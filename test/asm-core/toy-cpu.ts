/**
 * A toy CPU assembled by the CPU-neutral assembler core (`src/main/compiler-common/`) alone: a few
 * 6502-like instructions, its own tokens, operands, models and relative-branch fixup. It imports
 * nothing from `src/main/z80-compiler/`, so the tests that use it prove the core works for a CPU that
 * is not the Z80 (`dev/plans/ASSEMBLER_CPU_NEUTRAL_PLAN.md`, step 6).
 *
 * Instructions: `nop` ($EA), `rts` ($60), `inx` ($E8), `lda #n` ($A9), `lda nn` ($AD), `sta nn` ($8D),
 * `jmp nn` ($4C), `bne label` ($D0, relative).
 */
import { FixupType, IExpressionValue } from "@main/compiler-common/abstractions";
import { CommonAsmParser, ParsePoint } from "@main/compiler-common/common-asm-parser";
import { CommonAssembler } from "@main/compiler-common/common-assembler";
import { CommonTokenStream } from "@main/compiler-common/common-token-stream";
import {
  commonResolverHash,
  commonTokenTraits,
  CommonTokens,
  CommonTokenType,
  TokenTraits
} from "@main/compiler-common/common-tokens";
import { FixupEntry } from "@main/compiler-common/fixups";
import { InputStream } from "@main/compiler-common/input-stream";
import {
  AssemblyLine,
  CommonOperandType,
  Expression,
  Node,
  Operand,
  PartialAssemblyLine
} from "@main/compiler-common/tree-nodes";

// --- Tokens: the core's, plus the toy's mnemonics and registers
export const ToyTokens = {
  ...CommonTokens,
  Nop: 2000,
  Rts: 2001,
  Inx: 2002,
  Lda: 2003,
  Sta: 2004,
  Jmp: 2005,
  Bne: 2006,
  A: 2100,
  X: 2101
};
export type ToyTokenType = (typeof ToyTokens)[keyof typeof ToyTokens];

const toyResolverHash: Record<string, number> = { ...commonResolverHash };
for (const [word, token] of [
  ["nop", ToyTokens.Nop],
  ["rts", ToyTokens.Rts],
  ["inx", ToyTokens.Inx],
  ["lda", ToyTokens.Lda],
  ["sta", ToyTokens.Sta],
  ["jmp", ToyTokens.Jmp],
  ["bne", ToyTokens.Bne],
  ["a", ToyTokens.A],
  ["x", ToyTokens.X]
] as const) {
  toyResolverHash[word] = token;
  toyResolverHash[word.toUpperCase()] = token;
}

const toyTraits = new Map<number, TokenTraits>(commonTokenTraits);
toyTraits.set(ToyTokens.Nop, { instruction: true, simple: true });
toyTraits.set(ToyTokens.Rts, { instruction: true, simple: true });
toyTraits.set(ToyTokens.Inx, { instruction: true, simple: true });
toyTraits.set(ToyTokens.Lda, { instruction: true });
toyTraits.set(ToyTokens.Sta, { instruction: true });
toyTraits.set(ToyTokens.Jmp, { instruction: true });
toyTraits.set(ToyTokens.Bne, { instruction: true });
toyTraits.set(ToyTokens.A, { reg: true });
toyTraits.set(ToyTokens.X, { reg: true });

class ToyTokenStream extends CommonTokenStream<ToyTokenType> {
  constructor(input: InputStream) {
    // --- `#` is the immediate prefix (`lda #5`), not the start of a `#FF` hexadecimal literal
    super(input, false);
  }

  getResolverHash(): Record<string, number> {
    return toyResolverHash;
  }
  get escapeChars(): string[] {
    return ["n", "'", '"', "\\", "0"];
  }
}

// --- Syntax nodes
/** The toy's own operand kind: `#n` */
const ToyOperandType = { Immediate: 0 };

export interface ToyInstruction extends PartialAssemblyLine<ToyNode> {
  type: "ToyInstruction";
  mnemonic: string;
  immediate?: boolean;
  expr?: Expression<ToyNode, ToyTokenType>;
}
export type ToyNode = Node<ToyInstruction, ToyTokenType>;

class ToyAsmParser extends CommonAsmParser<ToyNode, ToyTokenType> {
  protected getTokenTraits(type: CommonTokenType): TokenTraits {
    return toyTraits.get(type) ?? {};
  }

