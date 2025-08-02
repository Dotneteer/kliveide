import type { ErrorCodes } from "../compiler-common/assembler-errors";
import type {
  M6510AssemblyLine,
  M6510Node,
  SimpleM6510Instruction,
} from "./assembler-tree-nodes";

import { InputStream } from "../compiler-common/input-stream";
import { CommonAssembler } from "@main/compiler-common/common-assembler";
import { CommonTokenStream } from "@main/compiler-common/common-token-stream";
import { CommonAsmParser } from "@main/compiler-common/common-asm-parser";
import { M6510TokenStream, M6510TokenType } from "./m6510-token-stream";
import { M6510AsmParser } from "./m6510-asm-parser";

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

    // const instr = opLine as Z80Node;
    // switch (instr.type) {
    //   case "NextRegInstruction":
    //     this.processNextRegInst(instr);
    //     break;
    //   case "PushInstruction":
    //   case "PopInstruction":
    //     this.processStackInst(instr);
    //     break;
    //   case "CallInstruction":
    //     this.processCallInst(instr);
    //     break;
    //   case "JpInstruction":
    //     this.processJpInst(instr);
    //     break;
    //   case "JrInstruction":
    //     this.processJrInst(instr);
    //     break;
    //   case "RetInstruction":
    //     this.processRetInst(instr);
    //     break;
    //   case "RstInstruction":
    //     this.processRstInst(instr);
    //     break;
    //   case "DjnzInstruction":
    //     this.emitJumpRelativeOp(instr, instr.target, 0x10);
    //     break;
    //   case "ImInstruction":
    //     this.processImInst(instr);
    //     break;
    //   case "IncInstruction":
    //   case "DecInstruction":
    //     this.processIncDecInst(instr);
    //     break;
    //   case "LdInstruction":
    //     this.processLdInst(instr);
    //     break;
    //   case "ExInstruction":
    //     this.processExInst(instr);
    //     break;
    //   case "AddInstruction":
    //   case "AdcInstruction":
    //   case "SbcInstruction":
    //     this.processAlu1Inst(instr);
    //     break;
    //   case "SubInstruction":
    //   case "AndInstruction":
    //   case "XorInstruction":
    //   case "OrInstruction":
    //   case "CpInstruction":
    //     this.processAlu2Inst(instr);
    //     break;
    //   case "InInstruction":
    //     this.processInInst(instr);
    //     break;
    //   case "OutInstruction":
    //     this.processOutInst(instr);
    //     break;
    //   case "RlcInstruction":
    //   case "RrcInstruction":
    //   case "RlInstruction":
    //   case "RrInstruction":
    //   case "SlaInstruction":
    //   case "SraInstruction":
    //   case "SllInstruction":
    //   case "SrlInstruction":
    //     this.processShiftRotateInst(instr);
    //     break;
    //   case "BitInstruction":
    //     this.processBitInst(instr, 0x40);
    //     break;
    //   case "ResInstruction":
    //     this.processBitInst(instr, 0x80);
    //     break;
    //   case "SetInstruction":
    //     this.processBitInst(instr, 0xc0);
    //     break;
    //   case "TestInstruction":
    //     this.processTestInst(instr);
    //     break;
    // }
  }

}

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
  tya: 0x98,
};
