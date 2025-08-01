/**
 * Base disassembly options that can be extended by specific CPU disassemblers
 */
export interface DisassemblyOptions {
  /**
   * Use decimal mode for number formatting
   */
  decimalMode?: boolean;

  /**
   * Don't use label prefix (use $ instead of L)
   */
  noLabelPrefix?: boolean;

  /**
   * Allow additional properties
   */
  [x: string]: any;
}

/**
 * The result of a fetch/peek operation
 */
export type FetchResult = {
  /**
   * The optional partition
   */
  partitionLabel?: string;

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
};
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
 * This enumeration represents the memory section types that can be used
 * when disassemblying a project.
 */
export enum MemorySectionType {
  /**
   * Simply skip the section without any output code generation
   */
  Skip,

  /**
   * Create Z80 disassembly for the memory section
   */
  Disassemble,

  /**
   * Create a byte array for the memory section
   */
  ByteArray,

  /**
   * Create a word array for the memory section
   */
  WordArray,

  /**
   * Create an RST 28 bytecode memory section
   */
  CustomSection
}

/**
 * Base class for memory sections with common functionality
 */
export class MemorySection {
  private _start = 0;
  private _end = 0;
  private _type: MemorySectionType = MemorySectionType.Disassemble;

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
  set sectionType(value: MemorySectionType) {
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
    sectionType = MemorySectionType.Disassemble
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
  overlaps(other: MemorySection): boolean {
    return (
      (other.startAddress >= this.startAddress && other.startAddress <= this.endAddress) ||
      (other.endAddress >= this.startAddress && other.endAddress <= this.endAddress) ||
      (this.startAddress >= other.startAddress && this.startAddress <= other.endAddress) ||
      (this.endAddress >= other.startAddress && this.endAddress <= other.endAddress)
    );
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
      : new MemorySection(intStart, intEnd, this.sectionType);
  }

  /**
   * Checks if this section has the same start and length than the other
   * @param other Other memory section
   * @return True, if the sections have the same start and length
   */
  sameSection(other: MemorySection): boolean {
    return this.startAddress === other.startAddress && this.endAddress === other.endAddress;
  }
}

/**
 * This class implements a memory map of a Z80 virtual machine.
 * Internally, the sections of the memory map are kept ordered by the section's
 * start addresses.
 */
export class MemoryMap {
  sections: MemorySection[] = [];

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
  add(item: MemorySection): void {
    // --- We store the items of the list in ascending order by StartAddress
    let overlapFound: boolean;
    do {
      overlapFound = false;

      // --- Adjust all old sections that overlap with the new one
      for (let i = 0; i < this.sections.length; i++) {
        var oldSection = this.sections[i];
        if (item.overlaps(oldSection)) {
          // --- The new item overlaps with one of the exisitning ones
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
              const newSection = new MemorySection(newEndEx + 1, oldEndEx);
              this.sections.splice(i + 1, 0, newSection);
            }
            break;
          }

          if (oldStart >= newStart) {
            if (oldEndEx <= newEndEx) {
              // --- The old section entirely intersects wiht the new section:
              // --- Remove the old section
              this.sections.splice(i, 1);
            } else {
              // --- Change the old sections's start address
              oldSection.startAddress = newEndEx + 1;
            }
            break;
          }
        }
      }
    } while (overlapFound);

    // --- At this point we do not have no old overlapping section anymore.
    // --- Insert the nex section to its place according to its StartAddress
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
  merge(map: MemoryMap, offset: number = 0): void {
    if (!map) {
      return;
    }
    for (const section of map.sections) {
      this.add(
        new MemorySection(
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
          prevSection.sectionType !== MemorySectionType.Disassemble ||
          currentSection.sectionType !== MemorySectionType.Disassemble
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

/**
 * This class represents the output of the disassembly project
 */
export class DisassemblyOutput {
  private _outputItems = new Array<DisassemblyItem>();
  private _outputByAddress = new Map<number, DisassemblyItem>();
  private readonly _labels = new Map<number, DisassemblyLabel>();

  /**
   * Gets the list of output items
   */
  get outputItems(): Array<DisassemblyItem> {
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
    this._outputItems = new Array<DisassemblyItem>();
    this._outputByAddress = new Map<number, DisassemblyItem>();
  }

  /**
   * Adds a new item to the output
   * @param item Disassembly item to add
   */
  addItem(item: DisassemblyItem): void {
    this._outputItems.push(item);
    this._outputByAddress.set(item.address, item);
  }

  /**
   * Gets a disassembly item by its address
   * @param addr Item address
   * @returns The speicifid item, if found; otherwise, undefined
   */
  get(addr: number): DisassemblyItem | undefined {
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
  replaceOutputItems(items: DisassemblyItem[]): void {
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
 * This class represents the output of a single disassembly item
 */
export interface DisassemblyItem {
  /**
   * Optional partition of an extended address
   */
  partition?: string;

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
   * The Z80 assembly instruction
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

  /**
   * The number of T-states consumed by the instruction
   */
  tstates?: number;

  /**
   * The number of T-states consumed by the instruction (alternative)
   */
  tstates2?: number;
}
