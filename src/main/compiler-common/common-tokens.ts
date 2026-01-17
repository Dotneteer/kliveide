/**
 * This enumeration defines the token types
 */
export const CommonTokens = {
  Eof: -1,
  Ws: -2,
  InlineComment: -3,
  EolComment: -4,
  Unknown: 0,

  Divide: 1,
  NewLine: 2,
  Colon: 3,
  DoubleColon: 4,
  Comma: 5,
  Assign: 6,
  Equal: 7,
  CiEqual: 8,
  LPar: 9,
  RPar: 10,
  LSBrac: 11,
  RSBrac: 12,
  QuestionMark: 13,
  Plus: 14,
  Minus: 15,
  GoesTo: 16,
  VerticalBar: 17,
  UpArrow: 18,
  Ampersand: 19,
  Exclamation: 20,
  NotEqual: 21,
  CiNotEqual: 22,
  LessThan: 23,
  LessThanOrEqual: 24,
  LeftShift: 25,
  MinOp: 26,
  GreaterThan: 27,
  GreaterThanOrEqual: 28,
  RightShift: 29,
  MaxOp: 30,
  Multiplication: 31,
  Modulo: 32,
  BinaryNot: 33,
  LDBrac: 34,
  RDBrac: 35,
  Dot: 36,
  Hashmark: 37,

  Identifier: 38,

  OrgPragma: 39,
  BankPragma: 40,
  XorgPragma: 41,
  EntPragma: 42,
  XentPragma: 43,
  EquPragma: 44,
  VarPragma: 45,
  DispPragma: 46,
  DefbPragma: 47,
  DefwPragma: 48,
  DefmPragma: 49,
  DefnPragma: 50,
  DefhPragma: 51,
  DefgxPragma: 52,
  DefgPragma: 53,
  DefcPragma: 54,
  SkipPragma: 55,
  ExternPragma: 56,
  DefsPragma: 57,
  FillbPragma: 58,
  FillwPragma: 59,
  ModelPragma: 60,
  AlignPragma: 61,
  TracePragma: 62,
  TraceHexPragma: 63,
  RndSeedPragma: 64,
  ErrorPragma: 65,
  IncludeBinPragma: 66,
  CompareBinPragma: 67,
  InjectOptPragma: 68,
  OnSuccessPragma: 69,
  OnErrorPragma: 70,
  SaveNexPragma: 71,

  Macro: 72,
  Endm: 73,
  Proc: 74,
  Endp: 75,
  Loop: 76,
  Endl: 77,
  Repeat: 78,
  Until: 79,
  While: 80,
  Endw: 81,
  If: 82,
  IfUsed: 83,
  IfNUsed: 84,
  Elif: 85,
  Else: 86,
  Endif: 87,
  For: 88,
  To: 89,
  Step: 90,
  Next: 91,
  Break: 92,
  Continue: 93,
  Module: 94,
  EndModule: 95,
  Struct: 96,
  Ends: 97,

  TextOf: 98,
  LTextOf: 99,
  Def: 100,
  IsIndexedAddr: 101,
  IsExpr: 102,

  True: 103,
  False: 104,
  CurCnt: 105,

  IfDefDir: 106,
  IfNDefDir: 107,
  EndIfDir: 108,
  ElseDir: 109,
  DefineDir: 110,
  UndefDir: 111,
  IncludeDir: 112,
  IfDir: 113,
  IfModDir: 114,
  IfNModDir: 115,
  LineDir: 116,
  CurAddress: 117,
  NoneArg: 118,

  BinaryLiteral: 119,
  OctalLiteral: 120,
  DecimalLiteral: 121,
  HexadecimalLiteral: 122,
  RealLiteral: 123,
  CharLiteral: 124,
  StringLiteral: 125
}

export type CommonTokenType = typeof CommonTokens[keyof typeof CommonTokens];

