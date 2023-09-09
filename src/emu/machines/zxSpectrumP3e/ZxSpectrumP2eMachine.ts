import { ZxSpectrum2Or3Machine } from "./ZxSpectrum2Or3Machine";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrumP2eMachine extends ZxSpectrum2Or3Machine {
  /**
   * The unique identifier of the machine type
   */
  readonly machineId = "spp2e";

  // --- Use the ROM of ZX Spectrum +3E
  get romId () {
    return "spp3e";
  }

  // --- +2E does not have a floppy drive
  protected hasFloppy (): boolean {
    return false;
  }

  protected hasDriveB (): boolean {
    return false;
  }
}
