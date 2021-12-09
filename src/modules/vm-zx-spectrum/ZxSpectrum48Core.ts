import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  MachineCreationOptions,
} from "@abstractions/vm-core-types";
import { SP48_MAIN_ENTRY, ZxSpectrumCoreBase } from "./ZxSpectrumCoreBase";

/**
 * ZX Spectrum 48 core implementation
 */
export class ZxSpectrum48Core extends ZxSpectrumCoreBase {
  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
  }

  /**
   * Gets the unique model identifier of the machine
   */
  getModelId(): string {
    return "sp48";
  }

  /**
   * The name of the module file with the WA machine engine
   */
  readonly waModuleFile: string = "sp48.wasm";

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 48K";

  /**
   * Prepares the engine for code injection
   * @param _model Model to run in the virtual machine
   */
  async prepareForInjection(_model: string): Promise<number> {
    const controller = this.controller;
    await controller.start(
      new ExecuteCycleOptions(
        EmulationMode.UntilExecutionPoint,
        DebugStepMode.None,
        0,
        SP48_MAIN_ENTRY
      )
    );
    await controller.waitForCycleTermination();
    return SP48_MAIN_ENTRY;
  }
}
