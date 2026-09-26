import {
  COMPARISONS,
  isSignedM,
  regClassOf,
  symText,
  type BinOp,
  type Block,
  type Instr,
  type MFunction,
  type MType,
  type RegClass,
  type Slot,
  type Terminator,
  type Value,
  type VReg
} from "../ir/mir";
import { CodegenError, instr, label, type LirLine } from "./lir";

/**
 * Level-0 instruction selection (`.docs/kbasic-lir-regalloc.md` §4): a stack machine. Every value
 * is computed into the accumulator of its class (A for 8-bit and bool, HL for 16-bit, pointers and
 * Strings); before a new value is computed, the one waiting in the accumulator is pushed. MIR
 * evaluates expressions depth first, so an instruction always finds its last operand in the
 * accumulator and the ones before it on top of the Z80 stack, in order.
 *
 * Nothing stays on the stack across a statement entry (G4); a `stmt` marker checks it.
 */
export function selectFunction(fn: MFunction, runtime: Set<string>): LirLine[] {
  return new Selector(fn, runtime).run();
}

/** Which register each runtime routine takes each argument in (the modules' header comments). */
const RUNTIME_ARGS: Record<string, string[]> = {
  "core.PrintU8": ["a"],
  "core.PrintI8": ["a"],
  "core.PrintU16": ["hl"],
  "core.PrintI16": ["hl"],
  "core.PrintU32": ["dehl"],
  "core.PrintI32": ["dehl"],
  "core.PrintStr": ["hl", "a"],
  "core.PrintTab": ["a"],
  "core.PrintAt": ["b", "c"],
  "core.PrintColour": ["c", "a"],
  "core.StrConcat": ["hl", "de", "a"],
  "core.StrCompare": ["hl", "de", "a"],
  "core.StrSlice": ["hl", "bc", "de", "a"],
  "core.StrLength": ["hl", "a"],
  "core.StrCode": ["hl", "a"],
  "core.StrChr": ["a"],
  "core.StrDup": ["hl"],
  "core.StrStore": ["hl", "de"],
  /** StrStore when the variable's address was computed before the value (a BYREF String). */
  "core.StrStore!addressFirst": ["de", "hl"],
  "core.Free": ["hl"],
  "core.ArrayAlloc": ["hl"],
  "core.ArrayFreeStrings": ["hl", "bc"],
  "core.ArrayInit": ["hl", "de", "bc"],
  "core.ArrayLBound": ["hl", "de"],
  "core.ArrayUBound": ["hl", "de"],
  "core.ColourPermanent": ["c", "a"],
  "core.Border": ["a"],
  "core.Pause": ["hl"],
  "core.FUnary": ["aedcb", "l"],
  "core.FStr": ["aedcb"],
  "core.PrintFloat": ["aedcb"],
  "core.FVal": ["hl", "a"],
  "core.Rnd": [],
  "core.Usr": ["hl"],
  "core.UsrString": ["hl", "a"],
  "core.Randomize": ["dehl"],
  "core.RandomizeFrames": [],
  "core.AbsI8": ["a"],
  "core.AbsI16": ["hl"],
  "core.AbsI32": ["dehl"],
  "core.SgnI8": ["a"],
  "core.SgnI16": ["hl"],
  "core.SgnI32": ["dehl"],
  "core.Inkey": [],
  /** Inline code, not a call: see INLINE. */
  "inline.Out": ["bc", "a"],
  "inline.In": ["bc"],
  "core.PrintComma": [],
  "core.PrintNewline": [],
  "core.PrintReset": [],
  "core.Cls": []
};

/** The code of the `inline.X` pseudo-routines, in place of a call (runtime-abi.md: IN/OUT inline). */
const INLINE: Record<string, string[]> = {
  "inline.Out": ["out (c),a"],
  "inline.In": ["in a,(c)"]
};

/** Where a value of each class lives while it is the current value. */
const ACC: Record<RegClass, string> = { r8: "a", r16: "hl", r32: "dehl", rflt: "aedcb" };

class Selector {
  private readonly out: LirLine[] = [];
  /** The vreg whose value is in the accumulator, if any. */
  private acc: VReg | undefined;
  /** The vregs whose values are on the Z80 stack, innermost last. */
  private stack: VReg[] = [];
  private sid = -1;
  private locals = 0;

  constructor(
    private readonly fn: MFunction,
    private readonly runtime: Set<string>
  ) {}

  run(): LirLine[] {
    for (const block of this.fn.blocks) this.block(block);
    return this.out;
  }

  private block(b: Block): void {
    this.acc = undefined;
    this.stack = [];
    this.out.push(label(b.label, b.instrs[0]?.sid ?? b.term?.sid ?? -1));
    if (b === this.fn.blocks[0] && this.fn.kind !== "main") this.prologue();
    for (const i of b.instrs) {
      this.sid = i.sid;
      this.instruction(i);
    }
    if (b.term) {
      this.sid = b.term.sid;
      this.terminator(b.term);
    }
    if (this.acc || this.stack.length) throw new CodegenError(`Block ${b.label} ends with values left over`);
  }

