import { describe, expect, it } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { DebugSupport } from "@emu/machines/DebugSupport";
import { getBreakpointDisplayKey, getBreakpointStorageKey } from "@common/utils/breakpoints";
import {
  breakpointMatchesScope,
  isAnnotationBreakpoint,
  ownerForScope,
  withScopeOwner
} from "@common/utils/breakpoint-scope";
import {
  breakpointFiltersOf,
  isLogpoint,
  readStoredBreakpointFilters,
  sameBreakpointFilters,
  withoutBreakpointRuntimeState
} from "@common/utils/breakpoint-filters";
import {
  fromSidecarBreakpoints,
  sameSidecarBreakpoints,
  toSidecarBreakpoints
} from "@renderer/appIde/DocumentPanels/Next/nexBreakpointSync";
import { logpointGroupsReducer } from "@common/state/watch-reducer";
import { setLogpointGroupsAction } from "@common/state/actions";

/*
 * The logpoint model (`.plans/LOGPOINTS_PLAN.md` Phase 1): `logMessage` / `logDialect` beside the
 * filters and out of the identity, the `annotation` owner and scope, the `LP:` key, the sidecar
 * round trip, and the group switch's reducer.
 */

describe("identity", () => {
  it("leaves the template out of the key, so bp-set turns a breakpoint into a logpoint and back", () => {
    const bp: BreakpointInfo = { address: 0x8000, exec: true };
    expect(getBreakpointStorageKey({ ...bp, logMessage: "x" })).toBe(getBreakpointStorageKey(bp));
    const ds = new DebugSupport();
    expect(ds.addBreakpoint({ ...bp, logMessage: "x={A}" })).toBe(true);
    expect(ds.addBreakpoint(bp)).toBe(false);
    expect(ds.breakpoints).toHaveLength(1);
    expect(isLogpoint(ds.breakpoints[0])).toBe(false);
  });

  it("keys a LOGPOINT comment by its source line and address, clear of a user breakpoint there", () => {
    const comment: BreakpointInfo = {
      owner: { kind: "annotation" },
      address: 0x8012,
      exec: true,
      resource: "main.asm",
      line: 7,
      logMessage: "${A}",
      logDialect: "dezog"
    };
    expect(getBreakpointStorageKey(comment)).toBe("LP:[main.asm]:7@$8012");
    expect(getBreakpointDisplayKey({ ...comment, partition: 5 }, { 5: "B5" })).toBe("LP:[main.asm]:7@B5:$8012");
    const user: BreakpointInfo = { resource: "main.asm", line: 7, exec: true };
    expect(getBreakpointStorageKey(user)).not.toBe(getBreakpointStorageKey(comment));

    const ds = new DebugSupport();
    ds.addBreakpoint(user);
    ds.addBreakpoint(comment);
    // --- One per macro expansion: same line, another address
    ds.addBreakpoint({ ...comment, address: 0x9012 });
    expect(ds.breakpoints).toHaveLength(3);
  });
});

describe("the annotation owner", () => {
  it("matches only its own scope, and is stamped by it", () => {
    const owner = { kind: "annotation" as const };
    expect(breakpointMatchesScope(owner, { kind: "annotation" })).toBe(true);
    expect(breakpointMatchesScope(owner, { kind: "project" })).toBe(false);
    expect(breakpointMatchesScope(undefined, { kind: "annotation" })).toBe(false);
    expect(breakpointMatchesScope(owner, { kind: "all" })).toBe(true);
    expect(ownerForScope({ kind: "annotation" }, undefined)).toEqual(owner);
    expect(isAnnotationBreakpoint(withScopeOwner({ address: 1 }, { kind: "annotation" }))).toBe(true);
  });

  it("is replaced as a set by its scope and left alone by every other", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x7000, exec: true });
    const comment = (address: number): BreakpointInfo => ({
      address,
      exec: true,
      resource: "a.asm",
      line: 1,
      logMessage: "x",
      logDialect: "dezog"
    });
    ds.resetBreakpointsTo([comment(0x8000), comment(0x8001)], { kind: "annotation" });
    expect(ds.breakpoints.filter(isAnnotationBreakpoint)).toHaveLength(2);
    ds.resetBreakpointsTo([], { kind: "project" });
    expect(ds.breakpoints.map((bp) => bp.address)).toEqual([0x8000, 0x8001]);
    ds.resetBreakpointsTo([comment(0x9000)], { kind: "annotation" });
    expect(ds.breakpoints.map((bp) => bp.address)).toEqual([0x9000]);
  });
});

describe("persisted fields", () => {
  it("stores the template and a non-default dialect with the filters", () => {
    expect(breakpointFiltersOf({ logMessage: "a", logDialect: "klive" })).toEqual({ logMessage: "a" });
    expect(breakpointFiltersOf({ logMessage: "a", logDialect: "dezog" })).toEqual({
      logMessage: "a",
      logDialect: "dezog"
    });
    expect(breakpointFiltersOf({ logMessage: "", logDialect: "dezog" })).toEqual({});
    expect(sameBreakpointFilters({ logMessage: "a" }, { logMessage: "b" })).toBe(false);
    expect(sameBreakpointFilters({ logMessage: "a", logDialect: "klive" }, { logMessage: "a" })).toBe(true);
  });

  it("strips the runtime-only logError", () => {
    expect(withoutBreakpointRuntimeState({ address: 1, logMessage: "x", logError: "e" })).toEqual({
      address: 1,
      logMessage: "x"
    });
  });

  it("reads stored template fields, dropping malformed ones with a message", () => {
    expect(readStoredBreakpointFilters({ logMessage: "x", logDialect: "dezog" })).toEqual({
      filters: { logMessage: "x", logDialect: "dezog" },
      problems: []
    });
    const bad = readStoredBreakpointFilters({ logMessage: 3, logDialect: "zesarux" });
    expect(bad.filters).toEqual({});
    expect(bad.problems).toHaveLength(2);
  });

  it("round-trips a logpoint through a .nex.dis sidecar", () => {
    const sidecar = "/p/Game.nex.dis";
    const bp: BreakpointInfo = {
      bank: 5,
      bankOffset: 0x100,
      exec: true,
      owner: { kind: "nex", sidecar },
      logMessage: "[S] {A}"
    };
    const stored = toSidecarBreakpoints([bp], sidecar);
    expect(stored[0]).toMatchObject({ logMessage: "[S] {A}" });
    const restored = fromSidecarBreakpoints(stored, sidecar);
    expect(restored[0].logMessage).toBe("[S] {A}");
    expect(sameSidecarBreakpoints(stored, toSidecarBreakpoints([{ ...bp, logMessage: "other" }], sidecar))).toBe(
      false
    );
  });
});

describe("the group switch reducer", () => {
  const reduce = (value: unknown) => logpointGroupsReducer({ enabled: true }, setLogpointGroupsAction(value));
  it("normalises names and defaults to everything on", () => {
    expect(reduce(undefined)).toEqual({ enabled: true });
    expect(reduce({ enabled: false, groups: ["a"] })).toEqual({ enabled: false });
    expect(reduce({ enabled: true, groups: ["loop", "A", "LOOP"] })).toEqual({
      enabled: true,
      groups: ["A", "LOOP"]
    });
  });
});
