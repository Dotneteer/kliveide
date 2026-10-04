# ZX Spectrum Snapshot Loading (`.sna`, `.z80`, `.szx`) Plan

Status: **decisions recorded** (2026-10-04): D1–D8 accepted, and the §8 questions answered as
proposed (D9–D15). No phase started.
Scope: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) G2.1 (`.sna`), G2.2 (`.z80` v1–v3) and
G2.3 (`.szx`). Each format gets a shared parser. The snapshot can be loaded into the 48K, 128K or
+2E/+3E machine and started with or without debugging. Each format also gets a document viewer with
Run / Debug actions. The same viewer delivers most of **G2.5** as a side effect (D6).
UX and architecture reference: the finished [Z88_SNAPSHOT_PLAN.md](Z88_SNAPSHOT_PLAN.md) and
[Z88_SLOT_BROWSER_PLAN.md](Z88_SLOT_BROWSER_PLAN.md). This plan copies their layering (common
parser, mapping, machine `loadSnapshotState`, `restoreState` orchestration through ports, IDE
command, emulator menu, viewer, tab bar and Explorer menu) and inherits the bugs they already fixed.

Format references (normative; the parsers are written from these, in Klive's own words):
- `.sna`: World of Spectrum format reference — <https://worldofspectrum.org/faq/reference/formats.htm>
- `.z80`: <https://worldofspectrum.org/faq/reference/z80format.htm>
- `.szx`: Spectaculator's ZX-State spec — <https://www.spectaculator.com/docs/svn/zx-state/intro.shtml>

> Field layouts, machine-id numbers and chunk ids quoted in this plan were written from memory
> while drafting. **Phase 1 and Phase 2 check every one of them against the spec before code is
> written**, and correct this document where they differ.

---

## 1. What is being added, and why

Games and demos are commonly distributed as snapshots, and sharing a machine state is everyday
practice for 48K/128K users. Klive only *views* `.z80` files today. `.sna` has a "not implemented"
stub and `.szx` is unknown. The competitive analysis (§2 row "Load .sna / .z80 / .szx snapshots",
§4 W5) lists this as table stakes that Fuse, ZEsarUX and Spectrum Analyser all have.

Z88 snapshots already have the full flow (`z88-snapshot` command, emulator menu, viewer with
Run/Debug). The Spectrum work is the same flow with three parsers feeding one normalised model,
plus core work, because the three Spectrum cores lack a few setters the Z88 core gained in its
Phase 2.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One normalised model** (`SpectrumSnapshot`) for all three formats. Everything downstream (mapping, machine load, orchestration, viewer core sections) depends on the model, never on the file format. Format-specific header detail is kept only for the viewer's "File" section. |
| D2 | **Machine mapping is by snapshot machine, not by the current machine.** A 48K snapshot runs on `sp48`, 128K/+2 on `sp128`, +2A/+3/+3e on `spp3e`. Pentagon, Scorpion, SamRam, Timex, Didaktik, Spectrum SE and anything else Klive lacks are **refused** with a clear message. The viewer still shows them, marked unloadable (the same rule as Z88 hybrids, Z88 D1). |
| D3 | **Near-misses load with a warning, not a refusal.** A grey +2 runs on Klive's 128K (its ROM differs only cosmetically). An Amstrad +2A/+3 snapshot runs on the +2E/+3E with Klive's +E ROMs (the original ROMs are G9.2). Interface 1, MGT, Multiface and a 48K AY are ignored. Every one of these produces a warning line in the output and in the viewer. |
| D4 | **Modes are `run` and `debug`**, as Z88 ended up after reversing its D9: no "load paused" mode. `debug` stops at the snapshot's PC before executing it. The command with no option debugs. |
| D5 | **No new dependency.** `.szx` RAM pages use zlib, and `fflate` (already added by Z88 D6) has `unzlibSync`. |
| D6 | **One viewer for all three formats**, replacing `SnaFileViewerPanel` (stub) and `Z80FileViewerPanel` (complete but standalone). The `.z80` parser moves out of the panel into `src/common`, and its v1 bug (§3, trap 9) is fixed. This delivers G2.5 for `.sna`/`.z80`/`.szx`, and the roadmap is updated accordingly. |
| D7 | **The command refuses a snapshot whose machine differs from an open Klive project's machine**, naming both. With no project open, the machine is switched freely (same spirit as `z88SnapshotProjectGuard`). Within the same machine id, the project's model wins and a model difference is a warning (e.g. a +3 snapshot in a +2E project). |
| D8 | **Test fixtures are synthetic.** Builders written from the specs produce `.sna`/`.z80`/`.szx` bytes in-test. No commercial snapshot is committed. Real-world files are used only for the manual in-app check (Phase 9). Homebrew files may be added only with their authors' explicit permission (D12). |
| D9 | (Q1) A machine-independent **File → Load Snapshot...** exists beside the Spectrum machine menus' item (§4.7). |
| D10 | (Q2) **Drag and drop is in this plan** as Phase 8, scoped as in §4.10. |
| D11 | (Q3) A file without a frame position (`.sna`, `.z80` v1/v2) starts at **frame tact 0**, just after the interrupt. |
| D12 | (Q4) Freely distributable homebrew snapshots may be committed as fixtures **only with their authors' explicit permission** (as Z88 D7). |
| D13 | (Q5) A 48K snapshot in an open 128K/+3E project is **refused** by the D7 guard; no 48K-mode lock. |
| D14 | (Q6) The menus offer **Run only**; Debug lives in the viewer, the Explorer menu and the command. |
| D15 | (Q7) An installed **Fuse may be run as a behavioural oracle** for the Phase 3 timing checks only: the same synthetic snapshots are loaded, only observed results are recorded, no Fuse code is copied or read for design, and it never runs in CI. |

### 1.2 Out of scope

- **Saving** snapshots (G2.4). The model is shaped so a writer can be added later.
- RZX (G2.7/G2.8), Klive state files (G2.6).
- Loading Spectrum snapshots into the **ZX Spectrum Next**. NextZXOS loads `.sna`/`.z80` itself;
  emulating that through the IDE is a separate feature.
- Restoring the µPD765 controller's mid-command state (§3, trap 7).
- TR-DOS / Beta 128, Interface 1 microdrives, Multiface, ZX Printer.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Machine ids and models | `src/common/machines/constants.ts:2-4` (`MI_SPECTRUM_48="sp48"`, `MI_SPECTRUM_128="sp128"`, `MI_SPECTRUM_3E="spp3e"`), `MC_DISK_SUPPORT` :18; `machine-registry.ts` — sp48 models `pal` / `ntsc` / `pal-16k` (206–232); sp128 has **no models** (251); spp3e models `nofdd` (+2E), `fdd1`, `fdd2` (274–304) |
| C cores | `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c` (+ `sp48-memory.c`), `zxSpectrum128/wasm/sp128/sp128.c`, `zxSpectrumP3e/wasm/spp3e/spp3e.c`; shared `zxSpectrum/wasm/common/*.c` (ULA, PSG, beeper, ports) and `src/emu/z80/wasm/z80.c` |
| Export lists | `scripts/build-sp48-wasm.cjs`, `build-sp128-wasm.cjs`, `build-spp3e-wasm.cjs`, and the TS loader types `wasm/*WasmV2Loader.ts`. **A new export goes in all of them.** |
| Machine wrappers | `ZxSpectrum48WasmV2Machine.ts:56`, `ZxSpectrum128WasmV2Machine.ts:48`, `ZxSpectrumP3eWasmV2Machine.ts:71`, over `ZxSpectrumBase.ts:54` |
| Memory | 48K: flat `sp48MemoryPtr` / `WriteMemory`. 128K/+3: `WriteRamBank(bank, offset, v)` (`sp128.c:1276`, `spp3e.c:1890`), `getMemoryPartition(bank)` (`ZxSpectrum128WasmV2Machine.ts:415`) |
| Paging | `$7FFD` only through `WritePort` (`sp128.c:1333-1360`; lock bit 5 sets `sp128PagingEnabled=0`, cleared only by Reset). +3 `$7FFD`/`$1FFD` at `spp3e.c:1965-2030` |
| AY | `SetPsgRegisterIndex` / `WritePsgRegisterValue` exports; TS `writePsgIndex` / `writePsgValue` (`ZxSpectrum128WasmV2Machine.ts:798-804`) |
| State restore seam | `IMachineController.restoreState(applyState, description)` (`IMachineController.ts:185`), implemented at `MachineController.ts:616` |
| Machine switch | `MachineService.setMachineType(machineId, modelId?, config?)` (`src/renderer/appEmu/MachineService.ts:48`) |
| Z88 reference flow | `src/common/z88/z88SnapshotLoadTypes.ts`, `src/renderer/appEmu/machines/z88SnapshotLoad.ts` (ports, `fitMachineConfig`), `EmuApi.loadZ88Snapshot` (`EmuApi.ts:86`) → `MainToEmuProcessor.ts:220`, `appIde/commands/Z88SnapshotCommand.ts`, `main/machine-menus/z88-menus.ts:109-160`, `features/documents/Z88SnapshotLaunchMenu.tsx`, `DocumentPanels/Z88/*` |
| Existing `.z80` code | `DocumentPanels/Next/Z80FileViewerPanel.tsx` (private `loadZ80FileContents` at :620, HW-mode tables :41-102); `appIde/utils/compression/z80-file-compression.ts` (`decompressZ80DataBlock`) and its test `test/dataCompression/z80-data-compresion.test.ts` |
| `.sna` stub | `DocumentPanels/Next/SnaFileViewerPanel.tsx`, listed in `Next/notImplemented.ts` |
| Registry | `src/common/state/common-ids.ts:18-20` (`Z80_VIEWER`, `SNA_VIEWER`); `src/renderer/registry.ts` editors ~452–470, file types `.z80` ~776 (keep the PASTA/80 comment's intent), `.sna` ~797 |
| Screen picture | `createScrPixelData` (`DocumentPanels/Next/ScrFileViewerPanel.tsx`) + `ScreenCanvas` (`controls/Next/ScreenCanvas`), already reused by `Tape/TapeBlockBrowser.tsx` |
| Bank browser shell | `src/renderer/controls/bankBrowser/BankBrowser.tsx` (used by NEX, tape and Z88 slot browsers) |
| Spectrum menus | `src/main/machine-menus/zx-specrum-menus.ts` (sic), composed in `machine-menu-registry.ts` for sp48 / sp128 / spp3e |
| Media | `setMediaAction(MEDIA_TAPE/…)`, `EmuApi.setDiskFile(index, file, contents)` (`EmuApi.ts:101`), `attachStoredMedia` (called by `restoreState`) |
| Tests | 48K harness `test/harness/sp48/` (no 128K/+3 harness); e2e tiers in `build/e2e-tests.ts` |

---

## 3. The traps

1. **`run()` resets from Stopped.** As with Z88, the loader goes through `controller.restoreState`,
   which stops, applies and leaves the machine **Paused**.
2. **The wrappers do not push IFF1/IFF2/IM to the cores.** `Z80Cpu`'s `iff1`, `iff2` and
   `interruptMode` setters only change the TypeScript mirror on the three Spectrum machines. (Next
   and Z88 push them; `ZxNextWasmV2Machine.ts:455-485`.) `loadSnapshotState` must call the WASM
   exports directly, as `Z88WasmV2Machine.loadSnapshotState` does, then re-sync the mirror.
3. **The 48K core has no IFF2 export**, and its wrapper fakes `iff2 = iff1` on read
   (`ZxSpectrum48WasmV2Machine.ts:984`). The 128K wrapper never reads IFF1/IFF2/IM back at all
   (~:1013), so the CPU panel would show stale values after a load. Both are fixed in Phase 3.
4. **No core can set HALT.** There is no `z80SetHalted`, and `z80SetEiBacklog` exists but is not
   exported. `.szx` carries both (`ZXSTZF_HALTED`, `ZXSTZF_EILAST`). Klive's HALT keeps PC *on* the
   `HALT` opcode (`op76Halt` decrements PC, `removeFromHaltedState` increments it), the same
   convention `.szx` writers use. That convention must be verified against the spec, and a halted
   snapshot whose `[PC]` is not `$76` gets a warning.
5. **The paging lock.** Once `$7FFD` bit 5 is written, later `$7FFD` writes are ignored until a
   reset. `loadSnapshotState` therefore resets first and writes `$1FFD` and then `$7FFD`
   **last** among the paging writes. The +3 core does not block `$1FFD` under the lock, unlike the
   hardware (`spp3e.c:2020`). This plan does not fix that, but it records it.
6. **The frame position.** `.z80` v3 and `.szx` carry the T-state position within the frame. The
   cores have `SetTacts` but no "frame tact" setter. The frame position is derived from
   `tacts - nextFrameStartTact` (`zx-spectrum-ula.c:81`). `sp48SetTacts` (`sp48.c:647`) also does
   not call `z80SetTacts`, unlike the 128K one. A dedicated export is needed (§4.4).
7. **The µPD765 cannot be restored mid-command.** Only reset/select/result-phase setters exist.
   The loader resets the controller and restores what `.szx` can express without it: drive count,
   motor (via `$1FFD` bit 3), and the inserted disks. Snapshots taken mid-disk-operation may fail to
   resume. This is documented, not fixed.
8. **A debug stop shows no picture.** This is Z88 Phase 7 bug 1 again: a stop at PC runs no frame,
   so the screen shows whatever was there before. `loadSnapshotState` must render the whole screen
   from the loaded RAM (§4.4 `RenderScreenNow`).
9. **The existing `.z80` parser returns raw v1 data.** `loadZ80FileContents` returns at :732 for
   v1 without decompressing, even when byte 12 bit 5 says compressed. The v1 end marker
   `00 ED ED 00` also needs `decompressZ80DataBlock(data, true)`. Byte 12 = `$FF` must be read as 1
   (spec).
10. **The 48K `.sna` stores PC on the stack.** The loader pops it (`PC = [SP]`, `SP += 2`) and
    sets `IFF1 = IFF2` (the RETN that a `.sna` implies). The two stack bytes are left as stored.
    That is what real loaders do, and it is the source of a well-known `.sna` corruption that some
    programs show; it is documented, not "fixed".
11. **The 128K `.sna` stores banks in a peculiar order.** It holds banks 5, 2 and the paged bank,
    then PC, `$7FFD` and the TR-DOS byte, then the remaining banks in ascending order. When the
    paged bank is 2 or 5 it is stored twice, which gives the 147,487-byte variant. The parser
    uses the first copy and ignores the duplicate.
12. **`restoreState` re-attaches stored media.** It calls `attachStoredMedia` after `applyState`.
    Disks and tapes a `.szx` embeds must therefore go through the media store (`setMediaAction` /
    `EmuApi.setDiskFile`) **before** the restore, or they would be replaced by the previously stored
    media.
13. **Writing the border through port `$FE` also writes EAR/MIC.** Use `border & 7` for
    `.sna`/`.z80`. Use the full last-`$FE` value only when `.szx` provides it (SPCR `chFe`).
14. **Writing AY register 13 restarts the envelope.** Restore R0–R15 in order (R13 last among the
    envelope registers is fine), then select the snapshot's current register.
15. **`.z80` from PASTA/80.** The `.z80` file-type entry exists alongside a PASTA/80 temp file of
    the same extension (see the comment at `registry.ts` ~763). The new Run/Debug actions must
    parse before acting and report "not a snapshot", not throw.
16. **The custom 48K ROM.** `sp48RomMenuRenderer` lets the user replace the ROM. A snapshot runs on
    whatever ROM is configured. This is a documented fact, not a check.

---

## 4. Design

### 4.1 The model — `src/common/spectrum/snapshot/spectrumSnapshot.ts` (pure, no Node/DOM)

```ts
type SpectrumSnapshotFormat = "sna" | "z80" | "szx";

/** The machine the snapshot was taken on, as the file says it */
type SnapshotMachine =
  | "16k" | "48k" | "48k-ntsc" | "128k" | "plus2" | "plus2a" | "plus3" | "plus3e"
  | { unsupported: string };            // "Pentagon 128", "SamRam", "TC2068", ...

type SpectrumSnapshot = {
  format: SpectrumSnapshotFormat;
  formatVersion: string;                // "48K", "128K", "v1", "v2", "v3", "1.4", ...
  machine: SnapshotMachine;
  cpu: {
    af, bc, de, hl, af_, bc_, de_, hl_, ix, iy, sp, pc, i, r,   // r includes bit 7
    im: 0 | 1 | 2; iff1: boolean; iff2: boolean;
    halted?: boolean; eiLast?: boolean; memptr?: number;
  };
  ula: { border: number; lastFe?: number; frameTact?: number; alternateTimings?: boolean };
  paging?: { port7ffd: number; port1ffd?: number };
  ram: Map<number, Uint8Array>;         // 16K banks in 128K numbering: a 48K snapshot is 5, 2, 0
  ay?: { selected: number; regs: Uint8Array /* 16 */; on48k?: boolean };
  peripherals: {                        // what Klive can use or must warn about
    issue2?: boolean; joystick?: string; interface1?: boolean; mgt?: boolean; trdosPaged?: boolean;
    plus3?: { drives: number; motorOn: boolean; disks: SnapshotDisk[] };
    tape?: { embedded?: Uint8Array; fileName?: string; format?: "tap" | "tzx"; block?: number };
  };
  header: SnapshotHeaderItem[];         // format-specific fields for the viewer's "File" section
  chunks?: { id: string; size: number; known: boolean }[];   // .szx only
  warnings: string[];
};
```

- `ram` uses **128K bank numbering for every machine**, because `.z80` (pages 4/5/8 → banks 2/0/5)
  and `.szx` (RAMP pages 5/2/0) already think that way. A 48K machine maps bank 5 → `$4000`,
  2 → `$8000`, 0 → `$C000`.
- Parse errors are thrown: unknown format, short file, bad length, a missing required bank, an
  undecodable block. Unsupported machines are **not** parse errors (D2).

### 4.2 The three parsers

- **`detectSnapshotFormat(name, bytes)`**: `.szx` and a `ZXST` magic → `szx`. `.sna` with
  49,179 / 131,103 / 147,487 bytes → `sna`. Otherwise `.z80`. Extension and content must agree, or
  the error says which check failed.
- **`snaFile.ts` — `parseSnaFile(bytes)`**
  - 27-byte header plus 48K → `48k`, PC popped (trap 10).
  - The 128K layout (trap 11) → `128k`, with `paging.port7ffd`. A set TR-DOS byte gives a warning.
  - `.sna` carries no frame position; `frameTact` is left undefined and the loader uses 0 (D11).
- **`z80File.ts` — `parseZ80File(bytes)`**
  - Moved out of `Z80FileViewerPanel` and rewritten against the spec.
  - Covers v1, v2 and v3, and v3 with the 55-byte extra header (`$1FFD`).
  - Compressed and uncompressed blocks, and the v1 end marker (trap 9).
  - Hardware-mode tables per version, including the "modified hardware" bit (16K, +2).
  - Reads the AY registers and the last `$FFFD`, the v3 T-state counter → `frameTact`, issue-2 and
    joystick bits, and the IF1/MGT paging flags.
  - `decompressZ80DataBlock` moves to `src/common/spectrum/snapshot/z80Compression.ts`, its test
    follows it, and the renderer file is deleted (AGENTS: no re-export wrappers).
- **`szxFile.ts` — `parseSzxFile(bytes)`**
  - Reads the 8-byte header (magic, major/minor version, machine id, flags), then walks
    `{ id[4], size: u32 }` chunks.
  - Known chunks:
    - `CRTR` (creator, for the viewer);
    - `Z80R` (registers, frame cycles, `chHoldIntReqCycles`, flags EILAST/HALTED, MEMPTR when the
      minor version has it);
    - `SPCR` (border, `$7FFD`, `$1FFD`, last `$FE`);
    - `RAMP` (page, compressed flag, zlib through `fflate.unzlibSync`);
    - `AY` (flags incl. 128-AY-on-48K, current register, R0–R15);
    - `KEYB` (issue 2, joystick emulation);
    - `JOY`;
    - `+3` (drive count, motor);
    - `DSK` (drive, embedded image which may be zlib, or a file name);
    - `TAPE` (embedded image or file name, current block).
  - Unknown or unsupported chunks (`IF1`, `MFCE`, `ZXPR`, `MCART`, …) are listed in `chunks` and
    give warnings. They are never errors.
  - A truncated chunk is an error. A missing `RAMP` page the machine needs is an error. A missing
    `Z80R` is an error.

### 4.3 Mapping — `spectrumSnapshotMapping.ts` — `mapSpectrumSnapshotToKlive(snapshot)`

Returns `{ machineId, modelId, configPatch, errors, warnings }`.

| Snapshot machine | Klive machine / model | Notes |
| --- | --- | --- |
| 16K | `sp48` / `pal-16k` | |
| 48K | `sp48` / `pal` (keeps `ntsc` if the current 48K is NTSC and the file does not say) | |
| 48K NTSC (`.szx`) | `sp48` / `ntsc` | |
| 128K | `sp128` | |
| +2 (grey) | `sp128` | warning (D3) |
| +2A | `spp3e` / `nofdd` | warning: +E ROMs |
| +3 | `spp3e` / `fdd1` (or `fdd2` when `.szx` says two drives) | warning: +E ROMs |
| +3e | `spp3e` / `fdd1` | |
| others | — | **error** (D2) |

- Warnings also cover: AY on a 48K, IF1/MGT/TR-DOS, issue-2 keyboard, alternate (late) ULA
  timings, and a joystick type Klive does not emulate. Kempston is not emulated on these machines.
- One pure function serves the viewer (the "Loadability" row), the command (the project guard,
  D7) and the emulator flow.

### 4.4 Cores and machines — loading the state

**C cores.** These exports are added to all three cores (`sp48*`, `sp128*`, `spp3e*`) and to their
export lists and loader types:

| Export | Why |
| --- | --- |
| `SetCpuHalted(v)` (needs `z80SetHalted` in `z80.c`) | trap 4 |
| `SetCpuEiBacklog(v)` (wraps the existing `z80SetEiBacklog`) | `.szx` EILAST, so no interrupt is taken right after an `EI` |
| `sp48SetCpuIff2`, `sp48GetCpuIff2` | trap 3 |
| `SetFrameTact(tact)` | trap 6; sets the core's tacts to `nextFrameStartTact + tact` and keeps `z80` tacts in step |
| `RenderScreenNow()` | trap 8; renders the full frame from current memory and paging (shadow screen included) |
| `SetCpuMemptr` | only if `SetCpuWz` turns out not to be the same register (check first) |

**`loadSnapshotState(snapshot, mapping)`** on each of the three WasmV2 machines. The sequence is
shared through `src/emu/machines/zxSpectrum/spectrumSnapshotRestore.ts`, over a small per-core
adapter. The adapter is needed because export names carry the core prefix.

1. Hard-reset the core state that matters here (paging unlocked, AY silent, keyboard released,
   halted cleared). Then zero RAM.
2. Copy each RAM bank. For 48K, banks 5/2/0 go to `$4000`/`$8000`/`$C000`.
3. Paging: `$1FFD` (+3 only), then `$7FFD` (trap 5).
4. AY (128K/+3): R0–R15, then the selected register (trap 14).
5. ULA: border (trap 13), then `SetFrameTact` (0 when the file has none, D11).
6. CPU, through the exports, never the TS setters (trap 2):
   - all register pairs, `IR` with R bit 7, IM, IFF1/IFF2, SP, PC;
   - then HALT and the EI backlog.
7. `RenderScreenNow()`, then sync the TypeScript mirror. The 128K/+3 sync is fixed to read
   IFF1/IFF2/IM (trap 3).

The machines throw if the mapping has errors, or if the snapshot needs another machine. Phase 4
switches machines before that can happen.

**Test harness.** Phase 3 adds `loadSnapshot(bytes)` and `cpuState()` to the 48K session, and
creates a minimal `test/harness/sp128/` session covering both the 128K and +3E cores. The session
boots, loads, runs frames, peeks memory and banks, reads the screen, and reads the AY. Its README
follows the sp48 one. The new test files are registered in the `e2e-cores` tier
(`build/e2e-tests.ts`).

### 4.5 Orchestration — `emuApi.loadSpectrumSnapshot(fileName, contents, mode)`

- `src/common/spectrum/snapshot/spectrumSnapshotLoadTypes.ts`:
  - `SpectrumSnapshotLoadMode = "run" | "debug"`;
  - `SpectrumSnapshotLoadResult = { pc, machineId, modelId, rebuilt, format, warnings }`;
  - `spectrumSnapshotCommandText(path, option)`, shared by the menu, the tab bar and the Explorer.
- `src/renderer/appEmu/machines/spectrumSnapshotLoad.ts`: `loadSpectrumSnapshot(ports, name, bytes,
  mode)`, with the same `ports` shape as `Z88SnapshotLoadPorts`. Its steps:
  1. detect, parse and map; throw on errors;
  2. **fit the machine**: if the machine id or model differs, `setMachineType(machineId, modelId,
     config)` (throw if superseded); otherwise keep the machine;
  3. embedded media from `.szx` (tape, disks) goes through the media store first (trap 12). A disk
     referenced by file name is attached when the file exists, otherwise it gives a warning;
  4. `controller.restoreState(() => machine.loadSnapshotState(...), "<format> snapshot loaded")`;
  5. `run` → `controller.start()`. `debug` → a one-shot exec breakpoint at PC
     (`owner: { kind: "session" }`), then `startDebug()`, exactly as `loadZ88Snapshot` does.
- `EmuApi.loadSpectrumSnapshot` gets a stub and a proxy entry; the handler goes in
  `EmuMessageProcessor` next to `loadZ88Snapshot`.

### 4.6 IDE command — `zx-snapshot <file> [-r | -d]` (alias `zxsnap`)

`src/renderer/appIde/commands/SpectrumSnapshotCommand.ts`, modelled on `Z88SnapshotCommand`:

- Validation:
  - the extension is one of `.sna`/`.z80`/`.szx` (case-insensitive);
  - at most one option;
  - the project guard (D7). The project guard needs the snapshot's machine, so it runs in
    `execute` after `readBinaryFile` plus parse and map.
- With no option, or `-d`, it debugs. `-r` runs.
- The output reports:
  - "machine switched to <name>" when the machine was rebuilt;
  - every warning, in yellow;
  - a final line: `<format> snapshot <file> running | stopped at PC $XXXX.`
- Errors lose their `Error: ` prefixes, as in the Z88 command.
- `spectrumSnapshotProjectGuard(state, snapshotMachineId?)` is exported for the tab bar. Without a
  machine id, it refuses only projects whose machine is not a ZX Spectrum (sp48 / sp128 / spp3e).

### 4.7 Emulator menu

- `spectrumSnapshotRenderer` in `zx-specrum-menus.ts`, added to the sp48, sp128 and spp3e entries
  in `machine-menu-registry.ts`, next to the tape items.
- **Load Snapshot...** opens a dialog filtered to `sna`, `z80`, `szx` and All Files. It remembers
  its folder under `spectrumSnapshotFolder` and calls `saveAppSettings()`.
- It runs `getIdeApi().executeCommand(spectrumSnapshotCommandText(path, "run"))` and shows a failed
  result in an error box, copying `openZ88Snapshot`.
- **File → Load Snapshot...** (D9): the same dialog and command, added to the File menu in
  `src/main/app-menu.ts` (~:343), so a snapshot can be opened while a Next, Z88 or ZX81 is selected.
  The machine menu only exists while a Spectrum is selected. Both items share one helper,
  `openSpectrumSnapshot(browserWindow)`, which lives in `zx-specrum-menus.ts`.
- Both items run; neither debugs (D14).

### 4.8 The viewer (D6)

- New editor id `SPECTRUM_SNAPSHOT_VIEWER`. File types `.sna`, `.z80` and `.szx`, each with
  `ignoreCase`, binary, read-only and permanent, plus `documentTabRenderer` and `contextMenuInfo`.
- `SNA_VIEWER` and `Z80_VIEWER` are removed, together with `SnaFileViewerPanel.tsx`,
  `Z80FileViewerPanel.tsx` and the `.SNA` line of `notImplemented.ts`. The PASTA/80 comment is
  kept in spirit: a non-snapshot `.z80` shows "not a snapshot", not an exception.
- The panel lives at `src/renderer/appIde/DocumentPanels/Spectrum/SpectrumSnapshotViewerPanel.tsx`,
  on `GenericFilePanel`, with `fileLoader = parse + map` (synchronous; `unzlibSync` is synchronous).
  A file that parses but cannot load still opens, with its errors shown.
- React-free logic goes in `spectrumSnapshotView.ts`. Its sections are `ExpandableRow`s, with
  expansion kept in the view state:
  1. **Snapshot**:
     - format and version, and the machine with what it loads as;
     - Loadable, with errors (`Text variant="error"`) and warnings;
     - **the screen picture**: bank 5, or bank 7 when `$7FFD` bit 3 is set, through
       `createScrPixelData` and `ScreenCanvas`.
  2. **Z80 Registers**: the main and alternate sets, IX/IY/PC/SP/I/R/IM/IFF1/IFF2, HALT, MEMPTR.
  3. **ULA & Paging**:
     - border and frame T-state;
     - `$7FFD` decoded (bank, ROM, shadow screen, locked) and `$1FFD` decoded (special paging,
       motor, printer strobe);
     - the bank behind each 16K range.
  4. **Address Space at PC**: the 64K as paged, built by a pure
     `buildSpectrumAddressSpace(snapshot)`. Two icon buttons open it as a memory dump or a
     disassembly with `topAddress = PC`, copying the Z88 "at PC" buttons.
  5. **AY-3-8912** (when present): R0–R15 decoded (tone periods, noise, mixer, volumes, envelope)
     and the selected register.
  6. **RAM Banks**: a `BankBrowser` with one row per bank and pop-out dumps. Disassembly is based on
     where the bank is paged, else `$C000`. Pop-out ids and titles follow `z88BankDocument.ts`.
  7. **File**:
     - format-specific header fields (`.z80` hardware mode, compression, version-specific bytes);
     - for `.szx`, the chunk list with sizes, known or unknown, and the creator;
     - peripherals and media (`.szx` disks and tape).
- No new colours. If a stylesheet becomes necessary, `.ai/ui-theming-intent-and-lessons.md` is
  updated in the same change (house rule).

### 4.9 Tab bar and Explorer context menu

`src/renderer/features/documents/SpectrumSnapshotLaunchMenu.tsx`, copied from
`Z88SnapshotLaunchMenu.tsx`:

- The Explorer gets "Run snapshot" and "Debug snapshot (stop at PC)".
- The tab bar gets `play` and `debug` `TabButton`s.
- Both are disabled, with the reason as a tooltip, when `spectrumSnapshotProjectGuard(state)`
  refuses without a machine id. The command makes the precise check (D7).

### 4.10 Drag and drop (G2.1; D10)

Klive has no file drop anywhere today: no `dataTransfer.files`, no `webUtils.getPathForFile`.
G2.1 asks for it, so Phase 8 adds it to the emulator window:

- the preload exposes `webUtils.getPathForFile`;
- the emulator's root handles `dragover` and `drop`;
- `.sna`/`.z80`/`.szx` run `zx-snapshot ... -r` through the IDE command;
- `.z88` runs `z88-snapshot -a`, and `.tap`/`.tzx` set the tape;
- anything else is ignored with a status message.

It is generic infrastructure, but it is kept in this plan (D10), with the routing function written so
other media types can be added later.

---

## 5. Phases

### Phase 1 — model, `.sna` and `.z80` parsers, mapping (nothing user-visible)
- `src/common/spectrum/snapshot/{spectrumSnapshot,snaFile,z80File,z80Compression,detectSnapshotFormat,spectrumSnapshotMapping}.ts`.
- Verify every layout and table quoted here against the spec (header note). Correct this plan if
  needed.
- Test builders in `test/spectrum/snapshot/builders.ts`, written from the specs (D8): `buildSna48`,
  `buildSna128`, `buildZ80(v1|v2|v3, {compressed})`.
- Tests in `test/spectrum/snapshot/`:
  - **`.sna`**:
    - each size, PC popped, IFF from byte 19;
    - all 128K bank orders, including the duplicate-bank variant;
    - TR-DOS warning.
  - **`.z80`**:
    - v1 compressed with the end marker, and v1 uncompressed;
    - byte 12 = `$FF`;
    - every hardware mode of v2 and v3, including the modified bit;
    - the 55-byte header, AY, T-states;
    - a non-snapshot `.z80` (the PASTA/80 case).
  - **Mapping**: row by row, refusals, every warning.
  - **Cross-format**: one state written as `.sna` and `.z80` parses to equal models.
- Move `decompressZ80DataBlock` and its test. Point `Z80FileViewerPanel` at the common parser
  until Phase 6 replaces it.

### Phase 2 — `.szx` parser
- `szxFile.ts` with `unzlibSync`.
- `buildSzx` builder, with compressed and raw RAMP and an unknown chunk.
- Tests:
  - each known chunk;
  - every machine id;
  - minor-version differences (MEMPTR);
  - truncated, missing and unknown chunks;
  - embedded DSK and TAPE (raw and zlib);
  - three-format equality with Phase 1.

### Phase 3 — core exports and `loadSnapshotState`
- C exports (§4.4) in all three cores. Rebuild with the WASM build scripts. Update the export lists
  and loader types.
- The shared restorer and the three adapters. Fix the IFF/IM sync (trap 3).
- Harness:
  - `sp48` gains `loadSnapshot`;
  - a new `test/harness/sp128/` session (128K and +3E), with a README;
  - tests registered in the `e2e-cores` tier.
- Tests on the real cores:
  - **Restore**: every register (R bit 7, IFF2 ≠ IFF1, IM 2), every bank's bytes, `$7FFD` and the
    lock, `$1FFD` special paging, border, AY registers.
  - **Frame position**: the first interrupt arrives after `frameLength − frameTact` tacts.
  - **CPU state**:
    - a halted snapshot resumes on the next interrupt;
    - EILAST suppresses the interrupt for one instruction;
    - the screen is drawn before any frame runs (trap 8).
  - **Fuse oracle (D15, local only)**: the synthetic timing snapshots are loaded into an installed
    Fuse and the observed results (interrupt arrival, border/screen at a frame count) are recorded
    as expectations. A script under `scripts/` does this when Fuse is present and skips otherwise.
    It is never part of CI.
  - **A behavioural test**: a small program assembled with Klive's assembler (IM 2 handler and a
    screen-drawing loop) is captured into a snapshot by a test-only state reader, then loaded and run.
    After N frames its counter and screen match a straight run of the same program.
  - **Mutation checks** (as Z88 Phase 2 did): no reset, `$7FFD` before `$1FFD`, the TS setters used
    instead of the exports, no frame tact, and no screen render must each fail a test.

### Phase 4 — emu orchestration
- `EmuApi.loadSpectrumSnapshot`, `spectrumSnapshotLoad.ts` and the handler.
- Flow tests on a real `MachineController`, the real cores and fake ports (copying
  `z88-snapshot-flow.test.ts`):
  - machine fitting: 48K → 128K → +3E and back, 16K, NTSC kept, model change within spp3e;
  - `run` continues from the snapshot rather than from a reset;
  - `debug`: Paused at PC with zero instructions executed, the one-shot breakpoint consumed, and a
    step executing the first instruction;
  - a reload over a running machine really stops it;
  - an unloadable snapshot leaves the machine untouched;
  - `.szx` embedded media survives `attachStoredMedia` (trap 12).

### Phase 5 — IDE command and emulator menu
- `SpectrumSnapshotCommand`, registered in `IdeCommands.ts`.
- Command tests copying `Z88SnapshotCommand.test.ts`:
  - options, extensions in any case;
  - the guard: no project, the same machine, the same machine id with another model (warning),
    another Spectrum, a non-Spectrum project;
  - read errors and emulator refusals;
  - the output lines;
  - the tokenizer round trip of `spectrumSnapshotCommandText` (spaces, Windows backslashes).
- The `spectrumSnapshotRenderer` menu item on the three Spectrum machines, and **File → Load
  Snapshot...** (D9). Both are checked in the running app in Phase 9.

### Phase 6 — the viewer
- The panel, the view module, the registry entries and the editor id. Delete the two old panels
  and `SNA_VIEWER`/`Z80_VIEWER`, then scan alias and relative imports (AGENTS).
- Tests:
  - node tests for `spectrumSnapshotView.ts`: paging ranges, address space at PC, `$7FFD`/`$1FFD`
    decoding, AY decoding, bank disassembly bases;
  - jsdom tests per format: sections, screen picture (shadow screen), an unloadable Pentagon file
    still shown, an invalid file, both "at PC" buttons with `topAddress`, a bank pop-out.

### Phase 7 — tab bar and Explorer context menu
- `SpectrumSnapshotLaunchMenu.tsx`, wired into the three file types.
- jsdom tests copying `Z88SnapshotLaunchMenu.test.tsx`.

### Phase 8 — drag and drop onto the emulator (D10)
- Preload `webUtils.getPathForFile`, the emulator's drop handler, and routing by extension.
- Tests for the routing function. Check the drop itself in the running app.

### Phase 9 — docs, roadmap and verification
- `docs/content/howto/spectrum-snapshots.mdx`, added to the howto `_meta.ts`, covering:
  - what loads where (the §4.3 table);
  - the warnings and what they mean;
  - the `.sna` stack quirk (trap 10) and the disk-controller limitation (trap 7);
  - that Restart returns to the configured machine.
- A `zx-snapshot` entry in `commands-reference.mdx`, and the route added to
  `.plans/docs-routes.golden.txt`.
- **Standing rule**:
  - in `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`, update the §2 row ("Load .sna / .z80 / .szx
    snapshots" → ✅ load; saving still open) and the §4 W5 gap (narrow it to saving and RZX);
  - mark G2.1, G2.2, G2.3 and G2.5 done in `CLOSING_THE_GAPS_PLAN.md`.
- In-app check on the `scripts/doc-shots` harness (isolated HOME, read
  `.ai/doc-screenshots-guide.md` first):
  - each format's viewer;
  - Run and Debug from the tab bar, starting from a Z88 and from a ZX81, so the machine switches;
  - the emulator menu item;
  - the EMU status bar and the pause overlay agree on the PC;
  - audio after a machine switch (Z88 Phase 7 bug 3);
  - a real 128K game snapshot plays (a local file, not committed; D12);
  - File → Load Snapshot... while a Z88 is selected, and dropping each format on the emulator (D10).
- `npm test` with the e2e tiers, `npm run build:check`, `npm run lint:renderer`,
  `npx electron-vite build --config build/electron.vite.config.ts`, and
  `npm run doc:build && npm run doc:check`.

---

## 6. Effort

| Item | Phases | Estimate |
| --- | --- | --- |
| G2.1 `.sna` | 1, 3–7 (shared) | S |
| G2.2 `.z80` | 1 (parser mostly exists; fix v1) | S–M |
| G2.3 `.szx` | 2, plus the media part of 4 | M |
| Shared core work (exports, restorer, 128K harness) | 3 | M — the largest single phase |
| Viewer (G2.5) | 6–7 | S–M |
| Drag and drop | 8 | S |

## 7. Risks

- **Frame-position semantics differ between writers.** For `.z80` v3 T-states and `.szx`
  `dwCyclesStart`, cycles are counted from the start of the frame (the interrupt). Klive's frame
  starts at the interrupt too, but this must be checked. An off-by-frame error shows as interrupts
  arriving at the wrong time, which the Phase 3 timing test catches.
- **+E ROMs instead of Amstrad ROMs** (D3). A +3 snapshot that jumps into ROM at a version-specific
  address may crash. Warn; the real fix is G9.2.
- **Contention-sensitive code** (multicolour, border effects) relies on the frame position. Without
  it (`.sna`, `.z80` v1/v2) such code may glitch on the first frame only.
- **Keyboard issue 2** (`.z80`/`.szx`) is not emulated. A few old games read EAR-bit artefacts.
  Warn.

## 8. Questions answered (2026-10-04)

The project author accepted every proposed answer; they are recorded as D9–D15 in §1.1.

| # | Question | Answer |
| --- | --- | --- |
| Q1 | Besides the Spectrum machine menus, should a machine-independent **File → Load Snapshot...** exist (reachable while a Next, Z88 or ZX81 is selected)? | Yes. It is cheap and matches G2.1's "from the file menu". |
| Q2 | Drag and drop (G2.1): in this plan as Phase 8, or a separate small plan covering every droppable media type? | Phase 8 here, scoped as in §4.10. |
| Q3 | The default frame position when the file has none (`.sna`, `.z80` v1/v2). | Start of the frame (tact 0, just after the interrupt), which is what a `.sna` saved from an interrupt handler implies. |
| Q4 | May a few freely distributable homebrew snapshots, with their authors' permission, be committed as fixtures, beside the synthetic ones? | Only with explicit permission, as with the Z88 sample (Z88 D7). |
| Q5 | Should a 48K snapshot be allowed to load into an open **128K/+3E project**, locked in 48K mode (`$7FFD` = `$30`), instead of being refused by D7? | No, refuse; keep the guard simple. |
| Q6 | Run is the menu's only action (no `.szx`/`.z80` "autorun" flag exists). Is a second "Load Snapshot (Debug)..." menu item wanted? | No. Debug is in the viewer and the command. |
| Q7 | Running an installed Fuse as a behavioural oracle (load the same synthetic snapshot, compare observed results; never copy code, never in CI), as Klive BASIC's D12 allows for `zxbc`? | Allowed, for the timing checks of Phase 3 only. |
