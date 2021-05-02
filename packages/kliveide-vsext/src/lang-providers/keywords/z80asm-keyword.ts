import { InputStream } from "../../z80lang/parser/input-stream";
import { TokenStream } from "../../z80lang/parser/token-stream";
import { Z80AsmParser } from "../../z80lang/parser/z80-asm-parser";
import { ImInstruction, IntegerLiteral, Operand, OperandType, RetInstruction, SimpleZ80Instruction, Z80Instruction,
  Z80InstructionWithOneOperand, Z80InstructionWithOneOrTwoOperands } from "../../z80lang/parser/tree-nodes";
import { Z80InstructionWithTwoOperands } from "../../z80lang/parser/tree-nodes";
import { Z80AssemblyLine } from "../../z80lang/parser/tree-nodes";
import * as keywords from "./z80asm-keywords.json";

export class Z80AsmKeywords {

    public static findKeyword(textLine: string): any {
        let keyword;
        let keywordRegexp: RegExp;

        // use z80 parser for get opcode and params
        const z80Parser: Z80AsmParser = new Z80AsmParser(new TokenStream(new InputStream(textLine)), 0);
        const assemblyLine: Z80AssemblyLine = z80Parser.parseAssemblyLine();

        switch (assemblyLine.type) {
            case "SimpleZ80Instruction":
                let mnemonic: string = ((assemblyLine as any) as SimpleZ80Instruction).mnemonic.toUpperCase();
                keyword = keywords.find((item) => item.keyword === mnemonic);
                break;
            default:
                let type: string = assemblyLine.type.replace("Instruction", "");
                let operandRegex: string = Z80AsmKeywords.getKeywordOperandsRegexp(assemblyLine);
                keywordRegexp = new RegExp(`${type.toUpperCase()}${operandRegex ? `\\s+${operandRegex}` : ""}`);
                keyword = keywords.find((item) => keywordRegexp.test(item.keyword));
                break;
        }

        return keyword;
    }

    private static getKeywordOperandsRegexp(instruction: Z80Instruction): string {

        if ((instruction as Z80InstructionWithOneOrTwoOperands).operand1 !== undefined) {
            let operand1: string = this.getKeywordOperand((instruction as Z80InstructionWithOneOrTwoOperands).operand1);
            let operand2: string = this.getKeywordOperand((instruction as Z80InstructionWithTwoOperands).operand2);
            return operand2 ? `${operand1}\\s*(,|\\s)\\s*${operand2}` : operand1;
        }
        else if ((instruction as Z80InstructionWithOneOperand).operand) {
            return this.getKeywordOperand((instruction as Z80InstructionWithOneOperand).operand);
        }
        else if ((instruction as ImInstruction).mode) {
            return ((instruction as ImInstruction).mode.expr as IntegerLiteral).value.toString();
        }
        else if ((instruction as RetInstruction).condition) {
            return "cc";
        }
    }

    private static getKeywordOperand(operand: Operand): string {

        let result: string;
        switch (operand && operand.operandType) {
            case OperandType.Reg8: result = "(r|r\u0027|A|C|s$|m$)"; break;
            case OperandType.Reg8Spec: result = `(${operand.register.toUpperCase()})`; break;
            case OperandType.Reg8Idx: break;
            case OperandType.Reg16: result = `(${operand.register === "hl" ? "HL|qq|ss" : `(dd|${operand.register.toUpperCase()}|qq|ss|pp|rr)`})`; break;
            case OperandType.Reg16Spec: result = `(${operand.register.toUpperCase()}|qq)`; break;
            case OperandType.Reg16Idx: result = `(${operand.register.toUpperCase()}|pp|rr)`; break;
            case OperandType.RegIndirect: result = `(\\(${operand.register.toUpperCase()}\\)|s$|m$)`; break;
            case OperandType.IndexedIndirect: result = `(\\(${operand.register.toUpperCase()}\\s*\\+\\s*d\\)|\\(${operand.register.toUpperCase()}\\)|s$|m$)`; break;
            case OperandType.MemIndirect: result = "(\\(nn\\)|\\(n\\))"; break;
            case OperandType.CPort: result = "(\\(C\\))"; break;
            case OperandType.Expression: result = "(n|s|b|e|\\(nn\\))"; break;
            case OperandType.Condition: result = `(${operand.register.toUpperCase()}|cc)`; break;
            case OperandType.NoneArg: break;

            default: ;
        }

        return result;
    }
}
