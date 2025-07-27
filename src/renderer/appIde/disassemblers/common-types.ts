/**
 * Common types and interfaces shared between different CPU disassemblers
 */

/**
 * Base disassembly options that can be extended by specific CPU disassemblers
 */
export interface BaseDisassemblyOptions {
  /**
   * Use decimal mode for number formatting
   */
  decimalMode?: boolean;
  
  /**
   * Don't use label prefix (use $ instead of L)
   */
  noLabelPrefix?: boolean;
}

/**
 * The result of a fetch/peek operation for disassembly
 */
export interface BaseFetchResult {
  /**
   * Offset the opcode was read from
   */
  offset: number;

  /**
   * Overflow detected?
   */
  overflow: boolean;

  /**
   * Opcode fetched
   */
  opcode: number;
}

/**
 * Base interface for a single disassembly item
 */
export interface BaseDisassemblyItem {
  /**
   * The memory address of the disassembled instruction
   */
  address: number;

  /**
   * Operation codes used for the disassembly
   */
  opCodes?: number[];

  /**
   * Indicates that the disassembly instruction has an associated label
   */
  hasLabel?: boolean;

  /**
   * The assembly instruction
   */
  instruction?: string;

  /**
   * Disassembler-generated comment
   */
  hardComment?: string;

  /**
   * The start position of token to replace
   */
  tokenPosition?: number;

  /**
   * The length of token to replace
   */
  tokenLength?: number;

  /**
   * Signs that this item has a symbol that can be associated with a literal
   */
  hasSymbol?: boolean;

  /**
   * The symbol value
   */
  symbolValue?: number;

  /**
   * Indicates if this item has a label symbol
   */
  hasLabelSymbol?: boolean;

  /**
   * Formatted label
   */
  formattedLabel?: string;

  /**
   * Formatted comment
   */
  formattedComment?: string;

  /**
   * Signs that this item is just a prefix item
   */
  isPrefixItem?: boolean;

  /**
   * The optional prefix comment
   */
  prefixComment?: string;
}

/**
 * Base class for disassembly output management
 */
export abstract class BaseDisassemblyOutput<T extends BaseDisassemblyItem> {
  private _outputItems = new Array<T>();
  private _outputByAddress = new Map<number, T>();
  private readonly _labels = new Map<number, DisassemblyLabel>();

  /**
   * Gets the list of output items
   */
  get outputItems(): Array<T> {
    return this._outputItems;
  }

  /**
   * Gets the labels created during disassembly
   */
  get labels(): Map<number, DisassemblyLabel> {
    return this._labels;
  }

  /**
   * Clears the entire output
   */
  clear(): void {
    this._outputItems = new Array<T>();
    this._outputByAddress = new Map<number, T>();
  }

  /**
   * Adds a new item to the output
   * @param item Disassembly item to add
   */
  addItem(item: T): void {
    this._outputItems.push(item);
    this._outputByAddress.set(item.address, item);
  }

  /**
   * Gets a disassembly item by its address
   * @param addr Item address
   * @returns The specified item, if found; otherwise, undefined
   */
  get(addr: number): T | undefined {
    return this._outputByAddress.get(addr);
  }

  /**
   * Creates a new label according to its address and optional name
   * @param addr Label address
   * @param referringOpAddr The address of operation referring to the label
   * @returns The newly created label
   */
  createLabel(addr: number, referringOpAddr?: number): void {
    let label = this._labels.get(addr);
    if (!label) {
      label = new DisassemblyLabel(addr);
      this._labels.set(label.address, label);
    }
    if (referringOpAddr) {
      label.references.push(referringOpAddr);
    }
  }

  /**
   * Replaces the original output items
   * @param items Items to replace the original output with
   */
  replaceOutputItems(items: T[]): void {
    this._outputItems = items;
    this._outputByAddress.clear();
    for (const item of items) {
      if (!item.isPrefixItem) {
        this._outputByAddress.set(item.address, item);
      }
    }
  }
}

/**
 * This class describes a label with its references
 */
