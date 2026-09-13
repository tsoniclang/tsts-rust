import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export function ownedPath(root, name) {
  if (typeof name !== "string" || name.length === 0 || isAbsolute(name) ||
      name.includes("\\") || name.split("/").some(part => part === ".." || part === "." || part === "")) {
    throw new Error(`Invalid artifact path: ${name}`);
  }
  return resolve(root, name);
}

export async function stageCanonicalInput(canonicalRoot, sourceRoot) {
  const input = await realpath(canonicalRoot);
  const manifest = JSON.parse(await readFile(resolve(input, "gotots-manifest.json"), "utf8"));
  if (manifest === null || typeof manifest !== "object" ||
      manifest.schemaVersion !== 1 || typeof manifest.semanticDigest !== "string" ||
      !/^[a-f0-9]{64}$/u.test(manifest.semanticDigest) || !Array.isArray(manifest.files) ||
      manifest.files.length === 0 || !manifest.files.every(name => typeof name === "string") ||
      new Set(manifest.files).size !== manifest.files.length ||
      !manifest.files.includes("gotots-manifest.json") || !manifest.files.includes("package.json")) {
    throw new Error("A canonical GoToTS manifest with distinct file members is required");
  }
  if (manifest.files.some(name => name === "runner.ts" || name === "tsonic.json" || name.startsWith("node_modules/"))) {
    throw new Error("Canonical input collides with assembly-owned source locations");
  }
  for (const name of manifest.files) ownedPath(input, name);
  const sources = [];
  const members = [];
  for (const name of manifest.files) {
    const file = ownedPath(input, name);
    if (!(await lstat(file)).isFile() || await realpath(file) !== file) {
      throw new Error(`Canonical member must be an unaliased regular file: ${name}`);
    }
    const bytes = await readFile(file);
    const targetName = name.startsWith("runtime/")
      ? `node_modules/@gotots/runtime/${name.slice("runtime/".length)}`
      : name;
    const destination = ownedPath(sourceRoot, targetName);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { flag: "wx" });
    if (name.endsWith(".ts") && !name.endsWith(".d.ts")) sources.push(targetName);
    members.push({ path: name, stagedPath: targetName, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  if (sources.length === 0) throw new Error("Canonical input contains no TypeScript source");
  return { semanticDigest: manifest.semanticDigest, rootFiles: sources.sort(), members };
}

export function requireScratchRoot(repositoryRoot, destination) {
  const inside = relative(resolve(repositoryRoot, ".temp"), resolve(destination));
  if (inside === "" || isAbsolute(inside) || inside === ".." || inside.startsWith("../")) {
    throw new Error("Build evidence must be in a new child directory of .temp");
  }
  return resolve(destination);
}

export async function createScratchRun(repositoryRoot, destination) {
  const path = requireScratchRoot(repositoryRoot, destination);
  const scratch = resolve(repositoryRoot, ".temp");
  await mkdir(scratch, { recursive: true });
  if (await realpath(scratch) !== scratch) throw new Error("The scratch root must not be a filesystem alias");
  const parts = relative(scratch, dirname(path)).split("/").filter(Boolean);
  let parent = scratch;
  for (const part of parts) {
    parent = resolve(parent, part);
    await mkdir(parent, { recursive: true });
    if (await realpath(parent) !== parent) throw new Error("Scratch parents must not be filesystem aliases");
  }
  await mkdir(path);
  return path;
}
