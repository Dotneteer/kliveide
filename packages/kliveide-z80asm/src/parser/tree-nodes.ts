/**
 * Aggregate type for all syntax nodes
 */
export type Node =
  | Program
  | LabelOnlyLine
  | Instruction
  | Expression
  | Directive
  | Pragma;
export type Instruction = SimpleZ80Instruction;
export type Expression =
  | UnaryExpression
  | BinaryExpression
  | ConditionalExpression
  | Symbol
  | IntegerLiteral
  | RealLiteral
  | CharLiteral
  | StringLiteral
  | BooleanLiteral
  | CurrentAddressLiteral
  | CurrentCounterLiteral;
export type Directive =
  | IfDefDirective
  | IfNDefDirective
  | DefineDirective
  | UndefDirective
  | IfModDirective
  | IfNModDirective
  | EndIfDirective
  | ElseDirective
  | IfDirective
  | IncludeDirective
  | LineDirective;
export type Pragma =
  | OrgPragma
  | BankPragma
  | XorgPragma
  | EntPragma
  | XentPragma
  | DispPragma
  | EquPragma
  | VarPragma
  | DefBPragma
  | DefWPragma
  | DefCPragma
  | DefMPragma
  | DefNPragma
  | DefHPragma
  | SkipPragma
  | ExternPragma
  | DefSPragma
  | FillbPragma
  | FillwPragma
  | ModelPragma
  | AlignPragma
  | TracePragma
  | RndSeedPragma
  | DefGPragma
  | DefGxPragma
  | ErrorPragma
  | IncBinPragma
  | CompareBinPragma
  | ZxBasicPragma
  | InjectOptPragma;

/**
 * This class represents the root class of all syntax nodes
 */
export interface BaseNode {
  /**
   * Node type discriminator
   */
  type: Node["type"];
}

/**
 * Represents a Z80 assembly line that can be expanded with attributes
 */
export interface PartialZ80AssemblyLine extends BaseNode {
  /**
   * Optional label
   */
  label?: string;
}

/**
 * Represents the common root node of expressions
 */
export interface ExpressionNode extends BaseNode {}

/**
 * Represents an unary expression
 */
export interface UnaryExpression extends ExpressionNode {
  type: "UnaryExpression";

  /**
   * Unary operator
   */
  operator: "+" | "-" | "~" | "!";

  /**
   * Operand of the expression
   */
  operand: ExpressionNode;
}

/**
 * Represents a binary expression
 */
export interface BinaryExpression extends ExpressionNode {
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
  left: ExpressionNode;

  /**
   * Right operand
   */
  right: ExpressionNode;
}

/**
 * Respresents a symbol
 */
export interface Symbol extends ExpressionNode {
  type: "Symbol";

  /**
   * Starts form global namespace?
   */
  startsFromGlobal: boolean;

  /**
   * Identifier name
   */
  identifier: string;
}

/**
 * Represents a ternary conditional expression
 */
export interface ConditionalExpression extends ExpressionNode {
  type: "ConditionalExpression";

  condition: ExpressionNode;
  consequent: ExpressionNode;
  alternate: ExpressionNode;
}

/**
 * Represents an integer literal with any radix
 */
export interface IntegerLiteral extends ExpressionNode {
  type: "IntegerLiteral";

  /**
   * Value of the literal
   */
  value: number;
}

/**
 * Represents a real number literal
 */
export interface RealLiteral extends ExpressionNode {
  type: "RealLiteral";

  /**
   * Value of the literal
   */
  value: number;
}

/**
 * Represents a string literal
 */
export interface StringLiteral extends ExpressionNode {
  type: "StringLiteral";

  /**
   * Value of the literal
   */
  value: string;
}

/**
 * Represents a character literal
 */
export interface CharLiteral extends ExpressionNode {
  type: "CharLiteral";

  /**
   * Value of the literal
   */
  value: string;
}

/**
 * Represents a boolean literal
 */
export interface BooleanLiteral extends ExpressionNode {
  type: "BooleanLiteral";

