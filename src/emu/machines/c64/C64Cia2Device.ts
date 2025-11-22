import { IGenericDevice } from "@emuabstr/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * Implementation of the CIA #2 (Complex Interface Adapter) for the Commodore 64
 * The CIA #2 is responsible for serial bus (IEC), RS-232, user port, and NMI interrupts.
 * It has 16 registers ($DD00-$DD0F) that control various I/O functions.
 */
export class C64Cia2Device implements IGenericDevice<IC64Machine> {
  /**
   * Flag indicating if the CPU port is driving the IEC DATA line low
   * This is used to implement the "wired-AND" behavior of the IEC bus
   */
  private _cpuPortDrivingDataLow = false;

  /**
   * Flag indicating if the CPU port is driving the IEC CLOCK line low
   * This is used to implement the "wired-AND" behavior of the IEC bus
   */
  private _cpuPortDrivingClockLow = false;

  /**
   * Gets whether the CPU port is driving the IEC DATA line low
   */
  get cpuPortDrivingDataLow(): boolean {
    return this._cpuPortDrivingDataLow;
  }

  /**
   * Sets whether the CPU port is driving the IEC DATA line low
   */
  set cpuPortDrivingDataLow(value: boolean) {
    this._cpuPortDrivingDataLow = value;
    // No need to call updateIecBusLines() as it's empty
  }

  /**
   * Gets whether the CPU port is driving the IEC CLOCK line low
   */
  get cpuPortDrivingClockLow(): boolean {
    return this._cpuPortDrivingClockLow;
  }

  /**
   * Sets whether the CPU port is driving the IEC CLOCK line low
   */
  set cpuPortDrivingClockLow(value: boolean) {
    this._cpuPortDrivingClockLow = value;
    // No need to call updateIecBusLines() as it's empty
  }

  /**
   * Data Port A (Register $DD00)
   * This register serves multiple functions:
   * - VIC-II bank selection
   * - Serial bus control
   * Bit 0: Serial bus data input/output (ATN OUT)
   * Bit 1: Serial bus clock pulse input/output (CLK OUT) 
   * Bit 2: Serial bus data input (DATA OUT)
   * Bit 3: Serial bus attention acknowledge input (ATN IN)
   * Bit 4-5: VIC-II memory bank select (inverted)
   *          00 = Bank 3 ($C000-$FFFF)
   *          01 = Bank 2 ($8000-$BFFF)
   *          10 = Bank 1 ($4000-$7FFF)
   *          11 = Bank 0 ($0000-$3FFF)
   * Bit 6: Serial bus clock input (CLK IN)
   * Bit 7: Serial bus data input (DATA IN)
   */
  private _portA: number = 0xFF;

  /**
   * Data Port B (Register $DD01)
   * This register is connected to the User Port and RS-232 interface.
   * Bit 0: RS-232 received data (RXD)
   * Bit 1: RS-232 request to send (RTS)
   * Bit 2: RS-232 data terminal ready (DTR)
   * Bit 3: RS-232 ring indicator (RI)
   * Bit 4: RS-232 carrier detect (DCD)
   * Bit 5: User port (Pin M)
   * Bit 6: RS-232 clear to send (CTS)
   * Bit 7: RS-232 data set ready (DSR)
   */
  private _portB: number = 0xFF;

  /**
   * Data Direction Register for Port A (Register $DD02)
   * Controls whether each bit in Port A is input (0) or output (1)
   * For serial bus operation, typically set to $3F (bits 0-5 output, 6-7 input)
   */
  private _ddrA: number = 0;

  /**
   * Data Direction Register for Port B (Register $DD03)
   * Controls whether each bit in Port B is input (0) or output (1)
   * For RS-232 operation, typically set with bits for required outputs
   */
  private _ddrB: number = 0;

  /**
   * Timer A Low Byte (Register $DD04)
   * Lower 8 bits of Timer A's value
   * For RS-232, this is used for the baud rate timer
   */
  private _timerALo: number = 0;

