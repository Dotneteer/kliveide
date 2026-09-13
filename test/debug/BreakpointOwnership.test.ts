import { describe, it, expect } from "vitest";
import { DebugSupport } from "@emu/machines/DebugSupport";
import type { BreakpointInfo, BreakpointScope } from "@abstractions/BreakpointInfo";
import {
  breakpointMatchesScope,
  ownerForScope,
  withScopeOwner
} from "@common/utils/breakpoint-scope";

const SIDECAR = "/projects/game/Game.nex.dis";
const OTHER_SIDECAR = "/projects/game/Other.nex.dis";

const NEX_SCOPE: BreakpointScope = { kind: "nex", sidecar: SIDECAR };
const PROJECT_SCOPE: BreakpointScope = { kind: "project" };
const ALL_SCOPE: BreakpointScope = { kind: "all" };

function keysOf(ds: DebugSupport): string[] {
  return ds.breakpoints
    .map((bp) => `${bp.address}:${bp.owner?.kind ?? "project"}:${bp.owner?.["sidecar"] ?? ""}`)
    .sort();
}

describe("breakpointMatchesScope", () => {
  it("treats an absent owner as the project — the only representation of project ownership", () => {
    // --- A truthiness or equality test on the owner object would exclude every breakpoint written
    // --- by a build that predates ownership.
    expect(breakpointMatchesScope(undefined, PROJECT_SCOPE)).toEqual(true);
  });

  it("does not let the project scope reach other owners", () => {
    expect(breakpointMatchesScope({ kind: "nex", sidecar: SIDECAR }, PROJECT_SCOPE)).toEqual(false);
    expect(breakpointMatchesScope({ kind: "session" }, PROJECT_SCOPE)).toEqual(false);
  });

  it("matches a nex scope only for the very same sidecar", () => {
    expect(breakpointMatchesScope({ kind: "nex", sidecar: SIDECAR }, NEX_SCOPE)).toEqual(true);
    expect(breakpointMatchesScope({ kind: "nex", sidecar: OTHER_SIDECAR }, NEX_SCOPE)).toEqual(
      false
    );
    expect(breakpointMatchesScope(undefined, NEX_SCOPE)).toEqual(false);
  });

  it("lets only the `all` scope reach session-owned breakpoints", () => {
    expect(breakpointMatchesScope({ kind: "session" }, ALL_SCOPE)).toEqual(true);
    expect(breakpointMatchesScope({ kind: "session" }, NEX_SCOPE)).toEqual(false);
  });

  it("matches everything under the `all` scope", () => {
    expect(breakpointMatchesScope(undefined, ALL_SCOPE)).toEqual(true);
    expect(breakpointMatchesScope({ kind: "nex", sidecar: SIDECAR }, ALL_SCOPE)).toEqual(true);
  });
});

describe("ownerForScope / withScopeOwner", () => {
  it("stamps project ownership as an absent owner, never an object", () => {
    expect(ownerForScope(PROJECT_SCOPE, { kind: "session" })).toEqual(undefined);
    const stamped = withScopeOwner({ address: 0x8000, owner: { kind: "session" } }, PROJECT_SCOPE);
    expect("owner" in stamped).toEqual(false);
  });

  it("stamps the sidecar for a nex scope", () => {
    const stamped = withScopeOwner({ address: 0x8000 }, NEX_SCOPE);
    expect(stamped.owner).toEqual({ kind: "nex", sidecar: SIDECAR });
  });

  it("keeps each breakpoint's own owner under the `all` scope", () => {
    // --- `all` replaces everything, but it is not an ownership claim.
    expect(withScopeOwner({ address: 1, owner: { kind: "session" } }, ALL_SCOPE).owner).toEqual({
      kind: "session"
    });
    expect("owner" in withScopeOwner({ address: 1 }, ALL_SCOPE)).toEqual(false);
  });

  it("does not mutate the breakpoint it is given", () => {
    // --- The caller's object may be a Redux value or a parsed project file.
    const original: BreakpointInfo = { address: 0x8000 };
    withScopeOwner(original, NEX_SCOPE);
    expect(original.owner).toEqual(undefined);
  });
});

