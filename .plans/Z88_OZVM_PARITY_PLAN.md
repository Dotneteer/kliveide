# Z88 ↔ OZvm Parity Plan

Status: **implemented** (2026-10-04), with the decisions of §9. §10 records what was done and what
was deliberately left out. The core's `README.md` ("Brought to OZvm's behaviour") is the durable
summary.

## 0. Background and sources

What prompted this:

- **User feedback (Gunther Strube, OZ author):** Klive's LCD shows "noise" under OZ v5 at the new
  resolutions, while OZvm does not. Two screen recordings compare the two emulators running
  OZ v5.0 on a 640x320 LCD with 512K RAM and a 512K AMD flash card.
  - In Klive, garbage cells appear in text rows 8, 9 and 11, under a clean PipeDream top area.
  - In OZvm the same screen is clean, apart from a short burst at boot while OZ is still setting
    up SBF.
- **Issue #1417** (https://github.com/Dotneteer/kliveide/issues/1417):
  - Rename the IDE's "SBR" to **SBF** (Screen Base File).
  - Show the decoded 24-bit address (bank + offset) next to the raw 16-bit value of SBF and
    PB0–PB3, as OZvm does: `SBF (Screen Base File): 0127h (243800h)`.
- **Parity check against OZvm:** https://gitlab.com/b4works/ozvm, commit `9e15b4c` (2026-10-04),
  read for behaviour only. OZvm is GPL-2, so no code is copied; Klive's renderer was already its
  own port.
  - Main OZvm files: `Z88Lcd.java`, `BlinkLcd.java`, `Blink.java`, `BlinkRtc.java`,
    `Z80Processor.java` (port decode), `Memory.java`, `Bank.java`, `IntelFlashBank.java`,
    `GenericAmdFlashBank.java`, `Z88.java`, `Z88Info.java` (debug text).

Klive files touched by this plan:

- C core: `src/emu/machines/z88/wasm/z88/` (`z88-screen.c`, `z88-blink.c`, `z88-keyboard.c`,
  `z88-memory.c`, `z88-cards.c`, `z88.c`). Read its `README.md` first.
- Rebuild the core with `npm run build:z88-wasm`.
- Host side: `Z88WasmV2Machine.ts`, `Z88WasmHost.ts`, `z88MachineInfo.ts`, `z88CardCatalog.ts`,
  `src/renderer/appEmu/machines/z88Cards.ts`.
- IDE panels: `src/renderer/appIde/SideBarPanels/BlinkPanel.tsx`,
  `src/renderer/appIde/DocumentPanels/Z88/Z88SnapshotViewerPanel.tsx`.

Test rules:

- Z88 tests live in `test/z88/` and `test/wasm/z88/`.
- Any new test that runs the core goes into `build/e2e-tests.ts`.
- Goldens under `test/wasm/z88/goldens` are re-recorded only after the picture has been checked
  by eye.

Severity legend: **B** = bug users can see, **P** = parity gap, **C** = cosmetic or debugging aid,
**K** = Klive is deliberately different or better (keep it, document it).

---

## 1. Root cause of the LCD noise (verified)

OZ v5 puts a larger SBF at the **top of a 16K bank**. In the recording, SBF `0127h` decodes to bank
`$24`, offset `$3800`. A 40-row screen file is 40 × 256 = 10K, so only rows 0–7 fit between `$3800`
and `$3FFF`.

- **OZvm:** wraps rows 8+ round to offset `$0000` of the **same** bank.
  - `Z88Lcd.renderEnabledScreenFrame` reads `memory.getByte(sbr + rowOffset + i, bankSbr)`.
  - `Bank.getByte` falls back to `bankMem[addr & 0x3FFF]` when the offset passes the end of the
    bank.
  - `BlinkLcd.getSbrAddress` documents the rule: "The location of the SBF is always from top of
    bank, downwards."
- **Klive:** `z88DrawScreen` builds one linear physical address (`sbr | bank << 14`) and adds 256
  per row. Rows 8+ are therefore read from bank `$25`, which holds unrelated RAM and shows up as
  the noise.

There are two more differences in the same read path:

- `z88ScreenRead` indexes `z88Memory[]` physically. It ignores card mirroring (the chip mask of a
  card smaller than its slot, or internal RAM smaller than 512K) and empty-slot reads. OZvm goes
  through `getBank(n)`, which honours both.
- OZvm treats the LCD as off until `COM.LCDON` is set **and** SBF and PB0–PB3 are all non-zero
  (`Z88Lcd.isLcdEnabledAndBound`). Klive draws as soon as LCDON is set. That is the likely source of
  the stray glyphs on the "HARD RESET" screen.

