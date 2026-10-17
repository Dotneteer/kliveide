# Boriel BASIC (zxbc 2.0) Integration — Implementation Plan

Status: **approved for implementation; Phases B0-B3 done** (2026-10-17, HEAD `2cebbd732`). Decisions B1, B-L1, B-T1 and B-T2 are settled (§0).
Inputs: the setup kits, now in `vendor/boriel-basic/` (`kit.json` + git-ignored `kits/`; see §3.1) and the debug
format published at <https://zxbasic.readthedocs.io/en/v2.0/debug_format/> (pages *Statements &
Addresses*, *Callables*, *Call Sites*, *Variables*, *Banking*).

The goal: Boriel BASIC becomes a second, switchable implementation behind the same `zxbas` file
type, templates and commands as Klive BASIC. Klive bundles Boriel's setup kit, offers to install it on
first run, and gives Boriel builds the same compile / run / debug / export features Klive BASIC has,
as far as Boriel's `.dbg` file allows. **Klive BASIC stays the default.** Boriel BASIC is something the
user opts into, and that holds until the readiness gate in §11 passes and the project author decides
otherwise.

---

## 0. Ground rules and decisions

### 0.1 What carries over from the Klive BASIC plans

- **Provenance (hard rule, `ZXBASIC_COMPILER_PLAN.md` §0.1).** This work runs Boriel's compiler as an
  external tool and reads its **documented** output (`.dbg`, `-M` map, diagnostics). Nobody reads the
  compiler, its runtime (`lib/*/runtime`) or its stdlib to design Klive BASIC, and no file from the kit
  is copied into Klive's source tree. The installer copies the kit **as an opaque archive** into the
  installation package and extracts it on the user's machine. That is redistribution, not reuse
  (permission for the beta: §0.3, B-L1).
- **D12 (the oracle never runs in CI)** governs Klive BASIC's compatibility work. It does not cover
  testing the Boriel integration itself. That has its own rule (B-T1, §0.3).
- **D9.** `zxbas` stays one language id. The compiler behind it is chosen by a setting.

### 0.2 Decisions proposed by this plan (need the author's OK)

