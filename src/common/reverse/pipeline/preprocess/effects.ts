/*
 * What one Z80/Z80N instruction does to the registers, memory, ports and stack
 * (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1 stages 8-9, D10), worked out from Klive's own
 * disassembler's text and bytes. It is the input of the register-facts pass and the RAM/port facts.
 *
 * Registers are tracked as 8-bit halves (`A`, `F`, `B`, ..., `IXH`, `IYL`); the alternate set is only
 * reached through `EX AF,AF'` and `EXX`, which are `swap` effects. `SP`, `I` and `R` are not tracked as
 * values (the stack is modelled by `stack`). Anything the model does not cover is `unknown`, never a
 * guess: the test runs every opcode of both CPUs through it.
 */

export type Reg8 = "A" | "F" | "B" | "C" | "D" | "E" | "H" | "L" | "IXH" | "IXL" | "IYH" | "IYL";

export const REG8: readonly Reg8[] = ["A", "F", "B", "C", "D", "E", "H", "L", "IXH", "IXL", "IYH", "IYL"];

export type RegPair = [Reg8, Reg8];

export type StackEffect =
  | { op: "push"; pair: RegPair }
  /** Z80N `PUSH nn`: a constant on the stack */
  | { op: "push-value" }
  | { op: "pop"; pair: RegPair }
  /** `EX (SP),HL/IX/IY`: the pair and the stack top change places */
  | { op: "exchange"; pair: RegPair };

export type Swap = "af" | "exx" | "de-hl";

/** Flag and A values an instruction leaves that the exit facts can name. */
export type KnownValues = { carry?: 0 | 1; zero?: 0 | 1; a?: number; carryToggles?: true };

export type Effects = {
  reads: Reg8[];
  writes: Reg8[];
  /** Absolute addresses read or written: `LD A,(nn)`, `LD (nn),HL` */
  memRead?: number;
  memWrite?: number;
  /** A port named by the instruction: a number (`IN A,(n)`, with A as its high byte) or `bc`. */
  portIn?: number | "bc";
  portOut?: number | "bc";
  /** Z80N `NEXTREG n,...`: the register written. */
  nextReg?: number;
  stack?: StackEffect;
  swap?: Swap;
  known?: KnownValues;
  /** The model does not cover this instruction. */
  unknown?: string;
};

const PAIRS: Record<string, RegPair> = {
  af: ["A", "F"],
  bc: ["B", "C"],
  de: ["D", "E"],
  hl: ["H", "L"],
  ix: ["IXH", "IXL"],
  iy: ["IYH", "IYL"]
};

const SINGLE: Record<string, Reg8> = {
  a: "A",
  f: "F",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  h: "H",
  l: "L",
  xh: "IXH",
  xl: "IXL",
  yh: "IYH",
  yl: "IYL",
  ixh: "IXH",
  ixl: "IXL",
  iyh: "IYH",
  iyl: "IYL"
};

/** An operand as the effects model sees it. */
type Operand =
  | { kind: "reg"; regs: Reg8[] }
  | { kind: "sp" }
  | { kind: "ir" }
  /** `(hl)`, `(ix+d)`, `(bc)`: memory through registers */
  | { kind: "mem"; via: Reg8[] }
  /** `(nn)` or `(n)` */
  | { kind: "abs"; value: number }
  /** `(c)` in `IN`/`OUT` */
  | { kind: "port-c" }
  | { kind: "imm"; value: number }
  | { kind: "other" };

function operand(text: string): Operand {
  const t = text.trim().toLowerCase();
  if (SINGLE[t]) return { kind: "reg", regs: [SINGLE[t]] };
  if (PAIRS[t]) return { kind: "reg", regs: [...PAIRS[t]] };
  if (t === "sp") return { kind: "sp" };
  if (t === "i" || t === "r") return { kind: "ir" };
  if (t === "(c)") return { kind: "port-c" };
  const mem = /^\((hl|bc|de|sp|ix|iy)([+-]\$?[0-9a-f]+)?\)$/.exec(t);
  if (mem) return mem[1] === "sp" ? { kind: "other" } : { kind: "mem", via: [...PAIRS[mem[1]]] };
  const abs = /^\((\$[0-9a-f]+|l[0-9a-f]{4})\)$/.exec(t);
  if (abs) return { kind: "abs", value: number(abs[1]) };
  if (/^(\$[0-9a-f]+|l[0-9a-f]{4}|\d+)$/.test(t)) return { kind: "imm", value: number(t) };
  return { kind: "other" };
}

