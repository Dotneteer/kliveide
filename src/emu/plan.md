# ZX Spectrum Next — MAME vs Klive Device Implementation Plan

This document compares the MAME ZX Spectrum Next (TBBlue) emulation with the Klive IDE implementation
and outlines a plan to implement the missing devices.

## Summary

| # | MAME Device | Klive Equivalent | Status |
|---|-------------|------------------|--------|
| 1 | Z80N CPU | Z80NMachineBase | ✅ Complete |
| 2 | Spectrum ULA contention | UlaDevice / MemoryDevice | ✅ Complete |
| 3 | IM2 Line Interrupt | InterruptDevice | ✅ Complete |
| 4 | IM2 ULA Interrupt | InterruptDevice | ✅ Complete |
| 5 | Z80 CTC (specnext_ctc) | CtcPortHandler (stub) | ❌ Missing |
| 6 | Z80 DMA (specnext_dma) | DmaDevice | ✅ Complete |
| 7 | Screen ULA / ULA+ / ULANext | NextComposedScreenDevice | ✅ Complete |
| 8 | Copper (specnext_copper) | CopperDevice | ✅ Complete |
| 9 | Layer 2 (specnext_layer2) | NextComposedScreenDevice | ✅ Complete |
| 10 | LoRes (specnext_lores) | NextComposedScreenDevice | ✅ Complete |
| 11 | Sprites (specnext_sprites) | SpriteDevice | ✅ Complete |
| 12 | Tilemap (specnext_tiles) | TilemapDevice | ✅ Complete |
| 13 | SPI SD Card ×2 (spi_sdcard) | SdCardDevice (high-level) + SPI port stubs | ⚠️ Partial |
| 14 | DivMMC (specnext_divmmc) | DivMmcDevice | ✅ Complete |
| 15 | Multiface (specnext_multiface) | MultifaceDevice | ✅ Complete |
| 16 | YM2149 PSG ×3 (TurboSound) | TurboSoundDevice | ✅ Complete |
| 17 | DAC 8-bit R2R ×4 | DacDevice / DacPortDevice / DacNextRegDevice | ✅ Complete |
| 18 | Speaker | AudioMixerDevice (beeper) | ✅ Complete |
| 19 | Palette (512×4 + 1) | PaletteDevice | ✅ Complete |
| 20 | DS1307 I2C RTC | I2cSclPortHandler / I2cSdaPortHandler (stubs) | ❌ Missing |
| 21 | I2C Bus | I2cSclPortHandler / I2cSdaPortHandler (stubs) | ❌ Missing |
| 22 | UART (dual) | UartTxPortHandler / UartRxPortHandler / etc. (stubs) | ❌ Missing |
| 23 | ZX Bus / Expansion Slot | ExpansionBusDevice (framework only) | ⚠️ Partial |
| 24 | Kempston Mouse | KempstonHandler (stubs) | ❌ Missing |
| 25 | Kempston Joystick ports | KempstonHandler (stubs) | ❌ Missing |
| 26 | Z80 Daisy Chain | InterruptDevice (priority, no daisy chain) | ⚠️ Partial |
| 27 | +3 FDC | SpectrumP3Fdc*PortHandler (stubs) | ❌ Missing |
| 28 | NextReg bank device | NextRegDevice | ✅ Complete |
| 29 | Memory paging | MemoryDevice | ✅ Complete |
| 30 | CPU speed control | CpuSpeedDevice | ✅ Complete |
| 31 | Keyboard | NextKeyboardDevice | ✅ Complete |

---

## Missing Devices — Implementation Plan

### Phase 1: CTC Device (High Priority)

**What**: Z80 CTC (Counter/Timer Circuit) — `specnext_ctc_device` in MAME  
**Why**: Required by timing-dependent demos, games, and system software. The CTC generates
interrupts on timer expiry and is part of the IM2 daisy chain. 8 CTC channels are mapped to
interrupt sources in the Next.  
**MAME Reference**: `_input/src/mame/sinclair/specnext_ctc.h`, `specnext_ctc.cpp`, `_input/src/devices/machine/z80ctc.h`, `z80ctc.cpp`  
**Klive Stubs**: `io-ports/CtcPortHandler.ts`

**Implementation Steps**:
1. Create `src/emu/machines/zxNext/CtcDevice.ts`
2. Implement 4 CTC channels, each with:
   - Timer mode (prescaler: 16 or 256) and counter mode (external trigger)
   - Time constant register (8-bit down counter)
   - Interrupt generation on zero-count
   - Channel control word decoding
3. Wire CTC channels to the InterruptDevice (8 CTC interrupt sources)
4. Implement I/O port handler at 0x183B+ (4 channels)
5. Integrate with the DMA device (CTC can trigger DMA transfers)
6. Add CTC state to machine snapshot (getState/setState)

