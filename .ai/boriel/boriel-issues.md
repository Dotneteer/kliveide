# Issues to report to Boriel (zxbc 2.0.0-beta25)

Each item was found during Klive's Phase B0. Each has a minimal program, Klive's own, that
reproduces it. The project author decides what to send.

1. **A FASTCALL function with a BASIC body computes the wrong result.**

   ```basic
   FUNCTION FASTCALL Twice(v As UByte) As UByte
       RETURN v * 2
   END FUNCTION
   PRINT Twice(7)
   ```

   It prints `134`, not `14`, at `-O 0`, `-O 1` and `-O 2`, with no warning. The routine is entered
   with the parameter in A (as FASTCALL intends) and IX still the caller's. The body seems to read
   the parameter from a frame slot, the same `ixOffset 5` the `.dbg` lists. If FASTCALL is meant
   only for `ASM` bodies, a diagnostic would help.
2. **The `.dbg` gives FASTCALL parameters a frame location** (`{ at: "frame", ixOffset: 5 }`)
   although the routine has no frame. A debugger reading IX + 5 shows garbage.
3. **`endAddress` crosses routine boundaries.** The last statement of a routine ends at the next
   statement in address order, so it covers its own epilogue and the next routine's prologue.
   Ending at the routine's epilogue start would be exact.
4. **Code with no statement is absorbed by the previous statement in `addressToStatement`:**
   prologues, epilogues, and the run-time allocation of a dynamic `DIM d(k)` (about 360 bytes).
   A `-1` entry for compiler glue, as the format allows, would keep a PC there from mapping to
   another routine's statement.
5. **Column ranges:**
   - an indented assignment starts at column 0 (`    r = n * n`);
   - `PRINT a; b; c` ends after the first item (`PRINT name$; ratio; fx` gives columns 0–11).
6. **Local dynamic arrays:** the frame slot holds a pointer to a heap descriptor (inferred), but the
   `.dbg` entry looks the same as a fixed local array's, apart from the missing `dimensions`.
   An `indirect: true`, or the descriptor shape, would let a debugger read the bounds at run time.
7. **Callable names are not module-qualified** in banked builds (two `RowBits`), and frame
   variables carry a `bank` tag.
8. **`W150 "never used"` is reported for an array that is read**
   (`DIM a(3) As UByte … a(k) = 1 … PRINT "after"; a(0)`). The program itself behaves correctly:
   the out-of-range write raises `3 Subscript wrong` under `--debug-array`.
9. **A FUNCTION call site's `returnAddress` is one byte too high.** In the `calls` fixture, `PRINT Square(4)`'s
   CALL ends at $930C, but the site says $930D: zxbc records the address after the `PUSH HL`/`PUSH AF`
   that follows the CALL. SUB, GOSUB and ON GOSUB sites are right. A debugger matching stack words
   against return addresses never finds the FUNCTION's activation. Klive's adapter moves it back
   when the code image shows a CALL ending one byte earlier (found in Phase B3).
10. **`--debug=FILE` changes the generated code.** A build with it and one without differ (5869 vs
    5867 bytes for one small Next program), so a `.nex` built without the flag next to a `.bin`
    built with it holds other code than the `.dbg` describes. Every breakpoint missed on the Next
    until Klive passed the flag to the `.nex` run too. Debug information should not change the code.
11. **A FUNCTION whose body is only `RETURN expr`** gets a zero-length statement
    (`startAddress == endAddress`), and the previous statement's range covers the routine's prologue.
12. **Diagnostics have no column**, and argument errors go to stderr even with `-e`.
13. **Packaging:**
    - the kits have no LICENSE file;
    - extracting with `tar`/Finder leaves `com.apple.quarantine`, and a quarantined first launch
      blocks a non-interactive caller forever (`kit.md`);
    - the Windows kits carry 34.5 MB of `.pdb` files.
