import { VirtualMachineCoreBase } from "../VirtualMachineCoreBase";
import { MachineCreationOptions } from "../vm-core-types";

/**
 * ZX Spectrum common core implementation
 */
export abstract class ZxSpectrumCoreBase extends VirtualMachineCoreBase {
  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
  }
}
