import type { ErrorCodes } from "../compiler-common/assembler-errors";
import type {
  CompoundM6510Instruction,
  M6510AssemblyLine,
  M6510Instruction,
  M6510Node,
  SimpleM6510Instruction
} from "./assembler-tree-nodes";

import { InputStream } from "../compiler-common/input-stream";
import { CommonAssembler } from "@main/compiler-common/common-assembler";
import { CommonTokenStream } from "@main/compiler-common/common-token-stream";
import { CommonAsmParser } from "@main/compiler-common/common-asm-parser";
import { M6510TokenStream, M6510TokenType } from "./m6510-token-stream";
import { M6510AsmParser } from "./m6510-asm-parser";
import { AssemblyLine, Expression, OperandType } from "@main/compiler-common/tree-nodes";
import { FixupType } from "@main/compiler-common/abstractions";
import { ExpressionValueType } from "@abstractions/CompilerInfo";

/**
 * This class provides the functionality of the M6510 Assembler
 */
export class M6510Assembler extends CommonAssembler<M6510Node, M6510TokenType> {
  /**
   * Creates a token stream from the input stream.
   * @param is Input stream to create the token stream from
   */
  protected createTokenStream(is: InputStream): CommonTokenStream<M6510TokenType> {
    return new M6510TokenStream(is);
  }

  /**
   * Creates an assembly parser from the token stream.
   * @param ts Token stream to create the parser from
   * @param fileIndex Index of the source file being parsed
   */
  protected createAsmParser(
    ts: CommonTokenStream<M6510TokenType>,
    fileIndex: number,
    macroEmitPhase?: boolean
  ): CommonAsmParser<M6510Node, M6510TokenType> {
    return new M6510AsmParser(ts, fileIndex, macroEmitPhase);
  }

  /**
   * Checks if the specified model type is valid.
   * @param modelType The model type to validate
   */
  protected validateModelType(_modelType: string): boolean {
    // TODO: Implement model type validation
    return false;
  }

  /**
   * Gets the model name by its ID.
   * @param modelId The model ID to get the name for
   */
  protected getModelNameById(_modelId: number): string {
    // TODO: Implement model name retrieval
    return "";
  }

  /**
   * Checks if the specified model ID supports the .bank pragma.
   * @param modelId The model ID to check
   */
  protected modelSupportsBankPragma(_modelId: number): ErrorCodes | null {
    return "Z0308"; // Other models do not support .bank pragma
  }

  // ==========================================================================
  // M6510 instruction processing methods

