# C64 CPU Port and CIA2 IEC Bus Integration

## Overview

The Commodore 64's I/O architecture includes a critical bidirectional communication mechanism between the CPU port and the CIA2 (Complex Interface Adapter) chip. This document explains how this integration works, focusing specifically on the IEC (Inter-Equipment Communication) bus lines, which are used for serial communication with peripherals like disk drives and printers.

## Architecture Components

### 1. CPU Port ($01)

The C64's 6510 CPU has an integrated 8-bit I/O port at memory locations $0000 (direction register) and $0001 (data register). This port serves multiple purposes:

- Memory bank selection (bits 0-2)
- Cassette control (bits 3, 5)
- IEC bus interaction (bits 6-7)

### 2. CIA2 Port A ($DD00)

CIA2's Port A has several functions:

- VIC-II bank selection (bits 0-1)
- IEC bus control (bits 2-7)
  - Bit 2: DATA OUT
  - Bit 6: CLOCK IN
  - Bit 7: DATA IN

### 3. IEC Bus Lines

The IEC bus is a serial bus with three main lines:
- DATA line
- CLOCK line
- ATN (Attention) line

## Bidirectional Wired-AND Logic

The IEC bus uses a "wired-AND" configuration, meaning:

1. Multiple devices can control the same line
2. Any device can pull a line LOW (logical 0)
3. A line is only HIGH (logical 1) when ALL connected devices allow it to be HIGH
4. Lines are pulled HIGH by resistors when no device is driving them LOW

This is a hardware-level implementation that must be accurately emulated in software.

## Emulation Implementation

### Key Challenges

When emulating this bidirectional interaction, we need to:

1. Track which devices are driving each IEC line LOW
2. Implement the wired-AND behavior in both directions
3. Ensure changes in one device are immediately reflected in all connected devices
4. Handle transitions between input and output modes correctly

### Data Structures

In our emulator, we maintain the following state:

```typescript
// In C64Cia2Device
private _cpuPortDrivingDataLow = false;
private _cpuPortDrivingClockLow = false;
```

These flags track when the CPU port is pulling the respective IEC lines LOW.

## Communication Flow

### From CPU Port to CIA2

When the CPU writes to the data register ($01) with bits 6-7 configured as outputs:

```typescript
// C64CpuPortDevice.ts
writeData(value: number): void {
  this._data = value;
  
  // Update external signals
  this.updateExternalSignals();
}

private updateExternalSignals(): void {
  // IEC bus - CPU port can influence IEC bus lines via the "wired-AND" behavior
  // In a real C64, there are hardware inverters in the IEC bus circuit
  // which means a "0" in the CPU port register pulls the corresponding IEC line LOW
  if (this._direction & 0x40) { // If bit 6 is an output
    const dataOut = (this._data & 0x40) === 0; // Active low
    // Signal to CIA2 that CPU port is driving DATA line low
    this.machine.cia2Device.cpuPortDrivingDataLow = dataOut;
  } else {
    // If bit 6 is an input, ensure we're not driving the line
    this.machine.cia2Device.cpuPortDrivingDataLow = false;
  }
  
  if (this._direction & 0x80) { // If bit 7 is an output
    const clockOut = (this._data & 0x80) === 0; // Active low
    // Signal to CIA2 that CPU port is driving CLOCK line low
    this.machine.cia2Device.cpuPortDrivingClockLow = clockOut;
  } else {
    // If bit 7 is an input, ensure we're not driving the line
    this.machine.cia2Device.cpuPortDrivingClockLow = false;
  }
}
```

### CIA2 Reading IEC Lines

When software reads CIA2's Port A ($DD00), the getter respects the wired-AND behavior:

```typescript
// C64Cia2Device.ts
get portA(): number {
  let result = 0;
  
  // Apply data direction register mask
  for (let bit = 0; bit < 8; bit++) {
    const mask = 1 << bit;
    if (this._ddrA & mask) {
      // This bit is configured as output, use internal latch
      result |= (this._portA & mask);
    } else {
      // This bit is configured as input, read from external source
      switch (bit) {
        case 6: // DATA IN (bit 6)
          // Respect the "wired-AND" behavior - if CPU port is driving low, we read low
          if (this._cpuPortDrivingDataLow) {
            // Leave bit 6 as 0 (low)
          } else {
            // No device is pulling it low, so it's high (pull-up resistor)
            result |= mask;
          }
          break;
        case 7: // CLK IN (bit 7)
          // Respect the "wired-AND" behavior - if CPU port is driving low, we read low
          if (this._cpuPortDrivingClockLow) {
            // Leave bit 7 as 0 (low)
          } else {
            // No device is pulling it low, so it's high (pull-up resistor)
            result |= mask;
          }
          break;
        // ... other bits ...
      }
    }
  }
  
  return result;
}
```

## Important Implementation Details

### 1. Reading Registers

When the C64's CPU reads CIA2 register $DD00, we must use the `portA` getter, not the raw value:

```typescript
readRegister(regIndex: number): number {
  regIndex &= 0x0F; // Limit to 16 registers (0-15)
  
  switch (regIndex) {
    case 0x00: return this.portA; // Use the getter, not this._portA
    // ... other registers ...
  }
}
```

### 2. Direction Changes

When the CPU port's direction register changes, we must update the IEC signals:

```typescript
writeDirection(value: number): void {
  const oldDirection = this._direction;
  this._direction = value;

  // Additional logic for capacitor effects, etc.
  
  // Update external signals when direction changes
  // This is important for IEC bus lines when they switch between input/output
  this.updateExternalSignals();
}
```

## Common Programming Patterns

### 1. Fast Loading Techniques

Many fast loaders manipulate the CPU port directly to control IEC lines:

```assembly
; Configure CPU port for IEC control
LDA #%11000000    ; Set bits 6-7 as outputs
STA $00           ; CPU port direction register

; Pull DATA line low
LDA #%10000000    ; Bit 6 low (DATA), bit 7 high (CLK)
STA $01           ; CPU port data register

; Wait for device response
wait_loop:
LDA $DD00         ; Read CIA2 Port A
AND #%10000000    ; Check DATA IN bit (7)
BNE wait_loop     ; Loop until DATA IN goes low
```

### 2. Emulator Testing

To verify correct bidirectional behavior, test both directions:

```typescript
it("CPU port can drive IEC lines when configured as outputs", () => {
  // Set CIA2 to use IEC lines as inputs
  cia2.writeRegister(0x02, 0x00); // All Port A bits as inputs
  
  // Configure CPU port to drive the IEC lines
  cpuPort.writeDirection(0xC0); // Bits 6-7 as outputs
  
  // Initially, keep lines high (in CPU port, writing 1 means high)
  cpuPort.writeData(0xC0);
  
  // CIA2 should read the lines as high (no device pulling them low)
  const initialRead = cia2.readRegister(0x00);
  expect((initialRead & 0xC0)).toBe(0xC0);
  
  // Now pull the DATA line low from the CPU port
  cpuPort.writeData(0x80); // Bit 6 low, bit 7 high
  
  // CIA2 should read the DATA line as low
  const dataLowRead = cia2.readRegister(0x00);
  expect((dataLowRead & 0x40)).toBe(0x00);
  expect((dataLowRead & 0x80)).toBe(0x80);
});
```

## Timing Considerations

The physical IEC bus has timing constraints that must be emulated for correct operation:

1. **Propagation Delay**: In hardware, signals take time to propagate through the bus. In an emulator, we often model this as immediate.

2. **Clock Stretching**: Devices may hold the CLOCK line low to indicate they need more time. The emulator should allow this behavior.

3. **Transition Detection**: Many IEC protocols rely on detecting transitions (HIGH to LOW or LOW to HIGH). Ensure your emulator doesn't miss transitions between CPU cycles.

## Debugging Tips

1. **Trace IEC Line States**: Add a debug view that shows the current state of all IEC lines in real-time.

2. **Log Device Actions**: Track which device is driving each line and why.

3. **Timing Analysis**: For fast loaders and custom protocols, analyze the timing of transitions to ensure accuracy.

## Example: Implementing a Serial Transfer Protocol

Here's a complete example of implementing a simple IEC transfer using both the CPU port and CIA2:

```typescript
// Initialize the C64
const c64 = new C64Machine();
const cia2 = c64.cia2Device;
const cpuPort = c64.cpuPortDevice;

// Configure the CPU port to control IEC lines
cpuPort.writeDirection(0xC0); // Bits 6-7 as outputs
cpuPort.writeData(0xC0);      // Initialize both lines high

// Configure CIA2 to read IEC lines
cia2.writeRegister(0x02, 0x00); // All Port A bits as inputs

// Transmit a byte using bit-banging
function transmitByte(byte) {
  for (let bit = 0; bit < 8; bit++) {
    // Set DATA line according to bit value (active low)
    const dataValue = (byte & (1 << bit)) ? 0x80 : 0xC0;
    cpuPort.writeData(dataValue);
    
    // Pulse CLOCK line (pull low then high)
    cpuPort.writeData(dataValue & 0x7F); // Pull CLOCK low
    // In a real implementation, we'd wait a specific number of cycles here
    cpuPort.writeData(dataValue); // Return CLOCK high
  }
  
  // Signify end of byte by pulling both lines low
  cpuPort.writeData(0x00);
}

// Receive a byte
function receiveByte() {
  let byte = 0;
  
  for (let bit = 0; bit < 8; bit++) {
    // Wait for CLOCK line to go low
    while ((cia2.readRegister(0x00) & 0x80) !== 0) {
      // In a real implementation, we'd need to handle timeouts
    }
    
    // Read DATA line (bit 6 of Port A)
    if ((cia2.readRegister(0x00) & 0x40) === 0) {
      byte |= (1 << bit);
    }
    
    // Wait for CLOCK line to go high again
    while ((cia2.readRegister(0x00) & 0x80) === 0) {
      // In a real implementation, we'd need to handle timeouts
    }
  }
  
  return byte;
}
```

