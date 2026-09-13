import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ownedPath } from "./canonical-input.mjs";

export async function stageProviderSourcePackage(packageRoot, sourceRoot, selection) {
  const root = await realpath(packageRoot);
  const sourceDirectory = ownedPath(root, selection.sourceDirectory);
  ownedPath(root, selection.declarationDirectory);
  if (typeof selection.name !== "string" || !/^@[a-z0-9-]+\/[a-z0-9-]+$/u.test(selection.name)) {
    throw new Error("Provider source selection requires an exact scoped package name");
  }
  const originalPackage = await readFile(resolve(root, "package.json"));
  const contract = JSON.parse(originalPackage.toString("utf8"));
  if (contract.name !== selection.name || contract.type !== "module" ||
    contract.exports === null || typeof contract.exports !== "object" || Array.isArray(contract.exports)) {
    throw new Error(`Provider source package '${selection.name}' has no matching ESM export contract`);
  }
  const sourceFiles = new Map();
  async function collect(directory, relativeDirectory) {
    if (await realpath(directory) !== directory) throw new Error("Provider sources cannot be filesystem aliases");
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      const path = ownedPath(root, relativePath);
      if (entry.isDirectory()) await collect(path, relativePath);
      else if (entry.isFile() && (await lstat(path)).isFile()) sourceFiles.set(relativePath, await readFile(path));
      else throw new Error(`Provider source '${relativePath}' is not a regular file or directory`);
    }
  }
  await collect(sourceDirectory, selection.sourceDirectory);
  const exports = {};
  const declarationPrefix = `./${selection.declarationDirectory}/`;
  for (const [specifier, target] of Object.entries(contract.exports)) {
    if (specifier === "./package.json" && target === "./package.json") {
      exports[specifier] = target;
      continue;
    }
    if (!specifier.startsWith("./") || specifier.includes("*") ||
      target === null || typeof target !== "object" || Array.isArray(target) ||
      typeof target.types !== "string" || !target.types.startsWith(declarationPrefix) ||
      !target.types.endsWith(".d.ts")) {
      throw new Error(`Provider export '${specifier}' has no exact selected declaration-to-source path`);
    }
    const relativePath = `${selection.sourceDirectory}/${target.types.slice(declarationPrefix.length, -5)}.ts`;
    ownedPath(root, relativePath);
    if (!sourceFiles.has(relativePath)) throw new Error(`Provider export '${specifier}' has no source '${relativePath}'`);
    exports[specifier] = `./${relativePath}`;
  }
  const destination = ownedPath(sourceRoot, `node_modules/${selection.name}`);
  await mkdir(destination, { recursive: true });
  const members = [];
  for (const [path, bytes] of sourceFiles) {
    const target = ownedPath(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    members.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const selectedPackage = { name: contract.name, version: contract.version, private: true, type: "module", exports };
  for (const key of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    if (contract[key] !== undefined) selectedPackage[key] = contract[key];
  }
  const packageBytes = JSON.stringify(selectedPackage, null, 2) + "\n";
  await writeFile(resolve(destination, "package.json"), packageBytes, { flag: "wx" });
  return {
    name: selection.name, root, selection,
    originalPackageSha256: createHash("sha256").update(originalPackage).digest("hex"),
    stagedPackageSha256: createHash("sha256").update(packageBytes).digest("hex"),
    members,
  };
}