  // ===============================================================================================
  // Emission helpers

  private emit(...lines: string[]): void {
    for (const l of lines) this.out.push(instr(l, this.sid));
  }

  private rt(name: string): string {
    this.runtime.add(name);
    return name;
  }

  private local(): string {
    return `__k${this.fn.label.replace(/^_/, "")}${this.locals++}`;
  }

  private placeLabel(name: string): void {
    this.out.push(label(name, this.sid));
  }

  // ===============================================================================================
  // The value stack

  /** Pushes the value waiting in the accumulator, before something else is computed there. */
  private spill(): void {
    if (!this.acc) return;
    const cls = regClassOf(this.acc.type);
    if (cls === "r8") this.emit("push af");
    else if (cls === "r16") this.emit("push hl");
    else if (cls === "r32") this.emit("push de", "push hl");
    else this.emit(...PUSH_FLOAT);
    this.stack.push(this.acc);
    this.acc = undefined;
  }

  /** Marks the result of the instruction as being in the accumulator. */
  private produce(dst: VReg): void {
    this.acc = dst;
  }

  /**
   * Takes an instruction's operands. The most recently computed value is always the one in the
   * accumulator, so the last vreg operand is there and the earlier ones are on top of the stack, in
   * order. Returns where each operand is: "acc", "stack" (the caller pops it) or an immediate's text.
   */
  private take(values: Value[]): ("acc" | "stack" | string)[] {
    const vregs = values.filter((v): v is VReg => v.kind === "vreg");
    if (vregs.length) {
      const last = vregs[vregs.length - 1];
      if (this.acc?.id !== last.id) throw new CodegenError(`Operand %${last.id} is not in the accumulator`);
      const earlier = vregs.slice(0, -1);
      const top = this.stack.slice(this.stack.length - earlier.length);
      if (earlier.some((v, k) => top[k]?.id !== v.id)) {
        throw new CodegenError(`Operands ${earlier.map((v) => `%${v.id}`).join(", ")} are not on top of the stack`);
      }
      this.stack.length -= earlier.length;
      this.acc = undefined;
    } else if (this.acc) {
      throw new CodegenError(`%${this.acc.id} is in the accumulator but no instruction uses it`);
    }
    const last = vregs[vregs.length - 1];
    return values.map((v) => (v.kind !== "vreg" ? immText(v) : v === last ? "acc" : "stack"));
  }

  // ===============================================================================================
  // Instructions

  private instruction(i: Instr): void {
    switch (i.op) {
      case "stmt":
        if (this.acc || this.stack.length) throw new CodegenError(`Values cross the entry of statement ${i.sid}`);
        this.out.push({ kind: "marker", marker: "stmt", sid: i.sid });
        return;
      case "prologue.end":
      case "epilogue.begin":
        this.out.push({ kind: "marker", marker: i.op, sid: i.sid });
        return;
      case "asm":
        this.spill();
        for (const line of i.lines) this.out.push(instr(line.trim() || "; (empty)", i.sid));
        return;
      case "const":
        this.spill();
        this.loadImmediate(i.dst.type, immText(i.value));
        this.produce(i.dst);
        return;
      case "load":
        this.load(i.dst, i.slot);
        return;
      case "store":
        this.store(i.type, i.slot, i.src);
        return;
      case "bin":
        this.binary(i.bop, i.dst, i.a, i.b);
        return;
      case "neg":
      case "not":
      case "lnot":
        this.unary(i.op, i.dst, i.a);
        return;
      case "conv":
        this.conv(i.dst, i.a);
        return;
      case "rtcall":
        this.rtcall(i.name, i.args, i.dst);
        return;
      case "addr":
        this.addr(i.dst, i.slot);
        return;
      case "call":
        this.call(i);
        return;
      default:
        throw new CodegenError(`Level 0 cannot select '${(i as { op: string }).op}' yet`);
    }
  }

  private loadImmediate(type: MType, text: string): void {
    const cls = regClassOf(type);
    if (cls === "r8") this.emit(text === "0" ? "xor a" : `ld a,${text}`);
    else if (cls === "r16") this.emit(`ld hl,${text}`);
    else if (cls === "r32") {
      const [low, high] = words32(text);
      this.emit(`ld hl,${low}`, `ld de,${high}`);
    } else throw new CodegenError(`Cannot load a ${type} immediate yet`);
  }

  /** The address text of a slot that has a fixed address, or undefined for one that needs a pointer. */
  private fixedAddress(slot: Slot): string | undefined {
    if (slot.kind === "global") return slot.name;
    if (slot.kind === "deref" && slot.ptr.kind !== "vreg") return immText(slot.ptr);
    return undefined;
  }

