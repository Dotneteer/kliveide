import type { DiagnosticBag, Span } from "../diagnostics";
import type { KBasicOptions } from "../options/options";
import type {
  AttrModifier,
  DimBound,
  Expression,
  JumpTarget,
  LoopKind,
  NameRef,
  Param,
  PrintItem,
  Program,
  RoutineHeader,
  Statement,
  Vector
} from "../syntax/ast";
import type { BoundAttr, BoundExpr, BoundPrintItem, BoundProgram, BoundStatement } from "./bound";
import { constantText, type Constant } from "./constants";
import { ExpressionBinder, type BindSettings } from "./expressions";
import { checkFlow } from "./flow";
import {
  Scope,
  kindText,
  type ArrayBound,
  type ArraySymbol,
  type ConstSymbol,
  type LabelSymbol,
  type ParamSymbol,
  type RoutineSymbol,
  type VariableSymbol
} from "./symbols";
import { commonType, integralRange, isIntegral, isNumeric, typeOfName, typeOfSigil, type KType } from "./types";

export type BindResult = {
  program: BoundProgram;
  globals: Scope;
};

/**
 * Binds a parsed program (plan §3.1, "Binder / checker"): resolves every name, types every
 * expression, folds constants and reports the spec's semantic errors and warnings. Labels and
 * routine headers are collected first, because GOTO targets and calls may come before them; every
 * other name follows the source order, as the spec's declaration rules require.
 */
export function bind(
  program: Program,
  options: KBasicOptions,
  diagnostics: DiagnosticBag,
  inits: { name: string; span: Span }[] = []
): BindResult {
  const result = new Binder(options, diagnostics).run(program);
  checkFlow(result.program, result.globals, options.optimize, diagnostics);
  for (const init of inits) {
    // --- #init names a routine the program start calls; it must be resident (spec extensions.codebank)
    const routine = result.program.routines.find((r) => r.name === init.name);
    if (routine && routine.bank !== 0) diagnostics.error("E453", `#init ${init.name}: the routine is in bank ${routine.bank}; an #init routine must be resident`, init.span);
  }
  return result;
}

class Binder extends ExpressionBinder {
  /** Pragma stacks for `#pragma push(name)` / `pop(name)`. */
  private readonly pragmaStacks = new Map<string, unknown[]>();
  /** The enclosing loops, innermost last (EXIT, CONTINUE). */
  private loops: LoopKind[] = [];
  /** Routine headers by their syntax node, from pass 1. */
  private readonly headerSymbols = new Map<RoutineHeader, RoutineSymbol>();

  constructor(options: KBasicOptions, diagnostics: DiagnosticBag) {
    super(options, diagnostics);
  }

  run(program: Program): BindResult {
    this.hoist(program.statements, undefined, 0);
    const statements = this.block(program.statements);
    this.finish();
    return { program: { statements, routines: this.routines, labels: [...this.labels.values()] }, globals: this.globals };
  }

  // ===============================================================================================
  // Pass 1: labels and routine headers

  private hoist(statements: Statement[], routine: RoutineSymbol | undefined, bank: number): void {
    for (const s of statements) {
      switch (s.kind) {
        case "label":
          this.declareLabel(s.name, s.lineNumber, s.span, routine, bank);
          break;
        case "routine": {
          const symbol = this.declareRoutine(s.header, false, bank);
          this.hoist(s.body, symbol, bank);
          break;
        }
        case "declare":
          this.declareRoutine(s.header, true, bank);
          break;
        case "codebank": {
          const n = s.bank.kind === "number" && Number.isInteger(s.bank.value) ? s.bank.value : bank;
          this.hoist(s.body, routine, n);
          break;
        }
        case "if":
          this.hoist(s.then, routine, bank);
          for (const e of s.elseIfs) this.hoist(e.body, routine, bank);
          if (s.else) this.hoist(s.else, routine, bank);
          break;
        case "for":
        case "while":
        case "do":
          this.hoist(s.body, routine, bank);
          break;
        case "pragma":
          if (s.name === "codebank" && s.action === "set" && s.value && /^\d+$/.test(s.value)) bank = Number(s.value);
          break;
      }
    }
  }

  private declareLabel(name: string, lineNumber: number | undefined, span: Span, routine: RoutineSymbol | undefined, bank: number): void {
    const key = lineNumber !== undefined ? `#${lineNumber}` : name.replace(/[$%]$/, "");
    const existing = this.labels.get(key);
    if (existing) {
      this.error("E403", `${lineNumber !== undefined ? `Line number ${lineNumber}` : `Label '${name}'`} is already declared`, span);
      return;
    }
    this.labels.set(key, { kind: "label", name, ...(lineNumber !== undefined ? { lineNumber } : {}), span, uses: [], ...(routine ? { routine } : {}), bank });
  }

