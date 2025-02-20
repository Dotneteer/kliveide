import type { Token } from "./token-stream";

/**
 * Aggregate type for all syntax nodes
 */
export type Node =
  | Program
  | LabelOnlyLine
  | CommentOnlyLine
  | MacroParameterLine
  | Instruction
  | Expression
  | Directive
  | Pragma
  | Operand
  | Statement
  | MacroOrStructInvocation
  | FieldAssignment;

export type Instruction =
  | SimpleZ80Instruction
  | TestInstruction
  | NextRegInstruction
  | MirrorInstruction
  | MulInstruction
  | DjnzInstruction
  | RstInstruction
  | ImInstruction
  | JrInstruction
  | JpInstruction
  | CallInstruction
  | RetInstruction
  | IncInstruction
  | DecInstruction
  | PushInstruction
  | PopInstruction
  | LdInstruction
  | ExInstruction
  | AluInstruction
  | InInstruction
  | OutInstruction
  | ShiftRotateInstruction
  | BitInstruction
  | ResInstruction
  | SetInstruction;

export type ShiftRotateInstruction =
  | RlcInstruction
  | RrcInstruction
  | RlInstruction
  | RrInstruction
  | SlaInstruction
  | SraInstruction
  | SllInstruction
  | SrlInstruction;

export type AluInstruction =
  | AddInstruction
  | AdcInstruction
  | SbcInstruction
  | SubInstruction
  | AndInstruction
  | XorInstruction
  | OrInstruction
  | CpInstruction;

export type Expression =
  | IdentifierNode
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
  | CurrentCounterLiteral
  | MacroParameter
  | MacroTimeFunctionInvocation
  | FunctionInvocation;

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
  | InjectOptPragma
  | OnSuccessPragma;

export type ByteEmittingPragma =
  | DefBPragma
  | DefWPragma
  | DefCPragma
  | DefMPragma
  | DefNPragma
  | DefHPragma
  | DefSPragma
  | FillbPragma
  | FillwPragma
  | DefGPragma
  | DefGxPragma;

export type IfLikeStatement = IfStatement | IfUsedStatement | IfNUsedStatement;

export type Statement =
  | MacroStatement
  | MacroEndStatement
  | LoopStatement
  | LoopEndStatement
  | WhileStatement
  | WhileEndStatement
  | RepeatStatement
  | UntilStatement
  | ProcStatement
  | ProcEndStatement
  | IfLikeStatement
  | ElseStatement
  | ElseIfStatement
  | EndIfStatement
  | BreakStatement
  | ContinueStatement
  | ModuleStatement
  | ModuleEndStatement
  | StructStatement
  | StructEndStatement
  | NextStatement
  | ForStatement;

// ============================================================================
// Fundamental syntax node types

/**
 * This class represents the root class of all syntax nodes
 */
export interface BaseNode {
  /**
   * Node type discriminator
   */
  type: Node["type"];
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

// ============================================================================
// Assembly line node types

/**
 * Represents a Z80 assembly line that can be expanded with attributes
 */
export interface PartialZ80AssemblyLine extends BaseNode {
  /**
   * Optional label
   */
  label?: IdentifierNode | null;

  /**
   * Optional macro parameters in the line
   */
  macroParams?: MacroParameter[];
}

/**
 * Represents a node that describes an assembly line
 */
export interface Z80AssemblyLine extends PartialZ80AssemblyLine, NodePosition {
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
export interface LabelOnlyLine extends PartialZ80AssemblyLine {
  type: "LabelOnlyLine";
}

/**
 * Represents an assembly line with a single label
 */
export interface CommentOnlyLine extends PartialZ80AssemblyLine {
  type: "CommentOnlyLine";
}

/**
 * Represents an assembly line with a single label
 */
export interface MacroParameterLine extends PartialZ80AssemblyLine {
  type: "MacroParameterLine";
}

// ============================================================================
// Expression node types

/**
 * Represents the common root node of expressions
 */
export interface ExpressionNode extends BaseNode, NodePosition {
  /**
   * The expression source code (used for macro argument replacement)
   */
  sourceText: string;
}

/**
 * Represents a node that describes an assembly line
 */
export interface IdentifierNode extends ExpressionNode {
  type: "Identifier";

