import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { toHexa2, toHexa6 } from "@renderer/appIde/services/ide-commands";

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
  bank8kLookup: Uint8Array;
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

  // --- Fast path optimization flags
  private _divMmcActive = false;
  private _layer2ReadActive = false;
  private _layer2WriteActive = false;
  private _useFastPath = true;

  // --- Layer 2 lookup tables (Priority 2 optimization)
  // 64KB lookup tables: Z80 address → SRAM offset (or -1 if not mapped)
  private _layer2ReadMap = new Int32Array(0x10000);
  private _layer2WriteMap = new Int32Array(0x10000);

  // --- Specialized slot readers/writers (Priority 4 optimization)
  // Function pointers for optimized memory access per slot
  private _readSlot0: (address: number) => number;
  private _readSlot1: (address: number) => number;
  private _readSlot2: (address: number) => number;
  private _readSlot3: (address: number) => number;
  private _writeSlot0: (address: number, data: number) => void;
  private _writeSlot1: (address: number, data: number) => void;
  private _writeSlot2: (address: number, data: number) => void;
  private _writeSlot3: (address: number, data: number) => void;

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
    this.bank8kLookup = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      this.pageInfo.push({
        readOffset: OFFS_ERR_PAGE,
        writeOffset: null,
        bank16k: 0xff,
        bank8k: 0xff
      });
      this.bank8kLookup[i] = 0xff;
    }
    this.memory = new Uint8Array(2048 * 1024 + 0x2000);

    // --- The last 8K represents the invalid page, where the corresponding MMU register's value is mapped
    // --- to non-existing memory
    for (let i = OFFS_ERR_PAGE; i < OFFS_ERR_PAGE + 0x2000; i++) {
      this.memory[i] = 0x7e;
    }
    
    // --- Initialize Layer 2 lookup tables with "not mapped" sentinel
    this._layer2ReadMap.fill(-1);
    this._layer2WriteMap.fill(-1);
    
    // --- Initialize slot function pointers to simple versions
    this._readSlot0 = this._readSlot0Simple.bind(this);
    this._readSlot1 = this._readSlot1Simple.bind(this);
    this._readSlot2 = this._readSlot2Simple.bind(this);
    this._readSlot3 = this._readSlot3Simple.bind(this);
    this._writeSlot0 = this._writeSlot0Simple.bind(this);
    this._writeSlot1 = this._writeSlot1Simple.bind(this);
    this._writeSlot2 = this._writeSlot2Simple.bind(this);
    this._writeSlot3 = this._writeSlot3Simple.bind(this);
    
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
    this.updateFastPathFlags();
  }

  hardReset(): void {}

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
    this.bank8kLookup[pageIndex] = bank8k;
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
    const slot = address >>> 14;
    
    // --- Dispatch to specialized slot reader
    switch (slot) {
      case 0: return this._readSlot0(address);
      case 1: return this._readSlot1(address);
      case 2: return this._readSlot2(address);
      case 3: return this._readSlot3(address);
    }
    return 0; // Should never reach here
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory(address: number, data: number): void {
    address &= 0xffff;
    const slot = address >>> 14;
    
    // --- Dispatch to specialized slot writer
    switch (slot) {
      case 0: this._writeSlot0(address, data); return;
      case 1: this._writeSlot1(address, data); return;
      case 2: this._writeSlot2(address, data); return;
      case 3: this._writeSlot3(address, data); return;
    }
  }

  /**
   * Reads a byte from the screen memory area
   * @param offset Screen memory offset
   * @returns Byte value read from screen memory
   */
  readScreenMemory(offset: number): number {
    const address = (this.useShadowScreen ? 0x07 : 0x05) * 0x4000 + (offset & 0x3fff);
    return this.memory[OFFS_NEXT_RAM + address];
  }

  /**
   * Writes a byte to the screen memory area
   * @param offset Screen memory offset
   * @param data Data byte to write
   */
  writeScreenMemory(offset: number, data: number): void { 
    const address = (this.useShadowScreen ? 0x07 : 0x05) * 0x4000 + (offset & 0x3fff);  
    this.memory[OFFS_NEXT_RAM + address] = data;
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
    this.selectedRomLsb = (value >> 4) & 0x01;
    this.pagingEnabled = !(value & 0x20);
    this.updateMemoryConfig();
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
   * Updates fast path flags based on current device states
   * Call this whenever DivMMC or Layer 2 state changes
   */
  updateFastPathFlags(): void {
    const divMmc = this.machine.divMmcDevice;
    this._divMmcActive = divMmc?.conmem || divMmc?.autoMapActive || false;

    const screen = this.machine.composedScreenDevice;
    this._layer2ReadActive = screen?.layer2EnableMappingForReads || false;
    this._layer2WriteActive = screen?.layer2EnableMappingForWrites || false;

    // --- Update Layer 2 lookup tables if Layer 2 is active
    if (this._layer2ReadActive || this._layer2WriteActive) {
      this.updateLayer2Mapping();
    }

    // --- Enable fast path only if no special mappings
    this._useFastPath = !this._divMmcActive && !this._layer2ReadActive && !this._layer2WriteActive;
    
    // --- Update specialized slot functions based on configuration
    this.updateSlotFunctions();
  }

  /**
   * Pre-computes Layer 2 memory mappings into lookup tables.
   * This replaces the ~30-operation getLayer2MappedAddress() call with a single array lookup.
   * Must be called whenever Layer 2 configuration changes.
   */
  private updateLayer2Mapping(): void {
    // Fill with -1 (not mapped)
    this._layer2ReadMap.fill(-1);
    this._layer2WriteMap.fill(-1);
    
    const screen = this.machine.composedScreenDevice;
    if (!screen.layer2EnableMappingForReads && !screen.layer2EnableMappingForWrites) {
      return; // Nothing mapped
    }
    
    const mapSegment = screen.layer2Bank;
    const activeBank = screen.layer2UseShadowBank 
      ? screen.layer2ShadowRamBank 
      : screen.layer2ActiveRamBank;
    const bankOffset = screen.layer2BankOffset || 0;
    
    console.log(`[Layer2] updateLayer2Mapping: mapSegment=${mapSegment}, activeBank=${activeBank}, bankOffset=${bankOffset}, read=${screen.layer2EnableMappingForReads}, write=${screen.layer2EnableMappingForWrites}`);
    
    // Pre-compute mappings for all addresses in the mapped region
    const startAddr = mapSegment === 3 ? 0x0000 : (mapSegment * 0x4000);
    const endAddr = mapSegment === 3 ? 0xC000 : ((mapSegment + 1) * 0x4000);
    
    for (let addr = startAddr; addr < endAddr; addr++) {
      // Calculate segment index based on address
      // VHDL: layer2_active_bank_offset_pre <= cpu_a(15 downto 14) when port_123b_layer2_map_segment = "11" else port_123b_layer2_map_segment
      const layer2ActiveBankOffsetPre = mapSegment === 3 
        ? ((addr >> 14) & 0x03) 
        : mapSegment;
      
      // VHDL: layer2_active_bank_offset <= ("00" & layer2_active_bank_offset_pre) + ('0' & port_123b_layer2_offset)
      const layer2ActiveBankOffset = (layer2ActiveBankOffsetPre + bankOffset) & 0x07;
      
      // VHDL: layer2_active_page <= (('0' & layer2_active_bank) + ("0000" & layer2_active_bank_offset)) & cpu_a(13)
      const pageBits7_1 = (activeBank + layer2ActiveBankOffset) & 0x7F;
      const pageBit0 = (addr >> 13) & 0x01;
      const layer2ActivePage = (pageBits7_1 << 1) | pageBit0;
      
      // VHDL: layer2_A21_A13 <= ("0001" + ('0' & layer2_active_page(7 downto 5))) & layer2_active_page(4 downto 0)
      const upperNibble = (0x01 + ((layer2ActivePage >> 5) & 0x07)) & 0x0F;
      const lowerBits = layer2ActivePage & 0x1F;
      const layer2_A21_A13 = (upperNibble << 5) | lowerBits;
      
      // VHDL: sram_active <= not sram_pre_layer2_A21_A13(8)
      if ((layer2_A21_A13 & 0x100) === 0) {
        const sramA12_A0 = addr & 0x1FFF;
        const sramAddr = ((layer2_A21_A13 & 0xFF) << 13) | sramA12_A0;
        const offset = OFFS_NEXT_RAM + sramAddr;
        
        if (screen.layer2EnableMappingForReads) {
          this._layer2ReadMap[addr] = offset;
        }
        if (screen.layer2EnableMappingForWrites) {
          this._layer2WriteMap[addr] = offset;
        }
      }
    }
  }

  /**
   * Updates specialized slot function pointers based on current configuration.
   * Called after fast path flags change.
   */
  private updateSlotFunctions(): void {
    // --- Slot 0 (0x0000-0x3FFF): Check DivMMC and Layer 2
    const slot0Complex = this._divMmcActive || this._layer2ReadActive;
    this._readSlot0 = slot0Complex 
      ? this._readSlot0Complex.bind(this)
      : this._readSlot0Simple.bind(this);
    
    const slot0WriteComplex = this._divMmcActive || this._layer2WriteActive;
    this._writeSlot0 = slot0WriteComplex
      ? this._writeSlot0Complex.bind(this)
      : this._writeSlot0Simple.bind(this);
    
    // --- Slot 1 (0x4000-0x7FFF): Check Layer 2 only
    this._readSlot1 = this._layer2ReadActive
      ? this._readSlot1Complex.bind(this)
      : this._readSlot1Simple.bind(this);
    
    this._writeSlot1 = this._layer2WriteActive
      ? this._writeSlot1Complex.bind(this)
      : this._writeSlot1Simple.bind(this);
    
    // --- Slot 2 (0x8000-0xBFFF): Check Layer 2 only
    this._readSlot2 = this._layer2ReadActive
      ? this._readSlot2Complex.bind(this)
      : this._readSlot2Simple.bind(this);
    
    this._writeSlot2 = this._layer2WriteActive
      ? this._writeSlot2Complex.bind(this)
      : this._writeSlot2Simple.bind(this);
    
    // --- Slot 3 (0xC000-0xFFFF): Always simple (no special mappings)
    // Already bound in constructor
  }

  // ========== Specialized Slot 0 Readers ==========
  
  private _readSlot0Simple(address: number): number {
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }
  
  private _readSlot0Complex(address: number): number {
    const page = address >>> 13;
    const offset = address & 0x1fff;
    let readOffset = this.pageInfo[page].readOffset;
    
    // --- DivMMC has priority
    if (this._divMmcActive) {
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        readOffset = page ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000 : OFFS_DIVMMC_ROM;
        return this.memory[readOffset + offset];
      } else if (divMmcDevice.autoMapActive) {
        readOffset = divMmcDevice.mapram
          ? page ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000 : OFFS_DIVMMC_RAM_BANK_3
          : page ? OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000 : OFFS_DIVMMC_ROM;
        return this.memory[readOffset + offset];
      }
    }
    
    // --- Layer 2 (if DivMMC not active)
    if (this._layer2ReadActive) {
      const layer2Offset = this._layer2ReadMap[address];
      if (layer2Offset >= 0) {
        return this.memory[layer2Offset];
      }
    }
    
    return this.memory[readOffset + offset];
  }

  // ========== Specialized Slot 1 Readers ==========
  
  private _readSlot1Simple(address: number): number {
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }
  
  private _readSlot1Complex(address: number): number {
    // --- Check Layer 2 first
    const layer2Offset = this._layer2ReadMap[address];
    if (layer2Offset >= 0) {
      return this.memory[layer2Offset];
    }
    
    // --- Fall back to MMU
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }

  // ========== Specialized Slot 2 Readers ==========
  
  private _readSlot2Simple(address: number): number {
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }
  
  private _readSlot2Complex(address: number): number {
    // --- Check Layer 2 first
    const layer2Offset = this._layer2ReadMap[address];
    if (layer2Offset >= 0) {
      return this.memory[layer2Offset];
    }
    
    // --- Fall back to MMU
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }

  // ========== Specialized Slot 3 Readers ==========
  
  private _readSlot3Simple(address: number): number {
    return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
  }

  // ========== Specialized Slot 0 Writers ==========
  
  private _writeSlot0Simple(address: number, data: number): void {
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
    }
  }
  
  private _writeSlot0Complex(address: number, data: number): void {
    const page = address >>> 13;
    const offset = address & 0x1fff;
    let writeOffset = this.pageInfo[page].writeOffset;
    
    // --- DivMMC has priority
    if (this._divMmcActive) {
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        if (!page) return; // Page 0 is read-only
        writeOffset = OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000;
        this.memory[writeOffset + offset] = data;
        return;
      } else if (divMmcDevice.autoMapActive) {
        if (!page || (divMmcDevice.mapram && divMmcDevice.bank === 3)) return;
        writeOffset = OFFS_DIVMMC_RAM + divMmcDevice.bank * 0x2000;
        this.memory[writeOffset + offset] = data;
        return;
      }
    }
    
    // --- Layer 2 (if DivMMC not active)
    if (this._layer2WriteActive) {
      const layer2Offset = this._layer2WriteMap[address];
      if (layer2Offset >= 0) {
        this.memory[layer2Offset] = data;
        return;
      }
    }
    
    // --- Fall back to MMU
    if (writeOffset !== null && writeOffset !== OFFS_ERR_PAGE) {
      this.memory[writeOffset + offset] = data;
    }
  }

  // ========== Specialized Slot 1 Writers ==========
  
  private _writeSlot1Simple(address: number, data: number): void {
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
    }
  }
  
  private _writeSlot1Complex(address: number, data: number): void {
    // --- Check Layer 2 first
    const layer2Offset = this._layer2WriteMap[address];
    if (layer2Offset >= 0) {
      this.memory[layer2Offset] = data;
      return;
    }
    
    // --- Fall back to MMU
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
    }
  }

  // ========== Specialized Slot 2 Writers ==========
  
  private _writeSlot2Simple(address: number, data: number): void {
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
    }
  }
  
  private _writeSlot2Complex(address: number, data: number): void {
    // --- Check Layer 2 first
    const layer2Offset = this._layer2WriteMap[address];
    if (layer2Offset >= 0) {
      this.memory[layer2Offset] = data;
      return;
    }
    
    // --- Fall back to MMU
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
    }
  }

  // ========== Specialized Slot 3 Writers ==========
  
  private _writeSlot3Simple(address: number, data: number): void {
    const pageInfo = this.pageInfo[address >>> 13];
    if (pageInfo.writeOffset !== null) {
      this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
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

    // --- Update fast path flags after memory configuration changes
    this.updateFastPathFlags();
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
   * Gets the Layer 2 mapped SRAM address for a Z80 memory address.
   * Returns null if the address is not in a Layer 2 mapped region.
   * 
   * Based on VHDL lines 2922-2927 in zxnext.vhd:
   * - layer2_active_bank_offset_pre <= cpu_a(15 downto 14) when port_123b_layer2_map_segment = "11" else port_123b_layer2_map_segment;
   * - layer2_active_bank_offset <= ("00" & layer2_active_bank_offset_pre) + ('0' & port_123b_layer2_offset);
   * - layer2_active_bank <= nr_12_layer2_active_bank when port_123b_layer2_map_shadow = '0' else nr_13_layer2_shadow_bank;
   * - layer2_active_page = (layer2_active_bank & '0') + layer2_active_bank_offset
   * - layer2_A21_A13 <= ("0001" + ('0' & layer2_active_page(7 downto 5))) & layer2_active_page(4 downto 0);
   * 
   * @param address Z80 address (0x0000-0xFFFF)
   * @param slot Memory slot (0-3 for 0x0000-0x3FFF, 0x4000-0x7FFF, 0x8000-0xBFFF, 0xC000-0xFFFF)
   * @returns SRAM address offset (0x040000+) or null if not mapped
   */
  private getLayer2MappedAddress(address: number, slot: number): number | null {
    const screenDevice = this.machine.composedScreenDevice;
    
    // Determine which 16K segment is being mapped
    // port_123b_layer2_map_segment: bits [7:6] of port 0x123B
    // 00 = First 16K  (0x0000-0x3FFF)
    // 01 = Second 16K (0x4000-0x7FFF)
    // 10 = Third 16K  (0x8000-0xBFFF)
    // 11 = All 48K    (0x0000-0xBFFF, segment determined by address bits 15:14)
    const mapSegment = screenDevice.layer2Bank;
    
    let segmentIndex: number;
    if (mapSegment === 3) {
      // All 48K mode: segment determined by address bits [15:14]
      segmentIndex = (address >> 14) & 0x03;
      if (segmentIndex === 3) return null; // 0xC000-0xFFFF not mapped
    } else {
      // Single 16K segment mode: check if address is in the mapped slot
      if (slot !== mapSegment) return null;
      segmentIndex = mapSegment;
    }
    
    // Get the active bank (7-bit value, 16K bank number)
    const activeBank = screenDevice.layer2UseShadowBank 
      ? screenDevice.layer2ShadowRamBank 
      : screenDevice.layer2ActiveRamBank;
    
    // In VHDL:
    // layer2_active_bank_offset_pre <= cpu_a(15 downto 14) when port_123b_layer2_map_segment = "11" 
    //                                  else port_123b_layer2_map_segment;
    // layer2_active_bank_offset <= ("00" & layer2_active_bank_offset_pre) + ('0' & port_123b_layer2_offset);
    // Since we don't have port_123b_layer2_offset in the emulator yet, assume it's 0
    const layer2ActiveBankOffset = segmentIndex;  // 0-2 (or address bits 15:14 in 48K mode)
    
    // layer2_active_page <= (('0' & layer2_active_bank) + ("0000" & layer2_active_bank_offset)) & cpu_a(13);
    // This creates an 8-bit page number where:
    //   - bits[7:1] = (activeBank + bankOffset)  [7-bit addition result]
    //   - bit[0] = address bit 13  [selects 8K half of the 16K segment]
    const pageBits7_1 = (activeBank + layer2ActiveBankOffset) & 0x7F;  // 7-bit value
    const pageBit0 = (address >> 13) & 0x01;  // address bit 13
    const layer2ActivePage = (pageBits7_1 << 1) | pageBit0;  // 8-bit page number
    
    // layer2_A21_A13 <= ("0001" + ('0' & layer2_active_page(7 downto 5))) & layer2_active_page(4 downto 0);
    // This generates a 9-bit value [8:0] representing SRAM address bits [21:13]
    // Upper part: bits [8:5] = 0b0001 (0x01) + layer2_active_page[7:5] (4-bit addition)
    // Lower part: bits [4:0] = layer2_active_page[4:0]
    const upperNibble = (0x01 + ((layer2ActivePage >> 5) & 0x07)) & 0x0F;  // 4-bit value [3:0]
    const lowerBits = layer2ActivePage & 0x1F;  // 5-bit value [4:0]
    const layer2_A21_A13 = (upperNibble << 5) | lowerBits;  // 9-bit value [8:0]
    
    // Check if bit 8 is set - if so, address is out of range
    // sram_active <= not sram_pre_layer2_A21_A13(8);
    if ((layer2_A21_A13 & 0x100) !== 0) return null;
    
    // Combine with address bits [12:0] to form the final SRAM address
    const sramA12_A0 = address & 0x1FFF;  // Lower 13 bits of Z80 address
    const sramAddr = ((layer2_A21_A13 & 0xFF) << 13) | sramA12_A0;  // 21-bit SRAM address
    
    // Return full memory offset (base + SRAM address)
    return OFFS_NEXT_RAM + sramAddr;
  }
}
