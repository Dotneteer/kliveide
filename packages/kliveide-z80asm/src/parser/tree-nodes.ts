import { Func } from "mocha";

/**
 * Aggregate type for all syntax nodes
 */
export type Node =
  | Program
  | LabelOnlyLine
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
  | AddInstruction
  | AdcInstruction
  | SbcInstruction
  | BitInstruction
  | SubInstruction
  | AndInstruction
  | XorInstruction
  | OrInstruction
  | CpInstruction
  | InInstruction
  | OutInstruction
  | RlcInstruction
  | RrcInstruction
  | RlInstruction
  | RrInstruction
  | SlaInstruction
  | SraInstruction
  | SllInstruction
  | SrlInstruction
  | ResInstruction
  | SetInstruction;

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
  | CurrentCounterLiteral
  | MacroParameter
  | BuiltInFunctionInvocation
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
  | ZxBasicPragma
  | InjectOptPragma;

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
  | IfStatement
  | IfUsedStatement
  | IfNUsedStatement
  | ElseStatement
  | ElseIfStatement
  | EndIfStatement
  | BreakStatement
  | ContinueStatement
  | ModuleStatement
  | ModuleEndStatement
  | StructStatement
  | StructEndStatement
  | LocalStatement
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
  label?: string;
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

// ============================================================================
// Expression node types

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

/**
 * Represents a macro parameter expression
 */
export interface MacroParameter extends ExpressionNode {
  type: "MacroParameter";
  identifier: string;
}

/**
 * Represents a built-in function invocation
 */
export interface BuiltInFunctionInvocation extends ExpressionNode {
  type: "BuiltInFunctionInvocation";
  functionName: string;
  operand?: Operand;
  mnemonic?: string;
  regsOrConds?: string;
  macroParam?: string;
}

/**
 * Represents a function invocation
 */
export interface FunctionInvocation extends ExpressionNode {
  type: "FunctionInvocation";
  functionName: string;
  args: ExpressionNode[];
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
  expr: ExpressionNode;
}

/**
 * Represents a NEXTREG Z80 instruction
 */
export interface NextRegInstruction extends Z80Instruction {
  type: "NextRegInstruction";
  register: ExpressionNode;
  value: ExpressionNode | null;
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
  target: ExpressionNode;
}

/**
 * Represents an RST Z80 instruction
 */
export interface RstInstruction extends Z80Instruction {
  type: "RstInstruction";
  target: ExpressionNode;
}

/**
 * Represents an IM Z80 instruction
 */
export interface ImInstruction extends Z80Instruction {
  type: "ImInstruction";
  mode: ExpressionNode;
}

/**
 * Represents a JR Z80 instruction
 */
export interface JrInstruction extends Z80Instruction {
  type: "JrInstruction";
  condition?: string;
  target: ExpressionNode;
}

/**
 * Represents a JP Z80 instruction
 */
export interface JpInstruction extends Z80Instruction {
  type: "JpInstruction";
  condition?: string;
  target: ExpressionNode;
}

/**
 * Represents a CALL Z80 instruction
 */
export interface CallInstruction extends Z80Instruction {
  type: "CallInstruction";
  condition?: string;
  target: ExpressionNode;
}

/**
 * Represents a RET Z80 instruction
 */
export interface RetInstruction extends Z80Instruction {
  type: "RetInstruction";
  condition?: string;
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
  operandType: OperandType;
  register?: string;
  expr?: ExpressionNode;
  offsetSign?: string;
  regOperation?: string;
  macroParam?: string;
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
  RegOperation,
  NoneArg,
}

// ============================================================================
// Directive syntax node types

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

// ============================================================================
// Pragma syntax node types

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

// ============================================================================
// Statement syntax nodes

/**
 * Represents a macro definition
 */
export interface MacroStatement extends PartialZ80AssemblyLine {
  type: "MacroStatement";

  parameters: string[];
}

/**
 * Represents a macro end statement
 */
export interface MacroEndStatement extends PartialZ80AssemblyLine {
  type: "MacroEndStatement";
}

/**
 * Represents a .loop statement
 */
