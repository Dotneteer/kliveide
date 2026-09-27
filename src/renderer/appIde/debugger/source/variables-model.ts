import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type {
  SourceActivationInfo,
  SourceStopInfo,
  SourceValueType,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";

import {
  decodeRegisters,
  decodeValue,
  typeName,
  valueSize,
  type DecodedValue,
  type MemoryView
} from "./value-decoder";

/**
 * The Variables panel's model (plan §10.7): which variables the selected frame sees, where each one
 * lives, and its value — decoded from a snapshot of the machine's memory, so it can be tested
 * without an emulator or a DOM.
 */

/** One row of the Variables tree. `expand` lists its children (an array's dimensions or elements). */
export type VariableNode = {
  /** Unique within its section: the tree keys expansion on it. */
  id: string;
  name: string;
  type: string;
  value: string;
  /** Where the value is (for the tooltip and a data breakpoint); absent for constants and results. */
  address?: number;
  decoded?: DecodedValue;
  expand?: () => VariableNode[];
};

export type VariableSections = {
  /** FUNCTION results that returned during the last step (§10.2.6). */
  returned: VariableNode[];
  /** The selected frame's parameters and locals; undefined for the main program. */
  locals?: VariableNode[];
  /** Why the locals cannot be read (a routine's frame is not set up yet, or already gone). */
  localsNote?: string;
  globals: VariableNode[];
};

/** Elements shown per page when an array dimension is long. */
export const ARRAY_PAGE = 100;

/** An array's layout, read from its descriptor (runtime ABI §2.3). */
export type ArrayLayout = {
  data: number;
  elementType: SourceValueType;
  elementSize: number;
  /** Per dimension; `count` is undefined when it cannot be known (an array parameter's first). */
  dimensions: { lower: number; count?: number }[];
};

/** The address of a variable's value (or of its array descriptor), or undefined when it cannot be read. */
export function variableAddress(v: VariableDebugInfo, mem: MemoryView, ix: number | undefined): number | undefined {
  let address: number;
  if (v.location.at === "absolute") address = v.location.address;
  else if (v.location.at === "frame") {
    if (ix === undefined) return undefined;
    address = (ix + v.location.ixOffset) & 0xffff;
  } else return undefined;
  return v.byRef ? mem.word(address) : address;
}

export function arrayLayout(v: VariableDebugInfo, mem: MemoryView, descriptor: number): ArrayLayout {
  const elementType = v.array!.elementType;
  const dimTable = mem.word(descriptor);
  const data = mem.word(descriptor + 2);
  const declared = v.array!.dimensions;
  if (declared?.length) {
    return {
      data,
      elementType,
      elementSize: valueSize(elementType),
      dimensions: declared.map((d) => ({ lower: d.lower, count: d.upper - d.lower + 1 }))
    };
  }
  // --- An array parameter: the argument's own descriptor says how many dimensions and how long all
  // --- but the first are; the bound tables, when the program keeps them, give the rest
  const n = mem.word(dimTable) + 1;
  const lbTable = mem.word(descriptor + 4);
  const ubTable = mem.word(descriptor + 6);
  const dimensions: ArrayLayout["dimensions"] = [];
  for (let i = 0; i < n; i++) {
    const lower = lbTable ? mem.word(lbTable + 2 * i) : 0;
    let count: number | undefined = i > 0 ? mem.word(dimTable + 2 * i) : undefined;
    if (ubTable) count = mem.word(ubTable + 2 * i) - lower + 1;
    dimensions.push({ lower, ...(count !== undefined ? { count } : {}) });
  }
  return { data, elementType, elementSize: mem.byte(dimTable + 2 * n) || valueSize(elementType), dimensions };
}

/** The address of an element; subscripts are the source's (lower bound included). */
export function elementAddress(layout: ArrayLayout, subscripts: number[]): number | undefined {
  let flat = 0;
  for (let i = 0; i < layout.dimensions.length; i++) {
    const d = layout.dimensions[i];
    const index = subscripts[i] - d.lower;
    if (index < 0 || (d.count !== undefined && index >= d.count)) return undefined;
    if (i > 0 && d.count === undefined) return undefined;
    flat = flat * (i > 0 ? d.count! : 1) + index;
  }
  return (layout.data + flat * layout.elementSize) & 0xffff;
}

function scalarNode(id: string, name: string, type: SourceValueType, mem: MemoryView, address: number): VariableNode {
  const decoded = decodeValue(type, mem, address);
  return { id, name, type: typeName(type), value: decoded.text, address, decoded };
}

function boundsText(layout: ArrayLayout): string {
  return layout.dimensions
    .map((d) => (d.count === undefined ? `${d.lower} TO ?` : `${d.lower} TO ${d.lower + d.count - 1}`))
    .join(", ");
}

/** The children of an array node at `prefix` (the subscripts chosen so far), paged by ARRAY_PAGE. */
function arrayChildren(
  id: string,
  name: string,
  layout: ArrayLayout,
  mem: MemoryView,
  prefix: number[],
  from?: number,
  to?: number
): VariableNode[] {
  const d = layout.dimensions[prefix.length];
  if (d.count === undefined) return [];
  const first = from ?? d.lower;
  const last = to ?? d.lower + d.count - 1;
  if (last - first + 1 > ARRAY_PAGE) {
    const pages: VariableNode[] = [];
    for (let lo = first; lo <= last; lo += ARRAY_PAGE) {
      const hi = Math.min(lo + ARRAY_PAGE - 1, last);
      pages.push({
        id: `${id}[${lo}]`,
        name: `[${lo} … ${hi}]`,
        type: "",
        value: "",
        expand: () => arrayChildren(id, name, layout, mem, prefix, lo, hi)
      });
    }
    return pages;
  }
  const out: VariableNode[] = [];
  const leaf = prefix.length === layout.dimensions.length - 1;
  for (let i = first; i <= last; i++) {
    const subscripts = [...prefix, i];
    const label = `${name}(${subscripts.join(", ")}${leaf ? "" : ", …"})`;
    const childId = `${id}(${subscripts.join(",")})`;
    if (leaf) {
      out.push(scalarNode(childId, label, layout.elementType, mem, elementAddress(layout, subscripts)!));
    } else {
      out.push({
        id: childId,
        name: label,
        type: "",
        value: "",
        expand: () => arrayChildren(childId, name, layout, mem, subscripts)
      });
    }
  }
  return out;
}

/** The row for one variable, or undefined when its storage cannot be read now. */
export function variableNode(v: VariableDebugInfo, mem: MemoryView, ix: number | undefined): VariableNode | undefined {
  const id = `${v.scope === "global" ? "g" : `l${v.scope.callableIndex}`}:${v.name}`;
  if (v.location.at === "constant") {
    const value = v.location.value;
    return {
      id,
      name: v.displayName,
      type: `CONST ${typeName(v.type)}`,
      value: typeof value === "string" ? `"${value}"` : String(value)
    };
  }
  const address = variableAddress(v, mem, ix);
  if (address === undefined) return undefined;
  if (!v.array) return scalarNode(id, v.displayName, v.type, mem, address);
  const layout = arrayLayout(v, mem, address);
  const allocated = layout.data !== 0;
  return {
    id,
    name: v.displayName,
    type: `${typeName(layout.elementType)}(${boundsText(layout)})`,
    value: allocated ? `$${layout.data.toString(16).toUpperCase().padStart(4, "0")}` : "not allocated",
    address,
    ...(allocated && layout.dimensions[0].count !== undefined
      ? { expand: () => arrayChildren(id, v.displayName, layout, mem, []) }
      : {})
  };
}

/** The IX of the activation whose locals `frame` shows: a GOSUB runs in its enclosing routine's frame. */
export function frameIx(chain: SourceActivationInfo[], frame: number): number | undefined {
  const a = chain[frame];
  if (!a) return undefined;
  if (a.kind !== "gosub") return a.ix;
  for (let k = frame + 1; k < chain.length; k++) {
    if (chain[k].callableIndex === a.callableIndex && chain[k].kind === "routine") return chain[k].ix;
  }
  return undefined;
}

export function buildVariableSections(
  info: SourceLevelDebugInfo,
  chain: SourceActivationInfo[],
  frame: number,
  stop: SourceStopInfo | undefined,
  mem: MemoryView
): VariableSections {
  const ext = info.extensions;
  const variables = ext?.variables ?? [];
  const returned = (stop?.returned ?? []).map((r, i) => {
    const callable = info.callables[r.callableIndex];
    const type = ext?.frames[r.callableIndex]?.returnType ?? "uinteger";
    const decoded = decodeRegisters(type, r.registers, mem);
    return { id: `r${i}`, name: `${callable?.name ?? "?"}()`, type: typeName(type), value: decoded.text, decoded };
  });
  const globals = variables
    .filter((v) => v.scope === "global")
    .map((v) => variableNode(v, mem, undefined))
    .filter((n): n is VariableNode => !!n);

  const activation = chain[frame];
  if (!activation) return { returned, globals };
  const callableIndex = activation.callableIndex;
  const scoped = variables.filter((v) => v.scope !== "global" && v.scope.callableIndex === callableIndex);
  const isRoutine = ext?.frames[callableIndex]?.convention === "frame";
  if (!isRoutine) return { returned, globals };
  const ix = frameIx(chain, frame);
  if (ix === undefined) {
    return { returned, globals, locals: [], localsNote: "The routine's frame is not set up here" };
  }
  const locals = scoped.map((v) => variableNode(v, mem, ix)).filter((n): n is VariableNode => !!n);
  return { returned, globals, locals };
}
