/**
 * Z88 AMD Flash Chip (generic protocol) emulation.
 *
 * Klive implemention based on Amd Flash class in OZvm,
 * https://gitlab.com/b4works/ozvm/-/blob/master/src/com/gitlab/z88/ozvm/IntelFlashBank.ava
 *
 * The emulation of the AMD and compatible Flash Memory solely implements the
 * chip command mode programming, since the Z88 Flash Cards only responds to
 * those command sequences (and not the hardware pin manipulation). Erase
 * Suspend and Erase Resume commands are also not implemented.
 *
 */

import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88MemoryCardBase } from "./Z88MemoryCardBase";


class Stack<T> {
  private _store: T[] = [];

  push(val: T) {
    this._store.push(val);
  }

  pop(): T | undefined {
    return this._store.pop();
  }
}


export class Z88AmdFlashMemoryCard extends Z88MemoryCardBase {

  /**
   * The AMD Flash card type is 16bits and contains Manufacturer and Device code
   * (upper 8 bits is Manufacturer code, lower 8 bits Device code)
   */
  public type: CardType;

  /**
   * The memory offset where the card is inserted
   */
  private memOffset = -1;

  /**
   * A command sequence consists of two unlock cycles, followed by a command
   * code cycle. Each cycle consists of an address and a: sub command code:
   * first cycle is [0x555,0xAA], the second cycle is [0x2AA, 0x55] followed
   * by the third cycle which is the command ('?') code (the actual command
   * will then be verified against known codes).
   */
  private readonly commandUnlockCycles: number[] = [0x555, 0xAA, 0x2AA, 0x55, 0x555, Number('?')];

  /**
   * Indicate success by DQ5 = 0 and DQ6 = 1, signaling no toggle in two
   * consecutive read cycles.
   */
  private readonly readStatusCommandSuccess: number[] = [0x40, 0x40];

  /**
   * Indicate failure by DQ5 = 1 and DQ6 toggling, for each consecutive read
   * cycle. The following bit patterns illustrate the sequence (from left to
   * right):
   * [1] 0110 0000 (DQ6=1,DQ5=1),
   * [2] 0010 0000 (DQ6=0,DQ5=1),
   * [3] 0110 0000 (DQ6=1,DQ5=1),
   * [4] 0010 0000 (DQ6=0,DQ5=1)
   */
  private readonly readStatusCommandFailure: number[] = [0x60, 0x20, 0x60, 0x20];

  /**
   * (Device level)
   *
   * The pending command sequence which is the template that is being
   * validated against the incoming command cycles (the processor write byte
   * cycles)
   */
  private commandUnlockCycleStack: Stack<Number>;

  /**
   * (Device level)
   *
   * Read Array Mode<p> True = Amd Flash Memory behaves like an Eprom, False =
   * command mode
   *
   * Read Array Mode state applies for the complete slot which this bank is
   * part of.
   */
  private readArrayMode: boolean;

  /**
   * (Device level)
   *
   * Set to True, if a command reports failure, which continues to display the
   * error toggle through the read status cycle.
   */
  private signalCommandFailure: boolean;

  /**
   * (Device level)
   *
   * Whenever a Flash memory command has executed it's functionality, it
   * begins to feed read status sequences back to the application (which polls
   * for status using read cycles). This stack will contain read status
   * sequences for commands reporting success or failure.
   */
  private readStatusStack: Stack<Number>;

  /**
   * (Device level)
   *
   * Status of ongoing accumulation of Flash Memory command, [<b>true</b>]
   * (ie. the individual cycles are accumulating and being verified as each
   * cycle is accumulated). A command sequence consists of three cycles; two
   * unlock cycles followed by the command code (The Erase commands consists
   * of two sections of three cycle command sequences).
   */
  private isCommandAccumulating: boolean;

  /**
   * (Device level)
   *
   * Indicate if a command is being executed [<b>true</b>] (Blow Byte, Erase
   * Sector/Chip or Auto-Select Mode command).
   */
  private isCommandExecuting: boolean;

  /**
   * (Device level)
   *
   * The command code of the executing command. Is set to 0, when no command
   * is executing (isCommandExecuting = false).
   */
  private executingCommandCode: number;

  /**
   * Initializes the AMD Flash card with the specified size (512K or 1024K)
   * Type is defined by derived class.
   */
  public constructor (public readonly host: IZ88Machine, public readonly size: number) {
    super(host, size);

    this.readArrayMode = true;
    this.type = CardType.None; // base class, type is defined in specific Amd chip
  }

  /**
   * Expose the current Read Array Mode status to the emulating environment
   *
   * @returns true if the AMD Flash chip is in Read Array Mode, false when in command mode
   */
  public readArrayModeState(): boolean {
    return this.readArrayMode;
  }

  /**
   * Reads the byte at the specified memory address of AMD Flash Card
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
      return 0; // this.getCommandStatus(bank, _22bitaddr);
    }
  }

  /**
   * "Blows" the specified byte at the given 16-bit CPU memory address using
   * AMD Flash command sequences
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
    // this.processCommand(bank, memOffset + (address & 0x1fff), byte);
  }

  /**
   * This method is invoked when the AMD flash card is inserted into the memory
   * @param memOffset the address of the bottom the slot where the card is inserted
   */
  public onInserted (memOffset: number): void {
    this.memOffset = memOffset;
    this.setPristineState();

    // When a card is inserted into a slot, the Flash chip
    // is always in Ready Array Mode by default
    this.readArrayMode = true;
    this.isCommandAccumulating = false;
    this.isCommandExecuting = false;
  }

  /**
   * Sets the AMD Flash card to it's pristine state (FFh)
   */
  public setPristineState (): void {
    for (let i = 0; i < this.size; i++) {
      this.host.memory.memory[this.memOffset + i] = 0xff;
    }
  }
}
