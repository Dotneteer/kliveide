/**
 * This class represents the output of a single disassembly item
 */
export class DisassemblyItem {
  /**
   * The memory address of the disassembled instruction
   */
  readonly address: number;

  /**
   * The last address that belongs to the operation
   */
  lastAddress: number;

  /**
   * Operation codes used for the disassembly
   */
  opCodes: string;

  /**
   * Indicates that the disassembly instruction has an associated label
   */
  hasLabel = false;

  /**
   * The Z80 assembly instruction
   */
  instruction: string | null;

  /**
   * Disassembler-generated comment
   */
  hardComment: string | null;

  /**
   * Optional target address, if the instruction contains any
   */
  targetAddress: number;

  /**
   * The start position of token to replace
   */
  tokenPosition = 0;

  /**
   * The length of token to replace
   */
  tokenLength = 0;

  /**
   * Signs that this item has a symbol that can be associated with a literal
   */
  hasSymbol = false;

  /**
   * The symbol value
   */
  symbolValue = 0;

  /**
   * Indicates if this item has a label symbol
   */
  hasLabelSymbol = false;

  /**
   * Initializes a new item
   * @param address Disassembly item address
   */
  constructor(address: number) {
    this.address = address;
    this.lastAddress = address;
    this.opCodes = "";
    this.instruction = null;
    this.targetAddress = 0;
    this.hardComment = null;
  }

  /**
   * Returns a string that represents the current object.
   */
  toString(): string {
    return `${intToX4(this.address)} ${this.opCodes} ${
      this.hasLabel ? "L" + intToX4(this.address) : ""
    }${this.instruction}`;
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
  Rst28Calculator,
}

/**
 * This class describes a memory section with a start address and a length
 */
export class MemorySection {
  private _start = 0;
  private _end = 0;
  private _type = MemorySectionType.Disassemble;

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
   * The lenght of the memory section
   */
  get lenght(): number {
    return (this.endAddress - this.startAddress + 1) & 0xffff;
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
    if (endAddress >= startAddress) {
      this.startAddress = startAddress;
      this.endAddress = endAddress;
    } else {
      this.startAddress = endAddress;
      this.endAddress = startAddress;
    }
    this.sectionType = sectionType;
  }

  /**
   * Checks if this memory section overlaps with the othe one
   * @param other Other memory section
   * @return True, if the sections overlap
   */
  overlaps(other: MemorySection): boolean {
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
  sameSection(other: MemorySection): boolean {
    return this._start === other._start && this._end === other._end;
  }

  /**
   * Gets the intersection of the two memory sections
   * @param other Other memory section
   * @return Intersection, if exists; otherwise, undefined
   */
  intersect(other: MemorySection): MemorySection | undefined {
    let intStart = -1;
    let intEnd = -1;
    if (other._start >= this._start && other._start <= this._end) {
      intStart = other._start;
    }
    if (other._end >= this._start && other._end <= this._end) {
      intEnd = other._end;
    }
    if (this._start >= other._start && this._start <= other._end) {
      intStart = this._start;
    }
    if (this._end >= other._start && this._end <= other._end) {
      intEnd = this._end;
    }
    return intStart < 0 || intEnd < 0
      ? undefined
      : new MemorySection(intStart, intEnd);
  }

  /**
   *
   * @param other Checks if this memory section equals with the other
   */
  equals(other: MemorySection): boolean {
    return (
      this._start === other._start &&
      this._end === other._end &&
      this._type === other._type
    );
  }
}

/**
 * This class specifies the spectrum disassembly flags that can be passed
 * to the Z80 disassembler to provide Spectrum ROM-specific disassembly
 */
export enum SpectrumSpecificDisassemblyFlags {
  None = 0,
  Spectrum48Rst08 = 0x0001,
  Spectrum48Rst28 = 0x0002,
  Spectrum48 = Spectrum48Rst08 | Spectrum48Rst28,
  Spectrum128Rst28 = 0x0004,
  Spectrum128 = Spectrum128Rst28,
  SpectrumP3 = Spectrum128Rst28,
  SpectrumNext = Spectrum128Rst28,
}

/**
 * This class contains helpers that manage ZX Spectrum float numbers
 */
export class FloatNumber {
  /**
   * Convert bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromBytes(bytes: number[]): number {
    if (bytes.length !== 5) {
      throw new Error("A float number must be exactly 5 bytes");
    }

    if (bytes[0] === 0) {
      // --- Simple integer form
      const neg = bytes[1] === 0xff;
      return (bytes[2] + bytes[3] * 0x100) * (neg ? -1 : 1);
    }

    const sign = (bytes[1] & 0x80) === 0 ? 1 : -1;
    const mantUpper = (((bytes[1] & 0x7f) | 0x80) << 23) * 2;
    const mant = mantUpper + (bytes[2] << 16) + (bytes[3] << 8) + bytes[4];
    const exp = bytes[0] - 128 - 32;
    return sign * mant * Math.pow(2.0, exp);
  }

  /**
   * Convert compact bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromCompactBytes(bytes: number[]): number {
    let copyFrom = 1;
    let exp = bytes[0] & 0x3f;
    if (exp === 0) {
      exp = bytes[1];
      copyFrom = 2;
    }
    exp += 0x50;
    const newBytes = [0x00, 0x00, 0x00, 0x00, 0x00];
    newBytes[0] = exp;
    let idx = 1;
    for (let i = copyFrom; i < bytes.length; i++) {
      newBytes[idx++] = bytes[i];
    }
    return FloatNumber.FromBytes(newBytes);
  }
}

/**
 * This class implements a memory map of the ZX Spectrum virtual machine.
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
 * Allows the JavaScript event loop to process waiting messages
 */
export function processMessages(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, 0);
  });
}

/**
 * Converts an unsigned byte to a signed byte
 */
export function toSbyte(x: number) {
  x &= 0xff;
  return x >= 128 ? x - 256 : x;
}

/**
 * Converts value to a signed short
 */
export function toSshort(x: number) {
  x &= 0xffff;
  return x >= 32768 ? x - 65536 : x;
}

/**
 * Converts the input value to a 2-digit hexadecimal string
 * @param value Value to convert
 */
export function intToX2(value: number): string {
  const hnum = value.toString(16).toUpperCase();
  if (hnum.length >= 2) {
    return hnum;
  }
  return "0" + hnum;
}

/**
 * Converts the input value to a 4-digit hexadecimal string
 * @param value Value to convert
 */
export function intToX4(value: number): string {
  const hnum = value.toString(16).toUpperCase();
  if (hnum.length >= 4) {
    return hnum;
  }
  return "0000".substring(0, 4 - hnum.length) + hnum;
}
