import { ZxSpectrumBase } from "./ZxSpectrumBase";
import { MachineApi } from "./wa-api";
import {
  Spectrum48MachineState,
  MachineState,
  ExecuteCycleOptions,
  EmulationMode,
  DebugStepMode,
} from "../../shared/machines/machine-state";
import { ROM_48_OFFS } from "./memory-map";
import { CodeToInject } from "../../shared/machines/api-data";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
const SP48_MAIN_ENTRY = 0x12ac;

/**
 * This class represents a ZX Spectrum 48 machine
 */
export class ZxSpectrum48 extends ZxSpectrumBase {
  /**
   * The type identifier of the machine
   */
  readonly typeId = "sp48";

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 48K";

  /**
   * Creates a new instance of the ZX Spectrum machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api, roms);
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
   * @param _model Model to run in the virtual machine
   */
  async prepareForInjection(_model: string): Promise<number> {
    const controller = this.vmEngineController;
    await controller.start(
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

  /**
   * Clears the screen before starting the injected code
   */
  async beforeRunInjected(
    codeToInject: CodeToInject,
    _debug?: boolean
  ): Promise<void> {
    // --- Clear the screen before run on ZX Spectrum 48
    if (codeToInject.model === "48") {
      for (let i = 0x4000; i < 0x5800; i++) {
        this.writeMemory(i, 0x00);
      }
    }
  }
}
