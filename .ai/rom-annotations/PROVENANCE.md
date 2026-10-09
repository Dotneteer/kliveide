# ROM Annotation Provenance

The rule, in one paragraph: the shipped ROM annotations (`src/public/roms/*.rom.dis`) are
Klive's own. No commented ROM disassembly, ROM symbol file or SkoolKit file is copied or
consulted, from print, online or memory. Allowed sources are the ROM bytes read through
Klive's disassembler, Klive's own runs, interface facts from the official manuals, and —
for routine *names* only — a conventional name list (Q1). Every entry records which it
came from (`observed`, `manual`, `derived`). The full rules for authors, human or AI, are
in `README.md` beside this file.

## Session log

Each authoring session adds an entry: the date, the sidecar, what was added, and the
method — which harness runs, which coverage scenarios, which manual pages, which name list.

### 2026-10-09 — `sp48.rom.dis`, first entries (phase R0)

- **Added:** 12 labels, 12 synopses, the character set region at `$3D00-$3FFF`.
- **Method:** only entry points the repository already relied on, each found earlier by
  running the ROM: the tape traps in `src/emu/machines/tape/TapeDevice.ts` (`$04C2`,
  `$056C`, `$05B6`, `$05E2`); the main loop entry `SP48_MAIN_ENTRY` in `ZxSpectrumBase.ts`
  (`$12AC`); the ROM routines the Klive BASIC runtime calls (`tape.kz80.asm`: `$0556`,
  `$04C2`; `float.kz80.asm`: `$2AB2`, `$2AB6`, `$2BF1`, `$2DE3`); the `RST $08` and
  `RST $28` behaviour the 48K custom disassembler decodes. The character set's place was
  confirmed by the coverage run (`test/rom-annotations/coverage.test.ts`: read while
  printing, never executed).
- **Names:** those the repository already used for these addresses. Where the
  repository gave no name (`$05B6`, `$05E2`, `$12AC`), Klive names were given
  (`LD_BAD_HEADER`, `LD_RESUME`, `MAIN_ENTRY`) rather than a remembered conventional one.
- **Provenance:** all `observed`.
- **Level:** 0 (`npm run rom:annotations -- level`: 940 unlabelled targets remain).
