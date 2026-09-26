import type { StatementKind } from "@abstractions/CompilerInfo";
import type { DiagnosticBag, Span } from "../diagnostics";
import type { AttrName } from "../syntax/ast";
import type { AddressTarget, BoundArgument, BoundExpr, BoundProgram, BoundStatement } from "../semantics/bound";
import type { Constant } from "../semantics/constants";
import type { ArraySymbol, LabelSymbol, RoutineSymbol, Scope, VariableSymbol } from "../semantics/symbols";
import {
  COMPARISONS,
  mtypeOf,
  mtypeSize,
  type BinOp,
  type Block,
  type CallSite,
  type DataItem,
  type Imm,
  type Instr,
  type MFunction,
  type MModule,
  type MType,
  type Slot,
  type SymRef,
  type Terminator,
  type Value,
  type VReg,
  symText
} from "./mir";

/**
 * Lowers the typed program to MIR (`.docs/kbasic-mir.md` §8). Variables are read and written through
 * slots; temporaries are virtual registers that never leave their statement. Every statement (and
 * every separately executing part of a block statement) gets a statement id with its span.
 *
 * What the code generator does not handle yet is reported as E501 and left out, so the rest of the
 * program still gets its diagnostics.
 */
export function lowerProgram(program: BoundProgram, globals: Scope, diagnostics: DiagnosticBag): MModule {
  return new Lowering(diagnostics).run(program, globals);
}

/** The label of a BASIC label or line number. */
export function labelName(label: LabelSymbol): string {
  return `_label.${label.lineNumber !== undefined ? label.lineNumber : label.name.replace(/[$%]$/, "")}`;
}

/** The label of a global variable. */
export function globalName(name: string): string {
  return `_${name}`;
}

const ATTR_CODES: Record<AttrName, number> = { INK: 16, PAPER: 17, FLASH: 18, BRIGHT: 19, INVERSE: 20, OVER: 21, BOLD: 0, ITALIC: 0 };

/** The labels of an array's static tables (runtime-abi.md §2.3). */
type ArrayTables = { dims: string; lower?: string; upper?: string };

type LoopTargets = { kind: "FOR" | "WHILE" | "DO"; exit: string; next: string };

class Lowering {
  private readonly module: MModule = { functions: [], data: [], statements: [], runtime: new Set() };
  private fn!: MFunction;
  private fnIndex = 0;
  private block!: Block;
  private vregs = 0;
  private labels = 0;
  private sid = -1;
  private loops: LoopTargets[] = [];
  private readonly strings = new Map<string, string>();
  private readonly staticSlots: DataItem[] = [];
  /**
   * The current routine's variables: where each parameter and local lives. An array parameter's
   * slot holds its descriptor's address (byref); a local array's slot is its descriptor.
   */
  private frameSlots = new Map<VariableSymbol | ArraySymbol, { slot: Slot; byref: boolean }>();
  /** The static tables of the current routine's local arrays (their initial values' images too). */
  private localArrays = new Map<ArraySymbol, ArrayTables & { image?: string }>();
  private routine: RoutineSymbol | undefined;
  private resultSlot: Slot | undefined;
  /** The call sites of the current statement, to fill in `moreCallsFollow` when it ends. */
  private statementCalls: CallSite[] = [];
  /** String vregs that are owned (must be consumed once); every other String value is borrowed. */
  private readonly owned = new Set<number>();
  /** Rule B1 of the string note: the statement calls a FUNCTION while it evaluates. */
  private copyBorrowed = false;
  /** UBOUND is asked at run time somewhere: every array gets an upper-bound table (runtime-abi §2.3). */
  private upperTables = false;

  constructor(private readonly diagnostics: DiagnosticBag) {}

  run(program: BoundProgram, globals: Scope): MModule {
    this.upperTables = containsBuiltin(program.statements, "UBOUND");
    this.globalData(globals);
    this.fn = { label: "_main", name: "main", kind: "main", convention: "stdcall", params: [], locals: [], frameSize: 0, argBytes: 0, blocks: [] };
    this.module.functions.push(this.fn);
    this.startBlock("_main");
    this.statements(program.statements);
    // --- Falling off the end of the main program is END 0
    this.endStatement();
    this.terminate({ op: "end", code: imm("u16", 0), sid: -1 });
    for (const s of routinesOf(program.statements)) this.lowerRoutine(s);
    this.module.data.push(...this.staticSlots);
    return this.module;
  }

  // ===============================================================================================
  // Data

  private globalData(globals: Scope): void {
    for (const symbol of globals.symbols) {
      if (symbol.kind === "array") {
        if (!symbol.param) this.globalArray(symbol);
        continue;
      }
      if (symbol.kind !== "variable" || symbol.at) continue;
      const type = mtypeOf(symbol.type);
      if (!this.supportedType(type)) continue;
      const init = symbol.initial ? bytesOf(symbol.initial, type) : undefined;
      this.module.data.push({ kind: "var", label: globalName(symbol.name), size: mtypeSize(type), ...(init ? { init } : {}) });
    }
  }

  /**
   * A global array (runtime-abi.md §2.3): the descriptor at `_a`, the data straight after it at
   * `_a.data` (or `_a.data` names the `AT` address), then the dimension and lower-bound tables.
   */
  private globalArray(symbol: ArraySymbol): void {
    const type = mtypeOf(symbol.elementType);
    if (!this.supportedType(type)) {
      this.unsupported(`${symbol.elementType} arrays`, symbol.span);
      return;
    }
    const name = globalName(symbol.name);
    const tables = this.arrayTables(symbol, name);
    const at = symbol.at ? atText(symbol.at) : undefined;
    this.module.data.push({ kind: "raw", label: name, lines: [`    .defw ${tables.dims},${name}.data,${tables.lower ?? 0},${tables.upper ?? 0}`] });
    if (at !== undefined) {
      if (symbol.initial) this.unsupported("An initialiser for an array placed AT an address", symbol.span);
      this.module.data.push({ kind: "equ", label: `${name}.data`, value: at });
    } else {
      const init = symbol.initial ? this.arrayImage(symbol, type) : undefined;
      this.module.data.push({ kind: "var", label: `${name}.data`, size: arrayBytes(symbol), ...(init ? { init } : {}) });
    }
    this.module.data.push(...tables.items);
  }

