import { 
  BaseDisassemblyOptions,
  BaseFetchResult,
  BaseDisassemblyItem,
  BaseDisassemblyOutput,
  BaseMemorySection,
  BaseMemoryMap
} from "../disassemblers/common-types";
import { 
  processMessages as baseProcessMessages, 
  toSbyte as baseToSbyte, 
  toSshort as baseToSshort, 
  intToX2 as baseIntToX2, 
  intToX4 as baseIntToX4 
} from "../disassemblers/utils";

// Re-export utility functions to maintain backward compatibility
export const processMessages = baseProcessMessages;
export const toSbyte = baseToSbyte;
export const toSshort = baseToSshort;
export const intToX2 = baseIntToX2;
export const intToX4 = baseIntToX4;

/**
 * Z80-specific fetch result that extends the base fetch result
 */
export interface FetchResult extends BaseFetchResult {
  /**
   * The optional partition
   */
  partitionLabel?: string;
}

/**
 * Z80-specific disassembly options
 */
export interface DisassemblyOptions extends BaseDisassemblyOptions {
  allowExtendedSet?: boolean;
}

/**
 * Z80-specific disassembly item that extends the base disassembly item
 */
export interface DisassemblyItem extends BaseDisassemblyItem {
  /**
   * Optional partition of an extended address
   */
  partition?: string;

  /**
   * The number of T-states consumed by the instruction
   */
  tstates?: number;

  /**
   * The number of T-states consumed by the instruction (alternative)
   */
  tstates2?: number;
}

/**
 * Z80-specific disassembly output that extends the base disassembly output
 */
export class DisassemblyOutput extends BaseDisassemblyOutput<DisassemblyItem> {
}

/**
 * Z80-specific memory section types that extend the base types
 */
export enum MemorySectionType {
  /**
   * Simply skip the section without any output code generation
   */
  Skip = 0,

  /**
   * Create Z80 disassembly for the memory section
   */
  Disassemble = 1,

  /**
   * Create a byte array for the memory section
   */
  ByteArray = 2,

  /**
   * Create a word array for the memory section
   */
  WordArray = 3,

  /**
   * Create an RST 28 bytecode memory section
   */
  CustomSection = 4
}

/**
 * Z80-specific memory section that extends the base memory section
 */
export class MemorySection extends BaseMemorySection<MemorySectionType> {
  private _custom: string | null = null;

  /**
   * Gets the subtype of a custom section
   */
  get customType(): string | null {
    return this._custom;
  }

  /**
   * Creates a MemorySection with the specified properties
   * @param startAddress Starting address
   * @param endAddress Ending address (inclusive)
   * @param sectionType Section type
   */
  constructor(
    startAddress: number,
    endAddress: number,
    sectionType = MemorySectionType.Disassemble
  ) {
    super(startAddress, endAddress, sectionType);
  }

  /**
   * Gets the intersection of the two memory sections
   * @param other Other memory section
   * @return Intersection, if exists; otherwise, undefined
   */
  intersect(other: MemorySection): MemorySection | undefined {
    let intStart = -1;
    let intEnd = -1;
    if (other.startAddress >= this.startAddress && other.startAddress <= this.endAddress) {
      intStart = other.startAddress;
    }
    if (other.endAddress >= this.startAddress && other.endAddress <= this.endAddress) {
      intEnd = other.endAddress;
    }
    if (this.startAddress >= other.startAddress && this.startAddress <= other.endAddress) {
      intStart = this.startAddress;
    }
    if (this.endAddress >= other.startAddress && this.endAddress <= other.endAddress) {
      intEnd = this.endAddress;
    }
    return intStart < 0 || intEnd < 0
      ? undefined
      : new MemorySection(intStart, intEnd);
  }
}

/**
 * Z80-specific memory map that extends the base memory map
 */
export class MemoryMap extends BaseMemoryMap<MemorySection> {
  /**
   * Creates a new section instance
   */
  protected createSection(startAddress: number, endAddress: number, sectionType: MemorySectionType): MemorySection {
    return new MemorySection(startAddress, endAddress, sectionType);
  }

  /**
   * Gets the default section type for disassembly
   */
  protected getDefaultDisassemblySectionType(): MemorySectionType {
    return MemorySectionType.Disassemble;
  }
}