export const commonResolverHash: { [key: string]: CommonTokenType } = {
  ".org": CommonTokens.OrgPragma,
  ".ORG": CommonTokens.OrgPragma,
  org: CommonTokens.OrgPragma,
  ORG: CommonTokens.OrgPragma,

  ".bank": CommonTokens.BankPragma,
  ".BANK": CommonTokens.BankPragma,
  bank: CommonTokens.BankPragma,
  BANK: CommonTokens.BankPragma,

  ".xorg": CommonTokens.XorgPragma,
  ".XORG": CommonTokens.XorgPragma,
  xorg: CommonTokens.XorgPragma,
  XORG: CommonTokens.XorgPragma,

  ".ent": CommonTokens.EntPragma,
  ".ENT": CommonTokens.EntPragma,
  ent: CommonTokens.EntPragma,
  ENT: CommonTokens.EntPragma,

  ".xent": CommonTokens.XentPragma,
  ".XENT": CommonTokens.XentPragma,
  xent: CommonTokens.XentPragma,
  XENT: CommonTokens.XentPragma,

  ".equ": CommonTokens.EquPragma,
  ".EQU": CommonTokens.EquPragma,
  equ: CommonTokens.EquPragma,
  EQU: CommonTokens.EquPragma,

  ".var": CommonTokens.VarPragma,
  ".VAR": CommonTokens.VarPragma,
  var: CommonTokens.VarPragma,
  VAR: CommonTokens.VarPragma,

  ".disp": CommonTokens.DispPragma,
  ".DISP": CommonTokens.DispPragma,
  disp: CommonTokens.DispPragma,
  DISP: CommonTokens.DispPragma,

  ".defb": CommonTokens.DefbPragma,
  ".DEFB": CommonTokens.DefbPragma,
  defb: CommonTokens.DefbPragma,
  DEFB: CommonTokens.DefbPragma,
  ".db": CommonTokens.DefbPragma,
  ".DB": CommonTokens.DefbPragma,
  db: CommonTokens.DefbPragma,
  DB: CommonTokens.DefbPragma,

  ".defw": CommonTokens.DefwPragma,
  ".DEFW": CommonTokens.DefwPragma,
  defw: CommonTokens.DefwPragma,
  DEFW: CommonTokens.DefwPragma,
  ".dw": CommonTokens.DefwPragma,
  ".DW": CommonTokens.DefwPragma,
  dw: CommonTokens.DefwPragma,
  DW: CommonTokens.DefwPragma,

  ".defm": CommonTokens.DefmPragma,
  ".DEFM": CommonTokens.DefmPragma,
  defm: CommonTokens.DefmPragma,
  DEFM: CommonTokens.DefmPragma,
  ".dm": CommonTokens.DefmPragma,
  ".DM": CommonTokens.DefmPragma,
  dm: CommonTokens.DefmPragma,
  DM: CommonTokens.DefmPragma,

  ".defn": CommonTokens.DefnPragma,
  ".DEFN": CommonTokens.DefnPragma,
  defn: CommonTokens.DefnPragma,
  DEFN: CommonTokens.DefnPragma,
  ".dn": CommonTokens.DefnPragma,
  ".DN": CommonTokens.DefnPragma,
  dn: CommonTokens.DefnPragma,
  DN: CommonTokens.DefnPragma,

  ".defh": CommonTokens.DefhPragma,
  ".DEFH": CommonTokens.DefhPragma,
  defh: CommonTokens.DefhPragma,
  DEFH: CommonTokens.DefhPragma,
  ".dh": CommonTokens.DefhPragma,
  ".DH": CommonTokens.DefhPragma,
  dh: CommonTokens.DefhPragma,
  DH: CommonTokens.DefhPragma,

  ".defgx": CommonTokens.DefgxPragma,
  ".DEFGX": CommonTokens.DefgxPragma,
  defgx: CommonTokens.DefgxPragma,
  DEFGX: CommonTokens.DefgxPragma,
  ".dgx": CommonTokens.DefgxPragma,
  ".DGX": CommonTokens.DefgxPragma,
  dgx: CommonTokens.DefgxPragma,
  DGX: CommonTokens.DefgxPragma,

  ".defg": CommonTokens.DefgPragma,
  ".DEFG": CommonTokens.DefgPragma,
  defg: CommonTokens.DefgPragma,
  DEFG: CommonTokens.DefgPragma,
  ".dg": CommonTokens.DefgPragma,
  ".DG": CommonTokens.DefgPragma,
  dg: CommonTokens.DefgPragma,
  DG: CommonTokens.DefgPragma,

  ".defc": CommonTokens.DefcPragma,
  ".DEFC": CommonTokens.DefcPragma,
  defc: CommonTokens.DefcPragma,
  DEFC: CommonTokens.DefcPragma,
  ".dc": CommonTokens.DefcPragma,
  ".DC": CommonTokens.DefcPragma,
  dc: CommonTokens.DefcPragma,
  DC: CommonTokens.DefcPragma,

  ".skip": CommonTokens.SkipPragma,
  ".SKIP": CommonTokens.SkipPragma,
  skip: CommonTokens.SkipPragma,
  SKIP: CommonTokens.SkipPragma,

  ".extern": CommonTokens.ExternPragma,
  ".EXTERN": CommonTokens.ExternPragma,
  extern: CommonTokens.ExternPragma,
  EXTERN: CommonTokens.ExternPragma,

  ".defs": CommonTokens.DefsPragma,
  ".DEFS": CommonTokens.DefsPragma,
  defs: CommonTokens.DefsPragma,
  DEFS: CommonTokens.DefsPragma,
  ".ds": CommonTokens.DefsPragma,
  ".DS": CommonTokens.DefsPragma,
  ds: CommonTokens.DefsPragma,
  DS: CommonTokens.DefsPragma,

  ".fillb": CommonTokens.FillbPragma,
  ".FILLB": CommonTokens.FillbPragma,
  fillb: CommonTokens.FillbPragma,
  FILLB: CommonTokens.FillbPragma,

  ".fillw": CommonTokens.FillwPragma,
  ".FILLW": CommonTokens.FillwPragma,
  fillw: CommonTokens.FillwPragma,
  FILLW: CommonTokens.FillwPragma,

  ".model": CommonTokens.ModelPragma,
  ".MODEL": CommonTokens.ModelPragma,
  model: CommonTokens.ModelPragma,
  MODEL: CommonTokens.ModelPragma,

  ".align": CommonTokens.AlignPragma,
  ".ALIGN": CommonTokens.AlignPragma,
  align: CommonTokens.AlignPragma,
  ALIGN: CommonTokens.AlignPragma,

  ".trace": CommonTokens.TracePragma,
  ".TRACE": CommonTokens.TracePragma,
  trace: CommonTokens.TracePragma,
  TRACE: CommonTokens.TracePragma,

  ".tracehex": CommonTokens.TraceHexPragma,
  ".TRACEHEX": CommonTokens.TraceHexPragma,
  tracehex: CommonTokens.TraceHexPragma,
  TRACEHEX: CommonTokens.TraceHexPragma,

  ".rndseed": CommonTokens.RndSeedPragma,
  ".RNDSEED": CommonTokens.RndSeedPragma,
  rndseed: CommonTokens.RndSeedPragma,
  RNDSEED: CommonTokens.RndSeedPragma,

  ".error": CommonTokens.ErrorPragma,
  ".ERROR": CommonTokens.ErrorPragma,
  error: CommonTokens.ErrorPragma,
  ERROR: CommonTokens.ErrorPragma,

  ".includebin": CommonTokens.IncludeBinPragma,
  ".INCLUDEBIN": CommonTokens.IncludeBinPragma,
  ".include_bin": CommonTokens.IncludeBinPragma,
  ".INCLUDE_BIN": CommonTokens.IncludeBinPragma,
  includebin: CommonTokens.IncludeBinPragma,
  INCLUDEBIN: CommonTokens.IncludeBinPragma,
  include_bin: CommonTokens.IncludeBinPragma,
  INCLUDE_BIN: CommonTokens.IncludeBinPragma,

  ".comparebin": CommonTokens.CompareBinPragma,
  ".COMPAREBIN": CommonTokens.CompareBinPragma,
  comparebin: CommonTokens.CompareBinPragma,
  COMPAREBIN: CommonTokens.CompareBinPragma,

  ".injectopt": CommonTokens.InjectOptPragma,
  ".INJECTOPT": CommonTokens.InjectOptPragma,
  injectopt: CommonTokens.InjectOptPragma,
  INJECTOPT: CommonTokens.InjectOptPragma,

  ".onsuccess": CommonTokens.OnSuccessPragma,
  ".ONSUCCESS": CommonTokens.OnSuccessPragma,
  onsuccess: CommonTokens.OnSuccessPragma,
  ONSUCCESS: CommonTokens.OnSuccessPragma,

  ".savenex": CommonTokens.SaveNexPragma,
  ".SAVENEX": CommonTokens.SaveNexPragma,
  ".SaveNex": CommonTokens.SaveNexPragma,
  savenex: CommonTokens.SaveNexPragma,
  SAVENEX: CommonTokens.SaveNexPragma,
  SaveNex: CommonTokens.SaveNexPragma,

  ".macro": CommonTokens.Macro,
  ".MACRO": CommonTokens.Macro,
  macro: CommonTokens.Macro,
  MACRO: CommonTokens.Macro,

  ".endm": CommonTokens.Endm,
  ".ENDM": CommonTokens.Endm,
  ".mend": CommonTokens.Endm,
  ".MEND": CommonTokens.Endm,

  ".proc": CommonTokens.Proc,
  ".PROC": CommonTokens.Proc,

  ".endp": CommonTokens.Endp,
  ".ENDP": CommonTokens.Endp,
  ".pend": CommonTokens.Endp,
  ".PEND": CommonTokens.Endp,

  ".loop": CommonTokens.Loop,
  ".LOOP": CommonTokens.Loop,

  ".endl": CommonTokens.Endl,
  ".ENDL": CommonTokens.Endl,
  ".lend": CommonTokens.Endl,
  ".LEND": CommonTokens.Endl,

  ".repeat": CommonTokens.Repeat,
  ".REPEAT": CommonTokens.Repeat,

  ".until": CommonTokens.Until,
  ".UNTIL": CommonTokens.Until,

  ".while": CommonTokens.While,
  ".WHILE": CommonTokens.While,

  ".endw": CommonTokens.Endw,
  ".ENDW": CommonTokens.Endw,
  ".wend": CommonTokens.Endw,
  ".WEND": CommonTokens.Endw,

  ".if": CommonTokens.If,
  ".IF": CommonTokens.If,
  if: CommonTokens.If,
  IF: CommonTokens.If,

  ".ifused": CommonTokens.IfUsed,
  ".IFUSED": CommonTokens.IfUsed,
  ifused: CommonTokens.IfUsed,
  IFUSED: CommonTokens.IfUsed,

  ".ifnused": CommonTokens.IfNUsed,
  ".IFNUSED": CommonTokens.IfNUsed,
  ifnused: CommonTokens.IfNUsed,
  IFNUSED: CommonTokens.IfNUsed,

  ".elif": CommonTokens.Elif,
  ".ELIF": CommonTokens.Elif,

  ".else": CommonTokens.Else,
  ".ELSE": CommonTokens.Else,

  ".endif": CommonTokens.Endif,
  ".ENDIF": CommonTokens.Endif,

  ".for": CommonTokens.For,
  ".FOR": CommonTokens.For,
  for: CommonTokens.For,
  FOR: CommonTokens.For,

  ".to": CommonTokens.To,
  ".TO": CommonTokens.To,
  to: CommonTokens.To,
  TO: CommonTokens.To,

  ".step": CommonTokens.Step,
  ".STEP": CommonTokens.Step,
  step: CommonTokens.Step,
  STEP: CommonTokens.Step,

  ".next": CommonTokens.Next,
  ".NEXT": CommonTokens.Next,

  ".break": CommonTokens.Break,
  ".BREAK": CommonTokens.Break,

  ".continue": CommonTokens.Continue,
  ".CONTINUE": CommonTokens.Continue,

  ".module": CommonTokens.Module,
  ".MODULE": CommonTokens.Module,
  module: CommonTokens.Module,
  MODULE: CommonTokens.Module,
  ".scope": CommonTokens.Module,
  ".SCOPE": CommonTokens.Module,
  scope: CommonTokens.Module,
  SCOPE: CommonTokens.Module,

  ".endmodule": CommonTokens.EndModule,
  ".ENDMODULE": CommonTokens.EndModule,
  endmodule: CommonTokens.EndModule,
  ENDMODULE: CommonTokens.EndModule,
  ".endscope": CommonTokens.EndModule,
  ".ENDSCOPE": CommonTokens.EndModule,
  endscope: CommonTokens.EndModule,
  ENDSCOPE: CommonTokens.EndModule,
  ".moduleend": CommonTokens.EndModule,
  ".MODULEEND": CommonTokens.EndModule,
  moduleend: CommonTokens.EndModule,
  MODULEEND: CommonTokens.EndModule,
  ".scopeend": CommonTokens.EndModule,
  ".SCOPEEND": CommonTokens.EndModule,
  scopeend: CommonTokens.EndModule,
  SCOPEEND: CommonTokens.EndModule,

  ".struct": CommonTokens.Struct,
  ".STRUCT": CommonTokens.Struct,
  struct: CommonTokens.Struct,
  STRUCT: CommonTokens.Struct,

  ".ends": CommonTokens.Ends,
  ".ENDS": CommonTokens.Ends,

  textof: CommonTokens.TextOf,
  TEXTOF: CommonTokens.TextOf,

  ltextof: CommonTokens.LTextOf,
  LTEXTOF: CommonTokens.LTextOf,

  def: CommonTokens.Def,
  DEF: CommonTokens.Def,

  isindexedaddr: CommonTokens.IsIndexedAddr,
  ISINDEXEDADDR: CommonTokens.IsIndexedAddr,

  isexpr: CommonTokens.IsExpr,
  ISEXPR: CommonTokens.IsExpr,

  ".true": CommonTokens.True,
  ".TRUE": CommonTokens.True,
  true: CommonTokens.True,
  TRUE: CommonTokens.True,

  ".false": CommonTokens.False,
  ".FALSE": CommonTokens.False,
  false: CommonTokens.False,
  FALSE: CommonTokens.False,

  ".cnt": CommonTokens.CurCnt,
  ".CNT": CommonTokens.CurCnt,
  $cnt: CommonTokens.CurCnt,
  $CNT: CommonTokens.CurCnt,

  "#ifdef": CommonTokens.IfDefDir,
  "#ifndef": CommonTokens.IfNDefDir,
  "#endif": CommonTokens.EndIfDir,
  "#else": CommonTokens.ElseDir,
  "#define": CommonTokens.DefineDir,
  "#undef": CommonTokens.UndefDir,
  "#include": CommonTokens.IncludeDir,
  "#if": CommonTokens.IfDir,
  "#ifmod": CommonTokens.IfModDir,
  "#ifnmod": CommonTokens.IfNModDir,
  "#line": CommonTokens.LineDir,

  $: CommonTokens.CurAddress
};