  /**
   * The dimension table; the lower-bound table for an array with a non-zero lower bound; the
   * upper-bound table when the program asks UBOUND at run time.
   */
  private arrayTables(symbol: ArraySymbol, prefix: string): ArrayTables & { items: DataItem[] } {
    const counts = symbol.bounds.map((b) => b.upper - b.lower + 1);
    const tables: ArrayTables & { items: DataItem[] } = { dims: `${prefix}.dims`, items: [] };
    tables.items.push({
      kind: "raw",
      label: tables.dims,
      lines: [`    .defw ${[counts.length - 1, ...counts.slice(1)].join(",")}`, `    .defb ${mtypeSize(mtypeOf(symbol.elementType))}`]
    });
    if (symbol.bounds.some((b) => b.lower !== 0)) {
      tables.lower = `${prefix}.lbound`;
      tables.items.push({ kind: "raw", label: tables.lower, lines: [`    .defw ${symbol.bounds.map((b) => b.lower).join(",")}`] });
    }
    if (this.upperTables) {
      tables.upper = `${prefix}.ubound`;
      tables.items.push({ kind: "raw", label: tables.upper, lines: [`    .defw ${symbol.bounds.map((b) => b.upper).join(",")}`] });
    }
    return tables;
  }

  /** The bytes of an array's `=> {...}` values. */
  private arrayImage(symbol: ArraySymbol, type: MType): number[] {
    const size = mtypeSize(type);
    return (symbol.initial ?? []).flatMap((c) => bytesOf(c, type) ?? new Array<number>(size).fill(0));
  }

  private stringLiteral(text: string): SymRef {
    let label = this.strings.get(text);
    if (!label) {
      label = `__str${this.strings.size}`;
      this.strings.set(text, label);
      this.module.data.push({ kind: "string", label, text });
    }
    return { kind: "sym", type: "str", name: label, offset: 0 };
  }

  /** A hidden variable: a frame slot in a routine, a static one in the main program. */
  private hiddenSlot(type: MType, what: string): Slot {
    if (this.routine) return this.allocateLocal(type);
    const label = `__${what}${this.labels++}`;
    this.staticSlots.push({ kind: "var", label, size: mtypeSize(type) });
    return { kind: "global", name: label };
  }

  // ===============================================================================================
  // Blocks, statements, values

  private newLabel(): string {
    return `__b${this.labels++}`;
  }

  private startBlock(label: string): void {
    this.block = { label, instrs: [] };
    this.fn.blocks.push(this.block);
  }

  /** Ends the current block (falling through to `label` if it has no terminator) and starts `label`. */
  private continueAt(label: string): void {
    if (!this.block.term) this.terminate({ op: "jmp", target: label, sid: this.sid });
    this.startBlock(label);
  }

  private terminate(t: Terminator): void {
    if (this.block.term) {
      // --- Code after a jump: unreachable, but it still needs a block of its own
      this.startBlock(this.newLabel());
    }
    this.block.term = t;
  }

  private emit(i: Instr): void {
    if (this.block.term) this.startBlock(this.newLabel());
    this.block.instrs.push(i);
  }

  private vreg(type: MType): VReg {
    return { kind: "vreg", id: this.vregs++, type };
  }

  /** Starts a statement (or statement part): a new sid with its span, and its entry marker. */
  private beginStatement(span: Span, kind: StatementKind, evaluates: unknown[] = []): void {
    this.endStatement();
    this.copyBorrowed = evaluates.some(containsCall);
    this.sid = this.module.statements.length;
    this.module.statements.push({ sid: this.sid, span, kind, functionIndex: this.fnIndex });
    this.emit({ op: "stmt", sid: this.sid });
  }

  /** Marks every user call of the statement but its last as followed by more calls (plan §10.2.3). */
  private endStatement(): void {
    this.statementCalls.forEach((site, i) => (site.moreCallsFollow = i < this.statementCalls.length - 1));
    this.statementCalls = [];
  }

  private unsupported(what: string, span: Span): void {
    this.diagnostics.error("E501", `${what} is not supported by the Klive BASIC code generator yet`, span);
  }

  private unsupportedValue(what: string, span: Span): Value {
    this.unsupported(what, span);
    return imm("ptr", 0);
  }

  private supportedType(t: MType): boolean {
    return t === "u8" || t === "i8" || t === "u16" || t === "i16" || t === "bool" || t === "ptr" || t === "str";
  }

  private rt(name: string): string {
    this.module.runtime.add(`core.${name}`);
    return `core.${name}`;
  }

  // ===============================================================================================
  // Statements

  private statements(list: BoundStatement[]): void {
    for (const s of list) this.statement(s);
  }

  private statement(s: BoundStatement): void {
    switch (s.kind) {
      case "label":
        this.continueAt(labelName(s.label));
        return;
      case "print":
        this.beginStatement(s.span, "other", [s.items]);
        this.print(s.items);
        return;
      case "cls":
        this.beginStatement(s.span, "other");
        this.emit({ op: "rtcall", name: this.rt("Cls"), args: [], sid: this.sid });
        return;
      case "assign":
        this.beginStatement(s.span, "assignment", [s.value, s.target]);
        this.assign(s.target, s.value, s.span);
        return;
      case "dim":
        if (s.symbol.kind === "array") {
          this.dimLocalArray(s.symbol, s.span);
          return;
        }
        if (!s.value) return;
        this.beginStatement(s.span, "declaration", [s.value]);
        this.assign({ kind: "variable", span: s.span, type: (s.symbol as VariableSymbol).type, symbol: s.symbol as VariableSymbol }, s.value, s.span);
        return;
      case "if":
        this.ifStatement(s);
        return;
      case "for":
        this.forStatement(s);
        return;
      case "while":
        this.whileStatement(s);
        return;
      case "do":
        this.doStatement(s);
        return;
      case "exit":
      case "continue": {
        this.beginStatement(s.span, "jump");
        const loop = [...this.loops].reverse().find((l) => l.kind === s.loop);
        if (loop) this.terminate({ op: "jmp", target: s.kind === "exit" ? loop.exit : loop.next, sid: this.sid });
        return;
      }
      case "goto":
        this.beginStatement(s.span, "jump");
        this.terminate({ op: "jmp", target: labelName(s.label), sid: this.sid });
        return;
      case "gosub": {
        this.beginStatement(s.span, "call");
        const next = this.newLabel();
        this.terminate({ op: "gosub", target: labelName(s.label), next, sid: this.sid, site: { kind: "gosub", moreCallsFollow: false, order: 0 } });
        this.startBlock(next);
        return;
      }
      case "on": {
        this.beginStatement(s.span, "switch");
        const sel = this.value(s.selector);
        const next = this.newLabel();
        const targets = s.labels.map(labelName);
        if (s.jump === "GOTO") this.terminate({ op: "switch", sel, targets, otherwise: next, sid: this.sid });
        else this.terminate({ op: "ongosub", sel, targets, next, sid: this.sid, site: { kind: "on-gosub", moreCallsFollow: false, order: 0 } });
        this.startBlock(next);
        return;
      }
      case "return":
        this.beginStatement(s.span, "return", [s.value]);
        if (this.routine) {
          if (s.value && this.resultSlot) {
            const type = mtypeOf(this.routine.returnType ?? "Float");
            // --- A returned String belongs to the caller: never a borrowed one (string note §3)
            const value = type === "str" ? this.ownedString(s.value) : this.value(s.value);
            this.emit({ op: "store", type, slot: this.resultSlot, src: value, sid: this.sid });
          }
          this.terminate({ op: "jmp", target: this.fn.epilogue!, sid: this.sid });
        } else this.terminate({ op: "ret", sid: this.sid });
        return;
      case "end":
        this.beginStatement(s.span, "return");
        this.terminate({ op: "end", code: s.value ? this.value(s.value) : imm("u16", 0), sid: this.sid });
        return;
      case "stop":
        this.beginStatement(s.span, "return");
        // --- ERR_NR 8: "9 STOP statement"
        this.terminate({ op: "raise", code: s.value ? this.value(s.value) : imm("u8", 8), sid: this.sid });
        return;
      case "error":
        this.beginStatement(s.span, "return");
        this.terminate({ op: "raise", code: this.value(s.value), sid: this.sid });
        return;
      case "poke": {
        this.beginStatement(s.span, "other");
        const type = mtypeOf(s.type);
        if (!this.supportedType(type)) {
          this.unsupported(`POKE ${s.type}`, s.span);
          return;
        }
        const address = this.value(s.address);
        const value = this.value(s.value);
        this.emit({ op: "store", type, slot: { kind: "deref", ptr: address }, src: value, sid: this.sid });
        return;
      }
      case "asm":
        this.beginStatement(s.span, "asm");
        this.emit({ op: "asm", lines: s.lines.map((l) => l.text), sid: this.sid });
        return;
      case "codebank":
        this.unsupported("CODEBANK", s.span);
        return;
      case "routine":
        return;
      case "call": {
        this.beginStatement(s.span, "call", [s.args]);
        const result = s.routine.kind === "function" ? mtypeOf(s.routine.returnType ?? "Float") : undefined;
        const value = this.call(s.routine, s.args, result === "str" ? "str" : undefined);
        // --- A String result nobody uses is freed at once
        if (value) this.consume(value, "free");
        return;
      }
      default:
        this.unsupported(`${s.kind.toUpperCase()}`, s.span);
    }
  }

