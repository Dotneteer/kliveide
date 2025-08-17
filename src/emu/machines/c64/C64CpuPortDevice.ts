import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * Capacitor effect constants for the C64 CPU port.
 * These represent the time (in CPU cycles) that the capacitor effect persists.
 */
export const C64_CAPACITOR_CONSTANTS = {
  // ~350ms at 1MHz for regular C64
  FALL_OFF_CYCLES: 350000,
  // ±20% variation to simulate real-world component tolerance
  FALL_OFF_RANDOM: 70000
};

/**
 * Represents a capacitor bit state in the C64 CPU port.
 */
export interface CapacitorBitState {
  value: number; // 0 or the bit value (e.g., 0x40 for bit 6)
  setTacts: number; // When the bit was last set (in cycles)
  falloffActive: boolean; // Whether the capacitor effect is active
}

/**
 * Implementation of the I/O Expansion Port for the Commodore 64
 * The expansion port is used for cartridges and other peripherals,
 * allowing them to map memory and I/O into the system address space.
 * This includes registers in the $DE00-$DFFF range.
 */
export class C64CpuPortDevice implements IGenericDevice<IC64Machine> {
  // --- Internal state
  private _direction: number; // CPU port direction register ($00)
  private _data: number; // CPU port data register ($01)
  private _dataRead: number; // What $01 reads back

  // Per-bit capacitor state (bits 3-7 can have capacitor effect)
  private _capacitorBits: CapacitorBit[] = [];
  
  /**
   * Get the current capacitor bit states (readonly)
   * This is primarily intended for testing purposes.
   */
  get capacitorBits(): ReadonlyArray<CapacitorBitState> {
    return this._capacitorBits;
  }

  /**
   * Initialize the CPU port device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public machine: IC64Machine) {
    this.reset();
  }

  /**
   * Reset the CPU port device to its initial state.
   */
  reset(): void {
    // Reset registers to default values
    this._direction = 0x2F; // Default CPU port direction after reset (bits 5 and 6 are inputs)
    this._data = 0x17;      // Default CPU port data after reset
    
    // --- Initialize capacitor bits to power-on state
    // --- At power-on/reset, ALL capacitor variables are set to 0
    // --- No capacitor effect is initially active
    for (let bit = 0; bit < 8; bit++) {
      this._capacitorBits[bit] = {
        value: 0,
        setTacts: 0,
        falloffActive: false
      };
    }

    // --- Initialize with default values
    this.updateDataRead();
    
    // Update external signals
    this.updateExternalSignals();
  }

  dispose(): void {
    // --- Nothing to dispose
  }

  /**
   * Read CPU port direction register ($00)
   * @returns The current direction register value
   */
  readDirection(): number {
    return this._direction;
  }

  /**
   * Write CPU port direction register ($00)
   * @param value The new direction register value
   */
  writeDirection(value: number): void {
    const oldDirection = this._direction;
    this._direction = value;

    // Check for output-to-input transitions that trigger capacitor effect
    this.checkCapacitorTriggers(oldDirection, this._direction, this._data);

    this.updateDataRead();
    
    // Update external signals when direction changes
    // This is important for IEC bus lines when they switch between input/output
    this.updateExternalSignals();
  }

  /**
   * Read CPU port data register ($01)
   * @returns The current data register value
   */
  readData(): number {
    this.updateCapacitorStates();
    // Always update the data read value to ensure we get the latest IEC line states
    this.updateDataRead();
    return this._dataRead;
  }

  /**
   * Write CPU port data register ($01)
   * @param value The new data register value
   */
  writeData(value: number): void {
    this._data = value;

    // Update capacitor bits for output bits
    this.updateCapacitorBitsOnWrite(value);
    this.updateDataRead();

    // Handle external signals (tape control)
    this.updateExternalSignals();
  }

  // Implementation details for the CPU port device

