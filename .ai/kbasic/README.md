# Klive BASIC — reference notes for AI sessions

Klive BASIC is Klive's own ZX BASIC compiler (plan: `.plans/ZXBASIC_COMPILER_PLAN.md`). This
folder holds the facts that plan depends on, gathered once so that no later session has to
rediscover them — and, above all, so that no session is tempted to read upstream compiler or
runtime source to find them.

| File | What it is |
| --- | --- |
| `runtime-abi.md` | The binary interface a ZX BASIC program and its libraries expect: calling conventions, data layouts, program layout, runtime entry-point contracts, assembler features upstream's runtime relies on. **Facts about interfaces only** — Klive BASIC's runtime is written from scratch to be compatible with them. |
| `codebank-contract.md` | NextBuild's `CODEBANK` extension: syntax, rules, warnings, the far-call mechanism as a behavioural contract, build outputs, and the scenarios its examples cover. |
| `klive-integration-map.md` | Where Klive BASIC plugs into Klive: compiler registry and output types, the existing (unused) source-level debug model, breakpoint resolution, stepping, highlighting, watch and call-stack code, language providers, templates, tests and harnesses. With file references. |
| `stdlib-api.json` | The documented API of upstream's `#include <…>` libraries (names, signatures, one-line purpose), taken from the CC BY 4.0 documentation. The contract Klive BASIC's own standard library implements. |

The language itself is described in `../zxbasic-syntax/` (read its README first).

## Rules that apply to everything here

- **Provenance.** Upstream `boriel-basic/zxbasic` compiler code is AGPL; its runtime files are MIT
  by a README statement that the project author does not want to rely on. Klive BASIC therefore
  **copies, converts or translates no upstream code at all — compiler or runtime**. These notes
  record interfaces and behaviour (register contracts, byte layouts, entry-point names, documented
  signatures), which is what compatibility needs, in Klive's own words. When writing a runtime
  routine, work from these notes and from the Z80/ROM documentation; do not open upstream runtime
  files.
- **Running upstream is allowed; reading its code for design is not.** A locally installed `zxbc`
  may compile Klive's own test programs so their observable behaviour (screen, memory, error
  reports) can be recorded as an oracle (plan D12, R9, `scripts/kbasic-oracle.cjs`). Commit only
  those results — never the generated code — and never run it in CI.
- **Installed oracle (this machine, 2026-09-26):** `~/zxbasic` is a clone of
  `boriel-basic/zxbasic` at commit `b8d3cd706b07620f4366418fb78f1ac43076da92` (tag `v1.19.0`) —
  the exact commit `../zxbasic-syntax/upstream-fingerprint.json` pins. It needs Python ≥ 3.14
  (installed via `brew install python@3.14`, since the machine's default `python3` was 3.12); the
  package is installed into its own virtual environment at `~/zxbasic/.venv`, isolated from the
  system Python. `KBASIC_ORACLE_ZXBC=~/zxbasic/.venv/bin/zxbc` is the path `scripts/kbasic-oracle.cjs`
  (R9, not yet written) should use; `zxbasm` and `zxbpp` live alongside it. A prior 1.17.1 checkout
  was moved to `~/zxbasic-1.17.1.bak`. Nothing under `~/zxbasic` is part of this repository.
- **The notes describe upstream as of v1.19.0** (the release `../zxbasic-syntax/` is pinned to)
  and NextBuild's fork `1.18.7-nb10`. Items marked *(unverified)* were not confirmed directly.
- Keep these files current: when a decision or a verified fact changes, fold it in and replace
  what it supersedes; do not keep history here (the plan's status lines are the history).
