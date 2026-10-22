# Z88DK (C) Integration — Implementation Plan

Status: **implemented** (2026-10-18, branch `feature/z88dk-integration`), all phases Z0–Z7, with the
decisions of §0.2 as written. §14 records what was built and where it differs from the text above.
The author's requirement (2026-10-18): **setup goes through a dialog with download, like the
sjasmplus integration** (§4).

Inputs: a local z88dk **v2.3** (`zcc - v22110-51889e5300-20231220`, `~/z88dk`, macOS universal
binaries), run against a small test program on 2026-10-18 (§11 records what it produced). The
GitHub releases of `z88dk/z88dk` (v2.4, 2025-10-02, is the latest).

Goal: make C a first-class Klive language. Opening a `.c` build root and pressing **Run** or
**Debug** should behave like sjasmplus or Boriel BASIC: diagnostics in the Problems view, breakpoints
on C lines, the execution point in the C source, symbols in Watch, and **Export** to the machine's
native format. The existing KSX-only path (`Z88dk.compile` in `build.ksx`) stays for custom builds.
Only the parts of z88dk that add value to Klive are integrated (§2).

---

## 0. Ground rules and decisions

### 0.1 Carry-overs

- **Standalone IDE** (Closing the Gaps D1). z88dk's own debugging route, `z88dk-gdb` talking to an
  emulator's GDB stub, is the remote-protocol route D1 dropped. Klive is the debugger; it reads
  z88dk's debug data itself.
- **Run the tool, never copy it.** z88dk is under the Clarified Artistic License. Klive runs `zcc`
  and parses its output files. Formats are recorded in Klive's own words in `.ai/z88dk/`, from
  observed output and the public wiki. No z88dk source (ticks, gdb, appmake) is translated into Klive.
- **Test fixtures are compiler output, committed, never hand-edited** (Boriel B-T1). They are
  regenerated with `npm run z88dk:fixtures`. CI never runs zcc; tests that need a real install run
  only when one is present locally (`Z88DK_ROOT` or `~/z88dk`).
- **Every user-facing text goes through `t()`**. A changeset comes with the commit that completes the
  plan, not with each phase.

### 0.2 Decisions proposed (need the author's OK)

