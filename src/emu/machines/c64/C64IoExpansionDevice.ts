import { IGenericDevice } from "../../abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * Implementation of the I/O Expansion Port for the Commodore 64
 * The expansion port is used for cartridges and other peripherals, 
 * allowing them to map memory and I/O into the system address space.
 * This includes registers in the $DE00-$DFFF range.
 */
export class C64IoExpansionDevice implements IGenericDevice<IC64Machine> {
  /**
   * Memory mapped to the I/O expansion area ($DE00-$DFFF)
   * This is a 512-byte area used by expansion devices
   * Individual device registers are typically mapped into this range
   */
  private _expansionMemory: Uint8Array = new Uint8Array(512);
  
  /**
   * Tracks which regions of the expansion memory are active
   * Some cartridges may only partially decode addresses
   */
  private _activeRegions: boolean[] = Array(32).fill(false);
  
  /**
   * Interrupt request line state from expansion devices
   * true = interrupt requested, false = no interrupt
   */
  private _irqLine: boolean = false;
  
  /**
   * Reset line state from expansion devices
   * true = reset requested, false = no reset
   */
  private _resetLine: boolean = false;
  
  /**
   * Game line state from expansion devices (active low)
   * Used to control bank switching
   * false (0) = enabled, true (1) = disabled
   */
  private _gameLine: boolean = true;
  
  /**
   * Exrom line state from expansion devices (active low)
   * Used to control bank switching
   * false (0) = enabled, true (1) = disabled
   */
  private _exromLine: boolean = true;
  
  /**
   * DMA request line from expansion devices
   * true = DMA requested, false = no DMA
   */
  private _dmaLine: boolean = false;
  
