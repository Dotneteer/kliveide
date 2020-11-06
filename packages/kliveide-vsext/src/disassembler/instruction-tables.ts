/**
 * This class represents a disassembly operation map
 */
export class OperationMap {
  /**
   * Operation code
   */
  readonly opCode: number;

  /**
   * Instruction pattern
   */
  readonly instructionPattern: string | null;

  /**
   * Indicates that this instruction is a ZX Spectrum Next operation
   */
  readonly extendedSet: boolean;

  /**
   * Instruction mask
   */
  readonly mask: number | undefined;

  /**
   * Initializes a new instance
   * @param opCode Operation code
   * @param mask Operation mask
   * @param instructionPattern Instruction pattern
   * @param extendedSet Indicates a ZX Spectrum Next extended operation
   */
  constructor(
    opCode: number,
    mask: number | undefined,
    instructionPattern: string | null,
    extendedSet = false
  ) {
    this.opCode = opCode;
    this.mask = mask;
    this.instructionPattern = instructionPattern;
    this.extendedSet = extendedSet;
  }
}

/**
 * This class represents a table of instruction deconding information.
 */
export class InstructionTable {
  private readonly _simpleInstructions: Map<number, OperationMap>;
  private readonly _maskedInstructions: Map<number, OperationMap>;

  /**
   * Initializes the table with the provided instructions
   * @param instructions Instructions in the table
   */
  constructor(instructions: Array<OperationMap>) {
    this._simpleInstructions = new Map<number, OperationMap>();
    this._maskedInstructions = new Map<number, OperationMap>();
    for (const instr of instructions) {
      if (instr.mask) {
        this._maskedInstructions.set(instr.opCode, instr);
      } else {
        this._simpleInstructions.set(instr.opCode, instr);
      }
    }
  }

  /**
   * Gets the instruction decoding information for the
   * specified opcode
   * @param opCode Opcode to get the information for
   * @returns Instruction information, if found; otherwise, undefined.
   */
  getInstruction(opCode: number): OperationMap | undefined {
    const simple = this._simpleInstructions.get(opCode);
    if (simple) {
      return simple;
    }
    for (const entry of this._maskedInstructions) {
      const op = entry[1];
      if (op.mask && (opCode & op.mask) === op.opCode) {
        return op;
      }
    }
    return undefined;
  }
}

/**
 * 16-bit register pairs for the ^Q pragma
 */
export const q16Regs: string[] = ["bc", "de", "hl", "sp"];

/**
 * 16-bit register pairs for the ^R pragma
 */
export const r16Regs: string[] = ["bc", "de", "hl", "af"];

/**
 * 8-bit register pairs for the ^q pragma
 */
export const q8Regs: string[] = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];

/**
 * Disassembly keywords that cannot be used as label names or other symbols
 */
export const disasmKeywords: string[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "H",
  "L",
  "F",
  "BC",
  "DE",
  "HL",
  "AF",
  "IX",
  "IY",
  "SP",
  "IR",
  "PC",
  "NZ",
  "Z",
  "NC",
  "PO",
  "PE",
  "P",
  "M",
  "ADD",
  "ADC",
  "AND",
  "BIT",
  "CALL",
  "CCF",
  "CP",
  "CPD",
  "CPDR",
  "CPI",
  "CPIR",
  "CPL",
  "DAA",
  "DEC",
  "DI",
  "DJNZ",
  "EI",
  "EX",
  "EXX",
  "LD",
  "LDD",
  "LDDR",
  "LDI",
  "LDIR",
  "IM",
  "IN",
  "INC",
  "IND",
  "INDR",
  "INI",
  "INIR",
  "JR",
  "JP",
  "NEG",
  "OR",
  "OTDR",
  "OTIR",
  "OUT",
  "OUTI",
  "OUTD",
  "POP",
  "PUSH",
  "RES",
  "RET",
  "RETI",
  "RETN",
  "RL",
  "RLA",
  "RLCA",
  "RLC",
  "RLD",
  "RR",
  "RRA",
  "RRC",
  "RRCA",
  "RRD",
  "RST",
  "SBC",
  "SCF",
  "SET",
  "SLA",
  "SLL",
  "SRA",
  "SRL",
  "SUB",
  "XOR",
];


