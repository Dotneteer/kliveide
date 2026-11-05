# Boriel BASIC: technical debt and open decisions

What is still open in the Boriel BASIC integration. Everything planned for it was implemented
(`integration.md`), and the plan was closed on 2026-11-04. When an item here is done or decided,
record the result where it belongs (`integration.md`, `kit.md`, `options.md`, ...) and remove the
item.

## Needs a run

1. **The `-I`/`-m` path separator on Windows.** Klive joins include and module folders into one
   `-I` and one `-m` with `path.delimiter`, which is `;` on Windows (`boriel-options.ts`). zxbc's help
   says "colon-separated" on every platform, but Windows paths hold colons, and nobody has run it on
   Windows. One run on a Windows host settles it:

   ```bash
   npm test -- test/main/boriel-compiler.test.ts
   ```

   The test "finds #includes and USEd modules in two include folders (the path separator)" passes
   on macOS and fails when the second folder is not searched. If it fails on Windows, change the
   separator for Windows and update `options.md`.

## The project author's decisions

2. **A CI install test.** No CI workflow installs the kit. The original plan wanted one per platform
   (it would also cover x86_64 Linux and both Windows kits, which B0 could not run here). The install
   ends with zxbc's version probe, and B-T1 keeps zxbc out of CI. The choice: no CI install test, or
   one that stops before the probe (extraction, modes, quarantine, marker, the `.pdb` skip).
3. **Banked 128K exports.** A banked 128K build exports zxbc's own tape, on which `-as`, `-n`, `-b`,
   `-scr` and the other loader options have no effect. Klive's own banked loader crashed until
   2026-11-04; it now CLEARs below the code and loads the program
   (`test/boriel/boriel-banked-tape.test.ts`). Switching the export back to Klive's loader would give
   the options back; it needs an IDE check run of the exported tape on the 128K.

## The readiness gate

Boriel BASIC became the only BASIC compiler on 2026-11-04 by the author's decision, before this gate
passed. It is what makes the beta sound; the documentation calls Boriel BASIC a beta until it is done.

4. **A production licence** for a non-beta Boriel version: its licence text in the installer and in
   `THIRD_PARTY_NOTICES.md` (`integration.md`, B-L1). The author says it is on its way.
5. **Install and update from a fresh `HOME`** on every shipped platform, with a failed install
   leaving no half-written folder and never touching an existing one. The author checked the install
   on macOS, Windows and Linux; a run from a fresh `HOME` is not recorded.

Done from the gate: every template and the debugger cases build, run and debug in the IDE
(`boriel-ide-check.cjs`, every part, 2026-11-04); a stale `.dbg` never drives the debugger (the
checksum check); the losses in `limitations.md` are accepted.

## Watch

6. **Klive sometimes does not quit** under the IDE check's Playwright driver: seen twice (after the
   `ui` part, and after a Next session paused at a breakpoint), not in the full run of 2026-11-04. The
   check kills such a process after 20 s and says so ("the app did not close in 20 s"). Not known to be
   Boriel-specific. If it shows up again, find what keeps the app alive.
