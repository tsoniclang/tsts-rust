import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createScratchRun, ownedPath, requireScratchRoot, stageCanonicalInput } from "../../scripts/canonical-input.mjs";

test("artifact paths cannot escape or alias their owned root", () => {
  for (const path of ["../bad", "/bad", "source/../bad", "source\\bad", "./bad", "a//b", ""]) {
    assert.throws(() => ownedPath("/product", path));
  }
  assert.equal(ownedPath("/product", "src/main.rs"), "/product/src/main.rs");
  assert.throws(() => requireScratchRoot("/product", "/product/src"));
  assert.throws(() => requireScratchRoot("/product", "/product/.temp"));
});

test("canonical source bytes remain unchanged, with one runtime module identity", async () => {
  await mkdir(".temp/assembly-tests", { recursive: true });
  const root = await mkdtemp(resolve(".temp/assembly-tests/input-"));
  const canonical = resolve(root, "canonical");
  const source = resolve(root, "source");
  await mkdir(resolve(canonical, "runtime"), { recursive: true });
  const files = ["gotots-manifest.json", "package.json", "program.ts", "runtime/scalars.ts"];
  await writeFile(resolve(canonical, "gotots-manifest.json"), JSON.stringify({
    schemaVersion: 1, semanticDigest: "1".repeat(64), files,
  }));
  await writeFile(resolve(canonical, "package.json"), '{"type":"module"}\n');
  const text = 'import type { int32 } from "@tsonic/core/types.js";\nexport type { int32 };\n';
  await writeFile(resolve(canonical, "runtime/scalars.ts"), text);
  await writeFile(resolve(canonical, "program.ts"), "export {};\n");
  const result = await stageCanonicalInput(canonical, source);
  assert.deepEqual(result.rootFiles, ["node_modules/@gotots/runtime/scalars.ts", "program.ts"]);
  assert.equal(await readFile(resolve(source, "node_modules/@gotots/runtime/scalars.ts"), "utf8"), text);
  assert.equal(result.members.length, files.length);
  await assert.rejects(stageCanonicalInput(canonical, source), { code: "EEXIST" });
});

test("invalid manifests cannot be accepted as canonical source", async () => {
  await mkdir(".temp/assembly-tests", { recursive: true });
  for (const files of [
    ["gotots-manifest.json", "package.json", 42],
    ["gotots-manifest.json", "package.json", "package.json"],
    ["gotots-manifest.json", "package.json", "../outside.ts"],
    ["gotots-manifest.json", "package.json", "runner.ts"],
    ["gotots-manifest.json", "package.json", "tsonic.json"],
    ["gotots-manifest.json", "package.json", "node_modules/other/index.ts"],
  ]) {
    const root = await mkdtemp(resolve(".temp/assembly-tests/invalid-"));
    await writeFile(resolve(root, "gotots-manifest.json"), JSON.stringify({
      schemaVersion: 1, semanticDigest: "1".repeat(64), files,
    }));
    await assert.rejects(stageCanonicalInput(root, resolve(root, "staged")));
  }
});

test("scratch transactions cannot overwrite or escape through a directory alias", async () => {
  await mkdir(".temp/assembly-tests", { recursive: true });
  const root = await mkdtemp(resolve(".temp/assembly-tests/scratch-"));
  const owned = await createScratchRun(root, resolve(root, ".temp/first"));
  await assert.rejects(createScratchRun(root, owned), { code: "EEXIST" });
  await mkdir(resolve(root, "outside"));
  await symlink(resolve(root, "outside"), resolve(root, ".temp/alias"));
  await assert.rejects(createScratchRun(root, resolve(root, ".temp/alias/escape")), /aliases/u);
});
