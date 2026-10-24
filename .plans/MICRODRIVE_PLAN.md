# ZX Interface 1 and Microdrives on the 48K and 128K (G9.6)

Status: ✅ **done** (2026-10-24). Every phase has an "As built" note. Decisions Q1–Q8 were
taken by the author on 2026-10-24 (§8).
Base plan: [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), §G9 (a new row, **G9.6**, size L).
Research: [`_input/microdrive/`](../_input/microdrive/README.md). Every fact in this plan comes from
there. Each file's citations point at its own bibliography (`sources.md`, `sources-formats.md`).
Templates: [BETA128_TRDOS_PLAN.md](BETA128_TRDOS_PLAN.md) (media, write-back, state, the stand-in test
ROM) and the DivMMC "classic" device of
[DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md](DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md) Part C (a shadow ROM
shared by the 48K and 128K cores).

> **Standing rules.**
> - When this ships, update §2 (the "Tape / disk" row) and §4 (W9) of
>   [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md), and add G9.6 as done
>   in the base plan, in the same change.
> - A visual change (the Microdrive menu, the media strip's cartridge cards, the Disk Explorer's
>   cartridge view) also updates `.ai/ui-theming-intent-and-lessons.md`.
> - The commit that completes the plan carries the changeset (a `feature`). Commits for single
>   phases carry none.

---

## 1. What is being added

The **ZX Interface 1** (IF1) was Sinclair's 1983 add-on for the 48K. It provides a Microdrive
controller, RS232 and the ZX Net, and it holds an **8K shadow ROM** that extends BASIC with `CAT`,
`FORMAT`, `ERASE`, `MOVE`, `OPEN #` and `SAVE *`/`LOAD *`/`VERIFY *`/`MERGE *`. A **Microdrive** is an
endless-loop tape cartridge of about 85–100K, read and written in sectors. A loop passes the head
every 7–8 s. Software reached users on cartridges (the Sinclair Demo, Business and Games cartridges,
the *Outlet* magazine, utilities), and today they circulate as **`.mdr`** images.

The hardware, in short (details and sources: `_input/microdrive/interface1-hardware.md`):

| Port | Read | Write |
|---|---|---|
| `$E7` (A4=0, A3=0) | next tape byte; **holds WAIT** until it has arrived | next tape byte; held by WAIT until the drive takes it |
| `$EF` (A4=0, A3=1) | status: b0 write-protect (1 = writable; 0 with no drive or cartridge), b1 SYNC (0 = sync seen), b2 GAP (1 = gap or no signal), b3 RS232 DTR, b4 BUSY (unused by both ROMs) | control: b0 COMMS DATA (0 = select; also routes `$F7` b0: 1 = RS232, 0 = net), b1 COMMS CLK, b2 R/W (1 = read), b3 ERASE (0 = on), b4 CTS, b5 network WAIT |
| `$F7` (A4=1, A3=0) | b0 network in, b7 RS232 TXD | b0 network out / RS232 RXD |

- **Paging.** The IF1 ROM replaces the Spectrum ROM at `$0000–$1FFF` on an M1 fetch from `$0008`
  (the error restart: errors, hook codes, new commands and IF1 channel I/O all arrive there) or
  `$1708` (CLOSE). It goes away **after** the M1 fetch at `$0700`, where the IF1 ROM holds a `RET`.
  The trigger is the address only, so it also fires when `$0008` is reached by `RET` (the ROM's
  CALBAS round trip depends on that), and whatever 128K ROM is selected.
- **Drives.** Up to eight drives are daisy-chained as an 8-stage shift register clocked by COMMS
  CLK. The stage that holds the select bit is the running drive. There is no separate motor bit.
- **The tape.** Each sector is a header block (12-byte preamble, then 15 bytes: flag, sector
  number, cartridge name, checksum) followed by a gap and a record block (preamble, a 15-byte
  descriptor, 512 data bytes, a checksum). The checksum is the byte sum mod 255. FORMAT numbers the
  sectors 254 down to 1. The ROM finds blocks by polling GAP and SYNC, then reads them with `INIR`
  paced by WAIT, about one byte per 48 µs (~168 T).

After this change, on the 48K (PAL, NTSC, 16K) and on the 128K/+2 (the `sp128` model) (Q2):

- **Machine › Interface 1** connects the interface (and disconnects the DivMMC, Q4). The real v2
  ROM ships with Klive, and a user ROM (v1, or another) can replace it (Q1).
- **Two drives in the UI, eight in the core** (Q3). Each takes an `.mdr`, can be write-protected
  and ejected, and has a card in the media strip. Changed sectors are written back to the file.