  private updateDataRead(): void {
    // Update capacitor states first
    this.updateCapacitorStates();
    
    let result = 0;

    // Process each bit
    for (let bit = 0; bit < 8; bit++) {
      const bitMask = 1 << bit;
      const isOutput = (this._direction & bitMask) !== 0;

      if (isOutput) {
        // Output bit - use data register value
        result |= this._data & bitMask;
      } else {
        // Input bit
        if (bit >= 3 && bit <= 7) {
          // Bits 3-7 can have capacitor effect
          const cap = this._capacitorBits[bit];
          if (cap.falloffActive) {
            // Capacitor effect takes precedence over external input
            result |= cap.value;
          } else {
            // Read external input or default to 0
            result |= this.getExternalInput(bit);
          }
        } else {
          // Bits 0-2 read external inputs
          result |= this.getExternalInput(bit);
        }
      }
    }

    this._dataRead = result;
  }

  /**
   * Get the external input for a specific bit.
   * @param bit The bit number (0-7)
   * @returns The value of the external input for the specified bit
   */
  private getExternalInput(bit: number): number {
    const bitMask = 1 << bit;
    
    switch (bit) {
      // --- Cassette sense (input)
      case 4:
        return this.machine.tapeDevice.cassetteSwitchSense ? bitMask : 0;

      // Bit 6 - IEC Data Line (input)
      case 6:
        // Get the state of the IEC Data line from CIA2
        // When iecDataLine is false (active/low), we return 0
        // When iecDataLine is true (inactive/high), we return 0x40
        return this.machine.cia2Device.iecDataLine ? bitMask : 0;

      // Bit 7 - IEC Clock Line (input)
      case 7:
        // Get the state of the IEC Clock line from CIA2
        // When iecClockLine is false (active/low), we return 0
        // When iecClockLine is true (inactive/high), we return 0x80
        return this.machine.cia2Device.iecClockLine ? bitMask : 0;

      // --- Bits 0-2 are used for memory configuration and typically not external inputs
      // --- Bits 3, 5 are floating and use capacitor effect
      default:
        return 0;
    }
  }

  private updateExternalSignals(): void {
    // Handle cassette-related signals
    this.updateCassetteSignals();
    
    // Handle IEC bus signals
    this.updateIecBusSignals();
  }
  
  /**
   * Updates cassette-related signals
   */
  private updateCassetteSignals(): void {
    // --- Bit 3: Cassette write (output)
    if ((this._direction & 0x08) !== 0) {
      // When bit 3 is output
      this.machine.tapeDevice.cassetteWrite = (this._data & 0x08) !== 0;
    }

    // --- Bit 5: Cassette motor control (output)
    if ((this._direction & 0x20) !== 0) {
      // --- Active low - bit 5 is 0 means motor ON
      this.machine.tapeDevice.motorOn = (this._data & 0x20) === 0;
    }
  }
  
  /**
   * Updates IEC bus signals based on CPU port state
   */
  private updateIecBusSignals(): void {
    // --- IEC DATA line (bit 6)
    // Note: In a real C64, there are hardware inverters in the IEC bus circuit
    // which means a "0" in the CPU port register pulls the corresponding IEC line LOW
    const isBit6Output = (this._direction & 0x40) !== 0;
    const dataOut = isBit6Output ? (this._data & 0x40) === 0 : false;
    this.machine.cia2Device.cpuPortDrivingDataLow = dataOut;
    
    // --- IEC CLOCK line (bit 7)
    const isBit7Output = (this._direction & 0x80) !== 0;
    const clockOut = isBit7Output ? (this._data & 0x80) === 0 : false;
    this.machine.cia2Device.cpuPortDrivingClockLow = clockOut;
  }

