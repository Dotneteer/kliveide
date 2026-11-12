# ZX Spectrum Next core 3.03.00 models (KS2 and KS3)

Status: **open** (started 2026-11-12). Phases 1-6 are done (2026-11-12, `npm run test:slow` passed); phase 7 waits for the 3.03.00 VHDL. Read `dev/ai/zxnext-models.md` first: this plan follows its
"Adding a model" steps and its decisions D1-D9, and says where it has to depart from them.

## Goal

Two new Next models that boot the distribution's 26.11 release (`gitlab.com/thesmog358/tbblue`,
`master` at `3a892b03738cfb27eee01f33d09186d3215a5a4a`, 2026-11-08: core 3.03.00 "28MHz 0 WS -
zxnDDMA", TBBLUE.FW 1.46, NextZXOS 2.10):

| Model id | Board | `g_board_issue` | Core | Artifact |
|---|---|---|---|---|
| `ks2-30300` | KS2 (Issue 4 PCB) | 2 | 3.03.00 | `zx-spectrum-next-ks2-30300.wasm` |
| `ks3-30300` | KS3 (Issue 5 PCB) | 3 | 3.03.00 | `zx-spectrum-next-ks3-30300.wasm` |

## What is known, and from where

- **The 3.03.00 VHDL is not public.** The FPGA repository's newest branch is `30205`
  (`git ls-remote`, 2026-11-12). D4's rule (the VHDL is the reference) cannot be met for the 3.03
  delta yet; see D-A below.
- **The KS3 board is public VHDL already**: 3.02.04 has `zxnext_top_issue5.vhd` and
  `g_board_issue >= 3` branches in `zxnext.vhd`. What it shows (`zxnext.vhd@3.02.04`):
  - `g_board_issue` is `X"3"` for issue 5 (`zxnext_top_issue5.vhd@3.02.04 ~39`), read by NextReg
    `$0F` (`~6455`).
  - SRAM is an IS61WV204816 (4 MB). `o_RAM_A_ADDR_21 <= sram_addr(21)` only on issue 5; on 2-4 it is
    `'0'` (`~1763-1777`), so bit 21 is dropped there and addresses wrap at 2 MB.
  - The MMU still reaches 8K pages 0-223 only: `mmu_A21_A13 = ("0001" + page(7:5)) & page(4:0)`, and
    bit 8 set (pages `$E0-$FF`) means no SRAM (`~3258`, `~3331`). The same holds for Layer 2 (`~3265`).
  - NextReg `$04` (config-mode ROM/RAM bank) keeps all 8 bits on issue 5 and 7 bits on 2-4
    (`~6218-6246`), so in config mode the CPU can see the whole 4 MB, 16K at a time.
  - The +3 FDC signals go to the expansion bus on issue 5 only (`~1818-1834`).
  - The rest of the issue 5 top file (PLL, HDMI, pins) is classified in phase 3.
- **The zxnDDMA is documented by the distribution**: `docs/zxnDDMA/zxnddma.gde` (7990 lines, core
  3.03.00, issues 2, 4, 5; many facts marked as checked on real boards in October 2026) and its
  example listings. It names `cores/zxnext/src/device/new_dma.vhd`, which is not published.
- **"28MHz 0 WS"** is one line in the distribution's `CHANGELOG`. Nothing says which wait states went.
- **The ROMs are new bytes.** All five NextZXOS ROMs differ from the committed `nextzxos-2.10` set
  (which came from the `KS3` branch at `b7cc7d34`), though both call themselves NextZXOS 2.10.
- **The FPGA boot ROM** (`bootrom_ab.bin`) is built from `src/rom/bootrom_ab.vhd`, which is not
  public for 3.03.

## Decisions

