---
type: feature
issues: [1446]
---
**Profiler on every Z80 machine:** **Debug › Start Profiling** and **Stop Profiling** measure
every instruction in a window of the run, with no sampling, and open the **Profiler** document.
**Routines** shows the time per routine (from Klive BASIC SUBs and FUNCTIONs, `.proc` blocks or
labels), **Addresses** the time per address, **Call tree** inclusive and exclusive time, and
**Callers** what called a routine. Interrupts count as roots of their own, and time waiting in
HALT is kept apart. `profile start -at <label> -until <label>` measures exactly one pass of a
loop. Profiles export to speedscope, callgrind (KCachegrind), CSV and Fuse's format, and
**Settings › Debugging › Profile hints in the editor** shows each routine's share in the source.
The assembler's `.proc` blocks also appear in the editor's Outline.
