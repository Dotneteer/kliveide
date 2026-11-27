# SAM Coupé parity with SimCoupé

Status: done (2026-11-27): Phases 0-7. Owner: the SAM core (`src/emu/machines/samcoupe/wasm/`).

Goal: find every place where Klive's SAM Coupé behaves differently from SimCoupé 1.2.17, decide each
difference, and pin the decided behaviour with tests that run in CI without SimCoupé. This continues the
oracle runs of 2026-11-24 (`dev/ai/sam-coupe.md`, "Oracle runs"), which found the SPEN bug and left one
open timing offset.

## 0. Ground rules

- **D1 stays.** SimCoupé is *run*, never read: no source, no headers, no diffing its behaviour by reading
  code. Only the observed results of Klive's own test programs are recorded, in Klive's words. Third-party
  software (games, demos) is run by hand for confidence and never becomes a fixture.
- **Never in CI.** The oracle run is a developer tool. What it observes becomes a pinned expectation in a
  normal Klive test (`test/sam-hw/parity/`), so CI checks Klive against the recorded result.
- **No synthetic keystrokes.** They go to whatever app is in front (this happened once). SimCoupé is driven
  only by its command line (`-keyin`, `-disk1`, `-tape`, `-autoload`, ...) and read back through files and
  `screencapture -l <window id>`.
- **Who wins a disagreement.** Real-hardware measurement (Owen's timings, the research pack's sources) beats
  SimCoupé; SimCoupé beats Klive's own guesses (the plan's Q-table defaults). Every kept difference is listed
  with its reason in the core README. SimCoupé's author is Simon Owen, whose measurements Klive's contention
  is fitted to, and its changelog shows years of timing and video work (contention alignment fixed 2021-22,
  cell-accurate display, mode-change artefacts, LPEN/HPEN/ATTR), so on timing and video it is a strong
  witness. **Sound is the exception:** Klive's SAA 1099 is now ported from SAASound, the library SimCoupé
  uses (§3, Phase 6), so agreement there proves only the port.

### SimCoupé's own fidelity settings

Some of SimCoupé's defaults trade accuracy for convenience. Every oracle run fixes and records them
(Phase 0 finds the exact option names): **fast floppy access off** and **tape traps / fast loading off**
(both on by default: disk and tape timing is not cycle-exact with them); the **ASIC start-up delay**
(about 49 ms, on by default; Klive has none, plan Q10) on or off to match the case; the **NMOS** Z80 (the
default; a CMOS switch exists); SAASound's **3-bit "accurate"** sample mode, not the 4-bit one; the model
(512K / 256K) and the external memory size. A run whose settings are not recorded is not evidence.

## 1. The measuring channels

Pictures alone are slow to compare and ambiguous by a cell. The suite uses four channels, best first:

1. **A result sector on disk.** A probe program measures something (a count, a port value, a beam
   position read from HPEN/LPEN) and writes a 512-byte result block to a fixed sector of its own `.mgt`
   through the 1772, with Klive's own sector-write routine. SimCoupé writes the image back; Klive's harness
   reads the same sector from its write-back. The comparison is a byte diff. Block layout: a magic, the
   probe's id and version, then (name, value) records.
2. **The screen as data.** The same result also drawn as large hex glyphs (mode 4, one colour per nibble),
   for when the disk channel cannot be used (a probe that tests the disk itself) and to check by eye.
3. **Raster pictures.** CLUT 0 writes at chosen moments; the white run between two writes measures CPU
   time with the display latency cancelled (the 2026-11-24 method). Used for interrupt and write-landing
   positions, where the beam is the quantity.
4. **Sound.** A WAV recorded by each emulator from the same probe, compared by pitch, period and envelope
   shape, not sample by sample. Since the SAASound port this is for the beeper and the mix; the SAA 1099
   itself is checked against SAASound directly (Phase 6).

