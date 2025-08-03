import { commonTokenTraits, TokenTraits } from "@main/compiler-common/common-tokens";
import { M6510Tokens, M6510TokenType } from "./m6510-token-stream";

/**
 * This map contains the traits of token types

*/
export const m6510TokenTraits = new Map<M6510TokenType, TokenTraits>(commonTokenTraits);


// ----------------------------------------------------------------------------
// A
m6510TokenTraits.set(M6510Tokens.AAC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ADC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.AND, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ARR, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ASL, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ASR, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ATX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.AXA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.AXS, { instruction: true });

// ----------------------------------------------------------------------------
// B
m6510TokenTraits.set(M6510Tokens.BCC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BCS, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BEQ, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BIT, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BMI, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BNE, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BPL, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BRK, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.BVC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.BVS, { instruction: true });

// ----------------------------------------------------------------------------
// C
m6510TokenTraits.set(M6510Tokens.CLC, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.CLD, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.CLI, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.CLV, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.CMP, { instruction: true });
m6510TokenTraits.set(M6510Tokens.CPX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.CPY, { instruction: true });

// ----------------------------------------------------------------------------
// D
m6510TokenTraits.set(M6510Tokens.DCP, { instruction: true });
m6510TokenTraits.set(M6510Tokens.DEC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.DEX, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.DEY, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.DOP, { instruction: true });

// ----------------------------------------------------------------------------
// E
m6510TokenTraits.set(M6510Tokens.EOR, { instruction: true });

// ----------------------------------------------------------------------------
// H
m6510TokenTraits.set(M6510Tokens.HLT, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// I

m6510TokenTraits.set(M6510Tokens.INC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.INX, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.INY, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.ISC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.IsRegX, {
  expressionStart: true,
  macroTimeFunction: true
});
m6510TokenTraits.set(M6510Tokens.IsRegY, {
  expressionStart: true,
  macroTimeFunction: true
});

// ----------------------------------------------------------------------------
// J
m6510TokenTraits.set(M6510Tokens.JAM, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.JMP, { instruction: true });
m6510TokenTraits.set(M6510Tokens.JSR, { instruction: true });

// ----------------------------------------------------------------------------
// L
m6510TokenTraits.set(M6510Tokens.KIL, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// L
m6510TokenTraits.set(M6510Tokens.LAR, { instruction: true });
m6510TokenTraits.set(M6510Tokens.LAX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.LDA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.LDX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.LDY, { instruction: true });
m6510TokenTraits.set(M6510Tokens.LSR, { instruction: true });

// ----------------------------------------------------------------------------
// M

// ----------------------------------------------------------------------------
// N
m6510TokenTraits.set(M6510Tokens.NOP, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// O
m6510TokenTraits.set(M6510Tokens.ORA, { instruction: true });

// ----------------------------------------------------------------------------
// P
m6510TokenTraits.set(M6510Tokens.PHA, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.PHP, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.PLA, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.PLP, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// R
m6510TokenTraits.set(M6510Tokens.RLA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ROL, { instruction: true });
m6510TokenTraits.set(M6510Tokens.ROR, { instruction: true });
m6510TokenTraits.set(M6510Tokens.RRA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.RTI, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.RTS, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// S
m6510TokenTraits.set(M6510Tokens.SAX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.SBC, { instruction: true });
m6510TokenTraits.set(M6510Tokens.SEC, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.SED, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.SEI, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.SLO, { instruction: true });
m6510TokenTraits.set(M6510Tokens.SRE, { instruction: true });
m6510TokenTraits.set(M6510Tokens.STA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.STX, { instruction: true });
m6510TokenTraits.set(M6510Tokens.STY, { instruction: true });
m6510TokenTraits.set(M6510Tokens.SXA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.SYA, { instruction: true });

// ----------------------------------------------------------------------------
// T
m6510TokenTraits.set(M6510Tokens.TAX, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.TAY, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.TOP, { instruction: true });
m6510TokenTraits.set(M6510Tokens.TSX, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.TXA, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.TXS, { instruction: true, simple: true });
m6510TokenTraits.set(M6510Tokens.TYA, { instruction: true, simple: true });

// ----------------------------------------------------------------------------
// X
m6510TokenTraits.set(M6510Tokens.X, { reg: true });
m6510TokenTraits.set(M6510Tokens.XAA, { instruction: true });
m6510TokenTraits.set(M6510Tokens.XAS, { instruction: true });

// ----------------------------------------------------------------------------
// Y
m6510TokenTraits.set(M6510Tokens.Y, { reg: true });

// ----------------------------------------------------------------------------
// Z
