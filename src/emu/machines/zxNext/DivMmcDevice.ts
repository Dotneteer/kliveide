import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class DivMmcDevice implements IGenericDevice<IZxNextMachine> {
  private _conmem: boolean;
  private _mapram: boolean;
  private _bank: number;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._conmem = false;
    this._mapram = false;
    this._bank = 0;
    this.divifaceAutomaticPaging = false;
  }

  dispose(): void {}

  get conmem(): boolean {
    return this._conmem;
  }

  get mapram(): boolean {
    return this._mapram;
  }

  get bank(): number {
    return this._bank;
  }

  get port0xe3Value(): number {
    return (this._conmem ? 0x80 : 0x00) | (this._mapram ? 0x40 : 0x00) | (this._bank & 0x0f);
  }

  set port0xe3Value(value: number) {
    this._conmem = (value & 0x80) !== 0;
    this._mapram = (value & 0x40) !== 0;
    this._bank = value & 0x0f;
  }

  divifaceAutomaticPaging: boolean;
}
