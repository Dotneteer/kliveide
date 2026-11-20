# SAM Coupé — decisions, as-built notes and open items

The plan is `dev/plans/SAM_COUPE_PLAN.md` (implemented 2026-11-20); the research pack is
`dev/research/sam-coupe/`; the core's hardware model is `src/emu/machines/samcoupe/wasm/README.md`. Read
that README before changing the core.

## Decisions (accepted as the plan recommended them)

- **D1 provenance.** Klive's own code from the research pack. SimCoupé, MAME's (GPL) SAM driver, ZEsarUX,
  the FPGA cores and pyz80 are not read for design; the ZX-Uno core is not read at all. SimCoupé may be
  *run* as an oracle (results recorded in Klive's words, never in CI). SAASound (BSD-3) was **not** ported:
  the SAA is written from the pack's record of its behaviour; porting it is allowed and is a follow-up.
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
- **D10** the competitive analysis names the SAM as an exception to "every shipped ROM is annotated".

## Rules for later work

- **Nothing reads "which ROM" from a literal**: `SamRoms.ts`, `MC_SAM_ROM`.
- **ROM landmarks come from running the ROM**, not from an address table: the copyright key wait (ROM0
  0FA2h on 3.0 and 3.1) is found by `test/sam-hw/boot.test.ts`; if a ROM changes, re-observe it.
- **The copyright screen eats its key.** F9 boots from the editor. Anything that automates boot (Run,
  Load and Run, a disk inserted at start) presses a key first.
- **The SAM ROM has no annotations** and must not be added under `dev/ai/rom-annotations/` without a plan
  that respects rule D4 there (the published annotated disassembly is never read).
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
- Panels: ASIC and SAA 1099 (Debug activity, SAM only); the disassembler lists the byte after `RST 8`
  (error codes and DOS hooks).
- Assembler: `.model SAMCOUPE`; code goes to page 1 at 8000h (`common/samcoupe/codePlacement.ts`).

## Open

- **No virtual keyboard** yet: the plan asks for its design (from a photograph) to be approved first.
- **SAASound's PDM amplitude table** for enveloped channels (port SAASound, BSD-3).
- **Oracle runs in SimCoupé 1.2.17**: the timing programs, interrupt positions and pictures have not been
  compared with it yet.
- **The mode-change artefact cell** (plan Q15), **MIDI devices, printer, Atom Lite/B-DOS, more than one
  external pack, Spectrum mode, the SAM Élite** - follow-ups.
- **SAM BASIC listing** (plan §11.1): the token table was not recorded; `BasicPanel` does not list SAM
  programs.
- **ROM annotations** for ROM 3.0 (a separate plan, rule D4).
- The "Under the hood" article on the ASIC's contention (plan Phase 10) is not written.
