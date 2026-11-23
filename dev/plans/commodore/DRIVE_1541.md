# The IEC bus and the accurate 1541

Part of `COMMODORE_PLAN.md` (Phase 6; decisions D7, D12). Research: `DRIVE_1541.md` (DRIVE §n),
`CPU_6502_FAMILY.md` (CPU §n). The project author asked for **an accurate 1541**: the real DOS ROM on a
second 6502, every VIA and read/write-logic behaviour that fast loaders and protections depend on. There
is no sector-level shortcut and no KERNAL trap in this plan.

## 1. Files (shared by every machine)
```
src/emu/machines/commodore/common/wasm/
  README.md          the drive's hardware model, the scheduler, every constant
  via6522.c          the VIA (the 1541's two, the VIC-20's two)
  iec.c              the open-collector bus: ATN, CLK, DATA, SRQ, RESET, time-stamped line changes
  drive1541.c        one drive: m6502 instance (NMOS, SO), 2K RAM, VIA1 $1800, VIA2 $1C00, ROM, the
                     ATN auto-acknowledge XOR, LED, motor, stepper, write protect
  gcr-disk.c         the disk surface and the 16 MHz read/write process (UE7/UF4, filter, AGC noise,
                     SYNC, BYTE READY, write path)
  drive-sched.c      the rational accumulator that runs drives against the host
src/emu/machines/commodore/
  D64File.ts, G64File.ts, NibFile.ts, P64File.ts       image readers/writers → the canonical track model
  CbmDisks.ts                                          the drive slots, write-back, write protect
src/common/diskfs/cbmdos.ts                            the 1541 DOS file system for the file manager
```
A machine TU includes these with a prefix (as `wd1793.c` is included today), so each core carries its own
copies; a change rebuilds the four Commodore cores and none of the others.

## 2. The IEC bus (DRIVE §4)
- Lines are wired-AND of every device's output; each device sets its own outputs with a **timestamp in
  the common time base** (host master ticks with a drive-cycle fraction) and reads the bus as resolved at
  its own current time.
- The drive is never ahead of the host (§5), so a read never sees the future.
- **ATN auto-acknowledge:** the 1541's XOR of ATN and VIA1 PB4 drives DATA combinationally; it is
  recomputed whenever the host changes ATN or the drive writes PB4, without running the drive CPU
  (DRIVE §4.4).
