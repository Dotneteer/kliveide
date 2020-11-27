import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "../../native/api/api";
import {
  Spectrum48MachineState,
  MachineState,
  ExecuteCycleOptions,
  EmulationMode,
  DebugStepMode,
} from "./machine-state";
import { ROM_48_OFFS } from "../../native/api/memory-map";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
const SP48_MAIN_ENTRY = 0x12ac;

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

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(model: string): Promise<number> {
    const controller = this.vmEngineController;
    await controller.run(
      new ExecuteCycleOptions(
        EmulationMode.UntilExecutionPoint,
        DebugStepMode.None,
        true,
        0,
        SP48_MAIN_ENTRY
      )
    );
    await controller.waitForCycleTermination();
    return SP48_MAIN_ENTRY;
  }
}
