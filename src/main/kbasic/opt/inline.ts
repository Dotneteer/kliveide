import type { Block, Instr, MFunction, MModule, MType, Slot, Terminator, Value, VReg } from "../ir/mir";
import { mtypeSize } from "../ir/mir";

/**
 * Inlining (level 3, plan §7.1, `.docs/kbasic-optimiser.md` §16): a small leaf SUB or FUNCTION with a
 * single call site is put in its caller, in memory form.
 *
 * Candidates: a SUB or FUNCTION with at most MAX_STATEMENTS statements, no user call, no inline asm,
 * no CODEBANK, only numeric parameters and locals (no Strings or arrays, so its epilogue frees
 * nothing), exactly one call in the program and no other reference (no `@routine`, not named in asm
 * or data).
 *
 * How:
 * - Each of the callee's frame slots gets a home in the caller: a new frame slot of a routine, a
 *   hidden global (`__inl<n>`) of the main program (the callee is a leaf with one call site, so it
 *   never runs twice at once). Its locals and result are zeroed at the call, as its prologue did.
 * - The caller's block is split at the call. Values computed before the call and used after it are
 *   stored to hidden homes right where they are computed and loaded again after the inlined code, and
 *   each argument is stored to its parameter's home right where it is computed — so the evaluation
 *   order is the program's, and no value is live across the inlined statements (G4 by construction).
 * - The callee's blocks follow, relabelled, their vregs renumbered, their frame slots rehomed; its
 *   frame markers go, and every return becomes a store of the result to its home and a jump to the
 *   continuation. The continuation loads the result and the saved values and runs the rest of the
 *   calling statement; its code is tagged -2 (shared), which the debugger treats like runtime code:
 *   the calling statement's entry and its first run stay as they were.
 * - The callee's statements now belong to the caller; the callee is left with no code (`removed`).
 *   At level 3 its parameters and locals are not in the Variables panel (debug builds use level 1).
 */
const MAX_STATEMENTS = 4;
const MAX_FRAME = 127;
const NUMERIC = new Set<MType>(["i8", "u8", "i16", "u16", "i32", "u32", "fix", "flt", "bool", "ptr"]);

export function inlineCalls(mir: MModule): boolean {
  let changed = false;
  let hidden = 0;
  let nextId = maxVreg(mir) + 1;
  const freshId = () => nextId++;
  for (let guard = 0; guard < 64; guard++) {
    const site = findSite(mir);
    if (!site) break;
    inlineAt(mir, site, freshId, () => `__inl${hidden++}`);
    changed = true;
  }
  return changed;
}

type Site = { caller: number; block: number; index: number; callee: number };

function maxVreg(mir: MModule): number {
  let max = 0;
  const see = (v: Value | undefined) => {
    if (v?.kind === "vreg") max = Math.max(max, v.id);
  };
  for (const fn of mir.functions) {
    for (const b of fn.blocks) {
      for (const i of b.instrs) {
        if ("dst" in i && i.dst) see(i.dst);
      }
    }
  }
  return max;
}

