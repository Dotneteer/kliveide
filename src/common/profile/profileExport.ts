import { csvCell, csvRow } from "@common/history/csv";
import { profileLocationOf, type ProfileLayout } from "./layouts/profileLayout";
import { PF_EXECUTED, type ProfileTouchedByte } from "./profileTypes";
import type { AddressRow, CallGraph, CallNode, FlatProfile } from "./profileRollup";

/*
 * The profiler's exports (`.plans/PROFILER_PLAN.md` D13): Fuse's profile, CSV of the tables,
 * callgrind for KCachegrind/QCachegrind and speedscope JSON for flame graphs. Pure; the format
 * follows the file's extension unless `-format` names one.
 */

export type ProfileExportFormat = "fuse" | "csv" | "callgrind" | "speedscope";

/** The save dialog's remembered folder key */
export const PROFILE_EXPORT_FOLDER = "profileExport";

/** The save dialog's file types */
export const PROFILE_FILE_FILTERS = [
  { name: "speedscope flame graph", extensions: ["json"] },
  { name: "Callgrind (KCachegrind)", extensions: ["callgrind"] },
  { name: "CSV table", extensions: ["csv"] },
  { name: "Fuse profile", extensions: ["prof"] }
];

/** The format a file name implies: `.prof`/`.fuse`, `.csv`, `callgrind.out.*`/`.callgrind`, `.speedscope.json`/`.json` */
export function profileFormatOfName(file: string): ProfileExportFormat | undefined {
  const name = file.replace(/\\/g, "/").split("/").pop()!.toLowerCase();
  if (name.startsWith("callgrind.out") || name.endsWith(".callgrind")) return "callgrind";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json")) return "speedscope";
  if (name.endsWith(".prof") || name.endsWith(".fuse") || name.endsWith(".txt")) return "fuse";
  return undefined;
}

/**
 * Fuse's profile (D13 (1)): one `0xADDR,TSTATES` line per 64K address that started an instruction,
 * in address order - what Fuse writes and `profile2map` reads. Banked offsets fold onto the address
 * they run at (`cpuAddressOf`), so it is a 64K-logical view; without it, a partition's byte lands at
 * its address inside the partition.
 */
export function toFuse(
  bytes: readonly ProfileTouchedByte[],
  layout: ProfileLayout,
  cpuAddressOf?: (offset: number) => number | undefined
): string {
  const time = new Map<number, number>();
  for (const b of bytes) {
    if ((b.flags & PF_EXECUTED) === 0 || !b.time) continue;
    const address = cpuAddressOf?.(b.offset) ?? profileLocationOf(layout, b.offset)?.address;
    if (address === undefined) continue;
    time.set(address & 0xffff, (time.get(address & 0xffff) ?? 0) + b.time);
  }
  return [...time]
    .sort((a, b) => a[0] - b[0])
    .map(([address, t]) => `0x${address.toString(16).padStart(4, "0")},${t}\n`)
    .join("");
}

/** What the CSV and the text table need to name things */
export type ProfileTableContext = {
  /** "T-states" or "28 MHz ticks" */
  timeUnit: string;
  /** A partition's display name (`getPartitionLabels`) */
  partitionLabel?: (partition: number) => string;
};

