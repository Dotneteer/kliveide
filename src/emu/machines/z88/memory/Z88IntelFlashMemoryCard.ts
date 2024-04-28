/**
 * Z88 Intel I28F004S5 (512K), I28F008S5 (1Mb) Flash card emulation.
 *
 * Klive implemention based on Intel Flash class in OZvm,
 * https://gitlab.com/b4works/ozvm/-/blob/master/src/com/gitlab/z88/ozvm/IntelFlashBank.java
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";

export class Z88IntelFlashMemoryCard extends Z88MemoryCardBase {

  /**
   * The Intel Flash card type is 16bits and contains Manufacturer and Device code
   * (upper 8 bits is Manufacturer code, lower 8 bits Device code)
   */
  type: CardType;

  /**
   * The memory offset where the card is inserted
   */
  private memOffset = -1;

  /**
   * Read Array Mode
   * True = Intel Flash Memory behaves like an Eprom, False = command mode
   *
   * Read Array Mode state applies for the complete chip (in slot)
   */
  private readArrayMode: boolean;

  /**
   * The command code of the executing command.
   * Set to 0, when no command is executing (readArrayMode = true).
   */
  private executingCommandCode: number;

  /**
   * The Command Mode Status Register.
   * Holds the status bits for success/failure when programming a byte or erasing a 64K sector.
   *
   * Set to 0, when no command is executing (readArrayMode = true).
   */
  private statusRegister: number;

  /**
   * Fetch success/failure status or chip information from the executing Flash
   * Memory command.
   *
   * @param bank
   * @param address 22bit absolute address in Intel flash chip
   * @returns command status information or device data
   */
  private getCommandStatus(bank: number, address: number): number {
    switch (this.executingCommandCode) {
      case 0x10: // Byte Program Command
      case 0x40: // Byte Program Command
      case 0x70: // Read Status Register
      case 0xD0: // Block Erase Command
        return this.statusRegister;

      case 0x90: // Get Device Identification
        if ((bank & 0x3f) == 0) {
          // Device and Manufacturer Code can only be fetched in bottom bank (0) of card
          switch (address & 0x1fff) {
            case 0:
              return this.type >> 8;      // (address) 0000 = Manufacturer Code
            case 1:
              return this.type & 0xff;    // (address) 0001 = Device Code
            default:
              return 0xff;                // (address) XXXX = Unknown behaviour...
          }
        } else {
          return 0xff;                    // (address in another bank) Unknown behaviour...
        }

      default: // unknown command!
        return 0xff;
    }
  }

  /**
   * Blow Byte at 22bit address.
   *
   * Verify that the byte to be blown follows the rule that only 0 bit
   * patterns can be programmed (converting 1 to 0 in the Flash Memory). Flash
   * memory bit patterns can only be converted from 0 to 1 by erasing the
   * memory...
   *
   * If the byte is successfully written, this method will signal success by
   * establishing a read status, which the outside application polls and
   * acknowledges as successfully completed.
   *
   * On Byte Write failure a similar read status data will signal failure. The
   * application must then signal back with forcing the chip back into Read
   * Array Mode.
   *
   * @param address 22bit absolute address in Intel flash chip (of slot)
   * @param b byte to be blown to Intel Flash Memory
   */
  private programByteAtAddress(address: number, b: number) {
    // get the current bits from address
    const byte0 = this.host.memory.memory[address];

    if ((b & byte0) == b) {
      // blow byte according to Flash hardware rule (memory bit pattern can be changed from 1 to 0)
      this.host.memory.memory[address] = b;

      // indicate success when application polls for read status cycles...
      this.statusRegister = 0x80; // SR.7 = Ready, SR.4 = 0 (Program OK), SR.3 = 0 (VPP OK)
    } else {
      // the byte will break the rule that a 0 bit cannot be programmed
      // to a 1, but only through a block erase.
      this.statusRegister = 0x90; // SR.7 = Ready, SR.4 = 1 (Program Error), SR.3 = 0 (VPP OK)
    }
  }

  /**
   * Erase the Flash Memory 64K sector which specified bank is part of.
   * PS: should we simulate erase error as experiments?
   *     (statusRegister = 0xA8; // SR.7 = Ready, SR.5 = 1 (Block Erase Error), SR.3 = 1 (no VPP))
   *
   * @param bank the (absolute) bank number (given via databus address) where the Intel Flash Card resides
   */
  private eraseSectorCommand(bank: number) {
    // all known Intel Flash chips uses a 64K sector architecture, so erase
    // the bottom bank of the current sector and the next three following 16K banks
    const bottomBankOfSector = bank & 0x3c;  // (relative) bottom bank (of current slot)
    // define base address of sector: bottom of slot base address + (relative slot bank number * 16K)
    const sectorStartAddress = this.memOffset + (bottomBankOfSector * 0x4000);

    // format 64K sector (with 0xff)
    for (let i = 0; i <= 0xffff; i++) {
      this.host.memory.directWrite(sectorStartAddress + i, 0xff);
    }

    // indicate success when application polls for read status cycles...
    // SR.7 = Ready, SR.5 = 0 (Block Erase OK), SR.4 = 0 (Program OK), SR.3 = 0 (VPP OK)
    this.statusRegister = 0x80;
  }

  /**
   * Process each command cycle sent to the Command Decoder, and execute the
   * parsed command, once it has been identified. If a command cycle is not
   * recognized as being a part of a command (address/data) sequence, the chip
   * automatically returns to Read Array Mode. Equally, if a read cycle is
   * performed against the Command Decoder while it is expecting a command
   * write cycle, the chip automatically returns to Read Array Mode.
   *
   * @param bank
   * @param address 22bit absolute address in Intel flash chip (of slot)
   * @param b
   */
  private processCommand(bank: number, address: number, b: number) {
    if (this.readArrayMode == true) {
      // get into command mode...
      this.readArrayMode = false;
      this.executingCommandCode = 0;
    }

    if (this.readArrayMode == false) {
      if (this.executingCommandCode == 0x10 || this.executingCommandCode == 0x40) {
        // Byte Program Command, Part 2 (initial Byte Program command received),
        // we've fetched the Byte Program Address & Data, programming will now begin...
        this.programByteAtAddress(address, b);
        this.executingCommandCode = 0x70;
        return;
      }

      switch (b) {
        case 0x20:  // Erase Command, part 1
          // wait for new sub command sequence for erase block
          this.executingCommandCode = 0x20;
          break;

        case 0x50: // Clear Status Register
          this.executingCommandCode = 0;
          // SR.7 = Ready, SR.5 = 0 (Block Erase OK), SR.4 = 0 (Program OK), SR.3 = 0 (VPP OK)
          this.statusRegister = 0x80;
          break;

        case 0x70: // Read Status Register
          // The Read Cycle will return the status register...
          this.executingCommandCode = 0x70;
          break;

        case 0x90:  // Chip Identification (get Manufacturer & Device Code)
          this.executingCommandCode = 0x90;
          break;

        case 0x10:
        case 0x40:  // Byte Program Command, Part 1, get address and byte to program..
          this.executingCommandCode = 0x40;
          break;

        case 0xd0: // Sector Erase Command (which this bank is part of), part 2
          if (this.executingCommandCode == 0x20) {
            this.executingCommandCode = 0xD0;
            this.eraseSectorCommand(bank); // always successful (no error simulation)
          }
          break;

        case 0xff:  // Reset chip to Read Arrary Mode
          this.readArrayMode = true;
          this.executingCommandCode = 0;
          break;

        default:
          // command was not identified; Either 2. part of a prev. command or unknown...
          this.readArrayMode = true;
          this.executingCommandCode = 0;
      }
    }
  }

  /**
   * Initializes the Intel Flash card with the specified size (512K or 1024K)
   * and defines type accordingly.
   */
  public constructor (public readonly host: IZ88Machine, public readonly size: number) {
    super(host, size);

    this.readArrayMode = true;
    this.type =
      size === 0x8_0000 ? CardType.FlashIntel28F004S5 : CardType.FlashIntel28F008S5;
  }

  /**
   * Expose the current Read Array Mode status to the emulating environment
   *
   * @returns true if the Intel Flash chip is in Read Array Mode, false when in command mode
   */
  public readArrayModeState(): boolean {
    return this.readArrayMode;
  }

  /**
   * Reads the byte at the specified memory address of Intel Flash Card
   *
   * @param memOffset The 8K page base address of bound CPU <address> (in 4Mb range)
   * @param bank The (absolute) 16K bank, of bound CPU <address>
   * @param address 16-bit (64K) CPU logical address
   * @returns The byte read from Intel Flash card
   */
  public readMemory (memOffset: number, bank: number, address: number): number {
    const _22bitaddr = memOffset + (address & 0x1fff);

    // Read behaviour of a Intel Flash (when in Read Array mode) is just like EPROM...
    if (this.readArrayMode == true) {
      return this.host.memory.memory[_22bitaddr];
    } else {
      // The chip is in Command Mode, get status of current command
      return this.getCommandStatus(bank, _22bitaddr);
    }
  }

  /**
   * "Blows" the specified byte at the given 16-bit CPU memory address using
   * Intel Flash command sequences
   *
   * @param memOffset The 8K page base address of bound CPU <address> (in 4Mb range)
   * @param bank The (absolute) 16K bank, of bound CPU <address>
   * @param address 16-bit (64K) CPU logical address
   * @param byte
   */
  public writeMemory (
    memOffset: number,
    bank: number, // the bank of current address
    address: number, // the 64K logical address from Z80
    byte: number // the byte to blow to Intel Flash card
  ): void {
    // deliver 16bit -> 22bit address of Intel Flash Card
    this.processCommand(bank, memOffset + (address & 0x1fff), byte);
  }

  /**
   * This method is invoked when the Intel flash card is inserted into the memory
   * @param memOffset the address of the bottom the slot where the card is inserted
   */
  public onInserted (memOffset: number): void {
    this.memOffset = memOffset;
    this.setPristineState();

    // When a card is inserted into a slot, the Flash chip is always in Ready Array Mode by default
    this.readArrayMode = true;
    this.executingCommandCode = this.statusRegister = 0x80;
  }

  /**
   * Sets the Intel Flash card to it's pristine state (FFh)
   */
  public setPristineState (): void {
    for (let i = 0; i < this.size; i++) {
      this.host.memory.memory[this.memOffset + i] = 0xff;
    }
  }
}
