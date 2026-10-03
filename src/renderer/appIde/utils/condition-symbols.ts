import type { EmuApi } from "@common/messaging/EmuApi";
import type { ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

import { ExpressionValueType } from "@abstractions/CompilerInfo";
import { bankLocalSymbolKey } from "@common/utils/breakpoint-condition/condition-types";

/*
 * The symbol table breakpoint conditions bind their labels to (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`
 * §3.6): the integer symbols of the last successful build, joined by the labels of every loaded
 * `.nex.dis` sidecar (F3). The emulator gets the whole table in one call whenever either changes.
 *
 * Module state, like the sidecar sync's own bookkeeping: one IDE window owns the build and the
 * sidecars, and the emulator holds the result.
 */

let buildSymbols: ConditionSymbols = {};
const sidecarSymbols = new Map<string, ConditionSymbols>();

/** The integer symbols of a compiler result (`compRes.symbols`, keyed lower-case). */
export function integerSymbolsOf(symbols: Record<string, unknown> | undefined): ConditionSymbols {
  const result: ConditionSymbols = {};
  for (const [name, info] of Object.entries(symbols ?? {})) {
    const value = (info as { value?: { _type?: number; _value?: unknown } })?.value;
    // --- Only integer symbols qualify; a string or boolean label leaves the condition inactive
    if (value?._type === ExpressionValueType.Integer && typeof value._value === "number") {
      result[name.toLowerCase()] = value._value;
    }
  }
  return result;
}

/** The labels of a NEX sidecar: globals by name, bank-locals as `<bank>:<name>` (bank offsets). */
export function sidecarSymbolsOf(annotations: NexFileAnnotations | undefined): ConditionSymbols {
  const result: ConditionSymbols = {};
  if (!annotations) return result;
  for (const label of annotations.globalLabels ?? []) {
    result[label.name.toLowerCase()] = label.value;
  }
  for (const [bankText, bank] of Object.entries(annotations.banks ?? {})) {
    for (const label of bank.localLabels ?? []) {
      result[bankLocalSymbolKey(Number(bankText), label.name)] = label.value;
    }
  }
  return result;
}

/** Every table merged: sidecar labels first, so where a build defines the same name it wins (§3.6). */
export function mergedConditionSymbols(): ConditionSymbols {
  const merged: ConditionSymbols = {};
  for (const symbols of sidecarSymbols.values()) Object.assign(merged, symbols);
  return Object.assign(merged, buildSymbols);
}

/** Record a successful build's symbols. */
export function setBuildConditionSymbols(symbols: ConditionSymbols): void {
  buildSymbols = symbols;
}

/** Record (or, with no annotations, forget) one sidecar's labels. */
export function setSidecarConditionSymbols(
  sidecar: string,
  annotations: NexFileAnnotations | undefined
): void {
  if (annotations) {
    sidecarSymbols.set(sidecar, sidecarSymbolsOf(annotations));
  } else {
    sidecarSymbols.delete(sidecar);
  }
}

/** Forget every table: a project was opened, and the last build was someone else's. */
export function clearConditionSymbols(): void {
  buildSymbols = {};
  sidecarSymbols.clear();
}

/**
 * Hand the merged table to the emulator. A missing machine is not an error: the next build or
 * sidecar change pushes again, and a new machine inherits the table from the old one.
 */
export async function pushConditionSymbols(emuApi: EmuApi): Promise<void> {
  try {
    await emuApi.setConditionSymbols(mergedConditionSymbols());
  } catch {
    // --- No machine yet
  }
}

/** For tests, which must not leak state between cases. */
export function resetConditionSymbolsForTests(): void {
  clearConditionSymbols();
}
