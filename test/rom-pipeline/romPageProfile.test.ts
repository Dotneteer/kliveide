import { describe, expect, it } from "vitest";

import { PROFILE_KEY_ROOT, type ProfileEdge } from "@common/profile/profileTypes";
import { romPageProfileOf } from "@common/reverse/pipeline/profile/romPageProfile";

/*
 * Cutting a machine's profile run into one ROM page's profile (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`
 * P3): the page's slice of the flags, and its call edges in page offsets.
 */

const edge = (caller: number, callee: number, calls = 1, kind: ProfileEdge["kind"] = "call"): ProfileEdge =>
  ({ caller, callee, calleeAddress: 0, kind, calls }) as ProfileEdge;

describe("romPageProfileOf", () => {
  it("takes the page's slice of the flags", () => {
    const flags = new Uint8Array(0x10);
    flags[0x08] = 1;
    flags[0x0b] = 2;
    const profile = romPageProfileOf(flags, [], { start: 0x08, size: 4 }, 3, "a recipe");
    expect(profile).toEqual({ page: 3, flags: [1, 0, 0, 2], edges: [], recipe: "a recipe" });
  });

  it("keeps the edges into the page, in page offsets, with outside callers as -1, summed", () => {
    const slice = { start: 0x100, size: 0x100 };
    const profile = romPageProfileOf(
      new Uint8Array(0x300),
      [
        edge(0x110, 0x150, 2),
        edge(0x120, 0x150, 3),
        edge(0x250, 0x150, 1),
        edge(PROFILE_KEY_ROOT, 0x160, 4, "int"),
        edge(0x110, 0x250, 9),
        edge(0x110, 0x150, 5)
      ],
      slice,
      0
    );
    expect(profile.edges).toEqual([
      { caller: -1, callee: 0x50, kind: "call", calls: 1 },
      { caller: 0x10, callee: 0x50, kind: "call", calls: 7 },
      { caller: 0x20, callee: 0x50, kind: "call", calls: 3 },
      { caller: -1, callee: 0x60, kind: "int", calls: 4 }
    ]);
  });
});
