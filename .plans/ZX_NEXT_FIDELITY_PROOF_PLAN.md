# ZX Spectrum Next Fidelity Proof – Plan

Created: 2026-10-24. Status: **draft, research done, nothing implemented.** §9 lists the questions the
project author must answer before Phase 2 and Phase 4 (Q1, the board, is answered).

**The reference board** (author, 2026-10-24): a **ZX Spectrum Next KS2** (Kickstarter 2, issue 4 PCB),
firmware **v1.44**, core **3.02.00**. Every O1 result in this plan is from this board unless it names
another.

**A second board is coming:** a **KS3** (third Kickstarter). Its exact PCB issue and FPGA are not
confirmed yet. Public sources disagree, and a fan preview speaks of a much larger FPGA and an upgraded
VGA output. They are read from the board itself on arrival (Phase 4 step 0). How the plan uses two
boards is in Phase 4 step 8.

Scope: build the evidence that Klive's ZX Spectrum Next (the WASM core in
`src/emu/machines/zxNext/wasm/zxnext/`) behaves like the real machine, measure how close it is, and
publish the result. This plan covers roadmap item **G10.2** (Next accuracy page) of
`.plans/CLOSING_THE_GAPS_PLAN.md` and goes beyond it.

Not in scope: new Next features. A gap this plan finds is fixed under its own bug or recorded as a
known difference (§7).

---

## 0. What "proof" means here

Today every Next expectation comes from **one oracle**: a person or an AI reading the VHDL in
`_input/next-fpga/src` and writing the value into a test. That catalogue is large and nearly complete
(§1), but it has a structural weakness: when the reader misunderstands a VHDL process, the test and the
fix carry the same mistake, and the suite stays green.

A claim of fidelity is credible when **independent oracles agree**. This plan adds three, and ranks them:

| Rank | Oracle | What it is | What it can prove |
|---|---|---|---|
| O1 | **Real hardware** | A ZX Spectrum Next board running a known core version | Everything observable: picture, sound, timing, port values |
| O2 | **The VHDL, executed** | `zxnext.vhd` simulated cycle by cycle in GHDL / nvc | Everything inside the FPGA, to the clock edge, for the pinned core version |
| O3 | **Hardware-verified third-party programs** | Test programs whose authors published real-board results | The behaviours those programs exercise |
| O4 | The VHDL, read | The current method | Whatever the reader got right |
| – | Other emulators (CSpect, ZEsarUX, MAME, JNEXT) | – | **Never an oracle.** Useful only to find candidate test scenarios. |

When oracles disagree: O1 beats O2 only for the **same core version**; otherwise the difference is
recorded with both versions named. O2 beats O4 always — a test whose O4 expectation differs from the
simulated VHDL is a misread, and the test is corrected (with a comment citing the simulation run).

**Ground rules** (in the spirit of the harness README and the archived Spectrum ULA accuracy plan):

- G1. **No golden from Klive's own output.** Goldens come from O1 captures or O2 simulation output.
- G2. Every published claim names its oracle, the core version and the test that holds it.
- G3. The VHDL is GPL-3; it is simulated locally and in a manual workflow, never shipped, and nothing
  generated from it (beyond observed values and pictures of our own test programs) enters `src/`.
- G4. A known difference is a first-class result, not a failure to hide: it is listed on the published
  page with its cause.
- G5. Expensive tiers (VHDL simulation, board runs, mutation) run on request, like `e2e-slow`, never on
  push or in the release.

---

## 1. Where we stand (research, 2026-10-24)

### 1.1 The evidence that exists

- **Hardware test catalogue** (`.plans/ZX_SPECTRUM_NEXT_HARDWARE_TEST_CATALOGUE_PLAN.md`): 495 rows in
  ~35 areas, **480 ✅**, every one a test in `test/zxnext-hw/` (114 files) on the real WASM core through
  the harness in `test/harness/zxnext/`. Expectations cite the VHDL (oracle O4). Open: COP-005/006
  (Copper MOVE latency, drift), INT-012/018/021/022, NMI-007, BEEP-005/006 (EAR input), SPI-006 (CMD25),
  PAR-007 (real software), PAR-001..004 retired with the TypeScript core.
- **Screen cases** `test/visual/copper/` (C00–C11, D01–D05, L01, P01, P02, T00) and `parity/PAR-005`,
  with a browser tier that loads them through real NextZXOS `.nexload` from a cloned SD card.
- **Machine-level tests** in `test/wasm/zxNext/` (loader, lifecycle, checkpoints, debug loop, boot).
- **The CPU** in isolation: `test/z80/` (81 files, instruction by instruction). The Z80 exercisers
  (ZEXALL/ZEXDOC, z80test) are **not** run on the Next core (G10.1 lists them as open).
- **Precedent:** the ZX Spectrum got exactly this treatment in the archived
  `SPECTRUM_ULA_ACCURACY_PLAN.md`: a vendored kit of community test programs (`vendor/spectrum-tests/`,
  `test/spectrum-kit/`) in the slow tier, results checked against real-machine photos, a published
  accuracy page (`docs/.../under-the-hood/emulator-internals/spectrum-accuracy`). This plan reuses that
  machinery and shape.

### 1.2 Weaknesses this plan addresses

| # | Weakness | Phase |
|---|---|---|
| W1 | One oracle (O4): a misread VHDL survives in both the test and the core. | 2 |
| W2 | Tact-exact claims (interrupt position, border latch, Copper latency, contention, 28 MHz wait states) were measured against values *derived by reading* the VHDL. | 2 |
| W3 | **No Next result has ever been compared with a real board.** | 3, 4 |
| W4 | The Next's CPU is the T80N, a T80 derivative, not a Zilog die: its undocumented behaviour (XF/YF on SCF/CCF, MEMPTR, block-instruction flags) need not match Zilog's published exerciser results. Nobody has checked either way on the Next core. | 2, 3 |
| W5 | The VHDL is pinned at core **3.02.01** (both tops: `g_version = X"32"`, `g_sub_version = X"01"`); the reference board runs **3.02.00**, and boards in the field run other versions. Nothing records which behaviours changed between versions; no public changelog for 3.02.00 → 3.02.01 was found. | 0, 4 |
| W6 | Coverage is unmeasured: we do not know which VHDL processes, NextReg bits or C code paths no test touches. 480 rows is a count, not a coverage figure. | 0, 1 |
| W7 | Real software is untested (PAR-007 blocked on a corpus). | 5 |
| W8 | Partly modelled features are scattered through the catalogue's notes (Copper tick-for-tick, UART interrupt sources, CMD25, the bus `/NMI`, EAR input, `$A0`/`$A2` pin takeover). | 6 |

### 1.3 Research findings that shape the plan

