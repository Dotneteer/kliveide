import { DacDevice } from "./DacDevice";

/**
 * DAC NextReg Device for ZX Spectrum Next
 * Provides NextReg mirrors for DAC control
 * 
 * NextReg Mapping:
 * - 0x2C (44): Mono DAC (writes to both DAC A and DAC D)
 * - 0x2D (45): Left DAC (writes to DAC B)
 * - 0x2E (46): Right DAC (writes to DAC C)
 */
export class DacNextRegDevice {
  private dac: DacDevice;

  constructor(dac: DacDevice) {
    this.dac = dac;
  }

  /**
   * Write to NextReg for DAC control
   * @param reg NextReg address (0x00-0xFF)
   * @param value 8-bit value to write
   * @returns true if this device handled the register, false otherwise
   */
  writeNextReg(reg: number, value: number): boolean {
    switch (reg) {
      case 0x2c: // Mono DAC (A + D)
        this.dac.setDacA(value);
        this.dac.setDacD(value);
        return true;

      case 0x2d: // Left DAC (B)
        this.dac.setDacB(value);
        return true;

      case 0x2e: // Right DAC (C)
        this.dac.setDacC(value);
        return true;

      default:
        return false;
    }
  }

  /**
   * Read from NextReg for DAC state
   * @param reg NextReg address (0x00-0xFF)
   * @returns 8-bit value or undefined if not handled by this device
   */
  readNextReg(reg: number): number | undefined {
    switch (reg) {
      case 0x2c: // Mono DAC (read A - should match D)
        return this.dac.getDacA();

      case 0x2d: // Left DAC (read B)
        return this.dac.getDacB();

      case 0x2e: // Right DAC (read C)
        return this.dac.getDacC();

      default:
        return undefined;
    }
  }

  /**
   * Reset the device (pass through to DAC)
   */
  reset(): void {
    this.dac.reset();
  }
}
