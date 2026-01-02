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
  private _nmiButtonPressed: boolean; // Track if NMI button is pressed

  readonly rstTraps: TrapInfo[] = [];
  automapOn3dxx: boolean;
  automapOff1ff8: boolean; // Enable automatic unmapping at 0x1FF8-0x1FFF
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

  // Entry point registries for extensibility
  private customEntryPoints: Array<{
    address: number;
    flag: () => boolean;
    requiresRom3: boolean;
    instant: boolean;
  }> = [];

  private rangeEntryPoints: Array<{
    range: { start: number; end: number };
    flag: () => boolean;
    requiresRom3: boolean;
    instant: boolean;
    handler: 'activate' | 'deactivate' | 'autoUnmap1ff8';
  }> = [];

  constructor(public readonly machine: IZxNextMachine) {
    for (let i = 0; i < 8; i++) {
      this.rstTraps.push({ enabled: false, onlyWithRom3: false, instantMapping: false });
    }
    this.initializeEntryPoints();
    this.reset();
  }

  /**
   * Initialize entry point registries for custom and range-based entry points.
   * This allows for easier extension and maintenance of entry point logic.
   */
  private initializeEntryPoints(): void {
    // Custom entry points registry
    this.customEntryPoints = [
      { address: 0x04c6, flag: () => this.automapOn04c6, requiresRom3: true, instant: false },
      { address: 0x0562, flag: () => this.automapOn0562, requiresRom3: true, instant: false },
      { address: 0x04d7, flag: () => this.automapOn04d7, requiresRom3: true, instant: false },
      { address: 0x056a, flag: () => this.automapOn056a, requiresRom3: true, instant: false },
    ];

    // Range entry points registry
    // Note: For 0x1FF8-0x1FFF, the behavior is always to unmap (deactivate), but the mode depends on the flag
    this.rangeEntryPoints = [
      {
        range: { start: 0x3d00, end: 0x3dff },
        flag: () => this.automapOn3dxx,
        requiresRom3: true,
        instant: true,
        handler: 'activate',
      },
      {
        // 0x1FF8-0x1FFF: Always unmaps, but instant if flag is false, delayed if true
        range: { start: 0x1ff8, end: 0x1fff },
        flag: () => true,  // Always enabled (check handled in checkRangeEntryPoints)
        requiresRom3: false,
        instant: false,
        handler: 'autoUnmap1ff8',  // Special handler
      },
    ];
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
    this._nmiButtonPressed = false;
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
      (this.automapOff1ff8 ? 0x40 : 0x00) |
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
    this.automapOff1ff8 = (value & 0x40) !== 0;
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

  /**
   * Checks if ROM 3 is currently paged in (128K +2A/+3 ROM)
   */
  private isRom3PagedIn(): boolean {
    return (
      this.machine.memoryDevice.selectedRomMsb |
      this.machine.memoryDevice.selectedRomLsb
    ) === 0x03;
  }

  /**
   * Checks and applies manual CONMEM control (port 0xE3 bit 7)
   * This works independently of entry points, but still requires enableAutomap
   */
  private checkManualConmem(): void {
    if (!this.enableAutomap) return;

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

  /**
   * Checks RST trap entry points (0x0000, 0x0008, ..., 0x0038)
   */
  private checkRstTraps(pc: number, rom3Present: boolean): void {
    if (pc < 0 || pc > 0x38 || (pc & 0x07) !== 0) return;

    const rstIdx = pc >> 3;
    const trapInfo = this.rstTraps[rstIdx];

    if (!trapInfo.enabled) return;
    if (trapInfo.onlyWithRom3 && !rom3Present) return;

    this.setAutomapRequest(trapInfo.instantMapping);
  }

  /**
   * Checks NMI entry point (0x0066)
   */
  private checkNmiEntry(pc: number): void {
    if (pc !== 0x0066) return;
    if (!this.enableDivMmcNmiByDriveButton) return;
    if (!(this as any)._nmiButtonPressed) return;

    const isInstant = this.automapOn0066;
    const isDelayed = this.automapOn0066Delayed;
    
    // Only activate if at least one mode is enabled
    if (!isInstant && !isDelayed) return;
    
    // Prefer instant mode if both are enabled
    this.setAutomapRequest(isInstant);
  }

  /**
   * Checks custom entry points (0x04C6, 0x0562, 0x04D7, 0x056A)
   */
  private checkCustomEntryPoints(pc: number, rom3Present: boolean): void {
    for (const ep of this.customEntryPoints) {
      if (pc !== ep.address) continue;
      if (!ep.flag()) continue;
      if (ep.requiresRom3 && !rom3Present) continue;

      this.setAutomapRequest(ep.instant);
      return;
    }
  }

  /**
   * Checks range-based entry points (0x3D00-0x3DFF and 0x1FF8-0x1FFF)
   */
  private checkRangeEntryPoints(pc: number, rom3Present: boolean): void {
    for (const ep of this.rangeEntryPoints) {
      if (pc < ep.range.start || pc > ep.range.end) continue;
      if (ep.requiresRom3 && !rom3Present) continue;

      // Special handling for 0x1FF8-0x1FFF auto-unmap
      if (ep.handler === 'autoUnmap1ff8') {
        if (this.automapOff1ff8) {
          // Delayed unmap (request for next instruction)
          this._requestAutomapOff = true;
        } else {
          // Immediate unmap
          this._autoMapActive = false;
          this.machine.memoryDevice.updateFastPathFlags();
        }
      } else if (ep.handler === 'activate') {
        if (!ep.flag()) continue;
        this.setAutomapRequest(ep.instant);
      } else if (ep.handler === 'deactivate') {
        if (!ep.flag()) continue;
        this.setAutomapDeactivateRequest();
      }
      return;
    }
  }

  /**
   * Sets up an automap activation request (instant or delayed)
   */
  private setAutomapRequest(instant: boolean, forceInstant: boolean = false): void {
    if (instant || forceInstant) {
      this._autoMapActive = true;
      this._requestAutomapOn = false;
    } else {
      this._requestAutomapOn = true;
    }
  }

  /**
   * Sets up an automap deactivation request
   */
  private setAutomapDeactivateRequest(): void {
    this._requestAutomapOff = true;
  }

  /**
   * Applies all automap state changes with a single memory update
   */
  private applyAutomapStateChanges(): void {
    // Batch all memory updates in one place
    if (this._autoMapActive || this._requestAutomapOn) {
      this.machine.memoryDevice.updateFastPathFlags();
    }
  }

  /**
   * Clears automap and conmem state when RETN is detected
   * This is called from the test machine when RETN is detected
   */
  handleRetnExecution(): void {
    this._autoMapActive = false;
    this._conmemActivated = false;
    this._conmem = false;
    this._portLastE3Value = this._portLastE3Value & 0x7f; // Clear bit 7 (conmem)
    this.machine.memoryDevice.updateFastPathFlags();
  }

  /**
   * Detects if the last instruction executed was RETN (0xED 0x45)
   * If detected, clears automap and conmem flags
   */
  private checkAndHandleRetn(): void {
    if (this.machine.retnExecuted) {
      this.handleRetnExecution();
    }
  }

  // --- Pages in ROM/RAM into the lower 16K, if requested so
  beforeOpcodeFetch(): void {
    const pc = this.machine.pc;

    // --- Check manual conmem control via helper method
    this.checkManualConmem();

    if (!this.enableAutomap) {
      // --- No page in/out if automap is disabled
      return;
    }

    const rom3Present = this.isRom3PagedIn();

    // --- Check all entry points
    this.checkRstTraps(pc, rom3Present);
    this.checkNmiEntry(pc);
    this.checkCustomEntryPoints(pc, rom3Present);
    this.checkRangeEntryPoints(pc, rom3Present);

    // --- Apply all state changes
    this.applyAutomapStateChanges();
  }

  // --- Pages in and out ROM/RAM into the lower 16K, if requested so
  afterOpcodeFetch(): void {
    // --- Check for RETN instruction (0xED 0x45) - unmaps DivMMC
    this.checkAndHandleRetn();

    // --- Process delayed automap requests
    this.processDelayedAutomapRequests();
  }

  /**
   * Processes any delayed automap activation or deactivation requests
   */
  private processDelayedAutomapRequests(): void {
    if (this._requestAutomapOn) {
      this._autoMapActive = true;
      this._requestAutomapOn = false;
      this.machine.memoryDevice.updateFastPathFlags();
    } else if (this._requestAutomapOff) {
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