/**
 * Disassembly stumps for standard instrcutions
 */
export const standardStumps: string [] = [
  /* 0x00 */ "nop",
  /* 0x01 */ "ld bc,^W",
  /* 0x02 */ "ld (bc),a",
  /* 0x03 */ "inc bc",
  /* 0x04 */ "inc b",
  /* 0x05 */ "dec b",
  /* 0x06 */ "ld b,^B",
  /* 0x07 */ "rlca",
  /* 0x08 */ "ex af,af'",
  /* 0x09 */ "add hl,bc",
  /* 0x0a */ "ld a,(bc)",
  /* 0x0b */ "dec bc",
  /* 0x0c */ "inc c",
  /* 0x0d */ "dec c",
  /* 0x0e */ "ld c,^B",
  /* 0x0f */ "rrca",

  /* 0x10 */ "djnz ^r",
  /* 0x11 */ "ld de,^W",
  /* 0x12 */ "ld (de),a",
  /* 0x13 */ "inc de",
  /* 0x14 */ "inc d",
  /* 0x15 */ "dec d",
  /* 0x16 */ "ld d,^B",
  /* 0x17 */ "rla",
  /* 0x18 */ "jr ^r",
  /* 0x19 */ "add hl,de",
  /* 0x1a */ "ld a,(de)",
  /* 0x1b */ "dec de",
  /* 0x1c */ "inc e",
  /* 0x1d */ "dec e",
  /* 0x1e */ "ld e,^B",
  /* 0x1f */ "rra",

  /* 0x20 */ "jr nz,^r",
  /* 0x21 */ "ld hl,^W",
  /* 0x22 */ "ld (^W),hl",
  /* 0x23 */ "inc hl",
  /* 0x24 */ "inc h",
  /* 0x25 */ "dec h",
  /* 0x26 */ "ld h,^B",
  /* 0x27 */ "daa",
  /* 0x28 */ "jr z,^r",
  /* 0x29 */ "add hl,hl",
  /* 0x2a */ "ld hl,(^W)",
  /* 0x1b */ "dec hl",
  /* 0x1c */ "inc l",
  /* 0x1d */ "dec l",
  /* 0x2e */ "ld l,^B",
  /* 0x2f */ "cpl",

  /* 0x30 */ "jr nc,^r",
  /* 0x31 */ "ld sp,^W",
  /* 0x32 */ "ld (^W),a",
  /* 0x33 */ "inc sp",
  /* 0x34 */ "inc (hl)",
  /* 0x35 */ "dec (hl)",
  /* 0x36 */ "ld (hl),^B",
  /* 0x37 */ "scf",
  /* 0x38 */ "jr c,^r",
  /* 0x39 */ "add hl,sp",
  /* 0x3a */ "ld a,(^W)",
  /* 0x3b */ "dec sp",
  /* 0x3c */ "inc a",
  /* 0x3d */ "dec a",
  /* 0x3e */ "ld a,^B",
  /* 0x3f */ "ccf",

  /* 0x40 */ "ld b,b",
  /* 0x41 */ "ld b,c",
  /* 0x42 */ "ld b,d",
  /* 0x43 */ "ld b,e",
  /* 0x44 */ "ld b,h",
  /* 0x45 */ "ld b,l",
  /* 0x46 */ "ld b,(hl)",
  /* 0x47 */ "ld b,a",
  /* 0x48 */ "ld c,b",
  /* 0x49 */ "ld c,c",
  /* 0x4a */ "ld c,d",
  /* 0x4b */ "ld c,e",
  /* 0x4c */ "ld c,h",
  /* 0x4d */ "ld c,l",
  /* 0x4e */ "ld c,(hl)",
  /* 0x4f */ "ld c,a",

  /* 0x50 */ "ld d,b",
  /* 0x51 */ "ld d,c",
  /* 0x52 */ "ld d,d",
  /* 0x53 */ "ld d,e",
  /* 0x54 */ "ld d,h",
  /* 0x55 */ "ld d,l",
  /* 0x56 */ "ld d,(hl)",
  /* 0x57 */ "ld d,a",
  /* 0x58 */ "ld e,b",
  /* 0x59 */ "ld e,c",
  /* 0x5a */ "ld e,d",
  /* 0x5b */ "ld e,e",
  /* 0x5c */ "ld e,h",
  /* 0x5d */ "ld e,l",
  /* 0x5e */ "ld e,(hl)",
  /* 0x5f */ "ld e,a",

  /* 0x60 */ "ld h,b",
  /* 0x61 */ "ld h,c",
  /* 0x62 */ "ld h,d",
  /* 0x63 */ "ld h,e",
  /* 0x64 */ "ld h,h",
  /* 0x65 */ "ld h,l",
  /* 0x66 */ "ld h,(hl)",
  /* 0x67 */ "ld h,a",
  /* 0x68 */ "ld l,b",
  /* 0x69 */ "ld l,c",
  /* 0x6a */ "ld l,d",
  /* 0x6b */ "ld l,e",
  /* 0x6c */ "ld l,h",
  /* 0x6d */ "ld l,l",
  /* 0x6e */ "ld l,(hl)",
  /* 0x6f */ "ld l,a",

  /* 0x70 */ "ld (hl),b",
  /* 0x71 */ "ld (hl),c",
  /* 0x72 */ "ld (hl),d",
  /* 0x73 */ "ld (hl),e",
  /* 0x74 */ "ld (hl),h",
  /* 0x75 */ "ld (hl),l",
  /* 0x76 */ "halt",
  /* 0x77 */ "ld (hl),a",
  /* 0x78 */ "ld a,b",
  /* 0x79 */ "ld a,c",
  /* 0x7a */ "ld a,d",
  /* 0x7b */ "ld a,e",
  /* 0x7c */ "ld a,h",
  /* 0x7d */ "ld a,l",
  /* 0x7e */ "ld a,(hl)",
  /* 0x7f */ "ld a,a",

  /* 0x80 */ "add a,b",
  /* 0x81 */ "add a,c",
  /* 0x82 */ "add a,d",
  /* 0x83 */ "add a,e",
  /* 0x84 */ "add a,h",
  /* 0x85 */ "add a,l",
  /* 0x86 */ "add a,(hl)",
  /* 0x87 */ "add a,a",
  /* 0x88 */ "adc a,b",
  /* 0x89 */ "adc a,c",
  /* 0x8a */ "adc a,d",
  /* 0x8b */ "adc a,e",
  /* 0x8c */ "adc a,h",
  /* 0x8d */ "adc a,l",
  /* 0x8e */ "adc a,(hl)",
  /* 0x8f */ "adc a,a",

  /* 0x90 */ "sub b",
  /* 0x91 */ "sub c",
  /* 0x92 */ "sub d",
  /* 0x93 */ "sub e",
  /* 0x94 */ "sub h",
  /* 0x95 */ "sub l",
  /* 0x96 */ "sub (hl)",
  /* 0x97 */ "sub a",
  /* 0x98 */ "sbc a,b",
  /* 0x99 */ "sbc a,c",
  /* 0x9a */ "sbc a,d",
  /* 0x9b */ "sbc a,e",
  /* 0x9c */ "sbc a,h",
  /* 0x9d */ "sbc a,l",
  /* 0x9e */ "sbc a,(hl)",
  /* 0x9f */ "sbc a,a",

  /* 0xa0 */ "and b",
  /* 0xa1 */ "and c",
  /* 0xa2 */ "and d",
  /* 0xa3 */ "and e",
  /* 0xa4 */ "and h",
  /* 0xa5 */ "and l",
  /* 0xa6 */ "and (hl)",
  /* 0xa7 */ "and a",
  /* 0xa8 */ "xor b",
  /* 0xa9 */ "xor c",
  /* 0xaa */ "xor d",
  /* 0xab */ "xor e",
  /* 0xac */ "xor h",
  /* 0xad */ "xor l",
  /* 0xae */ "xor (hl)",
  /* 0xaf */ "xor a",

  /* 0xb0 */ "or b",
  /* 0xb1 */ "or c",
  /* 0xb2 */ "or d",
  /* 0xb3 */ "or e",
  /* 0xb4 */ "or h",
  /* 0xb5 */ "or l",
  /* 0xb6 */ "or (hl)",
  /* 0xb7 */ "or a",
  /* 0xb8 */ "cp b",
  /* 0xb9 */ "cp c",
  /* 0xba */ "cp d",
  /* 0xbb */ "cp e",
  /* 0xbc */ "cp h",
  /* 0xbd */ "cp l",
  /* 0xbe */ "cp (hl)",
  /* 0xbf */ "cp a",

  /* 0xc0 */ "ret nz",
  /* 0xc1 */ "pop bc",
  /* 0xc2 */ "jp nz,^L",
  /* 0xc3 */ "jp ^L",
  /* 0xc4 */ "call nz,^L",
  /* 0xc5 */ "push bc",
  /* 0xc6 */ "add a,^B",
  /* 0xc7 */ "rst #00",
  /* 0xc8 */ "ret z",
  /* 0xc9 */ "ret",
  /* 0xca */ "jp z,^L",
  /* 0xcb */ "",
  /* 0xcc */ "call z,^L",
  /* 0xcd */ "call ^L",
  /* 0xce */ "adc a,^B",
  /* 0xcf */ "rst #08",

  /* 0xd0 */ "ret nc",
  /* 0xd1 */ "pop de",
  /* 0xd2 */ "jp nc,^L",
  /* 0xd3 */ "out (^B),a",
  /* 0xd4 */ "call nc,^L",
  /* 0xd5 */ "push de",
  /* 0xd6 */ "sub ^B",
  /* 0xd7 */ "rst #10",
  /* 0xd8 */ "ret c",
  /* 0xd9 */ "exx",
  /* 0xda */ "jp c,^L",
  /* 0xdb */ "in a,(^B)",
  /* 0xdc */ "call c,^L",
  /* 0xdd */ "",
  /* 0xde */ "sbc a,^B",
  /* 0xdf */ "rst #18",

  /* 0xe0 */ "ret po",
  /* 0xe1 */ "pop hl",
  /* 0xe2 */ "jp po,^L",
  /* 0xe3 */ "ex (sp),hl",
  /* 0xe4 */ "call po,^L",
  /* 0xe5 */ "push hl",
  /* 0xe6 */ "and ^B",
  /* 0xe7 */ "rst #20",
  /* 0xe8 */ "ret pe",
  /* 0xe9 */ "jp (hl)",
  /* 0xea */ "jp pe,^L",
  /* 0xeb */ "ex de,hl",
  /* 0xec */ "call pe,^L",
  /* 0xed */ "",
  /* 0xee */ "xor ^B",
  /* 0xef */ "rst #28",

  /* 0xf0 */ "ret p",
  /* 0xf1 */ "pop af",
  /* 0xf2 */ "jp p,^L",
  /* 0xf3 */ "di",
  /* 0xf4 */ "call p,^L",
  /* 0xf5 */ "push af",
  /* 0xf6 */ "or ^B",
  /* 0xf7 */ "rst #30",
  /* 0xf8 */ "ret m",
  /* 0xf9 */ "ld sp,hl",
  /* 0xfa */ "jp m,^L",
  /* 0xfb */ "ei",
  /* 0xfc */ "call m,^L",
  /* 0xfd */ "",
  /* 0xfe */ "cp ^B",
  /* 0xff */ "rst #38",
];