| # | Proposal |
|---|---|
| **C1** | **A real `IKliveCompiler` for language `c`** (`Z88dkCompiler`, registered in `compiler-registry.ts`). Templates switch to `$command("klive.compile/run/debug")` like the other built-ins. `Z88dk.compile` stays in KSX as the escape hatch. |
| **C2** | **Setup is a Z88DK integration dialog shaped like the sjasmplus one** (*author's requirement*): a *Local installation* source (detected installs, or a folder picked by the user) and an *Online* source that lists the GitHub releases of `z88dk/z88dk`, downloads the asset for this platform, installs it and tests it. Both sources lead to the same Test and Apply, with a project or user scope. z88dk is **not bundled** in the installer (343 MB installed, a 72 MB macOS / 118 MB Windows download) and there is no first-run offer; the dialog opens from Settings › Integrations, from `z88dk-setup`, and from the error a C build gives when z88dk is missing. |
| **C3** | **A supported version range, starting at v2.4.** The map format and debug records are undocumented and change between releases. The dialog lists every release but marks the supported ones and preselects the newest supported one; an unsupported install is accepted with a warning, not refused. The facts in §11 were observed on v2.3 and are re-verified on v2.4 in phase Z0. `BORIEL_BASIC_UPDATE_TRACKING_PLAN.md`'s shape covers upgrades later. |
| **C4** | **sccz80 is the default compiler; SDCC is selectable.** In v2.3, `-debug` with `-compiler=sdcc` fails to assemble (§11 F4), and SDCC's map attributes C files to generated-asm line numbers. SDCC builds therefore run and export but debug at the assembly and symbol level only. They get a one-line notice, not a broken source view. Re-verify on v2.4 in phase Z0. |
| **C5** | **The target comes from the machine, not from options.** A Klive-machine → `+target` table (§5.2) is used, with a clear refusal for unsupported machines. The C library (`classic`/`new`) and the subtype are project settings with sensible defaults. |
| **C6** | **Options live in the project, not in source headers.** The `z88dk.*` keys in `klive.project` are `compiler`, `clib`, `subtype`, `startup`, `optimise`, `extraArgs[]`, `libs[]` and `pragmas[]`, edited in a Settings › Integrations page. z88dk's own `#pragma output` keeps working, because zcc handles it. |
| **C7** | **Out of scope:** `z88dk-ticks`, `z88dk-gdb`, `z88dk-dis`, standalone `z88dk-z80asm`, the compressors, and the niche converters (§2.3 gives the reasons). |
| **C8** | **Debug data comes from the linker map (`-m -debug`), not from `.lis` files.** The map gives addresses for C lines, asm lines, symbols and type records in one file (§11 F2–F3). |

---

## 1. What exists today

| Piece | Where | State |
|---|---|---|
| Config keys | `src/main/z88dk-integration/z88dk-config.ts` | `z88dk`, `z88dk.root` only |
| zcc wrapper | `src/script-packages/z88dk/Zcc.ts` (`ZccCommandManager` on `CliManager`) | Full option table; always `+zx`; writes `_output.bin`; error regex for `file:line:col: error:` |
| KSX global | `src/script-packages/z88dk/Z88DK.ts`, exposed as `Z88dk` in `MainScriptManager.ts:436` | Prints diagnostics to the script output only (not the Problems view) |
| Reset command | `src/renderer/appIde/commands/Z88DkCommands.ts` | `z88dk-reset [path]`; its usage string wrongly says "ZXBC executable path" |
| Templates | `src/public/project-templates/{sp48,timex}/z88-dk/` | `build.ksx` injects a raw binary at the default org; `exportCode` is a TODO; there is no debug |
| File types | `src/renderer/registry.ts` | `.c`/`.h` → subtype `c`, `canBeBuildRoot: true`, but **no compiler** is registered, so `klive.compile` on a C root fails |
| Editor | Monaco's built-in `c` language | No Klive language provider, so no breakpoint glyph margin |
| Test | `test/script-packages/z88dk/Zcc-args.test.ts` | Argument building only |

The machinery a C integration plugs into already exists:

- `KliveCompilerOutput` gives segments, `sourceFileList`, `sourceMap` and `listFileItems`, and
  optionally `sourceLevelDebug`.
- `refreshSourceCodeBreakpoints` resolves breakpoints by file and line for any extension.
- The Monaco execution point uses `listItemsAtPc` or `locateSource`.
- `injectCode`/`runCode` handle segments, banks and the model; `.nex` is exported before a Next run.
- The export formats `tap`/`tzx`/`hex`/`nex`/`p`/`o` exist; the Z88 Insert Card dialog loads `.epr`.
- The source-level debugger (`SourceLevelDebugInfo` with variables, frames and call sites) already
  serves two producers, Klive BASIC and Boriel.

---

## 2. Which z88dk tools add value

### 2.1 Integrate

| Tool | Why |
|---|---|
| **`zcc`** (driving `z88dk-ucpp`, `z88dk-sccz80`/`z88dk-zsdcc`, `z88dk-copt`, `z88dk-z80asm`) | The compiler itself. Mixed `.c` + `.asm` projects go through zcc too, so z80asm needs no separate integration. |
| **Linker map with `-m -debug`** | This is the only debug data. It holds `__C_LINE_*` (C line → address), `__ASM_LINE_*` (crt0/asm line → address), every symbol with its section and source position, and `__CDBINFO__*` (SDCC-CDB-style records: functions, globals, locals with frame offsets, struct types). |
| **`z88dk-appmake`** (via `-create-app`) | It builds the native artefact for each target: `.tap` with a BASIC loader (zx/ts2068), `.nex` (zxn), `.P`/`.O` (zx81/zx80), `.dsk` (+3), and Z88 application cards. Klive already loads all of them; re-implementing them would be worse than using appmake. |
| **`z88dk-lib` / `zcc -x`** | Only as an option, so a project can build its own library. It needs no UI. |

### 2.2 Use indirectly

- **`z88dk-zx0`/`zx7`** (asset compression, popular in Spectrum games). They are not integrated, but
  a KSX script can call them. A `Z88dk.run("zx0", ...)` helper is a cheap follow-up
  only if asked for.

### 2.3 Leave out

| Tool | Reason |
|---|---|
| `z88dk-ticks` | A separate silent Z80 emulator with a debugger. Klive's own cores, profiler and Z80 unit tests already cover cycle counting and testing, on the real machine. |
| `z88dk-gdb` | A GDB client for emulators' GDB stubs. Klive *is* the emulator and debugger (D1). |
| `z88dk-dis`, `z88dk-z80nm`, `z88dk-zobjcopy` | Klive has its own disassembler, memory and symbol views. |
| Standalone `z88dk-z80asm` | Klive asm, sjasmplus and (planned) PASMO cover standalone assembly. Users rarely want a fourth assembler outside C projects. |
| `z88dk-basck`, `z80svg`, `font2pv1000`, `asmstyle`, `zpragma`, `dzx0`/`dzx7` | Niche, or internals of zcc. |

---

## 3. Phase Z0 — Facts and fixtures (no product code)

Record in `.ai/z88dk/`:

- `README.md`: version, layout, the `ZCCCFG` requirement, and the macOS quarantine on downloaded binaries.
- `releases.md`: the release assets per platform (§4.1), the folder layout inside each zip (is there
  a top-level `z88dk/` folder to strip?), whether the macOS zip is universal, and whether GitHub
  gives a sha256 `digest` for each asset.
- `map-format.md`: line grammar `NAME = $HEX ; kind, scope, , module, section, file:line`; the
  `file::function::scope::block:line` form for C symbols; hex escaping (`_2e` = `.`, `_2f` = `/`);
  `__head`/`__tail`/`CRT_ORG_CODE`/`__CODE_head`; bank sections.
- `cdb-records.md`: decoding of `__CDBINFO__` S/F/T records (`G`lobal/`L`ocal, type chains `SI`,
  `SC`, `DG` pointer, `DA` array, `ST` struct, address space `E`/`B`, frame offsets).
- `targets.md`: per-target command, outputs and entry convention (§5.2), checked on the real cores.

Spikes to settle before Z2:

1. **Entry and return convention per target.** Does the classic `+zx` crt0 started by inject
   (`subroutine: true`) return to BASIC cleanly? Where does `main` return on the Next and the ZX81?
2. **SDCC `-debug` on v2.4** (C4). If it is fixed, raise the support range instead of
   keeping the SDCC limitation.
3. **sccz80 local-variable addressing.** The CDB offsets (`B,1,4`, `B,1,-2`) are frame-relative, but
   sccz80 does not keep an IX frame by default. Find out what base the offsets use and whether the
   frame can be recovered at a stop (needed only in Z5).
4. **Is the map deterministic?** It embeds temp names (`/tmp/tmpX5WOG9xg.i`). Fixtures must
   normalise or ignore them.

Fixtures: `test/z88dk/fixtures/<case>/` (source, `.map`, binary, appmake output), produced by
`scripts/z88dk-fixtures.cjs`.

## 4. Phase Z1 — Setup: the Z88DK integration dialog

The dialog follows the sjasmplus integration layer by layer. The sjasmplus dialog is the MVC
pattern's reference implementation (`.ai/ui-mvc-guide.md`, `.docs/dialog-mvc-pattern.md`). It is
**copied and adapted, not generalised**: the differences below run through every layer, and a shared
abstraction over two tools would be guesswork. If PASMO's D4 (a generic
`ToolIntegrationDescriptor` dialog) lands first, the three are folded together then.

