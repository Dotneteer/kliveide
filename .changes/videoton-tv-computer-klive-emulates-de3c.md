---
type: feature
highlight: "**The Videoton TV Computer**, the Hungarian home computer: the TVC 64K and 64K+, with VT-DOS disks."
---

**The Videoton TV Computer:** Klive emulates the Hungarian home computer as the TVC 64K (BASIC 1.2)
and the TVC 64K+ (BASIC 2.2, four video banks), with their ROMs, the 2-, 4- and 16-colour modes,
palette and border changes in the middle of a line, the clock stretch on video memory, sound, and
the Hungarian accented letters on the keyboard. Programs load from `.cas` tapes (Load and Run,
`tape-load`, the Explorer, `klive run --machine tvc`), fast or in real time, and `SAVE` writes
`.cas` files. The HBF floppy interface with VT-DOS (Machine › Disks) reads and writes raw `.dsk`
disks. The assembler takes `.model TVC`: Run and Debug boot BASIC, move it above the code with
`LOMEM` and call the code with `USR`, so a `RET` goes back to BASIC; Export writes a `.cas` that
`LOAD` runs, and a new project template prints a welcome. Debugging (with Step Over across the
operating system's `RST 30h` calls), the TVC Video panel, the BASIC Listing, execution history,
reverse debugging, code coverage, state files and the Z80 unit-test runner work as on the other
machines.
