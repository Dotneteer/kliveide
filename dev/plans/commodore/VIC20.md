# The VIC-20 core

Part of `COMMODORE_PLAN.md` (milestone M2, Phase 9). Research: `VIC20.md` (VIC20 §n), `DRIVE_1541.md`.
The simplest of the four machines: the VIC chip uses its own half of every cycle and never stalls the
CPU (VIC20 §9), so the core reuses the 6502, the VIA, the IEC bus, the 1540/1541, the tape module and the
debugger work of M1 almost unchanged.

## 1. Files
```
src/emu/machines/commodore/vic20/
  wasm/vic20/vic20.c          the TU (m6502 NMOS, two VIAs, iec, drive1541, cbm-tape)
  wasm/vic20/vic6561.c        video + sound of the 6560/6561
  wasm/vic20/vic20-memory.c   RAM blocks, ROMs, cartridge areas, the $9000-$9FFF decode, open bus
  Vic20WasmHost.ts, Vic20WasmV2Machine.ts, vic20Profiles.ts, Vic20KeyMappings.ts, Vic20Typer.ts
```

## 2. Models and configuration (VIC20 §1, §3)
- Profiles `vic20-pal` (6561, 1 108 405 Hz) and `vic20-ntsc` (6560, 1 022 727 Hz), VIC-1001 as a
  Japanese-ROM option of the NTSC profile.
- `MC_VIC20_RAM` (machine config, not a model): any combination of 3K ($0400), BLK1, BLK2, BLK3, BLK5,
  with presets "unexpanded", "+3K", "+8K", "+16K", "+24K", "+32K (+BLK5)". BLK5 write protect as an option
  (VIC20 OQ6). The configuration is part of the machine identity for state files and Run (VIC20 §9 item 4).
- The VIC sees only internal RAM and the character ROM; **expansion RAM, including the 3K block, is
  invisible to it** (the majority view, VIC20 §10; floooh disagrees): one constant.

## 3. The VIC 6560/6561 (VIC20 §2)
- **Master tick = one CPU cycle**; the VIC does one fetch per half cycle (matrix, then character) and emits
  4 dots per cycle (one character every two cycles).
- Screen origin/size registers, 8×8 and 8×16 characters, multicolour, reverse, auxiliary colour, the
  colour RAM nibble (upper nibble from the VIC's last fetch: open bus, VIC20 §9 item 5), interlace (NTSC), the
  raster register, the light pen, POT X/Y (VIC20 OQ4).
- Sync and blanking positions per model are constants (VIC20 OQ1: the MAME rewrite and Lance Ewing's
  die-shot schematic as references, the latter's licence first, OQ14).
- **Sound:** three square voices as shift registers (viznut's model) and the noise voice as the 16-bit
  shift register worked out from the die (VIC20 §2); the counter reload and noise clock disagreements
  (VIC20 §10) as constants. **CLK's noise table is not ported** (it is marked as taken from VICE).
- Palette: Klive's own (D15).

## 4. VIAs, input, tape, cartridges (VIC20 §4–§7)
- VIA1 ($9110): RESTORE → NMI, joystick bits, serial bus lines, tape motor/sense; VIA2 ($9120): keyboard
  matrix, joystick right, tape read on CA1, the jiffy IRQ from T1. The `$9000–$93FF` mirror decode as VICE's
  `via_mapping` and `vic_9000test` observe (VIC20 OQ8).
- IEC through `iec.c` with the VIC-20's inversions; the SRQ wiring (VIC20 OQ7).
- Tape through `cbm-tape.c` (VIC20 OQ9: one module if the pulse widths fit).
- Cartridges: `.prg` with load address $A000 (and the others for BLK1–3), raw binaries, VICE `.crt` for
  the VIC-20 (type IDs from VICE's documentation, facts only, VIC20 OQ12). Mega-Cart/Final Expansion are
  follow-ups.

## 5. Run and loading (VIC20 §6–§7, §9.6)
`src/common/commodore/codePlacement.ts` (shared with the others) knows the VIC-20 rules: BASIC start
$1001 unexpanded, $0401 with 3K only, $1201 with 8K or more (VIC20 OQ5 for 3K + BLK1), the screen moving
to $1000 when BLK1+ is fitted; inject after the READY landmark, fix the BASIC pointers, type `RUN` through
the keyboard buffer (addresses confirmed from the running ROM, VIC20 OQ11).

## 6. Tests
- Harness `test/harness/vic20/` (`bootToBasic(model, ram)`, the Klive test ROM bare machine); `test/vic20-hw/`:
  memory per RAM configuration, the $9000 decode, VIC timing and fetch, sound, VIAs, input, tape, cartridges.
- VICE testprogs `VIC20/` (fetched; pass list in the README); a 1540/1541 fast loader.
- Oracle: VICE xvic.

## 7. Open questions (one constant each)
| # | Question | Default | Research |
|---|---|---|---|
| V1 | Sync/blanking/burst positions | MAME rewrite + die-shot facts | VIC20 OQ1 |
| V2 | 3K block visible to the VIC | no | VIC20 §10 |
| V3 | Voice counter reload, noise clock | the die-shot model | VIC20 §10 |
| V4 | `$9000–$93FF` decode | VICE testprog observations | VIC20 OQ8 |
| V5 | POT timing | VICE paddle test observations | VIC20 OQ4 |
| V6 | KERNAL VIC init and jiffy latch per region | read from the running ROM | VIC20 OQ3 |