export interface LoopStatement extends PartialZ80AssemblyLine {
  type: "LoopStatement";
  expr: ExpressionNode;
}

/**
 * Represents a loop end statement
 */
export interface LoopEndStatement extends PartialZ80AssemblyLine {
  type: "LoopEndStatement";
}

/**
 * Represents a .while statement
 */
export interface WhileStatement extends PartialZ80AssemblyLine {
  type: "WhileStatement";
  expr: ExpressionNode;
}

/**
 * Represents a while end statement
 */
export interface WhileEndStatement extends PartialZ80AssemblyLine {
  type: "WhileEndStatement";
}

/**
 * Represents a .repeat statement
 */
export interface RepeatStatement extends PartialZ80AssemblyLine {
  type: "RepeatStatement";
}

/**
 * Represents an until statement
 */
export interface UntilStatement extends PartialZ80AssemblyLine {
  type: "UntilStatement";
  expr: ExpressionNode;
}

/**
 * Represents a .proc statement
 */
export interface ProcStatement extends PartialZ80AssemblyLine {
  type: "ProcStatement";
}

/**
 * Represents a proc end statement
 */
export interface ProcEndStatement extends PartialZ80AssemblyLine {
  type: "ProcEndStatement";
}

/**
 * Represents an if statement
 */
export interface IfStatement extends PartialZ80AssemblyLine {
  type: "IfStatement";
  expr: ExpressionNode;
}

/**
 * Represents an ifused statement
 */
export interface IfUsedStatement extends PartialZ80AssemblyLine {
  type: "IfUsedStatement";
  symbol: Symbol;
}

/**
 * Represents an ifnused statement
 */
export interface IfNUsedStatement extends PartialZ80AssemblyLine {
  type: "IfNUsedStatement";
  symbol: Symbol;
}

/**
 * Represents an else statement
 */
export interface ElseStatement extends PartialZ80AssemblyLine {
  type: "ElseStatement";
}

/**
 * Represents an endif statement
 */
export interface EndIfStatement extends PartialZ80AssemblyLine {
  type: "EndIfStatement";
}

/**
 * Represents an elseif statement
 */
export interface ElseIfStatement extends PartialZ80AssemblyLine {
  type: "ElseIfStatement";
  expr: ExpressionNode;
}

/**
 * Represents a break statement
 */
export interface BreakStatement extends PartialZ80AssemblyLine {
  type: "BreakStatement";
}

/**
 * Represents a continue statement
 */
export interface ContinueStatement extends PartialZ80AssemblyLine {
  type: "ContinueStatement";
}

/**
 * Represents a module statement
 */
export interface ModuleStatement extends PartialZ80AssemblyLine {
  type: "ModuleStatement";
  identifier?: string;
}

/**
 * Represents a module end statement
 */
export interface ModuleEndStatement extends PartialZ80AssemblyLine {
  type: "ModuleEndStatement";
}

/**
 * Represents a struct statement
 */
export interface StructStatement extends PartialZ80AssemblyLine {
  type: "StructStatement";
}

/**
 * Represents a struct statement
 */
export interface StructEndStatement extends PartialZ80AssemblyLine {
  type: "StructEndStatement";
}

/**
 * Represents a local statement
 */
export interface LocalStatement extends PartialZ80AssemblyLine {
  type: "LocalStatement";
  identifiers: string[];
}

/**
 * Represents a struct statement
 */
export interface NextStatement extends PartialZ80AssemblyLine {
  type: "NextStatement";
}

/**
 * Represents a for statement
 */
export interface ForStatement extends PartialZ80AssemblyLine {
  type: "ForStatement";
  identifier: string;
  startExpr: ExpressionNode;
  toExpr: ExpressionNode;
  stepExpr?: ExpressionNode;
}

/**
 * Represents a field assignment
 */
export interface FieldAssignment extends PartialZ80AssemblyLine {
  type: "FieldAssignment";
  assignment: ByteEmittingPragma;
}

/**
 * Represents a macro or struct invokation
 */
export interface MacroOrStructInvocation extends PartialZ80AssemblyLine {
  type: "MacroOrStructInvocation";
  identifier: string;
  operands: Operand[];
}