- **New blank cartridge** (unformatted, for the ROM's own `FORMAT`) (Q7).
- **Real-speed timing** by default, and a **fast Microdrive** option that keeps the ROM's own
  protocol (Q6).
- RS232 and ZX Net are **stubbed** so the ROM fails cleanly instead of hanging (Q5).
- `.mdr` in the **Disk Explorer** and the `disk` commands (list, extract, add, delete, rename),
  `expc -f mdr` to export a compiled program as a bootable cartridge, and a **Microdrive Loader**
  flow that boots one (Q7).
- `.z80` and `.szx` **read and write** the IF1's state (Q8). Klive state files carry everything.
- The debugger shows the IF1 ROM as a partition of its own, on the 48K too.

**Out of scope:** the IF1 on the +2A/+2B/+3 (it does not work on real hardware: no ROMCS, §4.8),
Pentagon, Scorpion, Timex and Next (Q2); real RS232 and ZX Net (Q5); the QL `.mdv` and the ZEsarUX
`.rmd` formats; drives 3–8 in the UI (Q3); an IF1 ROM-annotation sidecar (a separate piece of work,
under the D4 rule, §3 M10).

## 2. What the code looks like today (the foundation)

Full survey with paths and line numbers: `_input/microdrive/klive-integration-survey.md`.

- **No IF1 or Microdrive code exists.** The traces are: `z80File.ts` knows hardware modes 1/4/5 and
  byte 36 (IF1 paged). `.szx` `IF1`/`MDRV` are in `SKIPPED_BLOCK_NAMES`.
  `spectrumSnapshotMapping.ts` warns "Interface 1 is not emulated; its state is ignored". There are
  TZX hardware-type enums, the i18n keys `media.snapshot.warning.interface1` and
  `media.snapshot.header.if1RomPaged`, and `snapshots.mdx` (Interface 1 listed as not emulated).
- **The shadow-ROM template is the DivMMC "classic" device**
  (`zxSpectrum/wasm/common/zx-spectrum-divmmc-classic.c`):
  - one C file, `#include`d by the 48K, 128K and +3 cores under a macro prefix;
  - switched on at runtime (`<prefix>DivMmcSetPresent`), with the user's ROM uploaded into a core
    static;
  - pages through the shared Z80's `Z80_BEFORE_OPCODE_FETCH` / `Z80_AFTER_OPCODE_FETCH`, and decodes
    its ports only while present;
  - on the 48K, swaps a 16K view into the flat `sp48Memory[0..$3FFF]` (the ROM is kept in
    `sp48RomShadow`); on the 128K, takes slot 0 in `rebuildMemorySlotMap()` / `rebuildFlatRomSlot()`;
  - TypeScript: one bridge (`divMmcCoreBridge.ts`, `DivMmcSupport`), a config flag `MC_DIVMMC`, a
    menu (`divmmc-menus.ts` `setDivMmcConnected` → `setMachineType(...)` rebuilds the machine), and a
    ROM setting (`SETTING_EMU_ESXDOS_ROM`).
- **The media template is Beta 128** (`Beta128Disks.ts`, `zx-spectrum-beta128.c`):
  - images live in WASM memory, so state files carry them;
  - a dirty revision with per-sector bits; `publish()` returns `SectorChanges`, which
    `MachineController` emits per frame and `RendererToMainProcessor.saveDiskChanges` writes back;
  - `republishDisks()` after a reverse-debugging fork;
  - media ids, `MediaInfo`, `attachStoredMedia`, the media strip (`spectrumMedia.ts`), and session
    restore (`main/index.ts`).
  - The controller is **lazy**: it replays elapsed events when the CPU touches a port. The tape's
    EAR bit is lazy too.
- **The 48K host has no memory partitions** (`ZxSpectrum48WasmHost` returns none; the profile layout
  `profile/layouts/sp48.ts` uses fixed addresses). The 128K lists R0/R1/B0–B7, plus R2 (TR-DOS) and
  the DivMMC's `DR`/`D0..DF`.
- **WAIT precedent:** the ZX81 core drains WAIT inside its port and memory delay hooks
  (`zx8081-ula.c` `zx8081DrainWait`).
- **Tact rebase rule:** every absolute tact a device keeps is shifted in `sp48ShiftTactOrigin` and
  the 128K equivalent (`test/wasm/zxSpectrum/wasm-tact-rebase.test.ts`).
- **Fixed-address ROM traps that the IF1 must not fool:** the tape trap at LD-BYTES `$0556` /
  SA-BYTES (`zx-spectrum-tape.c`, gated by `SP48_TAPE_TRAP_ACTIVE()`), the code-injection and
  loader flows' waiting addresses, profiling's ROM attribution, the 48K ROM's annotations in the
  disassembly. While the IF1 ROM is paged, `$0000–$1FFF` is not the 48K ROM.
- **Disk file systems:** `src/common/diskfs/` (`DiskFileSystem`, `open.ts` dispatching by kind,
  `diskExport.ts` for `expc -f dsk|trd`, `importFiles.ts`), the Disk Explorer and `DiskCommands.ts`.

## 3. Design (proposals, to be confirmed in Phases 1–2 against the real ROM)

- **M1. One C device, shared.** `zxSpectrum/wasm/common/zx-spectrum-if1.c`, prefix-macro'd like the
  DivMMC, included by `sp48.c` (and so by `timex.c`, where it is compiled out, as the DivMMC is) and
  by `sp128.c`. Not by `spp3e.c` (Q2). Present at runtime only when connected
  (`<prefix>If1SetPresent`). Unconnected, the cores pay one predictable branch per M1 and per port.
- **M2. Paging.**
  - In `Z80_BEFORE_OPCODE_FETCH`: when connected, not paged, and `pc` is `$0008` or `$1708`, page
    in.
  - In `Z80_AFTER_OPCODE_FETCH`: when paged and `pc` is `$0700`, page out. The `RET` at `$0700` was
    already fetched from the IF1 ROM, as it must be: the 48K ROM has `LD (HL),C` there.
  - The decision uses the address only, never the 128K's selected ROM (it does not matter in
    practice: 128K ROM 0 never fetches from `$0008` or `$1708`, `_input/Spectrum128_ROM0.asm`
    lines 700 and 6164).
  - `$2000–$3FFF` mirrors the 8K ROM while paged (MAME's choice; the IF1 ROM never touches it, §9).
- **M3. Ports.** Decode A4/A3 only (`00` data, `01` control/status, `10` RS232/net). Any port with
  A4=A3=0 is the data port, as on hardware (the "IN 0 crash"). An even port with A3 or A4 clear
  reaches both the ULA and the IF1. The DivMMC also decodes `$E7`, so the two are never connected
  together (Q4).
- **M4. The drive model: a ring of sector slots, laid out in time.**
  - A cartridge of *n* slots (*n* from the image, 254 by default; Fuse makes 10–254) is a ring.
    Each slot is [gap A][header: preamble + 15 bytes][gap B][record: preamble + up to `R_MAX`
    bytes][gap C].
  - The head position is computed lazily from the tact count while the motor runs:
    `(now − motorStart + phase) / byteTime mod loopLength`, like the tape's EAR bit. GAP, SYNC and
    the `$E7` bytes are derived from it on each port access.
  - A block "has signal" only if the CPU wrote it this session, or it was loaded with a valid
    checksum. Otherwise it reads as gap, so a blank cartridge gives "Microdrive not present" and an
    `OUT 239,0` erase works as on hardware.
  - **A write snaps to the next block.** The first byte written after R/W goes low with ERASE on
    goes to slot *k*'s header if the head is in gap A or the header, and to its record if it is in
    gap B or the record; anywhere later, it goes to slot *k+1*'s header. The head is then aligned
    with that block's start. The ROM never measures the absolute position, so this is invisible to
    it. Its fixed write delays (FORMAT's 3.2 ms / 6.2 ms in v1, 1.9 ms in v2, SEND-BLK's 2.7 ms
    erase lead-in) then always land where the ROM expects, whatever *n* is. A FORMAT on a
    cartridge of fewer than 254 slots overwrites its first sectors as on real tape.
  - **`R_MAX` covers v2's long FORMAT test record**: 629 bytes after the preamble, which v2's
    READ-BLK verifies as 15 + 612 `$FC` bytes. 528 would make every sector fail verification. The
    `.mdr` keeps 528 bytes; the final mark-free pass rewrites the records at normal length. The
    trailing bytes the ROM writes beyond 528 (3 per record) are dropped on save.
  - Gap lengths come from the ROM's minimum poll counts (§9, counted in Phase 0): at least 8 GAP=1
    polls of 88 T, then at least 6 GAP=0 polls before SYNC, with v2's 60-poll window of 38 T. So
    the signal must run for 528–2 900 T before SYNC; the real 12-byte preamble is 2 016 T. Nominal
    values follow v1 FORMAT's layout (header → 3.2 ms → record → 6.2 ms). The exact tolerances are
    bisected in Phase 2.
  - **Reads are paced by the CPU** (Phase 0 finding): byte *i* is delivered no earlier than its
    nominal time and never skipped, and the head's position within a block is the later of elapsed
    time and bytes consumed.
  - **Why not a raw track** (ZEsarUX `.rmd`): the `.mdr` stores sectors, not gaps. A slot ring
    converts losslessly both ways, matches the `.szx` `MDRV` block's head position and preamble
    count, and keeps write-back to sector granularity like the Beta 128's.
- **M5. WAIT.**
  - On an `$E7` read in read mode, if the next byte's time is later than now, the port-delay hook
    adds the difference to the tacts (the ZX81 drain pattern), so `INIR` runs at tape speed with
    real CPU timing. Writes do the same.
  - With no byte ever coming (motor off, gap, no cartridge), the CPU **hangs as on hardware**: the
    core burns the rest of the frame inside the `IN` and retries next frame. Pause, the debugger and
    a reset still work.
  - Writes to `$E7` in read mode are ignored, and reads in write mode return `$FF` (undocumented,
    §9).
- **M6. Fast Microdrive (Q6)** — *changed in Phase 1.*
  - **The tape is never shortened.** Phase 1 tried a fast tape first: shorter byte time and gaps. The
    ROM's own delays are fixed CPU time: ~53 ms to select and start the motor, and FORMAT's pauses.
    On a shorter tape those delays cover many more sectors than the ROM expects. ROM 2's FORMAT then
    starts its verify pass mid-tape, runs out of its visit budget ("highest sector seen + 3") and
    marks the unvisited sectors bad: 83K instead of 126K.
  - **Instead the host runs the machine faster.** While a drive's motor runs (`If1GetSelect` ≠ 0)
    and `emuOptions.fastMicrodrive` is on, `MachineController` runs frames back to back without the
    frame delay. It already does this for render-to-video (`unthrottled`).
  - Emulated time is unchanged, so the ROM sees real timing and nothing is lost. Replays, states
    and the core are untouched: the setting is host policy, not machine state.
  - The audio is muted while running fast (Phase 3 decides how).
- **M7. Drive select.** An 8-bit shift register, shifted on the falling edge of COMMS CLK with
  data = NOT COMMS DATA. The lowest selected stage is the running drive (two set bits would collide
  on hardware). Only that drive's motor runs. Write-protect reads 1 only for a selected drive
  holding a writable cartridge.
- **M8. Stubs (Q5).**
  - RS232: `$F7` b7 reads 0 (no start bit, so receive times out). DTR (`$EF` b3) reads 1, so sends
    complete into the void instead of blocking until BREAK.
  - ZX Net: `$F7` b0 reads NOT the station's own output while the network is routed, so the ROM's
    collision check sees a lone station and fails cleanly.
  - BUSY and the unused bits read 1.
- **M9. Images in WASM memory.** Eight slot rings, each up to 254 slots of (15 + `R_MAX`) bytes plus
  per-block "signal" bits and a write-protect flag: about 1.3 MB on each core. The cores' fixed
  memory sizes (sp48 14 MB, sp128 21 MB) are checked in Phase 1. A dirty revision and per-slot dirty
  bits feed write-back, as on the Beta 128.
- **M10. Provenance.**
  - The device is written from the research files' behaviour descriptions: the Service Manual, the
    Sinclair Wiki, the manuals, and the commented ROM disassemblies read **for behaviour only**.
    MAME's `intf1.cpp` / `microdrv.cpp` (BSD-3) were read for behaviour and are not ported. No GPL
    emulator code (Fuse, ZEsarUX, Spectaculator's docs only) is read or copied.
  - The commented IF1 disassemblies in `_input/microdrive/docs/` **must not feed** any future IF1
    ROM sidecar (D4, `.ai/rom-annotations/README.md`).
- **M11. Test material is Klive's own.** Fixture `.mdr` images are made by Klive's writer (Phase 3)
  or by the real ROM's `FORMAT`/`SAVE *` in the harness. Third-party cartridges (Demo, Games,
  *Outlet*) are used only in local, opt-in checks, never committed.

## 4. Behaviour to emulate

1. **Paging** (M2): in on M1 at `$0008`/`$1708`, including M1s reached by `RET`; out after the M1 at
   `$0700`. Data reads and stack traffic at those addresses do nothing. Reset pages out.
2. **While paged:** `$0038` in the IF1 ROM is `EI : RET`, so FRAMES does not count and the keyboard
   is not scanned. That comes free from running the ROM. `$0066` is `RETN`.
3. **Ports** (M3) and **status bits** (§1): write-protect, SYNC, GAP and DTR as specified; BUSY reads
   1.
4. **Drive select** (M7): ~16 ms of ROM clocking per select. The motor starts on select. Presence
   needs 6 consecutive GAP=0 polls within 5000 tries after the ROM's ~37 ms wait.
5. **Read:** gap, then signal, then SYNC, then the flag byte is the first `$E7` byte. The preamble
   is never handed to the CPU. Then 15 or 528 bytes (627 for v2's READ-BLK). Sectors pass in
   descending order, cyclically and in a stable order: v2 stops a scan at "highest sector seen + 3".
6. **Write:** ERASE (b3=0) then R/W (b2=0) frame an `OTIR` of 30 (header) or 543 (record) bytes,
   641 for v2's FORMAT test record. The first 12 are the preamble. A block left erased but not
   written becomes gap.
7. **The border** flashes to IOBORD during writes, from the ROM's own `OUT ($FE)`. Nothing to
   emulate.
8. **Models.** The 48K family (PAL, NTSC, 16K) and the 128K/+2 only. The IF1 commands work from 128
   BASIC too: ROM 0 raises errors through a `RST $08` in RAM with ROM 1 paged, which the IF1 traps.
   The +2A/+3 lack ROMCS, so the IF1 cannot work there, and it is not offered (`model-compatibility.md`).
9. **System variables:** on the first `RST 8` after power-on or NEW, the ROM inserts 58 bytes at
   `$5CB6`, moving CHANS and PROG up (PROG 23755 → 23813, derived). That is also the ROM's own
   behaviour. Klive's code that assumes PROG = 23755 must cope (§7).

## 5. Phases

### Phase 0 — ROM, references and the reference values (S) ✅
1. **The ROM (Q1).**
   - Add `src/public/roms/if1-2.rom` (8192 bytes, CRC32 `bb66dd1e`) with
     `if1-roms-readme.txt` (source, editions, the CRCs of v1 `e72a12ae` and v2).
   - Add a `THIRD_PARTY_NOTICES.md` section in the HT-1080Z style: rights with Sinclair Research,
     not covered by Amstrad's permission, no explicit permission known, removed on request.
   - Add a size and CRC test.
2. **The user-ROM setting.** `emuOptions.interface1RomFile` (`SETTING_EMU_IF1_ROM`), handed to the
   machine as `IF1_ROM_FILE`. A user ROM must be 8K; it is identified by CRC as v1, v2 or "custom".
3. **Reference values** that can be read from the ROM itself go into §9 now. The ones that need the
   ROM running (gap tolerance by bisection, port traces, PROG, CAT's "K free") need the device and
   move to Phase 2, step 0.

**As built (2026-10-24).**
- **The ROM.** `src/public/roms/if1-2.rom` was taken from a copy already on the author's machine.
  Three copies were found, all matching MAME's v2 CRC32 and SHA-1. Beside it are
  `if1-roms-readme.txt` and a `THIRD_PARTY_NOTICES.md` section.
  `test/machines/if1-rom-image.test.ts` checks:
  - size and CRC;
  - the Sinclair notice;
  - the bytes that M2 relies on, against `sp48.rom` and `sp128-1.rom`: the same instruction at
    `$0008`/`$1708`, `RET` against `LD (HL),C` at `$0700`;
  - `EI : RET` at `$0038` and `RETN` at `$0066`.

  There is no v1 file on this machine. The v1 runs of Phase 4 stay opt-in.
- **The setting.** `SETTING_EMU_IF1_ROM` goes in `setting-const.ts` and `setting-definitions.ts`,
  `IF1_ROM_FILE` in `machine-props.ts`, and `MachineService` hands the setting to every machine.
  `src/emu/machines/zxSpectrum/if1/if1Rom.ts` holds the resource name, the size and
  `checkInterface1Rom()` (v1 / v2 / custom by CRC32, refusing other sizes).
  - **Moved to Phase 3:** the Settings page row and the Machine › Interface 1 › ROM items. Both are
    gated on the Interface 1 being connected (`MC_INTERFACE1`), which Phase 3 adds; before that
    they would never show.
- **Counted from the v2 ROM's code**, as T-states at 3.5 MHz with uncontended ROM fetches (§9). Each
  gap poll in the block search (`CHKLOOP`/`CHK-LP-2`, TEST-BRK included) takes 88 T. Each SYNC poll
  (`DR-READY`) takes 38 T. A failed presence try takes ~113 T. The ROM takes ~104 T from seeing
  SYNC to its first `INIR`. Its slowest per-byte loop is READ-BLK's 36 T. These numbers settle M4's
  gap rules and change M6 (below).
- **A finding for M4/M6.** A drive whose bytes come purely from elapsed time loses bytes when a
  byte time is shorter than the ROM's ~104 T lead-in after SYNC. Real speed (168 T) is safe, but
  fast mode would not be. So **reads are paced by the CPU**: byte *i* of a block is delivered no
  earlier than its nominal time, and never skipped. The head's position within a block is the
  later of elapsed time and bytes consumed. This makes the real-speed behaviour identical to the
  hardware's (the ROM is always faster than the tape) and lets fast mode shrink the byte time
  freely.

### Phase 1 — the device in the cores (M–L)
1. `zx-spectrum-if1.c`: paging (M2), ports (M3), the shift register (M7), the lazy slot-ring drive
   (M4) with snapped writes and `R_MAX`, WAIT (M5), stubs (M8), image buffers and
   dirty bits (M9). Exports: present, ROM upload, insert/eject/write-protect, read slot, dirty
   revision, state getters for the debugger and snapshots.
2. `sp48.c`: the hooks, port routing in `SP48_PORT_*_NON_FE`, a slot-0 view like the DivMMC's (the
   8K IF1 ROM mirrored into `$0000–$3FFF` of the flat memory while paged), reset/hard reset,
   ShiftTactOrigin, and `SP48_TAPE_TRAP_ACTIVE()` false while paged. The Timex build compiles it
   out.
3. `sp128.c`: the same, with the IF1 view in `rebuildMemorySlotMap()` above ROM 0/1 (and below
   nothing: the DivMMC is never present with it, and the Beta 128 is on the Pentagon only), and
   `sp128GetCurrentPartition` / the history context's paged byte.
4. Build scripts: the exports list, the volatile list (scratch and debug only; the
   drive state is **not** volatile), `check-wasm-cpu-contract.cjs`. Check the fixed memory
   sizes.
5. Unconnected, the 48K and 128K goldens pass bit for bit and the 1 000-frame benchmark does not
   slow down (as G9.1b measured).

**As built (2026-10-24).**
- **The device.** `zxSpectrum/wasm/common/zx-spectrum-if1.c` is included by `sp48.c` (left out of
  the Timex build, which stubs it like the DivMMC) and `sp128.c`.
  - The 48K's ROM-slot remap now serves both the DivMMC and the Interface 1
    (`sp48RomSlotRemapped`). On the 128K the IF1 view sits in `rebuildMemorySlotMap()` below the
    DivMMC.
  - Ports reach the device through the cores' non-`$FE` decoding. That is **odd ports only**: an
    even port with A3 or A4 clear goes to the ULA alone, not to both as §3 M3 proposed.
  - WAIT stalls in the cores' port delay hooks (`sp48CpuDelayPortRead/Write`,
    `sp128CpuDelayPortRead/Write`), 16 T at a time so the beeper's sampling follows.
  - A wait past the frame's end, or one that never ends, **freezes** the CPU (`sp48If1RunFrozen`):
    time and the picture go on, no instruction runs. The byte a long wait delivers is already known
    when it starts, because nothing else moves the drive while the CPU is frozen.
  - The tape trap is off while the IF1 ROM is paged (`SP48_TAPE_TRAP_ACTIVE`).
  - The history context records the paging: the 48K's byte 1, the 128K's byte 3 bit 2. The 128K's
    `GetCurrentPartition` names the IF1 ROM −4.
  - Profiling still credits IF1 code to the 48K ROM's addresses until Phase 3's layouts.
- **Memory.** sp48 grew from 14 MB to 16 MB and sp128 from 21 MB to 23 MB, for the eight drives'
  1.3 MB. The export lists are `scripts/if1-exports.cjs`, added in each build mode (not to
  `productionExports`) so a benchmark reference built from older sources still links. `If1` is a
  device noun in the reverse-debugging export contract (`exportContract.ts`): its setters are
  journaled, its getters pure.
- **Fixes the real ROM found.**
  - **An off-by-one.** Byte *i* arrives (i + 1) byte times after sync, so a data segment lasts
    (n + 1) byte times. With n, the last header byte came from the next record and every header
    failed its checksum.
  - **The fast tape.** It failed as M6 now records.
- **Results** (`test/spectrum-hw/if1/if1-rom.test.ts`, shipped v2 ROM, real speed):
  - `FORMAT "m";1;"TEST"` writes all 254 slots, and `CAT 1` prints `TEST`, then **126**, then
    `0 OK, 20:1`. This confirms §9's derived 126K.
  - `SAVE *` writes one record (RECFLG `$06`), and `LOAD *` after NEW runs the program at its
    LINE.
  - `CAT 2` with no cartridge and `CAT 1` on a blank one both report
    `Microdrive not present, 10:1`.
  - On the 128K, `FORMAT` and `CAT` work from 128 BASIC (126).
  - The GAP polarity (1 = gap) is therefore **confirmed**: the ROM works only with it.
- **Speed.** `benchmark:debug-overhead --reference HEAD`: every core emulates identically to HEAD
  with the interface unconnected. The 128K is within noise. The 48K's mixed workload is +0.8%, and
  its idle-ROM run is −5.1% against −2.9% for HEAD against itself: about 2% real, under the 3%
  line. The hooks are out of line behind one predictable branch (`ZXIF1_UNLIKELY`).
- Full fast e2e tiers and the slow export-contract and replay-determinism tests pass.

### Phase 2 — hardware tests (M)
0. **The reference values Phase 0 could not take without the device** (§9 rows marked "Phase 2"):
   - the gap lengths the ROM tolerates, by bisection on the real ROM, in particular how long gap B
     must last after a header for G-HD-RC to find the record in the same pass;
   - port traces of FORMAT, CAT, SAVE and LOAD;
   - PROG after the first IF1 entry;
   - CAT's "K free" on a fresh 254-slot cartridge (v2).

   They become test expectations only once recorded.
A stand-in ROM in `test/spectrum-hw/if1/test-rom.ts`, assembled by Klive, with routines at the IF1
ROM's entry points (`$0008` dispatcher, `$0700` `RET`, a minimal select/read/write). It is used
where the real ROM's behaviour would hide the device's. Most tests run on the **shipped real ROM**.
Through new harness methods (`connectInterface1(rom?)`, `insertCartridge(drive, mdr)`,
`interface1()` state), in `test/spectrum-hw/if1/` and `test/sp128-hw/if1/`, each test citing the
research file and section it checks:
1. Paging: M1 at `$0008`/`$1708` pages in, including via `RET`; a data read does not; `$0700` pages
   out after its fetch; reset pages out; on the 128K with either ROM selected.
2. Ports: A3/A4 decode, port 0 is the data port, `$EF`/`$F7` bits, write-protect only for a
   selected drive.
3. Shift register: eight clocks select drive *n*; eight deselects stop all motors; the falling edge
   shifts.
4. Drive: GAP/SYNC sequence and byte pacing (one byte per byte time with real `INIR` timing);
   presence on a formatted cartridge; "never" on a blank one; descending, cyclic, stable sector
   order; the "IN 0" hang and recovery by reset.
5. Writes: header and record snapping, v2's long record verifying, a short (n < 254) ring
   overwriting its first sectors, erase without write becoming gap, write-protect.
6. Fast Microdrive is host policy (M6): its test is in Phase 3, where the controller runs
   unthrottled while a motor runs and the emulated result is identical to real speed.
7. Stubs: RS232 send completes, receive times out, the network fails cleanly.
8. Tact rebase and state round trip with a drive running (extend `wasm-tact-rebase.test.ts`,
   `machine-state-flow.test.ts`).

**As built (2026-10-24).**
- **Bridge and harness.** `src/emu/machines/zxSpectrum/if1/if1CoreBridge.ts` (`Interface1Support`)
  is the TypeScript side Phase 3's machines will use too. Image writes go through `writeCoreBytes`,
  so a journal sees them. `test/harness/interface1Support.ts` puts it on both sessions:
  - `connectInterface1(rom?)`: no reset; the ROM pages in at the next `$0008`.
  - `insertCartridge`, `interface1()`, `cartridge()`, `interface1Bridge`.

  The 48K session also gained `tacts()`, `reset()`, `saveState()`, `loadState()` and
  `testAdvanceTacts()`.
- **Tests:** `test/spectrum-hw/if1/`, 39 in six files, all in the fast tier (each under 20 s).
  `if1TestSupport.ts` holds a stand-in ROM, a tool-formatted cartridge builder, a BASIC runner and
  `SELECT` / `READ_BLOCK` routines written after SW-MOTOR and GET-M-BLK.
  - **paging:** `RST 8`, a fetch from `$0008` by RET, a fetch from `$1708`, data reads that page
    nothing, page-out after `$0700`'s fetch, the `$2700` mirror, reset, disconnected, and both
    128K ROMs.
  - **ports:** A4/A3 decoding, `$1F`/`$FF` not decoded, idle status `$FE`, write-protect per
    drive, the network and RS232 stubs, selecting drives 1/2/5/8, deselecting all, falling-edge
    shifting.
  - **drive:** the flag byte first, headers and records alternating with sectors descending,
    WAIT's pace (15 bytes in 14-16 byte times), presence on a formatted cartridge and none on a
    blank one, a wait across ~9 frames, the IN 0 hang ended by reset.
  - **writes:** a SEND-BLK-style record lands on the header's sector and nothing else changes;
    write protection; the erase head alone turns ~25 slots a second into gap.
  - **rom** (real v2): FORMAT/CAT 126, FORMAT on a 100-slot tape, SAVE */LOAD *, a write-protected
    SAVE, `OUT 239,0` erasing the tape, "not present" twice, PROG and `PEEK 23729`, the 128K.
  - **state:** RS232 through BASIC, five rebases mid-CAT changing nothing, a Klive state mid-SAVE *
    restoring the transfer to the same bytes and T-state.
- **A fix the tests found.** Switching ERASE on erased the block under the read head, so a
  SEND-BLK-style write lost the header it had just read. The erase head is ahead of the read head:
  only blocks that arrive later are erased (`zxIf1EnterSegment`). The real ROM had not shown it,
  because its processing takes it into gap B first.
- **Reference values recorded** (§9): gap tolerance, PROG = 23813, the short tape's 49K, and that
  RS232 sends complete.
- **Not done:**
  - **Port traces.** The real-ROM runs cover FORMAT, CAT, SAVE and LOAD end to end, and the
    traces would add nothing a test checks.
  - **WAIT on a read in write mode.** It stays the guess in §9: no ROM path does it.

### Phase 3 — the `.mdr` format, the media path and the UI (M–L)
1. **`src/emu/machines/microdrive/mdrImage.ts`.**
   - Parse `n × 543 (+1)` images (the trailing write-protect byte optional, as Warajevo writes them).
   - Reject a 174 930-byte QL `.mdv` with a clear message.
   - Write back the same slot count.
   - Validate checksums and list files: group records by name, order by RECNUM, find the EOF
     record, split off the 9-byte header of SAVE-type files.
   - Report free and bad sectors.
   - Create a blank (unformatted, all `$FF`) and a tool-formatted cartridge (§7 of
     `mdr-and-file-formats.md`).
   - Unit tests with the worked hex example (`HDCHK $02`, `DESCHK $BC`/`$BA`/`$41` - the research's
     `$21` was a sum error) and round trips.
2. **`src/common/diskfs/mdrfs.ts`** — a `DiskFileSystem` for `.mdr`:
   - list, extract (with header), add (as `SAVE *` would write it, into free sectors), delete
     (descriptors set free, as ERASE does), rename;
   - the cartridge name as the label; a sector view for the Layout tab (one "track", slots in tape
     order);
   - `open.ts`'s `diskImageKind` learns `mdr`, so the Disk Explorer, `disk ls/info/get/add/rm/mv` and
     the CLI verb pick it up.
3. **Config and menu.**
   - `MC_INTERFACE1` with `isInterface1Machine` / `hasInterface1` (`src/common/machines/interface1.ts`).
   - The Settings page row for `SETTING_EMU_IF1_ROM` (`when: {kind: "interface1"}`, browse/forget),
     moved here from Phase 0.
   - `interface1-menus.ts`: Connect (disconnects the DivMMC and says so, Q4), ROM, Fast Microdrive,
     and per drive Insert…, New Blank Cartridge…, Eject (asks to save if unsaved), Write Protect.
   - A `microdrives` key in `MACHINE_DEVICE_MENUS`; `setMachineType` rebuilds the machine, as the
     DivMMC does.
4. **Media.**
   - `MEDIA_MICRODRIVE_1` / `_2` in `project-const.ts`, `mediaIds` on `sp48` and `sp128`.
   - Write-protect props, `setMachineProperty` → a `Microdrives.ts` bridge (the `Beta128Disks`
     pattern).
   - Write-back of changed slots at `slot × 543` in `RendererToMainProcessor.saveDiskChanges`.
   - "Unsaved" props, `republishDisks()` after a reverse-debugging fork, session restore and the
     project's media list.
   - Media-strip cards ("Microdrive 1", "Microdrive 2", with a motor-running indicator).
5. **Debugger and host.**
   - The IF1 ROM partition: `IF` (−4) on the 128K, and the 48K host's first partitions (R0 and `IF`).
     `parseSpectrumPartitionLabel` learns `IF`. Update the label tests.
   - Profiling layouts for both. `getSelectedRomPage` while paged.
   - The disassembly does not show the 48K ROM's annotations over the IF1 ROM.
6. Hardware sheet (`hardware-specs.ts`) rows, i18n keys with translator context (`npm run i18n:keys`).
7. **Tests:** unit tests for `mdrImage`/`mdrfs`, menu-state tests, media-strip description tests,
   write-back tests (as the Beta 128's).

**As built (2026-10-24).**
- **Format and file system.**
  - `src/emu/machines/microdrive/mdrImage.ts` (unit tests in `test/disk/mdr-image.test.ts`) covers
    shape, checksums, sectors, the catalogue, files with the ROM's 9-byte header,
    write/erase/rename/label, and blank and tool-formatted cartridges. ROM 2's SAVE code settled the
    header: HD_0D is PROG for a program. HD_0F is an array's name byte in the low byte, with $FF
    above. HD_11 is $FFFF without LINE, because RES-VARS fills the area with $FF first.
  - The worked example's free-sector checksum is **$41**. The formats note's $21 was a sum error,
    and the note is corrected.
  - `src/common/diskfs/mdrfs.ts` (`MicrodriveFileSystem`, system `microdrive`) is opened for `.mdr`
    by `open.ts`. The Disk Explorer lists files and shows the slots as one track, R being the
    sector number. `disk` and the CLI work on it. The "new disk" paths (`crd`, `disk new`,
    `klive disk new`) take `mdr` (formatted) and `mdrblank`.
- **Machines.**
  - `src/emu/machines/zxSpectrum/if1/Interface1MachineSupport.ts`, shared by the 48K and 128K
    machine classes, does the following:
    - connects the interface from `MC_INTERFACE1` with `IF1_ROM_FILE` or the shipped `if1-2`, and
      reports the edition and any `problem`;
    - inserts the `MEDIA_MICRODRIVE_1/2` properties; re-sending the same bytes keeps the guest's
      writes;
    - puts written slots into `MICRODRIVE_CHANGES`, and drives detached by a state load into
      `MICRODRIVE_UNSAVED`;
    - backs `republishDisks()` after a fork and the core-revision follow after a replay.
  - The DivMMC wins a config that names both (Q4).
- **Write-back.**
  - `MachineController` carries `microdriveChanges` in its frame events.
  - `EmulatorPanel` patches the media store's copy in place, so it stays the same cartridge.
  - `MainApi.saveMicrodriveChanges` writes each slot at `slot × 543` of the `.mdr`.
- **Menu: Machine › Interfaces, not a Microdrives submenu.**
  - A separate submenu put the 48K's Machine menu over the twelve first-level items its test
    allows (MENU_REDESIGN_PLAN). The DivMMC and the Interface 1 are both edge-connector interfaces,
    one at a time, so on the 48K and the 128K they share **Interfaces**: both switches first, then
    the connected one's items.
  - The Interface 1's items are Fast Microdrive and, per drive, Insert/Change, New Blank Cartridge,
    Save Cartridge As, Eject and Write Protect.
  - The +2A/+3E and the Next keep **SD Card**.
  - Connecting one interface disconnects the other, with a message box.
  - The ROM is a Settings › Machine row (`if1Rom`, browse/forget), not a menu item: set-once ROM
    files live in Settings (`machine-menu-registry.ts`'s rule).
  - Sessions restore the cartridges (`main/index.ts`). As with disks, opening a project does not.
- **Fast Microdrive (M6).** The controller runs unthrottled while `microdriveMotors` ≠ 0 and the
  setting is on. It also reports the motors to the store (`SET_MICRODRIVE_MOTORS`) when they
  change. The audio is not muted while running fast.
- **Media strip.**
  - The Interface 1 adds two cards: the new `microdrive` icon and the drive number, "(no
    cartridge)" when empty, and the write-protect lock.
  - The icon turns `--color-display-hilite` while that drive's motor runs (rule recorded in
    `.ai/ui-theming-intent-and-lessons.md`).
  - Insert and eject go through the menu's own functions.
- **Debugger.**
  - On the 128K the paged ROM is partition **`IF`** (−4): labels, description, parse,
    `getMemoryPartition` (the 8K mirrored to 16K), and ROM page 3 while paged.
  - **The 48K stays partition-less**, as it is with the DivMMC mapped. Its memory views show the
    IF1 ROM's bytes while it is paged, because the flat memory holds them.
  - Profiling no longer credits IF1 code to the 48K ROM's addresses: the 48K maps it nowhere, and
    the 128K never mapped it. Profiling the IF1 ROM itself is not done.
- **Not done:**
  - **Hardware-sheet rows.** The sheet lists each model's built-in media, and the DivMMC, also an
    add-on, is not there either.
  - **Checking the 48K ROM's annotations against the paged IF1 ROM.** Sidecars match a page by its
    CRC, so the IF1 bytes should not pick up the 48K's, but this was not looked at in the running
    IDE.
- **Tests:** `test/spectrum-hw/if1/if1-machine.test.ts` (the machine side, nine tests), the media
  strip and menu-structure tests, and the full fast tiers (26,081 tests).
- **IDE check** (`scripts/doc-shots/recipes/microdrives.cjs`; the harness gained `sessionSettings`,
  because the scripted instance's application menu is empty here):
  1. A seeded session starts a 128K with the Interface 1 and a cartridge in Microdrive 1.
  2. The strip shows both cards, and the icon tints during CAT.
  3. `cat 1` in 128 BASIC prints `GAMES`, `127` and `0 OK, 0:1`.
  4. `save *"m";1;"hi"` reports `0 OK` and its bytes reach the `.mdr` file on disk.

### Phase 4 — the real ROM end to end and the IDE flows (M)
1. **On the shipped v2 ROM in the harness**, scripts T1–T12 of `test-material.md`, each expectation
   taken from the values Phases 0 and 2 recorded, never from the derived ones:
   - `FORMAT "m";1;"TEST"` then `CAT 1`;
   - `SAVE *`/`VERIFY *`/`LOAD *` of a program (with LINE), CODE, SCREEN$ and arrays;
   - OPEN#/PRINT#/INPUT#/CLOSE# and MOVE;
   - ERASE;
   - the error texts (`Microdrive not present, 0:1`, `File not found`, `Drive 'write' protected`,
     `Microdrive full`, ...);
   - write-back reaching the `.mdr` file;
   - `PEEK 23729` = 80.

   With a user v1 ROM (opt-in, `KLIVE_IF1_V1_ROM=/path`), the same suite and `PEEK 23729` = 0.
2. **128K:** the same from 128 BASIC and from 48 BASIC. Then `1000 OPEN #4,"X"` in the 128 editor,
   a fidelity check of the editor bug Paul Farrow lists.
3. **Microdrive Loader flow** (`getMicrodriveLoadFlow()` on both hosts; Machine › Boot Cartridge in
   Microdrive 1; `EmuApi.startMicrodriveBoot`): reset, then `RUN` with no program, which makes the
   IF1 load `run` from drive 1. If T9 shows that auto-run does not work from 128 BASIC, the 128K
   flow enters 48 BASIC or types `LOAD *"m";1;"run"`. E2E test: the flow boots a Klive-made cartridge
   whose `run` writes a known byte.
4. **Code injection (Q7).**
   - `expc -f mdr` (`diskExport.ts` learns `mdr`): code segments as CODE files, an optional screen,
     and a BASIC loader named `run` (`[CLEAR n:] [BORDER b:] LOAD *"m";1;"name" CODE: ... RANDOMIZE
     USR entry`), written by `mdrfs`. Banked segments are refused, as with `-f dsk|trd`.
   - An "Export and boot in Microdrive 1" IDE command inserts the cartridge and runs the Loader
     flow.
   - The existing Run/Debug code-injection flows are re-run with the IF1 connected (PROG moved, the
     ROM paged after every direct command, §7) and fixed where they assume the 48K ROM at
     `$0000–$1FFF` or PROG = 23755.
5. **Tape with the IF1:** `LOAD ""` with fast load on and off, and the tape trap not firing while
   the IF1 ROM is paged.

**As built (2026-10-24).**
- **Files on the real v2 ROM** (`test/spectrum-hw/if1/if1-rom-files.test.ts`, 13 tests, on a
  tool-formatted cartridge):
  - SAVE * of CODE and SCREEN$, with their headers (SCREEN$ takes 14 records), and LOAD * CODE at
    another address;
  - LOAD * of CODE as a program: "Wrong file type";
  - SAVE * and LOAD * DATA of an array (name byte `$FF81`);
  - VERIFY *, passing and then "Verification has failed";
  - a PRINT # stream: OPEN #, PRINT #, CLOSE #, INPUT #, then MOVE to the screen; its bytes are
    `hello\rworld\r` with no header;
  - ERASE, after which CAT shows 127 again;
  - the reports "File not found", "Invalid drive number", "Invalid name" (twice), "Invalid device
    expression", "Writing to a 'read' file", "Stream already open" and "Microdrive full".

  A SAVE * on a fresh cartridge takes about 475 frames (~10 s). ROM 1 is opt-in
  (`KLIVE_IF1_V1_ROM`): no v1 file was available, so it was not run.
- **A harness fix.** The 48K session's screen reader took its font from live memory, so it read
  every cell as `?` while the IF1 ROM was paged. It now uses the 48K ROM file's font then.
- **128K** (`if1-128k.test.ts`):
  - CAT works from 48 BASIC.
  - `1000 OPEN #4,"x"` in the 128 editor reports "Invalid device expression, 1000:" with the
    statement number wrapped onto a line of its own: the overrun Farrow lists.
  - **T9 settled:** RUN with no program auto-loads `run` on the 48K, from 48 BASIC and from 128
    BASIC (the editor's RUN reaches the IF1 as 48K BASIC's does).
- **The Microdrive Loader.**
  - `src/emu/machines/zxSpectrum/if1/microdriveBootFlows.ts`:
    - 48K: R, Enter at the main loop;
    - 128K: the menu's 128 BASIC, then `run`. Its first letter waits 25 frames, because the editor
      draws before it reads keys.
  - `getMicrodriveBootFlow()` on both machines, only with the IF1 connected.
  - `MachineController.runMicrodriveBoot`, `EmuApi.startMicrodriveBoot`.
  - Menu item: Machine › Interfaces › **Boot Cartridge in Microdrive 1**.
- **`expc -f mdr`.** `buildExportDisk("mdr")` writes the code files, an optional screen and a
  one-line loader `run` (`LOAD *"m";1;"name"CODE: ... RANDOMIZE USR entry`) on a formatted cartridge
  named after the program. The Loader boots it on the 48K and the 128K (`if1-export.test.ts`).
  - **Not done:** a separate "Export and boot in Microdrive 1" command. Export, then Insert and
    Boot Cartridge, do the same.
- **The IDE's flows with the IF1** (`if1-flows.test.ts`), all unchanged:
  - Injected code returns to a BASIC that still drives the Microdrives (PROG at 23813).
  - The 128K's sp48 and sp128 injection flows reach their main loops.
  - `LOAD ""` loads a tape with fast load on and off.
  - The tape trap does not fire at `$056C` inside the paged IF1 ROM. A control proves it fires with
    the interface off.

### Phase 5 — snapshots and state (S–M) ✅
1. **`.z80`:**
   - read modes 1 (48K + IF1), 4 in v2 / 5 in v3 (128K + IF1), with byte 37 bit 7 (16K / +2);
     byte 36 `$FF` restores the IF1 paged;
   - write v3 with mode 1 or 5 and byte 36;
   - a page-1 block (an IF1 ROM) is ignored;
   - the "not emulated" warning goes away for these machines.
2. **`.szx`:**
   - read and write `IF1\0` (enabled, paged, drive count, custom ROM, compressed or not; size 0 means
     the standard v2) and one `MDRV` per inserted drive (motor, head position, preamble count, the
     `.mdr` path);
   - a missing `.mdr` on load leaves the drive empty with a warning;
   - `wDrivePos`'s units are settled against a Spectaculator- or Fuse-written file, if
     one can be found; otherwise Klive writes slot × 543 + offset, clamped, and reads it the same
     way (§9).
3. **`.sna`:** no field. Saving warns while the IF1 ROM is paged. Loading keeps the IF1 as
   configured.
4. **Klive state files:** the drive state and images are in WASM memory and travel with the image.
   The `.mdr` files are **detached** on load (state-files plan D11), as the Beta 128's disks are. The
   layout fingerprint changes, and old states load through their `.szx`.
5. **RZX:** a recording made with a cartridge plays back from its embedded `.szx` (port reads come
   from the recording). Writes during playback never reach the user's file.
6. Tests: `test/spectrum/snapshot/*` (the existing `peripherals.interface1` parse tests now
   restore), `machine-state-flow.test.ts`, RZX determinism.

**As built (Phase 5, 2026-10-24):**
- **The model.** `peripherals.if1` (`SnapshotInterface1`: `paged`, `drives`, `customRom`,
  `microdrives`), next to the old `interface1` flag, which stays as "the interface was there".
- **`.z80`.**
  - Read: modes 1, 4 (v2) and 5 (v3), with the modified bit, give `if1` with `paged` from byte 36.
  - Write: mode 1 for the 16K/48K, mode 5 for the 128K, and mode 5 with the modified bit for the +2.
    Byte 36 is `$FF` while paged.
  - The cartridges and a custom ROM are declared losses. A page-1 block (an IF1 ROM) still only
    warns.
- **`.szx`.**
  - `IF1` and `MDRV` are read and written; neither is in the "not restored" list any more.
  - A custom ROM is embedded zlib-compressed. The standard v2 ROM (by CRC) gives `wRomSize` 0.
  - An `IF1` block with the enabled bit off records no interface. An `MDRV` without an `IF1` block
    still implies one.
  - A cartridge without a file is a loss.
- **`wDrivePos`.** No foreign file was found, so Klive writes the head's **slot index** and does
  not restore it (§9). The ROM re-finds its place from the headers. The motor and select state are
  not in the block either, so a snapshot taken mid-transfer does not resume the transfer.
- **`.sna`.** "does not record the Interface 1", or the "ROM was paged in" variant, plus the
  cartridges, all as losses.
- **The mapping.** No warning on the 48K family or the 128K/+2; the 128K prefers `sp128` over the
  Pentagon. Other targets warn that only those machines have one.
- **The loader.**
  - `fitSpectrumMachine` connects the IF1 (`MC_INTERFACE1`) and drops the DivMMC with a warning.
  - A snapshot without the IF1 leaves a connected interface alone.
  - The IDE command reads `MDRV`'s files like the disks (`diskCandidates`). A missing file is a
    warning.
  - The emulator inserts the cartridges through the main store (`insertLinkedMicrodrive`), so the
    guest's writes reach the file. A drive beyond 2, or a machine without the IF1, warns.
- **Capture and restore.**
  - Capture reads the paging, the ROM edition, and the inserted drives with their motor and slot.
    The cartridges' file names come from the media store (`microdriveFiles`).
  - Restore calls `If1SetPaged` after the reset.
- **Klive state files** list the two cartridges in `MEDI`. Loading one says the cartridge is
  detached (`emu.machineState.microdrive`).
- **The viewer** shows the interface's row and one row per cartridge.
- **RZX.** A CAT recorded with a cartridge plays back to the same screen on a machine with no
  cartridge (`if1-state.test.ts`). A test must put its program into memory before recording, since
  a poke behind the recorder desyncs any playback.
- **Tests:**
  - `test/spectrum/snapshot/spectrum-snapshot-if1.test.ts`;
  - the flow test (connect, insert, paging);
  - `if1-state.test.ts` (`.szx`/`.z80` paged round trips on the real core, RZX).

### Phase 6 — documentation and roadmap (S) ✅
1. `docs/content/en/guides/emulator/microdrives.mdx`, modelled on `trdos-disks.mdx`: connect the IF1,
   insert or create a cartridge, FORMAT, CAT, SAVE/LOAD, boot, fast mode, write-back, write protect,
   the "IN 0" hang. Also update `machine-types.mdx`, `snapshots.mdx` (Interface 1 now emulated),
   `disk-explorer.mdx` (`.mdr`), `custom-rom.mdx` (the IF1 ROM setting), the `expc` reference, the
   book's I/O ports appendix, and `whats-new.mdx`.
2. `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2 and §4; G9.6 row (✅) in `CLOSING_THE_GAPS_PLAN.md`;
   this plan's "As built" section.
3. `.ai/ui-theming-intent-and-lessons.md` for any styling rule the cards or menus taught.
4. The changeset (`npm run change -- --type feature --text "**Interface 1 and Microdrives** ..."`).
5. `npm run doc:build && npm run doc:check`.

**As built (Phase 6, 2026-10-24):**
- **Docs.**
  - New page: `guides/emulator/microdrives.mdx` (connect, cartridges, BASIC, boot, fast mode,
    things to know, snapshots), in the emulator guides' navigation after TR-DOS.
  - Updated: `machine-types.mdx` (Machine › Interfaces), `snapshots.mdx` (the IF1 is emulated; `.szx`
    links cartridges), `disk-explorer.mdx` (`.mdr`, its one-row layout, `-f mdr`, and the DivMMC's
    menu now under Interfaces on the 48K/128K), `custom-rom.mdx` (the IF1 ROM setting), and the
    `crd`, `disk` and `expc` references. The route golden gained the page.
  - **Not done:**
    - `whats-new.mdx` is generated from the CHANGELOG, so the changeset reaches it.
    - The book's I/O ports appendix is the Next's, which has no Interface 1.
    - No screenshots: the doc-shots recipe captures them, but none is published.
- **A Phase 4 gap closed.** The Export Code dialog offers "Microdrive cartridge (.mdr)" on the 48K
  and the 128K; only `expc -f mdr` did before.
- **Roadmap.**
  - G9.6 row ✅ in `CLOSING_THE_GAPS_PLAN.md`.
  - The tape/disk row (§2) and W9 (§4) in `LANDING_PAGE_COMPETITIVE_ANALYSIS.md`.
- **Where new cartridges go** (asked by the author after the phases): New Blank Cartridge starts in
  the open project's `cartridges` folder, which it makes (`newCartridgeDialogFolder`). Without a
  project, it starts in the last cartridge's folder. `crd mdr`/`mdrblank` without a folder (and with
  `-p`) use `cartridges` too, or `Klive/Cartridges` without a project (`defaultCartridgeFolder`).
- **`.mdr` in the project explorer** (found by the author after the phases): the file-type registry
  sent only `.dsk`/`.trd`/`.scl` to the Disk Explorer, so a cartridge opened as text. `.mdr` now opens
  there with the Microdrive icon (`diskFileType.test.ts`). An edit of a cartridge in a Microdrive
  pauses a running machine and re-inserts the cartridge, as for disks (`mountedMicrodrive`). The
  automation API's `expc` formats gained `mdr`.
- **No theming note.** Phase 6 changed no style, and Phase 3's icon rule is already recorded.
- **The changeset** is a feature, with a highlight.
- **Checks:** `doc:build` and `doc:check`, the fast tiers, and `test:slow`.

## 6. Verification

- Focused tests per phase, then `npm run build:check`, and `npm run lint:renderer` (Phases 3–4).
- `npx electron-vite build --config build/electron.vite.config.ts`.
- `npm run test:slow` before the plan completes.
- New core tests go in folders already in `E2E_CORE_TESTS`. A file over 20 s moves to the slow tier.
- **In the running IDE** (doc-shots Playwright driver, seeded settings, as the Beta 128 check did):
  1. connect the IF1 on a 48K;
  2. create a blank cartridge and `FORMAT` it;
  3. `SAVE *` a program and confirm the `.mdr` on disk changed;
  4. browse it in the Disk Explorer;
  5. boot an `expc -f mdr` cartridge with the Loader;
  6. repeat on the 128K;
  7. load a `.z80` with mode 1.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Shipping the IF1 ROM: the rights are Sinclair's, with no known permission (Q1) | Readme and notice in the HT-1080Z style, removal on request. The user-ROM setting means a removal never breaks the feature |
| The slot model's gaps do not satisfy some program that drives the ports itself (copiers, Microdrive Doctor) | Gaps from the ROM's poll minima plus margin. Phase 2 bisects the tolerance. Local opt-in runs of the Demo cartridge's Microdrive Test and a sector copier |
| v2 FORMAT's long records, or a short ring, behave differently from real tape | M4's `R_MAX` and write snapping; Phase 2 tests both |
| Klive flows and traps assume the 48K ROM at `$0000–$1FFF` or PROG = 23755 | Tape trap gated (Phase 1). Code injection and loader flows re-run with the IF1 (Phase 4.4). The disassembly and profiler see the partition |
| The "IN 0" hang looks like an emulator freeze | Documented. The debugger shows PC on the `IN`. Reset recovers |
| The paging check slows every M1 | Gated on "connected"; benchmark in Phase 1 |
| Core memory grows ~1.3 MB on each core | Checked against the fixed sizes; the image buffers could shrink to two drives' worth if needed (UI shows two) |
| Fast mode breaks determinism | It no longer can: the core runs at real speed and only the host's frame pacing changes (M6, Phase 1) |
| `.szx` `MDRV` head position cannot be interpreted | Klive writes and reads its own convention (§9); foreign values only position the head, which the ROM does not depend on |

## 8. Decisions from the author (2026-10-24)

- **Q1. The IF1 ROM:** **ship v2** (`if1-2.rom`) with a readme and a `THIRD_PARTY_NOTICES.md` entry,
  as for the HT-1080Z ROMs. A user-ROM setting can replace it (v1 or another 8K ROM).
- **Q2. Machines:** the 48K family (PAL, NTSC, 16K) and the 128K/+2 (`sp128` model). Not the
  Pentagon, Scorpion, Timex, +2A/+3 or Next.
- **Q3. Drives:** the core handles the full 8-drive chain; the UI exposes drives 1 and 2.
- **Q4. DivMMC:** mutually exclusive with the IF1. Connecting one disconnects the other, with a
  message.
- **Q5. RS232 and ZX Net:** stubbed (M8). Real emulation is a later plan.
- **Q6. Speed:** real speed by default, plus a **fast Microdrive** option that keeps the ROM's
  protocol (M6).
- **Q7. Tooling:** all four: new blank cartridge, an `.mdr` file system (Disk Explorer, `disk`, CLI),
  a Microdrive Loader flow, and code injection (`expc -f mdr` plus "export and boot").
- **Q8. Snapshots:** `.z80` and `.szx` read and written; Klive state files carry everything.

## 9. Reference values (Phase 0 recorded; rows marked Phase 2 follow)

Sources are the research files in `_input/microdrive/`, which carry the citations.

| Value | Klive (proposed) | Source / status |
|---|---|---|
| Paging | in on M1 `$0008`/`$1708` (before the fetch), out after the M1 at `$0700`; address only | `interface1-hardware.md` §3; MAME |
| `$2000–$3FFF` while paged | the 8K ROM mirrored | MAME; **not verified on hardware** |
| Port decode | A4/A3 only | `interface1-hardware.md` §2.1; full decode **unknown** |
| GAP polarity | 1 = gap / no signal | **confirmed** in Phase 1: the real v2 ROM formats, catalogues, saves and loads with it |
| Byte time | ~48 µs ≈ 168 T at 3.5 MHz (12 µs per bit per track, two tracks) | OqtaDrive, Sinclair Wiki; Wikipedia's 15 KB/s disagrees. The ROM never measures it |
| Gaps | ≥ 8 GAP=1 polls, then ≥ 6 GAP=0 polls before SYNC; Klive: gap A 0.57 ms, gap B 3.23 ms, gap C 6.2 ms (v1 FORMAT's layout) | `interface1-hardware.md` §7.3 |
| Gap tolerance (v2 ROM, real speed) | gap B ≥ ~1 ms (0.6 ms fails: G-HD-RC's processing after a header must end inside it); gap C ≥ ~3 ms (2 ms fails); gap A anything, even 0 (gap C precedes it). Klive's nominal values keep ≥ 2× margin | bisected in Phase 2 (FORMAT, CAT, SAVE */LOAD *) |
| ROM poll timing (v2, counted) | gap poll 88 T (`CHKLOOP`/`CHK-LP-2`, TEST-BRK included); SYNC poll 38 T × 60 (2 280 T); SYNC → first `INIR` ~104 T; `INIR` 21 T/byte; slowest byte loop 36 T (READ-BLK); a failed presence try ~113 T × 5 000 (~0.16 s) after a 5 000 × 26 T (~37 ms) settle; DELAY-BC 26 T per count | v2 code (`IF1 v2 rom source.txt`), counted in Phase 0 |
| Signal before SYNC | 528–2 900 T (6 polls minimum, then the 60-poll window); the real preamble is 12 × 168 = 2 016 T | derived from the row above |
| Slot at real speed | ~30 + 67 + 543 + 129 byte times (header, gap B, record, gap C) ≈ 129 000 T ≈ 37 ms; 254 slots ≈ 9.4 s a loop | v1 FORMAT's delays, Phase 0 |
| v2 FORMAT test record | `WR-BLK` writes 27 + 256 + 256 + 102 = 641 bytes; `READ-BLK` reads 15, then checks 256 + 256 + 100 = 612 bytes of `$FC` | v2 code, counted in Phase 0 |
| Preamble | 10 × `$00`, 2 × `$FF`; never handed to the CPU | `microdrive-media.md` §2.1 |
| Blocks | header 15 bytes, record 528 (ROM writes 543 with preamble + 3 junk, reads 528); v2 FORMAT record 641 written, 627 verified | `microdrive-media.md` §2.2–2.3; v2 disassembly WR-BLK/READ-BLK |
| Checksum | sum mod 255 | verified by simulation (`mdr-and-file-formats.md` §3) |
| Free sector | RECFLG b1 = 0 and RECLEN b9 = 0; bad = EOF + RECNAM[0] = 0 | ROM; the Sinclair Wiki's "b2 = in use" is wrong |
| `.mdr` | `n × 543 (+1)`, 254 × 543 + 1 = 137 923; slots in tape order (read HDNUMB, never the slot index) | `mdr-and-file-formats.md` §2 |
| Shift register | 8 stages, falling COMMS CLK edge, data = NOT COMMS DATA | MAME uses falling; no hardware document states it |
| Motor/select delays (ROM) | select ~16 ms; presence wait ~37 ms; FORMAT ~97 ms | `interface1-hardware.md` §5 |
| Unused read bits, BUSY | 1 | **guess** |
| `$E7` in the wrong direction | write in read mode ignored; read in write mode `$FF` | **guess**; undocumented |
| PROG after the first IF1 entry | 23813 | **confirmed** in Phase 2 (`if1-rom.test.ts`) |
| FORMAT on a 100-slot tape (v2) | the last 100 sectors written survive (100 down to 1); CAT: 49K (98 usable) | recorded in Phase 2 |
| CAT "K free", fresh 254-slot cartridge (v2) | 126 | **confirmed** in Phase 1 (`if1-rom.test.ts`) |
| CAT "K free", fresh 254-slot cartridge | 126 (v2) / 127 (v1) (derived) | **record in Phase 2** (v1 only with a user ROM) |
| `.szx` `wDrivePos` | Klive: the head's slot index (0-253); written, read into the model, not restored | spec says "position within the file" but the field is a WORD; no foreign file found (Phase 5) |
| ROM editions | v1 CRC32 `e72a12ae`, v2 `bb66dd1e` (SHA-1 `5cfb6bca…3a127c08`, the shipped file); `CLOSE #0: PRINT PEEK 23729` → 0 / 80 | MAME hashes; Carri; the shipped file checked in Phase 0 |
| Paging-address bytes | `$0008` `2A 5D 5C` and `$1708` `23` in the IF1 ROM, `sp48.rom` and `sp128-1.rom`; `$0700` `C9` (IF1) vs `71` (48K); `$0038` `FB C9`, `$0066` `ED 45` in the IF1 ROM | checked by `if1-rom-image.test.ts` |
| 128K ROM 0 | never fetches from `$0008`/`$1708` | `_input/Spectrum128_ROM0.asm` (Paul Farrow's notes) |
