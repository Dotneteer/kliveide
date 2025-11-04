import type { ErrorCodes } from "../compiler-common/assembler-errors";
import type {
  AdcInstruction,
  AddInstruction,
  AndInstruction,
  BitInstruction,
  CallInstruction,
  CpInstruction,
  DecInstruction,
  ExInstruction,
  ImInstruction,
  IncInstruction,
  InInstruction,
  JpInstruction,
  JrInstruction,
  LdInstruction,
  NextRegInstruction,
  OrInstruction,
  OutInstruction,
  PopInstruction,
  PushInstruction,
  ResInstruction,
  RetInstruction,
  RstInstruction,
  SbcInstruction,
  SetInstruction,
  ShiftRotateInstruction,
  SimpleZ80Instruction,
  SubInstruction,
  TestInstruction,
  XorInstruction,
  Z80AssemblyLine,
  Z80Node
} from "./assembler-tree-nodes";

import { InputStream } from "../compiler-common/input-stream";
import { Z80TokenStream, Z80TokenType } from "./z80-token-stream";
import { Z80AsmParser } from "./z80-asm-parser";
import { FixupType } from "../compiler-common/abstractions";
import {
  Expression,
  NodePosition,
  Operand,
  OperandType,
  Token
} from "../../main/compiler-common/tree-nodes";
import { SpectrumModelType, SpectrumModelTypes } from "./SpectrumModelTypes";
import { CommonAssembler } from "../../main/compiler-common/common-assembler";
import { CommonTokenStream } from "../../main/compiler-common/common-token-stream";
import { CommonAsmParser } from "../../main/compiler-common/common-asm-parser";

/**
 * The valid Spectrum model values
 */
const VALID_MODELS = ["SPECTRUM48", "SPECTRUM128", "SPECTRUMP3", "NEXT"];

/**
 * This class provides the functionality of the Z80 Assembler
 */
export class Z80Assembler extends CommonAssembler<Z80Node, Z80TokenType> {
  /**
   * Creates a token stream from the input stream.
   * @param is Input stream to create the token stream from
   */
  protected createTokenStream(is: InputStream): CommonTokenStream<Z80TokenType> {
    return new Z80TokenStream(is);
  }

  /**
   * Creates an assembly parser from the token stream.
   * @param ts Token stream to create the parser from
   * @param fileIndex Index of the source file being parsed
   */
  protected createAsmParser(
    ts: CommonTokenStream<Z80TokenType>,
    fileIndex: number,
    macroEmitPhase?: boolean
  ): CommonAsmParser<Z80Node, Z80TokenType> {
    return new Z80AsmParser(ts, fileIndex, macroEmitPhase);
  }

  /**
   * Checks if the specified model type is valid.
   * @param modelType The model type to validate
   */
  protected validateModelType(modelType: string): boolean {
    return VALID_MODELS.includes(modelType.toUpperCase());
  }

  /**
   * Gets the model name by its ID.
   * @param modelId The model ID to get the name for
   */
  protected getModelNameById(modelId: number): string {
    return SpectrumModelTypes[modelId];
  }

  /**
   * Checks if the specified model ID supports the .bank pragma.
   * @param modelId The model ID to check
   */
  protected modelSupportsBankPragma(modelId: number): ErrorCodes | null {
    if (modelId && modelId !== SpectrumModelType.Spectrum48) {
      return null; // NEXT supports .bank pragma
    }
    return "Z0308"; // Other models do not support .bank pragma
  }

  // ==========================================================================
  // Z80 instruction processing methods

  /**
   * Emits code for the specified operation
   * @param opLine Operation to emit the code for
   */
  protected emitAssemblyOperationCode(opLine: Z80AssemblyLine): void {
    if (opLine.type === "SimpleZ80Instruction") {
      const mnemonic = (opLine as unknown as SimpleZ80Instruction).mnemonic.toLowerCase();

      // --- Get the op codes for the instruction
      if (
        nextInstructionCodes[mnemonic] !== undefined &&
        this._output.modelType !== SpectrumModelType.Next
      ) {
        this.reportAssemblyError("Z0414", opLine);
        return;
      }
      const opCodes = simpleInstructionCodes[mnemonic];
      if (opCodes === undefined) {
        this.reportEvaluationError(this, "Z0401", opLine, null, mnemonic);
      }

      // --- Emit the opcode(s);
      this.emitOpCode(opCodes);
      return;
    }
    const instr = opLine as Z80Node;
    switch (instr.type) {
      case "NextRegInstruction":
        this.processNextRegInst(instr);
        break;
      case "PushInstruction":
      case "PopInstruction":
        this.processStackInst(instr);
        break;
      case "CallInstruction":
        this.processCallInst(instr);
        break;
      case "JpInstruction":
        this.processJpInst(instr);
        break;
      case "JrInstruction":
        this.processJrInst(instr);
        break;
      case "RetInstruction":
        this.processRetInst(instr);
        break;
      case "RstInstruction":
        this.processRstInst(instr);
        break;
      case "DjnzInstruction":
        this.emitJumpRelativeOp(instr, instr.target, 0x10);
        break;
      case "ImInstruction":
        this.processImInst(instr);
        break;
      case "IncInstruction":
      case "DecInstruction":
        this.processIncDecInst(instr);
        break;
      case "LdInstruction":
        this.processLdInst(instr);
        break;
      case "ExInstruction":
        this.processExInst(instr);
        break;
      case "AddInstruction":
      case "AdcInstruction":
      case "SbcInstruction":
        this.processAlu1Inst(instr);
        break;
      case "SubInstruction":
      case "AndInstruction":
      case "XorInstruction":
      case "OrInstruction":
      case "CpInstruction":
        this.processAlu2Inst(instr);
        break;
      case "InInstruction":
        this.processInInst(instr);
        break;
      case "OutInstruction":
        this.processOutInst(instr);
        break;
      case "RlcInstruction":
      case "RrcInstruction":
      case "RlInstruction":
      case "RrInstruction":
      case "SlaInstruction":
      case "SraInstruction":
      case "SllInstruction":
      case "SrlInstruction":
        this.processShiftRotateInst(instr);
        break;
      case "BitInstruction":
        this.processBitInst(instr, 0x40);
        break;
      case "ResInstruction":
        this.processBitInst(instr, 0x80);
        break;
      case "SetInstruction":
        this.processBitInst(instr, 0xc0);
        break;
      case "TestInstruction":
        this.processTestInst(instr);
        break;
    }
  }

