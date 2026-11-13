# ZX Spectrum Next: KS3 and core 3.03.03 follow-up

Status: **open** (2026-11-13). Phase 3 is **done**; phase 2 is **done except** what waits on phase 1's
research; phases 1, 4 and 5 are **not started** (research, or the author's decision). Follows
`dev/plans/ZXNEXT_3_03_PLAN.md` (the `ks2-30303` and `ks3-30303` models), whose decisions D-A to D-G still
hold. The facts this plan builds on are collected in `dev/ai/zxnext-ks3-memory-and-28mhz-wait.md`.

## Scope

What that note lists as not done yet, minus what the project author ruled out:

| # | Item | In this plan | State |
|---|---|---|---|
| 1 | The KS3's second SD card reader (internal and external) | Phases 1-2 | **Partly done**: the second card works (phase 2); which reader is internal waits on phase 1 |
| 2 | A KS1 (issue 2) model | **No** (author's decision, 2026-11-13: the board is old) | - |
| 3 | Firmware-level features of System/Next 26.11a | Phase 4, as a decision first | **Open**: waits on the author's decision |
| 4 | The IDE's view of the KS3's upper 2 MB | Phase 3 | **Done** |
| 5 | Which 28 MHz reads lost their wait | Researched below; one check left (phase 5) | **Open**: bank 5 and page `$0E` reads |
| 6 | The zxnDDMA details the guide leaves open | Researched below; some left (phase 5) | **Open**: the 2D counter, `$12`/`$13` on the KS3; the transparent write cycle is settled |

## Research (2026-11-13)

### Where the core 3.03 source is

- The distribution's `src/vhdl/read.me` points to gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA. That
  repository has no 3.03 branch: the newest is `30205` (2026-09-25), whose commits since 3.02.04 only trim
  the anti-brick core and bump the version. The `28MHz` (2019), `sram_memory_cycle` (2021) and
  `cpu_wait_bug` (2019) branches are history: in November 2019 `cpu_wait_bug` widened the 28 MHz wait from
  opcode fetches to all memory reads. **No 3.03 VHDL is public.**
- The release page (specnext.com/latestdistro, "System/Next 26.11a") adds nothing beyond "Core version:
  3.03.03 (Issues 2,4,5) featuring Zero Wait State 28MHz and zxnDimensionalDMA (zxnDDMA aka Blitter) - fixes
  dropped audio frames on HDMI".

### R1. The 28 MHz wait: gone for CPU fetches, CPU data reads and DMA reads

The zxnDDMA guide's example `zxnddma_compare.asm` (distribution `docs/zxnDDMA/examples/`, commit
`3a892b03`) draws 32 balls of 16 x 16 bytes on Layer 2 five ways, times each in video lines (NextRegs
`$1E`/`$1F`, 64 us a line) and prints tenths of a millisecond. Its header gives the times measured "on an
issue 5 (3.02.21, 28MHz), the same every run". 3.02.21 is the zxnDDMA development core (every example
asks for `savenex core 3,2,21`), which the release turned into 3.03. Assembled with sjasmplus and run
unchanged in Klive (research only; neither the program nor its NEX is in the repository):

| Way | Issue 5, measured | Klive `ks3-30303` / `ks2-30303` (no wait) | Klive `ks2-30204` (one wait) |
|---|---|---|---|
| 1 CPU, one `LDIR` per column | 7.2 ms | 112 lines, prints **7.2** | 130 lines, 8.3 |
| 2 CPU, byte by byte, skipping `$E3` | 15.6 ms | 243 lines, prints **15.6** | 295 lines, 18.9 |
| 3 zxnDMA, one transfer per column | 8.2 ms | 128 lines, prints **8.2** | 151 lines, 9.7 |
| 4 zxnDDMA, opaque | 2.1 ms | 33 lines, prints **2.1** | (no zxnDDMA) |
| 5 zxnDDMA, transparent | 2.1 ms | 33 lines, prints **2.1** | (no zxnDDMA) |