  /** A SUB or FUNCTION header: the definition, or a DECLARE (checked against each other). */
  private declareRoutine(header: RoutineHeader, isDeclare: boolean, bank: number): RoutineSymbol {
    const kind = header.routine === "SUB" ? "sub" : "function";
    const params = header.params.map((p) => this.paramOf(p));
    const returnType = kind === "function" ? (header.returnType ? typeOfName(header.returnType.name) : header.name.sigil ? typeOfSigil(header.name.sigil) : "Float") : undefined;
    const existing = this.globals.lookupLocal(header.name.name, this.settings.caseInsensitive);
    if (existing && (existing.kind === "sub" || existing.kind === "function")) {
      const symbol = existing;
      if (isDeclare) {
        if (symbol.declaredAt) this.error("E403", `${header.name.name} is already declared`, header.name.span);
        else if (symbol.definedAt) this.error("E415", `DECLARE of ${header.name.name} after its definition`, header.name.span);
        else symbol.declaredAt = header.span;
      } else if (symbol.definedAt) {
        this.error("E403", `${header.name.name} is already defined`, header.name.span);
      } else {
        this.checkAgainstDeclare(symbol, kind, params, returnType, header);
        symbol.definedAt = header.span;
        symbol.span = header.name.span;
        symbol.params = params;
        symbol.bank = bank;
      }
      this.headerSymbols.set(header, symbol);
      return symbol;
    }
    if (existing) this.error("E403", `'${header.name.name}' is already declared as ${kindText(existing)}`, header.name.span);
    const symbol: RoutineSymbol = {
      kind,
      name: header.name.name,
      span: header.name.span,
      uses: [],
      bank,
      convention: header.convention ?? "STDCALL",
      params,
      ...(returnType ? { returnType } : {}),
      ...(isDeclare ? { declaredAt: header.span } : { definedAt: header.span }),
      called: false
    };
    if (!existing) this.globals.add(symbol);
    this.routines.push(symbol);
    this.headerSymbols.set(header, symbol);
    return symbol;
  }

  private paramOf(p: Param): ParamSymbol {
    const type = p.type ? typeOfName(p.type.name) : p.name.sigil ? typeOfSigil(p.name.sigil) : "Float";
    const byref = p.isArray || (p.passing ? p.passing === "BYREF" : this.settings.defaultByref);
    return { name: p.name.name, span: p.name.span, type, byref, isArray: p.isArray, hasDefault: !!p.defaultValue };
  }

  private checkAgainstDeclare(symbol: RoutineSymbol, kind: "sub" | "function", params: ParamSymbol[], returnType: KType | undefined, header: RoutineHeader): void {
    const where = header.name.span;
    if (symbol.kind !== kind) {
      this.error("E415", `${header.name.name} was declared as a ${symbol.kind.toUpperCase()}`, where);
      return;
    }
    if (symbol.returnType !== returnType) {
      this.error("E415", `${header.name.name} was declared to return ${symbol.returnType}, not ${returnType}`, where);
    }
    if ((header.convention ?? "STDCALL") !== symbol.convention) {
      this.error("E415", `${header.name.name} was declared ${symbol.convention}`, where);
    }
    if (symbol.params.length !== params.length) {
      this.error("E415", `${header.name.name} was declared with ${symbol.params.length} parameter(s), not ${params.length}`, where);
      return;
    }
    symbol.params.forEach((d, i) => {
      const p = params[i];
      if (d.type !== p.type || d.byref !== p.byref || d.isArray !== p.isArray) {
        this.error("E415", `Parameter ${i + 1} of ${header.name.name} does not match its DECLARE`, p.span);
      } else if (d.name !== p.name) {
        this.warning("K405", `Parameter ${i + 1} of ${header.name.name} is '${d.name}' in its DECLARE`, p.span);
      }
    });
  }

  // ===============================================================================================
  // Pass 2: statements

  private block(statements: Statement[]): BoundStatement[] {
    const out: BoundStatement[] = [];
    for (const s of statements) {
      const bound = this.statement(s);
      if (bound) out.push(bound);
    }
    return out;
  }

