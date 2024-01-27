import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";

export class Z88UvEpromMemoryCard extends Z88MemoryCardBase {
  constructor (
    public readonly host: IZ88Machine,
    public readonly type: CardType,
    public readonly size: number
  ) {
    super(host, size);
  }

  /**
   * Reads the byte at the specified memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param _bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @returns The read byte
   */
  readMemory (memOffset: number, _bank: number, address: number): number {
    // TODO: Implement UV EPROM memory card read specifics
    return this.host.memory.memory[memOffset + (address & 0x1fff)];
  }

  /**
   * Writes the specified data byte at the given 16-bit memory address
   */
  writeMemory (
    memOffset: number,
    bank: number,
    address: number, // "addr" in OZVM source
    data: number // "b" in OZVM sourcve 
  ): void {
    // TODO: Implement UV EPROM memory card write specifics
    // int com = blink.getCom();
    //     int epr = blink.getEpr();
    //     if (((com & Blink.BM_COMLCDON) == 0) && ((com & Blink.BM_COMVPPON) != 0)
    //             && ((com & Blink.BM_COMPROGRAM) != 0) || ((com & Blink.BM_COMOVERP) != 0)) {
    //         // LCD turned off, VPP enabled and either programming or overprogramming enabled for slot 3...
    //         switch (eprType) {
    //             case VPP32KB:
    //                 if (epr != 0x48) {
    //                     return; // Epr setting doesn't fit; byte cannot be blown on 32K Eprom
    //                 }
    //                 break;
    //             case VPP128KB:
    //                 if (epr != 0x69) {
    //                     return; // Epr setting doesn't fit; byte cannot be blown on 128K/256K Eprom
    //                 }
    //                 break;
    //         }
  }
}
