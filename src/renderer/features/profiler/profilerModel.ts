import type { RoutineLabel } from "@common/profile/routineMap";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { EmuApi } from "@common/messaging/EmuApi";
import { profileLayoutOf } from "@common/profile/layouts";
import { profileLocationOf, profileOffsetOf, type ProfileLayout } from "@common/profile/layouts/profileLayout";
import {
  PF_EXECUTED,
  type ProfileEdge,
  type ProfileStatus,
  type ProfileTouchedByte
} from "@common/profile/profileTypes";
import {
  buildCallGraph,
  rollupAddresses,
  rollupFlat,
  type AddressRow,
  type CallGraph,
  type CallNode,
  type FlatProfile,
  type FlatRow
} from "@common/profile/profileRollup";
import { buildRoutineMap, routineSourceLabel, type RoutineMap } from "@common/profile/routineMap";
import { t } from "@common/i18n/i18n";

/*
 * The Profiler document's and the `profile` commands' model (`.plans/PROFILER_PLAN.md` D3-D5,
 * D10, D14): one read of the profile through the Emu API, rolled up by the pure functions in
 * `src/common/profile/`. No React, so it is tested without rendering.
 */

/** Everything the profiler reads from the emulator at once */
export type ProfileSnapshot = {
  status: ProfileStatus;
  /** Instruction starts (`PF_EXECUTED`), with their counters */
  bytes: ProfileTouchedByte[];
  /** The call graph's edges; empty when the call tracker never ran */
  edges: ProfileEdge[];
  /** The profile offset each 8K slot maps to now (unbanked code runs in whatever is paged) */
  slotOffsets: (number | null)[];
  partitionLabels: Record<number, string>;
};

/** Reads a snapshot; undefined when the machine keeps no profile */
export async function readProfileSnapshot(
  emuApi: Pick<EmuApi, "getProfileStatus" | "getProfileTouched" | "getProfileEdges" | "getProfileSlotOffsets" | "getPartitionLabels">
): Promise<ProfileSnapshot | undefined> {
  const status = await emuApi.getProfileStatus();
  if (!status) return undefined;
  const [touched, edges, slotOffsets, partitionLabels] = await Promise.all([
    emuApi.getProfileTouched(PF_EXECUTED),
    status.callsOn || status.calls || status.interrupts ? emuApi.getProfileEdges() : Promise.resolve(undefined),
    emuApi.getProfileSlotOffsets().catch(() => undefined),
    emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>)
  ]);
  return {
    status: touched?.info ?? status,
    bytes: touched?.bytes ?? [],
    edges: edges?.edges ?? [],
    slotOffsets: slotOffsets ?? [],
    partitionLabels: partitionLabels ?? {}
  };
}

/** The profile offset of a CPU address in a partition, or - unbanked - in whatever is paged now */
export function offsetResolver(
  layout: ProfileLayout,
  slotOffsets: readonly (number | null)[]
): (partition: number | undefined, address: number) => number | undefined {
  return (partition, address) => {
    if (partition !== undefined) return profileOffsetOf(layout, partition, address);
    const slot = slotOffsets[(address & 0xffff) >> 13];
    if (slot !== undefined && slot !== null) return slot + (address & 0x1fff);
    return profileOffsetOf(layout, undefined, address);
  };
}

/** The CPU address a profile offset runs at now; undefined when it is not paged in */
export function cpuAddressResolver(
  layout: ProfileLayout,
  slotOffsets: readonly (number | null)[]
): (offset: number) => number | undefined {
  return (offset) => {
    for (let slot = 0; slot < slotOffsets.length; slot++) {
      const start = slotOffsets[slot];
      if (start !== null && start !== undefined && offset >= start && offset < start + 0x2000) {
        return slot * 0x2000 + (offset - start);
      }
    }
    return layout.fixedAddress ? profileLocationOf(layout, offset)?.address : undefined;
  };
}

export type ProfilerModel = {
  snapshot: ProfileSnapshot;
  layout: ProfileLayout;
  map: RoutineMap;
  /** "Routines from labels (sjasmplus)" (D6) */
  sourceLabel: string;
  flat: FlatProfile;
  addresses: AddressRow[];
  /** Undefined when the call tracker recorded nothing */
  graph?: CallGraph;
  partitionLabel: (partition: number) => string;
};