  /**
   * Check for output-to-input transitions that trigger capacitor effect.
   * @param oldDirection The old direction register value
   * @param newDirection The new direction register value
   * @param dataValue The current data register value
   */
  private checkCapacitorTriggers(
    oldDirection: number,
    newDirection: number,
    dataValue: number
  ): void {
    // --- Check bits 3-7 for output-to-input transitions
    for (let bit = 3; bit <= 7; bit++) {
      const bitMask = 1 << bit;
      const wasOutput = (oldDirection & bitMask) !== 0;
      const isInput = (newDirection & bitMask) === 0;
      const dataHigh = (dataValue & bitMask) !== 0;

      // Output=1 to input transition triggers capacitor effect
      if (wasOutput && isInput && dataHigh) {
        const randomOffset = this.getRandomOffset();
        const falloffTime = C64_CAPACITOR_CONSTANTS.FALL_OFF_CYCLES + randomOffset;
        
        this._capacitorBits[bit] = {
          value: bitMask,
          setTacts: this.machine.tacts + falloffTime,
          falloffActive: true
        };
      } 
      // Output=0 to input transition doesn't trigger capacitor effect
      else if (wasOutput && isInput && !dataHigh) {
        this._capacitorBits[bit] = {
          value: 0,
          setTacts: 0,
          falloffActive: false
        };
      }
    }
  }

  /**
   * Update the states of the capacitor bits based on the current cycle.
   */
  private updateCapacitorStates(): void {
    const currentTacts = this.machine.tacts;
    
    // --- Check if any capacitor bits have expired
    for (let bit = 3; bit <= 7; bit++) {
      const cap = this._capacitorBits[bit];
      if (cap.falloffActive && currentTacts >= cap.setTacts) {
        // --- Capacitor has discharged
        cap.falloffActive = false;
        cap.value = 0;
        
        // Ensure that the data read gets updated to reflect discharged capacitor
        this.updateDataRead();
      }
    }
  }

  /**
   * Update the capacitor bits based on the current cycle.
   * @param value The new value to write to the data register
   */
  private updateCapacitorBitsOnWrite(value: number): void {
    // --- Update capacitor bits for output bits that are set to 1
    for (let bit = 3; bit <= 7; bit++) {
      const bitMask = 1 << bit;
      const isOutput = (this._direction & bitMask) !== 0;
      const isHigh = (value & bitMask) !== 0;

      if (isOutput && isHigh) {
        // --- Reset/extend capacitor effect for this bit
        this._capacitorBits[bit] = {
          value: bitMask,
          setTacts: this.machine.tacts + C64_CAPACITOR_CONSTANTS.FALL_OFF_CYCLES + this.getRandomOffset(),
          falloffActive: true
        };
      }
    }
  }

  /**
   * Get a random offset for the capacitor falloff time.
   * @returns A random offset in cycles (±20% of the base falloff time)
   */
  private getRandomOffset(): number {
    return Math.floor((Math.random() - 0.5) * 2 * C64_CAPACITOR_CONSTANTS.FALL_OFF_RANDOM);
  }

  // ============================================================================
  // === TEST UTILITY METHODS ===================================================
  // ============================================================================
  // The following methods are intended for testing purposes only and should not
  // be used in regular production code.

  /**
   * Set a capacitor bit's falloff state - for testing purposes only
   * @param bit The bit number (3-7)
   * @param active Whether the falloff is active
   */
  setCapacitorFalloffActive(bit: number, active: boolean): void {
    if (bit >= 3 && bit <= 7) {
      this._capacitorBits[bit].falloffActive = active;
    }
  }

  /**
   * Set a capacitor bit's value - for testing purposes only
   * @param bit The bit number (3-7)
   * @param value The value to set (0 or the bit's mask value)
   */
  setCapacitorValue(bit: number, value: number): void {
    if (bit >= 3 && bit <= 7) {
      this._capacitorBits[bit].value = value;
    }
  }

  /**
   * Set a capacitor bit's tacts value - for testing purposes only
   * @param bit The bit number (3-7)
   * @param tacts The tacts value to set
   */
  setCapacitorTacts(bit: number, tacts: number): void {
    if (bit >= 3 && bit <= 7) {
      this._capacitorBits[bit].setTacts = tacts;
    }
  }
}

/**
 * Internal representation of a capacitor bit in the C64 CPU port.
 * This is the internal type used by the implementation, while CapacitorBitState
 * is the public interface exposed for testing and diagnostics.
 */
type CapacitorBit = CapacitorBitState;