Tapes are inputs (channel 1 or 2 reports what the ROM or a loader read), and a tape-saving probe's output is
compared as edge timings when SimCoupé can record one (§3, step 0 checks).

## 2. Tooling (Phase 0) - done 2026-11-26

**As built.** `node dev/scripts/sam-parity/oracle.cjs [probe...] [--app <SimCoupe.app>] [--seconds <n>]`
does the whole round trip in one script (the four scripts first planned turned out to be one step each):

- **Klive:** it runs `test/sam-hw/parity/parity.test.ts` with `SAM_PARITY_OUT`; the test assembles the shared
  frame `probes/parity.inc.asm` and each probe (`parity.ts`), builds a boot `.mgt` with `samBootDisk.ts`,
  boots it as Run does and writes the probe disk, Klive's written-back disk and Klive's records.
- **SimCoupé:** each probe disk boots with BASIC's `BOOT` (`-keyin`), the fixed fidelity settings
  (`SIMCOUPE_SETTINGS` in the script) and `HOME` set to a scratch folder; after a fixed time (12 s, doubled
  once if no result) the script sends SIGTERM to the process it started, which saves the image.
- **Report:** `.local/sam-parity/runs/<time>/report.md` (and `latest`): one row per record, Klive against
  SimCoupé, plus any other sector that differs. Exit 2 when something differs.
- **Pinned results:** `test/sam-hw/parity/expected/<probe>.json`, each value with its source and date; a
  probe without one only has to run. The test is in the `e2e-cores` tier (`test/sam-hw/**`).
- **The result block** (`parity.inc.asm`): the probe records 8-character names with 32-bit values
  (`Record`, `RecordA`); the frame writes them to track 79, side 2, sector 10 through drive 1's VL1772, then
  shows a green border (red: the write failed). At most 41 records a probe.