/**
 * Contains traits of a particular token type
 */
export interface TokenTraits {
  /**
   * This token is an instruction
   */
  instruction?: boolean;

  /**
   * This token is a Z80 Next instruction
   */
  next?: boolean;

  /**
   * Indicates if an instruction is simple (argumentless)
   */
  simple?: boolean;

  /**
   * This token is a pragma
   */
  pragma?: boolean;

  /**
   * This token is a statement;
   */
  statement?: boolean;

  /**
   * This token is a directive
   */
  directive?: boolean;

  /**
   * This token can be the start of an expression
   */
  expressionStart?: boolean;

  /**
   * Represents a macro-time function?
   */
  macroTimeFunction?: boolean;

  /**
   * Represents a parse-time function
   */
  parseTimeFunction?: boolean;

  /**
   * Represents a literal?
   */
  literal?: boolean;

  /**
   * Represents a register?
   */
  reg?: boolean;

  /**
   * Represents a standard 8-bit register?
   */
  reg8?: boolean;

  /**
   * Represenst a special 8-bit register?
   */
  reg8Spec?: boolean;

  /**
   * Represents an 8-bit index register?
   */
  reg8Idx?: boolean;

  /**
   * Represents an 16-bit register?
   */
  reg16?: boolean;

  /**
   * Represents an 16-bit special register?
   */
  reg16Spec?: boolean;

