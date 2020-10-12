import { CompareBinPragma, Statement } from "../parser/tree-nodes";
import { BinarySegment } from "./assembler-in-out";

/**
 * Objects implementing this interface have usage information
 */
export interface HasUsageInfo {
  /**
   * Signs if the object has been used
   */
  isUsed: boolean;
}

/**
 * Defines a section of assembly lines
 */
export class DefinitionSection {
  constructor(
    public readonly firstLine: number,
    public readonly lastLine: number
  ) {}
}

/**
 * Represents the definition of an IF statement
 */
export class IfDefinition {
  /**
   * The entire if section
   */
  fullSection: DefinitionSection;

  /**
   * List of IF sections
   */
  ifSections: IfSection[] = [];

  /**
   * Optional ELSE section
   */
  elseSection?: IfSection;
}

/**
 * Represents a section of an IF definition
 */
export class IfSection {
  constructor(
    public readonly ifStatement: Statement,
    firstLine: number,
    lastLine: number
  ) {
    this.section = new DefinitionSection(firstLine, lastLine);
  }
  /**
   * Section boundaries
   */
  section: DefinitionSection;
}

/**
 * Represents a struct
 */
export class StructDefinition {
  constructor(
    public readonly structName: string,
    macroDefLine: number,
    macroEndLine: number,
    private caseSensitive: boolean
  ) {
    this.section = new DefinitionSection(macroDefLine, macroEndLine);
  }

  /**
   * Struct definition section
   */
  readonly section: DefinitionSection;

  /**
   * The fields of the structure
   */
  readonly fields: { [key: string]: FieldDefinition } = {};

  /**
   * The size of the structure
   */
  size: number;

  /**
   * Adds a new field to the structure
   * @param fieldName Field name
   * @param definition Field definition
   */
  addField(fieldName: string, definition: FieldDefinition): void {
    if (!this.caseSensitive) {
      fieldName = fieldName.toLowerCase();
    }
    this.fields[fieldName] = definition;
  }

  /**
   * Tests if the structure contains a field
   * @param fieldName Name of the field to check
   * @returns True, if the struct contains the field; otherwise, false.
   */
  containsField(fieldName: string): boolean {
    if (!this.caseSensitive) {
      fieldName = fieldName.toLowerCase();
    }
    return !!this.fields[fieldName];
  }

  /**
   * Gets the specified field definition
   * @param name field name
   * @returns The field information, if found; otherwise, undefined.
   */
  getField(fieldName: string): FieldDefinition | undefined {
    if (!this.caseSensitive) {
      fieldName = fieldName.toLowerCase();
    }
    return this.fields[fieldName];
  }
}

/**
 * Defines a fiels of a structure
 */
export class FieldDefinition implements HasUsageInfo {
  constructor(public readonly offset: number) {}

  /**
   * Signs if the object has been used
   */
  isUsed: boolean;
}

/**
 * Represents the definition of a macro
 */
export class MacroDefinition {
  constructor(
    public readonly macroName: string,
    macroDefLine: number,
    macroEndLine: number,
    public readonly argNames: string[],
    public readonly endLabel: string | null
  ) {
    this.section = new DefinitionSection(macroDefLine, macroEndLine);
  }

  /**
   * Struct definition section
   */
  readonly section: DefinitionSection;
}

/**
 * Information about binary comparison
 */
export class BinaryComparisonInfo {
  constructor(
    public readonly comparePragma: CompareBinPragma,
    public readonly segment: BinarySegment,
    public readonly segmentLength: number
  ) {}
}