  /**
   * Identifier name
   */
  name: string;
}

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
  operand: Expression;
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
  left: Expression;

  /**
   * Right operand
   */
  right: Expression;
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
  identifier: IdentifierNode;
}

/**
 * Represents a ternary conditional expression
 */
export interface ConditionalExpression extends ExpressionNode {
  type: "ConditionalExpression";

  condition: Expression;
  consequent: Expression;
  alternate: Expression;
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

/**
 * Represents a macro parameter expression
 */
export interface MacroParameter extends ExpressionNode, NodePosition {
  type: "MacroParameter";
  identifier: IdentifierNode;
}

/**
 * Represents a built-in function invocation
 */
export interface MacroTimeFunctionInvocation extends ExpressionNode {
  type: "MacroTimeFunctionInvocation";
  functionName: string;
  operand?: Operand;
}

/**
 * Represents a function invocation
 */
export interface FunctionInvocation extends ExpressionNode {
  type: "FunctionInvocation";
  functionName: IdentifierNode;
  args: Expression[];
}

// ============================================================================
// Instrcution syntax node types

/**
 * This class is the root case of all syntax nodes that describe an operation
 */
export interface Z80Instruction extends PartialZ80AssemblyLine {}

/**
 * Represents a trivial (argumentless) Z80 instruction
 */
export interface SimpleZ80Instruction extends Z80Instruction {
  type: "SimpleZ80Instruction";
  mnemonic: string;
}

/**
 * Represents a TEST Z80 instruction
 */
export interface TestInstruction extends Z80Instruction {
  type: "TestInstruction";
  expr: Expression;
}

/**
 * Represents a NEXTREG Z80 instruction
 */
export interface NextRegInstruction extends Z80InstructionWithTwoOperands {
  type: "NextRegInstruction";
}

/**
 * Represents a MIRROR Z80 instruction
 */
export interface MirrorInstruction extends Z80Instruction {
  type: "MirrorInstruction";
}

/**
 * Represents a MUL Z80 instruction
 */
export interface MulInstruction extends Z80Instruction {
  type: "MulInstruction";
}

/**
 * Represents a DJNZ Z80 instruction
 */
export interface DjnzInstruction extends Z80Instruction {
  type: "DjnzInstruction";
  target: Operand;
}

/**
 * Represents an RST Z80 instruction
 */
export interface RstInstruction extends Z80Instruction {
  type: "RstInstruction";
  target: Operand;
}

/**
 * Represents an IM Z80 instruction
 */
export interface ImInstruction extends Z80Instruction {
  type: "ImInstruction";
  mode: Operand;
}

/**
 * Represents a JR Z80 instruction
 */
export interface JrInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "JrInstruction";
}

/**
 * Represents a JP Z80 instruction
 */
export interface JpInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "JpInstruction";
}

/**
 * Represents a CALL Z80 instruction
 */
export interface CallInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "CallInstruction";
}

/**
 * Represents a RET Z80 instruction
 */
export interface RetInstruction extends Z80Instruction {
  type: "RetInstruction";
  condition?: Operand;
}

/**
 * Represents a Z80 instruction with a single mandatory operand
 */
export interface Z80InstructionWithOneOperand extends Z80Instruction {
  operand: Operand;
}

/**
 * Represents an INC Z80 instruction
 */
export interface IncInstruction extends Z80InstructionWithOneOperand {
  type: "IncInstruction";
}

/**
 * Represents a DEC Z80 instruction
 */
export interface DecInstruction extends Z80InstructionWithOneOperand {
  type: "DecInstruction";
}

/**
 * Represents a PUSH Z80 instruction
 */
export interface PushInstruction extends Z80InstructionWithOneOperand {
  type: "PushInstruction";
}

/**
 * Represents a POP Z80 instruction
 */
export interface PopInstruction extends Z80InstructionWithOneOperand {
  type: "PopInstruction";
}

/**
 * Represents a Z80 instruction with two mandatory operands
 */
export interface Z80InstructionWithTwoOperands extends Z80Instruction {
  operand1: Operand;
  operand2: Operand;
}

/**
 * Represents an LD Z80 instruction
 */
export interface LdInstruction extends Z80InstructionWithTwoOperands {
  type: "LdInstruction";
}

