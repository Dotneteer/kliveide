import { commonTokenTraits, TokenTraits } from "@main/compiler-common/common-tokens";
import { Z80TokenType, Z80Tokens } from "./token-stream";

/**
 * Gets the traits of the specified token type
 * @param type Token type
 */
export function getTokenTraits (type: Z80TokenType): TokenTraits {
  return tokenTraits.get(type) ?? {};
}

/**
 * This map contains the traits of token types
 */
const tokenTraits = new Map<Z80TokenType, TokenTraits>(commonTokenTraits);


// ----------------------------------------------------------------------------
// A
tokenTraits.set(Z80Tokens.A, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.AF, { reg: true, reg16Spec: true });
tokenTraits.set(Z80Tokens.AF_, { reg: true, reg16Spec: true });
tokenTraits.set(Z80Tokens.Adc, { instruction: true });
tokenTraits.set(Z80Tokens.Add, { instruction: true });
tokenTraits.set(Z80Tokens.And, { instruction: true });

// ----------------------------------------------------------------------------
// B
tokenTraits.set(Z80Tokens.B, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.BC, { reg: true, reg16: true });
tokenTraits.set(Z80Tokens.Bit, { instruction: true });
tokenTraits.set(Z80Tokens.Brlc, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Bsla, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Bsra, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Bsrf, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Bsrl, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// C
tokenTraits.set(Z80Tokens.C, {
  reg: true,
  reg8: true,
  condition: true,
  relCondition: true
});
tokenTraits.set(Z80Tokens.Call, { instruction: true });
tokenTraits.set(Z80Tokens.Ccf, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Cp, { instruction: true });
tokenTraits.set(Z80Tokens.Cpd, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Cpdr, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Cpi, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Cpir, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Cpl, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// D
tokenTraits.set(Z80Tokens.D, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.DE, { reg: true, reg16: true });
tokenTraits.set(Z80Tokens.Daa, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Dec, { instruction: true });
tokenTraits.set(Z80Tokens.Di, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Djnz, { instruction: true });

// ----------------------------------------------------------------------------
// E
tokenTraits.set(Z80Tokens.E, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.Ei, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Ex, { instruction: true });
tokenTraits.set(Z80Tokens.Exx, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// H
tokenTraits.set(Z80Tokens.H, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.HL, { reg: true, reg16: true });
tokenTraits.set(Z80Tokens.HReg, {
  expressionStart: true
});
tokenTraits.set(Z80Tokens.Halt, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// H
tokenTraits.set(Z80Tokens.I, { reg: true, reg8Spec: true });
tokenTraits.set(Z80Tokens.IX, { reg: true, reg16Idx: true });
tokenTraits.set(Z80Tokens.IY, { reg: true, reg16Idx: true });
tokenTraits.set(Z80Tokens.Im, { instruction: true });
tokenTraits.set(Z80Tokens.In, { instruction: true });
tokenTraits.set(Z80Tokens.Inc, { instruction: true });
tokenTraits.set(Z80Tokens.Ind, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Indr, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Ini, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Inir, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.IsCPort, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsCondition, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsExpr, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg16, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg16Idx, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg16Std, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg8, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg8Idx, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg8Spec, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsReg8Std, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegIndirect, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegA, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegAf, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegB, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegC, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegBc, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegD, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegE, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegDe, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegH, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegL, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegHl, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegI, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegR, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegXh, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegXl, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegIx, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegYh, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegYl, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegIy, {
  expressionStart: true,
  macroTimeFunction: true
});
tokenTraits.set(Z80Tokens.IsRegSp, {
  expressionStart: true,
  macroTimeFunction: true
});

// ----------------------------------------------------------------------------
// J
tokenTraits.set(Z80Tokens.Jp, { instruction: true });
tokenTraits.set(Z80Tokens.Jr, { instruction: true });

// ----------------------------------------------------------------------------
// L
tokenTraits.set(Z80Tokens.L, { reg: true, reg8: true });
tokenTraits.set(Z80Tokens.LReg, {
  expressionStart: true
});
tokenTraits.set(Z80Tokens.Ld, { instruction: true });
tokenTraits.set(Z80Tokens.Ldd, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Lddr, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Lddrx, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Lddx, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Ldi, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Ldir, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Ldirx, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Ldix, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Ldpirx, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Ldws, {
  instruction: true,
  simple: true,
  next: true
});

// ----------------------------------------------------------------------------
// M
tokenTraits.set(Z80Tokens.M, { condition: true });
tokenTraits.set(Z80Tokens.Mirror, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Mul, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// N
tokenTraits.set(Z80Tokens.NC, { condition: true, relCondition: true });
tokenTraits.set(Z80Tokens.NZ, { condition: true, relCondition: true });
tokenTraits.set(Z80Tokens.Neg, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.NextReg, { instruction: true, next: true });
tokenTraits.set(Z80Tokens.Nop, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// O
tokenTraits.set(Z80Tokens.Or, { instruction: true });
tokenTraits.set(Z80Tokens.Otdr, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Otir, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Out, { instruction: true });
tokenTraits.set(Z80Tokens.OutInB, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Outd, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Outi, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// P
tokenTraits.set(Z80Tokens.P, { condition: true });
tokenTraits.set(Z80Tokens.PE, { condition: true });
tokenTraits.set(Z80Tokens.PO, { condition: true });
tokenTraits.set(Z80Tokens.PixelAd, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.PixelDn, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Pop, { instruction: true });
tokenTraits.set(Z80Tokens.Push, { instruction: true });

// ----------------------------------------------------------------------------
// R
tokenTraits.set(Z80Tokens.R, { reg: true, reg8Spec: true });
tokenTraits.set(Z80Tokens.Res, { instruction: true });
tokenTraits.set(Z80Tokens.Ret, { instruction: true });
tokenTraits.set(Z80Tokens.Reti, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Retn, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rl, { instruction: true });
tokenTraits.set(Z80Tokens.Rla, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rlc, { instruction: true });
tokenTraits.set(Z80Tokens.Rlca, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rld, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rr, { instruction: true });
tokenTraits.set(Z80Tokens.Rra, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rrc, { instruction: true });
tokenTraits.set(Z80Tokens.Rrca, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rrd, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Rst, { instruction: true });

// ----------------------------------------------------------------------------
// S
tokenTraits.set(Z80Tokens.SP, { reg: true, reg16: true });
tokenTraits.set(Z80Tokens.Sbc, { instruction: true });
tokenTraits.set(Z80Tokens.Scf, { instruction: true, simple: true });
tokenTraits.set(Z80Tokens.Set, { instruction: true });
tokenTraits.set(Z80Tokens.SetAE, {
  instruction: true,
  simple: true,
  next: true
});
tokenTraits.set(Z80Tokens.Sla, { instruction: true });
tokenTraits.set(Z80Tokens.Sll, { instruction: true });
tokenTraits.set(Z80Tokens.Sra, { instruction: true });
tokenTraits.set(Z80Tokens.Srl, { instruction: true });
tokenTraits.set(Z80Tokens.Sub, { instruction: true });
tokenTraits.set(Z80Tokens.Swapnib, {
  instruction: true,
  simple: true,
  next: true
});

// ----------------------------------------------------------------------------
// T
tokenTraits.set(Z80Tokens.Test, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// X
tokenTraits.set(Z80Tokens.XH, { reg: true, reg8Idx: true });
tokenTraits.set(Z80Tokens.XL, { reg: true, reg8Idx: true });
tokenTraits.set(Z80Tokens.Xor, { instruction: true });

// ----------------------------------------------------------------------------
// Y
tokenTraits.set(Z80Tokens.YH, { reg: true, reg8Idx: true });
tokenTraits.set(Z80Tokens.YL, { reg: true, reg8Idx: true });

// ----------------------------------------------------------------------------
// Z
tokenTraits.set(Z80Tokens.Z, { condition: true, relCondition: true });
