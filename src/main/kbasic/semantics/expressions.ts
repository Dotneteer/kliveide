import type { DiagnosticBag, Span } from "../diagnostics";
import type { KBasicOptions } from "../options/options";
import type { Argument, Expression, NameRef, TypeRef } from "../syntax/ast";
import type { AddressTarget, BoundArgument, BoundExpr } from "./bound";
import {
  constantText,
  convertConstant,
  foldBinary,
  foldUnary,
  FoldError,
  intConstant,
  isTrueConstant,
  numberLiteral,
  numericValue,
  literalFloat,
  literalText,
  naturalConstant,
  stringConstant,
  type BinaryFoldOp,
  type Constant
} from "./constants";
import * as f40 from "./float40";
import {
  Scope,
  kindText,
  type ArraySymbol,
  type LabelSymbol,
  type ParamSymbol,
  type RoutineSymbol,
  type Symbol,
  type VariableSymbol
} from "./symbols";
import {
  commonType,
  isDecimal,
  isIntegral,
  isSigned,
  literalIntegerType,
  signedOf,
  sizeOf,
  typeOfName,
  typeOfSigil,
  type KType
} from "./types";

/** The settings `#pragma` can change from its line onward (spec `preprocessor.pragmas`). */
export type BindSettings = {
  arrayBase: number;
  stringBase: number;
  caseInsensitive: boolean;
  explicit: boolean;
  strict: boolean;
  defaultByref: boolean;
  /** `#pragma codebank = n`: the bank of the declarations that follow. */
  bank: number;
  /** `#pragma asm_dialect = zxbasm|klive`: the dialect of the ASM blocks that follow (plan D-C4). */
  asmDialect: "klive" | "zxbasm";
};

/** A place a name refers to a banked symbol, checked once every bank is known (E452, W920). */
export type BankReference = { span: Span; from: number; routine?: RoutineSymbol; symbol: Symbol | LabelSymbol; how: "call" | "farptr" | "use" };

/**
 * The binder's state and its expression half: names, types, conversions and constant folding.
 * `Binder` (binder.ts) adds declarations and statements.
 */
export class ExpressionBinder {
  protected settings: BindSettings;
  protected readonly globals = new Scope();
  protected scope: Scope = this.globals;
  protected routine?: RoutineSymbol;
  protected readonly labels = new Map<string, LabelSymbol>();
  protected readonly routines: RoutineSymbol[] = [];
  protected readonly bankReferences: BankReference[] = [];
  /** Named-argument names, each a use of its parameter (for the editor; see `BindResult`). */
  protected readonly paramUses: { param: ParamSymbol; span: Span }[] = [];

  constructor(
    protected readonly options: KBasicOptions,
    protected readonly diagnostics: DiagnosticBag
  ) {
    this.settings = {
      arrayBase: options.arrayBase,
      stringBase: options.stringBase,
      caseInsensitive: options.caseInsensitive,
      explicit: options.requireDeclarations,
      strict: options.requireTypes,
      defaultByref: options.defaultByref,
      bank: 0,
      asmDialect: options.asmDialect
    };
  }

  // ===============================================================================================
  // Diagnostics

  protected error(code: string, message: string, span: Span): void {
    this.diagnostics.error(code, message, span);
  }

  protected warning(code: string, message: string, span: Span): void {
    this.diagnostics.warning(code, message, span);
  }

  /** The type an untyped declaration gets: Float, with W100 (an error under strict typing). */
  protected defaultType(name: string, span: Span, what = "Variable"): KType {
    if (this.settings.strict) this.error("E426", `${what} '${name}' needs a type (AS ...): strict typing is on`, span);
    else this.warning("W100", `${what} '${name}' has no type; it is a Float`, span);
    return "Float";
  }

  // ===============================================================================================
  // Names

  /** While binding a DIM ... AT address: @ may name a variable not declared yet. */
  protected implicitAddress = false;

  protected lookup(name: string): Symbol | undefined {
    return this.scope.lookup(name, this.settings.caseInsensitive);
  }

  protected labelKey(name: string): string {
    const bare = name.replace(/[$%]$/, "");
    return this.settings.caseInsensitive ? bare.toLowerCase() : bare;
  }

  protected findLabel(name: string): LabelSymbol | undefined {
    const exact = this.labels.get(name.replace(/[$%]$/, ""));
    if (exact || !this.settings.caseInsensitive) return exact;
    const key = this.labelKey(name);
    for (const [k, label] of this.labels) if (k.toLowerCase() === key) return label;
    return undefined;
  }

  /** A variable a use creates (spec `types.default_type`): typed by its sigil or the context. */
  protected implicitVariable(ref: NameRef, contextType?: KType): VariableSymbol {
    if (this.settings.explicit) {
      this.error("E427", `'${ref.name}' is not declared: explicit declarations are on (DIM it first)`, ref.span);
    }
    let type: KType;
    if (ref.sigil) type = typeOfSigil(ref.sigil);
    else if (contextType) {
      type = contextType === "Boolean" ? "UByte" : contextType;
      if (this.settings.strict) this.error("E426", `Variable '${ref.name}' needs a type (DIM ... AS): strict typing is on`, ref.span);
    } else type = this.settings.explicit ? "Float" : this.defaultType(ref.name, ref.span);
    this.checkFastcallLocal(ref.name, ref.span);
    const symbol: VariableSymbol = {
      kind: "variable",
      name: ref.name,
      span: ref.span,
      uses: [],
      bank: this.settings.bank,
      type,
      storage: this.routine ? "local" : "global",
      declared: false,
      assigned: false,
      read: false
    };
    this.scope.add(symbol, this.settings.caseInsensitive);
    return symbol;
  }