/**
 * Represents an EX Z80 instruction
 */
export interface ExInstruction extends Z80InstructionWithTwoOperands {
  type: "ExInstruction";
}

/**
 * Represents an ADD Z80 instruction
 */
export interface AddInstruction extends Z80InstructionWithTwoOperands {
  type: "AddInstruction";
}

/**
 * Represents an ADC Z80 instruction
 */
export interface AdcInstruction extends Z80InstructionWithTwoOperands {
  type: "AdcInstruction";
}

/**
 * Represents an SBC Z80 instruction
 */
export interface SbcInstruction extends Z80InstructionWithTwoOperands {
  type: "SbcInstruction";
}

/**
 * Represents an BIT Z80 instruction
 */
export interface BitInstruction extends Z80InstructionWithTwoOperands {
  type: "BitInstruction";
}

/**
 * Represents a Z80 instruction with one mandatory and an optional operand
 */
export interface Z80InstructionWithOneOrTwoOperands extends Z80Instruction {
  operand1: Operand;
  operand2?: Operand;
}

/**
 * Represents an SUB Z80 instruction
 */
export interface SubInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "SubInstruction";
}

/**
 * Represents an AND Z80 instruction
 */
export interface AndInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "AndInstruction";
}

/**
 * Represents a XOR Z80 instruction
 */
export interface XorInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "XorInstruction";
}

/**
 * Represents an OR Z80 instruction
 */
export interface OrInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "OrInstruction";
}

/**
 * Represents a CP Z80 instruction
 */
export interface CpInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "CpInstruction";
}

/**
 * Represents an IN Z80 instruction
 */
export interface InInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "InInstruction";
}

/**
 * Represents an OUT Z80 instruction
 */
export interface OutInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "OutInstruction";
}

/**
 * Represents an RLC Z80 instruction
 */
export interface RlcInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "RlcInstruction";
}

/**
 * Represents an RRC Z80 instruction
 */
export interface RrcInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "RrcInstruction";
}

/**
 * Represents an RL Z80 instruction
 */
export interface RlInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "RlInstruction";
}

/**
 * Represents an RR Z80 instruction
 */
export interface RrInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "RrInstruction";
}

/**
 * Represents an SLA Z80 instruction
 */
export interface SlaInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "SlaInstruction";
}

/**
 * Represents an SRA Z80 instruction
 */
export interface SraInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "SraInstruction";
}

/**
 * Represents an SLL Z80 instruction
 */
export interface SllInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "SllInstruction";
}

/**
 * Represents an SRL Z80 instruction
 */
export interface SrlInstruction extends Z80InstructionWithOneOrTwoOperands {
  type: "SrlInstruction";
}

/**
 * Represents a Z80 instruction with two mandatory and an optional operand
 */
export interface Z80InstructionWithTwoOrThreeOperands extends Z80Instruction {
  operand1: Operand;
  operand2: Operand;
  operand3?: Operand;
}

/**
 * Represents an RES Z80 instruction
 */
export interface ResInstruction extends Z80InstructionWithTwoOrThreeOperands {
  type: "ResInstruction";
}

/**
 * Represents a SET Z80 instruction
 */
export interface SetInstruction extends Z80InstructionWithTwoOrThreeOperands {
  type: "SetInstruction";
}

// ============================================================================
// Operand syntax node types

/**
 * Represents an operand that may have many forms
 */
export interface Operand extends BaseNode {
  type: "Operand";
  startToken?: Token;
  operandType: OperandType;
  register?: string;
  expr?: Expression;
  offsetSign?: string;
  macroParam?: MacroParameter;
}

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

// ============================================================================
// Directive syntax node types

export interface IfDefDirective extends PartialZ80AssemblyLine {
  type: "IfDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
}

export interface IfNDefDirective extends PartialZ80AssemblyLine {
  type: "IfNDefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
}

export interface DefineDirective extends PartialZ80AssemblyLine {
  type: "DefineDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
}

export interface UndefDirective extends PartialZ80AssemblyLine {
  type: "UndefDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
}

export interface IfModDirective extends PartialZ80AssemblyLine {
  type: "IfModDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
}

export interface IfNModDirective extends PartialZ80AssemblyLine {
  type: "IfNModDirective";

