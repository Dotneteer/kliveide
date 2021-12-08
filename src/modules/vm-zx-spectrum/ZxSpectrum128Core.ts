import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  MachineCreationOptions,
} from "@abstractions/vm-core-types";
import { spectrumKeyCodes } from "./spectrum-keys";
import {
  SP128_MAIN_WAITING_LOOP,
  SP128_RETURN_TO_EDITOR,
  SP48_MAIN_ENTRY,
  ZxSpectrumCoreBase,
} from "./ZxSpectrumCoreBase";

/**
 * ZX Spectrum 128 core implementation
 */
export class ZxSpectrum128Core extends ZxSpectrumCoreBase {
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
    return "sp128";
  }

  /**
   * The name of the module file with the WA machine engine
   */
  readonly waModuleFile: string = "sp128.wasm";

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 128K";

  /**
   * Indicates if this model supports the AY-3-8912 PSG chip
   */
  get supportsPsg(): boolean {
    return true;
  }

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  async prepareForInjection(model: string): Promise<number> {
    const controller = this.controller;
    console.log(model);
    switch (model) {
      case "128":
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_MAIN_WAITING_LOOP
          )
        );
        await controller.waitForCycleTermination();
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_RETURN_TO_EDITOR
          )
        );
        await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
        await controller.delayKey(spectrumKeyCodes.Enter);
        await controller.waitForCycleTermination();
        return SP128_RETURN_TO_EDITOR;
      default:
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            0,
            SP128_MAIN_WAITING_LOOP
          )
        );
        await controller.waitForCycleTermination();
        await controller.start(
          new ExecuteCycleOptions(
            EmulationMode.UntilExecutionPoint,
            DebugStepMode.None,
            1,
            SP48_MAIN_ENTRY
          )
        );
        await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
        await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
        await controller.delayKey(spectrumKeyCodes.N6, spectrumKeyCodes.CShift);
        await controller.delayKey(spectrumKeyCodes.Enter);
        await controller.waitForCycleTermination();
        return SP48_MAIN_ENTRY;
    }
  }
}