/** Rolls a snapshot up; undefined when the machine's layout is unknown */
export function buildProfilerModel(
  snapshot: ProfileSnapshot,
  compilation: KliveCompilerOutput | undefined,
  options: { hideWaiting?: boolean; annotationLabels?: readonly RoutineLabel[] } = {}
): ProfilerModel | undefined {
  const { status } = snapshot;
  const layout = profileLayoutOf(status.machineId);
  if (!layout) return undefined;
  const partitionLabel = (p: number) => snapshot.partitionLabels[p] ?? String(p);
  const map = buildRoutineMap({
    compilation,
    layout,
    offsetOf: offsetResolver(layout, snapshot.slotOffsets),
    machineId: status.machineId,
    edges: snapshot.edges,
    partitionLabel,
    annotationLabels: options.annotationLabels
  });
  const flat = rollupFlat(snapshot.bytes, map, status, {
    hideWaiting: options.hideWaiting ?? true,
    edges: snapshot.edges,
    frameTicks: status.frameTicks
  });
  return {
    snapshot,
    layout,
    map,
    sourceLabel: routineSourceLabel(map),
    flat,
    addresses: rollupAddresses(snapshot.bytes, map, layout, flat.denominator, { hideWaiting: options.hideWaiting ?? true }),
    graph: snapshot.edges.length ? buildCallGraph(snapshot.edges, map, status) : undefined,
    partitionLabel
  };
}

// ------------------------------------------------------------------------------------------------
// Text

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/** The time unit's short name: "T" or "ticks" (28 MHz) */
export function unitShort(status: Pick<ProfileStatus, "timeUnit">): string {
  return status.timeUnit === "T-states" ? "T" : "ticks";
}

/** Wall time of `ticks` at the machine's clock (D5): "412 µs", "3.27 ms", "1.20 s" */
export function formatWallTime(ticks: number, clockHz?: number): string | undefined {
  if (!clockHz) return undefined;
  const seconds = ticks / clockHz;
  if (seconds >= 1) return `${seconds.toFixed(2)} s`;
  if (seconds >= 0.001) return `${(seconds * 1000).toFixed(2)} ms`;
  return `${(seconds * 1_000_000).toFixed(seconds * 1_000_000 >= 10 ? 0 : 1)} µs`;
}

/** Time in the core's unit and as wall time (D5): "12,345 T (3.53 ms)" */
export function formatTime(ticks: number, status: Pick<ProfileStatus, "timeUnit" | "clockHz">): string {
  const wall = formatWallTime(ticks, status.clockHz);
  return `${n(ticks)} ${unitShort(status)}${wall ? ` (${wall})` : ""}`;
}

/** A percentage with one decimal */
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

/** The header's facts (D14): the window, the total, the waiting share, the call tracker's counters (D10) */
export function profileHeaderFacts(model: ProfilerModel): { text: string; title?: string; warning?: boolean }[] {
  const { status } = model.snapshot;
  const facts: { text: string; title?: string; warning?: boolean }[] = [];
  const state = status.enabled
    ? status.armedStart >= 0
      ? t("panels.feature.profiler.state.armed", { address: `$${hex4(status.armedStart)}` })
      : t("panels.feature.profiler.state.profiling")
    : status.timeTotal
      ? t("panels.feature.profiler.state.stopped")
      : t("panels.feature.profiler.state.notStarted");
  facts.push({ text: state });
  if (model.flat.frames !== undefined) {
    facts.push({
      text: t("panels.feature.profiler.frames", { frames: model.flat.frames.toFixed(model.flat.frames < 10 ? 2 : 1) }),
      title: t("panels.feature.profiler.framesTooltip")
    });
  }
  facts.push({ text: t("panels.feature.profiler.total", { time: formatTime(status.timeTotal, status) }) });
  if (model.flat.waiting && status.timeTotal) {
    facts.push({
      text: t("panels.feature.profiler.waiting", { pct: formatPct((100 * model.flat.waiting) / status.timeTotal) }),
      title: t("panels.feature.profiler.waitingTooltip")
    });
  }
  facts.push({ text: model.sourceLabel });
  if (status.stackResyncs) {
    facts.push({
      text: t("panels.feature.profiler.stackSwitches", { count: status.stackResyncs }),
      warning: true,
      title: t("panels.feature.profiler.stackSwitchesTooltip")
    });
  }
  if (status.depthOverflows) {
    facts.push({
      text: t("panels.feature.profiler.tooDeep", { count: status.depthOverflows }),
      warning: true,
      title: t("panels.feature.profiler.tooDeepTooltip")
    });
  }
  if (status.edgesDropped) {
    facts.push({
      text: t("panels.feature.profiler.edgesDropped", { count: status.edgesDropped }),
      warning: true,
      title: t("panels.feature.profiler.edgesDroppedTooltip")
    });
  }
  return facts;
}