| # | Proposal |
| --- | --- |
| B1 | **Decided (2026-10-17): only Boriel BASIC 2.x is supported; the 1.x integration is removed.** `zxbasic.compiler` is a two-way choice: `klive` (default) or `boriel` (zxbc 2.x with debug info). Unset or unknown means `klive`. An existing `zxbc` value is read as `boriel`, so a user who chose the external compiler keeps an external compiler. §4.5 lists what is removed. |
| B2 | The switch is a **user setting with a project override**. `SettingsReader` already merges the two, with the project winning. A project can pin its compiler, and the same template works under either. |
| B3 | The install location is stored as the user setting `zxbasic.root` (modelled on `sjasmp.root`). `zxbc[.exe]` is resolved from it. An explicit `zxbasic.executablePath` still wins (for a hand-built or relocated 2.x), but it must pass the same 2.x version probe (§3.5). |
| B4 | Each installer carries **only the kit for its own platform and architecture**, not all seven. Per-arch `extraResources` in the `build` block of `package.json` handles this. `build/electron-builder.json5` is stale and must not be edited. |
| B5 | The kit is extracted **by Klive's own code**: the tar/zip helpers already inside the sjasmplus service, factored into a shared module (§3.3). There is no shelling out to `tar`/`unzip`, and no new runtime dependency. |
| B6 | Boriel builds read Klive's `'@name value` header options and translate them to zxbc flags (§4.2). The same `program.zxbas` therefore builds under both compilers without edits. |

### 0.3 Decisions resolved with the project author (2026-10-17)

| # | Decision |
| --- | --- |
| **B-L1** | **Redistribution: resolved for the beta.** The project author holds written permission (email) from Boriel to bundle and redistribute the current beta kit. The kit itself ships no LICENSE file: `lib/NOTICE.md` refers to a proprietary licence for the compiler binaries, and calls `lib/` MIT apart from 216 header-less files. So the licence text and the `THIRD_PARTY_NOTICES.md` entry are a **release gate for the production version** (§11, item 1), not a blocker for this work. Until then, the installer and the setup dialog say "Boriel BASIC 2.0 beta — redistributed with the author's permission". |
| **B-T1** | **Testing: option (a), accepted.** zxbc-built fixtures (`.dbg` + `.bin` + `-M` map) from Klive's own small test programs are committed under `test/boriel/fixtures/`, with a README naming the zxbc version and the licence they are under. CI tests the adapter and the debugger on them; zxbc itself never runs in CI. A developer regenerates them with `npm run boriel:fixtures` against the installed kit. **This is an explicit exception to D12's "no output code in Klive", limited to this folder and this integration.** Klive BASIC's provenance rule is unchanged: nobody reads these fixtures, or the kit's runtime, to design Klive BASIC. |
| **B-T2** | **Version: `2.0.0-beta25`, pinned.** This is an experiment. `kit.json`, the version probe (§3.5) and the fixtures all name this exact version. Moving to a newer beta or the release is a deliberate change: new kits, regenerated fixtures, rerun B0's checks. |

---

## 1. What exists today (facts this plan builds on)

### 1.1 Compiler plumbing

- `ZxBasicDispatcher` (`src/main/zxb-integration/ZxBasicDispatcher.ts`) is registered for `zxbas` and
  routes to `KBasicCompiler` or `ZxBasicCompiler` according to `selectedZxBasicCompiler(state)`
  (`zxb-config.ts`). The renderer calls the same function (`MonacoEditor.tsx` around lines 2209 and 2225).
- **Legacy `ZxBasicCompiler`:**
  - It runs `zxbc <file> --output x.bin --mmap x.lab -O -S -H …` through `CliRunner`.
  - It returns one segment at `machineCodeOrigin` with `modelType: Spectrum48`.
  - It returns no `sourceFileList`, `sourceMap` or `sourceLevelDebug`.
  - `lineCanHaveBreakpoint` is always false, and the `.lab` map is never parsed.
  - The error regex is `/^(.*):(\d+): error: (.*)$/`, which drops warnings and columns.
  - It throws when the executable path is unset, and a throw in the worker is reported as success.
- **Latent bug.** (Moot once §4.5 removes `ZxBasicCompiler`, but the guard is kept for any compiler
  without classic tables.) A Debug run under `zxbc` reads `result.sourceFileList.map(...)`
  (`KliveCompilerCommands.ts` around lines 1238 and 1294), which crashes on an `InjectableOutput`.
  Phase B2 fixes this whatever else happens.
- The `zxbasic.*` keys are not in `setting-definitions.ts`, so they have no settings-UI row. The only
  way to set them is the command prompt (`set …`, `zxb-reset`).

### 1.2 What the debugger needs (Klive BASIC's consumers)

- `MachineController.setSourceDebugInfo` builds the `SourceDebugIndex` **only if
  `sourceLevelDebug.extensions` exists**. Without extensions there is no source stepping, no
  symbolic call stack, no Variables panel and no error stop.
- The frame locator (`SourceStepDecision.ts`, `locateActivations`) assumes:
  - the STDCALL IX frame;
  - every user call is a recorded call site (G5);
  - SP is the same at every statement entry of an activation (G4);
  - the main program's baseline SP sits in the word at `mainBaselineSymbol`.
- Error stops use `extensions.errorEntry` (Klive's `core.RaiseError`, code in A). They also use a
  generic ROM `RST 8` path, guarded by "a user statement is on the stack".
- Just My Code uses `libraryFiles`. The profiler's routine map uses `callables`, `frames` and
  `runtimeSymbols`. GOSUB rows in the call stack use `labels`.
- The Variables panel decodes the **Boriel ABI** layouts that Klive BASIC adopted:
  - length-prefixed heap strings;
  - the 5-byte ROM float;
  - Fixed 16.16;
  - the 4-word array descriptor;
  - FUNCTION results in A / HL / DE:HL / A-E-D-C-B.

  These decoders should apply to zxbc output unchanged. That is to be verified, not assumed (§9, R3).
- NEX launches load `<name>.nex.kbasic-debug.json` (`source-debug-sidecar.ts`, format
  `klive-source-debug`).

### 1.3 Packaging and settings

- `package.json` `build`, built by CI (`release-artifacts.yml`):
  - **mac:** `pkg`, x64 and arm64.
  - **win:** nsis and zip, x64 only.
  - **linux:** AppImage, x64 and arm64.

  There are **no** Windows arm64 or armv7l builds, so the `arm64-win` and `armv6-linux` kits have no
  installer to ship in for now. They become relevant only if those targets are added. Windows x64
  Klive runs on Windows on ARM under emulation and gets the x64 kit, which also works there.
- `extraResources` uses no `${arch}` macros yet. Runtime resources are found through
  `process.resourcesPath` (see `cliLauncherPath()` in `src/main/cli-install.ts`). `"!vendor"` (added
  next to `"!_input"`) keeps `vendor/` out of `files`; the kit reaches the package only through
  `extraResources`.
- Settings live in `<home>/Klive/klive.settings`. User settings are free-form dotted keys, written in
  main via `applyUserSetting`.
- There is a first-run flow: `shouldShowFirstStartupDialog` → `&firststart=1` on the EMU window →
  `FirstStartDialog`.
- The sjasmplus integration is the reference for tool setup:
  - resolver, probe, download, validate;
  - MVC dialog in `src/renderer/appIde/dialogs/sjasmplus/`;
  - settings row `dialog:sjasmplus`;
  - an extractor with `safeJoin` and temp-then-rename install.

### 1.4 The kit (inspected 2026-10-17)

- One top-level folder `boriel-basic-v2.0.0-beta25_<arch>-<os>/` with about 826 entries (835 in the
  Windows zip), about 45 MB unpacked.
  - Native binaries `zxbc`, `zxbasm`, `zxbpp` (`.exe` + `.pdb` on Windows).
  - `tools/` (`zxbpack`, `nextcreator`, `modman`).
  - `arch/<machine>/` (peephole rules, `paging.json`).
  - `lib/<machine>/{runtime,stdlib}`.
  - `examples/`.
  - **No Python.**
- Architectures accepted by `--arch`: `zx48k` (default), `zx128k`, `zxnext`, `zx81sd`.
- Output formats: `asm | ir | bin | tap | tzx | sna | z80 | nex`.
- Flags this plan uses:

  | Flag | Use |
  | --- | --- |
  | `-d` / `--debug[=FILE]` | write the `.dbg` |
  | `-M` | memory map |
  | `-e FILE` | diagnostics to a file |
  | `--parse-only` | check without output |
  | `-S` / `--org` | origin |
  | `-H` | heap size |
  | `-O` | optimisation level |
  | `--split-modules`, `--bank-layout` | banking |
  | `--set:nex:sp`, `--set:tap:sp` | per-format settings |
  | `--version` | version probe |

  `--cow-strings` also exists and changes the string runtime. B0 found the same visible string layout
  under it (§10, item 16).
- **`-F/--config-file` defaults to `./project.ini`.** zxbc reads options from the current directory
  unless told otherwise, so the cwd of the child process matters (§4.1).
- zxbc also looks for modules in `~/.local/share/boriel_basic/modules` (`modman`).
- macOS binaries are ad-hoc, linker-signed arm64/x86_64 Mach-O, which Apple Silicon accepts.
  Extracting with `tar` keeps the archive's `com.apple.quarantine`/`provenance` attributes; files that
  Klive writes itself do not get quarantine.
- **The early hang is explained (B0).** A binary that still carries `com.apple.quarantine` at its
  first launch blocks forever, waiting for a Gatekeeper decision a headless process cannot answer.
  Removing the attribute afterwards does not unblock that file. Stripped before the first launch, it
  starts in about 1 s (`.ai/boriel/kit.md`).

---

## 2. Phase B0 — verify the kit (**done 2026-10-17**)

The results are in `.ai/boriel/`:

| File | Contents |
| --- | --- |
| `README.md` | Index and platform coverage. |
| `kit.md` | Hashes and download URLs, layout, the macOS trap. |
| `cli-and-diagnostics.md` | Command line, formats, exit codes, diagnostics, the `project.ini` trap. |
| `dbg-observed.md` | What the `.dbg` really contains, adapter corrections, verified data layouts. |
| `boriel-issues.md` | Defects worth reporting. |

The answers to V1–V10 are in §9.

Remaining from B0:

- Run the **x86_64-linux** kit on a real x86_64 Linux host or CI runner. Docker's Rosetta emulation
  cannot load it, which is not evidence of a broken kit.
- Run both **Windows** kits on Windows, including whether `zxbc.exe` runs with the `.pdb` files
  removed.
- The **armv6-linux** kit has no Klive build to ship in.

These checks are part of B1's install tests on CI (§8) rather than a separate gate.

---

## 3. Phase B1 — bundle and install (**done 2026-10-17**)

**As built.** The design below was implemented as written, except:

- **The command** is `display-dialog borielSetup`, the existing dialog command, not a new
  `boriel-setup`.
- **The offer opens in whichever Klive window has focus**, as the About dialog does (the emulator
  window at a normal start). Main shows it once per run, after `startScreenDisplayed`. The check runs
  in the background from `app.whenReady`, so it never delays the start.
- **The "Use Boriel BASIC" checkbox moves to B2**, together with the `boriel` compiler value it
  writes. B1 only installs and records the location.
- **`offeredVersion: "*"` declines every version.** The Playwright harnesses
  (`scripts/doc-shots/harness.cjs`, `scripts/automation-ide-check.cjs`) seed it, so no offer covers the
  windows they drive. `launchKlive({ borielSetup: null })` seeds nothing.
- **A dev run** finds `vendor/boriel-basic` by searching upward from `app.getAppPath()`, which is
  `out/main` when Electron starts on the built entry.
- **Windows `.pdb` files are still extracted.** Skipping them waits for the Windows check in §2.

Files:

| Area | Files |
| --- | --- |
| Main | `src/main/tool-install/archive.ts` (shared extractor), `src/main/boriel-integration/` (`boriel-config`, `boriel-version`, `boriel-kit`, `boriel-resolver`, `boriel-install-service`, `boriel-main`) |
| IPC | `src/common/messaging/BorielIntegration.ts` |
| Dialog | `src/renderer/appIde/dialogs/boriel/` |
| Script | `scripts/boriel-kit.cjs` |
| Tests | `test/main/{tool-install-archive,boriel-install-service,boriel-kit-script}.test.ts`, `test/dialogs/boriel/` |

The tests include the real kit installed and the real `zxbc` probed, when the kit is present.
Verified in the running app (a throwaway home):

1. The offer appears; Install puts the kit in `~/zxbasic2` and records `zxbasic.root`/`borielVersion`.
2. A restart with an unknown but working `~/zxbasic2` adopts it silently.
3. "Don't offer this again" holds across restarts.
4. Settings › Integrations › Boriel BASIC opens the dialog in its settings mode.


### 3.1 Packaging

**Location (decided 2026-10-17): `vendor/boriel-basic/`**, the one place the kits live in the source
tree. It replaces the earlier `_input/zxbasic-setup/` and `build/boriel/`; its `README.md` says
what each part is.

| Path | Tracked | Contents |
| --- | --- | --- |
| `vendor/boriel-basic/kit.json` | yes | `version`, `urlBase` (`https://files.boriel-basic.net/v2/`), and per `process.platform`-`process.arch` key (`darwin-arm64`, `win32-x64`, …) the `file`, `size` and `sha256`. The single source for the packaging step, the installer's hash check and the version probe. |
| `vendor/boriel-basic/kits/` | no | All seven archives under **Boriel's own file names**, no renaming. Downloaded from `urlBase` + `file`, or copied in by hand. |
| `vendor/boriel-basic/stage/` | no | The one kit the current package includes, plus `kit.json`. |