  /** E431: a FASTCALL routine has no stack frame, so it cannot have locals (spec subprograms.conventions). */
  protected checkFastcallLocal(name: string, span: Span): void {
    if (this.routine?.convention === "FASTCALL") {
      this.error("E431", `FASTCALL ${this.routine.name} cannot have the local '${name}': it has no stack frame (use STDCALL, or a global)`, span);
    }
  }

  /** Checks a name's sigil against the symbol's type (E422). */
  protected checkSigil(ref: NameRef, type: KType): void {
    if (ref.sigil && typeOfSigil(ref.sigil) !== type) {
      this.error("E422", `'${ref.name}${ref.sigil}': the '${ref.sigil}' does not fit ${ref.name}'s type, ${type}`, ref.span);
    }
  }

  protected noteUse(symbol: Symbol, span: Span, how: BankReference["how"] = "use"): void {
    symbol.uses.push(span);
    if (symbol.bank !== 0 || this.settings.bank !== 0) {
      this.bankReferences.push({ span, from: this.settings.bank, ...(this.routine ? { routine: this.routine } : {}), symbol, how });
    }
  }

  // ===============================================================================================
  // Expressions

  protected errorExpr(span: Span, type: KType = "Float"): BoundExpr {
    return { kind: "error", span, type };
  }

  protected constantExpr(constant: Constant, span: Span): BoundExpr {
    return { kind: "constant", span, type: constant.type, constant };
  }

  /** Binds an expression. `contextType` types a variable this use creates (LET's value side, READ, FOR). */
  expr(e: Expression): BoundExpr {
    switch (e.kind) {
      case "number":
        try {
          return this.constantExpr(numberLiteral(e.value, e.text, e.form), e.span);
        } catch {
          this.error("E425", `The number ${e.text} is too big`, e.span);
          return this.errorExpr(e.span);
        }
      case "string":
        return this.constantExpr(stringConstant(e.value), e.span);
      case "paren": {
        const inner = this.expr(e.expression);
        return { ...inner, span: e.span };
      }
      case "name":
        return this.nameExpr(e);
      case "call":
        return this.callExpr(e.callee, e.args, e.span);
      case "unary":
        return this.unaryExpr(e.op, this.expr(e.operand), e.span);
      case "binary":
        return this.binaryExpr(e.op, this.expr(e.left), this.expr(e.right), e.span);
      case "addressOf":
        return this.addressExpr(e.target, e.span);
      case "builtin":
        return this.builtinExpr(e.name, e.args, e.type, e.span);
      case "farptr":
        return this.farptrExpr(e.target, e.span);
      case "error":
        return this.errorExpr(e.span);
    }
  }

  /** A value: an expression that is not a whole array. */
  value(e: Expression): BoundExpr {
    const bound = this.expr(e);
    if (bound.kind === "array") {
      this.error("E402", `'${bound.symbol.name}' is an array: it needs subscripts here`, bound.span);
      return this.errorExpr(bound.span, bound.type);
    }
    return bound;
  }

  /** A numeric value (E409 for a String). */
  numeric(e: Expression): BoundExpr {
    const bound = this.value(e);
    if (bound.type === "String") {
      this.error("E409", "A number is needed here, not a String (use VAL)", bound.span);
      return this.errorExpr(bound.span);
    }
    return bound;
  }

  /** A value converted to a type (numbers only convert to numbers; E409 otherwise). */
  valueAs(e: Expression, type: KType, truncation = false): BoundExpr {
    return this.convert(this.value(e), type, truncation);
  }

  /**
   * Converts a bound value to a type: a constant is converted now (W120 when it loses digits or does
   * not fit); anything else gets a `convert` node. `truncation` asks for W200 when a Fixed or Float
   * value goes into an integral type (assignments, arguments, RETURN).
   */
  convert(e: BoundExpr, to: KType, truncation = false): BoundExpr {
    if (e.kind === "error") return { ...e, type: to };
    if (e.type === to) return e;
    if ((e.type === "String") !== (to === "String")) {
      this.error(
        "E409",
        to === "String" ? `A String is needed here, not ${e.type} (use STR)` : `A number is needed here, not a String (use VAL)`,
        e.span
      );
      return this.errorExpr(e.span, to);
    }
    if (e.constant && to !== "Boolean") {
      const converted = convertConstant(e.constant, to);
      if (converted) {
        if (converted.lossy) {
          this.warning("W120", `${constantText(e.constant)} does not fit ${to} exactly; it becomes ${constantText(converted.constant)}`, e.span);
        }
        return this.constantExpr(converted.constant, e.span);
      }
    }
    if (truncation && isDecimal(e.type) && isIntegral(to)) {
      this.warning("W200", `The ${e.type} value is truncated to ${to}`, e.span);
    }
    return { kind: "convert", span: e.span, type: to, operand: e };
  }

