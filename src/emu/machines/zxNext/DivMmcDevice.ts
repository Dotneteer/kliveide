import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class DivMmcDevice implements IGenericDevice<IZxNextMachine> {
  private _conmem: boolean;
  private _mapram: boolean;
  private _bank: number;

  readonly rstTraps: TrapInfo[] = [];
  autoMapOn3dxx: boolean;
  disableAutomapOn1ff8: boolean;
  automapOn056a: boolean;
  automapOn04d7: boolean;
  automapOn0562: boolean;
  automapOn04c6: boolean;
  automapOn0066: boolean;
  automapOn0066Delayed: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    for (let i = 0; i < 8; i++) {
      this.rstTraps.push({ enabled: false, onlyWithRom3: false, instantMapping: false });
    }
    this.reset();
  }

  reset(): void {
    this._conmem = false;
    this._mapram = false;
    this._bank = 0;
    this.automaticPaging = false;
    for (let i = 0; i < 8; i++) {
      this.rstTraps[i].enabled = false;
      this.rstTraps[i].onlyWithRom3 = false;
      this.rstTraps[i].instantMapping = false;
    }
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
    const mapramBit = (value & 0x40) !== 0;
    if (!this._mapram) {
      this._mapram = mapramBit;
    } else if (!mapramBit && this.machine.nextRegDevice.r09_ResetDivMmcMapram) {
      // --- Allow resetting MAPRAM only if the R09 register Bit 3 is set
      this._mapram = false;
    }
    this._bank = value & 0x0f;
  }

  set nextRegB8Value(value: number) {
    this.rstTraps[0].enabled = (value & 0x01) !== 0;
    this.rstTraps[1].enabled = (value & 0x02) !== 0;
    this.rstTraps[2].enabled = (value & 0x04) !== 0;
    this.rstTraps[3].enabled = (value & 0x08) !== 0;
    this.rstTraps[4].enabled = (value & 0x10) !== 0;
    this.rstTraps[5].enabled = (value & 0x20) !== 0;
    this.rstTraps[6].enabled = (value & 0x40) !== 0;
    this.rstTraps[7].enabled = (value & 0x80) !== 0;
  }

  set nextRegB9Value(value: number) {
    this.rstTraps[0].onlyWithRom3 = (value & 0x01) !== 0;
    this.rstTraps[1].onlyWithRom3 = (value & 0x02) !== 0;
    this.rstTraps[2].onlyWithRom3 = (value & 0x04) !== 0;
    this.rstTraps[3].onlyWithRom3 = (value & 0x08) !== 0;
    this.rstTraps[4].onlyWithRom3 = (value & 0x10) !== 0;
    this.rstTraps[5].onlyWithRom3 = (value & 0x20) !== 0;
    this.rstTraps[6].onlyWithRom3 = (value & 0x40) !== 0;
    this.rstTraps[7].onlyWithRom3 = (value & 0x80) !== 0;
  }

  set nextRegBAValue(value: number) {
    this.rstTraps[0].instantMapping = (value & 0x01) !== 0;
    this.rstTraps[1].instantMapping = (value & 0x02) !== 0;
    this.rstTraps[2].instantMapping = (value & 0x04) !== 0;
    this.rstTraps[3].instantMapping = (value & 0x08) !== 0;
    this.rstTraps[4].instantMapping = (value & 0x10) !== 0;
    this.rstTraps[5].instantMapping = (value & 0x20) !== 0;
    this.rstTraps[6].instantMapping = (value & 0x40) !== 0;
    this.rstTraps[7].instantMapping = (value & 0x80) !== 0;
  }

  set nextRegBBValue(value: number) {
    this.autoMapOn3dxx = (value & 0x80) !== 0;
    this.disableAutomapOn1ff8 = (value & 0x40) !== 0;
    this.automapOn056a = (value & 0x20) !== 0;
    this.automapOn04d7 = (value & 0x10) !== 0;
    this.automapOn0562 = (value & 0x08) !== 0;
    this.automapOn04c6 = (value & 0x04) !== 0;
    this.automapOn0066 = (value & 0x02) !== 0;
    this.automapOn0066Delayed = (value & 0x01) !== 0;
  }

  getRstTrapActive(index: number): boolean {
    return this.rstTraps[index].enabled;
  
  }

  automaticPaging: boolean;
}

type TrapInfo = {
  enabled: boolean;
  onlyWithRom3: boolean;
  instantMapping: boolean;
}