/** The next call worth inlining, if any. */
function findSite(mir: MModule): Site | undefined {
  const text = [
    ...mir.data.flatMap((d) => (d.kind === "raw" ? d.lines : d.kind === "equ" ? [d.value] : [])),
    ...mir.functions.filter((f) => !f.removed).flatMap((f) => f.blocks.flatMap((b) => b.instrs.flatMap((i) => (i.op === "asm" ? i.lines : []))))
  ].join("\n");
  const syms = new Set<string>();
  for (const fn of mir.functions) {
    if (fn.removed) continue;
    for (const b of fn.blocks) for (const i of b.instrs) if (i.op === "const" && i.value.kind === "sym") syms.add(i.value.name);
  }
  for (let callee = 0; callee < mir.functions.length; callee++) {
    const fn = mir.functions[callee];
    if (!candidate(fn)) continue;
    if (syms.has(fn.label) || new RegExp(`(^|[^\\w.])${fn.label.replace(/\./g, "\\.")}($|[^\\w.])`).test(text)) continue;
    const sites: Site[] = [];
    mir.functions.forEach((c, ci) => {
      if (c.removed) return;
      c.blocks.forEach((b, bi) =>
        b.instrs.forEach((i, ii) => {
          if (i.op === "call" && i.target === fn.label) sites.push({ caller: ci, block: bi, index: ii, callee });
        })
      );
    });
    if (sites.length !== 1) continue;
    const s = sites[0];
    const caller = mir.functions[s.caller];
    if (s.caller === callee || caller.kind === "data" || caller.bank) continue;
    if (caller.kind !== "main" && caller.frameSize + fn.frameSize + 16 > MAX_FRAME) continue;
    if (!splittable(caller.blocks[s.block], s.index)) continue;
    return s;
  }
  return undefined;
}

function candidate(fn: MFunction): boolean {
  if ((fn.kind !== "sub" && fn.kind !== "function") || fn.removed || fn.bank) return false;
  const instrs = fn.blocks.flatMap((b) => b.instrs);
  if (instrs.some((i) => i.op === "call" || i.op === "asm")) return false;
  if (instrs.filter((i) => i.op === "stmt").length > MAX_STATEMENTS + 1) return false;
  if ((fn.vars ?? []).some((v) => v.symbol.kind === "array" || v.byref)) return false;
  if ([...fn.params, ...fn.locals].some((p) => !NUMERIC.has(p.type))) return false;
  if (fn.returnType && !NUMERIC.has(fn.returnType)) return false;
  // --- Frame slots only through plain loads and stores (no address taken, no pointer arithmetic on the frame)
  if (instrs.some((i) => i.op === "addr" && i.slot.kind === "frame")) return false;
  // --- A GOSUB-like terminator would not be a routine's; switch/ongosub keep it simple
  if (fn.blocks.some((b) => b.term && !["jmp", "br", "ret"].includes(b.term.op))) return false;
  return true;
}

/** Values the block computes before the call and uses after it must be used only after it. */
function splittable(block: Block, index: number): boolean {
  const before = new Set<number>();
  for (let n = 0; n < index; n++) {
    const i = block.instrs[n];
    if ("dst" in i && i.dst) before.add(i.dst.id);
  }
  const usedBefore = new Set<number>();
  for (let n = 0; n < index; n++) operandsOf(block.instrs[n]).forEach((v) => v.kind === "vreg" && usedBefore.add(v.id));
  const usedAfter = new Set<number>();
  for (let n = index + 1; n < block.instrs.length; n++) operandsOf(block.instrs[n]).forEach((v) => v.kind === "vreg" && usedAfter.add(v.id));
  if (block.term) termOperands(block.term).forEach((v) => v.kind === "vreg" && usedAfter.add(v.id));
  for (const id of usedAfter) if (before.has(id) && usedBefore.has(id)) return false;
  // --- Every value used after is defined in the block (or is the call's result)
  return true;
}

