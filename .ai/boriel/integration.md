# How the Boriel BASIC integration is built

How Klive runs Boriel BASIC 2.x (`zxbc`) as its BASIC compiler: the decisions behind it, then each
part as it is built. It was implemented in phases B0-B6 (2026-10-17) of the integration plan, which
was closed on 2026-11-04 (git history: `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`). What zxbc
itself does is in the other files of this folder; what is still open is `technical-debt.md`; what
Boriel BASIC cannot do compared with Klive BASIC is `limitations.md`.

## Decisions

| # | Decision |
| --- | --- |
| Provenance | Klive runs zxbc as an external tool and reads its **documented** output (`.dbg`, `-M` map, diagnostics). Nobody reads the compiler, its runtime (`lib/*/runtime`) or its stdlib to design Klive BASIC, and no file from the kit is copied into Klive's source tree. The installer carries the kit as an opaque archive and extracts it on the user's machine: redistribution, not reuse. |
| B1 | Only Boriel BASIC **2.x** is supported; the 1.x (Python) integration and its `zxb-reset` command are gone. `zxbasic.compiler` is `klive` or `boriel`; an old `zxbc` value reads as `boriel`. **Since 2026-11-04 Klive BASIC is switched off** (`.ai/klive-basic-switch.md`) and the setting is ignored: Boriel BASIC builds every BASIC program. |
| B2 | The compiler choice is a user setting with a project override (`SettingsReader` merges them key by key, the project winning). |
| B3 | The install folder is the user setting `zxbasic.root` (like `sjasmp.root`); `zxbc[.exe]` is resolved from it. An explicit `zxbasic.executablePath` wins but must pass the same 2.x version probe. Keys: `boriel-config.ts`. |
| B4 | Each installer carries **only its own platform's kit**, staged into `extraResources` (see "The kits in the build"). |
| B5 | The kit is extracted by Klive's own code (`src/main/tool-install/archive.ts`, shared with sjasmplus): no `tar`/`unzip` process, no new dependency. |
| B6 | Boriel builds read Klive's `'@name value` header options and translate them to zxbc flags (`options.md`), so one `program.zxbas` builds under both compilers. |
| B-L1 | **Redistribution.** The project author holds Boriel's written permission (email) to bundle the beta kit. The kit ships no LICENSE file (`lib/NOTICE.md` names a proprietary licence for the binaries and calls `lib/` MIT apart from 216 header-less files), so a **production version needs its licence text in the installer and in `THIRD_PARTY_NOTICES.md`**. The UI says "Boriel BASIC 2.0 beta, redistributed with the author's permission". |
| B-T1 | **zxbc never runs in CI.** zxbc's output for Klive's own small programs is committed as fixtures in `test/boriel/fixtures/` (regenerated with `npm run boriel:fixtures`, never edited); CI tests the adapter and the debugger on them. This is an exception to Klive BASIC's D12, limited to that folder. Tests that run the real zxbc skip when no kit is installed. |
| B-T2 | **The version is pinned** in `vendor/boriel-basic/kit.json` (now `2.0.0-beta29`). A version change is deliberate and follows `updating.md`. |

## The kits in the build

- `vendor/boriel-basic/kit.json` (tracked) is the single source: `version`, `urlBase`, `mirrors`
  (empty today; tried after `urlBase` with the same hash check) and, per
  `process.platform`-`process.arch` key, the kit's `file`, `size` and `sha256`. `kits/` (all seven
  archives under Boriel's names) and `stage/` (the one kit a package includes) are git-ignored.
- `scripts/boriel-kit.cjs`: `fetch` downloads missing kits and verifies each hash, never overwriting
  a file that verifies; `stage --platform --arch` copies the target's kit and `kit.json` into a clean
  `stage/`, fetching it first. The `prepackage:*` scripts run `stage`, so a package build without a
  verified kit fails instead of shipping none; `predev` runs `fetch --current --optional`, which only
  warns offline.
- `package.json`'s `build.extraResources` has one entry, `vendor/boriel-basic/stage` → `boriel`.
  `"!vendor"` keeps the folder out of `files`. `build/electron-builder.json5` is stale: do not edit it.
- `borielKitPath()` (`boriel-kit.ts`) finds the kit: `process.resourcesPath/boriel/<file>` packaged,
  `vendor/boriel-basic/kits/<file>` in dev (searching upward from `app.getAppPath()`), or undefined
  when the installer carries no kit, and then no offer is made.
- Klive ships no Windows arm64 or armv7l build, so the `arm64-win` and `armv6-linux` kits are pinned
  but never shipped. Windows x64 Klive on ARM gets the x64 kit.

## The installation offer

`scheduleBorielSetupOffer` (`boriel-main.ts`, called from `src/main/index.ts`) checks in the
background from `app.whenReady`, and once per run after `startScreenDisplayed` opens the setup dialog
in the focused window, when all hold: a kit is bundled; `zxbasic.root` is unset or has no working
zxbc; `~/zxbasic2` has no working install (if it has one, Klive records that folder silently); the
user has not declined this kit version. The state is the top-level `AppSettings.borielSetup`
(`{ offeredVersion, declined, installedVersion? }`, `src/main/settings.ts`). An installed version
older than the kit brings the offer back as "Update"; `declined` is per offered version.
`offeredVersion: "*"` declines every version: the Playwright harnesses (`scripts/doc-shots/harness.cjs`,
`scripts/automation-ide-check.cjs`) seed it, and `launchKlive({ borielSetup: null })` seeds nothing.

## The setup dialog

`src/renderer/appIde/dialogs/boriel/` (MVC, `.ai/ui-mvc-guide.md`), id in `dialog-ids.ts`, opened by
the offer, by **Settings › Integrations › Boriel BASIC › Configure...**, by the status bar item and by
`display-dialog borielSetup`. It shows the status (not installed, installed `<version>` at `<folder>`,
broken, older than the kit), the folder (default `~/zxbasic2`, the user's home even for the portable
build, with Browse...), Install/Update/Repair, Not now, Don't ask again, and "Use an existing
installation...". The compiler switch it had is commented out while Klive BASIC is off
(`KLIVE-BASIC-OFF:` markers).

## The installer

`boriel-install-service.ts`, a MainApi long call with progress:

1. Refuse a folder that is not empty and has no previous Boriel marker, one under Klive's own
   installation or resources, or one that is not writable.
2. Verify the archive's SHA-256 against `kit.json`, then extract into `<target>.klive-tmp-XXXX`,
   stripping the top folder, honouring tar mode bits (GNU `ustar  ` magic included), with `0o755` as a
   fallback on the nine executables. The Windows `.pdb` files (34.5 MB of 46 MB) are skipped: no
   executable can load one (`kit.md`, "Layout").
3. On macOS, remove `com.apple.quarantine` **before anything in the folder runs**: a quarantined
   first launch blocks forever (`kit.md`). The probe's timeout kills the process and says macOS
   blocked zxbc.
4. Probe, then rename into place. An update renames the old folder aside and deletes it only after the
   probe passes; a failure restores it.
5. Write `<target>/.klive-boriel.json` (`version, platform, arch, installedAt, kitSha256`) and set
   `zxbasic.root` and `zxbasic.borielVersion`.

There is no uninstall: Klive never deletes a folder it did not just create.

## Resolver and version probe

`boriel-resolver.ts`: `zxbasic.executablePath`, then `zxbasic.root` + `zxbc[.exe]`, then "not
configured" (which offers the setup dialog). `probeBoriel` runs `zxbc --version` with a 10 s timeout
that kills the process; below 2.0 is rejected with a message that only 2.x is supported. Versions
compare with `compareBorielVersions` (`boriel-version.ts`).

## The compiler

`BorielCompiler.ts` implements `IKliveCompiler` behind `ZxBasicDispatcher`. Failures are returned,
never thrown, because a throw in the worker reads as success.

- **Process.** zxbc runs through `execa` behind an injectable `ZxbcRunner` (testable with a fake),
  with an argument list, a timeout and `cwd` = `<project>/_klive/boriel/`, because zxbc reads
  `./project.ini` by default. A `<project>/project.ini` is passed with `-F`, and the build output says
  so. Diagnostics come from the `-e` file, argument errors (exit 2) from stderr
  (`cli-and-diagnostics.md`).
- **Options:** `optionsFromSettings` → `readHeader` → `applyHeader`, then `boriel-options.ts`
  (`options.md` is the table of record). Every build passes `-I` and `-m` with the source folder and
  the include folders as one list each.
- **Machines:** 48K and Timex → `zx48k`; 128K, Scorpion, +3 → `zx128k`; Next → `zxnext`. Every other
  machine is refused before zxbc runs; `zx81sd` is other hardware.
- **Outputs** go to `_klive/boriel/<name>.{bin,dbg,map,err}`, always with `--debug=`, `-M`, `-e`. The
  result has one segment at the origin, `entryAddress` from the entrypoint callable,
  `injectOptions: { subroutine: true }`, the classic tables and `sourceLevelDebug` from the adapter,
  and `symbols` from the map.
- **Build identity.** The FNV-1a 32 of the produced code must equal the `.dbg`'s `binaryChecksum`
  (`programOf`); a mismatch fails the build rather than debug with stale data.
- **Debug profile.** A debug build passes `-O 1` unless the header sets `'@optimize`, and prints the
  level.
