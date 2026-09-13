import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [canonical, output] = process.argv.slice(2);
if (canonical === undefined || output === undefined || process.argv.length !== 4) {
  throw new Error("Usage: npm run build -- <canonical-directory> <new-.temp-run-directory>");
}

const emission = spawnSync(process.execPath, [
  resolve(root, "scripts/consume.mjs"), resolve(canonical),
  resolve(root, "assembly/runner.ts"), resolve(output),
], { stdio: "inherit" });
if (emission.error !== undefined) throw emission.error;
if (emission.status !== 0) process.exit(emission.status ?? 1);

const native = spawnSync("cargo", [
  "build", "--manifest-path", resolve(output, "output/Cargo.toml"),
], { stdio: "inherit" });
if (native.error !== undefined) throw native.error;
process.exitCode = native.status ?? 1;
