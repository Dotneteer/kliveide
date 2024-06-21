import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { OFFS_DIVMMC_RAM, OFFS_DIVMMC_ROM } from "./MemoryDevice";

export class DivMmcDevice implements IGenericDevice<IZxNextMachine> {
  private _conmem: boolean;
  private _mapram: boolean;
  private _bank: number;
  private _pagedIn: boolean;
  private _pageInRequested: boolean;
  private _pageInDelayed: boolean;
  private _pageOutRequested: boolean;
  private _canWritePage1: boolean;

  readonly rstTraps: TrapInfo[] = [];
  automapOn3dxx: boolean;
  disableAutomapOn1ff8: boolean;
  automapOn056a: boolean;
  automapOn04d7: boolean;
  automapOn0562: boolean;
  automapOn04c6: boolean;
  automapOn0066: boolean;
  automapOn0066Delayed: boolean;
  enableAutomap: boolean;
  multifaceType: number;

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
    this._pagedIn = false;
    this._pageInRequested = false;
    this._pageOutRequested = false;
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
    this._canWritePage1 = !this._mapram || this._bank !== 0x03;
    if (this.enableAutomap && this._conmem) {
      // --- Instant mapping when CONMEM is active
      this.pageIn();
    }
  }

  get nextRegB8Value(): number {
    return (
      (this.rstTraps[0].enabled ? 0x01 : 0x00) |
      (this.rstTraps[1].enabled ? 0x02 : 0x00) |
      (this.rstTraps[2].enabled ? 0x04 : 0x00) |
      (this.rstTraps[3].enabled ? 0x08 : 0x00) |
      (this.rstTraps[4].enabled ? 0x10 : 0x00) |
      (this.rstTraps[5].enabled ? 0x20 : 0x00) |
      (this.rstTraps[6].enabled ? 0x40 : 0x00) |
      (this.rstTraps[7].enabled ? 0x80 : 0x00)
    );
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

  get nextRegB9Value(): number {
    return (
      (this.rstTraps[0].onlyWithRom3 ? 0x01 : 0x00) |
      (this.rstTraps[1].onlyWithRom3 ? 0x02 : 0x00) |
      (this.rstTraps[2].onlyWithRom3 ? 0x04 : 0x00) |
      (this.rstTraps[3].onlyWithRom3 ? 0x08 : 0x00) |
      (this.rstTraps[4].onlyWithRom3 ? 0x10 : 0x00) |
      (this.rstTraps[5].onlyWithRom3 ? 0x20 : 0x00) |
      (this.rstTraps[6].onlyWithRom3 ? 0x40 : 0x00) |
      (this.rstTraps[7].onlyWithRom3 ? 0x80 : 0x00)
    );
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

  get nextRegBAValue(): number {
    return (
      (this.rstTraps[0].instantMapping ? 0x01 : 0x00) |
      (this.rstTraps[1].instantMapping ? 0x02 : 0x00) |
      (this.rstTraps[2].instantMapping ? 0x04 : 0x00) |
      (this.rstTraps[3].instantMapping ? 0x08 : 0x00) |
      (this.rstTraps[4].instantMapping ? 0x10 : 0x00) |
      (this.rstTraps[5].instantMapping ? 0x20 : 0x00) |
      (this.rstTraps[6].instantMapping ? 0x40 : 0x00) |
      (this.rstTraps[7].instantMapping ? 0x80 : 0x00)
    );
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

  get nextRegBBValue(): number {
    return (
      (this.automapOn3dxx ? 0x80 : 0x00) |
      (this.disableAutomapOn1ff8 ? 0x40 : 0x00) |
      (this.automapOn056a ? 0x20 : 0x00) |
      (this.automapOn04d7 ? 0x10 : 0x00) |
      (this.automapOn0562 ? 0x08 : 0x00) |
      (this.automapOn04c6 ? 0x04 : 0x00) |
      (this.automapOn0066 ? 0x02 : 0x00) |
      (this.automapOn0066Delayed ? 0x01 : 0x00)
    );
  }

  set nextRegBBValue(value: number) {
    this.automapOn3dxx = (value & 0x80) !== 0;
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

  get pagedIn(): boolean {
    return this._pagedIn;
  }

  get canWritePage1(): boolean {
    return this._canWritePage1;
  }

  get pageInRequested(): boolean {
    return this._pageInRequested;
  }

  get pageOutRequested(): boolean {
    return this._pageOutRequested;
  }

  // --- Pages in ROM/RAM into the lower 16K, if requested so
  beforeOpcodeFetch(): void {
    if (!this.enableAutomap) {
      // --- No page in/out if automap is disabled or the memory is already paged in
      return;
    }

    // --- We need to know if ROM 3 is paged in
    const memoryDevice = this.machine.memoryDevice;
    const rom3PagedIn =
      !memoryDevice.enableAltRom &&
      (memoryDevice.selectedRomMsb | memoryDevice.selectedRomLsb) === 0x03;

    // --- Check for traps
    const pc = this.machine.pc;
    switch (pc) {
      case 0x0000:
      case 0x0008:
      case 0x0010:
      case 0x0018:
      case 0x0020:
      case 0x0028:
      case 0x0030:
      case 0x0038:
        const rstIdx = this.machine.pc >> 3;
        if (this.rstTraps[rstIdx].enabled && (!this.rstTraps[rstIdx].onlyWithRom3 || rom3PagedIn)) {
          this._pageInRequested = true;
          this._pageInDelayed = !this.rstTraps[rstIdx].instantMapping;
        }
        break;
      case 0x0066:
        // TODO: Implement it when NMI button handling is implemented
        break;
      case 0x04c6:
        if (this.automapOn04c6 && rom3PagedIn) {
          this._pageInRequested = true;
          this._pageInDelayed = true;
        }
        break;
      case 0x0562:
        if (this.automapOn0562 && rom3PagedIn) {
          this._pageInRequested = true;
          this._pageInDelayed = true;
        }
        break;
      case 0x04d7:
        if (this.automapOn04d7 && rom3PagedIn) {
          this._pageInRequested = true;
          this._pageInDelayed = true;
        }
        break;
      case 0x056a:
        if (this.automapOn056a && rom3PagedIn) {
          this._pageInRequested = true;
          this._pageInDelayed = true;
        }
        break;
      default:
        if (pc >= 0x3d00 && pc <= 0x3dff && this.automapOn3dxx && rom3PagedIn) {
          this._pageInRequested = true;
          this._pageInDelayed = false;
        } else if (pc >= 0x1ff8 && pc <= 0x1fff && !this.disableAutomapOn1ff8) {
          this._pageOutRequested = true;
        }
    }

    // --- Page in, if reqested
    if (this._pageInRequested && !this._pageInDelayed) {
      this.pageIn();
      this._pageInRequested = false;
    }
  }

  // --- Pages in and out ROM/RAM into the lower 16K, if requested so
  afterOpcodeFetch(): void {
    // --- Check for delayed page in
    if (this._pageInRequested && this._pageInDelayed && !this._pageOutRequested) {
      this.pageIn();
      this._pageInRequested = false;
      this._pageInDelayed = false;
      return;
    }

    if (this._pageOutRequested) {
      this.pageOut();
      this._pageOutRequested = false;
    }
  }

  // --- Pages in ROM/RAM into the lower 16K
  private pageIn(): void {
    this._pagedIn = true;
    const memoryDevice = this.machine.memoryDevice;

    // --- Page 0
    if (this._conmem || !this._mapram) {
      memoryDevice.setPageInfo(0, OFFS_DIVMMC_ROM, null, 0xff, 0xff);
    } else {
      const offset = OFFS_DIVMMC_RAM + 3 * 0x2000;
      memoryDevice.setPageInfo(0, offset, offset, 0xff, 0xff);
    }

    // --- Page 1
    const offset = OFFS_DIVMMC_RAM + this.bank * 0x2000;
    memoryDevice.setPageInfo(1, offset, this._mapram  && this.bank === 3 ? null : offset, 0xff, 0xff);
  }

  // --- Pages out ROM/RAM from the lower 16K
  private pageOut(): void {
    this._pagedIn = false;
    this.machine.memoryDevice.updateMemoryConfig();
  }
}

type TrapInfo = {
  enabled: boolean;
  onlyWithRom3: boolean;
  instantMapping: boolean;
};
