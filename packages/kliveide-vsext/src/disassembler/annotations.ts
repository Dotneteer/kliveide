import {
  MemoryMap,
  SpectrumSpecificDisassemblyFlags,
  MemorySectionType,
  MemorySection,
} from "./disassembly-helper";

/**
 * Maximum label length
 */

export const MAX_LABEL_LENGTH = 16;

/**
 * Regex to check label syntax
 */
const labelRegex = /^[_a-zA-Z][_a-zA-Z0-9]{0,15}$/;

/**
 * This class describes those labels, comments, and literals that are used to decorate
 * the raw disassembly
 */
export class DisassemblyAnnotation {
  resourceName: string | undefined;
  labels: Map<number, string> = new Map<number, string>();
  comments: Map<number, string> = new Map<number, string>();
  prefixComments: Map<number, string> = new Map<number, string>();
  literals: Map<number, string[]> = new Map<number, string[]>();
  literalValues: Map<string, number> = new Map<string, number>();
  literalReplacements: Map<number, string> = new Map<number, string>();

  /**
   * The memory map structure
   */
  readonly memoryMap = new MemoryMap();

  /**
   * Disassembly flags to use with this bank
   */
  disassemblyFlags: SpectrumSpecificDisassemblyFlags = 0;

  /**
   * Sets the disassembly flag to the specified value
   * @param flag Disassembly flag
   */
  setDisassemblyFlag(flag: SpectrumSpecificDisassemblyFlags): void {
    this.disassemblyFlags = flag;
  }

  /**
   * Stores a label in annotations,
   * If the label text is null, empty, or contains only whitespaces, the label
   * gets removed.
   * @param address Label address
   * @param label Label text
   * @returns True, if any modification has been done; otherwise, false
   */
  setLabel(address: number, label: string | undefined): boolean {
    if (!label || !/\S/.test(label)) {
      return this.labels.delete(address);
    }

    if (label.length > MAX_LABEL_LENGTH) {
      label = label.substring(0, MAX_LABEL_LENGTH);
    }

    if (!labelRegex.test(label)) {
      return false;
    }

    // TODO: Implement this feature later
    // if (Z80Disassembler.DisAsmKeywords.Contains(label.ToUpper()))
    // {
    //     return false;
    // }

    for (const lab of this.labels.entries()) {
      if (lab[1].toLowerCase() === label.toLowerCase() && lab[0] !== address) {
        return false;
      }
    }

    this.labels.set(address, label);
    return true;
  }

  /**
   * Stores a comment in annotations
   * If the name text is null, empty, or contains only whitespaces, the name
   * gets removed.
   * @param address Comment address
   * @param comment Comment text
   */
  setComment(address: number, comment: string | undefined): boolean {
    if (!comment || !/\S/.test(comment)) {
      return this.comments.delete(address);
    }

    this.comments.set(address, comment);
    return true;
  }

  /**
   * Stores a prefix name in this collection.
   * If the name text is null, empty, or contains only whitespaces, the name
   * gets removed.
   * @param address Comment address
   * @param comment Comment text
   */
  setPrefixComment(address: number, comment: string | undefined): boolean {
    if (!comment || !/\S/.test(comment)) {
      return this.prefixComments.delete(address);
    }
    this.prefixComments.set(address, comment);
    return true;
  }

  /**
   * Adds a literal to this collection
   * @param key Literal key
   * @param name Literal name
   * @returns True, if any modification has been done; otherwise, false
   */
  addLiteral(key: number, name: string): boolean {
    if (!/\S/.test(name)) {
      return false;
    }

    let names = this.literals.get(key);
    if (!names) {
      names = [];
    }

    // --- Check if the same name is assigned to any other key
    let addr = this.literalValues.get(name);
    if (addr && addr !== key) {
      return false;
    }

    if (names.find((n) => n.toLowerCase() === name.toLowerCase())) {
      return false;
    }

    names.push(name);
    this.literalValues.set(name, key);
    this.literals.set(key, names);
    return true;
  }

