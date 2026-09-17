# Klive IDE Changelog

## Unreleased

### Fixes

- **A popped-out NEX bank could be open twice.** Opening a bank from the NEX viewer and then
  stopping in it while debugging (or following a label into it) gave two documents for the one
  bank, and the debugger scrolled the one you were not looking at. The two also carried different
  tab titles.
- *Go to Definition* landed at the start of the line instead of on the symbol.
- Opening a file whose viewer is not a code editor through the `nav` command (the NEX viewer, for
  example) took about five seconds.
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

## 0.58.0

### Features

- Multiple document hubs are avaliable through Split Right and Split Down document tab context menus
- Context menus and modal dialogs re-styled

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
