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

### 2026-10-11 — `zx81.rom.dis`, the statement scanner and the syntax tables (working copy)

- **Added:** 54 labels with synopses and comments: the statement scanner `SCAN_STATEMENT`
  (`$0CDE`) and its syntax loop (`SYNTAX_NEXT`, `SYNTAX_ITEM`, `SYNTAX_CHAR`, `STATEMENT_END`),
  the seven operand classes (`CLASS_0`-`CLASS_6`), `SYNTAX_Z`, `OPTIONAL_NUM`, `REPORT_C`,
  `IF_CMD`, `REM_CMD`, `STOP_CMD`, `NEW_CMD`, `RST $20`, and a label with a one-line synopsis
  for each command routine the syntax table names (`*_CMD`, `PLOT_UNPLOT`, `LET_ASSIGN`), plus
  `LOOK_VARS` and `SCAN_EXPR` by their callers. `SCAN_LINE`'s synopsis completed.
- **Regions:** the syntax offsets (`$0C29-$0C47`, one per keyword `$E1-$FF`, read at `$0CEC`),
  the syntax entries (`$0C48-$0CB9`, walked by `SYNTAX_ITEM`), the class table (`$0D16-$0D1C`,
  read at `$0D05`), and the operator priorities (`$110F-$111B`, read as `$104C` + operator code
  at `$10B7`; marking them makes `$111C`, a CALL target, an instruction start). The entries were
  decoded with a script reading the ROM bytes and the keyword table; every one ends exactly at
  the next, `$0C48` to `$0CB9`, and the routines it names agree with routines already named
  from their code (`CLS` = `CLEAR_SCREEN`, `CLEAR` = `VARS_RESET`, `INPUT` = `INPUT_CMD`).
  The listing outside the regions keeps its instruction starts, apart from the resync at `$111C`.
- **Method:** Klive's disassembler with the ZX81 decoding, re-run with the new regions.
- **Names:** Klive names; the command routines are named after the keyword whose syntax entry
  names them. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-11 — `zx81.rom.dis`, the expression evaluator (working copy)

- **Added:** 41 labels with synopses and comments: `SCAN_EXPR` (`$0F55-$110E`), its operand
  cases (RND, PI, INKEY$, quoted strings, brackets, functions and NOT, unary minus, variables,
  numbers in both their checking and running forms) and its operator half (`SCAN_OPERATOR`,
  `OP_PRIORITY`, `OP_COMPARE`, `OP_STACK`, the string forms of operators); helpers named from
  their code or callers (`ALPHANUM`, `TEST_5_ROOM`, `MOVE_FP`, `KEYBOARD`, `STK_STRING`, and
  `READ_NUMBER`, `STACK_BC`, `FP_TO_BC`, `STR_SLICE` marked not yet annotated). The operator
  priorities region's synopsis now names each operator: the index mapping was read from
  `$1098-$10B6` and the operation codes agree with the calculator decoder's names (`$03`
  subtract, `$04` multiply, `$0F` addition).
- **Method:** Klive's disassembler with the ZX81 decoding (including its RST $28 calculator
  decoding for RND and PI).
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, LOOK_VARS (working copy)

- **Added:** 18 labels with synopses and comments: `LOOK_VARS` (`$111C-$11A6`) in full — the
  name's kind built in C, the search of the variables area, long names, the exit flags — plus
  `ALPHA`, the top of `SUBSCRIPTS` (`$11A7`) and `REPORT_3`.
- **Method:** Klive's disassembler as before. **Klive's own run** through `test/harness/zx81/`
  (a throwaway probe, not kept): `LET A=1`, `LET AB=2`, `LET A$="X"`, then the variables area
  read back: `66 81 00 00 00 00 a6 a7 82 00 00 00 00 46 01 00 3d 80`, which confirms the kind bits
  the code builds and the bit 7 the search ignores.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, LET_ASSIGN (working copy)

- **Added:** 18 labels with synopses and comments: `LET_ASSIGN` (`$1321-$13F7`) in full — a new
  number or string built at the end of the workspace and moved to the end of the variables
  area (`PUT_AT_VARS_END`), an existing number overwritten in place, a whole string replaced
  (`REPLACE_STRING`), a part of one cut or padded to its length (`OLD_STRING`) — and the helpers
  `RST $30` (`WORK_ROOM`, `WORK_ROOM_END`), `RECLAIM_ELINE` and `STK_FETCH`.
- **Method:** Klive's disassembler as before. **Klive's own run** through `test/harness/zx81/`
  (a throwaway probe, not kept): `LET A$="HELLO"`, `LET B=3`, `LET A$="HI"`, `LET B=4`, with the
  variables area read after each: A$ moved behind B when replaced; B's 5 bytes changed in place.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, FOR and NEXT (working copy)

- **Added:** 11 labels with synopses and comments: `FOR_CMD` (`$0DB9-$0E2D`) in full — STEP,
  the FOR variable's layout (value, limit, step, line) with MEM pointed at it, the skip to the
  matching NEXT — `NEXT_CMD` (`$0E2E-$0E57`), `LOOP_TEST`, `GOTO_LINE`, `FIND_INT`, reports 1
  and B, and the small commands that end in `GOTO_LINE` (GOTO, CONT, RUN) and RAND.
- **Region:** the single byte `$0E69`, an end-calc that `LOOP_TEST`'s jump-true lands on; it was
  listed as `inc (hl)`. Instruction starts elsewhere unchanged.
- **Klive's own runs** through `test/harness/zx81/` (throwaway probes, not kept):
  `10 FOR I=1 TO 3 / 20 PRINT I / 30 NEXT I / 40 PRINT "E"` printed 1 2 3 E, and the variables
  area held `ee 83 00 00 00 00 82 40 00 00 00 81 00 00 00 00 0b 00 80` (I as a FOR variable:
  value 4, limit 3, step 1, line 11); with `FOR I=5 TO 3` it printed only E (`0/40`); `NEXT J`
  with no J gave `2/0`. A register trace at `$0E27` showed the skip comparing the letter ($2E)
  with B ($2E).
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, GOSUB, RETURN and POKE; the error return (working copy)