- **`scripts/boriel-kit.cjs`:**
  - `fetch` downloads every missing kit into `kits/` and verifies each SHA-256. It fails on a
    mismatch and never overwrites a file that verifies.
  - `stage --platform <p> --arch <a>` copies the matching kit and `kit.json` into a clean `stage/`.

  The `package:*` scripts run `stage` first, with the target's platform and arch (electron-builder
  names: `x64`, `arm64`, `armv7l` → `kit.json` keys `x64`, `arm64`, `arm`).
- **`package.json` `build.extraResources`:** one platform-neutral entry,

  ```jsonc
  { "from": "vendor/boriel-basic/stage", "to": "boriel" }
  ```

  Because `stage` holds exactly the target's kit, no `${arch}` macros or per-OS entries are needed.
  A package build with an empty `stage/` fails, rather than silently shipping no kit.
- **A fresh clone restores the kits by itself.** `kit.json` is tracked, and the archives are
  re-created from it on demand:
  - **Packaging.** `stage` first fetches the target's kit if `kits/` lacks it, then verifies it. It
    runs from `prepackage:win`, `prepackage:mac`, `prepackage:mac:arm64`, `prepackage:linux` and
    `prepackage:linux:arm64` (npm runs a `pre<name>` script before `<name>`). So
    `git clone` → `npm ci` → `npm run package:mac:arm64` downloads exactly one kit, and fails
    loudly if it cannot get a kit whose hash matches. An installer without the kit can never be
    produced silently.
  - **Dev.** `predev` (today `install-electron`) also runs `fetch --current --optional`. That
    downloads the running platform's kit and only warns when offline, so `npm run dev` works without
    network; the first-run offer is then simply not shown (§3.2).
  - **CI** needs no extra step: the release jobs call the package scripts, which fetch.
  - **Tests** need no kit: CI tests use the committed fixtures (B-T1). The kit is needed only by the
    install tests in §8, which fetch it the same way.
- **Not depending on one server.** `kit.json` lists `mirrors` after `urlBase`, tried in order with
  the same SHA-256 check. The first mirror is a Klive GitHub release that holds the seven archives
  as assets (tag `boriel-kit-2.0.0-beta25`), uploaded once by the project author. That is
  redistribution under the same permission as the installer itself (B-L1). If Boriel's server
  moves or the files change, the build still gets byte-identical kits, or stops. It never ships
  different ones.
- **Alternative, not chosen:** committing the five shipped kits (about 27 MB, or Git LFS). That
  makes clones self-contained, at the cost of repository size on every clone, forever.

- A resolver `borielKitPath()` (new, in `src/main/boriel-integration/boriel-kit.ts`) follows the
  `cliLauncherPath()` pattern. It returns `process.resourcesPath/boriel/<file>` packaged, and
  `vendor/boriel-basic/kits/<file>` in dev (the file for the running platform, from `kit.json`), or `undefined` when the installer carries no kit (unsupported
  platform). Then the setup offer is simply not made.
- Platform selection is by `process.platform` + `process.arch`. Because each installer carries one
  kit, this only checks that the bundled kit matches. It is not used to choose among several kits.

### 3.2 When Klive offers the installation

The offer is made at startup when **all** of these hold:

1. a kit is bundled;
2. `zxbasic.root` is unset, or points at a folder without a working `zxbc`;
3. there is no working install in the default folder `~/zxbasic2`;
4. the user has not declined for this kit version.

If condition 3 fails because a working install already exists there, Klive records that folder
silently.

This covers first-time users and existing users upgrading to a Klive that newly bundles the kit. The
state is a top-level `AppSettings` field (not mirrored from the store, so `saveAppSettings` keeps it):

```ts
borielSetup?: { offeredVersion: string; declined: boolean; installedVersion?: string };
```

Hook-in: an `&borielsetup=1` query parameter next to `firststart` on the EMU window. It is shown
**after** `FirstStartDialog` closes, so a new user does not get two dialogs at once.

### 3.3 The setup dialog (MVC)

The dialog is `BorielSetupDialog`, an MVC split modelled on `dialogs/sjasmplus/`. Read
`.ai/ui-mvc-guide.md` first. It is reachable from three places:

- the first-run offer;
- **Settings → Integrations → BASIC compilers → "Boriel BASIC…"**;
- the command `boriel-setup`.

The dialog shows:

- **Status:** not installed / installed `<version>` at `<folder>` / installed but broken / an older
  version than the bundled kit.
