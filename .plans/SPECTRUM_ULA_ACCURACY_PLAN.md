# ZX Spectrum ULA Accuracy Plan

Status: **in progress** (2026-10-23). Phase 0 step 1 done: the test programs are in
`vendor/spectrum-tests/` (see its `README.md` and `kit.json`). Nothing else implemented yet.

**The author's answers (2026-10-23)**, which this plan now follows:

1. There are no page references to Chris Smith's book. The book stays a source, read by chapter, but
   no step waits for page references.
2. There is no real hardware. The test programs are run in Klive. The hardware's behaviour comes from
   published real-machine results: the wiki pages' photos and videos of each test on real machines,
   the test programs' own PASS/FAIL output, and the photos shipped with the programs (HALT2INT's
   `Real 48k (early).png` and `Real 48k (late).png`).
3. Each phase that changes behaviour gets its own changeset.
4. Snow gets an on/off switch.
5. The test programs are committed to the repository, not fetched, because they are run often.

This plan closes the gaps listed in the review of the docs article
`docs/content/en/under-the-hood/emulator-internals/spectrum-display.mdx` ("Drawing late, but at the
right moment"), where Klive's Spectrum display was found to be T-state based but not proven
pixel-exact. The author's answers to that review set the scope:

| # | Gap | The author's decision | Phase |
|---|---|---|---|
| 1 | A write or an `OUT` takes effect at the end of its bus cycle; the catch-up draws the current T-state with the old value | Fix what can be fixed | 2 |
| 2 | The border can change every T-state (2 dots) | Check, confirm, fix | 1 |
| 3 | The floating bus offset is a calibration without a test | Verified by the author with RAMSOFT's FloatSpy on the 48K and the 128K; keep it that way | 3 |
| 4 | One ULA timing; real machines differ by one T-state ("early"/"late") | Implement | 4 |
| 5 | No snow | Implement | 5 |

Phase 0 builds the test kit every other phase is verified with. Phase 6 brings the docs up to date.

---

## 0. Ground rules

- **Facts come from hardware sources and test programs, never from another emulator's code.** Klive
  is MIT-licensed; Fuse and most other accurate emulators are GPL. Their *source* may be read to find
  out what a test expects or how hardware behaves, the *code* is never copied or translated. Results
  are recorded in Klive's own words with the source named.
- **The order of authority:** (1) results captured on real machines: the test programs' published
  real-hardware photos, videos and PASS/FAIL results (the ZXE wiki pages, the photos shipped with
  the programs), (2) Chris Smith, *The ZX Spectrum ULA: How to Design a Microcomputer* (2010), which
  the author owns, (3) published hardware documents (World of Spectrum FAQ, Sinclair Wiki, the ZXE
  wiki). Where sources disagree (Phase 4 has a case), real-machine results decide. A golden is never
  recorded from Klive's own output and then trusted; it is checked against a real-machine result
  first.
- **Every phase ends with a test that fails without the change**, in the harnesses
  (`test/harness/sp48/`, `test/harness/sp128/`), not with a new mock. Tests that run a core go into
  `build/e2e-tests.ts` (AGENTS.md); whole test-program runs are slow-tier.
- **FloatSpy must keep passing** after every phase (Phase 3 makes that automatic).
- **Replays stay deterministic.** RZX playback and the reverse-debugging journal replay the machine;
  a timing change alters what a replay produces, so `test/wasm/reverse/journal-replay-determinism`
  and the RZX tests run after every phase, and the debug-loop equivalence test
  (`test/wasm/debug-loop-equivalence.test.ts`) after any change to how the core advances T-states.
- **Every model is checked**: 16K, 48K (PAL, NTSC), 128K, +2 (ULA machines); +2A/+3/+3E (gate array);
  Timex, Pentagon, Scorpion (their own rules). A fix written for the 48K states what it does on each.
- **Changesets:** the five gaps are independent deliverables, so **each phase that changes behaviour
  carries its own changeset** (Phase 1 and 2: `fix`; Phase 4 and 5: `feature`; Phase 0, 3 and 6:
  `internal`). This departs from the one-changeset-per-plan default of AGENTS.md, by the author's
  decision (answer 3).

---

## 1. What is known so far

### 1.1 The border changes once per 8 dots (gap 2: confirmed)

The World of Spectrum 48K FAQ: *"you cannot change the border within a 'byte', an 8-pixel chunk"*,
and *"if you execute an OUT to Port 0xfe such that the OUT ends when 14339, 14340, 14341 or 14342 T
states have passed since the ULA pulled /INT low, the border will change at exactly the position of
byte 16384 of the screen"*. So the ULA takes the border colour once per **4 T-states**, and an `OUT`
ending anywhere in a 4 T-state window lands on the same 8-dot chunk.

Klive today: `sp48WritePort` (`zx-spectrum-ports.c`) catches the picture up to the current T-state
and switches the colour, and `renderUlaTact` paints every T-state (2 dots) with the colour of the
moment. Two differences follow:

- **Resolution:** Klive changes the border at 2-dot resolution; the hardware at 8.
- **Position:** with the display chunk of `$4000` drawn at frame T-state 14,336 in Klive's tables, an
  `OUT` ending at 14,339 shows from Klive's T-state 14,340 (4 to 8 dots late), and one ending at
  14,342 from 14,343: the hardware shows both from the start of the chunk. Klive's border changes are
  therefore up to about 7 T-states (14 dots) to the right of where the hardware puts them. To be
  confirmed by Phase 0's border tests before the fix (the analysis rests on Klive drawing the chunk of
  `$4000` at 14,336; Phase 2 may move what is drawn when, so the border offset must be fixed against
  the final display timing).

