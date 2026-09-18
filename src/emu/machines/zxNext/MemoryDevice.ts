import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";


export const OFFS_NEXT_ROM = 0x00_0000;
export const OFFS_DIVMMC_ROM = 0x01_0000;
export const OFFS_MULTIFACE_MEM = 0x01_4000;
export const OFFS_ALT_ROM_0 = 0x01_8000;
export const OFFS_ALT_ROM_1 = 0x01_c000;
export const OFFS_DIVMMC_RAM = 0x02_0000;
export const OFFS_DIVMMC_RAM_BANK_3 = 0x02_0000 + (3 << 13);
export const OFFS_NEXT_RAM = 0x04_0000;
export const OFFS_BANK_05 = 0x05_4000; // Bank 5 (normal screen) = OFFS_NEXT_RAM + (5 << 14)
export const OFFS_BANK_07 = 0x05_c000; // Bank 7 (shadow screen) = OFFS_NEXT_RAM + (7 << 14)
export const OFFS_ERR_PAGE = 2048 * 1024;

/**
 * The label for an 8K page that is not backed by any partition.
 *
 * Not a partition, so it has no index and no entry in `getPartitionLabels()`; this is the bank
 * column's empty state. See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8, decision 1.
 */
export const UNPAGED_PARTITION_LABEL = "UN";

/**
 * Memory information about a 8K page
 */
/**
 * The four 16K banks visible in **all-RAM mode**, or `undefined` when the machine is not in it.
 *
 * The ZX Spectrum +3's special paging configurations, which the Next inherits: with all-RAM mode on,
 * the two configuration bits pick one of four fixed arrangements of RAM banks across the whole 64K,
 * ROM included.
 *
 * A pure function of the reported `$1FFD` value rather than a method, because **two** machines have
 * to answer it — the interpreted `MemoryDevice` from its own state, and the WASM Next from the
 * NextReg it normalises into the same encoding. Only the first ever did, so the Memory Mapping
 * panel's "All RAM" row read `Off` on the machine people actually run.
 *
 * The encoding is the one `MemoryDevice.port1ffdValue` reports: all-RAM mode in bit 0, the
 * configuration in bits 1-2. (NextReg `$8E` uses a different layout, which
 * `getWasmV2Port1ffdValue` already converts.)
 */
export function allRamBanksFor(port1ffdValue: number): number[] | undefined {
  if (!(port1ffdValue & 0x01)) return undefined;
  switch ((port1ffdValue >> 1) & 0x03) {
    case 0:
      return [0, 1, 2, 3];
    case 1:
      return [4, 5, 6, 7];
    case 2:
      return [4, 5, 6, 3];
    default:
      return [4, 7, 6, 3];
  }
}

/**
 * The **16K bank** to report for a page, given the partition mapped there.
 *
 * A Next partition is an 8K page (Q9), so a 16K bank is `partition >> 1`. The interpreted
 * `MemoryDevice` has always reported it that way — `setPageInfo(..., bank8k >> 1, bank8k)` — but the
 * WASM Next passed the partition index straight through, so its page rows printed the *8K* number
 * under a field named `bank16k`. The Memory Mapping panel shows both columns, which meant the same
 * number twice with one of them labelled "16K bank".
 *
 * Negative partitions (the ROMs, the alt ROMs, DivMMC) are passed through unchanged: they are not
 * RAM banks and have no 16K bank, and the panel renders anything negative as `--`. `undefined` — an
 * unpaged page — becomes `0xff`, the placeholder the interpreted machine uses for the same case.
 */
