# Klive IDE Changelog

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
