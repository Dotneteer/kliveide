import type { ConditionSymbols } from "./condition-types";

/*
 * The integer symbols of a compiler result - what breakpoint conditions and logpoint templates bind
 * their labels to (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3.6). Dependency-free, so the main
 * process (which checks a build's `LOGPOINT` comments) and the IDE share it.
 */

/** `ExpressionValueType.Integer` (`@abstractions/CompilerInfo`), without importing the enum. */
const INTEGER = 2;

/** The integer symbols of a compiler result (`compRes.symbols`, keyed lower-case). */
export function integerSymbolsOf(symbols: Record<string, unknown> | undefined): ConditionSymbols {
  const result: ConditionSymbols = {};
  for (const [name, info] of Object.entries(symbols ?? {})) {
    const value = (info as { value?: { _type?: number; _value?: unknown } })?.value;
    // --- Only integer symbols qualify; a string or boolean label leaves the condition inactive
    if (value?._type === INTEGER && typeof value._value === "number") {
      result[name.toLowerCase()] = value._value;
    }
  }
  return result;
}
