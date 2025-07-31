import { TypedObject } from "./abstractions";
import { CommonTokenType } from "./common-tokens";

/**
 * Aggregate type for all syntax nodes
 */
export type Node<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | Program<TInstruction>
  | LabelOnlyLine<TInstruction>
  | CommentOnlyLine<TInstruction>
  | MacroParameterLine<TInstruction>
  | TInstruction
  | Expression<TInstruction, TToken>
  | Directive<TInstruction, TToken>
  | Pragma<TInstruction, TToken>
  | Operand<TInstruction, TToken>
  | Statement<TInstruction, TToken>
  | MacroOrStructInvocation<TInstruction, TToken>
  | FieldAssignment<TInstruction, TToken>;

export type Directive<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | IfDefDirective<TInstruction>
  | IfNDefDirective<TInstruction>
  | DefineDirective<TInstruction>
  | UndefDirective<TInstruction>
  | IfModDirective<TInstruction>
  | IfNModDirective<TInstruction>
  | EndIfDirective<TInstruction>
  | ElseDirective<TInstruction>
  | IfDirective<TInstruction, TToken>
  | IncludeDirective<TInstruction>
  | LineDirective<TInstruction, TToken>;

export type ByteEmittingPragma<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | DefBPragma<TInstruction, TToken>
  | DefWPragma<TInstruction, TToken>
  | DefCPragma<TInstruction, TToken>
  | DefMPragma<TInstruction, TToken>
  | DefNPragma<TInstruction, TToken>
  | DefHPragma<TInstruction, TToken>
  | DefSPragma<TInstruction, TToken>
  | FillbPragma<TInstruction, TToken>
  | FillwPragma<TInstruction, TToken>
  | DefGPragma<TInstruction>
  | DefGxPragma<TInstruction, TToken>;

export type Pragma<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | OrgPragma<TInstruction, TToken>
  | BankPragma<TInstruction, TToken>
  | XorgPragma<TInstruction, TToken>
  | EntPragma<TInstruction, TToken>
  | XentPragma<TInstruction, TToken>
  | DispPragma<TInstruction, TToken>
  | EquPragma<TInstruction, TToken>
  | VarPragma<TInstruction, TToken>
  | ByteEmittingPragma<TInstruction, TToken>
  | SkipPragma<TInstruction, TToken>
  | ExternPragma<TInstruction>
  | ModelPragma<TInstruction>
  | AlignPragma<TInstruction, TToken>
  | TracePragma<TInstruction, TToken>
  | RndSeedPragma<TInstruction, TToken>
  | ErrorPragma<TInstruction, TToken>
  | IncBinPragma<TInstruction, TToken>
  | CompareBinPragma<TInstruction, TToken>
  | InjectOptPragma<TInstruction>
  | OnSuccessPragma<TInstruction>;

export type IfLikeStatement<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | IfStatement<TInstruction, TToken>
  | IfUsedStatement<TInstruction>
  | IfNUsedStatement<TInstruction>;

export type Statement<TInstruction extends TypedObject, TToken extends CommonTokenType> =
  | MacroStatement<TInstruction>
  | MacroEndStatement<TInstruction>
  | LoopStatement<TInstruction, TToken>
  | LoopEndStatement<TInstruction>
  | WhileStatement<TInstruction, TToken>
  | WhileEndStatement<TInstruction>
  | RepeatStatement<TInstruction>
  | UntilStatement<TInstruction, TToken>
  | ProcStatement<TInstruction>
  | ProcEndStatement<TInstruction>
  | IfLikeStatement<TInstruction, TToken>
  | ElseStatement<TInstruction>
  | ElseIfStatement<TInstruction, TToken>
  | EndIfStatement<TInstruction>
  | BreakStatement<TInstruction>
  | ContinueStatement<TInstruction>
  | ModuleStatement<TInstruction>
  | ModuleEndStatement<TInstruction>
  | StructStatement<TInstruction>
  | StructEndStatement<TInstruction>
  | NextStatement<TInstruction>
  | ForStatement<TInstruction, TToken>;

/**
 * Represents a token
 */
export interface Token<T extends CommonTokenType> {
  /**
   * The raw text of the token
   */
  readonly text: string;

  /**
   * The type of the token
   */
  readonly type: T;

  /**
   * The location of the token
   */
  readonly location: TokenLocation;
}

