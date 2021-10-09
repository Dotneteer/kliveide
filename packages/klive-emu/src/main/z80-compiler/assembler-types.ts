import {
  CompareBinPragma,
  Statement,
} from "@abstractions/z80-assembler-tree-nodes";
import {
  DefinitionSection,
  IBinarySegment,
  IFieldDefinition,
  IStructDefinition,
} from "@abstractions/z80-compiler-service";

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
    this.section = { firstLine, lastLine };
  }
  /**
   * Section boundaries
   */
  section: DefinitionSection;
}

/**
 * Represents a struct
 */
export class StructDefinition implements IStructDefinition {
  constructor(
    public readonly structName: string,
    macroDefLine: number,
    macroEndLine: number,
    private caseSensitive: boolean
  ) {
    this.section = { firstLine: macroDefLine, lastLine: macroEndLine };
  }

  /**
   * Struct definition section
   */
  readonly section: DefinitionSection;

  /**
   * The fields of the structure
   */
  readonly fields: { [key: string]: IFieldDefinition } = {};

  /**
   * The size of the structure
   */
  size: number;

  /**
   * Adds a new field to the structure
   * @param fieldName Field name
   * @param definition Field definition
   */
  addField(fieldName: string, definition: IFieldDefinition): void {
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
  getField(fieldName: string): IFieldDefinition | undefined {
    if (!this.caseSensitive) {
      fieldName = fieldName.toLowerCase();
    }
    return this.fields[fieldName];
  }
}

/**
 * Information about binary comparison
 */
export class BinaryComparisonInfo {
  constructor(
    public readonly comparePragma: CompareBinPragma,
    public readonly segment: IBinarySegment,
    public readonly segmentLength: number
  ) {}
}