- **Folder:** default `~/zxbasic2` (`os.homedir()` + `zxbasic2`, which on the Windows portable build is
  still the user's home, not the portable root), with **Browse…** through `FilePickerPort` /
  `showOpenFolderDialog`.
- **Buttons:** Install (or Update / Repair), Not now, **Don't ask again** (sets `declined`), and
  "Use an existing installation…" (pick a folder, validate, record).
- **After an install:** the version probe result. A checkbox "Use Boriel BASIC for BASIC programs"
  (default **unchecked**, B1) writes `zxbasic.compiler`.

### 3.4 The installer service (main)

`src/main/boriel-integration/boriel-install-service.ts`:

1. **Factor the extractor.** `extractZip`, `extractTarGz`, `safeJoin` and temp-then-rename move out of
   `sjasmplus-integration-service.ts` into `src/main/tool-install/archive.ts`, and sjasmplus is switched
   over to it.
   - Extend the tar reader to **honour the mode bits** (header offset 100). Today it drops them, and the
     kit has executables in the root, in `tools/` and in `arch/zx81sd/tools/`.
   - Support the GNU `ustar  ` magic explicitly.
   - Strip the single top-level folder.
2. **Validate the target folder.**
   - Refuse a folder that is non-empty and holds no previous Boriel install marker. Offer "choose
     another folder".
   - Refuse a path under the Klive installation or the app's resources.
   - Check that it is writable.
3. **Install.**
   - Extract into `<target>.klive-tmp-XXXX`.
   - Verify the archive sha256 against `kit.json`.
   - chmod `0o755` on the nine executables (from the mode bits, with a fallback list: `zxbc`,
     `zxbasm`, `zxbpp`, `tools/*`, `arch/zx81sd/tools/*` without an extension).
   - **On macOS, before anything in the folder is executed,** run `xattr -dr com.apple.quarantine`
     on it. A quarantined first launch blocks forever, and the file stays blocked
     (`.ai/boriel/kit.md`). The probe's timeout must kill the process and report "macOS blocked
     zxbc" rather than hang.
   - On Windows, skip `*.pdb` (34.5 MB of 46 MB) once B0's remaining Windows check confirms zxbc
     runs without them.
   - Probe (§3.5).
   - Rename into place. An update renames the old folder aside and deletes it only after the probe
     passes; a failure restores it.
4. **Write the marker** `<target>/.klive-boriel.json` `{ version, platform, arch, installedAt, kitSha256 }`.
5. **Record.** Set the user settings `zxbasic.root` and `zxbasic.borielVersion` through `applyUserSetting`,
   and update `borielSetup.installedVersion`.
6. **Report progress.** This is a MainApi long call, like `downloadSjasmplusRelease`.

Uninstall is **not** offered. Klive never deletes a user folder it did not just create.

### 3.5 Resolver and version probe

`boriel-resolver.ts`, modelled on `sjasmplus-resolver.ts`:

- Resolution order: `zxbasic.executablePath` (explicit), then `zxbasic.root` + `zxbc[.exe]`, then
  "not configured". The "not configured" message offers the setup dialog.
- `probeBoriel(exe)`: `zxbc --version`, with a 10 s timeout that kills the process, parsed to a semver.
  `≥ 2.0` means the `.dbg` is supported, and `boriel` mode is allowed. Anything older (the 1.x Python
  zxbc) is rejected, with a message that Klive supports Boriel BASIC 2.x only and an offer of the setup
  dialog.
- At startup, if the installed version is older than the bundled kit, the setup offer reappears as
  "Update". The `declined` flag is per offered version.

---

## 4. Phase B2 — compile, run, inject, export (**done 2026-10-17**)

**As built.** The design below was implemented, except:

- **zxbc runs through `execa` directly**, behind an injectable `ZxbcRunner`, not through `CliRunner`.
  That keeps every branch testable with a fake zxbc. Diagnostics come from the `-e` file;
  argument errors (exit 2) come from stderr.
- **Options go through Klive's own pipeline** (`optionsFromSettings` → `readHeader` →
  `applyHeader`), then `boriel-options.ts` maps the merged `KBasicOptions` fields. The real option
  names differ from the table in §4.2 (`origin`, `check-bounds`, …); `.ai/boriel/options.md` is the
  table of record.
- **`include-path` is one `-I` list.** A repeated `-I` keeps only the last folder (verified).
- **No source-level debug data yet.** Builds return `sourceFileList: []`, so a debug run steps Z80
  instructions, and `lineCanHaveBreakpoint` is false. The `.dbg` is written and checksum-checked in
  every build; B3 maps it.
- **The Next is built twice**: `-f bin` for the image and `.dbg`, and `-f nex` for the file to start.
  The output carries `prebuiltNex`, and the NEX export copies those bytes instead of running
  Klive's NEX writer. A minimal `nexConfig` (`{ filename }`) keeps the Next run path.
- **Machines:**

  | Klive machine | zxbc `--arch` | Inject model |
  | --- | --- | --- |
  | 48K, Timex | `zx48k` | 48K |
  | 128K, Scorpion | `zx128k` | 128K |
  | +3 | `zx128k` | +3 |
  | Next | `zxnext` | Next |

  Every other machine is refused before zxbc runs. Scorpion and Timex now get their right
  architecture, whereas `optionsFromSettings` maps both to `zx48k`.
- **The "Use Boriel BASIC" switch** is in the setup dialog (deferred from B1). It writes the user
  setting, and the dialog says when the open project's own setting overrides it.
- **A shared bug fixed on the way:** `SettingsReader` merged user and project settings shallowly. A
  project that set `zxbasic.compiler` hid the user's `zxbasic.root`, and the build said "not set
  up". It now overrides key by key, merging nested objects. One existing test had pinned the
  shallow behaviour for navigation shortcuts; it now expects the user's other shortcuts to survive.
- **Docs:** `docs/content/working-with-ide/zxb.mdx` has a "Using Boriel BASIC" section. The
  `zxb-reset` command, its reference entry and its screenshot are gone.

**Verified in the running app:** a project from the sp48 BASIC template, with Boriel selected,
builds (6023 bytes at `$8000`), runs, and prints its text on the emulated screen. A syntax error
reports `E342` in the Build output. The Next run and the TAP/NEX exports are covered by unit tests
only, not yet in the app.


### 4.1 `BorielCompiler` (`src/main/boriel-integration/BorielCompiler.ts`)

`BorielCompiler` implements `IKliveCompiler`, and the dispatcher gets a third arm. The current
throwing paths become returned errors, because a throw in the worker reads as success.

- **Target arch from the machine,** the same as `optionsFromSettings`:

  | Klive machine | `--arch` |
  | --- | --- |
  | sp48, timex | `zx48k` |
  | sp128, scorpion, spp3e | `zx128k` |
  | zxnext | `zxnext` |
  | zx81 | not offered (`zx81sd` targets ZX81 + SD hardware that Klive does not emulate) |

  An unsupported machine gives a clear error.