  private assign(target: BoundExpr, valueExpr: BoundExpr, span: Span): void {
    if (target.kind === "element") {
      const type = mtypeOf(target.type);
      if (!this.supportedType(type)) {
        this.unsupported(`${target.type} arrays`, span);
        return;
      }
      // --- The element's address first, then the value (like a BYREF variable)
      const slot: Slot = { kind: "deref", ptr: this.elementAddress(target.symbol, target.indices, span) };
      if (type === "str") this.storeString(slot, valueExpr);
      else this.emit({ op: "store", type, slot, src: this.value(valueExpr), sid: this.sid });
      return;
    }
    if (target.kind !== "variable") {
      this.unsupported(`Assignment to ${target.kind === "slice" ? "a substring" : target.kind === "array" ? "a whole array" : "this target"}`, span);
      return;
    }
    const slot = this.variableSlot(target.symbol, span);
    const type = mtypeOf(target.type);
    if (!slot || !this.supportedType(type)) {
      if (slot) this.unsupported(`${target.type} variables`, span);
      return;
    }
    if (type === "str") {
      this.storeString(slot, valueExpr);
      return;
    }
    const value = this.value(valueExpr);
    this.emit({ op: "store", type, slot, src: value, sid: this.sid });
  }

  /** `s$ = expr`: an owned value (a copy of a borrowed one), stored with StrStore (string note §3). */
  private storeString(slot: Slot, valueExpr: BoundExpr): void {
    const value = this.ownedString(valueExpr);
    if (slot.kind === "deref") {
      // --- A BYREF String: its address was loaded before the value was computed
      this.rt("StrStore");
      this.emit({ op: "rtcall", name: "core.StrStore!addressFirst", args: [slot.ptr, value], sid: this.sid });
    } else {
      const address = this.slotAddress(slot);
      this.emit({ op: "rtcall", name: this.rt("StrStore"), args: [value, address], sid: this.sid });
    }
    this.owned.delete((value as VReg).id);
  }

  /** The address of a variable's slot, as a value. */
  private slotAddress(slot: Slot): Value {
    if (slot.kind === "global") return { kind: "sym", type: "ptr", name: slot.name, offset: 0 };
    if (slot.kind === "deref") return slot.ptr;
    const r = this.vreg("ptr");
    this.emit({ op: "addr", dst: r, slot, sid: this.sid });
    return r;
  }

  private variableSlot(symbol: VariableSymbol, span: Span): Slot | undefined {
    if (symbol.storage !== "global") {
      const local = this.frameSlots.get(symbol);
      if (!local) {
        this.unsupported(`The local '${symbol.name}'`, span);
        return undefined;
      }
      // --- A BYREF parameter holds the address of the caller's variable
      return local.byref ? { kind: "deref", ptr: this.load("ptr", local.slot) } : local.slot;
    }
    if (symbol.at) {
      const v = symbol.at.value;
      if (v.kind === "int") return { kind: "global", name: String(v.value) };
      if (v.kind === "address") return { kind: "global", name: atText(symbol.at) };
    }
    return { kind: "global", name: globalName(symbol.name) };
  }

  // ----------------------------------------------------------------------------------------------
  // PRINT (runtime-abi.md; print.kz80.asm)

  private print(items: Extract<BoundStatement, { kind: "print" }>["items"]): void {
    let colours = false;
    for (const item of items) {
      switch (item.kind) {
        case "separator":
          if (item.separator === ",") this.emit({ op: "rtcall", name: this.rt("PrintComma"), args: [], sid: this.sid });
          break;
        case "at":
          this.emit({ op: "rtcall", name: this.rt("PrintAt"), args: [this.value(item.row), this.value(item.column)], sid: this.sid });
          break;
        case "tab":
          this.emit({ op: "rtcall", name: this.rt("PrintTab"), args: [this.value(item.column)], sid: this.sid });
          break;
        case "attr": {
          const code = ATTR_CODES[item.attr];
          if (!code) {
            this.unsupported(item.attr, item.value.span);
            break;
          }
          colours = true;
          this.emit({ op: "rtcall", name: this.rt("PrintColour"), args: [imm("u8", code), this.value(item.value)], sid: this.sid });
          break;
        }
        case "expr":
          this.printValue(item.value);
          break;
      }
    }
    const last = items[items.length - 1];
    if (!last || last.kind !== "separator") this.emit({ op: "rtcall", name: this.rt("PrintNewline"), args: [], sid: this.sid });
    if (colours) this.emit({ op: "rtcall", name: this.rt("PrintReset"), args: [], sid: this.sid });
  }

  private printValue(e: BoundExpr): void {
    const type = mtypeOf(e.type);
    if (type === "str") {
      if (e.constant?.value.kind === "string" && e.constant.value.value === "") return;
      const v = this.value(e);
      this.emit({ op: "rtcall", name: this.rt("PrintStr"), args: [v, imm("u8", this.consumeFlag(v))], sid: this.sid });
      return;
    }
    const name = { u8: "PrintU8", bool: "PrintU8", i8: "PrintI8", u16: "PrintU16", i16: "PrintI16" }[type as "u8"];
    if (!name) {
      this.unsupported(`PRINT of a ${e.type}`, e.span);
      return;
    }
    this.emit({ op: "rtcall", name: this.rt(name), args: [this.value(e)], sid: this.sid });
  }

