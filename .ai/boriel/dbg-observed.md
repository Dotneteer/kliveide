# The `.dbg` file and run-time layouts, as observed (zxbc 2.0.0-beta25, re-checked on beta29)

The published format is at <https://zxbasic.readthedocs.io/en/v2.0/debug_format/>. This file records
what the compiler **actually writes**, checked by running the programs on Klive's real 48K harness.
"Verified" means a program run confirmed it; "observed" means it was seen in the output files only.

## What matches the published format (verified)

- Top level: `format: "zx-source-debug"`, `version: 1`, `architecture`, `binaryLength`,
  `binaryChecksum`.
- **`binaryChecksum` is FNV-1a 32 over the code image** (the `-f bin` bytes). It matched on four
  builds. For a `.nex`, the same image is inside the file; for an unbanked program at `$8000` it
  starts at offset 16896. Compare the checksum against what is loaded, not against the output
  file. **The `.nex` holds that image only when it was built with `--debug` too**: the flag changes
  the code (`cli-and-diagnostics.md`). `BorielCompiler` warns (`ZXBC-D`) when the `.nex` does not
  contain the image.
- **`mainBaselineSymbol`** is the address of the runtime word `.core.__CALL_BACK__` in the `-M` map.
  The word holds exactly the SP seen at every top-level statement entry.
- **Stack balance (Klive's G4) held** at `-O 0`, `-O 1` and `-O 2` on three programs: within one
  activation, SP is identical at every statement entry. Two activations of one routine in one
  statement (`Square(4) + Square(5)`) have different baselines, which is legitimate.
- **`returnSlotOffset` = locals + 2** for `"frame"` routines: IX + 2 − SP at statement entries gave
  9 and 8, as the file said. IX frames are the STDCALL shape Klive's locator assumes.
- **Parameters** are at IX + 4 and up, as the file says. A UByte is at IX + 5 (the high byte of a
  pushed word). A `BYREF` parameter's `ixOffset` addresses the **pointer** (`byRef: true`).
- **Call sites** carry the right `returnAddress`, `order` and `moreCallsFollow`
  (`Square(4) + Square(5)` gives `true`, then `false`). They have no `callerIndex` at top level
  (documented). `on-gosub` has no `calleeIndex`.
- **`IF c THEN a ELSE b` on one line** gives three statements: the whole line (the condition code),
  then each branch with its own columns. Good for statement stepping.
- **Line and column convention:** 1-based lines, 0-based end-exclusive columns, as Klive's model.

## What the adapter must correct (observed; most verified)

Items marked **fixed in beta29** no longer show in the pinned kit's output. The adapter keeps their
corrections: they change nothing on beta29 files, and a user may point Klive at an older zxbc.

1. **Statement indexes are not dense.** A statement the optimiser removes (an assignment to a
   variable never read) vanishes, leaving a gap in `index`. The array is also **not sorted**.
   Re-index to positions and remap `callSites[].statementIndex`.
2. **`endAddress` runs into the next routine.** It is the next statement's start in address order,
   so the last statement of a routine spans its epilogue, and often the next routine's prologue.
   Clamp it to the owning frame's `epilogueStart`, or to the next callable's `startAddress`.
   **Fixed in beta29:** a routine's last statement ends exactly at its frame's `epilogueStart`.
3. **Code with no statement maps to the previous statement.** Prologues, epilogues and a dynamic
   `DIM d(k)` (about 360 bytes of run-time code, with no statement record) fall inside the previous
   entry of `addressToStatement`, which can belong to another routine. Insert `-1` (glue) entries at
   every frame's `startAddress` and `epilogueStart`, and after each routine's end.
4. **Indented assignments start at column 0.** `    r = n * n` gives `startColumn 0`. Other
   statement kinds start at their first character. Trim leading blanks when highlighting.
5. **`PRINT a; b; c` ends after the first item.** `PRINT name$; ratio; fx` gives columns 0–11 (just
   `PRINT name$`). Extend the end to the next statement on the same line, or to the line's end (minus
   a trailing comment).
6. **`FOR … NEXT`:** the `FOR` statement spans the whole loop's lines (`18:4–20:10`), but its
   addresses cover only the initialisation. `NEXT` has no statement of its own; the
   increment-and-test code lies inside the last body statement's range. Each iteration re-enters the
   first body statement at its entry address, so a breakpoint there stops every iteration.
7. **GOSUB subroutines** belong to the entrypoint routine (`callableIndex` = main). At their
   statement entries SP = main baseline − 2. Klive's locator treats them as GOSUB activations, keyed
   by the `gosub`/`on-gosub` call sites, as it does for Klive BASIC.
8. **`exitAddresses`** lie somewhere in the epilogue, and once after the `_X__leave` label (`Dyn`:
   exit `38566`, label `38401`). Use `epilogueStart` for stepping decisions.
