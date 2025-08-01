import { commonTokenTraits, TokenTraits } from "@main/compiler-common/common-tokens";
import { Z80TokenType, Z80Tokens } from "./z80-token-stream";

/**
 * This map contains the traits of token types
 */
export const z80TokenTraits = new Map<Z80TokenType, TokenTraits>(commonTokenTraits);


// ----------------------------------------------------------------------------
// A
z80TokenTraits.set(Z80Tokens.A, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.AF, { reg: true, reg16Spec: true });
z80TokenTraits.set(Z80Tokens.AF_, { reg: true, reg16Spec: true });
z80TokenTraits.set(Z80Tokens.Adc, { instruction: true });
z80TokenTraits.set(Z80Tokens.Add, { instruction: true });
z80TokenTraits.set(Z80Tokens.And, { instruction: true });

// ----------------------------------------------------------------------------
// B
z80TokenTraits.set(Z80Tokens.B, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.BC, { reg: true, reg16: true });
z80TokenTraits.set(Z80Tokens.Bit, { instruction: true });
z80TokenTraits.set(Z80Tokens.Brlc, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Bsla, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Bsra, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Bsrf, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Bsrl, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// C
z80TokenTraits.set(Z80Tokens.C, {
  reg: true,
  reg8: true,
  condition: true,
  relCondition: true
});
z80TokenTraits.set(Z80Tokens.Call, { instruction: true });
z80TokenTraits.set(Z80Tokens.Ccf, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Cp, { instruction: true });
z80TokenTraits.set(Z80Tokens.Cpd, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Cpdr, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Cpi, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Cpir, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Cpl, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// D
z80TokenTraits.set(Z80Tokens.D, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.DE, { reg: true, reg16: true });
z80TokenTraits.set(Z80Tokens.Daa, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Dec, { instruction: true });
z80TokenTraits.set(Z80Tokens.Di, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Djnz, { instruction: true });

// ----------------------------------------------------------------------------
// E
z80TokenTraits.set(Z80Tokens.E, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.Ei, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Ex, { instruction: true });
z80TokenTraits.set(Z80Tokens.Exx, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// H
z80TokenTraits.set(Z80Tokens.H, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.HL, { reg: true, reg16: true });
z80TokenTraits.set(Z80Tokens.HReg, {
  expressionStart: true
});
z80TokenTraits.set(Z80Tokens.Halt, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// H
z80TokenTraits.set(Z80Tokens.I, { reg: true, reg8Spec: true });
z80TokenTraits.set(Z80Tokens.IX, { reg: true, reg16Idx: true });
z80TokenTraits.set(Z80Tokens.IY, { reg: true, reg16Idx: true });
z80TokenTraits.set(Z80Tokens.Im, { instruction: true });
z80TokenTraits.set(Z80Tokens.In, { instruction: true });
z80TokenTraits.set(Z80Tokens.Inc, { instruction: true });
z80TokenTraits.set(Z80Tokens.Ind, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Indr, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Ini, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Inir, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.IsCPort, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsCondition, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsExpr, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg16, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg16Idx, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg16Std, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg8, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg8Idx, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg8Spec, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsReg8Std, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegIndirect, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegA, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegAf, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegB, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegC, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegBc, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegD, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegE, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegDe, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegH, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegL, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegHl, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegI, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegR, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegXh, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegXl, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegIx, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegYh, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegYl, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegIy, {
  expressionStart: true,
  macroTimeFunction: true
});
z80TokenTraits.set(Z80Tokens.IsRegSp, {
  expressionStart: true,
  macroTimeFunction: true
});

// ----------------------------------------------------------------------------
// J
z80TokenTraits.set(Z80Tokens.Jp, { instruction: true });
z80TokenTraits.set(Z80Tokens.Jr, { instruction: true });

// ----------------------------------------------------------------------------
// L
z80TokenTraits.set(Z80Tokens.L, { reg: true, reg8: true });
z80TokenTraits.set(Z80Tokens.LReg, {
  expressionStart: true
});
z80TokenTraits.set(Z80Tokens.Ld, { instruction: true });
z80TokenTraits.set(Z80Tokens.Ldd, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Lddr, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Lddrx, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Lddx, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Ldi, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Ldir, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Ldirx, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Ldix, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Ldpirx, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Ldws, {
  instruction: true,
  simple: true,
  next: true
});

// ----------------------------------------------------------------------------
// M
z80TokenTraits.set(Z80Tokens.M, { condition: true });
z80TokenTraits.set(Z80Tokens.Mirror, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Mul, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// N
z80TokenTraits.set(Z80Tokens.NC, { condition: true, relCondition: true });
z80TokenTraits.set(Z80Tokens.NZ, { condition: true, relCondition: true });
z80TokenTraits.set(Z80Tokens.Neg, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.NextReg, { instruction: true, next: true });
z80TokenTraits.set(Z80Tokens.Nop, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// O
z80TokenTraits.set(Z80Tokens.Or, { instruction: true });
z80TokenTraits.set(Z80Tokens.Otdr, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Otir, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Out, { instruction: true });
z80TokenTraits.set(Z80Tokens.OutInB, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Outd, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Outi, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// P
z80TokenTraits.set(Z80Tokens.P, { condition: true });
z80TokenTraits.set(Z80Tokens.PE, { condition: true });
z80TokenTraits.set(Z80Tokens.PO, { condition: true });
z80TokenTraits.set(Z80Tokens.PixelAd, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.PixelDn, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Pop, { instruction: true });
z80TokenTraits.set(Z80Tokens.Push, { instruction: true });

// ----------------------------------------------------------------------------
// R
z80TokenTraits.set(Z80Tokens.R, { reg: true, reg8Spec: true });
z80TokenTraits.set(Z80Tokens.Res, { instruction: true });
z80TokenTraits.set(Z80Tokens.Ret, { instruction: true });
z80TokenTraits.set(Z80Tokens.Reti, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Retn, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rl, { instruction: true });
z80TokenTraits.set(Z80Tokens.Rla, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rlc, { instruction: true });
z80TokenTraits.set(Z80Tokens.Rlca, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rld, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rr, { instruction: true });
z80TokenTraits.set(Z80Tokens.Rra, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rrc, { instruction: true });
z80TokenTraits.set(Z80Tokens.Rrca, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rrd, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Rst, { instruction: true });

// ----------------------------------------------------------------------------
// S
z80TokenTraits.set(Z80Tokens.SP, { reg: true, reg16: true });
z80TokenTraits.set(Z80Tokens.Sbc, { instruction: true });
z80TokenTraits.set(Z80Tokens.Scf, { instruction: true, simple: true });
z80TokenTraits.set(Z80Tokens.Set, { instruction: true });
z80TokenTraits.set(Z80Tokens.SetAE, {
  instruction: true,
  simple: true,
  next: true
});
z80TokenTraits.set(Z80Tokens.Sla, { instruction: true });
z80TokenTraits.set(Z80Tokens.Sll, { instruction: true });
z80TokenTraits.set(Z80Tokens.Sra, { instruction: true });
z80TokenTraits.set(Z80Tokens.Srl, { instruction: true });
z80TokenTraits.set(Z80Tokens.Sub, { instruction: true });
z80TokenTraits.set(Z80Tokens.Swapnib, {
  instruction: true,
  simple: true,
  next: true
});

// ----------------------------------------------------------------------------
// T
z80TokenTraits.set(Z80Tokens.Test, { instruction: true, next: true });

// ----------------------------------------------------------------------------
// X
z80TokenTraits.set(Z80Tokens.XH, { reg: true, reg8Idx: true });
z80TokenTraits.set(Z80Tokens.XL, { reg: true, reg8Idx: true });
z80TokenTraits.set(Z80Tokens.Xor, { instruction: true });

// ----------------------------------------------------------------------------
// Y
z80TokenTraits.set(Z80Tokens.YH, { reg: true, reg8Idx: true });
z80TokenTraits.set(Z80Tokens.YL, { reg: true, reg8Idx: true });

// ----------------------------------------------------------------------------
// Z
z80TokenTraits.set(Z80Tokens.Z, { condition: true, relCondition: true });
