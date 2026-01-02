import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export class DivMmcDevice implements IGenericDevice<IZxNextMachine> {
  private _enabled: boolean;
  private _conmem: boolean;
  private _mapram: boolean;
  private _bank: number;
  private _portLastE3Value: number;
  private _enableAutomap: boolean;
  private _requestAutomapOn: boolean;
  private _requestAutomapOff: boolean;
  private _autoMapActive: boolean;
  private _conmemActivated: boolean; // Track if conmem activated the mapping

  readonly rstTraps: TrapInfo[] = [];
  automapOn3dxx: boolean;
  disableAutomapOn1ff8: boolean;
  automapOn056a: boolean;
  automapOn04d7: boolean;
  automapOn0562: boolean;
  automapOn04c6: boolean;
  automapOn0066: boolean;
  automapOn0066Delayed: boolean;
  multifaceType: number;
  enableDivMmcNmiByDriveButton: boolean;
  enableMultifaceNmiByM1Button: boolean;
  resetDivMmcMapramFlag: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    for (let i = 0; i < 8; i++) {
      this.rstTraps.push({ enabled: false, onlyWithRom3: false, instantMapping: false });
    }
    this.reset();
  }

  reset(): void {
    this._enabled = true;
    this._portLastE3Value = 0x00;
    this._conmem = false;
    this._mapram = false;
    this._bank = 0;
    this._autoMapActive = false;
    this._enableAutomap = false;
    this._requestAutomapOn = false;
    this._requestAutomapOff = false;
    this._conmemActivated = false;
    for (let i = 0; i < 8; i++) {
      this.rstTraps[i].enabled = false;
      this.rstTraps[i].onlyWithRom3 = false;
      this.rstTraps[i].instantMapping = false;
    }
    this.enableDivMmcNmiByDriveButton = false;
    this.enableMultifaceNmiByM1Button = false;
    this.resetDivMmcMapramFlag = false;
  }

  // Is the DivMMC device enabled?
  get enabled(): boolean {
    return this._enabled;
  }

  get conmem(): boolean {
    return this._conmem;
  }

  get mapram(): boolean {
    return this._mapram;
  }

  get bank(): number {
    return this._bank;
  }

  get autoMapActive(): boolean {
    return this._autoMapActive;
  }

  get enableAutomap(): boolean {
    return this._enableAutomap;
  }

  set enableAutomap(value: boolean) {
    if (this._enableAutomap === value) return;
    this._enableAutomap = value;
    if (!value) {
      // --- Automap is disabled
      this._autoMapActive = false;
      this._conmemActivated = false;
      this.machine.memoryDevice.updateFastPathFlags();
    }
  }

  get port0xe3Value(): number {
    return this.enabled
      ? (this._conmem ? 0x80 : 0x00) | (this._mapram ? 0x40 : 0x00) | (this._bank & 0x0f)
      : 0xff;
  }

  set port0xe3Value(value: number) {
    if (!this._enabled) return;

    this._portLastE3Value = value;
    this._conmem = (value & 0x80) !== 0;
    const mapramBit = (value & 0x40) !== 0;
    if (!this._mapram) {
      this._mapram = mapramBit;
    } else if (!mapramBit && this.resetDivMmcMapramFlag) {
      // --- Allow resetting MAPRAM only if the R09 register Bit 3 is set
      this._mapram = false;
    }
    this._bank = value & 0x0f;
    this.machine.memoryDevice.updateMemoryConfig();
    this.machine.memoryDevice.updateFastPathFlags();
  }

  set nextReg83Value(value: number) {
    const oldEnabled = this._enabled;
    this._enabled = !!(value & 0x01);
    if (oldEnabled === this._enabled) return;
    if (this._enabled) {
      // --- DivMMC is enabled again
      this.port0xe3Value = this._portLastE3Value;
    } else {
      // --- DivMMC is disabled
      this._autoMapActive = false;
      this._conmemActivated = false;
      this.machine.memoryDevice.updateFastPathFlags();
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
    this.rstTraps[0].enabled = !!(value & 0x01);
    this.rstTraps[1].enabled = !!(value & 0x02);
    this.rstTraps[2].enabled = !!(value & 0x04);
    this.rstTraps[3].enabled = !!(value & 0x08);
    this.rstTraps[4].enabled = !!(value & 0x10);
    this.rstTraps[5].enabled = !!(value & 0x20);
    this.rstTraps[6].enabled = !!(value & 0x40);
    this.rstTraps[7].enabled = !!(value & 0x80);
  }

  get nextRegB9Value(): number {
    return (
      (this.rstTraps[0].onlyWithRom3 ? 0x00 : 0x01) |
      (this.rstTraps[1].onlyWithRom3 ? 0x00 : 0x02) |
      (this.rstTraps[2].onlyWithRom3 ? 0x00 : 0x04) |
      (this.rstTraps[3].onlyWithRom3 ? 0x00 : 0x08) |
      (this.rstTraps[4].onlyWithRom3 ? 0x00 : 0x10) |
      (this.rstTraps[5].onlyWithRom3 ? 0x00 : 0x20) |
      (this.rstTraps[6].onlyWithRom3 ? 0x00 : 0x40) |
      (this.rstTraps[7].onlyWithRom3 ? 0x00 : 0x80)
    );
  }

  set nextRegB9Value(value: number) {
    this.rstTraps[0].onlyWithRom3 = !(value & 0x01);
    this.rstTraps[1].onlyWithRom3 = !(value & 0x02);
    this.rstTraps[2].onlyWithRom3 = !(value & 0x04);
    this.rstTraps[3].onlyWithRom3 = !(value & 0x08);
    this.rstTraps[4].onlyWithRom3 = !(value & 0x10);
    this.rstTraps[5].onlyWithRom3 = !(value & 0x20);
    this.rstTraps[6].onlyWithRom3 = !(value & 0x40);
    this.rstTraps[7].onlyWithRom3 = !(value & 0x80);
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

  // --- Pages in ROM/RAM into the lower 16K, if requested so
  beforeOpcodeFetch(): void {
    const pc = this.machine.pc;

    // --- Check manual conmem control (port 0xE3 bit 7)
    // --- This should work independently of entry points, but still requires enableAutomap
    if (this.enableAutomap) {
      if (this._conmem && !this._conmemActivated) {
        // --- conmem=1: activate mapping if not already activated by conmem
        this._autoMapActive = true;
        this._conmemActivated = true;
        this.machine.memoryDevice.updateFastPathFlags();
      } else if (!this._conmem && this._conmemActivated) {
        // --- conmem=0: deactivate mapping if it was activated by conmem
        this._autoMapActive = false;
        this._conmemActivated = false;
        this.machine.memoryDevice.updateFastPathFlags();
      }
    }

    if (!this.enableAutomap) {
      // --- No page in/out if automap is disabled
      return;
    }

    // --- We need to know if ROM 3 is paged in
    const memoryDevice = this.machine.memoryDevice;
    const rom3PagedIn =
      //!memoryDevice.enableAltRom &&
      (memoryDevice.selectedRomMsb | memoryDevice.selectedRomLsb) === 0x03;

    // --- Check for traps
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
          if (this.rstTraps[rstIdx].instantMapping) {
            this._autoMapActive = true;
            this._requestAutomapOn = false;
            this.machine.memoryDevice.updateFastPathFlags();
          } else {
            this._requestAutomapOn = true;
          }
        }
        break;
      case 0x0066:
        // TODO: Implement it when NMI button handling is implemented
        break;
      case 0x04c6:
        if (this.automapOn04c6 && rom3PagedIn) {
          this._requestAutomapOn = true;
        }
        break;
      case 0x0562:
        if (this.automapOn0562 && rom3PagedIn) {
          this._requestAutomapOn = true;
        }
        break;
      case 0x04d7:
        if (this.automapOn04d7 && rom3PagedIn) {
          this._requestAutomapOn = true;
        }
        break;
      case 0x056a:
        if (this.automapOn056a && rom3PagedIn) {
          this._requestAutomapOn = true;
        }
        break;
      default:
        if (pc >= 0x3d00 && pc <= 0x3dff) {
          if (this.automapOn3dxx && rom3PagedIn) {
            this._autoMapActive = true;
            this.machine.memoryDevice.updateFastPathFlags();
          }
        } else if (pc >= 0x1ff8 && pc <= 0x1fff) {
          if (this.disableAutomapOn1ff8) {
            this._requestAutomapOff = true;
          } else {
            this._autoMapActive = false;
            this.machine.memoryDevice.updateFastPathFlags();
          }
        }
    }

    // TODO: Page in/out logic
  }

  // --- Pages in and out ROM/RAM into the lower 16K, if requested so
  afterOpcodeFetch(): void {
    // --- Delayed page in
    if (this._requestAutomapOn) {
      this._autoMapActive = true;
      this._requestAutomapOn = false;
      this.machine.memoryDevice.updateFastPathFlags();
    }

    // --- Delayed page out
    if (this._requestAutomapOff) {
      this._autoMapActive = false;
      this._requestAutomapOff = false;
      this.machine.memoryDevice.updateFastPathFlags();
    }
  }
}

type TrapInfo = {
  enabled: boolean;
  onlyWithRom3: boolean;
  instantMapping: boolean;
};
