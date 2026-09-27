import type { LirLine } from "../backend/lir";

/**
 * The LIR as the optimiser reads it (`.docs/kbasic-optimiser.md` §4): the level-0 selector writes
 * each instruction as assembler text, and this parses that text into an opcode, its operands and
 * the registers it reads and writes. Anything this does not know is treated as reading and writing
 * everything, and as having side effects, so no rule can move or drop it.
 */
export type Reg = "a" | "f" | "b" | "c" | "d" | "e" | "h" | "l";

export const ALL_REGS: readonly Reg[] = ["a", "f", "b", "c", "d", "e", "h", "l"];

export type ParsedInstr = {
  op: string;
  args: string[];
  uses: Set<Reg>;
  defs: Set<Reg>;
  /** Reads or writes something besides registers and plain memory (ports, the stack pointer, IX, alternate registers, NextRegs): never removed. */
  sideEffects: boolean;
  /** Writes memory. */
  writesMemory: boolean;
  /** Transfers control: jumps, calls, returns. */
  branch?: { kind: "jp" | "jr" | "djnz" | "call" | "ret" | "rst" | "jpind"; cond?: string; target?: string };
};

const PAIRS: Record<string, Reg[]> = { af: ["a", "f"], bc: ["b", "c"], de: ["d", "e"], hl: ["h", "l"] };
const SINGLE = new Set(["a", "b", "c", "d", "e", "h", "l"]);
const CONDITIONS = new Set(["nz", "z", "nc", "c", "po", "pe", "p", "m"]);

/** Splits an operand list on commas outside parentheses. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The registers an operand reads as a value (a register or pair) — not those used for addressing. */
function valueRegs(arg: string): Reg[] {
  const a = arg.toLowerCase();
  if (SINGLE.has(a)) return [a as Reg];
  if (PAIRS[a]) return PAIRS[a];
  return [];
}

/** The registers an operand uses to form an address: `(hl)`, `(de)`, `(bc)`. IX/IY are not tracked. */
function addressRegs(arg: string): Reg[] {
  const m = /^\(\s*(hl|de|bc)\s*\)$/i.exec(arg);
  return m ? PAIRS[m[1].toLowerCase()] : [];
}

