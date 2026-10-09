import type { ConditionSymbols } from "./condition-types";
import { flattenSymbols, type SymbolTables } from "../flatten-symbols";

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

/**
 * The integer symbols of a whole compilation: the root symbols and every module's, by dotted name
 * (`.plans/Z80_UNIT_TESTS_PLAN.md` T4), so `Module1.counter` works in a condition or an `ASSERTION`.
 */
export function integerSymbolsOfOutput(output: unknown): ConditionSymbols {
  return integerSymbolsOf(flattenSymbols(output as SymbolTables | undefined));
}
