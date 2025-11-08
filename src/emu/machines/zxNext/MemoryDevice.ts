import { toHexa2, toHexa6 } from "@common/utils/conversions";
import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export const OFFS_NEXT_ROM = 0x00_0000;
export const OFFS_DIVMMC_ROM = 0x01_0000;
export const OFFS_MULTIFACE_MEM = 0x01_4000;
export const OFFS_ALT_ROM_0 = 0x01_8000;
export const OFFS_ALT_ROM_1 = 0x01_c000;
export const OFFS_DIVMMC_RAM = 0x02_0000;
export const OFFS_DIVMMC_RAM_BANK_3 = 0x02_0000 + 3 * 0x2000;
export const OFFS_NEXT_RAM = 0x04_0000;
export const OFFS_ERR_PAGE = 2048 * 1024;

/**
 * Memory information about a 8K page
 */
export type MemoryPageInfo = {
  readOffset: number;
  writeOffset: number | null;
  bank16k?: number;
  bank8k?: number;
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

  enableAltRom: boolean;
  altRomVisibleOnlyForWrites: boolean;
  lockRom1: boolean;
  lockRom0: boolean;
  reg8CLowNibble: number;
  configRomRamBank: number;
  mappingMode: number;

  readonly mmuRegs = new Uint8Array(0x08);

  private _wasInAllRamMode = false;

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
    for (let i = 0; i < 8; i++) {
      this.pageInfo.push({
        readOffset: OFFS_ERR_PAGE,
        writeOffset: null,
        bank16k: 0xff,
        bank8k: 0xff
      });
    }
    this.memory = new Uint8Array(2048 * 1024 + 0x2000);

    // --- The last 8K represents the invalid page, where the corresponding MMU register's value is mapped
    // --- to non-existing memory
    for (let i = OFFS_ERR_PAGE; i < OFFS_ERR_PAGE + 0x2000; i++) {
      this.memory[i] = 0x7e;
    }
    this.reset();
  }

  reset(): void {
    this._wasInAllRamMode = true;
    this.selectedRomLsb = 0;
    this.selectedRomMsb = 0;
    this.selectedBankLsb = 0;
    this.selectedBankMsb = 0;

    this.pagingEnabled = true;
    this.useShadowScreen = false;
    this.allRamMode = false;
    this.specialConfig = 0;

    this.enableAltRom = false;
    this.altRomVisibleOnlyForWrites = false;
    this.lockRom1 = false;
    this.lockRom0 = false;
    this.reg8CLowNibble = 0;
    this.configRomRamBank = 0;
    this.mappingMode = 0;

    // --- Default MMU register values
    this.mmuRegs[0] = 0xff;
    this.mmuRegs[1] = 0xff;
    this.mmuRegs[2] = 0x0a;
    this.mmuRegs[3] = 0x0b;
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
   * @param readOffset Memory offset for reading the page
   * @param bank8k 8K bank number
   * @param contended Contended memory?
   * @param readerFn Optional memory reader function
   * @param writerFn Optional memory writer function (if not specified, the memory is read-only)
   */
  setPageInfo(
    pageIndex: number,
    readOffset: number,
    writeOffset: number | null,
    bank16k: number,
    bank8k: number
  ) {
    if (pageIndex < 0 || pageIndex > 7) {
      throw new Error(`Invalid page index ${pageIndex}`);
    }
    this.pageInfo[pageIndex] = {
      readOffset,
      writeOffset,
      bank16k,
      bank8k
    };
  }

  getPageInfo(pageIndex: number): MemoryPageInfo {
    if (pageIndex < 0 || pageIndex > 7) {
      throw new Error(`Invalid page index ${pageIndex}`);
    }
    return this.pageInfo[pageIndex];
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory(address: number): number {
    address &= 0xffff;
    const page = address >>> 13;
    const slot = page >>> 1;
    const offset = address & 0x1fff;

    // --- Use MMU by default (unless overridden with a higher priority memory decoding)
    let readOffset = this.pageInfo[page].readOffset;
    if (slot === 0x00) {
      // --- 0x0000-0x3fff: area
      // --- #0: bootrom (ignored)

      // --- #1: Multiface
      let multifaceEnabled = false;
      if (multifaceEnabled) {
        // TODO: Read from Multiface memory
        return 0x00;
      }

      // --- #2: DivMMC
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        readOffset = page ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000 : OFFS_DIVMMC_ROM;
      } else if (divMmcDevice.autoMapActive) {
        readOffset = divMmcDevice.mapram
          ? page
            ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000
            : OFFS_DIVMMC_RAM_BANK_3
          : page
            ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000
            : OFFS_DIVMMC_ROM;
      } else {
        // --- #3: Layer 2 mapping
        const layer2Mapping = false;
        if (layer2Mapping) {
          // TODO: Read from layer2 memory
          return 0x00;
        }

        // --- #4: MMU
        // --- #5: Config (ignored)
        // --- #6: ROMCS expansion bus (ignored)
        // --- #7: ROM
      }
    } else if (slot < 3) {
      // --- 0x4000-0xbfff: area
      // --- #1: layer 2 mapping
      const layer2Mapping = false;
      if (layer2Mapping) {
        // TODO: Read from layer2 memory
        return 0x00;
      }
      // --- #2: mmu
    }

    // --- Return the memory content
    return this.memory[readOffset + offset];
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory(address: number, data: number): void {
    address &= 0xffff;
    const page = address >>> 13;
    const slot = page >>> 1;
    const offset = address & 0x1fff;

    // --- Use MMU by default (unless overridden with a higher priority memory decoding)
    let writeOffset = this.pageInfo[page].writeOffset;
    if (slot === 0x00) {
      // --- 0x0000-0x3fff: area
      // --- #0: bootrom (ignored)

      // --- #1: Multiface
      let multifaceEnabled = false;
      if (multifaceEnabled) {
        // TODO: Write to Multiface memory
        return;
      }

      // --- #2: DivMMC
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        // --- Page 0 is read-only
        if (!page) return;
        writeOffset = OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000;
      } else if (divMmcDevice.autoMapActive) {
        // --- Page 0 is read-only, MAPRAM disables write
        if (!page || (divMmcDevice.mapram && divMmcDevice.bank === 3)) return;
        writeOffset = OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000
      } else {
        // --- #3: Layer 2 mapping
        const layer2Mapping = false;
        if (layer2Mapping) {
          // TODO: Write to layer2 memory
          return;
        }

        // --- #4: MMU
        // --- #5: Config (ignored)
        // --- #6: ROMCS expansion bus (ignored)
        // --- #7: ROM
      }
    } else if (slot < 3) {
      // --- 0x4000-0xbfff: area
      // --- #1: layer 2 mapping
      const layer2Mapping = false;
      if (layer2Mapping) {
        // TODO: Write to layer2 memory
        return;
      }
      // --- #2: mmu
    }

    // --- Write the memory content
    if (writeOffset === null || writeOffset === OFFS_ERR_PAGE) {
      return;
    }
    this.memory[writeOffset + offset] = data;
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

  get port1ffdValue(): number {
    return (this.allRamMode ? 0x01 : 0x00) | (this.specialConfig << 1);
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

  get port7ffdValue(): number {
    return (
      this.selectedBankLsb |
      (this.useShadowScreen ? 0x08 : 0x00) |
      (this.selectedRomLsb << 4) |
      (this.pagingEnabled ? 0x00 : 0x20)
    );
  }

  /**
   * Updates the memory configuration based on the new 0x7ffd port value
   */
  set port7ffdValue(value: number) {
    // --- Port value has changed; abort if paging is not enabled
    if (!this.pagingEnabled) return;

    // --- Update port value changes
    const newBank16k = (this.selectedBankLsb = value & 0x07);
    this.mmuRegs[6] = this.selectedBankMsb * 8 + newBank16k * 2;
    this.mmuRegs[7] = this.mmuRegs[6] + 1;
    this.useShadowScreen = !!((value >> 3) & 0x01);
    this.machine.screenDevice.ulaScreenStartOffset = this.getUlaScreenOffset(this.useShadowScreen);
    this.selectedRomLsb = (value >> 4) & 0x01;
    this.pagingEnabled = !(value & 0x20);
    this.updateMemoryConfig();
  }

  getUlaScreenOffset(shadowScreen: boolean): number {
    return OFFS_NEXT_RAM + (shadowScreen ? 0x07 : 0x05) * 0x4000;
  }

  get portDffdValue(): number {
    return this.selectedBankMsb;
  }

  /**
   * Updates the memory configuration based on the new 0xdffd port value
   */
  set portDffdValue(value: number) {
    this.selectedBankMsb = value & 0x0f;
    this.mmuRegs[6] = this.selectedBankMsb * 8 + this.selectedBankLsb * 2;
    this.mmuRegs[7] = this.mmuRegs[6] + 1;
    this.updateMemoryConfig();
  }

  /**
   * Gets the value of the specified MMU register
   * @param index MMU register index
   */
  getNextRegMmuValue(index: number): number {
    return this.mmuRegs[index & 0x07];
  }

  /**
   * Sets the value of the specified MMU register
   * @param index MMU register index
   * @param value Value to set
   */
  setNextRegMmuValue(index: number, value: number): void {
    this.mmuRegs[index & 0x07] = value;
    this.updateMemoryConfig();
  }

  /**
   * Gets the value to be read from the Next register $8C
   */
  get nextReg8CValue(): number {
    return (
      (this.enableAltRom ? 0x80 : 0x00) |
      (this.altRomVisibleOnlyForWrites ? 0x40 : 0x00) |
      (this.lockRom1 ? 0x20 : 0x00) |
      (this.lockRom0 ? 0x10 : 0x00) |
      (this.reg8CLowNibble & 0x0f)
    );
  }

  /**
   * Sets the value of the Next register $8C
   * @param value Value to set
   */
  set nextReg8CValue(value: number) {
    this.enableAltRom = (value & 0x80) !== 0;
    this.altRomVisibleOnlyForWrites = (value & 0x40) !== 0;
    this.lockRom1 = (value & 0x20) !== 0;
    this.lockRom0 = (value & 0x10) !== 0;
    this.reg8CLowNibble = value & 0x0f;
    this.updateMemoryConfig();
  }

  /**
   * Gets the value to be read from the Next register $8E
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

  /**
   * Sets the value of the Next register $8E
   */
  set nextReg8EValue(value: number) {
    // --- Bit 3 indicates
    if (value & 0x08) {
      // --- Change RAM bank, MMU6, and MMU7
      this.selectedBankMsb = (value & 0x80) >> 7;
      this.selectedBankLsb = (value >> 4) & 0x07;
      this.mmuRegs[6] = (this.selectedBankMsb << 4) | (this.selectedBankLsb << 1);
      this.mmuRegs[7] = this.mmuRegs[6] + 1;
    }

    // --- Set the AllRAM flag
    this.allRamMode = (value & 0x04) !== 0;
    if (this.allRamMode) {
      this.specialConfig = value & 0x03;
    } else {
      this.selectedRomMsb = value & 0x02;
      this.selectedRomLsb = value & 0x01;
    }

    this.updateMemoryConfig();
  }

  /**
   * Gets the value to be read from the Next register $8F
   */
  get nextReg8FValue(): number {
    return this.mappingMode;
  }

  /**
   * Sets the value of the Next register $8F
   */
  set nextReg8FValue(value: number) {
    this.mappingMode = value & 0x03;
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array {
    const flat64 = new Uint8Array(0x1_0000);
    for (let i = 0; i < 0x1_0000; i++) {
      flat64[i] = this.readMemory(i);
    }
    return flat64;
  }

  /**
   * Get the specified 16K partition of memory
   * @param index Partition index
   * @returns Bytes of the partition
   *
   * < 0 : ROM pages
   * >= 0: RAM bank with the specified index
   */
  getMemoryPartition(index: number): Uint8Array {
    let length = 0x2000;
    let offset = 0;
    if (index >= -4 && index <= -1) {
      length = 0x4000;
      offset = OFFS_NEXT_ROM + 0x4000 * (-index - 1);
    } else if (index === -5) {
      length = 0x4000;
      offset = OFFS_ALT_ROM_0;
    } else if (index === -6) {
      length = 0x4000;
      offset = OFFS_ALT_ROM_1;
    } else if (index === -7) {
      length = 0x2000;
      offset = OFFS_DIVMMC_ROM;
    } else if (index >= -23 && index <= -8) {
      offset = OFFS_DIVMMC_RAM + 0x2000 * (-index - 8);
    } else if (index >= 0 && index < 224) {
      offset = OFFS_NEXT_RAM + 0x2000 * index;      
    }
    const partContent = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      partContent[i] = this.memory[offset + i];
    }
    return partContent;
  }

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getPartitions(): number[] {
    return this.pageInfo.map((b) => b.bank16k);
  }

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getPartitionLabels(): string[] {
    const result: string[] = [];
    for (let i = 0; i < 8; i++) {
      result.push(this.getPartitionLabelForPage(i));
    }
    return result;
  }

  getPartitionLabelForPage(pageIndex: number): string {
    const pageInfo = this.pageInfo[pageIndex & 0x07];
    if (pageInfo.bank16k < 224) {
      return toHexa2(pageInfo.bank16k);
    }
    let offs = pageInfo.readOffset;
    if (offs < OFFS_DIVMMC_ROM) {
      return `R${(offs - OFFS_NEXT_ROM) >> 14}`;
    }
    if (offs >= OFFS_ALT_ROM_0 && offs < OFFS_ALT_ROM_1) {
      return `A0`;
    }
    if (offs >= OFFS_ALT_ROM_1 && offs < OFFS_DIVMMC_RAM) {
      return `A1`;
    }
    if (offs >= OFFS_DIVMMC_ROM && offs < OFFS_MULTIFACE_MEM) {
      return `DM`;
    }
    if (pageIndex) {
      if (offs >= OFFS_DIVMMC_RAM && offs < OFFS_NEXT_RAM) {
        return `D${(offs - OFFS_DIVMMC_RAM) >> 13}`;
      }
    }
    return `UN`;
  }

  /**
   * Get value directly from the physical memory
   * @param index Absoulte memory address
   * @returns Memory value
   */
  directRead(index: number): number {
    return this.memory[index];
  }

  /**
   * Set value directly into the physical memory
   * @param index Absolute memory address
   * @param value Value to set
   */
  directWrite(index: number, value: number): void {
    this.memory[index] = value;
  }

  logStatus(): void {
    for (let i = 0; i < 8; i++) {
      const page = this.pageInfo[i];
      console.log(
        `Page ${i}: ${toHexa2(page.bank16k)} ${toHexa2(page.bank8k)} | ${toHexa6(page.readOffset)}`
      );
    }
  }

  /**
   * Updates the memory configuration based on the current settings
   */
  updateMemoryConfig(): void {
    if (this.allRamMode) {
      // --- All RAM page setup
      this._wasInAllRamMode = true;

      switch (this.specialConfig) {
        case 0:
          this.setRamSlotAndMmu(0, 0);
          this.setRamSlotAndMmu(1, 1);
          this.setRamSlotAndMmu(2, 2);
          this.setRamSlotAndMmu(3, 3);
          break;
        case 1:
          // --- 0x01: 16K RAM at 0x0000, 8K RAM at 0x4000, 8K RAM at 0x6000
          this.setRamSlotAndMmu(0, 4);
          this.setRamSlotAndMmu(1, 5);
          this.setRamSlotAndMmu(2, 6);
          this.setRamSlotAndMmu(3, 7);
          break;
        case 2:
          // --- 0x10: 16K RAM at 0x0000, 8K RAM at 0x4000, 8K RAM at 0x8000
          this.setRamSlotAndMmu(0, 4);
          this.setRamSlotAndMmu(1, 5);
          this.setRamSlotAndMmu(2, 6);
          this.setRamSlotAndMmu(3, 3);
          break;
        case 3:
          // --- 0x11: 16K RAM at 0x0000, 16K RAM at 0x4000
          this.setRamSlotAndMmu(0, 4);
          this.setRamSlotAndMmu(1, 7);
          this.setRamSlotAndMmu(2, 6);
          this.setRamSlotAndMmu(3, 3);
          break;
      }
      return;
    } else {
      if (this._wasInAllRamMode) {
        // --- Restore the original configuration
        this.mmuRegs[0] = 0xff;
        this.mmuRegs[1] = 0xff;
        this.mmuRegs[2] = 0x10;
        this.mmuRegs[3] = 0x11;
        this.mmuRegs[4] = 0x04;
        this.mmuRegs[5] = 0x05;
        this.mmuRegs[6] = 0x00;
        this.mmuRegs[7] = 0x01;
        this._wasInAllRamMode = false;
      }

      // --- Normal mode page setup
      if (!this.machine.divMmcDevice?.conmem) {
        this.setRomSlotByMmu(0);
        this.setRomSlotByMmu(1);
      }

      this.setRamSlotByMmu(2);
      this.setRamSlotByMmu(3);
      this.setRamSlotByMmu(4);
      this.setRamSlotByMmu(5);
      this.setRamSlotByMmu(6);
      this.setRamSlotByMmu(7);
    }
  }

  getMemoryMappings() {
    const divMmc = this.machine.divMmcDevice;
    return {
      allRamBanks: this.getAllRamMappings(),
      selectedRom: this.selectedRomMsb + this.selectedRomLsb,
      selectedBank: this.selectedBankMsb + this.selectedBankLsb,
      port7ffd: this.port7ffdValue,
      port1ffd: this.port1ffdValue,
      portDffd: this.portDffdValue,
      portEff7: 0x00,
      portLayer2: 0x00,
      portTimex: 0x00,
      divMmc: divMmc.port0xe3Value,
      divMmcIn: divMmc.conmem || divMmc.autoMapActive,
      pageInfo: this.pageInfo
    };
  }

  getAllRamMappings(): number[] | undefined {
    if (this.allRamMode) {
      switch (this.specialConfig) {
        case 0:
          return [0, 1, 2, 3];
        case 1:
          return [4, 5, 6, 7];
        case 2:
          return [4, 5, 6, 3];
        case 3:
          return [4, 7, 6, 3];
      }
    }
    return undefined;
  }

  /**
   * Sets the specified 16K memory slot to the specified 16K bank
   * @param slotNo
   * @param bank16k
   */
  private setRamSlotAndMmu(slotNo: number, bank16k: number): void {
    let bank8k = bank16k * 2;
    if (bank8k >= this.maxPages) {
      this.setPageInfo(slotNo * 2, OFFS_ERR_PAGE, null, bank16k, bank8k);
    } else {
      let offset = OFFS_NEXT_RAM + bank8k * 0x2000;
      this.setPageInfo(slotNo * 2, offset, offset, bank16k, bank8k);
    }
    bank8k++;
    if (bank8k >= this.maxPages) {
      this.setPageInfo(slotNo * 2 + 1, OFFS_ERR_PAGE, null, bank16k, bank8k);
    } else {
      let offset = OFFS_NEXT_RAM + bank8k * 0x2000;
      this.setPageInfo(slotNo * 2 + 1, offset, offset, bank16k, bank8k);
    }
  }

  private setRamSlotByMmu(pageNo: number): void {
    const bank8k = this.mmuRegs[pageNo];
    if (bank8k >= this.maxPages) {
      this.setPageInfo(pageNo, OFFS_ERR_PAGE, null, bank8k >> 1, bank8k);
    } else {
      let offset = OFFS_NEXT_RAM + bank8k * 0x2000;
      this.setPageInfo(pageNo, offset, offset, bank8k >> 1, bank8k);
    }
  }

  private setRomSlotByMmu(slotNo: number): void {
    slotNo = slotNo & 0x01;
    const romPage = this.selectedRomMsb | this.selectedRomLsb;
    const slotIndex = romPage * 2 + slotNo;
    const bank8k = this.mmuRegs[slotNo];
    if (bank8k !== 0xff) {
      // --- It is not a ROM, uset the MMU reg value
      this.setRamSlotByMmu(slotNo);
      return;
    }

    // --- It is a ROM, use the specified page number
    const romOffs = OFFS_NEXT_ROM + slotIndex * 0x2000;
    const altRomOffs = this.getAltRomOffset() + slotNo * 0x2000;
    if (this.enableAltRom) {
      if (this.altRomVisibleOnlyForWrites) {
        const page =
          !this.lockRom0 && !this.lockRom1
            ? this.selectedRomMsb + this.selectedRomLsb
            : (this.lockRom1 ? 2 : 0) + (this.lockRom0 ? 1 : 0);
        this.setPageInfo(
          slotNo,
          OFFS_NEXT_ROM + page * 0x4000 + slotNo * 0x2000,
          altRomOffs,
          0xff,
          0xff
        );
      } else {
        this.setPageInfo(slotNo, altRomOffs, null, 0xff, 0xff);
      }
    } else {
      this.setPageInfo(slotNo, romOffs, null, 0xff, 0xff);
    }
  }

  private getAltRomOffset(): number {
    return this.lockRom1
      ? OFFS_ALT_ROM_1
      : this.lockRom0
        ? OFFS_ALT_ROM_0
        : this.selectedRomLsb
          ? OFFS_ALT_ROM_1
          : OFFS_ALT_ROM_0;
  }

  /**
   * Gets the offset of the Layer 2 memory according to the current configuration
   */
  private getLayer2MemoryOffset(): number {
    const layer2Device = this.machine.layer2Device;
    let layer2Offset = 0;
    switch (layer2Device.bank) {
      case 0x01:
        layer2Offset = 0x4000;
        break;
      case 0x02:
        layer2Offset = 0x8000;
        break;
    }
    const ramBank = layer2Device.useShadowScreen
      ? layer2Device.shadowRamBank
      : layer2Device.activeRamBank;
    return OFFS_NEXT_RAM + ramBank * 0x4000 + layer2Device.bankOffset * 0x4000 + layer2Offset;
  }
}
