import { IGenericDevice } from "../../abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * Implementation of the CIA #1 (Complex Interface Adapter) for the Commodore 64
 * The CIA #1 is responsible for keyboard scanning, joystick input, and timers.
 * It has 16 registers ($DC00-$DC0F) that control various I/O functions.
 */
export class C64Cia1Device implements IGenericDevice<IC64Machine> {
  /**
   * Data Port A (Register $DC00)
   * This register serves multiple functions:
   * - For keyboard scanning: Outputs column values for keyboard matrix
   * - For joystick #2: Reads joystick switches
   * Bit 0: Joystick Right (0=pressed) or keyboard column 0
   * Bit 1: Joystick Left (0=pressed) or keyboard column 1
   * Bit 2: Joystick Down (0=pressed) or keyboard column 2
   * Bit 3: Joystick Up (0=pressed) or keyboard column 3
   * Bit 4: Joystick Fire (0=pressed) or keyboard column 4
   * Bit 5: Keyboard column 5
   * Bit 6: Keyboard column 6
   * Bit 7: Keyboard column 7
   * For keyboard: 0=select column, 1=don't select
   */
  private _portA: number = 0xFF;

  /**
   * Data Port B (Register $DC01)
   * This register serves multiple functions:
   * - For keyboard scanning: Reads row values from keyboard matrix
   * - For joystick #1: Reads joystick switches
   * Bit 0: Joystick #1 Right (0=pressed) or keyboard row 0
   * Bit 1: Joystick #1 Left (0=pressed) or keyboard row 1
   * Bit 2: Joystick #1 Down (0=pressed) or keyboard row 2
   * Bit 3: Joystick #1 Up (0=pressed) or keyboard row 3
   * Bit 4: Joystick #1 Fire (0=pressed) or keyboard row 4
   * Bit 5: Keyboard row 5
   * Bit 6: Keyboard row 6
   * Bit 7: Keyboard row 7
   * For keyboard rows: 0=key pressed, 1=key not pressed
   */
  private _portB: number = 0xFF;

  /**
   * Data Direction Register for Port A (Register $DC02)
   * Controls whether each bit in Port A is input (0) or output (1)
   * For keyboard scanning, typically set to $FF (all bits are outputs)
   */
  private _ddrA: number = 0;

  /**
   * Data Direction Register for Port B (Register $DC03)
   * Controls whether each bit in Port B is input (0) or output (1)
   * For keyboard scanning, typically set to $00 (all bits are inputs)
   */
  private _ddrB: number = 0;

  /**
   * Timer A Low Byte (Register $DC04)
   * Lower 8 bits of Timer A's value
   * When timer is running, this value is decremented at system clock speed or CNT pin pulses
   */
  private _timerALo: number = 0;

  /**
   * Timer A High Byte (Register $DC05)
   * Upper 8 bits of Timer A's value
   */
  private _timerAHi: number = 0;

  /**
   * Timer B Low Byte (Register $DC06)
   * Lower 8 bits of Timer B's value
   * When timer is running, this value is decremented at system clock speed or based on Timer A
   */
  private _timerBLo: number = 0;

  /**
   * Timer B High Byte (Register $DC07)
   * Upper 8 bits of Timer B's value
   */
  private _timerBHi: number = 0;

  /**
   * Time of Day Clock: 10ths of Seconds (Register $DC08)
   * Valid values: 0-9 (BCD format)
   * When bit 7 of Control Register A is 0, this can be written to
   */
  private _todTenths: number = 0;

  /**
   * Time of Day Clock: Seconds (Register $DC09)
   * Valid values: 0-59 (BCD format)
   */
  private _todSeconds: number = 0;

  /**
   * Time of Day Clock: Minutes (Register $DC0A)
   * Valid values: 0-59 (BCD format)
   */
  private _todMinutes: number = 0;

  /**
   * Time of Day Clock: Hours (Register $DC0B)
   * Valid values: 1-12 AM/PM (BCD format)
   * Bit 7: 0=AM, 1=PM
   * Bits 0-5: Hours in BCD (1-12)
   * When bit 7 of Control Register B is 0, reading this latches all TOD registers
   */
  private _todHours: number = 0;

  /**
   * Serial Data Register (Register $DC0C)
   * Used for serial I/O operations through the serial port
   */
  private _serialData: number = 0;

  /**
   * Interrupt Control Register (Register $DC0D)
   * Reading: Returns which interrupts have occurred
   * Writing: Enables/disables specific interrupts
   * Bit 0: Timer A underflow interrupt (1=enable)
   * Bit 1: Timer B underflow interrupt (1=enable)
   * Bit 2: TOD clock alarm interrupt (1=enable)
   * Bit 3: Serial port interrupt (1=enable)
   * Bit 4: FLAG line interrupt (1=enable, triggered by Cassette Read/Write)
   * Bit 5-6: Unused
   * Bit 7: Any enabled interrupt occurred (1=yes)
   */
  private _interruptControl: number = 0;

