import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { IGenericPsgDevice } from "../../abstractions/IGenericPsgDevice";

/**
 * Represents the AY-3-8910 PSG chip as a device
 */
export interface ISpectrumPsgDevice extends IGenericPsgDevice<IZxSpectrumMachine> {}