- **The VHDL is simulator-friendly.** `zxnext.vhd` (7542 lines) and the video, device, audio and CPU
  files use only `IEEE` and `work` libraries (`std_logic_unsigned` needs GHDL's `-fsynopsys`). Vendor
  primitives (`UNISIM`, Altera) appear only in the board tops, PLLs, HDMI and flashboot, which a
  testbench does not need. The one Verilog file the core uses, `input/ps2_mouse.v`, is stubbed
  (nvc and GHDL simulate VHDL only).
  The SRAM arbiter lives in the board top, not in `zxnext.vhd`, so the testbench has to reproduce it —
  this matters, because it is where the 28 MHz wait state comes from. **The reference board is issue 4,
  so the testbench follows `zxnext_top_issue4.vhd`**: one 16-bit IS61WV102416 SRAM (byte lanes by
  address bit 0, address bits 20–1 to the chip), synchronised to the 28 MHz clock, *not* issue 2's four
  8-bit AS7C34096 chips with chip selects and a swizzled address.
- **The board issue changes the core.** `zxnext.vhd` has `g_board_issue = 2` (issue 4) generate branches:
  the `$10` core-id write rule and the Xilinx peripherals (`$F0` XDEV, `$F8`–`$FA` XADC, the DNA).
  The issue-4 top also drives the internal speaker through the regular DAC. Klive's core already
  models an issue 4 board (`zxnext-nextreg.c`: `$0F` = `$02`, "as the `$11` and `$F0` rules assume"),
  which matches the reference board. No public simulation testbench for the Next exists. Simulator
  availability on the author's Mac and in CI is in Phase 2a.
- **A hardware-verified Next test suite exists:** `MrKWatkins/ZXSpectrumNextTests` (MIT). Folders
  `base` (Copper, DMA, NextReg defaults, Z80N), `Graphics` (Layer 2 colours/port/scroll, layer mixing in
  HiColour/HiRes/LoRes, lighten/darken, `$69`), `Interrupts` (HaltAfterDisable), `Sprites` (BigSprite,
  relative, scanline delay, transparency), `Timing` (8K bank changes with/without contention,
  scanline reading vs interrupt), `ULA` (scroll, transparency fallback, palettes). Many folders carry
  **photos of real boards** named by core version (2.00.24 … 3.01.10) beside CSpect/MAME/ZEsarUX shots,
  some marked `_OK` / `_BAD`. Most tests draw rather than self-report, so they are judged like the
  Spectrum kit's drawing programs. It also carries Spectrum TAPs for block-instruction flags and
  CCF/SCF flag stability.
- **Z80 exercisers:** Patrik Rak's z80test (z80full, z80doc, z80flags, z80ccf, z80memptr) and
  ZEXALL/ZEXDOC compare against a Zilog/NEC CPU's results. On the Next their *expected* values must come
  from O2 (the T80N simulated) or O1 (a real board), per W4.
- **The HDMI output is digital.** A capture of the Next's HDMI (720×576 @ 50 Hz) by a capture device
  that does no scaling and keeps 4:4:4 colour is pixel-comparable with Klive's 720×288 frame
  line-doubled. Cheap MJPEG/4:2:2 dongles are not; they need tolerant comparison (§Phase 4).

---

## Phase 0: The evidence ledger (measure before proving)

Goal: a machine-readable answer to "what is covered, by which oracle".

1. **Traceability index** `test/zxnext-fidelity/ledger.json`, generated by
   `scripts/next-fidelity-ledger.cjs`:
   - every NextReg in `_input/next-fpga/nextreg.txt` and every port in `ports.txt`, each **bit** of the
     read mux and of the write decode in `zxnext.vhd`, every `process` in the core's VHDL files;
   - which test files touch each one (by scanning tests for register/port literals and the catalogue's
     IDs; a test can declare `// @covers NR:$15.b3` where the scan is not enough);
   - which oracle backs the expectation (O4 today; O2/O3/O1 as later phases land).
2. **Report** `npm run next:fidelity-report`: per area, bits covered / total, oracle mix, open rows. This
   is the number the published page (Phase 7) shows, and it makes W6 visible.
3. **Version ledger** `.ai/zxnext/core-versions.md`: the pinned VHDL version, and for each behaviour a
   later phase finds version-dependent, the versions where it differs (W5).

Exit: the report runs, and lists the untouched bits/processes. Those become catalogue rows.

## Phase 1: Code coverage of the core

Goal: find C code in `zxnext-*.c` (≈10.5k lines) that no hardware test executes — such code is
unverified by definition.

1. **Spike (1 day):** the core is built by clang `--target=wasm32` (`scripts/build-zxnext-wasm.cjs`),
   where LLVM's profile runtime is not available. Two options, the spike picks one:
   - (a) a coverage build with `-fsanitize-coverage=trace-pc-guard,pc-table` and our own
     `__sanitizer_cov_trace_pc_guard` writing into an exported counter array, mapped to lines through
     DWARF (`-g`) with `llvm-dwarfdump`;
   - (b) a **native** build of the same C sources (they are freestanding C) with
     `-fprofile-instr-generate -fcoverage-mapping`, driven by a small replay of the harness's sessions.
     Only viable if (a) fails; it doubles the build surface.
2. `npm run next:coverage` runs `test/zxnext-hw` against the coverage build and writes an
   `llvm-cov`-style HTML report to `.next-coverage/` (git-ignored).
3. Every uncovered region gets a verdict: dead code (delete), debug-only (exclude), or **untested
   behaviour → new catalogue row**.

Exit: line and branch coverage of the hardware tests is known and recorded in the ledger; the
uncovered behaviour has rows.

## Phase 2: The VHDL as an executable oracle (O2)

Goal: turn "we read the VHDL" into "we ran the VHDL" (W1, W2, W4). This is the largest phase and the
one that changes the strength of every existing test.

### 2a. Spike with a go/no-go gate

- **Tools** (checked 2026-10-24 on the author's Mac: Apple silicon, macOS 26.6, Homebrew present):
  - **nvc is the simulator.** `brew install nvc` gives nvc 1.23.0 from homebrew-core, prebuilt for
    Apple silicon, GPL-3. It pulls in Homebrew's `llvm` (not installed yet; large). On GitHub,
    `nickg/setup-nvc` or the release's Ubuntu `.deb` installs it directly, with no Docker.
  - **GHDL is not installable through Homebrew on this Mac:** its cask (6.0.0, `ghdl-llvm` for
    aarch64) has been *disabled* since 2026-09-01 because it fails macOS Gatekeeper. Running it
    locally would mean downloading the release by hand and overriding Gatekeeper, which the
    author has to decide on. The plan does not need it locally.
  - **GHDL as a second opinion, in CI only:** the `ghdl/ghdl` Docker Hub images are maintained
    (updated 2026-10-24; release tags such as `6.0.0-llvm-ubuntu-24.04`), but they are **amd64 only**.
    They fit a manual workflow on `ubuntu-latest`, pinned to a release tag (never `*-dev-*`).
    `ghdl/setup-ghdl` is an alternative without Docker. On the Mac they would only run under
    emulation, slowly; Docker is installed there but its daemon is not running.
  - Two simulators agreeing on a divergence rules out a simulator bug before it is blamed on Klive.
- **First result (2026-10-24):** nvc 1.23.0 is installed (`brew install nvc`, with `llvm` 23.1.4 and
  `z3`). The **whole core analyses, elaborates and runs** under nvc with the issue 4 generics
  (`g_machine_id=X"0A"`, `g_version=X"32"`, `g_sub_version=X"01"`, `g_board_issue=X"2"`,
  `g_video_def="000"`, `g_video_inc="11"`). Elaboration takes about 0.3 s; a 1 µs run with undriven
  inputs gives only the expected metavalue warnings. What it took, all of it testbench-side, with
  `_input/` untouched:
  - `--std=2008 -a --relaxed`. VHDL-93 rejects the source: ambiguous `=` operators from mixing
    `std_logic_unsigned` with `numeric_std`, and `not reset` as a port actual.
  - Analysis order: the files are analysed in passes until nothing more succeeds. The real script will
    keep an explicit order.
  - `serial/fifop.vhd` uses `to_unsigned(-1, n)`, which ISE accepts and nvc rejects. A copy replaces it
    with an all-ones aggregate.
  - `rom/bootrom.vhd` needs Xilinx `UNISIM`. A stub is enough, because the testbench starts after the
    boot ROM. `rom/bootrom_ab.vhd` is plain VHDL and analyses as is.
  - Five Xilinx CORE Generator RAMs have no source in the tree: `sdpram_64_9` (UART), `sdpram_128_8` and
    `spram_320_9` (sprites), `sdpbram_16k_8` (sprite patterns), `sdpram_16_9` (tilemap). They are
    modelled as distributed RAM (synchronous write, asynchronous read) and block RAM (synchronous
    read). **This is an assumption that affects sprite and tilemap timing, and must be checked**
    against the cores' documented configuration before any sprite or tilemap result counts as O2.
  - `ram/dpram2.vhd` opens `init/none.bin.txt` relative to the run folder even when it does not read
    it, so the run folder needs an empty file there.
  The trial files are in the session scratchpad. Phase 2a moves them into `test/vhdl/`.
- `test/vhdl/tb/zxnext_tb.vhd`: instantiates the `zxnext` entity with
  - clocks generated in the testbench (28 MHz system, the derived enables come from the core itself);
  - `g_board_issue = X"2"` (issue 4, the reference board), a behavioural 16-bit 1M×16 SRAM and the
    SRAM interface reproduced from `zxnext_top_issue4.vhd`;
  - the ROM / boot state the harness's hard reset produces: start **after** the boot ROM, in the state
    `createSession()` reaches (config mode left, ROMs loaded into SRAM), not through flash boot;
  - keyboard, joystick, mouse, SD, UART, I2C lines tied idle (later driven from a stimulus file);
  - output taps: the CPU bus per cycle (A, D, M1, MREQ, IORQ, RD, WR, INT, NMI, WAIT), NextReg writes,
    the RGB stream at the pixel enable before the scandoubler, the audio mixer's PCM before I2S.
- Measure simulation speed in 28 MHz cycles per second and compile time.
- **Gate:** one 50 Hz frame is 560k cycles of 28 MHz. If a frame simulates in ≲ 60 s, Phase 2 proceeds
  as below. If it is much slower, Phase 2 narrows to **block-level** testbenches (copper, sprites,
  layer2, tilemap, dma, ctc, t80n, im2) driven by stimulus captured from the emulator's own trace —
  still an executed oracle, at the block boundary.

### 2b. Replaying the catalogue in the VHDL

The catalogue's programs are small Z80N programs; the VHDL can run the same ones.

1. A **result protocol** for self-contained tests: the program runs, writes what it measured into a
   results area (a fixed 8K page), and writes `$A5` to `$7F` (the existing ready marker). Harness
   assertions that read memory, `in` values taken *by the program*, register snapshots, frame pixels
   and audio are comparable directly.
2. A harness **session recorder** turns a scripted test's actions into a stimulus file: `loadCode`
   becomes the SRAM image, `runFrames`/`runTo` become run lengths, observations become probes on the
   VHDL's taps. Actions the real machine cannot do from outside (host-side `out`, `setNextReg`,
   `poke` mid-run) are compiled into a tiny CPU-executed stub where timing allows; tests that need a
   beam-exact host action are marked `vhdl: n/a` in the ledger instead of being forced.
3. `npm run test:vhdl -- <catalogue IDs | area>` runs the selected tests in the simulator and
   compares the VHDL's observables with the **test's expectation** (not with Klive): this checks the
   expectations themselves. A mismatch is a misread (W1) — fix the test, then the core.
4. Priority order: everything tact-exact first (VT, ULA border/latch, COP latency, SPD wait states,
   MEM contention, INT), then CMP/PAL/L2/TM/SPR (pixel streams), then DMA/CTC, then the rest.
5. The Copper rows COP-005/006 (open because the core is not modelled "tick for tick") get their
   expected positions from the simulation, closing them or recording the difference.

### 2c. Differential runs (finding what nobody wrote a test for)

1. **Trace diff:** for a program, the emulator's per-instruction trace (`zxnextTraceSetEnabled`,
   `frameTraceLayout.ts`) and the VHDL's bus tap are aligned on M1 cycles; the tool reports the first
   instruction where registers, a memory/port access, or the cycle count differ.