  /**
   * Represents an 16-bit index register?
   */
  reg16Idx?: boolean;

  /**
   * Represents a condition value?
   */
  condition?: boolean;

  /**
   * Represents a JR condition value?
   */
  relCondition?: boolean;
}

/**
 * This map contains the traits of token types
 */
export const commonTokenTraits = new Map<CommonTokenType, TokenTraits>();

// ----------------------------------------------------------------------------
// A
commonTokenTraits.set(CommonTokens.AlignPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Ampersand, {});
commonTokenTraits.set(CommonTokens.Assign, { pragma: true });

// ----------------------------------------------------------------------------
// B
commonTokenTraits.set(CommonTokens.BankPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.BinaryLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.BinaryNot, { expressionStart: true });
commonTokenTraits.set(CommonTokens.Break, { statement: true });
// ----------------------------------------------------------------------------
// C
commonTokenTraits.set(CommonTokens.CharLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.CiEqual, {});
commonTokenTraits.set(CommonTokens.CiNotEqual, {});
commonTokenTraits.set(CommonTokens.Colon, {});
commonTokenTraits.set(CommonTokens.Comma, {});
commonTokenTraits.set(CommonTokens.CompareBinPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Continue, { statement: true });
commonTokenTraits.set(CommonTokens.CurAddress, { expressionStart: true, literal: true });
commonTokenTraits.set(CommonTokens.CurCnt, { expressionStart: true, literal: true });

