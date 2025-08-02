import { InputStream } from "../compiler-common/input-stream";
import { commonResolverHash, CommonTokens } from "@main/compiler-common/common-tokens";
import { CommonTokenStream } from "@main/compiler-common/common-token-stream";

/**
 * This class implements the tokenizer (lexer) of the assembler
 */
export class M6510TokenStream extends CommonTokenStream<M6510TokenType> {
  /**
   * Initializes the tokenizer with the input stream
   * @param input Input source code stream
   */
  constructor(public readonly input: InputStream) {
    super(input);
  }

  /**
   * Gets the resolver hash for the current token stream
   */
  getResolverHash(): Record<string, number> {
    return resolverHash;
  }

  /**
   * Gets the escape characters for the current token stream
   */
  get escapeChars(): string[] {
    return [
      "n", // New line
      "s", // Safty space
      "R", // Reverse on
      "r" // Reverse off
    ];
  }
}

/**
 * This enumeration defines the token types
 */
export const M6510Tokens = {
  ...CommonTokens,

  // --- Registers
  X: 1000,
  Y: 1001,

  // --- Operations
  BRK: 1100,
  ORA: 1101,
  JAM: 1102,
  SLO: 1103,
  DOP: 1104,
  ASL: 1105,
  PHP: 1106,
  AAC: 1107,
  TOP: 1108,
  BPL: 1109,
  CLC: 1110,
  JSR: 1111,
  AND: 1112,
  RLA: 1113,
  BIT: 1114,
  ROL: 1115,
  PLP: 1116,
  BMI: 1117,
  SEC: 1118,
  RTI: 1119,
  EOR: 1120,
  SRE: 1121,
  LSR: 1122,
  PHA: 1123,
  ASR: 1124,
  JMP: 1125,
  BVC: 1126,
  CLI: 1127,
  RTS: 1128,
  ADC: 1129,
  RRA: 1130,
  ROR: 1131,
  PLA: 1132,
  ARR: 1133,
  BVS: 1134,
  SEI: 1135,
  STA: 1136,
  SAX: 1137,
  STY: 1138,
  STX: 1139,
  DEY: 1140,
  TXA: 1141,
  XAA: 1142,
  BCC: 1143,
  AXA: 1144,
  TYA: 1145,
  TXS: 1146,
  SXA: 1147,
  LDY: 1148,
  LDA: 1149,
  LDX: 1150,
  LAX: 1151,
  TAY: 1152,
  TAX: 1153,
  ATX: 1154,
  BCS: 1155,
  CLV: 1156,
  TSX: 1157,
  LAR: 1158,
  CPY: 1159,
  CMP: 1160,
  DCP: 1161,
  DEC: 1162,
  INY: 1163,
  DEX: 1164,
  AXS: 1165,
  BNE: 1166,
  CLD: 1167,
  CPX: 1168,
  SBC: 1169,
  ISC: 1170,
  INX: 1171,
  NOP: 1172,
  BEQ: 1173,
  SED: 1174,
  XAS: 1175,
  KIL: 1176,
  HLT: 1177,

  // --- Parse-time functions
  IsRegX: 1200,
  IsRegY: 1201
};

export type M6510TokenType = (typeof M6510Tokens)[keyof typeof M6510Tokens];

