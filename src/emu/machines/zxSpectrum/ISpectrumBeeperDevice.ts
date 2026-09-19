import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { IGenericBeeperDevice } from "../../abstractions/IGenericBeeperDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface ISpectrumBeeperDevice
  extends IGenericBeeperDevice<IZxSpectrumMachine | IZxNextMachine> {
  /**
   * Closes the current sample window at `sampleEndTact` (a CPU tact) and appends the sample - for a
   * machine that keeps the sample clock itself (the ZX Next runs it on its 28 MHz clock).
   */
  emitSampleAt(sampleEndTact: number): void;
}