  /**
   * Identifier of the directive
   */
  identifier: IdentifierNode;
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
  condition: Expression;
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
  lineNumber: Expression;

  /**
   * Optional line comment
   */
  filename?: string;
}

// ============================================================================
// Pragma syntax node types

export interface OrgPragma extends PartialZ80AssemblyLine {
  type: "OrgPragma";

  /**
   * Origin address
   */
  address: Expression;
}

export interface BankPragma extends PartialZ80AssemblyLine {
  type: "BankPragma";

  /**
   * ID of the bank
   */
  bankId: Expression;

  /**
   * Origin address
   */
  offset?: Expression;
}

export interface XorgPragma extends PartialZ80AssemblyLine {
  type: "XorgPragma";

  /**
   * Origin address
   */
  address: Expression;
}

export interface EntPragma extends PartialZ80AssemblyLine {
  type: "EntPragma";

  /**
   * Entry address
   */
  address: Expression;
}

export interface XentPragma extends PartialZ80AssemblyLine {
  type: "XentPragma";

  /**
   * Entry address
   */
  address: Expression;
}

export interface DispPragma extends PartialZ80AssemblyLine {
  type: "DispPragma";

  /**
   * Displacement
   */
  offset: Expression;
}

export interface EquPragma extends PartialZ80AssemblyLine {
  type: "EquPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface VarPragma extends PartialZ80AssemblyLine {
  type: "VarPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface DefBPragma extends PartialZ80AssemblyLine {
  type: "DefBPragma";

  /**
   * Pragma values
   */
  values: Expression[];
}

export interface DefWPragma extends PartialZ80AssemblyLine {
  type: "DefWPragma";

  /**
   * Pragma values
   */
  values: Expression[];
}

export interface DefCPragma extends PartialZ80AssemblyLine {
  type: "DefCPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface DefNPragma extends PartialZ80AssemblyLine {
  type: "DefNPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface DefMPragma extends PartialZ80AssemblyLine {
  type: "DefMPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface DefHPragma extends PartialZ80AssemblyLine {
  type: "DefHPragma";

  /**
   * Pragma value
   */
  value: Expression;
}

export interface SkipPragma extends PartialZ80AssemblyLine {
  type: "SkipPragma";

  /**
   * Number of bytes to skip
   */
  skip: Expression;

  /**
   * Filler byte
   */
  fill?: Expression;
}

export interface ExternPragma extends PartialZ80AssemblyLine {
  type: "ExternPragma";
}

export interface DefSPragma extends PartialZ80AssemblyLine {
  type: "DefSPragma";

  /**
   * Number of bytes to skip
   */
  count: Expression;

  /**
   * Filler byte
   */
  fill?: Expression;
}

export interface FillbPragma extends PartialZ80AssemblyLine {
  type: "FillbPragma";

  /**
   * Number of bytes to skip
   */
  count: Expression;

  /**
   * Filler byte
   */
  fill: Expression;
}

export interface FillwPragma extends PartialZ80AssemblyLine {
  type: "FillwPragma";

  /**
   * Number of words to skip
   */
  count: Expression;

  /**
   * Filler byte
   */
  fill?: Expression;
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
  alignExpr?: Expression;
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
  values: Expression[];
}

export interface RndSeedPragma extends PartialZ80AssemblyLine {
  type: "RndSeedPragma";

  /**
   * ID of the model
   */
  seedExpr?: Expression;
}

export interface DefGxPragma extends PartialZ80AssemblyLine {
  type: "DefGxPragma";

  /**
   * Pragma value
   */
  pattern: Expression;
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
  message: Expression;
}

export interface IncBinPragma extends PartialZ80AssemblyLine {
  type: "IncBinPragma";

  /**
   * File to include
   */
  filename: Expression;

  /**
   * Offset
   */
  offset?: Expression;

  /**
   * Included length
   */
  length?: Expression;
}

export interface CompareBinPragma extends PartialZ80AssemblyLine {
  type: "CompareBinPragma";

  /**
   * File to include
   */
  filename: Expression;

  /**
   * Offset
   */
  offset?: Expression;

  /**
   * Included length
   */
  length?: Expression;
}

export interface InjectOptPragma extends PartialZ80AssemblyLine {
  type: "InjectOptPragma";

