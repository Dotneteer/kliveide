# SAM Coupé — decisions, as-built notes and open items

The plan is `dev/plans/SAM_COUPE_PLAN.md` (implemented 2026-11-20); the research pack is
`dev/research/sam-coupe/`; the core's hardware model is `src/emu/machines/samcoupe/wasm/README.md`. Read
that README before changing the core.

## Decisions (accepted as the plan recommended them)

- **D1 provenance.** Klive's own code from the research pack. SimCoupé, MAME's (GPL) SAM driver, ZEsarUX,
  the FPGA cores and pyz80 are not read for design; the ZX-Uno core is not read at all. SimCoupé may be
  *run* as an oracle (results recorded in Klive's words, never in CI). **SAASound (BSD-3) is ported**
  (2026-11-26) into `sam-saa.c`: its chip model, with Klive's exact-time stepping; the pinned sources are
  `dev/research/sam-coupe/saasound/`. A later SAASound fix is ported from a new pinned commit, never
  re-derived.
- **D2** one machine id `sam`, models `sam512` (default) and `sam256`.
- **D3 ROMs**: ROM 3.0 (default) and 3.1 bundled under Andy Wright's 2008 grant
  (`src/public/roms/sam-roms-readme.txt`). The original message in the Red Hat archive could not be
  reached (DNS failure, 2026-11-20); the quote is World of SAM's copy. `SamRoms.ts` is the one place that
  names them.
- **D4** whole T-states, the frame from the frame interrupt, the ASIC stepped per cell.
- **D5** closed-form contention with named phases; Owen's timings reproduced.
- **D6** 12 MHz pixels, 640 x 288, aspect 7/12, per-cell register sampling.
- **D7** Klive's boot loader; Run boots a disk with F9 (direct injection only for debugging one unit test).
- **D8** SAASound's behaviour where it and MAME disagree.
- **D9** no DOS bundled.
- **D10** the competitive analysis names the SAM as an exception to "every shipped ROM is annotated" until
  ROM 3.0 and 3.1 were annotated (2026-11-28); the exception is gone.

## Rules for later work

- **Nothing reads "which ROM" from a literal**: `SamRoms.ts`, `MC_SAM_ROM`.
- **ROM landmarks come from running the ROM**, not from an address table: the copyright key wait (ROM0
  0FA2h on 3.0 and 3.1) is found by `test/sam-hw/boot.test.ts`; if a ROM changes, re-observe it.
- **The copyright screen eats its key.** F9 boots from the editor. Anything that automates boot (Run,
  Load and Run, a disk inserted at start) presses a key first.
- **The SAM ROM's annotations follow rule D4** (`dev/ai/rom-annotations/sam-authoring-guide.md`): the
  published annotated disassembly and every symbol file for the ROM (SimCoupé's `samrom.map` included) are
  never read. ROM 3.0 ships at level 2, ROM0 and ROM1 (`src/public/roms/sam-rom30.rom.dis`), and 3.1 by `inherits`.
- **The boot loader must stay within 501 bytes** (one sector minus the header) with "BOOT" at file byte
  247; `test/machines/sam-klive-boot.test.ts` checks both.
- **Contention constants are data**: a real-hardware measurement changes `sam-timing.c`'s table, and
  `test/sam-hw/timing.test.ts` pins Owen's values.
- `wd1793.c`'s 1772 variant is shared with the Beta 128, TVC and Enterprise cores: a change there rebuilds
  them, and their artifacts must stay byte-identical.

## As built

- Core: `src/emu/machines/samcoupe/wasm/sam/`; host `SamWasmHost.ts`, adapter `SamWasmV2Machine.ts`.
- Images: `.mgt`/raw `.dsk` (gzip too), `.sad`, normal-format EDSK, `.sbt` (wrapped, read-only); the
  guest's writes come back as whole MGT images. SAM files in the File Manager's MGT file system
  (`src/common/diskfs/mgtfs.ts`, `dev/ai/file-manager.md`).
- Tape: TZX/TAP through the shared reader; the deck starts itself while the ROM polls EAR.
- Virtual keyboard: `SamKeyboard.tsx`, from the homecomputermuseum.nl photo and the mockup the project
  author approved (without the case's SAM coupé / MGT branding: it costs screen space). Its colours are
  `--device-*-sam` tokens; `guides-samcoupe.cjs` shoots it for the guide.
- Panels: ASIC and SAA 1099 (Debug activity, SAM only); the disassembler lists the byte after `RST 8`
  (error codes and DOS hooks).
- Assembler: `.model SAMCOUPE`; code goes to page 1 at 8000h (`common/samcoupe/codePlacement.ts`).

## Oracle runs (SimCoupé 1.2.17, D1: run, never read)

- **The parity tooling** (plan `dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md`, Phase 0, 2026-11-26):
  `node dev/scripts/sam-parity/oracle.cjs [probe...] [--app <SimCoupe.app>]` runs the probes in
  `test/sam-hw/parity/probes/` in Klive and in SimCoupé and writes `.local/sam-parity/runs/latest/report.md`.
  A probe writes a result block to its own boot disk (track 79 side 2 sector 10); the blocks are compared,
  and the decided values are pinned in `test/sam-hw/parity/expected/` (a normal CI test). The app path is
  a setting (`--app`, `SIMCOUPE_APP`, else `/Applications`); a mounted `SimCoupe-1.2.17-macos.dmg` works.
- **Running it unattended.** Not every documented option works: `-mainmemory` is ignored (the config key
  `mainmem` works). SimCoupé saves the settings it applied, so its `SimCoupe.cfg` shows whether one took.
  The command-line options are in the app's bundled
  `Contents/Resources/Manual.md` (documentation, not source). `-rom <Klive's src/public/roms/sam-rom30.rom>`
  (SimCoupé's bundled `samcoupe.rom` is ROM 3.1), `-disk1 <x.mgt> -autoload 0 -keyin 'BOOT\n'` (BASIC's BOOT
  boots Klive's `.mgt` with no key presses; SimCoupé keeps F9 for its debugger, the SAM's F9 is keypad 9).
  The fidelity settings `oracle.cjs` fixes: `-fastreset 0 -turbodisk 0 -turbotape 0 -tapetraps 0 -dosboot 0
  -asicdelay 1 -cmosz80 0 -mainmemory 512 -externalmem 0`.
  - **SimCoupé saves its options** (command-line ones too) to `~/Library/Preferences/SimCoupe/SimCoupe.cfg`.
    Run it with `HOME` set to a scratch folder: it then writes there and the developer's settings stay as
    they were.
  - **Stopping it:** SIGTERM to the process the script started saves changed disk images (checked); never
    quit it by name, which could close the developer's own SimCoupé.
  - **No tape or WAV options** on the command line. Sound is recorded through a loopback device: BlackHole 2ch
    (`brew install blackhole-2ch`) in a Multi-Output Device with the speakers as the system output (SimCoupé
    plays to the default output; a Multi-Output Device has no volume, so the samples arrive unscaled); probes
    marked `@sound` make `oracle.cjs` record it with ffmpeg (`SAM_PARITY_AUDIO_DEVICE`) and `sound.cjs` measure
    both. Nothing else may play meanwhile. **SimCoupé's output on macOS is spliced every 60-100 ms** (bits
    dropped or repeated), so parts are found by onset, never by elapsed time. A tape file given
    as an argument is taken for disk 1 (and refused); dropped files and an "open documents" Apple Event to its
    pid are ignored on macOS. The one way in is the tape browser (F3, a file picker with no Play control),
    by hand: probes marked `@tape` make `oracle.cjs` ask for the file (`.local/sam-parity/tapes/`) and wait for
    the probe's green border. **SimCoupé plays a tape only while ROM code reads it**: a program polling EAR
    itself sees nothing, and the tape stops when the ROM's loader returns; calling ROM 3.0's edge routine
    (204Ch, found by running the ROM) runs it.
  - **`-keyin` types through the ROM, not the matrix** as a program sees it: text before `BOOT` reaches the
    editor exactly, but keys typed after it never show in the matrix while a program runs.
  - **Pictures:** grab the window with `screencapture -l <window id>` (the id from
    `CGWindowListCopyWindowInfo`, owner "SimCoupe"); never send synthetic keys, which go to whatever app is
    in front. "Full Active" shows the same hc 96-31 window as Klive: x = 3 window px per Klive px, rows 6 px
    from y 64 (at `-scale 2`, Retina).
- **Comparing timing through pictures.** Write CLUT 0 (the border and a cleared mode-4 screen) at the points
  to compare; a white run between two writes measures CPU time with the display latency cancelled.
- **Replaying ROM code.** A copy of a machine state (pages, ASIC, CPU) restored from a boot disk runs the
  ROM's own code in both emulators; a vector in RAM (here 5B70h, the line handler's `JP (HL)`) lets a
  variant insert writes or delays. The tools are in the git-ignored `.local/sam-oracle/` (templates and
  the parked test drivers in `drivers/`).
- **Findings (2026-11-24).** ROM 3.0's copyright bars: SPEN (FEh bit 5) must idle low (fixed, see the core
  README). Every Z80 instruction tested (NOP, LD r/(HL)/(nn) forms, PUSH/POP, EX (SP),HL, CALL/RET, JR/JP
  taken, RRA, AND, IN FEh, IN/OUT FAh) costs the same in both on screen lines; in the border part of a
  screen line SimCoupé is 0-8 T faster on about half the cases (phase-dependent).
