import { MachineCreationOptions } from "../vm-core-types";
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
  readonly modelId = "sp128";

  /**
   * Gets a unique identifier for the particular configuration of the model
   */
  get configurationId(): string {
    return this.modelId;
  }

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 128K";
}