/**
 * Extended Z80 instructions
 */
export const extendedInstructions = new InstructionTable([
  new OperationMap(0x00, 0xe0, null),
  new OperationMap(0x20, undefined, null),
  new OperationMap(0x21, undefined, null),
  new OperationMap(0x22, undefined, null),
  new OperationMap(0x23, undefined, "swapnib", true),
  new OperationMap(0x24, undefined, "mirror a", true),
  new OperationMap(0x25, undefined, null),
  new OperationMap(0x26, undefined, "mirror de", true),
  new OperationMap(0x27, undefined, "test ^B", true),
  new OperationMap(0x28, 0xf8, null),
  new OperationMap(0x30, undefined, "mul", true),
  new OperationMap(0x31, undefined, "add hl,a", true),
  new OperationMap(0x32, undefined, "add de,a", true),
  new OperationMap(0x33, undefined, "add bc,a", true),
  new OperationMap(0x34, undefined, "add hl,^W", true),
  new OperationMap(0x35, undefined, "add de,^W", true),
  new OperationMap(0x36, undefined, "add bc,^W", true),
  new OperationMap(0x37, undefined, null),
  new OperationMap(0x38, undefined, null),
  new OperationMap(0x39, undefined, null),
  new OperationMap(0x3a, undefined, null),
  new OperationMap(0x3b, undefined, null),
  new OperationMap(0x3c, undefined, null),
  new OperationMap(0x3d, undefined, null),
  new OperationMap(0x3e, undefined, null),
  new OperationMap(0x3f, undefined, null),
  new OperationMap(0x40, 0xc7, "in ^q,(c)"),
  new OperationMap(0x41, 0xc7, "out (c),^q"),
  new OperationMap(0x42, 0xcf, "sbc hl,^Q"),
  new OperationMap(0x43, 0xcf, "ld (^W),^Q"),
  new OperationMap(0x44, 0xc7, "neg"),
  new OperationMap(0x45, 0xc7, "retn"),
  new OperationMap(0x46, undefined, "im 0"),
  new OperationMap(0x47, undefined, "ld i,a"),
  new OperationMap(0x4a, 0xcf, "adc hl,^Q"),
  new OperationMap(0x4b, 0xcf, "ld ^Q,(^W)"),
  new OperationMap(0x4d, undefined, "reti"),
  new OperationMap(0x4e, undefined, "im 0"),
  new OperationMap(0x4f, undefined, "ld r,a"),
  new OperationMap(0x56, undefined, "im 1"),
  new OperationMap(0x57, undefined, "ld a,i"),
  new OperationMap(0x5e, undefined, "im 2"),
  new OperationMap(0x5f, undefined, "ld a,r"),
  new OperationMap(0x66, undefined, "im 0"),
  new OperationMap(0x67, undefined, "rrd"),
  new OperationMap(0x6e, undefined, "im 0"),
  new OperationMap(0x6f, undefined, "rld"),
  new OperationMap(0x70, undefined, "in (c)"),
  new OperationMap(0x71, undefined, "out (c),0"),
  new OperationMap(0x76, undefined, "im 1"),
  new OperationMap(0x77, undefined, null),
  new OperationMap(0x7e, undefined, "im 2"),
  new OperationMap(0x7f, undefined, null),
  new OperationMap(0x80, 0xf8, null),
  new OperationMap(0x88, undefined, null),
  new OperationMap(0x89, undefined, null),
  new OperationMap(0x8a, undefined, "push ^W", true),
  new OperationMap(0x8b, undefined, null),
  new OperationMap(0x8c, undefined, null),
  new OperationMap(0x8d, undefined, null),
  new OperationMap(0x8e, undefined, null),
  new OperationMap(0x8f, undefined, null),
  new OperationMap(0x90, undefined, "outinb", true),
  new OperationMap(0x91, undefined, "nextreg ^B,^B", true),
  new OperationMap(0x92, undefined, "nextreg ^B,a", true),
  new OperationMap(0x93, undefined, "pixeldn", true),
  new OperationMap(0x94, undefined, "pixelad", true),
  new OperationMap(0x95, undefined, "setae", true),
  new OperationMap(0x96, undefined, null),
  new OperationMap(0x97, undefined, null),
  new OperationMap(0x98, 0xf8, null),
  new OperationMap(0xa0, undefined, "ldi"),
  new OperationMap(0xa1, undefined, "cpi"),
  new OperationMap(0xa2, undefined, "ini"),
  new OperationMap(0xa3, undefined, "outi"),
  new OperationMap(0xa4, undefined, "ldix", true),
  new OperationMap(0xa8, undefined, "ldd"),
  new OperationMap(0xa9, undefined, "cpd"),
  new OperationMap(0xaa, undefined, "ind"),
  new OperationMap(0xab, undefined, "outd"),
  new OperationMap(0xac, undefined, "lddx", true),
  new OperationMap(0xad, undefined, null),
  new OperationMap(0xae, undefined, null),
  new OperationMap(0xaf, undefined, null),
  new OperationMap(0xb0, undefined, "ldir"),
  new OperationMap(0xb1, undefined, "cpir"),
  new OperationMap(0xb2, undefined, "inir"),
  new OperationMap(0xb3, undefined, "otir"),
  new OperationMap(0xb4, undefined, "ldirx", true),
  new OperationMap(0xb5, undefined, null),
  new OperationMap(0xb6, undefined, "ldirscale", true),
  new OperationMap(0xb7, undefined, "ldpirx", true),
  new OperationMap(0xb8, undefined, "lddr"),
  new OperationMap(0xb9, undefined, "cpdr"),
  new OperationMap(0xba, undefined, "indr"),
  new OperationMap(0xbb, undefined, "otdr"),
  new OperationMap(0xbc, undefined, "lddrx", true),
  new OperationMap(0xbd, undefined, null),
  new OperationMap(0xbe, undefined, null),
  new OperationMap(0xc0, 0xc0, null),
]);

