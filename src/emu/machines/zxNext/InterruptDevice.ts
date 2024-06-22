import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class InterruptDevice implements IGenericDevice<IZxNextMachine> {
  private _intSignalActive: boolean;
  private _ulaInterruptDisabled: boolean;
  private _lineInterruptEnabled: boolean;
  private _lineInterruptMsb: number;
  private _lineInterruptLsb: number;
  private _im2TopBits: number;
  private _enableStacklessNmi: boolean;
  private _hwIm2Mode: boolean;
  private _nmiReturnAddressLsb: number;
  private _nmiReturnAddressMsb: number;
  private _expBusIntSignalActive: boolean;
  private _uart0TxEmpty: boolean;
  private _uart0RxNearFull: boolean;
  private _uart0RxAvailable: boolean;
  private _uart1TxEmpty: boolean;
  private _uart1RxNearFull: boolean;
  private _uart1RxAvailable: boolean;

  readonly ctcChannelEnabled: boolean[] = [];

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._intSignalActive = false;
    this._ulaInterruptDisabled = false;
    this._lineInterruptEnabled = false;
    this._lineInterruptMsb = 0x00;
    this._lineInterruptLsb = 0x00;
    this._im2TopBits = 0x00;
    this._enableStacklessNmi = false;
    this._hwIm2Mode = false;
    this._nmiReturnAddressLsb = 0x00;
    this._nmiReturnAddressMsb = 0x00;
    for (let i = 0; i < 8; i++) {
      this.ctcChannelEnabled[i] = false;
    }
  }

  dispose(): void {}

  get nextReg22Value(): number {
    return (
      (this._intSignalActive ? 0x80 : 0x00) |
      (this._ulaInterruptDisabled ? 0x04 : 0x00) |
      (this._lineInterruptEnabled ? 0x02 : 0x00) |
      (this._lineInterruptMsb ? 0x01 : 0x00)
    );
  }

  set nextReg22Value(value: number) {
    this._intSignalActive = (value & 0x80) !== 0;
    this._ulaInterruptDisabled = (value & 0x04) !== 0;
    this._lineInterruptEnabled = (value & 0x02) !== 0;
    this._lineInterruptMsb = value & 0x01 ? 0x100 : 0x00;
  }

  get nextReg23Value(): number {
    return this._lineInterruptLsb;
  }

  set nextReg23Value(value: number) {
    this._lineInterruptLsb = value;
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
    this._nmiReturnAddressLsb = value;
  }

  set nextRegC3Value(value: number) {
    this._nmiReturnAddressMsb = value;
  }

  set nextRegC4Value(value: number) {
    this._expBusIntSignalActive = (value & 0x80) !== 0;
  }

  get nextRegC5Value(): number {
    return (
      (this.ctcChannelEnabled[0] ? 0x01 : 0x00) |
      (this.ctcChannelEnabled[1] ? 0x02 : 0x00) |
      (this.ctcChannelEnabled[2] ? 0x04 : 0x00) |
      (this.ctcChannelEnabled[3] ? 0x08 : 0x00) |
      (this.ctcChannelEnabled[4] ? 0x10 : 0x00) |
      (this.ctcChannelEnabled[5] ? 0x20 : 0x00) |
      (this.ctcChannelEnabled[6] ? 0x40 : 0x00) |
      (this.ctcChannelEnabled[7] ? 0x80 : 0x00)
    );
  }

  set nextRegC5Value(value: number) {
    this.ctcChannelEnabled[0] = (value & 0x01) !== 0;
    this.ctcChannelEnabled[1] = (value & 0x02) !== 0;
    this.ctcChannelEnabled[2] = (value & 0x04) !== 0;
    this.ctcChannelEnabled[3] = (value & 0x08) !== 0;
    this.ctcChannelEnabled[4] = (value & 0x10) !== 0;
    this.ctcChannelEnabled[5] = (value & 0x20) !== 0;
    this.ctcChannelEnabled[6] = (value & 0x40) !== 0;
    this.ctcChannelEnabled[7] = (value & 0x80) !== 0;
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

  get intSignalActive(): boolean {
    return this._intSignalActive;
  }

  get ulaInterruptDisabled(): boolean {
    return this._ulaInterruptDisabled;
  }

  get lineInterruptEnabled(): boolean {
    return this._lineInterruptEnabled;
  }

  get lineInterruptMsb(): number {
    return this._lineInterruptMsb;
  }

  get lineInterruptLsb(): number {
    return this._lineInterruptLsb;
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

  get nmiReturnAddressLsb(): number {
    return this._nmiReturnAddressLsb;
  }

  get nmiReturnAddressMsb(): number {
    return this._nmiReturnAddressMsb;
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
}