- Host sides: C64/C128 CIA2 port A (with the C128's fast-serial SRQ/CIA serial register, C128.md §6);
  VIC-20 VIA lines (with their inversions, VIC20 §4); Plus/4 CPU port bits (DRIVE §11 D8; TED §4).
- RESET: per profile, the host's reset resets the drives or not (C64 §1).

## 3. The VIA 6522 (DRIVE §2)
Timers T1 (one-shot, free-run, PB7) and T2 (one-shot, pulse counting), the shift register in all modes,
CA1/CA2/CB1/CB2 with handshake and pulse modes, IFR/IER, input latching, the reload timing and one-cycle IRQ
delay emulators model; the quirks DRIVE OQ6 lists are constants. Proven on its own with Klive tests from
DRIVE §2, then with the VICE `drive/viavarious` and VIC-20 `via_*` tests (fetched).

## 4. The drive and the disk
### 4.1 The drive (DRIVE §1)
- The 6502 at exactly 1 MHz (16 MHz / 16); the memory map with mirrors and open bus (DRIVE OQ5); VIA1 to
  the bus and the device number jumpers; VIA2 to the head, motor, stepper phases, LED, density (zone)
  bits, write protect (polarity: VICE's and CLK's, DRIVE §11 D4), SYNC and the read/write data byte.
- **BYTE READY on SO** and VIA2 CA1 (DRIVE OQ1–OQ2): the SO edge is raised at the gate array's cycle and
  the CPU core sets V by its own SO rule (CPU §4.3).
- **Stepper:** four phases, half tracks, tracks 1–42 (DRIVE §11 D2: 42 by default, one constant); head
  position in half-tracks.
- **Motor:** spin-up/spin-down as a rate ramp (DRIVE OQ4, constants), RPM default 300 with an optional
  wobble (off by default for determinism).

### 4.2 The bit-level disk process (DRIVE §3)
- **Canonical track model:** per half-track, a bit stream with a length in bitcells and a speed zone (or,
  from P64, flux positions at 16 MHz resolution). Every image format converts to it; G64 tracks are spread
  over one revolution with the cell length from the stored track length (DRIVE §6, as both reference
  emulators do).
- **Read logic:** the 16 MHz UE7 counter reloaded with the density value on every flux reversal, clocking
  UF4; a bit every 4 UF4 steps, 1 only on the first read after a reversal (the clock recovery); the 2.5 µs
  flux filter; AGC noise after ~18 µs without flux (weak bits, killer tracks); SYNC after 10 one-bits; the
  byte latch and BYTE READY every 8 bits outside SYNC. Written from DRIVE §3 in Klive's words.
  **The noise constants and the random seed are Klive's own** (MAME's match VICE's GPL code, DRIVE §8):
  derived from the hardware description, with a deterministic Klive PRNG (reverse debugging needs it, trap
  T1).
- **Write path:** the byte shifted out at the zone's rate, written as flux reversals into the track model;
  the track is marked dirty for write-back.
- **Advanced lazily but exactly:** the disk process is a function of time; it is advanced to the drive
  CPU's current cycle whenever the drive reads VIA2, samples SO or the scheduler reaches a frame end, in
  batches up to the next possible event (the next reversal, filter or noise timeout). Results are the same
  as stepping every 16 MHz tick; a test proves it on random tracks.

## 5. Scheduling against the host (D7; DRIVE §9)
- Each host master tick adds `driveHz / hostHz` (an exact rational per model: e.g. 1 000 000 :
  985 248.6 on a PAL C64, kept as integers) to an accumulator; the drive runs the whole cycles it yields
  (0, 1 or 2) **after** the host's tick. The drive is therefore always at most one drive cycle behind and
  never ahead.
- TED machines, whose CPU cycle length changes, schedule against the TED's absolute dot time, not CPU
  cycles (TED §7).
- **Idle optimisation (later, optional):** when the drive CPU is provably in the DOS idle loop, no timer
  or VIA interrupt is pending, the bus lines have not changed and the motor is off, the drive may skip
  ahead in one step. It is admitted only with a test that runs real workloads both ways and compares the
  whole machine state at every frame end (the debug-loop-equivalence pattern). Loaders that leave code in
  the drive never qualify.
- **Debugging:** the drive is a CPU in the descriptor (`drive8`); breakpoints, stepping, history and the
  memory view work on it (CPU_NEUTRAL_DEBUGGING.md §4).

## 6. Images and the file manager (DRIVE §6)
- **D64** (35/40/42 tracks, with or without error bytes: the error codes become missing/garbled sectors
  in the generated GCR, DRIVE §11 D10), **G64** (read/write), **NIB/NBZ** and **P64** (read; P64 written
  from its spec, the zlib library as a reference if ported, DRIVE §8). Writes go back as the source format
  when it can represent them (D64 only when the track is still standard GCR); otherwise the user is asked to
  save as G64.
- **Ambiguity:** a `.d64` is always the 1541's; `.d71`, `.g71` in the C128 milestone.
- **Drive ROMs** from the ROM manager (D2): 1541 (325302-01 + 901229-xx), 1541C, 1541-II (251968), 1571
  (C128.md); JiffyDOS as a user-supplied ROM only (DRIVE OQ13).
- **File manager:** `cbmdos.ts` reads and writes the BAM, directory and file chains of D64 (and later D71),
  so a disk can be browsed and files copied in and out; Run-from-disk uses it to build its D64 (IDE_INTEGRATION.md
  §4). Update `dev/ai/file-manager.md`.

## 7. The 1571 (C128 milestone; DRIVE §5)
The 1571 = the 1541's GCR path at 1 or 2 MHz + a WD1770 for MFM + a CIA for burst mode. The MFM side uses
the shared `wd1793.c` (1770 variant) at sector level (DRIVE OQ10); its integration and burst mode are in
C128.md §6.

## 8. Tests
- `test/drive-hw/`: VIA unit tests; the read logic on synthetic tracks (clock recovery at each zone, weak
  bits, SYNC, BYTE READY timing); the stepper and half tracks; the write path round trip; the scheduler
  (drive never ahead; the rational accumulator exact over a long run); the lazy disk equal to per-tick.
- With a C64 (local tier, real ROMs): `LOAD"$",8`, `LOAD"*",8,1`, `SAVE`, `VALIDATE`, formatting a disk;
  the VICE `drive/` testprogs (1541-testsuite, viavarious, rpm, skew, scanner, writeprotect, …; fetched) with
  their pass list in the README; **fast loaders:** Bitfire (BSD-3, may be built from source in a fetch
  step), Spindle and Krill's loader (licences unclear: local runs only), an IRQ-loader demo; a G64 of a
  protected title the developer owns (never committed).
- Oracle: the same disks in VICE x64sc with true drive emulation; observed results recorded.
- Benchmark: the C64 + 1541 benchmark above 10× real time with the drive busy (a loader running).

## 9. Open questions (one constant each)
| # | Question | Default | Research |
|---|---|---|---|
| R1 | SO latency to V | the CPU's SO rule, one cycle | DRIVE OQ1 |
| R2 | BYTE READY pulse width; CA1 latching | MAME's description | DRIVE OQ2 |
| R3 | Reading between two recorded half tracks | the nearer track, else noise | DRIVE OQ3 |
| R4 | Motor ramps, RPM, wobble | 300 RPM, no wobble; ramps from DRIVE §1 | DRIVE OQ4 |
| R5 | Open bus and RAM mirrors | the mirror; open bus = last byte | DRIVE OQ5 |
| R6 | VIA quirks | as DRIVE §2 records | DRIVE OQ6 |
| R7 | Track alignment between tracks | index-aligned | DRIVE OQ7 |
| R8 | Highest track | 42 | DRIVE §11 D2 |
| R9 | Write-protect polarity | PB4 = 0 when protected | DRIVE §11 D4 |
| R10 | ATN input pin | PB7 and CA1 | DRIVE §11 D6 |
