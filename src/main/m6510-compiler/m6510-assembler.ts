import type { ErrorCodes } from "../compiler-common/assembler-errors";
import type {
  CompoundM6510Instruction,
  M6510AssemblyLine,
  M6510Instruction,
  M6510Node,
  SimpleM6510Instruction
} from "./assembler-tree-nodes";

import { InputStream } from "../compiler-common/input-stream";
import { CommonAssembler } from "../compiler-common/common-assembler";
import { CommonTokenStream } from "../compiler-common/common-token-stream";
import { CommonAsmParser } from "../compiler-common/common-asm-parser";
import { M6510TokenStream, M6510TokenType } from "./m6510-token-stream";
import { M6510AsmParser } from "./m6510-asm-parser";
import { AssemblyLine, Expression, Operand, OperandType } from "../compiler-common/tree-nodes";
import { FixupType } from "../compiler-common/abstractions";
import { ExpressionValueType } from "@abstr/CompilerInfo";

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
      case "bpl":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0x10); // BPL $xx
        break;
      case "bmi":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0x30); // BMI $xx
        break;
      case "bvc":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0x50); // BVC $xx
        break;
      case "bvs":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0x70); // BVS $xx
        break;
      case "bcc":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0x90); // BCC $xx
        break;
      case "bcs":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0xb0); // BCS $xx
        break;
      case "bne":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0xd0); // BNE $xx
        break;
      case "beq":
        this.emitRelativeJump(compoundInstr, compoundInstr.operand, 0xf0); // BEQ $xx
        break;
      case "slo":
        this.withAddressing(compoundInstr, {
          idx: 0x03, // SLO ($xx,X)
          zp: 0x07, // SLO $xx
          abs: 0x0f, // SLO $xxxx,
          idy: 0x13, // SLO ($xx),Y
          zpx: 0x17, // SLO $xx,X
          aby: 0x1b, // SLO $xxxx,Y
          abx: 0x1f // SLO $xxxx,X
        });
        break;
      case "dop":
        this.withAddressing(compoundInstr, {
          zp: 0x04, // DOP $xx
          zpx: 0x14, // DOP $xx,X
          imm: 0x80 // DOP #$xx
        });
        break;
      case "aac":
        this.withAddressing(compoundInstr, {
          imm: 0x0b // AAC #$xx
        });
        break;
      case "top":
        this.withAddressing(compoundInstr, {
          abs: 0x0c, // TOP $xxxx
          abx: 0x1c // TOP $xxxx,X
        });
        break;
      case "rla":
        this.withAddressing(compoundInstr, {
          idx: 0x23, // RLA ($xx,X)
          zp: 0x27, // RLA $xx
          abs: 0x2f, // RLA $xxxx
          idy: 0x33, // RLA ($xx),Y
          zpx: 0x37, // RLA $xx,X
          aby: 0x3b, // RLA $xxxx,Y
          abx: 0x3f // RLA $xxxx,X
        });
        break;
      case "sre":
        this.withAddressing(compoundInstr, {
          idx: 0x43, // SRE ($xx,X)
          zp: 0x47, // SRE $xx
          abs: 0x4f, // SRE $xxxx
          idy: 0x53, // SRE ($xx),Y
          zpx: 0x57, // SRE $xx,X
          aby: 0x5b, // SRE $xxxx,Y
          abx: 0x5f // SRE $xxxx,X
        });
        break;
      case "sax":
        this.withAddressing(compoundInstr, {
          idx: 0x83, // SAX ($xx,X)
          zp: 0x87, // SAX $xx
          abs: 0x8f, // SAX $xxxx
          zpy: 0x97 // SAX $xx,Y
        });
        break;
      case "arr":
        this.withAddressing(compoundInstr, {
          imm: 0x6b // ARR #$xx
        });
        break;
      case "asr":
        this.withAddressing(compoundInstr, {
          imm: 0x4b // ASR #$xx
        });
        break;
      case "atx":
        this.withAddressing(compoundInstr, {
          imm: 0xab // ATX #$xx
        });
        break;
      case "axa":
        this.withAddressing(compoundInstr, {
          idy: 0x93, // AXA ($xx),Y
          aby: 0x9f // AXA $xxxx,Y
        });
        break;
      case "axs":
        this.withAddressing(compoundInstr, {
          imm: 0xcb // AXS #$xx
        });
        break;
      case "sax":
        this.withAddressing(compoundInstr, {
          idx: 0x83, // SAX ($xx,X)
          zp: 0x87, // SAX $xx
          abs: 0x8f, // SAX $xxxx
          zpy: 0x97 // SAX $xx,Y
        });
        break;
      case "dcp":
        this.withAddressing(compoundInstr, {
          idx: 0xc3, // DCP ($xx,X)
          zp: 0xc7, // DCP $xx
          abs: 0xcf, // DCP $xxxx
          idy: 0xd3, // DCP ($xx),Y
          zpx: 0xd7, // DCP $xx,X
          aby: 0xdb, // DCP $xxxx,Y
          abx: 0xdf // DCP $xxxx,X
        });
        break;
      case "isc":
        this.withAddressing(compoundInstr, {
          idx: 0xe3, // ISC ($xx,X)
          zp: 0xe7, // ISC $xx
          abs: 0xef, // ISC $xxxx
          idy: 0xf3, // ISC ($xx),Y
          zpx: 0xf7, // ISC $xx,X
          aby: 0xfb, // ISC $xxxx,Y
          abx: 0xff // ISC $xxxx,X
        });
        break;
      case "lar":
        this.withAddressing(compoundInstr, {
          aby: 0xbb // LAR $xxxx,Y
        });
        break;
      case "lax":
        this.withAddressing(compoundInstr, {
          idx: 0xa3, // LAX ($xx,X)
          zp: 0xa7, // LAX $xx
          abs: 0xaf, // LAX $xxxx
          idy: 0xb3, // LAX ($xx),Y
          zpy: 0xb7, // LAX $xx,Y
          aby: 0xbf // LAX $xxxx,Y
        });
        break;
      case "rra":
        this.withAddressing(compoundInstr, {
          idx: 0x63, // RRA ($xx,X)
          zp: 0x67, // RRA $xx
          abs: 0x6f, // RRA $xxxx
          idy: 0x73, // RRA ($xx),Y
          zpx: 0x77, // RRA $xx,X
          aby: 0x7b, // RRA $xxxx,Y
          abx: 0x7f // RRA $xxxx,X
        });
        break;
      case "sxa":
        this.withAddressing(compoundInstr, {
          aby: 0x9e // SXA $xxxx,Y
        });
        break;
      case "sya":
        this.withAddressing(compoundInstr, {
          abx: 0x9c // SYA $xxxx,X
        });
        break;
      case "xaa":
        this.withAddressing(compoundInstr, {
          imm: 0x8b // XAA #$xx
        });
        break;
      case "xas":
        this.withAddressing(compoundInstr, {
          aby: 0x9b // XAS $xxxx,Y
        });
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

  /**
   *
   * @param instr Control flow operation line
   * @param target Target expression
   * @param opCode Operation code
   */
  private emitRelativeJump(
    instr: CompoundM6510Instruction,
    target: Operand<M6510Node, M6510TokenType>,
    opCode: number
  ) {
    const opLine = instr as unknown as AssemblyLine<M6510Node>;
    if (target.operandType !== OperandType.Expression) {
      this.reportAssemblyError("M1009", opLine, null, instr.mnemonic.toUpperCase());
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