---

## Phase 1 — LCD rendering parity (fixes the reported noise) · B

1. **Wrap SBF rows inside their bank.**
   - Keep the SBF bank and the 14-bit offset separate.
   - Row `r`, cell `c` reads `bank:((sbfOffset + r*rowWidth + c*2) & 0x3FFF)`.
   - Apply the same `& 0x3FFF` wrap to font reads (PB0–PB3 + row), for consistency with OZvm.
2. **Read screen memory through the bank map, not raw physical memory.**
   - Add a side-effect-free `z88PeekBank(bank, offset)` to `z88-memory.c`. It uses
     `z88BankOffset()` so mirroring is honoured, ignores the flash command state, and returns
     `$FF` for an empty slot.
   - The empty-slot value must not advance the floating-bus LFSR (see Phase 5.6).
   - Use it for every SBF and font read in `z88-screen.c`. Remove the physical-address comment
     ("Reads beyond the 4 MB read 0").
3. **Pointer gate.**
   - Paint the LCD-off/blank frame until SBF, PB0, PB1, PB2 and PB3 are all non-zero.
   - Decide with the user: OZvm paints the unlit-green colour (`PXCOLOFF`) here, not the grey
     "LCD off" colour. Match OZvm's choice, so OZ's boot-time partial setup is never drawn.
4. **800-pixel row width (prepare only).** When `SCW` = 100, OZvm uses a 272-byte row stride
   (108 + 28 cells + terminator). Klive always uses 256.
   - Make the stride a function of the width: 256 for 640 pixels, 272 for 800.
   - Klive's menu offers no 800-pixel LCD today. Add it later if the user wants it (see §9).
5. **Tests** (in `test/z88/z88-lcd.test.ts`, e2e tier):
   - SBF at offset `$3800` with SCH=40: row 8 must render from offset `$0000` of the same bank.
   - Fill the next bank with a sentinel and assert it never appears.
   - A 128K internal RAM machine with SBF pointing into a mirrored bank (`$28` → `$20`) renders the
     mirrored content.
   - Pointer gate: LCDON with SBF=0 renders blank.
   - Boot OZ 5.0 (`z88v50b.rom`) at 640x320 and 640x480 and compare against a golden checked by
     eye. Confirm rows 8+ are clean after the boot burst.
6. Update the `z88-screen.c` header comment and the wasm `README.md` (screen section).

## Phase 2 — Issue #1417: SBF naming and 24-bit pointers in the IDE · C

1. **Rename the label.**
   - In `BlinkPanel.tsx` and `Z88SnapshotViewerPanel.tsx`, rename `SBR` to `SBF`.
   - Tooltip: "Screen Base File - 2K (or larger on big LCDs) of character/attribute pairs".
2. **Rename the identifiers.**
   - Rename `SBR` to `SBF` in `BlinkState` (`src/common/messaging/EmuApi.ts`) and in
     `Z88WasmV2Machine.getBlinkState()`.
   - Rename the WASM exports `z88GetSbr`/`z88SetSbr` to `z88GetSbf`/`z88SetSbf`, and update
     `Z88WasmV2Loader.ts`.
   - Update the tests (`z88-host.test.ts`, `z88-lcd.test.ts`, `z88-snapshot-load.test.ts`,
     `wasm-z88-parity.test.ts`).
   - **Keep the `.z88` snapshot property key `"SBR"`.** OZvm's `SaveRestoreVM` still reads and
     writes `SBR`. Only the in-memory field in `z88Snapshot.ts` may be renamed (`sbr` → `sbf`).
3. **Shared decoder.**
   - Add `z88ScreenPointers.ts` in `src/common/z88/`, exporting `sbfAddress`, `pb0Address` …
     `pb3Address`, each returning `{ bank, offset, ext24 }`.
   - Use the same formulas as `BlinkLcd`:
     - SBF / PB3: 11 bits, value `<< 11`.
     - PB0: 13 bits, value `<< 9`.
     - PB1: 10 bits, value `<< 12`.
     - PB2: 9 bits, value `<< 13`.
   - Bank = `ext >> 14`, offset = `ext & $3FFF`. The display form is `BBOOOO`.
   - Unit-test the decoder against the values in the issue screenshot:
     - SBF `0127h` → `243800h`
     - PB0 `0434h` → `212800h`
     - PB1 `000Dh` → `031000h`
     - PB2 `004Dh` → `262000h`
     - PB3 `0137h` → `263800h`
   - Make the C renderer's address math match it (it already does), and test both against the
     same table.