## Common IEC Bus Peripherals

The IEC bus was used to connect the C64 to a variety of peripherals. Emulating these devices requires a proper implementation of the bidirectional IEC bus communication. Here are the most common devices that used the IEC bus:

### 1. Disk Drives

#### Commodore 1541 (VIC-1541)
- The most common disk drive for the C64
- 5.25" single-sided floppy drive with 170KB capacity
- Has its own 6502 CPU and DOS implementation in ROM
- Device #8 by default (can be changed to 9-11)
- Communication challenges:
  - Slow default transfer rate (~300 bytes/sec)
  - Led to development of numerous fast loader implementations
  - Complex error channel handling

#### Commodore 1571
- Double-sided drive with 340KB capacity
- Faster than the 1541 and compatible with C128's burst mode
- Still fully compatible with C64 via standard IEC protocol
- Emulation consideration: Must handle both standard and burst modes

#### Commodore 1581
- 3.5" disk drive with 800KB capacity
- Uses a more sophisticated disk format with subdirectories
- Complex command channel and partition support
- Emulation challenges: Directory structure and partitioning

### 2. Printers

#### Commodore MPS-801/802/803
- Dot matrix printers
- Device #4 by default
- Implements a subset of the Commodore printer protocol
- Emulation consideration: Character set translation and graphics mode

#### Commodore DPS-1101
- Daisy wheel printer
- Used for letter-quality printing
- Emulation consideration: Different command set than dot matrix printers

### 3. Additional Peripherals

#### Commodore 1520 Plotter
- Small 4-color pen plotter
- Device #6 by default
- Uses specialized commands for drawing
- Emulation challenge: Converting vector commands to raster output

#### Commodore 1530 Datasette
- While not an IEC device (it connects to the cassette port), it's worth mentioning as programs often check its status via the CPU port
- Emulation consideration: Integration with CPU port bits for motor control

#### GEOS-Compatible Devices
- GEOS operating system supported specialized IEC commands
- Includes mouse interfaces, RAM expansion units, and more
- Emulation consideration: Handling GEOS-specific extensions to the protocol

### 4. Modern IEC Devices

Many modern storage solutions have been developed that use the IEC bus:

#### SD2IEC
- SD card adapter with IEC interface
- Emulates most 1541 commands but not all fast loaders
- Supports long filenames and subdirectories
- Emulation consideration: Handle extensions to the standard protocol

#### Ultimate-64/1541
- FPGA-based recreation with enhanced capabilities
- Provides cycle-exact emulation of the 1541
- Supports disk images, real drives, and other features
- Emulation consideration: Extended command set

#### Pi1541
- Raspberry Pi-based 1541 emulator
- Cycle-exact emulation with Pi GPIO pins
- Emulation consideration: Enhanced command set and real-time requirements

## Emulating IEC Devices

When implementing these devices in an emulator, consider:

1. **Device addressing**: Each device has a unique address on the bus (usually 4-30)
2. **Command channels**: Most devices use channel 15 for commands
3. **Protocol timing**: Some operations have specific timing requirements
4. **Status reporting**: Devices provide status information via the command channel
5. **File operations**: Supporting LOAD, SAVE, and file management commands

Example of initializing an emulated 1541 drive:

```typescript
class C64Disk1541Device implements IDevice {
  // Device properties
  private deviceNumber = 8; // Default device number
  private isListening = false;
  private isTalking = false;
  private activeChannel = 0;
  
  // IEC bus state
  private dataLineState = true; // true = high, false = low
  private clockLineState = true;
  private atnLineState = true;
  
  // Device functions
  public respondToAtn(command: number): void {
    // Handle attention sequence
    const deviceAddr = command & 0x1F;
    
    if (deviceAddr === this.deviceNumber || deviceAddr === 0x1F) {
      // Command is for this device or broadcast
      const commandType = (command & 0xE0) >> 5;
      
      switch (commandType) {
        case 1: // LISTEN
          this.isListening = true;
          this.isTalking = false;
          break;
        case 2: // TALK
          this.isTalking = true;
          this.isListening = false;
          break;
        case 3: // Secondary address / Data channel
          this.activeChannel = command & 0x0F;
          break;
        case 4: // UNTALK
          this.isTalking = false;
          break;
        case 5: // UNLISTEN
          this.isListening = false;
          break;
      }
    }
  }
  
  // Other methods for byte transfer, file operations, etc.
}
```

## Conclusion

The bidirectional integration between the C64's CPU port and CIA2 for IEC bus control is a sophisticated mechanism that requires careful emulation. By correctly implementing the wired-AND behavior and ensuring proper communication between these components, your emulator can accurately reproduce the C64's interaction with peripherals.

Understanding this integration is crucial for implementing accurate disk access, fast loaders, and other peripheral interactions. The key is to ensure that the influence of each component on the IEC bus lines is properly tracked and reflected in the state observed by all connected components.

Properly emulating the IEC bus and its connected devices enhances the authenticity of the C64 emulation experience and enables users to enjoy the full ecosystem of software that relied on these peripherals.