  /**
   * Value of the literal
   */
  value: boolean;
}

/**
 * Represents a current address literal
 */
export interface CurrentAddressLiteral extends ExpressionNode {
  type: "CurrentAddressLiteral";
}

/**
 * Represents a current counter literal
 */
export interface CurrentCounterLiteral extends ExpressionNode {
  type: "CurrentCounterLiteral";
}

// ============================================================================
// Factory methods

/*
 * Represents the root node of the entire Z80 program
 */
export interface Program extends BaseNode {
  type: "Program";
  /**
   * Assembly lines of the program
   */
  assemblyLines: Z80AssemblyLine[];
}

/**
 * Represents a node that describes an assembly line
 */
export interface Z80AssemblyLine extends PartialZ80AssemblyLine {
  /**
   * Optional label
   */
  label?: string;

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

/**
 * Represents an assembly line with a single label
 */
export interface LabelOnlyLine extends PartialZ80AssemblyLine {
  type: "LabelOnlyLine";
}

/**
 * This class is the root case of all syntax nodes that describe an operation
 */
export interface Z80Instruction extends PartialZ80AssemblyLine {
  /**
   * Mnemonic of the instruction (uppercase)
   */
  mnemonic: string;
}

/**
 * Represents a trivial (argumentless) Z80 instruction
 */
export interface SimpleZ80Instruction extends Z80Instruction {
  type: "SimpleZ80Instruction";
}

export interface IfDefDirective extends PartialZ80AssemblyLine {
  type: "IfDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface IfNDefDirective extends PartialZ80AssemblyLine {
  type: "IfNDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface DefineDirective extends PartialZ80AssemblyLine {
  type: "DefineDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface UndefDirective extends PartialZ80AssemblyLine {
  type: "UndefDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface IfModDirective extends PartialZ80AssemblyLine {
  type: "IfModDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface IfNModDirective extends PartialZ80AssemblyLine {
  type: "IfNModDirective";

  /**
   * Identifier of the directive
   */
  identifier: string;
}

export interface EndIfDirective extends PartialZ80AssemblyLine {
  type: "EndIfDirective";
}

export interface ElseDirective extends PartialZ80AssemblyLine {
  type: "ElseDirective";
}

export interface IfDirective extends PartialZ80AssemblyLine {
  type: "IfDirective";

  /**
   * IF condition
   */
  condition: ExpressionNode;
}

export interface IncludeDirective extends PartialZ80AssemblyLine {
  type: "IncludeDirective";

  /**
   * Name of the file to include
   */
  filename: string;
}

export interface LineDirective extends PartialZ80AssemblyLine {
  type: "LineDirective";

  /**
   * Line number
   */
  lineNumber: ExpressionNode;

  /**
   * Optional line comment
   */
  comment?: string;
}

export interface OrgPragma extends PartialZ80AssemblyLine {
  type: "OrgPragma";

  /**
   * Origin address
   */
  address: ExpressionNode;
}

export interface BankPragma extends PartialZ80AssemblyLine {
  type: "BankPragma";

  /**
   * ID of the bank
   */
  bankId: ExpressionNode;

  /**
   * Origin address
   */
  offset?: ExpressionNode;
}

export interface XorgPragma extends PartialZ80AssemblyLine {
  type: "XorgPragma";

  /**
   * Origin address
   */
  address: ExpressionNode;
}

export interface EntPragma extends PartialZ80AssemblyLine {
  type: "EntPragma";

  /**
   * Entry address
   */
  address: ExpressionNode;
}

export interface XentPragma extends PartialZ80AssemblyLine {
  type: "XentPragma";

  /**
   * Entry address
   */
  address: ExpressionNode;
}

export interface DispPragma extends PartialZ80AssemblyLine {
  type: "DispPragma";

  /**
   * Displacement
   */
  offset: ExpressionNode;
}

export interface EquPragma extends PartialZ80AssemblyLine {
  type: "EquPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface VarPragma extends PartialZ80AssemblyLine {
  type: "VarPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface DefBPragma extends PartialZ80AssemblyLine {
  type: "DefBPragma";

