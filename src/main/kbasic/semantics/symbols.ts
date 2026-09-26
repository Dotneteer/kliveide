import type { Span } from "../diagnostics";
import type { Constant } from "./constants";
import type { KType } from "./types";

/**
 * What a name means (spec `statements`, `subprograms`): a variable, an array, a constant, a SUB or
 * FUNCTION, or a label. Labels (and line numbers) are global and live apart from the other names, so
 * `GOTO x` and a variable `x` do not clash.
 */
export type Symbol = VariableSymbol | ArraySymbol | ConstSymbol | RoutineSymbol;

/** Where a variable lives. */
export type Storage = "global" | "local" | "param";

type SymbolBase = {
  /** As declared (without a sigil). */
  name: string;
  /** Where it was declared; for an implicit variable, its first use. */
  span: Span;
  /** Every use, in source order (the declaration excluded). */
  uses: Span[];
  /** The CODEBANK it was declared in (0: resident). */
  bank: number;
};

export type VariableSymbol = SymbolBase & {
  kind: "variable";
  type: KType;
  storage: Storage;
  /** Declared with DIM, or a parameter; false for one a use created (W100). */
  declared: boolean;
  /** A parameter passed BYREF: the variable holds the address of the caller's value. */
  byref?: boolean;
  /** `DIM x AT address`: the variable is mapped to that address. */
  at?: Constant;
  /** `DIM x = constant` at global scope (or mapped): the static initial value. */
  initial?: Constant;
  /** Assigned anywhere (W101 looks at reads before the first assignment). */
  assigned: boolean;
  /** Read anywhere (W150). */
  read: boolean;
  /** W101 was reported for it (once per variable). */
  warnedUnassigned?: boolean;
};

export type ArrayBound = { lower: number; upper: number };

export type ArraySymbol = SymbolBase & {
  kind: "array";
  elementType: KType;
  storage: Storage;
  /** The bounds of each dimension; empty for an array parameter, whose bounds come with the argument. */
  bounds: ArrayBound[];
  /** An array parameter (always BYREF). */
  param?: boolean;
  at?: Constant;
  /** `=> {...}`: the elements in row-major order, converted to the element type. */
  initial?: Constant[];
  read: boolean;
};

export type ConstSymbol = SymbolBase & {
  kind: "const";
  type: KType;
  value: Constant;
};

export type ParamSymbol = {
  name: string;
  span: Span;
  type: KType;
  byref: boolean;
  isArray: boolean;
  /** The parameter is optional: it has a default value (bound when its header is). */
  hasDefault: boolean;
  /** The default value, once bound. */
  defaultValue?: Constant;
  /** The variable (or array) the body sees. */
  symbol?: VariableSymbol | ArraySymbol;
};

export type RoutineSymbol = SymbolBase & {
  kind: "sub" | "function";
  convention: "STDCALL" | "FASTCALL";
  params: ParamSymbol[];
  /** FUNCTION only. */
  returnType?: KType;
  /** The DECLARE line, when there is one. */
  declaredAt?: Span;
  /** The definition's header; undefined until (unless) the definition is seen. */
  definedAt?: Span;
  /** Called from somewhere (W170). */
  called: boolean;
  /** The scope of the body: its parameters and locals. */
  scope?: Scope;
};

export type LabelSymbol = {
  kind: "label";
  /** The label's name with its sigil, or the line number's digits. */
  name: string;
  lineNumber?: number;
  span: Span;
  uses: Span[];
  /** The routine it sits in, if any (jumping into a routine is not possible). */
  routine?: RoutineSymbol;
  bank: number;
};

/**
 * One level of names: the program's globals, or a routine's parameters and locals. Lookup falls back
 * to the parent. Names match exactly; while `case_insensitive` is on, a name that has no exact match
 * matches one that differs only in case. A name declared while it was on (the standard library's,
 * which switches it on for its own scope) matches in any case from anywhere.
 */
export class Scope {
  private readonly names = new Map<string, Symbol>();
  private readonly anyCase = new Set<Symbol>();

  constructor(
    readonly parent?: Scope,
    readonly routine?: RoutineSymbol
  ) {}

  /** The symbols declared at this level, in declaration order. */
  get symbols(): Symbol[] {
    return [...this.names.values()];
  }

  lookupLocal(name: string, caseInsensitive: boolean): Symbol | undefined {
    const exact = this.names.get(name);
    if (exact || (!caseInsensitive && !this.anyCase.size)) return exact;
    const lower = name.toLowerCase();
    for (const [key, symbol] of this.names) {
      if (key.toLowerCase() === lower && (caseInsensitive || this.anyCase.has(symbol))) return symbol;
    }
    return undefined;
  }

  lookup(name: string, caseInsensitive: boolean): Symbol | undefined {
    return this.lookupLocal(name, caseInsensitive) ?? this.parent?.lookup(name, caseInsensitive);
  }

  /** `anyCase`: declared while `case_insensitive` was on. */
  add(symbol: Symbol, anyCase = false): void {
    this.names.set(symbol.name, symbol);
    if (anyCase) this.anyCase.add(symbol);
  }
}

/** How a symbol's class is named in messages. */
export function kindText(s: Symbol | LabelSymbol): string {
  switch (s.kind) {
    case "variable":
      return "a variable";
    case "array":
      return "an array";
    case "const":
      return "a constant";
    case "sub":
      return "a SUB";
    case "function":
      return "a FUNCTION";
    case "label":
      return "a label";
  }
}
