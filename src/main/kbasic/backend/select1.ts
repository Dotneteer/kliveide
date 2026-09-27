import {
  COMPARISONS,
  isSignedM,
  regClassOf,
  symText,
  type BinOp,
  type CallSite,
  type Instr,
  type MType,
  type Slot,
  type Terminator,
  type Value,
  type VReg
} from "../ir/mir";
import { CodegenError } from "./lir";
import { FLOAT_BINARY, FLOAT_COMPARE, FLOAT_REGS, LOAD_FLOAT_HL, PUSH_FLOAT, RUNTIME_ARGS, STORE_FLOAT_HL } from "./select0";

/**
 * Level-1 instruction selection (`.docs/kbasic-optimiser.md` §4.1, O8): expression trees instead of a
 * stack machine, for one *run* — the instructions of a block between two boundaries (the block's
 * start, a statement entry), where no value is live on entry (G4). The level-0 selector hands every
 * run here first and selects it itself when this declines (returns undefined).
 *
 * Accepted: runs whose values form trees (each vreg defined once, used once, after its definition)
 * of pure 8- and 16-bit operations — constants, loads, stores, address constants, arithmetic, logic,
 * comparisons, conversions between 8 and 16 bits — ending in nothing, a jump, a branch, END, or the
 * main program's RETURN. Roots are stores, SUB calls and runtime calls, emitted in their MIR order;
 * each root's tree is emitted where the root stands, and a run whose tree reaches back over an
 * earlier root is declined, so no load moves across a store or a call. A FUNCTION call is a node of
 * its tree: wherever the selector would evaluate a tree's operands out of MIR order (to use a leaf in
 * place), it keeps MIR order instead when one side calls a FUNCTION and the other reads memory
 * (`mayReorder`). Strings, Fixed, Float and 32-bit values, runtime calls with more than one computed
 * argument, inline asm and the other terminators go to level 0.
 *
 * Code: a value is computed into its accumulator (A, HL); a leaf operand — a constant, a global, a
 * frame slot — is used where it is (`add a,(ix-2)`, `cp 10`, `ld de,(_b)`), and only an operation
 * whose operands both need computing saves the first on the stack (balanced within the run, so G4
 * holds). A branch on a comparison branches on the flags.
 */
export type RunContext = {
  /** The function returns with a plain `ret` (the main program, the DATA table): its RETURN is selectable. */
  plainReturn: boolean;
  /** Emits instruction lines with a statement id. */
  emit: (sid: number, ...lines: string[]) => void;
  /** Emits a user call with its call-site record (G5). */
  emitCall: (sid: number, text: string, site: CallSite) => void;
  label: (sid: number, name: string) => void;
  local: () => string;
  rt: (name: string) => string;
};

/** What TreeGen writes to: lines tagged with the current statement id. */
type Sink = {
  plainReturn: boolean;
  emit: (...lines: string[]) => void;
  emitCall: (text: string, site: CallSite) => void;
  label: (name: string) => void;
  local: () => string;
  rt: (name: string) => string;
  setSid: (sid: number) => void;
};

type Node = { instr: Instr; dst: VReg };

const SUPPORTED_TYPES = new Set<MType>(["i8", "u8", "i16", "u16", "bool", "ptr", "i32", "u32", "fix", "flt"]);
const isSupportedType = (t: MType) => SUPPORTED_TYPES.has(t);

/** Selects a run, or returns false (nothing emitted) when level 0 must. */
export function selectRun(instrs: Instr[], term: Terminator | undefined, ctx: RunContext): boolean {
  const plan = planRun(instrs, term, ctx.plainReturn);
  if (!plan) return false;
  const out: ({ kind: "line"; text: string; sid: number; site?: CallSite } | { kind: "label"; name: string; sid: number })[] = [];
  let sid = instrs[0]?.sid ?? term?.sid ?? -1;
  const runtime: string[] = [];
  const sink: Sink = {
    plainReturn: ctx.plainReturn,
    emit: (...l) => l.forEach((text) => out.push({ kind: "line", text, sid })),
    emitCall: (text, site) => out.push({ kind: "line", text, sid, site }),
    label: (name) => out.push({ kind: "label", name, sid }),
    local: ctx.local,
    rt: (name) => {
      runtime.push(name);
      return name;
    },
    setSid: (s) => {
      sid = s;
    }
  };
  try {
    new TreeGen(plan.defs, sink).run(plan.roots, term);
  } catch (e) {
    if (e instanceof Decline) return false;
    throw e;
  }
  // --- Emit only once the whole run is known to be selectable
  runtime.forEach((name) => ctx.rt(name));
  for (const o of out) {
    if (o.kind === "line" && o.site) ctx.emitCall(o.sid, o.text, o.site);
    else if (o.kind === "line") ctx.emit(o.sid, o.text);
    else ctx.label(o.sid, o.name);
  }
  return true;
}

class Decline extends Error {}
const decline = (): never => {
  throw new Decline();
};