  /**
   * Emits code for the specified operation
   * @param opLine Operation to emit the code for
   */
  protected emitAssemblyOperationCode(opLine: M6510AssemblyLine): void {
    if (opLine.type === "SimpleM6510Instruction") {
      const mnemonic = (opLine as unknown as SimpleM6510Instruction).mnemonic.toLowerCase();

      const opCodes = simpleInstructionCodes[mnemonic];
      if (opCodes === undefined) {
        this.reportEvaluationError(this, "M1001", opLine, null, mnemonic);
      }

      // --- Emit the opcode(s);
      this.emitOpCode(opCodes);
      return;
    }

    if (opLine.type !== "CompoundM6510Instruction") {
      this.reportEvaluationError(this, "M1001", opLine, null, opLine.type);
      return;
    }

    const compoundInstr = opLine as unknown as CompoundM6510Instruction;
    const mnemonic = compoundInstr.mnemonic.toLowerCase();
    // --- Process the compound instruction

    switch (mnemonic) {
      case "lda":
        this.withAddressing(compoundInstr, {
          imm: 0xa9, // LDA #$xx
          zp: 0xa5, // LDA $xx
          abs: 0xad, // LDA $xxxx
          zpx: 0xb5, // LDA $xx,X
          abx: 0xbd, // LDA $xxxx,X
          aby: 0xb9, // LDA $xxxx,Y
          idx: 0xa1, // LDA ($xx,X)
          idy: 0xb1 // LDA ($xx),Y
        });
        break;
      case "ldx":
        this.withAddressing(compoundInstr, {
          imm: 0xa2, // LDX #$xx
          zp: 0xa6, // LDX $xx
          abs: 0xae, // LDX $xxxx
          zpy: 0xb6, // LDX $xx,Y
          aby: 0xbe // LDX $xxxx,Y
        });
        break;
      case "ldy":
        this.withAddressing(compoundInstr, {
          imm: 0xa0, // LDY #$xx
          zp: 0xa4, // LDY $xx
          abs: 0xac, // LDY $xxxx
          zpx: 0xb4, // LDY $xx,X
          abx: 0xbc // LDY $xxxx,X
        });
        break;
      case "sta":
        this.withAddressing(compoundInstr, {
          zp: 0x85, // STA $xx
          abs: 0x8d, // STA $xxxx
          zpx: 0x95, // STA $xx,X
          abx: 0x9d, // STA $xxxx,X
          aby: 0x99, // STA $xxxx,Y
          idx: 0x81, // STA ($xx,X)
          idy: 0x91 // STA ($xx),Y
        });
        break;
      case "stx":
        this.withAddressing(compoundInstr, {
          zp: 0x86, // STX $xx
          abs: 0x8e, // STX $xxxx
          zpy: 0x96 // STX $xx,Y
        });
        break;
      case "sty":
        this.withAddressing(compoundInstr, {
          zp: 0x84, // STY $xx
          abs: 0x8c, // STY $xxxx
          zpx: 0x94 // STY $xx,X
        });
        break;
      case "and":
        this.withAddressing(compoundInstr, {
          imm: 0x29, // AND #$xx
          zp: 0x25, // AND $xx
          abs: 0x2d, // AND $xxxx
          zpx: 0x35, // AND $xx,X
          abx: 0x3d, // AND $xxxx,X
          aby: 0x39, // AND $xxxx,Y
          idx: 0x21, // AND ($xx,X)
          idy: 0x31 // AND ($xx),Y
        });
        break;
      case "eor":
        this.withAddressing(compoundInstr, {
          imm: 0x49, // EOR #$xx
          zp: 0x45, // EOR $xx
          abs: 0x4d, // EOR $xxxx
          zpx: 0x55, // EOR $xx,X
          abx: 0x5d, // EOR $xxxx,X
          aby: 0x59, // EOR $xxxx,Y
          idx: 0x41, // EOR ($xx,X)
          idy: 0x51 // EOR ($xx),Y
        });
        break;
      case "ora":
        this.withAddressing(compoundInstr, {
          imm: 0x09, // ORA #$xx
          zp: 0x05, // ORA $xx
          abs: 0x0d, // ORA $xxxx
          zpx: 0x15, // ORA $xx,X
          abx: 0x1d, // ORA $xxxx,X
          aby: 0x19, // ORA $xxxx,Y
          idx: 0x01, // ORA ($xx,X)
          idy: 0x11 // ORA ($xx),Y
        });
        break;
      case "asl":
        this.withAddressing(compoundInstr, {
          a: 0x0a, // ASL A
          zp: 0x06, // ASL $xx
          abs: 0x0e, // ASL $xxxx
          zpx: 0x16, // ASL $xx,X
          abx: 0x1e // ASL $xxxx,X
        });
        break;
      case "lsr":
        this.withAddressing(compoundInstr, {
          a: 0x4a, // LSR A
          zp: 0x46, // LSR $xx
          abs: 0x4e, // LSR $xxxx
          zpx: 0x56, // LSR $xx,X
          abx: 0x5e // LSR $xxxx,X
        });
        break;
      case "rol":
        this.withAddressing(compoundInstr, {
          a: 0x2a, // ROL A
          zp: 0x26, // ROL $xx
          abs: 0x2e, // ROL $xxxx
          zpx: 0x36, // ROL $xx,X
          abx: 0x3e // ROL $xxxx,X
        });
        break;
      case "ror":
        this.withAddressing(compoundInstr, {
          a: 0x6a, // ROR A
          zp: 0x66, // ROR $xx
          abs: 0x6e, // ROR $xxxx
          zpx: 0x76, // ROR $xx,X
          abx: 0x7e // ROR $xxxx,X
        });
        break;
      case "adc":
        this.withAddressing(compoundInstr, {
          imm: 0x69, // ADC #$xx
          zp: 0x65, // ADC $xx
          abs: 0x6d, // ADC $xxxx
          zpx: 0x75, // ADC $xx,X
          abx: 0x7d, // ADC $xxxx,X
          aby: 0x79, // ADC $xxxx,Y
          idx: 0x61, // ADC ($xx,X)
          idy: 0x71 // ADC ($xx),Y
        });
        break;
      case "sbc":
        this.withAddressing(compoundInstr, {
          imm: 0xe9, // SBC #$xx
          zp: 0xe5, // SBC $xx
          abs: 0xed, // SBC $xxxx
          zpx: 0xf5, // SBC $xx,X
          abx: 0xfd, // SBC $xxxx,X
          aby: 0xf9, // SBC $xxxx,Y
          idx: 0xe1, // SBC ($xx,X)
          idy: 0xf1 // SBC ($xx),Y
        });
        break;
      case "dec":
        this.withAddressing(compoundInstr, {
          zp: 0xc6, // DEC $xx
          abs: 0xce, // DEC $xxxx
          zpx: 0xd6, // DEC $xx,X
          abx: 0xde // DEC $xxxx,X
        });
        break;
      case "inc":
        this.withAddressing(compoundInstr, {
          zp: 0xe6, // INC $xx
          abs: 0xee, // INC $xxxx
          zpx: 0xf6, // INC $xx,X
          abx: 0xfe // INC $xxxx,X
        });
        break;
      case "cmp":
        this.withAddressing(compoundInstr, {
          imm: 0xc9, // CMP #$xx
          zp: 0xc5, // CMP $xx
          abs: 0xcd, // CMP $xxxx
          zpx: 0xd5, // CMP $xx,X
          abx: 0xdd, // CMP $xxxx,X
          aby: 0xd9, // CMP $xxxx,Y
          idx: 0xc1, // CMP ($xx,X)
          idy: 0xd1 // CMP ($xx),Y
        });
        break;
      case "cpx":
        this.withAddressing(compoundInstr, {
          imm: 0xe0, // CPX #$xx
          zp: 0xe4, // CPX $xx
          abs: 0xec // CPX $xxxx
        });
        break;
      case "cpy":
        this.withAddressing(compoundInstr, {
          imm: 0xc0, // CPY #$xx
          zp: 0xc4, // CPY $xx
          abs: 0xcc // CPY $xxxx
        });
        break;
      case "bit":
        this.withAddressing(compoundInstr, {
          zp: 0x24, // BIT $xx
          abs: 0x2c // BIT $xxxx
        });
        break;
      case "jmp":
        this.withAddressing(compoundInstr, {
          abs: 0x4c, // JMP $xxxx
          ind: 0x6c // JMP ($xxxx)
        });
        break;
      case "jsr":
        this.withAddressing(compoundInstr, {
          abs: 0x20 // JSR $xxxx
        });
        break;
    }
  }

