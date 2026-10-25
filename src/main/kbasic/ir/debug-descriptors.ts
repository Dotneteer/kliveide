import * as f40 from "../../z80-backend/numeric/float40";
import type { VariableDescriptor } from "../../z80-backend/mir/mir";
import type { ArraySymbol, ConstSymbol, Scope, Symbol as KSymbol, VariableSymbol } from "../semantics/symbols";
import type { SourceSet } from "../syntax/source";
import { debugTypeOf } from "./types";

/**
 * Klive BASIC's variables as the shared back end's debug descriptors (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §3.3): names as the source writes them, BASIC's type names, and where each lives — a label the
 * assembler resolves, a fixed address, a frame offset or a constant's value. The back end turns them
 * into the debugger's variable table after assembly.
 */

/** The label of a global variable. */
export function globalName(name: string): string {
  return `_${name}`;
}

/** A name as the source writes it: with its sigil (`a$`, `n%`) when the declaration had one. */
function displayName(symbol: KSymbol, sources: SourceSet | undefined): string {
  if (!sources) return symbol.name;
  const text = sources.get(symbol.span.file).text.slice(symbol.span.start, symbol.span.end);
  return /^[A-Za-z_]\w*[$%]$/.test(text) && text.slice(0, -1) === symbol.name ? text : symbol.name;
}

function arrayInfo(symbol: ArraySymbol): NonNullable<VariableDescriptor["array"]> {
  const element = debugTypeOf(symbol.elementType);
  return {
    elementType: element.type,
    elementLabel: element.typeLabel,
    // --- A BASIC array is reached through its runtime descriptor (runtime-abi.md §2.3)
    layout: "descriptor",
    ...(symbol.bounds.length ? { dimensions: symbol.bounds.map((b) => ({ lower: b.lower, upper: b.upper })) } : {})
  };
}

function constantValue(symbol: ConstSymbol): number | string | undefined {
  const v = symbol.value.value;
  switch (v.kind) {
    case "int":
      return Number(v.value);
    case "fixed":
      return v.raw / 65536;
    case "float":
      return f40.toNumber(v.value);
    case "string":
      return v.value;
    default:
      return undefined;
  }
}

/** Where a global lives: its label, or the address or variable its `DIM ... AT` names. */
function globalStorage(symbol: VariableSymbol | ArraySymbol): VariableDescriptor["storage"] {
  const at = symbol.at?.value;
  if (at?.kind === "int") return { address: Number(at.value) & 0xffff };
  if (at?.kind === "address") {
    const label = at.symbol.startsWith("array:") ? `${globalName(at.symbol.slice(6))}.data` : globalName(at.symbol);
    return { label, offset: at.offset };
  }
  return { label: globalName(symbol.name) };
}

/** The user's globals and constants (the standard library's are not listed with them). */
export function globalDescriptors(globals: Scope, sources: SourceSet | undefined, isLibraryFile: (file: number) => boolean): VariableDescriptor[] {
  const out: VariableDescriptor[] = [];
  for (const symbol of globals.symbols) {
    if (isLibraryFile(symbol.span.file)) continue;
    if (symbol.kind === "const") {
      const value = constantValue(symbol);
      if (value === undefined) continue;
      out.push({
        name: symbol.name,
        displayName: displayName(symbol, sources),
        ...debugTypeOf(symbol.type),
        kind: "constant",
        storage: { constant: value },
        declaredAt: symbol.span
      });
      continue;
    }
    if (symbol.kind !== "variable" && symbol.kind !== "array") continue;
    if (symbol.storage !== "global") continue;
    out.push({
      name: symbol.name,
      displayName: displayName(symbol, sources),
      ...debugTypeOf(symbol.kind === "array" ? symbol.elementType : symbol.type),
      kind: "global",
      storage: globalStorage(symbol),
      ...(symbol.kind === "array" ? { array: arrayInfo(symbol) } : {}),
      declaredAt: symbol.span,
      ...(symbol.bank ? { bank: symbol.bank } : {})
    });
  }
  return out;
}

/** A routine's parameter or local: its frame slot at `offset` from IX (the value's first byte). */
export function frameDescriptor(
  symbol: VariableSymbol | ArraySymbol,
  offset: number,
  byRef: boolean,
  param: boolean,
  sources: SourceSet | undefined
): VariableDescriptor {
  return {
    name: symbol.name,
    displayName: displayName(symbol, sources),
    ...debugTypeOf(symbol.kind === "array" ? symbol.elementType : symbol.type),
    kind: param ? "parameter" : "local",
    ...(byRef ? { byRef: true } : {}),
    storage: { frameOffset: offset },
    ...(symbol.kind === "array" ? { array: arrayInfo(symbol) } : {}),
    declaredAt: symbol.span
  };
}
