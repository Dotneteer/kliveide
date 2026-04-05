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

  readonly ctcIntEnabled: boolean[] = [];
  readonly ctcIntStatus: boolean[] = []; // --- im2_int_status(3-10)
  readonly enableCtcToIntDma: boolean[] = [];

  // --- Daisy chain InService state per device (FPGA im2_device S_ISR equivalent)
  readonly daisyInService: boolean[] = [];

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
    this.lineInterrupt = 0x00;
    this.im2TopBits = 0x00;
    this.enableStacklessNmi = false;
    this.hwIm2Mode = false;
    this.nmiReturnAddress = 0x00;
    for (let i = 0; i < 8; i++) {
      this.ctcIntEnabled[i] = false;
      this.ctcIntStatus[i] = false;
      this.enableCtcToIntDma[i] = false;
    }
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      this.daisyInService[i] = false;
    }
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

  get nextReg20Value(): number {
    return (this.lineInterruptStatus ? 0x80 : 0x00) |
    (this.ulaInterruptStatus ? 0x40 : 0x00) |
    (this.ctcIntStatus[3] ? 0x08 : 0x00) |
    (this.ctcIntStatus[2] ? 0x04 : 0x00) |
    (this.ctcIntStatus[1] ? 0x02 : 0x00) |
    (this.ctcIntStatus[0] ? 0x01 : 0x00);
  }

  get nextReg22Value(): number {
    return (
      (this.intSignalActive ? 0x80 : 0x00) |
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
      (this.ulaInterruptDisabled ? 0x01 : 0x00)
    );
  }

  set nextRegC4Value(value: number) {
    this.expBusInterruptEnabled = (value & 0x80) !== 0;
    this.lineInterruptEnabled = (value & 0x02) !== 0;
    this.ulaInterruptDisabled = (value & 0x01) !== 0;
  }

  get nextRegC5Value(): number {
    return (
      (this.ctcIntEnabled[0] ? 0x01 : 0x00) |
      (this.ctcIntEnabled[1] ? 0x02 : 0x00) |
      (this.ctcIntEnabled[2] ? 0x04 : 0x00) |
      (this.ctcIntEnabled[3] ? 0x08 : 0x00) |
      (this.ctcIntEnabled[4] ? 0x10 : 0x00) |
      (this.ctcIntEnabled[5] ? 0x20 : 0x00) |
      (this.ctcIntEnabled[6] ? 0x40 : 0x00) |
      (this.ctcIntEnabled[7] ? 0x80 : 0x00)
    );
  }

  set nextRegC5Value(value: number) {
    this.ctcIntEnabled[0] = (value & 0x01) !== 0;
    this.ctcIntEnabled[1] = (value & 0x02) !== 0;
    this.ctcIntEnabled[2] = (value & 0x04) !== 0;
    this.ctcIntEnabled[3] = (value & 0x08) !== 0;
    this.ctcIntEnabled[4] = (value & 0x10) !== 0;
    this.ctcIntEnabled[5] = (value & 0x20) !== 0;
    this.ctcIntEnabled[6] = (value & 0x40) !== 0;
    this.ctcIntEnabled[7] = (value & 0x80) !== 0;
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

  get nextRegC8Value(): number {
    if (this.hwIm2Mode) {
      // --- In HW IM2 mode, status reflects daisy chain InService state
      return (
        (this.daisyInService[DAISY_PRIORITY_LINE] ? 0x02 : 0x00) |
        (this.daisyInService[DAISY_PRIORITY_ULA] ? 0x01 : 0x00)
      );
    }
    return (this.lineInterruptStatus ? 0x02 : 0x00) | (this.ulaInterruptStatus ? 0x01 : 0x00);
  }

  set nextRegC8Value(value: number) {
    if (value & 0x02 && !this.hwIm2Mode) {
      this.lineInterruptStatus = false;
    }
    if (value & 0x01 && !this.hwIm2Mode) {
      this.ulaInterruptStatus = false;
    }
  }

  get nextRegC9Value(): number {
    if (this.hwIm2Mode) {
      // --- In HW IM2 mode, status reflects daisy chain InService state
      let val = 0;
      for (let i = 0; i < 8; i++) {
        if (this.daisyInService[DAISY_PRIORITY_CTC_BASE + i]) val |= (1 << i);
      }
      return val;
    }
    return (
      (this.ctcIntStatus[0] ? 0x01 : 0x00) |
      (this.ctcIntStatus[1] ? 0x02 : 0x00) |
      (this.ctcIntStatus[2] ? 0x04 : 0x00) |
      (this.ctcIntStatus[3] ? 0x08 : 0x00) |
      (this.ctcIntStatus[4] ? 0x10 : 0x00) |
      (this.ctcIntStatus[5] ? 0x20 : 0x00) |
      (this.ctcIntStatus[6] ? 0x40 : 0x00) |
      (this.ctcIntStatus[7] ? 0x80 : 0x00)
    );
  }

  set nextRegC9Value(value: number) {
    if (value & 0x01 && !this.hwIm2Mode) {
      this.ctcIntStatus[0] = false;
    }
    if (value & 0x02 && !this.hwIm2Mode) {
      this.ctcIntStatus[1] = false;
    }
    if (value & 0x04 && !this.hwIm2Mode) {
      this.ctcIntStatus[2] = false;
    }
    if (value & 0x08 && !this.hwIm2Mode) {
      this.ctcIntStatus[3] = false;
    }
    if (value & 0x10 && !this.hwIm2Mode) {
      this.ctcIntStatus[4] = false;
    }
    if (value & 0x20 && !this.hwIm2Mode) {
      this.ctcIntStatus[5] = false;
    }
    if (value & 0x40 && !this.hwIm2Mode) {
      this.ctcIntStatus[6] = false;
    }
    if (value & 0x80 && !this.hwIm2Mode) {
      this.ctcIntStatus[7] = false;
    }
  }

  get nextRegCAValue(): number {
    if (this.hwIm2Mode) {
      // --- In HW IM2 mode, status reflects daisy chain InService state
      return (
        (this.daisyInService[DAISY_PRIORITY_UART1_TX] ? 0x40 : 0x00) |
        (this.daisyInService[DAISY_PRIORITY_UART1_RX] ? 0x30 : 0x00) |
        (this.daisyInService[DAISY_PRIORITY_UART0_TX] ? 0x04 : 0x00) |
        (this.daisyInService[DAISY_PRIORITY_UART0_RX] ? 0x03 : 0x00)
      );
    }
    return (
      (this.uart1TxEmptyStatus ? 0x40 : 0x00) |
      (this.uart1RxNearFullStatus ? 0x20 : 0x00) |
      (this.uart1RxAvailableStatus ? 0x10 : 0x00) |
      (this.uart0TxEmptyStatus ? 0x04 : 0x00) |
      (this.uart0RxNearFullStatus ? 0x02 : 0x00) |
      (this.uart0RxAvailableStatus ? 0x01 : 0x00)
    );
  }

  set nextRegCAValue(value: number) {
    if (value & 0x40 && !this.hwIm2Mode) {
      this.uart1TxEmptyStatus = false;
    }
    if (value & 0x20 && !this.hwIm2Mode) {
      this.uart1RxNearFullStatus = false;
    }
    if (value & 0x10 && !this.hwIm2Mode) {
      this.uart1RxAvailableStatus = false;
    }
    if (value & 0x04 && !this.hwIm2Mode) {
      this.uart0TxEmptyStatus = false;
    }
    if (value & 0x02 && !this.hwIm2Mode) {
      this.uart0RxNearFullStatus = false;
    }
    if (value & 0x01 && !this.hwIm2Mode) {
      this.uart0RxAvailableStatus = false;
    }
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

  /**
   * Returns true if the device at the given priority has a pending interrupt
   * request (status flag set) AND its interrupt source is enabled.
   */
  isDeviceRequesting(priority: number): boolean {
    switch (priority) {
      case DAISY_PRIORITY_LINE:
        return this.lineInterruptStatus && this.lineInterruptEnabled;
      case DAISY_PRIORITY_UART0_RX:
        return (this.uart0RxNearFullStatus || this.uart0RxAvailableStatus) &&
               (this.uart0RxNearFull || this.uart0RxAvailable);
      case DAISY_PRIORITY_UART1_RX:
        return (this.uart1RxNearFullStatus || this.uart1RxAvailableStatus) &&
               (this.uart1RxNearFull || this.uart1RxAvailable);
      case DAISY_PRIORITY_ULA:
        return this.ulaInterruptStatus && !this.ulaInterruptDisabled;
      case DAISY_PRIORITY_UART0_TX:
        return this.uart0TxEmptyStatus && this.uart0TxEmpty;
      case DAISY_PRIORITY_UART1_TX:
        return this.uart1TxEmptyStatus && this.uart1TxEmpty;
      default:
        // CTC channels 0-7 (priorities 3-10)
        if (priority >= DAISY_PRIORITY_CTC_BASE && priority < DAISY_PRIORITY_ULA) {
          const ch = priority - DAISY_PRIORITY_CTC_BASE;
          return this.ctcIntStatus[ch] && this.ctcIntEnabled[ch];
        }
        return false;
    }
  }

  /**
   * Clears the pending request status flag for the device at the given priority.
   */
  clearDeviceRequest(priority: number): void {
    switch (priority) {
      case DAISY_PRIORITY_LINE:
        this.lineInterruptStatus = false;
        break;
      case DAISY_PRIORITY_UART0_RX:
        this.uart0RxNearFullStatus = false;
        this.uart0RxAvailableStatus = false;
        break;
      case DAISY_PRIORITY_UART1_RX:
        this.uart1RxNearFullStatus = false;
        this.uart1RxAvailableStatus = false;
        break;
      case DAISY_PRIORITY_ULA:
        this.ulaInterruptStatus = false;
        break;
      case DAISY_PRIORITY_UART0_TX:
        this.uart0TxEmptyStatus = false;
        break;
      case DAISY_PRIORITY_UART1_TX:
        this.uart1TxEmptyStatus = false;
        break;
      default:
        if (priority >= DAISY_PRIORITY_CTC_BASE && priority < DAISY_PRIORITY_ULA) {
          this.ctcIntStatus[priority - DAISY_PRIORITY_CTC_BASE] = false;
        }
        break;
    }
  }

  /**
   * Walks the daisy chain from highest to lowest priority and determines
   * whether any device should assert INT to the CPU.
   *
   * MAME equivalent: daisy_update_irq_state().
   * FPGA equivalent: peripherals.vhd INT_n AND chain + IEO chain.
   *
   * Returns true if an interrupt should be asserted.
   */
  daisyUpdateIrqState(): boolean {
    for (let i = 0; i < DAISY_DEVICE_COUNT; i++) {
      if (this.daisyInService[i]) {
        // --- InService device blocks all lower-priority devices (IEO = 0)
        return false;
      }
      if (this.isDeviceRequesting(i)) {
        // --- First Requesting device with IEI = 1 asserts INT
        return true;
      }
    }
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
      if (this.daisyInService[i]) {
        // --- An InService device blocks all below — no lower device can be acknowledged
        break;
      }
      if (this.isDeviceRequesting(i)) {
        // --- Transition: Requesting → InService
        this.daisyInService[i] = true;
        this.clearDeviceRequest(i);
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
        this.daisyInService[i] = false;
        return;
      }
    }
  }
}