  private statement(s: Statement): BoundStatement | undefined {
    const span = s.span;
    switch (s.kind) {
      case "label": {
        const label = this.labels.get(s.lineNumber !== undefined ? `#${s.lineNumber}` : s.name.replace(/[$%]$/, ""));
        return label ? { kind: "label", span, label } : undefined;
      }
      case "pragma":
        this.pragma(s.name, s.action, s.value);
        return undefined;
      case "print":
        return { kind: "print", span, items: s.items.map((i) => this.printItem(i)) };
      case "attribute":
        return { kind: "attribute", span, attr: s.attr, value: this.valueAs(s.value, "UByte") };
      case "border":
        return { kind: "border", span, value: this.valueAs(s.value, "UByte") };
      case "beep":
        return { kind: "beep", span, duration: this.valueAs(s.duration, "Float"), pitch: this.valueAs(s.pitch, "Float") };
      case "cls":
        return { kind: "cls", span };
      case "plot":
        return { kind: "plot", span, attrs: this.attrs(s.attrs), x: this.valueAs(s.x, "UByte"), y: this.valueAs(s.y, "UByte") };
      case "draw":
        return {
          kind: "draw",
          span,
          attrs: this.attrs(s.attrs),
          x: this.valueAs(s.x, "Integer"),
          y: this.valueAs(s.y, "Integer"),
          ...(s.angle ? { angle: this.valueAs(s.angle, "Float") } : {})
        };
      case "circle":
        return {
          kind: "circle",
          span,
          attrs: this.attrs(s.attrs),
          x: this.valueAs(s.x, "Byte"),
          y: this.valueAs(s.y, "Byte"),
          radius: this.valueAs(s.radius, "Byte")
        };
      case "let":
        return this.assignment(s.target, s.value, span);
      case "callStatement":
        return this.callStatement(s.callee, s.args, span);
      case "dim":
        return this.dim(s);
      case "const":
        this.constDeclaration(s.name, s.type ? typeOfName(s.type.name) : undefined, s.value);
        return undefined;
      case "if":
        return this.ifStatement(s);
      case "for":
        return this.forStatement(s);
      case "while": {
        const condition = this.condition(s.condition);
        const body = this.loopBody("WHILE", s.body, span);
        return { kind: "while", span, header: { ...span, end: s.condition.span.end }, condition, body };
      }
      case "do": {
        const condition = s.condition ? this.condition(s.condition) : undefined;
        const body = this.loopBody("DO", s.body, span);
        const pre = s.test === "preUntil" || s.test === "preWhile";
        const doSpan = pre && s.condition ? { ...span, end: s.condition.span.end } : { ...span, end: span.start + 2 };
        return { kind: "do", span, test: s.test, ...(condition ? { condition } : {}), body, loop: s.loop.span, doSpan };
      }
      case "exit":
      case "continue":
        if (!this.loops.includes(s.loop)) {
          this.error("E412", `${s.kind.toUpperCase()} ${s.loop} outside a ${s.loop} loop`, span);
        }
        return { kind: s.kind, span, loop: s.loop };
      case "goto":
      case "gosub": {
        if (s.kind === "gosub" && this.routine) this.error("E413", "GOSUB is not allowed inside a SUB or FUNCTION", span);
        const label = this.jumpTarget(s.target);
        return label ? { kind: s.kind, span, label } : undefined;
      }
      case "on": {
        if (s.jump === "GOSUB" && this.routine) this.error("E413", "GOSUB is not allowed inside a SUB or FUNCTION", span);
        const selector = this.valueAs(s.selector, "UByte");
        const labels = s.targets.map((t) => this.jumpTarget(t)).filter((l): l is LabelSymbol => !!l);
        return { kind: "on", span, selector, jump: s.jump, labels };
      }
      case "return":
        return this.returnStatement(s.value, span);
      case "end":
      case "stop":
        return { kind: s.kind, span, ...(s.value ? { value: this.valueAs(s.value, s.kind === "end" ? "UInteger" : "UByte") } : {}) };
      case "error":
        return { kind: "error", span, value: this.valueAs(s.value, "UByte") };
      case "poke": {
        const type = s.type ? typeOfName(s.type.name) : "UByte";
        return { kind: "poke", span, type, address: this.valueAs(s.address, "UInteger"), value: this.valueAs(s.value, type, true) };
      }
      case "out":
        return { kind: "out", span, port: this.valueAs(s.port, "UInteger"), value: this.valueAs(s.value, "UByte") };
      case "pause":
        return { kind: "pause", span, value: this.valueAs(s.value, "UInteger") };
      case "randomize":
        return { kind: "randomize", span, ...(s.seed ? { seed: this.valueAs(s.seed, "ULong") } : {}) };
      case "read":
        return { kind: "read", span, targets: s.targets.map((t) => this.readTarget(t)) };
      case "data":
        if (this.routine) this.error("E413", "DATA is not allowed inside a SUB or FUNCTION", span);
        return { kind: "data", span, items: s.items.map((i) => this.value(i)) };
      case "restore": {
        const label = s.target ? this.jumpTarget(s.target) : undefined;
        return { kind: "restore", span, ...(label ? { label } : {}) };
      }
      case "tape":
        return this.tape(s);
      case "routine":
        return this.routineDefinition(s.header, s.body, span, s.end.span);
      case "declare":
        return undefined;
      case "asm":
        return { kind: "asm", span, lines: s.lines.map((l) => ({ text: l.text, span: l.span })) };
      case "codebank":
        return this.codebank(s.bank, s.body, span);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // Pragmas (spec `preprocessor.pragmas`): the ones that change binding

  private pragma(name: string | undefined, action: "set" | "push" | "pop", value: string | undefined): void {
    if (!name) return;
    const key = Object.hasOwn(PRAGMA_SETTINGS, name) ? PRAGMA_SETTINGS[name] : undefined;
    if (!key) return;
    if (action === "push") {
      const stack = this.pragmaStacks.get(name) ?? [];
      stack.push(this.settings[key]);
      this.pragmaStacks.set(name, stack);
      return;
    }
    if (action === "pop") {
      const stack = this.pragmaStacks.get(name);
      if (stack?.length) (this.settings as Record<string, unknown>)[key] = stack.pop();
      return;
    }
    const v = (value ?? "").trim().toLowerCase();
    const current = this.settings[key];
    (this.settings as Record<string, unknown>)[key] =
      typeof current === "boolean" ? ["", "true", "on", "yes", "+", "1"].includes(v) : Number.parseInt(v.replace(/^\$/, "0x"), v.startsWith("$") ? 16 : 10) || 0;
  }

  // ----------------------------------------------------------------------------------------------
  // PRINT and attributes

  private printItem(i: PrintItem): BoundPrintItem {
    switch (i.kind) {
      case "expr":
        return { kind: "expr", value: this.value(i.value) };
      case "at":
        return { kind: "at", row: this.valueAs(i.row, "UByte"), column: this.valueAs(i.column, "UByte") };
      case "tab":
        return { kind: "tab", column: this.valueAs(i.column, "UByte") };
      case "attrModifier":
        return { kind: "attr", attr: i.attr, value: this.valueAs(i.value, "UByte") };
      case "separator":
        return { kind: "separator", separator: i.separator };
    }
  }

  private attrs(list: AttrModifier[]): BoundAttr[] {
    return list.map((a) => ({ attr: a.attr, value: this.valueAs(a.value, "UByte") }));
  }

  // ----------------------------------------------------------------------------------------------
  // Assignment

  private assignment(target: Expression, valueExpr: Expression, span: Span): BoundStatement | undefined {
    // --- An undeclared scalar takes its type from the value (spec `types.default_type`)
    if (target.kind === "name" && !this.lookup(target.name) && !this.findLabel(target.name)) {
      const value = this.expr(valueExpr);
      if (value.kind === "array") {
        this.error("E423", `An array cannot be assigned to the scalar '${target.name}'`, value.span);
        return undefined;
      }
      const symbol = this.implicitVariable(target, value.kind === "error" ? undefined : value.type);
      symbol.assigned = true;
      const bound: BoundExpr = { kind: "variable", span: target.span, type: symbol.type, symbol };
      return { kind: "assign", span, target: bound, value: this.convert(value, symbol.type, true) };
    }
    const lhs = this.lvalue(target);
    if (!lhs) {
      this.expr(valueExpr);
      return undefined;
    }
    if (lhs.kind === "array") {
      const value = this.expr(valueExpr);
      if (value.kind !== "array") {
        if (value.kind !== "error") this.error("E423", `'${lhs.symbol.name}' is an array: only another array can be assigned to it`, value.span);
        return undefined;
      }
      this.checkArrayCopy(lhs.symbol, value.symbol, span);
      return { kind: "assign", span, target: lhs, value };
    }
    const value = this.expr(valueExpr);
    if (value.kind === "array") {
      this.error("E423", `An array cannot be assigned to a scalar`, value.span);
      return undefined;
    }
    return { kind: "assign", span, target: lhs, value: this.convert(value, lhs.type, true) };
  }

  /** Whole-array copy (spec `types.conversions.whole_array_assignment`). */
  private checkArrayCopy(to: ArraySymbol, from: ArraySymbol, span: Span): void {
    const count = (a: ArraySymbol) => a.bounds.reduce((n, b) => n * (b.upper - b.lower + 1), 1);
    if (to.elementType !== from.elementType || (!to.param && !from.param && count(to) !== count(from))) {
      this.error("E424", `Array '${from.name}' cannot be copied into '${to.name}': the element type and size must be the same`, span);
      return;
    }
    const shape = (a: ArraySymbol) => a.bounds.map((b) => b.upper - b.lower + 1).join(",");
    if (!to.param && !from.param && shape(to) !== shape(from)) {
      this.warning("K404", `Arrays '${from.name}' and '${to.name}' have different dimensions`, span);
    }
  }

  /** Something that can be assigned: a variable, an element, a substring or a whole array. */
  private lvalue(target: Expression): BoundExpr | undefined {
    if (target.kind === "name") {
      const symbol = this.lookup(target.name);
      if (!symbol) {
        if (this.findLabel(target.name)) {
          this.error("E423", `'${target.name}' is a label: it cannot be assigned`, target.span);
          return undefined;
        }
        const created = this.implicitVariable(target);
        created.assigned = true;
        return { kind: "variable", span: target.span, type: created.type, symbol: created };
      }
      switch (symbol.kind) {
        case "variable":
          this.checkSigil(target, symbol.type);
          this.noteUse(symbol, target.span);
          symbol.assigned = true;
          return { kind: "variable", span: target.span, type: symbol.type, symbol };
        case "array":
          this.noteUse(symbol, target.span);
          return { kind: "array", span: target.span, type: symbol.elementType, symbol };
        default:
          this.error("E423", `'${target.name}' is ${kindText(symbol)}: it cannot be assigned`, target.span);
          return undefined;
      }
    }
    if (target.kind === "call") {
      const bound = this.callExpr(target.callee, target.args, target.span);
      if (bound.kind === "error") return undefined;
      if (bound.kind === "element") return bound;
      if (bound.kind === "slice") {
        let inner: BoundExpr = bound.target;
        while (inner.kind === "slice") inner = inner.target;
        if (inner.kind === "variable" || inner.kind === "element") {
          if (inner.kind === "variable") inner.symbol.assigned = true;
          return bound;
        }
      }
      this.error("E423", "Only a variable, an array element or a substring of one can be assigned", target.span);
      return undefined;
    }
    this.error("E423", "Only a variable, an array element or a substring of one can be assigned", target.span);
    return undefined;
  }

  // ----------------------------------------------------------------------------------------------
  // Calls as statements

  private callStatement(callee: NameRef, args: import("../syntax/ast").Argument[], span: Span): BoundStatement | undefined {
    const symbol = this.lookup(callee.name);
    if (!symbol || (symbol.kind !== "sub" && symbol.kind !== "function")) {
      if (symbol) this.error("E429", `'${callee.name}' is ${kindText(symbol)}, not a SUB or FUNCTION`, callee.span);
      else this.error("E401", `SUB '${callee.name}' is not declared`, callee.span);
      this.bindArgumentsLoosely(args);
      return undefined;
    }
    symbol.called = true;
    this.noteUse(symbol, callee.span, "call");
    return { kind: "call", span, routine: symbol, args: this.matchArguments(symbol, args, span) };
  }

  // ----------------------------------------------------------------------------------------------
  // Declarations

  private dim(s: Extract<Statement, { kind: "dim" }>): BoundStatement | undefined {
    if (s.bounds) return this.dimArray(s.names[0], s.type ? typeOfName(s.type.name) : undefined, s.bounds, s.at, s.vector, s.span);
    const declaredType = s.type ? typeOfName(s.type.name) : undefined;
    let result: BoundStatement | undefined;
    for (const ref of s.names) {
      if (declaredType && ref.sigil) this.checkSigil(ref, declaredType);
      const initial = s.initialValue ? this.value(s.initialValue) : undefined;
      let type: KType;
      if (declaredType) type = declaredType;
      else if (ref.sigil) type = typeOfSigil(ref.sigil);
      else if (initial && initial.kind !== "error") type = initial.type === "Boolean" ? "UByte" : initial.type;
      else type = this.defaultType(ref.name, ref.span);
      const symbol = this.declareVariable(ref, type);
      if (!symbol) continue;
      if (s.at) {
        const at = this.address(s.at);
        if (at) symbol.at = at;
        symbol.assigned = true;
      }
      if (initial && initial.kind !== "error") {
        const value = this.convert(initial, type, true);
        symbol.assigned = true;
        if (value.constant && type !== "String" && symbol.storage === "global") symbol.initial = value.constant;
        else result = { kind: "dim", span: s.span, symbol, value };
      } else if (symbol.storage === "local") {
        result = { kind: "dim", span: s.span, symbol };
      }
    }
    return result;
  }

  /** Declares a scalar in the current scope; E403 for a name taken there, E404 for one used before. */
  private declareVariable(ref: NameRef, type: KType): VariableSymbol | undefined {
    const existing = this.scope.lookupLocal(ref.name, this.settings.caseInsensitive);
    if (existing) {
      if (existing.kind === "variable" && !existing.declared) {
        this.error("E404", `'${ref.name}' is declared after it was already used`, ref.span);
        existing.declared = true;
        existing.type = type;
        return existing;
      }
      this.error("E403", `'${ref.name}' is already declared as ${kindText(existing)}${existing.kind === "variable" && existing.storage === "param" ? " (a parameter)" : ""}`, ref.span);
      return undefined;
    }
    this.checkFastcallLocal(ref.name, ref.span);
    const symbol: VariableSymbol = {
      kind: "variable",
      name: ref.name,
      span: ref.span,
      uses: [],
      bank: this.settings.bank,
      type,
      storage: this.routine ? "local" : "global",
      declared: true,
      assigned: false,
      read: false
    };
    this.scope.add(symbol);
    return symbol;
  }

  /** An AT address (spec DIM): a constant number or a constant address. */
  private address(e: Expression): Constant | undefined {
    const bound = this.valueAs(e, "UInteger");
    if (bound.kind === "error") return undefined;
    if (!bound.constant) {
      this.error("E406", "An AT address must be a constant (a number, @global, @label or @array(constant subscripts))", e.span);
      return undefined;
    }
    return bound.constant;
  }

  private dimArray(ref: NameRef, declaredType: KType | undefined, boundsSyntax: DimBound[], at: Expression | undefined, vector: Vector | undefined, span: Span): BoundStatement | undefined {
    if (declaredType && ref.sigil) this.checkSigil(ref, declaredType);
    const elementType = declaredType ?? (ref.sigil ? typeOfSigil(ref.sigil) : this.defaultType(ref.name, ref.span, "Array"));
    const bounds: ArrayBound[] = [];
    for (const b of boundsSyntax) {
      const lower = b.lower ? this.integerConstant(b.lower, "An array bound", "E405") : this.settings.arrayBase;
      const upper = this.integerConstant(b.upper, "An array bound", "E405");
      if (lower === undefined || upper === undefined) {
        bounds.push({ lower: 0, upper: 0 });
        continue;
      }
      if (lower < 0 || upper < 0) this.error("E405", "Array bounds cannot be negative", b.span);
      else if (lower > upper) this.error("E405", `The lower bound ${lower} is above the upper bound ${upper}`, b.span);
      bounds.push({ lower: Math.max(0, lower), upper: Math.max(Math.max(0, lower), upper) });
    }
    const existing = this.scope.lookupLocal(ref.name, this.settings.caseInsensitive);
    if (existing) {
      this.error(existing.kind === "variable" && !existing.declared ? "E404" : "E403", `'${ref.name}' is already ${existing.kind === "variable" && !existing.declared ? "used as a variable" : `declared as ${kindText(existing)}`}`, ref.span);
      return undefined;
    }
    this.checkFastcallLocal(ref.name, ref.span);
    const symbol: ArraySymbol = {
      kind: "array",
      name: ref.name,
      span: ref.span,
      uses: [],
      bank: this.settings.bank,
      elementType,
      storage: this.routine ? "local" : "global",
      bounds,
      read: false
    };
    this.scope.add(symbol);
    if (at) {
      const address = this.address(at);
      if (address) symbol.at = address;
    }
    if (vector) {
      if (elementType === "String") this.error("E408", "A String array cannot have an initialiser", vector.span);
      else symbol.initial = this.initialiser(vector, bounds, elementType);
    }
    return symbol.storage === "local" ? { kind: "dim", span, symbol } : undefined;
  }

  /** `=> {...}`: nested to the dimensions, each list as long as its dimension (E407). */
  private initialiser(vector: Vector, bounds: ArrayBound[], type: KType): Constant[] | undefined {
    const values: Constant[] = [];
    let ok = true;
    const walk = (v: Vector, depth: number) => {
      const length = bounds[depth].upper - bounds[depth].lower + 1;
      if (v.items.length !== length) {
        this.error("E407", `This list needs ${length} item(s), not ${v.items.length}`, v.span);
        ok = false;
      }
      for (const item of v.items) {
        const nested = item.kind === "vector";
        if (depth < bounds.length - 1) {
          if (!nested) {
            this.error("E407", "A nested list { ... } is needed here", item.span);
            ok = false;
          } else walk(item, depth + 1);
          continue;
        }
        if (nested) {
          this.error("E407", "A value is needed here, not a list", item.span);
          ok = false;
          continue;
        }
        const bound = this.valueAs(item, type);
        if (bound.kind === "error") ok = false;
        else if (!bound.constant) {
          this.error("E406", "An array initialiser needs constant values", item.span);
          ok = false;
        } else values.push(bound.constant);
      }
    };
    walk(vector, 0);
    return ok ? values : undefined;
  }

  private constDeclaration(ref: NameRef, declaredType: KType | undefined, valueExpr: Expression): void {
    const value = this.value(valueExpr);
    if (value.kind === "error") return;
    if (!value.constant) {
      this.error("E425", `The value of constant '${ref.name}' must be a constant expression`, valueExpr.span);
      return;
    }
    let constant = value.constant;
    const type = declaredType ?? (ref.sigil ? typeOfSigil(ref.sigil) : constant.type === "Boolean" ? "UByte" : constant.type);
    if (type !== constant.type) {
      const converted = this.convert(value, type);
      if (!converted.constant) return;
      constant = converted.constant;
    }
    const existing = this.scope.lookupLocal(ref.name, this.settings.caseInsensitive);
    if (existing) {
      this.error("E403", `'${ref.name}' is already declared as ${kindText(existing)}`, ref.span);
      return;
    }
    const symbol: ConstSymbol = { kind: "const", name: ref.name, span: ref.span, uses: [], bank: this.settings.bank, type, value: { ...constant, type, literal: declaredType ? undefined : constant.literal } };
    if (!symbol.value.literal) delete symbol.value.literal;
    this.scope.add(symbol);
  }

  // ----------------------------------------------------------------------------------------------
  // Control flow

  /** A condition: numeric; W110 when it is a constant. */
  private condition(e: Expression): BoundExpr {
    const bound = this.numeric(e);
    const truth = this.truthOfConstant(bound);
    if (truth !== undefined) this.warning("W110", `The condition is always ${truth ? "true" : "false"}`, bound.span);
    return bound;
  }

  private ifStatement(s: Extract<Statement, { kind: "if" }>): BoundStatement | undefined {
    const branches: { header: Span; condition: BoundExpr; body: BoundStatement[] }[] = [];
    branches.push({ header: { ...s.span, end: s.condition.span.end }, condition: this.condition(s.condition), body: this.block(s.then) });
    for (const e of s.elseIfs) {
      branches.push({ header: { ...e.span, end: e.condition.span.end }, condition: this.condition(e.condition), body: this.block(e.body) });
    }
    const otherwise = s.else ? this.block(s.else) : undefined;
    const empty = branches.every((b) => b.body.length === 0) && (!otherwise || otherwise.length === 0);
    if (empty) {
      this.warning("W140", "The IF has no statements; it is discarded", s.span);
      return undefined;
    }
    return { kind: "if", span: s.span, branches, ...(otherwise ? { else: otherwise } : {}) };
  }

  private loopBody(kind: LoopKind, body: Statement[], span: Span): BoundStatement[] {
    this.loops.push(kind);
    const bound = this.block(body);
    this.loops.pop();
    if (bound.length === 0) this.warning("W130", `The ${kind} loop's body is empty`, span);
    return bound;
  }

  private forStatement(s: Extract<Statement, { kind: "for" }>): BoundStatement | undefined {
    const from = this.numeric(s.from);
    const to = this.numeric(s.to);
    const step = s.step ? this.numeric(s.step) : undefined;
    let variable: BoundExpr | undefined;
    const existing = this.lookup(s.variable.name);
    if (!existing) {
      // --- An undeclared loop variable takes the common type of the three values
      let type = commonType(from.type, to.type) ?? "Float";
      if (step) type = commonType(type, step.type) ?? type;
      const symbol = this.implicitVariable(s.variable, from.kind === "error" || to.kind === "error" ? undefined : type);
      symbol.assigned = true;
      symbol.read = true;
      variable = { kind: "variable", span: s.variable.span, type: symbol.type, symbol };
    } else if (existing.kind === "variable") {
      this.checkSigil(s.variable, existing.type);
      this.noteUse(existing, s.variable.span);
      existing.assigned = true;
      existing.read = true;
      if (!isNumeric(existing.type)) this.error("E409", `The FOR variable '${existing.name}' must be a number`, s.variable.span);
      variable = { kind: "variable", span: s.variable.span, type: existing.type, symbol: existing };
    } else {
      this.error("E402", `'${s.variable.name}' is ${kindText(existing)}: a FOR loop needs a variable`, s.variable.span);
    }
    if (s.next.variable && !this.sameVariable(s.next.variable, s.variable)) {
      this.error("E411", `NEXT ${s.next.variable.name} does not close FOR ${s.variable.name}`, s.next.variable.span);
    }
    const type = variable?.type ?? "Float";
    const f = this.convert(from, type, true);
    const t = this.convert(to, type, true);
    const st = step ? this.convert(step, type, true) : undefined;
    this.checkForRange(f, t, st, s.span, type);
    const body = this.loopBody("FOR", s.body, s.span);
    if (!variable) return undefined;
    const header = { ...s.span, end: (s.step ?? s.to).span.end };
    return { kind: "for", span: s.span, header, variable, from: f, to: t, ...(st ? { step: st } : {}), body, next: s.next.span };
  }

  private sameVariable(a: NameRef, b: NameRef): boolean {
    return this.settings.caseInsensitive ? a.name.toLowerCase() === b.name.toLowerCase() : a.name === b.name;
  }

  /**
   * The spec's uncoded FOR warnings: STEP 0 (K401) and a range that never runs (K402); and Klive's
   * K408, an integer loop that cannot pass its limit: the variable wraps before it gets past, so the
   * loop never ends (R8 for-loop-evaluation).
   */
  private checkForRange(from: BoundExpr, to: BoundExpr, step: BoundExpr | undefined, span: Span, type: KType): void {
    const num = (e: BoundExpr | undefined) =>
      e?.constant && e.constant.value.kind !== "address" && e.constant.value.kind !== "string" ? Number(constantText(e.constant)) : undefined;
    const s = step ? num(step) : 1;
    if (s === 0) {
      this.warning("K401", "The FOR loop's STEP is 0: it never ends", step!.span);
      return;
    }
    const f = num(from);
    const t = num(to);
    if (s !== undefined && f !== undefined && t !== undefined && (s > 0 ? f > t : f < t)) {
      this.warning("K402", `The FOR loop never runs: it counts from ${f} ${s > 0 ? "up" : "down"} to ${t}`, span);
      return;
    }
    if (s !== undefined && t !== undefined && isIntegral(type) && type !== "Boolean") {
      const { min, max } = integralRange(type);
      if (s > 0 ? t + s > Number(max) : t + s < Number(min)) {
        this.warning("K408", `The FOR loop never ends: a ${type} cannot count past ${t}, it wraps round first`, to.span);
      }
    }
  }

  private jumpTarget(t: JumpTarget): LabelSymbol | undefined {
    const label = t.kind === "lineTarget" ? this.labels.get(`#${t.line}`) : this.findLabel(t.name);
    if (!label) {
      this.error("E401", t.kind === "lineTarget" ? `Line ${t.line} does not exist` : `Label '${t.name}' is not declared`, t.span);
      return undefined;
    }
    label.uses.push(t.span);
    if (label.routine && label.routine !== this.routine) {
      this.error("E430", `'${label.name}' is inside ${label.routine.name}: it cannot be jumped to from outside it`, t.span);
    }
    this.noteLabelReference(label, t.span);
    return label;
  }

  private returnStatement(valueExpr: Expression | undefined, span: Span): BoundStatement {
    const routine = this.routine;
    if (routine?.kind === "function") {
      if (!valueExpr) {
        this.error("E414", `RETURN in FUNCTION ${routine.name} needs a value`, span);
        return { kind: "return", span };
      }
      const value = this.value(valueExpr);
      const type = routine.returnType ?? "Float";
      if (value.kind !== "error" && (value.type === "String") !== (type === "String")) {
        this.error("E414", `FUNCTION ${routine.name} returns ${type === "String" ? "a String" : "a number"}`, value.span);
        return { kind: "return", span };
      }
      return { kind: "return", span, value: this.convert(value, type, true) };
    }
    if (valueExpr) {
      this.error("E414", routine ? `SUB ${routine.name} cannot return a value` : "RETURN with a value outside a FUNCTION", valueExpr.span);
      this.expr(valueExpr);
    }
    return { kind: "return", span };
  }

  // ----------------------------------------------------------------------------------------------
  // READ, tape

  private readTarget(target: Expression): BoundExpr {
    if (target.kind === "name" && !this.lookup(target.name)) {
      // --- An undeclared READ target becomes a Float (or what its sigil says)
      const symbol = this.implicitVariable(target, target.sigil ? undefined : "Float");
      symbol.assigned = true;
      return { kind: "variable", span: target.span, type: symbol.type, symbol };
    }
    const bound = this.lvalue(target);
    if (!bound) return this.errorExpr(target.span);
    if (bound.kind === "array") {
      this.error("E421", `READ into the whole array '${bound.symbol.name}': READ takes one element at a time`, target.span);
      return this.errorExpr(target.span);
    }
    return bound;
  }

  private tape(s: Extract<Statement, { kind: "tape" }>): BoundStatement {
    const name = this.valueAs(s.name, "String");
    const t = s.target;
    let target: Extract<BoundStatement, { kind: "tape" }>["target"];
    if (t.kind === "code") {
      target = {
        kind: "code",
        ...(t.start ? { start: this.valueAs(t.start, "UInteger") } : {}),
        ...(t.length ? { length: this.valueAs(t.length, "UInteger") } : {})
      };
    } else if (t.kind === "screen") target = { kind: "screen" };
    else {
      const bound = t.variable ? this.expr(t.variable) : undefined;
      if (bound?.kind === "variable" && s.operation !== "SAVE") bound.symbol.assigned = true;
      target = { kind: "data", ...(bound && bound.kind !== "error" ? { target: bound } : {}) };
    }
    return { kind: "tape", span: s.span, operation: s.operation, name, target };
  }

  // ----------------------------------------------------------------------------------------------
  // Routines

  private routineDefinition(header: RoutineHeader, body: Statement[], span: Span, end: Span): BoundStatement | undefined {
    const routine = this.headerSymbols.get(header);
    if (!routine) return undefined;
    this.checkHeader(header, routine);
    const outer = { scope: this.scope, routine: this.routine, loops: this.loops };
    this.scope = new Scope(this.globals, routine);
    routine.scope = this.scope;
    this.routine = routine;
    this.loops = [];
    for (const p of routine.params) {
      const symbol = p.isArray
        ? ({ kind: "array", name: p.name, span: p.span, uses: [], bank: routine.bank, elementType: p.type, storage: "param", bounds: [], param: true, read: false } satisfies ArraySymbol)
        : ({ kind: "variable", name: p.name, span: p.span, uses: [], bank: routine.bank, type: p.type, storage: "param", declared: true, byref: p.byref, assigned: true, read: false } satisfies VariableSymbol);
      if (this.scope.lookupLocal(p.name, this.settings.caseInsensitive)) {
        this.error("E403", `Parameter '${p.name}' is already declared`, p.span);
        continue;
      }
      this.scope.add(symbol);
      p.symbol = symbol;
    }
    const bound = this.block(body);
    this.scope = outer.scope;
    this.routine = outer.routine;
    this.loops = outer.loops;
    return { kind: "routine", span, routine, body: bound, end };
  }

  /** The checks on a header that need binding: defaults, parameter rules, W100 and W160. */
  private checkHeader(header: RoutineHeader, routine: RoutineSymbol): void {
    let optionalSeen = false;
    header.params.forEach((p, i) => {
      const param = routine.params[i];
      if (!param) return;
      if (!p.type && !p.name.sigil && !p.isArray) this.defaultType(p.name.name, p.name.span, "Parameter");
      if (p.isArray && p.passing === "BYVAL") this.error("E419", `Array parameter '${p.name.name}' is always BYREF`, p.span);
      if (p.defaultValue) {
        if (p.isArray) this.error("E419", `Array parameter '${p.name.name}' cannot have a default value`, p.defaultValue.span);
        const value = this.valueAs(p.defaultValue, param.type);
        if (value.kind !== "error") {
          if (value.constant) param.defaultValue = value.constant;
          else this.error("E406", `The default value of '${p.name.name}' must be a constant`, p.defaultValue.span);
        }
        optionalSeen = true;
      } else if (optionalSeen) {
        this.error("E420", `Parameter '${p.name.name}' needs a default value: it follows an optional parameter`, p.span);
      }
    });
    if (routine.kind === "function" && !header.returnType && !header.name.sigil) {
      this.defaultType(header.name.name, header.name.span, "FUNCTION");
    }
    if (routine.convention === "FASTCALL" && routine.params.length > 1) {
      this.warning("W160", `FASTCALL ${routine.name} has ${routine.params.length} parameters: only the first arrives in registers`, header.name.span);
    }
  }

  // ----------------------------------------------------------------------------------------------
  // CODEBANK

  private codebank(bankExpr: Expression, body: Statement[], span: Span): BoundStatement | undefined {
    const bank = this.integerConstant(bankExpr, "A CODEBANK number", "E450");
    if (bank !== undefined && (bank < 1 || bank > 255)) this.error("E450", `CODEBANK ${bank}: a bank number is 1 to 255`, bankExpr.span);
    if (body.some((b) => b.kind === "dim") && !body.some((b) => b.kind === "routine")) {
      this.warning("W910", `CODEBANK ${bank ?? "?"} holds data but no SUB or FUNCTION`, span);
    }
    const outer = this.settings.bank;
    this.settings.bank = bank ?? outer;
    const bound = this.block(body);
    this.settings.bank = outer;
    return { kind: "codebank", span, bank: bank ?? 0, body: bound };
  }

  // ===============================================================================================
  // End of the program

  private finish(): void {
    for (const r of this.routines) {
      if (!r.definedAt) this.error("E416", `${r.kind === "sub" ? "SUB" : "FUNCTION"} ${r.name} is declared but never defined`, r.declaredAt ?? r.span);
    }
    this.checkBankReferences();
  }

  /** E451/E452: references between banks other than calls and FARPTR (spec extensions.codebank). */
  private checkBankReferences(): void {
    for (const ref of this.bankReferences) {
      const target = ref.symbol;
      if (ref.how === "farptr" || target.bank === 0 || target.bank === ref.from) continue;
      if (ref.how === "call" && (target.kind === "sub" || target.kind === "function")) continue;
      if (target.kind === "label") {
        this.error("E451", `'${target.name}' is in bank ${target.bank}: a jump between banks is not possible (call a routine instead)`, ref.span);
      } else if (target.kind !== "sub" && target.kind !== "function") {
        this.error("E452", `'${target.name}' is in bank ${target.bank}: reach it from outside only through FARPTR`, ref.span);
      }
    }
  }
}

/** The pragmas that change binding, and the setting each one drives. */
const PRAGMA_SETTINGS: Record<string, keyof BindSettings> = {
  array_base: "arrayBase",
  string_base: "stringBase",
  case_insensitive: "caseInsensitive",
  explicit: "explicit",
  strict: "strict",
  default_byref: "defaultByref",
  codebank: "bank"
};
