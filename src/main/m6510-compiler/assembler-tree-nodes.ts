import {
  AssemblyLine,
  PartialAssemblyLine,
  Node,
  Operand
} from "../compiler-common/tree-nodes";
import { M6510TokenType } from "./m6510-token-stream";

export type M6510Node = Node<M6510Instruction, M6510TokenType>;

export type M6510Instruction =
  | SimpleM6510Instruction
  | CompoundM6510Instruction;

// ============================================================================
// Instruction syntax node types

/**
 * This type represents all M6510 assembly lines
 */
export type M6510AssemblyLine = AssemblyLine<M6510Node>;

/**
 * This class is the root case of all syntax nodes that describe an operation
 */
interface M6510InstructionBase extends PartialAssemblyLine<M6510Instruction> {}

/**
 * Represents a trivial (argumentless) M6510 instruction
 */
export interface SimpleM6510Instruction extends M6510InstructionBase {
  type: "SimpleM6510Instruction";
  mnemonic: string;
}

/**
 * Represents a compound (multi-operand) M6510 instruction
 */
export interface CompoundM6510Instruction extends M6510InstructionBase {
  type: "CompoundM6510Instruction";
  mnemonic: string;
  operand: Operand<M6510Node, M6510TokenType>;
}