- **The Next is built twice:** `-f bin` (image and `.dbg`) and `-f nex`. **`--debug=` changes the code
  zxbc generates**, so every run after the first passes `--debug=<name>.same-code.dbg` (deleted after
  the build); a `.nex` that does not hold the `.bin` image gets a `ZXBC-D` warning (`nexHoldsImage`).
  The result carries `prebuiltNex`, which the NEX export copies instead of running Klive's writer.
- **Background checks** run `zxbc --parse-only` in the worker, debounced, on by default.
- A failed build whose root calls CODEBANK outside ASM gets a `ZXBC-K` error naming `MODULE` +
  `'@split-modules`: CODEBANK is Klive BASIC syntax (zxbc says "Undeclared function CODEBANK").
- **Run, inject, export.** Inject/run/debug use `injectCode()`. TAP/TZX/HEX exports use Klive's own
  exporter from the segments, so the loader options work as for any program; except a banked 128K
  build, below.

## The `.dbg` adapter

`dbg-adapter.ts` (pure but for an injected file reader) and `boriel-map.ts` turn zxbc's `.dbg` and
`-M` map into `SourceLevelDebugInfo` with extensions and the classic tables, which pass the same
validator as Klive BASIC's (`validateSourceLevel`; problems are one build warning, "source stepping
may stop in the wrong place", with details in the build output). The corrections it makes to zxbc's
output are listed in `dbg-observed.md` ("What the adapter must correct"). Beyond those:

