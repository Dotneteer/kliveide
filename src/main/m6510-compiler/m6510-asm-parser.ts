import { CommonTokens, CommonTokenType, TokenTraits } from "../compiler-common/common-tokens";
import { CommonAsmParser, ParsePoint } from "../compiler-common/common-asm-parser";
import { Operand, OperandType, PartialAssemblyLine } from "../compiler-common/tree-nodes";
import { M6510Tokens, M6510TokenStream, M6510TokenType } from "./m6510-token-stream";
import { M6510Node, SimpleM6510Instruction } from "./assembler-tree-nodes";
import { m6510TokenTraits } from "./m6510-token-traits";

/**
 * This class implements the M6510 assembly parser
 */
export class M6510AsmParser extends CommonAsmParser<M6510Node, M6510TokenType> {
  /**
   * Initializes the parser with the specified token stream
   * @param tokens Token stream of the source code
   * @param fileIndex Optional file index of the file being parsed
   */
  constructor(tokens: M6510TokenStream, fileIndex = 0, macroEmitPhase = false) {
    super(tokens, fileIndex, macroEmitPhase);
  }

  protected getTokenTraits(type: CommonTokenType): TokenTraits {
    return m6510TokenTraits.get(type) ?? {};
  }

  /**
   * Converts an escaped string to its unescaped form
   * @param inp String to convert
   */
  protected convertEscapedString(inp: string): string {
    return inp;
  }

  /**
   * instruction
   *   : simpleInstruction
   *   | compoundInstruction
   *   ;
   */
  parseInstruction(parsePoint: ParsePoint): PartialAssemblyLine<M6510Node> | null {
    const { traits } = parsePoint;
    return traits.simple
      ? this.parseSimpleInstruction(parsePoint)
      : this.parseCompoundInstruction(parsePoint);
  }

  /**
   * simpleInstruction
   *   : BRK
   *   | CLC
   *   | CLD
   *   | CLI
   *   | CLV
   *   | DEX
   *   | DEY
   *   | HLT
   *   | INX
   *   | INY
   *   | JAM
   *   | KIL
   *   | NOP
   *   | PHA
   *   | PHP
   *   | PLA
   *   | PLP
   *   | RTI
   *   | RTS
   *   | SEC
   *   | SED
   *   | SEI
   *   | TAX
   *   | TAY
   *   | TSX
   *   | TXA
   *   | TXS
   *   | TYA
   *   ;
   */
  private parseSimpleInstruction(parsePoint: ParsePoint): SimpleM6510Instruction | null {
    this.tokens.get();
    return {
      type: "SimpleM6510Instruction",
      mnemonic: parsePoint.start.text.toUpperCase()
    };
  }

  /**
   *
   * @param parsePoint
   */
  private parseCompoundInstruction(parsePoint: ParsePoint): PartialAssemblyLine<M6510Node> | null {
    const { start, traits } = parsePoint;
    if (!traits.instruction) {
      return null;
    }
    const mnemonic = start.text.toUpperCase();
    this.tokens.get(); // Consume the mnemonic token
    return {
      start,
      type: "CompoundM6510Instruction",
      mnemonic,
      operand: this.getOperand()
    } as PartialAssemblyLine<M6510Node>;
  }

  /**
   * Parses an operand
   */
  protected parseOperand(): Operand<M6510Node, M6510TokenType> | null {
    const { start, traits } = this.getParsePoint();
    if (start.type === M6510Tokens.A) {
      // --- A register
      this.tokens.get(); // Consume the A token
      return {
        type: "Operand",
        operandType: OperandType.Reg8,
        register: "a",
        startToken: start
      };
    }
    if (start.type === CommonTokens.Hashmark) {
      // --- Hashed hexadecimal number
      this.tokens.get();
      return {
        type: "Operand",
        operandType: OperandType.Immediate,
        expr: this.getExpression(),
        startToken: start
      };
    } else if (start.type === CommonTokens.LPar) {
      // --- Inidrect addressing
      this.tokens.get(); // Consume the left parenthesis
      const expr = this.getExpression();
      const nextToken = this.tokens.peek();
      if (nextToken.type === CommonTokens.RPar) {
        // --- Simple indirect addressing
        this.tokens.get(); // Consume the right parenthesis
        if (this.tokens.peek().type === CommonTokens.Comma) {
          this.tokens.get(); // Consume the comma
          this.expectToken(M6510Tokens.Y);
          return {
            type: "Operand",
            operandType: OperandType.IndexedIndirect,
            expr,
            register: "y",
            startToken: start
          };
        } else {
          return {
            type: "Operand",
            operandType: OperandType.IndexedIndirect,
            expr,
            register: "",
            startToken: start
          };
        }
      } else if (nextToken.type === CommonTokens.Comma) {
        // --- Indexed indirect addressing
        this.tokens.get(); // Consume the comma
        this.expectToken(M6510Tokens.X);
        this.expectToken(CommonTokens.RPar);
        return {
          type: "Operand",
          operandType: OperandType.IndexedIndirect,
          expr,
          register: "x",
          startToken: start
        };
      }
    } else if (traits.expressionStart) {
      const expr = this.getExpression();
      if (this.tokens.peek().type === CommonTokens.Comma) {
        // --- May be it's indexed with X or Y
        this.tokens.get(); // Consume the comma
        const nextToken = this.tokens.peek();
        if (nextToken.type === M6510Tokens.X || nextToken.type === M6510Tokens.Y) {
          this.tokens.get(); // Consume the index register token
          return {
            type: "Operand",
            operandType: OperandType.IndexedDirect,
            expr,
            register: nextToken.type === M6510Tokens.X ? "x" : "y",
            startToken: start
          };
        }
      }
      return {
        type: "Operand",
        operandType: OperandType.Expression,
        expr,
        startToken: start
      };
    }

    // --- It's not an operand
    return null;
  }

  /**
   * Gets a mandatory operand
   */
  private getOperand(): Operand<M6510Node, M6510TokenType> | null {
    const operand = this.parseOperand();
    if (operand) {
      return operand;
    }
    this.reportError("Z0113");
    return null;
  }
}
