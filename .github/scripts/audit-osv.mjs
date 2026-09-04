#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ENDPOINT = "https://api.osv.dev/v1/querybatch";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BATCH_SIZE = 1_000;

function packageKey(name, version) {
  return `${name}\0${version}`;
}

function advisoryKey(name, version, advisoryId) {
  return `${packageKey(name, version)}\0${advisoryId}`;
}

// SheetJS publishes supported releases outside the npm registry. These exact
// records are pinned in package.json/package-lock.json, including SRI.
const APPROVED_EXTERNAL_PACKAGES = new Map([
  [
    packageKey("xlsx", "0.20.3"),
    {
      resolved: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
      integrity:
        "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==",
    },
  ],
]);

// OSV's imported ranges omit the vendor's fixed bounds for these advisories.
// GitHub and SheetJS both document fixes in 0.19.3 and 0.20.2 respectively.
const APPROVED_EXTERNAL_ADVISORY_EXCEPTIONS = new Set([
  advisoryKey("xlsx", "0.20.3", "GHSA-4r6h-8v6p-xvw6"),
  advisoryKey("xlsx", "0.20.3", "GHSA-5pgg-2g8v-p4x9"),
]);

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAuditArgs(args) {
  let prefix = ".";
  const omitted = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--prefix") {
      prefix = requireValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument.startsWith("--prefix=")) {
      prefix = argument.slice("--prefix=".length);
      if (!prefix) {
        throw new Error("--prefix requires a value");
      }
      continue;
    }

    let omitValue;
    if (argument === "--omit") {
      omitValue = requireValue(args, index, argument);
      index += 1;
    } else if (argument.startsWith("--omit=")) {
      omitValue = argument.slice("--omit=".length);
    } else {
      throw new Error(`Unsupported npm audit argument for OSV fallback: ${argument}`);
    }

    for (const dependencyType of omitValue.split(",")) {
      if (!["dev", "optional", "peer"].includes(dependencyType)) {
        throw new Error(`Unsupported dependency type for --omit: ${dependencyType}`);
      }
      omitted.add(dependencyType);
    }
  }

  return { prefix, omitted };
}

function packageNameFromPath(packagePath, metadata) {
  const marker = "node_modules/";
  const markerIndex = packagePath.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const packageName = packagePath.slice(markerIndex + marker.length);
  if (!packageName || packageName.includes("/node_modules/")) {
    throw new Error(`Unable to identify npm package from lockfile path: ${packagePath}`);
  }
  if (metadata.name !== undefined && metadata.name !== packageName) {
    throw new Error(`Lockfile package name does not match installed path: ${packagePath}`);
  }
  return packageName;
}

function shouldOmit(metadata, omitted) {
  return (
    (omitted.has("dev") && (metadata.dev || metadata.devOptional)) ||
    (omitted.has("optional") && (metadata.optional || metadata.devOptional)) ||
    (omitted.has("peer") && metadata.peer)
  );
}