  /**
   * Option identifier
   */
  identifiers: IdentifierNode[];
}

export interface OnSuccessPragma extends PartialZ80AssemblyLine {
  type: "OnSuccessPragma";

  /**
   * Pragma values
   */
  command: string;
}

// ============================================================================
// Statement syntax nodes

export interface StatementBase extends PartialZ80AssemblyLine {
  isBlock?: boolean;
}

/**
 * Represents a macro definition
 */
export interface MacroStatement extends StatementBase {
  type: "MacroStatement";
  parameters: IdentifierNode[];
}

/**
 * Represents a macro end statement
 */
export interface MacroEndStatement extends StatementBase {
  type: "MacroEndStatement";
}

/**
 * Represents a .loop statement
 */
export interface LoopStatement extends StatementBase {
  type: "LoopStatement";
  expr: Expression;
}

/**
 * Represents a loop end statement
 */
export interface LoopEndStatement extends StatementBase {
  type: "LoopEndStatement";
}

/**
 * Represents a .while statement
 */
export interface WhileStatement extends StatementBase {
  type: "WhileStatement";
  expr: Expression;
}

/**
 * Represents a while end statement
 */
export interface WhileEndStatement extends StatementBase {
  type: "WhileEndStatement";
}

/**
 * Represents a .repeat statement
 */
export interface RepeatStatement extends StatementBase {
  type: "RepeatStatement";
}

/**
 * Represents an until statement
 */
export interface UntilStatement extends StatementBase {
  type: "UntilStatement";
  expr: Expression;
}

/**
 * Represents a .proc statement
 */
export interface ProcStatement extends StatementBase {
  type: "ProcStatement";
}

/**
 * Represents a proc end statement
 */
export interface ProcEndStatement extends StatementBase {
  type: "ProcEndStatement";
}

/**
 * Represents an if statement
 */
export interface IfStatement extends StatementBase {
  type: "IfStatement";
  expr: Expression;
}

/**
 * Represents an ifused statement
 */
export interface IfUsedStatement extends StatementBase {
  type: "IfUsedStatement";
  symbol: Symbol;
}

/**
 * Represents an ifnused statement
 */
export interface IfNUsedStatement extends StatementBase {
  type: "IfNUsedStatement";
  symbol: Symbol;
}

/**
 * Represents an else statement
 */
export interface ElseStatement extends StatementBase {
  type: "ElseStatement";
}

/**
 * Represents an endif statement
 */
export interface EndIfStatement extends StatementBase {
  type: "EndIfStatement";
}

/**
 * Represents an elseif statement
 */
export interface ElseIfStatement extends StatementBase {
  type: "ElseIfStatement";
  expr: Expression;
}

/**
 * Represents a break statement
 */
export interface BreakStatement extends StatementBase {
  type: "BreakStatement";
}

/**
 * Represents a continue statement
 */
export interface ContinueStatement extends StatementBase {
  type: "ContinueStatement";
}

/**
 * Represents a module statement
 */
export interface ModuleStatement extends StatementBase {
  type: "ModuleStatement";
  identifier?: IdentifierNode;
}

/**
 * Represents a module end statement
 */
export interface ModuleEndStatement extends StatementBase {
  type: "ModuleEndStatement";
}

/**
 * Represents a struct statement
 */
export interface StructStatement extends StatementBase {
  type: "StructStatement";
}

/**
 * Represents a struct statement
 */
export interface StructEndStatement extends StatementBase {
  type: "StructEndStatement";
}

/**
 * Represents a struct statement
 */
export interface NextStatement extends StatementBase {
  type: "NextStatement";
}

/**
 * Represents a for statement
 */
export interface ForStatement extends StatementBase {
  type: "ForStatement";
  identifier: IdentifierNode;
  startExpr: Expression;
  toExpr: Expression;
  stepExpr?: Expression;
}

/**
 * Represents a field assignment
 */
export interface FieldAssignment extends StatementBase {
  type: "FieldAssignment";
  assignment: ByteEmittingPragma;
}

/**
 * Represents a macro or struct invokation
 */
export interface MacroOrStructInvocation extends StatementBase {
  type: "MacroOrStructInvocation";
  identifier: IdentifierNode;
  operands: Operand[];
}