  /**
   * Evaluates the expression and emits bytes accordingly. If the expression
   * cannot be resolved, creates a fixup.
   * @param opLine Assembly line
   * @param expr Expression to evaluate
   * @param type Expression/Fixup type
   */
  private emitOpcodeWithZpOrAbs(
    instr: M6510Instruction,
    expr: Expression<M6510Instruction, M6510TokenType>,
    zpOpCode: number,
    absoluteOpCode: number
  ): void {
    const opLine = instr as unknown as AssemblyLine<M6510Instruction>;
    let value = this.evaluateExpr(expr);
    let valueToUse = 0x00;
    if (value.type === ExpressionValueType.Error) {
      return;
    }
    if (value.isNonEvaluated) {
      this.emitOpCode(absoluteOpCode);
      this.recordFixup(opLine, FixupType.Bit16, expr);
      this.emitByte(0xff); // Use a dummy value for 8-bit fixup
      this.emitByte(0xff); // Use a dummy value for 8-bit fixup
      return;
    }
    if (value.isValid) {
      if (value.type === ExpressionValueType.Integer) {
        valueToUse = value.asLong();
      } else if (value.type === ExpressionValueType.Real) {
        valueToUse = Math.round(value.asReal());
      } else if (value.type === ExpressionValueType.String) {
        this.reportAssemblyError("Z0603", opLine);
        valueToUse = 0xffff; // Use a dummy value for string
      }
    }
    if ((valueToUse & 0xffff) > 0xff) {
      // --- Absolute addressing
      this.emitOpCode(absoluteOpCode);
      this.emitByte(valueToUse & 0xff); // Low byte
      this.emitByte((valueToUse >> 8) & 0xff); // High byte
    } else {
      // --- Zero page addressing
      this.emitOpCode(zpOpCode);
      this.emitByte(valueToUse & 0xff);
    }
  }