  private load(dst: VReg, slot: Slot): void {
    const cls = regClassOf(dst.type);
    const fixed = this.fixedAddress(slot);
    if (fixed !== undefined) {
      this.spill();
      if (cls === "r8") this.emit(`ld a,(${fixed})`);
      else if (cls === "r16") this.emit(`ld hl,(${fixed})`);
      else if (cls === "r32") this.emit(`ld hl,(${fixed})`, `ld de,(${fixed}+2)`);
      else this.emit(`ld hl,${fixed}`, ...LOAD_FLOAT_HL);
      this.produce(dst);
      return;
    }
    if (slot.kind === "deref") {
      this.take([slot.ptr]);
      if (cls === "r8") this.emit("ld a,(hl)");
      else if (cls === "r16") this.emit("ld a,(hl)", "inc hl", "ld h,(hl)", "ld l,a");
      else if (cls === "r32") this.emit("ld e,(hl)", "inc hl", "ld d,(hl)", "inc hl", "ld a,(hl)", "inc hl", "ld h,(hl)", "ld l,a", "ex de,hl");
      else this.emit(...LOAD_FLOAT_HL);
      this.produce(dst);
      return;
    }
    // --- A frame slot
    this.spill();
    const d = (slot as { offset: number }).offset;
    if (cls === "r8") this.emit(`ld a,${ixd(d)}`);
    else if (cls === "r16") this.emit(`ld l,${ixd(d)}`, `ld h,${ixd(d + 1)}`);
    else if (cls === "r32") this.emit(`ld l,${ixd(d)}`, `ld h,${ixd(d + 1)}`, `ld e,${ixd(d + 2)}`, `ld d,${ixd(d + 3)}`);
    else this.emit(...FLOAT_REGS.map((r, k) => `ld ${r},${ixd(d + k)}`));
    this.produce(dst);
  }