  private nameExpr(ref: NameRef): BoundExpr {
    const symbol = this.lookup(ref.name);
    if (!symbol) {
      const label = this.findLabel(ref.name);
      if (label) {
        this.error("E402", `'${ref.name}' is a label, not a value (use @${ref.name} for its address)`, ref.span);
        return this.errorExpr(ref.span);
      }
      const created = this.implicitVariable(ref);
      created.read = true;
      this.readString(created, ref.span);
      return { kind: "variable", span: ref.span, type: created.type, symbol: created };
    }
    switch (symbol.kind) {
      case "variable":
        this.checkSigil(ref, symbol.type);
        this.noteUse(symbol, ref.span);
        symbol.read = true;
        this.readString(symbol, ref.span);
        return { kind: "variable", span: ref.span, type: symbol.type, symbol };
      case "const":
        this.checkSigil(ref, symbol.type);
        this.noteUse(symbol, ref.span);
        return this.constantExpr(symbol.value, ref.span);
      case "array":
        this.checkSigil(ref, symbol.elementType);
        this.noteUse(symbol, ref.span);
        symbol.read = true;
        return { kind: "array", span: ref.span, type: symbol.elementType, symbol };
      case "function":
        return this.callRoutine(symbol, [], ref.span, ref.span);
      case "sub":
        this.error("E429", `'${ref.name}' is a SUB: it has no value`, ref.span);
        this.noteUse(symbol, ref.span, "call");
        symbol.called = true;
        return this.errorExpr(ref.span);
    }
  }

  /** W101: a String variable read before any assignment to it. */
  private readString(symbol: VariableSymbol, span: Span): void {
    if (symbol.type === "String" && !symbol.assigned && symbol.storage !== "param" && !symbol.at && !symbol.warnedUnassigned) {
      symbol.warnedUnassigned = true;
      this.warning("W101", `String '${symbol.name}' is read before anything is assigned to it`, span);
    }
  }

  /** `callee(args)`: a FUNCTION call, an array element or a string slice. */
  protected callExpr(callee: Expression, args: Argument[], span: Span): BoundExpr {
    if (callee.kind === "name") {
      const symbol = this.lookup(callee.name);
      if (symbol?.kind === "function") return this.callRoutine(symbol, args, span, callee.span);
      if (symbol?.kind === "sub") {
        this.error("E429", `'${callee.name}' is a SUB: it has no value`, callee.span);
        symbol.called = true;
        this.bindArgumentsLoosely(args);
        return this.errorExpr(span);
      }
      if (symbol?.kind === "array") {
        this.checkSigil(callee, symbol.elementType);
        this.noteUse(symbol, callee.span);
        symbol.read = true;
        return this.elementExpr(symbol, args, span);
      }
      if (!symbol) {
        if (!callee.sigil || callee.sigil !== "$") {
          this.error("E401", `'${callee.name}' is not declared: an array must be DIMmed before use, and a FUNCTION defined`, callee.span);
          this.bindArgumentsLoosely(args);
          return this.errorExpr(span);
        }
      }
    }
    // --- Chained parentheses need a declared array or String: zxbc refuses f$(1)(0) for an unknown f$
    if (callee.kind === "call" && callee.callee.kind === "name" && !this.lookup(callee.callee.name)) {
      this.error("E401", `'${callee.callee.name}' is not declared: an array must be DIMmed before use, and a FUNCTION defined`, callee.callee.span);
      this.bindArgumentsLoosely(args);
      return this.errorExpr(span);
    }
    // --- A string slice
    const target = this.value(callee);
    if (target.kind === "error") {
      this.bindArgumentsLoosely(args);
      return this.errorExpr(span);
    }
    if (target.kind === "call") {
      // --- ZX BASIC does not slice what a FUNCTION returns: f$(1)(0) is an error there (C4)
      this.error("E435", `What ${target.routine.name} returns cannot be sliced here: assign it to a variable first`, callee.span);
      this.bindArgumentsLoosely(args);
      return this.errorExpr(span);
    }
    if (target.type !== "String") {
      const what = target.kind === "variable" ? `'${target.symbol.name}' is ${kindText(target.symbol)} of type ${target.type}` : "This value";
      this.error("E429", `${what}: it cannot take arguments (it is not an array, a FUNCTION or a String)`, callee.span);
      this.bindArgumentsLoosely(args);
      return this.errorExpr(span);
    }
    return this.sliceExpr(target, args, span);
  }

  /** Binds arguments for their own diagnostics after the call itself failed. */
  protected bindArgumentsLoosely(args: Argument[]): void {
    for (const a of args) {
      if (a.kind === "arg" || a.kind === "named") this.expr(a.value);
      else {
        if (a.from) this.expr(a.from);
        if (a.to) this.expr(a.to);
      }
    }
  }

  /** `a(i, j)`; for a String array one more subscript (or range) takes characters of the element. */
  protected elementExpr(symbol: ArraySymbol, args: Argument[], span: Span): BoundExpr {
    const dims = symbol.param ? undefined : symbol.bounds.length;
    const extra = symbol.elementType === "String" && dims !== undefined && args.length === dims + 1;
    const subscripts = extra ? args.slice(0, -1) : args;
    if (dims !== undefined && subscripts.length !== dims) {
      this.error("E428", `Array '${symbol.name}' has ${dims} dimension(s); ${subscripts.length} subscript(s) given`, span);
    }
    const indices: BoundExpr[] = [];
    for (const a of subscripts) {
      if (a.kind !== "arg") {
        this.error("E428", `An array subscript must be a value${a.kind === "range" ? ", not a range" : ""}`, a.span);
        continue;
      }
      indices.push(this.valueAs(a.value, "UInteger"));
    }
    const element: BoundExpr = { kind: "element", span, type: symbol.elementType, symbol, indices };
    return extra ? this.sliceExpr(element, [args[args.length - 1]], span) : element;
  }

