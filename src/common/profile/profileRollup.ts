import { profileLocationOf, type ProfileLayout } from "./layouts/profileLayout";
import {
  isProfileRootKey,
  PF_EXECUTED,
  PF_HALT,
  PROFILE_KEY_INT,
  PROFILE_KEY_NMI,
  PROFILE_KEY_OTHER,
  PROFILE_KEY_ROOT,
  PROFILE_KEY_UNMAPPED,
  type ProfileEdge,
  type ProfileEdgeKind,
  type ProfileInfo,
  type ProfileTouchedByte
} from "./profileTypes";
import type { Routine, RoutineMap, RoutineSource } from "./routineMap";

/*
 * The profiler's views of a profile (`.plans/PROFILER_PLAN.md` D3-D5, D11, §4.1): the flat
 * "top routines" table, the per-address table and the call graph. Pure: the IDE's document, the
 * `profile top` command, the exporters, KSX and the CLI (G5.6) all start here.
 */

// ------------------------------------------------------------------------------------------------
// The flat profile (D3, D4, D5)

/** Time that is no routine's (D4): shown as italic pseudo-rows */
export type PseudoRowKind = "halt" | "intAck" | "dma" | "snooze";

export type FlatRow = {
  key: string;
  name: string;
  /** Where the routine came from, or "pseudo" for a D4 row */
  source: RoutineSource | "pseudo";
  pseudo?: PseudoRowKind;
  routine?: Routine;
  partition?: number;
  /** The entry's CPU address */
  entry?: number;
  /** Its size up to the next routine (T7: a label's routine runs to the next label) */
  size?: number;
  file?: string;
  line?: number;
  /** Time spent in the routine's own instructions (its HALTs' waiting excluded, D4) */
  selfTime: number;
  /** `selfTime` as a share of the table's denominator, 0-100 */
  selfPct: number;
  /** Calls from the call graph when it ran, else executions of the entry instruction */
  calls: number;
  callsFromGraph: boolean;
  /** Instructions executed inside the routine */
  instructions: number;
  /** `selfTime / calls`; undefined without calls */
  avgPerCall?: number;
  /** `selfTime` per emulated frame (D5); undefined when the frame length is unknown */
  perFrame?: number;
};

export type FlatProfile = {
  /** Routine rows by self time, then the pseudo-rows that have time */
  rows: FlatRow[];
  /** The percentages' denominator: the total, less the HALT row when waiting is hidden */
  denominator: number;
  /** Everything measured */
  total: number;
  /** The HALT row's time (D4) */
  waiting: number;
  /** Emulated frames in the window (D5, T6): the total over one frame's length */
  frames?: number;
};

export type FlatOptions = {
  /** Remove HALT from the rows and the denominator (D4: on by default) */
  hideWaiting?: boolean;
  /** The call graph's edges: the calls column counts calls rather than entry executions */
  edges?: readonly ProfileEdge[];
  /** One frame's length in the time unit (D5) */
  frameTicks?: number;
};

/** What `rollupFlat` needs of the profile's header */
export type FlatInfo = Pick<ProfileInfo, "timeTotal" | "timeIntAck" | "timeNmiAck" | "timeDma" | "timeSnooze">;

/**
 * Rolls every instruction start's execution count and time up into its routine (D3). A HALT's
 * byte (`PF_HALT`) goes to the "HALT (waiting)" row instead (D4): its time is the machine waiting.
 */