2. **Frame diff:** the VHDL's RGB stream assembled into a 720×288 frame, compared pixel-exact with
   Klive's frame; the tool reports the first differing pixel with its line/HC.
3. **Seeded generators** (the retired PAR-001/002 idea, now against O2 instead of a second emulator):
   random NextReg/port sequences, random Copper lists, random sprite/layer/clip/scroll/palette
   set-ups, random DMA programs, random Z80N instruction streams. Each seed that diverges becomes a
   minimised regression test in `test/zxnext-hw/` with its expectation taken from the simulation.
4. **The CPU:** the single-instruction differential (§8, F1) is the first and main answer to W4.
   ZEXDOC/ZEXALL and z80test on the CPU testbench, to produce the T80N's own CRCs, are optional
   (§8, L7): at the measured ≈ 350k T-states/s they take tens of hours per run.

Exit: every catalogue row is tagged in the ledger as **O2-confirmed**, **O2-corrected** or **vhdl: n/a**
with a reason; the generators run nightly-on-request in an `e2e-vhdl` tier (`build/e2e-tests.ts`) and a
manual "VHDL oracle" GitHub workflow in Docker.

## Phase 3: The hardware-verified kit (O3)

Goal: independent, real-board evidence without owning hardware (W3 partly, W4).

1. `vendor/next-tests/` with `kit.json` (like `vendor/spectrum-tests/`): `MrKWatkins/ZXSpectrumNextTests`
   pinned by commit, fetched and git-ignored, licence kept beside it; README records each program's
   board photos and the core version on each.
2. `test/next-kit/` in the slow tier: each program runs headless on the harness (direct NEX load) and,
   where it depends on NextZXOS state, through the browser tier / NextZXOS in node.
