import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createScratchRun } from "./canonical-input.mjs";
import { snapshotFixture } from "./source-snapshot.mjs";
import { sharedCases } from "../test/support/shared-cases.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [name, destination] = process.argv.slice(2);
if (!Object.hasOwn(sharedCases, name) || destination === undefined || process.argv.length !== 4) {
  throw new Error(`Usage: stage-shared-fixture.mjs <${Object.keys(sharedCases).join("|")}> <new-.temp-directory>`);
}
const selected = sharedCases[name];
const inputs = JSON.parse(await readFile(resolve(repositoryRoot, "inputs.json"), "utf8"));
const runRoot = await createScratchRun(repositoryRoot, destination);
const sourceRoot = resolve(runRoot, "go");
const snapshot = await snapshotFixture(repositoryRoot, inputs[selected.owner], selected.directory, sourceRoot);
await writeFile(resolve(runRoot, "source-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
await mkdir(resolve(sourceRoot, "cmd/oracle"), { recursive: true });
await writeFile(resolve(sourceRoot, "cmd/oracle/main.go"),
  `package main\nimport (\n  "fmt"\n  fixture "${selected.importPath}"\n)\nfunc main() {\n` +
  selected.calls.map(call => `  fmt.Println(fixture.${call})`).join("\n") + "\n}\n", { flag: "wx" });
await writeFile(resolve(runRoot, "runner.ts"),
  `import "./program.js";\nimport * as fixture from "./packages/${selected.importPath}/_root/package.js";\n` +
  "export function main(): void {\n" +
  selected.calls.map(call => `  console.log(fixture.${call});`).join("\n") + "\n}\n", { flag: "wx" });
await writeFile(resolve(runRoot, "expected.stdout"), selected.expected, { flag: "wx" });
await writeFile(resolve(runRoot, "gotots.json"), JSON.stringify({
  schemaVersion: 4,
  distribution: { root: resolve(repositoryRoot, inputs.gotots.root) },
  source: { root: sourceRoot, package: ".", mode: "package" },
  go: { goos: "linux", goarch: "amd64", cgo: false, tags: [] },
  semantics: { integers: "fixed64-bigint", evaluationOrder: "preserve-go" },
  providers: { standardLibrary: false, externals: false },
  implementations: { packages: [], callables: [] },
  output: { directory: resolve(runRoot, "canonical") },
}, null, 2) + "\n");
console.log(`${name}: ${snapshot.fileCount} pinned source files, ${selected.calls.length} checks, ${runRoot}`);
