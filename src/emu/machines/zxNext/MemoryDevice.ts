import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export const OFFS_NEXT_ROM = 0x00_0000;
export const OFFS_DIVMMC_ROM = 0x01_0000;
export const OFFS_MULTIFACE_MEM = 0x01_4000;
export const OFFS_ALT_ROM_0 = 0x01_8000;
export const OFFS_ALT_ROM_1 = 0x01_c000;
export const OFFS_DIVMMC_RAM = 0x02_0000;
export const OFFS_NEXT_RAM = 0x40_0000;
export const OFFS_ERR_PAGE = 2048 * 1024;

/**
 * Memory information about a 8K page
 */
export type MemoryPageInfo = {
  offset: number;
  bank16k?: number;
  bank8k?: number;
  isReadOnly?: boolean;
  contended?: boolean;
};

/**
 * This class implements a handler for TbBlue memory
 */
export class MemoryDevice implements IGenericDevice<IZxNextMachine> {
  pageInfo: MemoryPageInfo[];
  maxPages: number;
  memory: Uint8Array;

  selectedRomLsb: number;
  selectedRomMsb: number;
  selectedBankLsb: number;
  selectedBankMsb: number;

  pagingEnabled: boolean;
  useShadowScreen: boolean;
  allRamMode: boolean;
  specialConfig: number;

  readonly mmuRegs = new Uint8Array(0x08);

  /**
   * Initializes the memory
   * @param totalMemInKb Total memory size in KB
   */
  constructor(
    public readonly machine: IZxNextMachine,
    totalMemInKb = 2048
  ) {
    switch (totalMemInKb) {
      case 2048:
        this.maxPages = 224;
        break;
      case 1536:
        this.maxPages = 160;
        break;
      case 1024:
        this.maxPages = 96;
        break;
      case 512:
        this.maxPages = 32;
        break;
      default:
        throw new Error(`Invalid memory size: ${totalMemInKb}KB`);
    }

    // --- Set up memory data (with no pageinfo yet)
    this.pageInfo = [];
    this.memory = new Uint8Array(2048 * 1024 + 0x2000);

    // --- The last 8K represents the invalid page, where the corresponding MMU register's value is mapped
    // --- to non-existing memory
    for (let i = OFFS_ERR_PAGE; i < OFFS_ERR_PAGE + 0x2000; i++) {
      this.memory[i] = 0x7e;
    }

    // --- Init the device flags and values
    this.reset();
  }

  reset(): void {
    this.selectedRomLsb = 0;
    this.selectedRomMsb = 0;
    this.selectedBankLsb = 0;
    this.selectedBankMsb = 0;

    this.pagingEnabled = true;
    this.useShadowScreen = false;
    this.allRamMode = false;
    this.specialConfig = 0;

    // --- Default MMU register values
    this.mmuRegs[0] = 0xff;
    this.mmuRegs[1] = 0xff;
    this.mmuRegs[2] = 0x10;
    this.mmuRegs[3] = 0x11;
    this.mmuRegs[4] = 0x04;
    this.mmuRegs[5] = 0x05;
    this.mmuRegs[6] = 0x00;
    this.mmuRegs[7] = 0x01;

    // --- Set memory pages according to the default configuration
    this.updateMemoryConfig();
  }

  hardReset(): void {}

  dispose(): void {}

  /**
   * Sets the page information for the specified 8K memory page
   * @param pageIndex Page index
   * @param offset Memory offset for the page
   * @param bank8k 8K bank number
   * @param contended Contended memory?
   * @param readerFn Optional memory reader function
   * @param writerFn Optional memory writer function (if not specified, the memory is read-only)
   */
  setPageInfo(
    pageIndex: number,
    offset: number,
    bank16k: number,
    bank8k: number,
    contended: boolean
  ) {
    if (pageIndex < 0 || pageIndex > 7) {
      throw new Error(`Invalid page index ${pageIndex}`);
    }
    this.pageInfo[pageIndex] = {
      offset,
      bank16k,
      bank8k,
      contended
    };
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory(address: number): number {
    address &= 0xffff;
    const pageOffset = address & 0x1fff;
    const pageInfo = this.pageInfo[address >>> 13];
    return this.memory[pageInfo.offset + pageOffset];
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory(address: number, data: number): void {
    address &= 0xffff;
    const pageOffset = address & 0x1fff;
    const pageInfo = this.pageInfo[address >>> 13];
    if (!pageInfo.isReadOnly) {
      this.memory[pageInfo.offset + pageOffset] = data;
    }
  }

  /**
   * Uploads the contents to the specified memory location
   * @param contents Contents to upload
   * @param startOffset Start offset in memory
   */
  upload(contents: Uint8Array, startOffset: number): void {
    for (let i = 0; i < contents.length; i++) {
      this.memory[startOffset + i] = contents[i];
    }
  }

  getBankOffset(bank: number): number {
    return bank << (13 + 0x40_0000);
  }

  /**
   * Updates the memory configuration based on the new 0x1ffd port value
   */
  set port1ffdValue(value: number) {
    this.allRamMode = (value & 0x01) !== 0;
    this.specialConfig = (value >> 1) & 0x03;
    this.selectedRomMsb = this.specialConfig & 0x02;
    this.updateMemoryConfig();
  }

  /**
   * Updates the memory configuration based on the new 0x7ffd port value
   */
  set port7ffdValue(value: number) {
    // --- Port value has changed; abort if paging is not enabled
    if (!this.pagingEnabled) return;

    // --- Update port value changes
    this.selectedBankLsb = value & 0x07;
    this.useShadowScreen = ((value >> 3) & 0x01) == 0x01;
    this.selectedRomLsb = (value >> 4) & 0x01;
    this.pagingEnabled = (value & 0x20) == 0x00;
    this.updateMemoryConfig();
  }

  /**
   * Updates the memory configuration based on the new 0xdffd port value
   */
  set portDffdValue(value: number) {
    this.selectedBankMsb = value & 0x0f;
    this.updateMemoryConfig();
  }

  /**
   * Gets the value to be read from the next register 8E
   */
  get nextReg8EValue(): number {
    return (
      ((this.selectedBankMsb & 0x01) << 7) |
      ((this.selectedBankLsb & 0x07) << 4) |
      0x08 |
      (this.allRamMode ? 0x04 : 0x00) |
      (this.allRamMode ? this.specialConfig & 0x02 : this.selectedRomMsb) |
      (this.allRamMode ? this.specialConfig & 0x01 : this.selectedRomLsb)
    );
  }

  set nextReg8EValue(value: number) {
    // --- Bit 3 indicates
    if (value & 0x08) {
      // --- Change RAM bank, MMU6, and MMU7
      this.selectedBankMsb = (value & 0x0e) | ((value & 0x80) >> 7);
      this.selectedBankLsb = (value >> 4) & 0x07;
      // TODO: Set MMUs
    }

    // --- Set the AllRAM flag
    this.allRamMode = (value & 0x04) !== 0;
    if (this.allRamMode) {
      this.specialConfig = value & 0x03;
    } else {
      this.selectedRomMsb = value & 0x02;
      this.selectedRomLsb = value & 0x01;
    }
  }

  private updateMemoryConfig(): void {
    // TODO: Implement memory configuration changes
  }
}
