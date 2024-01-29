import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { Z88PageInfo } from "./Z88PageInfo";
import { IZ88MemoryCard } from "./IZ88MemoryCard";
import { Z88RomMemoryCard } from "./Z88RomMemoryCard";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { MC_Z88_INTRAM } from "@common/machines/constants";
import { Z88RamMemoryCard } from "./Z88RamMemoryCard";
import { COMFlags } from "../IZ88BlinkDevice";

/**
 * This object represents the Z88 banked memory. Its responsibility is to carry out memory
 * read and write operations through the memory cards inserted into the Z88 slots.
 * When a particular slot is not available, it generates random values for memory read and ignores
 * memory writes.
 *
 * The BlinkDevice takes care of setting up memory card information.
 */
export class Z88BankedMemory implements IZ88BankedMemoryTestSupport {
  private _rndSeed: number;
  private readonly _cards: (IZ88MemoryCard | null)[] = [];
  private _intRamCard: IZ88MemoryCard | null = null;

  private readonly _bankData: Z88PageInfo[];
  private readonly _memory: Uint8Array;

  constructor (public readonly machine: IZ88Machine, rndSeed = 0) {
    // --- We allocate the entire 4MB memory
    this._memory = new Uint8Array(0x40_0000);

    // --- Set up memory data (needs configuration)
    this._bankData = [];
    for (let i = 0; i < 8; i++) {
      this._bankData[i] = {
        offset: 0,
        bank: 0
      };
    }

    // --- Use this random seed to generate random memory read values
    this._rndSeed = rndSeed;

    // --- Reset cards
    this._cards[0] = null;
    this._cards[1] = null;
    this._cards[2] = null;
    this._cards[3] = null;

    // --- Let's assume 512K internal ROM
    this._cards[0] = new Z88RomMemoryCard(this.machine, 0x08_0000);

    // --- Get the internal RAM size (assume 512K by default)
    const intRamSize = this.machine.config?.[MC_Z88_INTRAM] ?? 0x1f;
    let ramSizeInBytes = 0x08_0000;
    switch (intRamSize) {
      case 0x00:
        ramSizeInBytes = 0x00_0000;
        break;
      case 0x01:
        ramSizeInBytes = 0x00_8000;
        break;
      case 0x03:
        ramSizeInBytes = 0x01_0000;
        break;
      case 0x07:
        ramSizeInBytes = 0x02_0000;
        break;
      case 0x0f:
        ramSizeInBytes = 0x04_0000;
        break;
    }
    this._intRamCard = new Z88RamMemoryCard(this.machine, ramSizeInBytes);
    this.reset();
  }

  /**
   * Resets the memory to the specified data byte
   * @param dataByte Reset value
   */
  reset (dataByte = 0): void {
    for (let i = 0; i < this._memory.length; i++) {
      this._memory[i] = dataByte;
    }
  }

  /**
   * Sets up the memory page information for the specified slot
   * @param slot Slot ID (0..3)
   * @param bank Bank number to set up
   * Undefined means both pages.
   */
  setMemoryPageInfo (slot: number, bank: number, upper?: boolean): void {
    const thisObj = this;

    // --- Check the slot index
    if (slot < 0 || slot > 3) {
      throw new Error("Invalid slot index");
    }

    // --- Get the RAMS flag
    const RAMS = this.machine.blinkDevice.COM & COMFlags.RAMS;

    // --- Set up the memory pages
    if (slot === 0) {
      if (!upper) {
        // --- SR0, special case. Set up the lower 8K page
        if (RAMS) {
          this.setPageInfo(0, 0x08_0000, 0x20, this._intRamCard);
        } else {
          this.setPageInfo(0, 0x00_0000, 0x00, this._cards[0]);
        }
      } else {
        // --- SR0, Set up the upper 8K page
        const pageOffset =
          calculatePageOffset(bank & 0xfe) + (bank & 0x01) * 0x2000;
        this.setPageInfo(1, pageOffset, bank, getCard(bank));
      }
    } else {
      // --- Use the same pattern for SR1, SR2, and SR3
      const pageOffset = calculatePageOffset(bank);

      // --- Set up the lower page of the slot
      this.setPageInfo(2 * slot, pageOffset, bank, getCard(bank));

      // --- Set up the upper page of the slot
      this.setPageInfo(2 * slot + 1, pageOffset + 0x2000, bank, getCard(bank));
    }

    function getCard (bank: number): IZ88MemoryCard | null {
      if (bank >= 0x20 && bank <= 0x3f) {
        return thisObj._intRamCard;
      }
      return thisObj._cards[bank >> 6];
    }

    // --- Helper function to calculate the page offset for the specified bank.
    // --- Use the current slot's chip mask to calculate the offset.
    function calculatePageOffset (bank: number): number {
      // --- Obtain the chip mask for the current bank
      let sizeMask = thisObj._cards[bank >> 6]?.chipMask ?? 0x00;

      // --- We're using the internal RAM card
      if (bank >= 0x20 && bank <= 0x3f) {
        sizeMask = thisObj._intRamCard?.chipMask ?? 0x00;
      }
      return (
        ((bank < 0x40 ? bank & 0xe0 : bank & 0xc0) |
          (bank & sizeMask & 0x3f)) <<
        14
      );
    }
  }