  /**
   * Control Register A (Register $DC0E)
   * Controls Timer A and other functions
   * Bit 0: Start Timer A (1=start, 0=stop)
   * Bit 1: Timer A output on PB6 (1=yes)
   * Bit 2: PB6 output mode (0=toggle, 1=pulse)
   * Bit 3: Timer A run mode (0=one-shot, 1=continuous)
   * Bit 4: Force latched value to Timer A (1=force load)
   * Bit 5-6: Timer A input mode:
   *          00=Count system cycles
   *          01=Count positive CNT transitions
   *          10=Count Timer A underflows (not used in CIA 1)
   *          11=Count underflows when CNT positive
   * Bit 7: TOD frequency (0=60Hz, 1=50Hz)
   */
  private _controlA: number = 0;

  /**
   * Control Register B (Register $DC0F)
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
   * Initializes the CIA #1 device to its default state.
   */
  reset(): void {
    // Reset all CIA registers to their default values
    this._portA = 0xFF;
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
   * Performs a hard reset of the CIA #1 device.
   */
  hardReset = (): void => {
    // Perform a full reset, including any persistent state
    this.reset();
    // Additional hard reset logic can be added here
  };

  /**
   * Disposes of resources held by the CIA #1 device.
   */
  dispose(): void {
    // Clean up resources if necessary
    // For now, nothing to dispose
  }

  getFlatMemory(): Uint8Array {
    const flatMemory = new Uint8Array(0x100);
    for (let i = 0; i < 0x10; i++) {
      flatMemory.set(this.registers, i * 0x10);
    }
    return flatMemory;
  }

  /**
   * Gets Port A value (keyboard columns / joystick 2)
   */
  get portA(): number {
    // For Port A, only bits set as inputs (0 in DDR) will read external values
    // Bits set as outputs (1 in DDR) will read the value set in the port register
    const inputMask = ~this._ddrA & 0xff;  // Bits that are inputs (0 in DDR)
    const outputMask = this._ddrA & 0xff;  // Bits that are outputs (1 in DDR)
    
    // External input values would be read here for input pins
    // For now, we just use 1s (pulled high) for input bits
    const inputValue = 0xff & inputMask;
    
    // For output pins, we use the stored value
    const outputValue = this._portA & outputMask;
    
    // Combine the input and output values
    return inputValue | outputValue;
  }

  /**
   * Sets Port A value (keyboard columns / joystick 2)
   */
  set portA(value: number) {
    this._portA = value & 0xFF;
  }

  /**
   * Gets Port B value (keyboard rows / joystick 1)
   * This is where we read the keyboard matrix state based on the row selection in Port A
   */
  get portB(): number {
    // For Port B, only bits set as inputs (0 in DDR) will read external values
    // Bits set as outputs (1 in DDR) will read the value set in the port register
    const inputMask = ~this._ddrB & 0xff;  // Bits that are inputs (0 in DDR)
    const outputMask = this._ddrB & 0xff;  // Bits that are outputs (1 in DDR)
    
    // Read keyboard matrix for input bits
    // Port A is used to select keyboard columns (active low)
    let keyboardValue = 0xff;
    if (inputMask) {  // If there are any input bits
      // Read keyboard state using Port A as row selection
      keyboardValue = this.machine.keyboardDevice.getKeyLineStatus(this._portA);
    }
    
    // Apply input mask to keyboard value
    const inputValue = keyboardValue & inputMask;
    
    // For output pins, use the stored value
    const outputValue = this._portB & outputMask;
    
    // Combine the input and output values
    return inputValue | outputValue;
  }

  /**
   * Sets Port B value (keyboard rows / joystick 1)
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
   * @param regIndex Register index (0-15, corresponding to $DC00-$DC0F)
   * @returns The value of the register
   */
  readRegister(regIndex: number): number {
    regIndex &= 0x0F; // Limit to 16 registers (0-15)
    
    switch (regIndex) {
      case 0x00: return this._portA;
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
   * @param regIndex Register index (0-15, corresponding to $DC00-$DC0F)
   * @param value The value to write
   */
  writeRegister(regIndex: number, value: number): void {
    regIndex &= 0x0F; // Limit to 16 registers (0-15)
    value &= 0xFF;    // Ensure it's a byte value
    
    switch (regIndex) {
      case 0x00: 
        this._portA = value;
        break;
      case 0x01:
        this._portB = value;
        break;
      case 0x02:
        this._ddrA = value;
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
        } else {
          // One-shot mode
          timerA = 0;
          this._controlA &= ~0x01; // Stop timer
          
          // Set interrupt flag
          this._interruptControl |= 0x01 | 0x80;
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
        } else {
          // One-shot mode
          timerB = 0;
          this._controlB &= ~0x01; // Stop timer
          
          // Set interrupt flag
          this._interruptControl |= 0x02 | 0x80;
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
   * Checks if the current TOD matches the alarm setting and triggers an interrupt if needed
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
      }
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