  private withAddressing(instr: CompoundM6510Instruction, addr: AddressingInfo): void {
    const operand = instr.operand;
    switch (operand.operandType) {
      case OperandType.Reg8:
        if (addr.a !== undefined) {
          // --- Register operand
          this.emitOpCode(addr.a);
        } else {
          this.reportAssemblyError("M1005", instr, null, instr.mnemonic.toUpperCase());
        }
        break;
      case OperandType.Immediate:
        if (addr.imm !== undefined) {
          // --- Immediate operand
          this.emitOpCode(addr.imm);
          this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
        } else {
          this.reportAssemblyError("M1002", instr, null, instr.mnemonic.toUpperCase());
        }
        break;
      case OperandType.Expression:
        if (addr.zp !== undefined && addr.abs === undefined) {
          // --- Zero page addressing
          this.emitOpCode(addr.zp);
          this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
        } else if (addr.zp === undefined && addr.abs !== undefined) {
          // --- Absolute addressing
          this.emitOpCode(addr.abs);
          this.emitNumericExpr(instr, operand.expr, FixupType.Bit16);
        } else if (addr.zp !== undefined && addr.abs !== undefined) {
          // --- Zero page or absolute addressing
          this.emitOpcodeWithZpOrAbs(instr, operand.expr, addr.zp, addr.abs);
        } else {
          this.reportAssemblyError("M1008", instr, null, instr.mnemonic.toUpperCase());
        }
        break;
      case OperandType.IndexedDirect:
        if (operand.register === "x") {
          if (addr.zpx !== undefined && addr.abx === undefined) {
            // --- Indexed direct addressing with X register
            this.emitOpCode(addr.zpx);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
          } else if (addr.zpx !== undefined && addr.abx !== undefined) {
            // --- Indexed indirect addressing with X register
            this.emitOpcodeWithZpOrAbs(instr, operand.expr, addr.zpx, addr.abx);
          } else if (addr.zpx === undefined && addr.abx !== undefined) {
            // --- Indexed indirect addressing with X register
            this.emitOpCode(addr.abx);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit16);
          } else {
            this.reportAssemblyError("M1003", instr, null, instr.mnemonic.toUpperCase());
          }
        } else {
          if (addr.zpy !== undefined && addr.aby === undefined) {
            // --- Indexed direct addressing with Y register
            this.emitOpCode(addr.zpy);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
          } else if (addr.zpy !== undefined && addr.aby !== undefined) {
            // --- Indexed indirect addressing with Y register
            this.emitOpcodeWithZpOrAbs(instr, operand.expr, addr.zpy, addr.aby);
          } else if (addr.zpy === undefined && addr.aby !== undefined) {
            // --- Indexed indirect addressing with Y register
            this.emitOpCode(addr.aby);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit16);
          } else {
            this.reportAssemblyError("M1006", instr, null, instr.mnemonic.toUpperCase());
          }
        }
        break;
      case OperandType.IndexedIndirect:
        if (operand.register === "x") {
          if (addr.idx !== undefined) {
            // --- Indexed indirect addressing with X register
            this.emitOpCode(addr.idx);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
          } else {
            // --- Error if no addressing info is provided
            this.reportAssemblyError("M1004", instr, null, instr.mnemonic.toUpperCase());
          }
        } else if (operand.register === "y") {
          if (addr.idy !== undefined) {
            // --- Indexed indirect addressing with Y register
            this.emitOpCode(addr.idy);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit8);
          } else {
            // --- Error if no addressing info is provided
            this.reportAssemblyError("M1004", instr, null, instr.mnemonic.toUpperCase());
          }
        } else {
          // --- No register
          if (addr.ind !== undefined) {
            // --- Indirect addressing
            this.emitOpCode(addr.ind);
            this.emitNumericExpr(instr, operand.expr, FixupType.Bit16);
          } else {
            // --- Error if no addressing info is provided
            this.reportAssemblyError("M1007", instr, null, instr.mnemonic.toUpperCase());
          }
        }
        break;
    }
  }
}

type AddressingInfo = {
  a?: number;
  imm?: number;
  zp?: number;
  abs?: number;
  zpx?: number;
  zpy?: number;
  abx?: number;
  aby?: number;
  idx?: number;
  idy?: number;
  ind?: number;
};

/**
 * Represents the operation codes for simple Z80 instructions.
 */
const simpleInstructionCodes: Record<string, number> = {
  brk: 0x00,
  clc: 0x18,
  cld: 0xd8,
  cli: 0x58,
  clv: 0xb8,
  dex: 0xca,
  dey: 0x88,
  hlt: 0x02,
  inx: 0xe8,
  iny: 0xc8,
  jam: 0x02,
  kil: 0x02,
  nop: 0xea,
  pha: 0x48,
  php: 0x08,
  pla: 0x68,
  plp: 0x28,
  rti: 0x40,
  rts: 0x60,
  sec: 0x38,
  sed: 0xf8,
  sei: 0x78,
  tax: 0xaa,
  tay: 0xa8,
  tsx: 0xba,
  txa: 0x8a,
  txs: 0x9a,
  tya: 0x98
};