3. Judging, per the Spectrum kit's rule (no Klive goldens):
   - programs that report a result are asserted;
   - drawing programs: probes written **from the board photo** (colour bands, edge positions), plus an
     AI review prompt with the photo beside Klive's frame; the PNGs land in `.next-kit/` for by-eye
     comparison;
   - where the photo's core version differs from 3.02.01 and the pictures differ, record it in the
     version ledger rather than failing.
4. The z80test/ZEXALL CRCs from Phase 2c run here on the whole Next machine as well (memory paging,
   contention off, 3.5 and 28 MHz), against the T80N values.
5. Survey (½ day) for more hardware-verified Next material: NextZXOS distro test/demo programs,
   SpecNext forum threads with board measurements, the Next dev guide's worked examples. Add what has a
   real-board result.

Exit: every kit program has a verdict (match / differs-version / differs-bug) on the published page.

## Phase 4: The real-hardware loop (O1)

Goal: the strongest proof — the same test program on a real board and in Klive, results compared
automatically. Reference board: KS2 (issue 4), firmware v1.44, core 3.02.00.

0. **Version alignment (first, ½ day).** The pinned VHDL is 3.02.01, the board 3.02.00. Either
   (a) install a 3.02.01 core on the board so O1 and O2 are the same version; or (b) keep 3.02.00 and
   treat every O1/O2 disagreement as a version candidate until shown otherwise.
   Research (2026-10-24): (a) is the official release path. The System/Next **24.11** tag of
   `gitlab.com/thesmog358/tbblue` has a `TBBLUE.TBU` (2,687,488 bytes) whose header lists an issue 2
   core 3.02.00 and an **issue 4 core 3.02.01**; firmware 1.44.db. The repository's master branch has
   since moved to one multi-core TBU (10 MB, needs firmware 1.45, not in a release) offering issue 4
   cores **3.02.00 / 3.02.01 / 3.02.04** and an **issue 5 core 3.02.03**. So newer cores than the pinned
   VHDL exist, and the KS3 is probably issue 5. Neither newer core's source is in `_input/next-fpga/`.
   The 3.02.01 KS2 core also changed HDMI timing (`config.ini` `timing=0/1/7`; on it HDMI behaves
   like VGA-0), which matters for the capture in step 4. The 3.02 cores changed ULA timing (MiSTer port discussion), so timing rows are
   compared first. Record the decision and the board's `$01`/`$0E`/`$0F` readings in
   `.ai/zxnext/core-versions.md`. Keep the board's previous core image so it can be restored.
1. **Board runner** `scripts/next-board/`: packs a batch of result-protocol tests (Phase 2b.1) into one
   `.nex` that runs them in sequence, resetting the hardware state between them as the harness's
   `hardReset` does (NextReg `$02`), and writes each test's results area to a file on the SD card
   through esxDOS. The core version (`$01`/`$0E`) and board issue (`$0F`) are written into the file
   header.
2. **Transport:** SD card swap first (zero dependencies). The Wi-Fi push of
   `.plans/SEND_TO_NEXT_WIFI_PLAN.md` (draft, G6.5) can replace it later; this plan must not depend on
   it.
3. `npm run next:board-compare -- <results file>`: runs the same batch in Klive and diffs test by test.
   A board result that differs from the VHDL (O2) for the same core version is a board-level effect
   (SRAM timing, video encoder) and is recorded as such.
4. **Picture — no capture device** (decided by the author, 2026-10-24: no HDMI capture hardware will be
   bought; a MacBook has no video input). The picture evidence is split three ways:
   - *What the board can measure itself* is measured by the program, not looked at: raster timing
     through `$1E`/`$1F` and line interrupts, ULA fetch timing through the floating bus, sprite overlap
     through the collision flag, and everything stored in memory (Layer 2, tilemap, sprite and palette
     RAM, read back where the hardware allows). These results go to the SD card like any other.
   - *Pixel exactness* (layer priority, blend modes, palette and transparency results, Copper and
     scroll positions to the pixel) comes from **O2**, the simulated VHDL, which outputs the exact RGB
     stream. Phase 2 is therefore the pixel oracle; it is not cross-checked by a board capture.
   - *Real-board confirmation* is by **phone photo** of the monitor, judged as the Spectrum kit judges
     real-machine photos: by eye and by AI review beside Klive's frame, never as a pixel golden. Test
     pictures are designed for it: large flat colour areas, a printed test ID and core version on screen,
     and edges marked with contrasting rulers, so a photo settles "same colour, same order, same line"
     without pixel accuracy.
5. **Sound — no capture device either** (a MacBook's headphone jack takes only a headset microphone).
   Pitch and timing are checked from a **phone recording** of the board's speaker or headphone output:
   the test plays known tones and patterns, and a script measures frequency (within the settled 1 %)
   and the order and length of events. Level ratios and mixer behaviour, which a microphone cannot
   measure reliably, come from O2 (the simulated `audio_mixer.vhd` output).
6. **Timing on the board:** the tact-exact measurements (VT-006, ULA-007, SPD-002, MEM-023) are written
   in the self-measuring form the harness README describes ("Measuring to the tact": binary-searched
   delays read by one IN), so the board measures itself and the number is compared directly.
7. Pixel goldens for the screen cases come from **O2** (G1). Board photos are kept beside them as
   evidence (`.next-board/photos/`, git-ignored; selected ones published), not as goldens.
8. **Two boards (KS2 + KS3).**
   - *On arrival:* run a "board identity" `.nex` on the KS3 that records `$00`, `$01`, `$0E`, `$0F`, the
     firmware version and the Xilinx DNA/XADC readings (`$F0`–`$FA`). If `$0F` is neither issue 2 nor
     issue 4, `_input/next-fpga/` has no top for it. Then find the matching core source before any
     KS3-vs-VHDL comparison, and check that Klive's issue-4 behaviours (`$10`, `$F0`–`$FA`, the
     speaker DAC) still hold for it.
   - *Board-to-board check:* the same board-runner batch runs on both boards. A result where the two
     boards disagree on the **same core version** is a board-level effect (memory chip, video output,
     audio path), recorded as such and never used as a golden. A result both boards agree on is the
     strongest evidence this plan can produce.
   - *Version split:* one board stays on the core matching the pinned VHDL, as the fixed reference.
     The other follows new core releases, so the version ledger (W5) is filled by measurement, not
     guesswork.
   - Every O1 result names the board it came from (`KS2` / `KS3`) as well as the core version (G2).

Exit: the priority-1 rows of every area have a board result; the published page shows board vs Klive
per row, with core version.

## Phase 5: Real software (PAR-007)

1. A corpus of freely distributable Next software, each with its licence/permission recorded: the
   programs bundled with the NextZXOS distribution, plus titles whose authors agree (§9 Q4).
2. Boot through NextZXOS from a cloned CIM in node (the README's "Candidates" recipe, which already
   worked ad hoc), drive with scripted keystrokes, capture frames at fixed frame numbers.