- **Process.** Run zxbc through `CliRunner` with:
  - an explicit argument list (never a shell);
  - a timeout;
  - `cwd` = the project's `_klive/boriel/` build folder, so a stray `./project.ini` is not picked up.

  If `<project>/project.ini` exists, it is passed explicitly with `-F` and a build-output note says so.
  The user's project folder is added with `-I` / `-m`.
- **Outputs** go to `_klive/boriel/<name>.{bin,dbg,map,err}`:
  - `-f bin` for unbanked 48K/128K;
  - `-f nex` for the Next;
  - banked 128K is covered in §7;
  - always `-d=<path> -M <path> -e <path>`.
- **The result** is a `KliveCompilerOutput`:
  - `segments`: one segment at `--org`, from the `.bin` and `binaryLength`;
  - `entryAddress`: the entrypoint callable's `entryAddress`;
  - `modelType` from the arch;
  - `injectOptions: { subroutine: true }`;
  - the classic tables and `sourceLevelDebug` from the adapter (§5);
  - `symbols` from the `-M` map.
- **Build-identity check.** After the build, compute the FNV-1a 32 of the produced binary and compare it
  with `binaryChecksum`. A mismatch means a stale `.dbg`: the build fails with a diagnostic instead of
  debugging with wrong data.
- **Debug profile (D11 parity).** `klive.debug` passes `-O 1` unless the header sets `'@optimize`, and
  the effective level is printed in the build output.

### 4.2 Options

- The header parser (`src/main/kbasic/options/header.ts`) is Klive code, so it can be reused. Each Klive
  option and `zxbasic.*` setting is mapped to a zxbc flag, for example:

  | Option | zxbc flag |
  | --- | --- |
  | `'@optimize` | `-O` |
  | `'@heap-size` | `-H` |
  | `'@org` | `-S` |
  | array/string base | `--array-base`, `--string-base` |
  | `'@sinclair` | `-Z` |
  | `'@explicit` | `--explicit` |
  | `'@strict` | `--strict` |
  | `'@debug-array` / `'@debug-memory` | `--debug-array` / `--debug-memory` |
  | `'@enable-break` | `--enable-break` |

  Klive-only options (`'@asm-dialect klive`, CODEBANK options, debug-info level) produce a **warning**
  under Boriel and are ignored. The NextBuild `'!` aliases map the same way.
- A table in `.ai/boriel/options.md` is the single source. A unit test checks that every option in
  `options/options.ts` is either mapped or listed as Klive-only.

### 4.3 Diagnostics

- Parse the `-e` file using the format captured in B0. Keep severity (warnings are **not** dropped as
  they are today), the `Wnnn`/error code, the line, and the column if zxbc gives one. Paths are
  resolved against the include dirs.
- Background checks under `boriel` run `zxbc --parse-only` in the worker, debounced, with the same
  timeout. They are on by default (the removed 1.x integration needed `allowBackgroundCompile`), because they are cheap and have no output files.

### 4.4 Run / inject / export

- **Inject / run / debug** use the existing `injectCode()` path. Fix the `sourceFileList` crash
  (§1.1) for every compiler that returns no classic tables.
- **Export.** tap/tzx/hex use Klive's own exporter from `segments`, as today, so the export dialog's
  options (autostart loader, border, screen) behave the same for both compilers. nex is the zxbc-built
  `.nex`, copied to the export path. The `.dbg` is copied next to it as the sidecar (§6.4).

### 4.5 Removing the 1.x integration (B1)

`BorielCompiler` replaces `ZxBasicCompiler` as the dispatcher's second arm, in the same change, so
there is never a build in which `zxbasic.compiler` points at nothing.

- Delete `src/main/zxb-integration/ZxBasicCompiler.ts`, and its tests in `test/kbasic/compiler.test.ts`
  (around lines 175 and 319-330). The dispatcher tests are rewritten for `klive`/`boriel`, including
  `zxbc` read as `boriel`.
