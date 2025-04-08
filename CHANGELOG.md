# Klive IDE Changelog

## 0.45.0: Planned private build

- Issue #955
- Issue #954
- Issue #951
- Issue #944
- Issue #899
- Issue #879
- Issue #876


## 0.34.0 - 0.44.1: Private builds

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