// ----------------------------------------------------------------------------
// D
commonTokenTraits.set(CommonTokens.DecimalLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.Def, {
  expressionStart: true,
  macroTimeFunction: true
});
commonTokenTraits.set(CommonTokens.DefbPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefcPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefgPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefgxPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefhPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefineDir, { directive: true });
commonTokenTraits.set(CommonTokens.DefmPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefnPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefsPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DefwPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.DispPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Divide, {});
commonTokenTraits.set(CommonTokens.Dot, { expressionStart: true, literal: true });
commonTokenTraits.set(CommonTokens.DoubleColon, { expressionStart: true });

// ----------------------------------------------------------------------------
// E
commonTokenTraits.set(CommonTokens.Elif, { statement: true });
commonTokenTraits.set(CommonTokens.Else, { statement: true });
commonTokenTraits.set(CommonTokens.ElseDir, { directive: true });
commonTokenTraits.set(CommonTokens.EndIfDir, { directive: true });
commonTokenTraits.set(CommonTokens.EndModule, { statement: true });
commonTokenTraits.set(CommonTokens.Endif, { statement: true });
commonTokenTraits.set(CommonTokens.Endl, { statement: true });
commonTokenTraits.set(CommonTokens.Endm, { statement: true });
commonTokenTraits.set(CommonTokens.Endp, { statement: true });
commonTokenTraits.set(CommonTokens.Ends, { statement: true });
commonTokenTraits.set(CommonTokens.Endw, { statement: true });
commonTokenTraits.set(CommonTokens.EntPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.EquPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Equal, {});
commonTokenTraits.set(CommonTokens.ErrorPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Exclamation, { expressionStart: true });
commonTokenTraits.set(CommonTokens.ExternPragma, { pragma: true });

