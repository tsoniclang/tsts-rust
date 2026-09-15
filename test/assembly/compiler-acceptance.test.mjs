import assert from "node:assert/strict";
import test from "node:test";
import { compareCompilerExecution, compilerAcceptanceCases } from "../../scripts/compiler-acceptance.mjs";

const valid = compilerAcceptanceCases[0];
const passing = Object.freeze({
  status: 0, signal: null, stdout: "", stderr: "",
  files: [Object.freeze({ path: "valid.js", bytes: 12, sha256: "a".repeat(64) })],
});

test("native compiler acceptance requires identical successful bytes and expected output", () => {
  assert.deepEqual(compareCompilerExecution(valid, passing, passing), []);
  const empty = { ...passing, files: [] };
  assert.ok(compareCompilerExecution(valid, empty, empty).length > 0);
  for (const product of [
    { ...passing, status: 1 },
    { ...passing, stdout: "unexpected output" },
    { ...passing, stderr: "unexpected warning" },
    { ...passing, signal: "SIGKILL", status: null },
    { ...passing, error: "spawn timed out" },
    { ...passing, files: [{ ...passing.files[0], sha256: "b".repeat(64) }] },
    { ...passing, files: [{ ...passing.files[0], path: "elsewhere.js" }] },
  ]) assert.ok(compareCompilerExecution(valid, passing, product).length > 0);
});

test("negative acceptance proves the intended diagnostics and no emitted files", () => {
  const syntax = compilerAcceptanceCases.find(fixture => fixture.name === "syntax");
  const rejected = { status: 1, signal: null, stdout: "error TS1109: Expression expected.\n", stderr: "", files: [] };
  assert.deepEqual(compareCompilerExecution(syntax, rejected, rejected), []);
  assert.ok(compareCompilerExecution(syntax, passing, passing).length > 0);
  const wrongError = { ...rejected, stdout: "unrelated failure" };
  assert.ok(compareCompilerExecution(syntax, wrongError, wrongError).length > 0);
});
