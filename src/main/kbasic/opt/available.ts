import { instr, type LirLine } from "../backend/lir";
import { pinnedLines } from "./engine";
import { parseInstr, type Reg } from "./lir";

/**
 * Redundant loads across statements (level 2, `.docs/kbasic-optimiser.md` §2): a forward pass over a
 * function's LIR that knows, at each point, which registers hold the value of a variable or a
 * constant, and drops a load of a value a register already holds (or turns it into a register copy).
 * It is what removes the reload at the start of a statement of what the statement before it stored.
 *
 * What it trusts, and why it stays correct:
 *
 * - **Straight-line code only.** Everything is forgotten at every label something refers to (a jump,
 *   a call, a table), so no fact crosses a merge point or a loop's back edge: a loop that polls a
 *   variable an interrupt handler sets still reads it every time round. A label nothing refers to
 *   is reached only by falling through, and statement entries are not labels: facts cross both.
 * - **Program variables and frame slots only**: symbolic addresses (`_x`, `_a.data+4`) and `(ix+d)`.
 *   A numeric address (a system variable, `PEEK 23672`) is never assumed to keep its value.
 * - **Any store forgets every memory fact** but its own (so names that alias the same memory —
 *   `DIM x AT @y` — cannot keep a stale value); a store through a pointer, a call, anything the
 *   parser does not know, forgets everything.
 * - **Stores are never removed**: memory always holds every variable's value, as inline asm, the
 *   runtime and the debugger's Variables panel expect.
 * - Pinned lines (the user's inline asm, call sites, the prologue and the epilogue) are never
 *   changed, though what they do is still followed.
 */
type Fact = string;

const PAIRS: Record<string, [Reg, Reg]> = { bc: ["b", "c"], de: ["d", "e"], hl: ["h", "l"] };
const SINGLE = new Set(["a", "b", "c", "d", "e", "h", "l"]);

/** `(x)` → the memory fact keys of its first byte and the next one, or undefined when not trackable. */
function memoryKey(operand: string, extra = 0): Fact | undefined {
  const m = /^\(\s*(.+?)\s*\)$/.exec(operand);
  if (!m) return undefined;
  const inner = m[1].replace(/\s+/g, "");
  const ix = /^ix([+-]\d+)?$/i.exec(inner);
  if (ix) return `m:ix@${Number(ix[1] ?? 0) + extra}`;
  if (/^(hl|de|bc|iy|sp)$/i.test(inner) || /^iy[+-]/i.test(inner)) return undefined;
  // --- A symbol plus an optional constant offset; plain numbers are not program variables
  const sym = /^([A-Za-z_][\w.]*)([+-]\d+)?$/.exec(inner);
  if (!sym) return undefined;
  return `m:${sym[1]}@${Number(sym[2] ?? 0) + extra}`;
}

/** The facts of an immediate's two bytes (a number, or a symbol's address). */
function immediateKeys(text: string): [Fact, Fact] | undefined {
  const t = text.trim();
  let n: number | undefined;
  if (/^-?\d+$/.test(t)) n = Number(t);
  else if (/^\$[0-9a-f]+$/i.test(t)) n = parseInt(t.slice(1), 16);
  else if (/^0x[0-9a-f]+$/i.test(t)) n = parseInt(t.slice(2), 16);
  if (n !== undefined) return [`i:${n & 0xff}`, `i:${(n >> 8) & 0xff}`];
  if (/^[A-Za-z_][\w.]*([+-]\d+)?$/.test(t)) return [`s:${t}:lo`, `s:${t}:hi`];
  return undefined;
}