  /**
   * Inserts the card into the specified slot
   * @memory The object responsible for memory management
   * @param slot The index of the slot to insert the card into
   * @param memoryCard The memory card to insert
   * @param initialContent The initial content of the card (ROM/EPROM/EEROM, other read-only memory)
   */
  insertCard (
    slot: number,
    memoryCard: IZ88MemoryCard,
    initialContent?: Uint8Array
  ): void {
    // --- Check the slot index
    if (slot < 0 || slot > 3) {
      throw new Error("Invalid slot index");
    }

    // --- Memory card must be defined
    if (!memoryCard) {
      throw new Error("The memory card must be defined");
    }

    // --- Insert the card into the slot
    this._cards[slot] = memoryCard;

    // --- Set up the memory pages as a new card is inserted
    this.recalculateMemoryPageInfo();

    if (initialContent) {
      // --- Check for right content size
      if (initialContent.length !== memoryCard.size) {
        throw new Error("Invalid initial content size");
      }

      // --- Write the contents directly into the memory
      const cardOffset = slot * 0x10_0000;
      for (let i = 0; i < memoryCard.size; i++) {
        this._memory[cardOffset + i] = initialContent[i];
      }
    }

    // --- Notify the card about the insertion
    if (memoryCard) {
      memoryCard.onInserted(slot * 0x10_0000);
    }
  }

  /**
   * Removes the card from the specified slot
   * @param slot The index of the slot to remove the card from
   */
  removeCard (slot: number): void {
    // --- Check the slot index
    if (slot < 0 || slot > 3) {
      throw new Error("Invalid slot index");
    }

    // --- Get the card to remove
    const card = this._cards[slot];

    // --- Remove the card from the slot
    this._cards[slot] = null;
    this.recalculateMemoryPageInfo();

    // --- Notify the card about the removal
    if (card) {
      card.onRemoved();
    }
  }

  /**
   * Gets the current partition values for all 8K slots. This method is used by the IDE to display memory
   * partition information.
   */
  getPartitions (): number[] {
    return this.bankData.map(b => b.bank);
  }