- `format`/`version` must be `zx-source-debug`/`1`.
- File names resolve against the build folder (`baseFolder`) and the include folders; files under
  `<zxbasic.root>/lib/` are library files (Just My Code).
- `addressToStatement` gets `-1` at each frame's start and epilogue and after each routine, so
  prologues and statement-less code never map to another routine's statement.
- `fastcall` is a Klive frame convention (`SourceDebugInfo.ts`); FASTCALL parameters and dynamic
  local arrays are dropped, and the build output counts them.
- A call site without `callerIndex` belongs to the entrypoint; one without `statementIndex` is dropped.
- From the map: `.core.*` → runtime symbols, `.LABEL._<x>` → GOSUB labels (`.LABEL.__LABELn` dropped),
  `.core.__ERROR` → `errorEntry` (the code is in A).
- `optimizationLevel` comes from the command line actually used.

## The debugger

- **FASTCALL.** `locateActivations` (`src/emu/machines/SourceStepDecision.ts`) walks a `fastcall`
  activation: its return slot is the first stack word that is a call site of the routine, it has no
  IX, and the caller's IX passes through. Klive BASIC never emits it.
- **Error stops.** zx48k/zx128k: `__ERROR` does `RST 8`, so the generic ROM path works. zxnext:
  `errorEntry` = `__ERROR`, code in A, the stop comes before Boriel's panic screen. `__STOP` is not an
  error stop.
