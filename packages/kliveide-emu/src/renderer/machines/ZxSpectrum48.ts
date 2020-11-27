import { ZxSpectrumBase } from "./Z80VmBase";
import { MachineApi } from "../../native/api/api";
import {
  Spectrum48MachineState,
  MachineState,
} from "./machine-state";
import { ROM_48_OFFS } from "../../native/api/memory-map";

/**
 * This class represents a ZX Spectrum 48 machine
 */
export class ZxSpectrum48 extends ZxSpectrumBase {
  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api, 0, roms);
  }

  /**
   * Retrieves a ZX Spectrum 48 machine state object
   */
  createMachineState(): MachineState {
    return new Spectrum48MachineState();
  }

  /**
   * Gets the memory address of the first ROM page of the machine
   */
  getRomPageBaseAddress(): number {
    return ROM_48_OFFS;
  }
}
