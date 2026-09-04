import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOsvFindings,
  collectNpmPackages,
  parseAuditArgs,
  queryOsv,
} from "./audit-osv.mjs";

const XLSX_INTEGRITY =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

test("parses npm prefix and omit arguments", () => {
  const parsed = parseAuditArgs([
    "--prefix",
    "clinical-mcp-server",
    "--omit=dev",
    "--omit",
    "optional",
  ]);

  assert.equal(parsed.prefix, "clinical-mcp-server");
  assert.deepEqual([...parsed.omitted].sort(), ["dev", "optional"]);
  assert.throws(() => parseAuditArgs(["--audit-level=high"]), /Unsupported npm audit argument/);
});

test("collects unique registry packages while honoring omitted dependency types", () => {
  const lockfile = {
    lockfileVersion: 3,
    packages: {
      "": { name: "app", version: "1.0.0" },
      "node_modules/prod": { version: "1.0.0" },
      "node_modules/nested/node_modules/prod": { version: "1.0.0" },
      "node_modules/@scope/package": { version: "2.0.0" },
      "node_modules/dev-only": { version: "3.0.0", dev: true },
      "node_modules/optional-only": { version: "4.0.0", optional: true },
      "node_modules/xlsx": {
        version: "0.20.3",
        resolved: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
        integrity: XLSX_INTEGRITY,
      },
      "node_modules/workspace": { link: true, resolved: "packages/workspace" },
    },
  };

  assert.deepEqual(collectNpmPackages(lockfile, new Set(["dev", "optional"])), {
    packages: [
      { name: "@scope/package", version: "2.0.0" },
      { name: "prod", version: "1.0.0" },
      { name: "xlsx", version: "0.20.3" },
    ],
    externalPackages: [{ name: "xlsx", version: "0.20.3" }],
  });
});

test("rejects unsupported production dependency sources", () => {
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/lodash": { name: "safe-package", version: "4.17.20" },
        },
      }),
    /package name does not match installed path/,
  );
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/from-git": {
            version: "1.0.0",
            resolved: "git+https://github.com/example/from-git.git",
          },
        },
      }),
    /Unsupported external production dependency/,
  );
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/unverified": {
            version: "1.0.0",
            resolved: "https://packages.example.test/unverified-1.0.0.tgz",
          },
        },
      }),
    /Unsupported external production dependency/,
  );
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/unapproved": {
            version: "1.0.0",
            resolved: "https://packages.example.test/unapproved-1.0.0.tgz",
            integrity: "sha512-test",
          },
        },
      }),
    /Unsupported external production dependency/,
  );
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/xlsx": {
            version: "0.20.3",
            resolved: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
            integrity: "sha512-changed",
          },
        },
      }),
    /integrity does not match approved artifact/,
  );
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/unknown-source": {
            version: "1.0.0",
            resolved: "workspace:packages/unknown-source",
          },
        },
      }),
    /Unsupported external production dependency/,
  );
});

test("rejects mixed approved and standard sources for one package version", () => {
  assert.throws(
    () =>
      collectNpmPackages({
        packages: {
          "node_modules/xlsx": {
            version: "0.20.3",
            resolved: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
            integrity: XLSX_INTEGRITY,
          },
          "node_modules/parent/node_modules/xlsx": {
            version: "0.20.3",
            resolved: "https://registry.npmjs.org/xlsx/-/xlsx-0.20.3.tgz",
            integrity: "sha512-other",
          },
        },
      }),
    /Mixed package sources/,
  );
});

test("maps ordered OSV results back to package versions", async () => {
  const packages = [
    { name: "safe", version: "1.0.0" },
    { name: "affected", version: "2.0.0" },
  ];
  const fetchImpl = async (_endpoint, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.queries[1].package.ecosystem, "npm");
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [{}, { vulns: [{ id: "GHSA-test" }] }] }),
    };
  };

  assert.deepEqual(await queryOsv(packages, { fetchImpl }), [
    { id: "GHSA-test", name: "affected", version: "2.0.0" },
  ]);
});

test("limits advisory exceptions to the approved external artifact and IDs", () => {
  const approvedFinding = {
    id: "GHSA-4r6h-8v6p-xvw6",
    name: "xlsx",
    version: "0.20.3",
  };
  const futureFinding = { id: "GHSA-future", name: "xlsx", version: "0.20.3" };
  const externalPackages = [{ name: "xlsx", version: "0.20.3" }];

  assert.deepEqual(classifyOsvFindings([approvedFinding, futureFinding], externalPackages), {
    findings: [futureFinding],
    advisoryExceptions: [approvedFinding],
  });
  assert.deepEqual(classifyOsvFindings([approvedFinding], []), {
    findings: [approvedFinding],
    advisoryExceptions: [],
  });
});

test("fails closed on unavailable or malformed OSV responses", async () => {
  const packages = [{ name: "package", version: "1.0.0" }];

  await assert.rejects(
    queryOsv(packages, {
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /HTTP 503/,
  );
  await assert.rejects(
    queryOsv(packages, {
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) }),
    }),
    /malformed or incomplete/,
  );
});
