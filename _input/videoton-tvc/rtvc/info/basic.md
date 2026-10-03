# TVC BASIC Reference

User guide for the Videoton TV Computer BASIC language.

## Contents

- [Introduction](#introduction)
- [Program Structure](#program-structure)
- [Constants, Variables, and Operators](#constants-variables-and-operators)
- [Commands](#commands)
- [Statements](#statements)
- [Graphics and Sound](#graphics-and-sound)
- [File I/O](#file-io)
- [System and Machine Code](#system-and-machine-code)
- [Functions](#functions)
- [System Variables](#system-variables)
- [Appendices](#appendices)
  - [Tokenized program format](#tokenized-program-format)

---

## Introduction

TVC BASIC is a dialect of Microsoft BASIC running on the Videoton TV Computer.
This reference covers all commands, statements, functions, and system variables.
It is not a programming tutorial, but a concise reference for users who already
understand the fundamentals of BASIC.

**Peripherals** are identified by number:

| # | Device |
|---|--------|
| 0 | Screen |
| 1 | Keyboard |
| 2 | Editor |
| 3 | Sound generator |
| 4 | Parallel printer |
| 5 | Cassette tape / floppy disk |
| 6 | Expansion card |

Peripherals are specified as `#n` in I/O statements (e.g. `PRINT #4:` for the
printer).

---

## Program Structure

A BASIC program consists of numbered lines:

```
100 REM This is a comment
110 LET A = 5 : PRINT A
```

- Line numbers range from 1 to 9999.
- Multiple statements on one line are separated by `:`.
- A line may be up to 250 characters.
- Comments are introduced with `REM` and must be the last statement on the line.

### Line number conventions

Once a line number is assigned it identifies that line for GOTO, GOSUB, etc.
It is conventional to number lines in increments of 5 or 10 so that lines can
be inserted later.

---

## Constants, Variables, and Operators

### Constants

- **Numeric**: range ±0.1E−63 to ±0.9999999999E+63.
- **String**: text enclosed in `"..."`, up to 254 characters.
  Quotes may be omitted in `DATA` and `INPUT` unless the string contains
  commas, exclamation marks, colons, or leading spaces.

### Variables

- Names may contain letters, digits, `?`, `[`, `\`, `]`, `_`, `.`
  and must start with a letter.
- **Numeric**: no suffix.
- **String**: name ends with `$`.
- Undimensioned string variables hold up to 18 characters; longer strings
  require `DIM`.

### Arrays

Declared with `DIM`. The first element is always index 0.

```basic
DIM A(10)       ' numeric array with 11 elements (0-10)
DIM N$(5)*30    ' string array, 6 elements of up to 30 chars each
```

### Operators and precedence

| Level | Operators | Notes |
|-------|-----------|-------|
| 1 (highest) | `( )` | Parentheses |
| 2 | `^` | Exponentiation |
| 3 | `*`, `/` | Multiplication, division |
| 4 | `+`, `-` | Addition, subtraction |
| 5 | `=`, `<>`, `<`, `<=`, `>`, `>=` | Relational |
| 6 | `NOT` | Bitwise NOT |
| 7 | `AND` | Bitwise AND |
| 8 (lowest) | `OR`, `XOR` | Bitwise OR, exclusive OR |

Operators at the same level evaluate left to right.

---

## Commands

Commands are entered without a line number and execute immediately.

### NEW

```
NEW
```

Delete the current program from memory and turn off TRACE.

### RUN

```
RUN [line-number]
```

Start execution. Without a line number execution begins at the lowest-numbered
line. Clears all variables and function definitions.

### LIST

```
LIST [segments] | LIST [#periph:] [segments]
```

List the program (or specified line segments) to the screen or a peripheral.

`segments` examples: `50`, `100-200`, `50, 100-200, 600-`.

Pause listing with CTRL-P; resume with any key.

### LLIST

```
LLIST [segments] | LLIST [#periph:] [segments]
```

Same as LIST but output defaults to the printer.

### DELETE

```
DELETE segments
```

Delete line(s) from the program. Interrupt with CTRL-ESC.

Examples:
```
DELETE 100        ' delete line 100
DELETE 100-200    ' delete lines 100 through 200
DELETE 100-200,540,600-  ' delete ranges and individual lines
```

### TRACE

```
TRACE [#periph:] ON | TRACE [#periph:] OFF
```

Enable or disable line-number tracing. When ON the line number of every
executed line is printed to the specified peripheral (screen by default).

### CONTINUE

```
CONTINUE
```

Resume execution after a `STOP` or CTRL-ESC break. Not usable after
syntax/runtime errors, program modifications, `END`, or `DELETE`.

---

## Statements

### LET

```
LET variable = expression
```

Assign a value to a variable, array element, or substring. The `LET` keyword
is optional. Multiple assignments (e.g. `A = B = C = 2`) are not allowed.

Examples:
```basic
10 LET A = 625 : LET B = A/5
20 LET KUTYA$ = "PULI"
50 LET ADATTÖMB(2,1) = 3
60 LET NEVEK$(0:0) = "KISS"
```

Substring assignment uses `LET A$(m:n) = "text"` where `m` and `n` are the
start and end positions (1-based). An empty string (`""`) deletes the range.

### CLS

```
CLS
```

Clear the screen and home the cursor. The background colour is determined by
the current `SET PAPER` setting.

### PRINT

```
PRINT [parameters:] [item [[,|;|TAB(n)] item]...]
```

Parameters are comma-separated and must be followed by `:` before any printed
items:

```
#n
AT row, col
USING format$
```

Examples:

```
PRINT "hello"
PRINT AT 10,5: "hello"
PRINT AT 1,1: A; TAB(10); B
PRINT AT 1,64: "X";
PRINT USING "###.###": 1
PRINT #4: A,B,C$
PRINT #0, AT 24,1, USING "##": N
```

- `AT row, col` — set the cursor. Rows are 1–24. Columns are 1-based and
  depend on `GRAPHICS`: 64 in 2-colour, 32 in 4-colour, 16 in 16-colour mode.
  `AT` and `TAB` work with devices 0, 2, and 6. `PRINT AT 1,1` is the top-left
  character.
- `USING format$` — formatted output (see below).
- `,` (comma) in the item list — next tab stop (every 8 columns).
- `;` (semicolon) — no gap between items.
- `TAB(n)` — next item at column `n`.
- A trailing `,` or `;` suppresses the PRINT statement's own CR/LF (`0DH`/`0AH`).
  It does not stop the editor wrapping after the last column: writing that cell
  still advances to the next row and, if the next editor line is non-empty,
  inserts a blank line. There is no PRINT syntax to disable that wrap. A
  firmware workaround is to raise the editor width byte at `0E6BH` (3691) by
  one for the last-column write, then restore it (`POKE 3691,65` / `POKE 3691,64`
  in GRAPHICS 2). `PRINT #0` uses the video device instead and will not insert
  an editor line, but still CR/LFs the graphics pen after the last column.
- `PRINT` with no arguments moves to the next line.

**PRINT USING format characters:**

| Format | Effect |
|--------|--------|
| `#` | Digit placeholder |
| `.` | Decimal point |
| `^^^^` | Scientific notation |
| `$` | Dollar sign |
| `+` | Force sign |
| `-` | Trailing minus for negatives |
| `*` | Leading fill with `*` |
| `%` | Leading fill with `0` |
| `<` | Left-justify string |
| `>` | Right-justify string |

### LPRINT

```
LPRINT [AT row, col] [, USING format$]: [item [[,|;|TAB(n)] item]...]
```

Same as `PRINT` but output defaults to the printer (same as `PRINT #4:`).
`AT` and `USING` still take a colon before the item list.

### INPUT

```
INPUT [PROMPT "text":] variable [, variable...]
INPUT #periph: variable [, variable...]
```

Read data from the keyboard (default) or an open file. The `PROMPT` keyword
displays a prompt string. Input is terminated by RETURN.

- Numeric variables expect digits, `+`, `-`, `.`, `E`.
- String variables accept characters 32–223; quotes are needed only if
  the string contains leading spaces, `!`, or `,`.
- Invalid input sets numeric variables to 0 and string variables to `""`.
- If more variables are listed than data items, the extras are set to 0 or `""`.
- Interrupt with CTRL-ESC; resume with `CONTINUE`.

### INKEY$

```
A$ = INKEY$
```

Return the next available keyboard character as a single-character string, or
`""` if none is pending. Unlike `INPUT`, this function does not wait, does
not echo, and returns all character codes (0–255).

### GET

```
GET [#periph:] string-variable
```

Read a single character from the keyboard (default) or an open file. Returns
`""` at end of file.

### REM

```
REM comment text
```

Insert a comment in the program. Ignored during execution.

### IF — THEN — ELSE

```
IF condition THEN statement(s) | line-number [ELSE statement(s) | line-number]
```

If the condition is true (non-zero), execute the THEN branch; otherwise
execute the ELSE branch (if present) or continue on the next line.

Only the first `ELSE` on a line is recognised — nested IF/THEN/ELSE on one
line is not supported.

### FOR — NEXT

```
FOR variable = start TO end [STEP increment]
...
NEXT [variable [, variable...]]
```

Execute the loop body for each value of the control variable from `start` to
`end` stepping by `increment` (which defaults to +1). The loop runs at least
once. Loops may be nested. One `NEXT` can close multiple nested loops:

```
NEXT J, I   ' closes inner J loop then outer I loop
```

### DATA

```
DATA constant [, constant...]
```

Store numeric or string constants in the program for later reading with
`READ`. Strings need quotes only if they contain `,`, `!`, `:`, or leading
spaces. Multiple `DATA` statements form a logical chain.

### READ

```
READ variable [, variable...]
```

Read the next value from the `DATA` chain into the variable(s). The type of
the variable must match the constant. If all data has been consumed a
`*** No DATA` error is raised.

### RESTORE

```
RESTORE [line-number]
```

Reset the DATA pointer to the beginning of the program (or to the specified
line), allowing data to be re-read.

### STOP

```
STOP
```

Halt execution and return to command mode. May be resumed with `CONTINUE`.

### END

```
END
```

Mark the logical end of the program. If the physical end of the program is
the same as the logical end, `END` is optional.

### DIM

```
DIM variable(dim1 [, dim2...]) [, variable(dim2...)]...
DIM string-variable(dim1...) * max-length
```

Allocate memory for arrays. All elements are initialised to 0 (numeric) or
`""` (string). Redimensioning an existing array raises
`*** Variable declared twice`.

The optional `* max-length` sets the maximum string length for a string array
(default 18). A numeric array may have any number of dimensions (limited by
the 250-character line length).

### GOTO

```
GOTO line-number
```

Unconditional jump to the specified line. Use sparingly — prefer GOSUB for
reusable code and keep programs readable.

### GOSUB — RETURN

```
GOSUB line-number
...
RETURN
```

Call a subroutine starting at `line-number`. `RETURN` resumes execution at the
statement following the `GOSUB`. Subroutines may be nested (including
recursion, provided the chain terminates). `RETURN` without a prior `GOSUB`
causes an error.

### ON — GOTO / ON — GOSUB

```
ON expression GOTO line1 [, line2...] [ELSE stmt | line]
ON expression GOSUB line1 [, line2...] [ELSE stmt | line]
```

Evaluate `expression` and jump to the Nth line in the list (1-based). If the
value is 0 or exceeds the list size, the `ELSE` branch executes; if no `ELSE`
is present, execution continues on the next line.

---

## Graphics and Sound

### GRAPHICS

```
GRAPHICS mode
```

Select a graphics mode. `mode` is the number of colours (2, 4, or 16).

| Mode | Characters/row | Graphics pixels/row | Pixels/column |
|------|----------------|---------------------|---------------|
| 2 (2-colour) | 64 | 512 | 240 |
| 4 (4-colour) | 32 | 256 | 240 |
| 16 (16-colour) | 16 | 128 | 240 |

The default is 4-colour. The screen has 24 rows. Colours appear on a colour
TV or monitor; otherwise they show as grey-scale. Setting a new mode resets
colours and clears the screen.

### PLOT

```
PLOT x, y [; x, y...] [, PAINT]
```

Draw graphics using logical coordinates (960 x 1024). The system converts
these to physical pixels based on the current GRAPHICS mode.

- `,` (comma) — pen up (move without drawing)
- `;` (semicolon) — pen down (draw a line)
- `PAINT` — fill a closed shape with the current INK colour

Corner coordinates: (0,0) bottom-left, (1023,959) top-right.

### SET

```
SET parameter [, value...]
```

Configure colours, line styles, character definitions, and keyboard timing.

**SET PALETTE** — Select colours from the palette (2- and 4-colour modes).
```
SET PALETTE palcode0, palcode1 [, palcode2, palcode3]
```

**SET INK colour-number** — Set the drawing (pen) colour.
**SET PAPER colour-number** — Set the background colour.
**SET BORDER palette-code** — Set the screen border colour (works in all modes).
**SET STYLE style-number** — Select a line type for PLOT.
**SET MODE mode-number** — Set pixel overwrite mode (0=overwrite, 1=OR, 2=AND, 3=XOR).
**SET CHARACTER ascii-code, row0, row1, ... row9** — Define a user character
as 10 rows of 8-bit dot patterns (given as decimal byte values).
**SET RATE time-constant** — Set auto-repeat rate (time-constant/50 seconds).
**SET DELAY time-constant** — Set delay before auto-repeat starts
(time-constant/50 seconds).

### SOUND

```
SOUND [;] [PITCH p] [VOLUME v] [DURATION d] ...
```

Generate a sound. `;` waits for the previous sound to finish before starting.
Parameters can be repeated to play multiple notes.

- `PITCH`: 0–4094 (97656 Hz down to ~48 Hz), 4095 = silence.
  Frequency = 195312.5 / (4096 * pitch). Middle C (~261 Hz) = pitch 3349.
- `VOLUME`: 0 (silence) to 15 (maximum). Default: 8.
- `DURATION`: 0–255 (each unit = 1/50 second). Default: 100 (2 seconds).

If a parameter is omitted the previous note's value is reused.

---

## File I/O

### OPEN

```
OPEN "filename"
OPEN INPUT "filename"
OPEN OUTPUT "filename"
OPEN #periph: [INPUT | OUTPUT] "filename"
```

Open a file for reading (`INPUT`, default) or writing (`OUTPUT`). The default
device is #5 (cassette/floppy). On the floppy system, drive and path notation
is supported (see [vt-dos.md](vt-dos.md)).

### CLOSE

```
CLOSE [INPUT | OUTPUT] | CLOSE #periph: [INPUT | OUTPUT]
```

Close a previously opened file.

### LOAD

```
LOAD ["filename"] | LOAD #periph: "filename"
```

Load a program from cassette, disk, or expansion card into memory. The
current program and symbol table are cleared. If no filename is given the
first program found is loaded.

### SAVE

```
SAVE "filename" | SAVE #periph: "filename"
```

Save the current program to cassette, disk, or an expansion device in binary
internal format.

### VERIFY

```
VERIFY ["filename"] | VERIFY #periph: "filename"
```

Compare the program in memory against a saved file to verify a correct save.

---

## System and Machine Code

### EXT

```
EXT sub-number [, HL-value, DE-value, BC-value]
```

Call a user-defined machine-code subroutine. `sub-number` is 0–6, selecting
an entry in the USRTAB table. HL, DE, BC values are passed to the CPU
registers. The subroutine must end with `RET`.

### LOMEM

```
LOMEM address
```

Move the start of BASIC program space to `address`, freeing memory below for
machine-code routines. All variables are cleared. Standard start address is
stored in system variable VLOMEM (address 5920). NEW and LOAD reset to the
standard start, but changing VLOMEM with POKE protects routines across LOAD.

### OUT

```
OUT port, value
```

Write one byte to a hardware I/O port. Requires knowledge of the system's
port map. Use with care — incorrect values can crash the system.

### POKE

```
POKE address, value
```

Write one byte to a memory address. If the address falls in the BASIC ROM
region, the video RAM is selected instead. Used for modifying system variables
or placing machine code.

### USR

```
result = USR(address [, param])
```

Call a machine-code subroutine at `address`. `param` is placed in HL before
the call. The result is the final value of HL interpreted as a signed integer.

---

## Functions

All functions are listed with their syntax. `X` denotes a numeric expression,
`X$` a string expression.

### Numeric functions

| Function | Returns |
|----------|---------|
| `ABS(X)` | Absolute value of X |
| `ATN(X)` | Arctangent of X (radians) |
| `COS(X)` | Cosine of X (radians) |
| `EXP(X)` | e^X |
| `FREE` | Free RAM bytes available |
| `IN(port)` | Byte read from I/O port |
| `INT(X)` | Greatest integer ≤ X |
| `LOG(X)` | Natural logarithm of X (X > 0) |
| `ORD(X$)` | ASCII code of first character of X$ |
| `PEEK(address)` | Byte read from memory address (ROM addresses read video RAM) |
| `PI` | Constant π (3.141592654) |
| `RND` | Random number in [0, 1) |
| `RND(X)` | Random integer in [0, X−1] |
| `SIN(X)` | Sine of X (radians) |
| `SGN(X)` | Sign of X (−1, 0, or +1) |
| `SQR(X)` | Square root of X (X ≥ 0) |
| `TAN(X)` | Tangent of X (radians) |
| `VAL(X$)` | Numeric value parsed from X$ |
| `VARPTR(variable)` | Memory address of the variable |
| `VERNUM` | BASIC interpreter version number |

### String functions

| Function | Returns |
|----------|---------|
| `CHR$(X)` | Single-character string for ASCII code X (0–255) |
| `LEN(X$)` | Number of characters in X$ |
| `STR$(X)` | String representation of a number |
| `STRING$(n, X)` | String of `n` copies of character CHR$(X) |
| `STRING$(n, X$)` | String of `n` copies of the first character of X$ |

### RANDOMIZE

```
RANDOMIZE
```

Seed the random number generator with an unpredictable value. Call once
before using `RND` to get different sequences on each run.

---

## System Variables

System variables are accessible via `PEEK` and `POKE`. Key addresses:

| Name | Address | Bytes | Description |
|------|---------|-------|-------------|
| USRTAB | 33 (21H) | 14 | EXT subroutine address table (7 entries x 2 bytes) |
| STOPFL | 2838 (B16H) | 1 | ≠0 if CTRL-ESC pressed |
| HIMEM | 2841 (B19H) | 2 | Highest RAM address |
| P3RAM | 2843 (B1BH) | 1 | 0 = RAM bank 3 OK; FF = fault |
| INTINC | 2845 (B1DH) | 2 | Counter incremented every 20 ms |
| COLD FLAG | 2850 (B22H) | 1 | 0 = warm reset allowed; FF = disabled |
| MODE | 2891 (B4BH) | 1 | Pixel overwrite mode (0–3) |
| STYLE | 2892 (B4CH) | 1 | Line style for PLOT |
| INK | 2893 (B4DH) | 1 | Current ink colour number |
| PAPER | 2894 (B4EH) | 1 | Current paper colour number |
| BORDER | 2895 (B4FH) | 1 | Current border colour palette code |
| VFLAG | 2896 (B50H) | 1 | Character overwrite flag |
| PICTURE | 2897 (B51H) | 10 | Last keyboard character matrix |
| DELAYKEY | 2917 (B65H) | 1 | Auto-repeat delay |
| LOCK KEY | 2918 (B66H) | 1 | CTRL/SHIFT/ALT lock state |
| RATEKEY | 2919 (B67H) | 1 | Auto-repeat rate |
| HOLD DIS | 2920 (B68H) | 1 | 0 = HOLD enabled; FF = disabled |
| EOF | 2926 (B6EH) | 1 | ≠0 = end of file reached |
| AUTO | 5895 (1707H) | 1 | 255 = auto-run program after LOAD |
| TYPE | 5896 (1708H) | 1 | Type of current symbol table entry |
| START | 5900 (170CH) | 2 | Current BASIC line start address |
| VLOMEM | 5920 (1720H) | 2 | BASIC program area start address |
| TEXT | 5922 (1722H) | 2 | BASIC program start address |
| CHAIN | 5924 (1724H) | 2 | Address of last symbol table entry |
| TOP | 5926 (1726H) | 2 | Next free byte in symbol table |
| COMMAND | 5938 (1732H) | 255 | Current BASIC line buffer |
| BUFFER | 6193 (1831H) | 255 | Keyboard input buffer |
| FILENAME | 6606 (19CEH) | 17 | Filename buffer (1 byte length + 16 name) |
| PROGRAM | 6639 (19EFH) |  | Predefined program start |

---

## Appendices

### Tokenized program format

TVC BASIC stores a program as a sequence of length-prefixed lines at
[PROGRAM](#system-variables) (`19EFH`). Each line is:

```text
length    1 byte   size of this line, including the length byte and the FFH terminator
line      2 bytes  line number, little-endian
tokens    n bytes  tokenized statement text
FFH       1 byte   end of line
```

A `00H` length byte ends the program. Keywords and operators are single-byte
tokens from the BASIC 1.2 keyword table at SYS `DE6DH`, searched from token
`FEH` downward so a longer word such as `OUTPUT` matches before `OUT`. Letters
outside strings and `REM`/`!`/`DATA` tails are stored in uppercase. Spaces, string
literals, and the remainder of a `REM`, `!`, or `DATA` statement are stored as
characters. An unquoted colon ends a `DATA` statement and resumes tokenization;
`REM` and `!` preserve the rest of the line literally. Functions that are not keywords, including `USR`, `SIN`, and
`CHR$`, remain ASCII identifiers.

`rtvc-basic` compiles numbered source into this payload and wraps it in a CAS
container. Programs exceeding 42,256 bytes (including the final `00H`) are rejected.
This is the BASIC 1.2 ceiling for an unreserved 64K TVC: `BFFFH` HIMEM minus
`19EFH` program start minus the `0100H` gap required by the ROM memory check
at `FC8EH`. An empty program already contains a one-byte `00H` terminator,
so the startup screen reports **42,255 bytes free**.
Program bytes, variables, arrays, and the BASIC stack share RAM;
fitting this ceiling does not guarantee enough space to execute. A smaller
machine, DOS or other reservations lowering HIMEM, or a higher LOMEM reduces
the available space further; the compiler assumes the standard 64K layout.
Default headers match BASIC `SAVE` (file type `01H`, autostart
`00H`). `rtvc-tocas` writes the same CAS image beside the source:

```bash
cargo run --bin rtvc-basic -- coding/crtc-register-explorer.bas -o target/coding/crtc-register-explorer.cas
cargo run --bin rtvc-tocas -- coding/crtc-register-explorer.bas
```

Pass `--auto` to set the CAS autostart byte, or `--format bin` to write the
raw program bytes without a header. See
[rtvc.md](rtvc.md#command-line-basic-compiler) for command-line options.

### Colour numbers and palette codes

| Colour number | Palette code | Colour |
|:---:|:---:|---|
| 0 | 0 | Black |
| 1 | 1 | Dark blue |
| 2 | 4 | Dark red |
| 3 | 5 | Dark purple |
| 4 | 16 | Dark green |
| 5 | 17 | Dark cyan |
| 6 | 20 | Dark yellow |
| 7 | 21 | Grey |
| 8 | 64 | Black (bright) |
| 9 | 65 | Blue |
| 10 | 68 | Red |
| 11 | 69 | Purple |
| 12 | 80 | Green |
| 13 | 81 | Cyan |
| 14 | 84 | Yellow |
| 15 | 85 | White |

Palette code bits: bit 7 = intensity, bit 4 = green, bit 2 = red, bit 0 = blue.

### Line styles

| STYLE | Pattern |
|:---:|---|
| 1 | Solid |
| 2–15 | Various dashed/dotted patterns |

### Sample program: quadratic equation solver

```basic
100 INPUT PROMPT "Coefficients: ":a,b,c
110 d = b^2 - 4*a*c
120 IF d < 0 THEN PRINT "No real roots" : GOTO 100
130 ds = SQR(d)
140 x1 = (-b + ds) / (2*a)
150 x2 = (-b - ds) / (2*a)
160 PRINT x1, x2
```

### Sample program: sine wave plot

```basic
10 GRAPHICS 4
20 SET PAPER 0 : SET BORDER 4 : SET INK 3
30 PLOT 0,120 ; 255,120
40 PLOT 19,239 ; 19,0
50 SET INK 1
60 FOR I = 0 TO 2*PI STEP 0.02
70   PLOT 19+(30+I),120+(120+SIN(I));
80 NEXT I
```

### Derived mathematical functions

| Function | BASIC expression |
|----------|-----------------|
| Secant | `1 / COS(X)` |
| Cosecant | `1 / SIN(X)` |
| Cotangent | `1 / TAN(X)` |
| Arc sine | `ATN(X / SQR(1 - X*X))` |
| Arc cosine | `ATN(SQR(1 - X*X) / X)` |
| Hyperbolic sine | `(EXP(X) - EXP(-X)) / 2` |
| Hyperbolic cosine | `(EXP(X) + EXP(-X)) / 2` |
| Hyperbolic tangent | `(EXP(X) - EXP(-X)) / (EXP(X) + EXP(-X))` |
| Base-10 logarithm | `LOG(X) / LOG(10)` |
| N-th power | `EXP(N * LOG(X))` |
