import type {
  SimpleZ80Instruction,
  TestInstruction,
  NextRegInstruction,
  DjnzInstruction,
  RstInstruction,
  ImInstruction,
  JrInstruction,
  JpInstruction,
  CallInstruction,
  RetInstruction,
  IncInstruction,
  DecInstruction,
  PushInstruction,
  PopInstruction,
  Z80InstructionWithTwoOperands,
  LdInstruction,
  Z80InstructionWithOneOperand,
  ExInstruction,
  AddInstruction,
  AdcInstruction,
  SbcInstruction,
  BitInstruction,
  Z80InstructionWithOneOrTwoOperands,
  SubInstruction,
  AndInstruction,
  XorInstruction,
  CpInstruction,
  InInstruction,
  OutInstruction,
  RlcInstruction,
  RrcInstruction,
  RlInstruction,
  RrInstruction,
  SlaInstruction,
  SraInstruction,
  SllInstruction,
  SrlInstruction,
  OrInstruction,
  Z80InstructionWithTwoOrThreeOperands,
  ResInstruction,
  SetInstruction,
  Z80Node,
} from "./assembler-tree-nodes";

import { Z80TokenStream, Z80TokenType, Z80Tokens } from "./z80-token-stream";
import { convertSpectrumString } from "./z80-utils";
import { CommonTokens, CommonTokenType, TokenTraits } from "@main/compiler-common/common-tokens";
import { z80TokenTraits } from "./z80-token-traits";
import { CommonAsmParser, ParsePoint } from "@main/compiler-common/common-asm-parser";
import { Expression, Operand, OperandType, PartialAssemblyLine } from "@main/compiler-common/tree-nodes";

/**
 * This class implements the Z80 assembly parser
 */
export class Z80AsmParser extends CommonAsmParser<Z80Node, Z80TokenType> {
  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   * @param fileIndex Optional file index of the file being parsed
   */
  constructor(
    tokens: Z80TokenStream,
    fileIndex = 0,
    macroEmitPhase = false
  ) {
    super(tokens, fileIndex, macroEmitPhase);
  }

  protected getTokenTraits(type: CommonTokenType): TokenTraits {
    return z80TokenTraits.get(type) ?? {};
  }

    /**
   * Converts an escaped string to its unescaped form
   * @param inp String to convert
   */
  protected convertEscapedString(inp: string): string {
    return convertSpectrumString(inp);
  }

  /**
   * instruction
   *   : simpleInstruction
   *   | compoundInstruction
   *   ;
   */
  parseInstruction(parsePoint: ParsePoint): PartialAssemblyLine<Z80Node> | null {
    const { traits } = parsePoint;
    return traits.simple
      ? this.parseSimpleInstruction(parsePoint)
      : this.parseCompoundInstruction(parsePoint);
  }

  /**
   * simpleInstruction
   *   : NOP
   *   | RLCA
   *   | RRCA
   *   | RLA
   *   | RRA
   *   | DAA
   *   | CPL
   *   | SCF
   *   | CCF
   *   | HALT
   *   | EXX
   *   | DI
   *   | EI
   *   | NEG
   *   | RETN
   *   | RETI
   *   | RLD
   *   | RRD
   *   | LDI
   *   | CPI
   *   | INI
   *   | OUTI
   *   | LDD
   *   | CPD
   *   | IND
   *   | OUTD
   *   | LDIR
   *   | CPIR
   *   | INIR
   *   | OTIR
   *   | LDDR
   *   | CPDR
   *   | INDR
   *   | OTDR
   *   | LDIX
   *   | LDWS
   *   | LDIRX
   *   | LDDX
   *   | LDDRX
   *   | LDPIRX
   *   | OUTINB
   *   | SWAPNIB
   *   | PIXELDN
   *   | PIXELAD
   *   | SETAE
   *   ;
   */
  private parseSimpleInstruction(parsePoint: ParsePoint): SimpleZ80Instruction | null {
    this.tokens.get();
    return {
      type: "SimpleZ80Instruction",
      mnemonic: parsePoint.start.text.toUpperCase()
    };
  }

