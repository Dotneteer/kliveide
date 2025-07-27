import type { ErrorCodes } from "./assembler-errors";
import { IExpressionValue, IHasUsageInfo, IValueInfo } from "@main/compiler-common/abstractions";
import { NodePosition } from "@main/compiler-common/tree-nodes";

/**
 * Represents the context in which an expression is evaluated
 */
export interface IEvaluationContext {
  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): Z80AssemblyLine;

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(sourceLine: Z80AssemblyLine): void;

  /**
   * Gets the current assembly address
   */
  getCurrentAddress(): number;

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): IValueInfo | null;

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): IExpressionValue;

  /**
   * Evaluates the value if the specified expression node
   * @param expr Expression to evaluate
   * @param context: Evaluation context
   */
  doEvalExpression(context: IEvaluationContext, expr: Expression): IExpressionValue;

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   * @param parameters Optional error parameters
   */
  reportEvaluationError(
    context: IEvaluationContext,
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void;
}

/**
 * A single segment of the code compilation
 */
export interface IBinarySegment {
  /**
   * The bank of the segment
   */
  bank?: number;

  /**
   * Start offset used for banks
   */
  bankOffset?: number;

  /**
   * Maximum code length of this segment
   */
  maxCodeLength?: number;

  /**
   * Start address of the compiled block
   */
  startAddress: number;

  /**
   * Optional displacement of this segment
   */
  displacement?: number;

  /**
   * The current assembly address when the .disp pragma was used
   */
  dispPragmaOffset?: number;

  /**
   * Intel hex start address of this segment
   */
  xorgValue?: number;

  /**
   * Emitted Z80 binary code
   */
  emittedCode: number[];

  /**
   * Signs if segment overflow has been detected
   */
  overflowDetected?: boolean;

  /**
   * Shows the offset of the instruction being compiled
   */
  currentInstructionOffset?: number;

  /**
   * The current code generation offset
   */
  readonly currentOffset: number;

  /**
   * Emits the specified byte to the segment
   * @param data Byte to emit
   * @returns Null, if byte emitted; otherwise, error message
   */
  //emitByte(data: number): ErrorCodes | null;
}

/**
 * Describes a source file item
 */
export interface ISourceFileItem {
  /**
   * The name of the source file
   */
  readonly filename: string;

  /**
   * Optional parent item
   */
  parent?: ISourceFileItem;

  /**
   * Included files
   */
  readonly includes: ISourceFileItem[];

  /**
   * Adds the specified item to the "includes" list
   * @param childItem Included source file item
   * @returns True, if including the child item is OK;
   * False, if the inclusion would create a circular reference,
   * or the child is already is in the list
   */
  include?: (childItem: ISourceFileItem) => boolean;

  /**
   * Checks if this item already contains the specified child item in
   * its "includes" list
   * @param childItem Child item to check
   * @returns True, if this item contains the child item; otherwise, false
   */
  containsInIncludeList?: (childItem: ISourceFileItem) => boolean;
}

/**
 * Represents a file line in the compiled assembler output
 */
export interface IFileLine {
  fileIndex: number;
  line: number;
  startColumn?: number;
  endColumn?: number;
}

/**
 * This type represents a source map
 */
export type SourceMap = Record<number, IFileLine>;

/**
 * Represents a compilation error
 */
export interface IAssemblerErrorInfo {
  readonly errorCode: ErrorCodes;
  readonly filename: string;
  readonly line: number;
  readonly startPosition: number;
  readonly endPosition: number | null;
  readonly startColumn: number;
  readonly endColumn: number | null;
  readonly message: string;
  readonly isWarning?: boolean;
}

/**
 * Represents an item in the output list
 */
export interface IListFileItem {
  fileIndex: number;
  address: number;
  segmentIndex: number;
  codeStartIndex: number;
  codeLength: number;
  lineNumber: number;
  sourceText: string;
  isMacroInvocation: boolean;
}

/**
 * Type of the fixup
 */
export enum FixupType {
  Jr,
  Bit8,
  Bit16,
  Bit16Be,
  Equ,
  Ent,
  Xent,
  Struct,
  FieldBit8,
  FieldBit16
}

/**
 * Defines a section of assembly lines
 */
export type DefinitionSection = {
  readonly firstLine: number;
  readonly lastLine: number;
};

/**
 * Represents the definition of a macro
 */
export interface IMacroDefinition {
  readonly macroName: string;
  readonly argNames: IdentifierNode[];
  readonly endLabel: string | null;
  readonly section: DefinitionSection;
}

/**
 * Defines a field of a structure
 */
export interface IFieldDefinition extends IHasUsageInfo {
  readonly offset: number;
  isUsed: boolean;
}

/**
 * Represents a struct
 */
export interface IStructDefinition {
  readonly structName: string;

  /**
   * Struct definition section
   */
  readonly section: DefinitionSection;

  /**
   * The fields of the structure
   */
  readonly fields: Record<string, IFieldDefinition>;

  /**
   * The size of the structure
   */
  size: number;

  /**
   * Adds a new field to the structure
   * @param fieldName Field name
   * @param definition Field definition
   */
  addField(fieldName: string, definition: IFieldDefinition): void;

  /**
   * Tests if the structure contains a field
   * @param fieldName Name of the field to check
   * @returns True, if the struct contains the field; otherwise, false.
   */
  containsField(fieldName: string): boolean;

  /**
   * Gets the specified field definition
   * @param name field name
   * @returns The field information, if found; otherwise, undefined.
   */
  getField(fieldName: string): IFieldDefinition | undefined;
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