  // ----------------------------------------------------------------------------------------------
  // Control flow (.docs/kbasic-mir.md §8.3-§8.7)

  private ifStatement(s: Extract<BoundStatement, { kind: "if" }>): void {
    const after = this.newLabel();
    for (const branch of s.branches) {
      this.beginStatement(branch.header, "if");
      const cond = this.condition(branch.condition);
      const then = this.newLabel();
      const next = this.newLabel();
      this.terminate({ op: "br", cond, ifTrue: then, ifFalse: next, sid: this.sid });
      this.startBlock(then);
      this.statements(branch.body);
      if (!this.block.term) this.terminate({ op: "jmp", target: after, sid: this.sid });
      this.startBlock(next);
    }
    if (s.else) this.statements(s.else);
    this.continueAt(after);
  }

  private forStatement(s: Extract<BoundStatement, { kind: "for" }>): void {
    if (s.variable.kind !== "variable") return;
    const type = mtypeOf(s.variable.type);
    const slot = this.variableSlot(s.variable.symbol, s.header);
    if (!slot) return;
    if (!this.supportedType(type)) {
      this.unsupported(`A ${s.variable.type} FOR variable`, s.header);
      return;
    }
    const body = this.newLabel();
    const next = this.newLabel();
    const exit = this.newLabel();

    this.beginStatement(s.header, "loop");
    this.emit({ op: "store", type, slot, src: this.value(s.from), sid: this.sid });
    const limit = this.hiddenSlot(type, "forlim");
    this.emit({ op: "store", type, slot: limit, src: this.value(s.to), sid: this.sid });
    const constantStep = s.step ? stepConstant(s.step) : 1;
    let stepSlot: Slot | undefined;
    if (s.step && constantStep === undefined) {
      stepSlot = this.hiddenSlot(type, "forstep");
      this.emit({ op: "store", type, slot: stepSlot, src: this.value(s.step), sid: this.sid });
    }
    const beyond = () => this.forBeyond(slot, limit, type, constantStep, stepSlot);
    this.terminate({ op: "br", cond: beyond(), ifTrue: exit, ifFalse: body, sid: this.sid });

    this.startBlock(body);
    this.loops.push({ kind: "FOR", exit, next });
    this.statements(s.body);
    this.loops.pop();

    this.continueAt(next);
    this.beginStatement(s.next, "loop");
    const i = this.load(type, slot);
    const step = stepSlot ? this.load(type, stepSlot) : imm(type, constantStep ?? 1);
    const sum = this.vreg(type);
    this.emit({ op: "bin", bop: "add", dst: sum, a: i, b: step, sid: this.sid });
    this.emit({ op: "store", type, slot, src: sum, sid: this.sid });
    this.terminate({ op: "br", cond: beyond(), ifTrue: exit, ifFalse: body, sid: this.sid });
    this.startBlock(exit);
  }

  /** `i > limit` for a positive step, `i < limit` for a negative one; tested at run time when unknown. */
  private forBeyond(slot: Slot, limit: Slot, type: MType, step: number | undefined, stepSlot: Slot | undefined): Value {
    const compare = (op: BinOp) => {
      const r = this.vreg("bool");
      this.emit({ op: "bin", bop: op, dst: r, a: this.load(type, slot), b: this.load(type, limit), sid: this.sid });
      return r;
    };
    if (step !== undefined) return compare(step >= 0 ? "gt" : "lt");
    // --- (step < 0 AND i < limit) OR (step >= 0 AND i > limit)
    const negative = this.vreg("bool");
    this.emit({ op: "bin", bop: "lt", dst: negative, a: this.load(type, stepSlot!), b: imm(type, 0), sid: this.sid });
    const below = compare("lt");
    const down = this.vreg("bool");
    this.emit({ op: "bin", bop: "land", dst: down, a: negative, b: below, sid: this.sid });
    const positive = this.vreg("bool");
    this.emit({ op: "bin", bop: "ge", dst: positive, a: this.load(type, stepSlot!), b: imm(type, 0), sid: this.sid });
    const above = compare("gt");
    const up = this.vreg("bool");
    this.emit({ op: "bin", bop: "land", dst: up, a: positive, b: above, sid: this.sid });
    const r = this.vreg("bool");
    this.emit({ op: "bin", bop: "lor", dst: r, a: down, b: up, sid: this.sid });
    return r;
  }

  private whileStatement(s: Extract<BoundStatement, { kind: "while" }>): void {
    const test = this.newLabel();
    const body = this.newLabel();
    const exit = this.newLabel();
    this.continueAt(test);
    this.beginStatement(s.header, "loop");
    this.terminate({ op: "br", cond: this.condition(s.condition), ifTrue: body, ifFalse: exit, sid: this.sid });
    this.startBlock(body);
    this.loops.push({ kind: "WHILE", exit, next: test });
    this.statements(s.body);
    this.loops.pop();
    if (!this.block.term) this.terminate({ op: "jmp", target: test, sid: this.sid });
    this.startBlock(exit);
  }

  private doStatement(s: Extract<BoundStatement, { kind: "do" }>): void {
    const body = this.newLabel();
    const test = this.newLabel();
    const exit = this.newLabel();
    const pre = s.test === "preWhile" || s.test === "preUntil";
    if (pre) {
      this.continueAt(test);
      this.beginStatement(s.doSpan, "loop");
      this.doBranch(s, body, exit);
    }
    this.continueAt(body);
    this.loops.push({ kind: "DO", exit, next: pre ? test : test });
    this.statements(s.body);
    this.loops.pop();
    if (pre) {
      if (!this.block.term) this.terminate({ op: "jmp", target: test, sid: this.sid });
      this.startBlock(exit);
      return;
    }
    this.continueAt(test);
    this.beginStatement(s.loop, "loop");
    if (s.test === "none") this.terminate({ op: "jmp", target: s.body.length ? body : test, sid: this.sid });
    else this.doBranch(s, body, exit);
    this.startBlock(exit);
  }

  /** The DO/LOOP test: WHILE continues on true, UNTIL on false. */
  private doBranch(s: Extract<BoundStatement, { kind: "do" }>, body: string, exit: string): void {
    const cond = this.condition(s.condition!);
    const whileForm = s.test === "preWhile" || s.test === "postWhile";
    this.terminate({ op: "br", cond, ifTrue: whileForm ? body : exit, ifFalse: whileForm ? exit : body, sid: this.sid });
  }

  // ===============================================================================================
  // Routines (.docs/kbasic-mir.md §8.8, .docs/kbasic-lir-regalloc.md §6)