  /** `s(i)` and `s(a TO b)`: indices from string_base, made 0-based here. */
  protected sliceExpr(target: BoundExpr, args: Argument[], span: Span): BoundExpr {
    if (args.length !== 1) {
      this.error("E428", "A string takes one index or one range in parentheses", span);
      this.bindArgumentsLoosely(args);
      return this.errorExpr(span, "String");
    }
    const a = args[0];
    const index = (e: Expression | undefined) => (e ? this.rebase(this.valueAs(e, "UInteger")) : undefined);
    if (a.kind === "named") {
      this.error("E417", "A string index cannot be a named argument", a.span);
      return this.errorExpr(span, "String");
    }
    const single = a.kind === "arg";
    const from = a.kind === "arg" ? index(a.value) : index(a.from);
    const to = a.kind === "arg" ? from : index(a.to);
    const bound: BoundExpr = {
      kind: "slice",
      span,
      type: "String",
      target,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      single
    };
    // --- Constant slices of constant strings fold (spec `types.strings.slice_rules`)
    if (target.constant?.value.kind === "string" && (!from || from.constant) && (!to || to.constant)) {
      const text = target.constant.value.value;
      const lo = from ? Math.min(Number(numericValue(from.constant!)), 65534) : 0;
      const hi = to ? Math.min(Number(numericValue(to.constant!)), 65534) : text.length - 1;
      return this.constantExpr(stringConstant(lo > hi ? "" : text.slice(lo, hi + 1)), span);
    }
    return bound;
  }

  /** An index counted from string_base, made to count from 0. */
  private rebase(index: BoundExpr): BoundExpr {
    const base = this.settings.stringBase;
    if (base === 0) return index;
    const one = this.constantExpr(intConstant(BigInt(base), "UInteger"), index.span);
    return this.binaryExpr("-", index, one, index.span);
  }

  // ===============================================================================================
  // Calls

  /** A call of a SUB or FUNCTION: arguments matched to parameters (spec `subprograms.parameters`). */
  protected callRoutine(routine: RoutineSymbol, args: Argument[], span: Span, nameSpan: Span): BoundExpr {
    routine.called = true;
    this.noteUse(routine, nameSpan, "call");
    const bound = this.matchArguments(routine, args, span);
    return { kind: "call", span, type: routine.returnType ?? "Float", routine, args: bound };
  }

  /**
   * Arguments as ZX BASIC places them (observed through the oracle, compatibility plan C3): the values
   * given, positional and named, in the order they are written, then the default values of the
   * parameters neither given by position nor named, in parameter order - parameter i takes the i-th.
   * A name therefore only says which default is left out: s(c := 7, a := 5) is s(7, 5, <b's default>),
   * and s(b := 4) is s(4, <a's default>, <c's default>).
   */
  protected matchArguments(routine: RoutineSymbol, args: Argument[], span: Span): BoundArgument[] {
    const params = routine.params;
    const values: Argument[] = [];
    const namedIndices = new Set<number>();
    let named = false;
    let positional = 0;
    for (const a of args) {
      if (a.kind === "range") {
        this.error("E417", "A range is not an argument", a.span);
        continue;
      }
      if (a.kind === "named") {
        named = true;
        const index = params.findIndex((p) => this.sameName(p.name, a.name.name));
        if (index < 0) {
          this.error("E417", `${routine.name} has no parameter '${a.name.name}'`, a.name.span);
          this.expr(a.value);
        } else if (namedIndices.has(index)) {
          this.error("E417", `Parameter '${params[index].name}' is given twice`, a.name.span);
          this.expr(a.value);
        } else {
          namedIndices.add(index);
          this.paramUses.push({ param: params[index], span: a.name.span });
          values.push(a);
        }
        continue;
      }
      if (named) {
        this.error("E417", "A positional argument cannot follow a named one", a.span);
        this.expr(a.value);
        continue;
      }
      positional++;
      values.push(a);
    }
    if (values.length > params.length) {
      for (const extra of values.slice(params.length)) {
        this.error("E417", `${routine.name} takes ${params.length} argument(s); too many given`, extra.span);
        this.expr((extra as { value: Expression }).value);
      }
      values.length = params.length;
    }
    // --- The defaults of the parameters neither given by position nor named, in parameter order
    const defaults = params.map((_, i) => i).filter((i) => i >= positional && !namedIndices.has(i));
    const result: BoundArgument[] = [];
    params.forEach((param, i) => {
      const a = values[i];
      if (a) {
        const value = (a as { value: Expression }).value;
        result.push({ param, byref: param.byref || param.isArray, value: this.argument(param, value, routine) });
        return;
      }
      const from = params[defaults[i - values.length]];
      if (!from?.hasDefault) {
        this.error("E417", `${routine.name} needs an argument for '${(from ?? param).name}'`, span);
        result.push({ param, byref: param.byref });
        return;
      }
      if (from === param || !from.defaultValue) {
        result.push({ param, byref: param.byref });
        return;
      }
      // --- Another parameter's default, in this parameter's type
      const converted = convertConstant(from.defaultValue, param.type);
      result.push({ param, byref: param.byref, value: this.constantExpr(converted!.constant, span) });
    });
    return result;
  }

  private sameName(a: string, b: string): boolean {
    return this.settings.caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
  }

