import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Implements the Multiface NMI device for ZX Spectrum Next.
 * Models the multiface.vhd logic: NMI activation, memory paging, and port handling.
 */
export class MultifaceDevice implements IGenericDevice<IZxNextMachine> {
  /** nmi_active in VHDL — MF ROM is running and memory is paged in */
  nmiActive: boolean;

  /**
   * FPGA: enable_i => port_multiface_io_en (internal_port_enable bit 9).
   * When false, the device is held in reset: nmi_active=0, invisible=1, mf_enable=0.
   */
  get enabled(): boolean {
    return this.machine.nextRegDevice?.isPortGroupEnabled(1, 1) ?? true;
  }

  /**
   * Mirrors VHDL: nmi_disable_o <= nmi_active.
   * Gated by enabled (FPGA: all outputs are 0 when enable_i=0).
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
   * Gated by enabled (FPGA: all outputs are 0 when enable_i=0).
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
   * Gated by enabled: FPGA NMI button is external, but port_multiface_io_en gates the device.
   */
  pressNmiButton(): void {
    if (!this.enabled) return;
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
   * VHDL: port_mf_disable_rd clears mf_enable.
   * VHDL: In P3 mode, port_mf_disable_rd also clears nmi_active (edge-detected).
   */
  readDisablePort(): number {
    this.mfEnabled = false;
    // FPGA: (port_mf_disable_rd_i = '1' and mode_p3 = '1') and port_io_dly = '0' → nmi_active <= '0'
    if (this.modeP3) {
      this.nmiActive = false;
    }
    this.machine.memoryDevice.updateFastPathFlags();
    return 0xff;
  }

  // --- Port write handlers
  // FPGA multiface.vhd: port writes clear nmi_active and set invisible
  // (edge-detected via port_io_dly). MAME has a bug where port_io_dly
  // is computed synchronously, preventing writes from firing. We follow
  // the FPGA (truth).

  /**
   * Handles a write to the enable port.
   * FPGA: port_mf_enable_wr clears nmi_active (all modes).
   * FPGA: In P3 mode, port_mf_enable_wr sets invisible.
   */
  writeEnablePort(_value: number): void {
    // FPGA: (port_mf_enable_wr_i = '1' ... ) and port_io_dly = '0' → nmi_active <= '0'
    this.nmiActive = false;
    // FPGA: (port_mf_enable_wr_i = '1' and mode_p3 = '1') and port_io_dly = '0' → invisible <= '1'
    if (this.modeP3) {
      this.invisible = true;
    }
    this.machine.memoryDevice.updateFastPathFlags();
  }

  /**
   * Handles a write to the disable port.
   * FPGA: port_mf_disable_wr clears nmi_active (all modes).
   * FPGA: In non-P3 modes, port_mf_disable_wr sets invisible.
   */
  writeDisablePort(_value: number): void {
    // FPGA: (port_mf_disable_wr_i = '1' ... ) and port_io_dly = '0' → nmi_active <= '0'
    this.nmiActive = false;
    // FPGA: (port_mf_disable_wr_i = '1' and mode_p3 = '0') and port_io_dly = '0' → invisible <= '1'
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
    if (!this.enabled) return;
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
   * FPGA mf_port_en: asserted when reading the enable port, visible, and mode is MF128 or MF+3.
   * When true, the multiface returns register snapshots instead of letting other devices respond.
   */
  get mfPortEn(): boolean {
    if (!this.enabled) return false;
    const invisibleEff = this.invisible && !this.mode48;
    return !invisibleEff && (this.mode128 || this.modeP3);
  }

  /**
   * Returns the multiface port read data (register snapshot).
   * FPGA (zxnext.vhd lines 4287–4299): mf_port_dat depends on mode and cpu_a[15:12].
   */
  getMfPortData(portAddress: number): number {
    const memDevice = this.machine.memoryDevice;
    if (this.modeP3) {
      // MF+3: return depends on cpu_a[15:12]
      const highNibble = (portAddress >>> 12) & 0x0f;
      switch (highNibble) {
        case 0b0001: return memDevice.port1ffdValue;
        case 0b0111: return memDevice.port7ffdValue;
        case 0b1101: return memDevice.portDffdValue;
        case 0b1110: return memDevice.portEff7Value & 0x0c; // bits 2-3 only
        default: return this.machine.composedScreenDevice.borderColor & 0x07;
      }
    } else {
      // MF128/MF48: port_7ffd_reg(3) & "1111111" — shadow bit in bit 7
      return ((memDevice.port7ffdValue >>> 3) & 1) << 7 | 0x7f;
    }
  }

  /**
   * Handles a port read, routing to enable/disable based on current mode.
   * Returns { value, handled } to allow fallthrough to other devices (e.g. Kempston)
   * when the multiface does not claim the read.
   */
  handlePortRead(portAddress: number): { value: number; handled: boolean } {
    if (!this.enabled) return { value: 0xff, handled: false };
    const lowByte = portAddress & 0xff;
    if (lowByte === this.enablePortAddress) {
      // Enable port read: update mf_enable and check mf_port_en
      const mfPortEn = this.mfPortEn; // Check BEFORE state change (FPGA: combinatorial)
      this.readEnablePort();
      if (mfPortEn) {
        return { value: this.getMfPortData(portAddress), handled: true };
      }
      return { value: 0xff, handled: false };
    }
    if (lowByte === this.disablePortAddress) {
      this.readDisablePort();
      return { value: 0xff, handled: false };
    }
    return { value: 0xff, handled: false }; // Not a multiface port
  }

  /**
   * Handles a port write, routing to enable/disable based on current mode.
   */
  handlePortWrite(portAddress: number, value: number): void {
    if (!this.enabled) return;
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