describe("DebugSupport.resetBreakpointsTo scoping", () => {
  function seeded(): DebugSupport {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ address: 0x8001, exec: true, owner: { kind: "nex", sidecar: SIDECAR } });
    ds.addBreakpoint({
      address: 0x8002,
      exec: true,
      owner: { kind: "nex", sidecar: OTHER_SIDECAR }
    });
    ds.addBreakpoint({ address: 0x8003, exec: true, owner: { kind: "session" } });
    return ds;
  }

  it("addBreakpoint preserves the owner", () => {
    // --- `addBreakpoint` rebuilds the stored definition field by field, so an omitted `owner`
    // --- would make every breakpoint project-owned the moment it was registered.
    const ds = seeded();
    expect(keysOf(ds)).toEqual([
      `32768:project:`,
      `32769:nex:${SIDECAR}`,
      `32770:nex:${OTHER_SIDECAR}`,
      `32771:session:`
    ]);
  });

  /*
   * The regression this phase exists for: opening a project used to replace the *whole* breakpoint
   * set, destroying everything the project did not itself hold.
   */
  it("a project-scoped reset leaves nex- and session-owned breakpoints alone", () => {
    // --- Arrange
    const ds = seeded();

    // --- Act: what opening a project does
    ds.resetBreakpointsTo([{ address: 0x9000, exec: true }], PROJECT_SCOPE);

    // --- Assert: the project's own breakpoint was replaced; the other three survived
    expect(keysOf(ds)).toEqual([
      `32769:nex:${SIDECAR}`,
      `32770:nex:${OTHER_SIDECAR}`,
      `32771:session:`,
      `36864:project:`
    ]);
  });

  it("a nex-scoped reset touches only the named sidecar", () => {
    // --- Arrange
    const ds = seeded();

    // --- Act
    ds.resetBreakpointsTo([{ address: 0x9001, exec: true }], NEX_SCOPE);

    // --- Assert: the other sidecar, the project and the session are untouched
    expect(keysOf(ds)).toEqual([
      `32768:project:`,
      `32770:nex:${OTHER_SIDECAR}`,
      `32771:session:`,
      `36865:nex:${SIDECAR}`
    ]);
  });

  it("stamps the scope's owner onto the breakpoints it installs", () => {
    // --- Arrange/Act: the caller states no owner; the scope decides
    const ds = new DebugSupport();
    ds.resetBreakpointsTo([{ address: 0x9000, exec: true }], NEX_SCOPE);

    // --- Assert
    expect(ds.breakpoints[0].owner).toEqual({ kind: "nex", sidecar: SIDECAR });
  });

  it("overrides an owner that contradicts the installing scope", () => {
    // --- A breakpoint cannot be installed under one scope and owned by another.
    const ds = new DebugSupport();
    ds.resetBreakpointsTo(
      [{ address: 0x9000, exec: true, owner: { kind: "nex", sidecar: OTHER_SIDECAR } }],
      NEX_SCOPE
    );
    expect(ds.breakpoints[0].owner).toEqual({ kind: "nex", sidecar: SIDECAR });
  });

  it("the `all` scope clears everything, session included", () => {
    // --- Arrange
    const ds = seeded();

    // --- Act
    ds.resetBreakpointsTo([], ALL_SCOPE);

    // --- Assert
    expect(ds.breakpoints).toEqual([]);
  });

  it("the `all` scope keeps the owners it is handed", () => {
    // --- This is what makes `applyBreakpointEdit`'s read-modify-write ownership-preserving.
    const ds = new DebugSupport();
    ds.resetBreakpointsTo(
      [
        { address: 0x8000, exec: true },
        { address: 0x8001, exec: true, owner: { kind: "nex", sidecar: SIDECAR } }
      ],
      ALL_SCOPE
    );
    expect(keysOf(ds)).toEqual([`32768:project:`, `32769:nex:${SIDECAR}`]);
  });

  it("preserves the disabled state of both survivors and installed breakpoints", () => {
    // --- Arrange: one disabled breakpoint in each of two scopes
    const ds = new DebugSupport();
    const nexBp: BreakpointInfo = {
      address: 0x8001,
      exec: true,
      owner: { kind: "nex", sidecar: SIDECAR }
    };
    ds.addBreakpoint(nexBp);
    ds.enableBreakpoint(nexBp, false);

    // --- Act: a project-scoped reset installing a disabled project breakpoint
    ds.resetBreakpointsTo([{ address: 0x9000, exec: true, disabled: true }], PROJECT_SCOPE);

    // --- Assert: neither is armed, and `listBreakpoints` agrees with the emulator
    expect(ds.shouldStopAt(0x8001, () => undefined)).toEqual(false);
    expect(ds.shouldStopAt(0x9000, () => undefined)).toEqual(false);
    expect(ds.breakpoints.every((bp) => bp.disabled)).toEqual(true);
  });

  it("leaves surviving breakpoints armed and working", () => {
    // --- A survivor must come back as a functioning breakpoint, not just a definition.
    const ds = seeded();
    ds.resetBreakpointsTo([], PROJECT_SCOPE);
    expect(ds.shouldStopAt(0x8001, () => undefined)).toEqual(true);
    expect(ds.shouldStopAt(0x8000, () => undefined)).toEqual(false);
  });
});