  private allocateLocal(type: MType): Slot {
    return this.allocateBytes(mtypeSize(type));
  }

  private allocateBytes(size: number): Slot {
    this.fn.frameSize += size;
    return { kind: "frame", offset: -this.fn.frameSize };
  }

  private lowerRoutine(s: Extract<BoundStatement, { kind: "routine" }>): void {
    const r = s.routine;
    const fastcall = r.convention === "FASTCALL";
    const returnType = r.kind === "function" ? mtypeOf(r.returnType ?? "Float") : undefined;
    this.fn = {
      label: globalName(r.name),
      name: r.name,
      kind: r.kind,
      convention: fastcall ? "fastcall" : "stdcall",
      params: [],
      locals: [],
      frameSize: 0,
      argBytes: 0,
      ...(returnType ? { returnType } : {}),
      blocks: [],
      epilogue: `${globalName(r.name)}.leave`
    };
    this.fnIndex = this.module.functions.length;
    this.module.functions.push(this.fn);
    this.routine = r;
    this.frameSlots = new Map();
    this.localArrays = new Map();
    this.loops = [];
    this.sid = -1;
    const unsupportedType = (t: MType) => !this.supportedType(t) && t !== "ptr";

    // --- Parameters: the stack ones from IX+4 (the first nearest), 8-bit values in their slot's
    // --- high byte; a FASTCALL routine's first one arrives in a register and becomes the first local
    let offset = 4;
    r.params.forEach((p, i) => {
      const byref = p.byref || p.isArray;
      const type: MType = byref ? "ptr" : mtypeOf(p.type);
      if (unsupportedType(type)) {
        this.unsupported(`${p.type} parameters`, p.span);
        return;
      }
      if (fastcall && i === 0) {
        this.fn.registerParam = type;
        this.fn.frameSize = 2;
        const slot: Slot = { kind: "frame", offset: mtypeSize(type) === 1 ? -1 : -2 };
        if (p.symbol) this.frameSlots.set(p.symbol, { slot, byref });
        this.fn.params.push({ name: p.name, type, offset: -2 });
        return;
      }
      const size = mtypeSize(type);
      const slotSize = size === 1 ? 2 : size;
      const slot: Slot = { kind: "frame", offset: size === 1 ? offset + 1 : offset };
      if (p.symbol) this.frameSlots.set(p.symbol, { slot, byref });
      this.fn.params.push({ name: p.name, type, offset });
      offset += slotSize;
      this.fn.argBytes += slotSize;
    });

    // --- Locals: every variable of the routine's scope that is not a parameter
    for (const symbol of r.scope?.symbols ?? []) {
      if (symbol.kind === "array" && symbol.storage === "local") {
        this.localArray(symbol);
        continue;
      }
      if (symbol.kind !== "variable" || symbol.storage !== "local") continue;
      const type = mtypeOf(symbol.type);
      if (!this.supportedType(type)) {
        this.unsupported(`${symbol.type} local variables`, symbol.span);
        continue;
      }
      const slot = this.allocateLocal(type);
      this.frameSlots.set(symbol, { slot, byref: false });
      this.fn.locals.push({ name: symbol.name, type, offset: (slot as { offset: number }).offset });
    }
    this.resultSlot = returnType ? this.allocateLocal(returnType) : undefined;
    if (returnType && !this.supportedType(returnType)) this.unsupported(`${r.returnType} FUNCTION results`, r.span);

    this.startBlock(this.fn.label);
    this.block.instrs.push({ op: "prologue.end", sid: -1 });
    this.setUpLocalArrays();
    this.statements(s.body);
    this.continueAt(this.fn.epilogue!);
    this.beginStatement(s.end, "return");
    this.emit({ op: "epilogue.begin", sid: this.sid });
    // --- Local Strings and by-value String parameters belong to this activation
    for (const [symbol, { slot, byref }] of this.frameSlots) {
      if (symbol.kind === "variable" && symbol.type === "String" && !byref) {
        this.emit({ op: "rtcall", name: this.rt("Free"), args: [this.load("str", slot)], sid: this.sid });
      }
    }
    this.freeLocalArrays();
    const value = this.resultSlot && returnType ? this.load(returnType, this.resultSlot) : undefined;
    this.endStatement();
    this.terminate({ op: "ret", ...(value ? { value } : {}), sid: this.sid });
    this.routine = undefined;
    this.resultSlot = undefined;
  }

  /** A local array: its descriptor in the frame, its tables static (runtime-abi.md §2.3). */
  private localArray(symbol: ArraySymbol): void {
    const type = mtypeOf(symbol.elementType);
    if (!this.supportedType(type)) {
      this.unsupported(`${symbol.elementType} arrays`, symbol.span);
      return;
    }
    const slot = this.allocateBytes(8);
    const tables = this.arrayTables(symbol, `${this.fn.label}.${symbol.name}`);
    this.module.data.push(...tables.items);
    let image: string | undefined;
    if (symbol.initial) {
      image = `${this.fn.label}.${symbol.name}.init`;
      this.module.data.push({ kind: "var", label: image, size: arrayBytes(symbol), init: this.arrayImage(symbol, type) });
    }
    const { items: _, ...names } = tables;
    this.localArrays.set(symbol, { ...names, ...(image ? { image } : {}) });
    this.frameSlots.set(symbol, { slot, byref: false });
  }

  /** At entry: each local array's descriptor, and its data from the heap (or its AT address). */
  private setUpLocalArrays(): void {
    for (const [symbol, tables] of this.localArrays) {
      const base = (this.frameSlots.get(symbol)!.slot as { offset: number }).offset;
      const field = (k: number): Slot => ({ kind: "frame", offset: base + 2 * k });
      const sym = (name: string): SymRef => ({ kind: "sym", type: "ptr", name, offset: 0 });
      this.emit({ op: "store", type: "ptr", slot: field(0), src: sym(tables.dims), sid: -1 });
      if (tables.lower) this.emit({ op: "store", type: "ptr", slot: field(2), src: sym(tables.lower), sid: -1 });
      if (tables.upper) this.emit({ op: "store", type: "ptr", slot: field(3), src: sym(tables.upper), sid: -1 });
      let data: Value;
      if (symbol.at) data = { kind: "sym", type: "ptr", name: atText(symbol.at), offset: 0 };
      else {
        const r = this.vreg("ptr");
        this.emit({ op: "rtcall", name: this.rt("ArrayAlloc"), dst: r, args: [imm("u16", arrayBytes(symbol))], sid: -1 });
        data = r;
      }
      this.emit({ op: "store", type: "ptr", slot: field(1), src: data, sid: -1 });
    }
  }

  /** `DIM a(...) => {...}` in a routine: the values are copied in when the statement runs. */
  private dimLocalArray(symbol: ArraySymbol, span: Span): void {
    const image = this.localArrays.get(symbol)?.image;
    if (!image) return;
    this.beginStatement(span, "declaration");
    const data = this.load("ptr", this.dataSlot(symbol));
    const source: SymRef = { kind: "sym", type: "ptr", name: image, offset: 0 };
    this.emit({ op: "rtcall", name: this.rt("ArrayInit"), args: [source, data, imm("u16", arrayBytes(symbol))], sid: this.sid });
  }