  /**
   * Processes a MUL instruction
   * @param op Instruction
   */
  private processNextRegInst(op: NextRegInstruction): void {
    if (this.invalidNextInst(op)) {
      return;
    }
    if (op.operand1.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op.operand1.expr);
      return;
    }
    if (op.operand2.operandType === OperandType.Expression) {
      this.emitOpCode(0xed91);
      this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit8);
      this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
    } else if (op.operand2.operandType === OperandType.Reg8 && op.operand2.register === "a") {
      this.emitOpCode(0xed92);
      this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit8);
    } else {
      this.reportAssemblyError("Z0604", op);
    }
  }

  /**
   * Processes a PUSH or POP operation
   * @param op Instruction
   */
  private processStackInst(op: PushInstruction | PopInstruction): void {
    switch (op.operand.operandType) {
      case OperandType.Expression:
        // --- PUSH NNNN operation
        if (op.type === "PopInstruction") {
          this.reportAssemblyError("Z0412", op);
          return;
        }
        if (this.invalidNextInst(op)) {
          return;
        }
        this.emitOpCode(0xed8a);
        this.emitNumericExpr(op, op.operand.expr, FixupType.Bit16Be);
        return;
      case OperandType.Reg16:
      case OperandType.Reg16Spec:
      case OperandType.Reg16Idx:
        let opcode = popOpBytes[op.operand.register];
        if (opcode) {
          if (op.type === "PushInstruction") {
            opcode |= 0x04;
          }
          this.emitOpCode(opcode);
          return;
        }
    }
    this.reportAssemblyError("Z0413", op);
  }

  /**
   * Processes a CALL operation
   * @param op Instruction
   */
  private processCallInst(op: CallInstruction): void {
    if (!op.operand2) {
      if (op.operand1.operandType !== OperandType.Expression) {
        this.reportAssemblyError("Z0604", op);
        return;
      }
      this.emitOpCode(0xcd);
      this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit16);
      return;
    }
    let condition: string;
    if (op.operand1.operandType === OperandType.Condition) {
      condition = op.operand1.register;
    } else if (op.operand1.operandType === OperandType.Reg8 && op.operand1.register === "c") {
      condition = "c";
    } else {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const order = conditionOrder[condition] ?? 0;
    this.emitOpCode(0xc4 + order * 8);
    if (op.operand2.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
  }

  /**
   * Processes a JP operation
   * @param op Instruction
   */
  private processJpInst(op: JpInstruction): void {
    if (!op.operand2) {
      switch (op.operand1.operandType) {
        case OperandType.CPort:
          if (this.invalidNextInst(op)) {
            return;
          }
          this.emitOpCode(0xed98);
          return;
        case OperandType.Reg16:
        case OperandType.RegIndirect:
          if (op.operand1.register !== "hl") {
            break;
          }
          this.emitOpCode(0xe9);
          return;
        case OperandType.IndexedIndirect:
          if (op.operand1.offsetSign) {
            break;
          }
        // --- Flow to the next label is intentional
        case OperandType.Reg16Idx:
          if (op.operand1.register === "ix") {
            this.emitOpCode(0xdde9);
            return;
          }
          if (op.operand1.register === "iy") {
            this.emitOpCode(0xfde9);
            return;
          }
          break;
        case OperandType.Expression:
          this.emitOpCode(0xc3);
          this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit16);
          return;
      }
      this.reportAssemblyError("Z0604", op);
      return;
    }

    let condition: string;
    if (op.operand1.operandType === OperandType.Condition) {
      condition = op.operand1.register;
    } else if (op.operand1.operandType === OperandType.Reg8 && op.operand1.register === "c") {
      condition = "c";
    } else {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const order = conditionOrder[condition] ?? 0;
    if (op.operand2.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0111", op);
      return;
    }
    this.emitOpCode(0xc2 + order * 8);
    this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
  }

  /**
   * Processes a JR operation
   * @param op Instruction
   */
  private processJrInst(op: JrInstruction): void {
    if (!op.operand2) {
      if (op.operand1.operandType !== OperandType.Expression) {
        this.reportAssemblyError("Z0604", op);
        return;
      }
      this.emitJumpRelativeOp(op, op.operand1, 0x18);
      return;
    }
    let condition: string;
    if (op.operand1.operandType === OperandType.Condition) {
      condition = op.operand1.register;
    } else if (op.operand1.operandType === OperandType.Reg8 && op.operand1.register === "c") {
      condition = "c";
    } else {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const order = conditionOrder[condition] ?? 0;
    if (order >= 4) {
      this.reportAssemblyError("Z0402", op);
      return;
    }
    if (op.operand2.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    this.emitJumpRelativeOp(op, op.operand2, 0x20 + order * 8);
  }

  /**
   * Processes a RET operation
   * @param op Instruction
   */
  private processRetInst(op: RetInstruction): void {
    let condition: string;
    if (op.condition) {
      if (op.condition.operandType === OperandType.Condition) {
        condition = op.condition.register;
      } else if (op.condition.operandType === OperandType.Reg8 && op.condition.register === "c") {
        condition = "c";
      } else {
        this.reportAssemblyError("Z0604", op);
        return;
      }
      const order = conditionOrder[condition] ?? 0;
      this.emitByte(0xc0 + order * 8);
      return;
    }
    this.emitOpCode(0xc9);
  }

  /**
   * Processes an RST operation
   * @param op Instruction
   */
  private processRstInst(op: RstInstruction): void {
    if (op.target.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const value = this.evaluateExprImmediate(op.target.expr).value;
    if (value > 0x38 || value % 8 !== 0) {
      this.reportAssemblyError("Z0404", op, null, value);
      return;
    }
    this.emitOpCode(0xc7 + value);
  }

  /**
   * Processes an IM operation
   * @param op Instruction
   */
  private processImInst(op: ImInstruction): void {
    if (op.mode.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const value = this.evaluateExprImmediate(op.mode.expr).value;
    if (value < 0 || value > 2) {
      this.reportAssemblyError("Z0405", op, null, value);
      return;
    }
    this.emitOpCode([0xed46, 0xed56, 0xed5e][value]);
  }

  /**
   * Processes an EX operation
   * @param op Instruction
   */
  private processExInst(op: ExInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.Reg16Spec:
        if (op.operand1.register === "af") {
          if (op.operand2.register === "af'") {
            this.emitOpCode(0x08);
            return;
          }
        }
        break;
      case OperandType.Reg16:
        if (op.operand1.register === "de") {
          if (op.operand2.register === "hl") {
            this.emitOpCode(0xeb);
            return;
          }
        }
        break;
      case OperandType.RegIndirect:
        if (op.operand1.register !== "sp") {
          break;
        }
        if (op.operand2.register === "hl") {
          this.emitOpCode(0xe3);
          return;
        } else if (op.operand2.operandType === OperandType.Reg16Idx) {
          this.emitOpCode(op.operand2.register === "ix" ? 0xdde3 : 0xfde3);
          return;
        }
        break;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes an IN operation
   * @param op Instruction
   */
  private processInInst(op: InInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.CPort:
        if (op.operand2) {
          break;
        }
        this.emitOpCode(0xed70);
        return;
      case OperandType.Reg8:
        if (!op.operand2) {
          break;
        }
        if (op.operand1.register === "a") {
          if (op.operand2.operandType === OperandType.MemIndirect) {
            this.emitOpCode(0xdb);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
          }
          if (op.operand2.operandType === OperandType.CPort) {
            this.emitOpCode(0xed78);
            return;
          }
        }
        if (op.operand2?.operandType !== OperandType.CPort) {
          break;
        }
        this.emitOpCode(0xed40 + 8 * reg8Order[op.operand1.register]);
        return;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes an OUT operation
   * @param op Instruction
   */
  private processOutInst(op: OutInstruction): void {
    switch (op.operand1.operandType) {
      case OperandType.MemIndirect:
        if (!op.operand2) {
          break;
        }
        if (op.operand2.register === "a") {
          this.emitOpCode(0xd3);
          this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit8);
          return;
        }
        break;
      case OperandType.CPort:
        if (!op.operand2) {
          break;
        }
        if (op.operand2.operandType === OperandType.Reg8) {
          this.emitOpCode(0xed41 + 8 * reg8Order[op.operand2.register]);
          return;
        }
        if (op.operand2.operandType !== OperandType.Expression) {
          break;
        }
        const value = this.evaluateExprImmediate(op.operand2.expr).value;
        if (value !== 0) {
          this.reportAssemblyError("Z0406", op);
        } else {
          this.emitOpCode(0xed71);
        }
        return;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes a BIT/RES/SET operation
   * @param op Instruction
   * @param opByte Operation base value
   */
  private processBitInst(
    op: BitInstruction | ResInstruction | SetInstruction,
    opByte: number
  ): void {
    if (op.operand1.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", op);
      return;
    }
    const bitIndex = this.evaluateExprImmediate(op.operand1.expr).value;
    if (bitIndex < 0 || bitIndex > 7) {
      this.reportAssemblyError("Z0407", op, null, bitIndex);
      return;
    }
    switch (op.operand2.operandType) {
      case OperandType.IndexedIndirect:
        if (op.type !== "BitInstruction") {
          if (!op.operand3) {
            opByte |= 0x06;
          } else if (op.operand3.operandType === OperandType.Reg8) {
            opByte |= reg8Order[op.operand3.register];
          } else {
            this.reportAssemblyError("Z0604", op);
            return;
          }
        } else {
          opByte |= 0x06;
        }
        this.emitIndexedBitOperation(
          op as unknown as Z80AssemblyLine,
          op.operand2.register,
          op.operand2.offsetSign,
          op.operand2.expr,
          opByte + 8 * bitIndex
        );
        return;
      // Flows to the next label intentionally
      case OperandType.Reg8:
        opByte |= reg8Order[op.operand2.register];
        this.emitByte(0xcb);
        this.emitByte(opByte + 8 * bitIndex);
        return;
      case OperandType.RegIndirect:
        if (op.operand2.register !== "hl") {
          break;
        }
        this.emitByte(0xcb);
        this.emitByte((opByte | 0x06) + 8 * bitIndex);
        return;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes an RLC/RRC/RL/RR/SLA/SRA/SLL/SRL operation
   * @param op Instruction
   */
  private processShiftRotateInst(op: ShiftRotateInstruction): void {
    let opCode = 8 * shiftOpOrder[op.type];
    let error = false;
    switch (op.operand1.operandType) {
      case OperandType.Reg8:
        opCode |= reg8Order[op.operand1.register];
        if (op.operand2) {
          error = true;
        }
        break;
      case OperandType.RegIndirect:
        if (op.operand1.register === "hl") {
          opCode |= 0x06;
          if (op.operand2) {
            error = true;
          }
        } else {
          error = true;
        }
        break;
      case OperandType.IndexedIndirect:
        if (!op.operand2) {
          opCode |= 0x06;
        } else if (op.operand2.operandType !== OperandType.Reg8) {
          error = true;
          break;
        } else {
          opCode |= reg8Order[op.operand2.register];
        }
        this.emitIndexedBitOperation(
          op as unknown as Z80AssemblyLine,
          op.operand1.register,
          op.operand1.offsetSign,
          op.operand1.expr,
          opCode
        );
        return;
      default:
        error = true;
        break;
    }
    if (error) {
      this.reportAssemblyError("Z0604", op);
    } else {
      this.emitByte(0xcb);
      this.emitByte(opCode);
    }
  }

  /**
   * Processes an INC/DEC operation
   * @param op Instruction
   */
  private processIncDecInst(op: IncInstruction | DecInstruction): void {
    switch (op.operand.operandType) {
      case OperandType.Reg8:
        this.emitOpCode(
          (op.type === "IncInstruction" ? 0x04 : 0x05) + 8 * reg8Order[op.operand.register]
        );
        return;
      case OperandType.Reg8Idx:
      case OperandType.Reg16:
      case OperandType.Reg16Idx:
        this.emitOpCode(
          op.type === "IncInstruction"
            ? incOpCodes[op.operand.register]
            : decOpCodes[op.operand.register]
        );
        return;
      case OperandType.RegIndirect:
        if (op.operand.register !== "hl") {
          break;
        }
        this.emitOpCode(op.type === "IncInstruction" ? 0x34 : 0x35);
        return;
      case OperandType.IndexedIndirect:
        this.emitIndexedOperation(
          op as unknown as Z80AssemblyLine,
          op.operand,
          op.type === "IncInstruction" ? 0x34 : 0x35
        );
        return;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes a ADD/ADC/SBC operation
   * @param op Instruction
   */
  private processAlu1Inst(op: AddInstruction | AdcInstruction | SbcInstruction): void {
    if (!op.operand2) {
      op.operand2 = op.operand1;
      op.operand1 = {
        type: "Operand",
        operandType: OperandType.Reg8,
        register: "a"
      };
    }
    const aluIdx = aluOpOrder[op.type];
    switch (op.operand1.operandType) {
      case OperandType.Reg8:
        if (op.operand1.register !== "a") {
          this.reportAssemblyError("Z0409", op);
          return;
        }
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitOpCode(0x80 + aluIdx * 8 + reg8Order[op.operand2.register]);
            return;
          case OperandType.RegIndirect:
            if (op.operand2.register !== "hl") {
              break;
            }
            this.emitOpCode(0x86 + aluIdx * 8);
            return;
          case OperandType.Reg8Idx:
            this.emitByte(op.operand2.register.indexOf("x") >= 0 ? 0xdd : 0xfd);
            this.emitByte(aluIdx * 8 + (op.operand2.register.endsWith("h") ? 0x84 : 0x85));
            return;
          case OperandType.IndexedIndirect:
            this.emitIndexedOperation(
              op as unknown as Z80AssemblyLine,
              op.operand2,
              0x86 + aluIdx * 8
            );
            return;
          case OperandType.Expression:
            this.emitOpCode(0xc6 + aluIdx * 8);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
        }
        break;

      case OperandType.Reg16:
        switch (op.operand2.operandType) {
          case OperandType.Reg16:
            if (op.operand1.register !== "hl") {
              break;
            }
            let opCodeBase = 0xed42;
            if (op.type === "AddInstruction") {
              opCodeBase = 0x09;
            } else if (op.type === "AdcInstruction") {
              opCodeBase = 0xed4a;
            }
            this.emitOpCode(opCodeBase + reg16Order[op.operand2.register] * 16);
            return;
          case OperandType.Reg8:
            if (
              this.invalidNextInst(op) ||
              op.operand1.register === "sp" ||
              op.operand2.register !== "a"
            ) {
              break;
            }
            {
              let opCodeBase = 0xed33;
              if (op.operand1.register === "hl") {
                opCodeBase = 0xed31;
              } else if (op.operand1.register === "de") {
                opCodeBase = 0xed32;
              }
              this.emitOpCode(opCodeBase);
              return;
            }
          case OperandType.Expression:
            if (this.invalidNextInst(op) || op.operand1.register === "sp") {
              break;
            }
            {
              let opCodeBase = 0xed36;
              if (op.operand1.register === "hl") {
                opCodeBase = 0xed34;
              } else if (op.operand1.register === "de") {
                opCodeBase = 0xed35;
              }
              this.emitOpCode(opCodeBase);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;
            }
        }
        break;

      case OperandType.Reg16Idx:
        if (op.type !== "AddInstruction") {
          break;
        }
        const opCode = op.operand1.register === "ix" ? 0xdd09 : 0xfd09;
        switch (op.operand2.operandType) {
          case OperandType.Reg16:
            if (op.operand2.register === "hl") {
              break;
            }
            this.emitOpCode(opCode + reg16Order[op.operand2.register] * 16);
            return;
          case OperandType.Reg16Idx:
            if (op.operand1.register !== op.operand2.register) {
              break;
            }
            this.emitOpCode(opCode + 0x20);
            return;
        }
        break;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes a SUB/AND/XOR/OR/CP operation
   * @param op Instruction
   */
  private processAlu2Inst(
    op: SubInstruction | AndInstruction | XorInstruction | OrInstruction | CpInstruction
  ): void {
    let operand = op.operand1;
    let opType = op.operand1.operandType;
    let opReg = op.operand1.register;

    // --- Check for alternative syntax (A register as the first operand)
    if (op.operand2) {
      if (opType !== OperandType.Reg8 || opReg !== "a") {
        this.reportAssemblyError("Z0408", op);
        return;
      }
      operand = op.operand2;
      opType = op.operand2.operandType;
      opReg = op.operand2.register;
    }

    const aluIdx = aluOpOrder[op.type];
    switch (opType) {
      case OperandType.Reg8:
        this.emitOpCode(0x80 + aluIdx * 8 + reg8Order[opReg]);
        return;
      case OperandType.RegIndirect:
        if (opReg !== "hl") {
          break;
        }
        this.emitOpCode(0x86 + aluIdx * 8);
        return;
      case OperandType.Reg8Idx:
        this.emitByte(opReg.indexOf("x") >= 0 ? 0xdd : 0xfd);
        this.emitByte(aluIdx * 8 + (opReg.endsWith("h") ? 0x84 : 0x85));
        return;
      case OperandType.Expression:
        this.emitByte(0xc6 + aluIdx * 8);
        this.emitNumericExpr(op, operand.expr, FixupType.Bit8);
        return;
      case OperandType.IndexedIndirect:
        this.emitIndexedOperation(op as unknown as Z80AssemblyLine, operand, 0x86 + aluIdx * 8);
        return;
    }
    this.reportAssemblyError("Z0604", op);
  }

  /**
   * Processes an LD operation
   * @param op Instruction
   */
  private processLdInst(op: LdInstruction): void {
    let issueWithOp1 = true;
    switch (op.operand1.operandType) {
      case OperandType.Reg8: {
        const destReg = op.operand1.register;
        const destRegIdx = reg8Order[destReg];
        const sourceReg = op.operand2.register;
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitOpCode(0x40 + destRegIdx * 8 + reg8Order[sourceReg]);
            return;

          case OperandType.RegIndirect:
            if (sourceReg === "bc" && destReg === "a") {
              this.emitOpCode(0x0a);
              return;
            } else if (sourceReg === "de" && destReg === "a") {
              this.emitOpCode(0x1a);
              return;
            } else if (sourceReg === "hl") {
              this.emitOpCode(0x46 + destRegIdx * 8);
              return;
            }
            break;

          case OperandType.Reg8Spec:
            if (destReg !== "a") {
              break;
            }
            this.emitOpCode(sourceReg === "r" ? 0xed5f : 0xed57);
            return;

          case OperandType.Reg8Idx:
            if (destRegIdx >= 4 && destRegIdx <= 6) {
              break;
            }
            this.emitOpCode(
              (sourceReg.indexOf("x") >= 0 ? 0xdd44 : 0xfd44) +
                destRegIdx * 8 +
                (sourceReg.endsWith("h") ? 0 : 1)
            );
            return;

          case OperandType.Expression:
            this.emitOpCode(0x06 + destRegIdx * 8);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;

          case OperandType.MemIndirect:
            if (destReg !== "a") {
              break;
            }
            this.emitOpCode(0x3a);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
            return;

          case OperandType.IndexedIndirect:
            this.emitIndexedOperation(
              op as unknown as Z80AssemblyLine,
              op.operand2,
              0x46 + destRegIdx * 8
            );
            return;
        }
        break;
      }

      case OperandType.Reg8Idx:
        {
          const destReg = op.operand1.register;
          const sourceReg = op.operand2.register;
          switch (op.operand2.operandType) {
            case OperandType.Reg8:
              const sourceRegIdx = reg8Order[op.operand2.register];
              if (sourceRegIdx >= 4 && sourceRegIdx <= 6) {
                break;
              }
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd60 : 0xfd60) +
                  (destReg.endsWith("h") ? 0 : 8) +
                  sourceRegIdx
              );
              return;

            case OperandType.Reg8Idx:
              if (
                (sourceReg.indexOf("x") >= 0 && destReg.indexOf("y") >= 0) ||
                (sourceReg.indexOf("y") >= 0 && destReg.indexOf("x") >= 0)
              ) {
                break;
              }
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd64 : 0xfd64) +
                  (destReg.endsWith("h") ? 0 : 8) +
                  (sourceReg.endsWith("h") ? 0 : 1)
              );
              return;

            case OperandType.Expression:
              this.emitOpCode(
                (destReg.indexOf("x") >= 0 ? 0xdd26 : 0xfd26) + (destReg.endsWith("h") ? 0 : 8)
              );
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
              return;
          }
        }
        break;

      case OperandType.Reg8Spec:
        if (op.operand2.register !== "a") {
          break;
        }
        this.emitOpCode(op.operand1.register === "r" ? 0xed4f : 0xed47);
        return;

      case OperandType.RegIndirect:
        {
          const destReg = op.operand1.register;
          switch (op.operand2.operandType) {
            case OperandType.Reg8:
              const sourceReg = op.operand2.register;
              if (destReg === "bc" && sourceReg === "a") {
                this.emitOpCode(0x02);
                return;
              } else if (destReg === "de" && sourceReg === "a") {
                this.emitOpCode(0x12);
                return;
              } else if (destReg === "hl") {
                this.emitOpCode(0x70 + reg8Order[sourceReg]);
                return;
              }
              break;

            case OperandType.Expression:
              if (destReg !== "hl") {
                break;
              }
              this.emitByte(0x36);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
              return;
          }
        }
        break;

      case OperandType.MemIndirect: {
        let opCode = 0x00;
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            if (op.operand2.register !== "a") {
              break;
            }
            opCode = 0x32;
            break;

          case OperandType.Reg16:
            const sourceReg = op.operand2.register;
            opCode = 0x22;
            if (sourceReg === "bc") {
              opCode = 0xed43;
            } else if (sourceReg === "de") {
              opCode = 0xed53;
            } else if (sourceReg === "sp") {
              opCode = 0xed73;
            }
            break;

          case OperandType.Reg16Idx:
            opCode = op.operand2.register === "ix" ? 0xdd22 : 0xfd22;
            break;
        }
        if (!opCode) {
          break;
        }
        this.emitOpCode(opCode);
        this.emitNumericExpr(op, op.operand1.expr, FixupType.Bit16);
        return;
      }

      case OperandType.Reg16:
        {
          const destReg = op.operand1.register;
          const sourceReg = op.operand2.register;
          switch (op.operand2.operandType) {
            case OperandType.MemIndirect:
              let opCode = 0x2a;
              if (destReg === "bc") {
                opCode = 0xed4b;
              } else if (destReg === "de") {
                opCode = 0xed5b;
              } else if (destReg === "sp") {
                opCode = 0xed7b;
              }
              this.emitOpCode(opCode);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            case OperandType.Expression:
              this.emitOpCode(0x01 + reg16Order[op.operand1.register] * 16);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            default: {
              if (destReg !== "sp") {
                break;
              }
              let opCode = 0xf9;
              if (sourceReg === "ix") {
                opCode = 0xddf9;
              } else if (sourceReg === "iy") {
                opCode = 0xfdf9;
              } else if (sourceReg !== "hl") {
                break;
              }
              this.emitOpCode(opCode);
              return;
            }
          }
        }
        break;

      case OperandType.Reg16Idx:
        {
          const destReg = op.operand1.register;
          switch (op.operand2.operandType) {
            case OperandType.MemIndirect:
              this.emitOpCode(destReg === "ix" ? 0xdd2a : 0xfd2a);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;

            case OperandType.Expression:
              this.emitOpCode(destReg === "ix" ? 0xdd21 : 0xfd21);
              this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit16);
              return;
          }
        }
        break;

      case OperandType.IndexedIndirect: {
        switch (op.operand2.operandType) {
          case OperandType.Reg8:
            this.emitIndexedOperation(
              op as unknown as Z80AssemblyLine,
              op.operand1,
              0x70 + reg8Order[op.operand2.register]
            );
            return;
          case OperandType.Expression:
            this.emitIndexedOperation(op as unknown as Z80AssemblyLine, op.operand1, 0x36);
            this.emitNumericExpr(op, op.operand2.expr, FixupType.Bit8);
            return;
        }
        break;
      }
    }
    this.reportAssemblyError(
      "Z0604",
      op,
      toPosition(issueWithOp1 ? op.operand1.startToken : op.operand2.startToken)
    );
  }

  /**
   * Processes a TEST operation
   * @param op Instruction
   */
  private processTestInst(op: TestInstruction): void {
    if (this.invalidNextInst(op)) {
      return;
    }
    this.emitOpCode(0xed27);
    this.emitNumericExpr(op, op.expr, FixupType.Bit8);
  }

  /**
   * Checks if the specified operation results an error as it
   * can be used only with the ZX Spectrum Next
   * @param op Instruction to test
   */
  private invalidNextInst(op: Z80Node): boolean {
    if (this._output.modelType !== SpectrumModelType.Next) {
      this.reportAssemblyError("Z0414", op);
      return true;
    }
    return false;
  }

  /**
   *
   * @param instr Control flow operation line
   * @param target Target expression
   * @param opCode Operation code
   */
  private emitJumpRelativeOp(
    instr: Z80Node,
    target: Operand<Z80Node, Z80TokenType>,
    opCode: number
  ) {
    const opLine = instr as unknown as Z80AssemblyLine;
    if (target.operandType !== OperandType.Expression) {
      this.reportAssemblyError("Z0604", opLine);
      return;
    }
    const value = this.evaluateExpr(target.expr);
    let dist = 0;
    if (value.isNonEvaluated) {
      this.recordFixup(opLine, FixupType.Jr, target.expr);
    } else {
      dist = value.value - (this.getCurrentAssemblyAddress() + 2);
      if (dist < -128 || dist > 127) {
        this.reportAssemblyError("Z0403", opLine, null, dist);
        return;
      }
    }
    this.emitByte(opCode);
    this.emitByte(dist);
  }

  /**
   * Emits an indexed operation with the specified operand and operation code
   * @param opLine Operation source line
   * @param register Index register
   * @param sign Displacement sign
   * @param expr Displacement expression
   * @param opCode Operation code
   */
  private emitIndexedOperation(
    opLine: Z80AssemblyLine,
    operand: Operand<Z80Node, Z80TokenType>,
    opCode: number
  ): void {
    const idxByte = operand.register === "ix" ? 0xdd : 0xfd;
    let dispValue = 0x00;
    let evaluated = true;
    if (operand.offsetSign) {
      const value = this.evaluateExpr(operand.expr);
      if (!value.isValid) {
        evaluated = false;
      } else {
        dispValue = value.value;
        if (operand.offsetSign === "-") {
          dispValue = -dispValue;
        }
      }
    }
    this.emitByte(idxByte);
    this.emitByte(opCode);
    if (!evaluated) {
      this.recordFixup(opLine, FixupType.Bit8, operand.expr);
    }
    this.emitByte(dispValue);
  }

  /**
   * Emits an indexed bit operation with the specified operand and operation code
   * @param opLine Operation source line
   * @param register Index register
   * @param sign Displacement sign
   * @param expr Displacement expression
   * @param opCode Operation code
   */
  private emitIndexedBitOperation(
    opLine: Z80AssemblyLine,
    register: string,
    sign: string,
    expr: Expression<Z80Node, Z80TokenType>,
    opCode: number
  ): void {
    const idxByte = register === "ix" ? 0xdd : 0xfd;
    let dispValue = 0x00;
    let evaluated = true;
    if (sign) {
      const value = this.evaluateExpr(expr);
      if (!value.isValid) {
        evaluated = false;
      } else {
        dispValue = value.value;
        if (sign === "-") {
          dispValue = -dispValue;
        }
      }
    }
    this.emitByte(idxByte);
    this.emitByte(0xcb);
    if (!evaluated) {
      this.recordFixup(opLine, FixupType.Bit8, expr);
    }
    this.emitByte(dispValue);
    this.emitByte(opCode);
  }
}

function toPosition(token: Token<Z80TokenType>): NodePosition {
  return {
    line: token.location.startLine,
    startPosition: token.location.startPosition,
    endPosition: token.location.endPosition,
    startColumn: token.location.startColumn,
    endColumn: token.location.endColumn
  };
}

/**
 * Represents the operation codes for simple Z80 instructions.
 */
const simpleInstructionCodes: { [key: string]: number } = {
  bsla: 0xed28,
  bsra: 0xed29,
  bsrl: 0xed2a,
  bsrf: 0xed2b,
  brlc: 0xed2c,
  ccf: 0x3f,
  cpd: 0xeda9,
  cpdr: 0xedb9,
  cpi: 0xeda1,
  cpir: 0xedb1,
  cpl: 0x2f,
  daa: 0x27,
  di: 0xf3,
  ei: 0xfb,
  exx: 0xd9,
  halt: 0x76,
  ind: 0xedaa,
  indr: 0xedba,
  ini: 0xeda2,
  inir: 0xedb2,
  ldd: 0xeda8,
  lddr: 0xedb8,
  lddrx: 0xedbc,
  ldrx: 0xedbc,
  lddx: 0xedac,
  ldi: 0xeda0,
  ldir: 0xedb0,
  ldirx: 0xedb4,
  lirx: 0xedb4,
  ldix: 0xeda4,
  ldpirx: 0xedb7,
  lprx: 0xedb7,
  ldws: 0xeda5,
  mirror: 0xed24,
  mul: 0xed30,
  neg: 0xed44,
  nop: 0x00,
  otdr: 0xedbb,
  otir: 0xedb3,
  outinb: 0xed90,
  otib: 0xed90,
  outd: 0xedab,
  outi: 0xeda3,
  pixelad: 0xed94,
  pxad: 0xed94,
  pixeldn: 0xed93,
  pxdn: 0xed93,
  reti: 0xed4d,
  retn: 0xed45,
  rla: 0x17,
  rlca: 0x07,
  rld: 0xed6f,
  rra: 0x1f,
  rrca: 0x0f,
  rrd: 0xed67,
  scf: 0x37,
  setae: 0xed95,
  stae: 0xed95,
  swapnib: 0xed23,
  swap: 0xed23
};

/**
 * Represents the Z80 NEXT operations
 */
const nextInstructionCodes: { [key: string]: boolean } = {
  ldix: true,
  lsws: true,
  ldirx: true,
  lirx: true,
  lddx: true,
  lddrx: true,
  ldrx: true,
  ldpirx: true,
  lprx: true,
  outinb: true,
  otib: true,
  mul: true,
  swapnib: true,
  swap: true,
  mirror: true,
  nextreg: true,
  pixeldn: true,
  pxdn: true,
  pixelad: true,
  pxad: true,
  setae: true,
  stae: true,
  test: true,
  bsla: true,
  bsra: true,
  bsrl: true,
  bsrf: true,
  brlc: true
};

/**
 * Instruction codes for pop operations
 */
const popOpBytes: { [key: string]: number } = {
  af: 0xf1,
  bc: 0xc1,
  de: 0xd1,
  hl: 0xe1,
  ix: 0xdde1,
  iy: 0xfde1
};

/**
 * Order of conditions
 */
const conditionOrder: { [key: string]: number } = {
  nz: 0,
  z: 1,
  nc: 2,
  c: 3,
  po: 4,
  pe: 5,
  p: 6,
  m: 7,
  NZ: 0,
  Z: 1,
  NC: 2,
  C: 3,
  PO: 4,
  PE: 5,
  P: 6,
  M: 7
};

/**
 * Order of 8-bit registers
 */
const reg8Order: { [key: string]: number } = {
  a: 7,
  b: 0,
  c: 1,
  d: 2,
  e: 3,
  h: 4,
  l: 5
};

/**
 * Order of shift operations
 */
const shiftOpOrder: { [key: string]: number } = {
  RlcInstruction: 0,
  RrcInstruction: 1,
  RlInstruction: 2,
  RrInstruction: 3,
  SlaInstruction: 4,
  SraInstruction: 5,
  SllInstruction: 6,
  SrlInstruction: 7
};

/**
 * Increment operation codes
 */
const incOpCodes: { [key: string]: number } = {
  xl: 0xdd2c,
  xh: 0xdd24,
  yl: 0xfd2c,
  yh: 0xfd24,
  ixl: 0xdd2c,
  ixh: 0xdd24,
  iyl: 0xfd2c,
  iyh: 0xfd24,
  bc: 0x03,
  de: 0x13,
  hl: 0x23,
  sp: 0x33,
  ix: 0xdd23,
  iy: 0xfd23
};

/**
 * Decrement operation codes
 */
const decOpCodes: { [key: string]: number } = {
  xl: 0xdd2d,
  xh: 0xdd25,
  yl: 0xfd2d,
  yh: 0xfd25,
  ixl: 0xdd2d,
  ixh: 0xdd25,
  iyl: 0xfd2d,
  iyh: 0xfd25,
  bc: 0x0b,
  de: 0x1b,
  hl: 0x2b,
  sp: 0x3b,
  ix: 0xdd2b,
  iy: 0xfd2b
};

/**
 * Order of shift operations
 */
const aluOpOrder: { [key: string]: number } = {
  AddInstruction: 0,
  AdcInstruction: 1,
  SubInstruction: 2,
  SbcInstruction: 3,
  AndInstruction: 4,
  XorInstruction: 5,
  OrInstruction: 6,
  CpInstruction: 7
};

/**
 * Order of 16-bit registers
 */
const reg16Order: { [key: string]: number } = {
  bc: 0,
  de: 1,
  hl: 2,
  sp: 3
};