  /**
   * Gets the current partition labels for all 8K slots. This method is used by the IDE to display memory
   * partition information.
   */
  getPartitionLabels (): string[] {
    return this.bankData.map(b => {
      return b.bank === undefined ? "" : toHexa2(b.bank);
    });
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory (address: number): number {
    address &= 0xffff;
    const pageInfo = this.bankData[address >>> 13];
    if (!pageInfo.handler) {
      // --- Memory unavailable, generate random value
      const carry = this._rndSeed & 0x0001;
      this._rndSeed >>= 1;
      this._rndSeed ^= carry ? 0xb4b8 : 0x00b8;
      return this._rndSeed >> 8;
    }

    // --- Let the memory card handler do the job
    return pageInfo.handler.readMemory(pageInfo.offset, pageInfo.bank, address);
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param address 16-bit memory address to write
   * @param data Data to write
   */
  writeMemory (address: number, data: number): void {
    address &= 0xffff;
    const pageInfo = this.bankData[address >>> 13];
    if (!pageInfo.handler) {
      // --- Memory unavailable, ignore write
      return;
    }

    // --- Let the memory card handler do the job
    pageInfo.handler.writeMemory(pageInfo.offset, pageInfo.bank, address, data);
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    const flat64 = new Uint8Array(0x1_0000);
    const page0OffsL = this.getPartitionOffset(this.bankData[0].bank);
    for (let i = 0; i < 0x2000; i++) {
      flat64[i + 0x0000] = this.memory[page0OffsL + i];
    }
    const page0OffsH = this.getPartitionOffset(this.bankData[1].bank);
    for (let i = 0; i < 0x2000; i++) {
      flat64[i + 0x2000] = this.memory[page0OffsH + i];
    }
    const page1Offs = this.getPartitionOffset(this.bankData[2].bank);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0x4000] = this.memory[page1Offs + i];
    }
    const page2Offs = this.getPartitionOffset(this.bankData[4].bank);
    for (let i = 0; i < 0x4000; i++) {
      flat64[i + 0x8000] = this.memory[page2Offs + i];
    }
    const page3Offs = this.getPartitionOffset(this.bankData[6].bank);
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

  /**
   * Gets the offset of the specified partition
   * @param partition ROM index (from 0 to numRoms)
   */
  getPartitionOffset (partition: number): number {
    return partition * 0x4000;
  }

  /**
   * Sets the specified page with the provided attributes
   * @param page Page index
   * @param offset The start offset of the slot in the 4MB memory space
   * @param bank The bank mapped into the slot
   * @param handler The object handling the memory access for the slot (through a memory card)
   */
  private setPageInfo (
    page: number,
    offset: number,
    bank: number,
    handler?: IZ88MemoryCard
  ): void {
    if (page < 0 || page > 7) {
      throw new Error("Invalid page index");
    }

    // --- Truncate bank to 8-bit
    bank &= 0xff;

    // --- Set the slot info
    this._bankData[page] = {
      offset,
      bank,
      handler
    };
  }

  /**
   * Recalculates the memory page information to reflect the current memory card configuration
   */
  private recalculateMemoryPageInfo (): void {
    // --- A card might be inserted/removed, so we need to recalculate the memory page info
    // --- for all slots
    this.setMemoryPageInfo(0, this._bankData[0].bank, false);
    this.setMemoryPageInfo(0, this._bankData[1].bank, true);
    this.setMemoryPageInfo(1, this._bankData[2].bank);
    this.setMemoryPageInfo(2, this._bankData[4].bank);
    this.setMemoryPageInfo(3, this._bankData[6].bank);
  }

  // ==========================================================================
  // IZ88BankedMemoryTestSupport implementation

  get memory (): Uint8Array {
    return this._memory;
  }

  get bankData (): Z88PageInfo[] {
    return this._bankData.slice(0);
  }

  get rndSeed (): number {
    return this._rndSeed;
  }

  get cards (): IZ88MemoryCard[] | null {
    return this._cards.slice(0);
  }

  get intRamCard (): IZ88MemoryCard | null {
    return this._intRamCard;
  }

  setRamCard (card: IZ88MemoryCard): void {
    this._intRamCard = card;
  }
}

/**
 * Represents the members we add for testing purposes
 */
export interface IZ88BankedMemoryTestSupport {
  /**
   * Gets the memory buffer
   */
  readonly memory: Uint8Array;

  /**
   * Gets the bank data
   */
  readonly bankData: Z88PageInfo[];

  /**
   * Gets the random seed
   */
  readonly rndSeed: number;

  /*
   * Gets the memory cards
   */
  readonly cards: IZ88MemoryCard[] | null;

  /**
   * Gets the internal RAM card
   */
  readonly intRamCard: IZ88MemoryCard | null;

  /**
   * Sets the internal RAM card
   * @param card The new internal RAM card
   */
  setRamCard(card: IZ88MemoryCard): void;
}
