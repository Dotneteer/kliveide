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

### 2026-10-19 — `zx80.rom.dis`, the start-up sequence (working copy)

- **Added:** 7 labels with synopses and end-of-line comments for the cold start up to the main
  loop: `START` (`$0000`), `RAM_FILL`/`RAM_CHECK` (`$0261-$0282`: the RAM fill and count-down test,
  SP, I, IM 1, IY, VARS, E_LINE), `EDIT_RESET` (`$0283`: the empty edit line, D_FILE, DF_SZ),
  `MAIN_LOOP` (`$0293`, its head only), and the routine it calls first, `CLS_DISPLAY` (`$0747`) with
  its tail `DISPLAY_ENDS` (`$073C`). Klive names, chosen from what the code does. Authored outside
  the IDE, in `<Klive home>/RomAnnotations/zx80.rom.dis`; not yet copied to `src/public/roms/`.
- **Method:** the ROM bytes through the new `tools/zx80-dis.cjs` (Klive's `Z80Disassembler`; the byte
  after `RST $08` shown as data, because the handler at `$0008` reads it: `POP HL` / `LD L,(HL)`),
  read instruction by instruction; the jumps into `EDIT_RESET` and `MAIN_LOOP` found in the same
  listing. The character pattern address from Klive's core (`zx8081-ula.c`: `(address & $FE00)`
  with I as the high byte), RAM repeating above its top from `zx8081-memory.c`. System variable
  names and meanings from Klive's table (`Zx80SysVars.ts`).
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; breakpoints at `$0263`, `$026B`,
  `$026D`, `$0283`, `$0293`, `$02F7` on `zx80-1k` and `zx80-16k`): the fill loop runs 16384 times;
  the walk stops at HL = `$4400` (1K) and `$8000` (16K), so SP = `$43FE`/`$7FFE` after the PUSH AF,
  whose word is `$3FBA`; at `$02F7` VARS = `$4028` (holding `$80`), E_LINE = `$4029` (`$B0 $76`),
  D_FILE = `$402B`, DF_SZ = 2, I = `$0E`, IY = `$4000`, and `$4000` (ERR_NR) = `$FF` on both.
- **Manual:** ERR_NR's 'no report' value and S_POSN's column/line bytes (the ZX80 operating manual's
  system variables, through `Zx80SysVars.ts`); the two lines resting on them are `manual`.
- **Tools:** `apply-annotations.cjs` now ends the page where the file's last region ends (the ZX80's
  page is 4K) and creates the label, line and provenance maps a fresh sidecar lacks;
  `check-annotations.cjs` reads the ROM the sidecar names.
- **Names:** none from a name list. **Provenance:** `observed`, except the two `manual` lines.
- **Level:** 0 (`checkRomSidecar`: no problems). The IDE and the level tool still decode the ZX80 as
  plain Z80, so their unlabelled-target list includes the bytes after `RST $08`.

### 2026-10-19 — `zx80.rom.dis`, the main loop: listing, edit line, key wait (working copy)

- **Added:** 90 labels (four on table starts inside data regions), synopses for all of them and
  end-of-line comments, Klive names throughout. `MAIN_LOOP`'s synopsis now covers the whole loop.
  - The listing: `LIST_FROM_TOP`/`LIST_LOOP`, the S_TOP adjustment (`REDRAW`, `NEXT_LINE_NO`,
    `SET_LINE_NO`, `LIST_DONE`), `LIST_LINE`, `LIST_TEXT`, `PRINT_LINE_NO`/`PRINT_DIGITS`/
    `PRINT_PLACE`, `PRINT_TOKEN`/`FIND_TOKEN`, `PRINT_A` (`$0010`) and `PRINT_CHAR` (`$0560`),
    `DISPLAY_ROOM`, `FILL_NEWLINES`, `FIND_LINE`, `CMP_LINE_NO`, `NEXT_ITEM`, `LINE_NO`.
  - The edit line: `EDIT_LINE_SHOW`, `EDIT_SHOWN`, `LINE_SCAN` (`$07BE`, its first steps only),
    `MAKE_ROOM`, `POINTERS`, `RECLAIM`/`RECLAIM_1`.
  - The key wait and the picture: `WAIT_KEY` (`$013F`), `WK_BOTTOM`, `RUN_DISPLAY`, the INT handler
    `INT_DISPLAY`/`INT_RUN_ROW`/`INT_SAME_ROW` (`$0038-$0048`).
  - Key handling: `KEY_DECODE`, `KEY_CODE`, `EDIT_KEY_JUMP`, `EDIT_AGAIN`, and the six editing keys
    whose routines are short: `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_HOME`, `KEY_RUBOUT`
    (with `CURSOR_AT_START`, `KEY_IGNORE`, `SET_E_PPC`). SHIFT NEWLINE (`$03CB`) and NEWLINE (`$0408`)
    are left for a later session.
  - Regions: `KEY_TABLE` (`$006C`, with `KEY_TABLE_SHIFT` at `$0093`) and `KEYWORD_TABLE` (`$00BA-$013B`),
    `bytes`/`text` (they touch, so the IDE merges them; each start has its synopsis), and
    `EDIT_KEY_TABLE` (`$0372-$0381`, `words`).
- **Method:** the bytes through `tools/zx80-dis.cjs`, read instruction by instruction. The tables'
  extents from their readers: KEY_DECODE's index (5 × row + column, + 39 with SHIFT, base `$006B`),
  FIND_TOKEN's `$00BA` start byte and end-mark count (45 spellings, the last at `$013B`; code
  resumes at `$013C`), EDIT_KEY_JUMP's `$0292 + 2A` for the codes `$70-$77` (the only `$40-$7F` codes
  in the key table). The key and keyword contents decoded with Klive's `ZX80_CHARSET`. The
  two-pass apply left every instruction start outside the new regions unchanged. Hardware facts
  from Klive's core (`src/emu/machines/zx8081/wasm/README.md`, `zx8081.c`): the M1 NOP rule above
  32K, INT on A6 during refresh, VSYNC on at an IN from port $FE and off at an OUT, bit 6 of port $FE
  reading 1 on the 50 Hz machine. The ROM addresses in that README's tape section were not used.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`): after boot FLAGS = `$04`,
  P_PTR = E_LINE = `$4029`, X_PTR = 0, D_FILE = `$402B`, DF_EA = `$4042`, DF_END = `$4045` (the display
  file is 24 `$76`, `$B0`, `$76`), `($4023)` = `$38`, CH_ADD = `$FFFF`; FRAMES + 10 in 10 frames. A held
  40 frames in K mode inserted one byte, `$E6` (LIST), FLAGS bit 2 then clear, `($4022)` = `$0F` and
  CH_ADD = `$FDFD` while held. U stopped at `$0323` with BC = `$EFDF`, DE = 0, HL = `$4022` and inserted
  `$3A`; SHIFT 5 moved the cursor one place left; SHIFT 6 left the edit line as it was. The listing
  form (`  10` + inverse `>` + text) is the existing `test/zx8081-hw/zx80.test.ts` case.
- **Tools:** `apply-annotations.cjs` takes `dataLabels` (labels on table starts inside data regions).
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems). Unlabelled targets left are outside this session's
  code (the restarts' entries, the tape routines `$01B6-$0260`, the interpreter).

### 2026-10-19 — `zx80.rom.dis`, NEWLINE and SHIFT NEWLINE: storing and running lines (working copy)

- **Added:** 32 labels with synopses and end-of-line comments, Klive names throughout.
  - `KEY_EDIT` (`$03CB`, SHIFT NEWLINE) and `KEY_NEWLINE` (`$0408`): the last two editing keys.
  - Running a line: `RUN_START`, `RUN_STATEMENT`, `RUN_CHECK`, `RUN_NEXT_LINE`, `RUN_STOP` with the
    report (`REPORT_OLDPPC`, `REPORT_SHOW`); storing one: `STORE_LINE`, `SL_SIZE`, `SL_DONE`.
  - What they use: `ERROR_RST`/`ERROR_SET` (`$0008`), `NEXT_CHAR_RST` (`$0018`), `GET_CHAR` (`$001A`),
    `GC_TEST`, `NEXT_NONSPACE` (`$0020`), `NEXT_CHAR`/`NC_STEP` (`$0052`), `READ_NUMBER` (`$0679`),
    `PRINT_NUMBER` (`$06A1`), `PN_DIGITS`, `PN_DONE`, `PRINT_IF_RUN` (`$06E0`), `TEST_ROOM` (`$094F`),
    `CLEAR_E_LINE` (`$0D0A`), `RECLAIM_RANGE` (`$0663`), `CLEAR_VARS` (`$065B`).
  - Rewritten: the synopses of `EDIT_RESET` (its callers by label), `EDIT_KEY_TABLE`, `LINE_SCAN`
    (checking with FLAGS bit 7 clear, running with it set), `DISPLAY_ROOM` (report 4),
    `PRINT_DIGITS`.
- **Method:** the bytes through `tools/zx80-dis.cjs`, read instruction by instruction, with the
  register-set swaps (EXX) traced through READ_NUMBER, KEY_NEWLINE and KEY_EDIT. The report number
  is ERR_NR + 1 from RUN_STOP (`$0492-$04A8`); `zx80-dis.cjs` now shows it after each RST $08.
- **Runs** (throwaway probes in `test/zx8081-hw/`, deleted; `zx80-16k`):
  - `10 PRINT "HI"` stored as `00 0A F4 01 2D 2E 01 76`, E_PPC = 10; `20 PRINT 1` as `00 14 F4 1D 76`.
  - SHIFT NEWLINE on line 20 replaced the edit line (it held `$DE`) with `00 00 1E 1C B0 F4 1D 76`, in
    K mode; NEWLINE on it stored the same line again.
  - The command `PRINT 2` showed `2` on line 0 and `0/-2` on line 23, PPC = `$FFFE`, the edit line
    removed (E_LINE = D_FILE); the next key gave a new edit line.
  - `PRINT )`: X_PTR = `$4037`, the inverse S before `)`; NEWLINE left the line as it was.
  - `20` alone deleted line 20.
  - `PRINT X` with no X: ERR_NR = 1, report `2/-2`, OLDPPC = PPC.
  - RUN of `10 PRINT "HI"`: `HI`, then `0/10`.
  - `10 INPUT A` / `20 PRINT A`, RUN: FLAGX = `$60` while INPUT waits (bit 5 set), `$40` after the
    answer 7; the run went on to line 20 (`7`, `0/20`).
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-19 — `zx80.rom.dis`, LINE_SCAN and the syntax tables (working copy)

- **Added:** 31 labels and 3 data labels with synopses and end-of-line comments, Klive names.
  - The scanner: `LINE_SCAN` rewritten in full, `LS_LINE`, `LS_ERROR`, `LS_STATEMENT`, `SYNTAX_NEXT`,
    `SYNTAX_ITEM`, `SYNTAX_TOKEN`, `ST_COMPARE`, `CHECK_END`, `END_AT_HL`, `NO_STATEMENT`,
    `SKIP_TO_END`, `JUMP_ROUTINE`, `MARK_ERROR`, `ASSIGN_CHECK`, `EXPR_RST` (`$0028`, its entry only),
    `IS_LETTER`, `IS_ALNUM`, `IS_BELOW_40`.
  - The operand classes `CLASS_0`-`CLASS_6`.
  - The short command routines, read in full: `LIST_CMD` (`$0256`), `RANDOMISE_CMD`, `STOP_CMD`,
    `CONTINUE_CMD`, `GOTO_CMD`, `RUN_CMD` (`$0923-$0942`); REM is `SKIP_TO_END`, CLEAR `CLEAR_VARS`,
    CLS `CLS_DISPLAY`, NEW `START`. The rest are named by address in the table's synopsis.
  - Regions (`bytes`): `SYNTAX_TABLE` `$0752-$07BD` (offsets, then `SYNTAX_ENTRIES` from `$076C`)
    and `CLASS_TABLE` `$0836-$083C`.
- **Method:** the bytes through `tools/zx80-dis.cjs`; the tables' extents and contents from their
  readers (`$07FC-$0807`: `$0752 + T - $E6 + offset`; `$0819-$0821`: `$0836 + n + offset`), every
  entry decoded by a script reading the ROM bytes the way SYNTAX_ITEM does. The entries end at
  `$07BD`; NEW's offset points at `$07C3`, LINE_SCAN's own `LD HL,$0000` / `NOP` bytes, read as class
  0 and address `$0000`. The two-pass apply left every instruction start outside the new regions
  unchanged.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`): `10000 PRINT 1` marked
  X_PTR = `$402E`, just after the number; `LET A="X"` marked at its end; FLAGS = `$80` after
  `PRINT "HI"` and `$C0` after `PRINT 2` (bit 6: the type); `10 GO TO 30` / `20 PRINT "A"` /
  `30 STOP` / `40 PRINT "C"`, RUN: report `9/30`, OLDPPC = 31, ERR_NR = 8, line 20 not printed;
  CONTINUE: `C`, `0/40`; `LIST 20`: E_PPC = 20, no report; a REM line as a command: `0/-2`. A probe
  stopping at `$0000` after NEW did not stop (the key was likely lost); NEW's routine is described
  from the bytes only.
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-19 — `zx80.rom.dis`, the expression evaluator, variables and the assignment (working copy)

- **Added:** 65 labels and 3 data labels with synopses and end-of-line comments, Klive names.
  - The evaluator: `EVAL` (`$09E1`) and its `EV_*` steps, `PRIORITIES` (`$0AA3-$0AAC`), `OP_TABLE`
    (`$0D1F-$0D38`, the 13 operation routines named by address), `EXPR_RST` rewritten, `EXPR_NEXT`
    (`$0025`), `BRACKET_EXPR` (`$0049`).
  - Names: `VAR_SCAN` (`$0AAD`) with `VS_*`, `FUNCTION_TABLE` (`$0BC0-$0BEC`), `VAR_FIND` (`$0B3B`)
    with `VF_*`, `FN_RESULT`, `VAR_NOT_FOUND`.
  - The functions read in full: `PEEK_FN` (also CODE), `CHR_FN`, `TL_FN`, `STR_FN`, `USR_FN` (`$06F0`,
    PRINT_IF_RUN's `JP (HL)`), `EMPTY_STRING`; `RND_FN` by its entry only; ABS by address.
  - The assignment: `ASSIGN` (`$0C3D`) with `AS_*`, `NEW_STRING`, `NEW_VAR_END`, `WORKSPACE_RST`
    (`$0030`) and `WS_ROOM` (`$0CF3`), `CLEAR_TO_HL` (`$0D0D`), `DROP_RETURN`.
  - Regions: `PRIORITIES` and `FUNCTION_TABLE` (`bytes`), `OP_TABLE` (`words`).
- **Method:** the bytes through `tools/zx80-dis.cjs`, the operator stack and the register-set swaps
  traced by hand; the tables' extents from their readers (`$0A47`: `$0AA3 + code` for codes 0-9;
  `$0A5D`: `$0D1F + 2 × code` for 0-12, codes 10-12 from EV_PUSH's `+ 3`; VS_FUNCTION's walk from
  `$0BBF + 1` to the 0 at `$0BEC`), decoded by a script reading the ROM bytes. The way a new
  variable takes the `$80`'s place was traced through WS_ROOM, MAKE_ROOM and NEW_VAR_END for both an
  empty workspace and one holding the edit line. The two-pass apply left every instruction start
  outside the new regions unchanged.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`, each a command):
  `2+3*4` 14, `10-2-3` 5, `-5+2` -3, `NOT 0` -1, `7/2` 3, `"A"="A"` -1, `1=2` 0, `CODE("A")` 38,
  `CHR$(38)` A, `TL$("ABC")` BC, `STR$(-12)` -12, `PEEK(0)` 33, `ABS(-3)` 3; the variables area after
  `LET A=5` `66 05 00 80`, then `LET AB=7` adds `46 A7 07 00`, `LET A$="HI"` adds `86 2D 2E 01`,
  `LET A$="HELLO"` removes it and adds `86 2D 2A 31 31 34 01` at the end, `LET A=A+1` makes A 6;
  `AB*A` 42; `DIM B(3)` adds `A7 03` and 8 zero bytes, `LET B(2)=9` sets the third word;
  `B(4)`: ERR_NR 2, report 3; `Z`: ERR_NR 1, report 2; `32767+1`: ERR_NR 5, report 6. (`**` could not
  be typed through the harness's typer.)
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems).

### 2026-10-19 — `zx80.rom.dis`, the arithmetic and the character set (working copy)

- **Added:** 34 labels and 1 data label with synopses and end-of-line comments, Klive names.
  - The operation routines: `OP_SUBTRACT`, `OP_ADD` (`ADD_CHECK`, `OVERFLOW`), `OP_MULTIPLY`
    (`MUL_SIGN`), `MULT16` (`M16_*`), `OP_POWER` (`POW_*`), `OP_DIVIDE` (`DIV_*`), `OP_AND`, `OP_OR`,
    `OP_EQUAL` (`EQ_RESULT`), `OP_GREATER`, `OP_LESS` (`LESS_RESULT`), the string comparisons
    `OP_STR_EQUAL`/`OP_STR_GREATER`/`OP_STR_LESS` and `STR_COMPARE`; `ABS_BOTH`, `SWAP_ABS`,
    `ABS_HL` (ABS), `NEGATE`.
  - `RND_FN` described in full (`RND_SEED_0`, `RND_STORE`); `RAND_STORE` and `VS_FN_RUN`, two
    targets inside routines described earlier.
  - `OP_TABLE` and `FUNCTION_TABLE` now name the routines by label.
  - `CHARACTER_SET` (`$0E00-$0FFF`), a `bytes` region of one binary row per byte: the ROM's code
    ends at `$0DFF`.
- **Method:** the bytes through `tools/zx80-dis.cjs`; MULT16's shift-and-add, OP_DIVIDE's inverted
  quotient and sign bit, RND's mod-65537 step and STR_COMPARE's end test traced by hand. The
  character set's address and bit order from Klive's core (`zx8081-ula.c`: `(address & $FE00) |
  (code & $3F) << 3 | line`, inverted for codes with bit 7 clear; `zx8081-video.c`: MSB first) and
  I = `$0E` at `$026F`. `apply-annotations.cjs` now keeps a new region's `rowBytes` and `radix`.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`, each a command): `-7/2` -3,
  `7/-2` -3, `-7/-2` 3, `1/0` report 6; `181*181` 32761, `182*181` report 6, `-181*181` -32761;
  `-32767-1` -32768, `-32767-2` report 6; `2**10` 1024, `-2**3` -8, `2**0` 1, `2**15` and `2**-1`
  report 6; `5>3` -1, `3>5` 0, `3<5` -1, `-30000<30000` -1; `"AB"<"AC"`, `"B">"A"`, `"A"<"AB"` and
  `"A "<"A"` all -1; after `RANDOMISE 1`, `RND(10)` gave 1, 1, 10 with SEED `$004D`, `$1729`,
  `$F74F` (the values the mod-65537 step predicts); `ABS(-32767)` 32767. AND and OR were not run
  (the harness typed AND as letters).
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems); 36 unlabelled targets remain, in the tape routines
  (`$01BA-$024D`), PRINT (`$06F1-$073A`, `$0978-$09CF`), FOR, IF and `$0921`.

### 2026-10-19 — `zx80.rom.dis`, the command routines: PRINT, INPUT, IF, FOR, NEXT, GO SUB, RETURN, POKE, DIM (working copy)

- **Added:** 27 labels with synopses and end-of-line comments, Klive names: `PRINT_CMD` (`PR_ITEM`,
  `PR_SEPARATOR`) and its helpers `PRINT_RESULT`, `PR_CHAR`, `PR_CHECK`, `PR_STRING`,
  `PRINT_NEWLINE`, `PR_DONE_TEST`, `SCREEN_FULL`, `PRINT_COMMA` (`PC_TAB_LOOP`), `PRINT_SAVE_POS`
  (`$06F1-$073B`); `INPUT_CMD` (`IN_TYPE`, `IN_CURSOR`, `INPUT_ERROR`); `IF_CMD` (`IF_THEN`);
  `FOR_CMD` (`FOR_STORE`); `NEXT_CMD` (`NEXT_ERROR`); `GOSUB_CMD`; `RETURN_CMD`; `POKE_CMD`;
  `DIM_CMD`. `SYNTAX_TABLE`'s synopsis names them all by label. The comment at `$026C` now says what
  the start-up PUSH AF is for: RETURN_CMD recognises the stack's bottom word by its `$3F`.