- **NEX sidecar.** A NEX export of a Boriel build writes Klive's `<name>.nex.kbasic-debug.json` beside
  it. `nex-run -d` of a `.nex` built **outside** Klive falls back to the `<name>.dbg` zxbc wrote beside
  it (`boriel-nex-debug.ts`, through `MainApi.borielNexDebug`): it needs a `zxnext` `.dbg` whose length
  and checksum match the program the `.nex` loads (origin = the NEX header's PC), uses `<name>.map`
  when present, and resolves source names against the `.dbg`'s folder. An unusable `.dbg` is a yellow
  warning, and the launch goes on without source debugging.
- Everything else (breakpoints, execution point, Step Into/Over/Out/Over Line, run to frame, step-into
  targets, the call stack, the Variables panel, return values, watches, data breakpoints, Just My
  Code, the profiler) needs no Boriel-specific code beyond the adapter. Where it falls short:
  `limitations.md`.

## Banked programs (`--split-modules`)

- The header option `'@split-modules` maps to `--split-modules` on the 128K and the Next; on the 48K
  zxbc rejects it, so the build warns (`ZXBC-H`) and leaves it out. `USE` finds modules only on the
  `-m` path, which every build passes.
- `boriel-banked.ts`: the debug build's first run writes `-f z80 -B -a` (128K) or `-f nex` (Next),
  with `--debug`. The program is the resident part (origin to `$C000`) plus each bank
  `codebank.banks` lists; trailing zeros are trimmed and the `.dbg`'s `binaryLength`/`binaryChecksum`
  decide where each part ends (zeros that were data are put back until the checksum matches).
- One segment per part, `{bank, bankOffset 0, startAddress $C000}` (on the Next the 16K bank, 16 for
  pages 32-33). Each list item names its segment (`segmentOfPartition`), so a line breakpoint gets its
  partition.
- **Far calls** go through zxbc's helper and a shadow stack at `core.PAGE_STACK` (the caller's return
  and its paging: `BANKM` on the 128K, the MMU6 page on the Next). The adapter describes it as a
  CODEBANK runtime with `shadowStackKind: "zxbc"`; `stackReader` reads it, stepping by one byte
  because zxbc frames can sit at odd addresses. Stepping across far calls works unchanged.
  `SourceDebugIndex.callableAt` takes each 8K slot's page from the bank table, so a Next routine
  crossing `$E000` stays one routine.
- **Exporting a banked 128K build** hands over zxbc's own tape: the build also runs `-f tap -B -a`
  (with `--debug`) into `prebuiltTape`, and the TAP/TZX export saves its blocks unchanged, saying that
  `-as`, `-n`, `-b`, `-scr` and the other loader options have no effect. (Klive's own banked loader
  crashed until 2026-11-04 because it did not CLEAR; it now does, `spectrumTapeBlocks.ts`, tested by
  `test/boriel/boriel-banked-tape.test.ts`.)

## Editor, settings and status bar

- **Settings › Integrations:** the *Boriel BASIC* row is a `file` row showing the install folder or
  *Not set up*, beside **Configure...**. The *Compiler for BASIC programs* row, which wrote the
  effective `zxbasic.compiler` (the project's when it has one) through `setEffectiveBasicCompiler`, is
  commented out while Klive BASIC is off.
- **Status bar** (`IdeStatusBar.tsx`): while a `.zxbas`/`.bas` file is focused it names the compiler;
  a click opens the setup dialog.
- **Editor intelligence** stays Klive's: keyword help, completion and folding. There is no binder data
  under Boriel (`limitations.md`, item 17).
- **Templates:** every `zx-basic` template is a plain Boriel program; the Next, 128K and Scorpion ones
  end with `DO`/`LOOP` so their output stays on the screen.
- **User docs:** `docs/content/en/guides/languages/boriel-basic.mdx` and the NEX guide.

## Tests and checks

| Where | What |
| --- | --- |
| `test/main/tool-install-archive.test.ts`, `boriel-install-service.test.ts`, `boriel-kit-script.test.ts`, `test/dialogs/boriel/` | Extraction, install, the kit script, the dialog. The real kit is installed and probed when present. |
| `test/main/boriel-compiler.test.ts` | Options, diagnostics, and builds with the real zxbc (all five templates, banked builds, include and module paths). |
| `test/boriel/dbg-adapter.test.ts`, `test/main/boriel-banked.test.ts`, `test/main/boriel-nex-debug.test.ts` | The adapter, banked parts and the outside-built NEX on the fixtures. |
| `test/boriel/boriel-debugger.test.ts`, `boriel-next.test.ts`, `boriel-banked.test.ts`, `boriel-banked-tape.test.ts` | The debugger on the real 48K, 128K and Next cores (`e2e-kbasic` tier, `build/e2e-tests.ts`). |
| `scripts/boriel-ide-check.cjs [run debug next export ui templates banked]` | The running IDE (local only, needs the kit; `next`, `export`, `templates`, `banked` need a NextZXOS card). All parts passed on 2026-11-04 (36 checks). |
