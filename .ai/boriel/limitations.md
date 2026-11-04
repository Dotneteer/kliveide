# What Boriel BASIC cannot do that Klive BASIC could

Compared from the published v2.0 debug format and zxbc's command line (2026-10-17), and kept current
since. Items marked **(adapter)** are filled in by Klive and are not real losses; every other item is
a loss, with the reason it comes from the format or the compiler. The project author accepted these
losses on 2026-11-04: Klive does not require Boriel BASIC to do what Klive BASIC did. How the adapter
works is `integration.md`; the defects behind several items are in `boriel-issues.md`.

## Stepping and statements

1. **No statement kinds.** `kind` is always `"normal"`. Klive BASIC gives the separately executing
   parts of block statements their own ids (the `IF`/`ELSEIF`/`WHILE`/`LOOP UNTIL` condition, `FOR`
   initialisation, the `NEXT` increment and test, `END SUB`/`END FUNCTION`). With Boriel, stepping
   through loops and conditionals stops wherever zxbc put a statement boundary.
2. **No `elided` flag and no split-statement `ranges`.** Klive marks a statement the optimiser
   removed, so the debugger skips it and the Variables panel explains the unchanged value, and it
   lists every address run of a statement split by optimisation. Boriel has only
   `startAddress`/`endAddress`. A statement the optimiser removes vanishes (an index gap), and a
   breakpoint on its line resolves to the next statement with code. Run-length features (coverage, a
   per-statement heat map) are approximate.
3. **No documented stepping guarantees** (G1/G2: one entry per statement that no branch targets; G4:
   SP constant at statement entries; G5: every user call a recorded call site). Klive BASIC's code
   generator guarantees them and its validator checks every build. On B0's probes G4 and G5 held at
   `-O 0`, `1` and `2`; G1/G2 were not tested directly. Step Over/Out are only as right as zxbc's code
   happens to be; a build that fails the validator gets one warning and steps as usual.

## Calls, frames and banking

4. **Cross-bank calls (`--split-modules`).** There is no `"far"` call-site kind. **(adapter)** Klive
   decodes zxbc's far-call helper and reads its shadow stack, so the call stack walks through bank
   switches on the 128K and the Next, and stepping works across far calls. **CODEBANK is Klive BASIC
   syntax**: such programs do not compile under Boriel, which uses `MODULE`/`USE` with
   `--split-modules` instead.
5. **`callTargets` is always `[]`.** No loss: Klive uses `callSites` for the same information.
6. **Top-level call sites have no `callerIndex`.** **(adapter)** It is the entrypoint routine.
7. **FASTCALL routines** have no IX frame; Klive's locator has a `fastcall` path. Their parameters
   are listed with a wrong frame location (`ixOffset 5`; the value is in A at entry), so the
   Variables panel does not show them. A BASIC-bodied FASTCALL function also computes a wrong result
   in zxbc itself (`boriel-issues.md` #1).
8. **A frame's `endAddress` is approximate.** Several routines can share an epilogue, and the
   entrypoint has none. This affects the profiler's routine attribution near routine ends.

## Variables

9. **No CONST entries.** Klive BASIC lists constants with their values; Boriel lists none.
10. **No bounds or elements for DYNAMIC arrays.** `dimensions` is omitted, and the frame slot points
    to a heap block whose shape is undocumented. The panel shows the array's address only. Fixed-size
    global and local arrays work.
11. **No declaration column.** `declaredAt` has only file and line, so "declared at" goes to the line.
12. **`type` may be missing.** Such entries show as raw bytes; there is no type-driven editing.

## Runtime, errors and symbols

13. **No `errorEntry`.** **(adapter)** It is the map's `__ERROR`, with the code in A, so runtime-error
    stops work on every machine. After the stop, on the Next, continuing shows Boriel's panic screen
    and halts, where Klive BASIC returned with ERR_NR set.
14. **No `runtimeSymbols`, `labels`, `libraryFiles` or `optimizationLevel`.** **(adapter)** They come
    from the `-M` map, the install path and the command line.
15. **The `.dbg` covers only compiled BASIC.** Inline `ASM ... END ASM` blocks and stdlib assembly
    have no source mapping, so stepping into them is Z80-level in the disassembly. Klive BASIC mapped
    inline asm lines.
16. **`--cow-strings`** kept the classic string layout (`[len16][chars]`) in every case tried, so
    strings decode as usual. The decoder stays defensive: a length beyond the heap shows
    "unavailable".

## Source positions

17. **Column ranges are approximate:** indented assignments start at column 0, and multi-item `PRINT`
    statements end after their first item. The adapter repairs both (`dbg-observed.md`); other
    statement kinds may have similar gaps.
18. **Diagnostics have no column**, so an error marker covers the whole line.

## Editor and build

19. **No language intelligence** beyond keywords, completion and folding: no hover types, go to
    definition, references, rename, outline, signature help or library `#include` insertion. All of
    these came from Klive's binder, which does not compile Boriel 2.0's extended syntax
    (`MODULE`/`USE`/`PRIVATE`, `CALL FAR`). Diagnostics come from `--parse-only`.
20. **No in-process debug profile.** A debug build passes `-O 1`; its fidelity depends on zxbc.
21. **Slower builds and background checks:** zxbc is an external process per build and per check.
22. **Machine coverage.** No ZX81 target (`zx81sd` is other hardware). The +3, Scorpion and Timex run
    zxbc's generic `zx128k`/`zx48k` code.
23. **Klive-only language and options are ignored**, with a warning: `'@asm-dialect klive` inline asm,
    Klive's debug-info level, and Klive's documented deviations where zxbc's arithmetic is wrong. The
    same program can compute different results under the two compilers.
24. **A banked 128K export uses zxbc's own tape**, so the loader options (`-as`, `-n`, `-b`, `-scr`)
    have no effect on it (`technical-debt.md`, item 3).

**What Boriel adds:** `binaryChecksum` build identity (Klive verifies that a `.dbg` matches the loaded
program), `MODULE`/`USE` with automatic bank packing, `zx81sd`, and zxbc's own
`tap`/`tzx`/`sna`/`z80` writers.