4. **Display.**
   - In each SBF/PB row, show the raw value followed by the 24-bit pointer, e.g. `$0127  $24:3800`.
     Bank:offset is easiest to read; confirm the format with the user.
   - Tooltip: the decoded size (SBF = SCH × 256 bytes, so 2K at 64 lines and 10K at 320).
   - Follow the panel rules: columns in `ch` and token colours (`--color-state-value`).
5. **Optional follow-up: jump to the address.** If time allows, a click on the 24-bit value opens
   the memory view at that bank and offset. This is what the issue's motivation ("take a look with
   a memory viewer") is about.
6. Update `.ai/ui-theming-intent-and-lessons.md` if the row layout introduces a new pattern
   (a standing rule for any visual change).

## Phase 3 — Card lifecycle bugs (data loss) · B

Both bugs below were verified in the source.

1. **Changing one slot wipes the other slots' flash/EPROM.**
   - `applyCardStateChange` calls `machine.configure()`. That re-inserts slots 1–3, and every
     insert runs `z88CardInserted`, which sets EPROM and flash back to `$FF`.
   - Fix: `configureSlot` skips a slot whose `cardType`, `size` and `file` are unchanged.
   - Also split "insert a new card" (erase) from "keep the present card" in the host.
   - Test: program a byte into the slot-1 flash, insert a RAM card in slot 2, and check the byte is
     still there.
2. **Hard reset handles the wrong cards.**
   - OZvm `hardReset` zeroes **all RAM banks**, including RAM cards in slots 1–3, and leaves
     EPROM/flash alone.
   - Klive zeroes only internal RAM. It then re-runs `setup()`, which re-inserts every card, so
     flash goes back to its file image or to blank while RAM cards keep their contents.
   - Fix:
     - `z88HardReset` zeroes RAM-kind cards.
     - The reset path no longer re-inserts unchanged cards.
     - Correct the misleading z88.c comment ("a flash card's data survives a power cycle").
3. **A new RAM card shows the previous card's bytes.** Zero a RAM card's range when it is inserted
   without contents.
4. **Sector erase through a mirror bank.**
   - `z88CardEraseSector` uses `bank & 0x3C` with no chip mask, so on a 512K flash card in a 1M slot
     an erase addressed through the upper mirror clears memory beyond the card.
   - Fix: use `(bank & chipMask) & 0x3C`.
   - The README records the current behaviour as deliberate parity with the old TypeScript machine.
     That reason is gone now; update the README and re-record the affected goldens.
5. **Intel autoselect.**
   - Test `(bank & chipMask) == 0` instead of the absolute bank.
   - Mask the offset with `0x3FFF`, not `0x1FFF`, so the ID does not show up again at `$2000`.

## Phase 4 — Blink, reset and interrupt correctness · B/P

Do these one at a time, each with a focused test in `test/z88/`. The OZvm references are from the
parity check; re-read them before each change.

1. **Soft reset (the reset button) should keep the Blink.**
   - OZvm `pressResetButton()` resets only the Z80. COM, SR0–3, INT/STA, TIM0–4, TSTA, TMK, EPR and
     the LCD pointers all survive. Klive's `z88Reset` runs `z88BlinkReset()`, so OZ's clock loses
     the uptime.
   - Add a soft-reset path that keeps at least the RTC (TIM0–4, TSTA, TMK).
   - **Decide with the user** whether COM/SR/INT also survive, as in OZvm. Gunther knows what the
     hardware does.
2. **COM/memory mapping after reset.**
   - `z88BlinkReset` pages SR0 using the COM from before the reset, then clears COM.
   - Whichever reset model is chosen, re-page SR0 after COM changes, so RAMS and the mapping always
     agree.
3. **Stale interrupt line.**
   - `z88BlinkReset` clears STA after `z88BlinkSetInt` has re-evaluated the line.
   - Call `z88CheckMaskableInterrupt()` after clearing STA.
4. **RESTIM.**
   - OZvm resets only TIM0–4 (on the edge, and while RESTIM is held). Klive also clears TSTA, which
     can leave STA.TIME pending while TSTA reads 0.
   - Keep TSTA, or drop STA.TIME together with it.
5. **Key interrupt on release.**
   - `z88SetKeyStatus` can raise STA.KEY again when a key is released while others are held.
   - Raise it only on a press, as OZvm's `signalKeyPressed` does.
6. **Battery low** should wake a snoozing CPU (`z80AwakeCpu()`), as OZvm's `signalBattLow` does.
7. **Coma (optional, P).**
   - OZvm leaves Coma on any wake. A key pressed in Coma forces `INT |= KEY|GINT` and sets STA.KEY.
   - Klive has no Coma state, and HALT ends only on an accepted interrupt.
   - OZ 4.7/5.0 work today (`z88-timeout-coma.test.ts`). Implement the forced INT.KEY in the key
     path only if a program is found that depends on it.