function number(text: string): number {
  if (text.startsWith("$")) return parseInt(text.slice(1), 16);
  if (/^l[0-9a-f]{4}$/i.test(text)) return parseInt(text.slice(1), 16);
  return parseInt(text, 10);
}

/** The registers an operand reads when it is a source (or an address). */
function sourceRegs(op: Operand): Reg8[] {
  if (op.kind === "reg") return op.regs;
  if (op.kind === "mem") return op.via;
  return [];
}

/** The registers an operand reads only to form an address, when it is a destination. */
function addressRegs(op: Operand): Reg8[] {
  return op.kind === "mem" ? op.via : [];
}

const uniq = (regs: Reg8[]): Reg8[] => [...new Set(regs)];

function effects(reads: Reg8[], writes: Reg8[], extra: Partial<Effects> = {}): Effects {
  return { reads: uniq(reads), writes: uniq(writes), ...extra };
}

const ALU8 = new Set(["add", "adc", "sub", "sbc", "and", "xor", "or", "cp"]);
const SHIFT = new Set(["rlc", "rrc", "rl", "rr", "sla", "sra", "sll", "sl1", "srl"]);
const BLOCK: Record<string, { reads: Reg8[]; writes: Reg8[] }> = {
  ldi: { reads: ["B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L", "F"] },
  ldd: { reads: ["B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L", "F"] },
  ldir: { reads: ["B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L", "F"] },
  lddr: { reads: ["B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L", "F"] },
  cpi: { reads: ["A", "B", "C", "H", "L"], writes: ["B", "C", "H", "L", "F"] },
  cpd: { reads: ["A", "B", "C", "H", "L"], writes: ["B", "C", "H", "L", "F"] },
  cpir: { reads: ["A", "B", "C", "H", "L"], writes: ["B", "C", "H", "L", "F"] },
  cpdr: { reads: ["A", "B", "C", "H", "L"], writes: ["B", "C", "H", "L", "F"] },
  ini: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  ind: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  inir: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  indr: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  outi: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  outd: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  otir: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  otdr: { reads: ["B", "C", "H", "L"], writes: ["B", "H", "L", "F"] },
  // --- Z80N block copies: LDIX/LDDX/LDIRX/LDDRX/LDPIRX skip bytes equal to A; LDWS steps D and L
  ldix: { reads: ["A", "B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L"] },
  lddx: { reads: ["A", "B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L"] },
  ldirx: { reads: ["A", "B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L"] },
  lddrx: { reads: ["A", "B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "H", "L"] },
  ldpirx: { reads: ["A", "B", "C", "D", "E", "H", "L"], writes: ["B", "C", "D", "E", "L"] },
  ldws: { reads: ["D", "E", "H", "L"], writes: ["D", "L", "F"] },
  outinb: { reads: ["B", "C", "H", "L"], writes: ["H", "L"] }
};

/**
 * The effects of one instruction, from the disassembler's text (`ld a,($BF79)`) and its bytes. A data
 * row a custom decoder emits (`.defb $1B` after an EXOS call) has no effects.
 */
export function instructionEffects(text: string, bytes: readonly number[]): Effects {
  const source = text.trim().toLowerCase();
  if (source === "" || source.startsWith(".")) return effects([], []);
  const space = source.indexOf(" ");
  const mnemonic = space < 0 ? source : source.slice(0, space);
  const ops = space < 0 ? [] : splitOperands(source.slice(space + 1));
  const [o1, o2, o3] = ops.map(operand);

  switch (mnemonic) {
    case "nop":
    case "halt":
    case "di":
    case "ei":
    case "im":
      return effects([], []);

    case "ld":
      return load(o1, o2, ops, bytes);

    case "push":
      if (o1.kind === "reg" && o1.regs.length === 2) return effects(o1.regs, [], { stack: { op: "push", pair: o1.regs as RegPair } });
      if (o1.kind === "imm") return effects([], [], { stack: { op: "push-value" } });
      break;
    case "pop":
      if (o1.kind === "reg" && o1.regs.length === 2) return effects([], o1.regs, { stack: { op: "pop", pair: o1.regs as RegPair } });
      break;

    case "ex":
      if (ops[0] === "af" && ops[1] === "af'") return effects([], [], { swap: "af" });
      if (ops[0] === "de" && ops[1] === "hl") return effects([], [], { swap: "de-hl" });
      if (ops[0] === "(sp)" && o2.kind === "reg") {
        return effects(o2.regs, o2.regs, { stack: { op: "exchange", pair: o2.regs as RegPair } });
      }
      break;
    case "exx":
      return effects([], [], { swap: "exx" });

    case "inc":
    case "dec":
      if (o1.kind === "reg") return effects(o1.regs, o1.regs.length === 1 ? [...o1.regs, "F"] : o1.regs);
      if (o1.kind === "sp") return effects([], []);
      if (o1.kind === "mem") return effects(o1.via, ["F"]);
      break;

    case "rlca":
    case "rrca":
      return effects(["A"], ["A", "F"]);
    case "rla":
    case "rra":
      return effects(["A", "F"], ["A", "F"]);
    case "daa":
      return effects(["A", "F"], ["A", "F"]);
    case "cpl":
    case "neg":
      return effects(["A"], ["A", "F"]);
    case "scf":
      return effects([], ["F"], { known: { carry: 1 } });
    case "ccf":
      return effects(["F"], ["F"], { known: { carryToggles: true } });
    case "rld":
    case "rrd":
      return effects(["A", "H", "L"], ["A", "F"]);

    case "bit":
      return effects(sourceRegs(o2), ["F"]);
    case "set":
    case "res":
      // --- `SET b,(IX+d),r` (undocumented) also copies the result into r
      return effects([...sourceRegs(o2)], [...(o2.kind === "reg" ? o2.regs : []), ...(o3?.kind === "reg" ? o3.regs : [])]);

    case "in":
      return input(ops, o1, o2);
    case "out":
      return output(ops, o1, o2);

    case "jp":
    case "jr":
    case "call":
    case "ret":
    case "reti":
    case "retn":
    case "rst":
      return branchEffects(mnemonic, ops);
    case "djnz":
      return effects(["B"], ["B"]);

    // --- Z80N
    case "swapnib":
      return effects(["A"], ["A"]);
    case "mirror":
      return effects(["A"], ["A"]);
    case "mul":
      return effects(["D", "E"], ["D", "E"]);
    case "test":
      return effects(["A"], ["F"]);
    case "bsla":
    case "bsra":
    case "bsrl":
    case "bsrf":
    case "brlc":
      return effects(["D", "E", "B"], ["D", "E"]);
    case "pixeldn":
      return effects(["H", "L"], ["H", "L"]);
    case "pixelad":
      return effects(["D", "E"], ["H", "L"]);
    case "setae":
      return effects(["E"], ["A"]);
    case "nextreg": {
      const register = o1.kind === "imm" ? o1.value : undefined;
      if (o2?.kind === "reg") return effects(o2.regs, [], { nextReg: register });
      return effects([], [], { nextReg: register });
    }
  }

  if (BLOCK[mnemonic]) return effects(BLOCK[mnemonic].reads, BLOCK[mnemonic].writes);
  if (ALU8.has(mnemonic)) return alu(mnemonic, ops, o1, o2);
  if (SHIFT.has(mnemonic)) {
    const target = o1;
    const reads = [...sourceRegs(target), ...(mnemonic === "rl" || mnemonic === "rr" ? (["F"] as Reg8[]) : [])];
    const writes: Reg8[] = [...(target.kind === "reg" ? target.regs : []), "F", ...(o2?.kind === "reg" ? o2.regs : [])];
    return effects(reads, writes);
  }
  return { reads: [], writes: [], unknown: `No effects model for "${text.trim()}"` };
}

function splitOperands(text: string): string[] {
  return text.split(",").map((s) => s.trim());
}

function load(o1: Operand, o2: Operand, ops: string[], bytes: readonly number[]): Effects {
  if (!o1 || !o2) return { reads: [], writes: [], unknown: "ld without two operands" };
  if (o1.kind === "sp") return effects(sourceRegs(o2), [], o2.kind === "abs" ? { memRead: o2.value } : {});
  if (o1.kind === "ir") return effects(["A"], []);
  if (o2.kind === "ir") return effects([], ["A", "F"]);
  if (o1.kind === "reg") {
    // --- LD B,B and friends change nothing
    if (o2.kind === "reg" && o1.regs.length === 1 && o2.regs.length === 1 && o1.regs[0] === o2.regs[0]) return effects([], []);
    const known: KnownValues | undefined =
      o1.regs.length === 1 && o1.regs[0] === "A" && o2.kind === "imm" ? { a: o2.value & 0xff } : undefined;
    return effects(sourceRegs(o2), o1.regs, {
      ...(o2.kind === "abs" ? { memRead: absoluteOperand(bytes, o2.value) } : {}),
      ...(known ? { known } : {})
    });
  }
  if (o1.kind === "mem") return effects([...addressRegs(o1), ...sourceRegs(o2)], []);
  if (o1.kind === "abs") return effects(sourceRegs(o2), [], { memWrite: absoluteOperand(bytes, o1.value) });
  return { reads: [], writes: [], unknown: `ld ${ops.join(",")}` };
}

/** The address of an `(nn)` operand: the instruction's last two bytes, little-endian. */
function absoluteOperand(bytes: readonly number[], fromText: number): number {
  return bytes.length >= 3 ? bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8) : fromText;
}

function alu(mnemonic: string, ops: string[], o1: Operand, o2: Operand | undefined): Effects {
  // --- 16-bit forms: ADD HL,rr / ADC HL,rr / SBC HL,rr / ADD IX,rr and the Z80N ADD rr,A / ADD rr,nn
  if (o2 && o1.kind === "reg" && o1.regs.length === 2) {
    const reads = [...o1.regs, ...sourceRegs(o2), ...(mnemonic === "adc" || mnemonic === "sbc" ? (["F"] as Reg8[]) : [])];
    // --- ADD rr,rr sets flags; the Z80N's ADD rr,A and ADD rr,nn leave them alone
    const flags: Reg8[] = mnemonic === "add" && !(o2.kind === "reg" && o2.regs.length === 2) ? [] : ["F"];
    return effects(reads, [...o1.regs, ...flags]);
  }
  // --- 8-bit: `sub b`, `add a,b`, `and $0F`
  const src = o2 && o1.kind === "reg" && o1.regs[0] === "A" && ops.length === 2 ? o2 : o1;
  const reads: Reg8[] = ["A", ...sourceRegs(src), ...(mnemonic === "adc" || mnemonic === "sbc" ? (["F"] as Reg8[]) : [])];
  const selfA = src.kind === "reg" && src.regs.length === 1 && src.regs[0] === "A";
  // --- CP, and AND A / OR A (a test of A), leave A as it was
  const writes: Reg8[] = mnemonic === "cp" || (selfA && (mnemonic === "and" || mnemonic === "or")) ? ["F"] : ["A", "F"];
  let known: KnownValues | undefined;
  if (mnemonic === "and" || mnemonic === "or" || mnemonic === "xor") known = { carry: 0 };
  if ((mnemonic === "xor" || mnemonic === "sub") && selfA) known = { carry: 0, zero: 1, a: 0 };
  // --- XOR A / SUB A do not depend on A's value
  return effects(selfA && (mnemonic === "xor" || mnemonic === "sub") ? [] : reads, writes, known ? { known } : {});
}

function input(ops: string[], o1: Operand, o2: Operand | undefined): Effects {
  // --- IN A,(n): A is the port's high byte; IN r,(C) / IN (C) / IN F,(C)
  if (o1?.kind === "reg" && o2?.kind === "abs") return effects(["A"], ["A"], { portIn: o2.value });
  if (o1?.kind === "port-c" && ops.length === 1) return effects(["B", "C"], ["F"], { portIn: "bc" });
  if (o1?.kind === "reg" && o2?.kind === "port-c") return effects(["B", "C"], [...o1.regs, "F"], { portIn: "bc" });
  return { reads: [], writes: [], unknown: `in ${ops.join(",")}` };
}

function output(ops: string[], o1: Operand, o2: Operand | undefined): Effects {
  if (o1?.kind === "abs") return effects(["A"], [], { portOut: o1.value });
  if (o1?.kind === "port-c") return effects(["B", "C", ...(o2?.kind === "reg" ? o2.regs : [])], [], { portOut: "bc" });
  return { reads: [], writes: [], unknown: `out ${ops.join(",")}` };
}

/**
 * Branches: the flow comes from the disassembler's branch info; here only what the instruction itself
 * reads (a condition reads F, `JP (HL)` reads HL, `JP (C)` reads C).
 */
function branchEffects(mnemonic: string, ops: string[]): Effects {
  const condition = /^(nz|z|nc|c|po|pe|p|m)$/.test(ops[0] ?? "");
  const conditional = condition && (mnemonic === "ret" ? ops.length === 1 : ops.length === 2);
  const reads: Reg8[] = conditional ? ["F"] : [];
  if (mnemonic === "jp" && ops.length === 1) {
    const indirect = /^\((hl|ix|iy|c)\)$/.exec(ops[0]);
    if (indirect) return effects(indirect[1] === "c" ? ["B", "C"] : [...PAIRS[indirect[1]]], []);
  }
  return effects(reads, []);
}
