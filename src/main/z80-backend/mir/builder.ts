import type { StatementKind } from "@abstractions/CompilerInfo";

import type {
  BinOp,
  Block,
  CallSite,
  DataItem,
  Imm,
  Instr,
  MFunction,
  MModule,
  MType,
  Overflow,
  Slot,
  Span,
  SymRef,
  Terminator,
  Value,
  VariableDescriptor,
  VReg
} from "./mir";
import { COMPARISONS } from "./mir";

/**
 * Builds MIR (`.plans/SHARED_Z80_BACKEND_PLAN.md` §4.4): what a front end, or a test of the back end,
 * uses instead of writing the MIR's objects by hand. It keeps the invariants the verifier checks —
 * every instruction has a statement id, every vreg is defined once — and leaves every decision about
 * meaning to the caller: an operation whose meaning differs between languages gets exactly the
 * attributes the caller passes.
 */
export class MirBuilder {
  private readonly module: MModule = { functions: [], data: [], statements: [], runtime: new Set() };
  private nextVreg = 1;

  /** A new function; its first block is its entry. */
  fn(init: Pick<MFunction, "label" | "name" | "kind"> & Partial<Omit<MFunction, "label" | "name" | "kind" | "blocks">>): FunctionBuilder {
    const fn: MFunction = { convention: "stdcall", params: [], locals: [], frameSize: 0, argBytes: 0, ...init, blocks: [] };
    const index = this.module.functions.length;
    this.module.functions.push(fn);
    return new FunctionBuilder(this, fn, index);
  }

  /** A statement of a function: its id, which instructions carry. */
  statement(fn: FunctionBuilder, span: Span, kind: StatementKind = "other"): number {
    const sid = this.module.statements.length;
    this.module.statements.push({ sid, span, kind, functionIndex: fn.index });
    return sid;
  }

  data(item: DataItem): void {
    this.module.data.push(item);
  }

  global(descriptor: VariableDescriptor): void {
    (this.module.globals ??= []).push(descriptor);
  }

  vreg(type: MType): VReg {
    return { kind: "vreg", id: this.nextVreg++, type };
  }

  build(): MModule {
    return this.module;
  }
}

export class FunctionBuilder {
  private current: Block | undefined;

  constructor(
    private readonly owner: MirBuilder,
    readonly mfn: MFunction,
    readonly index: number
  ) {}

  /** Starts a block (the first one started is the function's entry). */
  block(label: string): this {
    this.current = { label, instrs: [] };
    this.mfn.blocks.push(this.current);
    return this;
  }

  private push(i: Instr): void {
    if (!this.current) this.block(this.mfn.label);
    this.current!.instrs.push(i);
  }

  /** The entry of a statement (its marker). */
  stmt(sid: number): this {
    this.push({ op: "stmt", sid });
    return this;
  }

  /** A routine's frame boundary: where its body starts (`prologue.end`) and its epilogue does. */
  marker(op: "prologue.end" | "epilogue.begin", sid: number): this {
    this.push({ op, sid });
    return this;
  }

  const(sid: number, value: Imm | SymRef): VReg {
    const dst = this.owner.vreg(value.type);
    this.push({ op: "const", dst, value, sid });
    return dst;
  }

  load(sid: number, type: MType, slot: Slot): VReg {
    const dst = this.owner.vreg(type);
    this.push({ op: "load", dst, slot, sid });
    return dst;
  }

  store(sid: number, type: MType, slot: Slot, src: Value): this {
    this.push({ op: "store", type, slot, src, sid });
    return this;
  }

  addr(sid: number, slot: Slot): VReg {
    const dst = this.owner.vreg("ptr");
    this.push({ op: "addr", dst, slot, sid });
    return dst;
  }

  /** A binary operation; comparisons and logic give `bool`. `meaning` is copied onto it as given. */
  bin(sid: number, bop: BinOp, a: Value, b: Value, meaning: Pick<Extract<Instr, { op: "bin" }>, "rounding" | "overflow" | "shift"> = {}): VReg {
    const logic = COMPARISONS.has(bop) || bop === "land" || bop === "lor" || bop === "lxor";
    const dst = this.owner.vreg(logic ? "bool" : a.type);
    this.push({ op: "bin", bop, dst, a, b, ...meaning, sid });
    return dst;
  }

  unary(sid: number, op: "neg" | "not" | "lnot", a: Value, meaning: { overflow?: Overflow } = {}): VReg {
    const dst = this.owner.vreg(op === "lnot" ? "bool" : a.type);
    this.push({ op, dst, a, ...meaning, sid });
    return dst;
  }

  conv(sid: number, to: MType, a: Value, meaning: Pick<Extract<Instr, { op: "conv" }>, "toInt" | "overflow" | "truth"> = {}): VReg {
    const dst = this.owner.vreg(to);
    this.push({ op: "conv", dst, a, ...meaning, sid });
    return dst;
  }

  call(sid: number, target: string, args: Value[], site: CallSite, result?: MType, convention: "stdcall" | "fastcall" = "stdcall"): VReg | undefined {
    const dst = result ? this.owner.vreg(result) : undefined;
    this.push({ op: "call", target, convention, args, site, ...(dst ? { dst } : {}), sid });
    return dst;
  }

  rtcall(sid: number, name: string, args: Value[], result?: MType): VReg | undefined {
    const dst = result ? this.owner.vreg(result) : undefined;
    this.push({ op: "rtcall", name, args, ...(dst ? { dst } : {}), sid });
    return dst;
  }

  asm(sid: number, lines: string[]): this {
    this.push({ op: "asm", lines, sid });
    return this;
  }

  /** Ends the current block. */
  end(term: Terminator): this {
    if (!this.current) this.block(this.mfn.label);
    this.current!.term = term;
    return this;
  }
}

/** An integer (or bool) immediate. */
export function imm(type: MType, value: number): Imm {
  return { kind: "imm", type, value };
}

/** A symbol (plus offset) the assembler resolves. */
export function sym(type: MType, name: string, offset = 0): SymRef {
  return { kind: "sym", type, name, offset };
}