- **Added:** 5 labels and synopses/comments for `GOSUB_CMD` (`$0EB5`), `RETURN_CMD` (`$0ED8`),
  `POKE_CMD` (`$0E92`) and `FP_TO_A`; corrected the comments at `$0629`, `$062D`, `$0673`, `$03E9`
  and `ERROR_L`'s synopsis to describe the error return: `ERR_SP`'s slot holds `KEY_NEWLINE`'s
  return only during the syntax check, and the run loop's (`$0676`, the CALL SCAN_LINE) while
  running; GOSUB and RETURN move `ERR_SP` with the return lines; `$3E00` is the bottom word.
- **Klive's own runs** through `test/harness/zx81/` (throwaway probes, not kept): stopped at
  `$0058` during `NEXT J`, `ERR_SP` = `$7FFC` holding `$0676` with `$3E00` above; a program
  `10 GOSUB 100 / 20 PRINT "B" / 30 GOTO 200 / 100 PRINT "A" / 110 RETURN` printed A B and, stopped
  at RETURN, had SP = ERR_SP = `$7FFA` holding `$0676`, `$000B`, `$3E00`; `RETURN` as a command
  gave `7/0`.
- **Note:** the IDE had saved the file in between (merging touching regions, and the user's own
  region edits at `$1FFF-$2000`); this session's entries were applied on top of that file, the
  regions left as the IDE wrote them. See "Regions that touch merge" in `README.md`.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, PRINT and the screen output (working copy)

- **Added:** 28 labels with synopses and comments: `LPRINT_CMD`/`PRINT_CMD` (`$0ACB-$0B8A`) — the
  item loop, `,` and `;` (one test, told apart by carry), AT, TAB, expressions, strings with
  keywords and the `""` token — `PRINT_COMMA`, `RUN_ONLY`, `CHECK_NEXT_ITEM`, `TWO_PARAMS`,
  `PARAM_TO_A`, `AT_POS` (`$08F5`), and the screen printer `PRINT_SCREEN` (`$0808-$0850`), which
  grows a collapsed line by inserting before its NEWLINE; `REPORT_5`; `PRINT_FP` named only.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): `PRINT 1,2`
  printed 1 and 2 sixteen columns apart; `PRINT "A";"B"` printed AB.
- **Method:** the live working copy re-read before writing (it is open in the IDE).
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, PRINT_FP: printing a number (working copy)

- **Added:** 21 labels with synopses and comments for `PRINT_FP` (`$15DB-$16D7`): the decimal
  exponent estimate (log10 2), the scaling to a whole number, the 10 BCD digits in MEMBOT at
  `$406C-$4075`, rounding to 8 significant digits with `daa`, the `$80` end marker and its
  `DEC (HL)/INC (HL)/RET PE` test, the plain and E forms; and `STACK_A`.
- **Region:** `$15EA-$15EB`, two calculator literals (`$27` abs, `$34` end-calc) that the first
  jump-true lands on; they were listed as `daa`/`inc (hl)`. No other instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT of 0,
  -2.5, 1/3, 123456789, 12345678, 1E10, 1E12, 1E13, .0001, .00001, 2/3E7, -1E-20, 100, 1E38 gave
  0, -2.5, 0.33333333, 123456790, 12345678, 10000000000, 1000000000000, 1E+13, .0001, .00001,
  6.6666667E-8, -1E-20, 100, 1E+38.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the calculator (working copy)

- **Added:** 60 labels: the calculator's interpreter `CALCULATE`/`CALC_LOOP`/`CALC_DISPATCH`
  (`$199D-$19E3`) annotated in full; one label for each routine of the operation table, named
  after the code Klive's calculator decoder gives it (`CALC_ADDITION`, `CALC_COMPARE`, ...);
  synopses for the small operations (delete, fp-calc-2, end-calc, stk-data and the compact
  number form, stk-const, st-mem, get-mem, exchange, neg, abs, sgn, peek, usr-no, greater-0,
  less-0, not, jump, jump-true, dec-jr-nz) and the helpers `STK_TOP`, `FP_0_OR_1`,
  `ADD_5_TIMES_A`, `SKIP_CONSTS`, `UNPACK_NUMBER`. The arithmetic, the functions and series are
  labelled, marked not yet annotated.
- **Regions:** the constants (`$1915-$1922`, read by stk-const through `$1A55`) and the operation
  table (`$1923-$199C`, read at `$19D0` as `$1923` + 2 x code; the four group entries at
  `$1995-$199B`). Unpacking the constants by the format `stk-data`'s code implements gives 0, 1,
  0.5, PI/2 and 10. Instruction starts outside the regions unchanged.
- **The 5-byte number format** is read from neg, abs, sgn and FP_0_OR_1 (exponent with bias
  `$80`, 0 for the number 0; sign in bit 7 of the first mantissa byte), and agrees with the
  variables the earlier runs read back (1 = `81 00 00 00 00`, 3 = `82 40 00 00 00`).
- **Note:** `sin` begins at `$1D49` inside `cos`'s calculator codes (`$EF $35`, jumped over by
  cos); the listing shows cos's reading, so sin has no label.
- **Names:** Klive names, from Klive's calculator decoder for the operation routines.
  **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-11 — `zx81.rom.dis`, addition and subtraction (working copy)

- **Added:** 23 labels with synopses and comments: `CALC_ADDITION` (`$1755-$17BB`) and
  `CALC_SUBTRACT` (`$174C`) in full, and the shared arithmetic steps they use — `PREP_ADD`
  (two's-complement preparation), `FETCH_TWO` (the register layout), `SHIFT_RIGHT` (alignment,
  with rounding), `INC_32`, `CLEAR_REGS`, `NORMALISE` (`$1828`, with its exponent-0 and rounding
  cases), `STORE_RESULT` (`$1868`) and `REPORT_6`.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT 1+2, 1-1,
  -1+.5, .1+.2, 1E38+1E38, 1-1E-10, 5-8, 1E-38-1E-38 gave 3, 0, -0.5, 0.3, report 6, 1, -3, 0.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, multiplication (working copy)