- **D-A - Build the 3.03 delta from the distribution's documents, marked as such.** Every behaviour
  that exists only in 3.03 is guarded by `#if ZXNEXT_CORE_VERSION >= 30300` and cites the guide
  (`zxnddma.gde@26.11 §2.5`), not VHDL. Each such guard carries `VHDL-PENDING(3.03.00)`, so the
  whole set can be found and checked once the VHDL is published (phase 7). The guide is read for
  interface facts and written in Klive's own words; its listings are not copied into the repository.
- **D-B - Board facts come from VHDL 3.02.04.** The KS3 behaviour (phase 3) is guarded by
  `ZXNEXT_BOARD_ISSUE >= 3` and cites `zxnext.vhd@3.02.04`, as D4 requires. Profiles name
  `vhdlRef: "3.02.04"` until 3.03.00 is pinned; the 3.03 items are listed in this plan instead.
- **D-C - One new ROM set, `nextzxos-26.11`**, named after the distribution release because the
  NextZXOS version did not change (D9.1: a newer release is a new set with a new name). Pinned to
  commit `3a892b03`. Both new models use it.
- **D-D - Boot ROM.** The new set has no `fpgaRoms`: 3.03's `bootrom_ab.vhd` is not published, and
  the boot ROM is only shipped for annotation (the cores do not load it). A copy of 3.02.04's would be
  the same bytes, which the ROM identity table already names by the 2.10 set (first entry wins).
- **D-E - 28 MHz zero wait states is not modelled** until the VHDL (or a measurement on a real 3.03
  board) says which waits went. At 28 MHz the new models time like 3.02.04. Recorded under "Open".
- **D-F - The new-project default stays `ks2-30204`** (D7) while the 3.03 models rest on unverified
  documents. Revisit in phase 7.