  /** One argument: an array, a reference (BYREF) or a value converted to the parameter's type. */
  private argument(param: ParamSymbol, e: Expression, routine: RoutineSymbol): BoundExpr {
    if (param.isArray) {
      const bound = this.expr(e);
      if (bound.kind !== "array") {
        if (bound.kind !== "error") this.error("E418", `Parameter '${param.name}' needs an array of ${param.type}, passed by its name`, e.span);
        return this.errorExpr(e.span, param.type);
      }
      if (bound.symbol.elementType !== param.type) {
        this.error("E418", `Parameter '${param.name}' needs an array of ${param.type}, not of ${bound.symbol.elementType}`, e.span);
      }
      this.crossBankByref(routine, e.span);
      return bound;
    }
    if (param.byref) {
      const bound = this.expr(e);
      if (bound.kind === "error") return bound;
      if (bound.kind !== "variable" && bound.kind !== "element") {
        this.error("E418", `Parameter '${param.name}' is BYREF: it needs a variable or an array element, not an expression`, e.span);
        return this.errorExpr(e.span, param.type);
      }
      if (bound.type !== param.type) {
        this.error("E418", `Parameter '${param.name}' is a BYREF ${param.type}: the variable must be ${param.type}, not ${bound.type}`, e.span);
      }
      if (bound.kind === "variable") bound.symbol.assigned = true;
      this.crossBankByref(routine, e.span);
      return bound;
    }
    return this.valueAs(e, param.type, true);
  }

  /** W900: a reference passed from one bank to a routine in another. */
  private crossBankByref(routine: RoutineSymbol, span: Span): void {
    if (routine.bank !== this.settings.bank && (routine.bank !== 0 || this.settings.bank !== 0)) {
      this.warning("W900", `The reference crosses banks: ${routine.name} is in bank ${routine.bank}, this call in bank ${this.settings.bank}`, span);
    }
  }

  // ===============================================================================================
  // Operators

  protected unaryExpr(op: "-" | "+" | "NOT" | "BNOT", operand: BoundExpr, span: Span): BoundExpr {
    if (operand.kind === "error") return { ...operand, span };
    if (operand.kind === "array") {
      this.error("E402", `'${operand.symbol.name}' is an array: it needs subscripts here`, operand.span);
      return this.errorExpr(span);
    }
    if (operand.type === "String") {
      this.error("E410", `${op === "BNOT" ? "bNOT" : op} does not apply to a String`, span);
      return this.errorExpr(span);
    }
    if (op === "+") return { ...operand, span };
    let type: KType;
    let input: BoundExpr = operand;
    if (op === "NOT") type = "Boolean";
    else if (op === "BNOT") {
      type = isDecimal(operand.type) ? "Long" : operand.type === "Boolean" ? "UByte" : operand.type;
      // --- A whole literal folds exactly before any conversion: BNOT 256 is -257 (ZX BASIC)
      if (operand.constant?.exact?.den === 1n) {
        const folded = foldUnary("BNOT", operand.constant, type);
        if (folded) return this.constantExpr(folded, span);
      }
      input = this.convert(operand, type);
    } else type = signedOf(operand.type);
    if (input.constant) {
      const folded = foldUnary(op, input.constant, type);
      if (folded) return this.constantExpr(folded, span);
    }
    if (op === "-" && input.type !== type) input = this.convert(input, type);
    return { kind: "unary", span, type, op, operand: input };
  }

  protected binaryExpr(op: BinaryFoldOp, left: BoundExpr, right: BoundExpr, span: Span): BoundExpr {
    if (left.kind === "error" || right.kind === "error") return this.errorExpr(span);
    for (const side of [left, right]) {
      if (side.kind === "array") {
        this.error("E402", `'${side.symbol.name}' is an array: it needs subscripts here`, side.span);
        return this.errorExpr(span);
      }
    }
    const strings = left.type === "String" || right.type === "String";
    const comparison = op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=";
    if (strings) {
      if (left.type !== right.type) {
        this.error("E409", `${left.type === "String" ? "A String" : "A number"} and ${right.type === "String" ? "a String" : "a number"} do not mix (use STR or VAL)`, span);
        return this.errorExpr(span);
      }
      if (op !== "+" && !comparison) {
        this.error("E410", `${op} does not apply to Strings`, span);
        return this.errorExpr(span);
      }
    }

    let operandType: KType;
    let resultType: KType;
    let l: BoundExpr = left;
    let r: BoundExpr = right;
    switch (op) {
      case "^":
        operandType = resultType = "Float";
        break;
      case "SHL":
      case "SHR":
        operandType = resultType = isDecimal(left.type) ? "ULong" : left.type === "Boolean" ? "UByte" : left.type;
        // --- Two literals shift exactly (5 SHL 8 is 1280, ZX BASIC); otherwise in the left type
        if (!(left.constant?.exact && right.constant?.exact)) {
          l = this.convert(left, operandType);
          r = this.convert(right, "UByte");
        }
        break;
      case "BAND":
      case "BOR":
      case "BXOR": {
        const toIntegral = (t: KType): KType => (isDecimal(t) ? "Long" : t);
        operandType = resultType = commonType(toIntegral(left.type), toIntegral(right.type))!;
        break;
      }
      case "AND":
      case "OR":
      case "XOR":
        operandType = commonType(left.type, right.type)!;
        resultType = "Boolean";
        break;
      default:
        operandType = commonType(left.type, right.type)!;
        resultType = comparison ? "Boolean" : operandType;
    }

    if (op !== "SHL" && op !== "SHR" && op !== "AND" && op !== "OR" && op !== "XOR") {
      // --- Literal constants fold in their own exact type; everything else meets in the operand type
      if (!(l.constant?.literal && r.constant?.literal)) {
        l = this.convert(l, operandType);
        r = this.convert(r, operandType);
      }
    }

    if (l.constant && r.constant) {
      try {
        if (op === "/" || op === "MOD") this.checkIntegerDivision(r.constant, operandType, span);
        const folded = foldBinary(op, l.constant, r.constant, operandType, resultType);
        if (folded) return this.constantExpr(folded, span);
      } catch (e) {
        if (!(e instanceof FoldError)) throw e;
        this.error("E425", e.problem === "overflow" ? "The constant expression overflows (Number too big)" : "The constant expression divides by zero", span);
        return this.errorExpr(span, resultType);
      }
    }
    if (l.constant?.literal && r.constant?.literal) {
      l = this.convert(l, operandType);
      r = this.convert(r, operandType);
    }
    return { kind: "binary", span, type: resultType, op, left: l, right: r, operandType };
  }

