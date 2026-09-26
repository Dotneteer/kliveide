/**
 * The binder's diagnostics. Errors have no codes upstream (spec `diagnostics.errors` lists their
 * classes); Klive numbers them E4xx, and E45x for CODEBANK. Warnings keep the spec's W-codes; the
 * spec's uncoded warnings and Klive's own take K4xx. `test/kbasic/semantics/diagnostics.test.ts`
 * has a case for every entry.
 */
export const SEMANTIC_ERRORS = {
  E401: "undeclared identifier, array or label",
  E402: "identifier used with the wrong class (variable, array, constant, function, sub, label)",
  E403: "duplicate declaration (variable, constant, array, label, line number, routine, parameter)",
  E404: "a variable declared after it was already used",
  E405: "array bounds not constant, negative or reversed",
  E406: "an AT address, initial value or default value that is not constant",
  E407: "an array initialiser whose shape does not match the bounds",
  E408: "a string array with an initialiser",
  E409: "a string where a number is needed, or a number where a string is needed (use VAL or STR)",
  E410: "an operator that does not apply to its operands (strings in arithmetic, bitwise or logical operators)",
  E411: "the variable after NEXT is not the FOR loop's",
  E412: "EXIT or CONTINUE outside a loop of that kind",
  E413: "GOSUB or DATA inside a SUB or FUNCTION",
  E414: "a RETURN that does not fit its routine (a value outside FUNCTION, none inside one)",
  E415: "a definition that does not match its DECLARE, or a DECLARE after the definition",
  E416: "a routine declared but never defined",
  E417: "wrong arguments: count, an unknown or repeated name, a positional argument after a named one",
  E418: "a BYREF argument that is not a variable, array or array element",
  E419: "an array parameter passed BYVAL, or with a default value",
  E420: "a mandatory parameter after an optional one",
  E421: "READ into a whole array",
  E422: "a sigil that contradicts the variable's type",
  E423: "an assignment to something that is not a variable (a constant, routine or label), or an array assigned to a scalar",
  E424: "a whole-array copy between arrays of different element type or size",
  E425: "a constant expression required (CONST, bounds, ON targets), or one that overflows",
  E426: "a declaration without a type while strict typing is on",
  E427: "a variable used before declaration while explicit declarations are on",
  E428: "the wrong number of subscripts for an array",
  E429: "a SUB used as a value, or a call of something that is not a routine",
  E430: "a jump to a label inside a SUB or FUNCTION from outside it",
  E450: "a CODEBANK bank number that is not a constant from 1 to 255",
  E451: "a direct GOTO or GOSUB between different banks",
  E452: "a reference into a bank from outside it (other than a call or FARPTR)",
  E453: "a banked #init routine",
  E454: "an ASM block that switches bank and does not switch back"
} as const;

export const SEMANTIC_WARNINGS = {
  W100: "an identifier received the default (implicit) type",
  W101: "a string variable is read before it was ever assigned",
  W110: "a condition is constant",
  W120: "a constant conversion loses significant digits or does not fit the target type",
  W130: "a loop body is empty",
  W140: "an empty IF was discarded",
  W150: "a variable or parameter is never used (optimisation level above 0)",
  W160: "a FASTCALL routine declares more than one parameter",
  W170: "a routine is never called (optimisation level above 0)",
  W180: "unreachable code",
  W190: "a FUNCTION may finish without returning a value",
  W200: "a value will be truncated",
  W900: "a BYREF argument crosses banks",
  W910: "a bank holds data but no routine",
  W920: "a bare @array used in a bank",
  K401: "a FOR loop whose STEP is 0",
  K402: "a FOR loop that never runs",
  K403: "SGN or ABS of an unsigned value",
  K404: "a whole-array copy between arrays of different dimension shapes",
  K405: "a definition whose parameter names differ from its DECLARE",
  K406: "a constant integer division by zero",
  K407: "VAL of a constant string that is not a number"
} as const;

export type SemanticCode = keyof typeof SEMANTIC_ERRORS | keyof typeof SEMANTIC_WARNINGS;
