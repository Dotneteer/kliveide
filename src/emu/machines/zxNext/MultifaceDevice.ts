import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Implements the Multiface NMI device for ZX Spectrum Next.
 * Models the multiface.vhd logic: NMI activation, memory paging, and port handling.
 */
export class MultifaceDevice implements IGenericDevice<IZxNextMachine> {
  /** nmi_active in VHDL — MF ROM is running and memory is paged in */
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

  // --- Enable gating (FPGA: reset <= reset_i or not enable_i)
  // MAME gates outputs by m_enable; we match that approach.

  /**
   * Maps to FPGA enable_i / MAME m_enable.
   * Reflects nextreg 0x83 bit 1 (portMultifaceEnabled).
   */
  get enabled(): boolean {
    return this.machine.nextRegDevice.portMultifaceEnabled;
  }

  /**
   * Mirrors VHDL: nmi_disable_o <= nmi_active, gated by enable.
   * MAME: nmi_disable_r() { return m_enable && m_nmi_active; }
   */
  get nmiHold(): boolean {
    return this.enabled && this.nmiActive;
  }

  /**
   * Mirrors VHDL: mf_enabled_o <= mf_enable_eff, gated by enable.
   * MAME: mf_enabled_r() { return m_enable && mf_enable_eff(); }
   * (fetch_66 term omitted — handled imperatively by onFetch0066)
   */
  get mfEnabledEff(): boolean {
    return this.enabled && this.mfEnabled;
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
   * Mirrors VHDL mf_is_active = mf_mem_en OR mf_nmi_hold, gated by enable.
   */
  get isActive(): boolean {
    return this.enabled && (this.mfEnabled || this.nmiActive);
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
   * VHDL clock_w: mf_enable <= !invisible_eff (when not fetch_66 or disable_rd).
   * Matches MAME: enable port read sets mf_enable based on invisible_eff.
   * nmi_active and invisible are NOT modified (MAME port_io_dly prevents it).
   */
  readEnablePort(): number {
    const invisibleEff = this.invisible && !this.mode48;
    this.mfEnabled = !invisibleEff;
    this.machine.memoryDevice.updateFastPathFlags();
    return 0xff;
  }

  /**
   * Handles a read of the disable port.
   * VHDL clock_w: mf_enable is cleared by port_mf_disable_rd.
   * nmi_active is NOT modified by port reads (MAME port_io_dly prevents it).
   * Only RETN (handleRetn) clears nmi_active.
   */
  readDisablePort(): number {
    this.mfEnabled = false;
    this.machine.memoryDevice.updateFastPathFlags();
    return 0xff;
  }

  // --- Port write handlers
  // In MAME, port_io_dly (computed synchronously) effectively prevents
  // port writes from modifying nmi_active, invisible, or mf_enable.
  // Only RETN (cpu_retn_seen) and button_pulse affect nmi_active.
  // Port writes are therefore no-ops for MF state.

  /**
   * Handles a write to the enable port.
   * No-op: matches MAME behavior where port_io_dly prevents state changes.
   */
  writeEnablePort(_value: number): void {
    // No state changes — see MAME port_io_dly analysis
  }

  /**
   * Handles a write to the disable port.
   * No-op: matches MAME behavior where port_io_dly prevents state changes.
   */
  writeDisablePort(_value: number): void {
    // No state changes — see MAME port_io_dly analysis
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
  /**
   * Handles a port read, routing to enable/disable based on current mode.
   * Mirrors VHDL dynamic port decoding via port_mf_enable_io_a / port_mf_disable_io_a.
   */
  handlePortRead(portAddress: number): number {
    const lowByte = portAddress & 0xff;
    if (lowByte === this.enablePortAddress) return this.readEnablePort();
    if (lowByte === this.disablePortAddress) return this.readDisablePort();
    return 0xff; // Not a multiface port for the current mode
  }

  /**
   * Handles a port write, routing to enable/disable based on current mode.
   */
  handlePortWrite(portAddress: number, value: number): void {
    const lowByte = portAddress & 0xff;
    if (lowByte === this.enablePortAddress) this.writeEnablePort(value);
    else if (lowByte === this.disablePortAddress) this.writeDisablePort(value);
  }

  reset(): void {
    this.nmiActive = false;
    this.mfEnabled = false;
    this.invisible = true; // starts invisible to prevent accidental paging
  }
}