  /** At exit: the heap data of each local array, its Strings first. */
  private freeLocalArrays(): void {
    for (const symbol of this.localArrays.keys()) {
      if (symbol.at) continue;
      const data = this.load("ptr", this.dataSlot(symbol));
      if (symbol.elementType === "String") {
        this.emit({ op: "rtcall", name: this.rt("ArrayFreeStrings"), args: [data, imm("u16", arrayCount(symbol))], sid: this.sid });
      } else this.emit({ op: "rtcall", name: this.rt("Free"), args: [data], sid: this.sid });
    }
  }

  /** The descriptor word of a local array that holds its data's address. */
  private dataSlot(symbol: ArraySymbol): Slot {
    return { kind: "frame", offset: (this.frameSlots.get(symbol)!.slot as { offset: number }).offset + 2 };
  }

  /**
   * An element's address. With the bounds known (a global or local array) it is computed inline: the
   * constant subscripts and every lower bound fold into one offset; each other subscript adds its
   * index times its stride. An array parameter's bounds come with its descriptor: ArrayAddress.
   */
  private elementAddress(symbol: ArraySymbol, indices: BoundExpr[], span: Span): Value {
    const size = mtypeSize(mtypeOf(symbol.elementType));
    if (symbol.param) {
      const local = this.frameSlots.get(symbol);
      if (!local) {
        this.unsupported(`The array parameter '${symbol.name}'`, span);
        return imm("ptr", 0);
      }
      const values = indices.map((i) => this.inVReg(this.value(i)));
      const descriptor = this.load("ptr", local.slot);
      const r = this.vreg("ptr");
      this.emit({ op: "rtcall", name: this.rt("ArrayAddress"), dst: r, args: [...values, descriptor], sid: this.sid });
      return r;
    }
    const counts = symbol.bounds.map((b) => b.upper - b.lower + 1);
    let offset = 0;
    let sum: Value | undefined;
    indices.forEach((index, d) => {
      const scale = counts.slice(d + 1).reduce((a, b) => a * b, 1) * size;
      offset -= symbol.bounds[d].lower * scale;
      const c = index.constant?.value;
      if (c?.kind === "int") {
        offset += Number(c.value) * scale;
        return;
      }
      let term = this.value(index);
      if (scale !== 1) {
        const scaled = this.vreg("u16");
        const shift = Math.log2(scale);
        if (Number.isInteger(shift)) this.emit({ op: "bin", bop: "shl", dst: scaled, a: term, b: imm("u8", shift), sid: this.sid });
        else this.emit({ op: "bin", bop: "mul", dst: scaled, a: term, b: imm("u16", scale), sid: this.sid });
        term = scaled;
      }
      if (!sum) sum = term;
      else {
        const added = this.vreg("u16");
        this.emit({ op: "bin", bop: "add", dst: added, a: sum, b: term, sid: this.sid });
        sum = added;
      }
    });
    offset = ((offset % 0x10000) + 0x10000) % 0x10000;
    if (offset > 0x7fff) offset -= 0x10000;
    if (symbol.storage === "global") {
      const base: SymRef = { kind: "sym", type: "ptr", name: `${globalName(symbol.name)}.data`, offset };
      if (!sum) return base;
      const r = this.vreg("ptr");
      this.emit({ op: "bin", bop: "add", dst: r, a: sum, b: base, sid: this.sid });
      return r;
    }
    if (!this.frameSlots.has(symbol)) {
      this.unsupported(`The array '${symbol.name}'`, span);
      return imm("ptr", 0);
    }
    let address: Value = this.load("ptr", this.dataSlot(symbol));
    if (sum) {
      const r = this.vreg("ptr");
      this.emit({ op: "bin", bop: "add", dst: r, a: sum, b: address, sid: this.sid });
      address = r;
    }
    if (offset) {
      const r = this.vreg("ptr");
      this.emit({ op: "bin", bop: "add", dst: r, a: address, b: imm("u16", offset), sid: this.sid });
      address = r;
    }
    return address;
  }

  /** The address of an array's descriptor (what an array argument passes, and `@a`). */
  private descriptorAddress(symbol: ArraySymbol, span: Span): Value {
    if (symbol.storage === "global" && !symbol.param) return { kind: "sym", type: "ptr", name: globalName(symbol.name), offset: 0 };
    const local = this.frameSlots.get(symbol);
    if (!local) {
      this.unsupported(`The array '${symbol.name}'`, span);
      return imm("ptr", 0);
    }
    if (local.byref) return this.load("ptr", local.slot);
    const r = this.vreg("ptr");
    this.emit({ op: "addr", dst: r, slot: local.slot, sid: this.sid });
    return r;
  }

  /** A value in a vreg: an immediate is loaded into one. */
  private inVReg(v: Value): VReg {
    if (v.kind === "vreg") return v;
    const r = this.vreg(v.type);
    this.emit({ op: "const", dst: r, value: v, sid: this.sid });
    return r;
  }

  /**
   * A SUB or FUNCTION call. Arguments are evaluated last first (.docs/kbasic-mir.md Q1), so the
   * stack machine leaves them where STDCALL wants them; each is a vreg, so each is pushed in turn.
   */
  private call(routine: RoutineSymbol, args: BoundArgument[], resultType: MType | undefined): Value | undefined {
    const values: Value[] = new Array(args.length);
    for (let i = args.length - 1; i >= 0; i--) values[i] = this.argument(args[i]);
    const site: CallSite = { kind: routine.kind, callee: routine.name, moreCallsFollow: false, order: this.statementCalls.length };
    this.statementCalls.push(site);
    const dst = resultType ? this.vreg(resultType) : undefined;
    if (dst?.type === "str") this.owned.add(dst.id);
    this.emit({
      op: "call",
      ...(dst ? { dst } : {}),
      target: globalName(routine.name),
      convention: routine.convention === "FASTCALL" ? "fastcall" : "stdcall",
      args: values,
      site,
      sid: this.sid
    });
    return dst;
  }

  private argument(a: BoundArgument): Value {
    let v: Value;
    if (!a.value) {
      const c = a.param.defaultValue;
      v = c ? this.constantValue(c, mtypeOf(a.param.type), a.param.span) : imm(mtypeOf(a.param.type), 0);
    } else if (a.byref) {
      v = a.value.kind === "variable" || a.value.kind === "element" || a.value.kind === "array" ? this.address(a.value, a.value.span) : this.unsupportedValue("This BYREF argument", a.value.span);
    } else if (mtypeOf(a.param.type) === "str") {
      // --- A by-value String argument is a copy the callee frees (plan §6.7)
      v = this.ownedString(a.value);
      if (v.kind === "vreg") this.owned.delete(v.id);
    } else v = this.value(a.value);
    // --- Every argument is computed into a vreg, so that it is pushed in its turn
    return this.inVReg(v);
  }