  /** K406: an integer division by a constant zero (the program gets every bit set, not an error). */
  private checkIntegerDivision(divisor: Constant, operandType: KType, span: Span): void {
    if (isIntegral(operandType) && divisor.value.kind === "int" && divisor.value.value === 0n) {
      this.warning("K406", "Integer division by zero: the result has every bit set", span);
    }
  }

  // ===============================================================================================
  // Addresses

  /** `@x`, `@a(1, 2)`, `@a`, `@label`, `@routine` (UInteger; constant for globals and labels). */
  protected addressExpr(target: NameRef | Expression, span: Span): BoundExpr {
    const make = (t: AddressTarget, constant?: Constant): BoundExpr => ({
      kind: "address",
      span,
      type: "UInteger",
      target: t,
      ...(constant ? { constant } : {})
    });
    const address = (symbol: string, offset = 0): Constant => ({ type: "UInteger", value: { kind: "address", symbol, offset } });
    if (target.kind === "call" && target.callee.kind === "name") {
      const symbol = this.lookup(target.callee.name);
      if (symbol?.kind !== "array") {
        this.error("E402", `@${target.callee.name}(...) needs an array`, target.span);
        return this.errorExpr(span, "UInteger");
      }
      this.noteUse(symbol, target.callee.span);
      const element = this.elementExpr(symbol, target.args, target.span);
      if (element.kind !== "element") return this.errorExpr(span, "UInteger");
      const constantIndex = element.indices.every((i) => i.constant?.value.kind === "int");
      const offset = constantIndex && symbol.storage === "global" && !symbol.param ? this.elementOffset(symbol, element.indices) : undefined;
      // --- `array:a` is the array's data; a bare `@a` below is its descriptor (runtime-abi.md §2.3)
      return make({ kind: "element", symbol, indices: element.indices }, offset !== undefined ? address(`array:${symbol.name}`, offset) : undefined);
    }
    if (target.kind !== "name") {
      this.error("E302", "Expected a name after '@'", target.span);
      return this.errorExpr(span, "UInteger");
    }
    const symbol = this.lookup(target.name);
    if (symbol) {
      this.noteUse(symbol, target.span);
      switch (symbol.kind) {
        case "variable":
          symbol.read = true;
          symbol.assigned = true;
          return make({ kind: "variable", symbol }, symbol.storage === "global" ? address(symbol.name) : undefined);
        case "array":
          symbol.read = true;
          if (this.settings.bank !== 0) this.warning("W920", `@${symbol.name} in a bank gives the address of the array's data in its own bank`, span);
          return make({ kind: "array", symbol }, symbol.storage === "global" && !symbol.param ? address(symbol.name) : undefined);
        case "sub":
        case "function":
          return make({ kind: "routine", routine: symbol }, address(symbol.name));
        case "const":
          this.error("E402", `'${symbol.name}' is a constant: it has no address`, target.span);
          return this.errorExpr(span, "UInteger");
      }
    }
    const label = this.findLabel(target.name);
    if (label) {
      label.uses.push(target.span);
      this.noteLabelReference(label, target.span);
      return make({ kind: "label", label }, address(`label:${label.name}`));
    }
    // --- ZX BASIC does not declare a variable for @ - an unknown name is an error - except after
    // --- DIM ... AT (compatibility plan C4)
    if (!this.implicitAddress) {
      this.error("E434", `@${target.name}: '${target.name}' is not declared`, target.span);
      return this.errorExpr(span, "UInteger");
    }
    const created = this.implicitVariable(target);
    created.assigned = true;
    return make({ kind: "variable", symbol: created }, created.storage === "global" ? address(created.name) : undefined);
  }

  /** The byte offset of an element with constant subscripts (row-major). */
  private elementOffset(symbol: ArraySymbol, indices: BoundExpr[]): number | undefined {
    let offset = 0;
    for (let d = 0; d < symbol.bounds.length; d++) {
      const i = Number((indices[d]?.constant?.value as { value: bigint } | undefined)?.value ?? 0n);
      const { lower, upper } = symbol.bounds[d];
      offset = offset * (upper - lower + 1) + (i - lower);
    }
    return offset * sizeOf(symbol.elementType);
  }

  protected noteLabelReference(label: LabelSymbol, span: Span): void {
    if (label.bank !== 0 || this.settings.bank !== 0) {
      this.bankReferences.push({ span, from: this.settings.bank, ...(this.routine ? { routine: this.routine } : {}), symbol: label, how: "use" });
    }
  }