/**
 * Z80 indexed instructions
 */
export const indexedInstructions = new InstructionTable([
  new OperationMap(0x09, 0xcf, "add ^X,^Q"),
  new OperationMap(0x21, undefined, "ld ^X,^W"),
  new OperationMap(0x22, undefined, "ld (^W),^X"),
  new OperationMap(0x23, undefined, "inc ^X"),
  new OperationMap(0x24, undefined, "inc ^h"),
  new OperationMap(0x25, undefined, "dec ^h"),
  new OperationMap(0x26, undefined, "ld ^h,^B"),
  new OperationMap(0x29, undefined, "add ^X,^X"),
  new OperationMap(0x2a, undefined, "ld ^X,(^W)"),
  new OperationMap(0x2b, undefined, "dec ^X"),
  new OperationMap(0x2c, undefined, "inc ^l"),
  new OperationMap(0x2d, undefined, "dec ^l"),
  new OperationMap(0x2e, undefined, "ld ^l,^B"),
  new OperationMap(0x34, undefined, "inc (^X^D)"),
  new OperationMap(0x35, undefined, "dec (^X^D)"),
  new OperationMap(0x36, undefined, "ld (^X^D),^B"),
  new OperationMap(0x44, 0xe7, "ld ^q,^h"),
  new OperationMap(0x45, 0xe7, "ld ^q,^l"),
  new OperationMap(0x46, 0xe7, "ld ^q,(^X^D)"),
  new OperationMap(0x60, 0xf8, "ld ^h,^s"),
  new OperationMap(0x64, undefined, "ld ^h,^h"),
  new OperationMap(0x65, undefined, "ld ^h,^l"),
  new OperationMap(0x66, undefined, "ld h,(^X^D)"),
  new OperationMap(0x68, 0xf8, "ld ^l,^s"),
  new OperationMap(0x6c, undefined, "ld ^l,^h"),
  new OperationMap(0x6d, undefined, "ld ^l,^l"),
  new OperationMap(0x6e, undefined, "ld l,(^X^D)"),
  new OperationMap(0x70, 0xf8, "ld (^X^D),^s"),
  new OperationMap(0x76, undefined, null),
  new OperationMap(0x7c, undefined, "ld a,^h"),
  new OperationMap(0x7d, undefined, "ld a,^l"),
  new OperationMap(0x7e, undefined, "ld a,(^X^D)"),
  new OperationMap(0x7f, undefined, null),
  new OperationMap(0x80, 0xef, null),
  new OperationMap(0x84, undefined, "add a,^h"),
  new OperationMap(0x85, undefined, "add a,^l"),
  new OperationMap(0x86, undefined, "add a,(^X^D)"),
  new OperationMap(0x8c, undefined, "adc a,^h"),
  new OperationMap(0x8d, undefined, "adc a,^l"),
  new OperationMap(0x8e, undefined, "adc a,(^X^D)"),
  new OperationMap(0x94, undefined, "sub ^h"),
  new OperationMap(0x95, undefined, "sub ^l"),
  new OperationMap(0x96, undefined, "sub (^X^D)"),
  new OperationMap(0x9c, undefined, "sbc a,^h"),
  new OperationMap(0x9d, undefined, "sbc a,^l"),
  new OperationMap(0x9e, undefined, "sbc a,(^X^D)"),
  new OperationMap(0xa4, undefined, "and ^h"),
  new OperationMap(0xa5, undefined, "and ^l"),
  new OperationMap(0xa6, undefined, "and (^X^D)"),
  new OperationMap(0xac, undefined, "xor ^h"),
  new OperationMap(0xad, undefined, "xor ^l"),
  new OperationMap(0xae, undefined, "xor (^X^D)"),
  new OperationMap(0xb4, undefined, "or ^h"),
  new OperationMap(0xb5, undefined, "or ^l"),
  new OperationMap(0xb6, undefined, "or (^X^D)"),
  new OperationMap(0xbc, undefined, "cp ^h"),
  new OperationMap(0xbd, undefined, "cp ^l"),
  new OperationMap(0xbe, undefined, "cp (^X^D)"),
  new OperationMap(0xe1, undefined, "pop ^X"),
  new OperationMap(0xe3, undefined, "ex (sp),^X"),
  new OperationMap(0xe5, undefined, "push ^X"),
  new OperationMap(0xe9, undefined, "jp (^X)"),
  new OperationMap(0xf9, undefined, "ld sp,^X"),
]);

