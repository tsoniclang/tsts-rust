import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { snapshotFixture } from "../../scripts/source-snapshot.mjs";
import { sharedCases } from "../support/shared-cases.mjs";

test("shared acceptance cases retain the existing TSTS denominators", () => {
  assert.equal(sharedCases.scalar.calls.length, 1);
  assert.equal(sharedCases["array-storage"].calls.length, 21);
  assert.equal(sharedCases["memory-views"].calls.length, 10);
  for (const selected of Object.values(sharedCases)) {
    assert.equal(selected.calls.length, selected.expected.trimEnd().split("\n").length);
  }
});

test("fixture snapshots use exact Git objects rather than mutable checkout files", async () => {
  await mkdir(".temp/assembly-tests", { recursive: true });
  const destination = await mkdtemp(resolve(".temp/assembly-tests/snapshot-"));
  const inputs = JSON.parse(await readFile("inputs.json", "utf8"));
  const selected = sharedCases.scalar;
  const record = await snapshotFixture(resolve("."), inputs.tsts, selected.directory, destination);
  assert.equal(record.revision, inputs.tsts.revision);
  assert.equal(record.fileCount, 2);
  assert.equal(await readFile(resolve(destination, "go.mod"), "utf8"), "module example.test/scalar\n\ngo 1.26.4\n");
  assert.match(await readFile(resolve(destination, "scalar.go"), "utf8"), /\(\*pointer\)\+\+/u);
  await assert.rejects(snapshotFixture(resolve("."), { ...inputs.tsts, revision: "main" }, selected.directory, destination));
});