  /** The address of a variable, an element or an array's descriptor (a BYREF argument, `@x`). */
  private address(e: AddressTarget, span: Span): Value {
    if (e.kind === "element") return this.elementAddress(e.symbol, e.indices, span);
    if (e.kind === "array") return this.descriptorAddress(e.symbol, span);
    if (e.kind !== "variable") {
      this.unsupported("This address", span);
      return imm("ptr", 0);
    }
    const slot = this.variableSlot(e.symbol, span);
    if (!slot) return imm("ptr", 0);
    if (slot.kind === "global") return { kind: "sym", type: "ptr", name: slot.name, offset: 0 };
    if (slot.kind === "deref") return slot.ptr;
    const r = this.vreg("ptr");
    this.emit({ op: "addr", dst: r, slot, sid: this.sid });
    return r;
  }

  // ===============================================================================================
  // Expressions

  /** A condition as a bool (non-zero is true). */
  private condition(e: BoundExpr): Value {
    const v = this.value(e);
    return this.toBool(v);
  }

  private toBool(v: Value): Value {
    if (v.type === "bool") return v;
    if (v.kind === "imm") return imm("bool", v.value !== 0 ? 1 : 0);
    const r = this.vreg("bool");
    this.emit({ op: "bin", bop: "ne", dst: r, a: v, b: imm(v.type, 0), sid: this.sid });
    return r;
  }

  private load(type: MType, slot: Slot): VReg {
    const r = this.vreg(type);
    this.emit({ op: "load", dst: r, slot, sid: this.sid });
    return r;
  }

  value(e: BoundExpr): Value {
    const type = mtypeOf(e.type);
    if (e.constant) return this.constantValue(e.constant, type, e.span);
    if (!this.supportedType(type)) {
      this.unsupported(`${e.type} values`, e.span);
      return imm(type, 0);
    }
    switch (e.kind) {
      case "variable": {
        const slot = this.variableSlot(e.symbol, e.span);
        if (!slot) return imm(type, 0);
        const v = this.load(type, slot);
        // --- B1: a global or BYREF String that a FUNCTION called later in the statement could change
        if (type === "str" && this.copyBorrowed && (e.symbol.storage === "global" || e.symbol.byref)) return this.dup(v);
        return v;
      }
      case "element": {
        const v = this.load(type, { kind: "deref", ptr: this.elementAddress(e.symbol, e.indices, e.span) });
        // --- B1: an element that a FUNCTION called later in the statement could change
        return type === "str" && this.copyBorrowed ? this.dup(v) : v;
      }
      case "slice":
        return this.slice(e);
      case "convert": {
        const a = this.value(e.operand);
        const r = this.vreg(type);
        this.emit({ op: "conv", dst: r, a, sid: this.sid });
        return r;
      }
      case "unary": {
        const a = this.value(e.operand);
        const r = this.vreg(type);
        this.emit({ op: e.op === "-" ? "neg" : e.op === "BNOT" ? "not" : "lnot", dst: r, a: e.op === "NOT" ? this.toBool(a) : a, sid: this.sid });
        return r;
      }
      case "binary":
        return this.binary(e);
      case "builtin":
        return this.builtin(e, type);
      case "call":
        return this.call(e.routine, e.args, type) ?? imm(type, 0);
      case "address":
        return this.address(e.target, e.span);
      default:
        this.unsupported(`This ${e.kind} expression`, e.span);
        return imm(type, 0);
    }
  }

  private binary(e: Extract<BoundExpr, { kind: "binary" }>): Value {
    const op = BINARY_OPS[e.op];
    if (e.op === "^") {
      this.unsupported("^", e.span);
      return imm(mtypeOf(e.type), 0);
    }
    if (op === "land" || op === "lor" || op === "lxor") {
      const a = this.toBool(this.value(e.left));
      const b = this.toBool(this.value(e.right));
      const r = this.vreg("bool");
      this.emit({ op: "bin", bop: op, dst: r, a, b, sid: this.sid });
      return r;
    }
    if (e.operandType === "String") return this.stringBinary(op, e);
    const a = this.value(e.left);
    const b = this.value(e.right);
    const r = this.vreg(COMPARISONS.has(op) ? "bool" : mtypeOf(e.type));
    this.emit({ op: "bin", bop: op, dst: r, a, b, sid: this.sid });
    return r;
  }

  // ----------------------------------------------------------------------------------------------
  // Strings (.docs/kbasic-string-ownership.md)

  /** 1 when the value is owned (a runtime routine should free it after use), else 0. */
  private consumeFlag(v: Value): number {
    if (v.kind !== "vreg" || !this.owned.has(v.id)) return 0;
    this.owned.delete(v.id);
    return 1;
  }

  /** Consumes an owned value by freeing it. */
  private consume(v: Value, how: "free"): void {
    if (how === "free" && v.kind === "vreg" && this.owned.delete(v.id)) {
      this.emit({ op: "rtcall", name: this.rt("Free"), args: [v], sid: this.sid });
    }
  }

  private dup(v: Value): VReg {
    const r = this.vreg("str");
    this.emit({ op: "rtcall", name: this.rt("StrDup"), dst: r, args: [v], sid: this.sid });
    this.owned.add(r.id);
    return r;
  }

  /** A String value that is owned: a copy of a borrowed one. */
  private ownedString(e: BoundExpr): Value {
    const v = this.value(e);
    if (v.kind === "vreg" && this.owned.has(v.id)) return v;
    return this.dup(v);
  }

  private owns(v: Value): VReg {
    const r = v as VReg;
    this.owned.add(r.id);
    return r;
  }

  private stringBinary(op: BinOp, e: Extract<BoundExpr, { kind: "binary" }>): Value {
    const a = this.value(e.left);
    const b = this.value(e.right);
    const flags = imm("u8", this.consumeFlag(a) | (this.consumeFlag(b) << 1));
    if (op === "add") {
      const r = this.vreg("str");
      this.emit({ op: "rtcall", name: this.rt("StrConcat"), dst: r, args: [a, b, flags], sid: this.sid });
      return this.owns(r);
    }
    // --- StrCompare gives -1, 0 or 1; the comparison is then that against 0
    const order = this.vreg("i8");
    this.emit({ op: "rtcall", name: this.rt("StrCompare"), dst: order, args: [a, b, flags], sid: this.sid });
    const r = this.vreg("bool");
    this.emit({ op: "bin", bop: op, dst: r, a: order, b: imm("i8", 0), sid: this.sid });
    return r;
  }

