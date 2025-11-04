import {
  AssemblyLine,
  Expression,
  Operand,
  PartialAssemblyLine,
  Node
} from "../../main/compiler-common/tree-nodes";
import { Z80TokenType } from "./z80-token-stream";

export type Z80Node = Node<Z80Instruction, Z80TokenType>;

export type Z80Instruction =
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

// ============================================================================
// Instrcution syntax node types

/**
 * This type represents all Z80 assembly lines
 */
export type Z80AssemblyLine = AssemblyLine<Z80Node>;

/**
 * This class is the root case of all syntax nodes that describe an operation
 */
interface Z80InstructionBase extends PartialAssemblyLine<Z80Instruction> {}

/**
 * Represents a trivial (argumentless) Z80 instruction
 */
export interface SimpleZ80Instruction extends Z80InstructionBase {
  type: "SimpleZ80Instruction";
  mnemonic: string;
}

/**
 * Represents a TEST Z80 instruction
 */
export interface TestInstruction extends Z80InstructionBase {
  type: "TestInstruction";
  expr: Expression<Z80Instruction, Z80TokenType>;
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
export interface MirrorInstruction extends Z80InstructionBase {
  type: "MirrorInstruction";
}

/**
 * Represents a MUL Z80 instruction
 */
export interface MulInstruction extends Z80InstructionBase {
  type: "MulInstruction";
}

/**
 * Represents a DJNZ Z80 instruction
 */
export interface DjnzInstruction extends Z80InstructionBase {
  type: "DjnzInstruction";
  target: Operand<Z80Instruction, Z80TokenType>;
}

/**
 * Represents an RST Z80 instruction
 */
export interface RstInstruction extends Z80InstructionBase {
  type: "RstInstruction";
  target: Operand<Z80Instruction, Z80TokenType>;
}

/**
 * Represents an IM Z80 instruction
 */
export interface ImInstruction extends Z80InstructionBase {
  type: "ImInstruction";
  mode: Operand<Z80Instruction, Z80TokenType>;
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
export interface RetInstruction extends Z80InstructionBase {
  type: "RetInstruction";
  condition?: Operand<Z80Instruction, Z80TokenType>;
}

/**
 * Represents a Z80 instruction with a single mandatory operand
 */
export interface Z80InstructionWithOneOperand extends Z80InstructionBase {
  operand: Operand<Z80Instruction, Z80TokenType>;
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
export interface Z80InstructionWithTwoOperands extends Z80InstructionBase {
  operand1: Operand<Z80Instruction, Z80TokenType>;
  operand2: Operand<Z80Instruction, Z80TokenType>;
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
export interface Z80InstructionWithOneOrTwoOperands extends Z80InstructionBase {
  operand1: Operand<Z80Instruction, Z80TokenType>;
  operand2?: Operand<Z80Instruction, Z80TokenType>;
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
export interface Z80InstructionWithTwoOrThreeOperands extends Z80InstructionBase {
  operand1: Operand<Z80Instruction, Z80TokenType>;
  operand2: Operand<Z80Instruction, Z80TokenType>;
  operand3?: Operand<Z80Instruction, Z80TokenType>;
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
