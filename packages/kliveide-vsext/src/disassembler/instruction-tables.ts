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
 * Standard Z80 instructions
 */
export const standardInstructions = new InstructionTable([
  new OperationMap(0x00, undefined, "nop"),
  new OperationMap(0x01, 0xcf, "ld ^Q,^W"),
  new OperationMap(0x02, 0xef, "ld (^Q),a"),
  new OperationMap(0x03, 0xcf, "inc ^Q"),
  new OperationMap(0x04, 0xc7, "inc ^q"),
  new OperationMap(0x05, 0xc7, "dec ^q"),
  new OperationMap(0x06, 0xc7, "ld ^q,^B"),
  new OperationMap(0x07, undefined, "rlca"),
  new OperationMap(0x08, undefined, "ex af,af'"),
  new OperationMap(0x09, 0xcf, "add hl,^Q"),
  new OperationMap(0x0a, 0xef, "ld a,(^Q)"),
  new OperationMap(0x0b, 0xcf, "dec ^Q"),
  new OperationMap(0x0f, undefined, "rrca"),
  new OperationMap(0x10, undefined, "djnz ^r"),
  new OperationMap(0x17, undefined, "rla"),
  new OperationMap(0x18, undefined, "jr ^r"),
  new OperationMap(0x1f, undefined, "rra"),
  new OperationMap(0x20, undefined, "jr nz,^r"),
  new OperationMap(0x22, undefined, "ld (^W),hl"),
  new OperationMap(0x27, undefined, "daa"),
  new OperationMap(0x28, undefined, "jr z,^r"),
  new OperationMap(0x2a, undefined, "ld hl,(^W)"),
  new OperationMap(0x2f, undefined, "cpl"),
  new OperationMap(0x30, undefined, "jr nc,^r"),
  new OperationMap(0x32, undefined, "ld (^W),a"),
  new OperationMap(0x37, undefined, "scf"),
  new OperationMap(0x38, undefined, "jr c,^r"),
  new OperationMap(0x3a, undefined, "ld a,(^W)"),
  new OperationMap(0x3f, undefined, "ccf"),
  new OperationMap(0x40, 0xc0, "ld ^q,^s"),
  new OperationMap(0x76, undefined, "halt"),
  new OperationMap(0x80, 0xf8, "add a,^s"),
  new OperationMap(0x88, 0xf8, "adc a,^s"),
  new OperationMap(0x90, 0xf8, "sub ^s"),
  new OperationMap(0x98, 0xf8, "sbc a,^s"),
  new OperationMap(0xa0, 0xf8, "and ^s"),
  new OperationMap(0xa8, 0xf8, "xor ^s"),
  new OperationMap(0xb0, 0xf8, "or ^s"),
  new OperationMap(0xb8, 0xf8, "cp ^s"),
  new OperationMap(0xc0, undefined, "ret nz"),
  new OperationMap(0xc1, 0xcf, "pop ^R"),
  new OperationMap(0xc2, undefined, "jp nz,^L"),
  new OperationMap(0xc3, undefined, "jp ^L"),
  new OperationMap(0xc4, undefined, "call nz,^L"),
  new OperationMap(0xc5, 0xcf, "push ^R"),
  new OperationMap(0xc6, undefined, "add a,^B"),
  new OperationMap(0xc7, 0xc7, "rst ^8"),
  new OperationMap(0xc8, undefined, "ret z"),
  new OperationMap(0xc9, undefined, "ret"),
  new OperationMap(0xca, undefined, "jp z,^L"),
  new OperationMap(0xcc, undefined, "call z,^L"),
  new OperationMap(0xcd, undefined, "call ^L"),
  new OperationMap(0xce, undefined, "adc a,^B"),
  new OperationMap(0xd0, undefined, "ret nc"),
  new OperationMap(0xd2, undefined, "jp nc,^L"),
  new OperationMap(0xd3, undefined, "out (^B),a"),
  new OperationMap(0xd4, undefined, "call nc,^L"),
  new OperationMap(0xd6, undefined, "sub ^B"),
  new OperationMap(0xd8, undefined, "ret c"),
  new OperationMap(0xd9, undefined, "exx"),
  new OperationMap(0xda, undefined, "jp c,^L"),
  new OperationMap(0xdb, undefined, "in a,(^B)"),
  new OperationMap(0xdc, undefined, "call c,^L"),
  new OperationMap(0xde, undefined, "sbc a,^B"),
  new OperationMap(0xe0, undefined, "ret po"),
  new OperationMap(0xe2, undefined, "jp po,^L"),
  new OperationMap(0xe3, undefined, "ex (sp),hl"),
  new OperationMap(0xe4, undefined, "call po,^L"),
  new OperationMap(0xe6, undefined, "and ^B"),
  new OperationMap(0xe8, undefined, "ret pe"),
  new OperationMap(0xe9, undefined, "jp (hl)"),
  new OperationMap(0xea, undefined, "jp pe,^L"),
  new OperationMap(0xeb, undefined, "ex de,hl"),
  new OperationMap(0xec, undefined, "call pe,^L"),
  new OperationMap(0xee, undefined, "xor ^B"),
  new OperationMap(0xf0, undefined, "ret p"),
  new OperationMap(0xf2, undefined, "jp p,^L"),
  new OperationMap(0xf3, undefined, "di"),
  new OperationMap(0xf4, undefined, "call p,^L"),
  new OperationMap(0xf6, undefined, "or ^B"),
  new OperationMap(0xf8, undefined, "ret m"),
  new OperationMap(0xf9, undefined, "ld sp,hl"),
  new OperationMap(0xfa, undefined, "jp m,^L"),
  new OperationMap(0xfb, undefined, "ei"),
  new OperationMap(0xfc, undefined, "call m,^L"),
  new OperationMap(0xfe, undefined, "cp ^B"),
]);

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
 * Z80 bit instructions
 */