- **Added:** 7 labels with synopses and comments: `CALC_MULTIPLY` (`$17C6-$1827`) — the
  preparation `PREP_MULT` (zero test, sign XOR, leading 1), the 33-round shift and add, the
  exponent sum and its range checks — falling into `NORMALISE`.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT 3*4,
  -2*3, -2*-3, .5*.5, 0*5, 5*0, 1E20*1E20, 1E-20*1E-20, 1E19*1E19, 1.5*1.5, 123456*1000 gave 12,
  -6, 6, 0.25, 0, 0, report 6, 0, 1E+38, 2.25, 123456000.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, division (working copy)

- **Added:** 6 labels with synopses and comments: `CALC_DIVISION` (`$1882-$18E3`) — divisor and
  dividend prepared (`PREP_MULT`), restoring long division with its carry-out case (`DIV_BIG`)
  and two rounding bits, the exponent difference — and `EXP_TAIL` (`$1810`), the exponent code
  division shares with multiply.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT 12/4, 1/3,
  -6/3, -6/-3, 7/7, 2/3, 0/5, 1/0, 1E30/1E-30, 1E-30/1E30, 1E38/.5 gave 3, 0.33333333, -2, 2, 1,
  0.66666667, 0, report 6, report 6, 0, report 6.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, truncate, int and n-mod-m (working copy)

- **Added:** 7 labels with synopses and comments: `CALC_TRUNCATE` (`$18E4-$1914`) in full, and
  synopses for `CALC_INT` (`$1C46`, rounding down) and `CALC_N_MOD_M` (`$1C37`), both calculator
  programs.
- **Region:** `$1C4E-$1C59`, int's calculator codes for a negative number, reached by its
  jump-true and listed as Z80 code until now; the `RET` at `$1C5A` stays code. No other
  instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT INT of
  2.7, -2.7, -3, .5, -.5, 123456789.6, 5E9+.5, -1E-10 gave 2, -3, -3, 0, -1, 123456790 (PRINT's
  8 digits), 5000000000, -1.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the number conversions (working copy)

- **Added:** 14 labels and synopses/comments for `READ_NUMBER` (`$14D9-$1513`: whole part,
  fraction with a place value in memory 0, exponent with its sign kept in memory 0's first
  byte), `STACK_DIGIT`, `STACK_A`, `STACK_BC` (`$1520`, with the IY restore usr-no relies on),
  `READ_INT` (`$1548`), `CALC_E_TO_FP` (`$155A`, steps of 10^7 and 10), `FP_TO_BC` (`$158A`,
  rounding, carry and Z on exit) and `FP_TO_A` (`$15CD`).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT 1.5E3,
  2E-3, 12345.678, 1E+2, .125, 65535, 1E15, 3.14159265 gave 1500, .002, 12345.678, 100, 0.125,
  65535, 1E+15, 3.1415927; the line `10 PRINT 1.5` was stored as
  `00 0a 0b 00 f5 1d 1b 21 7e 81 40 00 00 00 76`. (A POKE step in the probe was mistyped by the
  harness and is not used.)
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the comparisons, OR and AND (working copy)

- **Added:** 10 labels with synopses and comments: `CALC_COMPARE` (`$1B03-$1B61`) in full — the
  code's bits (swap, strings, base test, negate), the numeric difference, the string compare by
  character codes with its end-of-string cases — and synopses for `CALC_OR`, `CALC_NO_AND_NO`
  and `CALC_STR_AND_NO` (`$1AED-$1B02`).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT 1<2,
  2<1, 1=1, 1=2, 3>2, "A"<"B", "AB">"A", "A"="A", ""<"A", "B"<"AB", "AB"="ABC" gave
  1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the string operations (working copy)

- **Added:** 2 labels and synopses/comments for `CALC_STRS_ADD` (`$1B62`), `CALC_CHRS` (`$1B8F`),
  `CALC_VAL` (`$1BA4`, checked then run in a workspace copy), `CALC_STR` (`$1BD5`, printed into
  the workspace through PRINT_SCREEN's insert-before-NEWLINE), `CALC_CODE` (`$1C06`) and
  `CALC_LEN` (`$1C11`).
- **Function keys** for the probe read from the function table at `$00CC` with the key order at
  `$007E` (I CODE, U CHR$, Y STR$, K LEN, J VAL).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT
  "AB"+"CD", CHR$ 38, CHR$ 300, VAL "2*3+1", VAL "1+", STR$ 1.5, CODE "A", CODE "", LEN "HELLO"
  gave ABCD, A, report B, 7, report C, 1.5, 38, 0, 5.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the series generator (working copy)

- **Added:** 3 labels and synopses/comments: `CALC_SERIES` (`$1A7F-$1A9F`) in full — the
  recurrence it computes, read from its codes, and its loop across calculator codes and Z80
  (`SERIES_LOOP` fetching each constant from the caller's code stream) — and the calculator's
  inner entries `CALC_WITH_B` (`$19A0`) and `CALC_RESUME` (`$19A4`).
- **Regions:** `$1A83-$1A8F` and `$1A96-$1A9E`, calculator codes run through CALL $19A0 and
  CALL $19A4 (the decoder decodes only after RST $28); they were listed as Z80 code. No other
  instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT EXP 1,
  SIN 1, LN 2, COS 0, SQR 2, ATN 1 gave 2.7182818, 0.84147099, 0.69314718, 1, 1.4142136,
  0.78539816.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, exp (working copy)

- **Added:** 4 labels with synopses and comments: `CALC_EXP` (`$1C5B-$1CA8`) — the split of
  x log2 e into whole and fraction parts, the 8-constant series for 2^f, the whole part added
  to the exponent byte, the overflow (report 6) and underflow (0) cases.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT EXP of
  0, 1, 10, -1, 88, 89, -88, -100, .5 gave 1, 2.7182818, 22026.466, 0.36787944, 1.6516362E+38,
  report 6, 6.054602E-39, 0, 1.6487213.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, ln (working copy)

- **Added:** 2 labels with synopses and comments: `CALC_LN` (`$1CA9-$1D17`) — report A for
  x <= 0, the split into mantissa and exponent, the doubling below 0.8, the 12-constant series.
- **Region:** `$1CB1-$1CB3`, three calculator codes ln's jump-true lands on, listed as Z80 code
  until now. No other instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): PRINT LN of 1,
  2, 10, .5, .9, 1.5, 0, -1, 1E38, 1E-38 gave 0, 0.69314718, 2.3025851, -0.69314718,
  -0.10536052, 0.40546511, report A, report A, 87.498234, -87.498234.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, sqr and to-power (working copy)

- **Added:** synopses and comments for `CALC_SQR` (`$1DDB`, x ** 0.5, falling into to-power) and
  `CALC_TO_POWER` (`$1DE2`, EXP (y LN x), and the x = 0 cases).
- **Region:** `$1DEE-$1DFD`, to-power's calculator codes for x = 0 (also the end-calc sqr's
  jump-true lands on), listed as Z80 code until now; the RET at `$1DFE` stays code. No other
  instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): SQR of 4, 2,
  0, -1, 1E38 gave 2, 1.4142136, 0, report A, 9.9999999E+18; 2**10, 0**0, 0**2, 0**-1, 9**.5,
  -2**2, 2**-1 gave 1024, 1, 0, report 6, 3, -4, 0.5.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, get-argt, sin, cos and tan (working copy)