### 1.2 When the ULA reads, and when a write lands (gap 1)

- The documented contention starts at 14,335 with 6, 5, 4, 3, 2, 1, 0, 0 (WoS FAQ; Klive matches,
  `contentionValues` in `Sp48ScreenConfig`). That window, 14,335–14,340, is when the ULA holds the
  screen memory.
- Klive's tables fetch the first cell's bitmap byte at **14,334** and its attribute at **14,335**
  (`pixelDataPrefetchTime` 2, `attributeDataPrefetchTime` 1), and the second cell's at 14,336 and
  14,337. The bitmap fetch at 14,334 sits **outside** the contention window, where the CPU may still
  be writing to the screen memory. That cannot be right on the real machine, where the ULA reads only
  while it holds the bus; it can change which of two values a beam-racing write shows.
- The Z80 core applies a memory write after the whole 3 T-state cycle (`writeMemory` in `z80.c`:
  `delayMemoryWrite`, then `Z80_WRITE_MEMORY`), and an `OUT` after the whole 4 T-state I/O cycle. On
  the hardware, the data is on the bus from the cycle's second T-state.
- `renderUlaUntilCurrentTact` draws up to and **including** the current T-state with the old memory.

Each of these is at most a T-state or two, and matters only to code that writes a cell or the border
within a T-state or two of the ULA reading it: multicolour engines, beam-racing demos, the timing test
programs. The exact read times are in Chris Smith's book; they are not in any free document found.

### 1.3 The floating bus (gap 3)

`sp48ReadFloatingBus` returns the byte of the fetch phase **5 T-states** before the current one. The
author ran RAMSOFT's FloatSpy on Klive's 48K and 128K, and both pass. Phase 2 moves fetch times, so
the offset must move with them, and an automatic test must hold it.

### 1.4 Early and late timings (gap 4): the sources disagree

- **World of Spectrum FAQ** (May 2004 findings): *"Some machines use the timings given in this FAQ,
  while others are one T state later for all timings."*
- **Sinclair Wiki, Contended memory:** late timing is the documented figures plus one; a warm ULA
  drifts from early to late, a machine switched on cold always shows early timing; gate-array
  machines (+2A/+3) do not do it.
- **ZXE wiki (redcode), "Late timings"** (findings by Marta Sevillano Mancilla, May 2025): on the
  16K/48K, *"The INT signal begins 1 T-state earlier if /RFSH is low"* (with a condition on the
  preceding T-state); on the 128K/+2 the INT signal begins one T-state earlier, common on the grey
  +2. It describes only INT moving, and says some machines are late when **cold**.

These are not the same model: "everything one T-state later" against "INT one T-state earlier, under
a condition". Relative to the frame interrupt both shift the screen and contention by one T-state, so
they agree on most observable results, but not on the conditional /RFSH case. Phase 4 starts by
settling this.