export function rollupFlat(
  bytes: readonly ProfileTouchedByte[],
  map: RoutineMap,
  info: FlatInfo,
  options: FlatOptions = {}
): FlatProfile {
  const hideWaiting = options.hideWaiting ?? true;
  type Acc = { routine: Routine; time: number; exec: number; entryExec: number };
  const acc = new Map<string, Acc>();
  let waiting = 0;
  for (const b of bytes) {
    if ((b.flags & PF_EXECUTED) === 0 && !b.time) continue;
    if (b.flags & PF_HALT) {
      waiting += b.time ?? 0;
      continue;
    }
    const routine = map.routineAt(b.offset);
    let a = acc.get(routine.key);
    if (!a) acc.set(routine.key, (a = { routine, time: 0, exec: 0, entryExec: 0 }));
    a.time += b.time ?? 0;
    a.exec += b.exec ?? 0;
    if (routine.entryOffset === b.offset) a.entryExec += b.exec ?? 0;
  }

  // --- The call graph's calls into each routine
  const graphCalls = new Map<string, number>();
  const edges = options.edges ?? [];
  for (const e of edges) {
    if (isProfileRootKey(e.callee) || (e.callee & PROFILE_KEY_UNMAPPED) !== 0) continue;
    const key = map.routineAt(e.callee).key;
    graphCalls.set(key, (graphCalls.get(key) ?? 0) + e.calls);
  }
  const fromGraph = edges.length > 0;

  const total = info.timeTotal;
  const denominator = hideWaiting ? Math.max(0, total - waiting) : total;
  const frames = options.frameTicks ? total / options.frameTicks : undefined;
  const pct = (t: number) => (denominator ? (100 * t) / denominator : 0);

  const rows: FlatRow[] = [];
  for (const a of acc.values()) {
    const r = a.routine;
    const calls = fromGraph ? (graphCalls.get(r.key) ?? 0) : a.entryExec;
    rows.push({
      key: r.key,
      name: r.name,
      source: r.source,
      routine: r,
      partition: r.partition,
      entry: r.entry,
      size: r.end - r.entry,
      file: r.file,
      line: r.line,
      selfTime: a.time,
      selfPct: pct(a.time),
      calls,
      callsFromGraph: fromGraph,
      instructions: a.exec,
      avgPerCall: calls ? a.time / calls : undefined,
      perFrame: frames ? a.time / frames : undefined
    });
  }
  rows.sort((x, y) => y.selfTime - x.selfTime || x.name.localeCompare(y.name));

  const pseudo = (kind: PseudoRowKind, name: string, time: number) => {
    if (time <= 0) return;
    rows.push({
      key: `$${kind}`,
      name,
      source: "pseudo",
      pseudo: kind,
      selfTime: time,
      selfPct: pct(time),
      calls: 0,
      callsFromGraph: fromGraph,
      instructions: 0,
      perFrame: frames ? time / frames : undefined
    });
  };
  if (!hideWaiting) pseudo("halt", "HALT (waiting)", waiting);
  pseudo("intAck", "Interrupt acknowledge", info.timeIntAck + info.timeNmiAck);
  pseudo("dma", "DMA bus hold (Next)", info.timeDma);
  pseudo("snooze", "Snooze (Z88)", info.timeSnooze);
  return { rows, denominator, total, waiting, frames };
}

/** One instruction start: the Addresses tab's raw, Fuse-like view (D3) */
export type AddressRow = {
  offset: number;
  partition?: number;
  /** The CPU address on a fixed map; the address inside its partition otherwise */
  address: number;
  routine: Routine;
  /** Bytes from the routine's entry, when the entry is in the same partition */
  routineOffset?: number;
  exec: number;
  time: number;
  pct: number;
  /** A HALT waited here (D4) */
  halt: boolean;
};

/** Every instruction start that ran, by time */
export function rollupAddresses(
  bytes: readonly ProfileTouchedByte[],
  map: RoutineMap,
  layout: ProfileLayout,
  denominator: number,
  options: { hideWaiting?: boolean } = {}
): AddressRow[] {
  const hideWaiting = options.hideWaiting ?? true;
  const rows: AddressRow[] = [];
  for (const b of bytes) {
    if ((b.flags & PF_EXECUTED) === 0) continue;
    const halt = (b.flags & PF_HALT) !== 0;
    if (halt && hideWaiting) continue;
    const location = profileLocationOf(layout, b.offset);
    const routine = map.routineAt(b.offset);
    const address = location?.address ?? b.offset;
    const time = b.time ?? 0;
    rows.push({
      offset: b.offset,
      partition: location?.partition,
      address,
      routine,
      routineOffset:
        routine.entryOffset !== undefined && b.offset >= routine.entryOffset ? b.offset - routine.entryOffset : undefined,
      exec: b.exec ?? 0,
      time,
      pct: denominator ? (100 * time) / denominator : 0,
      halt
    });
  }
  rows.sort((x, y) => y.time - x.time || x.offset - y.offset);
  return rows;
}

// ------------------------------------------------------------------------------------------------
// The call graph (G5.4: D9-D12)

export type CallNodeKind = "root" | "interrupt" | "routine" | "other";