---

### Phase 2: SPI SD Card Ports (High Priority)

**What**: SPI protocol support for SD card communication  
**Why**: Klive has a high-level `SdCardDevice` that handles MMC commands via IPC, but the I/O port
handlers (`SpiCsPortHandler`, `SpiDataPortHandler`) are stubs. Software that directly accesses the
SPI ports (0xE7 chip select, 0xEB data) will not work. The ports need to bridge to the existing
SdCardDevice.  
**MAME Reference**: `_input/src/devices/machine/spi_sdcard.h`, `spi_sdcard.cpp`  
**Klive Stubs**: `io-ports/SpiCsPortHandler.ts`, `io-ports/SpiDataPortHandler.ts`

**Implementation Steps**:
1. Implement `writeSpiCsPort` to route chip select to `SdCardDevice`
2. Implement `readSpiDataPort` / `writeSpiDataPort` to route SPI data through `SdCardDevice`
3. Test with Next boot sequence (SD card initialization uses SPI commands)

---

### Phase 3: I2C Bus + DS1307 RTC (Medium Priority)

**What**: I2C master bit-bang protocol and DS1307 real-time clock  
**Why**: The Next uses I2C to communicate with a DS1307 RTC. Software can read date/time and
use the 56 bytes of battery-backed SRAM. Some games and system tools depend on this.  
**MAME Reference**: `_input/src/devices/machine/ds1307.h`, `ds1307.cpp`  
**Klive Stubs**: `io-ports/I2cSclPortHandler.ts`, `io-ports/I2cSdaPortHandler.ts`

**Implementation Steps**:
1. Create `src/emu/machines/zxNext/I2cDevice.ts` — I2C bus master:
   - SCL (clock) and SDA (data) line state tracking
   - START/STOP condition detection
   - Bit-level shift register (8 bits + ACK)
   - Device address decoding (DS1307 = 0x68)
2. Create `src/emu/machines/zxNext/RtcDevice.ts` — DS1307 RTC:
   - 64×8-bit register file (7 time registers + 56 SRAM bytes)
   - BCD-encoded time: seconds, minutes, hours, day-of-week, date, month, year
   - 12/24-hour mode
   - Oscillator enable/disable (CH bit)
   - Square wave output configuration
   - NVRAM persistence (save/restore state)
3. Wire I2C port handlers (port 0x103B SCL, 0x113B SDA) to I2cDevice
4. Connect I2cDevice to RtcDevice as slave at address 0x68
5. Populate RTC from host system clock on machine start
6. Add state serialization

---

### Phase 4: UART Serial Communication (Medium Priority)

**What**: Dual UART (UART0 and UART1) for serial communication  
**Why**: Used for Wi-Fi modules (ESP8266), serial debugging, and communication between devices.
The UART generates RX/TX interrupts that feed into the IM2 interrupt system.  
**MAME Reference**: No direct MAME C++ implementation (handled via FPGA VHDL in real hardware)  
**Klive Stubs**: `io-ports/UartTxPortHandler.ts`, `UartRxPortHandler.ts`, `UartSelectPortHandler.ts`, `UartFramePortHandler.ts`

**Implementation Steps**:
1. Create `src/emu/machines/zxNext/UartDevice.ts` with two UART channels:
   - 512-byte RX FIFO and 64-byte TX FIFO per channel
   - Prescaler-based baud rate generation
   - Data frame configuration (stop bits, parity, word length 5-8)
   - Status flags: TX empty, RX data available, RX near-full, RX full
   - Break condition detection
2. Implement port handlers:
   - 0x143B: UART TX data write
   - 0x143B: UART RX data read
   - 0x153B: UART select (channel 0 or 1)
   - 0x163B: UART frame configuration
3. Wire UART interrupts to InterruptDevice:
   - UART0 RX → interrupt source 1
   - UART1 RX → interrupt source 2
   - UART0 TX → interrupt source 12
   - UART1 TX → interrupt source 13
4. Optionally provide a virtual serial terminal or WebSocket bridge for external I/O

---

### Phase 5: Kempston Mouse + Joystick Ports (Medium Priority)

**What**: Kempston mouse (3-axis: X, Y, wheel + buttons) and joystick port reads  
**Why**: Many Next games and applications support mouse input. The Kempston joystick port reads
are also used by virtually all games. Currently, Klive's `JoystickDevice` has configuration logic
but the actual I/O port handlers are stubs.  
**MAME Reference**: Port mappings in `specnext.cpp` (ports 0x1F, 0x37, 0xFBDF, 0xFFDF, 0xFADF)  
**Klive Stubs**: `io-ports/KempstonHandler.ts`

