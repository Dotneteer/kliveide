import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Represents the expansion bus device of the ZX Spectrum Next.
 *
 * FPGA ground truth (zxnext.vhd):
 *   - NR $80: Enable expansion bus, ROMCS replacement, IO/MEM disable, soft reset persistence
 *   - NR $81: ROMCS status (read-only), ULA override, NMI debounce disable, clock always on,
 *             max CPU speed (fixed at 3.5MHz)
 *   - NR $82–$85: Internal port decoding enables (32-bit)
 *   - NR $86–$89: Expansion bus port decoding enables (32-bit, AND'd with internal when bus on)
 *   - NR $8A: IO propagate — selected ports forwarded to bus even when internally handled
 *
 * Port decoding (FPGA):
 *   When expbus is OFF: effective_port_enable = internal_enables (NR $82–$85)
 *   When expbus is ON:  effective_port_enable = internal_enables AND bus_enables (NR $86–$89)
 *
 * IO propagation (FPGA):
 *   Normally, if an internal port responds, the IO cycle is NOT sent to the expansion bus.
 *   When a propagate bit is set (NR $8A), the IO cycle IS sent to the bus even if handled internally.
 *
 * ROMCS (FPGA):
 *   External device asserts ROMCS_n to claim the ROM address space.
 *   When ROMCS replacement is enabled (NR $80 bit 6), reads from ROM space come from DivMMC banks 14/15.
 *   When ROMCS is active but replacement is disabled, reads come from external bus data.
 *
 * NMI (FPGA):
 *   Expansion bus NMI is level-triggered. Priority: multiface > divmmc > expansion bus.
 *   NR $81 bit 5 can disable debounce for devices like Opus Discovery.
 *
 * INT (FPGA):
 *   Expansion bus /INT is AND'd into Z80 INT line, gated by NR $C4 bit 7 (expBusInterruptEnabled).
 *
 * CPU Speed (FPGA):
 *   When expansion bus is enabled, CPU speed is forced to 3.5MHz (expbus_speed hard-wired to "00").
 *   NR $81 bit 4 (clockAlwaysOn) propagates max CPU clock even when bus is off.
 */
export class ExpansionBusDevice implements IGenericDevice<IZxNextMachine> {
  // --- NR $80 state
  private _enabled: boolean;
  private _romcsReplacement: boolean;
  private _disableIoCycles: boolean;
  private _disableMemCycles: boolean;
  private _softResetPersistence: number;

  // --- NR $81 state
  private _romcsAsserted: boolean;
  private _ulaOverrideEnabled: boolean;
  private _nmiDebounceDisabled: boolean;
  private _clockAlwaysOn: boolean;

  // --- NR $86–$89: Expansion bus port decoding enables (4 bytes, same bit layout as $82–$85)
  private _busPortEnables: Uint8Array = new Uint8Array(4); // [0x86, 0x87, 0x88, 0x89]

  // --- NR $8A: IO Propagate (6 bits)
  private _ioPropagate: number;

  /** Set to true by external hardware to assert /NMI via the expansion bus */
  expansionBusNmiPending: boolean = false;

  /** Set to true by external hardware to assert /INT via the expansion bus */
  expansionBusIntPending: boolean = false;

  /**
   * External data bus value. External devices can place data here
   * to be read by the CPU during IO or memory cycles.
   */
  externalBusData: number = 0xff;

  /**
   * ROMCS signal from external hardware.
   * When true, an external device is claiming the ROM address space.
   */
  romcsSignal: boolean = false;

  /**
   * IORQULA signal from external hardware.
   * When true, an external device is handling port $FE (disables internal ULA).
   */
  iorqulaSignal: boolean = false;

  constructor(public readonly machine: IZxNextMachine) {
    this.hardReset();
  }

  // ==========================================================================
  // NR $80 — Expansion Bus Enable
  // ==========================================================================

  get enabled(): boolean {
    return this._enabled;
  }

  get romcsReplacement(): boolean {
    return this._romcsReplacement;
  }

  get disableIoCycles(): boolean {
    return this._disableIoCycles;
  }

  get disableMemCycles(): boolean {
    return this._disableMemCycles;
  }

  get softResetPersistence(): number {
    return this._softResetPersistence;
  }

  set nextReg80Value(value: number) {
    this._enabled = (value & 0x80) !== 0;
    this._romcsReplacement = (value & 0x40) !== 0;
    this._disableIoCycles = (value & 0x20) !== 0;
    this._disableMemCycles = (value & 0x10) !== 0;
    this._softResetPersistence = value & 0x0f;
    this.machine.cpuSpeedDevice?.requestSpeedUpdate();
  }

  get nextReg80Value(): number {
    return (
      (this._enabled ? 0x80 : 0) |
      (this._romcsReplacement ? 0x40 : 0) |
      (this._disableIoCycles ? 0x20 : 0) |
      (this._disableMemCycles ? 0x10 : 0) |
      (this._softResetPersistence & 0x0f)
    );
  }

  // ==========================================================================
  // NR $81 — Expansion Bus Control
  // ==========================================================================

  get romcsAsserted(): boolean {
    return this._romcsAsserted;
  }

  get ulaOverrideEnabled(): boolean {
    return this._ulaOverrideEnabled;
  }

  get nmiDebounceDisabled(): boolean {
    return this._nmiDebounceDisabled;
  }

  get clockAlwaysOn(): boolean {
    return this._clockAlwaysOn;
  }

  set nextReg81Value(value: number) {
    // bit 7 is read-only (ROMCS status from expansion bus)
    this._ulaOverrideEnabled = (value & 0x40) !== 0;
    this._nmiDebounceDisabled = (value & 0x20) !== 0;
    this._clockAlwaysOn = (value & 0x10) !== 0;
    // bits 1:0 = max cpu speed when bus on (fixed at 00 = 3.5MHz in FPGA)
    this.machine.cpuSpeedDevice?.requestSpeedUpdate();
  }

  get nextReg81Value(): number {
    return (
      (this._romcsAsserted ? 0x80 : 0) |
      (this._ulaOverrideEnabled ? 0x40 : 0) |
      (this._nmiDebounceDisabled ? 0x20 : 0) |
      (this._clockAlwaysOn ? 0x10 : 0)
    );
  }

  // ==========================================================================
  // NR $86–$89 — Expansion Bus Port Decoding Enables
  // ==========================================================================

  getBusPortEnable(reg: number): number {
    return this._busPortEnables[reg & 0x03];
  }

  setBusPortEnable(reg: number, value: number): void {
    this._busPortEnables[reg & 0x03] = value & 0xff;
  }

  // ==========================================================================
  // NR $8A — Expansion Bus IO Propagate
  // ==========================================================================

  get ioPropagate(): number {
    return this._ioPropagate;
  }

  set ioPropagate(value: number) {
    this._ioPropagate = value & 0x3f;
  }

  // ==========================================================================
  // Port Enable Masking (FPGA: internal_port_enable logic)
  // ==========================================================================

  /**
   * Compute effective port enable for a given internal enable register value
   * and its corresponding bus enable register.
   *
   * FPGA: When expbus is OFF, return internal enables unchanged.
   *       When expbus is ON, return (internal AND bus_enables).
   *
   * @param internalValue The internal port enable register value (NR $82–$85)
   * @param busRegIndex   Index into bus port enables: 0=$86, 1=$87, 2=$88, 3=$89
   * @returns Effective port enable byte
   */
  effectivePortEnable(internalValue: number, busRegIndex: number): number {
    if (!this._enabled) return internalValue;
    return internalValue & this._busPortEnables[busRegIndex & 0x03];
  }

  // ==========================================================================
  // IO Propagation Check (FPGA: port_propagate logic)
  // ==========================================================================

  /**
   * Check if a specific port should be propagated to the expansion bus.
   * @param portBit Bit index in NR $8A (0=FE, 1=7FFD, 2=DFFD, 3=1FFD, 4=FF, 5=EFF7)
   * @returns true if the port should be propagated
   */
  shouldPropagateIo(portBit: number): boolean {
    return this._enabled && (this._ioPropagate & (1 << portBit)) !== 0;
  }

  // ==========================================================================
  // ROMCS Handling (FPGA: sram_romcs logic)
  // ==========================================================================

  /**
   * Check if ROMCS is active — external device claims ROM space.
   * FPGA: sram_pre_romcs_n = i_BUS_ROMCS_n AND expbus_eff_en AND NOT expbus_eff_disable_mem
   *
   * @returns true if ROMCS is active (external device claiming ROM space)
   */
  get isRomcsClaimed(): boolean {
    return this._enabled && !this._disableMemCycles && this.romcsSignal;
  }

  // ==========================================================================
  // NMI from Expansion Bus (FPGA: nmi_assert_expbus logic)
  // ==========================================================================

  /**
   * Check if the expansion bus is asserting NMI.
   * FPGA: nmi_assert_expbus = expbus_eff_en AND NOT expbus_eff_disable_mem AND NOT i_BUS_NMI_n
   *
   * @returns true if NMI is being asserted from the expansion bus
   */
  get isNmiAsserted(): boolean {
    return this._enabled && !this._disableMemCycles && this.expansionBusNmiPending;
  }

  // ==========================================================================
  // INT from Expansion Bus
  // ==========================================================================

  /**
   * Check if the expansion bus /INT should be active.
   * FPGA: gated by expbus_eff_en AND NOT expbus_eff_disable_io AND nr_c4_int_en_0_expbus
   *
   * @returns true if expansion bus interrupt is active
   */
  get isIntActive(): boolean {
    return (
      this._enabled &&
      !this._disableIoCycles &&
      this.machine.interruptDevice.expBusInterruptEnabled &&
      this.expansionBusIntPending
    );
  }

  // ==========================================================================
  // ULA Override (FPGA: port_fe_override logic)
  // ==========================================================================

  /**
   * Check if external ULA override is active for port $FE reads.
   * FPGA: port_fe_override = A(7:4) = "0000" AND nr_81_expbus_ula_override
   * When active and IORQULA is asserted, internal keyboard is disabled and
   * external bus data is AND-mixed into the keyboard read.
   *
   * @param address The port address being read
   * @returns true if ULA override should apply
   */
  isUlaOverride(address: number): boolean {
    return this._enabled && this._ulaOverrideEnabled && ((address >> 12) & 0x0f) === 0x00;
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  hardReset(): void {
    this.nextReg80Value = 0x00;
    this._romcsAsserted = false;
    this._ulaOverrideEnabled = false;
    this._nmiDebounceDisabled = false;
    this._clockAlwaysOn = false;
    this._busPortEnables.fill(0xff); // FPGA: all enables default to 1
    this._ioPropagate = 0x00;
    this.expansionBusNmiPending = false;
    this.expansionBusIntPending = false;
    this.externalBusData = 0xff;
    this.romcsSignal = false;
    this.iorqulaSignal = false;
  }

  reset(): void {
    const persistence = this.nextReg80Value & 0x0f;
    this.nextReg80Value = (persistence << 4) | persistence;
  }

  dispose(): void {}
}