  private store(type: MType, slot: Slot, src: Value): void {
    const cls = regClassOf(type);
    const fixed = this.fixedAddress(slot);
    if (fixed !== undefined) {
      const [place] = this.take([src]);
      if (place !== "acc") this.loadImmediate(type, place);
      if (cls === "r8") this.emit(`ld (${fixed}),a`);
      else if (cls === "r16") this.emit(`ld (${fixed}),hl`);
      else if (cls === "r32") this.emit(`ld (${fixed}),hl`, `ld (${fixed}+2),de`);
      else this.emit(`ld hl,${fixed}`, ...STORE_FLOAT_HL);
      return;
    }
    if (slot.kind === "deref") {
      // --- The pointer was computed first (on the stack, or in the accumulator when the value is
      // --- an immediate), then the value
      const [ptr, value] = this.take([slot.ptr, src]);
      if (cls === "r8") {
        if (value === "acc") this.emit("pop hl", "ld (hl),a");
        else this.emit(`ld (hl),${value}`);
        void ptr;
      } else if (cls === "r16") {
        if (value === "acc") this.emit("ex de,hl", "pop hl", "ld (hl),e", "inc hl", "ld (hl),d");
        else this.emit(`ld de,${value}`, "ld (hl),e", "inc hl", "ld (hl),d");
      } else if (cls === "r32") {
        if (value === "acc") this.emit("ld b,h", "ld c,l", "pop hl", "ld (hl),c", "inc hl", "ld (hl),b", "inc hl", "ld (hl),e", "inc hl", "ld (hl),d");
        else {
          const [low, high] = words32(value);
          this.emit(`ld bc,${low}`, `ld de,${high}`, "ld (hl),c", "inc hl", "ld (hl),b", "inc hl", "ld (hl),e", "inc hl", "ld (hl),d");
        }
      } else if (value === "acc") this.emit("pop hl", ...STORE_FLOAT_HL);
      else throw new CodegenError("A Float value is never an immediate");
      return;
    }
    // --- A frame slot
    const [place] = this.take([src]);
    const d = (slot as { offset: number }).offset;
    if (cls === "r8") this.emit(place === "acc" ? `ld ${ixd(d)},a` : `ld ${ixd(d)},${place}`);
    else if (cls === "r16" || cls === "r32") {
      if (place !== "acc") this.loadImmediate(type, place);
      this.emit(`ld ${ixd(d)},l`, `ld ${ixd(d + 1)},h`);
      if (cls === "r32") this.emit(`ld ${ixd(d + 2)},e`, `ld ${ixd(d + 3)},d`);
    } else {
      if (place !== "acc") throw new CodegenError("A Float value is never an immediate");
      this.emit(...FLOAT_REGS.map((r, k) => `ld ${ixd(d + k)},${r}`));
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Frames and calls (.docs/kbasic-lir-regalloc.md §6)

  /**
   * STDCALL and FASTCALL alike: `push ix; ld ix,0; add ix,sp`, then the frame below IX, zeroed. A
   * FASTCALL routine's register parameter is pushed first, so it is the frame's first slot.
   */
  private prologue(): void {
    this.sid = -1;
    this.emit("push ix", "ld ix,0", "add ix,sp");
    let size = this.fn.frameSize;
    if (this.fn.registerParam) {
      const cls = regClassOf(this.fn.registerParam);
      this.emit(...pushOf(cls));
      size -= cls === "r32" ? 4 : cls === "rflt" ? 6 : 2;
    }
    const words = Math.ceil(Math.max(0, size) / 2);
    if (words > 0) {
      this.emit("ld hl,0");
      if (words <= 4) for (let i = 0; i < words; i++) this.emit("push hl");
      else {
        const loop = this.local();
        this.emit(`ld b,${words}`);
        this.placeLabel(loop);
        this.emit("push hl", `djnz ${loop}`);
      }
    }
    if (this.fn.frameSize > 127) throw new CodegenError(`The frame of ${this.fn.name} is larger than 127 bytes`);
  }

  /** The epilogue's end: the result stays in A / HL; IX restored, the arguments removed, return. */
  private epilogue(value: Value | undefined): void {
    if (value) {
      const [place] = this.take([value]);
      if (place !== "acc") this.loadImmediate(value.type, place);
    }
    this.emit("ld sp,ix", "pop ix");
    if (this.fn.argBytes) {
      // --- The alternate set keeps HL (a result) intact; AF is not touched
      this.emit("exx", "pop bc", `ld hl,${this.fn.argBytes}`, "add hl,sp", "ld sp,hl", "push bc", "exx");
    }
    this.emit("ret");
  }

  private addr(dst: VReg, slot: Slot): void {
    this.spill();
    const fixed = this.fixedAddress(slot);
    if (fixed !== undefined) this.emit(`ld hl,${fixed}`);
    else if (slot.kind === "frame") this.emit("push ix", "pop hl", `ld de,${slot.offset}`, "add hl,de");
    else throw new CodegenError("The address of a pointer slot is the pointer itself");
    this.produce(dst);
  }

  /** A user call: arguments are vregs evaluated last first, so they are on the stack in ABI order. */
  private call(i: Extract<Instr, { op: "call" }>): void {
    if (i.args.length) {
      this.take([...i.args].reverse());
      // --- The first argument is in the accumulator: STDCALL pushes it too, FASTCALL keeps it there
      if (i.convention === "stdcall") {
        const cls = regClassOf(i.args[0].type);
        this.emit(...pushOf(cls));
      }
    } else this.spill();
    this.out.push(instr(`call ${i.target}`, this.sid, i.site));
    if (i.dst) this.produce(i.dst);
  }

  // ----------------------------------------------------------------------------------------------
  // Arithmetic

  /**
   * Puts a binary operation's operands into the class's registers: the left into A / HL, the right
   * into H / DE. `rightClass` differs from the left's only for shifts (the count is a byte).
   */
  private operands(a: Value, b: Value, cls: RegClass, rightClass: RegClass): void {
    const [pa, pb] = this.take([a, b]);
    const right = rightClass === "r8" ? (cls === "r8" ? "h" : "b") : "de";
    // --- Right operand to its register
    if (pb === "acc") {
      if (rightClass === "r8") this.emit(`ld ${right},a`);
      else this.emit("ex de,hl");
    } else if (pb !== "stack") {
      this.emit(`ld ${right},${pb}`);
    }
    // --- Left operand to the accumulator
    if (pa === "stack") this.emit(cls === "r8" ? "pop af" : "pop hl");
    else if (pa === "acc") {
      // --- The right operand was an immediate: the left is already in place
    } else this.loadImmediate(cls === "r8" ? "u8" : "u16", pa);
  }

  private binary(op: BinOp, dst: VReg, a: Value, b: Value): void {
    const type = a.type;
    const cls = regClassOf(type);
    const shift = op === "shl" || op === "shr";
    if (cls === "r32") {
      if (shift) this.shift32(op, type, a, b);
      else this.binary32(op, type, a, b);
      this.produce(dst);
      return;
    }
    if (cls === "rflt") {
      this.binaryFloat(op, a, b);
      this.produce(dst);
      return;
    }
    if (cls !== "r8" && cls !== "r16") throw new CodegenError(`Level 0 cannot select ${op} on ${type} yet`);
    // --- a > b is b < a, a <= b is b >= a: compare with the operands the other way round
    if (op === "gt" || op === "le") {
      this.operands(a, b, cls, cls);
      if (cls === "r8") this.emit("ld l,a", "ld a,h", "ld h,l");
      else this.emit("ex de,hl");
      this.compare(op === "gt" ? "lt" : "ge", type);
      this.produce(dst);
      return;
    }
    this.operands(a, b, cls, shift ? "r8" : cls);
    if (COMPARISONS.has(op)) {
      this.compare(op, type);
      this.produce(dst);
      return;
    }
    if (cls === "r8") this.binary8(op, type);
    else this.binary16(op, type);
    this.produce(dst);
  }

  private binary8(op: BinOp, type: MType): void {
    const signed = isSignedM(type);
    switch (op) {
      case "add":
        return this.emit("add a,h");
      case "sub":
        return this.emit("sub h");
      case "and":
      case "land":
        return this.emit("and h");
      case "or":
      case "lor":
        return this.emit("or h");
      case "xor":
      case "lxor":
        return this.emit("xor h");
      case "mul":
        return this.emit(`call ${this.rt("core.Mul8")}`);
      case "div":
        return this.emit(`call ${this.rt(signed ? "core.DivModI8" : "core.DivModU8")}`);
      case "mod":
        return this.emit(`call ${this.rt(signed ? "core.DivModI8" : "core.DivModU8")}`, "ld a,l");
      case "shl":
      case "shr": {
        const loop = this.local();
        const test = this.local();
        this.emit("ld b,h", "inc b", `jr ${test}`);
        this.placeLabel(loop);
        this.emit(op === "shl" ? "add a,a" : signed ? "sra a" : "srl a");
        this.placeLabel(test);
        this.emit(`djnz ${loop}`);
        return;
      }
      default:
        throw new CodegenError(`Level 0 cannot select ${op} on ${type} yet`);
    }
  }

  private binary16(op: BinOp, type: MType): void {
    const signed = isSignedM(type);
    const bytewise = (alu: string) => this.emit("ld a,h", `${alu} d`, "ld h,a", "ld a,l", `${alu} e`, "ld l,a");
    switch (op) {
      case "add":
        return this.emit("add hl,de");
      case "sub":
        return this.emit("and a", "sbc hl,de");
      case "and":
        return bytewise("and");
      case "or":
        return bytewise("or");
      case "xor":
        return bytewise("xor");
      case "mul":
        return this.emit(`call ${this.rt("core.Mul16")}`);
      case "div":
        return this.emit(`call ${this.rt(signed ? "core.DivModI16" : "core.DivModU16")}`);
      case "mod":
        return this.emit(`call ${this.rt(signed ? "core.DivModI16" : "core.DivModU16")}`, "ex de,hl");
      case "shl":
      case "shr": {
        const loop = this.local();
        const test = this.local();
        this.emit("inc b", `jr ${test}`);
        this.placeLabel(loop);
        if (op === "shl") this.emit("add hl,hl");
        else this.emit(signed ? "sra h" : "srl h", "rr l");
        this.placeLabel(test);
        this.emit(`djnz ${loop}`);
        return;
      }
      default:
        throw new CodegenError(`Level 0 cannot select ${op} on ${type} yet`);
    }
  }

  /**
   * Compares the accumulator with the right operand (H or DE) and leaves the bool in A. Signed
   * operands are compared as unsigned ones with their sign bits flipped.
   */
  private compare(op: BinOp, type: MType): void {
    const cls = regClassOf(type);
    const signed = isSignedM(type);
    if (cls === "r8") {
      if (signed && op !== "eq" && op !== "ne") this.emit("xor $80", "ld l,a", "ld a,h", "xor $80", "ld h,a", "ld a,l");
      this.emit("cp h");
    } else {
      if (signed && op !== "eq" && op !== "ne") this.emit("ld a,h", "xor $80", "ld h,a", "ld a,d", "xor $80", "ld d,a");
      this.emit("and a", "sbc hl,de");
    }
    // --- The flags now say: Z equal, C less than
    const skip = this.local();
    const falseWhen = { eq: "nz", ne: "z", lt: "nc", ge: "c" }[op as "eq"];
    this.emit("ld a,0", `jr ${falseWhen},${skip}`, "inc a");
    this.placeLabel(skip);
  }

  private unary(op: "neg" | "not" | "lnot", dst: VReg, a: Value): void {
    const cls = regClassOf(a.type);
    const [place] = this.take([a]);
    if (place !== "acc") this.loadImmediate(a.type, place);
    if (op === "lnot") this.emit("xor 1");
    else if (cls === "rflt" && op === "neg") this.emit("ld l,$1b", `call ${this.rt("core.FUnary")}`);
    else if (cls === "rflt") throw new CodegenError("BNOT of a Float");
    else if (cls === "r8") this.emit(op === "neg" ? "neg" : "cpl");
    else if (cls === "r32" && op === "neg") this.emit("xor a", "sub l", "ld l,a", "ld a,0", "sbc a,h", "ld h,a", "ld a,0", "sbc a,e", "ld e,a", "ld a,0", "sbc a,d", "ld d,a");
    else if (cls === "r32") this.emit("ld a,h", "cpl", "ld h,a", "ld a,l", "cpl", "ld l,a", "ld a,d", "cpl", "ld d,a", "ld a,e", "cpl", "ld e,a");
    else if (op === "neg") this.emit("xor a", "sub l", "ld l,a", "sbc a,a", "sub h", "ld h,a");
    else this.emit("ld a,h", "cpl", "ld h,a", "ld a,l", "cpl", "ld l,a");
    this.produce(dst);
  }

  private conv(dst: VReg, a: Value): void {
    const [place] = this.take([a]);
    if (place !== "acc") this.loadImmediate(a.type, place);
    const from = regClassOf(a.type);
    const to = regClassOf(dst.type);
    if (from === "r8" && to === "r16") {
      if (isSignedM(a.type)) this.emit("ld l,a", "add a,a", "sbc a,a", "ld h,a");
      else this.emit("ld l,a", "ld h,0");
    } else if (from === "r16" && to === "r8") this.emit("ld a,l");
    else if (from === "r8" && to === "r32") {
      if (isSignedM(a.type)) this.emit("ld l,a", "add a,a", "sbc a,a", "ld h,a", "ld e,a", "ld d,a");
      else this.emit("ld l,a", "ld h,0", "ld de,0");
    } else if (from === "r16" && to === "r32") {
      if (isSignedM(a.type)) this.emit("ld a,h", "add a,a", "sbc a,a", "ld e,a", "ld d,a");
      else this.emit("ld de,0");
    } else if (from === "r32" && to === "r16") {
      // --- The low word is already in HL
    } else if (from === "r32" && to === "r8") this.emit("ld a,l");
    else if (to === "rflt" && from !== "rflt") this.toFloat(a.type, from);
    else if (from === "rflt" && to !== "rflt") {
      // --- Rounded towards minus infinity and taken modulo 2^32, then narrowed (types.conversions)
      this.emit(`call ${this.rt("core.FToI32")}`);
      if (to === "r8") this.emit("ld a,l");
    } else if (from !== to) throw new CodegenError(`Level 0 cannot convert ${a.type} to ${dst.type} yet`);
    this.produce(dst);
  }

  /**
   * An integer as a Float. 8- and 16-bit values fit the ROM's small-integer form, built inline
   * (A = 0, E = the sign byte, D-C = the value, B = 0); 32-bit ones go through the float module.
   */
  private toFloat(type: MType, from: RegClass): void {
    const signed = isSignedM(type);
    if (from === "r32") {
      this.emit(`call ${this.rt(signed ? "core.FFromI32" : "core.FFromU32")}`);
      return;
    }
    if (from === "r8") this.emit(...(signed ? ["ld l,a", "add a,a", "sbc a,a", "ld h,a"] : ["ld l,a", "ld h,0"]));
    this.emit(...(signed ? ["ld a,h", "add a,a", "sbc a,a", "ld e,a"] : ["ld e,0"]), "ld d,l", "ld c,h", "xor a", "ld b,a");
  }

  // ----------------------------------------------------------------------------------------------
  // Runtime calls

  private rtcall(name: string, args: Value[], dst: VReg | undefined): void {
    if (name === "core.ArrayAddress") {
      this.arrayAddress(args);
      if (dst) this.produce(dst);
      return;
    }
    const regs = RUNTIME_ARGS[name];
    if (!regs) throw new CodegenError(`No register contract for ${name}`);
    // --- "core.X!variant" is core.X with its arguments in another evaluation order
    const routine = name.split("!")[0];
    if (args.some((a) => a.kind === "vreg")) {
      const places = this.take(args);
      // --- From the last argument back: the accumulator first, then the stack in pop order. Each
      // --- pop goes through the accumulator, so it must not overwrite a register already set.
      const placed = new Set<string>();
      for (let k = args.length - 1; k >= 0; k--) {
        const place = places[k];
        const reg = regs[k];
        const cls = regClassOf(args[k].type);
        if (place === "stack" && cls === "rflt") {
          if (reg !== "aedcb" || placed.size) throw new CodegenError(`${name}: a Float argument goes in A-E-D-C-B, before any other`);
          this.emit("pop af", "pop de", "pop bc");
        } else if (place === "stack" && cls === "r32") {
          if (reg !== "dehl" || placed.size) throw new CodegenError(`${name}: a 32-bit argument goes in DE:HL, before any other`);
          this.emit("pop hl", "pop de");
        } else if (place === "stack" && cls === "r16") {
          // --- A word is popped straight into its pair
          if ([...reg].some((r) => placed.has(r))) throw new CodegenError(`${name}: argument ${k + 1} would overwrite ${[...placed].join("")}`);
          this.emit(`pop ${reg}`);
        } else if (place === "stack") {
          if (placed.has("a")) throw new CodegenError(`${name}: argument ${k + 1} would overwrite A`);
          this.emit("pop af");
          this.move(reg, cls);
        } else if (place === "acc") this.move(reg, cls);
        if (place === "acc" || place === "stack") for (const r of reg) placed.add(r);
      }
      // --- Immediates last: nothing popped after them can overwrite them
      places.forEach((place, k) => {
        if (place !== "acc" && place !== "stack") this.loadRegister(regs[k], place);
      });
    } else {
      this.spill();
      args.forEach((a, k) => this.loadRegister(regs[k], immText(a)));
    }
    if (INLINE[routine]) this.emit(...INLINE[routine]);
    else this.emit(`call ${this.rt(routine)}`);
    if (dst) this.produce(dst);
  }

  /**
   * ArrayAddress takes its indices on the stack, the first pushed first, and the descriptor in HL
   * (arrays.kz80.asm): the arguments are the indices then the descriptor, every one a word vreg, so
   * the stack machine has them exactly there. The routine removes the indices.
   */
  private arrayAddress(args: Value[]): void {
    if (args.some((a) => a.kind !== "vreg" || regClassOf(a.type) !== "r16")) throw new CodegenError("ArrayAddress takes word vregs");
    this.take(args);
    this.emit(`ld a,${args.length - 1}`, `call ${this.rt("core.ArrayAddress")}`);
  }

  /** Loads an immediate into a runtime argument's register (DE:HL takes two words). */
  private loadRegister(reg: string, text: string): void {
    if (reg !== "dehl") {
      this.emit(`ld ${reg},${text}`);
      return;
    }
    const [low, high] = words32(text);
    this.emit(`ld hl,${low}`, `ld de,${high}`);
  }

  /**
   * A Float operator: the left operand on the stack, the right in A-E-D-C-B (both are vregs: a Float
   * constant is loaded from memory), the calculator operation in L (float.kz80.asm).
   */
  private binaryFloat(op: BinOp, a: Value, b: Value): void {
    const places = this.take([a, b]);
    if (places[0] !== "stack" || places[1] !== "acc") throw new CodegenError("Float operands are always computed values");
    if (op === "mod") return this.emit(`call ${this.rt("core.FMod")}`);
    const compare = FLOAT_COMPARE[op];
    if (compare !== undefined) return this.emit(`ld l,${compare}`, `call ${this.rt("core.FCompare")}`);
    const binary = FLOAT_BINARY[op];
    if (binary === undefined) throw new CodegenError(`Level 0 cannot select ${op} on Float`);
    this.emit(`ld l,${binary}`, `call ${this.rt("core.FBinary")}`);
  }

  /**
   * The operands of a 32-bit operator where the arith32 routines want them: the left on the stack
   * (low word on top), the right in DE:HL.
   */
  private operands32(a: Value, b: Value): void {
    const [pa, pb] = this.take([a, b]);
    if (pa === "stack") return;
    if (pa === "acc") {
      // --- The right operand is an immediate
      this.emit("push de", "push hl");
      this.loadImmediate(b.type, pb);
      return;
    }
    // --- The left operand is an immediate: push it without disturbing DE:HL
    const [low, high] = words32(pa);
    this.emit(`ld bc,${high}`, "push bc", `ld bc,${low}`, "push bc");
    if (pb !== "acc") this.loadImmediate(b.type, pb);
  }

  private binary32(op: BinOp, type: MType, a: Value, b: Value): void {
    const signed = isSignedM(type);
    if (op === "gt" || op === "le") {
      // --- a > b is b < a: swap the operands, the right one onto the stack
      this.operands32(a, b);
      this.emit("ex (sp),hl", "pop bc", "ex de,hl", "ex (sp),hl", "push bc", "ex de,hl");
      this.compare32(op === "gt" ? "lt" : "ge", signed);
      return;
    }
    this.operands32(a, b);
    if (COMPARISONS.has(op)) {
      this.compare32(op, signed);
      return;
    }
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
        return this.emit(`call ${this.rt("core.Mul32")}`);
      case "div":
        return this.emit(`call ${this.rt(signed ? "core.DivI32" : "core.DivU32")}`);
      case "mod":
        return this.emit(`call ${this.rt(signed ? "core.ModI32" : "core.ModU32")}`);
      default:
        throw new CodegenError(`Level 0 cannot select ${op} on ${type} yet`);
    }
  }

  /**
   * Compares the left operand (on the stack) with the right (DE:HL) by subtracting, and leaves the
   * bool in A. Signed operands have their sign bits flipped first, which makes the comparison an
   * unsigned one.
   */
  private compare32(op: BinOp, signed: boolean): void {
    const ordered = op !== "eq" && op !== "ne";
    if (signed && ordered) this.emit("ld a,d", "xor $80", "ld d,a");
    this.emit("ld b,d", "ld c,e", "ex de,hl", "pop hl");
    if (signed && ordered) this.emit("ex (sp),hl", "ld a,h", "xor $80", "ld h,a", "ex (sp),hl");
    this.emit("and a", "sbc hl,de", "ex (sp),hl", "sbc hl,bc", "pop de");
    // --- HL:DE = left - right; carry = left < right
    if (!ordered) this.emit("ld a,h", "or l", "or d", "or e");
    const skip = this.local();
    const falseWhen = { eq: "nz", ne: "z", lt: "nc", ge: "c" }[op as "eq"];
    this.emit("ld a,0", `jr ${falseWhen},${skip}`, "inc a");
    this.placeLabel(skip);
  }

  /** A 32-bit shift by a byte count: one bit at a time. */
  private shift32(op: BinOp, type: MType, a: Value, b: Value): void {
    const [pa, pb] = this.take([a, b]);
    if (pb === "acc") {
      this.emit("ld b,a");
      if (pa === "stack") this.emit("pop hl", "pop de");
      else this.loadImmediate(type, pa);
    } else {
      if (pa !== "acc") this.loadImmediate(type, pa);
      this.emit(`ld b,${pb}`);
    }
    const loop = this.local();
    const test = this.local();
    this.emit("inc b", `jr ${test}`);
    this.placeLabel(loop);
    if (op === "shl") this.emit("add hl,hl", "ex de,hl", "adc hl,hl", "ex de,hl");
    else this.emit(isSignedM(type) ? "sra d" : "srl d", "rr e", "rr h", "rr l");
    this.placeLabel(test);
    this.emit(`djnz ${loop}`);
  }

  /** Copies the accumulator of a class to a register. */
  private move(reg: string, cls: RegClass): void {
    if (reg === ACC[cls]) return;
    if (cls === "r8") this.emit(`ld ${reg},a`);
    else if (cls === "r16" && reg === "de") this.emit("ex de,hl");
    else if (cls === "r16" && reg === "bc") this.emit("ld b,h", "ld c,l");
    else throw new CodegenError(`Cannot move ${ACC[cls]} to ${reg}`);
  }

  // ===============================================================================================
  // Terminators

  private terminator(t: Terminator): void {
    switch (t.op) {
      case "jmp":
        this.emit(`jp ${t.target}`);
        return;
      case "br": {
        if (t.cond.kind !== "vreg") {
          this.emit(`jp ${t.cond.kind === "imm" && t.cond.value === 0 ? t.ifFalse : t.ifTrue}`);
          return;
        }
        this.take([t.cond]);
        this.emit("or a", `jp nz,${t.ifTrue}`, `jp ${t.ifFalse}`);
        return;
      }
      case "switch":
      case "ongosub": {
        const [place] = this.take([t.sel]);
        if (place !== "acc") this.loadImmediate("u8", place);
        const table = this.local();
        const after = t.op === "switch" ? t.otherwise : t.next;
        this.emit(`cp ${t.targets.length}`, `jp nc,${after}`, "ld l,a", "ld h,0", "add hl,hl", `ld de,${table}`, "add hl,de", "ld a,(hl)", "inc hl", "ld h,(hl)", "ld l,a");
        if (t.op === "switch") this.emit("jp (hl)");
        else {
          // --- An indirect call: push the return address, then jump
          const back = this.local();
          this.emit(`ld de,${back}`, "push de");
          this.out.push(instr("jp (hl)", this.sid, t.site));
          this.placeLabel(back);
          this.emit(`jp ${t.next}`);
        }
        this.placeLabel(table);
        for (const target of t.targets) this.emit(`.defw ${target}`);
        return;
      }
      case "gosub":
        this.out.push(instr(`call ${t.target}`, this.sid, t.site));
        this.emit(`jp ${t.next}`);
        return;
      case "ret":
        if (this.fn.kind === "main") this.emit("ret");
        else this.epilogue(t.value);
        return;
      case "end": {
        const [place] = this.take([t.code]);
        if (place === "acc") {
          if (regClassOf(t.code.type) === "r8") this.emit("ld c,a", "ld b,0");
          else this.emit("ld b,h", "ld c,l");
        } else this.emit(`ld bc,${place}`);
        this.emit(`jp ${this.rt("core.End")}`);
        return;
      }
      case "raise": {
        const [place] = this.take([t.code]);
        if (place === "acc") {
          if (regClassOf(t.code.type) !== "r8") this.emit("ld a,l");
        } else this.emit(`ld a,${place}`);
        this.emit(`jp ${this.rt("core.RaiseError")}`);
        return;
      }
    }
  }
}

/** `(ix+d)` / `(ix-d)`. */
function ixd(d: number): string {
  return d < 0 ? `(ix-${-d})` : `(ix+${d})`;
}

function immText(v: Value): string {
  if (v.kind === "imm") return String(v.type === "bool" ? v.value & 1 : v.value);
  if (v.kind === "sym") return symText(v);
  throw new CodegenError("A vreg is not an immediate");
}

/** The low and high words of a 32-bit immediate's text. */
function words32(text: string): [number, number] {
  const v = Number(text);
  if (!Number.isFinite(v)) throw new CodegenError(`'${text}' is not a 32-bit immediate`);
  return [v & 0xffff, (v >>> 16) & 0xffff];
}

/** A Float's registers in memory order: exponent, then the mantissa (sign in E). */
const FLOAT_REGS = ["a", "e", "d", "c", "b"];

/** The six-byte stack image of a Float: [pad][A][E][D][C][B] at ascending addresses. */
const PUSH_FLOAT = ["push bc", "push de", "push af"];

const LOAD_FLOAT_HL = ["ld a,(hl)", "inc hl", "ld e,(hl)", "inc hl", "ld d,(hl)", "inc hl", "ld c,(hl)", "inc hl", "ld b,(hl)"];
const STORE_FLOAT_HL = ["ld (hl),a", "inc hl", "ld (hl),e", "inc hl", "ld (hl),d", "inc hl", "ld (hl),c", "inc hl", "ld (hl),b"];

function pushOf(cls: RegClass): string[] {
  return cls === "r8" ? ["push af"] : cls === "r32" ? ["push de", "push hl"] : cls === "rflt" ? PUSH_FLOAT : ["push hl"];
}

/** The ROM calculator's operations (float.kz80.asm). */
const FLOAT_BINARY: Partial<Record<BinOp, string>> = { add: "$0f", sub: "$03", mul: "$04", div: "$05", pow: "$06" };
const FLOAT_COMPARE: Partial<Record<BinOp, string>> = { le: "$09", ge: "$0a", ne: "$0b", gt: "$0c", lt: "$0d", eq: "$0e" };