/** A routine (or a root) in the call graph, with the time of the calls that reached it */
export type CallNode = {
  /** The routine's key, or a root's */
  key: string;
  name: string;
  kind: CallNodeKind;
  routine?: Routine;
  calls: number;
  inclusive: number;
  exclusive: number;
  /** Activations open when the profile was read: their time so far is included */
  open: number;
  /** A routine already on the path to this node (recursion): it is not expanded again */
  recursive?: boolean;
};

/** A caller of a routine: the Callers tab's bottom-up row (D14, as in VICE's `func`) */
export type CallerRow = CallNode;

export type CallGraph = {
  /** "(entered before profiling)", each interrupt root (D11), and "(other)" when the table filled */
  roots: CallNode[];
  /** The routines a node called, with the time of those calls; recursion along `path` is cut */
  childrenOf(node: CallNode, path?: ReadonlySet<string>): CallNode[];
  /** Who called a routine (bottom-up) */
  callersOf(key: string): CallerRow[];
  /** Per routine: every call into it, summed */
  totals: Map<string, CallNode>;
};

/** The name of the root that collects what ran outside every tracked call (T5) */
export const ROOT_NODE_NAME = "(entered before profiling)";

/** An interrupt root's name (D11): "IM 1 handler at $0038", "IM 2 -> $8282 (Handler)", "NMI at $0066" */
export function interruptRootName(kind: ProfileEdgeKind, address: number, routineName?: string): string {
  const at = `$${hex4(address)}`;
  const named = routineName && !routineName.startsWith("$") ? ` (${routineName})` : "";
  if (kind === "nmi") return `NMI at ${at}${named}`;
  if (kind === "im2") return `IM 2 → ${at}${named}`;
  return `IM 1 handler at ${at}${named}`;
}

/**
 * Builds the call graph from the core's edges (D12): an edge's caller and callee offsets map to
 * routines, and edges between the same two routines merge. Interrupts are roots of their own (D11).
 * The "(entered before profiling)" root holds the time outside every tracked call (T5): the total
 * less the interrupts', its own exclusive time less the calls it made.
 */
