# Commodore 64 Emulator Implementation Overview

## Introduction

This document outlines the implementation approach for the Commodore 64 (C64) emulator within the Klive IDE project. The emulator aims to accurately recreate both the original C64 and its updated C64C model, with compatibility for running most original programs and games while supporting common peripheral interactions.

## Emulation Goals

The C64 emulator implementation focuses on these key objectives:

1. **Accurate hardware emulation** of both C64 and C64C models
2. **High compatibility** with original C64 software library
3. **Peripheral support** for common tape and floppy disk operations
4. **Integration with Klive IDE** features for debugging and development

## System Architecture

The Commodore 64 is built around the following core components:

- **CPU**: MOS Technology 6510 (a modified 6502 with I/O port)
- **Graphics**: MOS 6566/6567 (NTSC) or 6569 (PAL) Video Interface Chip (VIC-II)
- **Sound**: MOS 6581 (original C64) or 8580 (C64C) Sound Interface Device (SID)
- **I/O Controller**: MOS 6526 Complex Interface Adapter (CIA) - two chips
- **Memory**: 64KB RAM with various ROM segments
- **Storage Devices**:
  - **Tape Drive**: Commodore Datasette (1530/1531) 
  - **Floppy Disk**: Commodore 1541 Disk Drive (behavioral emulation of responses and protocols)

## Implementation Strategy

The emulator is implemented using a modular approach that separates the different hardware components while ensuring they interact correctly through the system bus and timing mechanisms.