  protected parseInstruction(parsePoint: ParsePoint): PartialAssemblyLine<ToyNode> | null {
    this.tokens.get();
    const mnemonic = parsePoint.start.text.toLowerCase();
    if (parsePoint.traits.simple) {
      return { type: "ToyInstruction", mnemonic } as ToyInstruction;
    }
    const immediate = !!this.skipToken(CommonTokens.Hashmark);
    const expr = this.getExpression();
    return { type: "ToyInstruction", mnemonic, immediate, expr } as ToyInstruction;
  }

  protected parseOperand(): Operand<ToyNode, ToyTokenType> | null {
    const immediate = !!this.skipToken(CommonTokens.Hashmark);
    const expr = this.getExpression(true);
    if (!expr) return null;
    return {
      type: "Operand",
      operandType: immediate ? ToyOperandType.Immediate : CommonOperandType.Expression,
      expr
    };
  }

  protected convertEscapedString(inp: string): string {
    return inp.replace(/\\n/g, "\n");
  }
}

/** The toy's models: `.model T1` loads code at $0801 */
const TOY_MODELS = ["T0", "T1"];

export class ToyAssembler extends CommonAssembler<ToyNode, ToyTokenType> {
  protected createTokenStream(is: InputStream): CommonTokenStream<ToyTokenType> {
    return new ToyTokenStream(is);
  }

  protected createAsmParser(
    ts: CommonTokenStream<ToyTokenType>,
    fileIndex: number,
    macroEmitPhase?: boolean
  ): CommonAsmParser<ToyNode, ToyTokenType> {
    return new ToyAsmParser(ts, fileIndex, macroEmitPhase);
  }

  protected validateModelType(modelType: string): boolean {
    return TOY_MODELS.includes(modelType.toUpperCase());
  }

  protected getModelNameById(modelId: number): string {
    return TOY_MODELS[modelId - 1];
  }

  protected getModelIdByName(modelName: string): number | undefined {
    const index = TOY_MODELS.indexOf(modelName.toUpperCase());
    return index < 0 ? undefined : index + 1;
  }

  protected getDefaultStartAddress(): number {
    return (this._output.modelType ?? 0) === 2 ? 0x0801 : 0x1000;
  }

  /** `#n` as a macro argument keeps its `#` */
  protected operandToMacroArgument(operand: Operand<ToyNode, ToyTokenType>): IExpressionValue | null | undefined {
    if (operand.operandType !== ToyOperandType.Immediate) return undefined;
    const value = this.evaluateExprImmediate(operand.expr);
    return value.isValid ? ({ ...value, asString: () => `#${value.asString()}` } as IExpressionValue) : null;
  }

  protected emitAssemblyOperationCode(opLine: AssemblyLine<ToyNode>): void {
    const instr = opLine as unknown as ToyInstruction;
    switch (instr.mnemonic) {
      case "nop":
        this.emitByte(0xea);
        return;
      case "rts":
        this.emitByte(0x60);
        return;
      case "inx":
        this.emitByte(0xe8);
        return;
      case "lda":
        if (instr.immediate) {
          this.emitByte(0xa9);
          this.emitNumericExpr(instr, instr.expr, FixupType.Bit8);
        } else {
          this.emitByte(0xad);
          this.emitNumericExpr(instr, instr.expr, FixupType.Bit16);
        }
        return;
      case "sta":
      case "jmp":
        if (instr.immediate) {
          this.reportAssemblyError("Z0604", opLine);
          return;
        }
        this.emitByte(instr.mnemonic === "sta" ? 0x8d : 0x4c);
        this.emitNumericExpr(instr, instr.expr, FixupType.Bit16);
        return;
      case "bne": {
        const value = this.evaluateExpr(instr.expr);
        let dist = 0;
        if (value.isNonEvaluated) {
          this.recordFixup(opLine, FixupType.Jr, instr.expr);
        } else if (value.isValid) {
          dist = value.asWord() - (this.getCurrentAssemblyAddress() + 2);
        }
        this.emitByte(0xd0);
        this.emitByte(dist & 0xff);
        return;
      }
    }
  }

  /** The relative branch: the toy's own fixup, resolved through the core's hook */
  protected resolveCpuFixup(fixup: FixupEntry<ToyNode, ToyTokenType>, value: IExpressionValue): boolean {
    if (fixup.type !== FixupType.Jr) return false;
    const segment = this._output.segments[fixup.segmentIndex];
    const dist = value.asWord() - (segment.startAddress + fixup.offset + 2);
    segment.emittedCode[fixup.offset + 1] = dist & 0xff;
    return true;
  }
}
