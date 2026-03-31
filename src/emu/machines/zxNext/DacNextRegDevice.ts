import { DacDevice } from "./DacDevice";

/**
 * DAC NextReg Device for ZX Spectrum Next
 * Provides NextReg mirrors for DAC control
 * 
 * NextReg Mapping (FPGA spec):
 * - 0x2C (44): DAC B Mirror (left)
 * - 0x2D (45): DAC A+D Mirror (mono)
 * - 0x2E (46): DAC C Mirror (right)
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
      case 0x2c: // DAC B Mirror (left)
        this.dac.setDacB(value);
        return true;

      case 0x2d: // DAC A+D Mirror (mono)
        this.dac.setDacA(value);
        this.dac.setDacD(value);
        return true;

      case 0x2e: // DAC C Mirror (right)
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
      case 0x2c: // I2S left MSB (not implemented, returns 0)
        return 0;

      case 0x2d: // I2S LSB (not implemented, returns 0)
        return 0;

      case 0x2e: // I2S right MSB (not implemented, returns 0)
        return 0;

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