/** The flat table as CSV (D13 (2)), pseudo-rows included */
export function toFlatCsv(flat: FlatProfile, context: ProfileTableContext): string {
  const unit = context.timeUnit;
  const header = [
    "Routine",
    "Kind",
    "Partition",
    "Entry",
    `Self (${unit})`,
    "Self %",
    flat.rows[0]?.callsFromGraph ? "Calls" : "Entry executions",
    "Instructions",
    `Average per call (${unit})`,
    `Per frame (${unit})`,
    "Size",
    "File",
    "Line"
  ];
  const lines = [csvRow(header.map((h) => csvCell(h)))];
  for (const r of flat.rows) {
    lines.push(
      csvRow([
        csvCell(r.name),
        csvCell(r.source),
        csvCell(r.partition === undefined ? undefined : (context.partitionLabel?.(r.partition) ?? String(r.partition))),
        csvCell(r.entry === undefined ? undefined : `$${hex4(r.entry)}`),
        csvCell(r.selfTime, true),
        csvCell(round(r.selfPct, 3), true),
        csvCell(r.pseudo ? undefined : r.calls, true),
        csvCell(r.pseudo ? undefined : r.instructions, true),
        csvCell(r.avgPerCall === undefined ? undefined : round(r.avgPerCall, 2), true),
        csvCell(r.perFrame === undefined ? undefined : round(r.perFrame, 2), true),
        csvCell(r.size, true),
        csvCell(r.file),
        csvCell(r.line, true)
      ])
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** The Addresses table as CSV (D13 (2)) */
export function toAddressCsv(rows: readonly AddressRow[], context: ProfileTableContext): string {
  const unit = context.timeUnit;
  const header = ["Partition", "Address", "Routine", "Offset in routine", "Executions", `Time (${unit})`, "Time %", "HALT"];
  const lines = [csvRow(header.map((h) => csvCell(h)))];
  for (const r of rows) {
    lines.push(
      csvRow([
        csvCell(r.partition === undefined ? undefined : (context.partitionLabel?.(r.partition) ?? String(r.partition))),
        csvCell(`$${hex4(r.address)}`),
        csvCell(r.routine.name),
        csvCell(r.routineOffset, true),
        csvCell(r.exec, true),
        csvCell(r.time, true),
        csvCell(round(r.pct, 3), true),
        csvCell(r.halt ? "yes" : undefined)
      ])
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** What the call-graph exports put in their headers */
export type CallGraphExportMeta = {
  /** The program or machine the profile is of */
  name: string;
  timeUnit: string;
  /** Everything measured: callgrind's summary */
  total: number;
};

/**
 * Callgrind (D13 (3)): one `fn` per routine with its exclusive time on its definition line, and
 * per callee a `cfn`/`calls=` pair with the inclusive time of those calls. Roots - the code outside
 * every tracked call and each interrupt (D11) - are functions of their own; KCachegrind computes
 * every inclusive cost from these. Without a call graph, each flat routine is a function with its
 * self time and no calls.
 */
export function toCallgrind(graph: CallGraph | undefined, flat: FlatProfile, meta: CallGraphExportMeta): string {
  const out: string[] = [
    "# callgrind format",
    "version: 1",
    "creator: Klive IDE",
    `cmd: ${meta.name}`,
    "positions: line",
    `events: Ticks`,
    `event: Ticks : ${meta.timeUnit}`,
    `summary: ${Math.round(meta.total)}`,
    ""
  ];
  const names = new UniqueNames();
  const fileOf = (node: { routine?: { file?: string } }) => node.routine?.file ?? "???";
  const lineOf = (node: { routine?: { line?: number } }) => node.routine?.line ?? 0;

  if (!graph || graph.totals.size === 0) {
    for (const r of flat.rows) {
      if (r.pseudo || !r.selfTime) continue;
      out.push(`fl=${r.file ?? "???"}`, `fn=${names.of(r.key, r.name)}`, `${r.line ?? 0} ${Math.round(r.selfTime)}`, "");
    }
    return out.join("\n");
  }

  const emit = (key: string, name: string, node: CallNode, self: number, calls: CallNode[]) => {
    out.push(`fl=${fileOf(node)}`, `fn=${names.of(key, name)}`);
    out.push(`${lineOf(node)} ${Math.round(self)}`);
    for (const c of calls) {
      if (!c.calls && !c.inclusive) continue;
      out.push(`cfl=${fileOf(c)}`, `cfn=${names.of(c.key, c.name)}`, `calls=${c.calls} ${lineOf(c)}`);
      // --- A recursive call's inclusive time is counted at the outermost activation (D12)
      out.push(`${lineOf(node)} ${Math.round(c.inclusive)}`);
    }
    out.push("");
  };

  for (const root of graph.roots) {
    if (root.kind === "interrupt" && root.routine) {
      // --- The interrupt calls its handler: the handler's own function carries the time
      emit(root.key, root.name, root, 0, [{ ...root, key: root.routine.key, name: root.routine.name }]);
    } else {
      emit(root.key, root.name, root, root.exclusive, graph.childrenOf(root));
    }
  }
  for (const [key, total] of graph.totals) {
    emit(key, total.name, total, total.exclusive, graph.childrenOf({ ...total, recursive: false }));
  }
  return out.join("\n");
}

/** Callgrind identifies a function by its name: two routines with one name get the key appended */
class UniqueNames {
  private readonly byKey = new Map<string, string>();
  private readonly used = new Set<string>();

  of(key: string, name: string): string {
    let unique = this.byKey.get(key);
    if (unique !== undefined) return unique;
    unique = name.replace(/[\r\n]/g, " ");
    if (this.used.has(unique)) unique = `${unique} [${key}]`;
    this.used.add(unique);
    this.byKey.set(key, unique);
    return unique;
  }
}

/** speedscope's file format (https://www.speedscope.app/file-format-schema.json), the parts used */
export type SpeedscopeFile = {
  $schema: "https://www.speedscope.app/file-format-schema.json";
  shared: { frames: { name: string; file?: string; line?: number }[] };
  profiles: {
    type: "sampled";
    name: string;
    unit: "none";
    startValue: number;
    endValue: number;
    samples: number[][];
    weights: number[];
  }[];
  name: string;
  activeProfileIndex: number;
  exporter: string;
};

/**
 * speedscope (D13 (4)): the call graph as weighted stacks, "sampled" type. A stack's weight is the
 * exclusive time of its top frame in that context. The core aggregates per caller/callee pair, not
 * per path, so below the first level a routine's calls are split across its callers in proportion
 * to the time each caller spent in it - the gprof estimate; the weights still add up to the total.
 */
export function toSpeedscope(graph: CallGraph, meta: CallGraphExportMeta): SpeedscopeFile {
  const frames: SpeedscopeFile["shared"]["frames"] = [];
  const frameIndex = new Map<string, number>();
  const frameOf = (node: CallNode): number => {
    let index = frameIndex.get(node.key);
    if (index === undefined) {
      index = frames.length;
      frames.push({
        name: node.name,
        ...(node.routine?.file ? { file: node.routine.file } : {}),
        ...(node.routine?.line ? { line: node.routine.line } : {})
      });
      frameIndex.set(node.key, index);
    }
    return index;
  };
  const samples: number[][] = [];
  const weights: number[] = [];
  const push = (stack: number[], weight: number) => {
    if (weight <= 0) return;
    samples.push(stack);
    weights.push(weight);
  };

  const walk = (node: CallNode, stack: number[], inclusive: number, exclusive: number, path: Set<string>, depth: number) => {
    push(stack, exclusive);
    if (node.recursive || depth > 64) return;
    const from = node.kind === "interrupt" && node.routine ? node.routine.key : node.key;
    const total = node.kind === "root" ? node.inclusive : (graph.totals.get(from)?.inclusive ?? 0);
    const share = total > 0 ? inclusive / total : 0;
    for (const child of graph.childrenOf(node, path)) {
      const childStack = [...stack, frameOf(child)];
      if (child.recursive) {
        push(childStack, child.exclusive * share);
        continue;
      }
      const next = new Set(path);
      next.add(child.key);
      walk(child, childStack, child.inclusive * share, child.exclusive * share, next, depth + 1);
    }
  };
  for (const root of graph.roots) {
    walk(root, [frameOf(root)], root.inclusive, root.exclusive, new Set([root.key, root.routine?.key ?? root.key]), 0);
  }
  const endValue = weights.reduce((a, b) => a + b, 0);
  return {
    $schema: "https://www.speedscope.app/file-format-schema.json",
    shared: { frames },
    profiles: [{ type: "sampled", name: `${meta.name} (${meta.timeUnit})`, unit: "none", startValue: 0, endValue, samples, weights }],
    name: meta.name,
    activeProfileIndex: 0,
    exporter: "Klive IDE"
  };
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
