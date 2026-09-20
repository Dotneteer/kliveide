import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice extends IGenericBeeperDevice<IZxSpectrumMachine> {
  /**
   * Closes the current sample window at `sampleEndTact` (a CPU tact) and appends the sample - for a
   * machine that keeps the sample clock itself.
   */
  emitSampleAt(sampleEndTact: number): void;
}
