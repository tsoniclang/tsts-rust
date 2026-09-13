import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sharedCases } from "../test/support/shared-cases.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = name => {
  const value = process.env[name];
  if (value === undefined || !isAbsolute(value)) throw new Error(`${name} must select an absolute input path`);
  return value;
};
const go = required("TSTS_GO_BUILDER");
const gotots = required("TSTS_GOTOTS");
const tsgo = required("TSTS_TSGO");
const moduleCache = required("TSTS_GO_MODULE_CACHE");
const inputs = JSON.parse(readFileSync(resolve(root, "inputs.json"), "utf8"));
const targetProfile = JSON.parse(readFileSync(resolve(root, "rust-target.json"), "utf8"));
const runRoot = resolve(root, ".temp", `shared-${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(runRoot, { recursive: true });
const environment = { ...process.env, GOTOOLCHAIN: "local", GOMODCACHE: moduleCache,
  GOCACHE: resolve(root, ".temp/go-cache"), CARGO_TARGET_DIR: resolve(root, ".temp/shared-cargo") };
const rows = [];
let failure = false;

function run(name, command, arguments_) {
  const stdoutPath = resolve(runRoot, `${name}.stdout`);
  const stderrPath = resolve(runRoot, `${name}.stderr`);
  const stdout = openSync(stdoutPath, "wx");
  const stderr = openSync(stderrPath, "wx");
  const started = performance.now();
  let result;
  try {
    result = spawnSync("bash", [resolve(root, "scripts/run-guarded.sh"), command, ...arguments_], {
      cwd: root, env: environment, stdio: ["ignore", stdout, stderr], timeout: 340000,
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
  const row = { name, command, arguments: arguments_, status: result.status, signal: result.signal,
    error: result.error?.message, milliseconds: Math.round(performance.now() - started) };
  rows.push(row);
  writeFileSync(resolve(runRoot, "results.json"), JSON.stringify(rows, null, 2) + "\n");
  const success = result.status === 0 && result.signal === null && result.error === undefined;
  console.log(`${name}: ${success ? "PASS" : "FAIL"} (${row.milliseconds}ms)`);
  if (!success) failure = true;
  return success;
}

for (const name of Object.keys(sharedCases)) {
  const fixture = resolve(runRoot, name);
  if (!run(`${name}-stage`, process.execPath, [resolve(root, "scripts/stage-shared-fixture.mjs"), name, fixture])) continue;
  if (!run(`${name}-go`, go, ["-C", resolve(fixture, "go"), "run", "./cmd/oracle"])) continue;
  assert.equal(readFileSync(resolve(runRoot, `${name}-go.stdout`), "utf8"), sharedCases[name].expected);
  if (!run(`${name}-generate`, gotots, ["build", "-c", resolve(fixture, "gotots.json"),
    "--distribution-root", resolve(root, inputs.gotots.root), "--go", go, "--tsgo", tsgo,
    "--tool-cache", resolve(root, ".temp/go-tools")])) continue;
  const target = resolve(fixture, "target");
  if (!run(`${name}-rust`, process.execPath, [resolve(root, "scripts/consume.mjs"),
    resolve(fixture, "canonical"), resolve(fixture, "runner.ts"), target])) continue;
  if (!run(`${name}-cargo`, "cargo", ["build", "--offline", "--quiet", "--manifest-path", resolve(target, "output/Cargo.toml")])) continue;
  if (!run(`${name}-execute`, resolve(environment.CARGO_TARGET_DIR, "debug", targetProfile.options.crateName), [])) continue;
  assert.equal(readFileSync(resolve(runRoot, `${name}-execute.stdout`), "utf8"), sharedCases[name].expected);
  assert.equal(readFileSync(resolve(runRoot, `${name}-execute.stderr`), "utf8"),
    readFileSync(resolve(runRoot, `${name}-go.stderr`), "utf8"));
}
console.log(`Evidence: ${runRoot}`);
process.exitCode = failure ? 1 : 0;