const isMemory = (arg: string) => arg.startsWith("(");
const touchesSpecial = (arg: string) => /\b(sp|ix|iy|ixh|ixl|iyh|iyl|i|r|af')\b/i.test(arg) && !/^\(\s*i[xy]\s*[+-]/i.test(arg);

function conservative(op: string, args: string[]): ParsedInstr {
  return { op, args, uses: new Set(ALL_REGS), defs: new Set(ALL_REGS), sideEffects: true, writesMemory: true };
}

/** Parses one instruction's text (`ld a,(ix-1)`, `jp nz,__b2`). */
export function parseInstr(text: string): ParsedInstr {
  const trimmed = text.trim();
  const space = trimmed.search(/\s/);
  const op = (space < 0 ? trimmed : trimmed.slice(0, space)).toLowerCase();
  const args = space < 0 ? [] : splitArgs(trimmed.slice(space + 1));
  const uses = new Set<Reg>();
  const defs = new Set<Reg>();
  const use = (...r: Reg[]) => r.forEach((x) => uses.add(x));
  const def = (...r: Reg[]) => r.forEach((x) => defs.add(x));
  const base = (): ParsedInstr => ({ op, args, uses, defs, sideEffects: false, writesMemory: false });

  switch (op) {
    case "ld": {
      if (args.length !== 2) return conservative(op, args);
      const [dst, src] = args;
      if (touchesSpecial(dst) || touchesSpecial(src)) {
        // --- ld sp,.. / ld (nn),sp / ld a,i / ld ix,..: registers as far as known, never removed
        const p = base();
        p.sideEffects = true;
        p.writesMemory = isMemory(dst);
        valueRegs(src).forEach((r) => uses.add(r));
        addressRegs(src).forEach((r) => uses.add(r));
        addressRegs(dst).forEach((r) => uses.add(r));
        if (!isMemory(dst)) valueRegs(dst).forEach((r) => defs.add(r));
        if (isMemory(dst)) p.writesMemory = true;
        return p;
      }
      use(...valueRegs(src), ...addressRegs(src), ...addressRegs(dst));
      const p = base();
      if (isMemory(dst)) p.writesMemory = true;
      else def(...valueRegs(dst));
      if (!isMemory(dst) && valueRegs(dst).length === 0) return conservative(op, args);
      return p;
    }
    case "push":
      if (!PAIRS[args[0]?.toLowerCase()]) return { ...conservative(op, args), uses: new Set(), defs: new Set() };
      use(...PAIRS[args[0].toLowerCase()]);
      return { ...base(), sideEffects: true };
    case "pop":
      if (!PAIRS[args[0]?.toLowerCase()]) return conservative(op, args);
      def(...PAIRS[args[0].toLowerCase()]);
      return { ...base(), sideEffects: true };
    case "add":
    case "adc":
    case "sub":
    case "sbc":
    case "and":
    case "or":
    case "xor":
    case "cp": {
      if (args.length === 2 && ["hl", "ix", "iy"].includes(args[0].toLowerCase())) {
        if (args[0].toLowerCase() !== "hl" || touchesSpecial(args[1])) return { ...conservative(op, args), writesMemory: false };
        use("h", "l", ...valueRegs(args[1]));
        if (op === "adc" || op === "sbc") use("f");
        def("h", "l", "f");
        return base();
      }
      const operand = args.length === 2 ? args[1] : args[0];
      if (!operand || (touchesSpecial(operand) && !/^\(\s*i[xy]/i.test(operand))) return conservative(op, args);
      use("a", ...valueRegs(operand), ...addressRegs(operand));
      if (op === "adc" || op === "sbc") use("f");
      def("f");
      if (op !== "cp") def("a");
      return base();
    }
    case "inc":
    case "dec": {
      const r = args[0]?.toLowerCase() ?? "";
      if (SINGLE.has(r)) {
        use(r as Reg);
        def(r as Reg, "f");
        return base();
      }
      if (PAIRS[r] && r !== "af") {
        use(...PAIRS[r]);
        def(...PAIRS[r]);
        return base();
      }
      if (/^\(\s*hl\s*\)$/.test(r)) {
        use("h", "l");
        def("f");
        return { ...base(), writesMemory: true };
      }
      if (/^\(\s*i[xy]/.test(r)) {
        def("f");
        return { ...base(), writesMemory: true };
      }
      return { ...conservative(op, args), writesMemory: false };
    }
    case "ex":
      if (args.map((a) => a.toLowerCase()).join(",") === "de,hl") {
        use("d", "e", "h", "l");
        def("d", "e", "h", "l");
        return base();
      }
      return conservative(op, args);
    case "cpl":
    case "neg":
    case "rla":
    case "rra":
    case "rlca":
    case "rrca":
      use("a");
      if (op === "rla" || op === "rra") use("f");
      def("a", "f");
      return base();
    case "rl":
    case "rr":
    case "rlc":
    case "rrc":
    case "sla":
    case "sra":
    case "srl": {
      const r = args[0]?.toLowerCase() ?? "";
      if (!SINGLE.has(r)) return conservative(op, args);
      use(r as Reg);
      if (op === "rl" || op === "rr") use("f");
      def(r as Reg, "f");
      return base();
    }
    case "scf":
    case "ccf":
      if (op === "ccf") use("f");
      def("f");
      return base();
    case "nop":
      return base();
    case "jp":
    case "jr": {
      if (args.length === 1 && /^\(\s*(hl|ix|iy)\s*\)$/i.test(args[0])) {
        return { ...conservative(op, args), branch: { kind: "jpind" } };
      }
      const cond = args.length === 2 ? args[0].toLowerCase() : undefined;
      if (cond && !CONDITIONS.has(cond)) return conservative(op, args);
      if (cond) use("f");
      return { ...base(), branch: { kind: op as "jp" | "jr", ...(cond ? { cond } : {}), target: args[args.length - 1] } };
    }
    case "djnz":
      use("b");
      def("b");
      return { ...base(), branch: { kind: "djnz", target: args[0] } };
    case "call": {
      const cond = args.length === 2 ? args[0].toLowerCase() : undefined;
      return { ...conservative(op, args), branch: { kind: "call", ...(cond ? { cond } : {}), target: args[args.length - 1] } };
    }
    case "ret":
      return { ...conservative(op, args), branch: { kind: "ret", ...(args[0] ? { cond: args[0].toLowerCase() } : {}) } };
    case "rst":
      return { ...conservative(op, args), branch: { kind: "rst" } };
    default:
      return conservative(op, args);
  }
}

/** The inverse of a condition (`nz` ↔ `z`, ...). */
export function invertCondition(cond: string): string {
  const inverse: Record<string, string> = { nz: "z", z: "nz", nc: "c", c: "nc", po: "pe", pe: "po", p: "m", m: "p" };
  return inverse[cond];
}

/** The instruction text of a line, parsed (undefined for labels, markers and comments). */
export function parsedLine(line: LirLine): ParsedInstr | undefined {
  return line.kind === "instr" ? parseInstr(line.text) : undefined;
}