/**
 * Z80 indexed bit instructions
 */
export const indexedBitInstructions = new InstructionTable([
  new OperationMap(0x00, 0xf8, "rlc (^X^D),^s"),
  new OperationMap(0x06, undefined, "rlc (^X^D)"),
  new OperationMap(0x08, 0xf8, "rrc (^X^D),^s"),
  new OperationMap(0x0e, undefined, "rrc (^X^D)"),
  new OperationMap(0x10, 0xf8, "rl (^X^D),^s"),
  new OperationMap(0x16, undefined, "rl (^X^D)"),
  new OperationMap(0x18, 0xf8, "rr (^X^D),^s"),
  new OperationMap(0x1e, undefined, "rr (^X^D)"),
  new OperationMap(0x20, 0xf8, "sla (^X^D),^s"),
  new OperationMap(0x26, undefined, "sla (^X^D)"),
  new OperationMap(0x28, 0xf8, "sra (^X^D),^s"),
  new OperationMap(0x2e, undefined, "sra (^X^D)"),
  new OperationMap(0x30, 0xf8, "sll (^X^D),^s"),
  new OperationMap(0x36, undefined, "sll (^X^D)"),
  new OperationMap(0x38, 0xf8, "srl (^X^D),^s"),
  new OperationMap(0x3e, undefined, "srl (^X^D)"),
  new OperationMap(0x40, 0xc0, "bit ^b,(^X^D)"),
  new OperationMap(0x80, 0xc0, "res ^b,(^X^D),^s"),
  new OperationMap(0xc0, 0xc0, "set ^b,(^X^D),^s"),
  new OperationMap(0x86, undefined, "res ^b,(^X^D)"),
  new OperationMap(0x8e, undefined, "res ^b,(^X^D)"),
  new OperationMap(0x96, undefined, "res ^b,(^X^D)"),
  new OperationMap(0x9e, undefined, "res ^b,(^X^D)"),
  new OperationMap(0xa6, undefined, "res ^b,(^X^D)"),
  new OperationMap(0xae, undefined, "res ^b,(^X^D)"),
  new OperationMap(0xb6, undefined, "res ^b,(^X^D)"),
  new OperationMap(0xbe, undefined, "res ^b,(^X^D)"),
  new OperationMap(0xc6, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xce, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xd6, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xde, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xe6, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xee, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xf6, undefined, "set ^b,(^X^D)"),
  new OperationMap(0xfe, undefined, "set ^b,(^X^D)"),
]);