/** Checks the run's shape; gives each vreg's defining instruction and the roots in order. */
function planRun(instrs: Instr[], term: Terminator | undefined, plainReturn: boolean): { defs: Map<number, Node>; roots: Instr[] } | undefined {
  if (term && term.op !== "jmp" && term.op !== "br" && term.op !== "end" && !(term.op === "ret" && plainReturn && !term.value)) return undefined;
  const defs = new Map<number, Node>();
  const position = new Map<number, number>();
  const uses = new Map<number, number>();
  const roots: Instr[] = [];
  const operandsOf = (i: Instr): Value[] => {
    switch (i.op) {
      case "const":
        return [];
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
  };
  for (let n = 0; n < instrs.length; n++) {
    const i = instrs[n];
    switch (i.op) {
      case "const":
      case "load":
      case "addr":
      case "bin":
      case "neg":
      case "not":
      case "lnot":
      case "conv":
        if (!isSupportedType(i.dst.type)) return undefined;
        break;
      case "store":
        if (!isSupportedType(i.type)) return undefined;
        break;
      case "call":
        // --- A SUB call is a root; a FUNCTION call is a node of its tree, of a type the selector knows
        if (i.dst && !isSupportedType(i.dst.type)) return undefined;
        break;
      case "rtcall": {
        if (i.dst) return undefined;
        const regs = RUNTIME_ARGS[i.name];
        if (!regs || i.name.startsWith("inline.") || regs.length !== i.args.length || regs.includes("stack")) return undefined;
        break;
      }
      default:
        return undefined;
    }
    for (const v of operandsOf(i)) {
      if (v.kind !== "vreg") {
        if (!isSupportedType(v.type)) return undefined;
        continue;
      }
      if (!defs.has(v.id) || !isSupportedType(v.type)) return undefined;
      uses.set(v.id, (uses.get(v.id) ?? 0) + 1);
    }
    if ("dst" in i && i.dst) {
      defs.set(i.dst.id, { instr: i, dst: i.dst });
      position.set(i.dst.id, n);
    } else roots.push(i);
  }
  const termValue = term?.op === "br" ? term.cond : term?.op === "end" ? term.code : undefined;
  if (termValue?.kind === "vreg") {
    if (!defs.has(termValue.id)) return undefined;
    uses.set(termValue.id, (uses.get(termValue.id) ?? 0) + 1);
  }
  // --- Trees: every value used exactly once
  for (const id of defs.keys()) if (uses.get(id) !== 1) return undefined;
  // --- No tree reaches back over an earlier root: a root's values are all defined after the root before it
  let lastStore = -1;
  for (let n = 0; n < instrs.length; n++) {
    const i = instrs[n];
    // --- Roots only: a FUNCTION call is a node of the tree that uses its result
    if (i.op !== "store" && !(i.op === "call" && !i.dst) && i.op !== "rtcall") continue;
    const tree = collect(i, defs, operandsOf);
    if (tree.some((id) => (position.get(id) ?? -1) < lastStore)) return undefined;
    lastStore = n;
  }
  if (termValue?.kind === "vreg") {
    const tree = [termValue.id, ...collect(defs.get(termValue.id)!.instr, defs, operandsOf)];
    if (tree.some((id) => (position.get(id) ?? -1) < lastStore)) return undefined;
  }
  return { defs, roots };
}

function collect(i: Instr, defs: Map<number, Node>, operandsOf: (i: Instr) => Value[]): number[] {
  const out: number[] = [];
  const walk = (x: Instr) => {
    for (const v of operandsOf(x)) {
      if (v.kind !== "vreg") continue;
      out.push(v.id);
      walk(defs.get(v.id)!.instr);
    }
  };
  walk(i);
  return out;
}

// =================================================================================================
// Code generation for trees

/** Flags after a comparison of left with right (left - right): which condition means "true". */
const TRUE_WHEN: Partial<Record<BinOp, string>> = { eq: "z", ne: "nz", lt: "c", ge: "nc" };
const INVERT: Record<string, string> = { z: "nz", nz: "z", c: "nc", nc: "c" };

class TreeGen {
  constructor(
    private readonly defs: Map<number, Node>,
    private readonly ctx: Sink
  ) {}

  private emit(...l: string[]): void {
    this.ctx.emit(...l);
  }

  run(roots: Instr[], term: Terminator | undefined): void {
    for (const r of roots) this.root(r);
    if (!term) return;
    this.ctx.setSid(term.sid);
    if (term.op === "jmp") {
      this.emit(`jp ${term.target}`);
      return;
    }
    if (term.op === "ret") {
      this.emit("ret");
      return;
    }
    if (term.op === "end") {
      // --- The exit code into BC, as level 0 passes it
      const k = this.constant(term.code);
      if (k !== undefined) this.emit(`ld bc,${k & 0xffff}`);
      else {
        this.gen(term.code);
        if (regClassOf(term.code.type) === "r8") this.emit("ld c,a", "ld b,0");
        else this.emit("ld b,h", "ld c,l");
      }
      this.emit(`jp ${this.ctx.rt("core.End")}`);
      return;
    }
    if (term.op !== "br") decline();
    const br = term as Extract<Terminator, { op: "br" }>;
    if (br.cond.kind !== "vreg") {
      this.emit(`jp ${br.cond.kind === "imm" && br.cond.value === 0 ? br.ifFalse : br.ifTrue}`);
      return;
    }
    const def = this.def(br.cond);
    if (def.instr.op === "bin" && COMPARISONS.has(def.instr.bop) && isSupportedType(def.instr.a.type)) {
      const cc = this.compare(def.instr.bop, def.instr.a, def.instr.b);
      this.emit(`jp ${cc},${br.ifTrue}`, `jp ${br.ifFalse}`);
      return;
    }
    this.gen(br.cond);
    this.emit("or a", `jp nz,${br.ifTrue}`, `jp ${br.ifFalse}`);
  }

  private def(v: VReg): Node {
    return this.defs.get(v.id) ?? decline();
  }

  // ----------------------------------------------------------------------------------------------
  // Leaves

  /** A leaf operand: its text as an 8-bit ALU operand (`10`, `(ix-2)`), or undefined. */
  private leaf8(v: Value): string | undefined {
    if (v.kind !== "vreg") return immText(v);
    const d = this.def(v).instr;
    if (d.op === "const") return immText(d.value);
    if (d.op === "load" && d.slot.kind === "frame") return ixd(d.slot.offset);
    return undefined;
  }

  /** A global (fixed-address) 8-bit load: its address text. */
  private global8(v: Value): string | undefined {
    if (v.kind !== "vreg") return undefined;
    const d = this.def(v).instr;
    return d.op === "load" ? fixedAddress(d.slot) : undefined;
  }

  /** Loads a leaf 16-bit value into DE without touching HL; false when it is not a leaf. */
  private leafToDe(v: Value): boolean {
    if (v.kind !== "vreg") {
      this.emit(`ld de,${immText(v)}`);
      return true;
    }
    const d = this.def(v).instr;
    if (d.op === "const") this.emit(`ld de,${immText(d.value)}`);
    else if (d.op === "load" && d.slot.kind === "frame") this.emit(`ld e,${ixd(d.slot.offset)}`, `ld d,${ixd(d.slot.offset + 1)}`);
    else if (d.op === "load" && fixedAddress(d.slot) !== undefined) this.emit(`ld de,(${fixedAddress(d.slot)})`);
    else if (d.op === "addr" && fixedAddress(d.slot) !== undefined) this.emit(`ld de,${fixedAddress(d.slot)}`);
    else return false;
    return true;
  }

  private isLeaf16(v: Value): boolean {
    if (v.kind !== "vreg") return true;
    const d = this.def(v).instr;
    return d.op === "const" || (d.op === "load" && (d.slot.kind === "frame" || fixedAddress(d.slot) !== undefined)) || (d.op === "addr" && fixedAddress(d.slot) !== undefined);
  }

  private isLeaf8(v: Value): boolean {
    return this.leaf8(v) !== undefined || this.global8(v) !== undefined;
  }

  // ----------------------------------------------------------------------------------------------
  // Values into the accumulator (A for 8-bit, HL for 16-bit)

  private gen(v: Value): void {
    const cls = regClassOf(v.type);
    if (v.kind !== "vreg") return this.loadImmediate(cls, immText(v));
    const i = this.def(v).instr;
    switch (i.op) {
      case "const":
        return this.loadImmediate(cls, immText(i.value));
      case "load":
        return this.load(i.dst, i.slot);
      case "addr":
        return this.addr(i.slot);
      case "bin":
        return this.binary(i.bop, i.dst, i.a, i.b);
      case "neg":
      case "not":
      case "lnot":
        return this.unary(i.op, i.a);
      case "conv":
        return this.conv(i.dst, i.a);
      case "call":
        // --- A FUNCTION: its result comes back in its accumulator (G6)
        return this.userCall(i);
      default:
        return decline();
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Evaluation order with calls in a tree

  /** Whether a value's tree calls a FUNCTION (which may change any variable). */
  private hasCall(v: Value): boolean {
    if (v.kind !== "vreg") return false;
    const i = this.def(v).instr;
    if (i.op === "call") return true;
    switch (i.op) {
      case "load":
      case "addr":
        return i.slot.kind === "deref" && this.hasCall(i.slot.ptr);
      case "bin":
        return this.hasCall(i.a) || this.hasCall(i.b);
      case "neg":
      case "not":
      case "lnot":
      case "conv":
        return this.hasCall(i.a);
      default:
        return false;
    }
  }

  /** Whether a value reads memory (a load somewhere in its tree). */
  private readsMemory(v: Value): boolean {
    if (v.kind !== "vreg") return false;
    const i = this.def(v).instr;
    switch (i.op) {
      case "load":
      case "call":
        return true;
      case "addr":
        return i.slot.kind === "deref" && this.readsMemory(i.slot.ptr);
      case "bin":
        return this.readsMemory(i.a) || this.readsMemory(i.b);
      case "neg":
      case "not":
      case "lnot":
      case "conv":
        return this.readsMemory(i.a);
      default:
        return false;
    }
  }

  /**
   * Whether `later` (after `earlier` in MIR order) may be evaluated before it: not when one of them
   * calls a FUNCTION and the other reads memory the call could change.
   */
  private mayReorder(earlier: Value, later: Value): boolean {
    return !((this.hasCall(later) && this.readsMemory(earlier)) || (this.hasCall(earlier) && this.readsMemory(later)));
  }

  private loadImmediate(cls: string, text: string): void {
    if (cls === "r8") this.emit(text === "0" ? "xor a" : `ld a,${text}`);
    else if (cls === "r16") this.emit(`ld hl,${text}`);
    else if (cls === "r32") {
      const [low, high] = words32(text);
      this.emit(`ld hl,${low}`, `ld de,${high}`);
    } else decline();
  }

  private load(dst: VReg, slot: Slot): void {
    const cls = regClassOf(dst.type);
    const fixed = fixedAddress(slot);
    if (cls === "rflt") {
      if (fixed !== undefined) this.emit(`ld hl,${fixed}`, ...LOAD_FLOAT_HL);
      else if (slot.kind === "frame") this.emit(...FLOAT_REGS.map((r, k) => `ld ${r},${ixd(slot.offset + k)}`));
      else if (slot.kind === "deref") {
        this.gen(slot.ptr);
        this.emit(...LOAD_FLOAT_HL);
      } else decline();
      return;
    }
    if (cls === "r32") {
      if (fixed !== undefined) this.emit(`ld hl,(${fixed})`, `ld de,(${fixed}+2)`);
      else if (slot.kind === "frame") {
        const d = slot.offset;
        this.emit(`ld l,${ixd(d)}`, `ld h,${ixd(d + 1)}`, `ld e,${ixd(d + 2)}`, `ld d,${ixd(d + 3)}`);
      } else if (slot.kind === "deref") {
        this.gen(slot.ptr);
        this.emit("ld e,(hl)", "inc hl", "ld d,(hl)", "inc hl", "ld a,(hl)", "inc hl", "ld h,(hl)", "ld l,a", "ex de,hl");
      } else decline();
      return;
    }
    if (fixed !== undefined) {
      this.emit(cls === "r8" ? `ld a,(${fixed})` : `ld hl,(${fixed})`);
      return;
    }
    if (slot.kind === "frame") {
      if (cls === "r8") this.emit(`ld a,${ixd(slot.offset)}`);
      else this.emit(`ld l,${ixd(slot.offset)}`, `ld h,${ixd(slot.offset + 1)}`);
      return;
    }
    if (slot.kind !== "deref") return decline();
    this.gen(slot.ptr);
    if (cls === "r8") this.emit("ld a,(hl)");
    else this.emit("ld a,(hl)", "inc hl", "ld h,(hl)", "ld l,a");
  }

  private addr(slot: Slot): void {
    const fixed = fixedAddress(slot);
    if (fixed !== undefined) this.emit(`ld hl,${fixed}`);
    else if (slot.kind === "frame") this.emit("push ix", "pop hl", `ld de,${slot.offset}`, "add hl,de");
    else decline();
  }

  // ----------------------------------------------------------------------------------------------
  // Stores

  private root(i: Instr): void {
    if (i.op === "call") return this.userCall(i);
    if (i.op === "rtcall") return this.runtimeCall(i);
    if (i.op !== "store") return decline();
    const cls = regClassOf(i.type);
    const fixed = fixedAddress(i.slot);
    if (cls === "r32") return this.store32(i.slot, i.src);
    if (cls === "rflt") return this.storeFloat(i.slot, i.src);
    if (i.slot.kind === "frame") {
      const d = i.slot.offset;
      const imm = this.constant(i.src);
      if (imm !== undefined) {
        if (cls === "r8") this.emit(`ld ${ixd(d)},${imm & 0xff}`);
        else this.emit(`ld ${ixd(d)},${imm & 0xff}`, `ld ${ixd(d + 1)},${(imm >> 8) & 0xff}`);
        return;
      }
      this.gen(i.src);
      if (cls === "r8") this.emit(`ld ${ixd(d)},a`);
      else this.emit(`ld ${ixd(d)},l`, `ld ${ixd(d + 1)},h`);
      return;
    }
    if (fixed !== undefined) {
      this.gen(i.src);
      this.emit(cls === "r8" ? `ld (${fixed}),a` : `ld (${fixed}),hl`);
      return;
    }
    if (i.slot.kind !== "deref") return decline();
    // --- Through a pointer: the pointer into HL, the value into A / DE
    const ptr = i.slot.ptr;
    if (!this.mayReorder(ptr, i.src)) {
      // --- In MIR order: the pointer first, saved while the value is computed
      this.gen(ptr);
      this.emit("push hl");
      this.gen(i.src);
      if (cls === "r8") this.emit("pop hl", "ld (hl),a");
      else this.emit("ex de,hl", "pop hl", "ld (hl),e", "inc hl", "ld (hl),d");
      return;
    }
    if (cls === "r8") {
      const leaf = this.leaf8(i.src);
      if (leaf !== undefined && !leaf.startsWith("(")) {
        this.gen(ptr);
        this.emit(`ld (hl),${leaf}`);
        return;
      }
      this.gen(i.src);
      if (this.isLeaf16(ptr)) {
        this.genPtrKeepingA(ptr);
      } else {
        this.emit("push af");
        this.gen(ptr);
        this.emit("pop af");
      }
      this.emit("ld (hl),a");
      return;
    }
    if (this.isLeaf16(i.src)) {
      this.gen(ptr);
      this.leafToDe(i.src);
    } else {
      this.gen(i.src);
      this.emit("push hl");
      this.gen(ptr);
      this.emit("pop de");
    }
    this.emit("ld (hl),e", "inc hl", "ld (hl),d");
  }

  /** A Float store: A-E-D-C-B to a global, a frame slot or through a pointer (MIR order). */
  private storeFloat(slot: Slot, src: Value): void {
    const fixed = fixedAddress(slot);
    if (fixed !== undefined) {
      this.gen(src);
      this.emit(`ld hl,${fixed}`, ...STORE_FLOAT_HL);
      return;
    }
    if (slot.kind === "frame") {
      this.gen(src);
      this.emit(...FLOAT_REGS.map((r, k) => `ld ${ixd(slot.offset + k)},${r}`));
      return;
    }
    if (slot.kind !== "deref") return decline();
    this.gen(slot.ptr);
    this.emit("push hl");
    this.gen(src);
    this.emit("pop hl", ...STORE_FLOAT_HL);
  }

  /** A 32-bit (or Fixed) store: DE:HL to a global, a frame slot or through a pointer (MIR order). */
  private store32(slot: Slot, src: Value): void {
    const fixed = fixedAddress(slot);
    if (fixed !== undefined) {
      this.gen(src);
      this.emit(`ld (${fixed}),hl`, `ld (${fixed}+2),de`);
      return;
    }
    if (slot.kind === "frame") {
      const d = slot.offset;
      const k = this.constant(src);
      if (k !== undefined) {
        const [low, high] = words32(String(k));
        this.emit(`ld ${ixd(d)},${low & 0xff}`, `ld ${ixd(d + 1)},${low >> 8}`, `ld ${ixd(d + 2)},${high & 0xff}`, `ld ${ixd(d + 3)},${high >> 8}`);
        return;
      }
      this.gen(src);
      this.emit(`ld ${ixd(d)},l`, `ld ${ixd(d + 1)},h`, `ld ${ixd(d + 2)},e`, `ld ${ixd(d + 3)},d`);
      return;
    }
    if (slot.kind !== "deref") return decline();
    this.gen(slot.ptr);
    this.emit("push hl");
    this.gen(src);
    this.emit("ld b,h", "ld c,l", "pop hl", "ld (hl),c", "inc hl", "ld (hl),b", "inc hl", "ld (hl),e", "inc hl", "ld (hl),d");
  }

  /**
   * A SUB or FUNCTION call: the arguments evaluated last first (plan Q1) and pushed in ABI order; a
   * FASTCALL routine's first argument stays in its accumulator. A FUNCTION's result is in its
   * accumulator afterwards.
   */
  private userCall(i: Extract<Instr, { op: "call" }>): void {
    for (let k = i.args.length - 1; k >= 0; k--) {
      this.gen(i.args[k]);
      if (k > 0 || i.convention === "stdcall") {
        const cls = regClassOf(i.args[k].type);
        this.emit(...(cls === "r8" ? ["push af"] : cls === "r32" ? ["push de", "push hl"] : cls === "rflt" ? PUSH_FLOAT : ["push hl"]));
      }
    }
    this.ctx.emitCall(`call ${i.target}`, i.site);
  }

  /**
   * A runtime call with at most one computed argument: that one is computed into its accumulator and
   * moved to the register the routine takes it in; the constants are loaded after it, into their
   * own registers (the register contract of RUNTIME_ARGS never shares one).
   */
  private runtimeCall(i: Extract<Instr, { op: "rtcall" }>): void {
    const regs = RUNTIME_ARGS[i.name];
    const computed = i.args.map((a, k) => ({ a, k })).filter(({ a }) => this.constant(a) === undefined && a.kind === "vreg");
    if (computed.length > 1) return decline();
    for (const { a, k } of computed) {
      this.gen(a);
      const reg = regs[k];
      const cls = regClassOf(a.type);
      if (cls === "r8" && reg !== "a") {
        if (reg.length !== 1) return decline();
        this.emit(`ld ${reg},a`);
      } else if (cls === "r16" && reg !== "hl") {
        if (reg === "de") this.emit("ex de,hl");
        else if (reg === "bc") this.emit("ld b,h", "ld c,l");
        else return decline();
      } else if (cls === "r32" && reg !== "dehl") return decline();
      else if (cls === "rflt" && reg !== "aedcb") return decline();
    }
    i.args.forEach((a, k) => {
      if (computed.some((c) => c.k === k)) return;
      const value = this.constant(a) ?? (a.kind !== "vreg" ? immText(a) : decline());
      if (regs[k] === "aedcb") decline();
      if (regs[k] === "dehl") {
        const [low, high] = words32(String(value));
        this.emit(`ld hl,${low}`, `ld de,${high}`);
      } else this.emit(`ld ${regs[k]},${value}`);
    });
    this.emit(`call ${this.ctx.rt(i.name)}`);
  }

  /** A leaf pointer into HL without touching A. */
  private genPtrKeepingA(ptr: Value): void {
    if (ptr.kind !== "vreg") return this.emit(`ld hl,${immText(ptr)}`);
    const d = this.def(ptr).instr;
    if (d.op === "const") this.emit(`ld hl,${immText(d.value)}`);
    else if (d.op === "load" && d.slot.kind === "frame") this.emit(`ld l,${ixd(d.slot.offset)}`, `ld h,${ixd(d.slot.offset + 1)}`);
    else if (d.op === "load" && fixedAddress(d.slot) !== undefined) this.emit(`ld hl,(${fixedAddress(d.slot)})`);
    else if (d.op === "addr" && fixedAddress(d.slot) !== undefined) this.emit(`ld hl,${fixedAddress(d.slot)}`);
    else decline();
  }

  private constant(v: Value): number | undefined {
    if (v.kind === "imm") return v.type === "bool" ? v.value & 1 : v.value;
    if (v.kind !== "vreg") return undefined;
    const d = this.def(v).instr;
    return d.op === "const" && d.value.kind === "imm" ? (d.value.type === "bool" ? d.value.value & 1 : d.value.value) : undefined;
  }

  // ----------------------------------------------------------------------------------------------
  // Arithmetic

  private binary(op: BinOp, dst: VReg, a: Value, b: Value): void {
    const cls = regClassOf(a.type);
    if (!isSupportedType(a.type)) return decline();
    if (cls === "r32") return this.binary32(op, a, b);
    if (cls === "rflt") return this.binaryFloat(op, a, b);
    if (cls !== "r8" && cls !== "r16") return decline();
    if (COMPARISONS.has(op)) {
      const cc = this.compare(op, a, b);
      this.materialize(cc);
      return;
    }
    if (op === "pow") return decline();
    if (this.strengthReduced(op, a, b, cls)) return;
    if (op === "shl" || op === "shr") return decline();
    if (cls === "r8") this.binary8(op, a, b);
    else this.binary16(op, dst, a, b);
  }

  /**
   * Strength reduction (plan §7.2 step 4) where the right operand is a constant: shifts by a
   * constant as straight-line shifts; multiplication as shift-and-add when that is short; unsigned
   * division and modulo by a power of two as a shift and a mask. False when none applies.
   */
  private strengthReduced(op: BinOp, a: Value, b: Value, cls: string): boolean {
    const k = this.constant(b);
    if (k === undefined) return false;
    const bits = cls === "r8" ? 8 : 16;
    const n = k & (bits === 8 ? 0xff : 0xffff);
    const signed = isSignedM(a.type);
    const log2 = n > 0 && (n & (n - 1)) === 0 ? Math.log2(n) : -1;
    if (op === "shl" || op === "shr") {
      this.gen(a);
      this.shift(op, n, cls, signed);
      return true;
    }
    if (op === "mul") {
      if (n === 0) {
        this.gen(a);
        this.emit(cls === "r8" ? "xor a" : "ld hl,0");
        return true;
      }
      if (log2 >= 0) {
        this.gen(a);
        this.shift("shl", log2, cls, false);
        return true;
      }
      // --- Shift-and-add: one doubling per bit below the top one, one add per further set bit
      const length = n.toString(2).length;
      const ones = n.toString(2).split("").filter((c) => c === "1").length;
      if (length - 1 + ones - 1 > 8) return false;
      this.gen(a);
      this.emit(cls === "r8" ? "ld e,a" : "ld d,h", ...(cls === "r8" ? [] : ["ld e,l"]));
      for (let bit = length - 2; bit >= 0; bit--) {
        this.emit(cls === "r8" ? "add a,a" : "add hl,hl");
        if ((n >> bit) & 1) this.emit(cls === "r8" ? "add a,e" : "add hl,de");
      }
      return true;
    }
    if ((op === "div" || op === "mod") && !signed && log2 >= 0) {
      this.gen(a);
      if (op === "div") this.shift("shr", log2, cls, false);
      else if (cls === "r8") this.emit(`and ${n - 1}`);
      else if (n - 1 <= 0xff) this.emit("ld a,l", `and ${n - 1}`, "ld l,a", "ld h,0");
      else this.emit("ld a,h", `and ${(n - 1) >> 8}`, "ld h,a");
      return true;
    }
    return false;
  }

  /** The accumulator shifted by a constant count, straight-line (whole bytes moved at once for 16-bit). */
  private shift(op: "shl" | "shr" | BinOp, count: number, cls: string, signed: boolean): void {
    const bits = cls === "r8" ? 8 : 16;
    if (count >= bits) {
      if (op === "shl" || !signed) this.emit(cls === "r8" ? "xor a" : "ld hl,0");
      else this.emit(...(cls === "r8" ? ["add a,a", "sbc a,a"] : ["ld a,h", "add a,a", "sbc a,a", "ld h,a", "ld l,a"]));
      return;
    }
    let n = count;
    if (cls === "r8") {
      for (let i = 0; i < n; i++) this.emit(op === "shl" ? "add a,a" : signed ? "sra a" : "srl a");
      return;
    }
    if (n >= 8) {
      if (op === "shl") this.emit("ld h,l", "ld l,0");
      else if (signed) this.emit("ld l,h", "ld a,h", "add a,a", "sbc a,a", "ld h,a");
      else this.emit("ld l,h", "ld h,0");
      n -= 8;
    }
    // --- A right shift costs 4 bytes a bit: past two bits a djnz loop is shorter
    const step = op === "shl" ? ["add hl,hl"] : [signed ? "sra h" : "srl h", "rr l"];
    this.repeat(step, n, op === "shl" ? 7 : 2);
  }

  /** `step` n times: straight-line up to `inline` times, otherwise a djnz loop on B. */
  private repeat(step: string[], n: number, inline: number): void {
    if (n <= inline) {
      for (let i = 0; i < n; i++) this.emit(...step);
      return;
    }
    const loop = this.ctx.local();
    this.emit(`ld b,${n}`);
    this.ctx.label(loop);
    this.emit(...step, `djnz ${loop}`);
  }

  private binary8(op: BinOp, a: Value, b: Value): void {
    const alu: Partial<Record<BinOp, string>> = { add: "add a,", sub: "sub ", and: "and ", land: "and ", or: "or ", lor: "or ", xor: "xor ", lxor: "xor " };
    const commutative = op === "add" || op === "and" || op === "or" || op === "xor" || op === "land" || op === "lor" || op === "lxor";
    if (alu[op]) {
      // --- The right operand where it is; for a commutative operator either side may be the leaf
      let [left, right] = [a, b];
      if (commutative && !this.isLeaf8(right) && this.isLeaf8(left) && this.mayReorder(a, b)) [left, right] = [b, a];
      const k = this.constant(right);
      if (k !== undefined && op === "add" && (k & 0xff) === 1) {
        this.gen(left);
        this.emit("inc a");
        return;
      }
      if (k !== undefined && op === "sub" && (k & 0xff) === 1) {
        this.gen(left);
        this.emit("dec a");
        return;
      }
      if (this.operand8(left, right, (text) => this.emit(`${alu[op]}${text}`))) return;
    }
    // --- The runtime operators take the left in A and the right in H (level 0's convention)
    this.pairIn(a, b, "h");
    switch (op) {
      case "mul":
        return this.emit(`call ${this.ctx.rt("core.Mul8")}`);
      case "div":
        return this.emit(`call ${this.ctx.rt(isSignedM(a.type) ? "core.DivModI8" : "core.DivModU8")}`);
      case "mod":
        return this.emit(`call ${this.ctx.rt(isSignedM(a.type) ? "core.DivModI8" : "core.DivModU8")}`, "ld a,l");
      default:
        if (alu[op]) return this.emit(`${alu[op]}h`);
        return decline();
    }
  }

  /**
   * The left operand into A and `apply` with the right one as an operand text: an immediate, an IX
   * slot, or `(hl)` for a global. False when the right operand is not a leaf.
   */
  private operand8(left: Value, right: Value, apply: (text: string) => void): boolean {
    const leaf = this.leaf8(right);
    if (leaf !== undefined) {
      this.gen(left);
      apply(leaf);
      return true;
    }
    const global = this.global8(right);
    if (global !== undefined) {
      this.gen(left);
      this.emit(`ld hl,${global}`);
      apply("(hl)");
      return true;
    }
    return false;
  }

  /** Both 8-bit operands computed: the left into A, the right into `reg` (h or e). */
  private pairIn(a: Value, b: Value, reg: string): void {
    const leaf = this.leaf8(b);
    if (leaf !== undefined) {
      this.gen(a);
      this.emit(`ld ${reg},${leaf}`);
      return;
    }
    const global = this.global8(b);
    if (global !== undefined && reg === "h") {
      this.gen(a);
      this.emit(`ld hl,${global}`, "ld h,(hl)");
      return;
    }
    // --- A leaf left operand waits: the right is computed first and kept in `reg`
    if (this.isLeaf8(a) && !this.global8(a) && this.mayReorder(a, b)) {
      this.gen(b);
      this.emit(`ld ${reg},a`);
      this.gen(a);
      return;
    }
    // --- Otherwise MIR order, the left saved while the right is computed (also the shorter way)
    this.gen(a);
    this.emit("push af");
    this.gen(b);
    this.emit(`ld ${reg},a`, "pop af");
  }

  private binary16(op: BinOp, dst: VReg, a: Value, b: Value): void {
    void dst;
    const k = this.constant(b);
    if (k !== undefined && (op === "add" || op === "sub")) {
      const step = op === "add" ? k & 0xffff : -k & 0xffff;
      if (step <= 3 || step >= 0xfffd) {
        this.gen(a);
        const n = step <= 3 ? step : 0x10000 - step;
        for (let i = 0; i < n; i++) this.emit(step <= 3 ? "inc hl" : "dec hl");
        return;
      }
    }
    const commutative = op === "add" || op === "and" || op === "or" || op === "xor";
    let [left, right] = [a, b];
    if (commutative && !this.isLeaf16(right) && this.isLeaf16(left) && this.mayReorder(a, b)) [left, right] = [b, a];
    this.pair16(left, right);
    switch (op) {
      case "add":
        return this.emit("add hl,de");
      case "sub":
        return this.emit("and a", "sbc hl,de");
      case "and":
      case "or":
      case "xor":
        return this.emit("ld a,h", `${op} d`, "ld h,a", "ld a,l", `${op} e`, "ld l,a");
      case "mul":
        return this.emit(`call ${this.ctx.rt("core.Mul16")}`);
      case "div":
        return this.emit(`call ${this.ctx.rt(isSignedM(a.type) ? "core.DivModI16" : "core.DivModU16")}`);
      case "mod":
        return this.emit(`call ${this.ctx.rt(isSignedM(a.type) ? "core.DivModI16" : "core.DivModU16")}`, "ex de,hl");
      default:
        return decline();
    }
  }

  /** The left 16-bit operand into HL and the right into DE. */
  private pair16(left: Value, right: Value): void {
    if (this.isLeaf16(right)) {
      this.gen(left);
      this.leafToDe(right);
      return;
    }
    if (!this.mayReorder(left, right)) {
      // --- In MIR order: the left saved while the right is computed
      this.gen(left);
      this.emit("push hl");
      this.gen(right);
      this.emit("ex de,hl", "pop hl");
      return;
    }
    this.gen(right);
    if (this.isLeaf16(left)) {
      this.emit("ex de,hl");
      this.genKeepingDe(left);
      return;
    }
    this.emit("push hl");
    this.gen(left);
    this.emit("pop de");
  }

  /** A leaf 16-bit value into HL without touching DE. */
  private genKeepingDe(v: Value): void {
    this.genPtrKeepingA(v);
  }

  /**
   * Compares left with right and gives the condition code under which the comparison holds. gt and
   * le compare the other way round; signed operands are compared with their sign bits flipped.
   */
  private compare(op: BinOp, a: Value, b: Value): string {
    const cls = regClassOf(a.type);
    if (cls === "r32") return this.compare32(op, a, b);
    if (cls === "rflt") {
      this.binaryFloat(op, a, b);
      this.emit("or a");
      return "nz";
    }
    let left = a;
    let right = b;
    let cmp = op;
    if (op === "gt" || op === "le") {
      cmp = op === "gt" ? "lt" : "ge";
      if (!this.mayReorder(a, b)) {
        // --- In MIR order, then the operands swapped in their registers: b - a
        const signed = isSignedM(a.type);
        if (cls === "r8") {
          this.pairIn(a, b, "h");
          this.emit("ld l,a", "ld a,h", "ld h,l");
          if (signed) this.emit("xor $80", "ld l,a", "ld a,h", "xor $80", "ld h,a", "ld a,l");
          this.emit("cp h");
        } else {
          this.pair16(a, b);
          this.emit("ex de,hl");
          if (signed) this.emit("ld a,h", "xor $80", "ld h,a", "ld a,d", "xor $80", "ld d,a");
          this.emit("and a", "sbc hl,de");
        }
        return TRUE_WHEN[cmp]!;
      }
      [left, right] = [b, a];
    }
    const ordered = cmp !== "eq" && cmp !== "ne";
    const signed = isSignedM(a.type) && ordered;
    if (cls === "r8") {
      const k = this.constant(right);
      if (k !== undefined) {
        this.gen(left);
        if (signed) this.emit("xor $80");
        this.emit(k === 0 && !signed && !ordered ? "or a" : `cp ${signed ? (k ^ 0x80) & 0xff : k & 0xff}`);
      } else if (!signed && this.operand8(left, right, (text) => this.emit(`cp ${text}`))) {
        // --- compared in place
      } else {
        this.pairIn(left, right, "h");
        if (signed) this.emit("xor $80", "ld l,a", "ld a,h", "xor $80", "ld h,a", "ld a,l");
        this.emit("cp h");
      }
    } else if (cls === "r16") {
      const k = this.constant(right);
      if (k === 0 && !ordered) {
        this.gen(left);
        this.emit("ld a,h", "or l");
      } else {
        this.pair16(left, right);
        if (signed) this.emit("ld a,h", "xor $80", "ld h,a", "ld a,d", "xor $80", "ld d,a");
        this.emit("and a", "sbc hl,de");
      }
    } else decline();
    return TRUE_WHEN[cmp] ?? decline();
  }

  /** The bool of a condition code into A (0 or 1). */
  private materialize(cc: string): void {
    if (cc === "c") return this.emit("sbc a,a", "neg");
    if (cc === "nc") return this.emit("ccf", "sbc a,a", "neg");
    const skip = this.ctx.local();
    this.emit("ld a,0", `jr ${INVERT[cc]},${skip}`, "inc a");
    this.ctx.label(skip);
  }

  private unary(op: "neg" | "not" | "lnot", a: Value): void {
    const cls = regClassOf(a.type);
    this.gen(a);
    if (op === "lnot") this.emit("xor 1");
    else if (cls === "rflt" && op === "neg") this.emit("ld l,$1b", `call ${this.ctx.rt("core.FUnary")}`);
    else if (cls === "rflt") return decline();
    else if (cls === "r32" && op === "neg") this.emit("xor a", "sub l", "ld l,a", "ld a,0", "sbc a,h", "ld h,a", "ld a,0", "sbc a,e", "ld e,a", "ld a,0", "sbc a,d", "ld d,a");
    else if (cls === "r32") this.emit("ld a,h", "cpl", "ld h,a", "ld a,l", "cpl", "ld l,a", "ld a,d", "cpl", "ld d,a", "ld a,e", "cpl", "ld e,a");
    else if (cls === "r8") this.emit(op === "neg" ? "neg" : "cpl");
    else if (op === "neg") this.emit("xor a", "sub l", "ld l,a", "sbc a,a", "sub h", "ld h,a");
    else this.emit("ld a,h", "cpl", "ld h,a", "ld a,l", "cpl", "ld l,a");
  }

  private conv(dst: VReg, a: Value): void {
    const from = regClassOf(a.type);
    const to = regClassOf(dst.type);
    this.gen(a);
    if (a.type === "fix" && dst.type === "flt") return this.emit(`call ${this.ctx.rt("core.FFromFixed")}`);
    if (a.type === "flt" && dst.type === "fix") return this.emit(`call ${this.ctx.rt("core.FToFixed")}`);
    if ((a.type === "fix") !== (dst.type === "fix")) return this.convFixed(a.type, dst.type);
    if (from === to) return;
    if (to === "rflt") return this.toFloat(a.type);
    if (from === "rflt") {
      // --- Rounded towards minus infinity, taken modulo 2^32, then narrowed (as level 0)
      this.emit(`call ${this.ctx.rt("core.FToI32")}`);
      if (to === "r8") this.emit("ld a,l");
      return;
    }
    const signed = isSignedM(a.type);
    if (from === "r8" && to === "r16") {
      if (signed) this.emit("ld l,a", "add a,a", "sbc a,a", "ld h,a");
      else this.emit("ld l,a", "ld h,0");
    } else if (from === "r16" && to === "r8") this.emit("ld a,l");
    else if (from === "r8" && to === "r32") {
      if (signed) this.emit("ld l,a", "add a,a", "sbc a,a", "ld h,a", "ld e,a", "ld d,a");
      else this.emit("ld l,a", "ld h,0", "ld de,0");
    } else if (from === "r16" && to === "r32") {
      if (signed) this.emit("ld a,h", "add a,a", "sbc a,a", "ld e,a", "ld d,a");
      else this.emit("ld de,0");
    } else if (from === "r32" && to === "r16") {
      // --- The low word is already in HL
    } else if (from === "r32" && to === "r8") this.emit("ld a,l");
    else decline();
  }

  /** To or from Fixed (16.16 in DE:HL), as level 0 does it: an integer n is n * 65536; a Fixed as an integer is its integer part. */
  private convFixed(from: MType, to: MType): void {
    if (to === "fix") {
      const cls = regClassOf(from);
      if (from === "flt") return decline();
      if (cls === "r8") this.emit(...(isSignedM(from) ? ["ld e,a", "add a,a", "sbc a,a", "ld d,a"] : ["ld e,a", "ld d,0"]));
      else this.emit("ex de,hl");
      this.emit("ld hl,0");
      return;
    }
    if (to === "flt") return decline();
    const cls = regClassOf(to);
    if (cls === "r8") return this.emit("ld a,e");
    this.emit("ex de,hl");
    if (cls === "r32") this.emit("ld a,h", "add a,a", "sbc a,a", "ld e,a", "ld d,a");
  }

  // ----------------------------------------------------------------------------------------------
  // Float (A-E-D-C-B, through the ROM calculator)

  /**
   * A Float operator as level 0 does it (the ROM calculator gives no better way): the left operand
   * on the stack, the right in A-E-D-C-B, the operation in L. A comparison leaves its bool in A.
   */
  private binaryFloat(op: BinOp, a: Value, b: Value): void {
    this.gen(a);
    this.emit(...PUSH_FLOAT);
    this.gen(b);
    if (op === "mod") return this.emit(`call ${this.ctx.rt("core.FMod")}`);
    const compare = FLOAT_COMPARE[op];
    if (compare !== undefined) return this.emit(`ld l,${compare}`, `call ${this.ctx.rt("core.FCompare")}`);
    const binary = FLOAT_BINARY[op];
    if (binary === undefined) return decline();
    this.emit(`ld l,${binary}`, `call ${this.ctx.rt("core.FBinary")}`);
  }

  /** An integer as a Float: 8- and 16-bit values in the ROM's small-integer form, built inline; 32-bit through the runtime. */
  private toFloat(type: MType): void {
    const cls = regClassOf(type);
    const signed = isSignedM(type);
    if (cls === "r32") return this.emit(`call ${this.ctx.rt(signed ? "core.FFromI32" : "core.FFromU32")}`);
    if (cls === "r8") this.emit(...(signed ? ["ld l,a", "add a,a", "sbc a,a", "ld h,a"] : ["ld l,a", "ld h,0"]));
    this.emit(...(signed ? ["ld a,h", "add a,a", "sbc a,a", "ld e,a"] : ["ld e,0"]), "ld d,l", "ld c,h", "xor a", "ld b,a");
  }

  // ----------------------------------------------------------------------------------------------
  // 32-bit and Fixed values (DE:HL, the low word in HL)

  /** A leaf 32-bit operand's two words as `ld bc,...` loads: [low, high], or undefined. */
  private words32Of(v: Value): [string[], string[]] | undefined {
    const k = this.constant(v);
    if (k !== undefined) {
      const [low, high] = words32(String(k));
      return [[`ld bc,${low}`], [`ld bc,${high}`]];
    }
    if (v.kind !== "vreg") return undefined;
    const d = this.def(v).instr;
    if (d.op !== "load") return undefined;
    const fixed = fixedAddress(d.slot);
    if (fixed !== undefined) return [[`ld bc,(${fixed})`], [`ld bc,(${fixed}+2)`]];
    if (d.slot.kind === "frame") {
      const o = d.slot.offset;
      return [
        [`ld c,${ixd(o)}`, `ld b,${ixd(o + 1)}`],
        [`ld c,${ixd(o + 2)}`, `ld b,${ixd(o + 3)}`]
      ];
    }
    return undefined;
  }

  /** The left operand on the stack (low word on top) and the right in DE:HL, in MIR order. */
  private stack32(a: Value, b: Value): void {
    this.gen(a);
    this.emit("push de", "push hl");
    this.gen(b);
  }

  private binary32(op: BinOp, a: Value, b: Value): void {
    const fix = a.type === "fix";
    const signed = isSignedM(a.type);
    if (COMPARISONS.has(op)) return this.materialize(this.compare32(op, a, b));
    if (!fix && this.strength32(op, a, b)) return;
    // --- Add and subtract with a leaf right operand: in place, word by word through BC
    const words = op === "add" || op === "sub" ? this.words32Of(b) : undefined;
    if (words) {
      this.gen(a);
      if (op === "add") this.emit(...words[0], "add hl,bc", "ex de,hl", ...words[1], "adc hl,bc", "ex de,hl");
      else this.emit(...words[0], "and a", "sbc hl,bc", "ex de,hl", ...words[1], "sbc hl,bc", "ex de,hl");
      return;
    }
    this.stack32(a, b);
    const bytewise = (alu: string) =>
      this.emit("pop bc", "ld a,l", `${alu} c`, "ld l,a", "ld a,h", `${alu} b`, "ld h,a", "pop bc", "ld a,e", `${alu} c`, "ld e,a", "ld a,d", `${alu} b`, "ld d,a");
    switch (op) {
      case "add":
        return this.emit("pop bc", "add hl,bc", "ex de,hl", "pop bc", "adc hl,bc", "ex de,hl");
      case "sub":
        return this.emit("ld b,d", "ld c,e", "ex de,hl", "pop hl", "and a", "sbc hl,de", "ex (sp),hl", "sbc hl,bc", "ex de,hl", "pop hl");
      case "and":
      case "or":
      case "xor":
        return bytewise(op);
      case "mul":
        return this.emit(`call ${this.ctx.rt(fix ? "core.FixMul" : "core.Mul32")}`);
      case "div":
        return this.emit(`call ${this.ctx.rt(fix ? "core.FixDiv" : signed ? "core.DivI32" : "core.DivU32")}`);
      case "mod":
        if (fix) return decline();
        return this.emit(`call ${this.ctx.rt(signed ? "core.ModI32" : "core.ModU32")}`);
      default:
        return decline();
    }
  }

  /** 32-bit strength reduction: constant shifts, multiplication by a power of two, unsigned div/MOD by one. */
  private strength32(op: BinOp, a: Value, b: Value): boolean {
    const k = this.constant(b);
    if (k === undefined) return false;
    const n = k >>> 0;
    const signed = isSignedM(a.type);
    const log2 = n > 0 && (n & (n - 1)) === 0 ? Math.log2(n) : -1;
    if (op === "shl" || op === "shr") {
      this.gen(a);
      this.shift32(op, n & 0xff, signed);
      return true;
    }
    if (op === "mul" && log2 >= 0) {
      this.gen(a);
      this.shift32("shl", log2, false);
      return true;
    }
    if ((op === "div" || op === "mod") && !signed && log2 >= 0) {
      this.gen(a);
      if (op === "div") {
        this.shift32("shr", log2, false);
        return true;
      }
      // --- The mask n - 1, byte by byte: 0xff bytes stay, 0 bytes clear
      const mask = (n - 1) >>> 0;
      const regs = ["l", "h", "e", "d"];
      regs.forEach((r, i) => {
        const m = (mask >>> (8 * i)) & 0xff;
        if (m === 0xff) return;
        if (m === 0) this.emit(`ld ${r},0`);
        else this.emit(`ld a,${r}`, `and ${m}`, `ld ${r},a`);
      });
      return true;
    }
    return false;
  }

  private shift32(op: "shl" | "shr", count: number, signed: boolean): void {
    let n = count;
    if (n >= 32) {
      if (op === "shl" || !signed) this.emit("ld hl,0", "ld de,0");
      else this.emit("ld a,d", "add a,a", "sbc a,a", "ld h,a", "ld l,a", "ld d,a", "ld e,a");
      return;
    }
    if (n >= 16) {
      if (op === "shl") this.emit("ex de,hl", "ld hl,0");
      else if (signed) this.emit("ex de,hl", "ld a,h", "add a,a", "sbc a,a", "ld d,a", "ld e,a");
      else this.emit("ex de,hl", "ld de,0");
      n -= 16;
    }
    // --- 5 (left) or 8 (right) bytes a bit: past two bits a djnz loop is shorter
    const step = op === "shl" ? ["add hl,hl", "ex de,hl", "adc hl,hl", "ex de,hl"] : [signed ? "sra d" : "srl d", "rr e", "rr h", "rr l"];
    this.repeat(step, n, 2);
  }

  /**
   * Compares two 32-bit values and gives the condition code under which the comparison holds; signed
   * ones (and Fixed) with their sign bits flipped. A leaf right operand is compared in place;
   * otherwise the left goes on the stack (MIR order) and gt/le swap the two there.
   */
  private compare32(op: BinOp, a: Value, b: Value): string {
    const ordered = op !== "eq" && op !== "ne";
    const signed = isSignedM(a.type) && ordered;
    const cmp: BinOp = op === "gt" ? "lt" : op === "le" ? "ge" : op;
    const swap = op === "gt" || op === "le";
    // --- In place: the left in DE:HL, the right a leaf (for gt/le the leaf is the left operand)
    const [left, right] = swap ? [b, a] : [a, b];
    const words = this.words32Of(right);
    // --- Not for a signed variable on the right: flipping its sign bit between the two word
    // --- subtractions would clear the low word's borrow; a constant is flipped when it is compiled
    const flipsRight = signed && this.constant(right) === undefined;
    if (words && !flipsRight && (!swap || this.mayReorder(a, b))) {
      this.gen(left);
      if (signed) this.emit("ld a,d", "xor $80", "ld d,a");
      const k = this.constant(right);
      const high = signed && k !== undefined ? [`ld bc,${(words32(String(k))[1] ^ 0x8000) & 0xffff}`] : words[1];
      if (!ordered) {
        this.emit(...words[0], "and a", "sbc hl,bc", "ld a,h", "or l", "ex de,hl", ...high, "sbc hl,bc", "or h", "or l");
        return TRUE_WHEN[cmp]!;
      }
      this.emit(...words[0], "and a", "sbc hl,bc", "ex de,hl", ...high, "sbc hl,bc");
      return TRUE_WHEN[cmp]!;
    }
    this.stack32(a, b);
    if (swap) this.emit("ex (sp),hl", "pop bc", "ex de,hl", "ex (sp),hl", "push bc", "ex de,hl");
    if (signed) this.emit("ld a,d", "xor $80", "ld d,a");
    this.emit("ld b,d", "ld c,e", "ex de,hl", "pop hl");
    if (signed) this.emit("ex (sp),hl", "ld a,h", "xor $80", "ld h,a", "ex (sp),hl");
    this.emit("and a", "sbc hl,de", "ex (sp),hl", "sbc hl,bc", "pop de");
    if (!ordered) this.emit("ld a,h", "or l", "or d", "or e");
    return TRUE_WHEN[cmp]!;
  }
}

function fixedAddress(slot: Slot): string | undefined {
  if (slot.kind === "global") return slot.name;
  if (slot.kind === "deref" && slot.ptr.kind !== "vreg") return immText(slot.ptr);
  return undefined;
}

/** The low and high words of a 32-bit immediate's text. */
function words32(text: string): [number, number] {
  const v = Number(text);
  if (!Number.isFinite(v)) return decline();
  return [v & 0xffff, (v >>> 16) & 0xffff];
}

function ixd(d: number): string {
  return d < 0 ? `(ix-${-d})` : `(ix+${d})`;
}

function immText(v: Value): string {
  if (v.kind === "imm") return String(v.type === "bool" ? v.value & 1 : v.value);
  if (v.kind === "sym") return symText(v);
  throw new CodegenError("A vreg is not an immediate");
}