function inlineAt(mir: MModule, site: Site, freshId: () => number, hiddenName: () => string): void {
  const caller = mir.functions[site.caller];
  const callee = mir.functions[site.callee];
  const block = caller.blocks[site.block];
  const call = block.instrs[site.index] as Extract<Instr, { op: "call" }>;
  const sid = call.sid;
  const tag = `${callee.label}.inl`;

  // --- A home in the caller for each of the callee's frame slots (offset -> slot)
  const sizes = new Map<number, MType>();
  for (const b of callee.blocks) {
    for (const i of b.instrs) {
      if ((i.op === "load" || i.op === "store") && i.slot.kind === "frame") sizes.set(i.slot.offset, i.op === "load" ? i.dst.type : i.type);
    }
  }
  // --- A byte parameter is the high byte of the word pushed for it (`push af`), a Float's image starts
  // --- after a padding byte: the body reads them one byte above the recorded offset. A parameter's
  // --- home is where the body accesses it.
  const paramOffset = (p: { offset: number; type: MType }) => (!sizes.has(p.offset) && sizes.has(p.offset + 1) ? p.offset + 1 : p.offset);
  for (const p of [...callee.params, ...callee.locals]) {
    const at = callee.params.includes(p) ? paramOffset(p) : p.offset;
    if (!sizes.has(at)) sizes.set(at, p.type);
  }
  const newHome = (type: MType): Slot => {
    if (caller.kind === "main") {
      const name = hiddenName();
      mir.data.push({ kind: "var", label: name, size: mtypeSize(type) });
      return { kind: "global", name };
    }
    caller.frameSize += mtypeSize(type);
    return { kind: "frame", offset: -caller.frameSize };
  };
  const homes = new Map<number, Slot>();
  for (const [offset, type] of sizes) homes.set(offset, newHome(type));
  const params = new Set(callee.params.map((p) => paramOffset(p)));
  // --- The result: the epilogue returns the load of the callee's result slot, whose home serves
  const resultOffset = resultSlotOffset(callee);
  const resultHome = callee.returnType ? (resultOffset !== undefined ? homes.get(resultOffset) : newHome(callee.returnType)) : undefined;
  // --- Slots the callee's first block writes before it reads them need no zeroing
  const writtenFirst = new Set<number>();
  const readFirst = new Set<number>();
  for (const i of callee.blocks[0].instrs) {
    if (i.op === "load" && i.slot.kind === "frame" && !writtenFirst.has(i.slot.offset)) readFirst.add(i.slot.offset);
    if (i.op === "store" && i.slot.kind === "frame" && !readFirst.has(i.slot.offset)) writtenFirst.add(i.slot.offset);
  }

  // --- Before the call: saved values and arguments stored where they are computed
  const argHome = new Map<number, { slot: Slot; type: MType }>();
  call.args.forEach((a, k) => {
    const p = callee.params[k];
    if (p && a.kind === "vreg") argHome.set(a.id, { slot: homes.get(paramOffset(p))!, type: p.type });
  });
  const usedAfter = new Set<number>();
  for (let n = site.index + 1; n < block.instrs.length; n++) operandsOf(block.instrs[n]).forEach((v) => v.kind === "vreg" && usedAfter.add(v.id));
  if (block.term) termOperands(block.term).forEach((v) => v.kind === "vreg" && usedAfter.add(v.id));
  const saved: { from: VReg; home: Slot }[] = [];
  const pre: Instr[] = [];
  for (let n = 0; n < site.index; n++) {
    const i = block.instrs[n];
    pre.push(i);
    if (!("dst" in i) || !i.dst) continue;
    const arg = argHome.get(i.dst.id);
    if (arg) pre.push({ op: "store", type: arg.type, slot: arg.slot, src: i.dst, sid });
    else if (usedAfter.has(i.dst.id)) {
      const home = newHome(i.dst.type);
      saved.push({ from: i.dst, home });
      pre.push({ op: "store", type: i.dst.type, slot: home, src: i.dst, sid });
    }
  }
  // --- Constant arguments, and the callee's locals and result zeroed (its prologue did that)
  call.args.forEach((a, k) => {
    const p = callee.params[k];
    if (p && a.kind !== "vreg") pre.push({ op: "store", type: p.type, slot: homes.get(paramOffset(p))!, src: a, sid });
  });
  const zeroTo = (slot: Slot, type: MType) => {
    if (type === "flt") {
      // --- A Float is never an immediate: loaded, like every Float constant, from five zero bytes
      const z: VReg = { kind: "vreg", id: freshId(), type: "flt" };
      pre.push({ op: "load", dst: z, slot: { kind: "global", name: floatZero(mir) }, sid });
      pre.push({ op: "store", type, slot, src: z, sid });
    } else pre.push({ op: "store", type, slot, src: { kind: "imm", type, value: 0 }, sid });
  };
  for (const [offset, type] of sizes) if (!params.has(offset) && !writtenFirst.has(offset)) zeroTo(homes.get(offset)!, type);
  if (resultHome && callee.returnType && resultOffset === undefined) zeroTo(resultHome, callee.returnType);

  // --- The callee's blocks, relabelled and renumbered
  const entry = `${tag}.${callee.blocks[0].label}`;
  const cont = `${tag}.cont`;
  const relabel = (l: string) => `${tag}.${l}`;
  const ids = new Map<number, number>();
  const vreg = (v: VReg): VReg => {
    if (!ids.has(v.id)) ids.set(v.id, freshId());
    return { ...v, id: ids.get(v.id)! };
  };
  const value = (v: Value): Value => (v.kind === "vreg" ? vreg(v) : v);
  // --- Frame slots to their homes (a pointer slot's operand is renamed with the other operands)
  const slot = (s: Slot): Slot => (s.kind === "frame" ? homes.get(s.offset)! : s);
  const inlined: Block[] = callee.blocks.map((b) => {
    const instrs: Instr[] = [];
    for (const i of b.instrs) {
      if (i.op === "prologue.end" || i.op === "epilogue.begin") continue;
      instrs.push(rewrite(i, value, vreg, slot));
    }
    let term: Terminator | undefined;
    const t = b.term;
    if (!t) term = undefined;
    else if (t.op === "jmp") term = { ...t, target: relabel(t.target) };
    else if (t.op === "br") term = { ...t, cond: value(t.cond), ifTrue: relabel(t.ifTrue), ifFalse: relabel(t.ifFalse) };
    else if (t.op === "ret") {
      // --- The result is already in its home when the epilogue returns the result slot's load
      if (t.value && resultHome && callee.returnType && resultOffset === undefined) {
        instrs.push({ op: "store", type: callee.returnType, slot: resultHome, src: value(t.value), sid: t.sid });
      } else if (t.value && resultOffset !== undefined) {
        // --- The epilogue's load of the result is not needed any more: drop it
        const load = instrs.findIndex((x) => x.op === "load" && "dst" in x && x.dst?.id === (value(t.value!) as VReg).id);
        if (load >= 0) instrs.splice(load, 1);
      }
      term = { op: "jmp", target: cont, sid: t.sid };
    }
    return { label: relabel(b.label), instrs, ...(term ? { term } : {}) };
  });
  // --- A block falling off the end goes on to the continuation
  const last = inlined[inlined.length - 1];
  if (!last.term) last.term = { op: "jmp", target: cont, sid: -1 };

  // --- The continuation: the saved values and the result again, then the rest of the statement
  const renames = new Map<number, VReg>();
  const contInstrs: Instr[] = [];
  for (const s of saved) {
    const again: VReg = { ...s.from, id: freshId() };
    renames.set(s.from.id, again);
    contInstrs.push({ op: "load", dst: again, slot: s.home, sid: -2 });
  }
  if (call.dst && resultHome) contInstrs.push({ op: "load", dst: call.dst, slot: resultHome, sid: -2 });
  const rename = (v: Value): Value => (v.kind === "vreg" && renames.has(v.id) ? renames.get(v.id)! : v);
  // --- The rest of the calling statement is shared code (-2); later statements keep their ids
  let calling = true;
  for (let n = site.index + 1; n < block.instrs.length; n++) {
    const i = mapOperands(block.instrs[n], rename);
    if (i.op === "stmt") calling = false;
    contInstrs.push(calling ? ({ ...i, sid: -2 } as Instr) : i);
  }
  const contTerm = block.term ? { ...mapTermOperands(block.term, rename), ...(calling ? { sid: -2 } : {}) } : undefined;
  const contBlock: Block = { label: cont, instrs: contInstrs, ...(contTerm ? { term: contTerm as Terminator } : {}) };

  block.instrs = pre;
  block.term = { op: "jmp", target: entry, sid };
  caller.blocks.splice(site.block + 1, 0, ...inlined, contBlock);

  // --- The callee's statements are the caller's now; the callee gets no code
  for (const st of mir.statements) {
    if (st.functionIndex !== site.callee) continue;
    st.functionIndex = site.caller;
    st.inlinedFrom ??= site.callee;
  }
  callee.removed = true;
}

