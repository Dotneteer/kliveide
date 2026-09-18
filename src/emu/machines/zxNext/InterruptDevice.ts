import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Number of IM2 daisy-chain peripherals (FPGA peripherals.vhd).
 */
const DAISY_DEVICE_COUNT = 14;

/**
 * IM2 daisy-chain priority indices matching the FPGA zxnext.vhd wiring.
 */
export const DAISY_PRIORITY_LINE = 0;
export const DAISY_PRIORITY_UART0_RX = 1;
export const DAISY_PRIORITY_UART1_RX = 2;
export const DAISY_PRIORITY_CTC_BASE = 3; // 3-10 for CTC channels 0-7
export const DAISY_PRIORITY_ULA = 11;
export const DAISY_PRIORITY_UART0_TX = 12;
export const DAISY_PRIORITY_UART1_TX = 13;

export class InterruptDevice implements IGenericDevice<IZxNextMachine> {
  intSignalActive: boolean;
  ulaInterruptDisabled: boolean;
  lineInterruptEnabled: boolean;
  expBusInterruptEnabled: boolean;
  lineInterrupt: number;
  im2TopBits: number;
  enableStacklessNmi: boolean;
  hwIm2Mode: boolean;
  nmiReturnAddress: number;
  uart0TxEmpty: boolean;
  uart0RxNearFull: boolean;
  uart0RxAvailable: boolean;
  uart1TxEmpty: boolean;
  uart1RxNearFull: boolean;
  uart1RxAvailable: boolean;
  lineInterruptStatus: boolean; // --- im2_int_status(0)
  ulaInterruptStatus: boolean;  // --- im2_int_status(11)
  uart0TxEmptyStatus: boolean;  // --- im2_int_status(12)
  uart0RxNearFullStatus: boolean; // --- im2_int_status(1) (shared with uart0RxAvailable)
  uart0RxAvailableStatus: boolean; // --- im2_int_status(1)
  uart1TxEmptyStatus: boolean; // --- im2_int_status(13)
  uart1RxNearFullStatus: boolean; // --- im2_int_status(2) (shared with uart1RxAvailable)
  uart1RxAvailableStatus: boolean; // --- im2_int_status(2)
  enableNmiToIntDma: boolean;
  enableLineIntToIntDma: boolean;
  enableUlaIntToIntDma: boolean;
  enableUart0TxEmptyToIntDma: boolean;
  enableUart0RxNearFullToIntDma: boolean;
  enableUart0RxAvailableToIntDma: boolean;
  enableUart1TxEmptyToIntDma: boolean;
  enableUart1RxNearFullToIntDma: boolean;
  enableUart1RxAvailableToIntDma: boolean;

  readonly ctcIntStatus: boolean[] = []; // --- im2_int_status(3-10)
  readonly enableCtcToIntDma: boolean[] = [];

  // --- Daisy chain InService state per device (FPGA im2_device S_ACK / S_ISR)
  readonly daisyInService: boolean[] = [];

  /**
   * im2_peripheral `im2_int_req` per device: set by an enabled (or unqualified) request edge in hardware
   * IM2 mode, cleared only by the RETI that ends the device's service (or by leaving hardware IM2 mode).
   * A pending device not in service is in im2_device S_REQ.
   */
  readonly pending: boolean[] = [];

  /** CPU tact at which a pulse started by a CTC, `$20` or ULA-exception request ends (pulse_int_n). */
  private _pulseEndTact = -1;

