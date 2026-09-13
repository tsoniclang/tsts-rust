# Agent Notes (TSTS Rust)

Read and follow `../tsonic/docs/architecture/workspace-agent-policy.md` before
any work.

## Product Ownership

This repository owns the Rust product assembly of Microsoft's selected TS-Go
compiler: source/toolchain selections, Rust product configuration, necessary
product-specific implementations, and generated/native differential proofs.

The input to the Rust target is canonical GoToTS output with shared neutral
markers, never the TypeScript target's lowered output. GoToTS owns Go semantics;
shared Tsonic owns marker facts; the Rust target owns Rust analysis and emission;
Cargo owns native compilation. Do not copy any of those owners into this product.

Tsonic, TSTS Legacy, the Rust target, and the Rust runtime/capability repositories
remain read-only. Report required changes to their owners with exact source
reproductions. Do not patch their source, compiled distributions, or submodules.
The existing TSTS JavaScript product must remain unchanged by this bootstrap.

Keep generated TypeScript, generated Rust, Cargo output, logs, and local proofs
under `.temp/`, untracked. Never hand-edit generated output to make a proof pass.
Use `.analysis/` for the necessity ledger, integration findings, and handoffs.

## Verification

Start with a small Go -> canonical TypeScript -> Rust -> executable proof before
attempting the full compiler. Compile-only output is not a runtime proof. Compare
the resulting compiler with the exact selected native TS-Go source, including
valid input, syntax/semantic diagnostics, exit status, and emitted file bytes.

Run resource-intensive commands serially with a kernel memory/swap ceiling and
timeout. Keep output bounded and retain failure logs. Never repeat an OOM with
the same resource policy. A Node heap limit alone is not an RSS ceiling.

## Pull Requests

Never use `gh` or PR APIs. Provide a creation URL for the pushed feature branch:
`https://github.com/tsoniclang/tsts-rust/compare/main...<branch>?quick_pull=1`.
