import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Interface for the DivIDE/DIVMMC interface
 */
export interface IDivMmcDevice extends IGenericDevice<IZxNextMachine> {
  /**
   * Enables or disables the DivIDE/DIVMMC interface
   * @param enabled
   */
  enableDiviface(enabled: boolean): void;

  /**
   * Gets the DivIDE/DIVMMC interface enabled/disabled state
   */
  readonly divifaceEnabled: boolean;

  /**
   * Enables or disables the DivMMC ports
   * @param enabled
   */
  enableDivMmcPorts(enabled: boolean): void;

  /**
   * Gets the DivMMC ports enabled/disabled state
   */
  readonly divMmcPortsEnabled: boolean;

  /**
   * Gets the state of the jumper that allows writing to the EPROM
   */
  readonly epromWriteJumper: boolean;

  /**
   * Gets the automatic paging allowed/disallowed state
   */
  automaticPagingAllowed: boolean;

  /**
   * Gets the active auto-paging state
   */
  activeAutoPaging: boolean;

  /**
   * Writes the Diviface control register
   * @param value
   */
  writeControlRegister(value: number): void;

  /**
   * Reads the Diviface control register
   */
  readControlRegister(): number;

  /**
   * Gets the CONMEM bit of the control register
   */
  readonly conMem: boolean;

  /**
   * Gets the MAPRAM bit of the control register
   */
  readonly mapRam: boolean;

  /**
   * Gets the BANK0 bit of the control register
   */
  readonly bank0: boolean;

  /**
   * Gets the BANK1 bit of the control register
   */
  readonly bank1: boolean;

  /**
   *  
   */
  willFetchOpcode(): void;

  /**
   * Hook for executing code after fetching a Z80 opcode
   */
  didFetchOpcode(): void;
}