  /**
   * Removes a literal from this collection.
   * If the name text is null, empty, or contains only whitespaces, the name
   * gets removed.
   * @param key Literal key
   * @param name Literal name
   * @returns True, if any modification has been done; otherwise, false
   */
  removeLiteral(key: number, name: string): boolean {
    if (!/\S/.test(name)) {
      return false;
    }
    let names = this.literals.get(key);
    if (!names) {
      names = [];
    }

    var index = names.findIndex((n) => n.toLowerCase() === name.toLowerCase());
    if (index < 0) {
      return false;
    }

    names.splice(index, 1);
    if (names.length > 0) {
      this.literals.set(key, names);
    } else {
      this.literals.delete(key);
    }
    return true;
  }

  /**
   * Stores a literal replacement in this collection.
   * If the name text is null, empty, or contains only whitespaces, the name
   * gets removed.
   * @param address Literal replacement address
   * @param literalName Literal name to replace a value
   * @returns True, if any modification has been done; otherwise, false
   */
  setLiteralReplacement(
    address: number,
    literalName: string | undefined
  ): boolean {
    if (!literalName || !/\S/.test(literalName)) {
      return this.literalReplacements.delete(address);
    }
    this.literalReplacements.set(address, literalName);
    return true;
  }

  /**
   * Replaces a literal in the disassembly item for the specified address. If
   * the named literal does not exists, creates one for the symbol.
   * If the literal already exists, it must have the symbol's value.
   * @param address Disassembly item address
   * @param symbol Symbol value for the literal
   * @param literalName Literal name
   * @returns undefined, if operation id ok, otherwise, error message
   */
  applyLiteral(
    address: number,
    symbol: number,
    literalName: string | undefined
  ): string | undefined {
    if (!literalName || !/\S/.test(literalName)) {
      this.literalReplacements.delete(address);
      return undefined;
    }

    let literal: number | undefined;
    if (literalName === "#") {
      // --- Apply the first literal that is available for the specified symbol
      let values = this.literals.get(symbol);
      if (!values) {
        // --- Fall back to labels
        let labelName = this.labels.get(symbol);
        if (!labelName) {
          return `There is no symbol associated with #${symbol} yet.`;
        }

        // --- We found a matching label
        literalName = labelName;
        literal = symbol;
      } else {
        // --- We found a matching symbol with one or more names
        // --- We deliberately choose the first name
        literalName = values.sort()[0];
        literal = this.getLiteralValue(literalName);
      }
    } else {
      // --- Let's check if we have a value to the specified literal
      literal = this.getLiteralValue(literalName);
    }

    if (literal) {
      if (literal !== symbol) {
        return `'${literalName}' cannot be assigned to #${symbol}, as it already has a value of #${literal}`;
      }
    } else {
      this.addLiteral(symbol, literalName);
    }
    this.literalReplacements.set(address, literalName);
    return undefined;
  }

  /**
   * Checks if the specified liter is defined.
   * Literal names are case sensitive
   * @param literalName Literal to check
   * @returns True, if the specified literal has already been defined; otherwise, false
   */
  getLiteralValue(literalName: string): number | undefined {
    return this.literalValues.get(literalName);
  }

  /**
   * Merges this annostation set with another one.
   * Definitions in the other annotation set override the ones defined here
   * @param other Other disassembly annotation set
   */
  merge(other: DisassemblyAnnotation): void {
    if (!other) {
      throw new Error("No annotation to merge");
    }

    if (other === this) {
      return;
    }

    for (const label of other.labels) {
      this.labels.set(label[0], label[1]);
    }
    for (const comment of other.comments) {
      this.comments.set(comment[0], comment[1]);
    }
    for (const prefixComment of other.prefixComments) {
      this.prefixComments.set(prefixComment[0], prefixComment[1]);
    }
    for (const literal of other.literals) {
      const oldSet = this.literals.get(literal[0]);
      if (oldSet) {
        let newSet = literal[1].splice(0);
        for (const oldVal of oldSet) {
          newSet.push(oldVal);
        }
        newSet = newSet.filter(function (value, index, self) {
          return self.indexOf(value) === index;
        });
        this.literals.set(literal[0], newSet);
      } else {
        this.literals.set(literal[0], literal[1]);
      }
    }
    for (const replacement of other.literalReplacements) {
      this.literalReplacements.set(replacement[0], replacement[1]);
    }
    for (const section of other.memoryMap.sections) {
      this.memoryMap.add(section);
    }
  }