  /**
   *
   * @param parsePoint
   */
  private parseCompoundInstruction(
    parsePoint: ParsePoint
  ): PartialAssemblyLine<Z80Node> | null {
    const { start } = parsePoint;
    const parser = this;
    this.tokens.get();
    switch (start.type) {
      case Z80Tokens.Ld:
        return twoOperands<LdInstruction>("LdInstruction");

      case Z80Tokens.Inc:
        return <IncInstruction>oneOperand("IncInstruction");

      case Z80Tokens.Dec:
        return <DecInstruction>oneOperand("DecInstruction");

      case Z80Tokens.Ex:
        return twoOperands<ExInstruction>("ExInstruction");

      case Z80Tokens.Add:
        return oneOrTwoOperands<AddInstruction>("AddInstruction");

      case Z80Tokens.Adc:
        return oneOrTwoOperands<AdcInstruction>("AdcInstruction");

      case Z80Tokens.Sub:
        return oneOrTwoOperands<SubInstruction>("SubInstruction");

      case Z80Tokens.Sbc:
        return oneOrTwoOperands<SbcInstruction>("SbcInstruction");

      case Z80Tokens.And:
        return oneOrTwoOperands<AndInstruction>("AndInstruction");

      case Z80Tokens.Xor:
        return oneOrTwoOperands<XorInstruction>("XorInstruction");

      case Z80Tokens.Or:
        return oneOrTwoOperands<OrInstruction>("OrInstruction");

      case Z80Tokens.Cp:
        return oneOrTwoOperands<CpInstruction>("CpInstruction");

      case Z80Tokens.Djnz:
        const djnzTarget = this.getOperand();
        return <DjnzInstruction>{
          type: "DjnzInstruction",
          target: djnzTarget
        };

      case Z80Tokens.Jr:
        return oneOrTwoOperands<JrInstruction>("JrInstruction");

      case Z80Tokens.Jp:
        return oneOrTwoOperands<JpInstruction>("JpInstruction");

      case Z80Tokens.Call:
        return oneOrTwoOperands<CallInstruction>("CallInstruction");

      case Z80Tokens.Ret:
        let retCondition: Operand<Z80Node, Z80TokenType> = this.parseOperand();
        return <RetInstruction>{
          type: "RetInstruction",
          condition: retCondition
        };

      case Z80Tokens.Rst:
        return <RstInstruction>{
          type: "RstInstruction",
          target: this.getOperand()
        };

      case Z80Tokens.Push:
        return <PushInstruction>oneOperand("PushInstruction");

      case Z80Tokens.Pop:
        return <PopInstruction>oneOperand("PopInstruction");

      case Z80Tokens.In:
        return oneOrTwoOperands<InInstruction>("InInstruction");

      case Z80Tokens.Out:
        return oneOrTwoOperands<OutInstruction>("OutInstruction");

      case Z80Tokens.Im:
        return <ImInstruction>{
          type: "ImInstruction",
          mode: this.getOperand()
        };

      case Z80Tokens.Rlc:
        return oneOrTwoOperands<RlcInstruction>("RlcInstruction");

      case Z80Tokens.Rrc:
        return oneOrTwoOperands<RrcInstruction>("RrcInstruction");

      case Z80Tokens.Rl:
        return oneOrTwoOperands<RlInstruction>("RlInstruction");

      case Z80Tokens.Rr:
        return oneOrTwoOperands<RrInstruction>("RrInstruction");

      case Z80Tokens.Sla:
        return oneOrTwoOperands<SlaInstruction>("SlaInstruction");

      case Z80Tokens.Sra:
        return oneOrTwoOperands<SraInstruction>("SraInstruction");

      case Z80Tokens.Sll:
        return oneOrTwoOperands<SllInstruction>("SllInstruction");

      case Z80Tokens.Srl:
        return oneOrTwoOperands<SrlInstruction>("SrlInstruction");

      case Z80Tokens.Bit:
        return twoOperands<BitInstruction>("BitInstruction");

      case Z80Tokens.Res:
        return twoOrThreeOperands<ResInstruction>("ResInstruction");

      case Z80Tokens.Set:
        return twoOrThreeOperands<SetInstruction>("SetInstruction");

      case Z80Tokens.Mul:
        parser.expectToken(Z80Tokens.D, "Z0104");
        parser.expectToken(Z80Tokens.Comma, "Z0003");
        parser.expectToken(Z80Tokens.E, "Z0105");
        return <SimpleZ80Instruction>{
          type: "SimpleZ80Instruction",
          mnemonic: "mul"
        };

      case Z80Tokens.Mirror:
        this.expectToken(Z80Tokens.A, "Z0101");
        return <SimpleZ80Instruction>{
          type: "SimpleZ80Instruction",
          mnemonic: "mirror"
        };

      case Z80Tokens.NextReg:
        return twoOperands<NextRegInstruction>("NextRegInstruction");

      case Z80Tokens.Test:
        return <TestInstruction>{
          type: "TestInstruction",
          expr: this.getExpression()
        };

      case Z80Tokens.Bsla:
        return expectDeAndB("bsla");

      case Z80Tokens.Bsra:
        return expectDeAndB("bsra");

      case Z80Tokens.Bsrl:
        return expectDeAndB("bsrl");

      case Z80Tokens.Bsrf:
        return expectDeAndB("bsrf");

      case Z80Tokens.Brlc:
        return expectDeAndB("brlc");
    }
    return null;

    function oneOperand<T extends Z80InstructionWithOneOperand>(
      instrType: Z80Node["type"]
    ): T | null {
      return {
        type: instrType,
        operand: parser.getOperand()
      } as unknown as T;
    }

    function twoOperands<T extends Z80InstructionWithTwoOperands>(
      instrType: Z80Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      parser.expectToken(Z80Tokens.Comma, "Z0003");
      const operand2 = parser.getOperand();
      return {
        type: instrType,
        operand1,
        operand2
      } as unknown as T;
    }

    function oneOrTwoOperands<T extends Z80InstructionWithOneOrTwoOperands>(
      instrType: Z80Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      let operand2: Operand<Z80Node, Z80TokenType> | undefined = undefined;
      if (parser.skipToken(Z80Tokens.Comma)) {
        operand2 = parser.getOperand();
      }
      return {
        type: instrType,
        operand1,
        operand2
      } as unknown as T;
    }

    function twoOrThreeOperands<T extends Z80InstructionWithTwoOrThreeOperands>(
      instrType: Z80Node["type"]
    ): T | null {
      const operand1 = parser.getOperand();
      parser.expectToken(Z80Tokens.Comma, "Z0003");
      const operand2 = parser.getOperand();
      let operand3: Operand<Z80Node, Z80TokenType> | undefined = undefined;
      if (parser.skipToken(Z80Tokens.Comma)) {
        operand3 = parser.getOperand();
      }
      return {
        type: instrType,
        operand1,
        operand2,
        operand3
      } as unknown as T;
    }

    function expectDeAndB(mnemonic: string): SimpleZ80Instruction {
      parser.expectToken(Z80Tokens.DE, "Z0103");
      parser.expectToken(Z80Tokens.Comma, "Z0003");
      parser.expectToken(Z80Tokens.B, "Z0102");
      return <SimpleZ80Instruction>{
        type: "SimpleZ80Instruction",
        mnemonic
      };
    }
  }

