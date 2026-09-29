import type { Instr, MFunction, MModule, Slot, Terminator, Value } from "../ir/mir";

/**
 * Constant slots (level 2, `.docs/kbasic-optimiser.md` §12–§14): SCCP's most valuable case in memory
 * form. A slot the routine stores exactly once, with a constant, holds that constant wherever the
 * store dominates the load — so the load becomes the constant. It is what turns a FOR loop's hidden
 * limit (`FOR i = 0 TO 9`) into `cp 9` at every NEXT, and a `DIM k AS UByte = 5` that is never
 * assigned again into the literal 5.
 *
 * Which slots: frame slots of routines (locals, parameters, hidden temporaries) whose address is
 * never taken, and the main program's hidden FOR slots (`__forlim<n>`, `__forstep<n>`). The main
 * program's own variables are globals that inline asm, interrupts and USR code can see: never
 * (O9). A routine holding inline asm is left alone. Every access of a slot must be of one type.
 *
 * Why it is exact: only loads the store dominates change — a load that can run before the store
 * (the first iteration of a loop, a GOTO into a FOR body) keeps reading memory. A user variable's
 * store always stays (write-back: memory and the Variables panel keep its value); a hidden slot's
 * store and data go once nothing reads them.
 */
const HIDDEN_GLOBAL = /^__(for(lim|step)|inl)\d+$/;

type Access = { block: number; index: number; instr: Extract<Instr, { op: "load" | "store" | "addr" }> };

export function propagateConstantSlots(mir: MModule): boolean {
  let changed = false;
  const removedGlobals: string[] = [];
  for (const fn of mir.functions) {
    if (fn.kind === "data" || fn.blocks.some((b) => b.instrs.some((i) => i.op === "asm"))) continue;
    const result = propagateInFunction(fn);
    if (result.changed) changed = true;
    removedGlobals.push(...result.removedGlobals);
  }
  // --- A hidden global nothing reads or writes any more: its data goes too
  for (const name of removedGlobals) {
    const used = mir.functions.some((fn) => fn.blocks.some((b) => b.instrs.some((i) => (i.op === "load" || i.op === "store" || i.op === "addr") && slotKey(i.slot) === `g:${name}`)));
    if (!used) mir.data = mir.data.filter((d) => d.label !== name);
  }
  return changed;
}

function slotKey(slot: Slot): string | undefined {
  if (slot.kind === "frame") return `f:${slot.offset}`;
  if (slot.kind === "global" && HIDDEN_GLOBAL.test(slot.name)) return `g:${slot.name}`;
  return undefined;
}

function propagateInFunction(fn: MFunction): { changed: boolean; removedGlobals: string[] } {
  // --- Every access of every candidate slot
  const accesses = new Map<string, Access[]>();
  const excluded = new Set<string>();
  const frameOffsets = new Map<number, number>(); // offset -> size, to exclude overlapping accesses
  fn.blocks.forEach((b, block) =>
    b.instrs.forEach((instr, index) => {
      if (instr.op !== "load" && instr.op !== "store" && instr.op !== "addr") return;
      const key = slotKey(instr.slot);
      if (!key) return;
      if (instr.op === "addr") excluded.add(key);
      const list = accesses.get(key) ?? [];
      list.push({ block, index, instr });
      accesses.set(key, list);
    })
  );
  // --- One type per slot, and no frame access that overlaps another slot's bytes
  for (const [key, list] of accesses) {
    const types = new Set(list.map((a) => (a.instr.op === "store" ? a.instr.type : a.instr.op === "load" ? a.instr.dst.type : "addr")));
    if (types.size !== 1) excluded.add(key);
    if (key.startsWith("f:")) {
      const offset = Number(key.slice(2));
      const t = [...types][0];
      frameOffsets.set(offset, t === "i8" || t === "u8" || t === "bool" ? 1 : t === "i32" || t === "u32" || t === "fix" ? 4 : t === "flt" ? 5 : 2);
    }
  }
  for (const [offset, size] of frameOffsets) {
    for (const [other, otherSize] of frameOffsets) {
      if (other !== offset && other < offset + size && offset < other + otherSize) {
        excluded.add(`f:${offset}`);
        excluded.add(`f:${other}`);
      }
    }
  }

  const defs = new Map<number, Instr>();
  for (const b of fn.blocks) for (const i of b.instrs) if ("dst" in i && i.dst) defs.set(i.dst.id, i);
  const constantOf = (v: Value): Extract<Instr, { op: "const" }>["value"] | undefined => {
    if (v.kind === "imm") return v;
    if (v.kind !== "vreg") return undefined;
    const d = defs.get(v.id);
    return d?.op === "const" ? d.value : undefined;
  };

  const dominates = dominatorTest(fn);
  let changed = false;
  const removedGlobals: string[] = [];
  for (const [key, list] of accesses) {
    if (excluded.has(key)) continue;
    const stores = list.filter((a) => a.instr.op === "store");
    if (stores.length !== 1) continue;
    const store = stores[0];
    const value = constantOf((store.instr as Extract<Instr, { op: "store" }>).src);
    if (!value) continue;
    let all = true;
    for (const load of list) {
      if (load.instr.op !== "load") continue;
      const covered = load.block === store.block ? load.index > store.index : dominates(store.block, load.block);
      if (!covered) {
        all = false;
        continue;
      }
      const l = load.instr;
      fn.blocks[load.block].instrs[load.index] = { op: "const", dst: l.dst, value: { ...value, type: l.dst.type } as never, sid: l.sid };
      changed = true;
    }
    // --- A hidden global nothing reads: its store goes (a user variable's never does)
    if (all && key.startsWith("g:")) {
      const b = fn.blocks[store.block];
      b.instrs = b.instrs.filter((i) => i !== store.instr);
      removedGlobals.push(key.slice(2));
      changed = true;
    }
  }
  return { changed, removedGlobals };
}

/** The blocks each terminator can go to (a GOSUB also goes on to its return point). */
function successors(t: Terminator | undefined, next: string | undefined): string[] {
  if (!t) return next ? [next] : [];
  switch (t.op) {
    case "jmp":
      return [t.target];
    case "br":
      return [t.ifTrue, t.ifFalse];
    case "switch":
      return [...t.targets, t.otherwise];
    case "gosub":
      return [t.target, t.next];
    case "ongosub":
      return [...t.targets, t.next];
    default:
      return [];
  }
}

/** `dominates(a, b)`: every path from the entry to block b passes block a (iterative dataflow). */
function dominatorTest(fn: MFunction): (a: number, b: number) => boolean {
  const n = fn.blocks.length;
  const index = new Map(fn.blocks.map((b, i) => [b.label, i]));
  const preds: number[][] = Array.from({ length: n }, () => []);
  fn.blocks.forEach((b, i) => {
    for (const s of successors(b.term, fn.blocks[i + 1]?.label)) {
      const j = index.get(s);
      if (j !== undefined) preds[j].push(i);
    }
  });
  const all = () => new Set(Array.from({ length: n }, (_, i) => i));
  const dom: Set<number>[] = Array.from({ length: n }, (_, i) => (i === 0 ? new Set([0]) : all()));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < n; i++) {
      let next: Set<number> | undefined;
      for (const p of preds[i]) next = next ? new Set([...next].filter((x) => dom[p].has(x))) : new Set(dom[p]);
      next = next ?? new Set();
      next.add(i);
      if (next.size !== dom[i].size || [...next].some((x) => !dom[i].has(x))) {
        dom[i] = next;
        changed = true;
      }
    }
  }
  return (a, b) => dom[b].has(a);
}
