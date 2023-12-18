# Klive IDE Project

Quick links:
- [What Klive IDE Is](#what-klive-ide-is)
- [Klive Documentation](https://dotneteer.github.io/kliveide/)
- [Release v0.30.4](https://github.com/Dotneteer/kliveide/releases/tag/v0.30.4)

## Announcement

**Klive IDE is about to receive a significant update affecting its functionality, stability, and internal architecture. Now, you can access the first release of this train of updates, v0.30.3.**

This new version, due to the new architecture, removes annoying issues and implements long-awaited features such as exporting code, viewing the structure of tape files, and improved source code debugging.

New and improved features at a glance:
- Exporting compiled code into `.tzx` or `.tap` files
- Viewers for `.tzx` and `.tap` files
- New disk format (standard `.dsk`) for ZX Spectrum +3E
- Viewer for `.dsk` files
- Brand new Basic Listing (with ZX Spectrum font support)
- New Memory view
- New Disassembly view
- Exclude files/folders from a project
- ZX Spectrum 128 Keyboard
- Keyboard mapping customization
- More stable ZX Basic integration
- New source code debugging architecture
- New integration architecture to allow future integration with external compilers and tools

> **Note**: The new release brings a new project file format. You will still be able to work with your Z80 assembly and ZX Basic source files; however, you should manually migrate your projects from the old format. I do not plan to add migration tools, but I will provide simple instructions. Sorry for that inconvenience. I plan to use my time to deliver more significant features!

**After the release, I will entirely focus on the new version and plan to abandon supporting the old ones gradually.**

## How You Can Contribute

I run this project for fun (my first computer was a ZX 81, and then I got a ZX Spectrum 48K). I never plan to earn money from this project; however, I am looking for networking opportunities and collaboration with Sinclair computer fans.

Klive is entirely written in TypeScript (using the Electron Shell and React). I'd be happy if you could contribute to the project, whether just mending documentation or other text typos, making small changes, fixing bugs, or even adding new features.

If you're interested, contact me through dotneteer@hotmail.com!

## What Klive IDE Is

**Klive IDE is a retro computer emulator and Integrated Development Environment running on Mac and Windows.**

Klive offers not only the emulators but also debugging views, a multi-pane code editor, interactive commands, and other tools to create your Z80 Assembly and ZX BASIC (Boriel's Basic) programs.

Klive IDE supports dual monitor mode to place the Emulator and IDE on different monitors while working with code.

![Intro](/public/images/intro/klive-ide-intro.png)

### Supported Emulators

Klive IDE intends to support retro computers with the Z80 family of CPUs. Klive supports these emulators:

- **ZX Spectrum 48K**
- **ZX Spectrum 128K**
- **ZX Spectrum +2E/+3E** (*in progress*)
- ZX 80/81 (*in the future*)
- Cambridge Z88 (*in the future*)
- ZX Spectrum Next (*in the future*)

### Emulator Features

The emulator can run the selected machine with or without debugging. These modes can be changed without restarting the running machine:

- Starting, pausing, continuing to run
- Start or continue in debug mode
- Setting up breakpoints, step-in, step-over, step-out modes

To examine the state of the emulator, Klive offers several views:

- Full CPU view
- Full ULA view
- Memory view with live refresh
- Disassembly view with execution point tracking
- Monitoring system variable values
- Displaying (and exporting) the current BASIC listing

You can quickly load and play programs (games) from files:

- Loading tape files (`.tap` and `.tzx`)
- Fast load
- Loading from disk files (`.dsk`) with ZX Spectrum +3E
- Writing and formatting disk (`.dsk`) files (*in progress*)

Other emulator features:

- Visual keyboard (ZX Spectrum 48K and ZX Spectrum 128K styles)
- Multiplying CPU clock speed (1-24 multiplier)
- Setting up the sound level, muting and unmuting sound

Planned features (*in the future*):

- Using custom machine ROMs
- Memory read/write breakpoints
- I/O read/write breakpoints
- Breakpoints with hit count conditions

### IDE Features

The IDE allows you to open project folders that keep the files belonging to a particular (development) project together. You can use Z80 Assembly language (with the built-in Klive Z80 Assembler) and ZX BASIC (Boriel's Basic) as your programming language.

- Syntax highlighting
- Source code debugging (works with the Klive Z80 Assembler)
- Exporting the compiled code to tape files (`.tap` and `.tzx) with BASIC loaders

Klive's unique feature is the one-click start and debugging: With a click of one button, your code is compiled and injected into the selected emulator and immediately starts up. You can start your code with debugging (or pause it and continue with debugging).

Commands: The IDE has an interactive command panel to issue CLI commands executed within the IDE.

Planned features (*in the future*):

- Watch Panel: display runtime information about memory variables (expressions)
- Conditional breakpoints
- Integration with other assemblers, including compilation and optional source code debugging (if the particular compiler supports debug symbol information).
