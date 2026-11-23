# The C16 / C116 / Plus/4 core

Part of `COMMODORE_PLAN.md` (milestone M3, Phase 10). Research: `TED_C16_PLUS4.md` (TED §n),
`CPU_6502_FAMILY.md` §1.7 (the 7501/8501), `DRIVE_1541.md`. One machine ID, `c264` ("Commodore 16 /
Plus/4"), for the TED family.

## 1. Files
```
src/emu/machines/commodore/c264/
  wasm/c264/c264.c            the TU (m6502 7501 variant, iec, drive1541, cbm-tape, ACIA on the Plus/4)
  wasm/c264/ted.c             video, DMA, clock switching, timers, sound, keyboard latch
  wasm/c264/c264-memory.c     RAM sizes and mirrors, $FF3E/$FF3F, the $FDD0 bank latch, $FC00, the I/O area
  wasm/c264/acia6551.c        Plus/4 only
  C264WasmHost.ts, C264WasmV2Machine.ts, c264Profiles.ts, C264KeyMappings.ts, C264Typer.ts
```

## 2. Models (TED §1)
`plus4-pal` (default), `plus4-ntsc`, `c16-pal`, `c16-ntsc`, `c116-pal`. Profile fields: RAM (16/32/64K,
mirrored), 3-plus-1 ROMs and ACIA and user port (Plus/4), KERNAL revision, PAL/NTSC crystal. RAM
expansion of the C16 to 64K is a config option.

## 3. Time base: the changing CPU clock (TED §2, §7)
- **Master tick = half a TED single-clock cycle (4 dots).** The CPU gets a cycle every 2 ticks in the
  border/refresh windows and slow mode, every tick elsewhere in fast mode; the TED's rules decide per tick.
  PAL 886 724 / 1 773 447 Hz, NTSC 894 886 / 1 789 773 Hz.
- **DMA:** the TED halts the CPU for 40 cycles on two lines per character row, warning 3 cycles before
  (BA through the 6502 core's RDY, the C64's mechanism: one implementation, TED §7 item 2).
- **Timers and sound tick on absolute time** (single-clock and dot/32 boundaries), never on CPU cycles.
- **PAL/NTSC switch** by `$FF07` bit 6 at run time changes the line count; the crystal sets only the
  absolute clock (TED §7 item 5, OQ5).
- The debugger's cycle counter shows CPU cycles and the master tick separately (CPU_NEUTRAL_DEBUGGING.md §4).
- The drive is scheduled against dot time (DRIVE_1541.md §5).

## 4. The TED (TED §2)
- Character/bitmap/multicolour/extended modes, the 121-colour palette (16 hues × 8 luminances; Klive's own
  palette, D15), hardware cursor, flash, raster interrupts, scroll, the 38/40-column and 24/25-row windows
  (TED OQ2), the three 16-bit timers, two sound voices (square; voice 2 noise; TED §8 disagreement on the
  noise feedback as a constant), volume, the keyboard latch at `$FF08` (latched on write, TED §8), the
  memory paging bits, single/double clock bits, the light pen (TED OQ4).
- The refresh window disagreement (TED §8: 304–344 vs 288–328 vs 296–336) defaults to the emulators'
  296–336, one constant, settled by a timing test (TED OQ3).
- Reference: MAME's October 2026 cycle-exact `mos7360.cpp` (BSD-3, per-file check) and CLK's partial Plus/4
  (MIT) may be read and ported in named pieces (D1); YAPE, plus4emu, FPGATED facts-only.

## 5. Memory and I/O (TED §3–§4)
Three-layer banking as one page table with separate CPU and TED views: `$FF3E/$FF3F` (ROM or RAM),
the `$FDD0` 4×4 bank latch (BASIC/KERNAL, 3-plus-1, cartridges C1/C2), the fixed `$FC00` page; the TED's
own view (`$FF12` bit 2). I/O: `$FD00` ACIA (Plus/4), `$FD10` 6529 user port / C16 decode (TED OQ12),
`$FD30` 6529 keyboard, `$FF00–$FF3F` TED. The 7501/8501 port drives the serial bus and tape (input bits per
model, TED OQ7).

## 6. Peripherals, Run
- Tape: the 1531 on the CPU port, polled input, **TAP v2 half-wave** (TED §4, OQ6) in `cbm-tape.c`.
- IEC to the 1541 through the CPU port bits (DRIVE §11 D8). The 1551 (TCBM) is a follow-up.
- Cartridges C1/C2 (VICE `.crt` types for the Plus/4, TED OQ9).
- Run: BASIC start $1001 (or $4001 with graphics on, TED OQ10), inject after READY, fix pointers, type `RUN`.

## 7. Tests and open questions
- Harness `test/harness/c264/`; `test/c264-hw/`: clock switching per line, DMA halts, timers, sound,
  banking (every `$FDD0` value), keyboard latch, tape, models.
- VICE testprogs `plus4/` and `TED/` (fetched), Diag264 if its licence allows a local run (TED OQ11);
  oracle VICE xplus4 (and YAPE/plus4emu as runs only).

| # | Question | Default | Research |
|---|---|---|---|
| T1 | Refresh window | dots 296–336 | TED §8, OQ3 |
| T2 | Noise feedback and step | MAME's 2026 model | TED §8 |
| T3 | Port input bits per model | as MAME, `0x2F` on the Plus/4 | TED OQ7 |
| T4 | `$FF07` b6 mismatch with the crystal | line count follows the register | TED OQ5 |
| T5 | Light pen IRQ, `$FF09` forced bits | `0x25` forced | TED OQ4 |
| T6 | TED revision differences | none modelled | TED OQ1 |