8. **Hard reset memory:** handled in Phase 3.2.

## Phase 5 — Smaller parity gaps · P/C

1. **SCW read-back.** OZvm reads `$50` (80) for 640 pixels; Klive reads `$FF`. OZ accepts both.
   - **Decide with the user:** keep `$FF` for the original 640x64 Z88 (real hardware value) and
     return 80 for the larger 640-wide LCDs, matching OZvm?
   - Also restrict SCH to 8/32/40/60, as OZvm does.
2. **Resolution change ⇒ hard reset.**
   - OZvm hard-resets after the LCD size changes, because OZ v5 allocates SBF at boot.
   - Check that Klive's `z88_lcd` menu (`setMachineType`) always ends in a cold start. If it does
     not, the old 2K SBF is shown on a taller LCD, which is more noise.
3. **Slot-0 512K ROM as AMD flash.**
   - OZvm loads a 512K slot-0 image as AMD flash, so OZ 4.5+/5.0 RomUpdate and the slot-0 file area
     work. Klive always makes it read-only ROM.
   - Map a 512K default image to `AMD_FLASH_29F040B`. Make it an option if read-only ROM is still
     wanted.
4. **Slot-0 ROM validation.**
   - Reject images over 512K. A 1M image currently writes over internal RAM at `$080000`.
   - Also reject sizes that are not a whole number of 16K banks.
5. **UART TXD → IDE output (C).** OZvm echoes port `$E3` writes to a message panel. Routing them to
   the Klive output pane helps when debugging OZ v5 builds.
6. **Side-effect-free peek.**
   - Debugger and memory-view reads of empty banks advance the floating-bus LFSR, so looking at
     memory changes what the CPU reads next.
   - Use the Phase 1.2 peek for `z88ReadMemory` and `COND_PEEK`.
7. **A blank ROM card reads `$00`.** Fill new ROM cards with `$FF`, as OZvm's `RomBank` does.
8. **More flash chips (optional).** OZvm supports these; Klive builds only 29F040B/080B and
   28F004S5/008S5:
   - STM 29F040B/080D
   - SST39FS040 (4K sectors)
   - Macronix
   - AMIC
   - AM29F010
   - Intel 28F008SA (needs slot 3 and VPPON)
   - Hybrid RAM + flash cards

   Wait for a user request before adding any of them.

## 6. Deliberate differences to keep (document only)

Record each of these in the wasm `README.md`, so the next parity check does not re-raise them:

- **Flash command state** is held per chip (per slot) in Klive. OZvm holds it per bank (Intel) or
  in shared static state (AMD). Klive is closer to the hardware.
- **UV EPROM programming** is allowed only in slot 3, which is where the hardware supplies VPP.
- **Undefined ports** read `$FF` (OZvm returns 0).
- **The RTC follows emulated time**, so it is deterministic and advances while stepping. OZvm uses
  a wall-clock timer, frozen while single-stepping.