- **Added:** synopses and comments for `CALC_GET_ARGT` (`$1D18`, the reduction to quarter
  turns and the reflection flag in memory 0), `CALC_COS` (`$1D3E`, with sin's entry inside its
  codes at `$1D49` and the shared series) and `CALC_TAN` (`$1D6E`).
- **Region:** `$1D35-$1D3C`, get-argt's calculator codes for the reflection, reached by its
  jump-true and listed as Z80 code until now; the RET at `$1D3D` stays code. No other
  instruction start changed.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): SIN of 0, 1,
  -1, 2, 100, PI, PI/2 gave 0, 0.84147099, -0.84147099, 0.90929743, -0.50636565, 0, 1; COS of 0,
  1, 2, PI gave 1, 0.54030231, -0.41614684, -1; TAN 1 and TAN (PI/4) gave 1.5574077 and 1.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, atn, asn and acs (working copy)

- **Added:** synopses and comments for `CALC_ATN` (`$1D76`, the two ranges, the series, and the
  Z80 entry at `$1D89` inside its own calculator codes), `CALC_ASN` (`$1DC4`) and `CALC_ACS`
  (`$1DD4`). With these, every routine of the calculator's operation table has a synopsis.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): ATN of 0, 1, -1,
  .5, 10, -10 gave 0, 0.78539816, -0.78539816, 0.46364761, 1.4711277, -1.4711277; ASN of 1, .5,
  -1, 2 gave 1.5707963, 0.52359878, -1.5707963, report A; ACS of 0, 1, -1, .5 gave 1.5707963, 0,
  3.1415927, 1.0471976.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-11 — `zx81.rom.dis`, the display: DISPLAY_FRAME, INT and NMI (working copy)

- **Added:** 11 labels with synopses and comments: `DISPLAY_FRAME` (`$0229-$0291`) — FRAMES and
  PAUSE's count, the keyboard read during VSYNC with the debounce, the borders and the text
  lines — `BORDER_LINES` (`$0292`, SLOW and FAST), `DISPLAY_LINES` (`$02B5`, running the display
  file), the INT handler `INT_DISPLAY` (`$0038`, scan lines and rows) and `NMI_COUNT_END`
  completed; `PAUSE_CMD`'s entry at `$022D` (`FRAMES_COUNT`).
- **Hardware facts** from Klive's own ZX81 core: `src/emu/machines/zx8081/wasm/README.md` ("How the
  ULA maps onto the shared Z80") and `zx8081-ula.c` — an opcode fetch above 32K of a byte with
  bit 6 clear latched and executed as NOP, the character row at refresh from (I & $FE) + code x 8
  + line, INT on A6 at refresh, NMI at HSYNC, IN with A0 low starting VSYNC, OUT ending it.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): FRAMES read
  `$FF7C`, then `$FF72` ten frames later, while idle; `$00B5`, then `$00A0`, during `PAUSE 200`;
  `$FEA2` after it. Bit 15 is set in normal running and clear during a PAUSE — the opposite of the
  description in `Zx81SysVars.ts`, which is flagged for a separate fix.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-12 — `zx81.rom.dis`, SLOW, FAST and PAUSE (working copy)

- **Added:** synopses and comments for `SLOW_CMD` (`$0F2B`), `FAST_CMD` (`$0F23`) and `PAUSE_CMD`
  (`$0F32`): CDFLAG bit 6, SLOW_FAST and SET_FAST, PAUSE's count through the frame code at
  `$022D`, FRAMES restored, and the ending key taken.
- **Keys** for the probe: SLOW and FAST read from the shifted key table at `$00A5` (SHIFT+D $E4,
  SHIFT+F $E5).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): CDFLAG `$C0`
  after start-up, `$00` after FAST, `$C0` after SLOW; `PAUSE 40000` still counting after 200
  frames (FRAMES `$9B81`), ended by a key with FRAMES back at `$FF20`, the key not typed.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems).

### 2026-10-12 — `zx81.rom.dis`, PLOT/UNPLOT, SCROLL and SET_PRINT_POS (working copy)

- **Added:** synopses and comments for `PLOT_UNPLOT` (`$0BAF`), `SCROLL_CMD` (`$0C0E`) and
  `SET_PRINT_POS` (`$0918`, completed); labels `PLOT_COLUMN`, `PLOT_CELL`, `PLOT_OLD_MASK`,
  `PLOT_OR_UNPLOT`, `PLOT_SET`, `PLOT_TO_CODE`, `PLOT_PRINT`, `SPP_LINE_BACK`, `SPP_PAD`.