  /**
   * Pragma values
   */
  values: ExpressionNode[];
}

export interface DefWPragma extends PartialZ80AssemblyLine {
  type: "DefWPragma";

  /**
   * Pragma values
   */
  values: ExpressionNode[];
}

export interface DefCPragma extends PartialZ80AssemblyLine {
  type: "DefCPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface DefNPragma extends PartialZ80AssemblyLine {
  type: "DefNPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface DefMPragma extends PartialZ80AssemblyLine {
  type: "DefMPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface DefHPragma extends PartialZ80AssemblyLine {
  type: "DefHPragma";

  /**
   * Pragma value
   */
  value: ExpressionNode;
}

export interface SkipPragma extends PartialZ80AssemblyLine {
  type: "SkipPragma";

  /**
   * Number of bytes to skip
   */
  skip: ExpressionNode;

  /**
   * Filler byte
   */
  fill?: ExpressionNode;
}

export interface ExternPragma extends PartialZ80AssemblyLine {
  type: "ExternPragma";
}

export interface DefSPragma extends PartialZ80AssemblyLine {
  type: "DefSPragma";

  /**
   * Number of bytes to skip
   */
  count: ExpressionNode;

  /**
   * Filler byte
   */
  fill?: ExpressionNode;
}

export interface FillbPragma extends PartialZ80AssemblyLine {
  type: "FillbPragma";

  /**
   * Number of bytes to skip
   */
  count: ExpressionNode;

  /**
   * Filler byte
   */
  fill?: ExpressionNode;
}

export interface FillwPragma extends PartialZ80AssemblyLine {
  type: "FillwPragma";

  /**
   * Number of words to skip
   */
  count: ExpressionNode;

  /**
   * Filler byte
   */
  fill?: ExpressionNode;
}

export interface ModelPragma extends PartialZ80AssemblyLine {
  type: "ModelPragma";

  /**
   * ID of the model
   */
  modelId: string;
}

export interface AlignPragma extends PartialZ80AssemblyLine {
  type: "AlignPragma";

  /**
   * ID of the model
   */
  alignExpr?: ExpressionNode;
}

export interface TracePragma extends PartialZ80AssemblyLine {
  type: "TracePragma";

  /**
   * Hexa output?
   */
  isHex: boolean;

  /**
   * Pragma values
   */
  values: ExpressionNode[];
}

export interface RndSeedPragma extends PartialZ80AssemblyLine {
  type: "RndSeedPragma";

  /**
   * ID of the model
   */
  seedExpr?: ExpressionNode;
}

export interface DefGxPragma extends PartialZ80AssemblyLine {
  type: "DefGxPragma";

  /**
   * Pragma value
   */
  pattern: ExpressionNode;
}

export interface DefGPragma extends PartialZ80AssemblyLine {
  type: "DefGPragma";

  /**
   * Pragma value
   */
  pattern: string;
}

export interface ErrorPragma extends PartialZ80AssemblyLine {
  type: "ErrorPragma";

  /**
   * Pragma value
   */
  message: ExpressionNode;
}

export interface IncBinPragma extends PartialZ80AssemblyLine {
  type: "IncBinPragma";

  /**
   * File to include
   */
  filename: ExpressionNode;

  /**
   * Offset
   */
  offset?: ExpressionNode;

  /**
   * Included length
   */
  length?: ExpressionNode;
}

export interface CompareBinPragma extends PartialZ80AssemblyLine {
  type: "CompareBinPragma";

  /**
   * File to include
   */
  filename: ExpressionNode;

  /**
   * Offset
   */
  offset?: ExpressionNode;

  /**
   * Included length
   */
  length?: ExpressionNode;
}

export interface ZxBasicPragma extends PartialZ80AssemblyLine {
  type: "ZxBasicPragma";
}

export interface InjectOptPragma extends PartialZ80AssemblyLine {
  type: "InjectOptPragma";

  /**
   * Option identifier
   */
  identifier: string;
}
