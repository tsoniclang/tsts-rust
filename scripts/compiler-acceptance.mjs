export const compilerAcceptanceCases = Object.freeze([
  Object.freeze({ name: "valid", roots: ["valid.ts"], status: 0, files: ["valid.js"] }),
  Object.freeze({ name: "literals", roots: ["literals.ts"], status: 0, files: ["literals.js"] }),
  Object.freeze({ name: "imports", roots: ["imports.ts"], status: 0, files: ["definitions.js", "imports.js"] }),
  Object.freeze({ name: "syntax", roots: ["syntax.ts"], status: 1, files: [], diagnostic: "TS1109" }),
  Object.freeze({ name: "semantic", roots: ["semantic.ts"], status: 1, files: [], diagnostic: "TS2322" }),
]);

export function compareCompilerExecution(expected, reference, product) {
  const failures = [];
  for (const [name, result] of [["reference", reference], ["product", product]]) {
    if (result.error !== undefined) failures.push(`${name}: ${result.error}`);
    if (result.signal !== null) failures.push(`${name}: terminated by ${result.signal}`);
    if (result.status !== expected.status) failures.push(`${name}: expected exit ${expected.status}, received ${result.status}`);
    if (expected.diagnostic !== undefined && !result.stdout.includes(expected.diagnostic) &&
      !result.stderr.includes(expected.diagnostic)) failures.push(`${name}: missing ${expected.diagnostic}`);
    if (JSON.stringify(result.files.map(file => file.path)) !== JSON.stringify(expected.files)) {
      failures.push(`${name}: emitted file inventory differs from the fixture contract`);
    }
  }
  if (reference.stdout !== product.stdout) failures.push("stdout differs");
  if (reference.stderr !== product.stderr) failures.push("stderr differs");
  if (JSON.stringify(reference.files) !== JSON.stringify(product.files)) failures.push("emitted bytes differ");
  return Object.freeze(failures);
}