export function buildCallGraph(
  edges: readonly ProfileEdge[],
  map: RoutineMap,
  info: Pick<ProfileInfo, "timeTotal">
): CallGraph {
  const unmapped = new Map<number, Routine>();
  const routineOf = (key: number): Routine => {
    if ((key & PROFILE_KEY_UNMAPPED) !== 0 && !isProfileRootKey(key)) {
      const address = key & 0xffff;
      let r = unmapped.get(address);
      if (!r) {
        r = { key: `unmapped:${address}`, name: `$${hex4(address)} (unmapped)`, source: "blocks", entry: address, end: address + 1 };
        unmapped.set(address, r);
      }
      return r;
    }
    return map.routineAt(key);
  };

  type Agg = { caller: string; node: CallNode };
  const byPair = new Map<string, Agg>();
  const rootNodes = new Map<string, CallNode>();
  const rootNode: CallNode = { key: "$root", name: ROOT_NODE_NAME, kind: "root", calls: 0, inclusive: 0, exclusive: 0, open: 0 };

  for (const e of edges) {
    let callerKey: string;
    if (e.caller === PROFILE_KEY_ROOT) {
      callerKey = rootNode.key;
    } else if (e.caller === PROFILE_KEY_INT || e.caller === PROFILE_KEY_NMI) {
      // --- An interrupt root per handler and kind (D11)
      const handler = routineOf(e.callee);
      const key = `$int:${e.kind}:${handler.key}`;
      let root = rootNodes.get(key);
      if (!root) {
        root = {
          key,
          name: interruptRootName(e.kind, e.calleeAddress, handler.name),
          kind: "interrupt",
          routine: handler,
          calls: 0,
          inclusive: 0,
          exclusive: 0,
          open: 0
        };
        rootNodes.set(key, root);
      }
      root.calls += e.calls;
      root.inclusive += e.inclusive;
      root.exclusive += e.exclusive;
      root.open += e.open ?? 0;
      continue;
    } else if (e.caller === PROFILE_KEY_OTHER) {
      const key = "$other";
      let root = rootNodes.get(key);
      if (!root) {
        root = { key, name: "(other: the edge table was full)", kind: "other", calls: 0, inclusive: 0, exclusive: 0, open: 0 };
        rootNodes.set(key, root);
      }
      root.calls += e.calls;
      root.inclusive += e.inclusive;
      root.exclusive += e.exclusive;
      continue;
    } else {
      callerKey = routineOf(e.caller).key;
    }
    const callee = routineOf(e.callee);
    const pair = `${callerKey}->${callee.key}`;
    let agg = byPair.get(pair);
    if (!agg) {
      agg = {
        caller: callerKey,
        node: { key: callee.key, name: callee.name, kind: "routine", routine: callee, calls: 0, inclusive: 0, exclusive: 0, open: 0 }
      };
      byPair.set(pair, agg);
    }
    agg.node.calls += e.calls;
    agg.node.inclusive += e.inclusive;
    agg.node.exclusive += e.exclusive;
    agg.node.open += e.open ?? 0;
  }

  // --- Children and callers, by routine
  const children = new Map<string, CallNode[]>();
  const callers = new Map<string, CallNode[]>();
  const totals = new Map<string, CallNode>();
  for (const { caller, node } of byPair.values()) {
    let list = children.get(caller);
    if (!list) children.set(caller, (list = []));
    list.push(node);
    let total = totals.get(node.key);
    if (!total) totals.set(node.key, (total = { ...node, calls: 0, inclusive: 0, exclusive: 0, open: 0 }));
    total.calls += node.calls;
    total.inclusive += node.inclusive;
    total.exclusive += node.exclusive;
    total.open += node.open;
  }
  for (const root of rootNodes.values()) {
    if (root.kind === "interrupt" && root.routine) {
      // --- The handler's totals include the interrupts that ran it
      let total = totals.get(root.routine.key);
      if (!total) {
        totals.set(root.routine.key, (total = { ...root, key: root.routine.key, name: root.routine.name, kind: "routine", calls: 0, inclusive: 0, exclusive: 0, open: 0 }));
      }
      total.calls += root.calls;
      total.inclusive += root.inclusive;
      total.exclusive += root.exclusive;
    }
  }
  for (const [caller, list] of children) {
    list.sort((a, b) => b.inclusive - a.inclusive || a.name.localeCompare(b.name));
    for (const node of list) {
      let into = callers.get(node.key);
      if (!into) callers.set(node.key, (into = []));
      const callerNode =
        caller === rootNode.key
          ? rootNode
          : (totals.get(caller) ?? { key: caller, name: caller, kind: "routine" as const, calls: 0, inclusive: 0, exclusive: 0, open: 0 });
      into.push({ ...callerNode, kind: callerNode.kind, calls: node.calls, inclusive: node.inclusive, exclusive: node.exclusive, open: node.open });
    }
  }
  for (const root of rootNodes.values()) {
    if (root.kind !== "interrupt" || !root.routine) continue;
    let into = callers.get(root.routine.key);
    if (!into) callers.set(root.routine.key, (into = []));
    into.push({ ...root });
  }
  for (const list of callers.values()) list.sort((a, b) => b.inclusive - a.inclusive || a.name.localeCompare(b.name));

  // --- The root: the total less the interrupts', and its own time less the calls it made
  const interruptTime = [...rootNodes.values()].filter((r) => r.kind === "interrupt").reduce((t, r) => t + r.inclusive, 0);
  rootNode.inclusive = Math.max(0, info.timeTotal - interruptTime);
  const rootCalls = children.get(rootNode.key) ?? [];
  rootNode.calls = rootCalls.reduce((n, c) => n + c.calls, 0);
  rootNode.exclusive = Math.max(0, rootNode.inclusive - rootCalls.reduce((t, c) => t + c.inclusive, 0));

  const roots = [rootNode, ...[...rootNodes.values()].sort((a, b) => b.inclusive - a.inclusive)];

  return {
    roots,
    totals,
    childrenOf(node: CallNode, path: ReadonlySet<string> = new Set()): CallNode[] {
      if (node.recursive) return [];
      // --- An interrupt root's children are its handler's calls
      const from = node.kind === "interrupt" && node.routine ? node.routine.key : node.key;
      const list = children.get(from) ?? [];
      return list.map((c) => (path.has(c.key) || c.key === from ? { ...c, recursive: true } : c));
    },
    callersOf(key: string): CallerRow[] {
      return callers.get(key) ?? [];
    }
  };
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
