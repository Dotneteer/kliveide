/**
 * Z88 UV Eprom 32K, 128K and 256K card emulation.
 * Full description of UV Eprom chip programming on the Z88 can be read here:
 * https://cambridgez88.jira.com/wiki/spaces/DN/pages/3113003/EPROMs
 *
 * Klive implemention based on UV Eprom class in OZvm,
 * https://gitlab.com/b4works/ozvm/-/blob/master/src/com/gitlab/z88/ozvm/EpromBank.java
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";

export class Z88UvEpromMemoryCard extends Z88MemoryCardBase {
  type: CardType;

  /**
   * The memory offset where the card is inserted
   */
  private memOffset = -1;

  /**
   * Initializes the card with the specified size
   */
  constructor (public readonly host: IZ88Machine, public readonly size: number) {
    super(host, size);

    this.type =
      size === 0x8000 ? CardType.EpromVpp32KB : CardType.EpromVpp128KB;
  }

  /**
   * Reads the byte at the specified memory address
   *
   * @param memOffset The 8K page base address of bound CPU <address> (in 4Mb range)
   * @param bank The (absolute) 16K bank, of bound CPU <address>
   * @param address 16-bit (64K) CPU logical address
   * @returns The read byte
   */
  readMemory (memOffset: number, bank: number, address: number): number {
    // Read behaviour of an UV Eprom is just like ROM or RAM...
    return this.host.memory.memory[memOffset + (address & 0x1fff)];
  }

  /**
   * "Blows" the specified byte at the given 16-bit memory address in slot 3
   * Blowing a byte to an UV Eprom requires the card to be in slot 3 (banks C0h-FFh),
   * Blink hardware has turned off screen, enabled VPP pin and EPR register semantics.
   *
   * If all conditions are not met, the write operation is ignored (cannot blow byte)
   *
   * @param memOffset The 8K page base address of bound CPU <address> (in 4Mb range)
   * @param bank The (absolute) 16K bank, of bound CPU <address>
   * @param address 16-bit (64K) CPU logical address
   * @param byte the byte to blow to UV Eprom (if H/W is active)
   */
  writeMemory (
    memOffset: number,
    bank: number,
    address: number,
    byte: number
  ): void {
    const blinkEpr = this.host.blinkDevice.EPR;
    const blinkCom = this.host.blinkDevice.COM;

    // are we in slot 3?
    if (bank < 0xc0) {
      return; // no, ignore write operation (no effect anyway - it's a ROM)
    }

    if (
      (blinkCom & COMFlags.VPPON) != 0 &&
      ((blinkCom & COMFlags.PROGRAM) != 0 || (blinkCom & COMFlags.OVERP) != 0)
    ) {
      // We're somwhere in slot 3, VPP enabled and either programming or overprogramming enabled

      switch (this.type) {
        case CardType.EpromVpp32KB:
          if (blinkEpr !== 0x48) {
            // Blink EPR register setting doesn't fit for this "chip"; byte cannot be blown on 32K Eprom
            return;
          }
          break;

        case CardType.EpromVpp128KB:
          if (blinkEpr !== 0x69) {
            // byte cannot be blown on 128K/256 Eprom
            return;
          }
          break;
      }

      // get the current bits from address
      const byte0 = this.host.memory.memory[memOffset + (address & 0x1fff)];
      // blow byte according to Eprom hardware rule (Eprom memory bit pattern can be changed from 1 to 0)
      this.host.memory.memory[memOffset + (address & 0x1fff)] = byte & byte0;
    }
  }

  /**
   * This method is invoked when the UV Eprom card is inserted into the memory
   * @param memOffset the 22bit-address of the bottom the slot where the card is inserted
   */
  onInserted (memOffset: number): void {
    this.memOffset = memOffset;
    this.setPristineState();
  }

  /**
   * Sets the UV Eprom card to it's pristine state (FFh)
   */
  setPristineState (): void {
    for (let i = 0; i < this.size; i++) {
      this.host.memory.memory[this.memOffset + i] = 0xff;
    }
  }
}
