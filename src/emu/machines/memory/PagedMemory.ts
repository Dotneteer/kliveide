/**
 * Memory information about a 8K page
 */
export type MemoryBankInfo = {
  offset: number;
  partition?: number;
  isReadOnly: boolean;
};

/**
 * This class implements a handler for paged memory
 */
export class PagedMemory {
  bankData: MemoryBankInfo[];
  memory: Uint8Array;

  constructor (
    // --- Number of ROMS
    public readonly numRoms: number,
    // --- Number of banks
    public readonly numBanks: number
  ) {
    if (numRoms < 0 || numRoms > 256) {
      throw new Error(`Invalid number of ROMs ${numRoms}`);
    }
    if (numBanks < 0 || numBanks > 256) {
      throw new Error(`Invalid number of Banks ${numRoms}`);
    }
    if (numRoms + numBanks > 256) {
      throw new Error(`Too many banks and ROMS ${numBanks + numRoms}`);
    }

    // --- Set up memory data
    this.bankData = [];
    this.memory = new Uint8Array(0x4000 * (numBanks + numRoms));
  }

  /**
   * Resets the memory to the specified data byte
   * @param dataByte Reset value
   */
  reset (dataByte = 0): void {
    for (let i = 0; i < this.memory.length; i++) {
      this.memory[i] = dataByte;
    }
  }

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getPartitions(): number[] {
    return this.bankData.map((b) => b.partition);
  }

  /**
   * Sets the page information for the specified 8K memory page
   * @param pageIndex Page index
   * @param offset Memory offset for the page
   * @param partition Partition ID of the page
   * @param isReadOnly Read only memory?
   */
  setPageInfo (
    pageIndex: number,
    offset: number,
    partition: number | undefined,
    isReadOnly: boolean
  ) {
    if (pageIndex < 0 || pageIndex > 7) {
      throw new Error(`Invalid page index ${pageIndex}`);
    }
    this.bankData[pageIndex] = {
      offset,
      partition,
      isReadOnly
    };
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory (address: number): number {
    address &= 0xffff;
    const pageOffset = address & 0x1fff;
    const pageInfo = this.bankData[address >>> 13];
    return this.memory[pageInfo.offset + pageOffset];
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory (address: number, data: number): void {
    address &= 0xffff;
    const pageOffset = address & 0x1fff;
    const pageInfo = this.bankData[address >>> 13];
    if (!pageInfo.isReadOnly) {
      this.memory[pageInfo.offset + pageOffset] = data;
    }
  }

  /**
   * Gets the offset of the specified partition
   * @param partition ROM index (from 0 to numRoms)
   */
  getPartitionOffset (partition: number): number {
    return partition < 0
      ? (-partition - 1) * 0x4000
      : (this.numRoms + partition) * 0x4000;
  }

  /**
   * Gets the current partition of the specified 16-bit address
   * @param address
   */
  getAddressPartition (address: number): number | undefined {
    return this.bankData[(address & 0xffff) >> 13].partition;
  }

  /**
   * Copies the specified data into the flat memory
   * @param offset Start offset
   * @param data Data to copy
   */
  rawCopy (offset: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.memory[offset + i] = data[i];
    }
  }

  /**
   * Resets the specified partition with the provided data byte
   * @param partition Partition ID
   * @param data Data byte to use
   */
  resetPartition (partition: number, data = 0): void {
    const pageOffs = this.getPartitionOffset(partition);
    for (let i = 0; i < 0x4000; i++) {
      this.memory[pageOffs + i] = data;
    }
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    const flat64 = new Uint8Array(0x1_0000);
    const page0Offs = this.getPartitionOffset(this.bankData[0].partition);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0x0000] = this.memory[page0Offs + i];
    }
    const page1Offs = this.getPartitionOffset(this.bankData[2].partition);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0x4000] = this.memory[page1Offs + i];
    }
    const page2Offs = this.getPartitionOffset(this.bankData[4].partition);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0x8000] = this.memory[page2Offs + i];
    }
    const page3Offs = this.getPartitionOffset(this.bankData[6].partition);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0xc000] = this.memory[page3Offs + i];
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
  get16KPartition (index: number): Uint8Array {
    const flat16 = new Uint8Array(0x1_0000);
    const pageOffs = this.getPartitionOffset(index);
    for (let i = 0; i < 0x4000; i++) {
      flat16[i + 0x0000] = this.memory[pageOffs + i];
    }
    return flat16;
  }

  /**
   * Get value directly from the physical memory
   * @param index Absoulte memory address
   * @returns Memory value
   */
  directRead (index: number): number {
    return this.memory[index];
  }

  /**
   * Set value directly into the physical memory
   * @param index Absolute memory address
   * @param value Value to set
   */
  directWrite (index: number, value: number): void {
    this.memory[index] = value;
  }
}