9. **FASTCALL routines** have `convention: "fastcall"`, `bodyStart == startAddress` and
   `returnSlotOffset: 0`. Their parameters are listed **with a frame location** (`ixOffset 5`), but
   there is no frame. At entry IX is still the caller's, and the parameter is in A (verified:
   `Twice(7)` entered with A = 7, IX = 0). Do not show FASTCALL parameters from IX. See
   `boriel-issues.md`.
10. **Variables omitted:** `CONST`, variables the optimiser found unused (they vanish together with
    their statements), and `DIM … = value` with a static initialiser (no statement, the value is in
    the data). Types observed: `ubyte`, `uinteger`, `long`, `string`, `float`, `fixed`, all names of
    Klive's `SourceValueType`. The others (`byte`, `integer`, `ulong`, `boolean`) were not
    exercised.
11. **`declaredAt`** has `fileIndex` and `line` only.
12. **`files[].filename`** is in the form the compiler was given (absolute if called with an absolute
    path).
13. **A FUNCTION call site's `returnAddress` is one too high** (verified, B3): it points past the
    `PUSH` after the CALL. SUB/GOSUB/ON GOSUB sites are right. The adapter checks each against the
    code image and moves it back when a CALL ends one byte earlier.

14. **A routine's only statement can be zero-length.** `FUNCTION Square(n As UByte) As UInteger` /
    `RETURN n * n` gives the `RETURN` `startAddress == endAddress == bodyStart` (every `-O`, zx48k and
    zxnext), and the previous statement in address order runs over the routine's prologue. The
    start is right (the body's first instruction), so a breakpoint there fires; the adapter gives
    the statement the range up to the epilogue (correction 2) and clamps the other at the routine's
    start. **Fixed in beta29:** the `RETURN` now spans `bodyStart` up to `epilogueStart`.

15. **A modular build gives every statement `callableIndex: 0`** (the main program), module
    routines' statements included (verified, B5). The owner is the routine whose frame range
    (`startAddress` up to the epilogue and exits) holds the statement's address, in the same raw
    partition. Without this, a routine's last statement ran to the next routine.
    **Fixed in beta29:** module routines' statements carry their own `callableIndex`.

All of these corrections live in `src/main/boriel-integration/dbg-adapter.ts`; the fixtures in
`test/boriel/fixtures/` and `test/boriel/dbg-adapter.test.ts` pin each one.

## Banking (observed, `--split-modules`)

- **zx128k:** `partition` = the physical 16K bank number (0, 1, …). The window is `$C000`, 16K.
  Statements in the fixed region carry no `partition`. `addressToStatement` holds only the unbanked
  ones; `partitionedAddressMap` groups the rest.
- **zxnext:** `partition` = the **first 8K page** of the 16K window's bank (32, 34, …). A statement
  at `$E000` tagged 32 is in page 33. Klive's partitions are 8K pages, so use
  `page = partition + ((address − $C000) >> 13)`. `codebank.banks[].id` lists the same even page
  numbers (16 of them). The `.nex` carries the corresponding 16K banks (16, 17 for pages 32–35).
- **`frames[]` have no `partition`.** Take it from the callable.
- **Frame variables carry `bank`.** It is meaningless for a stack location; ignore it unless the
  location is `absolute`.
- **Callable names are not module-qualified.** Two modules' `RowBits` both appear as `RowBits`
  (in different banks). Qualify them with the file name for display.
- `codebank` has `window`, `defaultPage`, `banks`, `callFar` and, on the Next, `jpFar`, as
  documented. There is no shadow stack.
- The `-M` map prefixes every label with its physical bank (`00::C000:`, `04::8000:` on the
  Next), as the docs say. Unbanked builds have no prefix.

## Where a banked program is (verified, B5)

- zxbc refuses `-f bin` with `--split-modules`; the program comes from a `-f z80 -B -a` snapshot
  (128K) or the `.nex` (Next), both as 16K banks.
- The resident part runs from the origin to `$C000` (bank 2 for `$8000`); each module bank starts
  at the window's first byte. `binaryLength`/`binaryChecksum` cover the resident part, then the
  banks in ascending order, each without its unused tail. No file states the parts' lengths.
- The 128K snapshot leaves `$7FFD` = `$10`: ROM 1, bank 0 at `$C000`, paging **unlocked**. A
  banked program must start from 128 BASIC; 48 BASIC latches the lock.
- **zxbc's own banked tape** (`-f tap -B -a`) loads through the 128K's Tape Loader and runs (verified
  in the app). Klive's 128K tape loader, given the same banks, loads them and the program then
  crashes into 48 BASIC; so Klive exports zxbc's tape for a banked 128K build.

## Far calls (verified on the 128K and Next cores, B5)

The plan assumed no shadow stack; there is one.

- A far call site runs the `callFar` template inline: `EXX; LD C,page; LD DE,target; CALL helper`.
  The helper's address is the template's last two bytes.
- The helper (`LD HL,ret` at helper + 4) **replaces the return slot** with its own return path
  `ret`, then switches SP to the page stack and pushes `AF` (A = the caller's paging: `BANKM` on
  the 128K, the page in MMU slot 6 on the Next) and then the caller's real return address. It
  pages the target in and `RET`s into it.
- `core.PAGE_STACK` is the word holding the page stack's pointer, and also the area's end: the
  pointer starts there and records are pushed downwards (area from `core.PAGE_STACK_BOTTOM`, 256
  bytes). Records = (`PAGE_STACK` − pointer) / 4; the oldest is at `PAGE_STACK − 4`: return word,
  then F, then A.
- The return path pops the record before it restores the paging. Paused inside the helper, a slot
  can lack its record (call path) or a record its slot (return path); pairing from the oldest end
  stays right in both.
- zxbc's frames hold byte-sized locals, so IX and return slots can be at **odd** addresses.
- Within one bank a call is a plain `CALL` (in the fixture, `Weigh` → `Mix`).
- Step Into/Over/Out need nothing more than the shadow-stack reader: they work across far calls on
  both machines (verified).
- A routine's frame carries its start's partition. On the Next a routine can cross `$E000` into
  its bank's second page (fixture `banked-edge-next`); the index takes each slot's page from the
  CODEBANK bank table.

## Run-time data layouts (verified on the 48K)

| Type | Layout |
| --- | --- |
| Long | 4 bytes, little-endian |
| Fixed | low word = fraction (1/65536), high word = integer part (`1.5` → `00 80 01 00`) |
| Float | the ROM's 5-byte format (`3.25` → `82 50 00 00 00`) |
| String | the variable holds a pointer (0 = empty); the pointer addresses `[length lo, length hi, characters…]`. **Same with `--cow-strings`** for the cases tried; any reference count is not visible at that address. |
| Global array | a **4-word descriptor** at its address: dimension table, data, lower-bound table (or 0), upper-bound table (or 0). The data follows the descriptor (+8). The dimension table is `[dims − 1 (word)][element counts of dimensions 2…n (words)][element size (byte)]`; `grid(2, 3) As UInteger` → `01 00 04 00 02`. A string array's data are string pointers. |
| Local fixed-size array | a **3-word descriptor in the frame** at `ixOffset`: dimension table (static), data (heap), lower-bound table (or 0). Six bytes; **no upper-bound slot**. |
| Local dynamic array (`DIM d(k)`) | the frame slot at `ixOffset` holds a **pointer to a heap block** rather than the descriptor itself. The block's layout was not determined. `.dbg` omits `dimensions` and does not mark the indirection. |

## Runtime errors (verified on the 48K; observed on the Next)

- `.core.__ERROR` (from the `-M` map) is entered with **the error code in A** on both archs, the same
  convention as Klive BASIC's `errorEntry`.
- **zx48k:** it stores A into the byte after its own `RST 8`, then executes it. The ROM prints the
  report (`3 Subscript wrong`, ERR_NR 2), and Klive's ROM-error path also sees the right code.
- **zxnext:** `LD ($5C3A),A`, then a red border and the panic screen (`__PANIC_*` labels), then a halt.
  A stop at `__ERROR` comes before any of that.
- `.core.__STOP` sets the code without stopping.

## The `-M` memory map

One `HHHH: .name` per line (banked: `BB::HHHH: .name`), sorted by address:

| Label form | Meaning |
| --- | --- |
| `.core.<name>` | runtime and program skeleton: `__START_PROGRAM`, `__CALL_BACK__` (baseline word), `ZXBASIC_MEM_HEAP`, `ZXBASIC_USER_DATA[_END]`, `__MAIN_PROGRAM__`, `__END_PROGRAM`, `__ERROR`, `__ERROR_CODE`, `__STOP`, … |
| `._<name>` | user routines and globals; `._<name>__leave` = a routine's epilogue; `._<arr>.__DATA__`, `._<arr>.__DATA__.__PTR__` for arrays; `._<module>.<name>` inside modules |
| `.LABEL._<line or label>` | **user** line numbers and labels (`.LABEL._1000`), for naming GOSUB rows |
| `.LABEL.__LABEL<n>` | compiler temporaries; not shown to users |

Default layout for `-S 32768` on zx48k: the prologue at `$8000`, the heap (default 4768 bytes) right
after `__CALL_BACK__`, then the globals, then `__MAIN_PROGRAM__`, then routines and the runtime.
