import { ZxSpectrum2Or3Machine } from "./ZxSpectrum2Or3Machine";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrumP3eMachine extends ZxSpectrum2Or3Machine {
  /**
   * The unique identifier of the machine type
   */
  readonly machineId = "spp3e";

  // --- This machine has one FDD
  protected hasFloppy (): boolean {
    return true;
  }
  protected hasDriveB (): boolean {
    return false;
  }
}
