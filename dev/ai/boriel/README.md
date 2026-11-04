# Boriel BASIC 2.x — reference notes for AI sessions

Boriel BASIC 2.x (`zxbc`, the native rewrite of the ZX BASIC compiler) is integrated into Klive as an
**external compiler**. Since 2026-11-04 it is the only BASIC compiler: Klive BASIC is switched off
(`dev/ai/klive-basic-switch.md`). This folder is the integration's record: how it is built
and why, what zxbc was observed to do (B0 measured `2.0.0-beta25`; the pin is now `2.0.0-beta29`,
re-checked 2026-10-24, see "Version history" below), and what is still open. The integration plan
was closed on 2026-11-04; its full text is in git history (`dev/plans/BORIEL_BASIC_INTEGRATION_PLAN.md`
before that date).

| File | What it is |
| --- | --- |
| `integration.md` | **How the integration is built**: the decisions (provenance, B1-B6, B-L1, B-T1, B-T2), packaging, the offer, the dialog, the installer, the compiler, the `.dbg` adapter, the debugger, banked programs, the UI, and the tests. Read it before changing `src/main/boriel-integration/`. |
| `technical-debt.md` | **What is still open**: a Windows run, the author's decisions, the readiness gate. |
| `limitations.md` | What Boriel BASIC cannot do that Klive BASIC could, and why. |
| `kit.md` | The setup kits: layout, platforms, hashes and download URLs, what an installer must do. The macOS first-launch trap is here. |
| `cli-and-diagnostics.md` | The command line Klive uses, the diagnostics format, and the traps (`project.ini`, `--debug=`, path forms). |
| `dbg-observed.md` | The `.dbg` file as zxbc actually writes it, checked against runs on the real 48K: what matches the published format, what the adapter must correct, and the run-time data layouts. |
| `boriel-issues.md` | Defects and gaps worth reporting to Boriel, each with a minimal program. |
| `updating.md` | **The action list for updating Klive to a new Boriel BASIC version** (the latest, or one the developer names). Follow it whenever a bump is asked for. |

## Rules that apply to everything here

- **Observed, not read.** Everything here comes from the kit's file listing, its `--help` text, the
  published docs (<https://zxbasic.readthedocs.io/en/v2.0/debug_format/>), and **running** zxbc on
  Klive's own small test programs, then inspecting the output files and the program's behaviour on
  Klive's 48K harness. Nobody opened the kit's runtime (`lib/*/runtime`) or stdlib sources. The
  Klive BASIC provenance rule (`dev/ai/kbasic/compiler.md`, "Provenance (hard rule)") still holds, so none of this
  may be used to design Klive BASIC's runtime.
- **zxbc never runs in CI** (B-T1): CI tests use the committed fixtures in `test/boriel/fixtures/`.
  **The kit is redistributed on Boriel's written permission for the beta** (B-L1): a production
  version needs its licence text shipped. Both are in `integration.md`, "Decisions".
- **Version-specific.** Facts are about the pinned kit, `2.0.0-beta29`, unless a note names
  another version. A kit update (B-T2, `integration.md`) means re-running
  the checks in "How to re-check" below and updating these files.
- **Platform coverage of B0** (2026-10-17, on an Apple Silicon Mac):

  | Kit | Status |
  | --- | --- |
  | arm64-macos | Ran natively. |
  | x86_64-macos | Ran under Rosetta. Output byte-identical. |
  | arm64-linux | Ran in an arm64 container. Output byte-identical. |
  | x86_64-linux | **Not run.** Docker's Rosetta emulation refuses the static binary (`rosetta error: bss_size overflow`). That is an emulator limit, not evidence of a broken kit. Check on a real x86_64 Linux machine or a CI runner. |
  | x86_64-win, arm64-win | **Not run.** No Windows host. |
  | armv6-linux | **Not run.** Apple Silicon has no AArch32. Klive ships no armv7l build anyway. |

  Since then the project author installed Klive's kit and ran it on macOS, Windows and Linux
  (2026-11-04). What is still unverified on Windows is in `technical-debt.md`.

## How to re-check

1. Extract a kit with code that adds no quarantine (Klive's installer, or `tar` followed by
   `xattr -cr` **before** the first launch, see `kit.md`), then run `zxbc --version`.
2. Compile probe programs with `--debug=<abs>.dbg -M <abs>.map -e <abs>.err -f bin -S 32768`,
   always with absolute paths and from an empty working folder.
3. Run the `.bin` on `test/harness/sp48`. Use the `runBinary` stub pattern from
   `test/kbasic/codegen/run-kit.ts`, set an exec breakpoint on every `statements[].startAddress`,
   and record SP, IX, A and the frame and global bytes at each stop. The B0 probe was a throwaway
   test in the `e2e-cores` project and was not kept. Phase B3's fixture tests replace it.

## Version history

| Version | Pinned | What the re-check found |
| --- | --- | --- |
| `2.0.0-beta25` | 2026-10-17 (B0) | The baseline every note was written against. |
| `2.0.0-beta29` | 2026-10-24 | Same kit layout (four new files under `lib/zxnext/runtime/`, not opened), same `--help`, same CLI facts and diagnostics, same `.dbg` keys and `version: 1`. **Fixed upstream:** a routine's last statement now ends at its `epilogueStart`, a `RETURN expr`-only body is no longer zero-length, and modular builds record each statement's real `callableIndex` (`dbg-observed.md` corrections 2, 14, 15; `boriel-issues.md` 3, 11, 12). The adapter keeps those corrections, which are no-ops on beta29 output and still needed for an older zxbc a user points Klive at. beta26-beta28 were skipped. Run natively on arm64-macos only; the other kits were checked for layout, not run. |
