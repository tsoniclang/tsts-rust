import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createScratchRun } from "./canonical-input.mjs";
import { compareCompilerExecution, compilerAcceptanceCases } from "./compiler-acceptance.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [referenceArgument, productArgument, outputArgument] = process.argv.slice(2);
if (process.argv.length !== 5) {
  throw new Error("Usage: check-compiler.mjs <native-tsgo-executable> <rust-compiler-executable> <new-.temp-run>");
}
const referencePath = await realpath(resolve(referenceArgument));
const productPath = await realpath(resolve(productArgument));
await access(referencePath, constants.X_OK);
await access(productPath, constants.X_OK);
const referenceHash = await digest(referencePath);
const productHash = await digest(productPath);
if (referencePath === productPath || referenceHash === productHash) {
  throw new Error("Reference and Rust product must be distinct executable artifacts");
}
const output = await createScratchRun(repository, resolve(outputArgument));
const fixtureRoot = resolve(output, "source");
await mkdir(fixtureRoot);
for (const entry of await readdir(resolve(repository, "test/fixtures/compiler"), { withFileTypes: true })) {
  if (!entry.isFile()) throw new Error("Compiler acceptance fixtures must be ordinary authored files");
  await copyFile(resolve(repository, "test/fixtures/compiler", entry.name), resolve(fixtureRoot, entry.name));
}
const results = [];
for (const fixture of compilerAcceptanceCases) {
  const reference = await execute("reference", referencePath, fixture);
  const product = await execute("product", productPath, fixture);
  const failures = compareCompilerExecution(fixture, reference, product);
  results.push({ name: fixture.name, reference, product, failures });
  console.log(`${fixture.name}: ${failures.length === 0 ? "PASS" : "FAIL"}`);
  for (const failure of failures) console.error(`  ${failure}`);
}
const report = {
  reference: { path: referencePath, sha256: referenceHash },
  product: { path: productPath, sha256: productHash },
  results,
};
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
process.exitCode = results.some(result => result.failures.length !== 0) ? 1 : 0;

async function execute(kind, executable, fixture) {
  const directory = resolve(output, fixture.name, kind);
  const emitted = resolve(directory, "emitted");
  await mkdir(emitted, { recursive: true });
  const arguments_ = [
    "--pretty", "false", "--strict", "--noLib", "--noEmitOnError",
    "--target", "es2022", "--module", "esnext", "--outDir", emitted,
    "globals.d.ts", ...fixture.roots,
  ];
  if (kind === "reference") arguments_.unshift("--singleThreaded");
  const result = spawnSync(executable, arguments_, {
    cwd: fixtureRoot,
    timeout: 60_000,
    killSignal: "SIGKILL",
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = result.stdout ?? Buffer.alloc(0);
  const stderr = result.stderr ?? Buffer.alloc(0);
  const stdoutText = stdout.toString("utf8");
  const stderrText = stderr.toString("utf8");
  const validEncoding = Buffer.from(stdoutText, "utf8").equals(stdout) &&
    Buffer.from(stderrText, "utf8").equals(stderr);
  const error = result.error?.message ?? (validEncoding ? undefined : "Compiler diagnostic output is not valid UTF-8");
  const record = {
    status: result.status,
    signal: result.signal,
    ...(error === undefined ? {} : { error }),
    stdout: stdoutText,
    stderr: stderrText,
    files: await artifacts(emitted),
  };
  await writeFile(resolve(directory, "stdout"), stdout, { flag: "wx" });
  await writeFile(resolve(directory, "stderr"), stderr, { flag: "wx" });
  await writeFile(resolve(directory, "execution.json"), JSON.stringify({ executable, arguments_, ...record }, null, 2) + "\n", { flag: "wx" });
  return record;
}

async function artifacts(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await artifacts(root, `${path}/`));
    else if (entry.isFile()) {
      const content = await readFile(resolve(root, path));
      files.push({ path, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
    } else throw new Error(`Compiler output is not an ordinary file/directory: ${path}`);
  }
  return files.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
