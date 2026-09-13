import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileProject } from "@tsonic/host";
import { createTargetRegistry } from "@tsonic/target-api";
import { createRustTargetPack } from "@tsonic/target-rust";
import { createGoAbiCapability } from "@gotots/abi";
import { createScratchRun, ownedPath, stageCanonicalInput } from "./canonical-input.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [canonical, runner, output] = process.argv.slice(2);
if (canonical === undefined || runner === undefined || output === undefined || process.argv.length !== 5) {
  throw new Error("Usage: node scripts/consume.mjs <canonical-directory> <runner.ts> <new-.temp-run-directory>");
}
const runRoot = await createScratchRun(repositoryRoot, output);
const sourceRoot = resolve(runRoot, "source");
await mkdir(sourceRoot);
const input = await stageCanonicalInput(resolve(canonical), sourceRoot);
await writeFile(resolve(runRoot, "input.json"), JSON.stringify(input, null, 2) + "\n");
await writeFile(resolve(sourceRoot, "runner.ts"), await readFile(resolve(runner)), { flag: "wx" });
const target = JSON.parse(await readFile(resolve(repositoryRoot, "rust-target.json"), "utf8"));
if (target.id !== "rust") throw new Error("This product must select the Rust target");
const project = {
  entryPoint: "runner.ts",
  rootFiles: [...input.rootFiles, "runner.ts"].sort(),
  rootDir: ".",
  outDir: resolve(runRoot, "output"),
  cacheDir: resolve(runRoot, "cache"),
  targets: [target],
};
const projectFilePath = resolve(sourceRoot, "tsonic.json");
await writeFile(projectFilePath, JSON.stringify(project, null, 2) + "\n");
const started = performance.now();
const result = compileProject({
  project,
  projectFilePath,
  registry: createTargetRegistry([createRustTargetPack()]),
  installedCapabilities: [createGoAbiCapability("rust")],
});
await writeFile(resolve(runRoot, "diagnostics.json"), JSON.stringify(result.diagnostics, null, 2) + "\n");
const errors = result.diagnostics.filter(diagnostic => diagnostic.category === "error");
const counts = {};
for (const diagnostic of errors) counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
console.log(JSON.stringify({ sourceFiles: input.rootFiles.length, errors: errors.length,
  counts, milliseconds: Math.round(performance.now() - started), evidence: runRoot }));
if (errors.length !== 0) {
  process.exitCode = 1;
} else {
  if (result.targets.length !== 1 || result.targets[0].compileResult.kind !== "resolved") {
    throw new Error("Rust target did not resolve exactly one output");
  }
  const artifacts = result.targets[0].compileResult.value.artifacts;
  const names = new Set();
  for (const artifact of artifacts) {
    ownedPath(runRoot, artifact.path);
    if (names.has(artifact.path)) throw new Error(`Duplicate target artifact: ${artifact.path}`);
    names.add(artifact.path);
  }
  const staged = resolve(runRoot, "staged");
  await mkdir(staged);
  for (const artifact of artifacts) {
    const destination = ownedPath(staged, artifact.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, artifact.text, { flag: "wx" });
  }
  await rename(staged, resolve(runRoot, "output"));
  console.log(`Rust artifacts: ${artifacts.length}; Cargo compilation is a separate gate.`);
}