  /**
   * Converts this annotation to its serialization data
   */
  toDisassemblyDecorationData(): DisassemblyAnnotationData {
    const dd = new DisassemblyAnnotationData();
    dd.labels = {};
    for (const item of this.labels) {
      dd.labels[item[0]] = item[1];
    }
    dd.comments = {};
    for (const item of this.comments) {
      dd.comments[item[0]] = item[1];
    }
    dd.prefixComments = {};
    for (const item of this.prefixComments) {
      dd.prefixComments[item[0]] = item[1];
    }
    dd.literals = {};
    for (const item of this.literals) {
      dd.literals[item[0]] = item[1];
    }
    dd.literalReplacements = {};
    for (const item of this.literalReplacements) {
      dd.literalReplacements[item[0]] = item[1];
    }
    dd.memorySections = [];
    for (const section of this.memoryMap.sections) {
      dd.memorySections.push(
        new MemorySectionData(
          section.startAddress,
          section.endAddress,
          section.sectionType
        )
      );
    }
    dd.disassemblyFlags = this.disassemblyFlags;
    return dd;
  }

  /**
   * Serializes the contents of this instance into a JSON string
   */
  serialize(): string {
    return JSON.stringify(this.toDisassemblyDecorationData());
  }

  /**
   * Deserializes the specified JSON string into a DisassemblyAnnotation
   * @param json JSON representation
   */
  static deserialize(json: string): DisassemblyAnnotation | null {
    let data: any;
    try {
      data = JSON.parse(json);
    } catch (err) {
      console.log(err);
      return null;
    }

    try {
      const annotation = new DisassemblyAnnotation();

      if (data.labels) {
        annotation.labels = new Map<number, string>();
        for (const addr in data.labels) {
          annotation.labels.set(parseInt(addr), data.labels[addr]);
        }
      }

      if (data.comments) {
        annotation.comments = new Map<number, string>();
        for (const addr in data.comments) {
          annotation.comments.set(parseInt(addr), data.comments[addr]);
        }
      }

      if (data.prefixComments) {
        annotation.prefixComments = new Map<number, string>();
        for (const addr in data.prefixComments) {
          annotation.prefixComments.set(
            parseInt(addr),
            data.prefixComments[addr]
          );
        }
      }

      if (data.literals) {
        annotation.literals = new Map<number, string[]>();
        for (const addr in data.literals) {
          annotation.literals.set(parseInt(addr), data.literals[addr]);
        }
      }

      if (data.literalReplacements) {
        annotation.literalReplacements = new Map<number, string>();
        for (const addr in data.literalReplacements) {
          annotation.literalReplacements.set(
            parseInt(addr),
            data.literalReplacements[addr]
          );
        }
      }

      annotation.disassemblyFlags = data.disassemblyFlags || 0;

      if (data.memorySections) {
        for (const section of data.memorySections) {
          annotation.memoryMap.sections.push(
            new MemorySection(
              section.startAddress,
              section.endAddress,
              section.sectionType
            )
          );
        }
      }

      for (const literal of annotation.literals) {
        for (const item of literal[1]) {
          annotation.literalValues.set(item, literal[0]);
        }
      }
      return annotation;
    } catch (err) {
      console.log(err);
      return null;
    }
  }
}

/**
 * Helper class for JSON serizalization
 */
export class DisassemblyAnnotationData {
  labels: any;
  comments: any;
  prefixComments: any;
  literals: any;
  literalReplacements: any;
  memorySections: MemorySectionData[] = [];
  disassemblyFlags: SpectrumSpecificDisassemblyFlags = 0;
}

/**
 * Stores serialization data for a memory section
 */
export class MemorySectionData {
  constructor(
    public startAddress: number,
    public endAddress: number,
    public sectionType: MemorySectionType
  ) {}
}
