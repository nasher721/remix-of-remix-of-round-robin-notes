import { access, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { transform } from "esbuild";

const tsExtensions = new Set([".ts", ".tsx"]);

const resolveWithExtensions = async (basePath) => {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return basePath;
};

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const projectRoot = path.dirname(fileURLToPath(import.meta.url));
    const basePath = path.join(projectRoot, "..", "src", specifier.replace("@/", ""));
    const resolvedPath = await resolveWithExtensions(basePath);
    return defaultResolve(pathToFileURL(resolvedPath).href, context);
  }

  return defaultResolve(specifier, context);
}

export async function load(url, context, defaultLoad) {
  const parsedUrl = new URL(url);
  const ext = path.extname(parsedUrl.pathname);

  if (!tsExtensions.has(ext)) {
    return defaultLoad(url, context, defaultLoad);
  }

  const source = await readFile(parsedUrl, "utf8");
  const { code, map } = await transform(source, {
    loader: ext === ".tsx" ? "tsx" : "ts",
    format: "esm",
    sourcemap: "inline",
    target: "node18",
    sourcefile: parsedUrl.pathname,
  });

  return {
    format: "module",
    source: code,
    shortCircuit: true,
  };
}
