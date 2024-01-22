import { MachineConfigSet } from "@common/machines/info-types";
import { IZ88BlinkDevice } from "../IZ88BlinkDevice";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { Z88PageInfo } from "./Z88PageInfo";
import { IZ88MemoryOperation } from "./IZ88MemoryOperation";

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
  private readonly _bankData: Z88PageInfo[];
  private readonly _memory: Uint8Array;

  constructor (
    private readonly blink: IZ88BlinkDevice,
    public readonly config: MachineConfigSet,
    rndSeed = 0
  ) {
    // --- We allocate the entire 4MB memory
    this._memory = new Uint8Array(0x10_0000);

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
   * Sets the specified page with the provided attributes
   * @param page Page index
   * @param offset The start offset of the slot in the 4MB memory space
   * @param bank The bank mapped into the slot
   * @param handler The object handling the memory access for the slot (through a memory card)
   */
  setPageInfo (
    page: number,
    offset: number,
    bank: number,
    handler?: IZ88MemoryOperation
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
   * Gets the current partition values for all 16K slots
   */
  getPartitions (): number[] {
    return this.bankData.map(b => b.bank);
  }

  /**
   * Gets the current partition labels for all 16K slots
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
    const pageInfo = this.bankData[address >>> 14];
    if (!pageInfo.handler) {
      // --- Memory unavailable, ignore write
      return;
    }

    // --- Let the memory card handler do the job
    pageInfo.handler.writeMemory(pageInfo.offset, pageInfo.bank, address, data);
  }

  // ==========================================================================
  // IZ88BankedMemoryTestSupport implementation

  get memory (): Uint8Array {
    return this._memory;
  }

  get bankData (): Z88PageInfo[] {
    return this._bankData.slice(0);
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
}

