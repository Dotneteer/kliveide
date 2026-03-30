import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { OFFS_MULTIFACE_MEM } from "./MemoryDevice";

/**
 * Implements the Multiface NMI device for ZX Spectrum Next.
 * Models the multiface.vhd logic: NMI activation, memory paging, and port handling.
 */
export class MultifaceDevice implements IGenericDevice<IZxNextMachine> {
  /** nmi_active in VHDL — MF ROM is running and memory is paged in */
  nmiActive: boolean;

  /**
   * Mirrors VHDL: nmi_disable_o <= enable_i AND nmi_active.
   * D9: Gated by port_multiface_io_en (enable).
   */
  get nmiHold(): boolean {
    return this.enabled && this.nmiActive;
  }

  /** mf_enable in VHDL — multiface memory paged in */
  mfEnabled: boolean;

  /** invisible flag (MF128/+3 only) */
  invisible: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.invisible = true;
  }

  // --- D4: enable gate (port_multiface_io_en / enable_i)

  /** True when port_multiface_io_en is set (NR $85 bit 1). */
  get enabled(): boolean {
    return this.machine.nextRegDevice?.portMultifaceEnabled ?? false;
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
   * invisible_eff = invisible AND NOT mode_48 (VHDL/MAME).
   */
  get invisibleEff(): boolean {
    return this.invisible && !this.mode48;
  }

  /**
   * MF is considered active when memory is paged in or NMI is pending.
   * Mirrors VHDL mf_is_active = mf_mem_en OR mf_nmi_hold.
   * D4: Gated by enable.
   */
  get isActive(): boolean {
    return this.enabled && (this.mfEnabled || this.nmiActive);
  }

  /**
   * Effective mfEnabled output gated by enable (D4).
   * Used by MemoryDevice for paging decisions.
   */
  get mfEnabledEff(): boolean {
    return this.enabled && this.mfEnabled;
  }

  /**
   * Port address used to enable (page in) the multiface memory.
   */
  get enablePortAddress(): number {
    const t = this.machine.divMmcDevice.multifaceType;
    return t === 2 || t === 3 ? 0x9f : t === 1 ? 0xbf : 0x3f;
  }

  /**
   * Port address used to disable (page out) the multiface memory.
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
      this.invisible = false;
    }
  }

  // --- Port read handlers

  /**
   * Handles a read of the enable port (D5).
   * VHDL clock_w: mf_enable <= !invisible_eff.
   * Returns mode-dependent paging data per MAME mf_port_en_r / mf_port_r.
   */
  readEnablePort(fullPortAddress: number): number {
    // D4: if not enabled, no state change — fall through
    if (!this.enabled) {
      return this._fallThroughData(fullPortAddress);
    }

    // State: mf_enable <= !invisible_eff (reads don't modify invisible or nmiActive)
    this.mfEnabled = !this.invisibleEff;
    this.machine.memoryDevice.updateFastPathFlags();

    // D5: return mode-dependent data based on mf_port_en_r()
    // mf_port_en_r = enable && port_mf_enable_rd && !invisible_eff && (mode_128 || mode_p3)
    const mfPortEn = !this.invisibleEff && (this.mode128 || this.modeP3);
    if (!mfPortEn) {
      return this._fallThroughData(fullPortAddress);
    }
    // MF 128/48 (type != 0): return (bit3_of_7ffd << 7) | 0x7F
    if (!this.modeP3) {
      const p7ffd = this.machine.memoryDevice.port7ffdValue;
      return ((p7ffd & 0x08) << 4) | 0x7f;
    }
    // MF +3: return paging register based on address bits 15:12
    const addrHigh4 = (fullPortAddress >> 12) & 0x0f;
    switch (addrHigh4) {
      case 0x01: return this.machine.memoryDevice.port1ffdValue;
      case 0x07: return this.machine.memoryDevice.port7ffdValue;
      case 0x0d: return this.machine.memoryDevice.portDffdValue;
      case 0x0e: return 0x00 & 0xc0; // portEff7 not implemented — return 0x00
      default:   return this.machine.composedScreenDevice.borderColor & 0x07;
    }
  }

  /**
   * Handles a read of the disable port (D2, D4, D6).
   * VHDL clock_w: mf_enable cleared by port_mf_disable_rd.
   * D2: In +3 mode, also clears nmi_active.
   */
  readDisablePort(fullPortAddress: number): number {
    // D4: if not enabled, no state change — fall through
    if (!this.enabled) {
      return this._fallThroughData(fullPortAddress);
    }

    this.mfEnabled = false;
    // D2: disable port read in +3 mode clears nmiActive
    if (this.modeP3) {
      this.nmiActive = false;
    }
    this.machine.memoryDevice.updateFastPathFlags();
    // D6: disable port reads always have mf_port_en=false → fall through
    return this._fallThroughData(fullPortAddress);
  }

  // --- Port write handlers (D1/D8)

  /**
   * Handles a write to the enable port (D1).
   * MAME clock_w: clears nmi_active in all modes.
   * In +3 mode, also sets invisible=1.
   */
  writeEnablePort(_value: number): void {
    if (!this.enabled) return; // D4
    // D1: nmi_active cleared by any port write
    this.nmiActive = false;
    // D1/D8: enable_wr in +3 mode → invisible=1
    if (this.modeP3) {
      this.invisible = true;
    }
    this.machine.memoryDevice.updateFastPathFlags();
  }

  /**
   * Handles a write to the disable port (D1).
   * MAME clock_w: clears nmi_active in all modes.
   * In non-+3 modes, also sets invisible=1.
   */
  writeDisablePort(_value: number): void {
    if (!this.enabled) return; // D4
    // D1: nmi_active cleared by any port write
    this.nmiActive = false;
    // D1/D8: disable_wr in non-+3 modes → invisible=1
    if (!this.modeP3) {
      this.invisible = true;
    }
    this.machine.memoryDevice.updateFastPathFlags();
  }

  /**
   * Called from ZxNextMachine.beforeOpcodeFetch() when PC == 0x0066 and MF NMI is active.
   * Pages in the multiface memory so the MF ROM can handle the NMI.
   */
  onFetch0066(): void {
    // D10: removed console.log
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
   * Handles a port read, routing to enable/disable based on current mode.
   * The full port address (including high byte) is passed through for MF+3 register selection.
   */
  handlePortRead(portAddress: number): number {
    const lowByte = portAddress & 0xff;
    if (lowByte === this.enablePortAddress) return this.readEnablePort(portAddress);
    if (lowByte === this.disablePortAddress) return this.readDisablePort(portAddress);
    // Not a multiface port for the current mode — fall through
    return this._fallThroughData(portAddress);
  }

  /**
   * Handles a port write, routing to enable/disable based on current mode.
   */
  handlePortWrite(portAddress: number, value: number): void {
    // D4: if not enabled, port writes are no-ops
    if (!this.enabled) return;
    const lowByte = portAddress & 0xff;
    if (lowByte === this.enablePortAddress) this.writeEnablePort(value);
    else if (lowByte === this.disablePortAddress) this.writeDisablePort(value);
  }

  reset(): void {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.invisible = true;
  }

  /**
   * Returns fall-through data for port reads when multiface doesn't handle the data.
   * Port 0x1F → 0x00 (joystick passthrough would return kempston data; simplified to 0x00),
   * other ports → 0x00.
   */
  private _fallThroughData(_portAddress: number): number {
    return 0x00;
  }
}
