# PASMO Z80 Assembler Integration Plan

Status: **proposed** — nothing implemented yet.

Goal: let a Klive project use [PASMO](https://pasmo.speccy.org/) (Julián Albo, GPL) as its
assembler, the way it can use sjasmplus today: pick or validate the executable in a dialog, store it
in user or project settings, compile the build root with it, and run and debug the result with source
lines and labels.

This plan follows the sjasmplus integration file by file. §1 maps that integration. §2 lists what is
different about PASMO, and those differences drive the decisions in §3. §4 to §6 are the work.

---

## 1. How sjasmplus is integrated (the pattern to copy)

| Layer | sjasmplus file(s) | Role |
|---|---|---|
| Setting keys | `src/main/sjasmp-integration/sjasmp-config.ts` | `sjasmp.root`, `sjasmp.executablePath`, `sjasmp.version`, `sjasmp.keepTempFiles`, plus the shared "configured executable failed" message |
| Resolver | `src/main/sjasmp-integration/sjasmplus-resolver.ts` | settings → executable path (explicit path, otherwise folder + `sjasmplus[.exe]`), and the "not configured" / "not working" messages |
| Install service | `src/main/sjasmp-integration/sjasmplus-integration-service.ts` | `probe…Path` (folder or file), PATH suggestions, GitHub release list and download/extract, `validate…Executable` (assembles a 3-byte probe program and checks the bytes), version read |
| IPC types | `src/common/messaging/SjasmplusIntegration.ts` | probe, release and apply request/result types |
| Main API | `src/common/messaging/MainApi.ts` (stubs + `downloadSjasmplusRelease` in the long-call list), `src/main/RendererToMainProcessor.ts` (implementations, incl. `applySjasmplusIntegration` writing user settings or project settings + `saveKliveProject`) | renderer → main calls |
| Command-line wrapper | `src/script-packages/sjasm/sjasm.ts` | `SjasmOptions` option table, `createSjasmRunner` (a `CliManager`), fixed temp outputs `_output.bin/.txt/.sld.txt` |
| Compiler | `src/main/sjasmp-integration/SjasmPCompiler.ts` | `IKliveCompiler` with `language = "sjasmp"`: runs the assembler, cuts the binary into segments using the listing, reads SLD for the source map, symbols, DeZog `K` annotations and banked partitions, picks the model (`DEVICE` or machine), `lineCanHaveBreakpoint`, `getErrorFilterDescription` |
| Registry | `src/main/compiler-integration/compiler-registry.ts` | `registerCompiler(new SjasmPCompiler())` |
| Editor language | `src/renderer/appIde/project/sjasmZ80LanguageProvider.ts` (registered in `src/renderer/registry.ts`) | Monaco tokens, `compiler: "SjasmPCompiler"`, breakpoints, build root |
| File types | `src/renderer/registry.ts` (`.sjasm` → `subType: "sjasmp"`, `canBeBuildRoot`), icon `src/renderer/assets/icons/file-sjasmp.svg` | the explorer and editor binding |
| Integration dialog (MVC) | `src/renderer/appIde/dialogs/sjasmplus/` (Model, Intents, Ports, Controller, ViewModel, View, Dialog container, `parts/`) | local / online setup, user / project scope, Test and Apply; the reference implementation of `.ai/ui-mvc-guide.md` |
| Dialog plumbing | `src/common/messaging/dialog-ids.ts` (`SJASMPLUS_INTEGRATION_DIALOG = 6`), `ideDialogRegistry.tsx`, `commands/DialogCommands.ts` | open the dialog |
| Settings page | `src/common/settings/settings-pages.ts` (`integrations` / "Assemblers" row, button `dialog:sjasmplus`), `src/common/settings/ui-action-ids.ts`, `src/main/ui-actions.ts` | entry point from Settings |
| IDE command | `src/renderer/appIde/commands/SjasmPlusCommands.ts` (`sjasmp-reset`), registered in `IdeCommands.ts` | set or clear the install folder from the prompt |
| Command line | `src/cli/compile.ts` (`--sjasmplus`, `SJASMPLUS` env, settings, PATH), `src/cli/project.ts` (extension → language) | headless `klive build/run/test` |
| Project templates | `src/public/project-templates/<machine>/sjasmplus/` (`__$klive.project` maps `"sjasmp": ".asm|.sjasm"`, `build.ksx`, `code/code.asm`) | New Project dialog |
| Cross-cutting consumers | `common/profile/routineMap.ts` (`sourceType`), `unit-tests/*` (DeZog tests), `common/reverse/sourceExport.ts`, `annotations/symbolResolver.ts` | read the debuggable output |
| Docs | `docs/content/working-with-ide/sjasmp.mdx` | user documentation |
| Tests | `test/main/sjasmplus-*.test.ts`, `test/sjasm-int/*`, `test/dialogs/sjasmplus/*`, `test/script-packages/sjasmp/*`, `test/main/sjasm-cli-options.test.ts` | |

PASTA/80 (`src/main/pasta80-integration/`) is a smaller example of the same idea: no dialog, only
setting keys and a `reset` command, and it calls `CliRunner` directly with no option table.

## 2. What is different about PASMO

These come from the official reference (`pasmodoc.html`, version 0.5.5, 2022). Items marked **verify**
are not documented. Phase 0 settles them by running the real executable.

1. **Command line.** `pasmo [options] file.asm file.bin [file.symbol [file.publics]]`. Output format
   flags: `--bin` (default), `--hex`, `--tap`, `--tzx`, `--tapbas`, `--plus3dos`, and others. Also
   `-I dir`, `--equ name=value`, `--nocase`, `--alocal`, `--bracket`, `--w8080`, `--err` (errors to
   stdout), `-d` / `-1` (debug trace of pass 2 / both passes, to stdout), and `-v`.
2. **No listing file and no SLD.** sjasmplus gives Klive both of these. PASMO gives neither. Its only
   machine-readable outputs are the object file and a symbol file. **This is the main design
   problem** (decision D2).
3. **Symbol file.** It is a list of `name EQU value` lines that can be INCLUDEd. Local labels are
   printed as 8-digit hex numbers. Labels and EQUs look identical in it.
4. **`--bin` writes one block** from the first address used to the last, with no header. Code at
   `ORG $8000` and `ORG $C000` comes out as one 16K block that includes the gap. `--hex` (Intel HEX)
   gives each address range exactly (decision D3).
5. **No `DEVICE`, no banks, no Z80N.** Output is a flat 64K. There is nothing to read a model from,
   and no Next instructions.
   **ZX Spectrum Next: not supported.** PASMO is a classic Spectrum assembler in Klive. The 0.5.5
   reference lists none of these:
   - the Z80N instructions (`NEXTREG`, `MUL D,E`, `LDIRX`, `PIXELAD`, `SWAPNIB`, `TEST n`, ...);
   - 8K pages or MMU slots;
   - `.nex` output (sjasmplus's `SAVENEX`).

   Plain Z80 code that PASMO assembles still runs on Klive's Next machine. Z80N instructions can only
   be hand-encoded as bytes (e.g. `NEXTREG $07,3` as `DB $ED,$91,$07,$03`). The source map and the
   disassembly then treat those lines as data, and banked code cannot be debugged.

   Consequences:
   - no `zxnext/pasmo` template;
   - the editor language has no Z80N keywords;
   - the user docs carry an explicit "Next: not supported" note.

   Phase 0 confirms the missing Z80N support against the real executable.
6. **Error text is undocumented (verify).** Recent builds are believed to print a two-line
   `ERROR on line N of file F` / `ERROR: message` pair. `CliRunner` already accepts an error-line
   splitter (`setErrorLineSplitter`), so a multi-line form can be handled.
7. **Distribution.** There are no GitHub releases and no Homebrew formula (checked: `brew info pasmo`
   finds nothing). There are Windows binaries and a source tarball on the author's site, and a
   Debian/Ubuntu `pasmo` package. sjasmplus's online download panel has nothing to download from
   here (decision D4).
8. **Directives differ** from sjasmplus: `PROC`/`ENDP`/`LOCAL`/`PUBLIC`, `MACRO`/`ENDM`/`EXITM`,
   `REPT`, `IRP`, `.ERROR`, `.WARNING`, `.SHIFT`, `DEFL`, `IF`/`IFDEF`/`IFNDEF`, `INCLUDE`/`INCBIN`, and
   `END [entry]`. The editor language and `lineCanHaveBreakpoint` need their own directive list.

## 3. Decisions to make before coding

| # | Question | Recommendation |
|---|---|---|
| D1 | Language id and extension | `language = "pasmo"`, compiler id `PasmoCompiler`, extension `.pasmo`. Templates map `"pasmo": ".asm|.pasmo"` the way the sjasmplus templates do. |
| D2 | Where the source map comes from | **Phase 0 spike.** (a) If the `-d` pass-2 trace prints, for each emitted line, the address, the file and the line, parse it. This is the preferred source. (b) If it does not give enough, have Klive run `-d` with `--err`, capture the trace, and match it to source lines itself. (c) If neither works, ship v1 without source-level stepping: labels from the symbol file only, and breakpoints on disassembly. Decide (a)/(b)/(c) from the spike before Phase 2. |
| D3 | Binary output | Assemble with `--hex` and parse the Intel HEX into `BinarySegment`s. This gives exact segments with no listing heuristics (unlike `extractSegmentsFromListFile`) and does not overwrite the gaps between ORGs. |
| D4 | Setup dialog | **Make the sjasmplus dialog generic rather than copying it.** It is about 1,700 lines plus about 1,000 lines of tests, and most of it does not depend on the tool. Move it to `dialogs/assemblerIntegration/` behind a `ToolIntegrationDescriptor`: display name, executable name(s), settings keys, repository URL, an **optional** release source, and the service port. Migrate sjasmplus first, with its tests unchanged and green. PASMO then needs only a descriptor with no release source: the online panel is hidden and a "Get PASMO" link opens the author's page. The alternative is a pruned copy with local setup only. It is faster, but it doubles code that must change in step. |
| D5 | Model and banking | Use the running machine (`getSjasmModelType`'s fallback branch, moved to a shared helper). Never emit partitions. Next projects are not offered (no Z80N). Templates: sp48, sp128, spp3e, timex, scorpion. |
| D6 | Symbol kinds | All symbol-file entries are `EQU` lines. Classify a name as a **Label** when the source defines it as `name:` or as a bare label at column 0 (a cheap scan of the files the source map names), and as an **Equ** otherwise. Drop the 8-digit hex local names, or keep them as `isLocal` when D2 gives their definition line. This matters to the profiler and Execution History (`.plans/PROFILER_PLAN.md` D8a). |
| D7 | DeZog comments (`LOGPOINT`/`ASSERTION`/`WPMEM`) and unit tests | Out of scope for v1. Comments can come later by scanning source comments and mapping line → address through the source map. sjasmplus gets them from SLD `K` lines, which PASMO does not have. DeZog unit tests depend on sjasmplus macros: leave `UNIT_TEST_LANGUAGES` unchanged. |
| D8 | Provenance | PASMO is GPL. Integrate by **running** it only. Copy no code from it, as with sjasmplus. |

## 4. Phases

### Phase 0 — Spike (no product code)
- Get PASMO 0.5.5 (built from source on macOS, the Windows binary on Windows). This needs a download,
  which the user approves.
- Confirm that Z80N mnemonics (e.g. `nextreg $07,3`, `mul d,e`) are rejected, and record the error
  (§2.5).
- Record facts in Klive's own words in `.ai/pasmo/cli-facts.md`:
  - the exact `-d` trace format;
  - the error and warning text, on stderr and with `--err`;
  - exit codes;
  - the `--hex` layout across multiple ORGs;
  - how the symbol file shows locals, PROC locals and macro labels;
  - `--version` / banner output, for reading the version.
- Save sample outputs as fixtures under `test/pasmo-int/fixtures/`.
- Result: choose D2 (a), (b) or (c). Write the error regex or splitter.

### Phase 1 — Main-process integration
- `src/main/pasmo-integration/pasmo-config.ts`: `PASMO_ALL = "pasmo"`, `pasmo.root`,
  `pasmo.executablePath`, `pasmo.version`, `pasmo.keepTempFiles`, `PASMO_CONFIGURED_FAILED_MESSAGE`.
- `pasmo-resolver.ts`: the same shape as `sjasmplus-resolver.ts` (`pasmo` / `pasmo.exe`). If D4 is
  generic, also extract the shared `normalizeExecutablePath` and the settings-reader helpers.
- `pasmo-integration-service.ts`: `probePasmoPath`, `getPasmoPathSuggestions` (PATH scan),
  `validatePasmoExecutable` (assemble `ORG $8000 / ld a,$42 / ret` with `--bin` into a temp folder
  and check `3E 42 C9`), and `readPasmoVersion`. No release list or download.
- `src/common/messaging/PasmoIntegration.ts`: probe and apply types, either reused from the generic
  types (D4) or as aliases.
- `src/script-packages/pasmo/pasmo.ts`: a `PasmoOptions` option table and `createPasmoRunner`, so
  that `pasmo.*` options can be passed through like sjasmplus's. Fixed temp outputs `_pasmo.hex`,
  `_pasmo.sym`, `_pasmo.trace.txt`.
- `PasmoCompiler.ts` (`IKliveCompiler`):
  - resolve, check existence, run `--hex --err [-d] src out.hex out.sym`;
  - parse HEX → segments (D3), symbol file → symbols (D6), trace → `sourceMap` / `listFileItems` /
    `sourceFileList` (D2);
  - `sourceType: "pasmo"`, `injectOptions: { subroutine: true }`, `modelType` (D5);
  - `lineCanHaveBreakpoint` with PASMO's directive list, `getErrorFilterDescription` and a splitter
    if needed;
  - remove temp files unless `pasmo.keepTempFiles` is set.
- Register in `compiler-registry.ts`.
- `MainApi.ts` / `RendererToMainProcessor.ts`: `probePasmoPath`, `getPasmoPathSuggestions`,
  `validatePasmoExecutable`, `applyPasmoIntegration` (a user or project scope copy of
  `applySjasmplusIntegration`).
- `common/profile/routineMap.ts`: name `"pasmo"` in the routine header.

### Phase 2 — Renderer
- `pasmoLanguageProvider.ts`: Z80 mnemonics as in sjasmplus, PASMO directives, `;` comments,
  `compiler: "PasmoCompiler"`, `supportsBreakpoints` (only if D2 is (a) or (b)). Register it in
  `renderer/registry.ts` with a `.pasmo` file-type entry and a new `file-pasmo.svg` in
  `src/renderer/assets/icons/` (see that folder's README; theme-coloured, not a colour literal).
- Dialog (D4): `PASMO_INTEGRATION_DIALOG = 10` in `dialog-ids.ts`, a registry entry,
  `DialogCommands.ts` `pasmoIntegration`, `ui-action-ids.ts` `"dialog:pasmo"`, a `ui-actions.ts`
  case, and a `settings-pages.ts` "Assemblers" row "PASMO". Follow `.ai/ui-mvc-guide.md` and
  `.docs/dialog-mvc-pattern.md`.
- `commands/PasmoCommands.ts`: `pasmo-reset [path] [-p]`, registered in `IdeCommands.ts`.

### Phase 3 — Command line and templates
- `src/cli/compile.ts`: `resolvePasmo` (`--pasmo <path>`, then the `PASMO` env variable, then settings,
  then PATH), in the same order as `resolveSjasmplus`. `src/cli/project.ts`: `[".pasmo", "pasmo"]`.
- Templates `src/public/project-templates/{sp48,sp128,spp3e,timex,scorpion}/pasmo/`: `__$klive.project`
  (`"languages": { "pasmo": ".asm|.pasmo" }`), `build.ksx`, and `code/code.asm` written in PASMO syntax
  (`ORG`, `END start`). Check how the New Project dialog lists template folders and labels them.

### Phase 4 — Docs and bookkeeping
- `docs/content/working-with-ide/pasmo.mdx` plus `_meta.ts`, and a mention in `project-templates.mdx`.
  The page states near the top that the **ZX Spectrum Next is not supported**: no Z80N instructions,
  no banking, no `.nex` output, with sjasmplus as the Next alternative (see §2.5).
  Update `.plans/docs-routes.golden.txt`. Run `npm run doc:build && npm run doc:check`.
- Generated screenshots of the dialog with `scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`).
- Add PASMO to the "External toolchains" row of `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md`.
- Any style or icon change → `.ai/ui-theming-intent-and-lessons.md`.

## 5. Tests

- `test/main/pasmo-resolver.test.ts`, `pasmo-integration-service.test.ts`: probe, PATH suggestions
  and validate, with a fake executable (as in the sjasmplus tests).
- `test/pasmo-int/`:
  - HEX → segments with multiple ORGs and gaps;
  - symbol-file parsing, including hex locals;
  - Label/Equ classification;
  - trace → source map, from Phase 0 fixtures;
  - error regex/splitter on real captured stderr.
- Dialog: if generic (D4), the existing sjasmplus dialog tests stay unchanged and green, plus a
  descriptor test showing PASMO hides the online panel. If copied, a pruned copy of
  `test/dialogs/sjasmplus/*`.
- `test/commands/` for `pasmo-reset`, plus a `test/settings/settings-pages.test.ts` row.
- CLI: `resolvePasmo` order and the error when nothing is found.
- `test/main/projects-create.test.ts`: the new templates.
- Optional end-to-end test, only when `PASMO` is set on the machine: assemble a template and run it on
  the sp48 harness. It is skipped in CI unless CI installs PASMO (Debian package).
- Then `npm run build:check`, `npm run lint:renderer`, and
  `npx electron-vite build --config build/electron.vite.config.ts`.

## 6. Risks

- **The source map (D2) is the whole debugging story.** If the `-d` trace is unusable, v1 can run
  PASMO programs but cannot step through their source. That is still useful, but say so plainly in
  the docs.
- **Error format (2.6)** varies between versions. Pin the supported version (0.5.5) and record the
  version in settings, as sjasmplus does.
- **Generalizing the dialog (D4)** touches code that already works. Mitigation: migrate sjasmplus
  first in its own change, with its tests kept as they are.