### 1.5 Snow (gap 5)

Sinclair Wiki, ZX Spectrum ULA: during the third and fourth T-states of an M1 cycle the Z80 drives
MREQ and RFSH with I (high byte) and R (low byte) on the address bus. With I in `$40`–`$7F`, the ULA
takes this as a screen-memory access. It halts the Z80 only on the first T-state of an M-cycle, so it
cannot stop the refresh; it does not drive its own address, but it still reads, and the byte it reads
is displayed. The ZXE wiki lists test programs for it (Snow, Snow48, Snow128N, Snow Contention, Snow
Hold, Snow R, IR Contention, IR Contention 128). The 128K "snow crash" has no documented cause and is
out of scope. Machines: 16K, 48K, 128K, +2; **not** +2A/+3/+3E, Timex, Pentagon, Scorpion. Klive
already applies the refresh cycle's IR contention (`wasm-contention.test.ts`, "48K M1 refresh applies
contention via IR address"); it does not alter the ULA's read.

---

## Phase 0: The test kit

**Goal:** run the community's timing test programs on Klive's cores, locally and repeatably, and keep
their expected results.

1. ✅ **The kit is committed** in `vendor/spectrum-tests/` (answer 5), one folder per program, archives
   extracted so every `.tap`, `.szx` and `.rom` opens directly in Klive. `kit.json` records each
   download's ZXE depot URL, size and SHA-256 and its licence as far as stated; `README.md` lists
   them. `.gitattributes` keeps the folder byte-exact (`-text`). The app never packages it.
2. ✅ **The programs** (ZXE wiki catalogue): ULA 48 Simple Test, ULA 128 Timing Test, ULA 128E +3 Test,
   Timing Test, ZX Spectrum Timing Tests 48K and 128K, Border Time, Screen Time, Floating Spy
   (FloatSpy), Float48K, Float128K, Snow, Snow Contention, Snow Hold, Snow R, Snow Tests, Snow48 (and
   its ten variants), Snow128N, ULA Snow Crash, IR Contention, IR Contention 128, HALT2INT, Time to
   First INT.
3. **Harness methods** (README "Adding a method"): `loadTap(path)` (ROM tape loading, fast), `screenPng()`
   / `screenHash()` of the whole picture including the border, `runUntilStable(frames)`. Each with a
   self-test.
4. **Expected results.** For each program: what the program itself reports (many print PASS/FAIL or a
   table), and where it only draws, a screen golden **checked by eye against the real-machine photo
   or video on its ZXE wiki page** (answer 2), never a golden recorded from Klive's own output first.
   Record, per program, which real-machine result the expectation came from.
5. **A runner** in the slow tier (`npm run test:slow`): one test file per program, reading the files
   from `vendor/spectrum-tests/`.
6. **Baseline:** run everything on today's core and record which tests pass. That table goes into this
   plan's status section and is the before-picture for every later phase.

**Done when** the runner runs every program on the 48K and the 128K, and the baseline table is
recorded.

## Phase 1: Border resolution and position (gap 2)

1. **Confirm** with Border Time and a harness test of our own (an `OUT` ending at each of
   14,335–14,350 on successive frames, the border colour sampled on the line of `$4000`). The expected
   result is §1.1's: four consecutive end times, one chunk.
2. **Check the other models' rules** before writing code: the 128K/+2 (WoS 128K FAQ), +2A/+3 (gate
   array), NTSC 48K, Timex SCLD, Pentagon, Scorpion. Record each in §1.1.
