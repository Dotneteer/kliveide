# C64 Emulator Implementation Context (v1.1)

This document provides context about the C64 emulator implementation in the Klive IDE project. GitHub Copilot will automatically use this information to provide more relevant assistance during development.

## Project Goals

- Emulate both C64 and C64C models with high accuracy
- Support running most original C64 programs and games
- Implement common tape and floppy device operations
- Integrate with Klive IDE debugging features

## Implementation Approach

- Modular architecture separating hardware components
- Cycle-accurate CPU and VIC-II implementation
- Accurate SID sound synthesis
- Behavioral emulation of the 1541 disk drive (not full hardware emulation)

## Key Implementation Decisions

### 1541 Disk Drive
- Using behavioral emulation that focuses on communication patterns
- Implementing IEC serial bus protocol
- Supporting disk image formats (D64, G64)
- Simulating command responses with appropriate timing
- Not implementing the drive's 6502 CPU and full hardware

### CPU Port and IEC Bus
- Special attention to the 6510 CPU port at $0000 (data direction) and $0001 (data)
- Accurately modeling the CPU port bits (3-5) connected to the IEC bus lines
- Implementing the capacitor-like behavior of IEC lines, including delayed transitions
- Handling the dual control of IEC lines by both CPU port and CIA2 port
- This is crucial for fast loaders and other timing-sensitive operations

### Component Implementations
- 6510 CPU: Full implementation including undocumented opcodes
- VIC-II: Cycle-accurate with support for all display modes and "bad lines"
- SID: Accurate waveform generation for both 6581/8580 variants
- CIA: Correct timer and interrupt handling

## System Integration Challenges

- Managing bus contention between CPU and VIC-II
- Accurate timing synchronization between components
- Memory bank switching implementation
- Serial bus protocol for peripheral communication
- Special hardware quirks like capacitor effects on IEC lines

## Development Workflow

- Document implementation challenges in `/docs/implementation/c64/`
- Use test-driven development for hardware components
- Prioritize compatibility with common software over edge cases

## Reference Materials

- C64 hardware documentation in `_input/` folder
- Memory map: [Wiki Link TBD]
- VIC-II timing details: [Reference TBD]
- Detailed technical information and emulation challenges available in `/docs/implementation/c64/c64-overview.md`
