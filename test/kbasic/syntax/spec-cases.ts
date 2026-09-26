/**
 * One entry per EBNF form in the spec (`.ai/zxbasic-syntax/zxbasic-syntax.json`), keyed by the exact
 * form string: programs the parser must accept and ones it must reject. Used by the parser's
 * spec-form test and by the binder's robustness test.
 */
export const CASES: Record<string, { accept: string[]; reject: string[] }> = {
  'asm-block = "ASM" NL { asm-line } "END" "ASM" ;': { accept: ["ASM\n nop\n ret\nEND ASM"], reject: ["ASM\n nop\n"] },
  'beep = "BEEP" expr "," expr ;': { accept: ["BEEP 0.5, 12"], reject: ["BEEP 1"] },
  'bold = "BOLD" expr ;': { accept: ["BOLD 1"], reject: ["BOLD"] },
  'border = "BORDER" expr ;': { accept: ["BORDER 2"], reject: ["BORDER"] },
  'bright = "BRIGHT" expr ;': { accept: ["BRIGHT 1"], reject: ["BRIGHT"] },
  'circle = "CIRCLE" [ attr-list ] expr "," expr "," expr ;': {
    accept: ["CIRCLE 128, 88, 40", "CIRCLE INK 2; 1, 2, 3"],
    reject: ["CIRCLE 1, 2"]
  },
  'attr-list = attr-modifier ";" { attr-modifier ";" } ;': {
    accept: ["PLOT INK 1; PAPER 2; 3, 4"],
    reject: ["PLOT INK 1 3, 4"]
  },
  'cls = "CLS" ;': { accept: ["CLS"], reject: ["CLS 1"] },
  'const-stmt = "CONST" identifier [ "AS" type ] "=" const-expr ;': {
    accept: ["CONST a AS UBYTE = 5", "CONST b = 1", 'CONST s$ = "text"'],
    reject: ["CONST c", "CONST = 1"]
  },
  'continue = "CONTINUE" ( "DO" | "FOR" | "WHILE" ) ;': { accept: ["CONTINUE FOR"], reject: ["CONTINUE", "CONTINUE LOOP"] },
  'data = "DATA" expr { "," expr } ;': { accept: ['DATA 1, "a", x + 1'], reject: ["DATA", "DATA 1,"] },
  'declare = "DECLARE" ( sub-header | function-header ) ;': {
    accept: ["DECLARE FUNCTION f(a AS INTEGER) AS LONG", "DECLARE SUB s"],
    reject: ["DECLARE x"]
  },
  'dim-stmt = "DIM" idlist [ "AS" type ] ;': { accept: ["DIM a, b AS INTEGER", "DIM c"], reject: ["DIM a, AS INTEGER"] },
  'dim-stmt = "DIM" identifier [ "AS" type ] "=" expr ;': { accept: ["DIM a AS UBYTE = 5", "DIM b = 1.5"], reject: ["DIM a, b = 5"] },
  'dim-stmt = "DIM" identifier [ "AS" type ] "AT" const-address ;': { accept: ["DIM a AS UBYTE AT 23672"], reject: ["DIM a AT"] },
  'dim-stmt = "DIM" identifier "(" bounds ")" [ "AS" type ] ;': { accept: ["DIM a(10) AS BYTE", "DIM s$(5)"], reject: ["DIM a(10"] },
  'dim-stmt = "DIM" identifier "(" bounds ")" [ "AS" type ] "AT" const-address ;': {
    accept: ["DIM a(1 TO 5) AS UBYTE AT 49152"],
    reject: ["DIM a(5) AT"]
  },
  'dim-stmt = "DIM" identifier "(" bounds ")" [ "AS" type ] "=>" vector ;': {
    accept: ["DIM a(2) => {1, 2, 3}", "DIM b(1) AS UBYTE => {1, _\n 2}"],
    reject: ["DIM a(2) => 1, 2"]
  },
  'idlist = identifier { "," identifier } ;': { accept: ["DIM x, y, z"], reject: ["DIM x y"] },
  'bounds = bound { "," bound } ;': { accept: ["DIM a(1, 2, 3)"], reject: ["DIM a(1,)"] },
  'bound = const-expr | const-expr "TO" const-expr ;': { accept: ["DIM a(4)", "DIM b(1 TO 4)"], reject: ["DIM a(1 TO)"] },
  'vector = "{" ( const-expr { "," const-expr } | vector { "," vector } ) "}" ;': {
    accept: ["DIM a(1, 1) => {{1, 2}, {3, 4}}"],
    reject: ["DIM a(1) => {1, 2"]
  },
  'const-address = const-expr | "@" identifier | "@" identifier "(" const-expr { "," const-expr } ")" | "@" label ;': {
    accept: ["DIM x AT @y", "DIM x AT @arr(1, 2)", "DIM x AT 1000", "DIM x AT @lbl"],
    reject: ["DIM x AT @", "DIM x AT @(1)"]
  },
  'do = "DO" SEP block "LOOP" ;': { accept: ["DO: LOOP", "DO\n x = 1\nLOOP"], reject: ["DO\nx = 1"] },
  'do = "DO" SEP block "LOOP" ( "UNTIL" | "WHILE" ) expr ;': {
    accept: ["DO: LOOP UNTIL a", "DO\nLOOP WHILE b"],
    reject: ["DO: LOOP UNTIL"]
  },
  'do = "DO" ( "UNTIL" | "WHILE" ) expr SEP block "LOOP" ;': {
    accept: ["DO UNTIL a: LOOP", "DO WHILE b\nLOOP"],
    reject: ["DO UNTIL a: LOOP WHILE b", "DO WHILE: LOOP"]
  },
  'draw = "DRAW" [ attr-list ] expr "," expr [ "," expr ] ;': {
    accept: ["DRAW 1, 2", "DRAW 1, 2, PI", "DRAW OVER 1; 3, 4"],
    reject: ["DRAW 1"]
  },
  'end = "END" [ expr ] ;': { accept: ["END", "END 3"], reject: ["END 1, 2"] },
  'error = "ERROR" expr ;': { accept: ["ERROR 3"], reject: ["ERROR"] },
  'exit = "EXIT" ( "DO" | "FOR" | "WHILE" ) ;': { accept: ["EXIT DO", "EXIT WHILE"], reject: ["EXIT SUB"] },
  'flash = "FLASH" expr ;': { accept: ["FLASH 1"], reject: ["FLASH"] },
  'for = "FOR" identifier "=" expr "TO" expr [ "STEP" expr ] SEP block "NEXT" [ identifier ] ;': {
    accept: ["FOR i = 1 TO 2 STEP 1: NEXT i", "FOR j = 1 TO 5\n PRINT j\nNEXT"],
    reject: ["FOR i = 1: NEXT", "FOR 1 = 1 TO 2: NEXT", "FOR i = 1 TO 3\nPRINT i"]
  },
  'function-def = "FUNCTION" [ convention ] identifier [ "(" [ params ] ")" ] [ "AS" type ] NL body "END" "FUNCTION" ;': {
    accept: ["FUNCTION f AS UBYTE\n RETURN 1\nEND FUNCTION", "FUNCTION STDCALL g(a, b) AS LONG\nEND FUNCTION", "FUNCTION h()\nEND FUNCTION"],
    reject: ["FUNCTION f(\nEND FUNCTION", "FUNCTION\nEND FUNCTION", "FUNCTION f\nPRINT"]
  },
  'convention = "FASTCALL" | "STDCALL" ;': {
    accept: ["SUB FASTCALL s(a AS UBYTE)\nEND SUB", "SUB STDCALL t\nEND SUB"],
    reject: ["SUB PASCAL s\nEND SUB"]
  },
  'params = param { "," param } ;': { accept: ["SUB s(a, b, c)\nEND SUB"], reject: ["SUB s(a,)\nEND SUB"] },
  'param = [ "BYVAL" | "BYREF" ] identifier [ "AS" type ] [ "=" const-expr ] | [ "BYREF" ] identifier "(" ")" "AS" type ;': {
    accept: ["SUB s(BYVAL a AS UBYTE = 1, BYREF b() AS UBYTE, c() AS FLOAT, d)\nEND SUB"],
    reject: ["SUB s(a() AS)\nEND SUB", "SUB s(BYVAL)\nEND SUB", "SUB s(a())\nEND SUB"]
  },
  'goto = "GO" "TO" target ;': { accept: ["GO TO 10"], reject: ["GO 10"] },
  'gosub = "GO" "SUB" target ;': { accept: ["GO SUB lbl"], reject: ["GO SUB"] },
  'gosub = "GOSUB" target ;': { accept: ["GOSUB 100"], reject: ["GOSUB"] },
  "target = line-number | identifier ;": { accept: ["GOTO lbl", "GOTO 10"], reject: ["GOTO 1.5", "GOTO a$"] },
  'goto = "GOTO" target ;': { accept: ["GOTO 10"], reject: ["GOTO"] },
  'if-single = "IF" expr [ "THEN" ] statements [ "ELSE" statements ] [ ":" ( "END" "IF" | "ENDIF" ) ] ;': {
    accept: ["IF a THEN PRINT 1 ELSE PRINT 2: END IF", "IF a PRINT 1: ENDIF", "IF a THEN x = 1: y = 2"],
    reject: ["IF THEN PRINT 1", "IF a THEN PRINT 1 ELSE ELSE PRINT 2"]
  },
  'if-block = "IF" expr [ "THEN" ] NL block { "ELSEIF" expr [ "THEN" ] [ NL ] block } [ "ELSE" [ NL ] block ] ( "END" "IF" | "ENDIF" ) ;': {
    accept: ["IF a THEN\nELSEIF b THEN\nELSE\nEND IF", "IF a\n PRINT\nENDIF", "IF a THEN\nELSEIF b PRINT 1\nELSE PRINT 2\nEND IF"],
    reject: ["IF a THEN\nPRINT 1", "IF a THEN\nELSE\nELSE\nEND IF"]
  },
  'ink = "INK" expr ;': { accept: ["INK 7"], reject: ["INK"] },
  'inverse = "INVERSE" expr ;': { accept: ["INVERSE 1"], reject: ["INVERSE"] },
  'italic = "ITALIC" expr ;': { accept: ["ITALIC 1"], reject: ["ITALIC"] },
  'assignment = [ "LET" ] identifier "=" expr ;': { accept: ["LET a = 1", "b = 2"], reject: ["LET = 1", "LET a 1"] },
  'array-assignment = [ "LET" ] identifier "(" args ")" "=" expr ;': { accept: ["a(1, 2) = 3", "LET b(0) = 1"], reject: ["a(1, 2 = 3"] },
  'array-copy = [ "LET" ] array-identifier "=" array-identifier ;': { accept: ["LET a = b", "c = d"], reject: ["LET a ="] },
  'substr-assignment = [ "LET" ] str-designator "(" [ expr ] "TO" [ expr ] ")" "=" string-expr ;': {
    accept: ['a$(1 TO 2) = "x"', 'LET a$(TO) = ""', 'a$(3 TO) = "y"'],
    reject: ['a$(1 TO 2 = "x"', 'a$(1 TO 2 TO 3) = "x"']
  },
  'substr-assignment = [ "LET" ] str-designator "(" expr ")" "=" string-expr ;': { accept: ['a$(3) = "y"'], reject: ['a$(3 = "y"'] },
  'substr-assignment = [ "LET" ] string-array "(" args ")" "(" [ expr ] "TO" [ expr ] ")" "=" string-expr ;': {
    accept: ['s$(1)(2 TO 3) = "z"'],
    reject: ['s$(1)(2 TO 3 = "z"']
  },
  'substr-assignment = [ "LET" ] string-array "(" args "," expr ")" "=" string-expr ;': {
    accept: ['s$(1, 2) = "w"'],
    reject: ['s$(1, ) = "w"']
  },
  'load = "LOAD" string-expr ( "CODE" [ expr [ "," expr ] ] | "SCREEN$" | "SCREEN" | "DATA" [ identifier [ "(" ")" ] ] ) ;': {
    accept: ['LOAD "x" CODE', 'LOAD "x" CODE 32768, 10', 'LOAD "s" SCREEN$', 'LOAD "s" SCREEN', 'LOAD "d" DATA a()', 'LOAD "" DATA'],
    reject: ['LOAD "x"', 'LOAD "x" CODE 1,', 'LOAD "d" DATA a(']
  },
  'on-jump = "ON" expr ( "GOTO" | "GO" "TO" | "GOSUB" | "GO" "SUB" ) target { "," target } ;': {
    accept: ["ON x GOTO 10, 20", "ON x GO SUB a", "ON x GOSUB a, b", "ON x GO TO 1"],
    reject: ["ON x GOTO", "ON x PRINT"]
  },
  'out = "OUT" expr "," expr ;': { accept: ["OUT 254, 1"], reject: ["OUT 254"] },
  'over = "OVER" expr ;': { accept: ["OVER 1"], reject: ["OVER"] },
  'paper = "PAPER" expr ;': { accept: ["PAPER 6"], reject: ["PAPER"] },
  'pause = "PAUSE" expr ;': { accept: ["PAUSE 0"], reject: ["PAUSE"] },
  'plot = "PLOT" [ attr-list ] expr "," expr ;': { accept: ["PLOT 1, 2"], reject: ["PLOT 1"] },
  'poke = "POKE" expr "," expr ;': { accept: ["POKE 23672, 0"], reject: ["POKE 1"] },
  'poke = "POKE" "(" expr "," expr ")" ;': { accept: ["POKE (1, 2)"], reject: ["POKE (1, 2"] },
  'poke = "POKE" type expr "," expr ;': { accept: ["POKE UINTEGER 23675, 60000"], reject: ["POKE UINTEGER 1"] },
  'poke = "POKE" "(" type expr "," expr ")" ;': { accept: ["POKE (FLOAT a, PI)"], reject: ["POKE (FLOAT 1)"] },
  'poke = "POKE" type "," expr "," expr ;': { accept: ["POKE LONG, 1, 2"], reject: ["POKE LONG, 1"] },
  'poke = "POKE" "(" type "," expr "," expr ")" ;': { accept: ["POKE (LONG, 1, 2)"], reject: ["POKE (LONG, 1, 2"] },
  'print = "PRINT" [ print-item { print-sep print-item } ] [ print-sep ] ;': {
    accept: ["PRINT", "PRINT a; b, c;", "PRINT ,"],
    reject: ["PRINT )", "PRINT AT 1"]
  },
  'print-sep = ";" | "," ;': { accept: ["PRINT 1, 2; 3"], reject: ["PRINT 1 : 2"] },
  'print-item = expr | "AT" expr "," expr | "TAB" expr | attr-modifier ;': {
    accept: ["PRINT AT 0, 0; TAB 4; INK 2; 1"],
    reject: ["PRINT TAB", "PRINT AT 1; 2"]
  },
  'attr-modifier = ( "INK" | "PAPER" | "FLASH" | "BRIGHT" | "INVERSE" | "OVER" | "BOLD" | "ITALIC" ) expr ;': {
    accept: ['PRINT PAPER 1; BOLD 1; ITALIC 0; FLASH 0; BRIGHT 1; INVERSE 0; OVER 1; "x"'],
    reject: ["PRINT INK; 1"]
  },
  'randomize = "RANDOMIZE" [ expr ] ;': { accept: ["RANDOMIZE", "RANDOMIZE 42"], reject: ["RANDOMIZE 1, 2"] },
  'read = "READ" designator { "," designator } ;': { accept: ["READ a, b(1), c$"], reject: ["READ", "READ 1"] },
  'designator = identifier | identifier "(" args ")" ;': { accept: ["READ x(1, 2)"], reject: ["READ x("] },
  'restore = "RESTORE" [ target ] ;': { accept: ["RESTORE", "RESTORE lbl", "RESTORE 100"], reject: ["RESTORE 1 + 2"] },
  'return = "RETURN" [ expr ] ;': { accept: ["RETURN", "RETURN a + 1"], reject: ["RETURN ,"] },
  'save = "SAVE" string-expr ( "CODE" expr "," expr | "SCREEN$" | "SCREEN" | "DATA" [ identifier [ "(" ")" ] ] ) ;': {
    accept: ['SAVE "c" CODE 16384, 6912', 'SAVE "s" SCREEN$', 'SAVE "d" DATA', 'SAVE "v" DATA v'],
    reject: ['SAVE "x" CODE 1', 'SAVE "x"']
  },
  'stop = "STOP" [ expr ] ;': { accept: ["STOP", "STOP 1"], reject: ["STOP ,"] },
  'sub-def = "SUB" [ convention ] identifier [ "(" [ params ] ")" ] NL body "END" "SUB" ;': {
    accept: ["SUB s\nEND SUB", "SUB FASTCALL t(a)\n PRINT a\nEND SUB"],
    reject: ["SUB s AS INTEGER\nEND SUB", "SUB\nEND SUB", "SUB s\nEND FUNCTION"]
  },
  'verify = "VERIFY" string-expr ( "CODE" [ expr [ "," expr ] ] | "SCREEN$" | "SCREEN" | "DATA" [ identifier [ "(" ")" ] ] ) ;': {
    accept: ['VERIFY "x" CODE', 'VERIFY "d" DATA a()', 'VERIFY "s" SCREEN$'],
    reject: ['VERIFY "x" CODE ,', 'VERIFY "x" PRINT']
  },
  'while = "WHILE" expr SEP block ( "END" "WHILE" | "WEND" ) ;': {
    accept: ["WHILE a: WEND", "WHILE a\n a = a - 1\nEND WHILE"],
    reject: ["WHILE a\nPRINT", "WHILE: WEND"]
  },
  '"ABS" "(" expr ")"': { accept: ["x = ABS(-1)"], reject: ["x = ABS 1", "x = ABS()"] },
  '"ACS" "(" expr ")"': { accept: ["x = ACS(0.5)"], reject: ["x = ACS 1"] },
  '"ASN" "(" expr ")"': { accept: ["x = ASN(0.5)"], reject: ["x = ASN 1"] },
  '"ATN" "(" expr ")"': { accept: ["x = ATN(1)"], reject: ["x = ATN 1"] },
  '"CAST" "(" type "," expr ")"': { accept: ["x = CAST(UBYTE, 300)"], reject: ["x = CAST(1, 2)", "x = CAST UBYTE, 1"] },
  '( "CHR" | "CHR$" ) "(" expr { "," expr } ")"': { accept: ["x$ = CHR$(65, 66)", "x$ = CHR(1)"], reject: ["x$ = CHR 65", "x$ = CHR()"] },
  '"CODE" "(" string-expr ")"': { accept: ['x = CODE("a")'], reject: ['x = CODE "a"'] },
  '"COS" "(" expr ")"': { accept: ["x = COS(PI)"], reject: ["x = COS PI"] },
  '"EXP" "(" expr ")"': { accept: ["x = EXP(1)"], reject: ["x = EXP 1"] },
  '"IN" expr': { accept: ["x = IN 254"], reject: ["x = IN"] },
  '"IN" "(" expr ")"': { accept: ["x = IN(254)"], reject: ["x = IN(254"] },
  '"INKEY"': { accept: ["x$ = INKEY"], reject: ["x$ = INKEY 1"] },
  '"INKEY$"': { accept: ['IF INKEY$ = "" THEN PRINT'], reject: ["x$ = INKEY$ 1"] },
  '"INT" "(" expr ")"': { accept: ["x = INT(1.5)"], reject: ["x = INT 1.5"] },
  '"LBOUND" "(" array-identifier [ "," expr ] ")"': { accept: ["x = LBOUND(a, 1)", "x = LBOUND(a)"], reject: ["x = LBOUND(1)", "x = LBOUND()"] },
  '"LEN" "(" string-expr ")"': { accept: ['x = LEN("abc")'], reject: ["x = LEN a$"] },
  '"LN" "(" expr ")"': { accept: ["x = LN(2)"], reject: ["x = LN 2"] },
  '"PEEK" expr': { accept: ["x = PEEK 23672"], reject: ["x = PEEK"] },
  '"PEEK" "(" expr ")"': { accept: ["x = PEEK(23672)"], reject: ["x = PEEK(1"] },
  '"PEEK" "(" type "," expr ")"': { accept: ["x = PEEK(UINTEGER, 23672)"], reject: ["x = PEEK(UINTEGER 1)"] },
  '"PI"': { accept: ["x = PI"], reject: ["x = PI(1)"] },
  '"RND"': { accept: ["x = RND"], reject: ["x = RND 1"] },
  '"RND" "(" ")"': { accept: ["x = RND()"], reject: ["x = RND(1)"] },
  '"SGN" "(" expr ")"': { accept: ["x = SGN(-3)"], reject: ["x = SGN 3"] },
  '"SIN" "(" expr ")"': { accept: ["x = SIN(0)"], reject: ["x = SIN 0"] },
  '"SIZEOF" "(" ( type | identifier ) ")"': { accept: ["x = SIZEOF(LONG)", "x = SIZEOF(v)"], reject: ["x = SIZEOF(1)", "x = SIZEOF LONG"] },
  '"SQR" "(" expr ")"': { accept: ["x = SQR(4)"], reject: ["x = SQR 4"] },
  '( "STR" | "STR$" ) "(" expr ")"': { accept: ["x$ = STR$(1)", "x$ = STR(2)"], reject: ["x$ = STR$ 1"] },
  '"TAN" "(" expr ")"': { accept: ["x = TAN(1)"], reject: ["x = TAN 1"] },
  '"UBOUND" "(" array-identifier [ "," expr ] ")"': { accept: ["x = UBOUND(a, 2)"], reject: ["x = UBOUND(a,)"] },
  '"USR" expr': { accept: ["x = USR 32768", "x = USR @routine"], reject: ["x = USR"] },
  '"USR" string-expr': { accept: ['x = USR "a"'], reject: ["x = USR ,"] },
  '"VAL" "(" string-expr ")"': { accept: ['x = VAL("1.5")'], reject: ['x = VAL "1"'] },
  'codebank-block = "CODEBANK" const-expr NL { routine-def | dim-stmt | asm-block | label-decl } "END" "CODEBANK" ;   (* not allowed inside a SUB/FUNCTION *)': {
    accept: ["CODEBANK 1\nSUB s\nEND SUB\nDIM buf(10) AS UBYTE\nASM\n nop\nEND ASM\nhere:\nEND CODEBANK"],
    reject: ["CODEBANK 1\nPRINT 1\nEND CODEBANK", "SUB s\nCODEBANK 1\nEND CODEBANK\nEND SUB", "CODEBANK 1\nSUB s\nEND SUB"]
  },
  'codebank-pragma = "#pragma" "codebank" "=" const-expr ;   (* bank 0 = resident; reset with #pragma codebank = 0 after an #include *)': {
    accept: ["#pragma codebank = 2", "#pragma codebank = 0"],
    reject: ["#pragma codebank =", "#pragma codebank = x"]
  },
  'farptr = "FARPTR" identifier ;   (* ULong: bank in bits 16..23, address in bits 0..15; for an array, the data address *)': {
    accept: ["x = FARPTR buf"],
    reject: ["x = FARPTR 1"]
  },
  'asm-pseudo-op = "CODEBANK" const-expr ;   (* inside ASM: switch the bank of following asm lines *)': {
    accept: ["ASM\n CODEBANK 2\n nop\nEND ASM"],
    reject: ["ASM\n CODEBANK\nEND ASM"]
  },
  'slice = str-designator "(" [ expr ] "TO" [ expr ] ")" ;   (* substring, inclusive bounds *)': {
    accept: ["x$ = a$(1 TO 2)", "x$ = a$(TO 2)", "x$ = a$(2 TO)"],
    reject: ["x$ = a$(1 TO 2"]
  },
  'slice = str-designator "(" expr ")" ;                       (* single character *)': { accept: ["x$ = a$(1)"], reject: ["x$ = a$(1"] },
  'str-designator = identifier | string-literal | "(" string-expr ")" | array-element | function-call ;': {
    accept: ['x$ = "abc"(1)', "x$ = (a$)(1)", "x$ = f$(1)(0)", "x$ = s$(1, 2)(0 TO 1)"],
    reject: ["x$ = (a$(1)"]
  },
  'call = identifier | identifier "(" [ args ] ")" | identifier args ;   (* statement: SUB or FUNCTION call; the parenthesis-less form allows e.g. test x := 1 *)': {
    accept: ["s", "s()", "s(1)", "s 1, 2", "test x := 1"],
    reject: ["s(1", "s 1,"]
  },
  'args = arg { "," arg } ;': { accept: ["s 1, x := 2"], reject: ["s 1, , 2"] },
  'arg = expr | identifier ":=" expr | array-identifier ;': { accept: ["s a, x := 1, arr"], reject: ["s x :="] },
  'primary = number | string-literal | "PI" | identifier | identifier "(" [ args ] ")" | identifier expr | slice | "(" expr ")" | "@" address-designator | builtin-call ;': {
    accept: ['x = 1 + "a" + PI + y + f(1) + g 2 + a$(1 TO 2) + (3) + @z + ABS(1)'],
    reject: ["x = )", "x = @1"]
  },
  "program = { line } ;": { accept: ["", "10 PRINT\n20 PRINT"], reject: ["PRINT )"] },
  'line = [ label-decl ] [ statement { ":" statement } ] NL ;': {
    accept: ["start: PRINT 1: PRINT 2", "10", "here:"],
    reject: ["PRINT 1 PRINT 2"]
  },
  'label-decl = line-number | identifier ":" ;': { accept: ["10 PRINT", "here: PRINT"], reject: ["1.5 PRINT"] }
};