  private farptrExpr(target: NameRef, span: Span): BoundExpr {
    const symbol = this.lookup(target.name);
    const label = symbol ? undefined : this.findLabel(target.name);
    if (!symbol && !label) {
      this.error("E401", `'${target.name}' is not declared`, target.span);
      return this.errorExpr(span, "ULong");
    }
    if (symbol?.kind === "const") {
      this.error("E402", `'${target.name}' is a constant: it has no address`, target.span);
      return this.errorExpr(span, "ULong");
    }
    const t = (symbol ?? label)!;
    t.uses.push(target.span);
    if (t.bank !== 0 || this.settings.bank !== 0) {
      this.bankReferences.push({ span, from: this.settings.bank, ...(this.routine ? { routine: this.routine } : {}), symbol: t, how: "farptr" });
    }
    return { kind: "farptr", span, type: "ULong", target: t as never };
  }

  // ===============================================================================================
  // Built-in functions (spec `functions`)

  private builtinExpr(name: string, args: Expression[], typeRef: TypeRef | undefined, span: Span): BoundExpr {
    const make = (type: KType, bound: BoundExpr[], argType?: KType): BoundExpr => ({
      kind: "builtin",
      span,
      type,
      name,
      args: bound,
      ...(argType ? { argType } : {})
    });
    const floatFunction = () => make("Float", [this.valueAs(args[0], "Float")]);
    switch (name) {
      case "PI":
        return this.constantExpr({ type: "Float", value: { kind: "float", value: f40.fromNumber(Math.PI) } }, span);
      case "RND":
        return make("Float", []);
      case "INKEY":
        return make("String", []);
      case "ACS":
      case "ASN":
      case "ATN":
      case "COS":
      case "EXP":
      case "LN":
      case "SIN":
      case "SQR":
      case "TAN": {
        // --- ZX BASIC folds a function of a literal in double arithmetic, and the result stays a
        // --- literal (see literalFloat); a value outside the domain is left to the run time
        const a = this.value(args[0]);
        if (a.constant?.exact) {
          const x = Number(a.constant.exact.num) / Number(a.constant.exact.den);
          const folded = literalFloat(MATH[name](x));
          if (folded) return this.constantExpr(folded, span);
        }
        return floatFunction();
      }
      case "STR": {
        // --- ZX BASIC writes a literal's STR$ at compile time: see literalText
        const a = this.value(args[0]);
        if (a.constant?.exact) return this.constantExpr(stringConstant(literalText(a.constant.exact)), span);
        return make("String", [this.valueAs(args[0], "Float")]);
      }
      case "ABS":
      case "SGN": {
        const a = this.numeric(args[0]);
        if (a.kind === "error") return this.errorExpr(span, name === "SGN" ? "Byte" : "Float");
        if (!isSigned(a.type)) this.warning("K403", `${name} of an unsigned ${a.type === "Boolean" ? "value" : a.type} is ${name === "ABS" ? "the value itself" : "never negative"}`, span);
        const type = name === "SGN" ? "Byte" : a.type === "Boolean" ? "UByte" : a.type;
        if (a.constant?.exact) {
          // --- Of a literal: a literal, whose type comes from its value (ZX BASIC; C4)
          const e = a.constant.exact;
          const sign = e.num > 0n ? 1n : e.num < 0n ? -1n : 0n;
          return this.constantExpr(name === "SGN" ? naturalConstant({ num: sign, den: 1n }) : naturalConstant({ num: sign * e.num, den: e.den }), span);
        }
        if (a.constant && a.constant.value.kind !== "address") {
          const x = numericValue(a.constant);
          if (name === "SGN") return this.constantExpr(intConstant(BigInt(Math.sign(x)), "Byte"), span);
          if (x >= 0) return this.constantExpr({ ...a.constant, type }, span);
          const negated = foldUnary("-", a.constant, type);
          if (negated) return this.constantExpr({ ...negated, type }, span);
        }
        return make(type, [a], a.type);
      }
      case "INT": {
        const a = this.numeric(args[0]);
        if (a.constant?.exact) {
          const e = a.constant.exact;
          const q = e.num / e.den;
          return this.constantExpr(naturalConstant({ num: q * e.den > e.num ? q - 1n : q, den: 1n }), span);
        }
        if (a.constant && a.constant.value.kind !== "address") {
          const converted = convertConstant(a.constant, "Long");
          if (converted) return this.constantExpr(converted.constant, span);
        }
        return make("Long", [a], a.type);
      }
      case "CAST": {
        const to = typeOfName(typeRef!.name);
        const a = this.value(args[0]);
        if (a.kind === "error") return this.errorExpr(span, to);
        if ((a.type === "String") !== (to === "String")) return this.convert(a, to);
        if (a.constant && to !== "Boolean") {
          const converted = convertConstant(a.constant, to);
          if (converted) return this.constantExpr(converted.constant, span);
        }
        return a.type === to ? { ...a, span } : { kind: "convert", span, type: to, operand: a };
      }
      case "CHR": {
        const bound = args.map((a) => this.valueAs(a, "UByte"));
        if (bound.every((b) => b.constant?.value.kind === "int")) {
          const text = bound.map((b) => String.fromCharCode(Number((b.constant!.value as { value: bigint }).value))).join("");
          return this.constantExpr(stringConstant(text), span);
        }
        return make("String", bound);
      }
      case "CODE": {
        const a = this.valueAs(args[0], "String");
        if (a.constant?.value.kind === "string") {
          const text = a.constant.value.value;
          return this.constantExpr(naturalConstant({ num: BigInt(text.length ? text.charCodeAt(0) : 0), den: 1n }), span);
        }
        return make("UByte", [a]);
      }
      case "LEN": {
        const a = this.expr(args[0]);
        if (a.kind === "array") {
          return this.constantExpr(intConstant(BigInt(a.symbol.bounds.length), "UInteger"), span);
        }
        const s = this.convert(a, "String");
        if (s.constant?.value.kind === "string") return this.constantExpr(naturalConstant({ num: BigInt(s.constant.value.value.length), den: 1n }), span);
        return make("UInteger", [s]);
      }
      case "VAL": {
        const a = this.valueAs(args[0], "String");
        // --- A constant number folds; anything else is an expression BASIC's VAL evaluates at run
        // --- time (the semantics annex's val-runtime), which is where its errors belong too
        if (a.constant?.value.kind === "string") {
          try {
            return this.constantExpr({ type: "Float", value: { kind: "float", value: f40.fromDecimal(a.constant.value.value.trim()) } }, span);
          } catch {
            // --- not a plain number
          }
        }
        return make("Float", [a]);
      }
      case "PEEK": {
        const type = typeRef ? typeOfName(typeRef.name) : "UByte";
        return make(type, [this.valueAs(args[0], "UInteger")]);
      }
      case "IN":
        return make("UByte", [this.valueAs(args[0], "UInteger")]);
      case "USR": {
        const a = this.value(args[0]);
        if (a.kind === "error") return this.errorExpr(span, "UInteger");
        return make("UInteger", [a.type === "String" ? a : this.convert(a, "UInteger")], a.type === "String" ? "String" : "UInteger");
      }
      case "SIZEOF": {
        if (typeRef) return this.sizeConstant(sizeOf(typeOfName(typeRef.name)), span);
        const ref = args[0] as NameRef;
        const symbol = this.lookup(ref.name);
        if (!symbol || symbol.kind === "sub" || symbol.kind === "function") {
          this.error(symbol ? "E402" : "E401", symbol ? `SIZEOF needs a type or a variable, not ${kindText(symbol)}` : `'${ref.name}' is not declared`, ref.span);
          return this.errorExpr(span, "UInteger");
        }
        if (symbol.kind === "array") {
          const count = symbol.bounds.reduce((n, b) => n * (b.upper - b.lower + 1), 1);
          return this.sizeConstant(count * sizeOf(symbol.elementType), span);
        }
        return this.sizeConstant(sizeOf((symbol as { type: KType }).type), span);
      }
      case "LBOUND":
      case "UBOUND": {
        const ref = args[0] as NameRef;
        const symbol = this.lookup(ref.name);
        if (symbol?.kind !== "array") {
          this.error(symbol ? "E402" : "E401", symbol ? `${name} needs an array, not ${kindText(symbol)}` : `Array '${ref.name}' is not declared`, ref.span);
          return this.errorExpr(span, "UInteger");
        }
        this.noteUse(symbol, ref.span);
        const dim = args[1] ? this.valueAs(args[1], "UInteger") : undefined;
        if (symbol.param) return make("UInteger", [{ kind: "array", span: ref.span, type: symbol.elementType, symbol }, ...(dim ? [dim] : [])]);
        const d = dim ? (dim.constant?.value.kind === "int" ? Number(dim.constant.value.value) : undefined) : 0;
        if (d === undefined) return make("UInteger", [{ kind: "array", span: ref.span, type: symbol.elementType, symbol }, dim!]);
        if (d === 0) return this.constantExpr(intConstant(BigInt(symbol.bounds.length), "UInteger"), span);
        const b = symbol.bounds[d - 1];
        if (!b) {
          this.error("E428", `Array '${symbol.name}' has ${symbol.bounds.length} dimension(s), not ${d}`, args[1]!.span);
          return this.errorExpr(span, "UInteger");
        }
        return this.constantExpr(intConstant(BigInt(name === "LBOUND" ? b.lower : b.upper), "UInteger"), span);
      }
    }
    this.error("E401", `Unknown function ${name}`, span);
    return this.errorExpr(span);
  }