### 4.1 What is different from sjasmplus

| Topic | sjasmplus | z88dk |
|---|---|---|
| What is configured | One executable | An **install folder** (`<root>/bin/zcc` and `<root>/lib/config`). Picking `zcc` itself is accepted too, and its root is derived from it. |
| Release assets | Windows binary, source | `z88dk-osx-<v>.zip` (macOS), `z88dk-win32-<v>.zip` (Windows), `z88dk-src-<v>.tgz`. **There is no Linux binary**, so Linux gets the dialog's existing "no download for this platform" panel, with steps: the distro or snap package, or a build from source, then *Local installation*. |
| Download size | Small | 72–118 MB. The download needs a **progress bar and Cancel**, which the sjasmplus service lacks. They are added to the shared download helper, so sjasmplus gains them too. |
| Probe | `sjasmplus --version` | `zcc` with no arguments (there is no `--version`); parse `vNNNNN-<hash>-<date>`. A real smoke test follows: compile a one-line `int main(){return 0;}` for `+zx`, which proves that `ZCCCFG`, the libraries and the bundled `zsdcc`/`sccz80` work, not just that the driver starts. |
| Environment | None | Every zcc run gets `ZCCCFG=<root>/lib/config` and `<root>/bin` first on `PATH`. The resolver owns this, so the dialog's test and the compiler always run zcc the same way. |
| macOS | Single binary | Several dozen binaries: `xattr -dr com.apple.quarantine` on the whole folder, and the executable bits restored from the zip (`archive.ts` honours mode bits). |
| Detection | Executables on `PATH` | `zcc` on `PATH`, the `Z88DK` / `ZCCCFG` env, `~/z88dk`, `/opt/z88dk`, `/usr/local/share/z88dk`, `C:\z88dk`, and the Homebrew and snap locations (**verify** each in Z0). |
| Version gate | None | The C3 support range: Apply on an unsupported version asks for confirmation (`ConfirmPort`). |