3. No pixel goldens: simulating minutes of a game in the VHDL is too slow, and there is no capture
   device. Each title gets smoke checks (reaches the title screen, no crash, no CPU stuck in a loop,
   audio not silent) and a by-eye comparison with a phone photo of the same screen on the board.
4. A compatibility table (title, version, result, notes) for the published page.

## Phase 6: Strength of the suite and the known gaps

1. **Mutation testing** (`npm run next:mutate -- <file>`, on request): a script mutates the C core
   (comparison operators, off-by-one constants, dropped masks, swapped bit indices), rebuilds, runs the
   area's `test/zxnext-hw` folder, and reports survivors. Each survivor is a behaviour no test pins;
   it becomes a row, or the mutated code is shown equivalent.
2. **The open rows and W8:** for each — Copper tick-for-tick, UART interrupt sources (INT-012),
   DMA interrupt hold-off (INT-018), HALT wake timing (INT-021), interrupt-acknowledge vector
   (INT-022, needs the `intack` session method), EAR input (BEEP-005/006, needs `tape`), CMD25
   (SPI-006), the bus `/NMI` (NMI-007), `$A0`/`$A2` pin takeover — decide **model it** (with the Phase 2
   simulation as the expectation) or **document it** as a known difference (G4).

## Phase 7: Publish and keep it honest