/** The frame offset of the slot a FUNCTION's epilogue returns (`%v = load [ix-n] ; ret %v`), if it has one. */
function resultSlotOffset(fn: MFunction): number | undefined {
  let offset: number | undefined;
  for (const b of fn.blocks) {
    const t = b.term;
    if (t?.op !== "ret" || !t.value || t.value.kind !== "vreg") continue;
    const def = b.instrs.find((i) => i.op === "load" && i.dst.id === (t.value as VReg).id) as Extract<Instr, { op: "load" }> | undefined;
    if (!def || def.slot.kind !== "frame") return undefined;
    if (offset !== undefined && offset !== def.slot.offset) return undefined;
    offset = def.slot.offset;
  }
  return offset;
}

/** Five zero bytes (a Float zero), added to the program's data once. */
function floatZero(mir: MModule): string {
  const label = "__inlzero";
  if (!mir.data.some((d) => d.label === label)) mir.data.push({ kind: "var", label, size: 5 });
  return label;
}

function rewrite(i: Instr, value: (v: Value) => Value, vreg: (v: VReg) => VReg, slot: (s: Slot) => Slot): Instr {
  const out = mapOperands(i, value);
  const withDst = "dst" in out && out.dst ? { ...out, dst: vreg(out.dst) } : out;
  if ((withDst.op === "load" || withDst.op === "store" || withDst.op === "addr") && withDst.slot) return { ...withDst, slot: slot(withDst.slot) } as Instr;
  return withDst as Instr;
}