### 4.2 Layers (sjasmplus counterpart in brackets)

| Layer | z88dk file | Notes |
|---|---|---|
| Config keys | `src/main/z88dk-integration/z88dk-config.ts` (`sjasmp-config.ts`) | `z88dk.root`, `z88dk.version`, plus the project keys of C6 |
| Resolver | `z88dk-resolver.ts` (`sjasmplus-resolver.ts`) | Explicit root, then `Z88DK` env, then detection; returns root, `zcc` path and run env |
| Main service | `z88dk-integration-service.ts` (`sjasmplus-integration-service.ts`) | `probeZ88dkPath`, `getZ88dkPathSuggestions`, `listZ88dkReleases` (GitHub API, `z88dk/z88dk`), `downloadZ88dkRelease` (temp folder, size check, sha256 when GitHub gives a digest, extract, strip the top folder, quarantine, smoke test, rename into place, `.klive-z88dk.json` marker), `validateZ88dkInstall`, `applyZ88dkIntegration` |
| Messaging | `src/common/messaging/Z88dkIntegration.ts` (`SjasmplusIntegration.ts`) | Request and result types; `RendererToMainProcessor` and MainApi entries; a progress event for the download |
| Dialog MVC | `src/renderer/appIde/dialogs/z88dk/` (`dialogs/sjasmplus/`) | `Z88dkModel`, `Z88dkIntents`, `Z88dkPorts`, `Z88dkController`, `Z88dkViewModel`, `Z88dkIntegrationView`, `Z88dkIntegrationDialog` and `parts/` (status block, local and online source panels, apply block, and a new progress row) |
| Registration | `ideDialogRegistry.tsx` | `dialog:z88dk` |
| Settings | `settings-pages.ts` › Integrations | A `z88dk` row with Configure, beside sjasmplus |
| Commands | `Z88DkCommands.ts` | Add `z88dk-setup` (opens the dialog). `z88dk-reset` stays for scripts; fix its usage text |
| Build error | `Z88dkCompiler` (Z2) | "z88dk is not set up", naming `z88dk-setup` (**verify** whether the Output pane can carry a link that opens the dialog; sjasmplus's `SJASMP_CONFIGURED_FAILED_MESSAGE` is text only) |
| Texts | `src/common/i18n/locales/en/dialogs.json`, `settings.json`, `commands.json` | `dialog.z88dk.*` with translator context; then `npm run i18n:keys` |
| Styles | `Z88dkIntegrationDialog.module.scss` | Tokens only; no colour literals |

### 4.3 Dialog behaviour

1. **On opening**, it shows the status of the configured install: path, version and smoke-test
   verdict, re-tested every time, because the folder may have moved since setup.
2. **Local installation**: a list of detected installs, each with its version and a supported or
   unsupported mark, plus *Choose folder…*. Picking one runs the probe and the smoke test.
3. **Online**: a release dropdown (supported releases first, newest preselected, a *Show older
   releases* toggle in place of sjasmplus's pre-release toggle), the asset for this platform with
   its size, a download folder (default `~/KliveTools/z88dk/<version>`, remembered), then
   *Download and install*, with progress and Cancel. On Linux it shows the build-from-source panel.
4. **Scope**: project or user, as in sjasmplus.
5. **Apply** saves `z88dk.root` and `z88dk.version`. Closing with an unapplied, tested candidate asks
   for confirmation (the sjasmplus discard prompt).

### 4.4 Tests

These mirror `test/dialogs/sjasmplus/`:

- Model, view model and controller tests are headless, through fakes of `Z88dkServicePort`,
  including the Linux "no download" path, an unsupported version, a cancelled download and a failed
  smoke test.
- A render test and a view test.
- Service tests in `test/main/z88dk-integration-service.test.ts` cover asset classification on the
  three real asset names, extraction with a strip, the size mismatch, and the marker.
- The real download and smoke test run only locally, behind `Z88DK_DOWNLOAD_TEST=1`.

## 5. Phase Z2 — Compiler, diagnostics, Run and Inject

### 5.1 `Z88dkCompiler` (`src/main/z88dk-integration/Z88dkCompiler.ts`)

- Reuse `ZccCommandManager`. Add a target parameter and an env hook, and write outputs to a
  per-build folder (`.klive/z88dk/<profile>/`) instead of `_output.bin` in the project root.
- Profile `debug`: `-debug -m`, plus no optimisation if the spike shows that line mapping degrades.
  Profile `build`: `-m -create-app` with the project's optimisation setting.
- Diagnostics go into `AssemblerErrorInfo` with file, line, column and severity, so they reach the
  Problems view. zcc reports linker errors as `file.c::func::0::1:57: error: undefined symbol`,
  which the existing regex treats as having no line; that case is kept.
- Output: `segments` built from the binary and `CRT_ORG_CODE` (banked sections later, phase Z6),
  `modelType`, `entryAddress`, `injectOptions`.
- Background `checkFile`: `zcc -c` on the edited file only. It is opt-in, because a zcc run is
  slower than Klive's in-process parsers.

### 5.2 Machine → target table (verify each in Z0)

| Klive machine | zcc | Run via | Native export |
|---|---|---|---|
| sp48 (and 16K: refuse or `-zorg`) | `+zx` | inject segments | `.tap` (appmake) |
| sp128, scorpion | `+zx` (128 banking in Z6) | inject | `.tap` |
| spp3e | `+zx -subtype=plus3` | inject | `.dsk` |
| timex | `+ts2068` | inject | `.tap` |
| zxnext | `+zxn -subtype=nex` | load the `.nex` (like Boriel's `prebuiltNex`) | `.nex` |
| zx81 / zx80 | `+zx81` / `+zx80` | load the `.P`/`.O` image | `.P`/`.O` |
| z88 | `+z88 -subtype=app` (needs `applname` pragmas) | insert the card image and start the app | card image (`.epr`) |
| c64 | — | refused | — |

### 5.3 Templates

- Rewrite `sp48`/`timex` `z88-dk` to use the built-in commands. Add `debugCode`, and make
  `exportCode` real.
- Add `z88-dk` templates for sp128, spp3e, zxnext, zx81 and zx80 in this phase. Z88 is added in Z4,
  once the card path works.
- Each `main.c` uses only that target's documented library calls.

## 6. Phase Z3 — Line-level debugging (the core value)

- **Map parser** (`z88dk-map.ts`, a pure function with fixture tests): it builds `sourceFileList`,
  `sourceMap`, `listFileItems` and `symbols` from `__C_LINE_*` and `__ASM_LINE_*`.
  - Keep only project files by default. Library and header lines (`/…/include/stdio.h:5`, all at the
    same address) are dropped.
  - For several lines at one address, the last one wins (the line that emits code).
  - The crt0 asm lines can be opened on request ("step into library" is off by default).
- **C language provider** (`cLanguageProvider.ts`): `supportsBreakpoints: true`, full-line
  breakpoints, `compiler: "Z88dkCompiler"`. Monaco's built-in C tokenizer stays.
  `lineCanHaveBreakpoint` comes from the last build's line set.
- **Symbols**: `_name` C symbols are shown as `name` in Watch, the memory views and the
  disassembly labels; the `__C_LINE`/`__CDBINFO` noise is filtered out.
- Stepping at this level is the existing line-based stepping. It is already useful, and it is what
  sjasmplus has today.

## 7. Phase Z4 — Export and Z88 applications

- `expc` gains a z88dk path: copy the appmake artefact (`.tap`, `.nex`, `.P`, `.O`, `.dsk`) rather
  than rebuild it. `hex` still comes from Klive's own exporter.
- Z88: build the application card and convert or name it as an `.epr` that the Insert Card dialog
  accepts (**verify** the `.63/.62` → `.epr` mapping). Then add the z88 template and a Run that
  inserts the card into a slot and starts the application.

## 8. Phase Z5 — Source-level debugging (C)

This phase is optional and the most expensive. Start it only if Z3 proves the map is reliable.

- `z88dk-debug-adapter.ts`: map + CDB → `SourceLevelDebugInfo` with `language: "c"`:
  - statements from the C lines;
  - callables from the CDB `F` records plus the symbol addresses;
  - variables from the CDB `S` records.
- **Type system**: `SourceValueType` is BASIC-shaped. Add `char`/`uchar`, `pointer`, `struct`
  (members from `T` records), arrays of any element type, and the z88dk float formats (classic
  math48 6-byte and IEEE 32-bit, chosen by the math library). `value-decoder.ts` grows to match. The
  types stay JSON-serialisable and language-neutral.
- **Frames**: needs a `CallableFrameInfo` convention for sccz80 (SP-relative, from spike 3), or
  limits locals to globals and parameters where the base is known. The call stack comes from return
  addresses matched against call sites.
- Fold the debug validator in, as with Boriel.

## 9. Phase Z6 — Banked builds

- 128K and Next banked code and data: `__BANK_n`/section heads in the map → segments with
  `bank`/`bankOffset` → `partition` in `listFileItems` (as with sjasmplus pages).

## 10. Phase Z7 — CLI, docs, bookkeeping

- `src/cli/compile.ts` accepts `.c` once Z2 is in.
- Docs: a `guides/languages/z88dk.mdx` page (setup, targets, debugging limits, SDCC note), and an
  update of `project-templates.mdx` and `settings.mdx`.
- `scripts/z88dk-ide-check.cjs [run|debug|export]`, Playwright on the built app (like Boriel's).
- `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2: "External toolchains" now has *z88dk C with
  line-level debugging*. Add a "C source-level debugging" row if Z5 lands.
- The changeset (`feature`) goes with the commit that completes the plan.

---

## 11. Facts observed with z88dk v2.3 (2026-10-18)

- **F1** `zcc +zx -debug -m -create-app -lndos -o prog main.c` produces `prog`, `prog.tap` and
  `prog.map`. `printf` on classic `+zx` needs `-lndos` (otherwise: `undefined symbol: writebyte`).
- **F2** The map has 343 `__C_LINE` symbols for a 14-line program. The ones for project lines look
  like `$830F main.c::main::1::3:9` (function `main`, line 9). The header lines all sit at the crt
  address and must be filtered out.
- **F3** `__CDBINFO__S_3aLmain_2ec_2eadd_24s…B_2c_31_2c_2d_32` decodes to local `s` in `add`, `int`,
  at frame offset −2. The globals (`G$counter`), function records and struct types for library
  headers are all present.
- **F4** `-compiler=sdcc -debug` (and `-Cs--debug`) fails to assemble on `defc … == .`, for both
  classic and `sdcc_iy`. SDCC without `-debug` works, but its map's `m.c:271` points at the
  generated asm, not the C source.
- **F5** These targets build with `-create-app`: `+zxn -subtype=nex` → `.nex`; `+zx81` → `.P`;
  `+zx80` → `.O`; `+ts2068` → `.tap`; `+zx -subtype=plus3` → `.dsk`. `+z88 -subtype=app` needs
  application pragmas (`applname`).
- **F6** zcc has no `--version`; running it without arguments prints the version line.

## 12. Risks

| Risk | Mitigation |
|---|---|
| The undocumented map and CDB formats change | Pin the version (C3), check fixtures, give a clear "unsupported version" message |
| SDCC users get no source debugging | C4 notice; re-check on each pinned upgrade |
| Optimised code maps lines poorly | The debug profile disables optimisation; a validator warns about unmapped lines |
| Large install and download | Detection first; the download is opt-in, with progress and Cancel; nothing is bundled |
| No Linux binary | The dialog's "no download for this platform" panel with build/package steps, then *Local installation* |
| The GitHub API rate limit (60 requests/hour without a token) | One release list per dialog session, cached; a clear error with the releases page link |
| Locals in Z5 cannot be located reliably | Z5 is gated; Z3 already delivers the main value |

## 13. Phases at a glance

| Phase | Content | Depends on |
|---|---|---|
| Z0 | Facts in `.ai/z88dk/`, spikes, fixtures | — |
| Z1 | The Z88DK integration dialog (local + online download), resolver, smoke test, settings row, `z88dk-setup` | Z0 |
| Z2 | `Z88dkCompiler`, target table, diagnostics, Run/Inject, templates | Z1 |
| Z3 | Map parser, C language provider, breakpoints, execution point, symbols | Z2 |
| Z4 | Native export through appmake; Z88 application cards | Z2 |
| Z5 | C source-level debugging (variables, call stack, types) — optional | Z3 |
| Z6 | Banked builds (128K, Next) | Z3 |
| Z7 | CLI, docs, IDE check, competitive analysis, changeset | Z3, Z4 |

Suggested order: Z0 → Z1 → Z2 → Z3 → Z4 → Z7, then decide on Z5/Z6 from real use. Z3 and Z4 can
run in parallel once Z2 is in.

## 14. As built (2026-10-18)

- **Z0.** Facts are in `.ai/z88dk/` (v2.4, re-verified). New facts: zcc's banner goes to stderr and it
  exits 0; `-clib=classic` exists only on `+zxn` (whose default `sdcc_iy` cannot `-debug`); C4 holds on
  v2.4; the CDB names escape digits too; **sccz80 reads one line ahead**, so a shared address maps to
  the *lowest* line (not the last, as §6 guessed); **`-debug` keeps a frame-pointer chain in
  `__debug_framepointer`** with an IX frame's layout, which is what made Z5 cheap. Fixtures:
  `test/z88dk/fixtures/` (`npm run z88dk:fixtures`, two documented path normalisations; the Next map
  is not committed, 1.2 MB).
- **Z1.** As §4, plus: the download helper (`tool-install/download.ts`, shared with sjasmplus) and an
  async zip extractor (`extractArchiveAsync`) so a 29 000-file release does not freeze the main
  process; progress is polled (`getZ88dkDownloadProgress`) rather than pushed. The release list is
  cached for 10 minutes in main and fetched once per dialog session. The not-set-up build error
  carries a **Set up z88dk...** link (error code `ZCC-SETUP`). Settings rows edit `z88dk.compiler`,
  `clib` and `optimise`; the other C6 keys are `klive.project` keys (documented).
- **Z2.** Builds go to `_klive/z88dk/<profile>/` (like Boriel's `_klive/boriel`), every profile with
  `-create-app`. Real-core tests (`test/z88dk/*.core.test.ts`) changed two routes: Klive's 128 BASIC
  injection starts code with the editor ROM paged, so the **128K, +3 and Scorpion inject in 48 BASIC**;
  the ZX80/ZX81 **load appmake's `.O`/`.P`** like `tape-load -r` (the ZX80's org is not Klive's REM
  body). `-lndos` is the default library on classic Spectrum/Next targets (printf needs it).
- **Z3.** As §6; `lineCanHaveBreakpoint` is a text rule (not the last build's line set).
- **Z4.** v2.4's appmake writes `.epr` itself. The Z88 Run route is `z88AppFlow.ts`: card in slot 3,
  soft reset (needed: OZ does not list a hot-plugged application otherwise), then □ + `APP_KEY` after
  1600 frames (OZ needed 400–800).
- **Z5.** `z88dk-debug-adapter.ts`; the shared debugger gained `framePointerAddress`, the `char` and
  `pointer` value types and `typeLabel`. Not decoded: floats, structs, arrays; banked functions are
  line-level only. The startup code is the entry-point callable (`__restore_sp_onexit` + 1 holds its
  SP); a function's opening line (before `call l_debug_push_frame`) is no statement.
- **Z6.** Banked builds: segments per `BANK_n`, list items with partition and segment; on the 128K and
  Scorpion they run from appmake's tape through the Tape Loader (48 BASIC locks the paging); banked
  +3 builds are export-only.
- **Templates.** The ZX Spectrum family's `z88-dk` templates were verified - and the Next's fixed -
  by `.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` (template fixtures for Debug and Run, real-core run and
  debug tests per model, the IDE sweep `z88dk-ide-check.cjs templates`, the `ZCC-PRINTF` warning).
- **Z7.** `klive build`/`run` take `--z88dk`; docs `guides/languages/z88dk.mdx`;
  `scripts/z88dk-ide-check.cjs` (run, debug, export, zx81, setup, nosetup) passed on the built app.