  private sizeConstant(n: number, span: Span): BoundExpr {
    return this.constantExpr(intConstant(BigInt(n), literalIntegerType(BigInt(n)), true), span);
  }

  // ===============================================================================================
  // Constants

  /** A compile-time constant, or undefined after reporting `code` (E425 by default). */
  protected constantOf(e: Expression, what: string, code = "E425"): Constant | undefined {
    const bound = this.value(e);
    if (bound.kind === "error") return undefined;
    if (!bound.constant) {
      this.error(code, `${what} must be a constant`, e.span);
      return undefined;
    }
    return bound.constant;
  }

  /** A constant whole number (bounds, bank numbers). */
  protected integerConstant(e: Expression, what: string, code = "E425"): number | undefined {
    const c = this.constantOf(e, what, code);
    if (!c) return undefined;
    if (c.value.kind !== "int") {
      if (c.value.kind === "string" || c.value.kind === "address") {
        this.error(code, `${what} must be a whole number`, e.span);
        return undefined;
      }
      const x = numericValue(c);
      if (!Number.isInteger(x)) {
        this.error(code, `${what} must be a whole number`, e.span);
        return undefined;
      }
      return x;
    }
    return Number(c.value.value);
  }

  protected truthOfConstant(e: BoundExpr): boolean | undefined {
    return e.constant && e.constant.value.kind !== "address" ? isTrueConstant(e.constant) : undefined;
  }
}

/** The math functions ZX BASIC folds for a literal argument, in double arithmetic. */
const MATH: Record<string, (x: number) => number> = {
  ACS: Math.acos, ASN: Math.asin, ATN: Math.atan, COS: Math.cos, EXP: Math.exp, LN: Math.log, SIN: Math.sin, SQR: Math.sqrt, TAN: Math.tan
};