  /**
   * Timer A High Byte (Register $DD05)
   * Upper 8 bits of Timer A's value
   */
  private _timerAHi: number = 0;

  /**
   * Timer B Low Byte (Register $DD06)
   * Lower 8 bits of Timer B's value
   * For RS-232, this is used for the bit timing
   */
  private _timerBLo: number = 0;

  /**
   * Timer B High Byte (Register $DD07)
   * Upper 8 bits of Timer B's value
   */
  private _timerBHi: number = 0;

  /**
   * Time of Day Clock: 10ths of Seconds (Register $DD08)
   * Valid values: 0-9 (BCD format)
   * When bit 7 of Control Register A is 0, this can be written to
   */
  private _todTenths: number = 0;

  /**
   * Time of Day Clock: Seconds (Register $DD09)
   * Valid values: 0-59 (BCD format)
   */
  private _todSeconds: number = 0;

  /**
   * Time of Day Clock: Minutes (Register $DD0A)
   * Valid values: 0-59 (BCD format)
   */
  private _todMinutes: number = 0;

  /**
   * Time of Day Clock: Hours (Register $DD0B)
   * Valid values: 1-12 AM/PM (BCD format)
   * Bit 7: 0=AM, 1=PM
   * Bits 0-5: Hours in BCD (1-12)
   * When bit 7 of Control Register B is 0, reading this latches all TOD registers
   */
  private _todHours: number = 0;

  /**
   * Serial Data Register (Register $DD0C)
   * Used for serial I/O operations, typically for RS-232 shifting
   */
  private _serialData: number = 0;

  /**
   * Interrupt Control Register (Register $DD0D)
   * Reading: Returns which interrupts have occurred
   * Writing: Enables/disables specific interrupts
   * Bit 0: Timer A underflow interrupt (1=enable)
   * Bit 1: Timer B underflow interrupt (1=enable)
   * Bit 2: TOD clock alarm interrupt (1=enable)
   * Bit 3: Serial port interrupt (1=enable)
   * Bit 4: FLAG line interrupt (1=enable, triggered by RS-232 received data)
   * Bit 5-6: Unused
   * Bit 7: Any enabled interrupt occurred (1=yes)
   * 
   * NOTE: CIA #2 generates NMI (Non-Maskable Interrupt) signals
   */
  private _interruptControl: number = 0;

  /**
   * Control Register A (Register $DD0E)
   * Controls Timer A and other functions
   * Bit 0: Start Timer A (1=start, 0=stop)
   * Bit 1: Timer A output on PB6 (1=yes)
   * Bit 2: PB6 output mode (0=toggle, 1=pulse)
   * Bit 3: Timer A run mode (0=one-shot, 1=continuous)
   * Bit 4: Force latched value to Timer A (1=force load)
   * Bit 5-6: Timer A input mode:
   *          00=Count system cycles
   *          01=Count positive CNT transitions
   *          10=Count Timer A underflows (not used in CIA 2)
   *          11=Count underflows when CNT positive
   * Bit 7: TOD frequency (0=60Hz, 1=50Hz)
   */
  private _controlA: number = 0;

  /**
   * Control Register B (Register $DD0F)
   * Controls Timer B and other functions
   * Bit 0: Start Timer B (1=start, 0=stop)
   * Bit 1: Timer B output on PB7 (1=yes)
   * Bit 2: PB7 output mode (0=toggle, 1=pulse)
   * Bit 3: Timer B run mode (0=one-shot, 1=continuous)
   * Bit 4: Force latched value to Timer B (1=force load)
   * Bit 5-6: Timer B input mode:
   *          00=Count system cycles
   *          01=Count positive CNT transitions
   *          10=Count Timer A underflows
   *          11=Count Timer A underflows while CNT positive
   * Bit 7: TOD alarm/clock (0=alarm, 1=clock)
   */
  private _controlB: number = 0;
  