/**
 * Represents the location of a token in the source stream
 */
export interface TokenLocation {
  // Start position in the source stream
  readonly startPosition: number;

  // End position (exclusive) in the source stream
  readonly endPosition: number;

  // Start line number
  readonly startLine: number;

  // End line number of the token
  readonly endLine: number;

  // Start column number of the token
  readonly startColumn: number;

  // End column number of the token
  readonly endColumn: number;
}

/**
 * This class represents the root class of all syntax nodes
 */
export interface BaseNode<T extends TypedObject> {
  /**
   * Node type discriminator
   */
  type: T["type"];
}

export interface NodePosition {
  /**
   * Start line number of the start token of the node
   */
  line: number;

  /**
   * Start position (inclusive) of the node
   */
  startPosition: number;

  /**
   * End position (exclusive)
   */
  endPosition: number;

  /**
   * Start column number (inclusive) of the node
   */
  startColumn: number;

  /**
   * End column number (exclusive) of the node
   */
  endColumn: number;
}

// ============================================================================
// Expression node types

/**
 * Represents the common root node of expressions
 */
export interface ExpressionNode<TNode extends TypedObject> extends BaseNode<TNode>, NodePosition {
  /**
   * The expression source code (used for macro argument replacement)
   */
  sourceText: string;
}

// ============================================================================
// Expression node types

export type Expression<TNode extends TypedObject, TToken extends CommonTokenType> =
  | IdentifierNode<TNode>
  | UnaryExpression<TNode, TToken>
  | BinaryExpression<TNode, TToken>
  | ConditionalExpression<TNode, TToken>
  | Symbol<TNode>
  | IntegerLiteral<TNode>
  | RealLiteral<TNode>
  | CharLiteral<TNode>
  | StringLiteral<TNode>
  | BooleanLiteral<TNode>
  | CurrentAddressLiteral<TNode>
  | CurrentCounterLiteral<TNode>
  | MacroParameter<TNode>
  | MacroTimeFunctionInvocation<TNode, TToken>
  | FunctionInvocation<TNode, TToken>;

/**
 * Represents a node that describes an assembly line
 */
export interface IdentifierNode<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "Identifier";

  /**
   * Identifier name
   */
  name: string;
}

/**
 * Represents an unary expression
 */
export interface UnaryExpression<TNode extends TypedObject, TToken extends CommonTokenType>
  extends ExpressionNode<TNode> {
  type: "UnaryExpression";

  /**
   * Unary operator
   */
  operator: "+" | "-" | "~" | "!";

  /**
   * Operand of the expression
   */
  operand: Expression<TNode, TToken>;
}

/**
 * Represents a binary expression
 */
export interface BinaryExpression<TNode extends TypedObject, TToken extends CommonTokenType>
  extends ExpressionNode<TNode> {
  type: "BinaryExpression";

  /**
   * Unary operator
   */
  operator:
    | "<?"
    | ">?"
    | "*"
    | "/"
    | "%"
    | "+"
    | "-"
    | "<<"
    | ">>"
    | "<"
    | "<="
    | ">"
    | ">="
    | "=="
    | "==="
    | "!="
    | "!=="
    | "&"
    | "|"
    | "^";

  /**
   * Left operand
   */
  left: Expression<TNode, TToken>;

  /**
   * Right operand
   */
  right: Expression<TNode, TToken>;
}

/**
 * Respresents a symbol
 */
export interface Symbol<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "Symbol";

  /**
   * Starts form global namespace?
   */
  startsFromGlobal: boolean;

  /**
   * Identifier name
   */
  identifier: IdentifierNode<TNode>;
}

/**
 * Represents a ternary conditional expression
 */
export interface ConditionalExpression<TNode extends TypedObject, TToken extends CommonTokenType>
  extends ExpressionNode<TNode> {
  type: "ConditionalExpression";

  condition: Expression<TNode, TToken>;
  consequent: Expression<TNode, TToken>;
  alternate: Expression<TNode, TToken>;
}

/**
 * Represents an integer literal with any radix
 */
export interface IntegerLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "IntegerLiteral";

  /**
   * Value of the literal
   */
  value: number;
}

/**
 * Represents a real number literal
 */
export interface RealLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "RealLiteral";

  /**
   * Value of the literal
   */
  value: number;
}

/**
 * Represents a string literal
 */