- **Findings (2026-11-26, probe `basics`).** Identical: FEh idle 5Fh (SPEN low, EAR high), STATUS FFh,
  LMPR/HMPR/VMPR after Klive's boot loader (1Fh, 01h, FEh), and ROM 3.0's ALLOCT.
- **Findings (2026-11-26, Phase 1: timing).** Loop counts (`cnt-*`), LPEN staircases (`stair-*`) and STATUS
  polls (`irq`) showed two differences: an ASIC I/O cycle after a 4-T instruction was 8 T slower in Klive's
  border (XOR A / OUT (FEh),A: 536 loops against SimCoupé's 644), and odd-length loops on screen lines
  differed by up to 2%. Both came from the contention phases, which Owen's table leaves open (36 of the 64
  memory/I/O pairs pass it). Memory and I/O free phases 5/5 (and 4/4, indistinguishable) reproduce all 226
  SimCoupé values; Klive now uses 5/5 (was 1/3). Pinned in `test/sam-hw/parity/expected/`.
  Then: code or data in ROM (`cnt-rom`), the program in external RAM (`cnt-ext`, `-externalmem 1`) and
  IM 1 (`im1`) all matched. The raster probe `pic-clut` (LPEN at each OUT, then the picture) showed a CLUT
  write one cell (8 T) later on Klive's screen than on SimCoupé's, with identical OUT times; Klive now
  draws a cell when the clock leaves it (Manual: "immediately on the next pixel"; SimCoupé: from the start
  of the cell), and all 23 raster rows match. This closes the old "write-landing 8-16 T" item: the I/O phase
  and the one-cell draw latency together.
