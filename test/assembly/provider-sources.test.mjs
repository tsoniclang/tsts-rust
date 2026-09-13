import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { stageProviderSourcePackage } from "../../scripts/provider-sources.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const selection = { name: "@example/provider", sourceDirectory: "src", declarationDirectory: "dist/src" };

async function fixture(exports) {
  const scratch = resolve(repository, ".temp/assembly-tests");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(resolve(scratch, "provider-"));
  const packageRoot = resolve(root, "package");
  const sourceRoot = resolve(root, "source");
  await mkdir(resolve(packageRoot, "src/internal"), { recursive: true });
  await mkdir(sourceRoot);
  await writeFile(resolve(packageRoot, "package.json"), JSON.stringify({
    name: selection.name, version: "0.0.0", type: "module", exports,
    peerDependencies: { "@gotots/runtime": "0.0.0" },
  }));
  await writeFile(resolve(packageRoot, "src/index.ts"), 'export { value } from "./internal/value.js";\n');
  await writeFile(resolve(packageRoot, "src/internal/value.ts"), "export const value = 42;\n");
  return { packageRoot, sourceRoot };
}

test("native provider assembly retains exact source bytes, exports and dependencies", async () => {
  const { packageRoot, sourceRoot } = await fixture({
    "./index.js": { types: "./dist/src/index.d.ts", default: "./dist/src/index.js" },
    "./package.json": "./package.json",
  });
  const receipt = await stageProviderSourcePackage(packageRoot, sourceRoot, selection);
  const destination = resolve(sourceRoot, "node_modules/@example/provider");
  const contract = JSON.parse(await readFile(resolve(destination, "package.json"), "utf8"));
  assert.deepEqual(contract.exports, { "./index.js": "./src/index.ts", "./package.json": "./package.json" });
  assert.deepEqual(contract.peerDependencies, { "@gotots/runtime": "0.0.0" });
  assert.deepEqual(receipt.members.map(member => member.path), ["src/index.ts", "src/internal/value.ts"]);
  for (const member of receipt.members) {
    assert.deepEqual(await readFile(resolve(destination, member.path)), await readFile(resolve(packageRoot, member.path)));
    assert.match(member.sha256, /^[a-f0-9]{64}$/u);
  }
  await assert.rejects(stageProviderSourcePackage(packageRoot, sourceRoot, selection), /EEXIST/u);
});

test("native provider assembly rejects unavailable and unselected source exports", async () => {
  for (const exports of [
    { "./missing.js": { types: "./dist/src/missing.d.ts" } },
    { "./index.js": { types: "./another/index.d.ts" } },
    { "./*.js": { types: "./dist/src/*.d.ts" } },
    { "./index.js": { types: "./dist/src/../../index.d.ts" } },
    { "./index.js": { default: "./dist/src/index.js" } },
  ]) {
    const { packageRoot, sourceRoot } = await fixture(exports);
    await assert.rejects(stageProviderSourcePackage(packageRoot, sourceRoot, selection));
  }
});

test("native provider assembly rejects wrong identities and aliased source files", async () => {
  const { packageRoot, sourceRoot } = await fixture({
    "./index.js": { types: "./dist/src/index.d.ts" },
  });
  await assert.rejects(stageProviderSourcePackage(packageRoot, sourceRoot, { ...selection, name: "@example/wrong" }), /matching ESM/u);
  await symlink(resolve(packageRoot, "src/index.ts"), resolve(packageRoot, "src/alias.ts"));
  await assert.rejects(stageProviderSourcePackage(packageRoot, sourceRoot, selection), /regular file/u);
});
