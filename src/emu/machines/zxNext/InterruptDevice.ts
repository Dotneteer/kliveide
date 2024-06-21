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
    this._lineInterruptMsb = (value & 0x01) ? 0x100 : 0x00;
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
}