export function bank16kForPartition(partition: number | undefined): number {
  if (partition === undefined) return 0xff;
  return partition >= 0 ? partition >> 1 : partition;
}

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

  /**
   * The ROM the `$0000-$3FFF` area shows (zxnext.vhd ~2938-2962 `sram_rom`), split into its two bits.
   * Derived from the machine type, `$1FFD`, `$7FFD` and the `$8C` lock bits at every paging change.
   */
  selectedRomLsb: number;
  selectedRomMsb: number;

  configRomRamBank: number;
  /** NextReg `$8F` (zxnext.vhd ~3766): no reset branch, so a reset keeps it. */
  mappingMode: number;

  readonly mmuRegs = new Uint8Array(0x08);

  // --- The paging registers exactly as zxnext.vhd stores them (~3638-3764). Everything else about
  // --- 128K/+3/Pentagon paging is derived from these and from the MMU registers they reload.
  private _port7ffd = 0; // port_7ffd_reg
  private _portDffd = 0; // port_dffd_reg (bits 4-0)
  private _portDffd6 = 0; // port_dffd_reg_6 (read back only by the MF+3 port)
  private _port1ffd = 0; // port_1ffd_reg
  private _portEff7 = 0; // port_eff7_reg_2 / _3 (bits 2 and 3)
  private _altRom = 0; // nr_8c_altrom
  /** Alt ROM 1 (48K) rather than Alt ROM 0 (128K) - `sram_alt_128_n`. */
  private _alt128n = false;

  // --- Fast path optimization flags
  private _divMmcActive = false;
  private _mfActive = false;
  private _layer2ReadActive = false;
  private _layer2WriteActive = false;
  private _useFastPath = true;

  // --- Layer 2 lookup tables (Priority 2 optimization)
  // 64KB lookup tables: Z80 address → SRAM offset (or -1 if not mapped)
  private _layer2ReadMap: Int32Array | null = null;
  private _layer2WriteMap: Int32Array | null = null;

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

    // --- Layer 2 lookup tables are allocated lazily when first needed

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
    // --- zxnext.vhd ~3645, 3685, 3712, 3758: every reset clears the paging ports
    this._port7ffd = 0;
    this._portDffd = 0;
    this._portDffd6 = 0;
    this._port1ffd = 0;
    this._portEff7 = 0;

    // --- zxnext.vhd ~2211: a reset copies NextReg $8C bits 3-0 into bits 7-4 and keeps bits 3-0.
    const altRomLowNibble = (this._altRom ?? 0) & 0x0f;
    this._altRom = (altRomLowNibble << 4) | altRomLowNibble;
    this.configRomRamBank = 0;
    // --- NextReg $8F (mapping mode) has no reset branch (zxnext.vhd ~3767): a soft reset keeps it.
    this.mappingMode ??= 0;

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

  hardReset(): void {
    this.mappingMode = 0;
    // --- Clear DivMMC RAM and all main RAM banks on hard reset to simulate a power-on.
    // --- This forces NextZXOS to perform a cold start on the next boot, which means:
    // ---   1. ESXDOS re-initializes its filesystem state from the SD card.
    // ---   2. The SD card is re-initialized through the full CMD0/ACMD41 sequence.
    // --- Without this, preserved BASIC in RAM causes NextZXOS to warm-start and reuse
    // --- a stale ESXDOS directory cache that was built before any new files were copied
    // --- to the SD card, resulting in "Not DIR" errors for newly-created directories.
    // ---
    // --- ROM areas (0x000000–0x01FFFF) are NOT cleared: their content is uploaded once
    // --- by setup() and must survive subsequent hard resets.
    // --- The sentinel page at OFFS_ERR_PAGE (0x7E bytes) is also preserved.
    this.memory.fill(0, OFFS_DIVMMC_RAM, OFFS_ERR_PAGE);
  }

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
    this.pageInfo[pageIndex] = {
      readOffset,
      writeOffset,
      bank16k,
      bank8k
    };
    this.bank8kLookup[pageIndex] = bank8k;
  }

  getPageInfo(pageIndex: number): MemoryPageInfo {
    return this.pageInfo[pageIndex];
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory(address: number): number {
    // --- Fast path: Direct access when no DivMMC or Layer 2 mapping
    if (this._useFastPath) {
      return this.memory[this.pageInfo[address >>> 13].readOffset + (address & 0x1fff)];
    }

    // --- Complex path: Check DivMMC and Layer 2
    const slot = address >>> 14;

    // --- Dispatch to specialized slot reader
    switch (slot) {
      case 0:
        return this._readSlot0(address);
      case 1:
        return this._readSlot1(address);
      case 2:
        return this._readSlot2(address);
      case 3:
        return this._readSlot3(address);
    }
    return 0; // Should never reach here
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory(address: number, data: number): void {
    // address &= 0xffff;

    // --- Fast path: Direct access when no DivMMC or Layer 2 mapping
    if (this._useFastPath) {
      const pageInfo = this.pageInfo[address >>> 13];
      if (pageInfo.writeOffset !== null) {
        // Check if writing to Layer 2 banks when Layer 2 display is enabled
        this.memory[pageInfo.writeOffset + (address & 0x1fff)] = data;
      }
      return;
    }

    // --- Complex path: Check DivMMC and Layer 2
    const slot = address >>> 14;

    // --- Dispatch to specialized slot writer
    switch (slot) {
      case 0:
        this._writeSlot0(address, data);
        return;
      case 1:
        this._writeSlot1(address, data);
        return;
      case 2:
        this._writeSlot2(address, data);
        return;
      case 3:
        this._writeSlot3(address, data);
        return;
    }
  }

  /**
   * Reads a byte from the screen memory area
   * @param offset Screen memory offset
   * @returns Byte value read from screen memory
   */
  readScreenMemory(offset: number): number {
    return this.memory[(this.useShadowScreen ? OFFS_BANK_07 : OFFS_BANK_05) + (offset & 0x3fff)];
  }

  /**
   * Writes a byte to the screen memory area
   * @param offset Screen memory offset
   * @param data Data byte to write
   */
  writeScreenMemory(offset: number, data: number): void {
    this.memory[(this.useShadowScreen ? OFFS_BANK_07 : OFFS_BANK_05) + (offset & 0x3fff)] = data;
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

  // ==========================================================================================
  // Paging registers (zxnext.vhd ~3638-3800)

  /** `$7FFD` bit 3: bank 7 is displayed (`port_7ffd_shadow`). NextReg `$69` bit 6 writes it too. */
  get useShadowScreen(): boolean {
    return (this._port7ffd & 0x08) !== 0;
  }
  set useShadowScreen(value: boolean) {
    this._port7ffd = value ? this._port7ffd | 0x08 : this._port7ffd & ~0x08;
  }

  /** Not `port_7ffd_locked` (~3749): Pentagon 1024 has no lock. `$08` bit 7 = 1 unlocks (~3650). */
  get pagingEnabled(): boolean {
    return this.pentagon1024 || (this._port7ffd & 0x20) === 0;
  }
  set pagingEnabled(value: boolean) {
    this._port7ffd = value ? this._port7ffd & ~0x20 : this._port7ffd | 0x20;
  }

  /** +3 special (all-RAM) mode: `$1FFD` bit 0. */
  get allRamMode(): boolean {
    return (this._port1ffd & 0x01) !== 0;
  }
  /** The +3 special layout: `$1FFD` bits 2-1. */
  get specialConfig(): number {
    return (this._port1ffd >> 1) & 0x03;
  }

  /** `$8F` = 11 and `$EFF7` bit 2 clear (~3781). */
  private get pentagon1024(): boolean {
    return this.mappingMode === 3 && (this._portEff7 & 0x04) === 0;
  }

  /** `port_7ffd_bank` (~3743-3746): the 16K bank `$7FFD` / `$DFFD` / Pentagon paging select. */
  get selectedBank16k(): number {
    const p = this._port7ffd;
    if (this.mappingMode === 2 || this.pentagon1024) {
      return (p & 0x07) | (((p >> 6) & 0x03) << 3) | (this.pentagon1024 && p & 0x20 ? 0x20 : 0);
    }
    return (p & 0x07) | ((this._portDffd & 0x0f) << 3);
  }
  get selectedBankLsb(): number {
    return this._port7ffd & 0x07;
  }
  get selectedBankMsb(): number {
    return this.selectedBank16k & 0x78;
  }

  get port7ffdValue(): number {
    return this._port7ffd;
  }
  /** A `$7FFD` write; ignored while locked (~3646). */
  set port7ffdValue(value: number) {
    if (!this.pagingEnabled) return;
    this._port7ffd = value & 0xff;
    this.reloadMmuFromPorts(true, false);
  }

  get portDffdValue(): number {
    return this._portDffd;
  }
  /** A `$DFFD` write; ignored while locked (~3688, the Profi exception is disabled in this core). */
  set portDffdValue(value: number) {
    if (!this.pagingEnabled) return;
    this._portDffd = value & 0x1f;
    this._portDffd6 = (value >> 6) & 0x01;
    this.reloadMmuFromPorts(true, false);
  }

  /** The MF+3 read-back of `$DFFD`: '0' & dffd(6) & '0' & dffd(4-0) (zxnext.vhd ~4294). */
  get portDffdReadback(): number {
    return (this._portDffd6 << 6) | this._portDffd;
  }

  get port1ffdValue(): number {
    return this._port1ffd;
  }
  /** A `$1FFD` write; ignored while locked (~3715). */
  set port1ffdValue(value: number) {
    if (!this.pagingEnabled) return;
    const specialOld = this.allRamMode;
    this._port1ffd = value & 0xff;
    this.reloadMmuFromPorts(true, specialOld);
  }

  get portEff7Value(): number {
    return this._portEff7;
  }
  /** A `$EFF7` write: only bits 2 and 3 are stored (~3761); the lock does not apply. */
  set portEff7Value(value: number) {
    this._portEff7 = value & 0x0c;
    this.reloadMmuFromPorts(true, false);
  }

  /**
   * The MMU reload after a paging write (zxnext.vhd ~4599-4664). `ramChange` is
   * `port_memory_ram_change_dly` (false only for a `$8E` write without bit 3); `specialOld` is
   * `port_1ffd_special_old`, the special-mode flag before a `$1FFD` / `$8E` write.
   */
  private reloadMmuFromPorts(ramChange: boolean, specialOld: boolean): void {
    const mmu = this.mmuRegs;
    const p = this._port1ffd;
    if (p & 0x01) {
      const b2 = (p >> 2) & 0x01;
      const b1 = (p >> 1) & 0x01;
      const high = (b2 | b1) << 3;
      const upper = ((b2 ^ 1) & b1) << 3;
      mmu[0] = high;
      mmu[1] = high | 1;
      mmu[2] = high | ((b2 & b1) << 2) | 2;
      mmu[3] = mmu[2] | 1;
      mmu[4] = high | 4;
      mmu[5] = high | 5;
      mmu[6] = upper | 6;
      mmu[7] = upper | 7;
    } else {
      const bank0 = (this._portEff7 & 0x08) !== 0;
      mmu[0] = bank0 ? 0x00 : 0xff;
      mmu[1] = bank0 ? 0x01 : 0xff;
      if (specialOld) {
        mmu[2] = 0x0a;
        mmu[3] = 0x0b;
        mmu[4] = 0x04;
        mmu[5] = 0x05;
      }
      if (specialOld || ramChange) {
        const bank = this.selectedBank16k;
        mmu[6] = (bank << 1) & 0xff;
        mmu[7] = ((bank << 1) | 1) & 0xff;
      }
    }
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
    const slotIndex = index & 0x07;
    this.mmuRegs[slotIndex] = value;
    this.updateMemoryConfig();
  }

  // --- NextReg $8C (~2207-2221)
  get enableAltRom(): boolean {
    return (this._altRom & 0x80) !== 0;
  }
  /** Bit 6: the Alt ROM is the write target and reads see the normal ROM. */
  get altRomVisibleOnlyForWrites(): boolean {
    return (this._altRom & 0x40) !== 0;
  }
  get lockRom1(): boolean {
    return (this._altRom & 0x20) !== 0;
  }
  get lockRom0(): boolean {
    return (this._altRom & 0x10) !== 0;
  }

  get nextReg8CValue(): number {
    return this._altRom;
  }
  set nextReg8CValue(value: number) {
    this._altRom = value & 0xff;
    this.updateMemoryConfig();
  }

  /** ~6104: dffd(0) & 7ffd(2:0) & 1 & 1ffd(0) & 1ffd(2) & ((7ffd(4) and not 1ffd(0)) or (1ffd(1) and 1ffd(0))) */
  get nextReg8EValue(): number {
    const p7 = this._port7ffd;
    const p1 = this._port1ffd;
    const special = p1 & 0x01;
    return (
      ((this._portDffd & 0x01) << 7) |
      ((p7 & 0x07) << 4) |
      0x08 |
      (special << 2) |
      (((p1 >> 2) & 0x01) << 1) |
      ((((p7 >> 4) & 0x01) & (special ^ 1)) | (((p1 >> 1) & 0x01) & special))
    );
  }

  /**
   * A `$8E` write (~3659-3730): bit 3 sets the bank (bits 6-4, `$DFFD` bit 0 from bit 7, `$DFFD` bit 3
   * cleared) and reloads MMU6/7; bit 2 = 0 sets the ROM bit from bit 0; `$1FFD` bits 2-0 always take
   * bits 1, 0, 2. The lock does not apply.
   */
  set nextReg8EValue(value: number) {
    const specialOld = this.allRamMode;
    if (value & 0x08) {
      this._port7ffd = (this._port7ffd & ~0x07) | ((value >> 4) & 0x07);
      this._portDffd = (this._portDffd & 0x10) | ((value >> 7) & 0x01);
    }
    if (!(value & 0x04)) {
      this._port7ffd = (this._port7ffd & ~0x10) | ((value & 0x01) << 4);
    }
    this._port1ffd =
      (this._port1ffd & ~0x07) | (((value >> 1) & 0x01) << 2) | ((value & 0x01) << 1) | ((value >> 2) & 0x01);
    this.reloadMmuFromPorts((value & 0x08) !== 0, specialOld);
  }

  get nextReg8FValue(): number {
    return this.mappingMode;
  }

  /** A `$8F` write: the mode, then (one clock later, ~3793) an MMU reload like a port write. */
  set nextReg8FValue(value: number) {
    this.mappingMode = value & 0x03;
    this.reloadMmuFromPorts(true, false);
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
   * The partition paged into each of the eight 8K pages.
   *
   * 8K pages, matching `getPartitionForPage` — see the note there.
   */
  getPartitions(): number[] {
    return this.pageInfo.map((b) => b.bank8k);
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

  /**
   * The label of whatever is paged into an 8K page.
   *
   * Derived from the machine's own `getPartitionLabels()` map rather than built here from offsets.
   * This function used to spell its own names — `A0`/`A1` for the alt ROMs and `D0`..`D15` for
   * DivMMC RAM — which the map calls `X0`/`X1` and `M0`..`MF` and which `parsePartitionLabel`
   * therefore rejected: a name shown in the disassembly could not be typed into `bp-set`. One map
   * is now the authority; see `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §3.
   */
  getPartitionLabelForPage(pageIndex: number): string {
    const partition = this.getPartitionForPage(pageIndex);
    if (partition === undefined) return UNPAGED_PARTITION_LABEL;
    return this.machine.getPartitionLabels()[partition] ?? UNPAGED_PARTITION_LABEL;
  }

  /**
   * The partition index paged into an 8K page, or `undefined` when the page is not backed by one.
   *
   * The single place that turns a memory offset into a partition. Everything that needs a *name*
   * goes through here and then through the label map, so an offset can never acquire a second name
   * on the way out.
   */
  getPartitionForPage(pageIndex: number): number | undefined {
    const pageInfo = this.pageInfo[pageIndex & 0x07];
    // --- The **8K page**, not the 16K bank. This used to return `bank16k`, which disagreed with
    // --- `getMemoryPartition(index)` — the function the Memory and Disassembly views fetch bytes
    // --- through — and with the 224-entry label map, `MF_BANK: 224` and the docs, all of which
    // --- describe 8K pages. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
    if (pageInfo.bank8k < 224) {
      return pageInfo.bank8k;
    }
    const offs = pageInfo.readOffset;
    if (offs < OFFS_DIVMMC_ROM) {
      // --- Next ROM 0..3 occupy partitions -1..-4
      return -1 - ((offs - OFFS_NEXT_ROM) >> 14);
    }
    if (offs >= OFFS_ALT_ROM_0 && offs < OFFS_ALT_ROM_1) {
      return -5; // --- Alt ROM 0, "X0"
    }
    if (offs >= OFFS_ALT_ROM_1 && offs < OFFS_DIVMMC_RAM) {
      return -6; // --- Alt ROM 1, "X1"
    }
    if (offs >= OFFS_DIVMMC_ROM && offs < OFFS_MULTIFACE_MEM) {
      return -7; // --- DivMMC ROM, "DM"
    }
    if (pageIndex) {
      if (offs >= OFFS_DIVMMC_RAM && offs < OFFS_NEXT_RAM) {
        // --- DivMMC RAM pages 0..15 occupy partitions -8..-23
        return -8 - ((offs - OFFS_DIVMMC_RAM) >> 13);
      }
    }
    return undefined;
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

  /**
   * Updates fast path flags based on current device states
   * Call this whenever DivMMC or Layer 2 state changes
   */
  updateFastPathFlags(): void {
    const divMmc = this.machine.divMmcDevice;
    // --- divmmc.vhd: the port enable (`i_en`, $83 bit 0) gates the paging
    this._divMmcActive = (divMmc?.enabled ?? false) && (divMmc.conmem || divMmc.autoMapActive);
    this._mfActive = this.machine.multifaceDevice?.mfEnabled || false;

    const screen = this.machine.composedScreenDevice;
    this._layer2ReadActive = screen?.layer2EnableMappingForReads || false;
    this._layer2WriteActive = screen?.layer2EnableMappingForWrites || false;

    // --- Update Layer 2 lookup tables if Layer 2 is active
    if (this._layer2ReadActive || this._layer2WriteActive) {
      this.updateLayer2Mapping();
    }

    // --- Enable fast path only if no special mappings
    this._useFastPath = !this._divMmcActive && !this._mfActive && !this._layer2ReadActive && !this._layer2WriteActive;

    // --- Update specialized slot functions based on configuration
    this.updateSlotFunctions();
  }

  /**
   * Pre-computes Layer 2 memory mappings into lookup tables.
   * This replaces the ~30-operation getLayer2MappedAddress() call with a single array lookup.
   * Must be called whenever Layer 2 configuration changes.
   *
   * Optimization: Process in 8KB chunks instead of byte-by-byte since calculations
   * only change at 8KB boundaries. This reduces iterations from ~49K to ~6.
   */
  private updateLayer2Mapping(): void {
    const screen = this.machine.composedScreenDevice;
    const enableReads = screen.layer2EnableMappingForReads;
    const enableWrites = screen.layer2EnableMappingForWrites;

    if (!enableReads && !enableWrites) {
      return; // Nothing mapped - skip fill operations
    }

    const mapSegment = screen.layer2Bank;
    const activeBank = screen.layer2UseShadowBank
      ? screen.layer2ShadowRamBank
      : screen.layer2ActiveRamBank;
    const bankOffset = screen.layer2BankOffset || 0;

    // --- zxnext.vhd ~3001-3020: segments 00/01/10 all map $0000-$3FFF (the segment picks the third of
    // --- Layer 2 shown there); only segment 11 maps $0000-$BFFF
    const startAddr = 0x0000;
    const endAddr = mapSegment === 3 ? 0xc000 : 0x4000;

    // Allocate lazily on first use (saves 512 KB of startup allocation)
    if (enableReads && !this._layer2ReadMap) {
      this._layer2ReadMap = new Int32Array(0x10000).fill(-1);
    }
    if (enableWrites && !this._layer2WriteMap) {
      this._layer2WriteMap = new Int32Array(0x10000).fill(-1);
    }

    // --- Clear everything a previous segment may have mapped ($0000-$BFFF), not just this segment
    this._layer2ReadMap?.fill(-1, 0, 0xc000);
    this._layer2WriteMap?.fill(-1, 0, 0xc000);

    // --- One 8K page at a time: the page only changes at 8K boundaries
    for (let regionStart = startAddr; regionStart < endAddr; regionStart += 0x2000) {
      // --- VHDL: layer2_active_bank_offset_pre <= cpu_a(15 downto 14) when segment = "11" else segment
      const offsetPre = mapSegment === 3 ? (regionStart >> 14) & 0x03 : mapSegment;
      // --- layer2_active_bank_offset <= ("00" & offset_pre) + ('0' & port_123b_layer2_offset)
      const bankOffsetSum = (offsetPre + bankOffset) & 0x07;
      // --- layer2_active_page <= (('0' & bank) + ("0000" & bank_offset)) & cpu_a(13): 8 bits
      const page = (((activeBank + bankOffsetSum) << 1) | ((regionStart >> 13) & 0x01)) & 0xff;
      // --- layer2_A21_A13 = ("0001" + page(7:5)) & page(4:0) is the SRAM page, i.e. RAM page + 32:
      // --- bit 8 (no SRAM cycle) is set for pages $E0-$FF. RAM page p lives at OFFS_NEXT_RAM + p x 8K.
      if (page >= 0xe0) continue;
      const baseOffset = OFFS_NEXT_RAM + (page << 13);
      for (let i = 0; i < 0x2000; i++) {
        if (enableReads) this._layer2ReadMap![regionStart + i] = baseOffset + i;
        if (enableWrites) this._layer2WriteMap![regionStart + i] = baseOffset + i;
      }
    }
  }

  /**
   * Updates specialized slot function pointers based on current configuration.
   * Called after fast path flags change.
   */
  private updateSlotFunctions(): void {
    // --- Slot 0 (0x0000-0x3FFF): Check Multiface, DivMMC and Layer 2
    const slot0Complex = this._mfActive || this._divMmcActive || this._layer2ReadActive;
    this._readSlot0 = slot0Complex
      ? this._readSlot0Complex.bind(this)
      : this._readSlot0Simple.bind(this);

    const slot0WriteComplex = this._mfActive || this._divMmcActive || this._layer2WriteActive;
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

    // --- Multiface has highest priority
    // Check mfEnabled DIRECTLY (like MAME's bank_update rechecks mf_enabled_r on every M1)
    // to avoid stale _mfActive cache issues
    if (this.machine.multifaceDevice?.mfEnabled) {
      return this.memory[OFFS_MULTIFACE_MEM + (page * 0x2000) + offset];
    }

    // --- DivMMC has priority
    if (this._divMmcActive) {
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        // FPGA: conmem page0 with mapram=1 reads RAM bank 3, mapram=0 reads ROM
        readOffset = page
          ? OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13)
          : divMmcDevice.mapram ? OFFS_DIVMMC_RAM_BANK_3 : OFFS_DIVMMC_ROM;
        return this.memory[readOffset + offset];
      } else if (divMmcDevice.autoMapActive) {
        readOffset = divMmcDevice.mapram
          ? page
            ? OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13)
            : OFFS_DIVMMC_RAM_BANK_3
          : page
            ? OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13)
            : OFFS_DIVMMC_ROM;
        return this.memory[readOffset + offset];
      }
    }

    // --- Layer 2 (if DivMMC not active)
    if (this._layer2ReadActive) {
      const layer2Offset = this._layer2ReadMap![address];
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
    const layer2Offset = this._layer2ReadMap![address];
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
    const layer2Offset = this._layer2ReadMap![address];
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

    // --- Multiface has highest priority (MF RAM page 1 is writable, page 0 ROM is read-only)
    // Check mfEnabled DIRECTLY (like MAME's bank_update rechecks on every access)
    if (this.machine.multifaceDevice?.mfEnabled) {
      if (page !== 0) {
        // Only page 1 (0x2000-0x3FFF = MF RAM) is writable; page 0 is MF ROM (read-only)
        this.memory[OFFS_MULTIFACE_MEM + (page * 0x2000) + offset] = data;
      }
      return;
    }

    // --- DivMMC has priority
    if (this._divMmcActive) {
      const divMmcDevice = this.machine.divMmcDevice;
      if (divMmcDevice.conmem) {
        // FPGA: rdonly = page0 OR (mapram AND ram_bank=3)
        if (!page || (divMmcDevice.mapram && divMmcDevice.bank === 3)) return;
        writeOffset = OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13);
        this.memory[writeOffset + offset] = data;
        return;
      } else if (divMmcDevice.autoMapActive) {
        if (!page || (divMmcDevice.mapram && divMmcDevice.bank === 3)) return;
        writeOffset = OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13);
        this.memory[writeOffset + offset] = data;
        return;
      }
    }

    // --- Layer 2 (if DivMMC not active)
    if (this._layer2WriteActive) {
      const layer2Offset = this._layer2WriteMap![address];
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
    const layer2Offset = this._layer2WriteMap![address];
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
    const layer2Offset = this._layer2WriteMap![address];
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
   * The ROM selection process (zxnext.vhd ~2938-2962): which ROM `$0000-$3FFF` shows and which Alt
   * ROM (`sram_alt_128_n`). The `$8C` lock bits override the ports whether or not the Alt ROM is on.
   */
  private updateRomSelection(): void {
    const lock1 = this.lockRom1;
    const lock0 = this.lockRom0;
    const rom7ffd = (this._port7ffd >> 4) & 0x01;
    const machineType = this.machine.composedScreenDevice?.machineType ?? 0b011;
    let rom: number;
    if (machineType === 0b001) {
      rom = 0;
      this._alt128n = !(!lock1 && lock0);
    } else if (machineType === 0b011) {
      if (lock1 || lock0) {
        rom = (lock1 ? 2 : 0) | (lock0 ? 1 : 0);
        this._alt128n = lock1;
      } else {
        rom = (((this._port1ffd >> 2) & 0x01) << 1) | rom7ffd;
        this._alt128n = rom7ffd === 1;
      }
    } else if (lock1 || lock0) {
      rom = lock1 ? 1 : 0;
      this._alt128n = lock1;
    } else {
      rom = rom7ffd;
      this._alt128n = rom7ffd === 1;
    }
    this.selectedRomMsb = rom & 0x02;
    this.selectedRomLsb = rom & 0x01;
  }

  /**
   * Maps the eight 8K slots from the MMU registers (zxnext.vhd ~2986-3017). The paging ports never
   * map memory directly: they reload the MMU registers (`reloadMmuFromPorts`), as the FPGA does.
   */
  updateMemoryConfig(): void {
    this.updateRomSelection();
    for (let slot = 0; slot < 8; slot++) {
      this.setRamSlotByMmu(slot);
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
      portEff7: this.portEff7Value,
      portLayer2: 0x00,
      portTimex: 0x00,
      divMmc: divMmc.port0xe3Value,
      divMmcIn: divMmc.conmem || divMmc.autoMapActive,
      pageInfo: this.pageInfo
    };
  }

  getAllRamMappings(): number[] | undefined {
    // --- Through the shared derivation, so this machine and the WASM one cannot answer differently.
    return allRamBanksFor(this.port1ffdValue);
  }

  /**
   * Maps one 8K slot from its MMU register. Pages `$00-$DF` are RAM (SRAM page + 32). Anything
   * above has bit 8 of `mmu_A21_A13` set: in slots 0/1 that is the ROM (~3010-3014: read-only unless
   * the Alt ROM takes writes); in slots 2-7 there is no SRAM cycle at all - writes are dropped (reads
   * are undefined on the hardware; the ROM is shown).
   */
  private setRamSlotByMmu(pageNo: number): void {
    const bank8k = this.mmuRegs[pageNo];
    if (bank8k < 0xe0) {
      if (bank8k >= this.maxPages) {
        this.setPageInfo(pageNo, OFFS_ERR_PAGE, null, bank8k >> 1, bank8k);
      } else {
        const offset = OFFS_NEXT_RAM + (bank8k << 13);
        this.setPageInfo(pageNo, offset, offset, bank8k >> 1, bank8k);
      }
      return;
    }

    const half = pageNo & 0x01;
    // --- ~2994-3000: in config mode the ROM slots show the 16K SRAM bank of $04 (bits 6-0), writable,
    // --- with no Alt ROM (sram_pre_override "110": DivMMC, Layer 2 and the Multiface still go above it)
    if (pageNo <= 1 && this.machine.nextRegDevice?.configMode) {
      const configOffs = (this.configRomRamBank << 14) + (half << 13);
      this.setPageInfo(pageNo, configOffs, configOffs, 0xff, 0xff);
      return;
    }
    const romOffs = OFFS_NEXT_ROM + ((this.selectedRomMsb | this.selectedRomLsb) << 14) + (half << 13);
    if (pageNo > 1) {
      this.setPageInfo(pageNo, romOffs, null, 0xff, 0xff);
      return;
    }

    // --- ~3050-3083: `sram_altrom_en` for reads while read-only, for writes while writable
    const altRomOffs = (this._alt128n ? OFFS_ALT_ROM_1 : OFFS_ALT_ROM_0) + (half << 13);
    if (!this.enableAltRom) {
      this.setPageInfo(pageNo, romOffs, null, 0xff, 0xff);
    } else if (this.altRomVisibleOnlyForWrites) {
      this.setPageInfo(pageNo, romOffs, altRomOffs, 0xff, 0xff);
    } else {
      this.setPageInfo(pageNo, altRomOffs, null, 0xff, 0xff);
    }
  }
}