/**
 * RST 28 calculations
 */
export const calcOps: { [key: number] : string } = {
  0x00: "jump-true",
  0x01: "exchange",
  0x02: "delete",
  0x03: "subtract",
  0x04: "multiply",
  0x05: "division",
  0x06: "to-power",
  0x07: "or",
  0x08: "no-&-no",
  0x09: "no-l-eql",
  0x0a: "no-gr-eq",
  0x0b: "nos-neql",
  0x0c: "no-grtr",
  0x0d: "no-less",
  0x0e: "nos-eql",
  0x0f: "addition",
  0x10: "str-&-no",
  0x11: "str-l-eql",
  0x12: "str-gr-eq",
  0x13: "strs-neql",
  0x14: "str-grtr",
  0x15: "str-less",
  0x16: "strs-eql",
  0x17: "strs-add",
  0x18: "val$",
  0x19: "usr-$",
  0x1a: "read-in",
  0x1b: "negate",
  0x1c: "code",
  0x1d: "val",
  0x1e: "len",
  0x1f: "sin",
  0x20: "cos",
  0x21: "tan",
  0x22: "asn",
  0x23: "acs",
  0x24: "atn",
  0x25: "ln",
  0x26: "exp",
  0x27: "int",
  0x28: "sqr",
  0x29: "sgn",
  0x2a: "abs",
  0x2b: "peek",
  0x2c: "in",
  0x2d: "usr-no",
  0x2e: "str$",
  0x2f: "chr$",
  0x30: "not",
  0x31: "duplicate",
  0x32: "n-mod-m",
  0x33: "jump",
  0x34: "stk-data",
  0x35: "dec-jr-nz",
  0x36: "less-0",
  0x37: "greater-0",
  0x38: "end-calc",
  0x39: "get-argt",
  0x3a: "truncate",
  0x3b: "fp-calc-2",
  0x3c: "e-to-fp",
  0x3d: "re-stack",
  0x3e: "series-06|series-08|series-0C",
  0x3f: "stk-zero|stk-one|stk-half|stk-pi-half|stk-ten",
  0x40: "st-mem-0|st-mem-1|st-mem-2|st-mem-3|st-mem-4|st-mem-5",
  0x41: "get-mem-0|get-mem-1|get-mem-2|get-mem-3|get-mem-4|get-mem-5",
};

/**
 * Spectrum-specific disassembly mode
 */
export enum SpectrumSpecificMode {
  None = 0,
  Spectrum48Rst08,
  Spectrum48Rst28,
  Spectrum128Rst8,
}