3. **Fix:** the border colour is latched per 4 T-state chunk. A chunk's colour is the border value at
   its sample point (for the 48K, the chunk drawn at T takes the value of `OUT`s ending up to T + 6,
   per §1.1, to be re-derived against Phase 2's display timing if Phase 2 lands first). In the
   renderer: an `OUT` that changes the colour catches up only to the last chunk whose sample point has
   passed, and the renderer paints border chunks four T-states at a time. The sample-point offset
   belongs in `Sp48ScreenConfig` (and the 128K/+3 configs), not in a constant.
4. **Tests:** the harness test from step 1 (it failed before), Border Time, and the existing
   first-row-border test.

**Done when** the border test matches the FAQ on the 48K and its documented counterpart on the other
models, and nothing in the baseline regressed.

## Phase 2: The moment of a read and of a write (gap 1)

1. **Establish the ULA's read times** within the contention window from Chris Smith's book (the
   chapters on the ULA's memory access; there are no page references, answer 1) and the published
   real-machine results of Screen Time and the ULA tests, and the moment within a Z80 write cycle
   that the data reaches the RAM. Record both in §1.2.
2. **Measure Klive against them** with Screen Time, ULA 48 Simple Test and ZX Spectrum Timing Tests,
   plus a harness test that writes a cell at each T-state around 14,330–14,345 and records what the
   first line shows.
3. **Fix**, in order of evidence:
   - move the fetch phases of the timing tables to the book's read times (the tables already carry
     them per T-state; `pixelDataPrefetchTime`/`attributeDataPrefetchTime` and the switch in
     `initializeTimingTables`);
   - make a write visible from the right T-state: either let the Z80 core report the write before the
     cycle's last T-state, or have `sp48CpuWriteMemory` catch up to the T-state before the data
     reached the RAM. The second keeps the shared Z80 core untouched and is preferred;
   - the same for `OUT` to `$FE` if Phase 1 has not already settled it;
   - re-calibrate `sp48ReadFloatingBus`'s offset so that FloatSpy still passes (Phase 3's test).
4. **Every core:** the 128K, +2A/+3/+3E, Timex (`zx-spectrum-scld.c`) and Pentagon/Scorpion tables
   are built by the same code with their own configs; each gets its own check.

**Done when** the write-timing test matches the book, the timing test programs pass that failed in the
baseline, FloatSpy passes, and replays stay deterministic.

## Phase 3: Floating bus kept honest (gap 3)

1. Record the author's FloatSpy runs in Klive (48K and 128K pass) here and in the article, and run
   `vendor/spectrum-tests/floating-spy/floatspy.tap` again to confirm the baseline.
2. Add a fast-tier harness test that reads port `$FF` at a set of known frame T-states and compares the
   byte with the screen memory the ULA reads there (bitmap, attribute, or `$FF` in the border). Its
   expectations come from FloatSpy's documented results, so it fails when Phase 2 moves a fetch and
   forgets the floating bus.