- **Findings (2026-11-26, Phase 2: interrupts).** Probes `status` (polling), `status-sweep` (edges to 4 T:
  a fixed delay, k NOPs, one read), `cnt-soff`, `cnt-softog`. Matching: every line interrupt's start and
  end (LINE 0-191; none for 192-255), the frame pulse, LINE written into its own line, HPEN's switch to 192
  after line 191, contention with SOFF held on. Fixed in Klive: the line pulse is a live comparison (writing
  the same LINE no longer ends it); the MIDI OUT pulse is the byte's last 96 T and TXFMST lasts 96 T past
  the byte (was: the pulse after the byte); LPEN/HPEN freeze when SOFF takes effect (was: the last value
  read); HPEN reads 192 on line 0 until hc 128. **Lesson:** a probe's reference must start from HALT (an
  interrupt), not from a polling loop: a polled start carries the phase of whatever ran before, so an
  earlier difference shows up again later as a false one (`SyncFrame` is HALT-based now).
- **Findings (2026-11-26, Phase 3: video).** Pictures are compared whole (`picture.cjs --full`: SimCoupé's
  window reduced to 640 x 288, colours mapped, pixels next to an edge skipped since its window blurs them).
  Matching from the start: the four modes, mode 3's swap and HMPR's colour bits, BRIGHT, the 128 colours
  (both linear: plan Q11), border writes, SOFF on and off mid-line, page switches. Fixed in Klive: ATTR and
  the floating bus show the cell on screen (were: the one fetched for the next); a cell's bytes are fetched
  at its own start and it is drawn in the mode at its end, and a switch between modes 1/2 and 3/4 inside a
  cell draws that cell as the ASIC's artefact (plan Q15, the rules fitted from `pic-q15`'s random bytes:
  `q15.cjs --fit`; see the core README). SimCoupé fits a Blue Alpha sampler on ports 7Ch-7Fh by default:
  the oracle turns it off (`-dac7c 0`).
