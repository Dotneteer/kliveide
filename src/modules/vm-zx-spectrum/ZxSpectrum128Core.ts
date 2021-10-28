import { MachineCreationOptions } from "@abstractions/vm-core-types";
import { ZxSpectrumCoreBase } from "./ZxSpectrumCoreBase";

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
   * Gets a unique identifier for the particular configuration of the model
   */
  get configurationId(): string {
    return this.getModelId();
  }

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
}
