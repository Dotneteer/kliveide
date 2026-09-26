import type { StatementKind } from "@abstractions/CompilerInfo";
import { runtimeBundle } from "../runtime/generated/runtime-bundle";
import type { DiagnosticBag, Span } from "../diagnostics";
import type { AttrName } from "../syntax/ast";
import type { AddressTarget, BoundArgument, BoundExpr, BoundProgram, BoundStatement } from "../semantics/bound";
import type { Constant } from "../semantics/constants";
import * as f40 from "../semantics/float40";
import type { ArraySymbol, LabelSymbol, RoutineSymbol, Scope, VariableSymbol } from "../semantics/symbols";
import {
  COMPARISONS,
  mtypeOf,
  mtypeSize,
  isSignedM,
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
export function lowerProgram(
  program: BoundProgram,
  globals: Scope,
  diagnostics: DiagnosticBag,
  isLibraryFile: (fileIndex: number) => boolean = () => false
): MModule {
  return new Lowering(diagnostics, isLibraryFile).run(program, globals);
}

/** The labels the runtime modules export (an asm block's `core.X` that is one links its module). */
const RUNTIME_EXPORTS = new Set(runtimeBundle.modules.flatMap((m) => m.exports));

/** The label of a BASIC label or line number. */
export function labelName(label: LabelSymbol): string {
  return `_label.${label.lineNumber !== undefined ? label.lineNumber : label.name.replace(/[$%]$/, "")}`;
}

/** The label of a global variable. */
export function globalName(name: string): string {
  return `_${name}`;
}

/** PrintColour's codes: the ROM's control codes 16-21, and Klive's own 26 BOLD and 27 ITALIC (print.kz80.asm). */
const ATTR_CODES: Record<AttrName, number> = { INK: 16, PAPER: 17, FLASH: 18, BRIGHT: 19, INVERSE: 20, OVER: 21, BOLD: 26, ITALIC: 27 };

/** The labels of an array's static tables (runtime-abi.md §2.3). */
type ArrayTables = { dims: string; lower?: string; upper?: string };

type DataStatement = Extract<BoundStatement, { kind: "data" }>;

/** The label of DATA item n (in source order); `__data_next` holds the next one READ takes. */
const dataItemLabel = (n: number) => `__data${n}`;

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
  /** Float constants by their bytes: each is five bytes of data, loaded like a variable. */
  private readonly floats = new Map<string, string>();
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
  /** The DATA statements in source order, and the item each starts with (their code is generated only when READ or RESTORE is used). */
  private readonly dataStatements: DataStatement[] = [];
  private readonly dataFirstItem = new Map<DataStatement, string>();
  /** RESTORE label: the first item of the DATA statement after the label. */
  private readonly restoreTargets = new Map<LabelSymbol, string>();
  private dataRead = false;

  constructor(
    private readonly diagnostics: DiagnosticBag,
    private readonly isLibraryFile: (fileIndex: number) => boolean
  ) {}

  run(program: BoundProgram, globals: Scope): MModule {
    this.upperTables = containsBuiltin(program.statements, "UBOUND");
    this.collectData(program.statements, []);
    this.dataRead = containsKind(program.statements, "read") || containsKind(program.statements, "restore");
    this.globalData(globals);
    this.fn = { label: "_main", name: "main", kind: "main", convention: "stdcall", params: [], locals: [], frameSize: 0, argBytes: 0, blocks: [] };
    this.module.functions.push(this.fn);
    this.startBlock("_main");
    this.statements(program.statements);
    // --- Falling off the end of the main program is END 0
    this.endStatement();
    this.terminate({ op: "end", code: imm("u16", 0), sid: -1 });
    const reachable = reachableRoutines(program.statements);
    for (const s of routinesOf(program.statements)) {
      // --- A library routine the program never reaches is left out (a user's is kept: inline asm
      // --- may call it by name)
      if (this.isLibraryFile(s.routine.span.file) && !reachable.has(s.routine)) continue;
      this.lowerRoutine(s);
    }
    if (this.dataRead) this.lowerData();
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

  /** A Float constant: a load of its five bytes (a Float is never an immediate at level 0). */
  private floatConstant(value: f40.Float40): VReg {
    const key = value.join(",");
    let label = this.floats.get(key);
    if (!label) {
      label = `__flt${this.floats.size}`;
      this.floats.set(key, label);
      this.module.data.push({ kind: "var", label, size: 5, init: [...value] });
    }
    return this.load("flt", { kind: "global", name: label });
  }

  /** A number of a type: an immediate, or a loaded constant for a Float. */
  private numberValue(type: MType, n: number): Value {
    if (type === "flt") return this.floatConstant(f40.fromNumber(n));
    return imm(type, type === "fix" ? Math.round(n * 65536) : n);
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
    // --- A block with nothing but its jump (the join after an IF, a loop's way back) is reached only
    // --- by branches: its jump belongs to no statement (glue), or a branch would land inside one (G2)
    this.block.term = this.block.instrs.length ? t : { ...t, sid: -1 };
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
    return t === "u8" || t === "i8" || t === "u16" || t === "i16" || t === "u32" || t === "i32" || t === "bool" || t === "ptr" || t === "str" || t === "flt" || t === "fix";
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
      case "attribute": {
        this.beginStatement(s.span, "other", [s.value]);
        const code = ATTR_CODES[s.attr];
        if (!code) {
          this.unsupported(s.attr, s.span);
          return;
        }
        this.emit({ op: "rtcall", name: this.rt("ColourPermanent"), args: [imm("u8", code), this.value(s.value)], sid: this.sid });
        return;
      }
      case "border":
        this.beginStatement(s.span, "other", [s.value]);
        this.emit({ op: "rtcall", name: this.rt("Border"), args: [this.value(s.value)], sid: this.sid });
        return;
      case "pause":
        this.beginStatement(s.span, "other", [s.value]);
        this.emit({ op: "rtcall", name: this.rt("Pause"), args: [this.value(s.value)], sid: this.sid });
        return;
      case "data":
        // --- Not executed where it stands: its items' code runs when READ takes them (lowerData)
        return;
      case "read":
        this.beginStatement(s.span, "call", [s.targets]);
        for (const target of s.targets) this.readInto(target);
        return;
      case "restore": {
        this.beginStatement(s.span, "other");
        const first = s.label ? this.restoreTargets.get(s.label) : this.dataFirstItem.get(this.dataStatements[0]);
        const target: SymRef = { kind: "sym", type: "ptr", name: first ?? this.rt("DataNone"), offset: 0 };
        this.emit({ op: "store", type: "ptr", slot: { kind: "global", name: "__data_next" }, src: target, sid: this.sid });
        return;
      }
      case "tape":
        this.beginStatement(s.span, "other", [s.name, s.target]);
        this.tape(s);
        return;
      case "beep":
        this.beginStatement(s.span, "other", [s.duration, s.pitch]);
        this.emit({ op: "rtcall", name: this.rt("Beep"), args: [this.value(s.duration), this.value(s.pitch)], sid: this.sid });
        return;
      case "plot":
        this.beginStatement(s.span, "other", [s.attrs, s.x, s.y]);
        this.graphics(s.attrs, () => ({ name: "Plot", args: [this.value(s.x), this.value(s.y)] }));
        return;
      case "draw":
        this.beginStatement(s.span, "other", [s.attrs, s.x, s.y, s.angle]);
        if (s.angle) {
          const { arc, angle } = s;
          if (!arc) {
            this.unsupported("DRAW with an arc", angle.span);
            return;
          }
          for (const a of s.attrs) this.colourItem(a.attr, a.value);
          // --- A call's arguments are computed last first, each into a vreg (as `call` does)
          const a = this.inVReg(this.value(angle));
          const y = this.inVReg(this.value(s.y));
          const x = this.inVReg(this.value(s.x));
          this.callValues(arc, [x, y, a], undefined);
          if (s.attrs.length) this.emit({ op: "rtcall", name: this.rt("PrintReset"), args: [], sid: this.sid });
          return;
        }
        this.graphics(s.attrs, () => ({ name: "DrawLine", args: [this.value(s.x), this.value(s.y)] }));
        return;
      case "circle":
        this.beginStatement(s.span, "other", [s.attrs, s.x, s.y, s.radius]);
        this.graphics(s.attrs, () => ({ name: "Circle", args: [this.value(s.x), this.value(s.y), this.value(s.radius)] }));
        return;
      case "randomize":
        this.beginStatement(s.span, "other", [s.seed]);
        if (s.seed) this.emit({ op: "rtcall", name: this.rt("Randomize"), args: [this.value(s.seed)], sid: this.sid });
        else this.emit({ op: "rtcall", name: this.rt("RandomizeFrames"), args: [], sid: this.sid });
        return;
      case "out":
        this.beginStatement(s.span, "other", [s.port, s.value]);
        this.emit({ op: "rtcall", name: "inline.Out", args: [this.value(s.port), this.value(s.value)], sid: this.sid });
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
        this.module.statements[this.sid].asmLines = s.lines.map((l) => l.span);
        // --- A runtime label the block names links its module (the library's asm uses core.PrintCol...)
        for (const line of s.lines)
          for (const m of line.text.matchAll(/\bcore\.([A-Za-z_]\w*)/g)) if (RUNTIME_EXPORTS.has(m[1])) this.rt(m[1]);
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
      default: {
        // --- Every kind is handled; a new one reaches here until it is
        const other = s as { kind: string; span: Span };
        this.unsupported(other.kind.toUpperCase(), other.span);
      }
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
    if (target.kind === "slice") {
      this.assignSubstring(target, valueExpr);
      return;
    }
    if (target.kind === "array" && valueExpr.kind === "array") {
      this.copyArray(target.symbol, valueExpr.symbol, span);
      return;
    }
    if (target.kind !== "variable") {
      this.unsupported("Assignment to this target", span);
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

  /**
   * `s$(a TO b) = v` and `s$(i) = v`: characters overwritten in place (strings.kz80.asm's
   * StrOverwrite). The value is an owned copy, computed first, so that neither a slice of the target
   * itself nor a FUNCTION that reassigns it can disturb the copy; the target's pointer is loaded last.
   */
  private assignSubstring(target: Extract<BoundExpr, { kind: "slice" }>, valueExpr: BoundExpr): void {
    const value = this.ownedString(valueExpr);
    this.owned.delete((value as VReg).id);
    let from: Value;
    let to: Value;
    if (target.single) {
      // --- One character: the same index as both bounds, evaluated once
      const index = this.value(target.from!);
      if (index.kind !== "vreg") from = to = index;
      else {
        const slot = this.hiddenSlot("u16", "chr");
        this.emit({ op: "store", type: "u16", slot, src: index, sid: this.sid });
        from = this.load("u16", slot);
        to = this.load("u16", slot);
      }
    } else {
      from = target.from ? this.value(target.from) : imm("u16", 0);
      to = target.to ? this.value(target.to) : imm("u16", 0xffff);
    }
    const pointer = this.stringPointer(target.target);
    this.emit({ op: "rtcall", name: this.rt("StrOverwrite"), args: [value, from, to, pointer, imm("u8", 1)], sid: this.sid });
  }

  /** The heap block a String variable or element holds, never a copy (it is changed in place). */
  private stringPointer(e: BoundExpr): Value {
    if (e.kind === "element") return this.load("str", { kind: "deref", ptr: this.elementAddress(e.symbol, e.indices, e.span) });
    if (e.kind === "variable") {
      const slot = this.variableSlot(e.symbol, e.span);
      if (slot) return this.load("str", slot);
    }
    this.unsupported("Substring assignment to this target", e.span);
    return imm("str", 0);
  }

  /** `a = b` for whole arrays of the same element type and size: the data copied, Strings duplicated. */
  private copyArray(target: ArraySymbol, source: ArraySymbol, span: Span): void {
    if (target.param || source.param) {
      this.unsupported("Copying an array parameter", span);
      return;
    }
    const src = this.arrayData(source);
    const dst = this.arrayData(target);
    if (target.elementType === "String") {
      this.emit({ op: "rtcall", name: this.rt("ArrayCopyStrings"), args: [src, dst, imm("u16", arrayCount(target))], sid: this.sid });
    } else this.emit({ op: "rtcall", name: this.rt("ArrayInit"), args: [src, dst, imm("u16", arrayBytes(target))], sid: this.sid });
  }

  /** The address of an array's data, as a value (a global's label, a local's from its descriptor). */
  private arrayData(symbol: ArraySymbol): Value {
    if (symbol.storage === "global") return { kind: "sym", type: "ptr", name: `${globalName(symbol.name)}.data`, offset: 0 };
    return this.load("ptr", this.dataSlot(symbol));
  }

  /** `s$ = expr`: an owned value (a copy of a borrowed one), stored with StrStore (string note §3). */
  private storeString(slot: Slot, valueExpr: BoundExpr): void {
    this.storeOwnedString(slot, this.ownedString(valueExpr));
  }

  /** Stores an owned String value into a variable's slot, freeing the value it held. */
  private storeOwnedString(slot: Slot, value: Value): void {
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
  // DATA, READ, RESTORE (data.kz80.asm)

  /** The DATA statements in source order, and which labels come before which (for RESTORE). */
  private collectData(list: BoundStatement[], pending: LabelSymbol[]): LabelSymbol[] {
    for (const s of list) {
      if (s.kind === "label") pending.push(s.label);
      else if (s.kind === "data") {
        const first = dataItemLabel(this.dataStatements.reduce((n, d) => n + d.items.length, 0));
        this.dataStatements.push(s);
        this.dataFirstItem.set(s, first);
        for (const label of pending) this.restoreTargets.set(label, first);
        pending = [];
      } else if (s.kind === "if") {
        for (const b of s.branches) pending = this.collectData(b.body, pending);
        if (s.else) pending = this.collectData(s.else, pending);
      } else if (s.kind === "for" || s.kind === "while" || s.kind === "do") pending = this.collectData(s.body, pending);
    }
    return pending;
  }

  /** READ into one target: the next item (a call into the DATA code), converted to the target's type. */
  private readInto(target: BoundExpr): void {
    const site: CallSite = { kind: "read", moreCallsFollow: false, order: this.statementCalls.length };
    this.statementCalls.push(site);
    this.emit({ op: "call", target: "__data_read", convention: "stdcall", args: [], site, sid: this.sid });
    const type = mtypeOf(target.type);
    const slot: Slot | undefined =
      target.kind === "element"
        ? { kind: "deref", ptr: this.elementAddress(target.symbol, target.indices, target.span) }
        : target.kind === "variable"
          ? this.variableSlot(target.symbol, target.span)
          : undefined;
    if (!slot || !this.supportedType(type)) {
      this.unsupported(`READ into a ${target.type}`, target.span);
      return;
    }
    if (type === "str") {
      const v = this.vreg("str");
      this.emit({ op: "rtcall", name: this.rt("DataString"), dst: v, args: [], sid: this.sid });
      this.owned.add(v.id);
      this.storeOwnedString(slot, v);
      return;
    }
    const f = this.vreg("flt");
    this.emit({ op: "rtcall", name: this.rt("DataNumber"), dst: f, args: [], sid: this.sid });
    let value: Value = f;
    if (type !== "flt") {
      value = this.vreg(type);
      this.emit({ op: "conv", dst: value, a: f, sid: this.sid });
    }
    this.emit({ op: "store", type, slot, src: value, sid: this.sid });
  }

  /**
   * The DATA items' code: `__data_read` jumps to the item `__data_next` names; each item computes its
   * value (a number as a Float, a String as an owned String), hands it to the data module, points
   * `__data_next` at the next item (the last at the first: READ wraps round) and returns. Each DATA
   * statement's items run under that statement's id, so a breakpoint on a DATA line stops when READ
   * takes its first item.
   */
  private lowerData(): void {
    this.fn = { label: "__data_read", name: "DATA", kind: "data", convention: "stdcall", params: [], locals: [], frameSize: 0, argBytes: 0, blocks: [] };
    this.fnIndex = this.module.functions.length;
    this.module.functions.push(this.fn);
    this.routine = undefined;
    this.frameSlots = new Map();
    this.sid = -1;
    this.startBlock("__data_read");
    this.emit({ op: "asm", lines: ["ld hl,(__data_next)", "jp (hl)"], sid: -1 });
    this.terminate({ op: "ret", sid: -1 });
    const count = this.dataStatements.reduce((n, d) => n + d.items.length, 0);
    let n = 0;
    for (const s of this.dataStatements) {
      s.items.forEach((item, k) => {
        this.startBlock(dataItemLabel(n));
        if (k === 0) this.beginStatement(s.span, "other", [s.items]);
        if (mtypeOf(item.type) === "str") {
          const v = this.ownedString(item);
          this.owned.delete((v as VReg).id);
          this.emit({ op: "rtcall", name: this.rt("DataPutString"), args: [v], sid: this.sid });
        } else {
          let v = this.value(item);
          if (v.type !== "flt") {
            const f = this.vreg("flt");
            this.emit({ op: "conv", dst: f, a: this.inVReg(v), sid: this.sid });
            v = f;
          }
          this.emit({ op: "rtcall", name: this.rt("DataPutNumber"), args: [v], sid: this.sid });
        }
        const next: SymRef = { kind: "sym", type: "ptr", name: dataItemLabel((n + 1) % count), offset: 0 };
        this.emit({ op: "store", type: "ptr", slot: { kind: "global", name: "__data_next" }, src: next, sid: this.sid });
        this.terminate({ op: "ret", sid: this.sid });
        n++;
      });
    }
    this.endStatement();
    this.module.data.push({ kind: "raw", label: "__data_next", lines: [`    .defw ${count ? dataItemLabel(0) : this.rt("DataNone")}`] });
  }

  // ----------------------------------------------------------------------------------------------
  // Tape (tape.kz80.asm)

  /**
   * SAVE, LOAD and VERIFY of CODE, SCREEN$ (CODE 16384, 6912) and DATA of one numeric variable or
   * array (a CODE block of its bytes).
   */
  private tape(s: Extract<BoundStatement, { kind: "tape" }>): void {
    let block: { start: BoundExpr | Value; length: BoundExpr | Value } | undefined;
    if (s.target.kind === "data") {
      const v = s.target.target;
      if (!v || (v.kind !== "variable" && v.kind !== "array") || v.type === "String") {
        this.unsupported(`${s.operation} DATA ${v ? "of a String" : "without a name"}`, s.span);
        return;
      }
      if (v.kind === "array" && (v.symbol.param || v.symbol.storage !== "global")) {
        this.unsupported(`${s.operation} DATA of a local array`, s.span);
        return;
      }
      if (v.kind === "variable" && v.symbol.storage !== "global") {
        this.unsupported(`${s.operation} DATA of a local variable`, s.span);
        return;
      }
      const start: Value =
        v.kind === "array"
          ? { kind: "sym", type: "ptr", name: `${globalName(v.symbol.name)}.data`, offset: 0 }
          : { kind: "sym", type: "ptr", name: (this.variableSlot(v.symbol, v.span) as { name: string }).name, offset: 0 };
      block = { start, length: imm("u16", v.kind === "array" ? arrayBytes(v.symbol) : mtypeSize(mtypeOf(v.type))) };
    } else if (s.target.kind === "screen") block = { start: imm("u16", 16384), length: imm("u16", 6912) };
    const name = this.value(s.name);
    const code = s.target.kind === "code" ? s.target : undefined;
    const given = (x: BoundExpr | Value | undefined): Value => (!x ? imm("u16", 0) : "span" in x ? this.value(x) : x);
    const start = given(block?.start ?? code?.start);
    const length = given(block?.length ?? code?.length);
    let flags = this.consumeFlag(name);
    if (s.operation === "SAVE") {
      this.emit({ op: "rtcall", name: this.rt("TapeSave"), args: [name, imm("u8", flags), start, length], sid: this.sid });
      return;
    }
    if (s.operation === "VERIFY") flags |= 2;
    if (block || code?.start) flags |= 4;
    if (block || code?.length) flags |= 8;
    this.emit({ op: "rtcall", name: this.rt("TapeLoad"), args: [name, imm("u8", flags), start, length], sid: this.sid });
  }

  // ----------------------------------------------------------------------------------------------
  // Graphics (graphics.kz80.asm)

  /** A graphics statement: its colour modifiers as temporary colours (like PRINT's), then the call. */
  private graphics(attrs: Extract<BoundStatement, { kind: "plot" }>["attrs"], call: () => { name: string; args: Value[] }): void {
    for (const a of attrs) this.colourItem(a.attr, a.value);
    const { name, args } = call();
    this.emit({ op: "rtcall", name: this.rt(name), args, sid: this.sid });
    if (attrs.length) this.emit({ op: "rtcall", name: this.rt("PrintReset"), args: [], sid: this.sid });
  }

  /** A temporary colour (PrintColour), as a PRINT item or a graphics modifier gives it. */
  private colourItem(attr: AttrName, value: BoundExpr): boolean {
    const code = ATTR_CODES[attr];
    this.emit({ op: "rtcall", name: this.rt("PrintColour"), args: [imm("u8", code), this.value(value)], sid: this.sid });
    return true;
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
        case "attr":
          colours = this.colourItem(item.attr, item.value);
          break;
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
    if (type === "fix") {
      // --- A Fixed prints as the Float of the same value
      const f = this.vreg("flt");
      this.emit({ op: "conv", dst: f, a: this.value(e), sid: this.sid });
      this.emit({ op: "rtcall", name: this.rt("PrintFloat"), args: [f], sid: this.sid });
      return;
    }
    if (type === "str") {
      if (e.constant?.value.kind === "string" && e.constant.value.value === "") return;
      const v = this.value(e);
      this.emit({ op: "rtcall", name: this.rt("PrintStr"), args: [v, imm("u8", this.consumeFlag(v))], sid: this.sid });
      return;
    }
    const name = { u8: "PrintU8", bool: "PrintU8", i8: "PrintI8", u16: "PrintU16", i16: "PrintI16", u32: "PrintU32", i32: "PrintI32", flt: "PrintFloat" }[type as "u8"];
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
    const step = stepSlot ? this.load(type, stepSlot) : s.step ? this.value(s.step) : this.numberValue(type, 1);
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
    const stepValue = this.load(type, stepSlot!);
    this.emit({ op: "bin", bop: "lt", dst: negative, a: stepValue, b: this.numberValue(type, 0), sid: this.sid });
    const below = compare("lt");
    const down = this.vreg("bool");
    this.emit({ op: "bin", bop: "land", dst: down, a: negative, b: below, sid: this.sid });
    const positive = this.vreg("bool");
    const stepAgain = this.load(type, stepSlot!);
    this.emit({ op: "bin", bop: "ge", dst: positive, a: stepAgain, b: this.numberValue(type, 0), sid: this.sid });
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
        // --- Pushed at entry: a word (A in its high byte); for 32 bits DE then HL; a Float's six bytes
        this.fn.frameSize = mtypeSize(type) === 4 ? 4 : mtypeSize(type) === 5 ? 6 : 2;
        const slot: Slot = { kind: "frame", offset: mtypeSize(type) === 1 ? -1 : mtypeSize(type) === 5 ? -5 : -this.fn.frameSize };
        if (p.symbol) this.frameSlots.set(p.symbol, { slot, byref });
        this.fn.params.push({ name: p.name, type, offset: -this.fn.frameSize });
        return;
      }
      // --- Parameters take whole words: a byte is the high byte of its word, a Float the five bytes
      // --- after a padding byte (runtime-abi.md §3.1)
      const size = mtypeSize(type);
      const slotSize = size === 1 ? 2 : size === 5 ? 6 : size;
      const slot: Slot = { kind: "frame", offset: size === 1 || size === 5 ? offset + 1 : offset };
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
    return this.callValues(routine, values, resultType);
  }

  /** A call with its arguments already in vregs, computed last first (by value, none a String). */
  private callValues(routine: RoutineSymbol, values: Value[], resultType: MType | undefined): Value | undefined {
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
    this.emit({ op: "bin", bop: "ne", dst: r, a: v, b: this.numberValue(v.type, 0), sid: this.sid });
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
      case "ACS":
      case "ASN":
      case "ATN":
      case "COS":
      case "EXP":
      case "LN":
      case "SIN":
      case "SQR":
      case "TAN":
        return this.floatUnary(FLOAT_FUNCTIONS[e.name], this.value(e.args[0]));
      case "ABS":
      case "SGN":
        return this.absSgn(e.name, e.args[0], type);
      case "INT": {
        // --- Rounded towards minus infinity, as a Long: a Float through the ROM's INT, an integer as it is
        const a = this.value(e.args[0]);
        const r = this.vreg("i32");
        this.emit({ op: "conv", dst: r, a, sid: this.sid });
        return r;
      }
      case "STR": {
        const r = this.vreg("str");
        this.emit({ op: "rtcall", name: this.rt("FStr"), dst: r, args: [this.value(e.args[0])], sid: this.sid });
        return this.owns(r);
      }
      case "VAL": {
        const v = this.value(e.args[0]);
        const r = this.vreg("flt");
        this.emit({ op: "rtcall", name: this.rt("FVal"), dst: r, args: [v, imm("u8", this.consumeFlag(v))], sid: this.sid });
        return r;
      }
      case "USR": {
        const a = this.value(e.args[0]);
        const r = this.vreg("u16");
        if (a.type === "str") this.emit({ op: "rtcall", name: this.rt("UsrString"), dst: r, args: [a, imm("u8", this.consumeFlag(a))], sid: this.sid });
        else this.emit({ op: "rtcall", name: this.rt("Usr"), dst: r, args: [a], sid: this.sid });
        return r;
      }
      case "RND": {
        const r = this.vreg("flt");
        this.emit({ op: "rtcall", name: this.rt("Rnd"), dst: r, args: [], sid: this.sid });
        return r;
      }
      case "INKEY": {
        const r = this.vreg("str");
        this.emit({ op: "rtcall", name: this.rt("Inkey"), dst: r, args: [], sid: this.sid });
        return this.owns(r);
      }
      case "IN": {
        const r = this.vreg(type);
        this.emit({ op: "rtcall", name: "inline.In", dst: r, args: [this.value(e.args[0])], sid: this.sid });
        return r;
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

  /** A Float function of the ROM calculator (float.kz80.asm's FUnary). */
  private floatUnary(operation: number, a: Value): VReg {
    const r = this.vreg("flt");
    this.emit({ op: "rtcall", name: this.rt("FUnary"), dst: r, args: [a, imm("u8", operation)], sid: this.sid });
    return r;
  }

  /** ABS keeps its argument's type; SGN is a Byte. Unsigned values need no code for ABS. */
  private absSgn(name: string, arg: BoundExpr, type: MType): Value {
    const argType = mtypeOf(arg.type);
    const a = this.value(arg);
    if (argType === "flt") {
      const f = this.floatUnary(name === "ABS" ? 0x2a : 0x29, a);
      if (name === "ABS") return f;
      const r = this.vreg("i8");
      this.emit({ op: "conv", dst: r, a: f, sid: this.sid });
      return r;
    }
    if (!isSignedM(argType)) {
      if (name === "ABS") return a;
      const nonZero = this.toBool(a);
      const r = this.vreg("i8");
      this.emit({ op: "conv", dst: r, a: nonZero, sid: this.sid });
      return r;
    }
    const width = { i8: "I8", i16: "I16", i32: "I32", fix: "I32" }[argType as "i8"];
    const r = this.vreg(name === "ABS" ? type : "i8");
    this.emit({ op: "rtcall", name: this.rt(`${name === "ABS" ? "Abs" : "Sgn"}${width}`), dst: r, args: [a], sid: this.sid });
    return r;
  }

  private constantValue(c: Constant, type: MType, span: Span): Value {
    const v = c.value;
    switch (v.kind) {
      case "int":
        if (type === "flt") return this.floatConstant(f40.fromInteger(Number(v.value)));
        return imm(type, Number(BigInt.asIntN(64, v.value)));
      case "address":
        return { kind: "sym", type: "ptr", name: addressLabel(v.symbol), offset: v.offset };
      case "string":
        return this.stringLiteral(v.value);
      case "float":
        return this.floatConstant(v.value);
      case "fixed":
        return imm(type, v.raw);
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

/** Whether a statement list holds a statement of a kind, at any depth (routines included). */
function containsKind(list: BoundStatement[], kind: string): boolean {
  return list.some((s) => {
    if (s.kind === kind) return true;
    const o = s as unknown as Record<string, unknown>;
    const nested = [o.body, o.else, ...(Array.isArray(o.branches) ? (o.branches as { body: BoundStatement[] }[]).map((b) => b.body) : [])];
    return nested.some((b) => Array.isArray(b) && containsKind(b as BoundStatement[], kind));
  });
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

/**
 * The routines the program can reach: those its main code calls or takes the address of, then those
 * they call, and so on.
 */
function reachableRoutines(statements: BoundStatement[]): Set<RoutineSymbol> {
  const bodies = new Map(routinesOf(statements).map((r) => [r.routine, r.body]));
  const reached = new Set<RoutineSymbol>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;
    if (o.kind === "routine" && o.body) return; // a definition: reached only through a call
    const target =
      o.kind === "call" ? o.routine : o.kind === "address" ? (o.target as { routine?: unknown }).routine : o.kind === "draw" ? o.arc : undefined;
    if (target && !reached.has(target as RoutineSymbol)) {
      reached.add(target as RoutineSymbol);
      visit(bodies.get(target as RoutineSymbol));
    }
    for (const [key, value] of Object.entries(o)) {
      if (key === "symbol" || key === "routine" || key === "arc" || key === "constant" || key === "span" || key === "label") continue;
      visit(value);
    }
  };
  visit(statements);
  return reached;
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
  "^": "pow",
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

/** The ROM calculator operation of each Float function. */
const FLOAT_FUNCTIONS: Record<string, number> = { SIN: 0x1f, COS: 0x20, TAN: 0x21, ASN: 0x22, ACS: 0x23, ATN: 0x24, LN: 0x25, EXP: 0x26, SQR: 0x28 };

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

/** A constant STEP's value, for its sign; undefined when the step is computed at run time. */
function stepConstant(step: BoundExpr): number | undefined {
  const v = step.constant?.value;
  if (v?.kind === "fixed") return v.raw / 65536;
  return v?.kind === "int" ? Number(v.value) : v?.kind === "float" ? f40.toNumber(v.value) : undefined;
}

/** The bytes of a constant in memory: little-endian for an integer, the five bytes of a Float. */
function bytesOf(c: Constant, type: MType): number[] | undefined {
  if (type === "flt") {
    if (c.value.kind === "float") return [...c.value.value];
    if (c.value.kind === "int") return [...f40.fromInteger(Number(c.value.value))];
    return undefined;
  }
  if (c.value.kind === "fixed") c = { ...c, value: { kind: "int", value: BigInt(c.value.raw) } };
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
