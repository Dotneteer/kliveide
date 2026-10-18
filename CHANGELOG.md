# Klive IDE Changelog

## 0.64.0 (2026-10-18)

### Highlights

- **Reverse debugging on every Z80 machine:** step back, reverse-continue to the last breakpoint
  hit, take over in the past, and save the session as a `.klr` debug recording (#1445).
- **Code coverage, a memory heat map and an exact profiler** on every Z80 machine (#1446).
- **Z80 unit tests** in DeZog's conventions, with a Unit Tests panel and the new `klive` command
  line for CI (`klive test` with JUnit and LCOV, `klive build`, `klive run`) (#1446).
- **ZX Spectrum Next inspectors:** Copper debugging, and live Sprite, Tilemap and Layer 2
  inspectors, with layer hiding and a pixel probe on the emulator screen (#1434).
- **New machines:** the Pentagon 128 with TR-DOS disks, the ZX Spectrum +2A/+3 with Amstrad's
  original ROMs, and experimental Timex TC2048/TC2068/TS2068 and Scorpion ZS-256 machines (#1431).
- **RZX input recordings:** play, debug, record, roll back and render `.rzx` files to video (#1431).
- **Reverse-engineering tools:** annotations on every machine, annotated ROMs, code and data
  detection from coverage, a graphics finder, SkoolKit import/export and export as re-assemblable
  source (#1448).
- **Boriel BASIC 2 comes with Klive,** with source-level debugging on the ZX Spectrum and the Next
  (#1463).
- **Klive speaks your language:** the IDE in Spanish, Portuguese (Brazil and Portugal), German and
  Hungarian (#1464, #1465).
- **A reorganised menu bar and a new Settings dialog,** with a Debug menu and one **File › Open
  File...** for every kind of file (#1443).

### Key fixes

- Cambridge Z88: no more noise below a small Screen Base File on the larger LCDs, the known issue of
  0.63.0 (#1433).
- Assembler: `DEFB` accepts strings (#1437).

### Breaking changes

- ZX Spectrum 48K, 128K and +2E/+3E machine states saved by 0.63.0 no longer load exactly, because
  the emulator cores' memory layout changed. Such a `.kls` file loads from the `.szx` snapshot it
  carries: nearly the same state, without the tape's exact position, the disk controller's state and
  a few CPU details. Klive says when this happens (#1431, #1432).
- Boriel ZX BASIC 1.x (`zxbc` 1.19) is no longer supported as the external compiler, and the
  `zxb-reset` command is gone. An existing `zxbasic.compiler zxbc` setting now means Boriel BASIC 2
  (#1463).
- Many menu items moved in the menu redesign, and the per-type load items, the IDE menu and the View
  and Machine check items are gone (the options are in Settings). Keyboard shortcuts are unchanged.
  The Settings page of the documentation has a **Where Did It Go?** table with the new place of
  every moved item (#1443).

### Features

- **Execution History on every Z80 machine:** **Debug › Execution History** (or `show-history`)
  lists the last instructions the CPU ran in a debug session: 131,072 on the Next and 65,536 on the
  other machines. Each row shows the bank and address, the bytes that actually ran, the disassembly,
  the source line, and the registers and flags the instruction changed. A HALT wait, a ZX80/ZX81
  display line and a Next DMA bus hold are each one row with a count, and **Fold interrupts** turns
  each interrupt service into one expandable row. Click a row for the full registers before and
  after it and the memory map at that time; double-click it to go to its source. A plain **Start**
  records nothing (#1445).
- **Reverse debugging on every Z80 machine:** while a debug session is paused, **Step Back**, **Step
  Forward**, **Reverse Step Over**, **Reverse Step Out** and **Reverse Continue** (Alt+F5) put the
  whole machine back at any recorded instruction, memory, devices and screen included, and every
  panel shows that moment. Stepping or continuing from the past replays the recorded run with your
  breakpoints active, and **Take over here** makes the current point the present and goes on live
  (on the Next this undoes the SD card writes of the discarded future). Reverse Continue checks
  every breakpoint kind, so a memory-write breakpoint finds where a byte last changed; a long search
  shows its progress and can be cancelled (`reverse-continue-cancel`). The status bar shows how far
  back you are, and a click returns to the present. **Settings › Debugging** sets how much memory
  the timeline may use (#1445).
- **Trace export:** **Debug › Export Execution History...**, the Execution History's **Export**
  button or `history-export` (`hexp`) saves a range of the history as a text or CSV trace. The
  defaults suit diffing two runs: times are relative to the first row, the header has no export
  time, and `-nointerrupts` leaves interrupt services out. The columns can be chosen, and CSV has
  one column per register (#1445).
- **Debug recordings:** **Debug › Save Debug Recording...** (`drsave`) saves a reverse-debugging
  session to a `.klr` file. **Debug › Open Debug Recording...** (`drload`), **File › Open File...**
  or dropping the file on the Emulator window opens it on the same machine and configuration, paused
  where it was saved, with its whole past to step back through; its breakpoints and watches come
  with it as session breakpoints. A minute of a ZX Spectrum game takes about 1-2 MB, and `.klr`
  files have a viewer in the Explorer. A recording replays only in the Klive build that made it; for
  a file from another build, Klive offers to open its end state instead (#1445).
- **The advanced debugging features can be turned off:** the execution history, reverse debugging,
  debug recordings, code coverage and the profiler are on by default.
  `set -u features.advancedDebugging 0` and a restart turn them all off; a debug session then
  records nothing extra, and the related commands say how to turn the features back on (#1445,
  #1446).
- **Code coverage and the memory heat map on every Z80 machine:** **Debug › Code Coverage** (or
  `coverage on`) records which bytes of every bank ran, were read or were written, and how often, at
  full speed as well as while stepping. The editor marks source lines as covered, partly covered or
  not covered, and the Disassembly view marks the instructions that ran. The Memory view's **Heat**
  selector draws execution, read or write counts as a heat map and outlines self-modified bytes;
  `coverage smc` lists self-modifying code. `coverage export` writes LCOV, CSV or `.kcov` files,
  `coverage load` merges a `.kcov` file, and **Debug › Reset Coverage** starts over (#1446).
- **Profiler on every Z80 machine:** **Debug › Start Profiling** and **Stop Profiling** measure
  every instruction in a window of the run, with no sampling, and open the **Profiler** document.
  **Routines** shows the time per routine (from Klive BASIC SUBs and FUNCTIONs, `.proc` blocks or
  labels), **Addresses** the time per address, **Call tree** inclusive and exclusive time, and
  **Callers** what called a routine. Interrupts count as roots of their own, and time waiting in
  HALT is kept apart. `profile start -at <label> -until <label>` measures exactly one pass of a
  loop. Profiles export to speedscope, callgrind (KCachegrind), CSV and Fuse's format, and
  **Settings › Debugging › Profile hints in the editor** shows each routine's share in the source.
  The assembler's `.proc` blocks also appear in the editor's Outline (#1446).
- **Z80 unit tests,** with the Klive assembler and with sjasmplus, in DeZog's conventions, so DeZog
  unit-test projects run unchanged: a routine labelled `UT_...` is a test, and `TEST_...` macros
  check values. **Add unit-test support** in the **Testing** activity's menu (or `test-init`) adds
  the include file to a project. The **Unit Tests** panel runs each test on a fresh machine in the
  background, without touching the emulator, and shows passed, failed or error, the values that made
  a test fail and the T-states each test took; a click goes to the source. A failing test can be
  debugged in the emulator, and **Run all tests with coverage** feeds code coverage. Commands:
  `test-list`, `test-run`, `test-debug` and `test-junit`. Tests run on the ZX Spectrum 48K/16K,
  128K, +2A/+3/+3E and Next (#1446).
- **The `klive` command line,** for scripts and CI, needs nothing else installed and never opens a
  window. `klive test` builds a project and runs its unit tests, with exit codes, pretty, plain or
  TAP output, JUnit XML, and LCOV or `.kcov` coverage, giving the same results on every run.
  `klive build` compiles a project to a flat binary or Intel HEX. `klive run` runs a project, a
  tape, a snapshot, a state file, a NEX file or a ZX80/ZX81 program until a frame count, an exact
  T-state count, an address, a HALT, a breakpoint or a timeout, then writes memory dumps, registers,
  a PNG screenshot or a state file. On macOS, **Klive IDE › Install Command Line Tool...** puts
  `klive` on the PATH; the Windows installer adds it there (#1446).
- **Automation:** with **Settings › General › Automation** on (it is off by default), scripts drive
  the running Klive with `klive ide`: build, run and debug the project, wait for a stop, read and
  write registers and memory, set breakpoints, take screenshots and, at the **Full** level, run any
  IDE command. Any language can do the same through a local, token-authenticated JSON-RPC 2.0
  protocol. Three permission levels (Read, Control, Full) limit what scripts may do, and an
  **Automation** status bar item and output pane show the connected scripts and their calls (#1446).
- **Faster debugging:** debug sessions and project starts now run close to the speed of a plain Run
  on most machines, also with memory, I/O or conditional breakpoints set; before, they could take
  two to three times longer. A source-level Step Over of a long call is almost four times faster
  (#1446).
- **ZX Spectrum Next Copper debugging:** a **Copper** panel in the Debug activity shows the Copper's
  mode, state, PC, write pointer, line offset and beam, with the instructions around its PC. The
  **Copper List** document (**View › Machine Views › Copper List**, or `show-copper [index]`)
  decodes all 1024 instructions with their meaning and a colour swatch for palette writes, marks the
  Copper's PC and last hit, flags a list without `HALT` and `WAIT`s that never match at the current
  timing, and draws a raster ruler of where in the frame each `WAIT` acts. `bp-set cu:<index>` stops
  the machine when the Copper completes an instruction, with hit counts, conditions, logpoints and
  one-shots; set one from the list's gutter, its row menu (**Run to here**, `run-to cu:`) or the
  margin of a `.copper` source line. **Step Copper** (**Debug › Step Copper**, `step-copper`) runs
  to the Copper's next instruction (#1434).
- **The `.copper` pragma** writes Copper instructions in the Klive Z80 Assembler: `.copper wait`,
  `move`, `nop`, `halt` and `word`, with highlighting, completion and hover. The Copper List matches
  the live Copper memory back to these source lines, even when the list is uploaded at an offset or
  patched at run time, and **Go to source** opens the line (#1434).
- **Sprite Inspector for the ZX Spectrum Next:** **View › Machine Views › Sprite Inspector**,
  `show-sprites [n]` or `show-patterns [n]` opens one document with two linked views. **Sprites**
  decodes all 128 attribute slots (pattern, position, palette offset, transforms, anchors,
  visibility) with diagnostics chips, change markers since the last stop and **copy as
  nextreg/.db**; **Patterns** shows the 16K of pattern RAM in the live or a pinned sprite palette,
  with usage badges. An inspector shows the selection and a map of sprite space. `export-patterns`
  (or **Export pattern RAM as .spr**) saves the pattern RAM. The inspector only reads: it does not
  clear the sprite status port `$303B` (#1434).
- **Tilemap Inspector for the ZX Spectrum Next:** **View › Machine Views › Tilemap Inspector**,
  `show-tilemap [x y]` or `show-tiles [n]` opens one document with two linked views: **Map**, the
  40x32 or 80x32 map (whole, or as displayed) with each cell's tile, attributes and address, and
  **Tiles**, the 256 or 512 definitions with usage counts and unused tiles dimmed. Select a tile and
  every cell that uses it is outlined. Diagnostics check the map, the tile definitions and the ULA
  screen for setup mistakes such as overlaps. The inspector only reads, so opening it never changes
  the machine (#1435).
- **Pattern and tile snapshots:** **Open in sprite editor** in the Sprite Inspector pops a sprite
  pattern, as its sprite shows it, into a read-only sprite editor, and **Open tile snapshot** in the
  Tilemap Inspector pops a tile into a read-only 8x8 viewer, with the cell's transform and the
  palette frozen at the stop (#1435).
- **Layer 2 Inspector for the ZX Spectrum Next:** **View › Machine Views › Layer 2 Inspector** or
  `show-layer2 [shadow|window]` shows the displayed (`$12`), shadow (`$13`) or `$123B` write-window
  banks as an image at their resolution, either whole with the 16K bank boundaries outlined, or as
  displayed with the scroll and clip window applied. A Banks strip names each bank's role, and the
  pixel inspector gives a pixel's byte, palette index and addresses: **Show in memory** opens the
  byte (in its 8K page when it is not mapped), and **Break on write** sets a bank-relative write
  breakpoint (#1436).
- **A viewer for `.sl2` and `.nxi` Layer 2 pictures,** at 256x192, 320x256 or 640x256 (the toolbar
  switches between the last two, which have the same size), with the palette the file carries or the
  Next's default Layer 2 palette (#1436).
- **Hide, solo and probe the ZX Spectrum Next's video layers:** the Layers strip under the emulator
  screen (**Settings › Emulator › Show the Layers strip**, the status bar's context menu, or the
  `layers` command, such as `layers spr off` or `layers l2 solo`) lists the layers in their `$15`
  priority order, hides or solos each one, marks where no layer is opaque, and draws the four clip
  windows. A paused picture is redrawn exactly at once, even after mid-frame Copper changes. The
  pixel probe names the layer that produced a pixel and the rule that made it win, and a click opens
  the inspector that owns it. **View › Machine Views › Layers** (`show-layers`) shows the priority
  stack and a card per layer. This changes only what the emulator shows, never what the machine
  does, and a pill on the screen says when a layer is hidden (#1442).
- **The beam position on the paused screen,** on the ZX Spectrum Next and on the 48K, 128K, +2A/+3,
  +2E/+3E, Pentagon, Scorpion and Timex models: when the machine pauses, a line marks the beam's
  row, a pill gives its raster line, paper row, position in the line and frame tact, and the part of
  the picture left from the previous frame is hatched. The paused picture is first brought up to the
  beam, without changing the machine. Blanking is named, pointing at a pixel tells how many tacts
  until the beam draws it, and on the Next a Copper breakpoint's hit is shown as a second marker.
  Switch it with the emulator toolbar's beam button, **Settings › Emulator › Beam position** or
  `beam [on|off]` (#1442).
- **Sprite attribute breakpoints on the ZX Spectrum Next:** `bp-set sp:<sprite>` stops after an
  instruction writes an attribute byte of that sprite, whether the CPU, the DMA or the Copper wrote
  it, through port `$57` or the NextReg mirrors. The stop reports the byte, its old and new value,
  and the writer, and `-attr` limits the breakpoint to some of the five bytes. You can also set one
  from the breakpoint dialog or the Sprite Inspector's row menu (#1445).
- **Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
  list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas, with each
  instruction's meaning in the comment column. Every row reassembles to the bytes it shows, and the
  annotation file stays readable by older Klive versions (#1444).
- **New model: the Pentagon 128,** the Russian 128K clone much of the demoscene writes for. It is a
  model of the ZX Spectrum 128K with the same ROMs, paging and AY and the Pentagon's own timing: 3.5
  MHz, a 71,680 T-state frame (224 T-states by 320 lines), no memory or I/O contention and no
  floating bus. Running, debugging, injecting code, the tape loader, snapshots and state files work
  as on the 128K. `.szx` and `.z80` snapshots of a Pentagon open on it and are saved as a Pentagon,
  and a 128K snapshot keeps a Pentagon project on the Pentagon (#1431).
- **TR-DOS disks on the Pentagon 128:** the Pentagon has the Beta 128 disk interface, with two
  drives that take `.trd` and `.scl` images, and TR-DOS. Klive cannot ship the TR-DOS ROM, so name
  your own 16K copy under **Settings › Machine › TR-DOS ROM**; without it the Pentagon runs without
  its drives. **Machine › Disks** inserts, ejects and write-protects disks; TR-DOS writes go back
  into `.trd` files, while an `.scl` is never changed (**Save Disk in Drive A as .trd...** keeps the
  changes). **Create Disk File...** and `crd` (for example `crd trd80ds games`) make blank TR-DOS
  disks, and **Boot Disk in Drive A** selects 48 BASIC, enters TR-DOS and runs the disk's `boot`
  program. The debugger shows the TR-DOS ROM as partition `R2`, so `R2:$3D2F` stops only in TR-DOS.
  `.szx` snapshots and state files keep the disk interface's state (#1432).
- **ZX Spectrum +2A/+3 with the original Amstrad ROMs:** the +2A/+3/+2E/+3E machine gains eight
  models that boot Amstrad's unmodified ROMs: the +2A (v4.1 and Spanish v4.1) and the +3 (v4.1, the
  1987 v4.0 and Spanish v4.1, each with one or two drives). Pick one when a program must behave
  exactly as on the original machine; running, debugging, injecting code, tapes, `.dsk` disks,
  snapshots and state files work as on the +2E/+3E. A `.z80` or `.szx` snapshot of a +2A or +3 stays
  on a +2A/+3 model when the project already uses one, and is saved back as a +2A or +3 (#1431).
- **New experimental machines: the Timex TC2048, TC2068 and TS2068.** They run 48K software and add
  the Timex SCLD's screen modes (a second screen, 8x1 extended colour and 512x192 two-colour), port
  `$FF` and the 3.528 MHz clock; the TS2068 has a 60 Hz frame and the TC2048 a built-in Kempston
  port. The 2068s add 8K bank switching from the HOME bank, the cartridge DOCK and the Extension ROM
  (partitions `H0`-`H7`, `D0`-`D7` and `X0`-`X7` in the views and breakpoints), an AY chip with the
  PSG panel, two joysticks, and cartridges: **Machine › Cartridge › Insert Cartridge...** takes a
  `.dck` file. Klive cannot ship Timex's ROMs, so name yours under **Settings › Machine** (TC2048
  ROM, TC2068 ROM or TS2068 ROM); until then the machine boots the Sinclair 48K ROM. With a 2068 ROM
  other than the known TS2068 one, the IDE cannot start a program or a tape. `.szx` and `.z80`
  snapshots load and save; a `.sna` saves as a 48K, and Klive names what it loses (#1432).
- **New experimental machine: the Scorpion ZS-256,** a Russian 128K-compatible machine with 256K of
  RAM in sixteen banks (`B0`-`B15`), port `$1FFD`, four ROMs (`R0`-`R3`: the 128K editor, 48K BASIC,
  the service monitor and TR-DOS) and a built-in Beta 128 disk interface with two drives, as on the
  Pentagon. Klive cannot ship its 64K ROM, so name yours under **Settings › Machine › Scorpion
  ROM**. Until then it boots the 128K ROMs and takes TR-DOS from the TR-DOS ROM setting, and
  running, debugging, the tape loader and booting a disk work as on the 128K. With the Scorpion's
  own ROM the IDE cannot start a program, tape or disk in its editor, so load them by hand. `.szx`
  and `.z80` snapshots keep all sixteen banks; a `.sna` is refused while `$1FFD` is in use (#1432).
- **RZX input recordings:** Klive plays and records RZX files (version 0.13) on the ZX Spectrum 48K
  (16K and NTSC too), the 128K and the +2E/+3E, and a recording made on a +2A or +3 plays on the new
  Amstrad models. Open an `.rzx` file with **File › Open File...**, drop it on the Emulator window,
  use **Play recording** in the Explorer or the recording's tab, or `zx-rzx <file>`. **Debug
  recording** (`zx-rzx <file> -d`) stops at the first instruction, breakpoints and stepping work
  while it plays, and a desync pauses the machine and names the frame. The `.rzx` viewer shows the
  file's details, its segments (each can be played from, `zx-rzx <file> -s <n>`) and its first
  snapshot. **Machine › Record › RZX: Record** (`zx-rzx-record`) records from the current state with
  a rollback point every five seconds, with **RZX: Roll Back** (`zx-rzx-rollback`), **RZX: Insert
  Rollback Point** (`zx-rzx-point`) and **RZX: Stop and Save...** (`zx-rzx-stop <file>`). **RZX:
  Render a Recording to Video...** (`zx-rzx-video <file>`) plays a recording into a video file. A
  PLAY/REC badge in the status bar shows the frame counter (#1431).
- **Machine code for the ZX81 and ZX80:** the assembler takes `.model ZX81` and `.model ZX80` (and
  `#ifmod`), the `.defzx` pragma writes text in the machines' character sets, and code above `$7FFF`
  gets a warning; a source with no `.model` is assembled for the running machine. **Run** and
  **Debug** put the code into a `1 REM` line followed by `2 RAND USR <entry>` and type `RUN`, so the
  code is debugged at source level as on the other machines, and **Inject** only writes the program.
  Code that starts at the program's base is taken as a complete program. **Export** (or
  `expc <file> -f p|o`) writes a `.p` or `.o` file, and on a `.p` file `-as` makes it run itself
  once loaded. New **ZX81** and **ZX80** project templates print a welcome message, and `klive run`
  works on these projects (#1461).
- **BASIC Listing for the ZX81 and ZX80:** **View › Machine Views › BASIC Listing** lists the
  program in a ZX81 or ZX80 the way the machine's own `LIST` prints it, with the ROM's keyword
  spacing, and line numbers above 9999 shown as the ROM shows them (14393 as E393). A ZX80 with the
  8K ROM is listed as a ZX81 (#1460).
- **ZX81 SAVE writes a `.p` file:** `SAVE "NAME"` on the ZX81 writes the program to `NAME.p` in the
  saved-files folder, as a Spectrum SAVE writes a `.tzx`. With *Fast Load* on, the save is instant;
  press BREAK while it saves, and no file is written (#1460).
- **A viewer for ZX81 `.p` and ZX80 `.o` files:** a summary strip (size, RAM needed, lines, auto-run
  line, FAST/SLOW) and the file's parts at their own addresses: system variables, BASIC program,
  display file and variables. Each part pops out as Memory, Disassembly, a BASIC listing, or the
  screen drawn with the machine's own characters. ZX80 files (`.o`/`.80`) open in the same viewer
  with the ZX80's keywords and variables (#1460, #1462).
- **A ZX80 virtual keyboard** in the original 4K machine's colours, with blue keys and white and
  amber legends taken from the ZX80 ROM; each legend is the key or SHIFT plus the key. A ZX80 with
  the 8K ROM shows the ZX81 keyboard (#1460).
- **TV noise without sync on the ZX80 and ZX81:** a ZX81 in FAST mode, or a ZX80 while it computes,
  sends no usable picture, which a real television showed as noise and Klive as black. Turn on
  **Settings › Emulator › Show TV noise without sync** (off by default) to see animated grey noise
  instead. SAVE and LOAD stripes still show, and screenshots and recordings keep the real picture
  (#1460).
- **ZX80 and ZX81 system variables:** the System Variables panel lists them, and the disassembly
  names operands such as `D_FILE` and `E_LINE`. Labels follow memory mirrors: a label shows at every
  address where its byte appears, and a mirror row says which address it mirrors (#1448).
- **Annotations on every machine:** the Disassembly view is now an editable, annotated listing on
  the ZX Spectrum 48K, 128K, +2A/+3 and Next, the Pentagon, the Scorpion, the Timex machines, the
  ZX80 and the ZX81. Right-click a row to add a label, a synopsis or an end-of-line comment, or to
  mark data; the `label` command adds a label from the command prompt. Annotations are kept in a
  `.dis` file beside the program: `nex-run`, `zx-snapshot`, `tape-load` of a ZX80/ZX81 program and
  the open project (`annotations.dis`) choose it for you, or pick one with `ann-new` or `ann-open`.
  Snapshot banks can be annotated too. The same names appear in the Execution History, the Call
  Stack, the Profiler and `dis`, and on every machine with banks, `bp-set` accepts
  `<bank>:+<offset>` and `<bank>:<label>` (#1448).
- **ROM annotations:** Klive recognises a ROM by its bytes, also when it is loaded from your own
  file, and shows the labels and comments it ships for it, so calls into the ROM read by name. This
  release ships the main entry points of the ZX Spectrum 48K ROM and the whole ZX81 ROM: a label on
  every call and jump target, a synopsis for each of its 604 labels, its data regions, and its
  tables (keys and keywords, edit keys, the calculator, syntax, operator priorities and the
  character set). ROM labels are set in italics, and the Disassembly view's **ROM labels** switch
  hides them. `bp-set ROM:<name>` breaks at a ROM label, and `ROM:<name>` also works in breakpoint
  conditions (#1448, #1460, #1466).
- **Editing ROM annotations:** a ROM's labels, comments and regions are edited in a working copy
  that replaces the shipped annotations for that ROM: in Klive's home folder (`RomAnnotations/`) for
  a ROM Klive ships, where it survives updates, or beside your own ROM file as `<file>.dis`. Make
  one with `rom-ann-new` or **Start Editing ROM Annotations...** on a ROM row's context menu, and
  open it with **Open ROM Annotations**, `rom-ann-open` or by opening the `.rom.dis` file: the ROM
  annotation editor finds the ROM by its bytes and opens its pages with the same annotation menu and
  shortcuts as a NEX bank, with no machine running. Once a working copy exists, ROM rows in the live
  Disassembly view can be edited too. A **Ready** chip (or `rom-ann-check`) says whether the file
  passes the checks of a shipped annotation file, **Next unlabelled** steps through the calls and
  jumps that still have no label, and `rom-ann-provenance` marks an entry as `observed` or `manual`
  (#1460).
- **Code and data detection:** after a run with code coverage on, **Debug › Detect Code and
  Data...** (also `ann-detect` or the Disassembly view's tools button) proposes annotation regions
  from what the program actually did: code, and `.defb`, `.defw` or `.defm` data, bank by bank. It
  warns about self-modifying code, overlapping instructions and code bytes that are also read, and
  its changes can be undone (#1448).
- **Graphics finder:** the `gfx` command, the Memory view's **Show as graphics** button, a
  Disassembly row's **Show as Graphics** or the **Graphics** mode of any memory dump draws memory as
  bitmaps. Change the width with the arrow keys until a sprite or a font snaps into focus; frames
  can be read in four byte orders, with masks, and graphics can be named and saved as PNG.
  `show-memory <address>` moves the Memory view to an address (#1448).
- **SkoolKit import and export:** `skool-import` and `skool-export`, or the Disassembly view's tools
  button, exchange annotations with SkoolKit skool and control (`.ctl`) files. Klive checks each
  imported instruction against the bytes already in the machine and lists the entries that do not
  match. SkoolKit itself is not needed (#1448).
- **Export as source:** **Export as Source...** on the Disassembly view's or a bank document's tools
  button, or `export-asm`, writes an annotated range or a whole bank as Klive Z80 assembly, then
  reassembles the file and reports whether the result is byte-identical. Encodings that would not
  assemble back to the same bytes are written so that they do (#1448).
- **Go to References in the Disassembly view:** a row's menu has one entry for each label the row
  offers, its own and its operands', and Shift+F12 opens the first. The list shows the rows of that
  bank or ROM page that name the label, with the routine each one is in, and **Go To** scrolls
  there. This works in the live Disassembly view and in the bank and ROM annotation editor, and the
  **Refs** column of the Labels list counts the same rows (#1466).
- **Label names in `.defw` rows:** a `.defw` word that is a labelled address shows the label in the
  operand colour, so jump tables and word tables read by name, and Go to Definition works on it.
  `.defb` rows inside code (after `RST $08` and `RST $28`) take the data colour (#1466).
- **Boriel BASIC 2 comes with Klive:** Klive includes Boriel's `zxbc` 2.0.0-beta25 and offers to
  install it the first time it starts (in `~/zxbasic2` by default); skip it and install it later
  from **Settings › Integrations › Boriel BASIC**, which also accepts, repairs or updates an
  existing installation. Klive BASIC stays the default. To switch, choose **Boriel BASIC** in
  **Settings › Integrations › Compiler for BASIC programs**, tick **Use Boriel BASIC to build BASIC
  programs** in the Boriel BASIC dialog, or type `set zxbasic.compiler boriel`. The status bar names
  the compiler of the focused BASIC file, and a click opens the dialog. The build options in the
  source header become `zxbc` options, and the few that only Klive BASIC knows give a warning.
  Boriel BASIC builds for the 48K, 128K, +3, Timex, Scorpion and Next; the result can be run,
  injected and exported, and `zxbc`'s errors keep their codes (#1463).
- **Source-level debugging of Boriel BASIC programs:** programs built with Boriel BASIC 2 get the
  same debugger as Klive BASIC programs, on the ZX Spectrum and on the Next: source breakpoints, the
  execution point, Step Into/Over/Out, the Call Stack (`FASTCALL` routines included), the Variables
  panel, watches and runtime-error stops. The Next's NEX export writes its debug file, so
  `nex-run -d` debugs it (#1463).
- **Boriel BASIC modules and banked programs:** a program can `USE` modules from its own folder or
  the `include-path` option, and on the 128K and the Next the `'@split-modules` header option puts
  each module in a RAM bank of its own. Klive runs and debugs such a program at source level, with
  the call stack and stepping working across bank switches, and a banked 128K program exports as
  `zxbc`'s own tape. A Boriel BASIC build that fails on `CODEBANK`, which is Klive BASIC syntax,
  says so at that line (#1463).
- **Display languages:** Klive's menus, dialogs, panels, command messages and compiler messages
  (assembler, Klive BASIC and KSX) are now available in Spanish, Portuguese (Brazil), Portuguese
  (Portugal), German and Hungarian, besides English. Pick one in **Settings › Language › Display
  language**, or open the page with `settings language`; **System default** follows the operating
  system and falls back to English, and a change applies at once in both windows. Machine, register
  and hardware names, Z80 instructions, BASIC keywords, command names and options, and message codes
  stay in English. The translations were made by AI and have not yet been reviewed by native
  speakers; the Language page shows how much of the current language is translated, and its **Help
  translate** button opens the contributor guide (#1464, #1465).
- **A reorganised menu bar:** the menus now hold commands, and preferences have moved to the new
  Settings dialog. **File › Open File...** opens snapshots, `.kls` states, `.rzx` recordings and
  tapes, as dropping the file on the Emulator window does, and replaces the separate load items of
  the File and Machine menus. **Quick Save State** and **Quick Restore State** moved to **File**. A
  new **Debug** menu holds Start with Debugging, the stepping commands, Step Copper and Sync Source
  with Breakpoint. The **Machine** menu has one submenu for each device the machine has (Tape,
  Program, Disks, Cartridge, SD Card, Input), a submenu named after the machine for its hardware
  actions, and Speed, Sound and Record. **View › Machine Views** opens the Memory, Disassembly,
  BASIC Listing and Next inspector views. The IDE menu is gone, and every keyboard shortcut still
  works (#1443).
- **Settings dialog:** **Klive › Settings...** (Cmd+,) on macOS, **File › Settings...** on Windows
  and Linux, the gear at the foot of the activity bar, or the `settings` command. Its nine pages
  (General, Appearance, Editor, Emulator, Debugging, Machine, Input, Recording and Integrations)
  hold what used to be menu check items and scattered options: the ROM files, the Z88's keyboard
  layout and LCD resolution, key mapping, recording formats, editor and panel options, the theme and
  the layout. Changes apply at once, the search box looks through every page, and **Reset Page to
  Defaults** restores the current page. Settings returns to the page you last used in the session,
  and **Machine › Input › Input Settings...**, **Machine › Record › Recording Settings...** and
  **Debug › Debugger Settings...** open it on their page (#1443, #1460).
- **Controls in the Emulator window:** the emulator toolbar's sound and recording buttons are split
  buttons with their options a click away. In the emulator status bar, the machine name opens
  **Select machine...** and the MHz label the list of speeds; right-clicking the status bar toggles
  the performance info, the media information and the Layers strip, and right-clicking the activity
  bar controls the sidebar (#1443, #1460).
- **New activity bar and toolbar icons:** the activity bar and the toolbar use new line-style icons,
  and the buttons are about 20% smaller, so more of them fit (#1460).
- **New Project dialog: machine type and model:** the long machine list is replaced by a **Machine
  type** drop-down, grouped by family, and a **Model** drop-down. The dialog opens on the running
  machine, and machine types that have no project templates are not offered (#1461).
- **A new documentation website** at kliveide.net, with a new landing page and four areas: Get
  Started, Guides, Reference and Under the Hood. Get Started is a ten-page tutorial from installing
  Klive to exporting a program, with tested example programs and annotated screenshots, and it and
  the landing page are available in all six display languages. New pages include a Klive BASIC
  language reference, project templates, the display language, the `klive` command line, articles on
  emulator internals (the ZX81 display and tape), and a What's new page generated from this
  changelog. Code blocks have a copy button and BASIC syntax highlighting, and old page addresses
  redirect to the new ones (#1465, #1467).

### Fixes

- Cambridge Z88: on the 640x256, 640x320 and 640x480 LCDs, a small Screen Base File (such as OZ
  V5.0B's 2K one) painted unrelated memory as noise below its last row. The Screen Base File now
  runs from its page offset to the end of its bank, as in OZvm, the rows below it stay unlit, and
  the Blink panel's tooltip sizes it the same way (#1433).
- Assembler: `DEFB` rejected string arguments unless the flexible-pragmas option was on, so
  `defb 22,9,5,"TEXT"` failed with Z0601. A string argument now emits one byte per character, with
  the same escapes as `DEFM` (#1437).
- ZX Spectrum Next: Layer 2 resolution `%11` in NextReg `$70` did not render as 640x256, and the
  Next Memory Mapping panel showed port `$123B` as 0 instead of its real value (#1436).
- ULA & I/O panel: the RAS and POS values were wrong on every machine other than the ZX Spectrum
  Next (#1442).
- Opening a project whose machine failed to start left an empty Explorer and a blank document area
  with no explanation. The folder still opens, and the error is now shown in a dialog (#1442).
- Breakpoints: stepping counted a single visit to a hit-count breakpoint twice, once when the step
  arrived at it and again when the next step left it. Each visit now counts once, in Reverse
  Continue as well (#1445).
- ZX Spectrum Next: while DivMMC or Multiface memory was paged in, Klive named the ROM underneath
  it, so source lines, bank breakpoints and `page()` in conditions pointed at the wrong memory. They
  now follow the memory the CPU actually reads (#1445).
- ZX Spectrum 128K, Pentagon, Scorpion and +2A/+3/+3E: after a project with `.bank` segments was
  started, the Memory, Disassembly, Watch and System Variables views showed the old bytes of a
  paged-in bank until the next paging change or reset. The program itself ran correctly (#1446).
- Annotations: changes another program made to an open annotation file (a text editor or a script)
  did not show until Klive restarted, and the next edit in the IDE overwrote them. The IDE now
  reloads the file when it changes on disk (#1460).
- ZX80/ZX81: the emulator window drew a white surround around the picture, which has its own border
  (#1460).
- ZX81: the description of the `FRAMES` system variable had bit 15 backwards; it is set in normal
  running and clear while `PAUSE` counts (#1460).
- ZX80 with the 8K ROM: *Load and Run* of a tape did not work reliably. Klive now waits until the
  editor is ready before it types (#1461).
- ZX80: *Load and Run* of a program file, and running code from the IDE, often stopped at the K
  cursor, because the 4K ROM ignored a key that came too soon after the reset. Klive now waits
  before it types `LOAD` or `RUN` (#1462).
- Settings: a nested setting in the project's settings hid the user's settings of the same group (a
  project's `zxbasic.compiler` hid the user's `zxbasic.root`, for example). Project settings now
  override user settings one key at a time (#1463).
- Settings: after a nested setting (such as `zxbasic.compiler`) changed, the IDE kept showing the
  old value until something else redrew it (#1463).
- Debugger: a debug run of a build without source-level debug information crashed (#1463).
- UI text: the ZX Spectrum Next's SD card picker was titled "Select Tape File", two browse tooltips
  named the wrong folder, the default dialog button read "Ok", and several plurals and wordings were
  wrong, including the Z88 RAM warning. Assembler error Z0322 now reports the file name and the
  error (#1464).
- Settings: a save during start-up (a window-state save, or the emulator window fitting itself to
  the machine) could erase every global setting. Klive no longer saves the settings before it has
  loaded them (#1465).
- Assembler: a bare `.dma wr3` followed by another line failed with "An expression expected".
- ZX Spectrum Next: running or debugging a program without `.savenex file` copied it to the SD card
  as
  `_klive/undefined`. The NEX is now named after the project folder (`NextSprites/` gives
  `NextSprites.nex`), and an exported NEX keeps the name it was exported under.

### Known issues

- Boriel BASIC programs have less debug information than Klive BASIC programs: stepping through
  loops and conditions stops wherever `zxbc` put a statement boundary; constants, `FASTCALL`
  parameters and the elements of dynamic arrays are not shown in the Variables panel; and inline
  `ASM` blocks are stepped in the disassembly only (#1463).

## 0.63.0

### Highlights

- **New machines: the Sinclair ZX81 and ZX80**, on a cycle-accurate WebAssembly core, with `.p`/`.o`
  program loading, a virtual keyboard and the full debugger.
- **Klive BASIC: a built-in ZX BASIC compiler** with source-level debugging &mdash; compatible with
  Boriel ZX BASIC 1.19, needing no installation, and now the default (#1400).
- **BASIC editor intelligence:** hover, Go to Definition, references, completion, signature help,
  rename, outline and folding, across included files (#1415).
- **More powerful breakpoints:** conditions and hit counts, logpoints, one-shot breakpoints, memory
  range watchpoints, and DeZog `LOGPOINT` / `ASSERTION` / `WPMEM` comments (#1413, #1414).
- **Snapshots and machine states:** open, view, run, debug and save ZX Spectrum `.sna`, `.z80` and
  `.szx` snapshots; save and load `.kls` machine state files on every machine, with a quick
  save/restore slot; open and debug Cambridge Z88 `.z88` snapshots (#1409, #1418).
- **A new tape viewer** for `.tap`/`.tzx` files, and loading tapes straight from the IDE (#1410).
- **IDE + Emulator screen recording** of both windows into one video (#1409).
- **Cambridge Z88 brought closer to OZvm:** no more screen noise on the larger LCDs under OZ 5, card
  contents that survive card changes and resets, and SBF / 24-bit screen pointers in the Blink panel
  (#1417).
- **A no-installer Windows build** (#1382), and a searchable **Select machine…** dialog with
  favourites (#1418).

### Key fixes

- Cambridge Z88: the screen showed garbage below row 8 on the 640x256/320/480 LCDs under OZ 5, and
  inserting or removing a card (or a hard reset) erased what OZ had written to flash and EPROM cards.
- Tape files: several TZX block types, header names and turbo-block playback are fixed.
- `run-to` no longer deletes a user breakpoint at the same address.
- Clicking a toolbar button no longer takes keyboard focus away from the emulator.
- No more "Machine controller not available" errors while a machine is being rebuilt.

### Features

- **New machines: the Sinclair ZX81 and ZX80.** One WebAssembly core runs both: the ZX81 with 1K, 16K
  or 64K, in PAL or NTSC (Timex Sinclair 1000), and the ZX80 with 1K or 16K, or with the 8K ROM
  upgrade. The ULA is emulated cycle by cycle: SLOW and FAST modes, a jitter-free picture, and the
  hi-res (WRX) graphics programs build on it. Open a `.p`/`.81` (ZX81) or `.o`/`.80` (ZX80) program
  from *Machine → Select Program File...* or the Explorer, and *Load and Run* types `LOAD ""`, loads
  it (instantly with fast load, or in real time from its tape signal) and types `RUN`. The ZX81 has a
  virtual keyboard that follows the original's layout. The debugger works as on the other machines,
  and the disassembler decodes the ZX81 ROM's error codes and calculator literals. The ZX80 and ZX81
  ROMs ship with Klive; they are free for non-commercial use (see `zx8081-roms-readme.txt`).

- **Klive BASIC, a built-in ZX BASIC compiler** (#1400). It needs no installation and is now the
  default compiler. It is compatible with Boriel ZX BASIC 1.19: the same options and `#pragma`s, the
  standard libraries, the `zxbasm` inline-assembly dialect, and NextBuild's `CODEBANK` for the Next.
  Build options go in `'@name value` header lines. `.zxbas` files are recognised, and a new
  **zx-basic** project template is available for the 48K, 128K and Next. `set zxbasic.compiler zxbc`
  switches back to Boriel's `zxbc`.

- **Source-level BASIC debugging** (#1400). Step Into (with a **Step Into Target** drop-down), Step
  Over, Step Out and Step Over Line step BASIC statements, and a **Source / Z80** toolbar toggle
  switches the stepping mode. Breakpoints can be set on individual statements of a line. The Call
  Stack panel shows SUB/FUNCTION/GOSUB frames, with **Run to this frame**, and the Variables panel
  shows parameters, locals, globals and BASIC watch expressions. A run stops on a BASIC error. New
  commands: `em-src`, `em-err` and `em-jmc` (Just My Code). A NEX export writes
  `<name>.nex.kbasic-debug.json`, so `nex-run -d` debugs it at source level.

- **New assembler features** (#1400): `#LINE` remaps reported source locations, and the
  `.page <page>[, addr[, count]]` pragma places code in an 8K Next page.

- **BASIC editor intelligence** (#1415). Background checking drives hover (types, scope, signatures,
  keyword help), Go to Definition (F12, which also opens `#include` files), Find All References
  (Shift+F12), context-aware completion (choosing a library routine adds its `#include`), signature
  help, Rename (F2), the Outline (Cmd/Ctrl+Shift+O), folding and block highlights &mdash; all across
  included files. With `zxbc` selected, only the keyword-level features work.

- **Conditional breakpoints and hit counts** (#1413), on every breakpoint kind.
  `bp-set ... -hit <spec>` takes `10`, `>10`, `>=10`, `<10`, `<=10` or `*10`; `-if <condition>` (it
  must come last) takes an expression over registers, flags, `VAL`/`ADDR`, memory reads (`w[HL]`,
  `b[05:$C010]`), `page()`, `nr()` and build labels. The new `bp-reset-hits` command resets the
  counts, and `bp-list` prints lines you can paste back into `bp-set`. Conditions can also be edited
  in the breakpoint dialog and the editor margin's menu.

- **Logpoints** (#1414). `bp-set ... -log "x={A} at {PC:hex16}"` writes to a new **Log** output pane
  and keeps running; formats include `hex8`, `hex16`, `int8`, `uint16`, `bits` and `string`. A
  `[GROUP]` prefix puts a logpoint into a group; switch groups with `lp-en` and list them with
  `lp-groups`. The breakpoint dialog has an **Action** row, the margin menu has **Add Logpoint…**,
  and logpoints are drawn as diamonds. DeZog `; LOGPOINT` comments are read from the Klive assembler
  and from sjasmplus (which needs `SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION`).

- **DeZog `ASSERTION` and `WPMEM` comments** (#1414). A failing assertion stops the machine and
  reports the values it read; `WPMEM` becomes a memory watchpoint over a range. Both are on by
  default; switch them off per project with `as-en -d` and `wp-en -d`.

- **One-shot breakpoints** (#1414): Shift+click the margin or the disassembly gutter, choose **Stop
  Here Once**, or use `bp-set -once`. They are never saved with the project.

- **Memory range breakpoints and watchpoints** (#1414). `bp-set <addr> -r|-w -len <bytes>` watches a
  range. Watch view rows gain **Break on write/read/access**, which follows the symbol across
  rebuilds (shown as `WS:<symbol>`). `show-disass <address>` moves the Disassembly view to an address.

- **ZX Spectrum snapshots** (#1418). A new viewer for `.sna`, `.z80` (v1–3) and `.szx` files shows the
  screen, registers, ULA, paging, AY and RAM banks, and banks can be popped out. Run or debug a
  snapshot from its tab, the Explorer, **File → Load ZX Spectrum Snapshot...**, by dropping it on the
  Emulator window, or with `zx-snapshot <file> [-r|-d]`. Klive switches to the 48K, 128K or +2E/+3E
  the snapshot needs, and inserts the disks and tapes an `.szx` file links.

- **Saving ZX Spectrum snapshots** (#1418): **File → Save ZX Spectrum Snapshot...**, the Emulator's
  **Machine → Save Snapshot...**, or `zx-snapshot-save <file> [-f]`. The extension picks the format.
  Klive reports what `.z80`/`.sna` cannot store, and refuses a state those formats would load back
  differently.

- **Machine state files** (#1418). `.kls` files capture the whole machine on every machine &mdash; 48K,
  128K, +2E/+3E, Next, Z88, ZX80 and ZX81. Use **File → Save/Load Machine State...**, `state-save`, or
  `state-load [-r|-d] [-y]`; **Quick Save/Restore State** is Ctrl/Cmd+Alt+S and Ctrl/Cmd+Alt+L.
  `.kls` files have a viewer and can be dropped on the Emulator window. A ZX Spectrum state saved by
  another Klive version falls back to the `.szx` it embeds.

- **Select machine…** (Cmd/Ctrl+Shift+M, #1418): a searchable list of every model with its hardware
  details. A star marks a favourite, and favourites can be reordered.

- **Cambridge Z88 snapshots** (#1397, #1409). The `.z88` viewer shows the registers, the Blink, the
  address space at PC, and a **Slots** browser that pops banks out as Z88 disassembly. Run or debug a
  snapshot with `z88-snapshot <file> [-r|-d|-a]`, from the Explorer, or with the Emulator's **Open Z88
  Snapshot...** (which follows the file's Autorun flag). The machine is rebuilt to match the
  snapshot's RAM and LCD size, and the real-time clock catches up with the time the file spent on
  disk. Hybrid RAM+Flash cards are not supported.

- **IDE + Emulator recording** (#1409): **Machine → Recording → Start IDE + Emulator recording**, or
  Ctrl+Shift+F7 (`shortcuts.recordIdeEmu` changes it), records both windows into one video at 30 fps,
  also while the machine is paused. Options: the IDE's position (left, right, top or bottom), pointer
  and click rings, and HiDPI.

- **Tape viewer** (#1410). For `.tap`/`.tzx` files (any case of extension) it shows a summary, a
  timeline strip, and the blocks grouped by file, with filters. It explains header bytes and pops
  blocks out as memory, disassembly, a BASIC listing or a screen. `tape-load <file> [-r|-d]` and the
  matching tab and Explorer buttons insert a tape, or load and run or debug it on the 48K, 128K and
  +2/+3.

- **Cambridge Z88: the Blink panel and the snapshot viewer show the 24-bit address** each screen
  pointer register (SBF, PB0–PB3) points at, in OZvm's form &mdash; `$0127 (243800h)` &mdash; so a
  memory view can be opened right there (#1417).

- **Cambridge Z88: the serial port's output** (bytes written to TXD) appears in the Emulator output
  as `[Z88 serial]` lines, as OZvm shows them (#1417).

- **New Cambridge Z88 LCD resolution: 640x256** (#1385), as in OZvm. It matches the ZX Spectrum Next
  in tile mode. The Z88 now offers 640x64 (the default), 640x256, 640x320 and 640x480.

- **The Z88 disassembler knows the OZ v5.0 API**: the new FP\_, OS\_ and GN\_ calls of the
  September 2026 V5.0B ROM (#1386). The OZ 4.7 model is now named "Cambridge Z88 (OZ v4.7 Int.)"
  (#1399).

- **No-installer Windows build** (#1382). Each release now also ships
  `KliveIde-Portable-{version}-x64.zip`, which you unpack and run without setup or admin rights.
  It is fully portable: settings, the SD card image, default project and export folders and the
  browser cache all live in a `KliveData` folder beside `Klive IDE.exe`, never in
  `%USERPROFILE%\Klive` or `%APPDATA%\Klive IDE`. Unblock the zip (*Properties → Unblock*) before
  extracting it.

### Fixes

- **Cambridge Z88: no more screen noise on the larger LCDs under OZ 5** (#1417). The Blink now reads
  the Screen Base File and the fonts as a bank and an offset that wraps inside the bank, through the
  bank map, as OZvm does. OZ 5 places a large Screen Base File from the top of a bank downwards; Klive
  read on into the next bank and painted it from row 8 down. Until OZ has set the screen up, the LCD
  stays blank instead of showing whatever its registers pointed at.

- **Cambridge Z88: card contents survive card changes and hard resets** (#1417). Changing one slot,
  or a hard reset, re-inserted every card, which erased what OZ had programmed into flash and EPROM
  cards. A new card no longer shows the bytes of the card that was in the slot before.

- **Cambridge Z88 parity fixes** (#1417): COM.RESTIM keeps the latched TSTA events; releasing a key
  while another is held raises no key interrupt; battery low wakes a snoozing CPU; a flash sector
  erase and the Intel chip-ID read work through a mirrored bank; a blank ROM card reads $FF; looking
  at memory in the IDE no longer changes what the CPU reads next.

- **Cambridge Z88 disassembly** (#1409): pausing the Z88 no longer shows an empty Disassembly view,
  and code in mirrored card banks no longer shows as NOPs.

- **Custom disassembler items** (OZ calls, Spectrum RST data) honour the listing's address offset and
  no longer add their bytes to the previous instruction (#1409).

- **Tape fixes** (#1410): TZX $19 blocks open, and $13/$18 block lengths are read correctly; header
  names are no longer read one byte off; turbo ($11) block playback works; BASIC `TAB` listings are
  right; SCR images keep bright ink.

- **The first visible row's left border is drawn on every ZX Spectrum** (#1410); a grey segment
  showed at the top left on the +2A/+3.

- **`run-to` no longer deletes a user breakpoint at the same address** (#1414).

- **Explorer** (#1409): double-clicking a file no longer fails with "Duplicated document", and
  context menus close after a file-type action.

- **Clicking a toolbar button no longer takes keyboard focus**, so Space and Enter keep reaching the
  emulator &mdash; for example after starting a recording (#1383, #1384).

- **No more "Machine controller not available" errors** while a machine is being rebuilt (a machine
  or model change, or a Z88 LCD size, RAM size or keyboard layout change).

- **The Z80's R register counts both opcode fetches of a prefixed instruction** (`CB`, `ED`, `DD`,
  `FD`), as the real CPU does: `LD A,R` after such an instruction reads one more than before. This
  affects every machine. Timing is unchanged.

- Dependency updates, including Electron 44.4.5.

### Breaking changes

- **ZX BASIC builds use Klive BASIC by default** (#1400). Use `set zxbasic.compiler zxbc` to keep
  Boriel's `zxbc`. The generated code's addresses and sizes differ from `zxbc`'s.

- **The Machine → Machine type menu lists only favourite models** (#1418). Every model is in **Select
  machine…**; the default favourites are the 48K, 128K, +3E, Next, Z88 (OZ 5.0) and ZX81 16K.

- **Cambridge Z88: the reset button resets only the CPU** (#1417). The Blink &mdash; COM, the segment
  registers, the interrupt registers, the clock and the screen pointers &mdash; keeps its state, as in
  OZvm, so OZ's time of day survives a soft reset. Only a hard reset (power-on) resets the Blink, and
  it now clears RAM cards too, while ROM, EPROM and flash cards keep their contents.

- **Cambridge Z88: a 512K slot-0 ROM image is an AMD 29F040B flash chip**, as OZvm loads it, so OZ can
  update it; a slot-0 image larger than 512K is refused (#1417).

- **Cambridge Z88: the SCW register reads 80 on the 640x256, 640x320 and 640x480 LCDs** (640x64 still
  reads $FF), as OZvm reports it (#1417).

- **Cambridge Z88: the Blink register `SBR` is now `SBF`** (Screen Base File) in the Blink panel and
  the snapshot viewer (#1417). `.z88` snapshot files still store it under `SBR`, as OZvm writes it.

- **The 800x320 and 800x480 Cambridge Z88 LCD sizes are gone** (#1385). The OZ screen driver is
  designed for 640-pixel-wide screens, so an LCD driver for them is not practical. A project that
  still names one of them opens with the default 640x64 LCD.

- **Documentation site:** "/" is now a landing page, and the Introduction moved to `/introduction`
  (#1411). Every other address is unchanged.

### Known issues

- **Cambridge Z88:** the bundled OZ V5.0B ROM keeps a 2K Screen Base File on every LCD size, so on
  640x256, 640x320 and 640x480 it uses only the top 8 text rows, and the rest of the screen shows
  unrelated memory (OZvm shows the same). A newer OZ 5 build that allocates a larger Screen Base File
  uses the whole screen.

## 0.61.0

### Highlights

- **All emulated machines run on a WebAssembly core** &mdash; the ZX Spectrum 48K, 128K, +2/+3, the
  ZX Spectrum Next and the Cambridge Z88. The older TypeScript emulators are gone; projects saved with
  the "ZX Spectrum Next Compatibility" or "Cambridge Z88 (TypeScript)" models open on the matching
  standard model (see *Breaking changes*).
- **A modernized IDE.** A new look and fonts; restyled context menus, dialogs and sidebar panels; a
  reworked sprite and palette editor; and clearer memory, disassembly and register panels. Documents
  can be split into multiple hubs through *Split Right* / *Split Down* on a document tab.
- **Debug `.nex` files directly.** Run or debug any NEX file without a project, break at its entry
  point, and pop out banks with their own breakpoint gutter and live, PC-aligned disassembly. Also
  new: bank-relative breakpoints and watchpoints (`05:+$0100`), `nex-label` for naming code while
  debugging, NEX labels in the live disassembly, *Go to Definition*, a sprite view, and header checks
  before a file runs.
- **More debugging tools:** *Run to a line* (`run-to`, or Ctrl/Cmd-click the margin), Next register
  write breakpoints, conditional branch prediction in the disassembly, and *Go Back* / *Go Forward*
  navigation history across editors, views and breakpoints.
- **ZX Spectrum Next:** initial mouse and joystick emulation, and many hardware accuracy fixes
  checked against the FPGA source (DMA, CTC, DivMMC, sprites, tilemap, scroll register), backed by a
  new hardware test harness.
- **Cambridge Z88:** a new OZ v5.0 beta ROM, working cursor keys, smooth sound, a reliable keyboard
  under OZ 4.7, a working auto power-off, and corrected Help menu links.
- **Better sound:** improved beeper and PSG (AY) generation, no audio echo or silence while debugging
  the Next, and no lost audio in half-fps recordings.
- **Emulator window:** a finer zoom menu, *Fit Window to Screen* commands, a window size remembered
  per machine, and an option to hide the performance info in the status bar.
- **SjasmPlus integration dialog**, and an updated +2/+3 SjasmPlus project template.
- **Editor:** pasting a large source file is now instant (one edit instead of one per character), and
  Monaco refactoring is improved.

### Key fixes

- Long-running sessions no longer freeze: the ZX Spectrum froze after about 20 minutes, and queued
  keys could stick after about 10 minutes.
- Breakpoints are reliable again: no more breakpoints firing in the wrong bank, phantom breakpoints
  after a rebuild, breakpoints on the same address disarming each other, or *Step Out* running away
  after tail calls.
- Screen recording produces a file in the installed app.
- Reopening a project restores every document, not just source files.
- Stability fixes on Windows.

### Changes

- **New Cambridge Z88 OZ v5.0 beta ROM** (#1376). The `OZ50` model now runs the V5.0B international
  ROM built in September 2026, replacing the 2023 build, and the Machine menu lists it as
  "Cambridge Z88 (OZ v5.0B Int.)". Existing projects that use this model load the new ROM.

### Changes

- **New Cambridge Z88 OZ v5.0 beta ROM** (#1376). The `OZ50` model now runs the V5.0B international
  ROM built in September 2026, replacing the 2023 build, and the Machine menu lists it as
  "Cambridge Z88 (OZ v5.0B Int.)". Existing projects that use this model load the new ROM.

### Fixes

- **Host cursor keys did nothing on the Cambridge Z88** (#1374). The joystick key bindings took the
  arrow keys, right Shift, right Ctrl, `\` and NumpadEnter on every machine, not just the ZX Spectrum
  Next. They now belong to the emulated keyboard on any machine without joystick connectors, which
  also restores the ZX Spectrum's arrow keys and the Z88's two-Shift sleep/wake from the keyboard.
- **Choppy Cambridge Z88 sound** (#1374). The Z88 delivers its sound in 40 ms bursts of eight short
  frames, and the audio buffer, sized for a single frame, dropped over half of every burst. The
  beeper and the 3200 Hz tone now play smoothly again. The Z88 also no longer goes silent after
  about 22 minutes of running.
- **Queued keys could stick after about 10 minutes of running** (#1374), on the Cambridge Z88, the
  ZX Spectrum 48/128/+3E and the ZX Spectrum Next. These are the keys the on-screen keyboard and
  code injection type. A key queued as the machine's cycle counter passed 2^31 stayed pressed for
  good, or never started and blocked every key after it. That point comes after about 10 minutes
  at 3.5 MHz (11 on the Z88), and after 80 seconds on a Next running at 28 MHz.
- **The ZX Spectrum 48, 128 and +3E froze after about 20 minutes of running** (#1374). When the
  machine's 32-bit cycle counter wrapped, the frame loop stopped running instructions and the
  machine hung for good. The cores now keep their internal counter well away from the wrap, and
  the counter the IDE shows carries on as before.
- **The Cambridge Z88 keyboard could go dead under OZ 4.7** (#1374). With Keyclick on, a key press in
  the Index moved the highlight once, then no key worked while the machine kept running. The
  emulated Z80 had an NMOS chip quirk the Z88's CMOS Z80 does not have, and OZ 4.7 read it as
  "interrupts off". The Z88 now emulates the CMOS behaviour; the ZX Spectrum machines are unchanged.
- **The Cambridge Z88 screen lost its corner pixels** to the emulator display's rounded corners
  (#1374). The LCD now sits in a narrow surround in its own colour: unlit green, or grey while the
  LCD is off. The display's 1px frame also no longer hides one pixel on each edge of every machine's
  picture. Z88 screen recordings carry the same surround (4 pixels), so a player that rounds its
  window's corners no longer clips the LCD either.
- **The Cambridge Z88 never switched itself off** after the Panel's idle timeout (#1374). Two faults
  in the emulated real-time clock hid the passing minutes from OZ 4.7 and OZ 5.0. Both now go into
  coma on time, as OZ 4.0 already did.
- **Screen recording never produced a file in the installed app** (#1374), on any machine. The app
  looked for its bundled FFmpeg inside the app archive, where it cannot run, and only an empty
  `KliveExports/video` folder was left. A recording that fails now says why, instead of ending as
  if it had worked.
- **Cambridge Z88 recordings had the wrong sound** (#1374): a beep recorded as a dull thump. The
  recorder took each frame's sound only after the next frames had already overwritten it, so
  every 40 ms of recorded audio repeated the same 5 ms slice. Recordings now carry exactly what
  the speaker plays.
- **Half-fps recordings lost half their sound**, on every machine. The audio of each skipped video
  frame was thrown away, so 2 seconds of video carried about 1 second of squeezed-together audio.
  All of the audio is now kept.
- **ZX Spectrum Next panels showed stale data.** On the standard (WASM) Next the Palettes panel and
  the sprite editor's palette showed power-on colours whatever a program had written, the ULA & I/O
  panel read values the emulator never updated, and the Memory Mapping panel showed logical instead of
  physical page offsets and zero for the paging and DivMMC ports. (On the now-removed Next
  Compatibility model the ULA & I/O panel failed outright, and the memory editor treated the ROM
  pages as RAM.)
- **No sound while debugging the ZX Spectrum Next.** With the debugger attached, the standard model
  played nothing after its first frame; it now sounds as it does without the debugger.
- The ZX Spectrum Next's **F2 (scandoubler), F3 (50/60 Hz) and F7 (scanline weight)** menu items had no
  effect on the standard model.
- On the standard ZX Next the status bar always showed 3.5 MHz, however fast the CPU ran, and a memory
  or I/O breakpoint hit was reported against address `$0000` in the Breakpoints panel.
- ZX Spectrum Next: a mid-line write to NextReg `$68` bit 2 (half-pixel ULA scroll) now takes effect at
  the next 8-pixel cell, as on the hardware; and the frame interrupt is raised in the first frame after
  a reset.
- **ZX Spectrum Next sprites could vanish.** On the standard model, sprites numbered above the one a
  program made visible last were not drawn at all. Both models also forgot a sprite's fifth attribute
  byte after a four-byte write, instead of keeping it for when the sprite becomes five-byte again.
- ZX Spectrum Next hardware fixes found by the new cross-checks (each against the FPGA source): CTC and
  UART interrupts, and an NMI with NextReg `$CC` bit 7, now break into a DMA transfer; a CTC control word
  that counts the channel down to zero raises its zero count; a Layer 2 read mapping (any segment)
  disables the DivMMC's ROM 3 entry points; a RETN at `$0066` is recognised from the code the DivMMC
  pages in; a tilemap in bank 7 wraps at 8K; and a soft reset now resets the sprite upload positions and
  keeps NextReg `$02` bit 7.
- **A popped-out NEX bank could be open twice.** Opening a bank from the NEX viewer and then
  stopping in it while debugging (or following a label into it) gave two documents for the one
  bank, and the debugger scrolled the one you were not looking at. The two also carried different
  tab titles.
- *Go to Definition* landed at the start of the line instead of on the symbol.
- Opening a file whose viewer is not a code editor through the `nav` command (the NEX viewer, for
  example) took about five seconds.
- In a disassembly listing, a label on the target of a `jr` or `djnz` appeared in the label column but
  never in the jump itself, which kept the generated `L…` name.
- **Only source files came back when you reopened a project.** Every other document backed by a
  project file &mdash; the NEX, DSK and Z80 viewers, plain text files &mdash; was saved into the
  workspace correctly and then discarded while restoring it, because restoring matched on the code
  editor alone. Losing such a document also lost the selected tab, since the active one fell back to
  the first document that happened to survive.
- A breakpoint in partition 0 (bank `B0` on the 128K, bank `00` on the ZX Next) could never fire.
- **A source-code breakpoint fired in the wrong memory bank.** For a line inside a `.bank` section,
  the breakpoint was placed by address alone &mdash; and `.bank` sections share addresses, so it also
  stopped the machine in every *other* bank's code at the same address. It now carries the bank its
  line was assembled into.
- **A rebuild left phantom breakpoints behind.** When recompiling moved a line's code, the machine
  kept stopping at the address the line used to be at, as well as at its new one, with nothing in the
  Breakpoints panel to explain it.
- Several breakpoints could disturb each other when they landed on the same address &mdash; and a
  bank-relative breakpoint occupies eight addresses, so this was easier to hit than it sounds. Adding
  or removing one breakpoint could silently disarm another, permanently; a disabled breakpoint could
  mask an enabled one.
- A breakpoint created *as* disabled was armed anyway, if it was scoped to a partition or a bank.
- Replacing a set of breakpoints (opening a project, saving one, refreshing after a build) did not
  remove the ones it was replacing &mdash; it added to them. Invisible in the Breakpoints panel,
  because the replacements took the same names, but the old ones stayed armed where they were.
- The breakpoint dialog never showed a breakpoint's hit count: the emulator was not reporting it.
- **Step Out could run away instead of stopping**, on every Z80 machine. The debugger's shadow stack
  of return addresses was only ever pushed to, never popped, so once a routine had returned its entry
  stayed on top &mdash; and Step Out aimed at an address the program would not reach again, running on
  to the next breakpoint instead. It went wrong whenever the routine you were in did not own the
  newest entry: after a tail call (`jp SomeRoutine`, which pushes nothing, so the routine returns past
  its caller), and after stepping into and back out of a nested call before stepping out of the
  routine containing it. The stack is now balanced on every RET actually taken, so a conditional RET
  that falls through still costs nothing.
- A `.nex.dis` file whose only debug state was a label-anchored breakpoint lost it on the next save.
- The buttons a document adds to the tab bar (Run, Debug, and the script and NEX actions) sat hard
  against the right-hand end of the header, with no space after the last one.
- The NEX viewer's **Header attributes** rows were taller than they needed to be, spreading the
  header over more vertical space than its content asks for.
- Opening a project no longer discards breakpoints the project does not own.
- Removing a partition-scoped breakpoint through the editor gutter silently did nothing.
- The Disassembly view's breakpoint gutter no longer shows a breakpoint from one bank while you are
  looking at another.
- The Memory Mapping panel's **All RAM** row always read `Off`. Two separate causes: the field was
  read under a different name than it was written, and the ZX Spectrum Next reported nothing for it
  at all.
- The Memory Mapping panel's page rows showed the same number twice on the ZX Spectrum Next, one of
  them labelled "16K bank" in the tooltip. It now shows the real 16K bank beside the 8K one.
- A memory-read, memory-write or I/O breakpoint shown in the disassembly margin could not be removed
  or disabled by clicking it. The margin did not know the breakpoint's type, so it asked to remove an
  *execution* breakpoint at that address &mdash; which is a different breakpoint, and matched
  nothing. On the ZX Spectrum Next a bank watchpoint failed a second way: the address it named
  carried a type suffix the commands do not accept as part of an address.
- A disassembly line carrying more than one breakpoint showed whichever the emulator happened to
  list last, which also decided what right-clicking it would remove. It now shows the execution
  breakpoint, preferring an enabled one.

### Breaking changes

- **The "ZX Spectrum Next Compatibility" machine model is gone.** It ran a second, TypeScript
  implementation of the Next, which existed to check the current emulator against while that one was
  being written. The two now agree everywhere they were measured &mdash; the whole hardware test
  suite, every pixel test, and a 1500-frame instruction-by-instruction comparison of the NextZXOS
  boot &mdash; so the old one has been removed, and with it the last places where the Next quietly
  ran two emulators at once. A project or a session saved with the Compatibility model opens on
  **ZX Spectrum Next**; nothing else about it changes.

- **The "Cambridge Z88 (TypeScript)" machine models are gone.** The Cambridge Z88 runs on its
  WebAssembly emulator, and the older TypeScript one stayed in the Machine menu, in its own submenu,
  only to compare the two. They agreed on every OZ version booting and typing, every LCD size, the
  beeper, every card type being programmed, the IDE's panels and the debugger, so the TypeScript Z88
  has been removed and the submenu with it. A project or a session saved with one of those models
  (or with an earlier "WASM preview" model) opens on the same Z88 model in the main list.

- **On the ZX Spectrum Next, a positive memory partition index now means an 8K page rather than a
  16K bank.** Everything else already described these as 8K pages &mdash; the 224-entry partition
  list, the Memory view's bank chooser and the documentation &mdash; but the breakpoint and
  disassembly layer halved the number, so `bp-set 0A:$C000` and the Memory view's bank `0A` named
  different memory.

  Two visible consequences: the Disassembly view's bank column shows different numbers on the Next
  (an address in 16K bank 5's low half now reads `0A`, not `05`), and a partition in `bp-set`, in a
  saved script, or in an existing `.kliveproject` now names an 8K page. Saved Next partition
  breakpoints are **not** migrated &mdash; a stored index is genuinely ambiguous, since a user
  following the documented behaviour already meant the new reading. 16K bank *B* is the partition
  pair `2B`/`2B+1`.

### Features

- Multiple document hubs are available through the *Split Right* and *Split Down* document tab
  context menus.
- Context menus and modal dialogs are restyled.
- **Fixed-size data rows in NEX annotations.** A `bytes` region in a `.nex.dis` file can set
  `rowBytes` (1&ndash;4), so a table of records lists one record per `.defb` line &mdash; each two-byte
  copper instruction on its own line, for example &mdash; with its own comment.
- **Go Back and Go Forward.** Klive remembers the places you jump to &mdash; *Go to Definition*, an
  output-pane link, a breakpoint, a document tab, *Go To* in the Memory and Disassembly views, a NEX
  bank or label &mdash; and takes you back through them with `Ctrl+-` / `Ctrl+Shift+-` on
  macOS and `Alt+Left` / `Alt+Right` elsewhere, the mouse's back and forward buttons, the new toolbar
  buttons, or **IDE &rsaquo; Go**. The arrow between the toolbar buttons lists the whole history.
  Debugger stops are not remembered, so after debugging, *Go Back* returns to where you were before.
  A remembered line follows its code as you edit, and a place in a closed document &mdash; including
  a popped-out NEX bank &mdash; opens it again. New commands: `nav-back`, `nav-forward`,
  `nav-history` and `nav-clear`; `nav` gained `-r` to record its jump.
- `bp-set`, `bp-del` and `bp-en` accept a bank-relative address on the ZX Spectrum Next:
  `bp-set 05:+$0100` breaks at offset `$0100` inside 16K bank 5, wherever that bank is paged in.
- Any `.nex` file can be run or debugged on its own, without a project: from the Project Explorer's
  context menu, from the buttons in a NEX file's document tab, or with the new `nex-run` command.
- A popped-out NEX bank has a breakpoint gutter: click it to break at that offset in that bank,
  wherever the bank is paged in. Those breakpoints are remembered in the `.nex.dis` sidecar, so they
  survive a restart even when no project is open.
- **Debug a NEX file from its first instruction.** `nex-run <file> -e`, or the new *Debug NEX file
  (break at entry point)* item in the Explorer menu and the NEX document's tab bar, stops the machine
  the moment NextZXOS hands control to the program &mdash; with the entry bank paged in. Klive reads
  the entry point from the NEX header, so you do not have to know where the program's code lives.
- **Bank watchpoints on the ZX Spectrum Next.** The **Memory read** and **Memory write** breakpoint
  types now work with a bank-relative address (`bp-set 05:+$0100 -w`), so you can break when a byte
  of a particular 16K bank is read or written, wherever that bank is paged. The breakpoint dialog's
  **Address** field accepts the bank-relative form too, which means you can click a popped-out NEX
  bank's margin to set an execution breakpoint and then double-click it to change its type.
- **The NEX viewer checks the file before you run it.** A banner reports problems decidable from the
  header: an entry bank the file does not contain, an entry point or stack pointer in ROM, a bank the
  entry point needs but the file lacks, a core version newer than the emulator's, and a bank count
  that disagrees with the file's own flags. Each of these otherwise fails silently &mdash; NextZXOS
  reports a successful load and the program runs into memory it never loaded.
- Breakpoints anchored to a NEX label are remembered in the `.nex.dis` file, so they come back with
  the file &mdash; still anchored to the label, not to wherever it happened to be last time.
- **Name what you just worked out, without leaving the debugger.** Paused inside a NEX's code, the
  new `nex-label <name>` command (alias `nl`) adds a label to that file's annotations at the offset
  you are stopped at &mdash; and the live disassembly starts using it. It writes a bank-local label,
  because the address is only meaningful as an offset in its bank. With the NEX's viewer open the
  label joins your unsaved annotation edits and is kept when you save them; with the viewer closed
  it is written straight to the `.nex.dis` file.
- **Your NEX labels appear in the live disassembly.** With a NEX launched, the Disassembly view names
  operands from the labels you wrote in the NEX viewer &mdash; `call DrawSprite` rather than
  `call $C100`. A bank's own labels apply only while that bank is paged in, so the names follow the
  program as it pages; labels you made global apply everywhere.
- **A bank listed at `$4000` no longer disassembles the screen.** That range is the ULA screen
  &mdash; bitmap and attributes, `$4000`&ndash;`$5AFF` &mdash; and it used to fill the listing with
  thousands of rows of decoded pixels ahead of the code. It now collapses to a single line, and a
  **Screen** switch in the toolbar brings the disassembly back when you want it. The switch appears
  only for a NEX bank listed at `$4000`, and it changes the listing only: regions and annotations you
  made inside the range are kept.
- **Follow a label to where it is defined.** A NEX bank's disassembly context menu opens with **Go to
  Definition** whenever the line names a label &mdash; `ld hl,InitPalettes` &mdash; and it takes you
  there. A definition inside the bank on screen is a scroll, and works with no machine running. One
  outside it needs a machine, because which bank holds an address depends on how the program has
  paged memory: with one running, that bank is brought forward and scrolled to the label; without
  one, the command is greyed rather than guessing. `Ctrl+F12` reaches it from the listing &mdash;
  plain `F12` is the macOS Step Into accelerator, so it was not free to take.
- **A popped-out NEX bank shows the machine, not the file &mdash; without being asked.** Whenever a
  machine is running, both the bank's memory *and* its disassembly are built from the bank's current
  contents, with every byte that differs from the file marked and counted in the toolbar. This is how
  self-modifying code, a decompressed payload, or a bank corrupted by a stray write become visible
  &mdash; none of it can be told from a clean load otherwise. It works for every bank of the file,
  including ones the program has paged out, and falls back to the file's bytes when no machine is
  running. There is no switch to find: a `Live` marker in the toolbar says which of the two you are
  looking at.
- **A paused NEX bank's disassembly is aligned to the program counter.** Decoding a bank from its
  first byte is a guess about where instructions start, and self-modifying code or a jump table can
  make it wrong for everything below. While the machine is paused with the PC inside the bank, the
  listing is cut and re-decoded at the PC &mdash; the one offset where the alignment is known rather
  than guessed &mdash; so the rows from there on are the instructions that will actually run. A
  listing that was already aligned is left exactly as it was.
- **The Memory Mapping panel says which slots hold banks of the NEX you launched.** Hovering a page
  row names the file when that bank is one the NEX declares &mdash; so you can tell at a glance which
  bank to pop out. It names the file rather than claiming what the slot currently holds: the program
  is free to have overwritten the bank, and popping the bank out is what answers that &mdash; its
  view is the machine's bytes, with the differences from the file marked.
- **A popped-out bank highlights the line the program counter is on.** While the machine is paused
  and the PC is inside that bank, its disassembly marks the current instruction the way the
  Disassembly view does, and the toolbar adds a `PC` marker so you can tell without hunting for it.
- **A popped-out ZX Spectrum Next bank says where it is paged in.** Its toolbar shows `Bank at
  $8000`, or `Bank not paged in`, updated as the machine runs — with the 8K slot numbers in the
  tooltip, and a note that a paged-out bank's breakpoints stay armed and will fire once it comes
  back. A bank whose two 8K halves are not paged in as one block is reported as exactly that.
- **The NEX viewer counts the breakpoints in each bank.** A bank's heading shows how many it carries,
  with the breakdown by type in the tooltip, so a collapsed bank still tells you it is armed.
- **Run to a line.** The new `run-to` command (alias `rtc`) runs the machine until it reaches an
  address and then stops, leaving no breakpoint behind. It accepts everything `bp-set` does,
  including the Next's bank-relative `05:+$0100` form, so you can run to an offset inside a bank that
  is not paged in yet. Hold <kbd>Ctrl</kbd> (<kbd>Cmd</kbd> on macOS) and click the breakpoint margin
  in the Disassembly view or a popped-out NEX bank to do the same thing without typing a command.

## 0.57.1

### Fix

- Klive Z80 Assembler handles the first operand of BIT, SET, and RES properly

## 0.57.0

### Features

- Experimental integration with PASTA/80

## 0.56.0

### Features

- Extending the Z80 Assembly editor:
  - Semantic syntax highlighting
  - Macro expansion preview
  - Code folding for assembler blocks
  - Block pair highlighting
  - Rename symbol
  - Address and byte count on hover
  - Go to included file
  - Color decorators for attribute 
- Extending the table of ZX Spectrum Next system variables

## 0.55.0

### Features

- Add new view options to the memory panel, highlight the selected character too
- Add experimental screen recording feature to the emulator

### Fixes

- Fix the "Select ROM File" issue on Windows
- Fix the Edit Memory Content function

## 0.54.0

### Features

- You can change the ZX Spectrum 48 ROM
- New text editor for text file types
- New binary editor for viewing binary file content
- New image viewer to display bitmap images

## 0.53.2

### Fixes

- Introduce "cursorl" with the same functionality as "cursork" (deprecated)

## 0.53.1

### Fixes

- Fix .tzx and .tap export functionality (issue #1151)

## 0.53.0

### Fixes

- Use token colors with more contrast in the light theme
- Experimenting with turning off the AppImage sandbox

### Features

- Allow token color customization

## 0.52.0

### Features

### Fixes

- Fix the ZX Spectrum 128 banked code injection issue

## 0.51.1

### Fixes

- Remove screen flickering

## 0.51.0

### Features

- Add scanline effect to machines supporting it
- Preload screen changed

### Fixes

- Monaco editor loading issue fixed
- Flash rate fixed

## 0.50.4

### Features

- Removed .MSI installer for Windows
- Added compression: "store" to NSIS config (disables compression for faster antimalware scanning)
- Removed ASAR unpacking of compilerWorker files (reduces loose files that trigger scanning)

## 0.50.3

### Features

- Add .MSI installer for Windows

## 0.50.2

### Fixes

- Resolve the Windows 11 "installer hang" issue by updating to the newest electron-builder version

## 0.50.1

### Fixes

- The SjasmPlus compiler DISPLAY output is now shown

## 0.50.0

### Features

- Watch panel prototype

## 0.49.4

### Fixes

- Fix the freeze of paused (restarted) emulator

## 0.49.3

### Fixes

- Fix ZXBASIC compilation issue (TypeError)

## 0.49.2

### Fixes

- Fix annoying startup issues after a fresh install

## 0.49.1

### Features

- SjasmPlus Z80 Assembler integration
- New IDE options
- New Editor options

### Fixes

- Dozens of helpful fixes

## 0.34.0 - 0.49.0: Private builds

## 0.33.0

### Features

- Shadow Screen feature (https://dotneteer.github.io/kliveide/howto/shadow-screen)
- ZX Spectrum Next implementation now handles startup from SD Card

## 0.32.3

### Fixes

- The Create new Klive Project dialog correctly handles the project folder path on Windows.

## 0.32.2

Updated to Electron Shell v33.0.2

## 0.32.1

### Features

- ZX Spectrum Next implementation started

### Fixes

- The faulty install kit with the empty emulator and IDE windows is fixed.
- Creating a new Klive IDE now also sets the build root file on Windows.

## 0.32.0

### Features

- Klive now has a scripting system that uses JavaScript-like language.
- The IDE has a new customizable build system (rudimentary) that uses scripts in the `build.ksx` file. *Note*, if you use an old project format, you may need to update it. See instructions [here](https://dotneteer.github.io/kliveide/getting-started/creating-project#updating-old-projects).
- You can [change the default file extensions](https://dotneteer.github.io/kliveide/howto/file-extensions) and associate them with compilers.

## 0.31.1

### Fixes

- Fix the segment loading issue in the ZX Spectrum 128 exported file loader

## 0.31.0

### Features

This build represents a preview of new features being built into the IDE. The release also adds new machine types:
- ZX Spectrum 16K
- ZX Spectrum 48K (NTSC)
- Greatly improved (still in progress) Cambridge Z88

Though the ZX Spectrum Next emulator is in a very initial state, some rudimentary tooling started regarding the ZX Spectrum Next app development:
- `.z80` file viewer
- `.scr` file viewer
- `.nex` file viewer
- `.spr` sprite editor
- `.pal` and `.npl` palette editors

This release contains numerous minor updates to improve user experience.

## 0.30.5

### Fixes

- `.includebin` pragma length issue fixed

## 0.30.4

### Fixes

- The IDE saves the zoom factor at exit and reloads it with a new start
- A few IDE startup bugs fixed
- Toolbar, status bar, primary and tool panel states are saved
- Status bar PC refresh fixed

### Features

- New install kits for ARM64 (MacOS and Linux)

## 0.30.3

### Fixes

- Remove log message preventing Klive from starting

## 0.30.2

### Fixes

- ZX Basic integration (now Python path can be set)
- The Create New Klive project now works in the packaged product.
- Installer fixes
- Fixing IDE closing issues

### Documentation

- Many new articles have been added to help get started with Klive

## 0.30.1

Failed on internal tests, not released publicly.

## 0.30.0

This version of Klive is a significant update with an entirely new architecture. It is not just about new features and bug fixes but a rethought, brand-new Klive IDE. These are the essential changes:

- It is entirely written in TypeScript, with no WebAssembly anymore.
- The build is based on Vite.
- The documentation engine has been changed from Jekyll to Nextra.

## 0.12.4

### IDE

#### Fixes

- Uppercase conditions in Z80 instructions (like `call Z,nnnn`) now work correctly

## 0.12.3

### IDE

#### Fixes

- Find/Replace dialog now shows icons on MacOS
- (ZXBASIC) path resolution works correctly on Linux

## 0.12.2

### IDE

#### Fixes

- Copy/paste is available on Mac
- You can add new builder roots (https://dotneteer.github.io/kliveide/getting-started/building-and-running-code#specify-additional-build-root-file-extensions)
- Source code debugging now navigates to the current execution point/breakpoint

## 0.12.1

### IDE

#### Fixes

- ZXBC command line execution now works on Mac

## 0.12.0

### Emulator

#### Features

- ZX Spectrum now passes these tests: FloatSpy, MemPtr, 48K_Timings, ZexAll
- ZX Spectrum +2E/+3E implementation in progress

#### Fixes

- Refactor the Z80/ZX Spectrum core
- Fix asynchronous React components

### IDE

#### Features

- Diagnostics mode can be turned on and off (https://dotneteer.github.io/kliveide/documents/detecting-klive-issues)
- The project file now opens in read-only mode
- File types have new icons
- Code injection support for ZX Spectrum 128K
- ZXBASM integration (https://dotneteer.github.io/kliveide/getting-started/try-run-zxbasm-code)

#### Fixes

- Several code parsing bugs fixed in the Klive Z80 compiler
- Eliminate worker thread when running the Klive Z80 compiler
- Update build roots and breakpoints in the project file when renaming or deleting project files
- First time start issue with the New Klive project
- Various small issues fixed in the Project Explorer

### Known Issues

- ZXBC command line execution does not work properly on Mac
- Create New Klive Project may raise permission issues on Mac and Linux

## 0.11.0

The brand newA new approach of Klive with its IDE -- no Visual Studio Code integration needed.

## 0.9.0-alpha.9

### Klive Emulator

#### Features

- Cambridge Z88 Emulation handles
    - Hard & soft reset
    - Extra screen resolutions
    - Selecting custom ROM
    - Keyboard layouts for UK, DK/NO, SE/FI, DE, FR, and ES
    - Sound emulation
    - New Real-Time Clock implementation
- Statusbar can be turned on and off
- Frame information on statusbar can be turned on and off
- Developer Tools is displayed only when connected to the IDE
- Machine-specific Help menu items
- Saving emulator settings (machine-specific) to a file when exiting the emulator

#### Refactorings

- Emulator updated to Electron 11.1; uses context isolation

#### Fixes

- ZX Spectrum 48/128 interrupt signal is no longer (256 microsecond), as in the real hardware.

### Klive IDE

#### Fixes

- Report an error when ZXBC utility cannot be found

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.8.0-alpha.8

### Klive Emulator

#### Known Issues

- ZX Spectrum 128 memory view and disassembly view has some discrepancies

#### Features

- Cambridge Z88 Emulation is now handles interrupts, keyboard, and screen rendering (the implementations is still in progress)

#### Fixes
- Timing issues with LDIR/LDDR operating on ROM fixed.
- ZX Spectrum 48/128 interrupt signal is no longer (256 microsecond), as in the real hardware.

### Klive IDE

#### Features

- Z80 & Other Registers view contains machine-specific diagnostics information for each machine type
- The IDE contains Execute Klive command that you can use to set up absolute breakpoints, among the others

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.7.0-alpha.7

### Klive Emulator

#### Known Issues

- ZX Spectrum 128 memory view and disassembly view has some discrepancies

#### Features

- Cambridge Z88 Emulation is supported (the emulator is still in progress)
- You can select sound level in the Emulator (from the Machine menu)

#### Fixes
- You can set the ZX BASIC optimization level between 0 and 4 (instead of 0 and 3)
- Emulator screen refresh fixed
- Sound lag fixed
- Stuck key issue (when using Windows/Command key) fixed

#### Others

- The Emulator's internal architecture has been significantly refactored. Now, it's much easier to add new virtual machine types with their pecuiliarities. 
    - The standard Z80 and the Z80 Next CPUs are separated
    - Each virtual machine has its separate WebAssembly files
    - Now, virtual machines are based on a generic Z80 machine model
- The development of the ZX Spectrum Next model started

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

## 0.6.0-alpha.6

### Klive Emulator

#### Known Issues

- There still might be sound lag issues on Mac. It's likely some strange issue (or bug) in Electron.

#### Features

- Now, ZX Spectrum 48/128 floating port is implemented.
- You can inject machine code from the IDE and run it within the Emulator.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- `.z80asm` files with syntax highlighting and immediate syntax check
- `.bor`, `.zxbas`, `.zxb` files with Boriel's Basic syntax highlighting (with embedded Z80 Assembly)
- The IDE has its integrated Z80 Assembler
- The IDE runs Boriel's Basic compiler, provided you install and configure this feature
- New command available form Z80 assembly and Boriel's Basic files: **Compile**, **Inject Code**, **Run Program in the Emulator**

#### Fixes

- A few annoying issues have been fixed in the disassembly view; disassembly generation is now about five times faster.

#### Others

- You can find new Getting Started articles here: [https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html](https://dotneteer.github.io/kliveide/getting-started/install-kliveide.html)


## 0.5.0-alpha.5

### Klive Emulator

#### Known Issues

- The ZX Spectrum 48 and 128 models do not implement the floating port feature yet.

#### Features

- You can toggle Fast Load mode while the ZX Spectrum machine runs
- The toolbar contains a Rewind button to reset the tape to its initial position

#### Fixes

- Sound generation now uses `AudioWorkletProcessor` to fix sound issues on Mac.
- Windows restore works normally on Mac.
- The Emulator displays an error message when loading a tape file fails.
- Keys do not struck when left-Alt or Command key is used.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- The IDE looks for the Emulator within the user's home folder, too.
- The IDE can send tape files to Emulator without restarting the virtual machine.
- You can select the machine type with the Update Klive Project command.
- The Memory view supports Spectrum 128 ROM and Bank pages.

#### Fixes

- The IDE does not display the "Cannot communicate with the executable" message when successfully strating the Emulator.
- The Update Klive Project now adds a code file (`code.z80asm`) to the project.
- The extension supports in initial model of Z80 Assembly language service (work in progress) that uses Z80 Assembly syntax highlighting.

#### Others

- Z80 Assembler building is in progress.

## 0.4.0-alpha.4

### Klive Emulator

#### Known Issues

- The ZX Spectrum 48 and 128 models do not implement the floating port feature yet.

#### Features

- The Emulator supports the ZX Spectrum 128 machine type, including PSG sound emulation.
- You can select a machine type in the Emulator.
- You can specify the type of machine used for startup.
- The SAVE command saves the ZX Spectrum code into a `.tzx` file to the folder configured in Klive IDE.
- You can configure the port the Emulator uses to listen to IDE commands.
- You can select a tape file to load directly from the Emulator.
- The Emulator displays when the IDE is connected, it disables a few features (such as machine type change and tape selection)

#### Fixes

- The flag setting bug with the `DEC (IX+d)` Z80 instruction is fixed.

### Klive IDE

#### Known Issues

- Disassembly View does not refresh automatically when the selected ROM or Bank changes.

#### Features

- The IDE looks for the Emulator within the user's home folder, too.
- The IDE can send tape files to Emulator without restarting the virtual machine.
- You can select the machine type with the Update Klive Project command.
- The Memory view supports Spectrum 128 ROM and Bank pages.

#### Fixes

- Step-over debug mode works properly with both ZX Spectrum machine types

#### Refactorings

- The virtual list used in the Memory and Disassembly views has been refactored to a more stable and faster one.
- The Memory view now uses the `innerHTML` technique instead of component-rendering to enhance performance.

## 0.3.0-alpha.3

### Klive Emulator

#### Features

- Now, it supports the step-over and step-out debug functions.
- The Emulator acceps tape files sent from the Klive IDE.
- The virtual machine screen displays an overlay with the execution state.
- The virtual machine allows CPU clock frequency multiplication. It support 3.5MHz, 7MHz, 10.5HMz, 14MHz, 17.5MHz, 21MHz, 24.5MHz, and 28MHz modes, too.
- The statusbar displays the number of screen frames since starting the virtual machine.
- The emulator supports displaying the screen rendering beam position

#### Fixes

- The virtual keyboard keys provide a larger surface to click symbol keys.
- Sound works properly with CPU clock frequency multiplication.

### Klive IDE

#### Features

- The project now has Github Pages documentation: https://dotneteer.github.io/kliveide/
- The disassembly view now displays ROM annotations.
- The disassembly view displays the breakpoints with different colors when not in debug mode.
- Now you can use the memory view.
- Both the disassembly and the memory view support the **Go To Address** and **Refresh** commands.
- You can send tape files to the Emulator.

#### Fixes

- The `chokidar` package has been removed from the build, as it was unreliable on Mac and Linux
- The **Create Klive Project** command signs when no project folder is open in VS Code

## 0.2.0-alpha.2

### Klive Emulator

#### Features

- Tape sound is enabled when loading program from tape
- Toolbar button to mute/unmute sound
- Displays engine and rendering frame time information in the status bar
- Displays Klive version information in the status bar
- Emulator pauses at breakpoins set in the Klive IDE
- Emulator supports the **step-into** debugger command

#### Fixes

- Mac and Linux build supported

### Klive IDE

#### Features:

- Z80 register view enhanced with flags and 8-bit registers
- Displays Klive status (disconnected/connected/running/paused/stopped) in VS Code status bar
- You can click to the disconnected Klive status in the VS Code statusbar to re-start Klive Emulator
- **Create Klive Project** command to generate a boilerplate ZX Spectrum project
- **Z80 Disassembly view** when selecting the `view.disassembly` file
- You can add and remove breakpoints in the Z80 Disassembly view
- The disassembly view displays the current execution point as you run the emulator
- The disassembly view navigates to the current execution point when the emulator is paused


## 0.1.0-alpha.1

Initial release:
- Klive Emulator, VS Code, and Klive VS Code Extension integration
- Z80 Registers view within the Debug activity tab
