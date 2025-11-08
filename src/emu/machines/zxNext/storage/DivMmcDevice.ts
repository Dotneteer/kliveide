import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";
import type { IDivMmcDevice } from "./IDivMmcDevice";

/**
 * Implements the DivIDE/DIVMMC interface
 */
export class DivMmc implements IDivMmcDevice {
  private _divifaceEnabled: boolean;
  private _divMmcPortsEnabled: boolean;
  private _divifaceControlRegister: number;
  private _conMem = false;
  private _mapRam = false;
  private _bank0 = false;
  private _bank1 = false;

  /**
   * Initialize the floating port device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public readonly machine: IZxNextMachine) {}

  /**
   * Dispose the resources held by the device
   */
  dispose(): void {}

  /**
   * Initializes the DivIDE/DIVMMC interface
   */
  reset(): void {
    this._divifaceControlRegister &= 0x3f;
    this.activeAutoPaging = false;
  }

  /**
   * Enables or disables the DivIDE/DIVMMC interface
   * @param enabled
   */
  enableDiviface(enabled: boolean): void {
    this._divifaceEnabled = enabled;
  }

  /**
   * Gets the DivIDE/DIVMMC interface enabled/disabled state
   */
  get divifaceEnabled(): boolean {
    return this._divifaceEnabled;
  }

  /**
   * Enables or disables the DivMMC ports
   * @param enabled
   */
  enableDivMmcPorts(enabled: boolean): void {
    this._divMmcPortsEnabled = enabled;
  }

  /**
   * Gets the DivMMC ports enabled/disabled state
   */
  get divMmcPortsEnabled(): boolean {
    return this._divMmcPortsEnabled;
  }

  /*
   * Gets the automatic paging allowed/disallowed state
   */
  automaticPagingAllowed: boolean;

  /**
   * Gets the active auto-paging state
   */
  activeAutoPaging: boolean;

  /**
   * Gets the state of the jumper that allows writing to the EPROM
   * Note: this implementation does not support writing to the EPROM
   */
  readonly epromWriteJumper = false;

  /**
   * Writes the Diviface control register
   * @param value
   */
  writeControlRegister(value: number): void {
    value = value & 0xff;
    if (this.mapRam) {
      this._divifaceControlRegister = value | 0x40;
    }
    this._conMem = !!(value & 0x80);
    this._mapRam = !!(value & 0x40);
    this._bank0 = !!(value & 0x01);
    this._bank1 = !!(value & 0x02);
  }

  /**
   * Reads the Diviface control register
   */
  readControlRegister(): number {
    return this._divifaceControlRegister;
  }

  /**
   * Gets the CONMEM bit of the control register
   */
  get conMem(): boolean {
    return this._conMem;
  }

  /**
   * Gets the MAPRAM bit of the control register
   */
  get mapRam(): boolean {
    return this._mapRam;
  }

  /**
   * Gets the BANK0 bit of the control register
   */
  get bank0(): boolean {
    return this._bank0;
  }

  /**
   * Gets the BANK1 bit of the control register
   */
  get bank1(): boolean {
    return this._bank1;
  }

  /**
   * Hook for executing code before fetching a Z80 opcode
   */
  willFetchOpcode(): void {
    throw new Error("Method not implemented.");
  }

  /**
   * Hook for executing code after fetching a Z80 opcode
   */
  didFetchOpcode(): void {
    throw new Error("Method not implemented.");
  }
}