- **Findings (2026-11-27, Phase 4: memory and models).** No difference: LMPR/HMPR over all 32 pages with the
  ROM0, ROM1 and write-protect bits and the page wrap (`mem-paging`), the 256K model's missing pages 16-31
  (`mem-256`, plan Q1), the external pack's 64 pages through LEPR and HEPR, the pack winning section D over
  ROM1, LEPR/HEPR not readable (`mem-ext`, Q8), ROM 3.0's and 3.1's ALLOCT on 512K and 256K (`alloct-*`), and
  the copyright and BASIC screens of both ROMs, pixel for pixel (oracle `screens`). **SimCoupé ignores
  `-mainmemory`**: 256K needs `mainmem=256` in its config file (the oracle seeds it); a setting that took is
  in the saved `SimCoupe.cfg`, which is how to check one. Not reachable unattended: the paging registers'
  reset values (Q9; the ROM sets them before any probe runs) and what survives the reset button (no keys).
- **Findings (2026-11-27, Phase 5: disks).** Probes `fdc-cmds` (drive 1 command by command), `fdc-drive2`,
  `fdc-drive2wp`, `fdc-nodrive`, `img-sad`, `img-edsk`. **SimCoupé's disk controller is not timed**: seeks and
  restores finish at once at every step rate, data is ready on every status read (no lost data however slow
  the loop), and its disk turns about 17 times faster than 300 rpm. So it is no reference for disk timing;
  Klive keeps the WD1772 data sheet's (pinned as Klive's values). Matching: every status bit of the type I
  commands, read address/sector, record not found, write and read-back, both drives and sides, write
  protection, the ID sequence, the SAD and EDSK images and the disks written back. Fixed in Klive: Type I
  bit 5 (spin-up complete) only after a real spin-up (a command with h = 1 no longer sets it; the 1772
  variant only, the Beta 128, TVC and Enterprise cores build byte-identical). Kept against SimCoupé, from
  the data sheet: Force Interrupt during a command leaves the other status bits; READ TRACK sets no bit 4.
  A missing drive's ports read FFh (SimCoupé 00h). Probe loops that move data must stay inside 32 us a byte
  (`FdcReadStore`, `FdcWriteFast`), or a timed controller reports lost data.

- **Findings (2026-11-27, Phase 6: tape, keyboard, mouse).** Probes `tape-code-std`, `-fast`, `-turbo`, `-slow`,
  `-pause` (ROM 3.0's `LOAD "" CODE` from Klive-made TZX tapes: standard blocks; turbo blocks at 0.5, 0.25 and
  1.15 times the standard pulses; a tone and a 3 s pause between header and data), `tape-ear` (nine tones
  timed through the ROM's edge routine), `keys`, `mouse`. Matching: every ROM load (ROM 3.0 in Klive loads 0.25
  to 1.18 times the standard pulse lengths, not 0.2 or 1.2), the edge count, a BASIC line typed with every
  symbol, the mouse's sequence, its strobe and wrap, and its **timeout: the same as Klive's 228 T (38 us),
  restarting on each read** (plan Q18; SimCoupé's ChangeLog's 50 us is from an older version). Kept as Klive's:
  the tape's short pulses (`tape-ear`: SimCoupé agrees at 2000 and 1000 T pulses, but from 800 T down its edges
  land tens of T away, alternating in sign, so the ROM's counts differ; Klive plays each TZX pulse to the
  T-state), and the matrix with a held key (`keys`; `-keyin` cannot hold one). Found on the way and fixed:
  Klive's tape layer dropped TZX 13h-15h and the Spectrum player silenced 12h (commit c5d2430, its own
  changeset).