export const bitInstructions = new InstructionTable([
  new OperationMap(0x00, 0xf8, "rlc ^s"),
  new OperationMap(0x08, 0xf8, "rrc ^s"),
  new OperationMap(0x10, 0xf8, "rl ^s"),
  new OperationMap(0x18, 0xf8, "rr ^s"),
  new OperationMap(0x20, 0xf8, "sla ^s"),
  new OperationMap(0x28, 0xf8, "sra ^s"),
  new OperationMap(0x30, 0xf8, "sll ^s"),
  new OperationMap(0x38, 0xf8, "srl ^s"),
  new OperationMap(0x40, 0xc0, "bit ^b,^s"),
  new OperationMap(0x80, 0xc0, "res ^b,^s"),
  new OperationMap(0xc0, 0xc0, "set ^b,^s"),
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
export const calcOps = new Map<number, string>([
  [0x00, "jump-true"],
  [0x01, "exchange"],
  [0x02, "delete"],
  [0x03, "subtract"],
  [0x04, "multiply"],
  [0x05, "division"],
  [0x06, "to-power"],
  [0x07, "or"],
  [0x08, "no-&-no"],
  [0x09, "no-l-eql"],
  [0x0a, "no-gr-eq"],
  [0x0b, "nos-neql"],
  [0x0c, "no-grtr"],
  [0x0d, "no-less"],
  [0x0e, "nos-eql"],
  [0x0f, "addition"],
  [0x10, "str-&-no"],
  [0x11, "str-l-eql"],
  [0x12, "str-gr-eq"],
  [0x13, "strs-neql"],
  [0x14, "str-grtr"],
  [0x15, "str-less"],
  [0x16, "strs-eql"],
  [0x17, "strs-add"],
  [0x18, "val$"],
  [0x19, "usr-$"],
  [0x1a, "read-in"],
  [0x1b, "negate"],
  [0x1c, "code"],
  [0x1d, "val"],
  [0x1e, "len"],
  [0x1f, "sin"],
  [0x20, "cos"],
  [0x21, "tan"],
  [0x22, "asn"],
  [0x23, "acs"],
  [0x24, "atn"],
  [0x25, "ln"],
  [0x26, "exp"],
  [0x27, "int"],
  [0x28, "sqr"],
  [0x29, "sgn"],
  [0x2a, "abs"],
  [0x2b, "peek"],
  [0x2c, "in"],
  [0x2d, "usr-no"],
  [0x2e, "str$"],
  [0x2f, "chr$"],
  [0x30, "not"],
  [0x31, "duplicate"],
  [0x32, "n-mod-m"],
  [0x33, "jump"],
  [0x34, "stk-data"],
  [0x35, "dec-jr-nz"],
  [0x36, "less-0"],
  [0x37, "greater-0"],
  [0x38, "end-calc"],
  [0x39, "get-argt"],
  [0x3a, "truncate"],
  [0x3b, "fp-calc-2"],
  [0x3c, "e-to-fp"],
  [0x3d, "re-stack"],
  [0x3e, "series-06|series-08|series-0C"],
  [0x3f, "stk-zero|stk-one|stk-half|stk-pi-half|stk-ten"],
  [0x40, "st-mem-0|st-mem-1|st-mem-2|st-mem-3|st-mem-4|st-mem-5"],
  [0x41, "get-mem-0|get-mem-1|get-mem-2|get-mem-3|get-mem-4|get-mem-5"],
]);

/**
 * Spectrum-specific disassembly mode
 */
export enum SpectrumSpecificMode {
  None = 0,
  Spectrum48Rst08,
  Spectrum48Rst28,
  Spectrum128Rst8,
}
