import { DacDevice } from "./DacDevice";

/**
 * DAC NextReg Device for ZX Spectrum Next
 * Provides NextReg mirrors for DAC control
 * 
 * FPGA soundrive.vhd / zxnext.vhd mapping:
 * - 0x2C (44): nr_left_we_i  → chB (left channel)
 * - 0x2D (45): nr_mono_we_i  → chA + chD (mono)
 * - 0x2E (46): nr_right_we_i → chC (right channel)
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
      case 0x2c: // Left DAC (chB) — FPGA nr_left_we_i
        this.dac.setDacB(value);
        return true;

      case 0x2d: // Mono DAC (chA + chD) — FPGA nr_mono_we_i
        this.dac.setDacA(value);
        this.dac.setDacD(value);
        return true;

      case 0x2e: // Right DAC (chC) — FPGA nr_right_we_i
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
      case 0x2c: // Left DAC (read B)
        return this.dac.getDacB();

      case 0x2d: // Mono DAC (read A — should match D)
        return this.dac.getDacA();

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