All five agree exactly; the one-wait model is off by 1.1 to 3.3 ms. Way 2 is dominated by CPU data reads,
way 1 by `LDIR` (two fetches and a data read a byte), ways 3-5 by DMA reads and the CPU's set-up code, so
**on an issue 5, CPU opcode fetches, CPU data reads and DMA reads all lost their 28 MHz wait**, which is
what Klive implements (`ZXNEXT_CORE_VERSION < 30300` guards in `zxnext-cpu.c` and `zxnext-dma.c`). Not
covered by the measurement: reads from bank 5 and page `$0E` (the program runs from SRAM and draws to SRAM),
and issues 2 and 4 (the release page states those).

### R2. A transparent byte still takes its write cycle

The ball has 84 transparent (`$E3`) bytes out of 256, 2,688 in the job. If a skipped byte also skipped its
3-clock write cycle, way 5 would be about 8,000 T-states (0.29 ms, 4-5 video lines) faster than way 4. On the
hardware both took 2.1 ms, as they do in Klive, which charges the write cycle either way. Confirmed.

### R3. DMA timing at 28 MHz matches

Way 3 (512 transfers of 16 bytes, each started by an `OTIR` of 8 bytes) and ways 4-5 (32 transfers of 256
bytes) depend on the per-byte cost (6 clocks at the default 3-cycle timing) and the per-transfer hand-over.
Klive matches both to the printed tenth, so its bus hand-over model holds on 3.03 at 28 MHz.

### Still open after the research

- **The 2D byte counter** (what the read-back sequence gives for the counter in 2D mode): nothing in the
  guide or its examples reads it. Klive counts every byte.
- **NextReg `$12`/`$13` on the KS3**: whether the Layer 2 bank registers gained a bit (Layer 2 in the upper
  2 MB). Nothing in the distribution says so; the 3.02.04 VHDL's Layer 2 address formula stops at 2 MB.
- **The 2-cycle timing claim** ("2-cycle timing makes both about 12% faster", the compare program) and the
  other examples' measurements (sprites: "244 of the 312 lines"; windows: "109 of the 312 lines (7.0ms)";
  FLIP 8.4 ms and PULSE 10.0 ms): checkable in Klive the same way (phase 5).
- **Which chip select is the KS3's internal SD reader.** The issue 5 top file wires `sd_cs0_n` and `sd_cs1_n`
  to FPGA pins N1 and K2; which socket each reaches needs the KS3 schematic, which the distribution does not
  have (only KS1 and KS2). The updater works with drive letters `C:`/`D:`; the NEXTEST guide does not say. The
  release page says a KS3 "with removed internal card" updates like a KS2.

## Phase 1: research the KS3's card readers — **NOT STARTED** (needs research)

Needed before phase 2 decides what the user sees. Until then Klive names the readers neutrally ("SD card",
"SD card 2").

1. Find which chip select (`$E7` value `$FE` = card 0, `$FD` = card 1) is the internal reader: the KS3
   schematic (SpecNext), the core's author, or a NextZXOS listing of which drive is which on a KS3 with both
   cards in. Record the source.
2. Find how NextZXOS 2.10a assigns drive letters to two cards, and what NextReg `$0A` bit 5 (swap, written in
   config mode) is for on a KS3: does the firmware set it, and when?
3. Record the answers in `dev/ai/zxnext-ks3-memory-and-28mhz-wait.md`.

## Phase 2: the KS3's second SD card — **DONE**, except the items that wait on phase 1

**As built (2026-11-13):**

- `NextProfile.sdReaders` (2 for `ks3-30303`, 1 elsewhere); `MEDIA_SD_CARD_2` (`project-const.ts`) holds
  the second image, saved with the project like every medium; unset is an empty slot.