- **Findings (2026-11-27, Phase 6: the beeper and the mix).** Probe `snd-mix`, recorded from both. Matching:
  the beeper's and the SAA's pitch (within 0.4%), the SAA's amplitude law (8, 4, 1 of 15: 0.53, 0.27, 0.07 in
  both). Different: the beeper's level, a swing 2.25 times one SAA channel's at amplitude 15 in SimCoupé, 3.0
  in Klive, which now uses SimCoupé's (0.1875 of full scale, was 0.25; the user's decision: Klive's was a guess,
  SOUND OQ4); the DC filter, a time constant of 11.6 ms in SimCoupé (about 14 Hz, and a held level drops away
  about 32 ms after a change) against Klive's 1.4 Hz, kept (the user's decision: every Klive core's value; no
  hardware figure for the SAM's coupling).
- **SAA 1099 against SAASound** (`dev/scripts/sam-parity/saasound-diff/`, 2026-11-27): the pinned SAASound and
  `sam-saa.c` built natively into one runner, fed the same timed register scripts (tones, every octave and
  offset write order, every noise source and source switches, all envelope shapes and resolutions, external
  clocking, mid-shape writes, sync, mute, amplitudes, eight random-write scripts of 1500 writes). **The port
  matches SAASound**: with SAASound ticking 8 times a chip clock and writes that tie with an edge held back
  (`--fine --oversample 5 --avoid-ties`), no case diverges; only blips of a few samples remain. Every difference
  traced was SAASound's stepping, which Klive replaces on purpose with exact edge times: an edge on the same
  clock as a write (SAASound's edge, a hair late from its truncated period table, comes after the write, Klive's
  before); the table's drift (a few clocks a second); and the remainder its counter keeps across a buffered
  octave change (an old-rate overshoot counted at the new rate: up to old/new rate ticks, 128 for octave 7 to
  0). The divergences shrink as SAASound's ticks get finer, as stepping must. At SimCoupé's own setting (44.1
  kHz, 64x oversampling: 2.8 clocks a tick) the structured cases agree and the random scripts part where a
  buffered write and an edge fall within that stepping error.
- **Phase 7 (2026-11-27): software side by side, by eye.** `dev/scripts/sam-parity/software.cjs` (disks in
  `.local/sam-parity/software/`, never committed). FRED 59, Defender and SAM DICE look the same in both; the
  Top Gun demo's original disk stops with "Out of memory" in both. The plan is done.

## Open

- **The SAA 1099 against a real chip.** The port makes Klive sound like SimCoupé by construction, so the
  differential test checks only the port. No implementation is published as measured feature by feature; real-SAM
  recordings of Klive's own test programs would be the only independent reference.
- **The tape's short pulses** (`tape-ear`, pinned as Klive's): SimCoupé's edges for pulses of 800 T and less
  land tens of T from the TZX timing. Klive keeps the exact timing; decide again if a loader is found that
  loads in one emulator only.
- **The DC filter** (`snd-mix`): Klive 1.4 Hz, SimCoupé about 14 Hz; neither is measured. A recording of a real
  SAM's output would settle it, and the beeper's level too.
- **SOFF held for a few T** (`cnt-softog` TOG1/TOG2, `status` SOFFPEN; pinned as Klive's values): when
  SOFF is switched on and off again within 1-2 NOPs, SimCoupé's contention differs from Klive's. Klive
  takes SOFF's contention change at the next cell boundary; no on/off latency in whole cells (1-4) matches
  SimCoupé, and longer ones break Owen's timings. Held for longer it matches (`cnt-soff`). Needs a
  sub-cell model, or a reason it does not matter.
- **LPEN bit 0** (`attr` POSB, pinned as Klive's): SimCoupé's bit fits the pixel two lines above the beam,
  about 15 pixels on (17 of 17 samples), which looks like how it reads its own frame buffer, not hardware;
  Klive reads the pixel under the beam. Decide again if a program depends on it.
- **MIDI devices, printer, Atom Lite/B-DOS, more than one
  external pack, Spectrum mode, the SAM Élite** - follow-ups.
- **SAM BASIC listing** (plan §11.1): the token table was not recorded; `BasicPanel` does not list SAM
  programs.
- **ROM annotations** are done for 3.0 and 3.1 (both shipped at level 2; `dev/ai/rom-annotations/sam-authoring-guide.md`).
- The "Under the hood" article on the ASIC's contention (plan Phase 10) is not written.
