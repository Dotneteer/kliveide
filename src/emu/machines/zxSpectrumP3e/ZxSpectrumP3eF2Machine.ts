import { ZxSpectrum2Or3Machine } from "./ZxSpectrum2Or3Machine";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrumP3eF2Machine extends ZxSpectrum2Or3Machine {
  /**
   * The unique identifier of the machine type
   */
  readonly machineId = "spp3ef2";

  // --- Use the ROM of ZX Spectrum +3E
  get romId () {
    return "spp3e";
  }

  // --- This machine has two FDDs
  protected hasFloppy (): boolean {
    console.log("spp3ef2");
    return true;
  }
  protected hasDriveB (): boolean {
    return true;
  }
}
