import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";

/**
 * The ID of a custom Z80 disassembler for a virtual machine
 */
export const CUSTOM_Z80_DISASSEMBLY_TOOL = "CustomZ80Disassembly";

/**
 * Describes the disassembly item of a custom disassembler
 */
export type CustomDisassemblyItem = {
  /**
   * Disassembly item resulted from the disassembly. Undefined, if no custom
   * disassembly item has been generated
   */
  item?: DisassemblyItem;

  /**
   * True, if custom disassembly should go on
   */
  carryOn: boolean;
};

/**
 * This interface defines the API Klive offers for custom disassemblers
 */
export interface IDisassemblyApi {
  /**
   * Use decimal mode?
   */
  readonly decimalMode: boolean;
  /**
   * Represents the contents of the memory to disassemble
   */
  getMemoryContents(): Uint8Array;

  /**
   * Current disassembly offset
   */
  getOffset(): number;

  /**
   * Fetches the next byte from the stream to disassemble
   */
  fetch(): FetchResult;

  /**
   * Peeks the opcode without fetching it
   * @param ahead Look-ahead from the current position, by default, zero.
   */
  peek(ahead?: number): FetchResult;

  /**
   * Add a new disassembly item to the output
   * @param item
   */
  addDisassemblyItem(item: DisassemblyItem): void;

  /**
   * Creates a label for the specified address
   * @param address Addres to create a label from
   */
  createLabel(address: number): void;
}

/**
 * A virtual machine can implement this interface to sign that it supports custom disassembly
 */
export interface ICustomDisassembler {
  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api API to use for disassembly
   * @param machine The virtual machine instance
   */
  setDisassemblyApi(api: IDisassemblyApi): void;

  /**
   * The disassembler starts disassembling a memory section
   * @param section 
   */
  startSectionDisassembly(section: MemorySection): void;

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(fecthResult: FetchResult): boolean;

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param item Disassembled item
   */
  afterInstruction(item: DisassemblyItem): void;
}