**Implementation Steps**:
1. Implement `readKempstonJoy1Port` (0x1F) — map JoystickDevice state to 8-bit value
   (right, left, down, up, fire, fire2, fire3)
2. Implement `readKempstonJoy2Port` (0x37) — second joystick port
3. Implement `readKempstonMouseXPort` (0xFBDF) — return accumulated X delta (wrapping 8-bit)
4. Implement `readKempstonMouseYPort` (0xFFDF) — return accumulated Y delta (wrapping 8-bit) 
5. Implement `readKempstonMouseWheelPort` (0xFADF) — return wheel delta + button state
6. Wire to MouseDevice for mouse position tracking
7. Wire to JoystickDevice for joystick button mapping

---

### Phase 6: Z80 Daisy Chain (Low Priority)

**What**: Proper Z80 daisy chain interrupt priority mechanism  
**Why**: MAME implements formal daisy chain with the priority order:
Line → CTC ch0-3 → ULA → DMA. Klive's InterruptDevice handles priority but uses a simpler
model. Once CTC is implemented, proper daisy chain sequencing becomes more important for
accurate interrupt acknowledgment and RETI handling.  
**MAME Reference**: `_input/src/devices/machine/z80daisy.h`, `z80daisy.cpp`

**Implementation Steps**:
1. Review Klive's InterruptDevice to assess whether it already satisfies daisy chain semantics
2. Add IEI/IEO (Interrupt Enable In/Out) chain traversal if missing
3. Ensure interrupt acknowledge delivers the correct vector from the highest-priority pending device
4. Ensure RETI instruction propagates through the chain correctly
5. Wire CTC channels into the chain between Line and ULA interrupts

---

### Phase 7: +3 FDC (Floppy Disk Controller) (Low Priority)

**What**: Spectrum +3 Floppy Disk Controller  
**Why**: The ZX Spectrum Next can emulate +3 mode with floppy disk support.
Lower priority because most Next software uses SD card storage.  
**MAME Reference**: +3 emulation in MAME  
**Klive Stubs**: `io-ports/SpectrumP3FdcControlPortHandler.ts`, `io-ports/SpectrumP3FdcStatusPortHandler.ts`

**Implementation Steps**:
1. Create `src/emu/machines/zxNext/FdcDevice.ts`
2. Implement basic NEC 765 FDC command set:
   - Read/Write sector
   - Seek/Recalibrate
   - Sense interrupt status
   - Specify
3. Add DSK image file loading support
4. Wire to I/O ports

---

### Phase 8: ZX Bus Expansion Slot (Low Priority)

**What**: External expansion bus device support  
**Why**: Klive has an `ExpansionBusDevice` framework but no actual external device support.
MAME implements ZXBUS with expansion slot capability.  
**MAME Reference**: `_input/src/devices/bus/spectrum/zxbus/bus.h`, `bus.cpp`

**Implementation Steps**:
1. Define expansion device interface in Klive
2. Allow loading virtual expansion ROMs
3. Route I/O and memory requests through expansion bus filter
4. This is primarily an extensibility feature for the future

---

## Implementation Priority Summary

| Priority | Device | Effort | Impact |
|----------|--------|--------|--------|
| 🔴 High | CTC Device | Medium | Timing-critical software support |
| 🔴 High | SPI SD Card Ports | Low | Bridge to existing SdCardDevice |
| 🟡 Medium | I2C Bus + DS1307 RTC | Medium | Date/time and NVRAM support |
| 🟡 Medium | UART (dual) | Medium-High | Serial communication, Wi-Fi |
| 🟡 Medium | Kempston Mouse/Joystick | Low-Medium | Game input support |
| 🟢 Low | Z80 Daisy Chain | Low | Interrupt accuracy refinement |
| 🟢 Low | +3 FDC | High | Legacy floppy support |
| 🟢 Low | ZX Bus Expansion | Medium | Future extensibility |

## Already Complete in Klive (No Action Needed)

- Z80N CPU with extended instructions
- Copper coprocessor (FPGA-accurate model)
- DMA controller (both legacy and ZXN modes)
- Layer 2 graphics (256×192, 320×256, 640×256)
- LoRes/Radastan graphics
- ULA / ULA+ / ULANext rendering
- Tilemap layer (40×32, 80×32, text mode)
- Sprite engine (128 sprites, rotation, scaling, relative sprites)
- Palette management (4 palette sets ×2 alternates)
- TurboSound (3× YM2149 PSG)
- 4-channel DAC (SpecDrum/SoundDrive)
- Audio mixer with beeper
- Memory paging (2MB, NextReg MMU)
- DivMMC with automap
- Multiface (4 variants)
- Keyboard with extended keys
- NextReg register system (256 registers)
- CPU speed control (3.5/7/14/28 MHz)
- Interrupt system (IM2 with multiple sources)