export interface StringLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "StringLiteral";

  /**
   * Value of the literal
   */
  value: string;
}

/**
 * Represents a character literal
 */
export interface CharLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "CharLiteral";

  /**
   * Value of the literal
   */
  value: string;
}

/**
 * Represents a boolean literal
 */
export interface BooleanLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "BooleanLiteral";

  /**
   * Value of the literal
   */
  value: boolean;
}

/**
 * Represents a current address literal
 */
export interface CurrentAddressLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "CurrentAddressLiteral";
}

/**
 * Represents a current counter literal
 */
export interface CurrentCounterLiteral<TNode extends TypedObject> extends ExpressionNode<TNode> {
  type: "CurrentCounterLiteral";
}

/**
 * Represents a macro parameter expression
 */
export interface MacroParameter<TNode extends TypedObject>
  extends ExpressionNode<TNode>,
    NodePosition {
  type: "MacroParameter";
  identifier: IdentifierNode<TNode>;
}

/**
 * Represents a built-in function invocation
 */
export interface MacroTimeFunctionInvocation<
  TNode extends TypedObject,
  TToken extends CommonTokenType
> extends ExpressionNode<TNode> {
  type: "MacroTimeFunctionInvocation";
  functionName: string;
  operand?: Operand<TNode, TToken>;
}

/**
 * Represents a function invocation
 */
export interface FunctionInvocation<TNode extends TypedObject, TToken extends CommonTokenType>
  extends ExpressionNode<TNode> {
  type: "FunctionInvocation";
  functionName: IdentifierNode<TNode>;
  args: Expression<TNode, TToken>[];
}

// ============================================================================
// Operand syntax node types

/**
 * Classification of operands
 */
export enum OperandType {
  Reg8,
  Reg8Spec,
  Reg8Idx,
  Reg16,
  Reg16Spec,
  Reg16Idx,
  RegIndirect,
  IndexedIndirect,
  MemIndirect,
  CPort,
  Expression,
  Condition,
  NoneArg
}

/**
 * Represents an operand that may have many forms
 */
export interface Operand<TNode extends TypedObject, TToken extends CommonTokenType> {
  type: "Operand";
  startToken?: Token<TToken>;
  operandType: OperandType;
  register?: string;
  expr?: Expression<TNode, TToken>;
  offsetSign?: string;
  macroParam?: MacroParameter<TNode>;
}

// ============================================================================
// Assembly line node types

/**
 * Represents a Z80 assembly line that can be expanded with attributes
 */
export interface PartialAssemblyLine<TNode extends TypedObject> extends BaseNode<TNode> {
  /**
   * Optional label
   */
  label?: IdentifierNode<TNode> | null;

  /**
   * Optional macro parameters in the line
   */
  macroParams?: MacroParameter<TNode>[];
}

/**
 * Represents a node that describes an assembly line
 */
export interface AssemblyLine<TNode extends TypedObject>
  extends PartialAssemblyLine<TNode>,
    NodePosition {
  /**
   * The file index of the parsed file
   */
  fileIndex: number;

  /**
   * Source line text (to store macro text)
   */
  sourceText?: string;

  /**
   * The optional end-of-line comment of the line
   */
  comment: string | null;
}

/**
 * Represents an assembly line with a single label
 */
export interface LabelOnlyLine<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "LabelOnlyLine";
}

/**
 * Represents an assembly line with a single label
 */
export interface CommentOnlyLine<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "CommentOnlyLine";
}

/**
 * Represents an assembly line with a single label
 */
export interface MacroParameterLine<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "MacroParameterLine";
}

// ============================================================================
// Fundamental syntax node types

/*
 * Represents the root node of the entire Z80 program
 */
export interface Program<TNode extends TypedObject> extends BaseNode<TNode> {
  type: "Program";
  /**
   * Assembly lines of the program
   */
  assemblyLines: AssemblyLine<TNode>[];
}

// ============================================================================
// Directive syntax node types

export interface IfDefDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "IfDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface IfNDefDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "IfNDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface DefineDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DefineDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface UndefDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "UndefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface IfModDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "IfModDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface IfNModDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "IfNModDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode<TNode>;
}

export interface EndIfDirective<TNode extends TypedObject> extends AssemblyLine<TNode> {
  type: "EndIfDirective";
}

export interface ElseDirective<TNode extends TypedObject> extends AssemblyLine<TNode> {
  type: "ElseDirective";
}