- **Method:** read through `zx81-dis.cjs`. PLOT's choice at `$0BDA` compares T_ADDR with `$0C9E`;
  the syntax offsets (`$0C29` + token - `$E1`, plus the byte there) put PLOT's (`$F6`) entry at
  `$0C98` and UNPLOT's (`$FC`) at `$0C9E`, the tokens named from the keyword spellings at `$0111`.
  MOVE_POINTERS (`$09AD`) moves only pointers above HL (`SBC HL,DE` carry), which is why SCROLL's
  DF_CC stays on the inserted NEWLINE.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): T_ADDR at `$0BDD`
  `$0C9C` for PLOT, `$0CA2` for UNPLOT; cell (21,0) `$04` after PLOT 0,0, `$83` after PLOT 0,0 and
  1,0, `$86` after those, PLOT 0,1 and UNPLOT 0,0; PLOT 0,43 then PRINT "X" gives `$01` and X at
  column 1; PLOT -3,1 gives COORDS `$0103` and `$02` at (21,1); PLOT 0,44 and PLOT 64,0 report B;
  PRINT "A": PRINT "B": SCROLL: PRINT "C" leaves B on line 0 and C on line 21.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 130 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, DIM, SUBSCRIPTS and their helpers (working copy)

- **Added:** synopses and comments for `DIM_CMD` (`$1409`, with the array layout) and
  `SUBSCRIPTS` (`$11A7`, rewritten: a number element's HL is the byte *before* its 5, not the
  element), and new routines `GET_SUBSCRIPT` (`$12DD`, entry `GET_SUBSCRIPT_A` `$12DE`),
  `NEXT_DIM` (`$12FF`), `MULTIPLY_HL_DE` (`$1305`), `STK_STRING_0` (`$12C2`); 31 labels in all
  (`DIM_*`, `SUBS_*`, `GSUB_*`, `IMUL_*`, `REPORT_C_IF_NZ` at `$128B`). STR_SLICE's own inside
  is left for its session.
- **Method:** read through `zx81-dis.cjs`. HL's meaning from the callers: OP_ALNUM (`$1039`)
  takes HL + 1 before MOVE_FP, as for a simple number. RST `$20` leaves HL = CH_ADD, so DIM's
  limit is `$40` with CH_ADD's low byte.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept): DIM A(3,4) left
  `$86 $41 $00 $02 $03 $00 $04 $00` and 60 zeros at VARS; DIM B$(2,3) `$C7 $0B $00 $02 $02 $00
  $03 $00`, 6 zeros, then `$80`; DIM A(0) and DIM A(17000) report 3, DIM A(16000) report 4; a
  second DIM A(3) gave A(2) = 0; LET A(2,3)=7 wrote at elements + 30; A(4,1), A(1) and A(1,1,1)
  report 3; B$(2)="XYZ" then B$(2,2) printed Y; DIM C$(5): LET C$="HI" printed "HI   ", C$(2) I;
  at `$123C` HL = `$43F5` with the element at `$43F6`.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 99 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, STR_SLICE and STK_STRING (working copy)

- **Added:** synopsis and comments for `STR_SLICE` (`$1263`), labels `SLICE_TO`, `SLICE_BOUNDS`,
  `SLICE_STACK`, `SLICE_RESULT`; `STK_STRING`'s synopsis completed (what its first byte means).
- **Method:** read through `zx81-dis.cjs`. The first byte: CLASS_1 ORs STK_FETCH's A into FLAGX
  (`$0D5D`), LET_ASSIGN tests FLAGX bit 0 (`$1381`); SUBSCRIPTS stacks a simple string with
  A = 1 (`$11B1`), STR_SLICE re-stacks through `STK_STRING_0` (`XOR A`). The bad-bound count is
  tested (`JP M` at `$12B4`) only after an empty slice has already been taken (`$12B0`).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept), A$="HELLO":
  A$(2 TO 4) ELL, A$(TO 2) HE, A$(4 TO) LO, A$() HELLO, A$(3) L, A$(2 TO 4)(2) L; A$(4 TO 2),
  A$(10 TO 2), A$(6 TO 5) empty, no report; A$(0 TO 0), A$(6), A$(2 TO 6) report 3; "ABC"(2) B,
  ("A"+"BC")(3) C; LET A$(2 TO 3)="XYZ" gave HXYLO, then ="Q" HQ LO. A register stop at `$12C3`
  gave inconsistent results and was not used.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 95 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, LIST, LLIST, LIST_LINES and the token printer (working copy)

- **Added:** synopses and comments for `LIST_CMD` (`$0730`), `LLIST_CMD` (`$072C`), `LIST_LINES`
  (`$073E`, rewritten: the full screen and the ERR_SP return), `PRINT_TOKEN` (`$094B`) and
  `FIND_TOKEN` (`$0975`, completed: the spacing rules, the '?' entry), and the new
  `PRINTER_CHAR` (`$0851`); 13 labels (`LIST_*`, `PTOK_*`, `FTOK_*`, `PRINT_TO_PRN`,
  `PRINT_CHAR_END`, `PRINT_CODE_A`, `PRINT_NONSPACE`). PRBUFF_OUT and COPY are left for the
  printer session.
- **Method:** read through `zx81-dis.cjs`; the keyword table's first bytes (`$8F` at `$0111`,
  a lone '?'). Token spacing tested by poking token bytes into a REM line's text and listing it.
- **Klive's own run** through `test/harness/zx81/` (throwaway probes, not kept): the poked line
  listed as `10 REM A<=B AND C THEN PRINT SIN X**2;INKEY$;STR$ 1;PI;RND;A TO BAT`; LIST of 25
  REM lines showed 10-220 and report 5/0; LIST 120 started at 120 with E_PPC 120; LIST 20000
  left E_PPC 3616. With the emulator's breakpoints while line 250 was entered under 24 lines:
  `$0433` (ERR_SP `$7FFC`), `$0835` and `$0058` (BERG 1), then `$0436` with ERR_NR `$04`, S_TOP
  30 to 40, `$0433` again and `$0436` with BERG 0. An earlier probe lost typed digits (the
  harness), its readings were not used.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 82 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, SAVE and LOAD (working copy)

