# Klive IDE Changelog

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