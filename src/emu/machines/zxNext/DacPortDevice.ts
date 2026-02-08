import { DacDevice } from "./DacDevice";

/**
 * DAC Port Device for ZX Spectrum Next
 * Routes I/O port writes to DAC channels
 * 
 * Port Mapping (all even addresses):
 * - 0x1F, 0xF1, 0x3F → DAC A
 * - 0x0F, 0xF3 → DAC B
 * - 0xDF, 0xFB → DAC A + DAC D
 * - 0xB3 → DAC B + DAC C
 * - 0x4F, 0xF9 → DAC C
 * - 0x5F → DAC D
 */
export class DacPortDevice {
  private dac: DacDevice;

  constructor(dac: DacDevice) {
    this.dac = dac;
  }

  /**
   * Handle I/O port write
   * Routes the value to appropriate DAC channel(s) based on port address
   * @param port Port address (even values only)
   * @param value 8-bit value to write
   */
  writePort(port: number, value: number): void {
    // Normalize port to even address (remove bit 0)
    const normalizedPort = port & 0xfe;

    switch (normalizedPort) {
      // DAC A
      case 0x1e:
      case 0xf0:
      case 0x3e:
        this.dac.setDacA(value);
        break;

      // DAC B
      case 0x0e:
      case 0xf2:
        this.dac.setDacB(value);
        break;

      // DAC A + DAC D
      case 0xde:
      case 0xfa:
        this.dac.setDacA(value);
        this.dac.setDacD(value);
        break;

      // DAC B + DAC C
      case 0xb2:
        this.dac.setDacB(value);
        this.dac.setDacC(value);
        break;

      // DAC C
      case 0x4e:
      case 0xf8:
        this.dac.setDacC(value);
        break;

      // DAC D
      case 0x5e:
        this.dac.setDacD(value);
        break;

      // Unrecognized port - ignore
      default:
        break;
    }
  }

  /**
   * Handle I/O port read
   * Currently not implemented - DAC ports are write-only
   * @param port Port address
   * @returns 0xFF (open bus)
   */
  readPort(port: number): number {
    // DAC ports are write-only, return open bus value
    return 0xff;
  }

  /**
   * Reset the port device (pass through to DAC)
   */
  reset(): void {
    this.dac.reset();
  }
}