- **Added:** synopses and comments for `SAVE_CMD` (`$02F6`), `LOAD_CMD` (`$0340`) and the new
  `SAVE_BYTE` (`$031E`), `LOAD_BYTE` (`$034C`), `TAPE_NAME` (`$03A8`), `TAPE_NEXT_ADDR`
  (`$01FC`), `REPORT_F` (`$02F4`), `REPORT_D` (`$03A6`); 29 labels (`SAVE_*`, `LOAD_*`).
- **Method:** read through `zx81-dis.cjs`. Port behaviour from Klive's own ULA
  (`zx8081-ula.c`: an IN with A0 low starts VSYNC and returns the tape signal in bit 7, an OUT
  ends VSYNC). Times are computed from the loops' T-states at 3.25 MHz and marked so. The core
  README's tape section names three ROM addresses after a commented listing; those names and
  addresses were **not** used.
- **Klive's own run** through `test/harness/zx81/` (throwaway probes, not kept; LOAD with
  `fastLoad: false`, so the ROM read synthesized pulses). SAVE "AB" from a program: at `$031E`
  the bytes `$26 $A7` then `$00 $0A $00 $87` from `$4009`; pulses per bit at `$0328`
  4,4,9,4,4,9,9,4 / 9,4,9,4,4,9,9,9 / 4 x 8 / 4,4,4,4,9,4,9,4; BREAK gave D/10; the line then
  listed `SAVE "A[B]"`; SAVE "" gave F/0. LOAD "" of `basic/BASE.p` (943 bytes): first byte
  stored at `$4009` with D 0 and E_LINE `$4497`; the first 12 bytes stored equal the file's; E at
  `$0395` `$38` for 0-bits, `$D7` for 1-bits; the whole load 1119 frames, ending at the file's
  E_LINE `$43B4` (15 bytes below E_LINE differed from the file afterwards; not looked into).
  LOAD "X": `$036F` with C `$80`, NZ, no match after. No tape, BREAK: `$03A6` with D `$C2`. BREAK
  after the name matched: `$0361` (D 0) then `$03E5`; the old program was gone. Earlier readings
  that relied on the screen after a held key, or on an address range that missed `$01FC`, were
  discarded.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 54 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, the printer: COPY and PRBUFF_OUT (working copy)

- **Added:** synopses and comments for `COPY_CMD` (`$0869`) and `PRBUFF_OUT` (`$0871`, the line
  printer); 10 labels (`PRN_*`).
- **Method:** read through `zx81-dis.cjs`. Port `$FB`'s bits are described by what the code does
  with them (waits on read bits 7 and 0, stops on bit 6, the pixel in written bit 7); the
  manuals do not document them, and no hardware meaning is given from memory. Klive emulates no
  printer: its ULA answers only reads with A0 low (`zx8081-ula.c`), so `$FB` reads `$FF`.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept), a program
  `10 LPRINT "AB";`, `20 LPRINT` 33 Cs, `30 COPY`: PR_CC `$BC` before; `$0871` entered by a jump
  from PRINTER_CHAR (`$0853`/`$0860`) with PR_CC `$5C` and the buffer `$26 $27` and 30 `$28`, then
  on the NEWLINE with PR_CC `$3F` and three `$28`; COPY at `$0876` with D `$16` and HL = D_FILE + 1;
  each print read `$FF` at `$088A` and went to `$08DE`; report 0/30, PR_CC `$BC` after.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 44 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, INPUT (working copy)

- **Added:** `INPUT_CMD`'s synopsis completed (the edit line it builds, FLAGX, the answer's
  path) and its comments; `INPUT_ANSWER`'s synopsis corrected (an empty answer is stopped by the
  check before it); labels `INPUT_TYPE`, `INPUT_CURSOR`, `REPORT_8`.
- **Method:** read through `zx81-dis.cjs`, with the already annotated answer path (KEY_NEWLINE,
  SCAN_LINE, RUN_EDIT_LINE, the run loop's `$0682`).
- **Klive's own run** through `test/harness/zx81/` (throwaway probes, not kept): waiting for
  INPUT A, FLAGX `$62`, the edit line `$7F $76`, T_ADDR `$1820` = the S_POSN after PRINT "Q";;
  for INPUT A$, FLAGX `$22`, `$0B $7F $0B $76`. Answers: 2+3 then PRINT A*2 gave `Q10` on line 0,
  FLAGX `$42` after; HI for A$ gave HI/; B*2 with B = 7 gave 14; Z gave 2/10; an empty answer and
  "X" for a number showed the inverse S with FLAGX still `$62`, and 4 afterwards was taken; STOP
  (SHIFT+A) gave D/10; INPUT A as a command 8/0. The first STOP and command readings ran into a
  session left waiting and were discarded.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 41 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, KEYBOARD (working copy)

- **Added:** `KEYBOARD`'s synopsis completed (`$02BB`: the reading's form, SHIFT, MARGIN) with
  comments; label `KBD_ROW`.
- **Method:** read through `zx81-dis.cjs`. That the US machine's port reads 0 in bit 6 is from
  Klive's core README ("Models"); that the IN starts VSYNC from Klive's ULA (`zx8081-ula.c`).
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept), HL at `$02E6`
  with keys held: none `$FFFF`, A `$FDFD`, SHIFT `$FEFF`, SHIFT+A `$FCFD`, Z `$FBFE`, Q+P `$FDDB`,
  A+Q `$FDF9`, 1 `$FDF7`, SPACE `$FD7F`, NEWLINE `$FDBF`, the same on both models; MARGIN 55 on
  `zx81-16k`, 31 on `zx81-16k-us`.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 40 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, CLS_COLLAPSED (working copy)