  /** `s(from TO to)` and `s(i)`: bounds already 0-based (the binder rebased them). */
  private slice(e: Extract<BoundExpr, { kind: "slice" }>): Value {
    const target = this.value(e.target);
    const from = e.from ? this.value(e.from) : imm("u16", 0);
    const to = e.single ? undefined : e.to ? this.value(e.to) : imm("u16", 0xffff);
    const r = this.vreg("str");
    const flags = imm("u8", this.consumeFlag(target));
    if (e.single) {
      // --- One character: the same index as both bounds, evaluated once
      if (from.kind !== "vreg") this.emit({ op: "rtcall", name: this.rt("StrSlice"), dst: r, args: [target, from, from, flags], sid: this.sid });
      else {
        const index = this.hiddenSlot("u16", "chr");
        this.emit({ op: "store", type: "u16", slot: index, src: from, sid: this.sid });
        const low = this.load("u16", index);
        const high = this.load("u16", index);
        this.emit({ op: "rtcall", name: this.rt("StrSlice"), dst: r, args: [target, low, high, flags], sid: this.sid });
      }
    } else this.emit({ op: "rtcall", name: this.rt("StrSlice"), dst: r, args: [target, from, to!, flags], sid: this.sid });
    return this.owns(r);
  }

  private builtin(e: Extract<BoundExpr, { kind: "builtin" }>, type: MType): Value {
    switch (e.name) {
      case "PEEK": {
        const address = this.value(e.args[0]);
        const r = this.vreg(type);
        this.emit({ op: "load", dst: r, slot: { kind: "deref", ptr: address }, sid: this.sid });
        return r;
      }
      case "CHR": {
        let result: Value | undefined;
        for (const arg of e.args) {
          const ch = this.vreg("str");
          this.emit({ op: "rtcall", name: this.rt("StrChr"), dst: ch, args: [this.value(arg)], sid: this.sid });
          if (!result) result = ch;
          else {
            const joined = this.vreg("str");
            this.emit({ op: "rtcall", name: this.rt("StrConcat"), dst: joined, args: [result, ch, imm("u8", 3)], sid: this.sid });
            result = joined;
          }
        }
        return this.owns(result!);
      }
      case "LBOUND":
      case "UBOUND": {
        // --- Bounds the binder could not fold: an array parameter's, or a dimension computed at run time
        const array = e.args[0] as Extract<BoundExpr, { kind: "array" }>;
        const descriptor = this.descriptorAddress(array.symbol, array.span);
        const dim = e.args[1] ? this.value(e.args[1]) : imm("u16", 0);
        const r = this.vreg(type);
        this.emit({ op: "rtcall", name: this.rt(e.name === "LBOUND" ? "ArrayLBound" : "ArrayUBound"), dst: r, args: [descriptor, dim], sid: this.sid });
        return r;
      }
      case "LEN":
      case "CODE": {
        const v = this.value(e.args[0]);
        const r = this.vreg(type);
        this.emit({ op: "rtcall", name: this.rt(e.name === "LEN" ? "StrLength" : "StrCode"), dst: r, args: [v, imm("u8", this.consumeFlag(v))], sid: this.sid });
        return r;
      }
      default:
        this.unsupported(e.name, e.span);
        return imm(type, 0);
    }
  }

  private constantValue(c: Constant, type: MType, span: Span): Value {
    const v = c.value;
    switch (v.kind) {
      case "int":
        return imm(type, Number(BigInt.asIntN(64, v.value)));
      case "address":
        return { kind: "sym", type: "ptr", name: addressLabel(v.symbol), offset: v.offset };
      case "string":
        return this.stringLiteral(v.value);
      default:
        this.unsupported(`${c.type} constants`, span);
        return imm(type, 0);
    }
  }
}

/** Whether a piece of the typed tree calls a user routine (rule B1 of the string note). */
function containsCall(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(containsCall);
  const o = node as Record<string, unknown>;
  if (o.kind === "call" && o.routine) return true;
  for (const [key, value] of Object.entries(o)) {
    if (key === "symbol" || key === "routine" || key === "constant" || key === "span") continue;
    if (containsCall(value)) return true;
  }
  return false;
}

/** Whether a piece of the typed tree calls a builtin function. */
function containsBuiltin(node: unknown, name: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((n) => containsBuiltin(n, name));
  const o = node as Record<string, unknown>;
  if (o.kind === "builtin" && o.name === name) return true;
  for (const [key, value] of Object.entries(o)) {
    if (key === "symbol" || key === "routine" || key === "constant" || key === "span" || key === "label") continue;
    if (containsBuiltin(value, name)) return true;
  }
  return false;
}

/** The routine definitions of a program, including those inside CODEBANK blocks. */
function routinesOf(statements: BoundStatement[]): Extract<BoundStatement, { kind: "routine" }>[] {
  const out: Extract<BoundStatement, { kind: "routine" }>[] = [];
  for (const s of statements) {
    if (s.kind === "routine") out.push(s);
    else if (s.kind === "codebank") out.push(...routinesOf(s.body));
  }
  return out;
}

const BINARY_OPS: Record<string, BinOp> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  MOD: "mod",
  BAND: "and",
  BOR: "or",
  BXOR: "xor",
  SHL: "shl",
  SHR: "shr",
  "=": "eq",
  "<>": "ne",
  "<": "lt",
  "<=": "le",
  ">": "gt",
  ">=": "ge",
  AND: "land",
  OR: "lor",
  XOR: "lxor"
};

function imm(type: MType, value: number): Imm {
  return { kind: "imm", type, value };
}

/**
 * The label of an address constant's symbol: `label:x` for a label, `array:a` for an array's data,
 * a global's (or an array descriptor's) name otherwise.
 */
function addressLabel(symbol: string): string {
  if (symbol.startsWith("label:")) return `_label.${symbol.slice(6).replace(/[$%]$/, "")}`;
  if (symbol.startsWith("array:")) return `${globalName(symbol.slice(6))}.data`;
  return globalName(symbol);
}

/** The address text of `DIM ... AT`. */
function atText(at: Constant): string {
  const v = at.value;
  if (v.kind === "address") return symText({ kind: "sym", type: "ptr", name: addressLabel(v.symbol), offset: v.offset });
  return v.kind === "int" ? String(Number(BigInt.asUintN(16, v.value))) : "0";
}

function arrayCount(symbol: ArraySymbol): number {
  return symbol.bounds.reduce((n, b) => n * (b.upper - b.lower + 1), 1);
}

function arrayBytes(symbol: ArraySymbol): number {
  return arrayCount(symbol) * mtypeSize(mtypeOf(symbol.elementType));
}

function stepConstant(step: BoundExpr): number | undefined {
  const v = step.constant?.value;
  return v?.kind === "int" ? Number(v.value) : undefined;
}

/** The little-endian bytes of an integral constant. */
function bytesOf(c: Constant, type: MType): number[] | undefined {
  if (c.value.kind !== "int") return undefined;
  const size = mtypeSize(type);
  let v = BigInt.asUintN(size * 8, c.value.value);
  const bytes: number[] = [];
  for (let i = 0; i < size; i++) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return bytes;
}
