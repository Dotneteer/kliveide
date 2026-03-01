# Klive IDE Project

Quick links:
- [What Klive IDE Is](#what-klive-ide-is)
- [Klive Documentation](https://dotneteer.github.io/kliveide/)
- [Release v0.55.0](https://github.com/Dotneteer/kliveide/releases/tag/v0.55.0)

## How You Can Contribute

This project is a passion project—born from a love of retro computing. My first computer was a ZX81, followed by a ZX Spectrum 48K. Klive is my way of honoring that legacy, not for profit, but for the joy of creation and connection. I'm always open to collaboration and would love to meet fellow Sinclair enthusiasts.

Klive is entirely written in TypeScript using Electron and React. Whether you're up for fixing a typo, improving documentation, squashing bugs, or adding new features—every contribution is welcome and appreciated.

If this resonates with you, feel free to reach out: dotneteer@hotmail.com

A heartfelt thanks to these amazing contributors:

- [bits4fun](https://github.com/bits4fun) – for inspiring the project and helping bring Cambridge Z88 emulation to life
- [vrishe](https://github.com/vrishe) – for new IDE features and bug-squashing wizardry
- [TheStruggleForAntiSpaghetti](https://github.com/TheStruggleForAntiSpaghetti), [Pete-L-72](https://github.com/Pete-L-72) – for thoughtful suggestions, testing, and helping to shape a more stable IDE

## What Klive IDE Is

**Klive IDE is a cross-platform emulator and Integrated Development Environment for Sinclair Z80-based computers—built for retro enthusiasts, hobbyists, and developers alike.**

It runs on Mac, Linux, and Windows, providing not just emulation, but also powerful development tools: debugging views, a multi-pane code editor, interactive commands, and much more for your Z80 Assembly or ZX BASIC (Boriel's Basic) programming needs.

With support for dual-monitor setups, you can keep the emulator and IDE side-by-side for a seamless coding experience.

![Intro](/public/images/intro/klive-ide-intro.png)

### Supported Emulators

Klive IDE intends to support retro computers with the Z80 family of CPUs. Klive supports emulation of these computers:

- **ZX Spectrum 48K**
- **ZX Spectrum 128K**
- **ZX Spectrum +2E/+3E**
- **Cambridge Z88**
- **ZX Spectrum Next** (*in progress*)
- ZX 80/81 (*in the future*)
- **Commodore 64** (*experimental, in progress*)

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