- **Added:** `CLS_COLLAPSED`'s synopsis completed (`$0A52`) with comments, and a comment on
  CLS_LINES's `SET 7` at `$0A3E`.
- **Method:** read through `zx81-dis.cjs`.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept), program
  PRINT "AB", PRINT "CD", CLS, PRINT "E". On `zx81-1k` (RAMTOP `$4400`): CLS at `$0A52` with B `$18`,
  HL = DF_CC = `$40A1` (D_FILE + 1); at `$0A5D` DE `$40B9`, HL = VARS `$40BD`; afterwards the display
  file 25 NEWLINEs (plus E). The editor's lower-part clears entered with B 2, then B 1. On
  `zx81-16k`: S_POSN `$8101` at `$0A4F` for each clear.
- **Names:** none added. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 40 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, CLASS_1 (working copy)

- **Added:** `CLASS_1`'s synopsis completed (`$0D3C`: what DEST, STRLEN and FLAGX hold for each
  kind of target) with comments.
- **Method:** read through `zx81-dis.cjs`, with LOOK_VARS's and SUBSCRIPTS's exits as annotated.
- **Klive's own run** through `test/harness/zx81/` (a throwaway probe, not kept), stopping at
  `$0D6A` in a program of LETs: LET A=1 FLAGX `$02`, DEST in the line (`$26`); LET A=2 `$00`, DEST
  VARS + 0 (`$66 $81 ...`); LET AB=3 `$02`, in the line; LET AB=4 `$00`, DEST the stored `$A7`;
  LET A$="HI" `$02`, in the line; LET A$="X" `$01`, STRLEN 2, DEST the text `$2D $2E`; LET A$(1)="Z"
  `$00`, STRLEN 1, the text; LET C(2)=5 after DIM C(3) `$00`; LET Q(1)=1 with no Q report 2/10.
- **Names:** none added. **Provenance:** all `observed`. **Level:** 0 (`checkRomSidecar`: no
  problems; 40 unlabelled targets).

### 2026-10-12 — `zx81.rom.dis`, level 1: the remaining targets (working copy)