- **Interrupt enable rule**: STA.TIME is gated by INT.TIME (F1). TSTA and SEC|MIN are ORed together
  (#1374).
  - Also correct the misleading "TSTA latches whatever TMK enables" comment in `z88-blink.c`.
- **KWAIT keyboard read** with a key held returns the matrix immediately.
- **Beeper:** 3200 Hz is a square wave rather than OZvm's sine, and a DC filter replaces OZvm's
  100 ms SBIT silence.

## 7. Order and size

| # | Phase | Why first | Size |
|---|-------|-----------|------|
| 1 | LCD rendering (Phase 1) | The user-reported noise | S–M |
| 2 | #1417 IDE (Phase 2) | Open issue; helps verify Phase 1 by hand | S |
| 3 | Card lifecycle (Phase 3) | Silent data loss | M |
| 4 | Blink/reset (Phase 4) | Correctness; some items need user decisions | M |
| 5 | Remaining (Phase 5) | Polish | S each |

Each phase is one reviewable change. For each:

- Run the focused tests (`npm test -- test/z88/<file>`), then `npm run test:e2e` for the core
  tiers.
- Run `npm run build:check`, and also `npm run lint:renderer` for Phase 2.
- Run `npm run check:z88-wasm-size` after core changes.

## 8. Verification in the running app

After Phase 1, reproduce the user's setup:

- OZ 5.0 at 640x320, 512K RAM, a 512K AMD flash card in slot 1.
- Open PipeDream and type a few lines.

Then confirm:

- Rows 8+ stay clean.
- The IDE Blink panel shows `SBF $0127 ($24:3800)` or whatever OZ allocated.
- The memory view at that bank shows the screen file wrapping at `$3FFF` → `$0000`.

Ask Gunther to re-check with his recordings.

## 9. Decisions (the author, 2026-10-04)

1. Pointer-gate colour: **Klive's grey** "LCD off" colour while SBF or a PB register is unset.
2. Soft reset: **follow OZvm** - the reset button resets the CPU only; the whole Blink survives.
3. SCW on the larger 640-wide LCDs: **follow OZvm** - 80. The original 640x64 LCD keeps $FF (what the
   real Blink, which has no SCW, reads).
4. 800-pixel LCD widths: **no**. The core accepts only SCW $FF/80 and SCH 8/32/40/60; the pixel
   buffer is 640x480 now, and the 272-byte row stride of Phase 1.4 was not added.
5. The 24-bit pointer's format: **follow OZvm** - `0127h (243800h)`: Klive's `$0127` raw value, then
   `(243800h)`.

## 10. Implementation record

Done:

- **Phase 1.1-1.3, 1.5, 1.6** - `z88-screen.c` reads every SBF and font byte through `z88PeekBank`
  (bank map, offset wrapped inside the bank, $FF for an empty slot, no side effect) and paints the
  LCD off until SBF and PB0-PB3 are set. Tests: `test/z88/z88-lcd.test.ts` (the wrap at SBF $3800 on
  a 40-row LCD, a mirrored 32K card, the pointer gate for each register).
- **Phase 2** - `SBR` became `SBF` in `BlinkState`, the WASM exports (`z88GetSbf`/`z88SetSbf`), the
  Blink panel, the snapshot viewer and the `.z88` snapshot model (`sbf`, still read from the file key
  `"SBR"`). `@common/z88/z88ScreenPointers` decodes SBF/PB0-PB3; both panels show `(243800h)` after
  the raw value. Test: `test/z88/z88-screen-pointers.test.ts` (the issue's screenshot values).
  `.ai/ui-theming-intent-and-lessons.md` records the display rule.
- **Phase 3** - `Z88WasmHost.slotSources`: a card whose type, size and image file are unchanged is not
  inserted again (by `configure()` or the hard reset's `setup()`); a snapshot's cards are adopted
  (`adoptConfiguredSlots`). `z88HardReset` clears RAM cards; a new card is zeroed (RAM) or $FF; the
  sector erase and the Intel ID read go through the chip mask. Tests: `wasm-z88-machine.test.ts`,
  `z88-ozvm-parity.test.ts`, `z88-snapshot-load.test.ts`.
- **Phase 4.1-4.6** - `z88BlinkPowerOn` (power-on only; COM first, interrupt line last), the reset
  button keeps the Blink, RESTIM keeps TSTA, STA.KEY only on a key going down, battery low wakes the
  CPU. The host calls `z88ResetBlink` for a newly loaded core and before a `.z88` snapshot load.
- **Phase 5.1, 5.3, 5.4, 5.5, 5.6, 5.7** - SCW 80 / SCH restricted; a 512K slot-0 ROM image is an AMD
  29F040B and a longer one is refused; TXD bytes reach the emulator output (`Z88UartTxLines`,
  `[Z88 serial] ...` lines); `z88PeekMemory` for the IDE and `COND_PEEK`; a blank ROM card is $FF.
- **Phase 5.2** - verified by reading: the `z88_lcd` menu changes the machine type
  (`setMachineType`), which builds a new machine, so OZ always cold-boots on a new LCD size.
- **Goldens** re-recorded after the diff was traced entry by entry (see `test/z88/README.md`).

Left out, as the plan said:

- **Phase 1.4** (800-pixel row stride) - decision 4.
- **Phase 2.5** (click the 24-bit value to open the memory view) - optional; the panel shows the
  address in the form the memory view takes.
- **Phase 4.7** (Coma's forced INT.KEY wake) - no program found that needs it; OZ 4.7/5.0 time out
  and wake today (`z88-timeout-coma.test.ts`).
- **Phase 5.8** (more flash chip types) - waits for a user request.

Found while verifying: the bundled `z88v50b.rom` (byte-identical to OZvm's `Z88V50B.rom`) never reads
SCW/SCH and keeps the 2K Screen Base File (SBF $010F) on every LCD size, so on 640x256/320/480 it
draws only 8 rows and whatever lies in the rest of the bank below them - in OZvm too. The clean
40-row PipeDream of the recordings needs the newer OZ 5 build that allocates the larger SBF
($0127, $24:3800); the wrap of Phase 1.1 is what that build relies on.
