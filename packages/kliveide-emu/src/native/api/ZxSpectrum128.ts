import { ZxSpectrumBase } from "./Z80VmBase";
import { MachineApi } from "./api";
import { Spectrum128MachineState, MachineState } from "./machine-state";
import { ROM_128_0_OFFS } from "./memory-map";

/**
 * This class represents a ZX Spectrum 48 machine
 */
export class ZxSpectrum128 extends ZxSpectrumBase {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api, 1, roms);
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new Spectrum128MachineState();
  }

  /**
   * Gets the memory address of the first ROM page of the machine
   */
  getRomPageBaseAddress(): number {
    return ROM_128_0_OFFS;
  }
}
