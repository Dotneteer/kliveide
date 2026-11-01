import { isProfileRootKey, type ProfileEdge } from "@common/profile/profileTypes";
import type { RomPageProfile } from "../preprocess/analyse";

/*
 * A machine's profile run turned into one ROM page's profile (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`
 * §4.2, P3): the page's slice of the core's flag buffer, and the call edges whose callee is in the
 * page, both in page offsets. Where the page lies in the buffer is the core's profile layout
 * (`src/common/profile/layouts/`), which the recipe names; this module only cuts.
 */

/** Where a ROM page lies in a core's profile buffer. */
export type ProfileSlice = { start: number; size: number };

/** One ROM page's profile from a whole run. */
export function romPageProfileOf(
  flags: Uint8Array,
  edges: readonly ProfileEdge[],
  slice: ProfileSlice,
  page: number,
  recipe?: string
): RomPageProfile {
  const inside = (offset: number) => offset >= slice.start && offset < slice.start + slice.size;
  const pageEdges = new Map<string, { caller: number; callee: number; calls: number; kind: string }>();
  for (const edge of edges) {
    if (isProfileRootKey(edge.callee) || !inside(edge.callee)) continue;
    const caller = !isProfileRootKey(edge.caller) && inside(edge.caller) ? edge.caller - slice.start : -1;
    const callee = edge.callee - slice.start;
    const key = `${caller}:${callee}:${edge.kind}`;
    const seen = pageEdges.get(key);
    pageEdges.set(key, { caller, callee, kind: edge.kind, calls: (seen?.calls ?? 0) + edge.calls });
  }
  return {
    page,
    flags: Array.from(flags.subarray(slice.start, slice.start + slice.size)),
    edges: [...pageEdges.values()].sort((a, b) => a.callee - b.callee || a.caller - b.caller),
    ...(recipe ? { recipe } : {})
  };
}