export function collectNpmPackages(lockfile, omitted = new Set()) {
  if (!lockfile || typeof lockfile !== "object" || !lockfile.packages) {
    throw new Error("OSV fallback requires an npm lockfile with a packages map");
  }

  const packages = new Map();
  const externalPackages = new Map();
  const packageSources = new Map();

  for (const [packagePath, metadata] of Object.entries(lockfile.packages)) {
    if (!packagePath || !metadata || typeof metadata !== "object") {
      continue;
    }
    if (metadata.link || shouldOmit(metadata, omitted)) {
      continue;
    }

    const name = packageNameFromPath(packagePath, metadata);
    if (!name) {
      continue;
    }
    if (typeof metadata.version !== "string" || !metadata.version) {
      throw new Error(`Missing concrete version for production dependency: ${name}`);
    }
    const key = packageKey(name, metadata.version);
    let source = "standard";

    if (metadata.resolved !== undefined) {
      if (typeof metadata.resolved !== "string" || !metadata.resolved) {
        throw new Error(`Malformed dependency source for production dependency: ${name}`);
      }

      if (!/^https:\/\/registry\.npmjs\.org\//i.test(metadata.resolved)) {
        const approvedSource = APPROVED_EXTERNAL_PACKAGES.get(key);
        if (!approvedSource || approvedSource.resolved !== metadata.resolved) {
          throw new Error(`Unsupported external production dependency: ${name}`);
        }
        if (approvedSource.integrity !== metadata.integrity) {
          throw new Error(`External dependency integrity does not match approved artifact: ${name}`);
        }
        source = "approved-external";
      }
    }

    const existingSource = packageSources.get(key);
    if (existingSource && existingSource !== source) {
      throw new Error(`Mixed package sources for production dependency: ${name}@${metadata.version}`);
    }
    packageSources.set(key, source);

    if (source === "approved-external") {
      externalPackages.set(key, { name, version: metadata.version });
    }
    packages.set(key, { name, version: metadata.version });
  }

  const sortPackages = (left, right) =>
    left.name.localeCompare(right.name) || left.version.localeCompare(right.version);

  return {
    packages: [...packages.values()].sort(sortPackages),
    externalPackages: [...externalPackages.values()].sort(sortPackages),
  };
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export async function queryOsv(
  packages,
  {
    endpoint = DEFAULT_ENDPOINT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node.js runtime does not provide fetch");
  }

  const findings = [];

  for (let offset = 0; offset < packages.length; offset += MAX_BATCH_SIZE) {
    const batch = packages.slice(offset, offset + MAX_BATCH_SIZE);
    const timeout = createTimeoutSignal(timeoutMs);
    let response;

    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queries: batch.map(({ name, version }) => ({
            package: { name, ecosystem: "npm" },
            version,
          })),
        }),
        signal: timeout.signal,
      });
    } catch (error) {
      timeout.cancel();
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`OSV request failed: ${detail}`);
    }

    if (!response.ok) {
      timeout.cancel();
      throw new Error(`OSV request failed with HTTP ${response.status}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`OSV returned invalid JSON: ${detail}`);
    } finally {
      timeout.cancel();
    }

    if (!payload || !Array.isArray(payload.results) || payload.results.length !== batch.length) {
      throw new Error("OSV returned a malformed or incomplete batch response");
    }

    for (let index = 0; index < payload.results.length; index += 1) {
      const result = payload.results[index];
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("OSV returned a malformed result entry");
      }
      if (result.next_page_token) {
        throw new Error("OSV response requires unsupported pagination");
      }
      if (!("vulns" in result)) {
        continue;
      }
      if (!Array.isArray(result.vulns)) {
        throw new Error("OSV returned a malformed vulnerability list");
      }

      for (const vulnerability of result.vulns) {
        if (!vulnerability || typeof vulnerability.id !== "string" || !vulnerability.id) {
          throw new Error("OSV returned a vulnerability without an ID");
        }
        findings.push({
          id: vulnerability.id,
          name: batch[index].name,
          version: batch[index].version,
        });
      }
    }
  }

  return findings;
}

export function classifyOsvFindings(reportedFindings, externalPackages) {
  const externalPackageKeys = new Set(
    externalPackages.map(({ name, version }) => packageKey(name, version)),
  );
  const advisoryExceptions = [];
  const findings = reportedFindings.filter((finding) => {
    const key = packageKey(finding.name, finding.version);
    const exceptionKey = advisoryKey(finding.name, finding.version, finding.id);
    if (
      externalPackageKeys.has(key) &&
      APPROVED_EXTERNAL_ADVISORY_EXCEPTIONS.has(exceptionKey)
    ) {
      advisoryExceptions.push(finding);
      return false;
    }
    return true;
  });

  return { findings, advisoryExceptions };
}

export async function run(args, options = {}) {
  const { prefix, omitted } = parseAuditArgs(args);
  const lockfilePath = path.resolve(prefix, "package-lock.json");
  const lockfile = JSON.parse(await readFile(lockfilePath, "utf8"));
  const { packages, externalPackages } = collectNpmPackages(lockfile, omitted);

  if (packages.length === 0) {
    throw new Error(`No auditable production dependencies found in ${lockfilePath}`);
  }

  if (externalPackages.length > 0) {
    const approvedPackages = externalPackages
      .map(({ name, version }) => `${name}@${version}`)
      .join(", ");
    console.warn(
      `::warning::OSV fallback is checking approved integrity-pinned external package source(s): ${approvedPackages}`,
    );
  }

  const reportedFindings = await queryOsv(packages, options);
  const { findings, advisoryExceptions } = classifyOsvFindings(
    reportedFindings,
    externalPackages,
  );

  if (advisoryExceptions.length > 0) {
    const exceptions = advisoryExceptions
      .map(({ id, name, version }) => `${id} for ${name}@${version}`)
      .join(", ");
    console.warn(
      `::warning::Ignoring documented OSV range false positive(s) for the approved external artifact: ${exceptions}`,
    );
  }

  if (findings.length > 0) {
    console.error(`::error::OSV reported ${findings.length} vulnerable package version(s)`);
    console.error(JSON.stringify({ provider: "OSV", findings }, null, 2));
    return 1;
  }

  console.warn(
    "::warning::OSV fallback found no matching records; coverage differs from npm audit and remediation metadata is unavailable",
  );
  console.log(
    JSON.stringify({
      provider: "OSV",
      packages: packages.length,
      approvedExternalPackages: externalPackages.length,
      advisoryExceptions: advisoryExceptions.length,
      vulnerabilities: 0,
    }),
  );
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    process.exitCode = await run(process.argv.slice(2));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`::error::OSV fallback audit failed: ${detail}`);
    process.exitCode = 2;
  }
}