  busResetRequested: boolean;
  mfNmiByIoTrap: boolean;
  mfNmiByNextReg: boolean;
  divMccNmiBtNextReg: boolean;
  lastWasHardReset: boolean;
  lastWasSoftReset: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.intSignalActive = false;
    this.ulaInterruptDisabled = false;
    this.lineInterruptEnabled = false;
    // --- zxnext.vhd reset branch: nr_c4_int_en_0_expbus <= '1'
    this.expBusInterruptEnabled = true;
    this.lineInterrupt = 0x00;
    this.im2TopBits = 0x00;
    this.enableStacklessNmi = false;
    this.hwIm2Mode = false;
    this.nmiReturnAddress = 0x00;
    for (let i = 0; i < 8; i++) {
      this.ctcIntStatus[i] = false;
      this.enableCtcToIntDma[i] = false;
    }
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      this.daisyInService[i] = false;
      this.pending[i] = false;
    }
    this._pulseEndTact = -1;
    this.busResetRequested = false;
    this.mfNmiByIoTrap = false;
    this.mfNmiByNextReg = false;
    this.divMccNmiBtNextReg = false;
    this.lastWasHardReset = false;
    this.lastWasSoftReset = false;

    // --- UART interrupt enable/status/DMA flags
    this.uart0TxEmpty = false;
    this.uart0RxNearFull = false;
    this.uart0RxAvailable = false;
    this.uart1TxEmpty = false;
    this.uart1RxNearFull = false;
    this.uart1RxAvailable = false;
    this.lineInterruptStatus = false;
    this.ulaInterruptStatus = false;
    this.uart0TxEmptyStatus = false;
    this.uart0RxNearFullStatus = false;
    this.uart0RxAvailableStatus = false;
    this.uart1TxEmptyStatus = false;
    this.uart1RxNearFullStatus = false;
    this.uart1RxAvailableStatus = false;
    this.enableNmiToIntDma = false;
    this.enableLineIntToIntDma = false;
    this.enableUlaIntToIntDma = false;
    this.enableUart0TxEmptyToIntDma = false;
    this.enableUart0RxNearFullToIntDma = false;
    this.enableUart0RxAvailableToIntDma = false;
    this.enableUart1TxEmptyToIntDma = false;
    this.enableUart1RxNearFullToIntDma = false;
    this.enableUart1RxAvailableToIntDma = false;
  }

  get nextReg02Value(): number {
    return (
      (this.busResetRequested ? 0x80 : 0x00) |
      (this.mfNmiByIoTrap ? 0x10 : 0x00) |
      (this.mfNmiByNextReg ? 0x08 : 0x00) |
      (this.divMccNmiBtNextReg ? 0x04 : 0x00) |
      (this.lastWasHardReset ? 0x02 : 0x00) |
      (this.lastWasSoftReset ? 0x01 : 0x00)
    );
  }

  /** zxnext.vhd ~5935: line, ULA, "00", CTC 3-0 - status or pending, as $C8/$C9 read them. */
  get nextReg20Value(): number {
    return (
      (this.statusOf(DAISY_PRIORITY_LINE) ? 0x80 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_ULA) ? 0x40 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_CTC_BASE + 3) ? 0x08 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_CTC_BASE + 2) ? 0x04 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_CTC_BASE + 1) ? 0x02 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_CTC_BASE) ? 0x01 : 0x00)
    );
  }

  /**
   * zxnext.vhd ~1902 (`im2_int_unq`): each set bit is an unqualified request - line (7), ULA (6),
   * CTC 3-0 (3-0) - that ignores the enables.
   */
  set nextReg20Value(value: number) {
    if (value & 0x80) this.request(DAISY_PRIORITY_LINE, true, true);
    if (value & 0x40) this.request(DAISY_PRIORITY_ULA, true, true);
    for (let i = 0; i < 4; i++) if (value & (1 << i)) this.request(DAISY_PRIORITY_CTC_BASE + i, true, true);
  }

  get nextReg22Value(): number {
    return (
      // --- zxnext.vhd ~5938: bit 7 is the INT pulse itself (`not pulse_int_n`), not a stored bit; only
      // --- an enabled source starts it (~1968-1985)
      ((this.machine.composedScreenDevice.pulseIntActive && !this.ulaInterruptDisabled) ||
      (this.machine.composedScreenDevice.lineIntActive && this.lineInterruptEnabled) ||
      this.pulseActive
        ? 0x80
        : 0x00) |
      (this.ulaInterruptDisabled ? 0x04 : 0x00) |
      (this.lineInterruptEnabled ? 0x02 : 0x00) |
      ((this.lineInterrupt & 0x100) ? 0x01 : 0x00)
    );
  }

  set nextReg22Value(value: number) {
    this.intSignalActive = (value & 0x80) !== 0;
    this.ulaInterruptDisabled = (value & 0x04) !== 0;
    this.lineInterruptEnabled = (value & 0x02) !== 0;
    this.lineInterrupt = ((value & 0x01) << 8) | (this.lineInterrupt & 0xff);
  }

  get nextReg23Value(): number {
    return this.lineInterrupt & 0xff;
  }

  set nextReg23Value(value: number) {
    this.lineInterrupt = (this.lineInterrupt & 0x100) | (value & 0xff);
  }

  get nextRegC0Value(): number {
    return (
      this.im2TopBits |
      (this.enableStacklessNmi ? 0x08 : 0x00) |
      (this.currentInterruptMode << 1) |
      (this.hwIm2Mode ? 0x01 : 0x00)
    );
  }

  set nextRegC0Value(value: number) {
    this.im2TopBits = value & 0xe0;
    this.enableStacklessNmi = (value & 0x08) !== 0;
    this.hwIm2Mode = (value & 0x01) !== 0;
    // --- im2_peripheral: im2_reset_n = hardware IM2 mode - pulse mode holds every device in S_0
    if (!this.hwIm2Mode) {
      for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
        this.pending[i] = false;
        this.daisyInService[i] = false;
      }
    }
  }

  set nextRegC2Value(value: number) {
    this.nmiReturnAddress = (this.nmiReturnAddress & 0xff00) | value;
  }

  set nextRegC3Value(value: number) {
    this.nmiReturnAddress = ((value & 0xff) << 8) | (this.nmiReturnAddress & 0xff);
  }

  get nextRegC4Value(): number {
    return (
      (this.expBusInterruptEnabled ? 0x80 : 0x00) |
      (this.lineInterruptEnabled ? 0x02 : 0x00) |
      (!this.ulaInterruptDisabled ? 0x01 : 0x00)
    );
  }

  set nextRegC4Value(value: number) {
    this.expBusInterruptEnabled = (value & 0x80) !== 0;
    this.lineInterruptEnabled = (value & 0x02) !== 0;
    this.ulaInterruptDisabled = (value & 0x01) === 0;
  }

  /**
   * $C5: the interrupt enable of CTC channels 0-3 - the same bit as control word bit 7 (ctc_chan.vhd
   * control_reg(7), zxnext.vhd ~4058). Channels 4-7 do not exist: bits 7-4 read 0.
   */
  get nextRegC5Value(): number {
    let v = 0;
    for (let i = 0; i < 4; i++) if (this.machine.ctcDevice.channels[i].intEnabled) v |= 1 << i;
    return v;
  }

  set nextRegC5Value(value: number) {
    for (let i = 0; i < 4; i++) this.machine.ctcDevice.channels[i].setIntEnabled((value & (1 << i)) !== 0);
  }

  get nextRegC6Value(): number {
    return (
      (this.uart1TxEmpty ? 0x40 : 0x00) |
      (this.uart1RxNearFull ? 0x20 : 0x00) |
      (this.uart1RxAvailable ? 0x10 : 0x00) |
      (this.uart0TxEmpty ? 0x04 : 0x00) |
      (this.uart0RxNearFull ? 0x02 : 0x00) |
      (this.uart0RxAvailable ? 0x01 : 0x00)
    );
  }

  set nextRegC6Value(value: number) {
    this.uart1TxEmpty = (value & 0x40) !== 0;
    this.uart1RxNearFull = (value & 0x20) !== 0;
    this.uart1RxAvailable = (value & 0x10) !== 0;
    this.uart0TxEmpty = (value & 0x04) !== 0;
    this.uart0RxNearFull = (value & 0x02) !== 0;
    this.uart0RxAvailable = (value & 0x01) !== 0;
  }

  /** im2_peripheral o_int_status: the status latch or a pending request. */
  private statusOf(index: number): boolean {
    return this.pending[index] || this.statusLatch(index);
  }

  private statusLatch(index: number): boolean {
    switch (index) {
      case DAISY_PRIORITY_LINE:
        return this.lineInterruptStatus;
      case DAISY_PRIORITY_UART0_RX:
        return this.uart0RxNearFullStatus || this.uart0RxAvailableStatus;
      case DAISY_PRIORITY_UART1_RX:
        return this.uart1RxNearFullStatus || this.uart1RxAvailableStatus;
      case DAISY_PRIORITY_ULA:
        return this.ulaInterruptStatus;
      case DAISY_PRIORITY_UART0_TX:
        return this.uart0TxEmptyStatus;
      case DAISY_PRIORITY_UART1_TX:
        return this.uart1TxEmptyStatus;
      default:
        return this.ctcIntStatus[index - DAISY_PRIORITY_CTC_BASE];
    }
  }

  private setStatusLatch(index: number): void {
    switch (index) {
      case DAISY_PRIORITY_LINE:
        this.lineInterruptStatus = true;
        break;
      case DAISY_PRIORITY_ULA:
        this.ulaInterruptStatus = true;
        break;
      case DAISY_PRIORITY_UART0_TX:
        this.uart0TxEmptyStatus = true;
        break;
      case DAISY_PRIORITY_UART1_TX:
        this.uart1TxEmptyStatus = true;
        break;
      case DAISY_PRIORITY_UART0_RX:
        this.uart0RxAvailableStatus = true;
        break;
      case DAISY_PRIORITY_UART1_RX:
        this.uart1RxAvailableStatus = true;
        break;
      default:
        this.ctcIntStatus[index - DAISY_PRIORITY_CTC_BASE] = true;
    }
  }

  /** zxnext.vhd ~6193: bit 1 line, bit 0 ULA. */
  get nextRegC8Value(): number {
    return (this.statusOf(DAISY_PRIORITY_LINE) ? 0x02 : 0x00) | (this.statusOf(DAISY_PRIORITY_ULA) ? 0x01 : 0x00);
  }

  /** A written 1 clears the status latch (not a pending request), in either mode. */
  set nextRegC8Value(value: number) {
    if (value & 0x02) this.lineInterruptStatus = false;
    if (value & 0x01) this.ulaInterruptStatus = false;
  }

  /** CTC 7-0; channels 4-7 do not exist. */
  get nextRegC9Value(): number {
    let val = 0;
    for (let i = 0; i < 8; i++) if (this.statusOf(DAISY_PRIORITY_CTC_BASE + i)) val |= 1 << i;
    return val;
  }

  set nextRegC9Value(value: number) {
    for (let i = 0; i < 8; i++) if (value & (1 << i)) this.ctcIntStatus[i] = false;
  }

  /** zxnext.vhd ~6200: '0' & UART1 TX & UART1 RX & UART1 RX & '0' & UART0 TX & UART0 RX & UART0 RX. */
  get nextRegCAValue(): number {
    return (
      (this.statusOf(DAISY_PRIORITY_UART1_TX) ? 0x40 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_UART1_RX) ? 0x30 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_UART0_TX) ? 0x04 : 0x00) |
      (this.statusOf(DAISY_PRIORITY_UART0_RX) ? 0x03 : 0x00)
    );
  }

  /** ~1908: bit 6 / bit 2 clear the TX status, bits 5-4 / 1-0 the shared RX status. */
  set nextRegCAValue(value: number) {
    if (value & 0x40) this.uart1TxEmptyStatus = false;
    if (value & 0x30) this.uart1RxNearFullStatus = this.uart1RxAvailableStatus = false;
    if (value & 0x04) this.uart0TxEmptyStatus = false;
    if (value & 0x03) this.uart0RxNearFullStatus = this.uart0RxAvailableStatus = false;
  }

  get nextRegCCValue(): number {
    return (
      (this.enableNmiToIntDma ? 0x80 : 0x00) |
      (this.enableLineIntToIntDma ? 0x02 : 0x00) |
      (this.enableUlaIntToIntDma ? 0x01 : 0x00)
    );
  }

  set nextRegCCValue(value: number) {
    this.enableNmiToIntDma = (value & 0x80) !== 0;
    this.enableLineIntToIntDma = (value & 0x02) !== 0;
    this.enableUlaIntToIntDma = (value & 0x01) !== 0;
  }

  get nextRegCDValue(): number {
    return (
      (this.enableCtcToIntDma[0] ? 0x01 : 0x00) |
      (this.enableCtcToIntDma[1] ? 0x02 : 0x00) |
      (this.enableCtcToIntDma[2] ? 0x04 : 0x00) |
      (this.enableCtcToIntDma[3] ? 0x08 : 0x00) |
      (this.enableCtcToIntDma[4] ? 0x10 : 0x00) |
      (this.enableCtcToIntDma[5] ? 0x20 : 0x00) |
      (this.enableCtcToIntDma[6] ? 0x40 : 0x00) |
      (this.enableCtcToIntDma[7] ? 0x80 : 0x00)
    );
  }

  set nextRegCDValue(value: number) {
    this.enableCtcToIntDma[0] = (value & 0x01) !== 0;
    this.enableCtcToIntDma[1] = (value & 0x02) !== 0;
    this.enableCtcToIntDma[2] = (value & 0x04) !== 0;
    this.enableCtcToIntDma[3] = (value & 0x08) !== 0;
    this.enableCtcToIntDma[4] = (value & 0x10) !== 0;
    this.enableCtcToIntDma[5] = (value & 0x20) !== 0;
    this.enableCtcToIntDma[6] = (value & 0x40) !== 0;
    this.enableCtcToIntDma[7] = (value & 0x80) !== 0;
  }

  get nextRegCEValue(): number {
    return (
      (this.enableUart1TxEmptyToIntDma ? 0x40 : 0x00) |
      (this.enableUart1RxNearFullToIntDma ? 0x20 : 0x00) |
      (this.enableUart1RxAvailableToIntDma ? 0x10 : 0x00) |
      (this.enableUart0TxEmptyToIntDma ? 0x04 : 0x00) |
      (this.enableUart0RxNearFullToIntDma ? 0x02 : 0x00) |
      (this.enableUart0RxAvailableToIntDma ? 0x01 : 0x00)
    );
  }

  set nextRegCEValue(value: number) {
    this.enableUart1TxEmptyToIntDma = (value & 0x40) !== 0;
    this.enableUart1RxNearFullToIntDma = (value & 0x20) !== 0;
    this.enableUart1RxAvailableToIntDma = (value & 0x10) !== 0;
    this.enableUart0TxEmptyToIntDma = (value & 0x04) !== 0;
    this.enableUart0RxNearFullToIntDma = (value & 0x02) !== 0;
    this.enableUart0RxAvailableToIntDma = (value & 0x01) !== 0;
  }

  get currentInterruptMode(): number {
    return this.machine.interruptMode;
  }

  setCtcChannelInterruptStatus(channel: number, value: boolean) {
    this.ctcIntStatus[channel] = value;
  }

  /** Whether a pulse started by `request` (CTC, `$20`, the ULA exception) still drives INT. */
  get pulseActive(): boolean {
    return this._pulseEndTact >= 0 && this.machine.tacts < this._pulseEndTact;
  }

  /** zxnext.vhd ~1968-1995: pulse_int_n low for 32 (48K, +3) or 36 CPU cycles; ignored while low. */
  private startPulse(): void {
    if (this.pulseActive) return;
    const cycles = this.machine.composedScreenDevice.intPulseLength >> 1 << this.machine.cpuSpeedDevice.effectiveSpeed;
    this._pulseEndTact = this.machine.tacts + (cycles || 32);
  }

  /**
   * An interrupt request edge from device `index` (im2_peripheral `int_req` / `int_unq`).
   *
   * The status latches always. An enabled or unqualified request becomes the device's pending request
   * in hardware IM2 mode, or an INT pulse in pulse mode - `pulse` = false for the ULA and line
   * interrupts, whose pulses the screen device times itself. The ULA is the only EXCEPTION: in
   * hardware IM2 mode with the CPU not in IM 2 it pulses too.
   */
  request(index: number, enabled: boolean, pulse: boolean): void {
    this.setStatusLatch(index);
    if (!enabled) return;
    if (this.hwIm2Mode) {
      this.pending[index] = true;
      if (pulse && index === DAISY_PRIORITY_ULA && this.machine.interruptMode !== 2) this.startPulse();
    } else if (pulse) {
      this.startPulse();
    }
  }

  /** The rising edge of the ULA frame interrupt; zxula_timing.vhd generates none while disabled. */
  captureUlaInterruptPulse(): void {
    if (!this.ulaInterruptDisabled) this.request(DAISY_PRIORITY_ULA, true, false);
  }

  /** The rising edge of the line interrupt; generated only while $22 bit 1 enables it. */
  captureLineInterruptPulse(): void {
    if (this.lineInterruptEnabled) this.request(DAISY_PRIORITY_LINE, true, false);
  }

  /** A CTC channel's zero count / time-out: status always, an interrupt with its enable. */
  ctcZeroCount(channel: number, enabled: boolean): void {
    this.request(DAISY_PRIORITY_CTC_BASE + channel, enabled, true);
  }

  /** im2_device S_REQ: pending and not yet acknowledged. */
  isDeviceRequesting(priority: number): boolean {
    return this.pending[priority] && !this.daisyInService[priority];
  }

  /**
   * The daisy chain's INT (im2_device o_int_n): the first device from the top that is not in S_0
   * decides - a requesting one asserts INT, one in service blocks everything below it (IEO = 0).
   * Only while the CPU is in IM 2.
   */
  daisyUpdateIrqState(): boolean {
    if (this.machine.interruptMode !== 2) return false;
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      if (this.daisyInService[i]) return false;
      if (this.isDeviceRequesting(i)) return true;
    }
    return false;
  }

  /**
   * Returns true when a currently pending interrupt source is also enabled as
   * a DMA break-in source through NR $CC-$CE.
   *
   * FPGA equivalent: peripherals.vhd o_dma_int, driven from the interrupt
   * request vector and the separate im2_dma_int_en mask.
   */
  get dmaInterruptRequestActive(): boolean {
    // --- im2_device o_dma_int: a device out of S_0 (pending or in service) with its $CC-$CE bit.
    // --- Pulse mode holds every device in S_0.
    const active = (i: number) => this.pending[i] || this.daisyInService[i];
    if (this.enableLineIntToIntDma && active(DAISY_PRIORITY_LINE)) return true;
    if (this.enableUlaIntToIntDma && active(DAISY_PRIORITY_ULA)) return true;
    for (let i = 0; i < 8; i++) {
      if (this.enableCtcToIntDma[i] && active(DAISY_PRIORITY_CTC_BASE + i)) return true;
    }
    if ((this.enableUart0RxNearFullToIntDma || this.enableUart0RxAvailableToIntDma) && active(DAISY_PRIORITY_UART0_RX)) return true;
    if (this.enableUart0TxEmptyToIntDma && active(DAISY_PRIORITY_UART0_TX)) return true;
    if ((this.enableUart1RxNearFullToIntDma || this.enableUart1RxAvailableToIntDma) && active(DAISY_PRIORITY_UART1_RX)) return true;
    if (this.enableUart1TxEmptyToIntDma && active(DAISY_PRIORITY_UART1_TX)) return true;
    return false;
  }

  /**
   * Acknowledges the highest-priority interrupt request in the daisy chain.
   * Transitions the device from Requesting to InService, clears its request
   * status flag, and returns the IM2 vector.
   *
   * MAME equivalent: daisy_get_irq_device() + z80daisy_irq_ack().
   * FPGA equivalent: im2_device S_REQ → S_ACK → S_ISR transition.
   *
   * Returns the IM2 vector, or 0xFF if no device claims the interrupt.
   */
  daisyAcknowledge(): number {
    const base = this.im2TopBits;
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      // --- An InService device blocks all below — no lower device can be acknowledged
      if (this.daisyInService[i]) break;
      if (this.isDeviceRequesting(i)) {
        // --- S_REQ -> S_ACK/S_ISR; the request stays pending until the RETI
        this.daisyInService[i] = true;
        return base | (i << 1);
      }
    }
    return 0xff;
  }

  /**
   * Handles a RETI instruction by clearing the InService state of the
   * highest-priority device currently being serviced.
   *
   * MAME equivalent: daisy_call_reti_device() → z80daisy_irq_reti().
   * FPGA equivalent: im2_device S_ISR → S_0 transition on reti_seen with IEI = 1.
   */
  daisyReti(): void {
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      if (this.daisyInService[i]) {
        // --- S_ISR -> S_0: im2_isr_serviced clears the pending request
        this.daisyInService[i] = false;
        this.pending[i] = false;
        return;
      }
    }
  }
}