- **Method:** the bytes through `tools/zx80-dis.cjs`; the GO SUB stack (a word under the routine's
  return address, left on the machine stack when LINE_SCAN returns) and the bottom-word test traced
  by hand; the FOR variable's layout from FOR_CMD and NEXT_CMD and NEXT_ITEM's 6 bytes.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`): `PRINT "A";"B"` AB;
  `PRINT 1,2,3` 8 columns apart; `PRINT "X";` and a bare PRINT; `10 IF 1=1 THEN PRINT "T"` /
  `20 IF 1=2 THEN PRINT "F"`: only T, `0/20`; `10 FOR I=1 TO 3` / `20 PRINT I;` / `30 NEXT I`: 123,
  `0/30`, I = `EE 04 00 03 00 0B 00`; `10 NEXT I` alone: `2/10`; the GO SUB program: SE, `9/30`;
  RETURN as a command `7/-2`; `POKE 16413,9` then `PEEK(16413)` 9; INPUT as a command `8/-2`;
  `10 INPUT A$` / `20 PRINT A$`: the answer line `01 B0 01 76`, FLAGX `$20`, DF_SZ 24, then HI and
  `0/20`; `DIM C(2)`: `A8 02` and 6 zero bytes; `DIM D(256)`: report 3; `10 PRINT 1` /
  `20 GO TO 10`: 23 lines, then `5/10`. NEXT on a variable that is not a FOR one (report 1) was not
  run: it is from the code.
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 0 (`checkRomSidecar`: no problems); the 18 unlabelled targets left are all in the
  tape routines (`$01BA-$024D`).

### 2026-10-19 — `zx80.rom.dis`, SAVE and LOAD; level 1 and level 2 (working copy)

- **Added:** 21 labels with synopses and end-of-line comments, Klive names: `SAVE_CMD` (`$01B6`) with
  `SV_LEADER`, `SV_LEADER_PAUSE`, `SV_START`, `SV_BYTE`, `SV_BIT`, `SV_PULSE`, `SV_PAUSE_OFF`,
  `SV_PAUSE_ON`, `SV_GAP`; `NEXT_TAPE_BYTE` (`$01F8`); `TAPE_DONE` (`$0203`); `LOAD_CMD` (`$0206`) with
  `LD_QUIET`, `LD_QUIET_LOOP`, `LD_BYTE`, `LD_WAIT`, `LD_SIGNAL`, `LD_COUNT`, `LD_BIT`, `LD_BREAK`.
  Synopses for the two labels that had none (`WK_PAUSE`, `SYNTAX_ENTRIES`).
- **Method:** the bytes through `tools/zx80-dis.cjs`. The tape output and input from Klive's core
  (`src/emu/machines/zx8081/wasm/README.md`: the tape output is the vertical sync; `zx8081-ula.c`:
  bit 7 of port $FE is the tape signal); the ROM addresses that README's tape section gives were not
  used. LD_COUNT's decision traced with C wrapping past 0, which a first reading missed and the run
  below showed.
- **Runs** (a throwaway probe in `test/zx8081-hw/`, deleted; `zx80-16k`): `_input/zx80-tapes/klive/hello.o`
  inserted for a real-time load (no fast-load trap), LOAD typed, breakpoints at `$021A`, `$023E`,
  `$0242` and `$0203`: the quiet wait ended at `$021A`; the first byte's eight 1 bits reached
  `$0242` with C = `$D6`/`$D7` and carry clear, the 0 bits with C = `$37`/`$38`, carry set at `$0242`
  after `CP $56`; `$4000-$4003` held the file's first bytes (`FF 04 00` ...). SAVE was not run: it
  is from the code.
- **Names:** none from a name list. **Provenance:** `observed` throughout.
- **Level:** 2, measured by `checkRomSidecar` and recorded in the working copy: 314 labels, every
  control-transfer target labelled and every label with a synopsis; no problems.

### 2026-10-19 — `zx80.rom.dis`, the character set's characters (working copy)

- **Added:** a synopsis for each of the 64 characters in `CHARACTER_SET` (`$0E00-$0FFF`, every 8 bytes),
  in the ZX81 sidecar's style: `$NN - Character: 'c'`, `mosaic` for the ten block graphics
  `$02-$0B`, `ukp` for £ (`$0C`). The table's own synopsis stays at `$0E00`, with `$00`'s line after it.
- **Method:** the names from Klive's `ZX80_CHARSET` (`src/common/zx8081/charset.ts`, read off these
  glyphs); a sample of the patterns (`$01`, `$02`, `$0C`, `$12`, `$17`, `$3F`) printed from the ROM
  and checked by eye against them. No run.
- **Provenance:** `observed`. **Level:** 2, unchanged (`checkRomSidecar`: no problems).

### 2026-10-19 — `sp48.rom.dis`, the restarts and the start-up up to the main loop (working copy)

- **Added:** 94 labels and their synopses and comments, in `<Klive home>/RomAnnotations/sp48.rom.dis`
  (not yet copied to `src/public/roms/`): the restarts and interrupts `$0000-$0094` (`RESET`,
  `PRINT_A`, `CUR_CHAR`/`NEXT_CHAR`/`SKIP_TEST`, `WS_ROOM`, `MASK_INT`, `ERROR_TAIL`, `NMI`); the
  cold start and NEW, `NEW_CMD` to `MAIN_RESET_EDIT` (`$11B7-$12A9`); and the routines start-up
  calls: `CLS`/`CLS_ALL`/`CLS_LOWER`, `CLEAR_LINES`, `SET_POS`/`STORE_POS`, `LINE_ADDR`,
  `TEMP_COLOURS`, `CLEAR_PRINTER`, `PRINT_MESSAGE`/`PRINT_TOKEN`/`FIND_ENTRY`, `CHAN_OPEN` and the
  channel flag routines, `MAKE_ROOM`/`POINTERS_UP`/`TEST_ROOM`, `CLEAR_EDIT_WS`, `CALC_STK_RESET`,
  `INDEXER`. `KEY_SCAN` (`$028E`) is described; `KEYBOARD` (`$02BF`) and `MAIN_LOOP` (`$12A2`) are
  labelled with only their first lines described.
- **Regions:** five data regions, each bounded from the bytes and the code that reads them: the
  keyword table `$0095-$0204` (92 bit-7-terminated strings walked from `$0095`; code resumes at
  `$0205`), the start-up message table `$1538-$1554`, the channel data `$15AF-$15C3` (21 bytes, the
  `LDIR` count at `$123E`), the stream table `$15C6-$15D3` (14 bytes, `$1282`), and `CHAN_OPEN`'s
  letter table `$162D-$1633` (read by `INDEXER` from `$1621`). The listing resynchronised on the same
  instruction starts as before, plus `$1555` after the message table.
- **Method:** the ROM bytes through Klive's own disassembler with the 48K decoding
  (`tools/sp48-dis.cjs`, new this session), read instruction by instruction. One throwaway probe on
  `test/harness/sp48` (deleted): the cold start reaches `$11EF` after 82 frames with HL = `$FFFF`;
  RAMTOP `$FF57`, UDG `$FF58` (its first 8 bytes equal `$3E08`'s), CHANS `$5CB6`, PROG = VARS
  `$5CCB`, E-LINE `$5CCC`, WORKSP = STKBOT = STKEND `$5CCE`, ERR-SP `$FF54`, BORDCR = ATTR-P `$38`,
  REPDEL 35, REPPER 5, NMIADD 0; the channel and stream bytes as in the regions; line 23 shows the
  copyright line. NEW typed in K mode (A, ENTER) stops at `$11B7`, enters `$11CB` with A = `$FF`,
  skips `$1200`, and keeps a RAMTOP poked to `$7FFF`. The CAPS SHIFT / SYMBOL SHIFT key numbers
  (`$27`, `$18`) were worked out from Klive's own matrix (`SpectrumKeyCode.ts`: row 0 bit 0, row 7 bit 1).
- **Manual:** the token codes `$A5-$FF` of the keywords (the keyword table's synopsis), the colour
  meaning of `$38` (`$1265`), and the name COORDS for `$5C7D` (`$0DAF`); those lines are `manual`.
  Other system variable names from Klive's table (`ZxSpectrum48SysVars.ts`), which names `$5C7D`
  `UDG` by mistake (its description is the plotted coordinates).
- **Names:** Klive names throughout, chosen from what the code does; no name list was used.
- **Provenance:** `observed`, except the three `manual` lines and the keyword table region.
- **Level:** 0 (`checkRomSidecar`: no problems; 842 unlabelled targets, from 940). The working copy
  exports and reassembles to the ROM byte for byte (`buildRomSourceExport`, `compareRomAssembly`).

### 2026-10-19 — `sp48.rom.dis`, the main execution cycle and the report handler (working copy)

- **Added:** 27 labels and their synopses and comments: the main cycle `MAIN_LOOP`/`MAIN_ENTRY`
  to `MAIN_LINE_OK` (`$12A2-$1300`), the report handler `MAIN_REPORT` to `REPORT_DONE`
  (`$1303-$138E`) and `REPORT_NO_ROOM` (`$1555`); the routines the cycle calls, described as far as
  read: `REMOVE_NUMS`, `E_LINE_NO`, `PRINT_BC_NUM`, `PRINT_A_DIGIT`, `CLEAR_INPUT`/`INPUT_RANGE`,
  `RECLAIM_BC`/`RECLAIM_DE`/`DIFFERENCE`, `PRB_SEND`, `REPORT_C`; and the entries of larger routines
  with only their first lines described: `EDITOR` (`$0F2C`), `LINE_SCAN` (`$1B17`), `LINE_RUN`
  (`$1B8A`), `ADD_LINE` (`$155D`), `AUTO_LIST` (`$1795`).
- **Regions:** the report messages `$1391-$1537`, walked from `$1391` (29 bit-7-terminated strings)
  up to the start-up message table, which the region now joins (`$1391-$1554`, one region: they touch
  and share a type). `COMMA_MESSAGES` (`$1536`) marks the second table the handler reads at `$134A`.
  Outside the region the listing kept its instruction starts.
- **Method:** the ROM bytes through `tools/sp48-dis.cjs`, read instruction by instruction. One
  throwaway probe on `test/harness/sp48` (deleted), stepping with the keys held and stopping at the
  cycle's addresses. At main level SP = `$FF56` and ERR-SP = `$FF54`, so each top-level CALL leaves its
  return in the ERR-SP slot: `$12B7` during the syntax check, `$1303` while a line runs, `$1555`
  inside `ADD_LINE` (no constant `$1303` exists in the ROM). PRINT 1 ends at `$1303` with ERR-NR `$FF`
  and shows "0 OK, 0:1"; PRINT 1/0 gives ERR-NR 5 and "6 Number too big, 0:1"; PRINT ) takes
  `$12C3`, reclaims 6 bytes and returns to `$12AC` with "PRINT ?)" in the edit line; 10 STOP goes
  `$155D` → `$12A2` and lists "10>STOP" (FLAGS2 bit 0 set afterwards); RUN on it gives ERR-NR 8,
  "9 STOP statement, 10:1", OLDPPC 10, OSPPC 2; an empty ENTER goes `$12DD` → `$12A2`.
- **Manual:** none beyond the earlier sessions' system variable names; the report texts are read
  from the ROM's own table.
- **Names:** Klive names, from what the code does; no name list.
- **Provenance:** all `observed`.
- **Level:** 0 (`checkRomSidecar`: no problems; 774 unlabelled targets, none in `$12A2-$1390`). The
  working copy exports and reassembles to the ROM byte for byte.

### 2026-10-19 — `sp48.rom.dis`, the house style, and the keyboard (working copy)

- **Restyled** every entry of the earlier sp48 sessions to `zx81.rom.dis`'s conventions: system
  variables with underscores (CH_ADD, ERR_SP), synopses wrapped at 92 columns with numbered steps
  and `Entry:`/`Exit:`/`Changes:`/`Observed:` lines, "Stops with error code n (report X)", comments
  starting with a capital and without a full stop, tests as questions. Labels of routines with the
  same job as a ZX81 one take its name: `START`, `GET_CHAR`/`GET_CHAR_TEST`/`NEXT_SKIP`/`NEXT_CHAR`/
  `CH_ADD_PLUS1`, `WORK_ROOM`/`WORK_ROOM_END`, `ERROR_CODE`/`ERROR_L`, `INT_FRAME`, `KEYWORD_TABLE`,
  `RAM_FILL`/`RAM_FILL_LOOP`/`RAM_CHECK`/`RAM_TOP_FOUND`, `MAKE_ROOM_ONE`, `MOVE_POINTERS`,
  `RECLAIM`/`RECLAIM_DE_HL`, `NO_ROOM`, `CALC_RESET`, `PRBUFF_OUT`/`CLEAR_PRBUFF`, `STRIP_NUMBERS`,
  `EDIT_LINE_NO`, `CLEAR_SCREEN`, `CLS_LINES`, `SET_PRINT_POS`, `REPORT`/`PRINT_REPORT`,
  `SET_OLDPPC`, `CHECK_EDIT_LINE`, `RUN_EDIT_LINE`, `STORE_LINE`, `REPORT_G`, `REPORT_O`. Every label
  now has a synopsis (31 inner labels got theirs).
- **Added:** 23 labels for the keyboard: `KEYBOARD` (`$02BF`) and its key-set handling (`KBD_*`,
  `$02C6-$031D`), `KEY_TEST` (`$031E`), `KEY_DECODE` and its branches (`KD_*`, `$0333-$03B4`); the six
  key tables `KEYS_MAIN`, `KEYS_E_LETTERS`, `KEYS_E_SHIFTED`, `KEYS_CAPS_DIGITS`, `KEYS_SYM_LETTERS`,
  `KEYS_E_SYM_DIGIT`.
- **Regions:** the key tables `$0205-$028D` (39 + 26 + 26 + 10 + 26 + 10 bytes, bounded by the bases
  the decoder adds codes to: `$0205` + key number, `$01EB`/`$0205` + letter, `$0230`/`$0229`/`$0254` +
  code; KEY_SCAN starts at `$028E`). They touch KEYWORD_TABLE, so the region is now `$0095-$028D`;
  each table's start has its synopsis and a data label. The listing kept its instruction starts.
- **Method:** the bytes through `tools/sp48-dis.cjs`. Two throwaway probes on `test/harness/sp48`
  (deleted). KEYBOARD called directly with keys held and MODE/FLAGS/FLAGS2 set gave LAST_K: A in K
  mode `$E6`, L mode `$61`, with CAPS LOCK or CAPS SHIFT `$41`, SYMBOL SHIFT `$E2`; E mode `$E3`, with a
  shift `$7E`; G mode A `$90`, V `$A5`; 5 `$35`, CAPS SHIFT+5 `$08`, SYMBOL SHIFT+2 `$40`, +0 `$5F`, +3
  `$23`; E mode 3 `$13`, CAPS `$1B`, SYMBOL `$CA`, 8 `$02`, CAPS+9 `$01`; G mode 1 `$81`, CAPS+1 `$8E`,
  8 `$80`, 0 `$0C`, 9 `$0F`; SPACE `$20`, ENTER `$0D`, CAPS SHIFT+SYMBOL SHIFT `$0E`; a shift key alone,
  or A+S, no key. Holding 1 in the running machine: a new key on the first interrupt, then after 35
  and every 5 more; on release the set's counter ran 4, 3, 2, 1 and the set was freed on the fifth.
  The table examples in the synopses are spelt from the ROM's own KEYWORD_TABLE.
- **Manual:** the names of the CAPS SHIFT digit codes (DELETE, EDIT, CAPS LOCK, TRUE VIDEO,
  INV. VIDEO, the cursor keys, GRAPHICS): that line is `manual`.
- **Names:** Klive names; the ZX81 sidecar's own names reused for routines with the same job.
- **Provenance:** `observed`, except the line above and the earlier `manual` lines.
- **Level:** 0 (`checkRomSidecar`: no problems; 754 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-19 — `sp48.rom.dis`, the line editor (working copy)

- **Added:** 55 labels and their synopses: `EDITOR` (`$0F2C`) and `ED_LOOP`, `INSERT_CHAR`,
  `ED_CONTROL`, `EDIT_KEY_JUMP`; the editing keys `KEY_EDIT`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_DOWN`,
  `KEY_UP`, `KEY_DELETE`, `KEY_ENTER`, `KEY_EXTEND`, `KEY_GRAPHICS`, `ED_PREV_ITEM`, `ED_ERROR`
  (`$0FA9-$1096`); channel K's input `KEY_INPUT` and its branches (`KI_*`, `$10A8-$111C`); `WAIT_KEY`,
  `CHAN_INPUT` (`$15D4-$15EE`); the line helpers `LINE_NO`/`LINE_NO_PREV`, `FIND_LINE`, `CMP_LINE_NO`,
  `NEXT_ITEM`, `E_PPC_NEXT`, `SET_LINE_WORD`; and, first lines only, `EDIT_LINE_SHOW` (`$111D`),
  `PRINT_LINE` (`$1855`), `BEEPER` (`$03B5`).
- **Regions:** `EDIT_KEY_TABLE` `$0FA0-$0FA8` (9 offsets for codes `$07-$0F`, from `$0F99` + code;
  each offset lands on a code start, and code resumes at `$0FA9`, KEY_EDIT); `ZERO_WORD`
  `$168F-$1690`, the two zero bytes LINE_NO_PREV points DE at (after MOVE_POINTERS' RET, never run).
  Only the instruction starts inside them changed.
- **Correction:** MAKE_ROOM opens its room *before* the byte at HL (that byte moves up), not after
  it, as INSERT_CHAR shows (the key lands at the old K_CUR). MAKE_ROOM, MAKE_ROOM_ONE and
  WORK_ROOM_END now say so.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted), typing with the harness's keys and reading the edit line from E_LINE to WORKSP with
  K_CUR: PRINT 123 → `F5 31 32 33|0D`; LEFT moved K_CUR before `33`; DELETE removed `32`; RIGHT moved
  it back to the end, and again did nothing; LEFT x3 reached the start, where DELETE did nothing. With
  10 PRINT 1 and 20 PRINT 2 stored, UP set E_PPC 10, DOWN 20; UP then EDIT gave
  `20 20 31 30|F5 31 0D` ("  10" and PRINT 1, the cursor after the number, no '>'), and ENTER
  stored it again. CAPS LOCK set and cleared FLAGS2 bit 3; E mode and GRAPHICS gave MODE 1 and 2 and
  0 when pressed again; E then 2 inserted `11 02`, E then CAPS SHIFT+3 `10 03`, E then 8 `13 00`.
  BEEPER was called once per key with DE = 0 (PIP) and HL = `$00C8`.
- **Manual:** the names of control codes `$10-$14` (INK, PAPER, FLASH, BRIGHT, INVERSE): the
  `ED_CONTROL` and `KEY_INPUT` lines are `manual`. The report texts are the ROM's own.
- **Names:** the ZX81 sidecar's names for the same jobs (`WAIT_KEY`, `INSERT_CHAR`, `EDIT_KEY_JUMP`,
  `EDIT_KEY_TABLE`, `KEY_LEFT`..., `LINE_NO`, `LINE_NO_PREV`, `FIND_LINE`, `CMP_LINE_NO`, `NEXT_ITEM`,
  `SET_LINE_WORD`, `EDIT_LINE_SHOW`); Klive names otherwise.