export class DisassemblyLabel {
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
 * Base enumeration for memory section types
 */
export enum BaseMemorySectionType {
  /**
   * Simply skip the section without any output code generation
   */
  Skip,

  /**
   * Create disassembly for the memory section
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
 * Base class for memory sections with common functionality
 */
export abstract class BaseMemorySection<T = any> {
  private _start = 0;
  private _end = 0;
  private _type: T;

  /**
   * The start address of the section
   */
  get startAddress() {
    return this._start;
  }
  set startAddress(value: number) {
    this._start = value & 0xffff;
  }

  /**
   * The end address of the section (inclusive)
   */
  get endAddress() {
    return this._end;
  }
  set endAddress(value: number) {
    this._end = value & 0xffff;
  }

  /**
   * The type of the memory section
   */
  get sectionType() {
    return this._type;
  }
  set sectionType(value: T) {
    this._type = value;
  }

  /**
   * The length of the memory section
   */
  get length(): number {
    return (this.endAddress - this.startAddress + 1) & 0xffff;
  }

  /**
   * Creates a BaseMemorySection with the specified properties
   * @param startAddress Starting address
   * @param endAddress Ending address (inclusive)
   * @param sectionType Section type
   */
  constructor(
    startAddress: number,
    endAddress: number,
    sectionType: T
  ) {
    if (endAddress >= startAddress) {
      this.startAddress = startAddress;
      this.endAddress = endAddress;
    } else {
      this.startAddress = endAddress;
      this.endAddress = startAddress;
    }
    this._type = sectionType;
  }

  /**
   * Checks if this memory section overlaps with the other one
   * @param other Other memory section
   * @return True, if the sections overlap
   */
  overlaps(other: BaseMemorySection<T>): boolean {
    return (
      (other._start >= this._start && other._start <= this._end) ||
      (other._end >= this._start && other._end <= this._end) ||
      (this._start >= other._start && this._start <= other._end) ||
      (this._end >= other._start && this._end <= other._end)
    );
  }

  /**
   * Checks if this section has the same start and length than the other
   * @param other Other memory section
   * @return True, if the sections have the same start and length
   */
  sameSection(other: BaseMemorySection<T>): boolean {
    return this._start === other._start && this._end === other._end;
  }

  /**
   * Gets the intersection of the two memory sections
   * @param other Other memory section
   * @return Intersection, if exists; otherwise, undefined
   */
  abstract intersect(other: BaseMemorySection<T>): BaseMemorySection<T> | undefined;

  /**
   * Checks if this memory section equals with the other
   * @param other Other memory section
   */
  equals(other: BaseMemorySection<T>): boolean {
    return (
      this._start === other._start &&
      this._end === other._end &&
      this._type === other._type
    );
  }
}

/**
 * Base class for memory maps
 */
export abstract class BaseMemoryMap<T extends BaseMemorySection<any>> {
  sections: T[] = [];

  /**
   * Gets the count of items in the memory map
   */
  get count() {
    return this.sections.length;
  }

  /**
   * Adds the specified item to the map
   * @param item Memory section item to add to the map
   */
  add(item: T): void {
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
              const newSection = this.createSection(newEndEx + 1, oldEndEx, oldSection.sectionType);
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
   * Creates a new section instance - must be implemented by derived classes
   */
  protected abstract createSection(startAddress: number, endAddress: number, sectionType: any): T;

  /**
   * Gets the default section type for disassembly
   */
  protected abstract getDefaultDisassemblySectionType(): any;

  /**
   * Merges the sections of another map into this one
   * @param map Map to merge into this one
   * @param offset Optional offset of start and end addresses
   */
  merge(map: BaseMemoryMap<T>, offset: number = 0): void {
    if (!map) {
      return;
    }
    for (const section of map.sections) {
      this.add(
        this.createSection(
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
          prevSection.sectionType !== this.getDefaultDisassemblySectionType() ||
          currentSection.sectionType !== this.getDefaultDisassemblySectionType()
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
