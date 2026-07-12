import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] ?? "dist");
const secretCanaries = (process.env.CLIENT_SECRET_CANARIES || process.env.CLIENT_SECRET_CANARY || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (secretCanaries.length === 0) {
  console.error("CLIENT_SECRET_CANARIES must be set before checking a production bundle.");
  process.exit(1);
}

async function findCanary(directory) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...await findCanary(entryPath));
      continue;
    }
    const contents = await readFile(entryPath);
    for (const secretCanary of secretCanaries) {
      if (contents.includes(Buffer.from(secretCanary))) {
        matches.push({ entryPath, secretCanary });
      }
    }
  }
  return matches;
}

const matches = await findCanary(outputDirectory);
if (matches.length > 0) {
  console.error("A server-only credential canary was embedded in the client bundle:");
  matches.forEach(({ entryPath }) => console.error(`- ${entryPath}`));
  process.exit(1);
}

console.log(`${secretCanaries.length} client credential canaries are absent from ${outputDirectory}.`);