- `zxb-config.ts`: drop `ZXBC_PYTHON_PATH`, `ZXBC_STRICT_BOOL` (a 1.x flag, absent from 2.x's help)
  and `ZXBC_STORE_GENERATED_ASM` unless B2 gives it a 2.x meaning (`-f asm` as an extra build).
  `selectedZxBasicCompiler` returns `"klive" | "boriel"`. The option keys Klive BASIC also reads stay.
- Remove the `zxb-reset` command (`ZxbCommands.ts`); the setup dialog (§3.3) replaces it.
- `docs/content/working-with-ide/zxb.mdx`: replace "Using the external zxbc compiler" with the
  Boriel BASIC section (§8). Any doc page that tells users to install zxbc 1.x with Python goes.
- Leftover `zxbasic.pythonPath` values in existing settings files are ignored, not migrated or deleted.
- **Not affected:** `scripts/kbasic-oracle.cjs`, which runs a locally installed zxbc 1.19 as the
  behavioural oracle for Klive BASIC's compatibility work (D12). It is a developer tool, not an IDE
  integration. Whether the oracle moves to 2.x is a separate decision for the compatibility plan.
- Scan for every import of the removed symbols (alias and relative paths), then run
  `npm run build:check` and the electron-vite build.

---

## 5. Phase B3 — the `.dbg` adapter (**done 2026-10-17**)

**As built.** `src/main/boriel-integration/dbg-adapter.ts` and `boriel-map.ts`. Every Boriel build now
returns the classic tables and `sourceLevelDebug` with extensions. Source breakpoints, the execution
point, source stepping, the call stack, the Variables panel, watches and error stops work on zxbc
programs. Beyond the table below:

- **One more zxbc defect, found and corrected here:** a FUNCTION call site's `returnAddress` is one
  too high. It points past the `PUSH` after the CALL, so no FUNCTION activation could be found on
  the stack. The adapter checks each site against the code image and moves it back
  (`.ai/boriel/boriel-issues.md` #9).
- **`fastcall` is now a Klive frame convention**, in `SourceDebugInfo.ts`. The frame locator still
  stops at it, so a FASTCALL routine is missing from the call stack. B4 fixes that, and
  `test/boriel/boriel-debugger.test.ts` pins the current behaviour.
- **Dropped records:** dynamic local arrays and FASTCALL parameters are left out and listed in the
  build output's count. Statement kinds are all `"other"`.
- **Validator:** the structural checks in `validateSourceLevel` run on every build, and problems go
  to the build output. B4 decides the fallback when they fail.
- **Fixtures (B-T1):** `test/boriel/fixtures/` (`calls`, `calls-next`, `arrays`, `runtime-error`),
  regenerated with `npm run boriel:fixtures` (`scripts/boriel-fixtures.cjs`).
- **Tests:**
  - `test/boriel/dbg-adapter.test.ts`: each B0 correction on real zxbc output.
  - `test/boriel/boriel-debugger.test.ts` (e2e-kbasic tier): the fixtures run on the real 48K, with
    a breakpoint on every statement. Call stack, Variables panel, watches and values agree;
    covers `Square` called twice in one statement, GOSUB activations, the BYREF parameter,
    fixed-size local and global arrays, strings, Float, Fixed and Long, and the error stop with A = 2.
- **Verified in the running app:** a breakpoint inside a SUB pauses the machine, and the editor
  highlights exactly that statement.


`src/main/boriel-integration/dbg-adapter.ts`: `.dbg` JSON → `SourceLevelDebugInfo` + `extensions`.
It is a pure function, unit-tested on fixtures. The output must satisfy the same debug-info
validator Klive BASIC's builder runs.

| Boriel `.dbg` | Klive model | Conversion |
| --- | --- | --- |
| `format`/`version` | — | Require `zx-source-debug` / `1`; otherwise build error "unsupported debug format". |
| `files[]` | `files`, `sourceFileList` | Resolve file names against the build cwd and include dirs to absolute paths. |
| `statements[]` | `statements`, `sourceMap`, `listFileItems` | Same 1-based lines and 0-based end-exclusive columns. **Corrections from B0** (`.ai/boriel/dbg-observed.md`): sort by address and re-index densely, remapping call sites, because removed statements leave gaps; clamp `endAddress` to the owning frame's `epilogueStart` / the next routine's start; skip leading blanks in `startColumn`; extend a `PRINT` statement's end to the next statement on the line. |
| `callables[]` | `callables` | `kind`: `subroutine`→sub, `function`, `entrypoint`→main. Derive `firstStatement`/`lastStatement` from `statements[].callableIndex`. |
| `addressToStatement` | same | Same `[addr, idx]` shape. Insert `-1` at each frame's `startAddress` and `epilogueStart` and after each routine's end, so prologues, epilogues and statement-less code (a dynamic `DIM`) never map to another routine's statement. |
| `partitionedAddressMap`, `partition`, `bank` | `partitionedAddressMap`, `partition`, `bank` | Map partition ids per arch to Klive partitions: 128K = 16K bank id; Next page ids → Klive's 8K-page partitions (to verify, §9). Missing means unbanked, never 0. |
| `extensions.frames` | `frames` | `"frame"` and `"entrypoint"` as is. **`"fastcall"` is new to Klive** (§6.1). `endAddress` is approximate; omitted for the entrypoint (use `epilogueStart`). |
| `mainBaselineSymbol` | same | Same meaning, emitted by Boriel for every arch except zx81sd. |
| `callSites` | `callSites` | A missing `callerIndex` (a top-level call) means the entrypoint's index. A missing `statementIndex` makes the site unusable: drop it and warn. `kind` matches; there is no `far`. |
| `variables` | `variables` | Map `type` names to `SourceValueType`; an unknown or missing type is shown raw (hex bytes). `dimensions` `[lo, hi]` → `{lower, upper}`. `declaredAt.column` = 0. **Drop the frame location of FASTCALL parameters** (V6). Ignore `bank` on frame locations. A local array without `dimensions` is a dynamic one behind a pointer: show its address only. |
| — | `runtimeSymbols`, `labels` | From the `-M` map (`HHHH: .name`; banked `BB::HHHH: .name`): `.core.*` → runtime symbols, `.LABEL._<x>` → user labels for GOSUB rows. `.LABEL.__LABELn` temporaries are dropped. |
| — | `errorEntry` | `.core.__ERROR` from the `-M` map. The code is in A at entry (B0, V5), which is the convention Klive's error stop already uses. |
| — | `libraryFiles` | Files under `<zxbasic.root>/lib/`. |
| — | `optimizationLevel` | From the command line actually used. |

---

## 6. Phase B4 — debugger parity

### 6.1 Frame locator: `fastcall`

Teach `locateActivations` and `SourceStepDecision` the `fastcall` convention:

- `returnSlotOffset` 0 and no IX frame: the return address is the first stack word, at or above SP,
  that matches a call site of this callee.
- `bodyStart`/`epilogueStart` bound it.

Klive BASIC never emits it, so this is new code that needs its own tests. Klive's own behaviour does
not change.

### 6.2 Guarantees G1/G2/G4/G5 are not promised by Boriel

Klive's stepping relies on four guarantees:

- each statement has one entry address that no internal branch targets (G1/G2);
- SP is constant at statement entries (G4);
- every user call is a recorded call site (G5).

Boriel's documentation states none of these. Plan:

- Run the debug-info validator on every Boriel build. A **debug** build that fails it still runs, but
  source stepping falls back to "stop at any statement entry" (no Step Over/Out semantics), with a
  build-output warning naming the statement.
- The Boriel variant of `corpus-debugger.test.ts` (§8) measures how often this happens. The number goes
  to Boriel as a bug report, not into a workaround.

### 6.3 Error stops

- **zx48k/zx128k:** `__ERROR` does `RST 8`, so Klive's generic ROM-error path works unchanged.
- **zxnext:** `__ERROR` writes `ERR_NR` and halts behind a panic screen, with no `RST 8`. Use
  `errorEntry` = `__ERROR`, with the code in A at entry (B0). The stop comes before the panic screen.
- **`__STOP`** sets `ERR_NR` without stopping. It is not an error stop, which matches Boriel's
  documentation.

### 6.4 NEX sidecar

`NexLaunchCommand` also looks for `<name>.dbg` next to a `.nex`. It accepts the file only when
`binaryChecksum`/`binaryLength` match the bytes the `.nex` loads; otherwise it warns and launches
without source debugging.

### 6.5 Everything else unchanged

The following need no Boriel-specific code beyond the adapter, once the frame-locator change is in:

- breakpoints (line and statement);
- execution point;
- Step Into/Over/Out/Over Line;
- run to frame;
- step-into targets (`order`/`moreCallsFollow` exist);
- the symbolic call stack;
- the Variables panel (globals, locals, params, by-ref, fixed-bound arrays);
- return values at return points (`returnType`);
- BASIC watch expressions;
- data breakpoints on variables;
- Just My Code;
- the profiler routine map.

§10 lists where each falls short.

---

## 7. Phase B5 — banked programs (`--split-modules`)

1. **128K.** zxbc refuses `bin` and `sna` for a banked build. It writes only `tap`, `tzx` or `z80`
   (B0). Build `-f z80 -B -a`, read the snapshot with Klive's own `.z80` reader, and turn its RAM banks
   into segments `{bank, bankOffset}` for the program's banks (the `.dbg`'s partitions name them). That
   keeps the inject/run/debug flow. Loading the whole snapshot is the fallback. A split-bin output
   remains a nice-to-have request to Boriel, not a dependency.
2. **Next.** The `.nex` already carries the banks. Run/debug go through the NEX launch path with the
   `.dbg` sidecar (§6.4).
3. **Partition-qualified breakpoints and execution point** work through `partition`/`partitionedAddressMap`.
4. **Cross-bank calls.** `extensions.codebank` describes zxbc's far-call trampoline: a template, with
   target page/address patched at fixed offsets. There is **no shadow stack**. Klive's frame locator
   recognises far calls only through Klive's CODEBANK runtime. Supporting zxbc's mechanism needs a new
   locator branch that decodes the trampoline bytes (`callFar.bytes`/`slots`). It is scoped as a
   separate task once 1–3 work. Until then, see §10, item 4.

---

## 8. Phase B6 — editor, settings UI, templates, docs, tests

- **Settings UI.** Add `zxbasic.compiler` (Klive BASIC / Boriel BASIC) and the Boriel
  row (status + "Configure…") to `settings-pages.ts` under Integrations. Add a project-settings entry
  for B2. The status bar shows the active BASIC compiler when a `.zxbas` file is focused, so the
  switch is never invisible.
- **Templates** stay as they are (B6). There is no spp3e `zx-basic` template today; adding one is
  independent of this plan.
- **Editor intelligence.** Under `boriel` there is no `BasicIntelData`. The data comes from Klive's
  binder, and Boriel 2.0 accepts syntax Klive's parser does not (`MODULE`/`USE`/`PRIVATE`, `CALL FAR`)
  and the reverse (CODEBANK). Keyword help, completion and folding stay. See §10.
- **Docs.** Update `docs/content/working-with-ide/zxb.mdx`: installing, switching, what differs (§10).
  Update `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (§2 table) when this ships, under the standing
  instruction.
- **Tests:**
  - Unit: archive extraction (mode bits, traversal, GNU magic), resolver/probe, option mapping,
    diagnostics parser, the adapter on fixtures (B-T1), FNV-1a.
  - Debugger: the `fastcall` locator, and a Boriel variant of `corpus-debugger.test.ts` over the
    committed fixtures (B-T1 a), run on `test/harness/sp48`. The new tests that run a core go into
    `build/e2e-tests.ts`.
  - Local only: `scripts/boriel-check.cjs`. It is `kbasic-ide-check.cjs`'s `classic` and `next` parts
    with `zxbasic.compiler boriel`, plus the first-run install on a fresh `HOME`, and it needs the kit.
  - `npm run build:check`, `npm run lint:renderer`, and the electron-vite build after moving the
    extractor.

---

## 9. Facts verified in Phase B0 (2026-10-17)

| # | Question | Answer (details in `.ai/boriel/`) |
| --- | --- | --- |
| V1 | Does every kit start? | Yes for arm64-macos, x86_64-macos (Rosetta) and arm64-linux, with byte-identical output. The hang was the macOS quarantine trap (§1.4). x86_64-linux and Windows are still to run (§2). |
| V2 | Diagnostics format | `file:line: error|warning: [Ennn|Wnnn] message`; the code is sometimes absent; **no column**; the path is in the form given. Argument errors (exit 2) go to stderr even with `-e`. |
| V3 | Array locations | Global: the 4-word descriptor (Klive's layout), data at +8. Local fixed-size: a 3-word descriptor in the frame (no upper-bound slot). Local dynamic: the frame slot points to a heap block; the shape was not determined, and the `.dbg` does not say. |
| V4 | Partition numbering | zx128k: the 16K bank. zxnext: the window's first 8K page, so `page = partition + ((addr − $C000) >> 13)`. `frames[]` carry none. |
| V5 | `__ERROR` | The code is in A on zx48k and zxnext, as Klive's `errorEntry`. On the Next the stop comes before the panic screen. |
| V6 | FASTCALL parameters | Listed with a **wrong** frame location (`ixOffset 5`). The value is in A at entry, and IX is the caller's. A BASIC-bodied FASTCALL function also computes wrongly (`boriel-issues.md` #1). |
| V7 | Stepping guarantees | G4 (constant SP per activation) and G5 (recorded call sites) held at `-O 0`/`1`/`2` on the probes. Statements removed by the optimiser vanish (index gaps). `endAddress`/`addressToStatement` absorb prologues, epilogues and statement-less code (§5). G1/G2 were not tested directly. |
| V8 | Strings | Pointer → `[len16][chars]`, the same with `--cow-strings` for the cases tried. |
| V9 | Banked 128K injection | `-f z80` (with `-B -a`), read by Klive's `.z80` reader (§7). |
| V10 | Map labels | `.LABEL._<line>` = user labels; `.LABEL.__LABELn` = temporaries; `.core.*` = runtime; `._name` = user symbols. |

--- | --- | --- |
| V1 | Does every kit start (`--version`) without hanging? | §2, §3.5 |
| V2 | Exact diagnostics format (file, line, column?, severity, code) | §4.3 |
| V3 | Does a global or local array's `location` point at the descriptor (as Klive's) or at the data? Same 4-word descriptor? | §5, §6.5 |
| V4 | Partition numbering for zx128k (16K bank) and zxnext (8K page or 16K bank?) | §5, §7 |
| V5 | Code register at `__ERROR` on zxnext; is it before the panic screen? | §6.3 |
| V6 | How a FASTCALL routine's parameter is described in `variables` (if at all) | §6.1, §10 |
| V7 | Does `-O 2` keep G1/G2/G4/G5? How often does the validator fail on the template programs? | §6.2 |
| V8 | String layout with and without `--cow-strings` | §10 |
| V9 | How banked 128K output can be injected (bank manifest?) | §7 |
| V10 | Are `-M` labels named so that BASIC line labels can be told apart from runtime labels? | §5 |

---

## 10. What does not work with Boriel BASIC, compared to Klive BASIC

From the published v2.0 debug format (2026-10-17) and the kit's CLI. Items marked **(adapter)** are
filled in by Klive and are not real losses. The rest are losses, each with the reason it comes from
the format or the compiler.

**Stepping and statements**

1. **No statement kinds.** `kind` is always `"normal"`. Klive BASIC gives the separately executing parts
   of block statements their own ids: the `IF`/`ELSEIF`/`WHILE`/`LOOP UNTIL` condition, `FOR`
   initialisation, `NEXT` increment and test, `END SUB`/`END FUNCTION`. With Boriel, stepping through
   loops and conditionals stops wherever zxbc happened to put a statement boundary. Whether the `NEXT`
   test is a separate stop is unknown until V7.
2. **No `elided` flag and no split-statement `ranges`.** Klive marks a statement the optimiser removed,
   so the debugger skips it and the Variables panel explains the unchanged value, and it lists every
   address run of a statement split by optimisation. Boriel only has `startAddress`/`endAddress`,
   where end = the next statement's start, and the last statement in a bank repeats its start.
   Breakpoints on an elided statement may resolve to the next statement's code. Run-length-based
   features (coverage, heat map per statement) are approximate.
3. **No documented stepping guarantees** (G1/G2/G4/G5). Klive BASIC's code generator guarantees them
   and its validator checks every build. Boriel's Step Over/Step Out are only as right as zxbc's code
   happens to be. A build that fails validation degrades to "stop at next statement" (§6.2).

**Calls, frames and banking**

4. **Cross-bank calls (CALL FAR / `--split-modules`).** There is no `"far"` call-site kind and no
   shadow call stack. The call stack cannot be walked through a far call, and Step Over/Out across a
   bank switch are unreliable until a trampoline decoder exists (§7, item 4). Klive's CODEBANK-based
   banked debugging has no Boriel equivalent. Also, **CODEBANK itself is Klive BASIC syntax**: those
   programs do not compile under Boriel, which uses `MODULE`/`USE` with `--split-modules` instead.
5. **`callTargets` is always `[]`.** No loss, because Klive uses `callSites` for the same information.
6. **Top-level call sites have no `callerIndex`.** **(adapter)** It is the entrypoint routine.
7. **FASTCALL routines** have no IX frame. Klive's locator gains a `fastcall` path (§6.1). Their
   parameters are listed with a wrong frame location, so they are not shown in the Variables panel
   (V6). A BASIC-bodied FASTCALL function also computes a wrong result in zxbc itself
   (`.ai/boriel/boriel-issues.md` #1).
8. **Frame `endAddress` is approximate.** Several routines can share an epilogue, and the entrypoint
   has none. This affects the profiler's routine attribution near routine ends.

**Variables**

9. **No CONST entries.** Klive BASIC lists constants with their values; Boriel lists none.
10. **No bounds or elements for DYNAMIC arrays.** `dimensions` is omitted, and the frame slot points to
    a heap block whose shape is undocumented (V3). The panel shows the array's address only.
    Fixed-size global and local arrays work.
11. **No declaration column.** `declaredAt` has only file and line, so the "declared at" link goes to
    the line, not to the identifier.
12. **`type` may be missing.** Such entries are shown as raw bytes. There is no type-driven editing.

**Runtime, errors and symbols**

13. **No `errorEntry`.** **(adapter)** It is `-M`'s `__ERROR`, with the code in A as Klive expects
    (V5), so runtime-error stops work on both archs. What differs is after the stop: on the Next,
    continuing shows Boriel's panic screen and halts, where Klive BASIC returns with ERR_NR set
    (D-C5).
14. **No `runtimeSymbols`, `labels`, `libraryFiles` or `optimizationLevel`.** **(adapter)** These come
    from `-M`, the install path and the command line. GOSUB rows show a label only if V10 holds;
    otherwise they show "GOSUB" + address.
15. **The `.dbg` covers only compiled BASIC.** Inline `ASM … END ASM` blocks and stdlib assembly have
    no source mapping, so stepping into them is Z80-level in the disassembly. Klive BASIC maps inline
    asm lines, its asm being compiled by Klive's assembler.
16. **`--cow-strings`** kept the classic visible string layout in B0's cases (V8), so strings are
    decoded as usual. The decoder stays defensive: a length beyond the heap shows "unavailable".

**Source positions (B0)**

16a. **Statements the optimiser removes vanish without trace.** No `elided` marker, as item 2 says.
     A breakpoint on such a line resolves to the next statement with code, and the Variables panel
     cannot explain why a value did not change.
16b. **Column ranges are approximate:** indented assignments start at column 0, and multi-item
     `PRINT` statements end after their first item. The adapter repairs both heuristically (§5);
     other statement kinds may have similar gaps.
16c. **Diagnostics have no column**, so error markers cover the whole line (Klive BASIC marks the
     exact span).

**Editor and build**

17. **No language intelligence** beyond keywords, completion and folding: no hover types, go to
    definition, references, rename, outline, signature help, or library `#include` insertion. All of
    these come from Klive's binder, which does not compile Boriel 2.0's extended syntax. Diagnostics
    come from `--parse-only`, so they are only as precise as zxbc's (columns per V2).
18. **No in-process debug profile.** `-O 1` is passed instead of Klive's debug profile. Its fidelity
    depends on zxbc.
19. **Slower builds and background checks.** zxbc is an external process per build and per check;
    Klive BASIC runs in process and in the worker.
20. **Machine coverage.** There is no ZX81 target (`zx81sd` is different hardware). The +3, Scorpion
    and Timex run zxbc's generic `zx128k`/`zx48k` code, without the per-machine targets Klive BASIC
    has (for example `zxplus3`).
21. **Klive-only language and options are ignored**, with a warning: `'@asm-dialect klive` inline
    asm, Klive's debug-info level, and Klive's documented deviations where zxbc's arithmetic is wrong
    (D-C6). The same program can therefore compute different results under the two compilers.

**What Boriel adds that Klive BASIC does not have:** `binaryChecksum` build identity (Klive can verify
that a `.dbg` matches the loaded program), `MODULE`/`USE` with automatic bank packing, `zx81sd`, and
zxbc's own `tap`/`tzx`/`sna`/`z80` writers.

---

## 11. Readiness gate — when Boriel BASIC counts as "sound and safe"

All of these are needed before anyone proposes making Boriel the default:

1. **Production licence (B-L1):** for any non-beta Boriel version, the licence text ships in the installer and in `THIRD_PARTY_NOTICES.md`. The beta goes ahead on the author's written permission.
2. Install and update succeed on every shipped platform from a fresh `HOME`. A failed install leaves no
   half-written folder and never touches an existing one.
3. Every template program, and the Boriel debugger corpus, builds, runs and debugs through
   `boriel-check.cjs`. The validator (§6.2) passes on all of them at the debug profile.
4. Build-identity checks never let a stale `.dbg` drive the debugger.
5. The §10 losses the author considers essential are closed, or accepted in writing.

---

## 12. Phases at a glance

| Phase | Content | Depends on |
| --- | --- | --- |
| B0 | **Done.** Kit verification, facts V1–V10, `.ai/boriel/`. x86_64-linux and Windows runs move to B1's CI install tests | — |
| B1 | Packaging, extractor refactor, installer service, setup dialog, first-run offer, resolver/probe | B0 |
| B2 | `BorielCompiler`, switch (B1/B2), options, diagnostics, inject/run/export, removal of the 1.x integration (§4.5), `sourceFileList` guard | B1 |
| B3 | `.dbg` adapter + `-M` parser, fixtures (`test/boriel/fixtures/`, B-T1) | B2 |
| B4 | `fastcall` locator, validator fallback, error stops, NEX sidecar | B3 |
| B5 | Banked 128K/Next, trampoline decoder (separate task) | B4, V4/V9 |
| B6 | Settings UI, status bar, docs, competitive-analysis update, local IDE check | B2–B4 |

The extractor refactor (B1, step 1) and the `sourceFileList` guard (B2) are independent of
everything else and can land first.