  /**
   * Parses an operand
   */
  protected parseOperand(): Operand<Z80Node, Z80TokenType> | null {
    const { start, traits } = this.getParsePoint();
    const startToken = this.tokens.peek();
    // --- Check registers
    if (traits.reg) {
      // --- We have a register operand
      this.tokens.get();
      const register = start.text.toLowerCase();
      let operandType = OperandType.NoneArg;
      if (traits.reg8) {
        operandType = OperandType.Reg8;
      } else if (traits.reg8Spec) {
        operandType = OperandType.Reg8Spec;
      } else if (traits.reg8Idx) {
        operandType = OperandType.Reg8Idx;
      } else if (traits.reg16) {
        operandType = OperandType.Reg16;
      } else if (traits.reg16Idx) {
        operandType = OperandType.Reg16Idx;
      } else if (traits.reg16Spec) {
        operandType = OperandType.Reg16Spec;
      }
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType,
        register,
        startToken
      };
    }

    // --- Check LREG
    if (start.type === Z80Tokens.LReg) {
      this.tokens.get();
      this.expectToken(CommonTokens.LPar, "Z0004");
      const reg = this.tokens.peek();
      if (reg.type === CommonTokens.LDBrac) {
        // --- Handle macro parameters
        this.parseMacroParam();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.NoneArg,
          startToken
        };
      }
      let register: string | undefined;
      let operandType = OperandType.Reg8Idx;
      switch (reg.text) {
        case "bc":
        case "de":
        case "hl":
          register = reg.text[1];
          operandType = OperandType.Reg8;
          break;
        case "ix":
          register = "xl";
          break;
        case "iy":
          register = "yl";
          break;
        default:
          this.reportError("Z0109");
          return null;
      }
      this.tokens.get();
      this.expectToken(CommonTokens.RPar, "Z0005");
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType,
        register,
        startToken
      };
    }

    // --- Check HREG
    if (start.type === Z80Tokens.HReg) {
      this.tokens.get();
      this.expectToken(Z80Tokens.LPar, "Z0004");
      const reg = this.tokens.peek();
      if (reg.type === Z80Tokens.LDBrac) {
        // --- Handle macro parameters
        this.parseMacroParam();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.NoneArg,
          startToken
        };
      }
      let register: string | undefined;
      let operandType = OperandType.Reg8Idx;
      switch (reg.text) {
        case "bc":
        case "de":
        case "hl":
          register = reg.text[0];
          operandType = OperandType.Reg8;
          break;
        case "ix":
          register = "xh";
          break;
        case "iy":
          register = "yh";
          break;
        default:
          this.reportError("Z0109");
          return null;
      }
      this.tokens.get();
      this.expectToken(CommonTokens.RPar, "Z0005");
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType,
        register,
        startToken
      };
    }

    // --- Check NONEARG
    if (start.type === CommonTokens.NoneArg) {
      this.tokens.get();
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType: OperandType.NoneArg,
        startToken
      };
    }

    // --- Check for "("
    if (start.type === CommonTokens.LPar) {
      const ahead = this.tokens.ahead(1);
      const traits = this.getTokenTraits(ahead.type);
      if (ahead.type === Z80Tokens.C) {
        // C port
        this.tokens.get();
        this.tokens.get();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.CPort,
          startToken
        };
      }
      if (traits.reg16) {
        // 16-bit register indirection
        this.tokens.get();
        this.tokens.get();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.RegIndirect,
          register: ahead.text.toLowerCase(),
          startToken
        };
      }
      if (traits.reg16Idx) {
        // 16-bit index register indirection
        this.tokens.get();
        this.tokens.get();
        let expr: Expression<Z80Node, Z80TokenType> | undefined = undefined;
        const register = ahead.text.toLowerCase();
        let sign = this.tokens.peek();
        let offsetSign =
          sign.type === CommonTokens.Plus || sign.type === CommonTokens.Minus
            ? sign.text
            : undefined;
        if (offsetSign) {
          this.tokens.get();
          expr = this.getExpression();
          sign = this.tokens.peek();
        }
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.IndexedIndirect,
          register,
          offsetSign,
          expr,
          startToken
        };
      }
      if (traits.expressionStart) {
        // Memory indirection
        this.tokens.get();
        const expr = this.getExpression();
        this.expectToken(CommonTokens.RPar, "Z0005");
        return <Operand<Z80Node, Z80TokenType>>{
          type: "Operand",
          operandType: OperandType.MemIndirect,
          expr,
          startToken
        };
      }
    }

    // --- Check for a condition
    if (traits.condition) {
      this.tokens.get();
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType: OperandType.Condition,
        register: start.text,
        startToken
      };
    }

    // --- Check for an expression
    if (traits.expressionStart) {
      // Expression
      return <Operand<Z80Node, Z80TokenType>>{
        type: "Operand",
        operandType: OperandType.Expression,
        expr: this.getExpression(),
        startToken
      };
    }

    // --- It's not an operand
    return null;
  }

  /**
   * Gets a mandatory operand
   */
  private getOperand(): Operand<Z80Node, Z80TokenType> | null {
    const operand = this.parseOperand();
    if (operand) {
      return operand;
    }
    this.reportError("Z0113");
    return null;
  }
}
