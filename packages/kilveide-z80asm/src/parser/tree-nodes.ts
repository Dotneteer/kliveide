/**
 * Aggregate type for all syntax nodes
 */
export type Node =
  | Program
  | LabelOnlyLine
  | Instruction
  | Expression
  | Directive;
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
  line: ExpressionNode;

  /**
   * Optional line comment
   */
  comment: string | null;
}