- **Level:** 0 (`checkRomSidecar`: no problems; 713 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-19 — `sp48.rom.dis`, storing lines, the listing and the edit line's display (working copy)

- **Added:** 37 labels and their synopses: `STORE_LINE` (`$155D-$15AE`) with `STORE_NEW`/`STORE_DONE`;
  `AUTO_LIST` (`$1795-$17F4`) and `LIST_ALL` (`$1833-$1854`); `PRINT_LINE` (`$1855`), `PRINT_TEXT`,
  `PRINT_CURSOR`, `PRINT_FLASH`, `SKIP_NUMBER`, `PRINT_LIST_CHR` (`$1855-$196D`); `DIGIT_OUT`,
  `PRINT_LINE_NO`, `DIGIT_TEST`; `EDIT_LINE_SHOW` in full (`$111D-$118F`); `PRINT_OUT` (`$09F4`, first
  lines only). `PRINT_BC_NUM`'s synopsis now covers its `B` bit 7 case (prints 0).
- **Regions:** `TAPE_MESSAGES` `$09A1-$09F3` (6 bit-7-terminated strings, read by PRINT_MESSAGE from
  `$0977`; the code before it ends with `JP SA_BYTES` at `$099E`). Marking it lets `$09F4`, channel
  K/S/P's output routine named in CHANNEL_DATA, list as code: before, a misdecode ran across it.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted), typing lines and reading PROG to VARS: 10 PRINT 1 → `00 0A 09 00 F5 31 0E 00 00 01 00 00
  0D`; 5 PRINT 5 stored in front; 10 STOP replaced line 10 (`00 0A 02 00 E2 0D`); 5 alone deleted
  line 5, E_PPC 5. With 30 lines `n REM` + 20 letters (n = 20..600), E_PPC 600: rows 0-21 listed
  180-600 with '>' on 600 (S_TOP 200 afterwards); after 25 cursor ups E_PPC = S_TOP = 100, listed at
  row 0 with '>'. A 41-character edit line made DF_SZ 3; after 30 DELETEs the old second row was
  blank and ECHO_E had moved back.
- **Manual:** attribute bit 7 as FLASH (the `PRINT_FLASH` line is `manual`).
- **Names:** the ZX81 sidecar's where the job is the same (`STORE_LINE`, `SKIP_NUMBER`,
  `PRINT_LINE_NO`, `EDIT_LINE_SHOW`); Klive names otherwise.
- **Level:** 0 (`checkRomSidecar`: no problems; 671 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-19 — `sp48.rom.dis`, PRINT_OUT: printing, control codes, scrolling (working copy)

- **Added:** 58 labels and their synopses: `PRINT_OUT` (`$09F4`) and the control codes `PO_BACK`,
  `PO_RIGHT`, `PO_ENTER`, `PO_COMMA`, `PO_QUEST`, `PO_COLOUR`, `PO_AT_TAB`, `PO_OPERANDS`, `PO_TAB`,
  `PO_FILL` (`$0A23-$0AD8`); `PO_ABLE`, `FETCH_POS`, `PO_ANY`, `PO_GRAPHIC`, `PO_UDG_TOKEN`,
  `PO_CHAR`, `PO_PATTERN`, `PO_ATTR` (`$0AD9-$0C09`); `PO_SCROLL` with the scroll prompt and the
  lower screen's growth (`$0C55-$0D4C`); `CL_SCROLL`/`CL_SCROLL_B` (`$0DFE-$0E43`); `REPORT_5`,
  `REPORT_D`, `REPORT_B`; and `CO_TEMP` (`$2211`, first lines only).
- **Regions:** `CTRL_TABLE` `$0A11-$0A22` (18 offsets for codes `$06-$17` from `$0A0B` + code; all
  land on code starts, and code resumes at `$0A23`, PO_BACK); `SCROLL_MESSAGE` `$0CF8-$0CFF` (`$80`,
  then "scroll?", read by PRINT_MESSAGE from `$0CA1`; code resumes at `$0D00`). The listing changed
  only inside them.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted): machine code opening a stream and printing bytes with RST $10. AT 5,3 "A", TAB 10 "B",
  comma "C" → A, B, C at columns 3, 10, 16; "XY", `$08`, "Z" → XZ; INVERSE 1 printed A's `$3C` row
  as `$C3`; B over B with OVER 1 left `$00`; `$83` gave four rows `$FF`, four `$00`; `$90` printed
  the UDG at UDG; `$F5` printed " PRINT"; AT 22,0 in the upper screen reached RST $08 from `$0C86`
  with code 4; 30 lines from a cleared screen stopped at the prompt's WAIT_KEY (`$0CB3`) with SCR_CT
  22; four lines through stream 1 made DF_SZ 5.
- **Manual:** the names of control codes `$10-$15`, attribute bit 7 as FLASH, the PAPER 9/INK 9
  meaning of P_FLAG bits 6 and 4, and OVER/INVERSE as P_FLAG bits 0 and 2: the lines naming them
  (`PO_COLOUR`, `PO_PATTERN`, `PO_ATTR`, `CO_TEMP`) are `manual`.
- **Names:** Klive names (`PO_` for the print-out routines); the ZX81 sidecar has no screen printer
  of this kind.
- **Level:** 0 (`checkRomSidecar`: no problems; 622 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-19 — `sp48.rom.dis`, the statement scanner and the syntax tables (working copy)

- **Added:** 90 labels and their synopses: the statement loop `CHECK_LINE` (renamed from
  `CHECK_EDIT_LINE`, the ZX81 sidecar's name), `STMT_LOOP`/`STMT_START`, `SYNTAX_ITEM`/`SYNTAX_NEXT`/
  `SYNTAX_CHAR`, `STMT_RET`, `RUN_EDIT_LINE`, `LINE_NEW`, `LINE_END`, `LINE_USE`, `NEXT_LINE`,
  `STATEMENT_END`, `STMT_NEXT` (`$1B17-$1C00`); the operand classes `CLASS_0`-`CLASS_B` with
  `CLASS_VAR`, `SET_DEST`, `VAL_FETCH`, `FETCH_NUM`, `USE_ZERO` (`$1C0D-$1CED`); `STOP_CMD`, `IF_CMD`;
  `EACH_STMT` (`$198B-$19B7`); `SYNTAX_Z`, `BREAK_KEY`; reports `N`, `2`, `O` (`$1725`). Every command
  routine named in the syntax entries got a `<KEYWORD>_CMD` label (`CLS` renamed `CLS_CMD`), and the
  routines the classes call (`SCAN_EXPR`, `LOOK_VARS`, `STK_VAR`, `LET_ASSIGN`, `SAVE_ETC`, `CO_*`,
  `TEST_ZERO`) a label; those not read yet say "Not yet described".
- **Regions:** `SYNTAX_OFFSETS` + `SYNTAX_ENTRIES` `$1A48-$1B16` (50 offsets for `$CE-$FF`, each
  landing on its entry; the entries decoded item by item, classes 0/3/5 followed by an address, 2/7/`$0B`
  ending one; the last, CAT's, ends at `$1B16` and CHECK_LINE starts at `$1B17`); `CLASS_TABLE`
  `$1C01-$1C0C` (12 offsets, each landing on a class routine). Outside them the listing gained one
  instruction start, `$1C0D` (CLASS_3), which the misdecode had covered.
- **Method:** the bytes through `tools/sp48-dis.cjs`; the syntax entries decoded from the bytes, their
  keywords spelt from KEYWORD_TABLE and every routine address checked to be an instruction start. One
  throwaway probe on `test/harness/sp48` (deleted): GO TO "a" was refused with the ? marker;
  PRINT 1: PRINT 2 → "0 OK, 0:2"; IF 0 THEN PRINT 1: PRINT 2 → "0:1", IF 1 → "0:3"; FORMAT "a" →
  "O Invalid stream, 0:1"; RUN on 10 PRINT 5: GO TO 30 / 20 PRINT 6 → "0 OK, 10:2"; CAPS SHIFT +
  SPACE during 30 GO TO 30 → "L BREAK into program, 30:1".
- **Manual:** the colour meaning of class 7 and class 9's MASK_T/P_FLAG changes (those lines are
  `manual`).
- **Names:** the ZX81 sidecar's for the same jobs (`CHECK_LINE`, `SYNTAX_OFFSETS`, `SYNTAX_ENTRIES`,
  `SYNTAX_ITEM`, `SYNTAX_NEXT`, `SYNTAX_CHAR`, `CLASS_TABLE`, `CLASS_n`, `CLASS_VAR`, `SET_DEST`,
  `STATEMENT_END`, `LET_ASSIGN`, `LOOK_VARS`, `SCAN_EXPR`, `*_CMD`).
- **Level:** 0 (`checkRomSidecar`: no problems; 571 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the expression evaluator and LOOK_VARS (working copy)

- **Added:** 91 labels and their synopses: `SCAN_EXPR` (`$24FB`) and its operand side
  `SCAN_OPERAND`, `OP_QUOTE`, `OP_BRACKET`, `OP_RND`, `OP_PI`, `OP_INKEY`, `OP_SCREEN`/`SCREENS_VALUE`,
  `OP_ATTR`/`ATTR_VALUE`, `OP_POINT`, `OP_ALNUM`, `OP_NUMBER`/`NUMBER_RUN`, `OP_VARIABLE`, `OP_PREFIX`,
  `PUSH_PREFIX` (`$24FF-$2711`); the operator loop `SCAN_OPERATOR`, `SCAN_OP_LOOP`, `SCAN_OP_APPLY`,
  `SCAN_OP_PUSH`, `OP_REPORT_C` (`$2712-$2794`); `LOOK_VARS` with its walk and the DEF FN parameters
  (`LV_*`, `$28B2-$2995`); the helpers `ALPHANUM`, `ALPHA`, `STK_TO_BC`, `STK_TO_A`, `FN_SKIP_SP`,
  `STACK_NUM`, `MOVE_FP`, `STACK_A`, `REPORT_B_2`; and, first lines only, `FN_CALL`, `DEC_TO_FP`,
  `STACK_BC`, `FP_TO_BC`, `POINT_SUB`, `STR_SLICE`.
- **Regions:** `SCAN_FUNCS` `$2596-$25AE` (12 INDEXER pairs and a 0, every offset landing on a code
  start, code resuming at `$25AF`); `OPERATORS` + `PRIORITIES` `$2795-$27BC` (13 pairs and a 0 at
  `$27AF`, then 13 priorities read as `$26ED` + operation `$C3-$CF`). Outside them the listing gained
  `$27BD`, FN's entry, which the misdecode had covered.
- **Method:** the bytes through `tools/sp48-dis.cjs`; the calculator operation names in the synopses
  are those Klive's own 48K decoder prints for those codes. One throwaway probe on
  `test/harness/sp48` (deleted), inserting token bytes into the edit line with MAKE_ROOM at K_CUR
  (from the editor's WAIT_KEY loop head, `$15DE`) and pressing ENTER: 2+3*4 14; 2^3^2 64; -2^2 -4;
  NOT 1=0 1; "ab"+"cd" abcd; "a"<"b" 1; "x" AND 1 x, "x" AND 0 empty; 1 AND 0 0, 3 OR 0 3; "ab"*2
  refused with ? before '*'; VAL "2+3" 5; CODE "A" 65; LEN "abc" 3; "say ""hi""" say "hi";
  "abcde"(2 TO 3) bc; LET total value=5: PRINT TotalValue 5; PRINT zz "2 Variable not found";
  PI 3.1415927; INKEY$ with no key empty; SCREEN$ (0,0) after printing Q "Q"; ATTR (0,0) 56; BIN 101 5;
  RND from SEED 0 0.0011291504, SEED 74; 10 PRINT 2.5 stored with `0E 82 20 00 00 00`.
- **Names:** the ZX81 sidecar's for the same jobs (`SCAN_OPERAND`, `SCAN_OPERATOR`, `OP_INKEY`,
  `OP_NUMBER`, `NUMBER_RUN`, `SET_NUMERIC`, `OP_REPORT_C`, `STR_SLICE`); Klive names otherwise.
- **Level:** 0 (`checkRomSidecar`: no problems; 494 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the simple commands, FOR and NEXT (working copy)

- **Added:** 30 labels and synopses for every routine in `$1D03-$1DEB` and `$1E42-$1F53`: RESTORE,
  RANDOMIZE, CONTINUE, GO TO (`GO_TO_2`), OUT, POKE (`TWO_PARAM`), `FIND_INT1`/`FIND_INT2`, RUN, CLEAR
  (`CLEAR_RUN`, `CLEAR_STACK`, report M), GO SUB (`GO_SUB_ROOM`), `FREE_MEM`, RETURN (report 7), PAUSE;
  FOR (`FOR_VALUES`, `FOR_STORE`, `FOR_SEARCH`, report I), `LOOK_PROG`, NEXT (report 1), `NEXT_LOOP`. The
  `*_CMD` labels from the syntax table got full synopses.
- **Regions:** `$1DE9`, one byte: the end-calc the calculator's jump-true at `$1DE4` lands on (the
  listing had shown it as `JR C`); `$1DEA` (SCF) now lists as code. Nothing else changed.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted), inserting token bytes into the edit line from WAIT_KEY's loop head and pressing ENTER:
  10 GO SUB 100: PRINT "b" / 20 STOP / 100 PRINT "a";: RETURN → ab, 9 at 20:1; RETURN alone → report
  7; FOR i=1 TO 3: PRINT i;: NEXT i → 123; FOR i=5 TO 1: PRINT "x";: NEXT i: PRINT "y" → y; FOR i=3 TO
  1 STEP -1 → 321, the variable `E9`, value 0, limit 1, step -1, `FE FF`, 3; LET j=1: NEXT j → report 1;
  NEXT q → report 2; FOR k=5 TO 1: PRINT k → report I; CLEAR 30000 → RAMTOP 30000 holding `$3E`; CLEAR
  100 → report M; POKE 30001,300 → report B, POKE 30001,-1 → 255; RANDOMIZE 5 → SEED 5, RANDOMIZE →
  FRAMES' low word; GO TO 61440 → report B; STOP then CONTINUE → p, then q, 0 OK at 10:3.
- **Names:** Klive names; the ZX81 sidecar's where the job is the same (`*_CMD`, `TEST_ROOM`).
- **Level:** 0 (`checkRomSidecar`: no problems; 466 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, PRINT, LPRINT, INPUT, READ, DATA and DIM (working copy)

- **Added:** 55 labels and their synopses: `RUN_ONLY` (`$1FC3`), PRINT/LPRINT and the print list
  (`PRINT_START`, `PRINT_LIST`, `PRINT_SEP`, `PRINT_ITEM`, `PRINT_STRING`, `PRINT_END_Z`,
  `STREAM_ALTER`, `PRINT_COLOUR`; `$1FC9-$2088`, `$21F2`); INPUT (`INPUT_*`, `IN_ASSIGN`, `IN_STOP`,
  `IN_CHAN_K`; `$2089-$21E0`); READ (`READ_NEXT`, `READ_ITEM`, `READ_SEP`), DATA (`DATA_LOOP`,
  `DATA_SKIP`; `$1DEC-$1E41`); DIM (`DIM_*`, `$2C02-$2C87`); `REPORT_3`; and, first lines only,
  `SUBSCRIPT` (`$2ACC`), `HL_MULT` (`$2AF4`). The `*_CMD` synopses of these commands were rewritten.
- **Regions:** none.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted), inserting token bytes into the edit line and pressing ENTER, then typing answers:
  PRINT "a";"b";"c","d"'"e" → abc, d at column 16, e on the next line; AT 3,4;"x";TAB 9;"y" → x at 4,
  y at 9 of line 3; INK 2;"z" → attribute `$3A`; a trailing ';' left the position on the line; INPUT
  "n?";n answered 21 → 42 (workspace `0D`, FLAGX `$62` while waiting); INPUT a$ → workspace `22 22 0D`,
  cursor on the second quote, FLAGX `$22`, answer hi → hi!; INPUT LINE b$ → FLAGX `$A2`, 1+2 → 1+2!; a
  bad answer ! was shown again with ?; STOP → "H STOP in INPUT, 10:1"; READ a,b$ / DATA 5,"q" → 5q,
  then READ c → "E Out of DATA, 10:3"; DIM a(2,3): DIM b$(4) → `81 23 00 02 02 00 03 00` + 30 zeros,
  `C2 07 00 01 04 00` + 4 spaces. LPRINT and PRINT #1 were run but their output was gone (the report
  emptied the buffer and the lower screen) before it was read: no claim rests on them.
- **Names:** the ZX81 sidecar's `RUN_ONLY`; Klive names otherwise.
- **Level:** 0 (`checkRomSidecar`: no problems; 412 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the variable handlers and DEF FN (working copy)

- **Added:** 67 labels and their synopses: `STK_VAR` (`$2996`, `SV_*`), `STR_SLICE` (`$2A52`, `SL_*`),
  `STK_ST_0`, `SUBSCRIPT`/`SUBSCRIPT_A`, `GET_DIM`, `HL_MULT`, `HL_HL_X_DE` (`$30A9`, first lines
  only); `LET_ASSIGN` (`$2AFF-$2BF0`, `L_*`); `DEF_FN_CMD` (`$1F60-$1FC2`, `DF_*`); `FN_CALL`
  (`$27BD-$28AA`, `FN_*`, report Q).
- **Regions:** none.
- **Method:** the bytes through `tools/sp48-dis.cjs`. Two throwaway probes on `test/harness/sp48`
  (deleted), inserting token bytes into the edit line: LET Total Sum=3: LET q=7 → VARS `B4 6F 74 61
  6C 73 75 ED` + 5 bytes, `71` + 5 bytes; LET q=9 changed only q's bytes; LET a$="hello" → `41 05 00`
  hello, then LET a$="hi" → `41 02 00 68 69`; a$(2 TO 3)="EL" → hELlo, ="XYZ" → hXYlo; slices (TO 2)
  hX, (4 TO) lo, () whole, (3 TO 2) and (9 TO 2) empty, (7) report 3; DIM c$(3): c$="ABCDE" → ABC,
  c$="X" → X and two spaces; DIM n$(2,3): n$(2)="xy" → "xy ", n$(2,2) y; DIM m(2,3), m(2,3)=6,
  m(1,2)=4 → 6, 4, 0; m(3,1) → report 3. 10 DEF FN f(x,y)=x*y+1 stored `0E` + 5 bytes after x and y
  (leftover bytes until called, then 3 and 4); FN f(3,4) 13; with 20 DEF FN s$(a$)=a$+"!", FN s$("hi")
  hi!; FN g(1) → "P FN without DEF"; FN f(1) and FN f("a",2) → "Q Parameter error".
- **Names:** Klive names (`SV_`, `SL_`, `L_`, `DF_`, `FN_` for the routines' parts).
- **Level:** 0 (`checkRomSidecar`: no problems; 346 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, string tables as `defc` regions (working copy)

- **Changed:** the new `defc` region decoding (`"type": "bytes", "decode": "defc"`) on the tables
  whose entries end with bit 7 set: KEYWORD_TABLE `$0095-$0204` (split from the key tables, which stay
  a plain `bytes` region `$0205-$028D`), TAPE_MESSAGES `$09A1-$09F3`, SCROLL_MESSAGE `$0CF8-$0CFF` and
  the report and start-up messages `$1391-$1554`. KEYWORD_TABLE's synopsis says so. No label, line
  or provenance changed but the new region key `0:517:region`.
- **Method:** the export as source lists 132 `.defc` rows (`KEYWORD_TABLE: .defc "?"`, `.defc "RND"`,
  ...; `.defc "\x0DProgram: "`; `.defc "\x7F 1982 Sinclair Research Ltd"`); the label COMMA_MESSAGES
  inside "Tape loading error" cuts it into `.defm` and `.defc "r"`. It reassembles to the ROM byte for
  byte; `checkRomSidecar`: no problems.

### 2026-10-20 — `sp48.rom.dis`, the unused space as a `fill` region (working copy)

- **Added:** the new `fill` region decoding on `$386E-$3CFF` (`"type": "bytes", "decode": "fill"`), the
  label `UNUSED_SPACE` and its synopsis. The `defc` regions' type is now called "Bit-7 Text" in the IDE.
- **Method:** the bytes: the only run of 16 or more equal bytes below the character set is 1170 x `$FF`
  from `$386E`; the code before it ends with the RET at `$386D` (the `JR C` the listing shows at `$386C`
  is the end-calc of the calculator's jump-true from `$384D`, left for the calculator session), and no
  code target lies in it (`checkRomSidecar`). The export lists `UNUSED_SPACE: .fillb 1170,$FF` and
  reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the colour items and the graphics commands (working copy)

- **Added:** 43 labels and their synopses: the colour items `CO_ITEMS`, `PRINT_COLOUR`, `CO_TEMP_ITEM`
  and `CO_TEMP` with its parts (`CO_*`, report K; `$21E1-$2293`); BORDER (`$2294-$22A9`); `PIXEL_ADDR`,
  POINT, PLOT, `PLOT_SUB` (`$22AA-$2306`); CIRCLE (`$2320-$2381`); DRAW with its arc (`DRAW_ARC`,
  `ARC_*`, `$2382-$247C`); `CD_PARAMS` (`$247D-$24B6`); `DRAW_LINE` (`DL_*`, `$24B7-$24F8`). The
  `*_CMD` synopses of these commands were rewritten.
- **Regions:** `DRAW_ARC_CALC` `$23A3-$23B4`: calculator codes the jump-true at `$239C` lands on, which
  the listing showed as Z80 code; decoded in the synopsis (the names Klive's 48K decoder gives these
  codes), the Z80 resuming at `$23B5`, `DRAW_ARC_SIZE`. Only the starts inside it changed.
- **Method:** the bytes through `tools/sp48-dis.cjs`; the trigonometry of CD_PARAMS and the arc loop
  described only as far as the calculator codes show it. One throwaway probe on `test/harness/sp48`
  (deleted), inserting token bytes into the edit line: PLOT 0,0 lit the bottom left pixel; PLOT 3,0
  then PLOT OVER 1;3,0 cleared it; PLOT INVERSE 1;3,0 cleared it; POINT (5,7) 1 and (6,7) 0 after
  PLOT 5,7; PLOT 0,176 report B; PLOT 10,10: DRAW 20,5 → COORDS 30,15; DRAW 250,0 → to x 255, report
  B; PLOT 100,50: DRAW 50,0,PI → COORDS 150,50; CIRCLE 128,88,40 lit (168,88), (128,128), (128,48),
  COORDS 168,83; CIRCLE 20,20,0.5 plotted (20,20) only; PLOT INK 2;PAPER 6;30,30 → attribute `$32`,
  ATTR_P `$38`; BORDER 2 → BORDCR `$17`, BORDER 5 → `$28`; BORDER 8, INK 10, FLASH 2 → report K;
  PAPER 1;INK 9 → `$0F`, PAPER 6;INK 9 → `$30`; INK 8;PAPER 8;BRIGHT 1 over a PAPER 2 cell → `$50`;
  INK 3: PAPER 5: FLASH 1: BRIGHT 1 → ATTR_P `$EB`; OVER 1: INVERSE 1 → P_FLAG `$0A`.
- **Manual:** the names INK, PAPER, FLASH, BRIGHT, INVERSE, OVER and their 8/9 meanings, the border's
  port `$FE` bits (the lines naming them are `manual`).
- **Names:** Klive names (`CO_`, `ARC_`, `DL_`).
- **Level:** 0 (`checkRomSidecar`: no problems; 305 unlabelled targets). The working copy exports
  and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the tape commands, BEEPER and BEEP (working copy)

- **Added:** 97 labels and their synopses for `$03B5-$09A0`: BEEPER (`BEEPER_*`), BEEP (`BEEP_*`, report B),
  `SEMITONES`, the unreferenced `UNUSED_STR_BIT7` (`$04AA`; no CALL, JP or stored address in the ROM);
  SA_BYTES (`SAVE_*`), `TAPE_RETURN`; LD_BYTES (`LOAD_*`, `TAPE_EDGE`, `TAPE_TWO_EDGES`); SAVE_ETC with
  its header building (`SE_*`), the header search (`LOAD_HEADER_*`), VERIFY/CODE (`LOAD_CODE_*`,
  `LOAD_BLOCK`, report R), program and array loading (`LOAD_PROG_ARRAY`, `LOAD_PROGRAM`), MERGE
  (`MERGE_*`) and `SAVE_CONTROL`; the data label `TAPE_KIND_MSGS` (`$09C0`) inside TAPE_MESSAGES.
- **Regions:** `SEMITONES` `$046E-$04A9`, 12 five-byte numbers (bytes; `rowBytes` stops at 4), read by
  BEEP at `$046E` + 5 x semitone; decoded from the bytes as 261.626 to 493.883.
- **Names:** Klive names chosen from what the code does (`SAVE_`, `LOAD_`, `TAPE_`, `SE_`, `MERGE_`):
  the conventional names of these routines were deliberately not used (D4). The earlier session's
  `SA_BYTES`, `LD_BYTES`, `LD_START`, `LD_BAD_HEADER`, `LD_RESUME` (the repository's own) were kept.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted), with TAP blocks built in the test (flag, bytes, XOR) and fast load: SAVE "" and SAVE
  "abcdefghijk" → report F; SAVE "a" CODE refused when checking; LOAD "" CODE → "Bytes: abc", 1,2,3,4
  at 32768; LOAD "abc" CODE 40000 → at 40000; VERIFY with a byte different → report R; LOAD "" CODE
  50000,4 for an 8-byte block → report R; LOAD "abc" CODE past "xyz" → printed "Bytes: xyz", loaded abc;
  a program header with line 10 → loaded and ran line 10; MERGE of 20 PRINT 8 → listed 10 and 20;
  BEEP 11,0 → report B; BEEP .5,0 → BEEPER with DE 130, HL 1642; BEEP .5,12 → DE 261, HL 806.
- **Manual:** port `$FE`'s bits (border 0-2, 3, speaker 4, tape input 6): the BEEPER and TAPE_EDGE lines
  are `manual`.
- **Level:** 0 (`checkRomSidecar`: no problems; 210 unlabelled targets). The working copy exports and
  reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, streams, the printer and LIST (working copy)

- **Added:** 30 labels and their synopses: CLOSE # (`CLOSE_*`, `STREAM_WORD`; `$16E5-$1735`), OPEN #
  (`OPEN_*`, report F; `$1736-$1792`), COPY and the printer (`COPY_*`, `PRBUFF_ROW`, `PRINTER_*`;
  `$0EAC-$0F2B`), LIST/LLIST (`LIST_*`; `$17F5-$1832`). The `*_CMD` synopses were rewritten.
- **Regions:** `CLOSE_LETTERS` `$1716-$171B` (K, S, P pairs for INDEXER, every offset to `$171C`, whose
  POP HL / RET now list as code) and `OPEN_LETTERS` `$177A-$1780` (K, S, P and the 0).
- **Method:** the bytes through `tools/sp48-dis.cjs`. Two throwaway probes on `test/harness/sp48`
  (deleted): OPEN #4,"s" → word 6, PRINT #4 printed on the screen; OPEN #4,"P" → 16; CLOSE #4 → 0, then
  PRINT #4 → report O; OPEN #5,"q" / "ss" / "" → report F; OPEN #16,"s" → report O; OPEN #2,"k" → 1,
  CLOSE #2 → 6; with lines 10-30 LIST 20 listed 20 (with '>') and 30, E_PPC 20; COPY with no printer
  (port `$FB` reads `$FF`) → 0 OK at once. The printer's actual output was not seen: Klive's 48K core
  has no ZX Printer.
- **Manual:** the ZX Printer's port `$FB` bits (motor, speed, stylus, the encoder and "no printer"
  bits): the PRINTER_ROW and PRINTER_OFF lines are `manual`.
- **Level:** 0 (`checkRomSidecar`: no problems; 186 unlabelled targets). The working copy exports and
  reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the calculator: dispatch, stack, memories, arithmetic (working copy)

- **Added:** 161 labels and their synopses: the dispatcher `CALC_ENTRY` and its loop (`$335B-$33A2`); every
  operation's routine named from `CALC_OP_TABLE` with the operation names Klive's own 48K decoder
  prints (`CALC_ADDITION`, `CALC_COMPARE` for the twelve comparisons, ...; those not read yet say "Not
  yet described"); the literals (`UNPACK_LITERAL`, `SKIP_LITERALS`), memories (`MEM_ADDRESS`, get-mem,
  st-mem, stk-const), exchange, abs/negate/sgn, peek/in/usr, not/less-0/greater-0/or/and, the
  comparisons, strs-add, chr$, len, the jumps, end-calc, n-mod-m, int; the small integers
  (`SMALL_INT_GET`, `SMALL_INT_PUT`, re-stack); addition/subtract, multiply, division and their shared
  helpers (`ADD_*`, `MUL_*`, `DIV_*`, `RESULT_EXPONENT`, `SHIFT_UP`, `ROUND_RESULT`, `STORE_RESULT`, report
  6); truncate (`TRUNC_*`).
- **Regions:** `CALC_CONSTANTS` `$32C5-$32D6` (five compact literals, 18 bytes); `CALC_OP_TABLE`
  `$32D7-$335A` (66 words, listed with the routines' labels); `CALC_INT_NEG` `$36B7-$36C2`, calculator
  codes the jump-true at `$36B2` lands on, decoded in the synopsis; `$36C3` (RET) now lists as code.
- **Names:** Klive names for the helpers, chosen to avoid the conventional ones (D4).
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted): INT 2.5 / -2.5 / -3 → 2 -3 -3; 300*300 90000; 65535+1 65536; -65535-1 printed -1E-38 (not
  -65536); 7/2 3.5; 1/3 0.33333333; 1/0 and 1E38*10 report 6; 1E-38/1E10 0; ABS -3 3; SGN -5 -1, SGN 0 0;
  NOT 0 1, NOT 7 0; 2<=2 1, 3>=4 0, 2<>2 0, "ab"<"abc" 1; 0.1+0.2 0.3; LET v=-5 / w=1.5 / z=65535 stored
  `00 FF FB FF 00`, `81 40 00 00 00`, `00 00 FF FF 00`.
- **Level:** 0 (`checkRomSidecar`: no problems; 66 unlabelled targets). The working copy exports and
  reassembles to the ROM byte for byte.
- **A provenance problem found in this session's own earlier work.** Some labels given in the earlier
  sp48 sessions are conventional names of these routines remembered by the AI author, not chosen from
  the code, and recorded `observed`: sp48-only `BEEPER`, `CHAN_OPEN`, `CL_SCROLL`, `CL_SCROLL_B`,
  `CO_TEMP`, `DEC_TO_FP`, `EACH_STMT`, `FIND_INT1`, `FIND_INT2`, `INDEXER`, `KEY_SCAN`, `KEY_TEST`,
  `LINE_ADDR`, `PIXEL_ADDR`, `PRINT_OUT`, `SAVE_ETC`, `STACK_NUM`, `STK_TO_A`, `STK_TO_BC`, `STK_VAR`,
  `TEMP_COLOURS`, `TEST_ZERO`, and the 45 `PO_*` labels; shared with the ZX81 sidecar `ALPHA`,
  `ALPHANUM`, `CALC_RESET`, `CLEAR_PRBUFF`, `FP_TO_BC`, `MOVE_FP`, `PRBUFF_OUT`, `SCAN_EXPR`, `STACK_A`,
  `STACK_BC`, `STR_SLICE`, `WAIT_KEY`. They must be renamed to Klive names (or recorded `manual` from a
  named name list, Q1) before this file ships. No comment or region boundary was taken from memory.

### 2026-10-20 — `sp48.rom.dis`, the memory-derived labels renamed (working copy)

- **Renamed** the labels the previous entry lists as remembered conventional names, 99 in all, to
  Klive names chosen from what each routine does, with every reference in the synopses and comments
  (123): the `PO_*` family → `OUT_*`; `CO_*` → `COL_*` (`CO_TEMP` → `SET_TEMP_ATTR`); `CL_SCROLL` →
  `SCROLL_SCREEN`, `CL_SCROLL_B` → `SCROLL_LINES_B`, `CL_SCR_*` → `SCROLL_*`; `CD_PARAMS*` → `CHORD_COUNT*`;
  `KEY_SCAN*` → `READ_KEYS*`; `KEY_TEST` → `KEY_MAIN_CODE`, `KEY_TEST_MAIN` → `KEY_MAIN_LOOKUP`; `FIND_INT1`
  → `TAKE_BYTE`, `FIND_INT2` → `TAKE_WORD`, `FIND_INT_TEST` → `TAKE_INT_TEST`; `STK_TO_BC` →
  `TAKE_TWO_BYTES`, `STK_TO_A` → `TAKE_BYTE_SIGN`; `DEC_TO_FP` → `READ_NUMBER` (the ZX81 sidecar's name for
  the same job); `STACK_NUM` → `PUSH_NUMBER`; `PIXEL_ADDR` → `PIXEL_BYTE`; `LINE_ADDR` → `LINE_SCREEN_ADDR`;
  `EACH_STMT` → `FIND_STATEMENT`; `INDEXER` → `TABLE_LOOKUP`, `INDEXER_NEXT` → `LOOKUP_NEXT_PAIR`;
  `CHAN_OPEN` → `STREAM_SELECT`, `CHAN_OPEN_FOUND` → `STREAM_FOUND`; `BEEPER*` → `TONE_*` (`TONE_OUT`);
  `SAVE_ETC` → `TAPE_COMMAND`; `PRINT_OUT` → `SCREEN_OUTPUT`; `STK_VAR` → `VAR_SUBSCRIPTS`; `TEMP_COLOURS`
  → `COLOURS_TO_TEMP`, `TEMP_COLOURS_SET` → `COLOURS_TEMP_SET`; `TEST_ZERO` → `IS_ZERO`.
- **Kept**, under the README's rule that a routine doing the same job as one named in another sidecar
  takes that name: `ALPHA`, `ALPHANUM`, `CALC_RESET`, `CLEAR_PRBUFF`, `FP_TO_BC`, `MOVE_FP`, `PRBUFF_OUT`,
  `SCAN_EXPR`, `STACK_A`, `STACK_BC`, `STR_SLICE`, `WAIT_KEY` (the ZX81 sidecar's). Whether those names in
  `zx81.rom.dis` are clean is that file's own provenance question, not settled here.
- **Not changed:** comments, regions and every other entry. `checkRomSidecar`: no problems; the
  working copy exports and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, number conversion and printing (working copy)

- **Added:** 60 labels and their synopses: READ_NUMBER with binary, decimal and exponent parts
  (`BINARY_*`, `NUM_*`; `$2C9B-$2D1A`), `DIGIT_TO_STACK`, `DIGITS_TO_FP`, e-to-fp (`TENS_*`), STACK_A and
  STACK_BC's synopses, `FP_TO_BC` (rounding, carry, sign), `FP_TO_BYTE` (`$2DD5`), `LOG10_ESTIMATE`,
  PRINT_FP (`NP_*`, `MUL10_ADD`; `$2DE3-$2F9A`), val/val$, str$, read-in and code (`$35DE-$3673`).
- **Regions:** `TENS_CALC_TAIL` `$2D6D-$2D6F` (calculator codes the jump-true at `$2D68` and the jump at
  `$2D6B` land on; the Z80 resumes at `$2D70`) and `NP_NEG_CALC` `$2DF2-$2DF3` (abs, end-calc, the
  jump-true at `$2DE6`'s target; the Z80 resumes at `$2DF4`). Only the starts inside them changed.
- **Names:** Klive names; prefixes that could echo conventional ones were avoided on purpose
  (`NP_` for the number printer, `NUM_`, `BINARY_`, `TENS_`), and `FP_TO_BYTE` rather than a
  remembered name. `FP_TO_BC`, `STACK_A`, `STACK_BC` are the ZX81 sidecar's (kept, see the rename entry).
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted): 1E9 → 1E+9; 123456789 → 1.2345679E+8; 12345678 → 12345678; .0001 → .0001; .001 → .001; .5
  → 0.5; -.5 → -0.5; 1.5E-5 → .000015; 2E10 → 2E+10; 1/7 → 0.14285714; 0 and -0 → 0; 1E38 → 1E+38;
  1E39 and BIN with 17 digits refused when checking; BIN 11111111 255, BIN 1111111111111111 65535; VAL
  "2*3" 6; VAL "1E3" 1000; VAL$ joining two strings → ab; VAL of a string expression → report C; STR$
  (1/3) 0.33333333; LEN STR$ 100 3; CODE "" 0.
- **Level:** 0 (`checkRomSidecar`: no problems; 9 unlabelled targets left in the whole ROM). The
  working copy exports and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the maths functions (working copy)

- **Added:** 10 labels and synopses for the series generator (`CALC_SERIES`, `$3449`), exp
  (`EXP_*`), ln (`LN_*`), get-argt (`ARGT_REFLECT`), sin, cos, tan, atn (`ATN_SMALL`), asn, acs, sqr and
  to-power (`POWER_ZERO_BASE`), replacing every "Not yet described" synopsis; `LINE_NO_TOO_BIG`
  (`$1A15`, EDIT_LINE_NO's report C for a line number of 10000 or more).
- **Regions:** three more calculator-code runs that a jump-true reaches outside an RST $28 decode, as
  `bytes` with a decoding synopsis: `LN_POSITIVE` `$371C-$371E` (the Z80 resumes at `$371F`),
  `ARGT_REFLECT` `$37A1-$37A8` (resumes at `$37A9`), `POWER_ZERO_BASE` `$385D-$386C` (resumes at
  `$386D`; sqr's jump-true at `$384D` also lands at `$386C`). The phantom targets `$3773`, `$379E` and
  `$3837` the misdecoded bytes produced are gone.
- **Names:** Klive names from what the code does. The series is described as the Clenshaw recurrence for
  a Chebyshev series: a mathematical description of the recurrence the codes compute, not a ROM name.
- **Method:** the bytes through `tools/sp48-dis.cjs`. One throwaway probe on `test/harness/sp48`
  (deleted): SIN 0, SIN (PI/2), SIN PI, SIN 1 → 0 1 0 0.84147098; SIN 1000 0.82687939; COS 0, COS PI,
  COS 1 → 1 -1 0.54030231; TAN 1 1.5574077; ATN 1 0.78539816; ATN -2 -1.1071487; ASN .5 0.52359878; ACS
  .5 1.0471976; LN 1 0; LN 10 2.3025851; EXP 1 2.7182818; EXP -1 0.36787944; SQR 2 1.4142136; SQR 0 0;
  2^10 1024; 2^.5 1.4142136; 0^0 1; 0^3 0; EXP -100 0; report 6 for 0^-1 and EXP 100; report A for LN 0,
  SQR -1, ASN 2 and (-2)^2.
- **Level:** 1 recorded (`checkRomSidecar`: no problems; 0 unlabelled targets). The tool measures 2,
  since every label now has a synopsis, but level 2's end-of-line comments where a purpose is not obvious
  are the author's judgement and have not been reviewed ROM-wide. The working copy exports and
  reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, level-2 comments: numbers and the calculator (working copy)

- **Added:** 862 end-of-line comments, house style (a capital first, no full stop), on the Z80
  instructions from `$2C9B` to `$36A0` and the Z80 lines in exp, ln and atn: number reading, STACK_BC,
  e-to-fp, the small-integer form, FP_TO_BC/FP_TO_BYTE, PRINT_FP, addition, multiply, division,
  normalising, truncate, re-stack, the calculator's dispatch, literals, memories and simple operations,
  comparisons, string operations, val/str$/read-in and the calculator's jumps. Calculator-code bytes
  take no comments: the decoder names each code. The comment total is now 1058 (196 before).
- **Corrected while reviewing:** SMALL_INT_GET returns the magnitude in DE (the stored two's
  complement value negated back for a negative sign), not a signed value, and leaves HL at the high
  byte; NP_SPLIT leaves the whole part on the stack and the fraction in memory 2, not the reverse.
- **Method:** the bytes through `tools/sp48-dis.cjs`, no new probes. `checkRomSidecar`: no problems,
  0 unlabelled targets; the working copy exports and reassembles to the ROM byte for byte.
- **Level:** stays 1. The rest of the ROM (`$0000-$2C9A`) is still to be reviewed for comments before
  level 2 is recorded.

### 2026-10-20 — `sp48.rom.dis`, level-2 comments: start-up, keyboard, beeper and tape (working copy)

- **Added:** 784 end-of-line comments, house style, on the Z80 instructions from `$0000` to `$0C09`:
  the restarts and the interrupt and NMI handlers, CH_ADD and SKIP_TEST, READ_KEYS, KEYBOARD and
  KEY_DECODE, TONE_OUT and BEEP, SA_BYTES, LD_BYTES and TAPE_EDGE, TAPE_COMMAND (SAVE, LOAD, VERIFY,
  MERGE: headers, names, DATA, SCREEN$, CODE, LINE), the header search, LOAD of programs, arrays and
  code, MERGE's line and variable merging, SAVE_CONTROL, and SCREEN_OUTPUT up to OUT_ATTR. Existing
  comments were kept. The comment total is now 1842.
- **Corrected while reviewing:** the comment at `$0B9E` said B = $FF meant OVER 0; it is OVER 1 (the
  old byte kept, to XOR with); OVER 0 makes B 0. MERGE_ENTER's synopsis had HL and DE swapped: the
  item is at HL in the workspace and goes in before DE in the program.
- **Method:** the bytes through `tools/sp48-dis.cjs`, no new probes. `checkRomSidecar`: no problems,
  0 unlabelled targets; the working copy exports and reassembles to the ROM byte for byte.
- **Level:** stays 1; `$0C0A-$2C9A` is still to be reviewed for comments.

### 2026-10-20 — `sp48.rom.dis`, level-2 comments: screen output, printer, editor and main loop (working copy)

- **Added:** 610 end-of-line comments, house style, on the Z80 instructions from `$0C0A` to `$138E`:
  PRINT_MESSAGE and PRINT_TOKEN, FIND_ENTRY, OUT_SCROLL and the "scroll?" prompt, the lower screen
  growing, the temporary colours, CLS, RESET_CHAN_K, CLEAR_SCREEN, SET_PRINT_POS, the scrolling and
  line-clearing routines, COPY, the printer buffer and PRINTER_ROW, the editor and its keys, KEY_INPUT,
  EDIT_LINE_SHOW, INPUT_RANGE, STRIP_NUMBERS, NEW and start-up, and the main loop with PRINT_REPORT.
  Existing comments were kept (one draft that repeated `$1148`'s was dropped). `$138F-$1554` is the
  report and start-up message text, already marked. The comment total is now 2452.
- **Corrected while reviewing:** nothing; the synopses and comments checked in this range held.
- **Method:** the bytes through `tools/sp48-dis.cjs`, no new probes. `checkRomSidecar`: no problems,
  0 unlabelled targets; the working copy exports and reassembles to the ROM byte for byte.
- **Level:** stays 1; `$1555-$2C9A` is still to be reviewed for comments.

### 2026-10-20 — `sp48.rom.dis`, level-2 comments: line storage, channels, listing and the statement loop (working copy)

- **Added:** 541 end-of-line comments, house style, on the Z80 instructions from `$1555` to `$1BFE`:
  REPORT_G and STORE_LINE, WAIT_KEY, CHAN_INPUT, PRINT_A_CHAN, STREAM_SELECT and the channel flags,
  MAKE_ROOM and MOVE_POINTERS, LINE_NO, WORK_ROOM_END, the workspace and calculator-stack resets,
  TABLE_LOOKUP, CLOSE #, OPEN #, AUTO_LIST, LIST/LLIST and LIST_ALL, PRINT_LINE, PRINT_TEXT,
  PRINT_FLASH and PRINT_CURSOR, the digit printers, PRINT_LIST_CHR, FIND_LINE, FIND_STATEMENT,
  NEXT_ITEM, RECLAIM, EDIT_LINE_NO, and the statement loop (CHECK_LINE, STMT_START, SYNTAX_ITEM,
  STMT_RET, RUN_EDIT_LINE, LINE_NEW, LINE_END, NEXT_LINE, STATEMENT_END). Existing comments were kept.
  Two short runs nothing in this ROM reaches are marked as such: `$16D4` (RECLAIM_DE_HL from E_LINE)
  and `$1988` (past a line's number and length into FIND_STATEMENT). The comment total is now 2993.
- **Corrected while reviewing:** nothing; the synopses and comments checked in this range held.
- **Method:** the bytes through `tools/sp48-dis.cjs`, no new probes. `checkRomSidecar`: no problems,
  0 unlabelled targets; the working copy exports and reassembles to the ROM byte for byte.
- **Level:** stays 1; `$1C00-$2C9A` is still to be reviewed for comments.

### 2026-10-20 — `sp48.rom.dis`, level-2 comments: commands, evaluator and variables; level 2 (working copy)

- **Added:** 1884 end-of-line comments, house style, on the Z80 instructions from `$1C00` to `$2C9A`:
  the statement classes, GO TO, GO SUB, RETURN, RUN, CLEAR, CONTINUE, POKE, PAUSE, RANDOMIZE, FOR,
  NEXT, READ, DATA, DEF FN, PRINT and INPUT with their items, the colour items, BORDER, PLOT, DRAW and
  CIRCLE, SCAN_EXPR with its operands and operators, FN_CALL, LOOK_VARS, VAR_SUBSCRIPTS, STR_SLICE,
  SUBSCRIPT, LET_ASSIGN, STK_FETCH and DIM. They were drafted in five parts by helper agents working
  from the same bytes (`tools/sp48-dis.cjs` listing and this sidecar only), each line checked to be an
  instruction start, then reviewed and merged here. A sweep of the rest of the ROM added 9 more (the
  maths routines' Z80 lines and addition's negation). Existing comments were kept. The comment total
  is now 4886; every code area has been reviewed.
- **Corrected while reviewing:** FOR variables are 19 bytes, not 18 (FOR_CMD); DIM_FILL sets the
  room's last byte and copies it down, not from the first; INKEY$ decodes the key in L mode (MODE 0,
  D = $FF), so a letter gives a letter, not a keyword (OP_INKEY); LV_PARAM_FOUND copies a string
  parameter's 5 bytes onto the calculator stack, while a number's stay at HL + 1 after its $0E (it said
  the reverse); LOOK_VARS's and LV_EXIT's Z flag means a string or an array when a variable is found,
  and a following '(' only when checking or not found.
- **Method:** the bytes through `tools/sp48-dis.cjs`, no new probes. `checkRomSidecar`: no problems,
  0 unlabelled targets, every label with a synopsis; it measures level 2.
- **Level:** 2 recorded. The working copy exports and reassembles to the ROM byte for byte.

### 2026-10-20 — `sp48.rom.dis`, the character set in the ZX81 sidecar's style

- **Changed:** the character set `$3D00-$3FFF` takes `zx81.rom.dis`'s form: the label `CHARACTER_SET`,
  the region shown one byte per row in binary, a synopsis naming its three readers (OUT_CHAR and
  SCREENS_VALUE through CHARS, and the start-up copy of A-U into the UDGs at `$1203`), and a
  `$NN - Character: ...` synopsis at each of the 96 pictures.
- **Method:** every picture drawn from the ROM's bytes and named from its pixels: ASCII order
  throughout except `$5E` (an up arrow), `$60` (a pound sign, `ukp` as in the ZX81 sidecar) and `$7F`
  (a copyright sign); `$27` is named `apostrophe` to keep the quoting readable.
- **Level:** 2. `checkRomSidecar`: no problems; the file exports and reassembles byte for byte.

### 2026-10-20 — `sp128-1.rom.dis`, the 128K's ROM 1 (shipped)

- **Added:** `sp128-1.rom.dis`, which `inherits` `sp48.rom.dis` and authors only where ROM 1's bytes
  differ: 99 labels, 253 line entries, 10 regions. Byte binding carries 1,036 of the 48K file's
  1,043 labels; the merged page measures level 2 and reassembles byte for byte (1,135 labels).
- **Method:** the two ROMs compared byte by byte: 1,177 bytes differ, in six patches of 2-4 bytes
  (`$004A`, `$0B52`, `$1349`, `$1B7D`, `$1BF4`, `$2646`) and the 48K's filler `$386E-$3CFF`, which
  holds new code. Each patch was read against the 48K code it replaced; the new code through
  `tools/sp48-dis.cjs` with the merged regions.
- **What the new code is (from the code):** a device on the AY chip's register 14 I/O port, read
  one bit at a time (bit 0 out, bit 5 in), whose codes map through a table of digits, `.`, ENTER,
  arithmetic signs, keyword codes and edit codes: the `KP_` routines (named for the keypad that
  table describes), hooked into the frame interrupt and INKEY$ when FLAGS bit 4 is set; hooks that
  send report printing and the statement loop to addresses `$010F`, `$0112`, `$0115` through the
  RAM routine at `$5B00`; keyword codes `$A3`/`$A4` printed as SPECTRUM and PLAY (a `defc` table);
  a test picture reached through a vector table at `$3C01`; filler.
- **Names:** Klive's own; the patched routines keep their 48K names, and the 48K entries of their
  unchanged lines are copied as `derived`.
- **Probe** (`test/harness/sp128`, deleted): at the start-up menu FLAGS was `%00011101` (bit 4 set)
  and `$5B00` held code that flips bit 4 of the byte at `$5B5C`, writes it to port `$7FFD` with
  interrupts off and returns.
- **Tooling, in the same change:** the parser kept no `inherits`, so inheritance had never applied
  in the IDE; it does now, and the readiness check, the level measure, Export as source and the
  `tools/` scripts read an inheriting sidecar merged with its inherited, byte-bound entries.
- **Level:** 2.

### 2026-10-20 — `sp128-0.rom.dis`, the 128K editor ROM: start-up and the main menu (shipped)

- **Added:** a new sidecar, written from scratch: 66 labels, 172 line entries, 18 data regions.
  Covered: the restarts and the way into ROM 1 (`CALL_ROM1`, RST $28), the routines copied to $5B00
  (`SWAP_ROM` to `CALL_ROM0_BACK`), the vector table at $0100, the RAM test and start-up
  (`START`-`START_SETUP`), the bank and stack switches (`SELECT_BANK`, `BANK7_STACK`,
  `BANK0_STACK`), the main menu (`MAIN_MENU`, `MAIN_KEY_LOOP`, `KEY_DISPATCH`, `DRAW_MENU`,
  `TABLE_DISPATCH`), and the data they read: the copyright message, CHANS and STRMS as copied at
  start-up, the bank table, the key tables, both menus' actions and texts, the menu's header,
  stripes and colours, and the bytes at the ROM's end.
- **Decoding:** ROM 0's RST $28 reads the word after it as a ROM 1 address (its routine at $0028),
  so a new custom disassembler for `sp128-editor` pages lists that word as `.defw` (178 calls).
- **Method:** the bytes through `tools/sp48-dis.cjs` (`ROM=sp128-0.rom`); the ROM 1 addresses
  named from `sp48.rom.dis`; the probe of the ROM 1 session (the menu text on screen, FLAGS bit 4
  set, the $5B00 code) confirmed the start-up's result.
- **Names:** Klive's own; the restarts that forward to ROM 1's take the 48K file's names
  (`PRINT_A`, `GET_CHAR`, `NEXT_SKIP`, `INT_FRAME`), `START` likewise, and `WAIT_KEY` the ZX81
  file's. The 128K's new system variables are named by address, not given names.
- **Level:** 0 (921 targets left to label). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, from start-up to the statement loop (shipped)

- **Added:** 26 labels, 103 line entries, 2 regions, continuing in address order from `$026B`: a
  line entered in the 128 BASIC editor (`LINE_ENTER`), the handler that stores or runs it
  (`ENTER_HANDLER`, `STORE_LINE` with `REPORT_G_ROOM`), the run set-up and the hand-over to the
  statement loop (`RUN_SETUP`, `EXEC_LINE` at `$1838`), the report after a run (`AFTER_RUN`,
  `REPORT_PRINT`, `REPORT_LINE`, CONTINUE's place), the 128K's report table and messages
  (`REPORT_128_TABLE`, `REPORT_128_MSGS`), and the editor's entry (`EDITOR_MAIN`).
- **Method:** the bytes through `tools/sp48-dis.cjs`; the ROM 1 routines named from `sp48.rom.dis`.
  Read from the table itself: reports g and h share "File does not exist", and p's entry points at
  the copyright message.
- **Probe** (`test/harness/sp128`, deleted; the menu's second item chosen with CS+6 and ENTER):
  `print x` gave `2 Variable not found, 0:1`; `play "x"` gave `k Invalid note name, 0:1`; `10 print
  1` was stored and listed as `10 PRINT 1`. After a report the first key only clears it, and the
  editor needs keys held 4 frames 12 apart to take them all.
- **Level:** 0 (879 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, the statement loop (working copy and shipped file, uncommitted)

- **Added:** 43 labels, 117 line entries, 3 regions: the 128K's own copy of the statement
  interpreter, with the 48K file's names where a routine does the same job (`CHECK_LINE`,
  `STMT_LOOP`, `STMT_START`, `SYNTAX_ITEM`, `STMT_RET`, `LINE_NEW`, `LINE_END`, `NEXT_LINE`,
  `STATEMENT_END`, `STMT_NEXT`, `CLASS_0`-`CLASS_B`, `REM_CMD`, `IF_CMD`; `EXEC_LINE` renamed
  `RUN_EDIT_LINE`), the classes the 48K ROM has not (`CLASS_C`-`CLASS_E`, which run a routine in this
  ROM), the syntax tables (`SYNTAX_OFFSETS`, `SYNTAX_ENTRIES`, `CLASS_TABLE`), and the error routine
  `ERROR_128` with `BREAK_KEY`.
- **Decoding:** `ERROR_128` takes the byte after `CALL $05AC` as the report code (32 calls); the
  editor ROM's custom disassembler now lists it as `.defb`.
- **Method:** the bytes through `tools/sp48-dis.cjs`; the syntax entries parsed by the item rules
  the class routines show (classes 0, 3, 5, $0C, $0D, $0E are followed by a routine's address;
  2, 7 and $0B end an entry); the command routines read from them.
- **Probe** (`test/harness/sp128`, deleted): `if 0 then print 1` printed nothing; `if 1 then print
  2` printed 2 and reported 0:2; `ink 2` made ATTR_P 58 (from 56); `print 1: rem x: print 3`
  printed 1 and reported 0:2; `print 1:: print 4` printed 1 and 4 and reported 0:3; `go to 5` with
  no program reported 0 OK, 0:1.
- **Level:** 0 (853 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, command routines $1981-$1C2D (working copy and shipped file, uncommitted)

- **Added:** 44 labels, 116 line entries, 1 region: FOR, READ, DATA, RUN, CLEAR, GO SUB, RETURN,
  DEF FN, MOVE, SPECTRUM, LLIST/LIST, CAT and ERASE, with the 48K file's names where a routine does
  the same job (`FOR_CMD`, `READ_CMD`, `CLEAR_RUN`, `GO_SUB_CMD`, `RETURN_CMD`, `DEF_FN_CMD`,
  `LIST_CMD` ...); the two canned commands the menus run (`RUN_LOAD_LINE` with `LOAD_LINE`, the
  tokens of LOAD "" that the `RST $28` decoder would otherwise read as a call; `RUN_LIST_LINE`); the
  menu's 48 BASIC (`GO_48_BASIC`).
- **Read from the code:** MOVE's routine is a lone RET; CAT and ERASE accept only `!` (the RAM
  disk); SPECTRUM leaves through ROM 1's RST $08 with the $FF at ROM 1's $0013 as the code, into the
  48K REPORT with the paging locked.
- **Probe** (`test/harness/sp128`, deleted): `for i=1 to 3: print i;: next i` printed 123; `read a:
  print a: data 7` as a direct command gave E Out of DATA; `clear 30000` made RAMTOP 30000;
  `return` gave 7 RETURN without GOSUB; `move "a","b"` and `cat !` gave 0 OK; `cat` was refused by
  the syntax check; `def fn f(x)=x*2: print fn f(4)` as a direct command gave P FN without DEF;
  `spectrum` gave 0 OK with FLAGS bit 4 clear and the paging byte $30.
- **Not yet:** the RAM-disk helpers at $1BAD and $1C2E between these routines.
- **Level:** 0 (825 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, the RAM disk (working copy and shipped file, uncommitted)

- **Added:** 58 labels, 88 line entries, 1 region: the RAM disk's catalogue and files
  (`RAMDISK_NEW`, `RAMDISK_FIND`, `RAMDISK_OPEN`, `RAMDISK_CLOSE`, `RAMDISK_WRITE`, `RAMDISK_READ`,
  `RAMDISK_ERASE`, `RAMDISK_CAT` with `CAT_PRINT_NAME` and its name bounds, `RAMDISK_FREE_ADD`),
  the entries SAVE !/LOAD ! use (`RAMDISK_SAVE`, `RAMDISK_LOAD_HDR`, `RAMDISK_LOAD`), and the two
  bank 7 copiers behind vectors $0106 and $0109 (`BANK7_PUT`, `BANK7_GET`).
- **Read from the code:** the catalogue grows down from $EBEC in bank 7 in 20-byte entries (name,
  start, length, current place, flags); places are an address in $C000-$FFFF with a bank number
  (SELECT_BANK 0-4); $5B85-$5B87 count the free bytes (76780 at start-up: four banks and bank 7
  below the catalogue); a source or destination in the $C000 window goes through 32 bytes at $5B98;
  ERASE moves every later file down byte by byte across banks and closes the catalogue's gap; CAT
  lists in name order by repeated passes.
- **Probe** (`test/harness/sp128`, deleted): free bytes 76780 at start; `save !"bb"code 0,100` took
  129, `save !"aa"code 0,50` took 79; `cat !` listed aa then bb; saving aa again gave e File
  already exists; `erase !"aa"` gave the 79 back and $5B83 rose 20; `load !"zz"code` gave h File
  does not exist; `load !"bb"code 32768` gave 0 OK.
- **Level:** 0 (768 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, SAVE/LOAD/VERIFY/MERGE (working copy and shipped file, uncommitted)

- **Added:** 54 labels, 75 line entries: the four commands' entries and the `!` test (`SAVE_128`
  ... `TAPE_BANG`), ROM 0's own copy of the tape command parser with the 48K file's names where it
  does the same job (`TAPE_COMMAND`, `SE_HEADER_ROOM` ... `SE_SAVE_OR_LOAD`), and the RAM disk side
  (`RD_COMMAND`, `RD_CODE`, `RD_MERGE`, `RD_LOAD_PROG`, `RD_LOAD_PROGRAM`, `RD_READ`,
  `RAMDISK_NAME`, `STRING_NAME`).
- **Read from the code:** tape transfers go on in ROM 1 (SAVE_CONTROL, and the load branch of its
  SE_SAVE_OR_LOAD at $0761); MERGE ! reuses ROM 1's MERGE_LOAD from $08CE; VERIFY ! takes LOAD's
  CODE path, so it reads the data in place without comparing.
- **Probe** (`test/harness/sp128`, deleted): `save !"c"code 0,10` then `load !"c"code 32768` put
  $F3 $01 $2B at 32768 (ROM 0's first bytes: saving from 0 in 128 BASIC saves the paged ROM 0);
  `merge !"c"` and `load !"c"` of that CODE file gave b Wrong file type; `load !"c"code 32768,5`
  gave c CODE error; `verify !"c"code 32768` put the file's bytes at 32768; `save "t"` printed
  Start tape, then press any key. (With a program line stored, the 128K editor's cursor stays on
  the listing and further typing goes into that line: probe commands before storing a line.)
- **Not yet:** the serial byte sender at $11A3 (vector $011E), which sits just before these.
- **Level:** 0 (715 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, PRINT to DIM and the line tests (working copy and shipped file, uncommitted)

- **Added:** 35 labels, 50 line entries, 1 region ($2174-$2316): LPRINT, PRINT, INPUT, COPY, NEW,
  CIRCLE, DRAW and DIM (front ends to ROM 1's routines; NEW restarts from START_SETUP's $019D,
  COPY goes to $08F0); the Calculator's line handler `CALC_LINE`, which evaluates a line that starts
  like an expression and feeds the result back into the editor as keys (`KEY_INTO_EDITOR`); the
  tests `LINE_ENTER` uses (`KEYWORD_TEST`, `LETTER_TEST`, `NUMBER_TEST`, `DIGIT_TEST`,
  `OPERATOR_TEST` with its `OPERATORS` list, `LET_TEST`). `LINE_ENTER`'s synopsis now names them.
- **Probe** (`test/harness/sp128`, deleted; the menu's third item is the Calculator): `1+2` in 128
  BASIC and in the Calculator became `3` in the edit line with 0 OK, 0:0; `sin 0` in the Calculator
  became 0; `x` in 128 BASIC gave 2 Variable not found, 0:1. $EC0E was 0 in 128 BASIC and 4 in
  the Calculator.
- **Level:** 0 (689 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, PLAY and MIDI (working copy and shipped file, uncommitted)

- **Added:** 134 labels, 183 line entries, 8 regions: PLAY's front end ($2317) and its engine
  ($0985-$11EA): the blocks it builds (one per string, one shared), the command interpreter and
  every command (`PLAY_COMMANDS`, `PLAY_LETTERS`, `PLAY_OCTAVE` ... `PLAY_STOP`), notes and lengths
  (`PLAY_NOTE`, `PLAY_NOTE_NAME`, `PLAY_LENGTHS`, `PLAY_NOTE_TABLE`, `PLAY_PERIODS`), the timing loop
  (`PLAY_SHORTEST`, `PLAY_START_NOTES`, `PLAY_WAIT`, `PLAY_ADVANCE`), the tempo (`TEMPO_CODE`, run in
  RAM under ROM 1's calculator), the AY (`AY_WRITE`, `AY_READ`, `PLAY_SILENCE`), MIDI
  (`MIDI_NOTE_ON`, `MIDI_NOTE_OFF`, `MIDI_OUT`, the byte sender at $11A3, vector $011E), the errors
  d, k, l, m, n, o; and COPY's printer codes (`COPY_CODES`), which sat in front of PLAY.
- **Read from the code:** the command letters are capitals only (a small o is a note name); only
  triplet lengths count towards "Too many tied notes"; the dispatch table's order matches the
  letters searched from the end (H is index 14, a note 0).
- **Probe** (`test/harness/sp128`, deleted; capitals typed as `{CS+X}` chords): during play "1c"
  AY registers 0-1 held $01A8 (note 60's period from the table); play "O4cC" gave 0 OK;
  `O9c`, `V16c`, `T300c` gave n Out of range; `o9c`, `x` and `o8b#` gave k Invalid note name;
  `(((((c)))))` gave d Too many brackets; `99999c` gave l Number too big; nine strings were refused
  when entered; eleven plain ties played.
- **Level:** 0 (569 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, RS232, FORMAT and COPY (working copy and shipped file, uncommitted)

- **Added:** 72 labels, 100 line entries, 1 region ($05E6-$0978): CALL_ROM0's work in ROM 0
  (`ROM0_CALLED`, which feeds an INPUT line to ROM 1's editor character by character), FORMAT with
  its `BAUD_TABLE`, channel P's input (`RS232_IN`, a bit-banged receiver that keeps a second byte
  arriving at once) and output (`RS232_PRINT`, a small printer driver: width, CR LF, the comma's
  columns, AT and TAB; `RS232_OUT`, the byte sender), and COPY to an RS232 printer (`COPY_128`, 44
  strips of 4 pixel lines as 768-dot graphics).
- **Read from the code:** the RS232 port is the AY's I/O port A (bit 7 data in, bit 6 handshake in,
  bit 3 data out, bit 2 handshake out).
- **Probe** (`test/harness/sp128`, deleted): `format "p";300` made $5B5F 451, `;1000` 110 (1200's),
  `;20000` left 11 (9600's, the start-up value), `;0` gave j Invalid baud rate, `format "x";300`
  gave C Nonsense in BASIC. LPRINT and COPY were not run (they wait for a printer's handshake).
- **Level:** 0 (498 targets left). It reassembles byte for byte.

### 2026-10-20 — `sp128-0.rom.dis`, the editor to the end of the ROM (working copy and shipped file, uncommitted)

- **Added:** 553 labels, each with a synopsis, about 450 comments and 18 regions, drafted in four
  ranges by helper agents from the listing and the sidecar only (D4), and reviewed against the code
  before merging: the editing rows (`ROWS_REBUILD`, `ROWS_DRAW`, `ROW_PUSH_CHAR` ... $152F-$16DB);
  unused code at $2336-$2536 (a character-buffer renderer and room helpers that nothing calls, with
  two 8x8 pictures); the keys and menus ($2584-$2A19: `KEY_ENTER`, `KEY_WORD_LEFT`, `SCREEN_TOGGLE`,
  `MENU_OPEN`, `MENU_SELECT`, the menu items `MENU_TAPE_LOAD` to `MENU_RENUMBER`, the Calculator's
  menu and the Tape Loader's text as regions); line entry from the rows, insert and delete across a
  line's rows ($2A1A-$311D, `LINE_INSERT_CHAR`, `LINE_DELETE_CHAR`); the row stores above and below
  the screen, line expansion with the keyword finder run in RAM at $FCAE (`EXPAND_CODES`,
  `OWN_WORDS`) ($311E-$3847); renumber, the window and cursor routines and the tables to the end
  ($3848-$3FCD, `RENUM_TOKENS`); and five strays (`START_CHARS`, `ERROR_128_OWN`, `DEF_FN_CHECK`,
  `TABLE_LOOP`, `TABLE_CARRY`).
- **Corrected:** `MENU_BAR` flips the item's 14 attribute cells between $78 and $68 rather than
  moving the bar; $1B14 puts LLIST's token ($E1, from ROM 1's keyword table) into the line, so it is
  `RUN_LLIST_LINE` (the Print item); the menu text after `MENU_ACTIONS` is named by address ($2754).
  Names three drafts shared were split: `CURSOR_ON/OFF` (the editor's), `CELL_CURSOR_ON/OFF` ($3640),
  `WIN_CURSOR_ON/OFF` ($3A9D); `NEXT_EDIT_CHAR` ($32EA).
- **Read from the code, not probed:** `ROWS_DRAW`'s $161B-$162F is never reached (both callers
  enter with Z); `ABOVE_POP` with an empty stack expands from $F9E1, 3 bytes above the stack's base;
  `BELOW_CARRY` at row 21 addresses a 22nd slot past the buffer.
- **Probe** (`test/harness/sp128`, deleted): EDIT in 128 BASIC opens Options (128 BASIC, Renumber,
  Screen, Print, Exit); Renumber made lines 1 and 2 into 10 and 20; after `1 PRINT 1` and ENTER the
  line's row at $EC16 (bank 7) has flags $19 and the empty rows $09, so bit 4 marks a row from the
  program; the fifth start-up item shows "Tape Tester".
- **Level:** measures 2 (1,085 labels, every one with a synopsis, no unlabelled targets, no
  problems); recorded level still 0, with 959 comments for some 7,700 lines. It reassembles byte for
  byte.

### 2026-10-20 — `sp128-0.rom.dis`, the comment pass; level 2 recorded

- **Added:** 3,294 end-of-line comments (4,253 in all, about one per 1.9 instructions), drafted in
  six ranges by helper agents from the listing and the sidecar only (D4), sampled against the code
  and checked for names that do not exist; every name a comment uses is a label in ROM 0 or ROM 1.
- **Corrected** (each reported by a helper and checked against the instructions): `ROWS_DRAW` draws
  rows B to C; `BELOW_ROW_ADDR`/`ABOVE_ROW_ADDR` leave HL = $0023; `DRAW_MENU`'s items are 14
  cells; `PLAY_PERIODS`' first word ($0FBF) is note 21's; $17C1 calls ROM 1's CLEAR_WS, not
  CALC_RESET; `PLAY_VOLUME` does not check the string's number; `RAM_FAULT`'s border is the bank
  counter (bank + 1); `COPY_STRIP` sends x = 0 up; `RS232_OTHER` passes every control $10-$1F but
  AT/TAB to `RS232_COLOUR`; `CLICK` uses RASP; `SWAP_INK_PAPER`'s C lacks the new ink;
  `DELETE_SHIFT`'s bit is set on the cursor's row; `SCREEN_REFILL` does not store the line it
  looks up; `ROW_UP`/`ROW_DOWN_TEXT` compare row numbers; the main window is lines 0-20 and the
  lower one 22-23 (IX + 2 is the last line from the top); `RAMDISK_ERASE`'s source and destination
  comments were swapped; `RAMDISK_READ` reads to HL; $1826's report L is never reached (BREAK_KEY
  raises it); the tape tester takes 2047 samples a reading; `RENUM_REF_LINE`'s other case.
- **Read from the code, not probed:** $2DA5 compares C with the byte at ($F9DB)'s word, not the
  count (commented as a probable slip).
- **Probe** (`test/harness/sp128`, deleted): RENUMBER with one line and step 10 renumbered it from
  start 9989 and refused start 9990, so its test is start + step x count, one step past the last
  new number.
- **Level:** 2, recorded (1,085 labels, every one with a synopsis, no unlabelled targets, no
  problems). It reassembles byte for byte.

### 2026-10-20 — the +2A/+3 ROM 3s: `spp3-41-3`, `spp3-40-3`, `spp3-41es-3` (shipped, level 2)

- **Method:** each ROM compared byte by byte with `sp48.rom` and `sp128-1.rom`; inheritance is one
  level deep, so each sidecar lists its whole chain, nearest first (`spp3-41-3`: `sp128-1`, `sp48`;
  the other two: `spp3-41-3`, `sp128-1`, `sp48`). What did not bind (a label whose span holds a
  changed byte, a region holding one) was given back: the unchanged lines' entries copied
  (provenance `derived`), the changed ones described from the bytes.
- **v4.1 (`spp3-41-3`), 44 own labels:** the NMI's test is the 48K ROM's reversed (it jumps to
  NMIADD when that is not zero); the frame interrupt calls `INT_KBD_MOTOR`, which after the keyboard
  counts the disk motor's time-out down at $E600 in bank 7 every even frame and clears bit 3 of
  port $1FFD (and its copy $5B67) at 0 (`MOTOR_TIMEOUT`); `ROM_SWAP_HL` at $3A00/$3A05 clears bit 2
  of port $1FFD and continues at $3D00 in ROM 1, `ROM_SWAP_BACK` returns (nothing in ROM 3 calls
  them); the hooks into the editor ROM are ROM 1's moved down $112 with their jumps NOPped out, so
  REPORT_CHAR, STMT_JUMP and STMT_NEXT always take the 48K path; INKEY$ has DI, EI and a jump where
  ROM 1 reads its keypad; SPECTRUM/PLAY printing kept; the messages ("Press REC & PLAY, then any
  key.", " 1982 Amstrad"); the rest of $386E-$3CFF is filler, with an unprinted text at $3C01 that
  `JUMP_3C01` would jump into.
- **v4.0 (`spp3-40-3`, also the +3E's ROM 3: same CRC), 10 own labels:** $0013 is $A7, and the three
  hooks keep their `JR NZ` to `HOOK_TO_010F`/`0112`/`0115`, so in +3 BASIC reports and statement
  ends go to the editor ROM as on the 128K.
- **Spanish v4.1 (`spp3-41es-3`), 53 own labels:** the tape, scroll ("]MAS?", shown as an inverted
  question mark) and report messages in Spanish; the longer reports move COMMA_MESSAGES to $1544
  and START_MESSAGES to $1546 (start-up's pointer at $1296 follows), while HOOK_REPORT still loads
  $1536, which PRINT_MESSAGE's skip makes harmless; five character pictures differ (named from their
  pixels: inverted exclamation mark, N with tilde, inverted question mark, Pt, n with tilde); the 48K
  synopses that quote a report's text quote the Spanish one, their probe results marked as the
  48K ROM's.
- **Probe** (`test/harness/sp128`, models `plus3-fdd1` and `plus3-es-fdd1`, deleted): the menus say
  "+3 BASIC" (the synopses say so for FLAGS bit 4); 48 BASIC started with " 1982 Amstrad" on both;
  SAVE "x" printed "Press REC & PLAY, then any key."; in +3 BASIC $E600 set to 6 reached 0 within
  20 frames and bit 3 of $5B67 was cleared (ROM 0 may count too); Spanish PRINT 1/0 gave
  "6 NUMERO MUY GRANDE, 0:1".
- **Level:** 2 for all three, recorded; each reassembles byte for byte.

### 2026-10-20 — +3DOS: `spp3-41-2`, `spp3-40-2`, `spp3-41es-2` (shipped, level 2)

- **Sources:** the bytes only. No +3 manual was available, so the jump table's routines are named
  from their code; the uPD765's datasheet (`_input/765.pdf`) was allowed for command codes and status
  bits (interface facts). The commented +3 and 128K disassemblies in `_input/` were not opened.
- **v4.1 (`spp3-41-2`), 747 labels, 3,658 comments, 74 regions:** a skeleton by hand (the frame
  interrupt with the same motor time-out as ROM 3, the "PLUS3DOS" text, the 53-entry jump table
  `DOS_JUMPS` with `DOS_xxxx` entry labels, `CALL_ROM0` at $3E00 with a words region for its inline
  address, `CALL_ROM2` at $3F00, which ROM 1 enters in its own copy, filler); then five ranges
  drafted by helpers from the listing, reviewed (samples against the code; one name clash,
  WRITE_BYTES, split) and merged. Found: file records of $38 bytes from $DBA0, a sector cache of 16
  entries at $DFE0, drive tables, the 765 driver on ports $2FFD/$3FFD with its error numbers, a copy
  of the 48K ROM's keyboard decoder at $229E (+$2099, the 48K names kept), and a disk test program at
  $2492 that ROM 0 copies to $6000 (labels `DT_`, RAM = ROM + $3B6E). Read from the code, not
  probed: LENGTH_FROM_DIR never clears $DF90; ENTRY_STAMP_ADDR may run past one entry's copy.
- **v4.0 (`spp3-40-2`), inherits v4.1:** differs only at $244E-$2CDF and $3FFF: hooks without the
  CURCHL/FLAGS saving, and the test program at $245C (RAM = ROM + $3BA4) with a block that still runs
  the spin test and other timing constants; the rest is v4.1's code moved, its entries converted.
- **Spanish v4.1 (`spp3-41es-2`), inherits v4.1:** the same English messages, $21 lower; a shorter
  disk-error question (message at $DB22, no key list, the routine's code taken as the answer); the
  code after the messages $2E lower and the calls to it changed; $0103 returns DE = $0101, HL =
  $0070; the first hook passes HL = BC, moving the test program up 2. Entries copied with the shifts
  and their text's addresses remapped.
- **Probe** (`test/harness/sp128`, `plus3-fdd1` / `plus3-es-fdd1`, `test/testfiles/ltk.dsk` and
  `blank180K.dsk`, deleted): CAT listed "DISK . 1K", "124K free"; a blank disk "No files found",
  "173K free"; SAVE "prog": CAT gave "PROG . 1K", "172K free"; no disk asked "Drive A: track 0,
  sector 0, no data - Retry, Ignore or Cancel?" (C: "No data, 0:1"); LOAD "nope" gave "File not
  found"; SAVE "a?b" "Bad filename"; on the Spanish +3 the question came in Spanish from the routine
  at $DB20 ("SIN DATOS, 0:1").
- **Level:** 2 for all three, recorded; each reassembles byte for byte.

### 2026-10-20 — the +2E/+3E: ROM 3 covered, `spp3e-2` (shipped, level 2)

- **ROM 3:** `spp3e-3.rom` is byte-identical to `spp3-40-3.rom` (CRC 04448eaa), so the shipped
  `spp3-40-3.rom.dis` already applies through the index.
- **ROM 2 (`spp3e-2`), 1,102 labels, 6,091 comments:** v4.0's merged entries (its own and v4.1's)
  were mapped by aligning the two listings instruction by instruction with address operands
  ignored (51 blocks, 4,735 instructions; RAM operands matched in 202 of 204 cases, so the RAM
  layout is the same), data regions by their exact bytes, ROM addresses in the text remapped
  (provenance `derived`). The first mapping put the +3's table at $0100 onto this ROM's second
  table at $00A0 and remapped port $1FFD as an address; the helper of $0000-$23FF corrected those
  (165 fixes, labels moved as one batch). Three helpers authored the rest from the bytes (D4; no
  file of `_input/` but the 765 datasheet; interface commands described by value): the 56-entry
  `DOS_JUMPS` and a second 32-entry table at $00A0, a hard disk driver on ports $xxEF (256-byte
  sectors), partitions and their table, drive letters mapped to partitions or floppy/RAM devices,
  a snapshot loader, BASIC streams, coloured messages (`SHOW_MESSAGE` through ROM 0's $3FF7). Read
  from the code, not probed: RP_READ passes an undoubled sector (probably a bug).
- **Probe** (`test/harness/sp128`, model `fdd1`, entered through the code-injection flow): the
  start-up shows "2000-2015 Garry Lancaster v1.43"; CAT listed ltk.dsk ("DISK . 1K", "124K free");
  with no disk "Drive A: track 0 sector 0", "No data", "Retry, Ignore or Cancel?", C: "No data, 0:1".
  The hard disk code was not probed (the harness has no hard disk).
- **Level:** 2, recorded; it reassembles byte for byte.

### 2026-10-20 — the +3 editor ROM: `spp3-41-0`, `spp3-40-0`, `spp3-41es-0`, `spp3e-0` (shipped, level 2)

- **Decoding:** these pages (`plus3-editor`) now decode `RST $28` + word as a call into ROM 3
  (`ZxSpectrum128EditorCustomDisassembler` with `decodeErrorCalls: false, otherRom: "ROM 3"`: their
  $05AC is a stack switch, so nothing after its calls is data), in the tools and in the +3/+3E live
  view (`spectrumP3CustomDisassembler`). `CALL $3E80` + word (into ROM 1) is marked with words regions.
- **v4.1 (`spp3-41-0`), 833 labels, 3,628 comments:** a skeleton (filler), then five ranges drafted by
  helpers from the bytes (D4; `_input/` holds commented disassemblies of these ROMs and was not
  opened). Much of the ROM is the 128K editor ROM's code moved, so those routines carry the 128K
  names (renamed where the 128K name says something wrong here: TITLE_P3_BASIC, MENU_LOADER ...);
  the rest is new: restarts and RAM paging copies, start-up, the factory test program with its
  texts, ROM switching at $3E00/$3E80/$3F00. Corrections found on review: $0FC2 is a row template,
  not filler; WAIT_40_FRAMES is not where the start-up ends (that JP is into ROM 1); CHANS_128_INIT's
  third channel is X and P is $3A05/$3A00.
- **v4.0, Spanish, +3E:** mapped from v4.1 by instruction alignment (address operands masked, two
  passes, the second listing the target with the first pass's regions; small gaps filled by
  carrying the nearest shift; data regions placed by bytes or by position; moved RAM variables
  remapped where consistent; the ROM 1 words after `CALL $3E80` translated). v4.0 needed only
  ROM 1 addresses fixed by hand (its ROM 1 sites found by their bytes). The Spanish ROM 0 (857
  labels) has Spanish menus and loader text and its own Spanish disk-error prompt at $21A3; the
  +3E's (846 labels) replaces the test program with the window channel W (a drawing engine with a
  dual 3/5-pixel font), channels M, V, X and F and a disk-message routine; both completed by
  helpers. The mapper's slips, all fixed: constants and other ROMs' addresses in the text taken for
  ROM 0 addresses (now left alone when a unit word or "in ROM n" follows, or in a "ROM n's" list).
- **Level rule:** a jump target inside an instruction (v4.0's start-up JP into ROM 1 at $253A) is
  reported apart (`midInstructionTargets`) and no longer holds a page below level 1.
- **Probe** (`plus3-fdd1`): the start-up menu "128 +3" (Loader, +3 BASIC, Calculator, 48 BASIC;
  "Drives A: and M: available."); EDIT opens Options (+3 BASIC, Renumber, Screen, Print, Exit);
  Renumber made lines 1, 2 into 10, 20 ($5B75/$5B77 = 10).
- **Level:** 2 for all four, recorded; each reassembles byte for byte.

### 2026-10-20 — the +3 syntax ROM: `spp3-41-1`, `spp3-40-1`, `spp3-41es-1`, `spp3e-1` (shipped, level 2); R4 done

- **Decoding:** `plus3-syntax` pages decode `RST $28` (ROM 3), `CALL $3F00` (ROM 2, a DOS_JUMPS entry)
  and `CALL $3E80` (ROM 0) with their inline words (`plus3SyntaxDecoder`, in the tools and the
  +3/+3E live view). The error routine (v4.1 $2C4C; $0008 jumps to it) and FILE_ERROR ($0EB6) are
  followed by an error code byte; they sit at a different address in each version, so every such
  byte is a one-byte region in the sidecars (an `errfix` pass added any a draft missed).
- **v4.1 (`spp3-41-1`), 812 labels, 3,681 comments:** five ranges drafted by helpers from the bytes
  (D4; `_input/` not opened): the 128K editor ROM's syntax machinery, commands and PLAY moved here
  under its names; tape and disk SAVE/LOAD/VERIFY/MERGE; FORMAT (the disk, LPRINT and LINE forms:
  FORMAT LINE joins the 128K's FORMAT "p" code at FORMAT_LINE_BAUD, while FORMAT "p" itself has no
  caller); ERASE, MOVE, CAT, COPY (screen, EXP, files, SPECTRUM FORMAT); the report table and
  messages; COPY RANDOMIZE's greeting; the ROM switching. Two text slips found later and fixed:
  INSERT_TAPE_MSG is INK 0, PAPER 7; ROM 3's tape message is "Press REC & PLAY, then any key.".
- **v4.0, Spanish, +3E:** mapped from v4.1 (the mapper's inline-word context set to ROM 0) and
  completed by helpers: v4.0 has one RS232 wiring, a 52-entry report table and fewer FORMAT
  options; the Spanish texts and report table are Spanish; the +3E adds streams (OPEN #, GO TO #
  ...), partitions (NEW DATA, MOVE ... FOR/IN/OUT, FORMAT TO), CAT TAB/ASN, SPECTRUM snapshots and
  drive letters, and drops FORMAT "p", COPY RANDOMIZE and the second RS232 wiring. The PLAY period
  for notes below 21 is the constant $0FBF ($0FBE on the +3E), which the mapper had remapped.
- **Probe** (`plus3-fdd1`): FORMAT LINE 2400 gave 0 OK and $5B5F 11 -> 54; ERASE "nope" on a blank
  disk gave "File not found, 0:1".
- **Level:** 2 for all four, recorded; each reassembles byte for byte. Every +2A/+3/+3E ROM now ships
  at level 2 (R4 done).

### 2026-10-21 — ZX Spectrum Next: preparation (N0 of `.plans/NEXT_ROM_ANNOTATIONS_PLAN.md`)

- **Machine:** the Next now reports its ROM pages to the annotations (`getRomSources`: R0-R3, X0, X1
  and the DivMMC ROM; the DivMMC RAM is left out), each with its file and page, so a working copy
  `~/Klive/RomAnnotations/<file>.dis` applies to it in the Disassembly view. A site in a 16K ROM page
  is offset within the page (the core pages R0 in both slots 0 and 1). `KNOWN_ROM_PAGES` knows the
  Next's pages (with a `page` for files of several pages); page 3 is `sp48-basic` and decodes as the
  48K ROM in the live view.
- **Tools:** `PAGE=<n>` in `sp48-dis.cjs`, `apply-annotations.cjs`, `annotated-view.py` and the
  reassembly template; `check-annotations.cjs` measures every page of the file.
- **Working copies** (skeletons, level 0): `enNextZX.rom.dis` (4 pages), `enAltZX.rom.dis` (2),
  `enNxtmmc.rom.dis`, `enNextMf.rom.dis`; unlabelled targets per page 967 / 984 / 578 / 1045, 459 /
  610, 528, 451.
- **Measured, not yet authored:** page 3 shares ~9.7K with the 48K ROM; page 2 ~3K with the +3E's
  ROM 0; pages 0 and 1 little; `enNextLG.rom` differs from `enNextZX.rom` in page 2 only.

### 2026-10-21 — NextZXOS ROM 3 (`enNextZX.rom` page 3, working copy, level 2 measured)

- **Method:** `sp48.rom.dis` mapped onto page 3 with `map-rom.py` (`PAGE=3 SRC_PAGE=0`, two passes: 749 of
  1,043 labels, 3,445 of 5,263 lines), then three ranges completed by helpers from the bytes (D4; the
  Next developer guide, `nextreg.txt` and the VHDL allowed as interface documents), each draft merged with
  `apply-draft.py` and `:replace=` ranges. Audit of the remapped addresses: no slips.
- **Found:** the listing tools hid the Z80N's opcodes (`MUL D,E`, `NEXTREG`, `PUSH nn` ... listed as NOPs);
  Next pages now decode them (`next-basic` kind for this page). NextZXOS removed the tape code ($0605 and
  $060D page DivMMC RAM in, `$87` to port `$E3`), the 48K start-up and the syntax tables; added an operand
  jump table at $0600, a 256-byte operator table at $1A99, selectors and string modifiers at $11B7, number
  bases (`$`, `@`, BIN; memory 5's byte $5CAD), long names, local variables (list at ($5C0B)), `%` integer
  variables in DivMMC memory, BANK PEEK/DPEEK/USR/PEEK$, SPRITE functions, shifts and bitwise operators
  ($386E-$3CFC); moved the calculator's operation table to $3B02 and its constants to $3C02; `CALL $2705` is
  followed by an inline DivMMC address (words regions); `RST $00` soft-resets through NextReg 2. Token
  names of NextBASIC's new keywords were read from the alternate ROM's keyword table (bytes).
- **Probe** (`test/harness/zxnext`, `prepareBasic()` and `call()`): MUL_HL_DE 300 x 200 = 60000, $1234 x
  $0300 carry, 0 x 5 Z; NEXTREG_READ of register $00 gave 8 (the core's value).
- **Level:** page 3 measures 2 (1,148 labels, 5,416 comments, no unlabelled or mid-instruction targets);
  it reassembles byte for byte. The file records 0 until its other pages are done.

### 2026-10-21 — NextZXOS ROMs 0 and 1 (`enNextZX.rom` pages 0 and 1, working copy, level 2 measured)

- **Decoding first:** each page uses its restarts differently, read from their own routines: the ROM-to-ROM
  stubs at $3E00/$3E80/$3F00 take the word after the CALL and switch ROM with NextReg $8E; `CALL $0068`
  (and page 1's `$0080`) calls the alternate ROM (NextReg $8C = $80); `RST $28` calls ROM 3 through the RAM
  routine at $5B48. Page 0: `RST $18`/`$20` + word into ROM 1/2. Page 1: `RST $00` + word into ROM 2,
  `RST $08` and `CALL $08EF` + error byte, `RST $10` + function byte (+ word when bit 7 is set),
  `CALL $26CB`/`$26E5` + word into DivMMC memory. Page 2: `RST $08` + byte + word. New kinds `next-os0`-`2`
  and `NextZxOsCustomDisassembler` (`nextzxos-disassembler.ts`, test `nextRomDecoder.test.ts`). Two of the
  conventions were found by helpers while drafting and fed back to the others.
- **Method:** five helpers per page drafted from the bytes (D4), with the +3E's, 128K's and 48K's sidecars
  for names where the bytes and the job match; merged with `apply-draft.py`. The NextZXOS and esxDOS API
  document (read as text extracted from the PDF) gave the API names after `RST $00`/`$20` and of the
  IDE_* entry points, and `nextreg.txt` the NextReg meanings: provenance `manual` (81 entries on page 0,
  48 on page 1). No published NextZXOS or esxDOS source was opened.
- **Found:** page 0 is the system ROM: start-up and RAM test, the RAM routines at $5B00, the start-up menu
  (text at $09EA-$0DAC), the channel dispatchers (M, F, D, V), the window channel driver in five screen modes
  with its fonts and line buffer, the line editor (IDE_WINDOW_LINEIN) and the Browser (IDE_BROWSER). Page 1
  is NextBASIC's command ROM: the syntax tables at $021D-$0566 (class words whose top two bits pick this ROM,
  ROM 3, the alternate ROM or the DivMMC memory), reports and the error messages at $2705, the program
  index of labels and PROCs, LAYER, SAVE/LOAD, IF/ELSE, loops, PROC/LOCAL, PRINT/INPUT, the BANK commands,
  OPEN #/CLOSE #, DRIVER. A helper's "never reached" note at $0DCE was wrong ($0135 and $2B9C jump there).
- **Probe:** none this time (the findings are structural; booting NextZXOS to its menu needs a cloned card).
- **Level:** pages 0 and 1 measure 2 (1,068 and 1,038 labels; 3,895 and 4,663 comments; no unlabelled
  targets) and reassemble byte for byte. The file records 0 until page 2 is done.

### 2026-10-21 — NextZXOS ROM 2 (`enNextZX.rom` page 2, working copy; the file at level 2)

- **Decoding first:** page 2's `RST $08` ($3F18) takes a byte and a word, pages the DivMMC out, selects ROM 3
  at $3CFC and runs on into $3D00, where the fetch maps the DivMMC in again (its $3Dxx automap with ROM 3:
  `zxnext.vhd`, NextReg $BB bit 7, interface documents): a call of the DivMMC memory's code, the word its
  address, the byte probably the DivMMC bank at $2000-$3FFF during the call. A helper found `CALL $3E18`
  (and the unused `$3E32`): + word into the alternate ROM. Both in `nextzxos-disassembler.ts`, with tests.
- **Not mapped:** `map-rom.py` carried only 40 of the +3E ROM 0's 846 labels (the shared ~1.5K is
  scattered), so five helpers drafted from the bytes with the byte-identical runs and the other sidecars'
  names, as in N2; the shared routines keep the +3E's names (house rule).
- **Found:** page 2 is the DOS ROM, not an editor ROM as first measured: the IDE_* jump table below $0100
  and the +3DOS-compatible DOS_*/DD_* table from $0100, matched to the API document's call addresses
  (`manual`, 357 entries); most entries call the DivMMC memory's code through `RST $08`. Also the snapshot
  and machine-ROM loaders (SNA/SNX/Z80, ZX80/ZX81 .O/.P with code run at $F000), streams and channels (the
  +3E's code with the Next's D, V and W channels), the swap file, the SD card's SPI driver (the MMC
  specification for the commands), mounting and images (.P3D/.DSK), the start-up loading of enAltZX.rom
  and enSystem.sys, and metadata files. The code ends at $291B; the rest is filler and the stubs.
- **Corrected in page 1:** $001B is reached (page 2's LDIR_ROM_1 pushes it).
- **Probe:** none (structural findings; the SD and boot paths need a booted card).
- **Level:** page 2 measures 2 (761 labels, 3,111 comments); all four pages reassemble byte for byte and the
  file records level 2. Not shipped yet (N6).

### 2026-10-21 — The Next's DivMMC ROM and Multiface ROM (`enNxtmmc.rom`, `enNextMf.rom`, working copies, level 2)

- **Decoding first** (`nextzxos-disassembler.ts`, kinds `next-divmmc` and `next-multiface`, with tests), each
  convention read from its routine; four of them were found by helpers while drafting and fed back:
  - DivMMC: `RST $08` + the API function byte ($0512; it hands the call to $33B4 in DivMMC RAM, so the ROM
    holds no esxDOS function table); `RST $18` + a word read high byte first ($03C6); `RST $28` / `CALL $04E1`
    + a field offset read at (IY)/(IX), `CALL $04F8`/`$0500` + one written there; `RST $30` + a word, the
    vector entries at $0100-$018A whose address picks the bank ($018D; the tables at $2300/$2310/$2320);
    `CALL $040D`/`$0407` + an address in DivMMC bank A / the last bank, `CALL $041F` + bank + address.
  - Multiface: `RST $10`-`$28` + an address in ROM 0-3 (through its RAM image: $1856-$1AAF runs at $5B00);
    `CALL $1569` + an API function byte (run as `RST $08` at $5B5D in ROM 3).
- **Method:** three helpers per ROM from the bytes (D4), merged with `apply-draft.py`; the API document
  (`manual`: the +3DOS/IDEDOS entry names on the DivMMC side, as NextZXOS ROM 2 calls them; M_DRVAPI and the
  disk-stream calls on the Multiface), `nextreg.txt`, the VHDL (automap entry points and the $1FF8-$1FFF
  off-area, the Multiface's ports $3F/$BF) and the MMC specification. The Multiface's register block is named
  after the public .z80 snapshot file format (an interface fact, like the API document). No published
  esxDOS, NextZXOS or Multiface source was opened.
- **Found:** the DivMMC ROM holds the vector table and bank dispatch, the FAT16/FAT32 file system (mounting,
  partitions, long and short names, directories, file handles, block and byte I/O) and the SD card's sector
  layer; error codes are the +3DOS rc_ numbers. The Multiface ROM is the NMI menu: it saves the program's
  state in a .z80-shaped block, the Status, memory browser and breakpoint screens (breakpoints are planted
  `NEXTREG $02,$08`, which raises the Multiface NMI), .z80 and bank saving, and the start of a snapshot that
  NextZXOS's loader raised.
- **Probe:** none (structural; the paths need a booted card).
- **Level:** both measure 2 (617 labels and 2,559 comments; 424 and 1,864) and reassemble byte for byte;
  both record level 2. Not shipped yet (N6).

### 2026-10-21 — The alternate ROM and enNextLG's page 2 (`enAltZX.rom`, `enNextLG.rom`, working copies, level 2)

- **Decoding first:** the alternate ROM's two pages stand in for ROM 0 and ROM 1 (NextReg $8C), so they get
  kinds of their own, `next-alt0`/`next-alt1` (replacing `next-os`), and decoder tables
  (`NEXT_ALT_ROM_PAGES`): page 0's `RST $10`/`$18`/`$20` + word into ROM 0/1/3, page 1's into ROM 1/2/3, page
  1's `CALL $00BA` (ROM 0) and `$00D7` (DivMMC); each stub leaves through its `$007B` (NextReg $8C = 0).
- **Method:** five helpers from the bytes (D4), with the 128K's and +3E's editor and syntax ROMs' names where
  the bytes and the job match; merged with `apply-draft.py`. The API document (`manual`) for the DOS and IDE
  calls COPY, CAT, MOVE, CD/MKDIR/RMDIR/PWD make; the developer guide for the sprite, tilemap, palette and AY
  ports.
- **Found:** page 0 is NextBASIC's screen editor (the 128K's editor widened to 32, 64 or 85 columns, with
  syntax colouring and the tokeniser) and holds the keyword table at $18FB-$19D5 that N1 read token names
  from; page 1 holds the SPRITE, TILE, LAYER, PALETTE, PLAY (three AY chips), CAT, COPY, ERASE, MOVE, CD,
  MKDIR, RMDIR, PWD and FORMAT commands, reached from NextZXOS ROM 1's syntax words with bits 15-14 = 10.
  NextZXOS page 1's OPT_RANGE_STEP synopsis was corrected (this ROM calls it).
- **enNextLG.rom** differs from enNextZX.rom only in page 2's two file-name texts ("lg.rom", "enNextLG.rom");
  its pages 0, 1, 3 have enNextZX's CRCs. `enNextLG.rom.dis` inherits enNextZX's page 2 and authors the two
  texts. Its text regions had to be declared again: parsing merges adjacent decoded regions, so the merged
  region holding a changed byte no longer binds. `sp48-dis.cjs` now maps parsed region types on its
  inheritance path.
- **Level:** both alternate pages measure 2 (511 labels and 2,309 comments; 612 and 3,059) and reassemble
  byte for byte; enNextLG's page 2 measures 2 (761 labels, 2 its own). All record level 2. Not shipped (N6).

### 2026-10-23 — HT-1080Z BASIC, first session (`ht1080z-s1.rom`, shipped file, level 0)

- **Set-up:** the BASIC ROM is known by its CRC (`romIdentity.ts`: kind `ht1080z-basic` for `2bfef8f7`,
  Series I and II, which are byte-identical, and `48985a30`, the /64), and `romDecoder.ts` decodes that kind
  with the IDE's own `Ht1080zCustomDisassembler` (the byte after `RST $08` as data; it also lists
  $1608-$18F6 as tables, a range this session did not yet check from the bytes). New tool
  `tools/ht1080z-dis.cjs`. `apply-annotations.cjs` no longer adds a batch's region twice. New sidecar
  `src/public/roms/ht1080z-s1.rom.dis` (no working copy yet), indexed.
- **Rule D4:** Level II BASIC is a ROM with widely published commented disassemblies, which the author of
  this session has very probably met in training. None was opened, no name list was used, and every name is
  a Klive name chosen after reading the routine. Region boundaries come from the bytes and the code that
  reads them.
- **Read from the bytes:** the restarts all jump through RAM ($4000-$4014), filled at power-on from $06D2
  (BOOT's 54-byte copy, read back from RAM in a run). `RST $08` → $1C96: compares (HL) with the byte after
  the RST and steps past it, else $1997. `RST $10` → $1D78 (next character), `RST $18` → $1C90 (HL with DE),
  `RST $20` → $25D9 (flags of the byte at $40AF), `RST $28`/`$30` RET, `RST $38` EI/RET. $0013/$001B/$0023
  call a device block (type, driver, two letters: KI $03E3, DO $0458, PR $058D) with B = 1/2/4 through
  $03C2. The key table at $0050 is read by the keyboard driver at $0443 for matrix row 6; the row's order is
  Klive's own key map (`Ht1080zKeyCode.ts`).
- **Probe** (a throwaway `test/ht1080z-hw/` test, deleted; Series I, 16K):
  - Power-on stops at $0075 then $00B5, never $069F; $37EC reads $FF (extension ROM).
  - NEW LINE alone at the question: the RAM test stops with HL = $8000; $40B1 = $7FFF, $40A0 = $7FCD.
    The answer 20000 gives $40B1 = $4E1E.
  - `$4000-$4035` after the question equals the $06D2 image except the display block's position bytes.
  - `PRINT (` stops at $19A2 with E = $28 and prints `?MO ERROR`; `A=1)` stops at $1997 and prints
    `?SN ERROR`, so E / 2 indexes the two-letter table at $18C9.
  - BREAK at the prompt reaches $0456 (`RST $28`), then $05F0 and $0661. The RESET key runs $0066,
    $06CC, $1A18, $1A19, and READY is printed again.
- **Done:** 45 labels (four on table starts), each with a synopsis, and 9 regions: the restarts, the device
  calls, the keyboard driver, BOOT and its disabled sector boot, the NMI, BASIC_INIT and the power-on
  question with its RAM test, the syntax check, NEXT_CHAR, CP_HL_DE, TYPE_FLAGS and the two error entries.
  Provenance `observed` throughout. Level 0: 764 unlabelled targets and 36 targets inside an instruction
  remain.

### 2026-10-23 — HT-1080Z ROM pages in the running machine (no annotation content)

- The machine now reports its BASIC and extension ROMs as two pages (-1, -2) instead of one 14K page, and
  has an `ht1080z` bank space, so the shipped `ht1080z-s1.rom.dis` shows in the live Disassembly view.
  Checked in the running IDE (Playwright harness): POWER_ON at $0000 and EXPECT_CHAR at $1C96 with their
  synopses. No annotations were added in this change.

### 2026-10-23 — HT-1080Z BASIC to level 2 (`ht1080z-s1.rom`, shipped file)

- **Method:** eight helper agents drafted $0000-$2FFF in $600 ranges from the listing alone
  (`helper-briefs/ht1080z-draft-a-range.md`: no `_input/` file — it holds commented disassemblies of this ROM —
  no web, no remembered Level II or Microsoft names). They had the IDE decoder's output, `dispatch.txt` (the
  routines the ROM's own function and statement tables reach, with Klive's token names), Klive's core and key
  map, and the facts of the first session. Merged with `merge-drafts.py` (three name clashes renamed:
  INT_SIGNED_HL, EVAL_BRACKETED, FN_CALL). No name list was used; every label is `observed`.
- **Found** (each with its code address in the synopses): the cassette format (255 zeros, $A5, SYSTEM blocks
  $55/$3C/$78 with checksums, BASIC programs as $D3 x3 and a name character), the display and printer drivers
  and their control codes, the line editor and EDIT, the tokenizer and lister, the expression evaluator and its
  precedences, the number formats (4-byte single, 8-byte double, exponent bias $80, sign in the top mantissa
  byte), single/double/integer arithmetic, number input and output, PRINT USING, the string space and its
  collector, the variable and array layouts, FOR/GOSUB stack frames, the error trap.
- **Settled at merge:** RND's multiplier is $4090-$4092 (one helper had "probably the seed"); the never-taken
  `JP C` at $0E11 became a one-byte region so that $0E12 (DBL_DIV_KEEP) lists as code and the false target
  $0412 goes.
- **Probe** (throwaway, deleted; Series I): program start $42E9; `10 ?1` stores $B2 (PRINT), `20 'X` stores
  `: REM $FB X`, ELSE is stored as `: $95`; $4090-$4092 read 40 E6 4D and one RND step takes a zero seed to
  65 B0 05 (seed x multiplier + $05B065); the error code at $409A after NEXT, RETURN, 1/0, READ, CHR$(300), a
  second DIM, A$=1, GOTO 999, RESUME, CONT and A(11) was 0, 4, $14, 6, 8, $12, $18, $0E, $24, $20, $10: NF, RG,
  /0, OD, FC, DD, TM, UL, RW, CN, BS, as the table at $18C9 gives.
- **Level:** 2, measured and recorded (915 labels, 928 synopses, 3,047 comments, 33 regions; 32 targets inside an
  instruction, each explained). Checked in the running IDE.

### 2026-10-23 — The other HT-1080Z ROMs (all at level 2, shipped files)

- **/64 BASIC** (`ht1080z-s64.rom.dis`): `inherits` s1; authors its five changed runs from the bytes. Probe
  (throwaway, deleted): the /64 asks `MEMORY SIZE?` and prints `BASIC  2.20`; NEW LINE made the top $FFFF; the
  banner is stored as $42 $41 $53 where Series I stores READY as $12 $05 $01; CLEAR -1 left $409A = $0C (OM) on
  the /64 and 8 (FC) on Series I; LPRINT completes on both. Added HOOK_ERROR ($012D) to s1, whose span the /64's
  text change cut.
- **Extension ROMs**: a page kind `ht1080z-ext` with an origin of $3000 (`romKindOrigin`), so the tools decode
  them where they run. Series I's and the /64's drafted by helpers (`helper-briefs/ht1080z-draft-extension.md`:
  no `_input/`, no web, no remembered names), the /64's reusing Series I's names where the bytes match; both ran
  probes (deleted) for the RAM vectors /12288 sets, the workspace, blink, auto-repeat, the renumber command, the
  monitor and the /64's accent mode. Series II's `inherits` Series I's and authors its accent code; probe: no
  message after /12288, $4016 = $303A, CLEAR+A typed $5D, CLEAR+E $40, a plain O $4F, CLEAR alone nothing.
  The /64's byte $05B9 is $00 where Series I has $10 (DJNZ): RE 1,1 left old digits and $40F9 unchanged
  (observed); the image matches the MAME set's checksums.
- **Character generators**: glyphs read from sheets rendered from the bytes (bits 7-3, 16 rows each); the
  core's use of them from `ht1080z-video.c`.
- **Merge fixes**: label references swapped for names with paragraphs re-flowed; a duplicated name and the
  RESUME synopsis repaired; every "probably" removed. Checked in the running IDE (Playwright harness): the /64
  shows its own MEMORY_TEXT and the extension's labels at $3000; Series I shows READY_TEXT.

### 2026-10-28 — Videoton TVC: `tvc12-d4.rom` (BASIC 1.2, SYS low chip) to level 2

- **Sources:** the ROM bytes through Klive's disassembler (`tools/tvc-dis.cjs`, the `tvc-sys-low` kind decoded at
  $C000 with `RST $30`'s code byte as data); the SYS high chip's and EXTH's bytes where this chip calls them;
  Klive's TVC core (`tvc-memory.c` paging, ports) for hardware facts; runs on the real core. Not used: anything
  under `_input/` (rtvc's ROM listings and symbols, `TVC_ROM_20190616.pdf`, `tvcrom.pdf`), the web, and the
  routine names in Klive's own TVC code (`KB_CHIN` there is rtvc's; $1618 is KBD_READ_KEY from its code). The OS
  manual (`operaciosrendszer.pdf`) has no text layer and was not used. No `manual` entries.
- **Coverage probe** (throwaway, deleted): the core's profile over boot and ~60 typed commands marked code
  ($0229-$0478, $098F-$1E6C) and data (the times table, statement words, constants, CRTC values, device table,
  font, key maps, token table, inline strings) before drafting; 51 regions from it and the bytes.
- **Helpers:** six, one per range, with `helper-briefs/tvc-draft-a-range.md` (no `_input/`, no web, no names from
  Klive's TVC code), `dispatch.txt` (built from the bytes) and the coverage map. Two ran probes (deleted): the
  flood fill ($0D48, reached only by `PLOT PAINT`; with put mode AND it filled a box), SET CHARACTER's RAM glyphs,
  the cursor-to-cell function. A helper found the dispatch file's statement tokens off by one: $1B97 indexes
  the table by `token XOR $FF`; checked from the code and corrected.
- **Settling probe** (throwaway, deleted): `PRINT ATN(1)` alone reaches the SYS high chip's $EAF1 and `EXP(1)`
  alone its $EBB8/$EBED (LOG, SQR, SIN, TAN reach neither), naming the two constant blocks; `SAVE "P"` calls
  device 5's functions 0-4 repeatedly (the cassette); `A=5` reaches $E3BC and `LET B=5` does not; after `FOR`
  and `GOSUB` the IY stack held a 6-byte entry of type $06 above a 43-byte entry of type $2B. Read from the code:
  a line number has an exponent byte of $40-$43 (1-9999); D bit 6 of the number reader marks an exponent
  overflow.
- **Merge fixes:** 30 labels given synopses, numeric references to labelled code swapped for names (RAM
  addresses kept), START_BASIC renamed BOOT_TO_BASIC (too close to BASIC_START), every "probably" settled.
- **Level:** 2, measured and recorded (471 labels, 1,802 annotated lines, 75 regions, 3,249 instructions; 2
  targets inside an instruction, each explained). Checked in the running IDE (Playwright harness, `dis` at
  $C229, $D9EF, $DB80 with the labels; $E000 unlabelled, as the SYS high chip has no sidecar yet).

### 2026-10-28 — Videoton TVC: `tvc12-d3.rom` (BASIC 1.2, SYS high chip) to level 2

- **Sources:** as for tvc12-d4 (the bytes through `tools/tvc-dis.cjs`, the SYS low and EXTH chips' bytes where
  this chip calls them, Klive's TVC core, runs). Not used: anything under `_input/`, the web, routine names from
  Klive's TVC code. No `manual` entries. Names from the SYS low chip's sidecar are cited, not copied as labels.
- **Base regions** from the bytes and the earlier profile run (which covered the whole SYS bank): the built-in
  function chain (23 entries, walked from VERNUM's, whose head the SYS low chip stores at $DD0F), every
  `RST $18` stream (the rule read from CALCULATOR $FB82 and the op routines: only op 5, $EA82, reads the
  stream), every `RST $08` code byte and `CALL $FE79` string (the scan rerun until no new site appeared), and
  the operand bytes at $0000-$0001.
- **Helpers:** seven, one per range, with `helper-briefs/tvc-draft-a-range.md`, a dispatch file built from the
  bytes (statement words, calculator ops, the function chain, the SYS low chip's calls into this chip with
  their names) and the coverage map. A helper corrected the facts file's number layout (+7 is a carry byte,
  not part of a 7-byte number at +2); checked against PUSH_NUMBER and NORMALIZE and sent to the others.
  Helper probes (deleted): XOR ORs the high bytes (POKE 30000,(256 XOR 256)/256 poked 1; 3 XOR 5 gave 6); an
  overflowing division gives 0 (X=1E60/1E-60 left 0, no error); a sign only starts a sum; ^ is left to
  right; string slices A$(2:3), A$(4); DEF Q(Z)=Z*2+1 gives Q(3) = 7; POKE/PEEK accept 0-65535 (else error
  4) and map $C000 up to video RAM; error output and STOP's "STOP at line 10".
- **Settling probe** (throwaway, deleted): "B"<"AA" is true and "AB"<"B" false (lengths compared first);
  LEN(STRING$(3,"")) = 0; 20 calls of STRING$(3,"") in one line left FREE unchanged.
- **Merge fixes:** four name clashes resolved by meaning (PRINT_PREFIX/PRINT_ITEM, READ_NUM_VAR/READ_NUMBER,
  STORE_NUM7/STORE_NUMBER, PRINT_NUM_ITEM/PRINT_NUMBER); run-address references swapped for names (this
  chip's, and "the SYS low chip's NAME"); the two "probably"s settled (token class 1 is a string variable;
  codes $10-$18 are the small Hungarian letters, as Klive's earlier TVC work observed).
- **Level:** 2, measured and recorded (607 labels, 285 regions, 4,279 instructions; 4 targets inside an
  instruction, each explained). Checked in the running IDE (Playwright harness, `dis` at $E002, $E570, $EAF1,
  $FB82, $FE79 with the labels and calls named).

### 2026-10-28 — Videoton TVC: `tvc12-d7.rom` (BASIC 1.2, EXTH) to level 2

- **Sources:** as for the SYS chips (the bytes through `tools/tvc-dis.cjs`, the SYS chips' sidecars for the
  routines EXTH calls and is called from, Klive's TVC core and its README's tape description, `TvcCasFile.ts`,
  runs). Not used: anything under `_input/`, the web, routine names from Klive's TVC code. No `manual` entries.
- **Base regions** from the bytes and the earlier profile run (which covered EXTH): the $FF filler
  ($0000-$0FFF), the RAM table defaults, the card names, the RAM glyphs (320 bytes and the fill glyph, read
  from the boot's copy loop) and the tail. No inline restarts or `CALL $FE79` sites (the $CF/$DF bytes are
  operands). A cross-reference built from `LD HL,nn` + `$FFF0` pairs in both directions, since EXTH and SYS
  never see each other.
- **Helpers:** three, one per range. Probes (deleted): the cassette codes SAVE, VERIFY, LOAD, OPEN OUTPUT,
  PRINT # and CLOSE use (DE/BC observed, the 16-byte program header); PRINT USING with 16 number formats and
  string alignments (e.g. `##,###.##` with 12345.678 prints "12,345.67"; numbers are truncated; `##` with 999
  is error 4). Glyphs read from their dots. The RS232 card is not emulated: its driver is described from the
  code only, without saying what the card does with the bytes.
- **Merge fixes:** the card-name region split; $1FE8 renamed BAUD_DEFAULT (it sets the RS232 speed index 4);
  references to EXTH's own routines swapped for names ($FFF0 left as a number: both chips have one); every
  "probably" settled from another helper's evidence or removed.
- **Level:** 2, measured and recorded (287 labels, 39 regions, 1,977 instructions; 3 targets inside an
  instruction, each explained). Checked in the running IDE: `bp-set $F000`, `em-debug`, then `dis` at $F000,
  $F3D8 and $FFF0 show EXTH's labels (EXTH_BOOT, CASX_CHAR, EXTH_TO_SYS).

### 2026-10-31 — ZX Spectrum Next: the nextzxos-2.10 sidecars carried from nextzxos-2.08 (D8)

- **What:** `src/public/roms/zxnext/nextzxos-2.10/{enNextZX,enNxtmmc,enNextMf,enAltZX,enNextLG}.rom.dis`, carried
  from the same files of the `nextzxos-2.08` set (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D8). Every 2.10 page CRC
  differs from 2.08's, so nothing was reused as is. Nothing new was written: every entry is one of Klive's own
  2.08 entries, moved. **Sources:** Klive's 2.08 sidecars and the two sets' ROM bytes, nothing else (no
  disassembly, name list or other annotation of NextZXOS 2.10 was opened).
- **How:** `npm run rom:annotations:carry -- <fromSidecar> <toRom>` (`scripts/rom-annotations-carry.cjs`, its
  header has the rules). Each annotated offset (label, line annotation, data region start and end) is re-anchored
  by a byte signature of the 2.08 page that occurs once in the 2.10 page: forward, centred and backward windows
  of 8-128 bytes, cut at instruction boundaries, with the address operands of CALL/JP/LD/PUSH nn and of a
  restart's inline word that point into the page as wildcards; shapes must agree; a place found by fewer than 16
  fixed bytes must lie between its strongly placed neighbours; an ambiguous one is placed only when the strong
  anchors on both sides moved by the same distance. Labels and comments in a data region go only where that
  region went; labels not on a 2.10 instruction start are dropped. Code regions are rebuilt as the gaps.
  Cross-checked against an independent byte alignment (difflib) of each page: no disagreement except one label
  (enAltZX page 1 PATH_REASON), where the alignment was wrong and the signature right (checked by the bytes).
- **Provenance:** every carried entry is `derived`, and each file's `carriedFrom` names the 2.08 sidecar it came
  from. `manual` 2.08 entries are `derived` here too (their source is the 2.08 sidecar). `enNextLG.rom.dis`
  still describes page 2 only and now inherits `zxnext/nextzxos-2.10/enNextZX.rom.dis` page 2.
- **Counts (carried / 2.08 entries):** enNextZX labels 3,714/4,015, line annotations 16,424/17,921, data regions
  227/269; enNxtmmc 607/617, 2,587/2,623, 10/13; enNextMf 421/424, 1,989/1,997, 34/34; enAltZX 929/1,123,
  4,510/5,625, 48/53; enNextLG 1/2, 1/2, 19/22 (MSG_VERSION's text region changed, so its label and synopsis,
  which quote "0208", were not carried).
- **Review lists:** `.ai/rom-annotations/carry-review/nextzxos-2.10/<file>.rom.review.txt`: every entry not
  carried (missing, ambiguous, conflict, out of order, outside its region, off an instruction start) and every
  carried comment to check (it names a ROM address that moved or was not placed, or the data under it changed:
  enNextZX 860, enNxtmmc 79, enNextMf 91, enAltZX 185).
- **Level:** 0 for every file, measured: the 2.10 pages have unlabelled targets (enNextZX 27/110/28/24, enNxtmmc
  6, enNextMf 3, enAltZX 228/291, enNextLG 28 with the inherited entries). The labels kept all have synopses.
  Next: an authoring session per file works through its review list and the `skeleton` to-do list, from the 2.10
  bytes, under D4 as for any other page.

### 2026-10-31 — ZX Spectrum Next: the nextzxos-2.10 sidecars to level 2

- **What:** all five `src/public/roms/zxnext/nextzxos-2.10/*.rom.dis`, from the carry (level 0) to level 2, every
  page measured and reassembled byte for byte (`reassemble-test.ts.txt`). Nine helpers drafted from the 2.10 bytes
  (D4), one per page or range, merged with `apply-draft.py`; their facts were passed between ranges.
  **Sources:** the 2.10 ROM bytes through Klive's disassembler, Klive's own 2.08 and 2.10 sidecars (names and
  comments reused only where the 2.10 code was read and does the same job, or where the instruction sequence is
  identical after aligning the two listings), and the interface documents of the earlier Next sessions (API
  document, `nextreg.txt`, the Spectrum manual's token codes). No published or remembered NextZXOS, esxDOS or
  Multiface disassembly, source, symbol file or name list was opened.
- **Decoding first** (`nextzxos-disassembler.ts`, tests in `nextRomDecoder.test.ts`): 2.10 moved ROM 1's DivMMC call
  stubs ($26CB/$26E5 → $26C5/$26DF), its error entry (2.08's `CALL $08EF` + byte → `CALL $08E2` + byte, without
  closing file 0) and the Multiface's API call ($1569 → $1572); the alternate ROM page 0 gained `RST $30` + a ROM 2
  word ($0099, through $5B43). The tables list both sets' addresses; a test proves no set calls the other's. The
  tools `sp48-dis.cjs` and `check-annotations.cjs` had read the 2.08 ROM for a 2.10 sidecar (its bare
  `source.fileName`); they now take the ROM from the sidecar's path. `apply-draft.py`'s `:replace=` dropped region
  provenance on every page; it is now limited to its page.
- **Found (structural, from the bytes):** 2.10 moved the SAVE/LOAD/VERIFY/MERGE code from ROM 1 into the
  alternate ROM page 1 ($2E45-$353D), the start-up menu from ROM 0 into the alternate ROM page 0 ($2115-$2719),
  and the Browser's settings code from ROM 0 into ROM 2 ($297E-$2A8E, its data now in DivMMC bank 1). ROM 3 hands
  work to the alternate ROM page 1 with bare `NEXTREG $8C,$80` hooks ($03C1, $1664, $1FBE, $2962, $2BED), which
  run PLOT/POINT/DRAW/CIRCLE for screen modes 1-15. New: LINE (renumbering), LINE NEW/MERGE, BANK n LINE/MERGE
  and ERASE in the alternate ROM page 0, with automatic line numbers ($D74E/$D750); REG (keyword $88) takes a
  list; OUT; SPRITE OVER; TILE BANK n OVER; a DEF FN parameter lookup; a boot option kept across resets. Bank 7's
  variables from $D74E up and the Browser buffers moved by 4; the version word is $E210 (was $0208); the local
  variable list pointer is ($5B58), not ($5C0B). Data regions the carry lost were restored from the bytes:
  ROM 1's syntax tables ($0300-$056B), the copyright text, the calculator's operation table in ROM 3, PLAY's
  periods, the Browser's key tables, and texts in new code.
- **Labels per page:** enNextZX 1,026 / 980 / 785 / 1,149; enAltZX 660 / 806; enNextMf 425; enNxtmmc 618;
  enNextLG 2 of its own (785 with the inherited ones).
  Two targets inside an instruction remain on page 2 ($0747, $0934): real jumps into the ZX80 ROM from code run at
  $F000, as in 2.08.
- **Not done:** the carried comments in enNextZX page 0's Browser ($2EB2-$3B60) rest on the alignment and an
  automatic address pass, not a full re-read: a comment pass there is the next step. Some cross-page caller lists
  in synopses that were not touched may still quote 2.08 addresses of other pages. No probe was run.

### 2026-11-01 — Enterprise 128: `ep-exos21.rom` page 0 (EXOS 2.1, segment 00h) to level 2

- **What:** `src/public/roms/ep-exos21.rom.dis`, page 0 only, written from scratch: the kernel (reset, the ROM
  checksum and RAM test, the ROM scan, the RAM-copied pager and `RST 30h` entry, the dispatcher, EXOS 0-34 except
  what segment 1 serves, channels, the channel-buffer allocator, module loading), and the VIDEO, SOUND, KEYBOARD
  and EDITOR devices. Plumbing in the same change: the `ep-exos`/`ep-ext` page kinds (every Enterprise ROM page
  known by its CRC, listed at $C000, `RST 30h`'s function byte decoded), `isRomPartition` for the Enterprise's
  positive ROM partitions, `EpWasmV2Machine.getRomPartitionImages`, `tools/ep-dis.cjs`, the probe template and the
  helper brief; `merge-drafts.py` takes a draft's `"manual"` list.
- **Sources:** the ROM bytes through Klive's disassembler (`tools/ep-dis.cjs`); runs on the real core
  (`test/harness/enterprise/`); and, for interface facts only (marked `manual`, 443 entries), the EXOS 2.1 kernel
  specification (`_input/enterprise128/docs/Exos.htm`, the Hungarian translation of the official technical
  specification): function codes and names, the fixed system-segment variable names, EXOS variable numbers and
  names, error codes and names, action codes, descriptor formats, special function codes, video modes and escape
  sequences. Hardware facts (ports) from Klive's own `DAVE_MEMORY_IO.md` notes. No commented disassembly, symbol
  file or name list of EXOS was opened; ep128emu, Xep128 and other GPL sources were not read. Segment 1's bytes
  were read where segment 0 calls it (its service dispatcher at $E40F, service 4 at $E47A).
- **How:** the session read the reset code, the RAM copies, the dispatcher and the device chain into a facts file
  and a dispatch list (built from the indexing code: the function table at $000A for codes 17-34, the chain at
  $0008, each device's entry table), extracted the specification's text, then nine helpers drafted one range
  each under `helper-briefs/ep-draft-a-range.md` with the D4 rule; no helper opened `_input/` or the web. Merged
  with `merge-drafts.py`; the session then renamed six labels two helpers had both chosen (from the code), swapped
  226 numeric references to labelled code for names, turned run-address references to this page into offsets,
  and settled every "probably" from the code or a probe.
- **Runs (observed):** a profile over the boot and ~60 typed IS-BASIC commands: the boot reads every ROM byte (the
  32K word checksum at $0084, which must come to 0), so only reads after the boot marked data. EXDOS 1.3's
  action-7 request at boot is B = 1, DE = $07D4 and is given segment $FF (stop at $0339). Two helper probes read
  the editor's buffer and variables after the boot, after typing and after cursor keys (window 24 x 40, margins
  1 and 38, 2143 free bytes). A probe template run stopped in VIDEO's write character ($D4D0) with segment 0 in
  page 3.
- **Read from the bytes against the specification:** @@MARG treats $FF as "keep" and 0 as "the cursor column",
  the reverse of the specification's text; the action-7 path for RAM in a device segment stores the request byte
  popped at $0332 instead of the segment read at $032F (no shipped ROM takes it). Both are described as the code
  does them.
- **Level:** 2, measured and recorded (1,132 labels, 48 data regions, 8,268 instructions; 22 targets inside an
  instruction, each explained on the instruction that hides it). Reassembles byte for byte (the source export).
  Checked in the running IDE (Playwright harness): `dis $D4D0` at a breakpoint shows VID_WRITE_CHAR with its
  operands named, `dis $C410` shows KERNEL_ENTRY; `ann-info` finds the shipped sidecar for segment 0 and lists
  segments 01h, 04h and 10h by file; the ROM annotation editor reports "Ready to ship · level 2".

### 2026-11-01 — Enterprise 128: `ep-exos21.rom` page 1 (EXOS 2.1, segment 01h) to level 2

- **Sources:** the ROM bytes through Klive's disassembler (`tools/ep-dis.cjs`, now with IS-BASIC's call lists
  decoded on this page, kind `ep-exos-basic`); the IS-BASIC 2.1 cartridge's bytes (`ep-basic21.rom`) where this
  page calls it; runs on the real core (`test/harness/enterprise/`); and, for interface facts only (marked
  `manual`, 325 entries), the EXOS 2.1 kernel specification (`_input/enterprise128/docs/Exos.htm`): action codes,
  EXOS variable numbers and names, error codes and names, special functions, descriptor formats, escape
  sequences. Hardware facts (ports) from Klive's own core notes. No commented disassembly, symbol file or name
  list of EXOS or IS-BASIC was opened; ep128emu, Xep128 and other GPL sources were not read; no helper opened
  `_input/` or the web.
- **How:** a profile run, then probes that dumped the null segment's low RAM after the boot (the cartridge's gate:
  `RST 08h`/`10h`/`18h`/`20h`) and logged every step of the call lists over 56 commands (only $92 moved the list
  pointer, by one byte; $93 and $96 read a word, from their code). The decoder was written from that and checked
  against the profile: all 164 lists that ran end where the code goes on. Two helpers wrote the call dictionary
  (the cartridge's 65 routines and this page's 64), eleven drafted ranges under `helper-briefs/ep-draft-a-range.md`
  with the D4 rule. Merged with `merge-drafts.py`; the session renamed two clashing labels (from the code),
  labelled one more target (`WP_JP_HL`), swapped 83 numeric references to labelled code for names and settled
  every "probably" from the code or a probe.
- **Runs (observed):** the profile (about 100 typed IS-BASIC commands and the WP's keys; 4,818 bytes ran, 3,934
  were read as data after the boot). A probe at SERIAL's write character showed descriptor byte IX+11 = 4 for
  channel 3 (the channel number + 1). Helper probes: VER$ (66 characters), function results (EXP, LOG10, SQR,
  ROUND, TRUNCATE, RND, MOD, REM, SIZE, UBOUND, LBOUND, POS, RTRIM$, MAXLEN, EPS, HEX$), EXSTRING$ for each error
  number, `:HELP WP`, `:HELP ISL1985`, an unknown command, the WP's screens and function keys, DATE's 8-digit form.
- **Read from the bytes and confirmed in runs:** POS misses a match after a partial one; RTRIM$ trims nothing past
  128 characters; MOD with a negative divisor gives 0; MAXLEN of a string-array element gives 0. The tamper check
  (one tick in eight) passes on the ROM as shipped (computed). The 32K ROM's words add up to 0.
- **Level:** 2, measured and recorded (923 labels, 519 data regions, 7,184 instructions; 23 targets inside an
  instruction, each explained on the instruction that hides it). Reassembles byte for byte (the source export).
  Checked in the running IDE (Playwright harness): `dis $E47A` at a breakpoint shows SVC_TICK with its operands
  named; `ann-info` finds the shipped sidecar for segment 01h; the ROM annotation editor reports "Ready to ship ·
  level 2". The live gating of the call lists is covered by a test over the real page bytes and the panel's
  context function.

### 2026-11-01 — Enterprise 128: `ep-basic21.rom` (the IS-BASIC 2.1 cartridge) to level 2

- **Sources:** the ROM bytes through Klive's disassembler (`tools/ep-dis.cjs`, the call lists decoded: kind
  `ep-basic`); EXOS 2.1's finished sidecar for the routines the cartridge reaches; runs on the real core; Klive's
  `src/common/enterprise/basicTokens.ts` for token numbers the BASIC listing view decodes (interface facts); and,
  for interface facts only (marked `manual`), the EXOS 2.1 kernel specification. No commented disassembly or
  name list of IS-BASIC was opened; GPL emulator sources were not read; no helper opened `_input/` or the web.
- **How:** the 65 routine names of the cartridge's call table came from the call dictionary written for EXOS's
  segment 01h (from the bytes and probes). A profile over ~140 typed commands and two programs, then ten helpers
  drafted ranges under `helper-briefs/ep-draft-a-range.md` with the D4 rule. Merged with `merge-drafts.py`; the
  session renamed three clashing labels, listed the restarts' two RAM `JR`s as data (their targets differ in the
  ROM listing), settled every "probably" from the code, and swapped 298 numeric references to labelled code for
  names.
- **Runs (observed):** the profile (8,976 bytes ran after the boot, 1,268 read as data); helper probes of
  EXSTRING$ for many error numbers, statements (SELECT/CASE, slices, logical operators, ASK, CLOSE, CALL,
  CONTINUE, INFO); a probe that typed a line of 70 "1+" terms: error 20073 "Statement not allowed after THEN"
  from the line-buffer resize at $0504.
- **Level:** 2, measured and recorded (1,021 labels, 493 data regions, 7,770 instructions; 38 targets inside an
  instruction, each explained on the instruction that hides it). Reassembles byte for byte. In the running IDE
  `ann-info` finds the shipped sidecar for segment 04h and the ROM annotation editor reports "Ready to ship ·
  level 2".

### 2026-11-01 — Enterprise 64: `ep-exos20.rom` (EXOS 2.0, segments 00h and 01h) to level 2

- **Sources:** Klive's own EXOS 2.1 sidecar, carried onto 2.0's bytes with `npm run rom:annotations:carry`
  (579 of 1,132 labels on page 0, 630 of 923 on page 1; provenance `derived`); the ROM bytes through
  `tools/ep-dis.cjs` (page 1 with IS-BASIC's call lists decoded, kind `ep-exos-basic`); runs on the 64
  (`createEpSession({ model: "ep64" })`); and, for interface facts only (marked `manual`), the EXOS 2.1 kernel
  specification, each checked against 2.0's code. No commented disassembly or name list of EXOS was opened; GPL
  emulator sources were not read; no helper opened `_input/` or the web.
- **How:** a script compared each carried label's routine with 2.1's (317 DIFFERS); ten helpers aligned 2.0
  with 2.1 instruction by instruction, carried the remaining text with every ROM and RAM address translated, and
  rewrote every routine that really differs from 2.0's bytes (`replace` and `rename` lists, new in
  `merge-drafts.py`). The session then flagged every RAM address in the text that 2.1's code uses and 2.0's does
  not (8, all correct on reading), settled the last "probably" by computing the 32K word sum (0), and swapped 38
  numeric references for names.
- **Runs (observed):** a profile on the 64 over ~145 typed commands and two programs; helper probes: CSC(1)
  printed blank lines and never returned to "ok", ANGLE(-1,0) under OPTION ANGLE DEGREES gave 3.141592654,
  MOD(5,-3) and MOD(-7,-3) gave -1, VER$ and VERNUM (2), TIME$ and DATE$ after the boot.
- **Level:** 2 on both pages, measured and recorded (1,142 and 899 labels; 21 and 23 targets inside an
  instruction). Reassembles byte for byte. On the 64 in the running IDE `dis $E471` at a breakpoint shows
  SVC_TICK with its targets named, `ann-info` finds the shipped sidecar for segments 00h and 01h, and the ROM
  annotation editor reports "Ready to ship · level 2".
