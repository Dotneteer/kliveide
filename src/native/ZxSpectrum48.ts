import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "./api";
import { Spectrum48MachineState, SpectrumMachineState } from "./machine-state";

/**
 * This class represents a ZX Spectrum 48 machine
 */
export class ZxSpectrum48 extends ZxSpectrumBase {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param type Machine type
   */
  constructor(public api: MachineApi) {
    super(api, 0);
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): SpectrumMachineState {
    return new Spectrum48MachineState()
  }
}