export function removeRedundantLoads(fn: LirLine[], asmStatements: ReadonlySet<number>): LirLine[] {
  const pinned = pinnedLines(fn, asmStatements);
  const state = new Map<Reg, Fact>();
  const forgetMemory = (except?: Set<Reg>) => {
    for (const [r, f] of state) if (f.startsWith("m:") && !except?.has(r)) state.delete(r);
  };
  // --- Labels something refers to: any instruction naming them (jumps, calls, jump tables)
  const referenced = new Set<string>();
  for (const l of fn) {
    if (l.kind !== "instr") continue;
    for (const m of l.text.matchAll(/[A-Za-z_][\w.]*/g)) referenced.add(m[0]);
  }
  const out: LirLine[] = [];
  fn.forEach((line, index): void => {
    if (line.kind === "label" && referenced.has(line.name)) state.clear();
    if (line.kind !== "instr") {
      out.push(line);
      return;
    }
    const p = parseInstr(line.text);
    const keep = (): void => {
      out.push(line);
    };
    const canChange = !pinned[index];

    if (p.op === "ld" && p.args.length === 2 && !p.sideEffects) {
      const [dst, src] = p.args.map((a) => a.trim().toLowerCase());
      // --- A register loaded from memory or with a constant
      if (SINGLE.has(dst) && !src.startsWith("(") && SINGLE.has(src)) {
        const f = state.get(src as Reg);
        if (f !== undefined && state.get(dst as Reg) === f && canChange) return;
        if (f !== undefined) state.set(dst as Reg, f);
        else state.delete(dst as Reg);
        return keep();
      }
      if (SINGLE.has(dst)) {
        const f = src.startsWith("(") ? memoryKey(p.args[1]) : immediateKeys(p.args[1])?.[0];
        if (f !== undefined && state.get(dst as Reg) === f && canChange) return;
        if (f !== undefined && canChange && src.startsWith("(")) {
          // --- From memory into A: a register already holding it is a cheaper copy
          const holder = [...state].find(([r, v]) => v === f && r !== dst)?.[0];
          if (holder) {
            out.push(instr(`ld ${dst},${holder}`, line.sid));
            state.set(dst as Reg, f);
            return;
          }
        }
        if (f !== undefined) state.set(dst as Reg, f);
        else state.delete(dst as Reg);
        return keep();
      }
      if (PAIRS[dst]) {
        const [hi, lo] = PAIRS[dst];
        const keys: [Fact | undefined, Fact | undefined] = src.startsWith("(")
          ? [memoryKey(p.args[1], 0), memoryKey(p.args[1], 1)]
          : (immediateKeys(p.args[1]) ?? [undefined, undefined]);
        if (keys[0] !== undefined && keys[1] !== undefined && state.get(lo) === keys[0] && state.get(hi) === keys[1] && canChange) return;
        for (const [r, f] of [
          [lo, keys[0]],
          [hi, keys[1]]
        ] as const) {
          if (f !== undefined) state.set(r, f);
          else state.delete(r);
        }
        return keep();
      }
      // --- A store: memory changes, so every memory fact goes but the one this store makes true
      if (dst.startsWith("(")) {
        const regs = SINGLE.has(src) ? [src as Reg] : PAIRS[src] ? [PAIRS[src][1], PAIRS[src][0]] : [];
        const keys = regs.map((_, k) => memoryKey(p.args[0], k));
        forgetMemory();
        if (keys.every((k) => k !== undefined)) regs.forEach((r, k) => state.set(r, keys[k]!));
        return keep();
      }
    }
    if (p.op === "ex" && p.args.join(",").replace(/\s/g, "").toLowerCase() === "de,hl") {
      const [d, e, h, l] = [state.get("d"), state.get("e"), state.get("h"), state.get("l")];
      const put = (r: Reg, f: Fact | undefined) => (f === undefined ? state.delete(r) : state.set(r, f));
      put("d", h);
      put("e", l);
      put("h", d);
      put("l", e);
      return keep();
    }
    // --- Anything else: what it writes is unknown now; memory writes and the unknown forget more
    if (p.sideEffects && p.op !== "push" && p.op !== "pop") state.clear();
    for (const r of p.defs) state.delete(r);
    if (p.writesMemory) forgetMemory();
    return keep();
  });
  return out;
}
