/**
 * Language intelligence for Klive BASIC (`.zxbas`): what one background check of a build root
 * knows about its symbols, for hover, definition, references, completion, rename and the outline
 * (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` §3).
 *
 * Unlike the assembler's `LanguageIntelData`, which is keyed by name, every symbol has an id and
 * every occurrence points at one: BASIC has scopes (a local `x` shadows a global `x`) and the binder
 * has already resolved each use (E1).
 *
 * Plain data, safe for IPC. Lines are 1-based physical lines; columns are 0-based, end exclusive.
 */

/** A place in one of the snapshot's files. */
export type BasicLocation = {
  readonly fileIndex: number;
  /** 1-based physical line (not `#line`-mapped: the editor shows physical lines). */
  readonly line: number;
  /** 0-based. */
  readonly startColumn: number;
  /** 0-based, exclusive. */
  readonly endColumn: number;
};

export type BasicSymbolKind = "variable" | "array" | "const" | "sub" | "function" | "param" | "label" | "lineNumber";

export type BasicParamInfo = {
  readonly name: string;
  readonly typeText: string;
  readonly byref: boolean;
  readonly isArray: boolean;
  /** The default value as written, for an optional parameter. */
  readonly defaultText?: string;
};

export type BasicSymbolInfo = {
  /** Its index in `symbols`. */
  readonly id: number;
  /** As declared, without a sigil. */
  readonly name: string;
  readonly kind: BasicSymbolKind;
  /** The scope it is declared in (0: globals). */
  readonly scopeId: number;
  /** Where it is declared; a routine's definition (its DECLARE when it has none). */
  readonly declaration: BasicLocation;
  /** A routine's DECLARE line, when it has a definition too. */
  readonly forwardDeclaration?: BasicLocation;
  /** The type (an array's element type), e.g. "UByte", "String". */
  readonly typeText?: string;
  /** A one-line signature for hover, outline and completion. */
  readonly detail: string;
  readonly storage?: "global" | "local" | "param";
  readonly byref?: boolean;
  /** A variable a use created (W100), not a DIM. */
  readonly implicit?: boolean;
  /** A constant's value, formatted. */
  readonly constValue?: string;
  /** An array's bounds, e.g. "(0 TO 9, 1 TO 3)". */
  readonly arrayBounds?: string;
  readonly params?: BasicParamInfo[];
  readonly returnType?: string;
  readonly convention?: "FASTCALL" | "STDCALL";
  /** The comment lines directly above the declaration, without their comment markers. */
  readonly doc?: string;
  /** The CODEBANK it is in (0: resident). */
  readonly bank?: number;
};

export type BasicOccurrence = BasicLocation & {
  readonly symbolId: number;
  readonly role: "declaration" | "use";
  /** The occurrence's text is the symbol's name (E11): false for a use produced by a macro. */
  readonly editable: boolean;
};

export type BasicScopeInfo = {
  readonly id: number;
  /** The routine whose body this is; absent for the globals. */
  readonly routineId?: number;
  readonly fileIndex: number;
  /** The routine header's line (the globals: 1). */
  readonly startLine: number;
  /** The END SUB / END FUNCTION line (the globals: the root file's last line). */
  readonly endLine: number;
  /** The symbols declared here, in declaration order. */
  readonly symbolIds: number[];
};

export type BasicOutlineEntry = {
  readonly name: string;
  readonly kind: "sub" | "function" | "param" | "variable" | "array" | "const" | "label" | "codebank";
  readonly fileIndex: number;
  readonly line: number;
  readonly endLine: number;
  /** The name's columns on `line` (0-based, end exclusive). */
  readonly startColumn: number;
  readonly endColumn: number;
  readonly detail?: string;
  readonly children?: BasicOutlineEntry[];
};

export type BasicDefineInfo = {
  readonly name: string;
  readonly declaration: BasicLocation;
  readonly uses: BasicLocation[];
  /** The body as written (continuations joined). */
  readonly body: string;
  readonly params?: string[];
};

/** A `'@name value` header line of the build root. */
export type BasicHeaderOptionInfo = {
  /** The option's name as written (without `'@`). */
  readonly name: string;
  readonly location: BasicLocation;
  /** The value the build uses, formatted. */
  readonly value?: string;
};

export type BasicIntelFile = {
  readonly index: number;
  /** An absolute path, or `<kbasic-stdlib>/name.bas` for a library file. */
  readonly path: string;
  /** A Klive BASIC library file (read-only). */
  readonly library: boolean;
  /** Not a file on disk (a library file, a `-D` macro's text). */
  readonly virtual: boolean;
};

export type BasicIntelData = {
  /** The file this snapshot was compiled from. */
  readonly rootFile: string;
  /** Identifiers match in any case (E12). */
  readonly caseInsensitive: boolean;
  readonly files: ReadonlyArray<BasicIntelFile>;
  /** Index = symbol id. */
  readonly symbols: BasicSymbolInfo[];
  /** Declarations and uses, sorted by (file, line, column). */
  readonly occurrences: BasicOccurrence[];
  /** [0] = globals; one per routine body. */
  readonly scopes: BasicScopeInfo[];
  /** Per file, nested. */
  readonly outline: BasicOutlineEntry[];
  readonly defines: BasicDefineInfo[];
  readonly headerOptions: BasicHeaderOptionInfo[];
};
