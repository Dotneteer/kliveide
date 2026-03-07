import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Implements the Multiface NMI device for ZX Spectrum Next.
 * Models the multiface.vhd logic: NMI activation, memory paging, and port handling.
 */
export class MultifaceDevice implements IGenericDevice<IZxNextMachine> {
  /** nmi_active in VHDL — also exposed as mfNmiHold */
  nmiActive: boolean;

  /** mf_enable in VHDL — multiface memory paged in */
  mfEnabled: boolean;

  /** invisible flag (MF128/+3 only) */
  invisible: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.invisible = true;
  }

  // --- Mode helpers (derived from multifaceType = nr_0a_mf_type bits 7:6)

  /** True when mode is MF48 / MF1 (type 3) */
  get mode48(): boolean {
    return this.machine.divMmcDevice.multifaceType === 3;
  }

  /** True when mode is MF+3 (type 0) */
  get modeP3(): boolean {
    return this.machine.divMmcDevice.multifaceType === 0;
  }

  /** True when mode is MF128 (type 1 or 2) */
  get mode128(): boolean {
    return !this.mode48 && !this.modeP3;
  }

  /**
   * MF is considered active when memory is paged in or NMI is pending.
   * Mirrors VHDL mf_is_active = mf_mem_en OR mf_nmi_hold.
   */
  get isActive(): boolean {
    return this.mfEnabled || this.nmiActive;
  }

  /**
   * Port address used to enable (page in) the multiface memory.
   * Derived from nr_0a_mf_type:
   *   type 0 (MF+3):   0x3F
   *   type 1 (MF128 v87.2): 0xBF
   *   type 2 (MF128 v87.12): 0x9F
   *   type 3 (MF48/MF1): 0x9F
   */
  get enablePortAddress(): number {
    const t = this.machine.divMmcDevice.multifaceType;
    return t === 2 || t === 3 ? 0x9f : t === 1 ? 0xbf : 0x3f;
  }

  /**
   * Port address used to disable (page out) the multiface memory.
   * Derived from nr_0a_mf_type:
   *   type 0 (MF+3):   0xBF
   *   type 1 (MF128 v87.2): 0x3F
   *   type 2 (MF128 v87.12): 0x1F
   *   type 3 (MF48/MF1): 0x1F
   */
  get disablePortAddress(): number {
    const t = this.machine.divMmcDevice.multifaceType;
    return t === 2 || t === 3 ? 0x1f : t === 1 ? 0x3f : 0xbf;
  }

  /**
   * Called when the M1 button (simulated multiface NMI button) is pressed.
   * Sets nmi_active and clears invisible (as the physical button does on MF128/+3).
   * Only has effect when nmiActive is not already set — "first come, first served".
   */
  pressNmiButton(): void {
    if (!this.nmiActive) {
      this.nmiActive = true;
      this.invisible = false; // button press clears invisible flag (MF128/+3)
    }
  }

  // --- Port read handlers

  /**
   * Handles a read of the enable port.
   * If invisible_eff (invisible && !mode48): pages out MF, returns 0xFF.
   * Otherwise: if nmiActive, pages in MF; returns 0xFF (emulator does not mirror port data).
   */
  readEnablePort(): number {
    const invisibleEff = this.invisible && !this.mode48;
    if (invisibleEff) {
      this.mfEnabled = false;
      this.machine.memoryDevice.updateFastPathFlags();
      return 0xff;
    }
    if (this.nmiActive) {
      this.mfEnabled = true;
      this.machine.memoryDevice.updateFastPathFlags();
    }
    return 0xff;
  }

  /**
   * Handles a read of the disable port.
   * Pages out MF memory. For MF+3 mode also clears nmiActive.
   */
  readDisablePort(): number {
    this.mfEnabled = false;
    if (this.modeP3) {
      this.nmiActive = false;
    }
    this.machine.memoryDevice.updateFastPathFlags();
    return 0xff;
  }

  // --- Port write handlers

  /**
   * Handles a write to the enable port.
   * Clears nmiActive. For MF+3 mode also sets invisible.
   */
  writeEnablePort(_value: number): void {
    this.nmiActive = false;
    if (this.modeP3) {
      this.invisible = true;
    }
  }

  /**
   * Handles a write to the disable port.
   * Clears nmiActive. For non-MF+3 modes sets invisible.
   */
  writeDisablePort(_value: number): void {
    this.nmiActive = false;
    if (!this.modeP3) {
      this.invisible = true;
    }
  }

  /**
   * Called from ZxNextMachine.beforeOpcodeFetch() when PC == 0x0066 and MF NMI is active.
   * Pages in the multiface memory so the MF ROM can handle the NMI.
   */
  onFetch0066(): void {
    if (this.nmiActive) {
      this.mfEnabled = true;
      this.machine.memoryDevice.updateFastPathFlags();
    }
  }

  /**
   * Called when a RETN instruction is executed while the multiface is active.
   * Clears nmiActive and mfEnabled (pages out MF memory).
   */
  handleRetn(): void {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.machine.memoryDevice.updateFastPathFlags();
  }

  /**
   * Resets the multiface device to its initial state.
   */
  reset(): void {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.invisible = true; // starts invisible to prevent accidental paging
  }
}