3. Run FloatSpy, Float48K and Float128K from the kit in the slow tier.
4. The +2A/+3 floating bus (port `$0FFD` area, the gate array's own rules) is out of scope; note it.

**Done when** the fast test exists and fails if the offset is changed by one.

## Phase 4: Early and late timings (gap 4)

1. **Settle the model** (§1.4) from real-machine results, since there is no hardware here (answer 2):
   HALT2INT's own photos of a real 48K in early and late timing (`vendor/spectrum-tests/halt2int/`),
   the ZXE wiki's videos (its BBG page runs HALT2INT on a pre-cooled machine to confirm late timing)
   and the wiki pages of the ULA and timing tests. Run the same programs in Klive and compare with
   what each model predicts. Chris Smith's book on the ULA's timing chain is the second source.
2. **Design** from the settled model:
   - If "everything one T-state later": shift the frame start against the interrupt by one T-state
     (contention, fetches, border, floating bus together), a per-machine offset applied when the
     tables are built.
   - If "INT one T-state earlier under /RFSH": the INT start becomes a function of the CPU's state at
     the preceding T-state, which needs a hook from the Z80 core (`processInt` and the M1 refresh in
     `z80.c`) and a core candidate test as `src/emu/z80/wasm/README.md` requires for new stops.
3. **Setting:** a machine option for the ULA machines (16K, 48K, 128K, +2), "ULA timing: early / late",
   default early (the documented timings, what Klive does today). Through `t()` with translator
   context (`.ai/i18n-guide.md`), in the machine settings like `MC_SP128_TIMING`. Not offered on
   gate-array machines, Timex, Pentagon, Scorpion.
4. **Snapshots:** `.szx` carries a machine flag for alternate (late) timings; read and write it
   (`spectrumSnapshotCapture.ts` / `spectrumSnapshotRestore.ts`; verify the flag against the SZX
   specification).
5. **Tests:** HALT2INT matches its early photo with the option off and its late photo with it on; the
   other timing tests match their published results in each mode; a harness test proves the one
   T-state shift (or the conditional INT) and fails with the option off.
6. **Docs:** the machine settings reference page, and the article (Phase 6).

**Done when** both modes reproduce the published real-machine results and the option round-trips
through `.szx`.

## Phase 5: Snow (gap 5)

1. **Establish the exact rule** from Chris Smith's book and the snow test programs: in which T-state
   of the refresh the ULA's read is disturbed, and which address it then reads (the refresh row, R's
   low seven bits, with the ULA's own column, or another combination).
2. **Design:** the shared Z80 core already calls `Z80_REFRESH(IR)` for every M1 refresh. The Spectrum
   ULA cores define it (today it counts RZX fetches) to also check: I in `$40`–`$7F`, and a ULA fetch
   phase at the refresh's T-state in the tables. When both hold, the core catches the picture up to
   that T-state and replaces the latched byte with the byte at the disturbed address, so the lazy
   renderer draws it. The floating bus reads the same disturbed byte.
3. **Machines:** 16K, 48K, 128K, +2 only (§1.5). The 128K snow crash is out of scope.
4. **Setting (answer 4):** a machine option "Snow effect" on the 16K, 48K, 128K and +2, **on by
   default** (it is what the hardware does), off for users of programs that set I to `$40`–`$7F` and
   would rather not see it. Through `t()` with translator context, saved with the machine settings,
   and documented on the machine settings reference page. With the option off, the refresh hook does
   no snow work at all (the IR contention stays: it is timing, not picture).
5. **Cost:** the check runs on every M1 cycle; it must be a single compare when I is outside the
   range. Measure with the existing core benchmarks; the fast-frame path must not slow down.
6. **Tests:** a harness test that sets I to `$40`, runs a known loop over the display period and finds
   disturbed bytes exactly where the rule predicts, none with I = `$3F`, and none with the option
   off; the kit's snow tests compared with the real-machine photos and videos on their wiki pages.

**Done when** the snow tests match the published real-machine results on the 48K and the 128K, the
switch turns the effect off, and the benchmark shows no measurable slowdown with I outside the range.

## Phase 6: Docs and roadmap

1. `spectrum-display.mdx`: Part 5's snow callout (no longer "Klive does not emulate snow"), Part 6's
   "Drawing late, but at the right moment" (what is now verified, with FloatSpy and the timing tests
   named), the 128K table if the numbers moved, and a mention of the late-timing option.
2. The machine settings reference for the new options.
3. `.plans/CLOSING_THE_GAPS_PLAN.md` and the comparison table of
   `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` if accuracy features are listed there (AGENTS.md's
   standing instruction).
4. This plan's status section, with the before/after table from Phase 0.

---

## Order

Phase 0 first. Then **Phase 2 before Phase 1** where possible: the border's sample point is measured
against the display timing, which Phase 2 may move; if Phase 2 waits for the book references, Phase 1
can land first and be re-checked after Phase 2. Phase 3's fast test goes in before Phase 2 changes any
fetch time. Phases 4 and 5 are independent of each other and come last.

## Open questions for the author

None at the moment; the four earlier questions are answered at the top of this plan.

## Sources

- World of Spectrum, *48K ZX Spectrum Technical Information*:
  https://worldofspectrum.org/faq/reference/48kreference.htm
- Sinclair Wiki, *Contended memory*: https://sinclair.wiki.zxnet.co.uk/wiki/Contended_memory
- Sinclair Wiki, *ZX Spectrum ULA*: https://sinclair.wiki.zxnet.co.uk/wiki/ZX_Spectrum_ULA
- ZXE wiki (redcode/ZXSpectrum), *Tests*: https://github.com/redcode/ZXSpectrum/wiki/Tests
- ZXE wiki, *Late timings*: https://github.com/redcode/ZXSpectrum/wiki/Late-timings
- Chris Smith, *The ZX Spectrum ULA: How to Design a Microcomputer*, ZX Design and Media, 2010.
- ZXE depot, where the kit's files come from: https://zxe.io/depot/software/ZX%20Spectrum/
- Z80 wiki (redcode/Z80), *HALT2INT*: https://github.com/redcode/Z80/wiki/HALT2INT
