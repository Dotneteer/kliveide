/**
 * Z88 Intel I28F004S5 (512K), I28F008S5 (1Mb) Flash card emulation.
 *
 * Klive implemention based on Intel Flash class in OZvm,
 * https://gitlab.com/b4works/ozvm/-/blob/master/src/com/gitlab/z88/ozvm/IntelFlashBank.java
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";

export class Z88IntelFlashMemoryCard extends Z88MemoryCardBase {
  type: CardType;

  /**
   * The memory offset where the card is inserted
   */
  memOffset = -1;

  /**
   * Initializes the card with the specified size (512K or 1024K)
   */
  constructor (public readonly host: IZ88Machine, public readonly size: number) {
    super(host, size);

    this.type =
      size === 0x8_0000 ? CardType.FlashIntel28F004S5 : CardType.FlashIntel28F008S5;
  }

  /**
   * Reads the byte at the specified memory address
   *
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param _bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @returns The read byte
   */
  readMemory (memOffset: number, _bank: number, address: number): number {
    // Read behaviour of a Intel Flash (when in Read Array mode) is just like EPROM...
    return this.host.memory.memory[memOffset + (address & 0x1fff)];
  }

  /**
   * "Blows" the specified byte at the given 16-bit memory address
   */
  writeMemory (
    memOffset: number,
    bank: number, // the bank of current address
    address: number, // the 64K logical address from Z80
    byte: number // the byte to blow to Intel Flash card
  ): void {

    const blinkCom = this.host.blinkDevice.COM;

    // get the current bits from address
    const byte0 = this.host.memory.memory[memOffset + (address & 0x1fff)];
    // blow byte according to Flash hardware rule (memory bit pattern can be changed from 1 to 0)
    this.host.memory.memory[memOffset + (address & 0x1fff)] = byte & byte0;
  }

  /**
   * This method is invoked when the card is inserted into the memory
   * @param memOffset Memory offset where the card is inserted
   */
  onInserted (memOffset: number): void {
    this.memOffset = memOffset;
    this.setPristineState();
  }

  /**
   * Sets the Intel Flash card to it's pristine state (FFh)
   */
  setPristineState (): void {
    for (let i = 0; i < this.size; i++) {
      this.host.memory.memory[this.memOffset + i] = 0xff;
    }
  }
}