// ----------------------------------------------------------------------------
// F
commonTokenTraits.set(CommonTokens.False, { expressionStart: true, literal: true });
commonTokenTraits.set(CommonTokens.FillbPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.FillwPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.For, { statement: true });

// ----------------------------------------------------------------------------
// G
commonTokenTraits.set(CommonTokens.GoesTo, {});
commonTokenTraits.set(CommonTokens.GreaterThan, {});
commonTokenTraits.set(CommonTokens.GreaterThanOrEqual, {});

// ----------------------------------------------------------------------------
// H
commonTokenTraits.set(CommonTokens.HexadecimalLiteral, {
  expressionStart: true,
  literal: true
});

// ----------------------------------------------------------------------------
// H
commonTokenTraits.set(CommonTokens.Identifier, { expressionStart: true });
commonTokenTraits.set(CommonTokens.If, { statement: true });
commonTokenTraits.set(CommonTokens.IfDefDir, { directive: true });
commonTokenTraits.set(CommonTokens.IfDir, { directive: true });
commonTokenTraits.set(CommonTokens.IfModDir, { directive: true });
commonTokenTraits.set(CommonTokens.IfNDefDir, { directive: true });
commonTokenTraits.set(CommonTokens.IfNModDir, { directive: true });
commonTokenTraits.set(CommonTokens.IfNUsed, { statement: true });
commonTokenTraits.set(CommonTokens.IfUsed, { statement: true });
commonTokenTraits.set(CommonTokens.IncludeBinPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.IncludeDir, { directive: true });
commonTokenTraits.set(CommonTokens.InjectOptPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.InlineComment, {});
commonTokenTraits.set(CommonTokens.IsExpr, {
  expressionStart: true,
  macroTimeFunction: true
});
commonTokenTraits.set(CommonTokens.IsIndexedAddr, {
  expressionStart: true,
  macroTimeFunction: true
});

