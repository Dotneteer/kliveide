import type { IZxSpectrumMachine } from "@emuabstr/IZxSpectrumMachine";
import type { IGenericPsgDevice } from "@emuabstr/IGenericPsgDevice";

/**
 * Represents the AY-3-8910 PSG chip as a device
 */
export interface ISpectrumPsgDevice extends IGenericPsgDevice<IZxSpectrumMachine> {}
