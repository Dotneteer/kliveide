# Z88 Snapshot (`.z88`) Plan

Status: **Complete — all seven phases done** (open questions resolved, see §7)
Scope: OZvm `.z88` snapshot files: a shared parser, loading a snapshot into the Z88 WASM machine
(load / run / debug-stop-at-PC), an IDE document viewer for `.z88` files (with memory dump and
disassembly), and an emulator menu item.
Origin: [Dotneteer/kliveide#1397](https://github.com/Dotneteer/kliveide/issues/1397) (Gunther Strube).
Format reference: [OZvm wiki — Z88 Snapshot Format](https://gitlab.com/b4works/ozvm/-/wikis/Z88-Snapshot-Format)
(the spec is normative; its "Load algorithm" section is what §4.3 implements).
Sample: `mm+jsw-oz5.z88` attached to the issue (OZ 5 on a 512K AMD flash in slot 0, 128K internal RAM,
32K EPROMs in slots 2 and 3, `Autorun=true`).

---

## 1. What is being added, and why

OZvm can freeze a whole Z88 (Z80, Blink, every populated bank, the slot cards) into a `.z88` file.
Loading those files into Klive gives OZvm users an easy migration path. It also makes ready-made
debugging setups possible: save the machine just before the interesting code, then open it in Klive
and debug from there.

Klive has no snapshot loading for any machine today. `.z80` and `.sna` have read-only viewers only.
The nearest models in the codebase are:

- the ZX Next checkpoint restore in `MachineController.runCode` (state injected, then the controller
  is left **Paused**);
- the `.nex` launch flow (`NexLaunchCommand`, `NexLaunchContextMenu`): Run, Debug, and Debug (break
  at entry) from a document toolbar and the Explorer context menu.

### 1.1 Decisions taken before drafting

| # | Decision |
| --- | --- |
| D1 | **Hybrid RAM+Flash cards (types 8, 9, 12) are rejected** with a clear message. The viewer still shows them, marked unsupported. |
| D2 | **RTC catch-up is implemented**: on load, TIM0–4 are advanced by `max(0, now − Z88StoppedAtTime)`, exactly as in the spec. |
| D3 | A `.z88` file gets a **document viewer** in the IDE that shows the file's contents, including a memory dump and disassembly. |
| D4 | The snapshot can be **loaded into the machine and started with or without debugging**. With debugging, the machine **stops at the snapshot's PC** before executing it. |
| D5 | Flash types that OZvm models as distinct chips but which are AMD-compatible become Klive AMD cards of the same size (issue text). |
| D6 | Unzipping uses the **`fflate`** dependency. |
| D7 | The issue's sample `mm+jsw-oz5.z88` is **committed as a test fixture** (Gunther agreed). |
| D8 | Card-type numbering follows the **spec**: 9 = AMIC hybrid (rejected), 10 = STM (→ AMD). Type 14 (Intel SA) maps to the Klive Intel card. Gunther agreed to both. |
| D9 | The emulator menu offers **Load** (paused at PC, ignoring `Autorun`) next to the `Autorun`-driven open. |

### 1.2 Out of scope (later work)

- **Saving** `.z88` snapshots (the inverse writer).
- `boot.z88` autoload at startup.
- Importing the snapshot's `Breakpoints` into Klive's breakpoint set. They are bank+offset addresses,
  and bank-relative breakpoints are Next-only today. The viewer lists them (§4.6).
- Hybrid cards (D1).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| WASM core | `src/emu/machines/z88/wasm/z88/` — `z88.c` (CPU exports 346–389, `z88Memory[0x400000]`), `z88-blink.c` (state 34–48, exports 365–391), `z88-memory.c` (card kinds 16–22, `z88InsertCard` 287), `z88-cards.c` (flash state, not exported) |
| Machine wrapper | `src/emu/machines/z88/Z88WasmV2Machine.ts` — register setters 108–349, `insertCardIntoBackend` 631, `getBlinkState` 716, private `syncCpuFromWasmV2` 858, 64K flattening in `getMemoryPartition` ~677–690 |
| Host / setup | `src/emu/machines/z88/Z88WasmHost.ts` — `setup()` 117 (slot 0 needs a `file`, or setup aborts), `configure()` 169, `hardReset()` 209 (**re-runs `setup()`**, which re-inserts cards from config) |
| Card vocabulary | `CardIds.ts`, `CardSlotState.ts`, `z88CardCatalog.ts` (`z88CardSpec`, `z88InternalRamSizeInBytes`), `src/renderer/appEmu/machines/z88Cards.ts` (`allowInSlot0`: EPROMs, Intel 512K, AMD 512K) |
| Config keys | `src/common/machines/constants.ts:5-22` (`MC_Z88_INTRAM`, `MC_Z88_SLOT0..3`) |
| Start/stop | `src/emu/machines/MachineController.ts` — `run()` 847 resets on None/Stopped; `state` setter 193 dispatches `setMachineStateAction` (returns early if unchanged); `stop()` 313 clears `lastBreakpoint`; `runCode` 653–679 is the inject-then-Paused precedent |
| Stop at entry | `DebugStepDecision.ts:117-136` (a breakpoint at PC fires with 0 instructions executed unless `lastBreakpoint === pc`); `NexLaunchCommand.ts:133-150` (one-shot `owner:{kind:"session"}` breakpoint, then debug) |
| Emu messaging | `src/common/messaging/EmuApi.ts` (stub + `createEmuApi` proxy), `src/renderer/appEmu/MainToEmuProcessor.ts` (same-named handler) |
| Machine rebuild from emu side | `MachineService.setMachineType` (`src/renderer/appEmu/MachineService.ts:46`); precedent `useZ88Ports.ts:43` |
| Viewers | `src/renderer/registry.ts` (panel table ~395–425, file types ~648–689), `GenericFilePanel`, `Z80FileViewerPanel.tsx`, `NexFileViewerPanel.tsx`, `NexBankBrowser.tsx`, `MemoryDumpViewer`, `openStaticMemoryDump` (`StaticMemoryDump.tsx:1688`) |
| Tab toolbar / context menu | `FileTypePattern.documentTabRenderer` / `contextMenuInfo`; model: `src/renderer/features/documents/NexLaunchContextMenu.tsx` |
| Emu menu | `src/main/machine-menus/z88-menus.ts`; menu → IDE command via `getIdeApi().executeCommand(...)` (`app-menu.ts:870`) |

**No ZIP library is installed** (no jszip, fflate, pako or adm-zip). `GenericFilePanel`'s
`fileLoader` is synchronous, so the browser's async `DecompressionStream` does not fit the viewer.

---

## 3. The traps

1. **`run()` resets from Stopped.** A state loaded into a Stopped machine is wiped by the next Start.
   The loader must leave the controller **Paused**. To make the IDE refresh, go Stopped → Paused: the
   setter does not dispatch when the state is unchanged.
2. **`hardReset()` re-runs `setup()`.** Restart, or a machine rebuild, re-inserts the cards from
   config and loses the snapshot's card contents. Stop then Start only does a soft reset, so memory
   survives (like the real reset button). Document this; don't fight it.
3. **Slot 0 config needs a ROM file.** `setup()` aborts if slot 0 is configured without a `file`.
   The loader must therefore not route slot 0 through `setup()` (§4.4).
4. **COM before SR0.** SR0 paging depends on `COM.RAMS`, so COM is restored before SR0–SR3.
5. **Card insertion erases EPROM/flash** to `$FF`, so bytes are written *after* `z88InsertCard`.
6. **Missing core setters**: TIM0–4 and TSTA cannot be set; PB0–3/SBR are only settable via
   `z88WritePort` with B as the high byte.
7. **Spec vs. issue numbering.** The issue says "STM (9)", but the spec has 9 = AMIC *hybrid* and
   10 = STM. The plan follows the spec (D8).

---

## 4. Design

### 4.1 Shared parser — `src/common/z88/z88Snapshot.ts` (pure, no Node/DOM)

Used by the viewer (IDE renderer), the load command, and the tests.

- **ZIP reader** (`z88Zip.ts`): a thin wrapper over `fflate`'s synchronous `unzipSync` (D6), which
  reads STORED and DEFLATE members and works in main, renderer and vitest. The wrapper only turns
  `fflate` errors into "Not a ZIP archive (...)" and drops directory entries.
- **Properties parser** (`z88Properties.ts`): the full `java.util.Properties.load` grammar:
  ISO-8859-1, `#`/`!` comments, `=`/`:`/whitespace separators, continuation lines, and `\t \n \r \f
  \uXXXX` escapes. It is barely longer than a subset, and a hand-edited settings file may use any of it.
- **Model**:

  ```ts
  type Z88Snapshot = {
    cpu: { af, bc, de, hl, af_, bc_, de_, hl_, ix, iy, pc, sp, i, r, im, iff1, iff2 };
    blink: { com, int, sta, tmk, tsta, sr: [4], tim: [5], pb: [4], sbr, scw, sch };
    rom: { type: number; bytes: Uint8Array };          // slot 0, banks $00..
    ram: Uint8Array;                                   // banks $20..
    slots: (Z88SnapshotSlot | null)[];                 // index 1..3
    autorun: boolean; stoppedAt?: number; breakpoints: { ext: number; display: boolean }[];
    png?: Uint8Array; extraEntries: string[]; warnings: string[];
  };
  type Z88SnapshotSlot = { ozvmType: number; bytes?: Uint8Array; ram?: Uint8Array; flash?: Uint8Array };
  ```

- **Errors** (hard): not a ZIP; missing `snapshot.settings`, `rom.bin` or `ram.bin`; a bank image
  whose length isn't a multiple of 16384; a bad hex or decimal value; `SLOTnTYPE` missing for
  slots 1–3. Missing `SCW`/`SCH`/`Autorun`/`Z88StoppedAtTime` take the spec's defaults.
- Parsing never rejects hybrids or unsupported sizes. That is the mapping's job (§4.2), so the
  viewer can still display such files.

### 4.2 Mapping to Klive cards — `mapZ88SnapshotToKlive(snapshot)`

Returns `{ intRamMask, slot0: Z88CardSpec, slots: (Z88CardSpec|null)[], errors: string[] }`.

| OZvm type | Name | Klive card (by size) |
| --- | --- | --- |
| 0 | Empty | — |
| 1 | ROM | slot 0: `ROM` (128/256/512K); slots 1–3: UV EPROM of the same size (32/128/256K), else error |
| 2 | RAM | `RAM32`…`RAM1024` |
| 3 | UV EPROM | `EPROMUV32/128/256` |
| 4 | Intel Flash S5 | `IF28F004S5` (512K) / `IF28F008S5` (1M) |
| 14 | Intel Flash SA | same as 4 (D8) |
| 5, 6, 10, 11, 13 | AMD / AMIC / STM / SST / Macronix | `AMDF29F040B` (512K) / `AMDF29F080B` (1M) |
| 8, 9, 12 | Hybrids | **error** (D1) |
| 7, other | — | error |

- Any other size is an error.
- Slot 0 is further limited to the `allowInSlot0` set and 128/256/512K, as the insert-card dialog
  requires.
- Internal RAM: `ram.bin` of 32K, 128K or 512K maps to the `MC_Z88_INTRAM` chip mask, the inverse of
  `z88InternalRamSizeInBytes`. Any other size is an error.

### 4.3 RTC catch-up — `adjustZ88LostTime(tim, stoppedAtMs, nowMs)`

Implements the spec's "Generic algorithm" with BigInt or safe Number arithmetic (the max is about
1e12 ms, well inside 2^53, so `Number` is fine):

1. Decode TIM0–4 to milliseconds.
2. Add `max(0, now − stoppedAt)`.
3. Encode back, wrapping TIM4 to 8 bits and clamping the 5 ms tick to 199.

No TIME interrupt is raised (spec). The catch-up is applied even when `COM.RESTIM` is set, as OZvm
does; Klive's core then zeroes TIM on the next tick anyway.

### 4.4 Core and machine — loading the state

**C core** (`z88-blink.c`, rebuild with `npm run build:z88-wasm`). New exports:

- `z88SetTim(index, value)` and `z88SetTsta(value)`.
- `z88SetPb(index, value)` and `z88SetSbr(value)`. These go through the same internal path as the
  port writes, so any screen-side caches in `z88-screen.c` are updated. *Verify those caches when
  implementing.*
- A way to put each flash chip back into read-array mode, unless `z88InsertCard` already does this.
  The snapshot carries no flash command state, so read-array is correct.

**`Z88WasmV2Machine.loadSnapshotState(snapshot, mapping, nowMs)`** (public, new):

1. Clear the keyboard matrix. Set `halted`/`snoozed` to false, and reset the Blink with `EPR`,
   `ACK` and `TACK` idle.
2. Insert each card through `insertCardIntoBackend`, slot 0 included, replacing the card the
   config inserted, then copy its bytes in. Empty slots get `removeCardFromBackend`. Copy internal
   RAM to `0x080000`.
3. Restore the Blink: COM, then SR0–SR3, INT, STA, TMK, TSTA, PB0–3, SBR, SCW/SCH, and TIM0–4
   after `adjustZ88LostTime`.
4. Restore the CPU: main and alternate registers, IX, IY, `I`/`R` (combined into the core's `IR`),
   IM, IFF1/2, PC, SP.
5. Call `syncCpuFromWasmV2()` and invalidate any cached disassembly/memory views (the same calls
   the Next checkpoint restore makes).

### 4.5 Orchestration in the emulator — `emuApi.loadZ88Snapshot(bytes, mode)`

`mode` is `"load" | "run" | "debug"`. The handler lives in `MainToEmuProcessor`:

1. Parse and map. On any error, throw; the IDE command reports it.
2. **Make the machine fit.**
   - If the machine isn't a Z88, or the internal RAM size or the LCD size (`mapping.screenSize`,
     when defined) differs, rebuild it through
     `machineService.setMachineType(MI_Z88, currentModelOrDefault, config)`. Set `MC_Z88_INTRAM`,
     `MC_SCREEN_SIZE`, and
     set `MC_Z88_SLOT1..3` to `{ size, cardType }` *without* `file`, so the card UI shows the right
     cards (blank until step 4).
   - **Slot 0's config is left as it is.** Its bytes are replaced in the core only (trap 3).
   - If a rebuild isn't needed, update `dynamicConfig` for slots 1–3 the way `applyCardStateChange`
     does.
3. `controller.stop()`. This makes the next state change dispatch, and clears `lastBreakpoint` and
   `lastStartupBreakpoint`.
4. `machine.loadSnapshotState(...)`, then `controller.state = Paused`. The IDE refreshes through
   `setMachineStateAction`, and the execution point shows the snapshot's PC.
5. Per mode:
   - `load`: done (Paused at PC, not debugging).
   - `run`: `controller.start()`, which resumes from Paused without a reset.
   - `debug`: add a one-shot exec breakpoint `{ address: pc, exec: true, oneShot: true, owner: { kind: "session" } }`,
     then `controller.startDebug()`. It stops before executing the instruction at PC, in debug mode
     (`isDebugging` set by `run()`), exactly as `nex-run -e` does.

**Persistence.**

- The rebuild changes `emulatorState.config`. The plan does **not** save the project. If the user
  later saves, the project records the snapshot's card types and RAM size, but not the card bytes.
- Restart (hard reset) returns to the configured ROM and blank cards (trap 2). This is documented
  in the user docs.

### 4.6 IDE command — `z88-snapshot "<path>" [-r | -d | -a]`

`src/renderer/appIde/commands/Z88SnapshotCommand.ts`, registered like `NexLaunchCommand`.

- Reads the file with `mainApi.readBinaryFile`, then calls `emuApi.loadZ88Snapshot(bytes, mode)`.
- No flag: load and stay paused. `-r`: run. `-d`: debug and stop at PC.
- Outputs a one-line summary to the console, plus any warnings (for example "RTC advanced by 3d 4h").

**Project guard:** if a project is open and its machine isn't a Z88, the command refuses ("the
current project targets <machine>"). Switching a project's machine type behind the user's back is
worse than an error message. With no project open, the command switches to the Z88 freely.

### 4.7 Emulator menu items

`z88-menus.ts` gets two items. Both open a file dialog filtered to `*.z88`, then call
`getIdeApi().executeCommand('z88-snapshot "<path>" <flag>')`:

- **Open Z88 snapshot…**: the flag follows `Autorun`. `true` runs; `false` debugs and stops at PC,
  as the spec intends.
- **Load Z88 snapshot…** (D9): no flag, so the machine stays paused at PC and `Autorun` is ignored.

These menu items are the only path that reads `Autorun`; the viewer buttons always do what the user
clicked.

### 4.8 The `.z88` viewer

New editor id `Z88_SNAPSHOT_VIEWER`. File type `{ matchType:"ends", pattern:".z88", isBinary:true,
isReadOnly:true, openPermanent:true, documentTabRenderer, contextMenuInfo }`. The panel is
`src/renderer/appIde/DocumentPanels/Z88/Z88SnapshotViewerPanel.tsx`, built on `GenericFilePanel`
with `fileLoader = parseZ88Snapshot` (synchronous, thanks to `fflate`). `ExpandableRow` sections,
with expanded state kept in `viewState`:

1. **Summary**
   - Autorun.
   - Saved at: the `Z88StoppedAtTime` local date.
   - RTC on load: the TIM value after catch-up, as an elapsed duration.
   - Archive entries with their sizes, any unknown entries, parser warnings.
   - **Loadability**: the mapping errors from §4.2, so the user sees "hybrid card in slot 3 — cannot
     load" before trying.
   - The `snapshot.png` LCD thumbnail, if present (cosmetic; rendered as an `<img>` from a blob URL).
2. **Z80 registers**: the main and alternate sets, IX/IY/PC/SP/I/R/IM/IFF1/IFF2, in the
   `LabeledText` style of the `.z80` viewer.
3. **Blink**
   - COM/INT/STA/TMK/TSTA with their bit flags decoded.
   - SR0–SR3 with the bank number and its owner (`ROM`/`RAM`/`Slot n`).
   - TIM0–4 raw and decoded.
   - PB0–3 and SBR as hex, SCW/SCH as pixels.
4. **Address space at PC**: the 64K Z80 view as SR0–SR3 and `COM.RAMS` page it.
   - Built by a pure `buildZ88AddressSpace(bankReader, sr, com)` in `src/common/z88/`, so the viewer
     and `Z88WasmV2Machine.getMemoryPartition` agree. The machine can be switched to it later; that
     isn't required.
   - Shown in a `MemoryDumpViewer` preview, with **Disassembly at PC** opening
     `openStaticMemoryDump(..., { disassemblyEnabled: true, viewMode: "disassembly", topAddress: pc })`.
   - This is the "what will execute" view.
5. **Slots 0–3 and internal RAM**: one row per slot showing the OZvm type name, the Klive mapping
   (or the reason it can't be loaded), the size, and the bank range.
   - Each has a **bank browser** modelled on `NexBankBrowser`: pick a bank and dump its 16K.
   - Disassembly uses `disassOffset` set to the segment the bank is currently paged into, if it is
     (from SR0–3), else `$C000`, with the offset shown in the title.
6. **Breakpoints**: the snapshot's list as `BB:HHHH` with stop/display, read-only (out of scope §1.2).

All of it uses existing primitives (`ExpandableRow`, `LabeledText`, `@renderer/controls/data`).
There are no new colours. If any style change turns out to be needed, update
`.ai/ui-theming-intent-and-lessons.md` in the same change (house rule).

### 4.9 Toolbar and context menu

`Z88SnapshotLaunchCommandBar` and `getZ88SnapshotContextMenuInfo`, copied from
`NexLaunchContextMenu.tsx`. Three buttons, **Load**, **Run** and **Debug (stop at PC)**, mapped to
`z88-snapshot "<path>"`, `-r` and `-d`. They are disabled, with a hint, when the project guard of
§4.6 would refuse. Loadability errors leave the buttons enabled; the command reports them.

---

## 5. Phases

### Phase 1 — parser, mapping, RTC (nothing user-visible) — ✅ **COMPLETE**
- Add `fflate`. Write `src/common/z88/{z88Zip,z88Properties,z88Snapshot,z88SnapshotMapping,z88Rtc}.ts`.
- Tests in `test/z88/snapshot/`:
  - ZIP with STORED and DEFLATE (fixtures built in-test with `fflate.zipSync`);
  - properties edge cases;
  - each hard error;
  - the mapping table, row by row, including hybrids → error and odd sizes → error;
  - RTC: the spec's worked example (`00 00 0A 1E 28` + 5 h → `00 01 36 1E 28`), a negative delta,
    and a TIM4 wrap;
  - the issue's sample file, committed as `test/z88/snapshot/fixtures/mm+jsw-oz5.z88` (D7). Its
    expected values come from its `snapshot.settings`:
    PC `F523`, SP `1EBA`, SR0–3 `21 22 BE BF`, slot types `5/0/3/3`.

**What differed from the plan**
- ZIP: `fflate.unzipSync` instead of a hand-written central-directory reader (§4.1).
- Properties: the full Java grammar instead of a subset (§4.1).
- Breakpoint offsets are kept as written (16 bits) rather than masked to 14, so a malformed file
  shows its real value in the viewer.
- An occupied slot without its image is read as empty with a warning, as OZvm inserts no card
  there. Members the format does not define are listed as warnings too.
- `ozvmCardTypeName()` lives in the mapping module, ready for the viewer.

**Tests**: `test/z88/snapshot/z88-snapshot.test.ts`, 100 tests. The RTC clamp was mutation-checked:
removing `max(0, …)` fails "never runs the clock backwards".

### Phase 2 — core setters and `loadSnapshotState` — ✅ **COMPLETE**
- Add the C exports, then `npm run build:z88-wasm`. Update the loader export type in
  `Z88WasmV2Loader.ts`.
- Write `loadSnapshotState` and `buildZ88AddressSpace`.
- Harness-level tests: load the sample into a real core, then assert registers, SR, TIM, and memory
  bytes at a few banks. Run 50 frames and assert no crash and that the PC left the start. Load the
  same state twice and expect identical results.

**What was built**
- Core (`z88-blink.c`): `z88SetTim`, `z88SetTsta`, `z88SetPb`, `z88SetSbr`, added to the build's
  allow-list and the loader's required exports.
- `Z88WasmV2Machine.loadSnapshotState(snapshot, mapping, nowMs)`:
  1. resets the machine and zeroes the 4 MB memory (what OZvm's `setVoidMemory` does);
  2. inserts or removes each card, slot 0 included, and copies its bytes in;
  3. copies the internal RAM to `$080000`;
  4. restores the Blink with COM first and TIM last, after the catch-up;
  5. restores the CPU and re-syncs the TypeScript mirror.

  It returns the restored TIM0–4. It throws on mapping errors and on an internal RAM size that
  differs from the machine's; Phase 3 rebuilds the machine before that can happen.
- `src/common/z88/z88AddressSpace.ts`: `buildZ88AddressSpace(readBank, sr, com)` and
  `z88SnapshotBankReader(snapshot)`, with card mirroring.
- Harness (`test/harness/z88`): the session methods `loadSnapshot(bytes, nowMs?)`,
  `insertedCards()` and `cpuState()`, documented in its README.

**What differed from the plan**
- No flash-reset export was needed: `z88InsertCard` already puts a flash chip into read-array mode
  and clears its command state.
- PB/SBR got direct setters rather than `z88WritePort`, because the screen has no caches (§6).
- Klive and OZvm encode SCW differently (Klive's `$FF` means 640 pixels; OZvm stores pixels / 8).
  The mapping therefore gained `screenSize` (the `MC_SCREEN_SIZE` for 640 × 64/256/320/480) and a
  `warnings` list. An LCD size Klive lacks is a warning, not an error. `loadSnapshotState` leaves
  the LCD to the configuration, and Phase 3 rebuilds the machine when `screenSize` differs.
- The 64K builder reads the odd-SR0 half of `$2000–$3FFF` correctly, where `get64KFlatMemory`
  keeps a parity quirk. A test holds the builder to the core: after a load, the CPU's view
  (`peekBytes(0, 64K)`) equals `buildZ88AddressSpace` over the file's images.

**Tests**: `test/z88/snapshot/z88-snapshot-load.test.ts`, 17 tests. They cover:
- every register, the Blink, and every image's physical location;
- the inserted cards (a stale slot-1 card is removed);
- the 64K paging, the 5-hour RTC catch-up, and a cleared HALT;
- 50 frames running with a lit LCD, two loads running to the same state, and a reload over a
  running machine;
- both refusals, and the LCD mapping.

Five mutations of `loadSnapshotState` were each caught: no reset, no TSTA, no PB, no card removal,
no I/R. The full Z88 suites still pass (28 files, 1,448 tests).

### Phase 3 — emu orchestration — ✅ **COMPLETE**
- Add `EmuApi.loadZ88Snapshot` plus its handler: machine fitting, stop → load → Paused, and the
  three modes.
- Tests at the controller level:
  - `debug` stops with `pc === snapshot.pc` and 0 instructions executed;
  - `run` advances;
  - `load` leaves the state Paused and dispatches exactly one state change.

**What was built**
- `IMachineController.restoreState(applyState, description)`, implemented in `MachineController`:
  stop, apply, attach the stored media, then **Paused**, and an output line with the PC. This is the
  same seam as the checkpoint restore in `runCode`, made generic; it is the only way to inject state
  that the next Start does not reset.
- `src/renderer/appEmu/machines/z88SnapshotLoad.ts`:
  - `loadZ88Snapshot(ports, bytes, mode, nowMs)` takes its services as ports
    (`Z88SnapshotLoadPorts`), so the flow is tested without the emulator window.
  - `fitMachineConfig(current, mapping)` builds the configuration and decides whether to rebuild.
  - A machine that already fits gets the new configuration through `setMachineConfigAction` and
    `dynamicConfig`, without a `configure()`; `loadSnapshotState` inserts the real cards.
- `EmuApi.loadZ88Snapshot(contents, mode)` → `EmuMessageProcessor.loadZ88Snapshot`, wired to
  `MachineService` and the store.
  - Its types are in `src/common/z88/z88SnapshotLoadTypes.ts`, so `EmuApi`, which lives in common,
    doesn't import from the renderer.
  - It returns `{ pc, tim, rebuilt, autorun, warnings }`. The IDE command (Phase 4) reports these,
    and the emulator menu uses `autorun`.

**What differed from the plan**
- The rebuild check also covers the LCD size (Phase 2 finding). A machine of another type becomes
  the first registered Z88 model, with that model's slot-0 ROM.
- "Exactly one state change" was the wrong test. `stop()` itself fires Stopping and Stopped. What
  matters is that the last change is to Paused, with the store's `machineState` and `pcValue`
  following it, and that a running machine really stops (its frame counter stands still).
- The project guard (§4.6) belongs to the IDE command, so it moves to Phase 4. This call does what
  it is asked.

**Tests**: `test/z88/snapshot/z88-snapshot-flow.test.ts`, 17 tests. They run on a real
`MachineController` and the real Z88 core, with fake `MachineService` ports that build machines as
`MachineService` does.
- Fitting: no rebuild when RAM and LCD fit, the cards recorded, slot 0 left alone, rebuilds for RAM,
  LCD and another machine type.
- `load`: Paused at `$F523` with the store following, the card configuration and `dynamicConfig`,
  a rebuild for the wrong RAM size, and a switch from a ZX Spectrum 48.
- `run` continues from the snapshot rather than a reset.
- `debug`: two Paused transitions at the same tact count (the restore, then the breakpoint, with no
  instruction between them), `isDebugging` set, and the one-shot consumed. A step then executes the
  first instruction, and debugging twice stops twice.
- A reload over a running machine really pauses it. `Autorun` is reported. An unloadable snapshot is
  refused with the machine untouched, as is a superseded rebuild.

Three mutations were checked:
- without the one-shot breakpoint, the debug tests fail;
- Stopped instead of Paused fails six tests;
- skipping the stop before the restore survived at first, so the frame-counter check was added to
  the reload test, which now catches it.

### Phase 4 — IDE command and emulator menu — ✅ **COMPLETE**
- `Z88SnapshotCommand` with argument parsing tests and the project guard (§4.6, moved here from
  Phase 3).
- The two `z88-menus.ts` items (§4.7).

**What was built**
- `src/renderer/appIde/commands/Z88SnapshotCommand.ts`: `z88-snapshot <z88-file> [-r | -d | -a]`
  (alias `z88snap`), registered in `IdeCommands.ts`.
  - It reads the file through `mainApi.readBinaryFile` and calls `emuApi.loadZ88Snapshot`.
  - It writes "set up again" (after a rebuild) and every warning to the output, and finishes with
    `Z88 snapshot <file> loaded, paused at | running | stopped at PC $XXXX.`
  - Errors from across the process boundary lose their `Error: ` prefixes.
- `z88SnapshotProjectGuard(state)`, exported for the viewer's buttons (Phase 6): a Klive project
  whose machine isn't a Z88 is refused, naming the machine. With no project open, any machine is
  switched.
- `z88SnapshotCommandText(path, option)` in `src/common/z88/z88SnapshotLoadTypes.ts` builds the
  command text, so the emulator menu and the viewer quote the path the same way.
- `src/main/machine-menus/z88-menus.ts`: `z88SnapshotRenderer`, registered between the LCD and
  reset items of the Z88 machine menu.
  - **Open Z88 Snapshot...** uses `-a`; **Load Z88 Snapshot (Paused)...** has no flag (D9).
  - The dialog remembers its folder (`z88SnapshotFolder` in the app settings).
  - A failed command shows its message in an error box. Both go through
    `getIdeApi().executeCommand`, as the emulator's Run/Debug items already do.

**What differed from the plan**
- **`-a`** (follow `Autorun`) is a command option, not the menu's logic. The command parses the
  file in the IDE to read the flag, so scripts and the console get the same behaviour as the menu,
  and `EmuApi`'s modes stay load/run/debug.
- The menu labels are "Open Z88 Snapshot..." and "Load Z88 Snapshot (Paused)...", so the
  difference between the two is visible in the menu itself.
- The machine-specific menu only exists while the machine is a Z88, so the project guard matters
  for the viewer's buttons and the console more than for the menu.

**Tests**: `test/commands/Z88SnapshotCommand.test.ts`, 20 tests:
- registration and the path check;
- validation: each option, two options, an empty or non-`.z88` path, and the guard with no project,
  a Z88 project, another machine's project and an unknown machine;
- execution: each mode, `-a` both ways, `-a` on a file that isn't a snapshot, an unreadable file,
  the emulator's refusal, and the rebuild and warning output;
- the command text.

The menu itself is checked in the running app (Phase 7).

### Phase 5 — viewer — ✅ **COMPLETE**
- `Z88SnapshotViewerPanel`, its registry entries, and the editor id.
- jsdom tests: render the synthetic snapshot; check that the sections are present, that the
  hybrid-card file shows the loadability error, and that **Disassembly at PC** calls
  `openStaticMemoryDump` with `topAddress === pc`.

**What was built**
- `src/renderer/appIde/DocumentPanels/Z88/Z88SnapshotViewerPanel.tsx`, on `GenericFilePanel`. Its
  `loadZ88SnapshotFileContents` parses and maps the file. A file Klive cannot *load* still opens,
  with its mapping errors shown; only a file that does not parse is reported as invalid.
- The sections, each an `ExpandableRow` whose expanded state is kept in the view state:
  1. **Snapshot**: Loadable and Autorun flags, the mapping errors (`Text variant="error"`), parser and
     mapping warnings, "Saved at", the RTC as saved and as it will be on load, the archive's members,
     and the LCD picture.
  2. **Z80 Registers**.
  3. **Blink**: COM/INT/STA/TMK/TSTA with their set bits named, SR0–3, TIM0–4, PB0–3, SBR, the LCD
     size.
  4. **Address Space at PC**: where PC is (bank and offset) and the bank behind each of the five
     ranges, with SR0's half named. The heading's two icon buttons open the 64K (built by
     `buildZ88AddressSpace`) as a memory dump or a disassembly, with `topAddress = PC`.
  5. **One section per card**: slot 0's ROM area, the internal RAM, and each occupied slot, hybrids
     included, with what it loads as (or why it can't), a bank dropdown, and the bank's
     `MemoryDumpViewer` with disassembly.
  6. **Breakpoints** (read-only).
- `src/renderer/appIde/DocumentPanels/Z88/z88SnapshotView.ts`: the React-free part, which covers the
  Blink bit names, the paged ranges, PC's bank and offset, the card and bank list, each bank's
  disassembly base, and the RTC duration.
- `Z88_SNAPSHOT_VIEWER` in `common-ids.ts`, with its panel and its `.z88` file-type entry in
  `registry.ts` (binary, read-only, permanent).
- No stylesheet and no colour: shared primitives only, `ch` widths. The one inline style is the LCD
  picture's `image-rendering: pixelated; max-width: 100%`. The rule behind it is recorded in
  `.ai/ui-theming-intent-and-lessons.md` ("A picture of the machine that a file carries is shown as
  stored").

**What differed from the plan**
- **Bank picking**: the bank browser is a dropdown, not a `NexBankBrowser` clone. A Z88 card has
  no per-bank annotations to list, so the NEX browser's list-and-details layout would carry nothing
  extra.
- **Disassembly base**: a bank disassembles at the address the snapshot pages it **through the card's
  mirrors** (a 32K card in slot 2 is banks `$80–$81`, and SR3 = `$BF` pages `$81` at `$C000`).
  Otherwise it disassembles at `$C000`. The plan's exact-SR comparison would have missed every
  mirrored card, which includes the sample's.
- **No mini dump in the paging section**: `MemoryDumpViewer`'s preview always starts at offset 0,
  which says nothing about PC. The two buttons open the dump already positioned at PC.

**Tests**
- `test/z88/snapshot/z88-snapshot-view.test.ts` (node, 20 tests): Blink bit names, paging (with
  and without COM.RAMS), PC's location, SR0's half bank, the sample's card and bank list, a hybrid
  shown both halves and not loadable, disassembly bases through mirrors and when not paged in, and
  RTC formatting.
- `test/renderer/Z88SnapshotViewerPanel.test.tsx` (jsdom, 8 tests): every section of the sample,
  registers, Blink bits and paging text, the LCD picture, an unloadable file still shown with its
  error, an invalid file, both "at PC" buttons (the opened document's 64K contents and
  `topAddress`), and a card's selected bank with its mirrored disassembly base.
- Not yet checked: how the viewer looks in the running app (Phase 7, by the AGENTS rule to verify
  geometry in the app).

### Phase 6 — toolbar and context menu — ✅ **COMPLETE**
- Command bar and Explorer context menu, with tests mirroring the NEX ones.

**What was built**
- `src/renderer/features/documents/Z88SnapshotLaunchMenu.tsx`, beside `NexLaunchContextMenu.tsx`:
  - `getZ88SnapshotContextMenuInfo`: the Explorer entries "Load Z88 snapshot (paused)", "Run Z88
    snapshot" and "Debug Z88 snapshot (stop at PC)".
  - `z88SnapshotLaunchCommandBarRenderer`: the viewer's tab-bar buttons, `pause` (load), `play`
    (run) and `debug` (debug, stop at PC), separated with `TabButtonSpace` as the other command bars
    are.
  - Both build the command with `z88SnapshotCommandText`. They do what was clicked and ignore
    `Autorun`.
  - Both are disabled only where `z88SnapshotProjectGuard` refuses (another machine's project). The
    buttons' tooltips then carry the reason.
- Registered on the `.z88` file type in `registry.ts` (`documentTabRenderer`, `contextMenuInfo`).

**What differed from the plan**
- The NEX entries gate on "the machine is a Next". These gate on the project guard instead,
  because loading a snapshot switches a machine that has no project.
- A test now runs the command text through the IDE's own tokenizer (`parseCommand`): a path with
  spaces and a Windows path with backslashes both reach the command intact, as one argument.

**Tests**
- `test/renderer/Z88SnapshotLaunchMenu.test.tsx` (jsdom, 12 tests): each context-menu entry's text
  and command; the disabled state for no project, a Z88 project, another machine with no project,
  and another machine's project; each tab button's command; the three icons; and the refused case,
  where every button is disabled, says why, and runs nothing.
- `test/commands/Z88SnapshotCommand.test.ts` gained the tokenizer round-trip test.
- No new styles: the buttons are the shared `TabButton`s, so `.ai/ui-theming-intent-and-lessons.md`
  has nothing new to record.

### Phase 7 — docs and verification — ✅ **COMPLETE**
- Z88 page in `docs/content/`: what loads, the card mapping, hybrid rejection, Restart discarding
  snapshot cards, and the RTC catch-up.
- Verify in the running IDE (CDP, per `.ai/ui-theming-intent-and-lessons.md`):
  - open the sample and check the viewer;
  - Debug → the execution point is at `F523`;
  - step a few instructions;
  - Run → the OZ screen appears.
- `npm run build:check`, `npm run lint:renderer`, `npx electron-vite build --config build/electron.vite.config.ts`,
  `npm run doc:build && npm run doc:check`.

---

**What was done**
- Docs:
  - `docs/content/howto/z88-snapshots.mdx` ("Using Z88 Snapshots"), added to the howto `_meta.ts`.
  - A `z88-snapshot` entry in `commands-reference.mdx`.
  - A link from the Z88 section of `machine-types.mdx`.
  - `/howto/z88-snapshots/index.html` added to `.plans/docs-routes.golden.txt`.
  - `doc:build` and `doc:check` pass. The route check also notes `/contribute/wasm-toolchain/`,
    which predates this work and was left for its owner to baseline.
- The in-app check, by a Playwright script on the `scripts/doc-shots` harness (isolated settings
  and HOME; the script is scratch, not committed):
  - the viewer renders every section, including the LCD picture;
  - "Disassembly at PC" opens at `$F523`;
  - the tab buttons work from a ZX Spectrum 48K: the machine becomes a Z88 with the snapshot's
    cards; Debug stops at `F523` with the LCD drawn; Run runs (the Jet Set Willy title screen);
  - both emulator menu items work (the file dialog was stubbed; the menu needs polling, as the
    harness guide warns);
  - the EMU status bar and the pause overlay agree on the PC.

**Three bugs the in-app check found, fixed with mutation-checked tests**
1. **A debug stop showed a blank LCD.** The core draws the LCD every 8th frame, and a stop at PC
   runs none.
   - Fix: a new core export, `z88DrawLcd()`, called at the end of `loadSnapshotState`.
   - Test: "shows the snapshot's LCD before the first frame".
2. **The EMU status bar kept a stale PC after a paused load.** It re-rendered only on (some) frames.
   - Fix: `EmuStatusBar` also re-renders on a machine state change, which helps any pause too.
   - Test: in `test/controls/EmuStatusBar.test.tsx`.
3. **"Cannot resume a closed AudioContext" when a snapshot ran straight after a machine rebuild.**
   `initAudio` closed the old context while `beeperRenderer.current` still pointed at it, and the
   machine was already running. A manual machine switch never starts inside that window.
   - Fix: `useEmulatorAudio` drops the renderer before closing its context, and `AudioRenderer`
     ignores `play`/`suspend` on a closed context. The next full frame's `play()` starts the new
     renderer.
   - Test: `test/controls/EmulatorAudioContextSwap.test.tsx` (each fix mutation-checked).

**Found, not ours, fixed afterwards**
- "Duplicated document" page errors on the first Explorer double-click of a binary file (a `.nex`
  file did the same).
  - Cause: a double-click is click, click, dblclick. Each one saw the file "not open" while the
    first open was still reading it, so each opened its own document object.
  - Fix: `ExplorerPanel` keeps the opens in flight by path. A click or double-click on a file
    already being opened waits for that open, and the open is registered before the handler's first
    await.
  - Test: `test/controls/ExplorerPanelDoubleClick.test.tsx`, which fails on the old code (the file
    is read twice). Rechecked in the running app: no errors for `.z88` or `.nex`.

**Final checks**
- The full test suite (`--project='!perf'`): 872 files, 22,111 tests passed, 118 skipped (the
  existing skips).
- `npm run build:check`: no new type errors (115 known).
- `npm run lint:renderer`: 44 warnings, the same count as before. The two in `EmuStatusBar.tsx` are
  its existing `useEffect` dependency warnings, moved down by the new lines.
- The `electron-vite` build and `npm run doc:build && npm run doc:check` pass.

## 6. Risks

- ~~Screen caches in `z88-screen.c`~~ — resolved in Phase 2: `z88DrawScreen` derives every font and
  map address from PB0–PB3 and SBR at each draw, so a direct set needs nothing else.
- **Intel SA (type 14)** is mapped to the S5 Klive emulates (D8). If its write/erase commands turn
  out to differ, only write/erase on such a card is affected; reading is unaffected.
- **Breakpoint at PC in a banked machine.** A plain `address` breakpoint fires whatever is paged
  in. It is one-shot and consumed at once, so this is harmless.
- **Machine rebuild while a project is open** is blocked by the guard (§4.6). The remaining risk is
  a Z88 project whose RAM size changes because of a snapshot. That change is visible, but unsaved.

## 7. Resolved questions

| Question | Answer |
| --- | --- |
| `fflate` as a new dependency | Yes (D6) |
| Commit the issue's sample as a fixture | Yes, Gunther agreed (D7) |
| Type 9 vs 10; type 14 Intel SA | Follow the spec; 14 maps to Intel. Gunther agreed (D8) |
| A plain "Load" in the emulator menu | Yes (D9) |
