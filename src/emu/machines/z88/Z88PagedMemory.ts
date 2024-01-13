import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { PagedMemory } from "../memory/PagedMemory";
import { AccessType, IZ88BlinkDevice } from "./IZ88BlinkDevice";

export class Z88PagedMemory extends PagedMemory {
  private _rndSeed: number;

  constructor (
    // --- Number of banks
    public readonly numBanks: number,
    private readonly blink: IZ88BlinkDevice,
    rndSeed = 0
  ) {
    super(0, numBanks);
    this._rndSeed = rndSeed;
  }

  /**
   * Reads the byte at the specified memory address
   * @param address 16-bit memory address to read
   */
  readMemory (address: number): number {
    address &= 0xffff;
    const accessType = this.blink.getAccessTypeOfAddress(address);
    if (accessType === AccessType.Unavailable) {
      const carry = this._rndSeed & 0x0001;
      this._rndSeed >>= 1;
      this._rndSeed ^= carry ? 0xb4b8 : 0x00b8;
      return this._rndSeed >> 8;
    }
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
    const accessType = this.blink.getAccessTypeOfAddress(address);
    if (accessType !== AccessType.Ram) {
      return;
    }
    this.memory[pageInfo.offset + pageOffset] = data;
  }

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getPartitionLabels (): string[] {
    return this.bankData.map(b => {
      if (b.partition === undefined) {
        return "";
      }
      if (b.partition < 0) {
        return `R${-(b.partition + 1)}`;
      }
      return toHexa2(b.partition);
    });
  }
}
