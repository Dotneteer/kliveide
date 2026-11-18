import type { DisassemblyItem } from "../disassemblers/common-types";

/*
 * The Disassembly view's flow gutter (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §6.1, D4): arrows
 * between `JR`, `JP` and `DJNZ` and their targets, in up to eight lanes, shortest innermost. A jump
 * longer than about a screen of rows becomes a stub at each end; a target outside the listing a
 * stub pointing up or down; a jump that finds no free lane, stubs too. `CALL` and `RST` keep the
 * verdict hook.
 *
 * Computed once per listing, in the same pass as the listing (risk "Performance"), and drawn row by
 * row: each row carries the pieces of the lanes that cross it, so the virtualised list and the
 * taller synopsis rows need nothing positioned over them.
 */

/** Lanes the gutter has room for */
export const FLOW_LANES = 8;
/** A jump over more rows than this is drawn as two stubs */
export const FLOW_MAX_SPAN = 48;

export type FlowEdge = {
  id: number;
  /** The jump's row */
  from: number;
  /** The target's row, or undefined when it is outside the listing */
  to?: number;
  /** The target is above the source */
  up: boolean;
  conditional: boolean;
  /** The lane, 0 innermost; undefined for an edge drawn as stubs */
  lane?: number;
};

/** One row's piece of an edge */
export type FlowPiece = {
  edge: number;
  lane: number;
  kind:
    | "pass" // --- the lane runs through the row
    | "source" // --- the jump leaves this row
    | "target" // --- the jump arrives at this row
    | "stubOut" // --- a jump drawn as a stub, at its source
    | "stubIn"; // --- the same, at its target
  /** For a source or target: the lane continues downwards from this row (else upwards) */
  down: boolean;
  conditional: boolean;
};

export type FlowLayout = {
  edges: FlowEdge[];
  /** The pieces each row draws, by row index; rows without any are absent */
  rows: Map<number, FlowPiece[]>;
};

const FLOW_KINDS = new Set(["jr", "jp", "djnz"]);

/**
 * Lay out the listing's jumps.
 * @param items The listing's rows (a synopsis row has no address and no branch)
 */
export function layoutFlow(items: readonly DisassemblyItem[]): FlowLayout {
  // --- The first row of each address: a target is an instruction, not a synopsis line above it
  const rowOf = new Map<number, number>();
  items.forEach((item, index) => {
    if (item.prefixComment !== undefined) return;
    if (!rowOf.has(item.address)) rowOf.set(item.address, index);
  });

  const edges: FlowEdge[] = [];
  items.forEach((item, from) => {
    const branch = item.branch;
    if (!branch || !FLOW_KINDS.has(branch.kind) || branch.target === undefined) return;
    const to = rowOf.get(branch.target);
    edges.push({
      id: edges.length,
      from,
      to,
      up: to !== undefined ? to < from : branch.target < item.address,
      conditional: !!branch.condition || branch.kind === "djnz"
    });
  });

  // --- Shortest first, each in the lowest lane free over its whole span
  const laned = edges
    .filter((e) => e.to !== undefined && Math.abs(e.to - e.from) <= FLOW_MAX_SPAN && e.to !== e.from)
    .sort((a, b) => Math.abs(a.to! - a.from) - Math.abs(b.to! - b.from) || a.from - b.from);
  const busy: { lo: number; hi: number }[][] = Array.from({ length: FLOW_LANES }, () => []);
  for (const edge of laned) {
    const lo = Math.min(edge.from, edge.to!);
    const hi = Math.max(edge.from, edge.to!);
    for (let lane = 0; lane < FLOW_LANES; lane++) {
      if (busy[lane].every((span) => hi < span.lo || lo > span.hi)) {
        busy[lane].push({ lo, hi });
        edge.lane = lane;
        break;
      }
    }
  }

  const rows = new Map<number, FlowPiece[]>();
  const add = (row: number, piece: FlowPiece) => {
    const list = rows.get(row);
    if (list) list.push(piece);
    else rows.set(row, [piece]);
  };
  for (const edge of edges) {
    if (edge.lane !== undefined && edge.to !== undefined) {
      const lo = Math.min(edge.from, edge.to);
      const hi = Math.max(edge.from, edge.to);
      add(edge.from, { edge: edge.id, lane: edge.lane, kind: "source", down: !edge.up, conditional: edge.conditional });
      add(edge.to, { edge: edge.id, lane: edge.lane, kind: "target", down: edge.up, conditional: edge.conditional });
      for (let row = lo + 1; row < hi; row++) {
        add(row, { edge: edge.id, lane: edge.lane, kind: "pass", down: true, conditional: edge.conditional });
      }
    } else {
      // --- Too long, no free lane, or a target outside the listing: a stub at each end there is
      add(edge.from, { edge: edge.id, lane: 0, kind: "stubOut", down: !edge.up, conditional: edge.conditional });
      if (edge.to !== undefined) {
        add(edge.to, { edge: edge.id, lane: 0, kind: "stubIn", down: edge.up, conditional: edge.conditional });
      }
    }
  }
  return { edges, rows };
}

/** The edges that leave or arrive at a row (the selected row's jumps are highlighted) */
export function edgesAt(layout: FlowLayout, row: number): Set<number> {
  const result = new Set<number>();
  for (const piece of layout.rows.get(row) ?? []) {
    if (piece.kind !== "pass") result.add(piece.edge);
  }
  return result;
}