  // Timer related internal state
  private _timerALatch: number = 0; // Latch for Timer A
  private _timerBLatch: number = 0; // Latch for Timer B
  
  // TOD alarm values - used to compare against current time for alarm interrupt
  private _todAlarmTenths: number = 0;
  private _todAlarmSeconds: number = 0;
  private _todAlarmMinutes: number = 0;
  private _todAlarmHours: number = 0;
  
  private registers: Uint8Array;

  constructor(public readonly machine: IC64Machine) {
    this.registers = new Uint8Array(0x10);
  }

  /**
   * Check if the device asks for a non-maskable interrupt (NMI).
   */
  requestsNmi(): boolean {
    // TODO: Implement this method
    return false;
  }

  /**
   * Check if the device asks for an interrupt request (IRQ).
   */
  requestsIrq(): boolean {
    // TODO: Implement this method
    return false;
  }

  /**
   * Initializes the CIA #2 device to its default state.
   */
  reset(): void {
    // Reset all CIA registers to their default values
    this._portA = 0x3F;  // Default: VIC-II Bank 0 ($0000-$3FFF), serial lines high
    this._portB = 0xFF;
    this._ddrA = 0;
    this._ddrB = 0;
    this._timerALo = 0;
    this._timerAHi = 0;
    this._timerBLo = 0;
    this._timerBHi = 0;
    this._todTenths = 0;
    this._todSeconds = 0;
    this._todMinutes = 0;
    this._todHours = 0;
    this._serialData = 0;
    this._interruptControl = 0;
    this._controlA = 0;
    this._controlB = 0;
    
    // Reset internal state
    this._timerALatch = 0;
    this._timerBLatch = 0;
    this._todAlarmTenths = 0;
    this._todAlarmSeconds = 0;
    this._todAlarmMinutes = 0;
    this._todAlarmHours = 0;
  }

  /**
   * Performs a hard reset of the CIA #2 device.
   */
  hardReset = (): void => {
    // Perform a full reset, including any persistent state
    this.reset();
    // Additional hard reset logic can be added here
  };

  getFlatMemory(): Uint8Array {
    const flatMemory = new Uint8Array(0x100);
    for (let i = 0; i < 0x10; i++) {
      flatMemory.set(this.registers, i * 0x10);
    }
    return flatMemory;
  }