function operandsOf(i: Instr): Value[] {
  switch (i.op) {
    case "load":
    case "addr":
      return i.slot.kind === "deref" ? [i.slot.ptr] : [];
    case "store":
      return [...(i.slot.kind === "deref" ? [i.slot.ptr] : []), i.src];
    case "bin":
      return [i.a, i.b];
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return [i.a];
    case "call":
    case "rtcall":
      return i.args;
    default:
      return [];
  }
}

function termOperands(t: Terminator): Value[] {
  switch (t.op) {
    case "br":
      return [t.cond];
    case "switch":
    case "ongosub":
      return [t.sel];
    case "ret":
      return t.value ? [t.value] : [];
    case "end":
    case "raise":
      return [t.code];
    default:
      return [];
  }
}

function mapOperands(i: Instr, f: (v: Value) => Value): Instr {
  const slot = (s: Slot): Slot => (s.kind === "deref" ? { ...s, ptr: f(s.ptr) } : s);
  switch (i.op) {
    case "load":
    case "addr":
      return { ...i, slot: slot(i.slot) };
    case "store":
      return { ...i, slot: slot(i.slot), src: f(i.src) };
    case "bin":
      return { ...i, a: f(i.a), b: f(i.b) };
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return { ...i, a: f(i.a) };
    case "call":
    case "rtcall":
      return { ...i, args: i.args.map(f) };
    default:
      return i;
  }
}

function mapTermOperands(t: Terminator, f: (v: Value) => Value): Terminator {
  switch (t.op) {
    case "br":
      return { ...t, cond: f(t.cond) };
    case "switch":
    case "ongosub":
      return { ...t, sel: f(t.sel) };
    case "ret":
      return t.value ? { ...t, value: f(t.value) } : t;
    case "end":
    case "raise":
      return { ...t, code: f(t.code) };
    default:
      return t;
  }
}