/** What the document says when there is nothing to show */
export function profilerEmptyMessage(input: {
  supported: boolean;
  switchedOff: boolean;
  model?: ProfilerModel;
}): string | undefined {
  if (input.switchedOff) {
    return t("panels.feature.profiler.empty.switchedOff");
  }
  if (!input.supported) return t("panels.feature.profiler.empty.unsupported");
  const status = input.model?.snapshot.status;
  if (!status || (!status.timeTotal && !status.instructions)) {
    return status?.enabled
      ? status.armedStart >= 0
        ? t("panels.feature.profiler.empty.armed", { address: `$${hex4(status.armedStart)}` })
        : t("panels.feature.profiler.empty.profiling")
      : t("panels.feature.profiler.empty.noProfile");
  }
  return undefined;
}

export type TopSort = "self" | "inclusive" | "calls";

/** A row of `profile top`: a routine with its self time and, from the call graph, inclusive time */
export type TopRow = { name: string; self: number; selfPct: number; inclusive?: number; calls: number; pseudo: boolean };

/** The rows `profile top` prints, sorted (D16) */
export function topRows(model: ProfilerModel, by: TopSort): TopRow[] {
  const rows: TopRow[] = model.flat.rows.map((r: FlatRow) => {
    const total = r.routine ? model.graph?.totals.get(r.routine.key) : undefined;
    return {
      name: r.name,
      self: r.selfTime,
      selfPct: r.selfPct,
      inclusive: total?.inclusive,
      calls: r.calls,
      pseudo: !!r.pseudo
    };
  });
  const key = (r: TopRow) => (by === "inclusive" ? (r.inclusive ?? r.self) : by === "calls" ? r.calls : r.self);
  return rows.sort((a, b) => key(b) - key(a) || b.self - a.self);
}

/** `profile top`'s text table (D16), also for KSX and the CLI */
export function topTableLines(model: ProfilerModel, count: number, by: TopSort): string[] {
  const { status } = model.snapshot;
  const unit = unitShort(status);
  const rows = topRows(model, by).slice(0, count);
  const withInclusive = !!model.graph;
  const callsTitle = model.flat.rows[0]?.callsFromGraph ? "Calls" : "Entries";
  const nameWidth = Math.min(32, Math.max(7, ...rows.map((r) => r.name.length)));
  const header =
    `${"Routine".padEnd(nameWidth)}  ${`Self (${unit})`.padStart(14)}  ${"Self %".padStart(7)}` +
    (withInclusive ? `  ${`Incl. (${unit})`.padStart(14)}` : "") +
    `  ${callsTitle.padStart(10)}`;
  const lines = [model.sourceLabel, header];
  for (const r of rows) {
    const name = r.name.length > nameWidth ? `${r.name.slice(0, nameWidth - 1)}…` : r.name;
    lines.push(
      `${name.padEnd(nameWidth)}  ${n(r.self).padStart(14)}  ${formatPct(r.selfPct).padStart(7)}` +
        (withInclusive ? `  ${(r.inclusive === undefined ? "" : n(r.inclusive)).padStart(14)}` : "") +
        `  ${(r.pseudo ? "" : n(r.calls)).padStart(10)}`
    );
  }
  return lines;
}

/** The Call tree's node path key, for expansion state */
export function nodePathKey(path: readonly CallNode[]): string {
  return path.map((p) => p.key).join(">");
}

/** One visible row of the Call tree */
export type CallTreeRow = {
  node: CallNode;
  depth: number;
  /** The path's key: what `expanded` holds */
  pathKey: string;
  expandable: boolean;
  expanded: boolean;
};

/**
 * The Call tree's visible rows (D14): top-down from the roots, a node's calls under it when its path
 * is expanded. A routine already on its path is shown once more, marked recursive, and not expanded.
 */
export function flattenCallTree(graph: CallGraph, expanded: ReadonlySet<string>, maxRows = 50_000): CallTreeRow[] {
  const rows: CallTreeRow[] = [];
  const visit = (node: CallNode, path: CallNode[], keys: Set<string>) => {
    if (rows.length >= maxRows) return;
    const fullPath = [...path, node];
    const pathKey = nodePathKey(fullPath);
    const children = node.recursive ? [] : graph.childrenOf(node, keys);
    const isExpanded = expanded.has(pathKey);
    rows.push({ node, depth: path.length, pathKey, expandable: children.length > 0, expanded: isExpanded && children.length > 0 });
    if (!isExpanded) return;
    const next = new Set(keys);
    next.add(node.key);
    if (node.routine) next.add(node.routine.key);
    for (const child of children) visit(child, fullPath, next);
  };
  for (const root of graph.roots) visit(root, [], new Set());
  return rows;
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