// A hash of keyword-like tokens starting with a dot
const resolverHash: Record<string, M6510TokenType> = {
  ...commonResolverHash,

  // --- Registers
  x: M6510Tokens.X,
  X: M6510Tokens.X,
  y: M6510Tokens.Y,
  Y: M6510Tokens.Y,

  // --- Operations
  brk: M6510Tokens.BRK,
  BRK: M6510Tokens.BRK,
  ora: M6510Tokens.ORA,
  ORA: M6510Tokens.ORA,
  jam: M6510Tokens.JAM,
  JAM: M6510Tokens.JAM,
  slo: M6510Tokens.SLO,
  SLO: M6510Tokens.SLO,
  dop: M6510Tokens.DOP,
  DOP: M6510Tokens.DOP,
  asl: M6510Tokens.ASL,
  ASL: M6510Tokens.ASL,
  php: M6510Tokens.PHP,
  PHP: M6510Tokens.PHP,
  aac: M6510Tokens.AAC,
  AAC: M6510Tokens.AAC,
  top: M6510Tokens.TOP,
  TOP: M6510Tokens.TOP,
  bpl: M6510Tokens.BPL,
  BPL: M6510Tokens.BPL,
  clc: M6510Tokens.CLC,
  CLC: M6510Tokens.CLC,
  jsr: M6510Tokens.JSR,
  JSR: M6510Tokens.JSR,
  and: M6510Tokens.AND,
  AND: M6510Tokens.AND,
  rla: M6510Tokens.RLA,
  RLA: M6510Tokens.RLA,
  bit: M6510Tokens.BIT,
  BIT: M6510Tokens.BIT,
  rol: M6510Tokens.ROL,
  ROL: M6510Tokens.ROL,
  plp: M6510Tokens.PLP,
  PLP: M6510Tokens.PLP,
  bmi: M6510Tokens.BMI,
  BMI: M6510Tokens.BMI,
  sec: M6510Tokens.SEC,
  SEC: M6510Tokens.SEC,
  rti: M6510Tokens.RTI,
  RTI: M6510Tokens.RTI,
  eor: M6510Tokens.EOR,
  EOR: M6510Tokens.EOR,
  sre: M6510Tokens.SRE,
  SRE: M6510Tokens.SRE,
  lsr: M6510Tokens.LSR,
  LSR: M6510Tokens.LSR,
  pha: M6510Tokens.PHA,
  PHA: M6510Tokens.PHA,
  asr: M6510Tokens.ASR,
  ASR: M6510Tokens.ASR,
  jmp: M6510Tokens.JMP,
  JMP: M6510Tokens.JMP,
  bvc: M6510Tokens.BVC,
  BVC: M6510Tokens.BVC,
  cli: M6510Tokens.CLI,
  CLI: M6510Tokens.CLI,
  rts: M6510Tokens.RTS,
  RTS: M6510Tokens.RTS,
  adc: M6510Tokens.ADC,
  ADC: M6510Tokens.ADC,
  rra: M6510Tokens.RRA,
  RRA: M6510Tokens.RRA,
  ror: M6510Tokens.ROR,
  ROR: M6510Tokens.ROR,
  pla: M6510Tokens.PLA,
  PLA: M6510Tokens.PLA,
  arr: M6510Tokens.ARR,
  ARR: M6510Tokens.ARR,
  bvs: M6510Tokens.BVS,
  BVS: M6510Tokens.BVS,
  sei: M6510Tokens.SEI,
  SEI: M6510Tokens.SEI,
  sta: M6510Tokens.STA,
  STA: M6510Tokens.STA,
  sax: M6510Tokens.SAX,
  SAX: M6510Tokens.SAX,
  sty: M6510Tokens.STY,
  STY: M6510Tokens.STY,
  stx: M6510Tokens.STX,
  STX: M6510Tokens.STX,
  dey: M6510Tokens.DEY,
  DEY: M6510Tokens.DEY,
  txa: M6510Tokens.TXA,
  TXA: M6510Tokens.TXA,
  xaa: M6510Tokens.XAA,
  XAA: M6510Tokens.XAA,
  bcc: M6510Tokens.BCC,
  BCC: M6510Tokens.BCC,
  axa: M6510Tokens.AXA,
  AXA: M6510Tokens.AXA,
  tya: M6510Tokens.TYA,
  TYA: M6510Tokens.TYA,
  txs: M6510Tokens.TXS,
  TXS: M6510Tokens.TXS,
  sxa: M6510Tokens.SXA,
  SXA: M6510Tokens.SXA,
  ldy: M6510Tokens.LDY,
  LDY: M6510Tokens.LDY,
  lda: M6510Tokens.LDA,
  LDA: M6510Tokens.LDA,
  ldx: M6510Tokens.LDX,
  LDX: M6510Tokens.LDX,
  lax: M6510Tokens.LAX,
  LAX: M6510Tokens.LAX,
  tay: M6510Tokens.TAY,
  TAY: M6510Tokens.TAY,
  tax: M6510Tokens.TAX,
  TAX: M6510Tokens.TAX,
  atx: M6510Tokens.ATX,
  ATX: M6510Tokens.ATX,
  bcs: M6510Tokens.BCS,
  BCS: M6510Tokens.BCS,
  clv: M6510Tokens.CLV,
  CLV: M6510Tokens.CLV,
  tsx: M6510Tokens.TSX,
  TSX: M6510Tokens.TSX,
  lar: M6510Tokens.LAR,
  LAR: M6510Tokens.LAR,
  cpy: M6510Tokens.CPY,
  CPY: M6510Tokens.CPY,
  cmp: M6510Tokens.CMP,
  CMP: M6510Tokens.CMP,
  dcp: M6510Tokens.DCP,
  DCP: M6510Tokens.DCP,
  dec: M6510Tokens.DEC,
  DEC: M6510Tokens.DEC,
  iny: M6510Tokens.INY,
  INY: M6510Tokens.INY,
  dex: M6510Tokens.DEX,
  DEX: M6510Tokens.DEX,
  axs: M6510Tokens.AXS,
  AXS: M6510Tokens.AXS,
  bne: M6510Tokens.BNE,
  BNE: M6510Tokens.BNE,
  cld: M6510Tokens.CLD,
  CLD: M6510Tokens.CLD,
  cpx: M6510Tokens.CPX,
  CPX: M6510Tokens.CPX,
  sbc: M6510Tokens.SBC,
  SBC: M6510Tokens.SBC,
  isc: M6510Tokens.ISC,
  ISC: M6510Tokens.ISC,
  inx: M6510Tokens.INX,
  INX: M6510Tokens.INX,
  nop: M6510Tokens.NOP,
  NOP: M6510Tokens.NOP,
  beq: M6510Tokens.BEQ,
  BEQ: M6510Tokens.BEQ,
  sed: M6510Tokens.SED,
  SED: M6510Tokens.SED,
  xas: M6510Tokens.XAS,
  XAS: M6510Tokens.XAS,
  kil: M6510Tokens.KIL,
  KIL: M6510Tokens.KIL,
  hlt: M6510Tokens.HLT,
  HLT: M6510Tokens.HLT,

  // --- Parse-time functions
  isregx: M6510Tokens.IsRegX,
  ISREGX: M6510Tokens.IsRegX,
  isregy: M6510Tokens.IsRegY,
  ISREGY: M6510Tokens.IsRegY
};