1. Docs page `under-the-hood/emulator-internals/next-accuracy` beside the Spectrum one (G10.2):
   the ledger's coverage per area and oracle, the O2 agreement figures, the kit's verdicts with board
   photos beside Klive's frames, exerciser CRCs, board results (Phase 4), the real-software table, and
   the known differences with causes. Published pictures are regenerated by the slow tier and fail it
   when they drift (the Spectrum page's `PublishedPictures` mechanism).
2. Landing-page "accuracy" feature extended to the Next (`docs/landing/features.ts`, with `since`).
3. Standing instructions: mark G10.2 done in `.plans/CLOSING_THE_GAPS_PLAN.md` and update §2/§4 of
   `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` in the same change; one changeset (`feature`) for the
   published page when the plan completes, none for intermediate phases.
4. `.ai/zxnext/fidelity-guide.md`: how to run each oracle, how to add a test to the ledger, how to
   resolve an oracle disagreement — so later sessions keep the evidence current.

---

## 8. Order: the fast track first

Reviewed 2026-10-24 at the author's request. **Start with the tests that find a compatibility issue in
the least time and run with no human in the loop.** A step qualifies for the fast track when it is
fully automatic once written (no board, no SD card swap, no photo, no listening), its runs take
minutes, and each mismatch it reports is a concrete, reproducible input. Steps needing the board or a
person come after it, as do steps that measure gaps instead of finding differences.

**Speed measured on the author's Mac** (nvc 1.23.0, 2026-10-24), which sets the order:
- the T80N CPU alone, with a flat 64K RAM, simulates **≈ 350,000 T-states per second** at 3.5 MHz,
  about a tenth of real time;
- the whole core elaborates in ≈ 0.3 s. Its run speed is not measured yet; it is far slower than the
  CPU alone (the 28 MHz domain, video and every device run each clock). Measuring it is part of F3.

### Fast track (automatic, ordered by time to the first finding)

| # | Step | From | Time to build | Run time | Why it finds issues fast |
|---|---|---|---|---|---|
| F1 | **T80N single-instruction differential** | new (Phase 2c) | ½–1 day | ~30 s per 100k cases | The CPU is where every program starts, the simulation is fast, and undocumented behaviour is where emulators usually differ. |
| F2 | **Kit programs that judge themselves** | Phase 3 (part) | ½ day | minutes | Hardware-verified programs, no simulator needed at all. |
| F3 | **Whole-core testbench + short catalogue replays** | Phase 2a + 2b (part) | 1–2 days | seconds–minutes each | Re-checks the expected values of ~480 existing tests in the executed VHDL; most non-picture tests need only microseconds to a few frames of machine time. |
| F4 | **Seeded generators, short runs** | Phase 2c (part) | 1 day | minutes per batch | Finds what no test was written for: random NextReg/port/MMU/DMA/CTC/IM2/Copper-MOVE sequences, compared by write logs and read-backs. |
| F5 | **Kit drawing programs, AI-reviewed against the published board photos** | Phase 3 (rest) | ½ day | minutes | Real-board pictures that already exist, compared without a person. |
| F6 | **Full-frame pixel diffs** | Phase 2c.2 | 1 day | depends on F3's speed figure | The picture to the pixel, once the frame cost is known and the RAM models are checked. |

**F1 — the first step.** A testbench drives the T80N alone (`cpu/t80na.vhd`, a flat RAM, I/O reads
from a seeded table) and Klive runs the same case on the Next machine through the harness (`loadCode`,
`step`, `registers`, `tacts`; 3.5 MHz, contention off).
- *Each case* is a short prologue that loads every register and flag (including the undocumented
  bits 3 and 5 of F), one instruction under test, and an epilogue that stores the registers to memory.
- *Compared:* all registers and flags, the memory and port writes with their addresses and values,
  the instruction's T-states, and the bus-cycle sequence (M1, memory, I/O, refresh).
- *Cases:* every opcode — unprefixed, `CB`, `ED` (including the Z80N set), `DD`/`FD`, `DDCB`/`FDCB`
  — with random register/flag states, plus targeted edge cases (block instructions with BC = 1,
  `SCF`/`CCF` after flag-setting and non-flag-setting instructions, interrupt acceptance after
  `EI`/`HALT`).
- *Output:* the first differing case, as a ready-to-paste `test/zxnext-hw/cpu/` test with the
  expectation taken from the simulation (G1).

  This replaces the Z80 exercisers as the first CPU check. ZEXALL and the z80test suite run billions of
  instructions, which at the measured speed means tens of hours in the simulator. They move to the
  later track, optional.

#### F1 run specification (recorded 2026-10-24, before the first run)

The author accepted the fast track with four constraints: the exact number of tests is calculated
and recorded here before running; a passing result comes with evidence; a run more than 10 % slower
than ~30 s per 100,000 tests stops after 5 minutes; progress (percent done and forecast finish) is
reported every 5 minutes.

**Exact number of tests: 115,854**, from `node test/vhdl/f1/generate-cases.cjs --count` (seed
`0x20261024`, which fixes every case):

| Set | How the count arises | Cases |
|---|---|---|
| Unprefixed | 256 − 4 prefixes (`CB DD ED FD`) − `HALT` = 251 opcodes × 64 | 16,064 |
| `CB xx` | 256 × 64 | 16,384 |
| `ED xx` | 256 − 2 (`ED 91`/`ED 92` NEXTREG, which act outside the CPU) = 254 × 64 | 16,256 |
| `DD xx` | 256 − 4 (`CB` is the next row; `DD ED FD` are prefix chains) − `HALT` = 251 × 64 | 16,064 |
| `FD xx` | as `DD` | 16,064 |
| `DD CB d xx` | 256 × 64 | 16,384 |
| `FD CB d xx` | 256 × 64 | 16,384 |
| *Random total* | 1,775 opcodes × 64 | *113,600* |
| `DAA` | every A (256) × every N/H/C combination (8) | 2,048 |
| Block instructions | 22 (16 Z80 + `LDIX LDDX LDIRX LDDRX LDPIRX LDWS`) × 5 counter edge values | 110 |
| `SCF`/`CCF` after none / a non-flag / a flag-setting instruction | 2 × 3 × 16 | 96 |
| **Total** | 113,600 + 2,048 + 110 + 96 | **115,854** |

**What one test is:** a prologue loads every register (I, R, both sets, IX, IY, SP, IM, IFF) from a
data block, then the instruction runs once (a repeating block instruction: one iteration). The T80N
and Klive must agree on:
- every register, including the undocumented flag bits;
- IFF1, IFF2 and IM;
- the next PC;
- the T-states the instruction took;
- every memory byte it changed.

I/O instructions use a port `$xxFE`, so reads return a fixed value. Port *writes* are not compared:
the harness has no I/O log yet, and F4 covers ports.

**Case revision 2 (2026-10-24, before the fix's runs; the count stays 115,854).** The first measured
run's set hid two things:
- *MEMPTR was never random.* The prologue's final `JP $8020` always left MEMPTR = $8020, so
  `BIT n,(HL)`'s flag bits 3/5 matched by coincidence. The prologue now ends by falling into $8020,
  with `LD A,(nn)` (random nn) setting MEMPTR beforehand.
- *Single-port I/O read one constant.* It read $BF, whose odd parity hid that Klive's `IN r,(C)` never
  sets P/V. The single-port I/O instructions (`IN r,(C)`, `OUT (C),r`, `IN A,(n)`, `OUT (n),A`,
  `JP (C)`, `OUTINB`) now use port $253B. On Klive it reads NextReg $7F, which each case sets to a
  random value; the testbench returns the same value. Block I/O keeps port $xxFE ($BF), because B is
  part of its port.

**Bring-up runs** (getting the testbench and the runner to work) use a fixed sample: the first case of
every opcode, **1,775 cases** (`--sample`). That is at most 10 runs, so at most 17,750 executions; the
evidence reports how many there were. They are not the measured run.

**Time rule:**
- *Measured:* wall time from launching the simulator shards and the Klive runner to the end of the
  comparison. Generation, VHDL compilation and elaboration are excluded but reported.
- *Expected:* 30 s per 100,000 tests, so **34.8 s** for the full run.
- *Limit:* more than 10 % slower means a rate worse than 33.0 s per 100,000 (over 38.2 s projected).
  Such a run is stopped at 5 minutes if it has not finished, and the evidence records how far it got.

**Progress:** every 5 minutes, the percentage of tests done and the forecast finish time. The forecast
comes from the measured rate so far.

**Evidence of a pass:**
- *Report:* `test/vhdl/f1/results/<date>/report.md`, with the versions and hashes of every input
  (VHDL files, case file, WASM core, nvc), the executed count against the 115,854 above, and pass
  counts per set and group.
- *Negative control:* the comparator, run on a copy of the results with deliberately corrupted values,
  reports exactly those as mismatches. This proves a "0 mismatches" result is not a comparator that
  sees nothing.
- *Capture check:* for a sample of cases, the testbench's captured pre-state equals the data block it
  was given. This proves the registers were loaded and read back.

#### F1 result (measured run, 2026-10-24 21:04)

**Verdict: DIFFERENCES.** The run itself is valid:
- *Count:* 115,854 of 115,854 tests generated, executed on both sides and compared.
- *Time:* 25.6 s (22.1 s per 100,000, inside the 30 s target), so the stop rule did not apply.
- *Controls:* the negative control found 5 of 5 injected differences, and the capture check passed
  64 of 64.
- *Evidence:* `test/vhdl/f1/results/2026-10-24T19-04-05-full/report.md`, git-ignored and reproducible
  from the seed.

**Bring-up before it:** 4 runs, 5,327 test executions in total. Run 1 had 2 cases; runs 2–4 had the
1,775-case sample each. On top of that came 2 single-case traces on the T80N alone and one timing run
of the sample on Klive alone (1,775). Bring-up found and fixed two **testbench** artefacts:
- *IFF was sampled too early.* The T80N applies EI/DI/RETN during T2/T3 of the *next* fetch, so I,
  R, IFF and IM are now read at the end of the epilogue.
- *The read address was not held.* The T80N can move the address bus during a read (LDPIRX). Reads
  now use the address at the start of the read, as the core's SRAM request does
  (`zxnext.vhd` ~3150–3165).

**Agreement:**
- *All 100 %:* the 16,064 unprefixed tests, the `CB`, `DD` and `FD` sets, all 2,048 `DAA`
  combinations and the 96 `SCF`/`CCF` cases (Q). That covers the registers, the T-states, PC,
  memory, IFF, IM, I and R.
- *Where they differ:* **7,768 tests, all in flags, except `ED B6`:**

| # | Instructions | Tests | What differs (T80N vs Klive) |
|---|---|---|---|
| D1 | `BIT n,(IX+d)` / `BIT n,(IY+d)` (DDCB/FDCB 40–7F) | 6,143 | flag bits 3/5 (Klive takes them from the high byte of IX+d, the Zilog MEMPTR rule) |
| D2 | `IN r,(C)` (ED 40…78) | 384 | flag bits 3/5 |
| D3 | `LD A,I`, `LD A,R` | 98 | flag bits 3/5 |
| D4 | `CPI CPD CPIR CPDR` | 216 | flag bits 3/5 |
| D5 | `INI IND INIR INDR` | 274 | H, P/V, C |
| D6 | `OUTI OUTD OTIR OTDR` | 257 | N, H, P/V, C |
| D7 | Z80N `LDIX LDDX LDIRX LDDRX LDPIRX` | 332 | the T80N changes flags; Klive leaves F unchanged |
| D8 | `ED B6` | 64 | the T80N executes **LDIRSCALE** (an undocumented Z80N copy, 21 T-states, writes memory, changes HL/DE/BC); Klive runs it as an 8 T-state NOP |

#### F1 fix and re-run (2026-10-24 21:22) — **PASS**

The author chose a Next-only build variant of the shared core over a separate Z80N implementation.
- *The variant:* `Z80_T80N`, defined in `zxnext-cpu.c`, makes `z80.c` follow the T80N for D1–D8. The
  rules were read from `t80n*.vhd` and first checked offline against the simulator's results of the
  first measured run, where they predicted every affected case.
- *Two more differences* surfaced after case revision 2:
  - **D9, PIXELDN at the bottom row:** the T80N wraps the pixel row from 255 to 0 without touching
    H7–H5; Klive carried into H5. Fixed for every core, as PIXELDN is Z80N-only.
  - **LDPIRX's flags** use B after BC's decrement, which differs only when C = 0.
- *The case revision* (random MEMPTR, a random single-port I/O value) also exposed `BIT n,(HL)`
  (part of D1) and `IN r,(C)` parity (part of D2).

**Measured run 3: PASS.**
- *Result:* 115,854 of 115,854 tests compared, **0 mismatches**, 26.7 s (23.1 s per 100,000).
- *Controls:* the negative control found 5 of 5 injected differences; the capture check passed 64 of 64.
- *Evidence:* `test/vhdl/f1/results/2026-10-24T19-21-40-full/report.md`.
- *Measured runs so far:* run 1 (7,768 mismatches, before the fix), run 2 (2 mismatches: D9 and
  LDPIRX with C = 0), run 3 (0).
- *Bring-up:* 3 more sample runs (5,325 executions), so 7 in all, within the limit of 10.

**Other suites:**
- *Shared Z80 corpus:* `test/wasm/z80` (built without the define) passes 1,483 of 1,483.
- *`npm run test:fast`:* 26,147 tests pass. The one failure was an HT-1080Z test timing out under
  load; it passes alone, 11 of 11.
- *Type check:* `npm run build:check` reports no new type errors.

**Open, outside this fix:**
- *ZX Spectrum `IN r,(C)` parity:* Klive's Zilog path (WASM and TypeScript CPUs) never sets P/V for
  `IN r,(C)`, which a Zilog Z80 does. That is a ZX Spectrum bug too, left for its own change.
- *Confirming on hardware:* a check of D1 and D8 on the author's KS2 (core 3.02.01) is still worth doing.

**Before changing Klive** (written before the fix):
- *Klive's Z80 core is shared.* It is also the ZX Spectrum's CPU, whose Zilog behaviour the Spectrum
  timing suites confirm. A fix has to make the Next's CPU follow the T80N without changing the other
  machines.
- *The oracle is VHDL 3.02.01.* A short program on the author's KS2, once it runs core 3.02.01, can
  confirm one case of each of D1–D8 on the real board before the core is changed.

**F2–F5 need no simulator speed beyond F3.** F2 and F5 run on Klive alone. F3 doubles as Phase 2a's
go/no-go measurement: tests are replayed shortest first, and the frame cost decides how far into the
frame-heavy areas F3 and F6 go. Until the Xilinx RAM models are checked (Phase 2a), sprite and tilemap
results in F3, F4 and F6 are reported but not used as expectations.

#### F3 run specification (recorded 2026-10-25, before the measured run)

The same four constraints as F1 (count first, evidence, the 10 % / 5-minute rule, progress every
5 minutes), plus the author's request for frequent progress reports with a forecast finish.

**What F3 is, as built** (`test/vhdl/f3/`, `node test/vhdl/f3/run-f3.cjs`):
- *The testbench (`tb_next.vhd`):* `zxnext.vhd`, unchanged, wired as `zxnext_top_issue4.vhd` wires
  it:
  - aligned 28/14/7 MHz clocks, the CPU clock chosen by the core's speed output, `CLK_3M5_CONT`
    contention, the AY enable;
  - the soft-reset sequencer and the SRAM controller.

  Models (`models.vhd`, written for the testbench) stand in for the Xilinx RAMs, the boot ROM and a
  preloadable `dpram2`.
- *Speed, measured:* boot plus one 50 Hz frame takes 9.4 s; a frame alone takes about 8.5 s, roughly
  1/400 of real time.
- *The programs:* every program the hardware tests load. Running `test/zxnext-hw` with `F3_CAPTURE`
  records them: 114 files, 1,516 tests, 3,074 loads, **1,070 unique programs**.
- *Each replay starts both machines from the same state:*
  - *Memory:* Klive's memory right after `loadCode`.
  - *Boot:* a firmware stand-in leaves config mode at Klive's machine type and timing (`$03` = $33)
    and soft-resets. The start code then sets the registers NextZXOS's firmware sets (`$05`, `$06`,
    `$08` as Klive has them), clears the interrupt status (`$C8`, `$C9`), and runs DI / LD SP / JP entry.
  - *Raster:* the CPU is released so the program's first fetch lands at line 0, HC 0, where Klive
    starts it. The raster runs through resets; the release point, line 310 HC 165, was calibrated
    once.
- *The comparison:* right after the instruction that writes the ready marker ($A5 to `$7F`).
  Klive stops there with `runToNextRegWrite`; the testbench stops at the next M1. Compared:
  - the time from the first fetch, in T-states;
  - PC, A, F and SP;
  - every NextReg through the core's own read mux, except the raster counters `$1E`/`$1F` and Klive's
    deliberate identity (`$00` = $08 "emulator", `$0E` sub-version);
  - all RAM from $40000, with banks 5 and 7 taken from the core's block RAM.

**Exact count:**

| | Programs |
|---|---|
| Captured, unique | **1,070** |
| Replayed on both machines (reach the ready marker on Klive within 8 frames) — **the F3 tests** | **895** |
| Not replayable: never write the marker themselves (their tests drive them from outside) | 170 |
| Not replayable: need an SD card image (SPI-004/005/006/010/011) | 5 |

The 895 runs need **1,232 frames** on Klive's clock: 649 programs take 1 frame, 199 take 2, 32 take 3,
4 take 5, 8 take 6 and 3 take 7.

**Expected time:**
- *Phase 4 (simulator), 10 jobs:* 1,232 frames plus about ½ frame of boot wait per run gives
  ≈ 1,680 frames. At 8.5 s each, divided by 10, that is ≈ 24 min, plus ≈ 15 % for 10 simulators at
  once: **27 min (1,620 s)**.
- *Phases 1–3 and the comparison:* about 2–3 min.
- *Total:* **≈ 30 min**.
- *Limit:* 10 % over phase 4 is 1,782 s. At the 5-minute mark the forecast, from frames simulated so
  far including runs in flight, is checked; over the limit, the run stops (`--expect 1620`).

**Measured run 1 (05:41) — STOPPED by the 5-minute rule.** The forecast for phase 4 was 2,502 s against
1,620 s expected. 10 simulators at once ran about 2× slower each than one alone; my estimate assumed
15 %. 44 runs finished. Their differences exposed two measurement errors, both fixed in bring-up
runs 8–11 (34 executions):
- *Wrong counters.* The testbench timed the start on `zxnext`'s `hc`/`vc`, which are the ULA's
  display-relative counts. It now uses `zxula_timing`'s raw frame counters, where the interrupt
  position is defined and which Klive's line/HC are. The release point is now line 310, HC 205; the
  first fetch lands at exactly line 0, HC 0.
- *Wrong time measure.* Klive's tacts count CPU T-states at the current speed, so they are not time.
  The stop time is now compared as (frames since the first fetch, raw line, HC) on both machines.

**Revised expected time (recorded 05:58, before measured run 2):**
- *Phase 4:* **2,500 s (≈ 42 min)**, from run 1's measured rate.
- *Total:* ≈ 45 min.
- *Limit:* 2,750 s; the 5-minute check uses `--expect 2500`.

The count is unchanged: **895** simulator runs out of 1,070 programs.

**Measured run 2 (05:56–06:57) — complete, verdict DIFFERENCES.**
- *Time:* 895 of 895 simulator runs in 3,672 s, 47 % over the recorded 2,500 s.
  - The 5-minute check forecast 2,376 s and passed.
  - The forecast weighted progress by frames and left out each run's fixed boot (about one frame of
    waiting for the release point). That overhead dominates the many 1-frame runs at the end. A
    later forecast must count runs too.
