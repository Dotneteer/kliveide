import { ExpressionValueType } from "@abstractions/CompilerInfo";
import {
  AssemblyLine,
  CompareBinPragma,
  Expression,
  IdentifierNode,
  NodePosition,
  Statement
} from "./tree-nodes";
import { CommonTokenType } from "./common-tokens";

export type TypedObject = { type: string };

/**
 * Describes the structure of error messages
 */
export interface ParserErrorMessage<T> {
  code: T;
  text: string;
  position: number;
  line: number;
  column: number;
}

/**
 * This enum defines the types of assembly symbols
 */
export enum SymbolType {
  None,
  Label,
  Var
}

/**
 * Represents the value of an evaluated expression
 */
export interface IExpressionValue {
  /**
   * Gets the type of the expression
   */
  readonly type: ExpressionValueType;

  /**
   * Checks if the value of this expression is valid
   */
  readonly isValid: boolean;

  /**
   * Checks if the value of this expression is not evaluated
   */
  readonly isNonEvaluated: boolean;

  /**
   * Gets the value of this instance
   */
  readonly value: number;

  /**
   * Returns the value as a long integer
   */
  asLong(): number;

  /**
   * Returns the value as a real number
   */
  asReal(): number;

  /**
   * Returns the value as a string
   */
  asString(): string;

  /**
   * Returns the value as a Boolean
   */
  asBool(): boolean;

  /**
   * Returns the value as a 16-bit unsigned integer
   */
  asWord(): number;

  /**
   * Returns the value as an 8-bit unsigned integer
   */
  asByte(): number;
}

/**
 * Map of symbols
 */
export type SymbolValueMap = Record<string, IExpressionValue>;

/**
 * Objects implementing this interface have usage information
 */
export interface IHasUsageInfo {
  /**
   * Signs if the object has been used
   */
  isUsed: boolean;
}

/**
 * Information about a symbol's value
 */
export interface IValueInfo {
  /**
   * The value of the symbol
   */
  value: IExpressionValue;

  /**
   * Symbol usage information
   */
  usageInfo: IHasUsageInfo;
}

/**
 * This class represents an assembly symbol
 */
export interface IAssemblySymbolInfo extends IHasUsageInfo {
  readonly name: string;
  readonly type: SymbolType;
  value: IExpressionValue;

  /**
   * Tests if this symbol is a local symbol within a module.
   */
  readonly isModuleLocal: boolean;

  /**
   * Tests if this symbol is a short-term symbol.
   */
  readonly isShortTerm: boolean;
}

/**
 * Represents the context in which an expression is evaluated
 */
export interface IEvaluationContext<TNode extends TypedObject, TToken extends CommonTokenType> {
  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): AssemblyLine<TNode>;

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(sourceLine: AssemblyLine<TNode>): void;

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
  doEvalExpression(
    context: IEvaluationContext<TNode, TToken>,
    expr: Expression<TNode, TToken>
  ): IExpressionValue;

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   * @param parameters Optional error parameters
   */
  reportEvaluationError(
    context: IEvaluationContext<TNode, TToken>,
    code: string,
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
   * Flag indicating if this bank segment should be exported to NEX file
   * Default: true for Next model banks, ignored for other models
   */
  nexExport?: boolean;

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
  readonly errorCode: string;
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
export interface IMacroDefinition<TNode extends TypedObject> {
  readonly macroName: string;
  readonly argNames: IdentifierNode<TNode>[];
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
export class IfDefinition<TNode extends TypedObject, TToken extends CommonTokenType> {
  /**
   * The entire if section
   */
  fullSection: DefinitionSection;

  /**
   * List of IF sections
   */
  ifSections: IfSection<TNode, TToken>[] = [];

  /**
   * Optional ELSE section
   */
  elseSection?: IfSection<TNode, TToken>;
}

/**
 * Represents a section of an IF definition
 */
export class IfSection<TNode extends TypedObject, TToken extends CommonTokenType> {
  constructor(
    public readonly ifStatement: Statement<TNode, TToken>,
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
export class BinaryComparisonInfo<TNode extends TypedObject, TToken extends CommonTokenType> {
  constructor(
    public readonly comparePragma: CompareBinPragma<TNode, TToken>,
    public readonly segment: IBinarySegment,
    public readonly segmentLength: number
  ) {}
}