- Main process (`zx-next-menus.ts`): `getSdCardDevice(card)`, card 1 through its own handler cache
  (`getSdCard2Device`, `.cim` or a raw image), 0 sectors without an image; `readSdCardSector`,
  `writeSdCardSector` and `getSdCardInfo` take a card (`MainApi.ts`, `RendererToMainProcessor.ts`), card 0
  by default, so the DivMMC machines are unchanged. `isActiveSdCard` (the file manager's guard) covers card 2.
- Machine › SD Card on the KS3 model: **Select Image for SD Card 2...** and **Eject SD Card 2**
  (`menu.next.selectImage2`, `menu.next.ejectImage2`, `messages.sdCard.select2`).
- Renderer (`ZxNextWasmV2Machine`): every SD read, write, undo-log read and revert carries its card; the
  card sizes (`ensureSdCardInfo`, public now) are loaded at setup when the machine has a messenger, again
  after every hard reset (so a card chosen while stopped counts), and before an SD frame command otherwise.
- Tests: `SPI-013` in `test/zxnext-hw/sd/sd-card.test.ts` on every profile (card 1 answers only on the KS3
  and only with an image; `CMD17` on card 1 returns its own image, which failed before); the harness's
  `InMemorySdMessenger` routes by card and `session.attachSdCard2`; `test/main/zx-next-sd-card-2.test.ts`
  (the menu per model, the empty slot, a raw image read and written).
- Docs: `guides/next/sd-card.mdx` ("A second card on the KS3"), the models page.

**Not done (waits on phase 1):** naming the readers internal and external, and whether the KS3 model should
come with a default second card (step 3). Not done by choice: `ncp` and the file manager's SD drive work on
card 0 only; a machine state file records card 0's fingerprint only. Not checked: that NextZXOS 2.10a mounts
the second card as a drive (no test boots NextZXOS with two cards).

The original steps:

The core needs no change: `zx-spectrum-sd.c` already has two cards (`sdCards[1]`, `READ_CARD1`/`WRITE_CARD1`),
the swap is in `zxnext-sd.c`, and `ZxNextWasmV2Machine` turns card 1's commands into `sd-read-card1` /
`sd-write-card1` frame commands. What is missing is on the host:

1. **The main-process API takes a card**: `readSdCardSector(sector)` and its write twin
   (`MainApi.ts`, `RendererToMainProcessor.ts`) gain a card index; card 1 reads its own CIM file. Today
   `processWasmV2SdReadFrameCommand` passes card 1's requests to card 0's file.
2. **Card 1's size reaches the core** (`zxSdSetCardInfo(1, sectors)` through the existing card-info path), so
   the slot is present only when a card 1 file is chosen; otherwise it stays empty, as now.
3. **A second card file per model, only where the board has a second reader**: a `NextProfile` field (for
   example `sdReaders: 1 | 2`), set to 2 for `ks3-30303`. Its working copy, if one is created by default,
   names itself after the model and the reader (`ks3-30303-ext.cim`); the default is an **empty slot** unless
   phase 1 shows NextZXOS expects two cards.
4. **Menus and settings**: Machine > SD Card gets the second reader for the KS3 model (select, eject, reset),
   with `t()` texts (`dev/ai/i18n-guide.md`); the setting persists per model like the first card.
5. **Tests**: harness scripted tests in `test/zxnext-hw/sd/` on every profile (card 1 absent on KS2 models
   and by default on KS3; present and readable when given; the swap still works), and a main-process test of
   the per-card file routing.
6. **Docs**: `docs/content/en/guides/next/sd-card.mdx` and the models page.

Risks: `zx-spectrum-sd.c` is shared with the other Spectrum cores' DivMMC; this phase does not touch it. The
state image already carries both cards' C state.

## Phase 3: the KS3's upper 2 MB in the IDE — **DONE**

**As built (2026-11-13):**

- Partitions **256-511**, labelled **`U00`-`UFF`**, described "Upper RAM page $nn (physical $2nnn00)" and
  grouped "Upper RAM" (`nextMachineInfo.ts`, `NEXT_UPPER_PARTITION_BASE`; a `NextPartitionOptions.upperRam`
  flag), offered only when the model's board is the KS3 (`ZxNextWasmHost.partitionOptions`). A separate
  range, not 224-479: 224 is the history context's "no partition", and the RAM pages keep their two-digit
  names. `parsePartitionLabel` accepts `U00`-`UFF` on the KS3 only.
- `ZxNextWasmV2Machine.getMemoryPartition` reads them at physical + `$2000` (after the error page), so the
  memory view shows and edits them (`writeMemoryPartition` writes the same array).
- `BankDropdown` draws each captioned bank block with its caption beside its first row and starts each block
  on a fresh row; arrow keys move over the same rows. The memory view, the disassembly toolbar and the
  breakpoint dialog all get the upper pages through the one partition model (a breakpoint there never fires:
  no MMU page maps it).
- Profiler and NEX validation unchanged, as planned. The captions follow the existing untranslated
  partition captions ("RAM Banks", "DivMMC RAM"): hardware area names.
- Tests: `test/zxnext-shared/nextMachineInfo.test.ts` (labels per model, round trip, 224 free),
  `test/controls/PartitionPicker.test.tsx` (two captioned blocks, a block on a fresh row; fails on the old
  chooser), `DDMA-003` (the IDE reads the DMA's bytes at `$290000` as `U48` and its write lands in the SRAM).
- Not checked in the running app: the chooser's look with 480 bank cells (only in jsdom).

The original steps:

The core keeps it after the error page (offset = physical + `$2000`, `zxnextSramOffset`); nothing in the IDE
reads that block.

1. **Partitions**: give the upper 2 MB partition numbers (8K pages 224-479 continue the RAM pages' numbering,
   or a separate range: decide, and keep `zxnextPartitionOfPage` and `nextMemoryLayout.ts` the one source).
2. **Memory panel and bank pickers** (`BankDropdown.tsx`, `PartitionPicker.tsx`, `nextMachineInfo.ts`'s
   `0..223` loops, `ZxNextWasmV2Machine.ts:1493`): offer the extra pages on a KS3 model only, read through the
   physical offset. The CPU can never page them, so they are view and edit only.
3. **Export/inspect views that list physical memory** (the NEX viewer's validation, `nexValidation.ts`):
   unchanged, since a NEX cannot load there.
4. **Profiler**: unchanged on purpose (D-G of the 3.03 plan: the upper block is never profiled), stated in
   its docs.
5. Tests: renderer/model tests for the panel's page list per model; a harness test reading a byte the DMA
   wrote at `$300000` through the IDE's memory API.
6. `dev/ai/ui-theming-intent-and-lessons.md` only if a visual change is made; i18n keys for new labels.

## Phase 4: firmware-level features (a decision first) — **NOT STARTED** (waits on the author's decision)

Klive starts the Next **after** its firmware: the host loads the ROMs and sets the post-firmware register
values (`zxnext-nextreg.c`, hard reset). So firmware 1.46's features (the boot INFO screen, 60 Hz per
personality, the test card mode, the updater, more personalities) are not missing pieces of the 3.03 models;
they belong to a firmware stage Klive has never had. Options:

- **A. Keep starting after the firmware** (recommended). Take over only what a program can observe after
  boot and Klive gets wrong. Candidates: the per-personality 50/60 Hz choice (NextReg `$05` bit 2 after
  boot) if a model or project setting wants it. Each is a small change with a test.
- **B. Run the real firmware**: boot the anti-brick core's boot ROM, load `TBBLUE.FW` from the card, run its
  boot module in config mode, let it load the ROMs and start NextZXOS. Faithful, but a project of its own
  (flash emulation for the core slots, `config.ini`, the boot ROM of 3.03, which is not published), and it
  makes every start slower.
- **C. Nothing.**

The project author decides before any work here.

## Phase 5: close the research items — **NOT STARTED** (research)

1. Replay the guide's other measured examples in Klive as in R1 (sprites, lemmings, windows, FLIP/PULSE) and
   the 2-cycle timing claim; record each match or mismatch. A mismatch is a core fix with a test.
2. Ask (forum or the core's author) for the three answers no source gives: the 2D byte counter's read-back,
   NextReg `$12`/`$13`'s width on the KS3, and bank 5 / page `$0E` reads at 28 MHz on 3.03.
3. When the core 3.03 VHDL is published, phase 7 of `ZXNEXT_3_03_PLAN.md` takes over (pin, classify, check
   every `VHDL-PENDING(3.03.03)`).

## Order and size

Phase 1 is research only and unblocks phase 2. Phases 2 and 3 are independent of each other (different
files: main process and SD menus vs memory panels), and each is a change of its own with a `feature`
changeset. Phase 4 starts with the author's decision. Phase 5 can run any time; its findings go to the note
and, where they change Klive, to a `fix` changeset.