- **D-G - Memory size is a board fact.** The KS3 artifact's memory array is 4 MB plus the error page,
  the upper 2 MB placed *after* the error page (offset = physical + $2000, `zxnextSramOffset`), so every
  offset below $202000 (the error page, the partitions, the profiler's flags) is the same on every
  board and the IDE's layout needs no board. The KS2 artifacts keep 2 MB, so their state images are
  unchanged. The IDE does not show the upper 2 MB yet (Open).

## Phases

1. **ROM set.** `npm run next-roms:fetch -- nextzxos-26.11 --ref 3a892b03...`; `fpgaRoms` as D-D;
   facts (key-wait loop, HALT, LD-BYTES) read from the bytes and proved by `rom-facts.test.ts`; the ROM
   decoder's inline-data addresses; `npm run next-sd:build -- nextzxos-26.11`; sidecars carried with
   `npm run rom:annotations:carry` (D8), review lists in `dev/ai/rom-annotations/carry-review/`,
   `PROVENANCE.md` appended.
2. **Profiles.** `NextProfileId` and `NEXT_PROFILES` (both models), the two artifacts in
   `dev/scripts/zxnext-artifacts.cjs`, NextReg set `30300` (the 30204 set plus any documented change;
   `$0F`'s description names issue 5), the registry (models list), the SD working copies
   `ks2-30300.cim` / `ks3-30300.cim`, the NEX minimum-core check. Each model boots its card into
   NextZXOS's waiting loop (`nextzxos-boot.test.ts`).
3. **KS3 board** (`ZXNEXT_BOARD_ISSUE >= 3`, VHDL 3.02.04): the memory size (D-G), `$0F` = 3,
   NextReg `$04` with 8 bits in config mode, the FDC expansion-bus signals as far as Klive models the
   expansion bus, and a classification of `zxnext_top_issue5.vhd` against `zxnext_top_issue4.vhd`
   (video timing, audio, anything else a program can see) in `dev/ai/zxnext-cores/ks2-to-ks3.md`.
   IDE: memory and bank views that assume 2 MB (`nextMachineInfo.ts`, `ZxNextWasmV2Machine.ts`,
   `nexValidation.ts`, the bank pickers) learn the profile's size. Harness tests on every profile.
4. **zxnDDMA** (`ZXNEXT_CORE_VERSION >= 30300`, D-A), in `zxnext-dma.c`, from the guide's Part 2:
   - port `$6B` only: `$D7`/`$DB` (address bits 23:16), `$DF` mode flags (physical, 2D, transparent,
     fill, Layer 2 X,Y with `$70` modes, hidden screen with `$13`) and its follow bytes; the 2D
     row length, row count and strides; `$F3` transparent value; `$F7` fill value;
   - on `$0B`, and on cores before 3.03, the command byte is dropped and its follow bytes are taken as
     ordinary register writes (§2.5);
   - physical mode: 22 bits, bit 21 dropped on boards before issue 5 (D-B), SRAM only (never the
     BRAM banks 5 and 7), carry and borrow across 64K (§2.9 note 7), on until `$DF`/`$C3`;
   - block length on `$6B` (N moves N bytes, `$0000` moves 1) and fill's no-read cycle;
   - hardware IM2 holding the DMA back (§2.9 note 10);
   - timing: the guide's measured figures where it gives them, otherwise the 3.02.04 per-byte cost,
     listed under "Open".
   Scripted harness tests in `test/zxnext-hw/dma/` on every profile: the 3.02 profiles prove the
   commands are ignored (their follow bytes as register writes), the 3.03 profiles prove each feature,
   KS2 vs KS3 prove the bit 21 wrap.
5. **IDE and docs.** The models page (`docs/content/en/guides/next/next-models.mdx`), the KS3's
   memory in the Next Memory Mapping panel, `npm run i18n:keys` if text was added,
   `dev/ai/zxnext-models.md` (profiles table, as-built notes, open items), the
   competitive-analysis tables if a gap closes, a `feature` changeset for the whole plan.
6. **Checks.** Focused tests, `npm run build:check`, `npm run lint:renderer`, the Vite build,
   `npm run test:slow` before closing.
7. **When the 3.03.00 VHDL is published.** Pin it in `sources.json`, fetch, carry the comments,
   classify the delta (`dev/ai/zxnext-cores/30204-to-30300.md`), check every `VHDL-PENDING(3.03.00)`
   guard against it, set `vhdlRef` to `3.03.00`, model "28MHz 0 WS" (D-E), reconsider D-F.

## As built (2026-11-12)

- ROM set `nextzxos-26.11` is NextZXOS 2.10a. All five ROMs changed in place (see
  `dev/ai/rom-annotations/PROVENANCE.md`, 2026-11-12); the ROM facts and the decoder's inline-data
  addresses are 2.10's. The card leaves out `extras/nextest` (`sdBaseImage.exclude`, GitHub's 100 MB
  limit). `next-roms:fetch -- --git` was added for GitLab's HTTP 429.
- The KS3 board: `ZXNEXT_SRAM_SIZE`, `ZXNEXT_NR_04_MASK` (`zxnext-profile.h`); the classification is
  `dev/ai/zxnext-cores/ks2-to-ks3.md`.
- The zxnDDMA is in `zxnext-dma.c` behind `ZXNEXT_CORE_VERSION >= 30300`; tests
  `test/zxnext-hw/dma/zxnddma.test.ts` (every profile for the physical copy and NextReg `$04`, the 3.03
  profiles for the rest). Choices where the guide is silent: a transparent byte still takes its write
  cycle; the byte counter counts every byte in 2D mode; the Layer 2 bank from `$12`/`$13` is 7 bits;
  the SRAM behind banks 5 and 7 is a separate 32K store only physical mode reaches.

## Open

- 28 MHz zero wait states (D-E).
- zxnDDMA timing beyond what the guide measured.
- The 3.03 boot ROM (D-D).
- Any NextReg added or changed in 3.03 that the guide does not mention.
- The choices listed under "As built" for the zxnDDMA.
- The IDE's memory views and the profiler do not show the KS3's upper 2 MB.