  /**
   * Gets Port A value (VIC-II bank selection and serial bus control)
   */
  get portA(): number {
    // The value read depends on DDR settings
    // For each bit:
    // - If set as output (1 in DDR), read the value from _portA
    // - If set as input (0 in DDR), read the value from external source
    
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
          case 3: // ATN IN (bit 3)
            // In a real C64, this would read the actual IEC ATN IN line from the port
            // For now, it's always high when not externally driven
            result |= mask;
            break;
          default:
            // For other bits configured as inputs, use the latch value
            // This isn't completely accurate for all bits, but works for now
            result |= (this._portA & mask);
            break;
        }
      }
    }
    
    return result;
  }

  /**
   * Sets Port A value (VIC-II bank selection and serial bus control)
   */
  set portA(value: number) {
    // Update the internal latch
    this._portA = value & 0xFF;
    
    // TODO: In a complete implementation, this would:
    // 1. Update the actual IEC bus lines based on output bits
    // 2. Update the VIC-II bank selection
    // 3. Signal other devices about IEC bus changes
  }

  /**
   * Gets the current VIC-II memory bank (0-3)
   */
  get vicMemoryBank(): number {
    // The bits are inverted, so we need to invert and extract bits 4-5
    return (~this._portA >> 4) & 0x03;
  }
  
  /**
   * Sets the VIC-II memory bank (0-3)
   */
  set vicMemoryBank(bank: number) {
    // Clear bits 4-5 and set them according to the inverted bank value
    bank = bank & 0x03; // Ensure valid value 0-3
    this._portA = (this._portA & 0xCF) | ((~bank & 0x03) << 4);
    // Notify VIC device of the bank change
    this.machine.vicDevice.setBaseBank(bank);
  }

  /**
   * Get the current state of the IEC Data line (DATA OUT)
   * Returns true if the data line is high (1), false if low (0)
   * This corresponds to bit 2 of Port A
   */
  get iecDataLine(): boolean {
    // DATA OUT is on bit 2 of Port A
    // A 0 in the register means the line is pulled low (active), 1 means high (inactive)
    // Only consider this bit if it's configured as an output in DDRA
    if ((this._ddrA & 0x04) !== 0) {
      return (this._portA & 0x04) !== 0;
    }
    
    // If not configured as output, the line is high (inactive)
    return true;
  }

  /**
   * Get the current state of the IEC Clock line (CLK OUT)
   * Returns true if the clock line is high (1), false if low (0)
   * This corresponds to bit 1 of Port A
   */
  get iecClockLine(): boolean {
    // CLK OUT is on bit 1 of Port A
    // A 0 in the register means the line is pulled low (active), 1 means high (inactive)
    // Only consider this bit if it's configured as an output in DDRA
    if ((this._ddrA & 0x02) !== 0) {
      return (this._portA & 0x02) !== 0;
    }
    
    // If not configured as output, the line is high (inactive)
    return true;
  }

  /**
   * Get the current state of the IEC ATN line (ATN OUT)
   * Returns true if the ATN line is high (1), false if low (0)
   * This corresponds to bit 0 of Port A
   */
  get iecAtnLine(): boolean {
    // ATN OUT is on bit 0 of Port A
    // A 0 in the register means the line is pulled low (active), 1 means high (inactive)
    // Only consider this bit if it's configured as an output in DDRA
    if ((this._ddrA & 0x01) !== 0) {
      return (this._portA & 0x01) !== 0;
    }
    
    // If not configured as output, the line is high (inactive)
    return true;
  }

  /**
   * Gets Port B value (RS-232 and user port)
   */
  get portB(): number {
    // Similar to Port A, the value read depends on DDR settings
    // This is simplified for now - would need actual RS-232 state
    return this._portB;
  }

  /**
   * Sets Port B value (RS-232 and user port)
   */
  set portB(value: number) {
    this._portB = value & 0xFF;
  }

  /**
   * Gets the current Timer A value as 16-bit
   */
  get timerA(): number {
    return (this._timerAHi << 8) | this._timerALo;
  }

  /**
   * Sets the Timer A value as 16-bit
   * Note: This sets the latch value that will be loaded when the timer is started or underflows
   */
  set timerA(value: number) {
    this._timerALatch = value & 0xFFFF;
    if (!(this._controlA & 0x01)) {
      // If timer is not running, also set the current timer value
      this._timerALo = value & 0xFF;
      this._timerAHi = (value >> 8) & 0xFF;
    }
  }

  /**
   * Gets the current Timer B value as 16-bit
   */
  get timerB(): number {
    return (this._timerBHi << 8) | this._timerBLo;
  }

  /**
   * Sets the Timer B value as 16-bit
   * Note: This sets the latch value that will be loaded when the timer is started or underflows
   */
  set timerB(value: number) {
    this._timerBLatch = value & 0xFFFF;
    if (!(this._controlB & 0x01)) {
      // If timer is not running, also set the current timer value
      this._timerBLo = value & 0xFF;
      this._timerBHi = (value >> 8) & 0xFF;
    }
  }

  /**
   * Gets the current Time of Day as a string in HH:MM:SS.T format
   */
  get timeOfDay(): string {
    const hours = this.bcdToDec(this._todHours & 0x1F); // Mask off AM/PM bit
    const amPm = (this._todHours & 0x80) ? 'PM' : 'AM';
    const minutes = this.bcdToDec(this._todMinutes);
    const seconds = this.bcdToDec(this._todSeconds);
    const tenths = this.bcdToDec(this._todTenths);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${
      seconds.toString().padStart(2, '0')}.${tenths} ${amPm}`;
  }

  /**
   * Sets the Time of Day clock
   * @param hours Hours (1-12)
   * @param minutes Minutes (0-59)
   * @param seconds Seconds (0-59)
   * @param tenths Tenths of seconds (0-9)
   * @param isPm True if PM, false if AM
   */
  setTimeOfDay(hours: number, minutes: number, seconds: number, tenths: number, isPm: boolean): void {
    // Convert to BCD
    this._todHours = this.decToBcd(hours) | (isPm ? 0x80 : 0);
    this._todMinutes = this.decToBcd(minutes);
    this._todSeconds = this.decToBcd(seconds);
    this._todTenths = this.decToBcd(tenths);
  }

  /**
   * Read a CIA register value
   * @param regIndex Register index (0-15, corresponding to $DD00-$DD0F)
   * @returns The value of the register
   */
  readRegister(regIndex: number): number {
    regIndex &= 0x0F; // Limit to 16 registers (0-15)
    
    switch (regIndex) {
      case 0x00: return this.portA;
      case 0x01: return this._portB;
      case 0x02: return this._ddrA;
      case 0x03: return this._ddrB;
      case 0x04: 
        // Reading Timer A low byte resets the timer underflow flag
        return this._timerALo;
      case 0x05: return this._timerAHi;
      case 0x06: 
        // Reading Timer B low byte resets the timer underflow flag
        return this._timerBLo;
      case 0x07: return this._timerBHi;
      case 0x08: return this._todTenths;
      case 0x09: return this._todSeconds;
      case 0x0A: return this._todMinutes;
      case 0x0B:
        // Reading hours latches all TOD registers if bit 7 of CRB is 0
        return this._todHours;
      case 0x0C: return this._serialData;
      case 0x0D:
        // Reading ICR clears all interrupt flags after returning them
        const icr = this._interruptControl;
        this._interruptControl &= 0x7F;
        return icr;
      case 0x0E: return this._controlA;
      case 0x0F: return this._controlB;
      default: return 0; // Should never reach here due to mask
    }
  }

  /**
   * Write to a CIA register
   * @param regIndex Register index (0-15, corresponding to $DD00-$DD0F)
   * @param value The value to write
   */
  writeRegister(regIndex: number, value: number): void {
    regIndex &= 0x0F; // Limit to 16 registers (0-15)
    value &= 0xFF;    // Ensure it's a byte value
    
    switch (regIndex) {
      case 0x00: 
        // Write to Port A - affects IEC bus lines and VIC bank
        const oldPortA = this._portA;
        this._portA = value;
        
        // Check if IEC lines have changed and need to be updated
        const iecMask = 0x07; // Bits 0-2 affect IEC bus lines
        if ((oldPortA & iecMask) !== (value & iecMask)) {
          // The wired-AND behavior is implemented through getters
          // so no explicit update is needed
        }
        
        // Check if VIC bank selection has changed
        const vicBankMask = 0x30; // Bits 4-5 affect VIC bank
        if ((oldPortA & vicBankMask) !== (value & vicBankMask)) {
          // Signal VIC-II about bank change
          const newBank = this.vicMemoryBank;
          this.machine.vicDevice.setBaseBank(newBank);
        }
        break;
      case 0x01:
        this._portB = value;
        break;
      case 0x02:
        // Data Direction Register A - affects how Port A bits are interpreted
        const oldDdrA = this._ddrA;
        this._ddrA = value;
        
        // If IEC line direction has changed, update their state
        if ((oldDdrA & 0x07) !== (value & 0x07)) {
          // The wired-AND behavior is implemented through getters
          // so no explicit update is needed
        }
        break;
      case 0x03:
        this._ddrB = value;
        break;
      case 0x04:
        // Writing to Timer A low byte sets the latch
        this._timerALatch = (this._timerALatch & 0xFF00) | value;
        if (!(this._controlA & 0x01)) {
          this._timerALo = value;
        }
        break;
      case 0x05:
        // Writing to Timer A high byte sets the latch
        this._timerALatch = (this._timerALatch & 0x00FF) | (value << 8);
        if (!(this._controlA & 0x01)) {
          this._timerAHi = value;
        }
        break;
      case 0x06:
        // Writing to Timer B low byte sets the latch
        this._timerBLatch = (this._timerBLatch & 0xFF00) | value;
        if (!(this._controlB & 0x01)) {
          this._timerBLo = value;
        }
        break;
      case 0x07:
        // Writing to Timer B high byte sets the latch
        this._timerBLatch = (this._timerBLatch & 0x00FF) | (value << 8);
        if (!(this._controlB & 0x01)) {
          this._timerBHi = value;
        }
        break;
      case 0x08:
        // Write to TOD tenths if Control Register B bit 7 is 0
        if (!(this._controlB & 0x80)) {
          this._todTenths = value & 0x0F; // Only values 0-9 are valid
        } else {
          this._todAlarmTenths = value & 0x0F;
        }
        break;
      case 0x09:
        // Write to TOD seconds if Control Register B bit 7 is 0
        if (!(this._controlB & 0x80)) {
          this._todSeconds = value & 0x7F; // BCD value 0-59
        } else {
          this._todAlarmSeconds = value & 0x7F;
        }
        break;
      case 0x0A:
        // Write to TOD minutes if Control Register B bit 7 is 0
        if (!(this._controlB & 0x80)) {
          this._todMinutes = value & 0x7F; // BCD value 0-59
        } else {
          this._todAlarmMinutes = value & 0x7F;
        }
        break;
      case 0x0B:
        // Write to TOD hours if Control Register B bit 7 is 0
        if (!(this._controlB & 0x80)) {
          this._todHours = value & 0x9F; // BCD value 1-12 + AM/PM flag
        } else {
          this._todAlarmHours = value & 0x9F;
        }
        break;
      case 0x0C:
        this._serialData = value;
        break;
      case 0x0D:
        // Writing to ICR enables/disables specific interrupts
        // Bit 7: 1=Set bits, 0=Clear bits
        if (value & 0x80) {
          // Set bits
          this._interruptControl |= (value & 0x1F);
        } else {
          // Clear bits
          this._interruptControl &= ~(value & 0x1F);
        }
        break;
      case 0x0E:
        // Handle Control Register A
        const oldControlA = this._controlA;
        this._controlA = value;
        
        // Check if Timer A is being started
        if ((value & 0x01) && !(oldControlA & 0x01)) {
          // Start Timer A - load from latch if bit 4 is set
          if (value & 0x10) {
            this._timerALo = this._timerALatch & 0xFF;
            this._timerAHi = (this._timerALatch >> 8) & 0xFF;
          }
        }
        
        // Force load from latch if bit 4 is set
        if (value & 0x10) {
          this._timerALo = this._timerALatch & 0xFF;
          this._timerAHi = (this._timerALatch >> 8) & 0xFF;
        }
        break;
      case 0x0F:
        // Handle Control Register B
        const oldControlB = this._controlB;
        this._controlB = value;
        
        // Check if Timer B is being started
        if ((value & 0x01) && !(oldControlB & 0x01)) {
          // Start Timer B - load from latch if bit 4 is set
          if (value & 0x10) {
            this._timerBLo = this._timerBLatch & 0xFF;
            this._timerBHi = (this._timerBLatch >> 8) & 0xFF;
          }
        }
        
        // Force load from latch if bit 4 is set
        if (value & 0x10) {
          this._timerBLo = this._timerBLatch & 0xFF;
          this._timerBHi = (this._timerBLatch >> 8) & 0xFF;
        }
        break;
    }
  }

  /**
   * Updates the timers and Time of Day clock for each CPU cycle
   * This should be called during CPU emulation
   * @param cycles The number of cycles to advance
   */
  updateTimers(cycles: number): void {
    // Update Timer A if it's running
    if (this._controlA & 0x01) {
      // Simple countdown for now, in reality the behavior depends on bits 5-6 of CR
      let timerA = this.timerA - cycles;
      if (timerA <= 0) {
        // Timer underflow
        if (this._controlA & 0x08) {
          // Continuous mode - reload from latch
          timerA = this._timerALatch - (Math.abs(timerA) % this._timerALatch);
          
          // Set interrupt flag
          this._interruptControl |= 0x01 | 0x80;
          
          // Signal NMI if enabled
          this.signalNmiIfEnabled(0x01);
        } else {
          // One-shot mode
          timerA = 0;
          this._controlA &= ~0x01; // Stop timer
          
          // Set interrupt flag
          this._interruptControl |= 0x01 | 0x80;
          
          // Signal NMI if enabled
          this.signalNmiIfEnabled(0x01);
        }
      }
      
      this._timerALo = timerA & 0xFF;
      this._timerAHi = (timerA >> 8) & 0xFF;
    }
    
    // Update Timer B if it's running
    if (this._controlB & 0x01) {
      // The behavior depends on bits 5-6 of CR
      // For now, simple countdown assuming system clock source
      let timerB = this.timerB - cycles;
      if (timerB <= 0) {
        // Timer underflow
        if (this._controlB & 0x08) {
          // Continuous mode - reload from latch
          timerB = this._timerBLatch - (Math.abs(timerB) % this._timerBLatch);
          
          // Set interrupt flag
          this._interruptControl |= 0x02 | 0x80;
          
          // Signal NMI if enabled
          this.signalNmiIfEnabled(0x02);
        } else {
          // One-shot mode
          timerB = 0;
          this._controlB &= ~0x01; // Stop timer
          
          // Set interrupt flag
          this._interruptControl |= 0x02 | 0x80;
          
          // Signal NMI if enabled
          this.signalNmiIfEnabled(0x02);
        }
      }
      
      this._timerBLo = timerB & 0xFF;
      this._timerBHi = (timerB >> 8) & 0xFF;
    }
    
    // TOD clock would be updated here based on cycles,
    // but that's more complex and depends on 50/60Hz setting
    // This is simplified for now
    
    // Check for TOD alarm match
    this.checkTodAlarm();
  }
  
  /**
   * Checks if the current TOD matches the alarm setting and triggers an NMI interrupt if needed
   */
  private checkTodAlarm(): void {
    // Check if the current time matches the alarm time
    if (this._todTenths === this._todAlarmTenths && 
        this._todSeconds === this._todAlarmSeconds &&
        this._todMinutes === this._todAlarmMinutes &&
        this._todHours === this._todAlarmHours) {
      // Trigger alarm interrupt if enabled
      if (this._interruptControl & 0x04) {
        this._interruptControl |= 0x04 | 0x80;
        
        // Signal NMI if TOD alarm interrupt is enabled
        this.signalNmiIfEnabled(0x04);
      }
    }
  }
  
  /**
   * Signals an NMI (Non-Maskable Interrupt) to the CPU if the interrupt is enabled
   * @param source The source bit of the interrupt (0x01 for Timer A, 0x02 for Timer B, etc.)
   */
  private signalNmiIfEnabled(source: number): void {
    // Check if the interrupt source is enabled
    if (this._interruptControl & source) {
      // In a full implementation, this would signal the CPU's NMI line
      // For now, we'll just have a placeholder
      // this.machine.signalNmi();
    }
  }

  /**
   * Helper function to convert from BCD to decimal
   */
  private bcdToDec(bcd: number): number {
    return ((bcd >> 4) & 0x0F) * 10 + (bcd & 0x0F);
  }

  /**
   * Helper function to convert from decimal to BCD
   */
  private decToBcd(dec: number): number {
    return ((dec / 10) << 4) | (dec % 10);
  }
}
