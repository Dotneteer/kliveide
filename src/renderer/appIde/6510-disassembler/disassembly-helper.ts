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
  intToX4 as baseIntToX4,
  toDecimal3 as baseToDecimal3,
  toDecimal5 as baseToDecimal5
} from "../disassemblers/utils";

// Re-export utility functions to maintain backward compatibility
export const processMessages = baseProcessMessages;
export const toSbyte = baseToSbyte;
export const toSshort = baseToSshort;
export const intToX2 = baseIntToX2;
export const intToX4 = baseIntToX4;
export const toDecimal3 = baseToDecimal3;
export const toDecimal5 = baseToDecimal5;

/**
 * M6510-specific fetch result that extends the base fetch result
 */
export interface M6510FetchResult extends BaseFetchResult {
}

/**
 * M6510-specific disassembly options
 */
export interface M6510DisassemblyOptions extends BaseDisassemblyOptions {
}

/**
 * M6510-specific disassembly item that extends the base disassembly item
 */
export interface M6510DisassemblyItem extends BaseDisassemblyItem {
  /**
   * The number of cycles consumed by the instruction
   */
  cycles?: number;
}

/**
 * M6510-specific disassembly output that extends the base disassembly output
 */
export class M6510DisassemblyOutput extends BaseDisassemblyOutput<M6510DisassemblyItem> {
}

/**
 * This class describes a label with its references
 */
export class M6510DisassemblyLabel {
  /**
   * Label address
   */
  address: number;

  /**
   * Addresses of instructions that reference this label
   */
  readonly references: Array<number>;

  /**
   * Initializes disassembly label information
   * @param address Label address
   */
  constructor(address: number) {
    this.address = address;
    this.references = new Array<number>();
  }
}

/**
 * This enumeration represents the memory section types that can be used
 * when disassembling a 6510 project.
 */
export enum M6510MemorySectionType {
  /**
   * Simply skip the section without any output code generation
   */
  Skip,

  /**
   * Create 6510 disassembly for the memory section
   */
  Disassemble,

  /**
   * Create a byte array for the memory section
   */
  ByteArray,

  /**
   * Create a word array for the memory section
   */
  WordArray
}

/**
 * M6510-specific memory section that extends the base memory section
 */
export class M6510MemorySection extends BaseMemorySection<M6510MemorySectionType> {
  /**
   * Creates a M6510MemorySection with the specified properties
   * @param startAddress Starting address
   * @param endAddress Ending address (inclusive)
   * @param sectionType Section type
   */
  constructor(
    startAddress: number,
    endAddress: number,
    sectionType = M6510MemorySectionType.Disassemble
  ) {
    super(startAddress, endAddress, sectionType);
  }

  /**
   * Checks if this memory section overlaps with the other one
   * @param other Other memory section
   * @return True, if the sections overlap
   */
  overlaps(other: M6510MemorySection): boolean {
    return (
      (other.startAddress >= this.startAddress && other.startAddress <= this.endAddress) ||
      (other.endAddress >= this.startAddress && other.endAddress <= this.endAddress) ||
      (this.startAddress >= other.startAddress && this.startAddress <= other.endAddress) ||
      (this.endAddress >= other.startAddress && this.endAddress <= other.endAddress)
    );
  }

  /**
   * Checks if this section has the same start and length than the other
   * @param other Other memory section
   * @return True, if the sections have the same start and length
   */
  sameSection(other: M6510MemorySection): boolean {
    return this.startAddress === other.startAddress && this.endAddress === other.endAddress;
  }

  /**
   * Gets the intersection of the two memory sections
   * @param other Other memory section
   * @return Intersection, if exists; otherwise, undefined
   */
  intersect(other: M6510MemorySection): M6510MemorySection | undefined {
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
      : new M6510MemorySection(intStart, intEnd);
  }

  /**
   * Checks if this memory section equals with the other
   * @param other Other memory section
   */
  equals(other: M6510MemorySection): boolean {
    return (
      this.startAddress === other.startAddress &&
      this.endAddress === other.endAddress &&
      this.sectionType === other.sectionType
    );
  }
}

/**
 * M6510-specific memory map that extends the base memory map
 */
export class M6510MemoryMap extends BaseMemoryMap<M6510MemorySection> {
  /**
   * Creates a new memory section of the appropriate type
   */
  createSection(startAddress: number, endAddress: number, sectionType: M6510MemorySectionType): M6510MemorySection {
    return new M6510MemorySection(startAddress, endAddress, sectionType);
  }

  /**
   * Gets the default disassembly section type
   */
  getDefaultDisassemblySectionType(): M6510MemorySectionType {
    return M6510MemorySectionType.Disassemble;
  }

  /**
   * Adds the specified item to the map
   * @param item Memory section item to add to the map
   */
  add(item: M6510MemorySection): void {
    // --- We store the items of the list in ascending order by StartAddress
    let overlapFound: boolean;
    do {
      overlapFound = false;

      // --- Adjust all old sections that overlap with the new one
      for (let i = 0; i < this.sections.length; i++) {
        var oldSection = this.sections[i];
        if (item.overlaps(oldSection)) {
          // --- The new item overlaps with one of the existing ones
          overlapFound = true;
          const oldStart = oldSection.startAddress;
          const oldEndEx = oldSection.endAddress;
          const newStart = item.startAddress;
          const newEndEx = item.endAddress;

          if (oldStart < newStart) {
            // --- Adjust the length of the old section:
            // --- it gets shorter
            oldSection.endAddress = newStart - 1;
            if (oldEndEx > newEndEx) {
              // --- The rightmost part of the old section becomes a new section
              const newSection = new M6510MemorySection(newEndEx + 1, oldEndEx);
              this.sections.splice(i + 1, 0, newSection);
            }
            break;
          }

          if (oldStart >= newStart) {
            if (oldEndEx <= newEndEx) {
              // --- The old section entirely intersects with the new section:
              // --- Remove the old section
              this.sections.splice(i, 1);
            } else {
              // --- Change the old section's start address
              oldSection.startAddress = newEndEx + 1;
            }
            break;
          }
        }
      }
    } while (overlapFound);

    // --- At this point we do not have no old overlapping section anymore.
    // --- Insert the new section to its place according to its StartAddress
    let insertPos = this.sections.length;
    for (var i = 0; i < this.sections.length; i++) {
      if (this.sections[i].startAddress > item.startAddress) {
        // --- This is the right place to insert the new section
        insertPos = i;
        break;
      }
    }
    this.sections.splice(insertPos, 0, item);
  }

  /**
   * Merges the sections of another map into this one
   * @param map Map to merge into this one
   * @param offset Optional offset of start and end addresses
   */
  merge(map: M6510MemoryMap, offset: number = 0): void {
    if (!map) {
      return;
    }
    for (const section of map.sections) {
      this.add(
        new M6510MemorySection(
          section.startAddress + offset,
          section.endAddress + offset,
          section.sectionType
        )
      );
    }
  }

  /**
   * Joins adjacent Disassembly memory sections
   */
  normalize(): void {
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 1; i < this.count; i++) {
        const prevSection = this.sections[i - 1];
        const currentSection = this.sections[i];
        if (
          prevSection.endAddress !== currentSection.startAddress - 1 ||
          prevSection.sectionType !== M6510MemorySectionType.Disassemble ||
          currentSection.sectionType !== M6510MemorySectionType.Disassemble
        ) {
          continue;
        }

        prevSection.endAddress = currentSection.endAddress;
        this.sections.splice(i, 1);
        changed = true;
      }
    }
  }
}