- *Results:* `test/vhdl/f3/results/full-2/report.md`.

| Result | Programs |
|---|---|
| Compared | 893 |
| …differing only in `$81` bit 7 | **728** |
| …with other differences | 165 |
| Did not reach the marker in the VHDL: SPD-005 (expansion bus on), SPI-003 (no SD card) | 2 |
| Not replayed: no marker on their own (170), need an SD image (5) | 175 |

- **`$81` bit 7 (all 893).** The core reads `i_BUS_ROMCS_n` raw (`zxnext.vhd` ~6072), so an idle
  expansion bus reads **1**. nextreg.txt documents it as "1 if asserted", and Klive reads 0. This is a
  documentation-versus-VHDL conflict; the board can settle it.
- **The other 165**, by test file:

| Test file | Programs | Mostly |
|---|---|---|
| `video/video-timing` | 65 | `$22` bit 7 (ULA interrupt active at the stop, 41) and measured values in memory/A |
| `speed/cpu-speed` | 19 | stop a few HC earlier in the VHDL |
| `uart/uart` | 16 | stop a few HC earlier in the VHDL |
| `memory/contention` | 16 | stop a few HC earlier in the VHDL; 2 by whole frames |
| `sd/sd-card` | 10 | stop lines apart (no card in the testbench) |
| `dma/dma` | 6 | stop a few HC later in the VHDL |
| 17 others | 1–5 each | `$C8` (11), `$C2` (7), `$4A`, `$20` |