export interface IfDirective<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "IfDirective";

  /**
   * IF condition
   */
  condition: Expression<TNode, TToken>;
}

export interface IncludeDirective<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "IncludeDirective";

  /**
   * Name of the file to include
   */
  filename: string;
}

export interface LineDirective<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "LineDirective";

  /**
   * Line number
   */
  lineNumber: Expression<TNode, TToken>;

  /**
   * Optional line comment
   */
  filename?: string;
}

// ============================================================================
// Pragma syntax node types

export interface OrgPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "OrgPragma";

  /**
   * Origin address
   */
  address: Expression<TNode, TToken>;
}

export interface BankPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "BankPragma";

  /**
   * ID of the bank
   */
  bankId: Expression<TNode, TToken>;

  /**
   * Origin address
   */
  offset?: Expression<TNode, TToken>;
}

export interface XorgPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "XorgPragma";

  /**
   * Origin address
   */
  address: Expression<TNode, TToken>;
}

export interface EntPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "EntPragma";

  /**
   * Entry address
   */
  address: Expression<TNode, TToken>;
}

export interface XentPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "XentPragma";

  /**
   * Entry address
   */
  address: Expression<TNode, TToken>;
}

export interface DispPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DispPragma";

  /**
   * Displacement
   */
  offset: Expression<TNode, TToken>;
}

export interface EquPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "EquPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface VarPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "VarPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface DefBPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefBPragma";

  /**
   * Pragma values
   */
  values: Expression<TNode, TToken>[];
}

export interface DefWPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefWPragma";

  /**
   * Pragma values
   */
  values: Expression<TNode, TToken>[];
}

export interface DefCPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefCPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface DefNPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefNPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface DefMPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefMPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface DefHPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefHPragma";

  /**
   * Pragma value
   */
  value: Expression<TNode, TToken>;
}

export interface SkipPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "SkipPragma";

  /**
   * Number of bytes to skip
   */
  skip: Expression<TNode, TToken>;

  /**
   * Filler byte
   */
  fill?: Expression<TNode, TToken>;
}

export interface ExternPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "ExternPragma";
}

export interface DefSPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "DefSPragma";

  /**
   * Number of bytes to skip
   */
  count: Expression<TNode, TToken>;

  /**
   * Filler byte
   */
  fill?: Expression<TNode, TToken>;
}

export interface FillbPragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "FillbPragma";

  /**
   * Number of bytes to fill
   */
  count: Expression<TNode, TToken>;

  /**
   * Filler byte
   */
  fill: Expression<TNode, TToken>;
}

export interface FillwPragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "FillwPragma";

  /**
   * Number of words to fill
   */
  count: Expression<TNode, TToken>;

  /**
   * Filler byte
   */
  fill?: Expression<TNode, TToken>;
}

export interface ModelPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "ModelPragma";

  /**
   * ID of the model
   */
  modelId: string;
}

export interface AlignPragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "AlignPragma";

  /**
   * ID of the model
   */
  alignExpr?: Expression<TNode, TToken>;
}

export interface TracePragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "TracePragma";

  /**
   * Hexa output?
   */
  isHex: boolean;

  /**
   * Pragma values
   */
  values: Expression<TNode, TToken>[];
}

export interface RndSeedPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "RndSeedPragma";

  /**
   * ID of the model
   */
  seedExpr?: Expression<TNode, TToken>;
}

export interface DefGxPragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "DefGxPragma";

  /**
   * Pragma value
   */
  pattern: Expression<TNode, TToken>;
}

export interface DefGPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "DefGPragma";

  /**
   * Pragma value
   */
  pattern: string;
}

export interface ErrorPragma<TNode extends TypedObject, TToken extends CommonTokenType> extends PartialAssemblyLine<TNode> {
  type: "ErrorPragma";

  /**
   * Pragma value
   */
  message: Expression<TNode, TToken>;
}

export interface IncBinPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "IncBinPragma";

  /**
   * File to include
   */
  filename: Expression<TNode, TToken>;

  /**
   * Offset
   */
  offset?: Expression<TNode, TToken>;

  /**
   * Included length
   */
  length?: Expression<TNode, TToken>;
}