  constructor(public readonly machine: IC64Machine) {
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
   * Initializes the I/O Expansion device to its default state.
   */
  reset(): void {
    // Clear expansion memory
    this._expansionMemory.fill(0);
    
    // Reset all active regions
    this._activeRegions.fill(false);
    
    // Reset control lines
    this._irqLine = false;
    this._resetLine = false;
    this._gameLine = true;
    this._exromLine = true;
    this._dmaLine = false;
  }

  /**
   * Performs a hard reset of the I/O Expansion device.
   */
  hardReset = (): void => {
    // Perform a full reset
    this.reset();
    // Additional hard reset logic can be added here
  };

  /**
   * Disposes of resources held by the I/O Expansion device.
   */
  dispose(): void {
    // Clean up resources if necessary
    // For now, nothing to dispose
  }
  
  /**
   * Gets the current state of the GAME line
   * false (0) = enabled, true (1) = disabled
   */
  get gameLine(): boolean {
    return this._gameLine;
  }
  
  /**
   * Sets the state of the GAME line
   * false (0) = enabled, true (1) = disabled
   */
  set gameLine(value: boolean) {
    this._gameLine = value;
    this.machine.memoryDevice.updateConfiguration();
  }
  
  /**
   * Gets the current state of the EXROM line
   * false (0) = enabled, true (1) = disabled
   */
  get exromLine(): boolean {
    return this._exromLine;
  }
  
  /**
   * Sets the state of the EXROM line
   * false (0) = enabled, true (1) = disabled
   */
  set exromLine(value: boolean) {
    this._exromLine = value;
    this.machine.memoryDevice.updateConfiguration();
  }
  
  /**
   * Gets the current state of the IRQ line
   */
  get irqLine(): boolean {
    return this._irqLine;
  }
  
  /**
   * Sets the state of the IRQ line
   * Setting this to true will trigger an interrupt in the CPU
   */
  set irqLine(value: boolean) {
    const oldIrq = this._irqLine;
    this._irqLine = value;
    
    // In a full implementation, this would signal the CPU's IRQ line if changed
    if (!oldIrq && value) {
      // IRQ line was pulled low (active)
      // this.machine.signalIrq(true);
    } else if (oldIrq && !value) {
      // IRQ line was released
      // this.machine.signalIrq(false);
    }
  }
  
  /**
   * Gets the current state of the RESET line
   */
  get resetLine(): boolean {
    return this._resetLine;
  }
  
  /**
   * Sets the state of the RESET line
   * Setting this to true will trigger a system reset
   */
  set resetLine(value: boolean) {
    const oldReset = this._resetLine;
    this._resetLine = value;
    
    // In a full implementation, this would trigger a system reset if changed
    if (!oldReset && value) {
      // RESET line was pulled low (active)
      // this.machine.triggerReset();
    }
  }
  
  /**
   * Gets the current state of the DMA line
   */
  get dmaLine(): boolean {
    return this._dmaLine;
  }
  
  /**
   * Sets the state of the DMA line
   * Setting this to true indicates a DMA request from the expansion device
   */
  set dmaLine(value: boolean) {
    this._dmaLine = value;
    
    // In a full implementation, this would handle DMA operations
    // if (value) {
    //   this.machine.handleDmaRequest();
    // }
  }
  
  /**
   * Gets the current memory bank configuration based on GAME and EXROM lines
   * This determines how the cartridge ROM appears in the C64's memory map
   * @returns A value from 0-7 representing the current bank configuration
   */
  get memoryBankConfig(): number {
    // Convert GAME and EXROM lines to a bank configuration value
    // In C64, these are active low signals, so we invert them for clarity
    const game = this._gameLine ? 0 : 1;
    const exrom = this._exromLine ? 0 : 1;
    
    return (game << 1) | exrom;
  }
  
  /**
   * Marks a specific region of the expansion memory as active/inactive
   * @param region Region index (0-31, each region is 16 bytes)
   * @param active Whether the region is active (true) or inactive (false)
   */
  setRegionActive(region: number, active: boolean): void {
    if (region >= 0 && region < 32) {
      this._activeRegions[region] = active;
    }
  }
  
  /**
   * Checks if a specific region of the expansion memory is active
   * @param region Region index (0-31, each region is 16 bytes)
   * @returns Whether the region is active
   */
  isRegionActive(region: number): boolean {
    if (region >= 0 && region < 32) {
      return this._activeRegions[region];
    }
    return false;
  }

  /**
   * Reads a byte from the I/O expansion memory
   * @param address Address to read from ($DE00-$DFFF)
   * @returns The byte value read
   */
  readIoRegister(address: number): number {
    // Normalize address to 0-511 range
    const localAddr = address & 0x01FF;
    
    // Check if the region is active
    const region = (localAddr >> 4) & 0x1F; // Divide by 16 to get region index
    if (this._activeRegions[region]) {
      return this._expansionMemory[localAddr];
    }
    
    // If region is not active, return floating bus (typically 0xFF)
    return 0xFF;
  }

  /**
   * Writes a byte to the I/O expansion memory
   * @param address Address to write to ($DE00-$DFFF)
   * @param value The byte value to write
   */
  writeIoRegister(address: number, value: number): void {
    // Normalize address to 0-511 range
    const localAddr = address & 0x01FF;
    
    // Check if the region is active
    const region = (localAddr >> 4) & 0x1F; // Divide by 16 to get region index
    if (this._activeRegions[region]) {
      this._expansionMemory[localAddr] = value & 0xFF;
      
      // In a full implementation, writing to certain addresses might trigger
      // side effects, like changing GAME/EXROM lines, etc.
    }
  }
  
  /**
   * Installs an expansion device ROM into the expansion memory
   * @param romData The ROM data to install
   * @param offset The offset within the expansion memory to install at
   * @param length The length of the ROM data to install
   */
  installExpansionRom(romData: Uint8Array, offset: number = 0, length: number = -1): void {
    if (length < 0) {
      length = Math.min(romData.length, this._expansionMemory.length - offset);
    }
    
    // Copy the ROM data into expansion memory
    for (let i = 0; i < length; i++) {
      if (offset + i < this._expansionMemory.length) {
        this._expansionMemory[offset + i] = romData[i];
      }
    }
    
    // Mark the appropriate regions as active
    const startRegion = Math.floor(offset / 16);
    const endRegion = Math.floor((offset + length - 1) / 16);
    
    for (let i = startRegion; i <= endRegion; i++) {
      if (i >= 0 && i < 32) {
        this._activeRegions[i] = true;
      }
    }
  }
}