Not every difference is a Klive bug. Each group is triaged against the testbench's own
simplifications first:
- the plain CPU clock mux on speed changes (the board's BUFGMUX switches glitch-free);
- the idle UART, SD and expansion-bus lines;
- the Xilinx RAM models for sprites and tilemap.

Only then are they recorded as findings with a minimal program each.

**Bring-up before it:**
- *Sample runs:* 7 runs of a 6-program sample, 35 simulator executions, which calibrated the start
  state; then runs 8–11 above.
- *Plus:* one speed measurement and one plan-only pass (Klive only).

**Evidence:**
- *Report:* `test/vhdl/f3/results/<run>/report.md`, with verdicts per program, the differences grouped
  by kind with the tests they come from, input hashes, and per-program files.
- *Proof the comparison sees differences:* the sample runs already show it detecting real ones, such
  as `$81` bit 7 and a 14,640 T-state contention gap.

**What happens to a finding:** the step writes the mismatch, the seed and the minimised program into
`.next-fidelity/findings/` (git-ignored). Deciding whether it is a Klive bug, a misread VHDL or a test
error is the normal bug-fixing work, not part of the automatic run.

### Later track

| # | Step | Phase | Why later |
|---|---|---|---|
| L1 | Evidence ledger | 0 | Measures coverage gaps; finds no difference by itself. Cheap, and useful for choosing F4's generators. |
| L2 | Code coverage of the C core | 1 | Same: points at untested code, then needs new tests. |
| L3 | Catalogue replay of the remaining (frame-heavy) tests | 2b (rest) | Bound by the whole-core speed. |
| L4 | Board runner and comparisons | 4 | Needs SD card swaps, photos and recordings by a person. |
| L5 | Real software | 5 | Needs NextZXOS boots, a corpus decision (§9 Q4) and photos. |
| L6 | Mutation testing, known gaps | 6 | Slow (a rebuild per mutant); strengthens the suite rather than finding differences. |
| L7 | Z80 exercisers in the simulator | 2c.4 | Tens of hours per run at the measured speed; F1 covers the same ground faster. |
| L8 | Publish | 7 | When the evidence is in. |

F1 and F2 are independent and can run in parallel sessions; F3 needs F1's testbench conventions only
loosely, and can start alongside.

**Definition of done** ("as close to the real hardware as can be shown"):

- every catalogue row is O2-confirmed (or `vhdl: n/a` with a reason), and the generators find no new
  divergence over an agreed seed budget;
- the T80N single-instruction differential (F1) finds no divergence over an agreed case budget
  covering every opcode;
- every kit program has a verdict, and every difference is explained;
- if a board is available: every priority-1 row has a matching board result for a named core version;
- every remaining difference is listed publicly with its cause.

## 9. Open questions for the author

1. **Hardware:** ✅ answered 2026-10-24 — KS2 (issue 4), firmware v1.44, core 3.02.00. Still open:
   may the board be moved to core 3.02.01 for the comparison (Phase 4 step 0), or should a 3.02.00 VHDL
   be found and pinned beside the current one? A KS3 is on its way. Which board stays on the pinned
   core and which follows new releases (Phase 4 step 8)?
2. **Capture:** ✅ answered 2026-10-24 — no capture hardware. Pixel evidence comes from O2 and board
   self-measurement, board confirmation from phone photos and recordings (Phase 4 steps 4–5).
3. **Tools:** ✅ nvc installed on the Mac (2026-10-24); the full core already elaborates (Phase 2a).
   Still open: may a **manual** GitHub workflow install nvc (`nickg/setup-nvc`) and run GHDL from a
   pinned `ghdl/ghdl` release image? GHDL stays off the Mac unless you choose to override Gatekeeper
   for it.
4. **Corpus:** which Next titles may be used for the real-software tier (and published as pictures)?
5. **Vendoring:** OK to pin `MrKWatkins/ZXSpectrumNextTests` (MIT) in `vendor/next-tests/` like the
   Spectrum kit, and to show its board photos (with credit) on the docs page?

## 10. Sources

- `_input/next-fpga/src/` (core 3.02.01), `_input/next-fpga/nextreg.txt`, `ports.txt`.
- `.plans/ZX_SPECTRUM_NEXT_HARDWARE_TEST_CATALOGUE_PLAN.md`, `test/harness/zxnext/README.md`.
- Archived `SPECTRUM_ULA_ACCURACY_PLAN.md` (git `0b98eaa49a`), `vendor/spectrum-tests/`, `test/spectrum-kit/`.
- MrKWatkins, ZX Spectrum Next tests: https://github.com/MrKWatkins/ZXSpectrumNextTests
- Patrik Rak's Z80 test suite and its use as an emulator reference: https://github.com/redcode/Z80/wiki/Z80-Test-Suite
- The Next core source layout and its ISE build: https://github.com/avlixa/zx_spectrum_next_03.01.09
