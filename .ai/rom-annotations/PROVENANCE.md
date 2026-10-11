# ROM Annotation Provenance

The rule, in one paragraph: the shipped ROM annotations (`src/public/roms/*.rom.dis`) are
Klive's own. No commented ROM disassembly, ROM symbol file or SkoolKit file is copied or
consulted, from print, online or memory. Allowed sources are the ROM bytes read through
Klive's disassembler, Klive's own runs, interface facts from the official manuals, and —
for routine *names* only — a conventional name list (Q1). Every entry records which it
came from (`observed`, `manual`, `derived`). The full rules for authors, human or AI, are
in `README.md` beside this file.

**SkoolKit files (R8 of `.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`).** A published skool or
control file of a Spectrum ROM is never imported into, compared with, or used for a shipped
sidecar. A *user* may import any skool file into their own annotation set or their own ROM layer
(`skool-import`): that is their data, and the import writes only there.

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

### 2026-10-11 — `zx81.rom.dis`, the start-up sequence (working copy)

- **Added:** 27 labels, synopses and end-of-line comments for the cold start and the start-up
  sequence up to the main loop: `START` (`$0000`), `RAM_FILL` to `EDIT_RESET` (`$03CB-$0418`), the
  `MAIN_LOOP` entry (`$0419`), and the routines start-up calls: `VARS_RESET`/`NEW_EDIT_LINE` and their
  stack entry points (`$149A-$14BA`), `SLOW_FAST`/`STAY_FAST`/`DISPLAY_FRAME` (`$0207-$0229`),
  `CLEAR_SCREEN`/`CLS_LINES` (`$0A2A-$0A5D`), `PRINT_CHAR` (`$07F5`), `SET_PRINT_POS` (`$0918`), and
  the `NMI` handler (`$0066-$007C`), read to explain how `SLOW_FAST` tests for display NMIs.
  Authored outside the IDE, in `<Klive home>/RomAnnotations/zx81.rom.dis`; not yet copied to
  `src/public/roms/`.
- **Method:** the ROM bytes through Klive's own disassembler (`Z80Disassembler` with
  `Zx81CustomDisassembler`, the decoding the ROM page documents use), read instruction by
  instruction; callers of the re-entry points (`$03E5` from `$0361`, `$0413` from `$0664`) found in
  the same listing. Hardware behaviour from Klive's own ZX81 core
  (`src/emu/machines/zx8081/wasm/zx8081/zx8081-ula.c`): port `$FD` stops and port `$FE` starts the
  NMI generator; the character patterns come from the page `I` selects. System variable names from
  Klive's table (`Zx81SysVars.ts`).
- **Manual:** the ZX81 BASIC Programming manual's character set (`$76` NEWLINE, `$7E` number
  marker, `$7F` cursor) and the `$80` that ends the variables area; the entries that rest on these
  are marked `manual`.
- **Names:** Klive names throughout, chosen from what the code does; no name list was used.
- **Provenance:** `observed`, except the seven `manual` entries above.
- **Level:** 0 (`checkRomSidecar`: no problems; most of the ROM's targets are still unlabelled).

### 2026-10-11 — `zx81.rom.dis`, the main loop and the line editor (working copy)

- **Added:** 67 labels and their synopses and comments for the main loop from `MAIN_LOOP`
  (`$0419`): the listing (`$0419-$046D`), the edit line (`EDIT_LINE_SHOW`, `$0472-$04BF`), the key
  wait and decode (`WAIT_KEY` to `EDIT_KEY_JUMP`, `$04C1-$0536`), the K/L mode scan
  (`SET_KL_MODE`), the editing keys (`KEY_LEFT` to `KEY_EDIT`, `$0576-$060B`) and the top of
  `KEY_NEWLINE` (`$060C`); and the helpers they use: `FIND_LINE`, `CMP_LINE_NO`, `NEXT_ITEM`,
  `LINE_NO`, `LIST_LINES`, `PRINT_EDIT_LINE`, `KEY_DECODE`, `SKIP_NUMBER`, `MAKE_ROOM`,
  `MOVE_POINTERS`, `RECLAIM`, `TEST_ROOM`, `CLS_LOWER`, `RST $10`/`RST $18`, `ERROR_L`.
- **Regions:** six data regions found from the bytes and the code that reads them: the key tables
  at `$007E` (unshifted, read through `$007D` + position by `KEY_DECODE`) and `$00A5` (shifted),
  the function table at `$00CC` and the graphics table at `$00F3` (both indexed in the key
  decoding at `$04F2`/`$0502`), the keyword table at `$0111-$01FB` (walked by `FIND_TOKEN`; code
  resumes at `$01FC`, the next genuine target), and the editing-key jump table at `$0562-$0575`
  (`EDIT_KEY_JUMP` indexes `$0482` + 2 x code for codes `$70-$79`). The disassembly past each
  region was checked to resynchronise on the same instruction starts as before.
- **Method:** as the start-up session: Klive's own disassembler with the ZX81 decoding, read
  instruction by instruction, re-run with the new regions.
- **Manual:** the key names of codes `$70-$79` (cursor keys, GRAPHICS, EDIT, NEWLINE, RUBOUT,
  K/L, FUNCTION) and the `$7E` number marker, from the manual's character set; entries resting
  on them are marked `manual`.
- **Names:** Klive names, chosen from what the code does.
- **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-11 — `zx81.rom.dis`, KEY_NEWLINE: storing and running lines (working copy)

- **Added:** 25 labels with synopses and comments for `KEY_NEWLINE` (`$060C`) and what it does:
  the syntax check (`CHECK_LINE`, the top of `SCAN_LINE`), `EDIT_LINE_NO`, storing a line
  (`STORE_LINE`/`INSERT_LINE`, `$06E0-$072B`), running a command or INPUT's answer and the
  program after it (`RUN_EDIT_LINE`, `RUN_LINE_LOOP`), the report (`REPORT`, `PRINT_REPORT`,
  `SET_OLDPPC`), and the helpers `ERROR_RST`, `SET_CH_ADD`, `SET_FAST`, `CLEAR_PRBUFF`,
  `PRBUFF_OUT`, `PRINT_BC_NUM`, `PRINT_LINE_NO`, `PRINT_DIGIT`, `BREAK_TEST`, and the top of
  INPUT (`INPUT_CMD`, `$0EE9`). `NEXT_ITEM`'s synopsis corrected: it falls into `LEN_DE_TO_HL`.
- **Method:** Klive's disassembler as before; the keyword table decoded to name `$FF` (COPY)
  and `$E3` (STOP). **Klive's own runs**, through `test/harness/zx81/` (a throwaway probe, not
  kept): `10 INPUT A`, RUN, an answer, `PRINT 1`, `10` alone, and `20 PRINT )` — observed FLAGX
  bit 5 (set while INPUT waits) and bit 6 (a numeric INPUT), the `[L]` cursor during INPUT, the
  reports `0/10` and `0/0`, PPC `$FFFE` after a command, the listing `  10[>]INPUT A`, a line
  deleted by its number alone, and a syntax error left in the editor as `20 PRINT [S])`.
- **Manual:** report 9 is STOP and SPACE is BREAK; the entries resting on them are `manual`.
- **Names:** Klive names. **Level:** 0 (`checkRomSidecar`: no problems).
