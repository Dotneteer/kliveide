import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class InterruptDevice implements IGenericDevice<IZxNextMachine> {
  private _intSignalActive: boolean;
  private _ulaInterruptDisabled: boolean;
  private _lineInterruptEnabled: boolean;
  private _lineInterrupt: number;
  private _im2TopBits: number;
  private _enableStacklessNmi: boolean;
  private _hwIm2Mode: boolean;
  private _nmiReturnAddress: number;
  private _expBusIntSignalActive: boolean;
  private _uart0TxEmpty: boolean;
  private _uart0RxNearFull: boolean;
  private _uart0RxAvailable: boolean;
  private _uart1TxEmpty: boolean;
  private _uart1RxNearFull: boolean;
  private _uart1RxAvailable: boolean;
  private _lineInterruptStatus: boolean;
  private _ulaInterruptStatus: boolean;
  private _uart0TxEmptyStatus: boolean;
  private _uart0RxNearFullStatus: boolean;
  private _uart0RxAvailableStatus: boolean;
  private _uart1TxEmptyStatus: boolean;
  private _uart1RxNearFullStatus: boolean;
  private _uart1RxAvailableStatus: boolean;
  private _enableNmiToIntDma: boolean;
  private _enableLineIntToIntDma: boolean;
  private _enableUlaIntToIntDma: boolean;
  private _enableUart0TxEmptyToIntDma: boolean;
  private _enableUart0RxNearFullToIntDma: boolean;
  private _enableUart0RxAvailableToIntDma: boolean;
  private _enableUart1TxEmptyToIntDma: boolean;
  private _enableUart1RxNearFullToIntDma: boolean;
  private _enableUart1RxAvailableToIntDma: boolean;

  readonly ctcIntEnabled: boolean[] = [];
  readonly ctcIntStatus: boolean[] = [];
  readonly enableCtcToIntDma: boolean[] = [];

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
    this._intSignalActive = false;
    this._ulaInterruptDisabled = false;
    this._lineInterruptEnabled = false;
    this._lineInterrupt = 0x00;
    this._im2TopBits = 0x00;
    this._enableStacklessNmi = false;
    this._hwIm2Mode = false;
    this._nmiReturnAddress = 0x00;
    for (let i = 0; i < 8; i++) {
      this.ctcIntEnabled[i] = false;
      this.ctcIntStatus[i] = false;
      this.enableCtcToIntDma[i] = false;
    }
    this.busResetRequested = false;
    this.mfNmiByIoTrap = false;
    this.mfNmiByNextReg = false;
    this.divMccNmiBtNextReg = false;
    this.lastWasHardReset = false;
    this.lastWasSoftReset = false;
  }

  dispose(): void {}

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

  get nextReg22Value(): number {
    return (
      (this._intSignalActive ? 0x80 : 0x00) |
      (this._ulaInterruptDisabled ? 0x04 : 0x00) |
      (this._lineInterruptEnabled ? 0x02 : 0x00) |
      ((this._lineInterrupt & 0x100) ? 0x01 : 0x00)
    );
  }

  set nextReg22Value(value: number) {
    this._intSignalActive = (value & 0x80) !== 0;
    this._ulaInterruptDisabled = (value & 0x04) !== 0;
    this._lineInterruptEnabled = (value & 0x02) !== 0;
    this._lineInterrupt = ((value & 0x01) << 8) | (this._lineInterrupt & 0xff);
  }

  get nextReg23Value(): number {
    return this._lineInterrupt & 0xff;
  }

  set nextReg23Value(value: number) {
    this._lineInterrupt = (this._lineInterrupt & 0x100) | (value & 0xff);
  }

  get nextRegC0Value(): number {
    return (
      this._im2TopBits |
      (this._enableStacklessNmi ? 0x08 : 0x00) |
      (this.currentInterruptMode << 1) |
      (this._hwIm2Mode ? 0x01 : 0x00)
    );
  }

  set nextRegC0Value(value: number) {
    this._im2TopBits = value & 0xe0;
    this._enableStacklessNmi = (value & 0x08) !== 0;
    this._hwIm2Mode = (value & 0x01) !== 0;
  }

  set nextRegC2Value(value: number) {
    this._nmiReturnAddress = (this._nmiReturnAddress & 0xff00) | value;
  }

  set nextRegC3Value(value: number) {
    this._nmiReturnAddress = ((value & 0xff) << 8) | (this._nmiReturnAddress & 0xff);
  }

  get nextRegC4Value(): number {
    return (
      (this._expBusIntSignalActive ? 0x80 : 0x00) |
      (this._lineInterruptEnabled ? 0x02 : 0x00) |
      (!this._ulaInterruptDisabled ? 0x01 : 0x00)
    );
  }

  set nextRegC4Value(value: number) {
    this._expBusIntSignalActive = (value & 0x80) !== 0;
    this._lineInterruptEnabled = (value & 0x02) !== 0;
    this._ulaInterruptDisabled = (value & 0x01) === 0;
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
      (this._uart1TxEmpty ? 0x40 : 0x00) |
      (this._uart1RxNearFull ? 0x20 : 0x00) |
      (this._uart1RxAvailable ? 0x10 : 0x00) |
      (this._uart0TxEmpty ? 0x04 : 0x00) |
      (this._uart0RxNearFull ? 0x02 : 0x00) |
      (this._uart0RxAvailable ? 0x01 : 0x00)
    );
  }

  set nextRegC6Value(value: number) {
    this._uart1TxEmpty = (value & 0x40) !== 0;
    this._uart1RxNearFull = (value & 0x20) !== 0;
    this._uart1RxAvailable = (value & 0x10) !== 0;
    this._uart0TxEmpty = (value & 0x04) !== 0;
    this._uart0RxNearFull = (value & 0x02) !== 0;
    this._uart0RxAvailable = (value & 0x01) !== 0;
  }

  get nextRegC8Value(): number {
    return (this._lineInterruptStatus ? 0x02 : 0x00) | (this._ulaInterruptStatus ? 0x01 : 0x00);
  }

  set nextRegC8Value(value: number) {
    if (value & 0x02 && !this._hwIm2Mode) {
      this._lineInterruptStatus = false;
    }
    if (value & 0x01 && !this._hwIm2Mode) {
      this._ulaInterruptStatus = false;
    }
  }

  get nextRegC9Value(): number {
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
    if (value & 0x01 && !this._hwIm2Mode) {
      this.ctcIntStatus[0] = false;
    }
    if (value & 0x02 && !this._hwIm2Mode) {
      this.ctcIntStatus[1] = false;
    }
    if (value & 0x04 && !this._hwIm2Mode) {
      this.ctcIntStatus[2] = false;
    }
    if (value & 0x08 && !this._hwIm2Mode) {
      this.ctcIntStatus[3] = false;
    }
    if (value & 0x10 && !this._hwIm2Mode) {
      this.ctcIntStatus[4] = false;
    }
    if (value & 0x20 && !this._hwIm2Mode) {
      this.ctcIntStatus[5] = false;
    }
    if (value & 0x40 && !this._hwIm2Mode) {
      this.ctcIntStatus[6] = false;
    }
    if (value & 0x80 && !this._hwIm2Mode) {
      this.ctcIntStatus[7] = false;
    }
  }

  get nextRegCAValue(): number {
    return (
      (this._uart1TxEmptyStatus ? 0x40 : 0x00) |
      (this._uart1RxNearFullStatus ? 0x20 : 0x00) |
      (this._uart1RxAvailableStatus ? 0x10 : 0x00) |
      (this._uart0TxEmptyStatus ? 0x04 : 0x00) |
      (this._uart0RxNearFullStatus ? 0x02 : 0x00) |
      (this._uart0RxAvailableStatus ? 0x01 : 0x00)
    );
  }

  set nextRegCAValue(value: number) {
    if (value & 0x40 && !this._hwIm2Mode) {
      this._uart1TxEmptyStatus = false;
    }
    if (value & 0x20 && !this._hwIm2Mode) {
      this._uart1RxNearFullStatus = false;
    }
    if (value & 0x10 && !this._hwIm2Mode) {
      this._uart1RxAvailableStatus = false;
    }
    if (value & 0x04 && !this._hwIm2Mode) {
      this._uart0TxEmptyStatus = false;
    }
    if (value & 0x02 && !this._hwIm2Mode) {
      this._uart0RxNearFullStatus = false;
    }
    if (value & 0x01 && !this._hwIm2Mode) {
      this._uart0RxAvailableStatus = false;
    }
  }

  get nextRegCCValue(): number {
    return (
      (this._enableNmiToIntDma ? 0x80 : 0x00) |
      (this._enableLineIntToIntDma ? 0x02 : 0x00) |
      (this._enableUlaIntToIntDma ? 0x01 : 0x00)
    );
  }

  set nextRegCCValue(value: number) {
    this._enableNmiToIntDma = (value & 0x80) !== 0;
    this._enableLineIntToIntDma = (value & 0x02) !== 0;
    this._enableUlaIntToIntDma = (value & 0x01) !== 0;
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
      (this._enableUart1TxEmptyToIntDma ? 0x40 : 0x00) |
      (this._enableUart1RxNearFullToIntDma ? 0x20 : 0x00) |
      (this._enableUart1RxAvailableToIntDma ? 0x10 : 0x00) |
      (this._enableUart0TxEmptyToIntDma ? 0x04 : 0x00) |
      (this._enableUart0RxNearFullToIntDma ? 0x02 : 0x00) |
      (this._enableUart0RxAvailableToIntDma ? 0x01 : 0x00)
    );
  }

  set nextRegCEValue(value: number) {
    this._enableUart1TxEmptyToIntDma = (value & 0x40) !== 0;
    this._enableUart1RxNearFullToIntDma = (value & 0x20) !== 0;
    this._enableUart1RxAvailableToIntDma = (value & 0x10) !== 0;
    this._enableUart0TxEmptyToIntDma = (value & 0x04) !== 0;
    this._enableUart0RxNearFullToIntDma = (value & 0x02) !== 0;
    this._enableUart0RxAvailableToIntDma = (value & 0x01) !== 0;
  }

  get intSignalActive(): boolean {
    return this._intSignalActive;
  }

  get ulaInterruptDisabled(): boolean {
    return this._ulaInterruptDisabled;
  }

  get lineInterruptEnabled(): boolean {
    return this._lineInterruptEnabled;
  }

  get lineInterrupt(): number {
    return this._lineInterrupt;
  }

  get im2TopBits(): number {
    return this._im2TopBits;
  }

  get enableStacklessNmi(): boolean {
    return this._enableStacklessNmi;
  }

  get currentInterruptMode(): number {
    return this.machine.interruptMode;
  }

  get hwIm2Mode(): boolean {
    return this._hwIm2Mode;
  }

  get nmiReturnAddress(): number {
    return this._nmiReturnAddress;
  }

  get expBusIntSignalActive(): boolean {
    return this._expBusIntSignalActive;
  }

  get uart0TxEmpty(): boolean {
    return this._uart0TxEmpty;
  }

  get uart0RxNearFull(): boolean {
    return this._uart0RxNearFull;
  }

  get uart0RxAvailable(): boolean {
    return this._uart0RxAvailable;
  }

  get uart1TxEmpty(): boolean {
    return this._uart1TxEmpty;
  }

  get uart1RxNearFull(): boolean {
    return this._uart1RxNearFull;
  }

  get uart1RxAvailable(): boolean {
    return this._uart1RxAvailable;
  }

  get lineInterruptStatus(): boolean {
    return this._lineInterruptStatus;
  }

  set lineInterruptStatus(value: boolean) {
    this._lineInterruptStatus = value;
  }

  get ulaInterruptStatus(): boolean {
    return this._ulaInterruptStatus;
  }

  set ulaInterruptStatus(value: boolean) {
    this._ulaInterruptStatus = value;
  }

  setCtcChannelInterruptStatus(channel: number, value: boolean) {
    this.ctcIntStatus[channel] = value;
  }

  get uart0TxEmptyStatus(): boolean {
    return this._uart0TxEmptyStatus;
  }

  set uart0TxEmptyStatus(value: boolean) {
    this._uart0TxEmptyStatus = value;
  }

  get uart0RxNearFullStatus(): boolean {
    return this._uart0RxNearFullStatus;
  }

  set uart0RxNearFullStatus(value: boolean) {
    this._uart0RxNearFullStatus = value;
  }

  get uart0RxAvailableStatus(): boolean {
    return this._uart0RxAvailableStatus;
  }

  set uart0RxAvailableStatus(value: boolean) {
    this._uart0RxAvailableStatus = value;
  }

  get uart1TxEmptyStatus(): boolean {
    return this._uart1TxEmptyStatus;
  }

  set uart1TxEmptyStatus(value: boolean) {
    this._uart1TxEmptyStatus = value;
  }

  get uart1RxNearFullStatus(): boolean {
    return this._uart1RxNearFullStatus;
  }

  set uart1RxNearFullStatus(value: boolean) {
    this._uart1RxNearFullStatus = value;
  }

  get uart1RxAvailableStatus(): boolean {
    return this._uart1RxAvailableStatus;
  }

  set uart1RxAvailableStatus(value: boolean) {
    this._uart1RxAvailableStatus = value;
  }

  get enableNmiToIntDma(): boolean {
    return this._enableNmiToIntDma;
  }

  get enableLineIntToIntDma(): boolean {
    return this._enableLineIntToIntDma;
  }

  get enableUlaIntToIntDma(): boolean {
    return this._enableUlaIntToIntDma;
  }

  get enableUart0TxEmptyToIntDma(): boolean {
    return this._enableUart0TxEmptyToIntDma;
  }

  get enableUart0RxNearFullToIntDma(): boolean {
    return this._enableUart0RxNearFullToIntDma;
  }

  get enableUart0RxAvailableToIntDma(): boolean {
    return this._enableUart0RxAvailableToIntDma;
  }

  get enableUart1TxEmptyToIntDma(): boolean {
    return this._enableUart1TxEmptyToIntDma;
  }

  get enableUart1RxNearFullToIntDma(): boolean {
    return this._enableUart1RxNearFullToIntDma;
  }

  get enableUart1RxAvailableToIntDma(): boolean {
    return this._enableUart1RxAvailableToIntDma;
  }
}
