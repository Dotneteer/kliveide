import type { IExpressionValue } from "@main/compiler-common/abstractions";
import { ExpressionValue } from "@main/compiler-common/expressions";
import type { MacroTimeFunctionInvocation, Operand } from "@main/compiler-common/tree-nodes";
import { OperandType } from "./assembler-tree-nodes";

/**
 * The Z80 macro-time functions that test an operand's kind (`isreg8(a)`, `isindexedaddr((ix+2))`, ...)
 */
const operandKindTests: Record<string, OperandType[]> = {
  isreg8: [OperandType.Reg8, OperandType.Reg8Spec, OperandType.Reg8Idx],
  isreg8std: [OperandType.Reg8],
  isreg8spec: [OperandType.Reg8Spec],
  isreg8idx: [OperandType.Reg8Idx],
  isreg16: [OperandType.Reg16, OperandType.Reg16Spec, OperandType.Reg16Idx],
  isreg16std: [OperandType.Reg16],
  isreg16idx: [OperandType.Reg16Idx],
  isregindirect: [OperandType.RegIndirect],
  isindexedaddr: [OperandType.IndexedIndirect],
  iscport: [OperandType.CPort]
};

/**
 * The Z80 macro-time functions that test for one register (`isrega(a)`, `isreghl(hl)`, ...)
 */
const registerTests: Record<string, string> = {
  isrega: "a",
  isregaf: "af",
  isregb: "b",
  isregc: "c",
  isregbc: "bc",
  isregd: "d",
  isrege: "e",
  isregde: "de",
  isregh: "h",
  isregl: "l",
  isreghl: "hl",
  isregi: "i",
  isregr: "r",
  isregsp: "sp",
  isregix: "ix",
  isregiy: "iy"
};

/**
 * The index-register halves: `xh` matches `xh` and `ixh` (the operand keeps the source's spelling)
 */
const indexHalfTests: Record<string, string> = {
  isregxh: "xh",
  isregxl: "xl",
  isregyh: "yh",
  isregyl: "yl"
};

/**
 * Evaluates a Z80 macro-time function on a macro argument
 * @param funcExpr The function invocation
 * @returns The function's value, or undefined when it is not a Z80 macro-time function
 */
export function evalZ80MacroTimeFunction(
  funcExpr: MacroTimeFunctionInvocation<any, any>
): IExpressionValue | undefined {
  const name = funcExpr.functionName.toLowerCase();
  const operand = funcExpr.operand as Operand<any, any> | undefined;
  const register = operand?.register ?? "";

  const kinds = operandKindTests[name];
  if (kinds) {
    return new ExpressionValue(!!operand && kinds.includes(operand.operandType));
  }
  if (name === "iscondition") {
    // --- `c` is both a register and a condition
    return new ExpressionValue(
      !!operand && (operand.operandType === OperandType.Condition || register === "c")
    );
  }
  const reg = registerTests[name];
  if (reg) {
    return new ExpressionValue(!!operand && register === reg);
  }
  const half = indexHalfTests[name];
  if (half) {
    return new ExpressionValue(!!operand && register.indexOf(half) >= 0);
  }
  return undefined;
}
