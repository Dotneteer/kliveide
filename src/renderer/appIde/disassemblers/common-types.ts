import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";

export type DisassemblyOperandPragma = "L" | "W" | "w";

export type DisassemblyOperandInfo = {
  /**
   * The displayed instruction address, including any configured address offset.
   */
  instructionAddress: number;

  /**
   * The raw offset of the instruction within the disassembled memory contents.
   */
  instructionOffset: number;

  /**
   * Zero-based index of the 16-bit operand within this instruction.
   */
  operandIndex: number;

  /**
   * The numeric 16-bit operand value decoded from the instruction stream.
   */
  operandValue: number;

  /**
   * The disassembler pragma that produced this operand.
   */
  pragma: DisassemblyOperandPragma;

  /**
   * The text the disassembler would render without a resolver.
   */
  defaultText: string;

  /**
   * The text a resolver put in `defaultText`'s place, when one did.
   *
   * Recorded so a view can tell an operand that carries a *name* from one that carries a number.
   * The resolved label is substituted into `instruction` as plain text, which leaves no way to find
   * it again afterwards — the annotated `.NEX` listing paints resolved operands in their own colour
   * and needs to know which run of characters to paint.
   */
  resolvedText?: string;
};

export type DisassemblyOperandLabelResolver = (
  operand: DisassemblyOperandInfo
) => string | undefined;

/**
 * The shape of a branching instruction, independent of how it is spelled.
 *
 * The disassembler renders from text templates (`"jr nz,^r|12/7"`), so by the time an item exists
 * nothing structured says it branches. Every cheap way to recover that after the fact is wrong:
 *
 * - `tstates2 > 0` misses `JP cc,nn`, which costs 10 T-states whether or not it jumps, and
 *   false-positives on the block-repeat ops (`LDIR`, `CPIR`, `INIR`, `OTIR`, `LDDR`, `CPDR`,
 *   `INDR`, `OTDR`, and Z80N's `LDIRX`, `LDPIRX`, `LDDRX`), all encoded `21/16`.
 * - `hasLabelSymbol` misses `RET cc`, `RST` and the indirect jumps, and is also set for operands
 *   that are not branch targets at all.
 * - Parsing `instruction` back is fragile: `noLabelPrefix`, `decimalMode` and `operandLabelResolver`
 *   each rewrite the rendered operand.
 *
 * So this is decoded from the opcode itself. See `z80-branch-info.ts` for the table.
 */
export type DisassemblyBranchKind =
  | "jr"
  | "jp"
  | "call"
  | "ret"
  | "djnz"
  | "rst"
  | "jp-indirect";

/**
 * The eight Z80 condition codes, spelled as the assembler spells them.
 *
 * `DJNZ` is conditional but takes none of these: it tests `B`, not a flag.
 */
export type DisassemblyBranchCondition = "nz" | "z" | "nc" | "c" | "po" | "pe" | "p" | "m";

/**
 * Where a branching instruction's destination comes from, when it is not a literal in the operand.
 *
 * - `"hl"` / `"ix"` / `"iy"` — `JP (HL)` and its indexed forms. Resolvable from a register snapshot.
 * - `"stack"` — `RET` and `RET cc`. Resolvable only where the stack top is both readable and
 *   meaningful, which in practice means at PC and in a flat 64K view.
 * - `"io-port"` — Z80N `JP (C)` alone. **Not resolvable at all.** The destination is
 *   `(PC & $C000) | (readPort(BC) << 6)` (see `Z80NCpu.ts`), and the low bits come from a live I/O
 *   read, not from any register. Obtaining them would mean performing that read, whose side effects
 *   — interrupt acknowledgement, FIFO advance, device state — would disturb the execution being
 *   debugged. A read-only view must report this as unknowable rather than produce a number.
 */
export type DisassemblyBranchTargetSource = "hl" | "ix" | "iy" | "stack" | "io-port";

/**
 * Control-flow metadata for one branching instruction.
 */
export type DisassemblyBranchInfo = {
  /** What kind of branch this is. */
  kind: DisassemblyBranchKind;

  /**
   * The flag condition guarding the branch, absent on an unconditional one.
   *
   * Absent on `DJNZ` too, which is conditional on `B` rather than on a flag — `kind` carries that.
   */
  condition?: DisassemblyBranchCondition;

  /**
   * The destination, where the instruction itself names it.
   *
   * Present for `JR`, `JR cc`, `DJNZ`, `JP`, `JP cc`, `CALL`, `CALL cc` (copied from the item's
   * `symbolValue`, which the `^r`/`^L` pragmas already resolve) and for `RST` (the vector). Absent
   * whenever `targetSource` is set instead.
   */
  target?: number;

  /** Where the destination comes from when `target` is absent. */
  targetSource?: DisassemblyBranchTargetSource;

  /** T-states spent when the branch is taken. Equals `tstatesNotTaken` when unconditional. */
  tstatesTaken: number;

  /** T-states spent when it is not. Equals `tstatesTaken` when unconditional. */
  tstatesNotTaken: number;
};

export type DisassemblyAnnotationRegionType = "disassemble" | "bytes" | "words" | "skip";

export type DisassemblyAnnotationMetadata = {
  /**
   * Optional bank number for bank-relative annotated disassembly.
   */
  bank?: number;

  /**
   * Offset of the generated row within the source bank or memory block.
   */
  bankOffset: number;

  /**
   * Number of source bytes represented by the generated row.
   */
  byteLength: number;

  /**
   * Region type that produced the generated row.
   */
  regionType?: DisassemblyAnnotationRegionType;

  /**
   * True when the row has a synopsis or end-of-line annotation.
   */
  hasLineAnnotation?: boolean;

  /**
   * True when the row has a local or global annotation label.
   */
  hasLabel?: boolean;

  /**
   * Original disassembler-generated comment before user annotations are appended.
   */
  generatedHardComment?: string;
};

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
   * Gets the current ROM page number
   */
  getRomPage?: () => number;

  /**
   * Optionally resolves 16-bit operand values to display labels.
   */
  operandLabelResolver?: DisassemblyOperandLabelResolver;

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
 * Base class for memory sections with common functionality
 */
export class MemorySection implements IMemorySection {
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
   * 16-bit operand candidates that may be annotated with a label reference.
   */
  operandCandidates?: DisassemblyOperandInfo[];

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

  /**
   * Optional metadata used by annotated disassembly views.
   */
  annotation?: DisassemblyAnnotationMetadata;

  /**
   * Control-flow metadata, present only on a branching instruction.
   *
   * Optional, so every existing consumer is unaffected. See `DisassemblyBranchInfo`.
   */
  branch?: DisassemblyBranchInfo;
}