For the 1541 floppy disk drive, a behavioral emulation approach is used rather than full hardware emulation. This focuses on accurately reproducing the communication patterns and drive responses without implementing the complete internal hardware (including the drive's 6502 CPU). This approach provides good compatibility while reducing complexity and resource usage.

## 6510 CPU Architecture

- **Registers**:
  - Accumulator (A): 8-bit register for arithmetic and logical operations
  - X and Y Index Registers: 8-bit registers for indexing and counting
  - Stack Pointer (S): 8-bit register pointing to the stack in page 1 ($0100-$01FF)
  - Program Counter (PC): 16-bit register holding the address of the next instruction
  - Processor Status (P): 8-bit register with status flags (C, Z, I, D, B, V, N)
  - Processor Port: Special 6510 feature - I/O port at address $0001 controlling memory banking

- **CPU Port**:
  - Data Direction Register at $0000 controls which bits are inputs/outputs
  - Data Register at $0001 controls memory banking and IEC lines
  - Bits 0-2: Memory configuration control
  - Bits 3-5: Connected to IEC bus (CIA2 port lines)
  - Bits 6-7: Unused

- **Addressing Modes**:
  - Implied/Implicit: No operand needed (e.g., `CLC`)
  - Immediate: Operand is a constant value (e.g., `LDA #$42`)
  - Zero Page: Operand is in memory locations $0000-$00FF (e.g., `LDA $42`)
  - Zero Page,X/Y: Zero page with index register offset (e.g., `LDA $42,X`)
  - Absolute: Full 16-bit memory address (e.g., `LDA $1234`)
  - Absolute,X/Y: Absolute with index register offset (e.g., `LDA $1234,X`)
  - Indirect: Address points to location containing the target address (e.g., `JMP ($1234)`)
  - Indexed Indirect (X): Zero page, X-indexed, points to target address (e.g., `LDA ($42,X)`)
  - Indirect Indexed (Y): Zero page points to address, Y-indexed (e.g., `LDA ($42),Y`)
  - Relative: Branch instructions with signed 8-bit offset (e.g., `BEQ $+10`)

- **Instruction Set**:
  - Official Instructions: 56 different instructions with 151 opcodes
  - Undocumented Instructions: 12+ undocumented but functional instructions
    - LAX: Load Accumulator and X register
    - SAX: Store Accumulator AND X register
    - DCP: Decrement memory and Compare
    - ISC/ISB: Increment memory and Subtract from Accumulator
    - SLO: Arithmetic Shift Left and OR
    - RLA: Rotate Left and AND
    - SRE: Logical Shift Right and EOR
    - RRA: Rotate Right and Add

- **Interrupts**:
  - IRQ (Interrupt ReQuest): Maskable interrupt, vector at $FFFE-$FFFF
  - NMI (Non-Maskable Interrupt): Cannot be disabled, vector at $FFFA-$FFFB
  - RESET: System reset, vector at $FFFC-$FFFD
  - BRK: Software interrupt, uses IRQ vector but sets B flag

- **Emulation Challenges**:
  - Accurate implementation of undocumented instructions is essential for compatibility with many games
  - The JMP ($xxFF) bug where the indirect jump incorrectly wraps within a page must be replicated
  - Cycle-exact timing is crucial for compatibility with software that relies on precise timing
  - Decimal mode arithmetic must be implemented correctly, unlike some other 6502 emulators
  - Proper processor port emulation at $0001 is required for correct memory banking
  - CPU port bits connected to the IEC bus have capacitor-like behavior that affects timing
  - The capacitive effect on port pins causes delayed transitions that some fast loaders rely on
  - Accurate modeling of the interaction between CPU port and CIA2 port for IEC bus control

## Memory Organization

- **RAM**: 64KB of RAM from $0000-$FFFF
- **ROM**: Overlaid on RAM at specific addresses when enabled:
  - BASIC ROM: $A000-$BFFF (8KB)
  - KERNAL ROM: $E000-$FFFF (8KB)
  - CHARACTER ROM: $D000-$DFFF (4KB, when I/O is disabled)
- **I/O Area**: $D000-$DFFF when enabled
  - VIC-II: $D000-$D3FF (but only uses 64 registers)
  - SID: $D400-$D7FF (but only uses 29 registers)
  - Color RAM: $D800-$DBFF (1000 bytes, 4-bit nibbles)
  - CIA 1: $DC00-$DCFF (keyboard, joystick, etc.)
  - CIA 2: $DD00-$DDFF (serial bus, user port, etc.)
- **Memory Banking**: Controlled by processor port at $0001
  - Bits 0-2 control which ROM areas are visible
  - Different configurations for different tasks (BASIC, Kernel development, cartridges)

- **Emulation Challenges**:
  - Implementing the complex memory banking system with multiple overlapping address spaces
  - Accurately handling the transition timing when switching memory configurations
  - Managing read/write access properly (some locations are read-only or write-only)
  - Emulating special behavior of Color RAM (only 4 bits per byte are used)
  - Dealing with cartridge ROMs and their various banking schemes
  - Correctly implementing the interaction between the CPU's processor port and memory mapping

## VIC-II Video Generation

- **Registers**: 47 registers controlling display modes, sprites, and timing
- **Display Modes**:
  - Standard character mode (text)
  - Multicolor character mode
  - Extended background color mode
  - Bitmap mode (standard and multicolor)
  - Mixed text/graphics modes
- **Sprites**: 8 hardware sprites with collision detection
- **Raster Interrupts**: Ability to trigger interrupts at specific scanlines
- **Display Timing**:
  - 262 scanlines (NTSC) or 312 scanlines (PAL)
  - 63 cycles per scanline
  - "Bad lines" where CPU is paused for character data fetching

- **Emulation Challenges**:
  - Cycle-exact rendering is crucial for many demo effects and games
  - Implementing "bad lines" where the CPU is suspended for VIC-II memory access
  - Correctly handling sprite collisions and sprite-background collisions
  - Emulating border effects and open borders tricks used in demos
  - Accurately implementing the relationship between screen refresh and CPU timing
  - Handling differences between NTSC and PAL versions of the VIC-II
  - Implementing special timing-based tricks like sprite multiplexing

## SID Audio Synthesis

- **Voices**: 3 independent sound generators
- **Waveforms**: Square, triangle, sawtooth, and noise
- **ADSR Envelope**: Attack, Decay, Sustain, Release volume control
- **Filters**: Low-pass, band-pass, high-pass, with resonance control
- **Special Features**: Ring modulation, synchronization, and filter sweeps

- **Emulation Challenges**:
  - Accurately reproducing the analog characteristics of the SID in digital form
  - Simulating filter behavior, which varies between chip revisions
  - Implementing precise ADSR envelope timing
  - Replicating the unique distortion characteristics of the SID
  - Handling differences between 6581 (original) and 8580 (revised) SID models
  - Emulating quirks like combined waveforms and DC offset
  - Dealing with sampled sounds that exploit SID register behavior

## CIA Interface Adapters

- **Timers**: Two 16-bit timers per CIA chip
- **I/O Ports**: Two 8-bit parallel ports per CIA chip
- **Special Functions**:
  - CIA 1: Keyboard matrix, joystick inputs, IRQ generation
  - CIA 2: Serial bus control, user port, NMI generation
- **Time of Day Clock**: Real-time clock with hours, minutes, seconds, tenths

- **Emulation Challenges**:
  - Correctly implementing timer operation including cascading timer modes
  - Accurate CIA-generated interrupt timing is essential for many timing-sensitive operations
  - Properly handling keyboard scanning and joystick input through CIA ports
  - Emulating the Time of Day clock with correct update frequency
  - Implementing complex interactions between CIA 2 and the serial bus for disk operations
  - Accounting for differences between CIA chip revisions (6526, 6526A)
  - Handling edge cases in timer behavior that some software relies on

## Peripheral Interfaces

- **Serial Bus (IEC)**: Protocol for disk drives and printers
  - DATA, CLK, and ATN lines
  - Bit-level timing requirements
  - Lines are driven by both CPU port and CIA2 port
- **Datassette Interface**: Dedicated port for tape operations
  - Motor control, read/write signals
  - Timing-sensitive data encoding
- **User Port**: Programmable parallel I/O
- **Cartridge Port**: Direct CPU and address/data bus access

- **Emulation Challenges**:
  - **Serial Bus**:
    - Implementing correct timing of the IEC protocol for disk drive communication
    - Supporting various disk drive fast loaders that use custom protocols
    - Handling bus arbitration between multiple devices
    - Accurately emulating the capacitor-like behavior of IEC lines
    - Correctly implementing the dual control of IEC lines by both CPU port and CIA2
    - Modeling signal transition delays that fast loaders exploit
  
  - **Datassette**:
    - Accurately emulating tape signal timing for reliable loading
    - Supporting various tape protection schemes
    - Implementing motor control and sensing
    - Dealing with various tape formats and encodings
  
  - **Cartridge and User Port**:
    - Supporting various cartridge types with different memory configurations
    - Implementing cartridge ROM banking schemes
    - Handling special cartridge hardware like the Final Cartridge or Action Replay
    - Emulating user port peripherals like modems or MIDI interfaces

## Key Challenges

### Hardware Component Challenges

- **CPU (6510)**:
  - Accurate implementation of undocumented opcodes
  - Proper handling of the integrated I/O port
  - Cycle-accurate execution timing

- **VIC-II**:
  - Complex raster timing and interrupt generation
  - Sprite collision detection and priority handling
  - Special display modes and effects (multi-color, extended background)
  - Screen border timing and rendering

- **SID (6581/8580)**:
  - Accurate waveform generation and filter implementation
  - Modeling differences between chip versions
  - Emulating analog characteristics digitally

- **CIA Chips**:
  - Timer operation and interrupt generation
  - Real-time clock functionality
  - I/O port handling for keyboard and joysticks

- **Storage Devices**:
  - Datasette timing and motor control
  - 1541 drive behavioral emulation:
    - IEC serial bus protocol implementation
    - Disk image format handling (D64, G64)
    - Command response simulation
    - Appropriate timing characteristics

### System Integration Challenges

- **Bus Contention**: 
  - Managing shared access to the system bus
  - VIC-II and CPU memory access coordination
  - Cycle stealing between components

- **Timing Synchronization**:
  - Maintaining proper timing relationships between all components
  - Handling PAL vs. NTSC timing differences
  - IRQ and NMI generation and handling

- **Memory Management**:
  - Bank switching between ROM and RAM
  - Cartridge ROM mapping
  - Character ROM and I/O mapping

- **Peripheral Communication**:
  - Serial bus protocol implementation (IEEE-488 derived)
  - Tape data encoding/decoding
  - IEC bus timing for floppy drive communication

- **Debugging Integration**:
  - Non-intrusive monitoring of internal state
  - Breakpoint handling across multiple CPUs (main system and disk drive)
  - Visual representation of complex hardware states