- **Added:** 39 labels on the remaining control-transfer targets, each with a one-line synopsis
  read from its code (loop heads and branch targets in annotated routines), among them
  `CALC_RESET` (`$14BC`: MEM = MEMBOT, STKEND = STKBOT; called by SCAN_LINE, EDIT_LINE_NO and the
  error handler), `REPORT_2` (`$0D4B`), `ERROR_CODE` (`$0056`), `CALC_RST` (`$0028`), and the
  NEXT_ITEM branches (`NI_*`: a line's, a string's or array's length word, a number's 5 bytes
  or a FOR variable's 17, a long name walked to its last character).
- **Method:** read through `zx81-dis.cjs`; no run needed (no behaviour claimed beyond the bytes).
  Two synopses were corrected before writing, on a re-trace: PEL_CURSOR_CHAR uses bit 2 of A,
  KD_COUNT counts C's set bits below its first clear one.
- **`$1D89`** (atn's |x| < 1 entry inside calculator codes): labelled `ATN_SMALL` at the
  author's decision, through `formatRomSidecar` by a one-off script (`apply-annotations.cjs`
  refuses a label that is not a Z80 instruction start in the listing). The level tool restarts
  its decode at labels and accepts it; Klive's disassembler shows the label on the
  `.defb $EF (get-mem-15)` line, which ATN_SMALL's and CALC_ATN's synopses explain.
- **Names:** Klive names. **Provenance:** all `observed`. **Level:** 1, measured by
  `checkRomSidecar` (no unlabelled targets, no problems) and recorded; 295 labels have no
  synopsis yet (level 2).

### 2026-10-12 — `zx81.rom.dis`, level 2: a synopsis for every label (working copy)

- **Added:** synopses for the 295 labels that had none (loop heads, branch targets and shared
  tails inside annotated routines), in five batches in address order; two corrected after a
  re-trace before the next batch (SHIFT_LOOP: zero only when the rounding wraps the 32 bits;
  ADD_ALIGNED: the overflow shift), and in the first batch KEY_DISPATCH (the overflow on
  CP $F0), INT_SAME_ROW (reached only by JP NZ), DEBOUNCE and PRINT_CODE_A before writing.
- **Method:** each label's code from it to the next label, read through `zx81-dis.cjs` with the
  comments already on those lines; where a label's meaning depended on code before it, that
  code was read too. Every synopsis describes the bytes; no run was needed and none is claimed.
- **Names:** none added. **Provenance:** all `observed`. **Level:** 2, measured by
  `checkRomSidecar` (every label has a synopsis, no unlabelled targets, no problems) and
  recorded in the working copy.

### 2026-10-12 — `zx81.rom.dis`, the character set's region trimmed (working copy)

- **Changed:** the character set's region `$1E00-$2000` ends at `$1FFF`, the ROM's last byte,
  and the code region after it starts at `$2000`. The ROM is 8K; `$2000` is past it.
- **Found through** a duplicate `$1FFF` row in the Disassembly view: a region starting past a
  short page's bytes was clamped onto the last byte and decoded again
  (`annotatedDisassembly.ts`, fixed in the same change, with a test). Klive's disassembler
  view now skips such a region; the trim keeps the file within the ROM.
- **Level:** 2, unchanged (`checkRomSidecar`: no problems).

### 2026-10-12 — `zx81.rom.dis`, labelled addresses named by their labels (working copy)

- **Changed:** 27 mentions of a labelled address in synopses and comments now use the label
  (for example `$14BC` in ERROR_L's synopsis is `CALC_RESET`), and the syntax table's decoded
  entries name each command's routine. Kept as numbers, because they are values and not
  references to the labelled code: `$0482` (EDIT_KEY_JUMP's base, three times) and the operand
  of `LD HL,$0000`. Two synopses were re-broken to keep their lines short.
- **Method:** a scan of every synopsis and comment for `$XXXX` against the page's labels, each
  mention replaced by hand; the author's own edits in the working copy were kept.
- **Level:** 2, unchanged (`checkRomSidecar`: no problems).

### 2026-10-17 — `zx81.rom.dis`, the key and keyword tables labelled (working copy)

- **Added:** labels on the five table starts, inside their data regions: `KEYS_UNSHIFTED`
  (`$007E`), `KEYS_SHIFTED` (`$00A5`), `KEYS_FUNCTION` (`$00CC`), `KEYS_GRAPHICS` (`$00F3`) and
  `KEYWORD_TABLE` (`$0111`), Klive names. Their synopses were rewritten in more detail: entry
  counts, the indexing each reader uses, every key's code, token or graphic, and the entries
  never read (graphics table: shifted P O I U and L K J). KEY_DECODE, FUNCTION_KEY,
  GRAPHICS_KEY, FIND_TOKEN and the comment at `$0502` now name the tables by label.
- **Method:** the bytes through `zx81-dis.cjs`, decoded through the ZX81 character set and the
  keyword table's own spellings; the readers read: KEY_DECODE (`HL = $007D + E`), the mode
  dispatch from `$04DF` (FUNCTION_KEY's `$00CC + E - 1` with shifted keys folded, GRAPHICS_KEY's
  `$00C7 + E` only for codes `$40` and over, KL_MODE_KEY's `+ $C0` for letters in K mode),
  OP_INKEY (the string is the table entry) and FIND_TOKEN (entry n found by counting end
  marks; 68 entries ending at `$01FB`). No run was needed and none is claimed.
- **Applied** with a variant of `apply-annotations.cjs` that accepts labels inside data regions
  and keeps a changed line's provenance (the lines at `$007E` and `$00A5` stay `manual`).
- **Names:** none from a name list. **Provenance:** labels `observed`. **Level:** 2, unchanged
  (`checkRomSidecar`: no problems).

### 2026-10-17 — `zx81.rom.dis`, the two word tables labelled (working copy)

- **Added:** `EDIT_KEY_TABLE` (`$0562`; the name its synopsis already used) and `CALC_OP_TABLE`
  (`$1923`), Klive names, on the starts of the page's two `words` regions. EDIT_KEY_TABLE's
  synopsis no longer opens with its own name; EDIT_KEY_JUMP's comment names it by label.
- **With it, in Klive:** a `.defw` value that is a labelled address now shows the label
  (`annotatedDisassembly.ts`), so the tables read `.defw KEY_UP, KEY_DOWN` and
  `.defw CALC_JUMP_TRUE, CALC_EXCHANGE`. All ten editing-key words have labels; of the
  calculator's 61, only `$1D49` (sin, inside cos's codes) does not.
- **Method:** each word read from the ROM and matched against the page's labels; the listing
  checked through `createAnnotatedDisassemblyItems` on the working copy. No run.
- **Provenance:** labels `observed`; the `$0562` line stays `manual`. **Level:** 2, unchanged.

### 2026-10-17 — `zx81.rom.dis`, the syntax tables labelled (working copy)

- **Added:** `SYNTAX_OFFSETS` (`$0C29`), `SYNTAX_ENTRIES` (`$0C48`, where the entries start inside
  the same merged region) and `CLASS_TABLE` (`$0D16`, the name its synopsis already used), Klive
  names. Synopses rewritten: the offsets as one-byte relative pointers in token order with each
  keyword's entry address (computed from the bytes); the entry format (class codes `$00-$06`,
  required characters `$0B` and up, the routine word after classes 0, 3 and 5, LET ending with
  class 2); and what an operand class is, with each class's job and the commands that use it.
  SCAN_STATEMENT names the offsets by label.
- **Method:** the bytes through `zx81-dis.cjs`; SCAN_STATEMENT and SYNTAX_ITEM read
  (`$0C29 + keyword - $E1`, then `+ (HL)`; `$0D16 + class`, then `+ (HL)`, entered by PUSH/RET
  with SYNTAX_NEXT as the return), and the class routines `$0D1D-$0DA5` (which pop that return:
  CLASS_0 via STATEMENT_END, CLASS_3 into CLASS_0, CLASS_5; RUN_ROUTINE reading the word at
  T_ADDR). No run was needed and none is claimed.
- **Provenance:** labels `observed`; changed lines keep theirs. **Level:** 2, unchanged.

### 2026-10-18 — `zx81.rom.dis`, the operator priorities labelled (working copy)

- **Added:** `OP_PRIORITIES` (`$110F`), a Klive name. Its synopsis now gives the size, the index
  order (from OPERATOR_CODE), that `$104C + C` is the table plus the index, and how the numbers are
  used: higher binds tighter, a waiting operation of the same or higher priority is done first
  (so equal priorities work left to right), and 0 ends the expression. OP_PRIORITY's synopsis and
  the comment at `$10BB` name the table by label.
- **Method:** `$1088-$110E` read through `zx81-dis.cjs` (the index arithmetic at `$1098-$10B3`,
  the `CP B` / `JR C` at `$10BE`); the 13 bytes read from the ROM. No run.
- **Provenance:** label `observed`; changed lines keep theirs. **Level:** 2, unchanged.

### 2026-10-18 — `zx81.rom.dis`, the character set labelled (working copy)

- **Added:** `CHARACTER_SET` (`$1E00`), a Klive name. A paragraph about the whole table now
  precedes the author's own `$00 - Character: ' '` line, which is kept as it was: 64 codes ×
  8 bytes, one byte per pixel row, and its two readers. PRN_CHAR's synopsis and the comment at
  `$03F4` name the table by label.
- **Method:** the display's address from `zx8081-ula.c` (`(address & $FE00) | (code & $3F) << 3
  | line`, inverse from bit 7) and the `LD I,A` at `$03F4`; the printer's from PRN_CHAR
  (`$089C-$08B1`: three shifts of the code, H = `$0F` rotated with bit 5, the inverse bit from
  bit 7 of C). Bit 7 as the leftmost pixel is from PRN_CHAR's `RLC C`. No run.
- **Provenance:** label `observed`; changed lines keep theirs. **Level:** 2, unchanged.