export interface CompareBinPragma<TNode extends TypedObject, TToken extends CommonTokenType>
  extends PartialAssemblyLine<TNode> {
  type: "CompareBinPragma";

  /**
   * File to include
   */
  filename: Expression<TNode, TToken>;

  /**
   * Offset
   */
  offset?: Expression<TNode, TToken>;

  /**
   * Included length
   */
  length?: Expression<TNode, TToken>;
}

export interface InjectOptPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "InjectOptPragma";

  /**
   * Option identifier
   */
  identifiers: IdentifierNode<TNode>[];
}

export interface OnSuccessPragma<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  type: "OnSuccessPragma";

  /**
   * Pragma values
   */
  command: string;
}

// ============================================================================
// Statement syntax nodes

export interface StatementBase<TNode extends TypedObject> extends PartialAssemblyLine<TNode> {
  isBlock?: boolean;
}

/**
 * Represents a macro definition
 */
export interface MacroStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "MacroStatement";
  parameters: IdentifierNode<TNode>[];
}

/**
 * Represents a macro end statement
 */
export interface MacroEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "MacroEndStatement";
}

/**
 * Represents a .loop statement
 */
export interface LoopStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "LoopStatement";
  expr: Expression<TNode, TToken>;
}

/**
 * Represents a loop end statement
 */
export interface LoopEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "LoopEndStatement";
}

/**
 * Represents a .while statement
 */
export interface WhileStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "WhileStatement";
  expr: Expression<TNode, TToken>;
}

/**
 * Represents a while end statement
 */
export interface WhileEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "WhileEndStatement";
}

/**
 * Represents a .repeat statement
 */
export interface RepeatStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "RepeatStatement";
}

/**
 * Represents an until statement
 */
export interface UntilStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "UntilStatement";
  expr: Expression<TNode, TToken>;
}

/**
 * Represents a .proc statement
 */
export interface ProcStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ProcStatement";
}

/**
 * Represents a proc end statement
 */
export interface ProcEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ProcEndStatement";
}

/**
 * Represents an if statement
 */
export interface IfStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "IfStatement";
  expr: Expression<TNode, TToken>;
}

/**
 * Represents an ifused statement
 */
export interface IfUsedStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "IfUsedStatement";
  symbol: Symbol<TNode>;
}

/**
 * Represents an ifnused statement
 */
export interface IfNUsedStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "IfNUsedStatement";
  symbol: Symbol<TNode>;
}

/**
 * Represents an else statement
 */
export interface ElseStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ElseStatement";
}

/**
 * Represents an endif statement
 */
export interface EndIfStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "EndIfStatement";
}

/**
 * Represents an elseif statement
 */
export interface ElseIfStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "ElseIfStatement";
  expr: Expression<TNode, TToken>;
}

/**
 * Represents a break statement
 */
export interface BreakStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "BreakStatement";
}

/**
 * Represents a continue statement
 */
export interface ContinueStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ContinueStatement";
}

/**
 * Represents a module statement
 */
export interface ModuleStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ModuleStatement";
  identifier?: IdentifierNode<TNode>;
}

/**
 * Represents a module end statement
 */
export interface ModuleEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "ModuleEndStatement";
}

/**
 * Represents a struct statement
 */
export interface StructStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "StructStatement";
}

/**
 * Represents a struct statement
 */
export interface StructEndStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "StructEndStatement";
}

/**
 * Represents a struct statement
 */
export interface NextStatement<TNode extends TypedObject> extends StatementBase<TNode> {
  type: "NextStatement";
}

/**
 * Represents a for statement
 */
export interface ForStatement<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "ForStatement";
  identifier: IdentifierNode<TNode>;
  startExpr: Expression<TNode, TToken>;
  toExpr: Expression<TNode, TToken>;
  stepExpr?: Expression<TNode, TToken>;
}

/**
 * Represents a field assignment
 */
export interface FieldAssignment<TNode extends TypedObject, TToken extends CommonTokenType> extends StatementBase<TNode> {
  type: "FieldAssignment";
  assignment: ByteEmittingPragma<TNode, TToken>;
}

/**
 * Represents a macro or struct invokation
 */
export interface MacroOrStructInvocation<TNode extends TypedObject, TToken extends CommonTokenType>
  extends StatementBase<TNode> {
  type: "MacroOrStructInvocation";
  identifier: IdentifierNode<TNode>;
  operands: Operand<TNode, TToken>[];
}
