# TSTS Rust

Rust product assembly for Microsoft's TypeScript-Go compiler, translated by
GoToTS. This product consumes **canonical GoToTS output directly**:

```text
selected TS-Go source -> GoToTS -> canonical TypeScript + neutral markers
                                               |
                                     Tsonic host + Rust target
                                               |
                                     Rust source -> Cargo -> native TSTS
```

The TypeScript target and its lowered JavaScript-oriented output are not in
this path. The existing TSTS product performs the analogous assembly for
TypeScript/Node; the two products need equivalent responsibilities and relevant
acceptance cases, not identical implementation files.

## Current boundary

This repository is an integration bootstrap, **not yet a working native TS-Go
compiler**. Direct GoToTS scalar output and a neutral pointer allocation,
identity, load/store program compile to Rust and execute successfully. The
shared scalar-pointer, array-storage and memory-view corpus currently fails
Rust source checking. Its generated helpers require `BigInt(...)`,
`globalThis.BigInt(...)`, `Object.freeze(...)`, and length-form
`new Array<T>(length)` contracts missing from the selected Rust source profile.

No declarations are injected, no generated code is patched, and no failure is
classified as successful compilation. Full-product provider selection,
reproducible toolchain assembly, and compiler runtime parity remain gated on
the actual consumer contracts. Additional backend failures may surface after
source checking passes.

## Ownership

- GoToTS owns Go semantics and canonical generation.
- Shared Tsonic owns checked marker facts.
- The Rust target owns source-profile admission, Rust lowering and printing.
- Cargo and the Rust runtime packages own native compilation and execution.
- This repository owns product configuration, necessary product-specific
  implementations, assembly, and differential acceptance.

Shared/compiler-owner repositories are read-only during this work. No Rust
compiler implementation is copied into the assembly. Generated source and
binaries stay under `.temp/` and are not committed.

## Local inputs

The bootstrap uses local packages from sibling repositories through explicit
`file:` development dependencies. Install links without rebuilding or modifying
those repositories:

```sh
npm install --ignore-scripts --offline --no-audit --no-fund
npm test
```

The owners must have built their public package distributions. This local
bootstrap is not a replacement for the eventual sealed product toolchain.
`inputs.json` pins the source revisions used for shared fixtures and identifies
the TS-Go product source. Git fixture blobs are read at those revisions, never
from potentially modified working files. `rust-target.json` selects the public
Rust target configuration. Cargo receives the target's generated manifest.

## Consume canonical output

Given a GoToTS canonical directory and an authored TypeScript entry exporting
`main(): void`:

```sh
npm run consume -- /path/to/canonical /path/to/runner.ts .temp/example-run
bash scripts/run-guarded.sh cargo run --offline \
  --manifest-path .temp/example-run/output/Cargo.toml
```

The run directory must be new. The consumer copies manifested bytes without
rewriting source, installing generated `runtime/` exactly once as
`@gotots/runtime`. `input.json` records each source member's SHA-256 and original
path; this content hash is distinct from GoToTS's source-semantic digest.
Diagnostics remain in the run directory. Output is published only after the
whole target returns successfully and every artifact path is validated.

External provider packages are not silently substituted. The full TS-Go product
needs an explicit executable provider/source-package selection; the current
bootstrap does not claim that Node-oriented declarations are Rust bodies.

## Shared acceptance corpus

The existing TSTS scalar-pointer example and GoToTS's 21 array-storage and 10
memory-view cases are selected in `test/support/shared-cases.mjs`. Their source
is reused, not reimplemented here. The small local scalar and pointer fixtures
are isolated bring-up controls without the larger Go runtime helper closure.

Set explicit bootstrap executable and cache paths, then run:

```sh
export TSTS_GO_BUILDER=/path/to/go1.26.4/bin/go
export TSTS_GOTOTS=/path/to/gotots
export TSTS_TSGO=/path/to/tsgo
export TSTS_GO_MODULE_CACHE=/path/to/go-module-cache
npm run check:shared
```

Every case snapshots source, verifies a native Go oracle, generates canonical
TypeScript, and invokes Rust. On successful Rust emission it separately builds
and executes the Cargo product and compares stdout/stderr. Independent cases
continue after a rejected target so the report captures the complete reached
class; the overall command exits nonzero if any case fails. Expected outputs
are the same ones asserted by the corresponding TSTS checks.

Resource-intensive commands run serially under a 6 GiB kernel memory ceiling,
zero swap, a five-minute timeout, two Go/Cargo workers and a 4 GiB Node heap.
This is the small-proof budget, not permission to run a full product under an
unmeasured resource policy. Logs and failed artifacts remain under `.temp/`.