- `dev/scripts/sam-parity/listen.cjs` plays a sound demo in an isolated Klive (Phase 6's ear check).

**Step 0 findings** (recorded in `dev/ai/sam-coupe.md`, "Oracle runs"): the options are in the app's bundled
`Manual.md`; SimCoupé saves its options to `~/Library/Preferences/SimCoupe/SimCoupe.cfg`, so runs use a
scratch `HOME`; SIGTERM saves changed disks; there is **no command-line tape option and no WAV recording**,
so tape cases need a file argument or the tape browser (to try in Phase 6) and SimCoupé's sound cannot be
captured unattended. ROM 3.1, 256K and external memory are options (`-rom`, `-mainmemory`, `-externalmem`),
not yet exercised. Not built yet: hex glyphs on screen (channel 2) and frame-synchronised timing loops in
the include; they come with the first probes that need them (Phases 1 and 3).

**Exit met:** the `basics` probe (FEh, STATUS, LMPR/HMPR/VMPR, ALLOCT) round-trips through both; all eight
values are identical and pinned.

## 3. The probe catalogue (Phases 1-6)

Each phase is a set of probes, one report, the fixes it leads to, and pinned results. Order is by how much
running software depends on the area.

### Phase 1: CPU timing and contention

Owen's table is already matched; this extends coverage to everything a program can do.

**As built (2026-11-26).** `timing.inc.asm` adds two methods. *Loop counts*: a block runs as `block / INC IY
/ JP` between two interrupts entered from HALT (border window: frame interrupt to line 0; screen window:
line 0 to line 191) and the count is recorded; a 1-T difference a loop shows as tens of loops. *LPEN
staircases*: line interrupt, a fixed delay, k NOPs (0-31), the block, then LPEN, at two delays so both
contention boundaries are crossed. Probes: `cnt-core`, `cnt-io`, `cnt-prefix` (CB/ED/DD/DDCB, undocumented),
`cnt-block`, `cnt-mode1`, `irq`, `stair-core`, `stair-late` (226 values). Findings: the I/O and memory
contention phases, which Owen's table leaves open, were wrong (an ASIC I/O after a 4-T instruction was 8 T
slow in the border; odd-length loops on screen were off by up to 2%). A sweep of all 64 phase pairs found
5/5 (and the indistinguishable 4/4) matching every SimCoupé value and Owen's table; Klive uses 5/5 now.
All values are pinned. **Then** (same day): `cnt-rom` (opcode fetch and data from ROM0), `cnt-ext` (the whole
program in a 1 MB external pack: a copier moves pages 1-2 there; probes marked `@extmem` get the pack in
both emulators), `im1` (staircases through IM 1; the handler at 0038h reads STATUS at once, since a longer
path misses the 128-T line pulse) all matched. `pic-clut` (`@picture`: the window is grabbed and compared
by `picture.cjs`, the white runs pinned too) showed CLUT writes one cell late on Klive's screen; Klive now
draws a cell when the clock leaves it (the user's decision: match SimCoupé), and the picture matches row
for row. 13 probes, all identical. **Phase 1 is done.**

- Every instruction group (the 2026-11-24 runs covered a dozen): block instructions (LDIR, LDDR, CPIR,
  INIR, OTIR, OUTI with ASIC and non-ASIC ports), DD/FD/ED/CB prefixes and DDCB, EX/EXX, DAA, the
  undocumented ones, HALT exit, interrupt acknowledge in IM 1 and IM 2.
- Each in the four places: border line, screen line before hc 124, screen line after, and the bottom
  border; code and data in ROM, internal RAM, external RAM.
- Mode 1 stripes, modes 2-4, SOFF on and off.
- A phase sweep: the same instruction started at each of the 8 cell phases (a probe that slides its start
  by one T per frame).
- Method: count loop iterations between two line interrupts (channel 1), and raster runs (channel 3) for
  the ones that differ.
- Resolves the open item "interrupt and write-landing positions": separate the interrupt's position, the
  acknowledge's cost (plan Q20) and where an OUT takes effect, with probes that vary only one of them.

### Phase 2: interrupts and STATUS

- Frame interrupt line and T; line interrupt for LINE 0, 1, 100, 191, 192-255 (none); pulse length read by
  polling STATUS; a LINE write during the pulse; LINE changed after the pulse; a pulse missed under DI;
  frame and line together; MIDI OUT interrupt time and length; IM 2 vector byte.
- HPEN/LPEN read at known points (the beam position as a number), with SOFF.

**As built (2026-11-26).** `status` polls STATUS with interrupts off; `status-sweep` (`sweep.inc.asm`) places
one read at a fixed delay plus k NOPs (k = 0-31, 4 T apart) after a reference, so an edge shows to 4 T;
`cnt-soff` and `cnt-softog` count loops under SOFF. Fixed in Klive: the line pulse as a live comparison,
the MIDI OUT pulse and TXFMST timing, LPEN/HPEN frozen when SOFF takes effect, HPEN on line 0 (all
SimCoupé's, recorded in the core README). A reference that starts from polling carried earlier
differences forward; `SyncFrame` now starts from HALT. The IM 2 vector byte (FFh) is covered by every
probe's handler at 0A0FFh. **Left as a known difference:** SOFF switched on and off within a few T (`dev/ai/
sam-coupe.md`, Open); its three values are pinned as Klive's with a note. **Phase 2 is done.**

### Phase 3: video

- Each mode on worked bytes; mode 3's pixel swap and HMPR's high bits; BRIGHT; FLASH period and phase
  after reset; border bits and the border in each mode; SOFF and its latency; VMPR changed mid-frame and
  mid-line (the mode-change artefact cell, plan Q15: SimCoupé shows the artefacts of mode 1/2 <-> 3/4
  switches and changes the page one cell after the mode, so this run can settle Q15 by observation);
  CLUT change landing cell; a line-interrupt split
  screen; ATTR in the border and on screen; the floating bus on unmapped ports (Q14).
- Channels 2 and 3: SimCoupé's window at "Full Active" against Klive's 640 x 288 picture, cropped to the
  same area; a probe screen is compared pixel by pixel after mapping SimCoupé's palette to Klive's (the
  palette itself, Q11, is checked once with all 128 colours on screen).

**As built (2026-11-26).** Picture probes: `pic-modes` (the four modes as line-interrupt bands), `pic-palette`
(all 128 colours), `pic-raster` (mid-line border, SOFF, mode and page writes), `pic-q15` (mid-line mode
switches over random bytes); `attr` reads ATTR, an unused port (37h) and LPEN along a line. `picture.cjs
--full` compares whole pictures (colours mapped, edge pixels skipped); `q15.cjs` classifies and fits the
artefact cells. Fixed in Klive: ATTR and the floating bus show the cell on screen; a cell's bytes are fetched
at its start and drawn in the mode at its end; the mode-change artefact cell (Q15), fitted from SimCoupé
(mode 3 inferred). All pictures now match SimCoupé (FLASH cells only by the frame each was taken at).
**Left as a known difference:** LPEN bit 0 (SimCoupé reads a pixel two lines above the beam). FLASH's period
and phase after reset are not compared: SimCoupé's capture time is not tied to a frame. **Phase 3 is done.**

### Phase 4: memory, paging, models

- Every LMPR/HMPR combination with ROM0/ROM1/RAM0 bits, write protection, page wrap; 256K: pages 16-31
  read and write (Q1); external memory pages, LEPR/HEPR read back (Q8); reset values of the paging
  registers (Q9); what survives the reset button.
- Both ROMs (3.0, 3.1): boot to BASIC, ALLOCT and the system variables dumped to the result sector; the
  copyright and BASIC screens.

**As built (2026-11-27).** Probe flags `@ram256`, `@rom31` and `@extmem` choose the machine on both sides;
`@use <name>` appends any `<name>.inc.asm`. Probes `mem-paging`, `mem-256` (`paging.inc.asm`), `mem-ext`,
`alloct-r30`, `alloct-r31`, `alloct-256` (`alloct.inc.asm`); the oracle's `screens` compares the copyright
and BASIC screens of both ROMs. **Everything matched**; no change to Klive. SimCoupé ignores the documented
`-mainmemory`: the oracle writes `mainmem=256` into its config instead. Not covered: the paging registers'
reset values (Q9: the ROM has set them before a probe runs) and the reset button (it needs a key press).
**Phase 4 is done.**

### Phase 5: disks

- Through Klive's own FDC probes (no DOS): status bits after each command type; step rates and settle
  (timed in T); index pulse period (rotation); read and write sector timing, the DRQ rate; seek errors,
  record not found, write protect; side select; two drives; force interrupt; the busy/motor-on timeout.
- Images: the same probe from `.mgt`, `.sad` and EDSK images; write-back contents of each.
- The ROM's own F9 boot and BOOT command timings (frames from command to the loader's first instruction).
- Disks the user owns (SAMDOS, MasterDOS, games): boot each in both and compare by eye and by the frame at
  which the boot finishes. Never committed.

**As built (2026-11-27).** `fdc.inc.asm` (timed commands in status polls, data through tight loops),
`drive2.inc.asm`; probes `fdc-cmds`, `fdc-drive2`, `fdc-drive2wp`, `fdc-nodrive`, `img-sad`, `img-edsk`. Flags
`@disk2`, `@disk2wp` (drive 2 with a blank disk, read-only for SimCoupé) and `@image sad|edsk` (the boot disk
converted, `diskFormats.ts` / `disk-formats.cjs`). **SimCoupé's controller is untimed**, so step rates, the
index period, the motor timeout, spin-up and the ROM's boot timing cannot be compared with it: Klive keeps the
WD1772 data sheet. Everything functional matched except: Type I bit 5 (fixed in Klive, 1772 only), Force
Interrupt's status and READ TRACK's bit 4 (kept from the data sheet), a missing drive's ports (Klive FFh).
Left to the user: their own disks, by hand. **Phase 5 is done.**

### Phase 6: tape, keyboard, sound

- **Tape:** a set of Klive-generated TZX/TAP files (standard speed, fast speeds, a turbo block, pulses near
  the edge of the ROM's tolerance, a TZX with pauses and direct-recording blocks). The ROM's `LOAD` in both;
  the result sector reports what loaded and the frame it finished. A probe that samples EAR (FEh bit 6)
  every N T for a known tone reports the edge times it saw. SAVE: compare recorded edges if SimCoupé can
  record (step 0), else the ROM's timing constants from Klive's capture against the observed ones.
- **Keyboard:** `-keyin` text typed into BASIC in both; a probe that scans the matrix with every
  combination of high-byte rows (several rows ANDed) while `-keyin` holds a key.
- **Mouse:** by hand, plus one probe for the read timeout. SimCoupé's is 50 us and restarts on each byte
  read; Klive's is 38 us from the last read without that restart (plan Q18). Decide which, and record why.
- **Sound: done differently.** The SAA 1099 was ported from SAASound (2026-11-26, commit 3d92322 pinned in
  `dev/research/sam-coupe/saasound/`): the tone, noise, envelope and amplitude stages are SAASound's,
  time is Klive's exact event clock. Two checks remain:
  1. **The port against SAASound itself** (a differential test, no SimCoupé): build the pinned SAASound
     natively in `dev/scripts/sam-parity/saasound-diff/`, feed it and Klive's core the same timed register
     scripts (every register, sync on/off, each envelope shape and resolution switch, octave/offset write
     orders, noise sources), and compare the per-channel levels over time. SAASound runs per sample, so
     compare levels averaged over windows longer than its period error (12-bit fraction), and edges to
     within one sample. Differences are port bugs, except the stepping, which is Klive's on purpose.
  2. **The beeper and the mix** against SimCoupé: the beeper's level against the SAA's (SOUND OQ4,
     unmeasured in both), and the DC filter. SimCoupé has no unattended WAV recording (Phase 0), so this
     needs its audio captured another way (a loopback device), or it is judged by ear.
  A real-chip reference (recordings of Klive's sound probes on a real SAM) is out of this plan's scope:
  it is the only way to go beyond SAASound, and it needs an owner of the hardware.

**As built (2026-11-27), tape, keyboard, mouse.** Tapes come from `test/sam-hw/parity/tapes.ts` (a TZX writer;
`@tape <name>` puts one in Klive's deck and in `.local/sam-parity/tapes/`). SimCoupé takes a tape only through
its tape browser, by hand: `oracle.cjs` asks for it and waits for the probe's green border, and SimCoupé plays
a tape only while ROM code reads it (`dev/ai/sam-coupe.md`). `@typed <line>` types a line before the probe
boots (a line with `BOOT` boots by itself), `@hold <key>` holds a key from the probe's start, `@mouse` fits
SimCoupé's mouse. Probes `tape-code-std/-fast/-turbo/-slow/-pause` (`taperom.inc.asm`: ROM 3.0's
`LOAD "" CODE 81920: BOOT`), `tape-ear` (nine tones through the ROM's edge routine at 204Ch), `keys`, `mouse`.
All ROM loads, the typed line and the mouse (sequence, timeout, restart: Q18 is Klive's 38 us) match. Kept as
Klive's, with notes: the short pulses' edge timing (SimCoupé's tape stepping) and the held-key matrix
(`-keyin` cannot hold a key). Not done: SAVE timing (SimCoupé cannot record a tape unattended). Found and
fixed on the way: TZX 12h-15h on every machine (commit c5d2430).

**As built (2026-11-27), sound step 1.** `dev/scripts/sam-parity/saasound-diff/` builds the
pinned SAASound and `sam-saa.c` into one native runner (Xcode's clang) and compares levels sample by sample:
blips (an edge moved by SAASound's stepping) apart from divergences, `--fine` for one SAASound tick per chip
clock, `--avoid-ties` to hold back a write that ties with an edge, `SAA_DEBUG_AT` / `SAA_FIND_NOISE` to dump both
sides. With 8 SAASound ticks a clock and ties held back, none of the 33 cases (eight random-write scripts among
them) diverges: the port matches SAASound, and every difference traced is SAASound's stepping
(`dev/ai/sam-coupe.md`). **Phase 6 is done.**

**As built (2026-11-27), sound step 2.** SimCoupé's output is recorded through BlackHole (a loopback device in a
Multi-Output Device): `@sound` probes make `oracle.cjs` record it with ffmpeg while Klive's harness writes its
own samples (`klive.wav`); `sound.cjs` finds each part by its onset (SimCoupé's macOS output is spliced every
60-100 ms) and compares ratios. Probe `snd-mix`. Pitch and the SAA's amplitude law match; the beeper's level now
follows SimCoupé's (2.25 times one SAA channel at amplitude 15; was 3.0); the DC filter stays Klive's 1.4 Hz
(SimCoupé's is about 14 Hz). Both decided by the user.

## 4. Software runs by hand (Phase 7)

Confidence, not fixtures: games and demos from the research pack's list (Defender, the BSD demo, FRED 59
Space demo, SAM DICE, SAM Mines, the TopGun demo on external memory) and the user's own disks and tapes.
For each: boots, plays, sound, nothing visibly different in a side-by-side of the first minute. A failure
becomes a probe in the phase it belongs to, not a game-specific fix.

**As built (2026-11-27), light.** No disks were at hand, so four titles World of SAM distributes were run:
`dev/scripts/sam-parity/software.cjs` boots every disk in `.local/sam-parity/software/` in both emulators
(Klive as Run boots a disk, SimCoupé with BASIC's BOOT, the oracle's settings) and pictures both every 5 s for a
minute, side by side (`runs/latest/index.html`). FRED 59 (its menu, scroller and animated logo), Defender (the
attract sequence and the game demo) and SAM DICE (its screen) look the same; the Top Gun demo's original disk
stops with "Out of memory" in both. Nothing new to probe. The sheet is by eye only: SimCoupé's disk is untimed,
so screens come at different moments; games were not played (nothing presses keys). The BSD demo and SAM Mines
were not found there. Real use stays the larger test: a difference users report becomes a probe.

## 5. Recording and exit

- Each phase ends with its report summarised in `dev/ai/sam-coupe.md` ("Oracle runs": what was compared,
  what differed, what was decided), the core README updated where behaviour changed, the plan's Q-table
  answers moved from "default" to "observed", and pinned results in `test/sam-hw/parity/`.
- Picture hashes that change are re-pinned only after an eye check (as for the copyright screen).
- Tests that run the core go in `build/e2e-tests.ts`; the sweeps (every instruction, every phase) go to
  `E2E_SLOW_TESTS` and one representative case stays fast.
- A behaviour change in the core gets a `fix` changeset per change set shipped; the tooling and probes alone
  are `internal`.
- **The plan is done when** every probe in §3 has a decided, pinned result; the open timing offset is
  resolved or explained; the Phase 7 titles show no difference by eye; and `dev/ai/sam-coupe.md` lists the
  differences kept on purpose.

## 6. Risks

- **SimCoupé is not hardware.** Where it disagrees with Owen's measurements, Klive keeps the measurement;
  the report flags these so they are not "fixed" later.
- **Write-back timing.** If SimCoupé only writes a disk on quit or eject, every run ends in a quit; if it
  cannot be quit without keys, channel 2 (screen data) replaces channel 1.
- **Window scale and Retina.** Captures depend on `-scale 2` and the display; the capture script checks the
  window's size and refuses to compare a different one.
- **Cost.** Each SimCoupé run takes seconds; the sweeps run as one disk with many probes writing many
  sectors, not one launch per case.