// ----------------------------------------------------------------------------
// L
commonTokenTraits.set(CommonTokens.LDBrac, { expressionStart: true });
commonTokenTraits.set(CommonTokens.LineDir, { directive: true });
commonTokenTraits.set(CommonTokens.LPar, { expressionStart: true });
commonTokenTraits.set(CommonTokens.LSBrac, { expressionStart: true });
commonTokenTraits.set(CommonTokens.LTextOf, {
  expressionStart: true,
  parseTimeFunction: true
});
commonTokenTraits.set(CommonTokens.LeftShift, {});
commonTokenTraits.set(CommonTokens.LessThan, {});
commonTokenTraits.set(CommonTokens.LessThanOrEqual, {});
commonTokenTraits.set(CommonTokens.Loop, { statement: true });

// ----------------------------------------------------------------------------
// M
commonTokenTraits.set(CommonTokens.Macro, { statement: true });
commonTokenTraits.set(CommonTokens.MaxOp, {});
commonTokenTraits.set(CommonTokens.MinOp, {});
commonTokenTraits.set(CommonTokens.Minus, { expressionStart: true });
commonTokenTraits.set(CommonTokens.ModelPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Module, { statement: true });
commonTokenTraits.set(CommonTokens.Modulo, {});
commonTokenTraits.set(CommonTokens.Multiplication, {
  expressionStart: true,
  literal: true
});

// ----------------------------------------------------------------------------
// N
commonTokenTraits.set(CommonTokens.Next, { statement: true });
commonTokenTraits.set(CommonTokens.NoneArg, {});
commonTokenTraits.set(CommonTokens.NotEqual, {});

// ----------------------------------------------------------------------------
// O
commonTokenTraits.set(CommonTokens.OctalLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.OnErrorPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.OnSuccessPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.OrgPragma, { pragma: true });

// ----------------------------------------------------------------------------
// P
commonTokenTraits.set(CommonTokens.Plus, { expressionStart: true });
commonTokenTraits.set(CommonTokens.Proc, { statement: true });

// ----------------------------------------------------------------------------
// Q
commonTokenTraits.set(CommonTokens.QuestionMark, {});

// ----------------------------------------------------------------------------
// R
commonTokenTraits.set(CommonTokens.RDBrac, {});
commonTokenTraits.set(CommonTokens.RealLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.Repeat, { statement: true });
commonTokenTraits.set(CommonTokens.RightShift, {});
commonTokenTraits.set(CommonTokens.RndSeedPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.RPar, {});
commonTokenTraits.set(CommonTokens.RSBrac, {});

// ----------------------------------------------------------------------------
// S
commonTokenTraits.set(CommonTokens.SaveNexPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.SkipPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.Step, {});
commonTokenTraits.set(CommonTokens.StringLiteral, {
  expressionStart: true,
  literal: true
});
commonTokenTraits.set(CommonTokens.Struct, { statement: true });

// ----------------------------------------------------------------------------
// T
commonTokenTraits.set(CommonTokens.TextOf, {
  expressionStart: true,
  parseTimeFunction: true
});
commonTokenTraits.set(CommonTokens.To, {});
commonTokenTraits.set(CommonTokens.TracePragma, { pragma: true });
commonTokenTraits.set(CommonTokens.TraceHexPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.True, { expressionStart: true, literal: true });

// ----------------------------------------------------------------------------
// U
commonTokenTraits.set(CommonTokens.UndefDir, {});
commonTokenTraits.set(CommonTokens.Until, { statement: true });
commonTokenTraits.set(CommonTokens.UpArrow, {});

// ----------------------------------------------------------------------------
// V
commonTokenTraits.set(CommonTokens.VarPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.VerticalBar, {});

// ----------------------------------------------------------------------------
// W
commonTokenTraits.set(CommonTokens.While, { statement: true });

// ----------------------------------------------------------------------------
// X
commonTokenTraits.set(CommonTokens.XentPragma, { pragma: true });
commonTokenTraits.set(CommonTokens.XorgPragma, { pragma: true });

