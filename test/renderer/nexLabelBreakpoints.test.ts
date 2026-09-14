import { describe, it, expect } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import {
  patchForResolution,
  resolveLabelBreakpoint,
  resolveLabelBreakpointsFor
} from "@renderer/appIde/DocumentPanels/Next/nexLabelBreakpoints";

/*
 * Resolving a label-anchored breakpoint against a sidecar's label table.
 *
 * A global label's value is a 16-bit address; a local label's is bank-relative. So the two resolve
 * to different *shapes* of breakpoint, which is the rule §13.2 settled on.
 */

const SIDECAR = "Game.nex.dis";

const annotations: NexFileAnnotations = {
  schemaVersion: 2,
  globalLabels: [
    { name: "Start", value: 0x8000 },
    { name: "Shared", value: 0x4321 }
  ],
  banks: {
    "5": {
      offsetIndex: 1,
      regions: [],
      localLabels: [
        { name: "DrawSprite", value: 0x0100 },
        { name: "Shared", value: 0x0200 }
      ]
    },
    "6": { offsetIndex: 3, regions: [], localLabels: [{ name: "DrawSprite", value: 0x0abc }] }
  }
} as any;

const localBp = (over: Partial<BreakpointInfo> = {}): BreakpointInfo => ({
  label: "DrawSprite",
  labelFile: SIDECAR,
  bank: 5,
  exec: true,
  ...over
});

const globalBp = (over: Partial<BreakpointInfo> = {}): BreakpointInfo => ({
  label: "Start",
  labelFile: SIDECAR,
  exec: true,
  ...over
});

describe("resolveLabelBreakpoint", () => {
  it("resolves a local label to a place in its bank", () => {
    expect(resolveLabelBreakpoint(localBp(), annotations)).toEqual({
      kind: "bank",
      bank: 5,
      bankOffset: 0x0100
    });
  });

  it("resolves a global label to an address", () => {
    expect(resolveLabelBreakpoint(globalBp(), annotations)).toEqual({
      kind: "address",
      address: 0x8000
    });
  });

  it("looks only in the scope the breakpoint names", () => {
    /*
     * `Shared` exists as both a global label ($4321) and a local one in bank 5 ($0200). Searching
     * both and preferring one would make the two breakpoints the same whenever only one label
     * existed, then silently different once the other was added.
     */
    expect(resolveLabelBreakpoint(localBp({ label: "Shared" }), annotations)).toEqual({
      kind: "bank",
      bank: 5,
      bankOffset: 0x0200
    });
    expect(resolveLabelBreakpoint(globalBp({ label: "Shared" }), annotations)).toEqual({
      kind: "address",
      address: 0x4321
    });
  });

  it("resolves the same name in different banks to different places", () => {
    expect(resolveLabelBreakpoint(localBp({ bank: 6 }), annotations)).toEqual({
      kind: "bank",
      bank: 6,
      bankOffset: 0x0abc
    });
  });

  it("is unresolved for a label that is not there", () => {
    // --- Not an error and not a reason to delete it: a label can be renamed, or the sidecar may
    // --- not have loaded yet. It waits, as a source breakpoint does before its list file.
    expect(resolveLabelBreakpoint(localBp({ label: "Missing" }), annotations)).toEqual({
      kind: "unresolved"
    });
    expect(resolveLabelBreakpoint(globalBp({ label: "Missing" }), annotations)).toEqual({
      kind: "unresolved"
    });
  });

  it("is unresolved for a bank the sidecar says nothing about", () => {
    expect(resolveLabelBreakpoint(localBp({ bank: 7 }), annotations)).toEqual({
      kind: "unresolved"
    });
  });

  it("is unresolved without annotations", () => {
    expect(resolveLabelBreakpoint(localBp(), undefined)).toEqual({ kind: "unresolved" });
  });

  it("resolves bank 0 and offset 0, which are both falsy", () => {
    const withBank0: NexFileAnnotations = {
      schemaVersion: 2,
      banks: { "0": { offsetIndex: 0, regions: [], localLabels: [{ name: "Top", value: 0 }] } }
    } as any;
    expect(resolveLabelBreakpoint({ label: "Top", labelFile: SIDECAR, bank: 0 }, withBank0)).toEqual(
      { kind: "bank", bank: 0, bankOffset: 0 }
    );
  });
});

describe("patchForResolution", () => {
  it("patches only the resolved fields", () => {
    // --- The stated fields are the breakpoint's identity; resolution must never touch them.
    expect(patchForResolution({ kind: "bank", bank: 5, bankOffset: 0x100 })).toEqual({
      resolvedBank: 5,
      resolvedBankOffset: 0x100
    });
    expect(patchForResolution({ kind: "address", address: 0x8000 })).toEqual({
      resolvedAddress: 0x8000
    });
  });

  it("has no patch for an unresolved label", () => {
    expect(patchForResolution({ kind: "unresolved" })).toEqual(undefined);
  });
});

describe("resolveLabelBreakpointsFor", () => {
  it("resolves this sidecar's label breakpoints", () => {
    const [resolved] = resolveLabelBreakpointsFor([localBp()], SIDECAR, annotations);
    expect(resolved).toMatchObject({ resolvedBank: 5, resolvedBankOffset: 0x0100 });
  });

  it("leaves another sidecar's alone", () => {
    // --- `labelFile` is part of identity; another file's labels are a different table that happens
    // --- to share names.
    const other = localBp({ labelFile: "Other.nex.dis" });
    const [result] = resolveLabelBreakpointsFor([other], SIDECAR, annotations);
    expect(result).toBe(other);
  });

  it("passes every other shape through untouched", () => {
    /*
     * This is a read-modify-write of the whole set, so anything not copied through would be
     * deleted — the same hazard `resetBreakpointsTo` is scoped for.
     */
    const address: BreakpointInfo = { address: 0x8000, exec: true };
    const bankRelative: BreakpointInfo = { bank: 5, bankOffset: 0x10, exec: true };
    const source: BreakpointInfo = { resource: "a.asm", line: 3, exec: true };
    const result = resolveLabelBreakpointsFor(
      [address, bankRelative, source],
      SIDECAR,
      annotations
    );
    expect(result).toEqual([address, bankRelative, source]);
  });

  it("clears a stale resolution when the label is gone", () => {
    /*
     * A label renamed away must stop firing where it used to be. Keeping the old `resolved*` would
     * leave a breakpoint armed at a place nothing points at any more — the same phantom
     * `resetBreakpointResolution` prevents for source breakpoints.
     */
    const stale = localBp({ label: "Missing", resolvedBank: 5, resolvedBankOffset: 0x0100 });
    const [result] = resolveLabelBreakpointsFor([stale], SIDECAR, annotations);
    expect(result.resolvedBank).toEqual(undefined);
    expect(result.resolvedBankOffset).toEqual(undefined);
  });

  it("clears a stale address when a global label is gone", () => {
    const stale = globalBp({ label: "Missing", resolvedAddress: 0x8000 });
    const [result] = resolveLabelBreakpointsFor([stale], SIDECAR, annotations);
    expect(result.resolvedAddress).toEqual(undefined);
  });

  it("re-resolves to the label's new place", () => {
    const moved: NexFileAnnotations = {
      schemaVersion: 2,
      banks: {
        "5": { offsetIndex: 1, regions: [], localLabels: [{ name: "DrawSprite", value: 0x0180 }] }
      }
    } as any;
    const previously = localBp({ resolvedBank: 5, resolvedBankOffset: 0x0100 });
    const [result] = resolveLabelBreakpointsFor([previously], SIDECAR, moved);
    expect(result.resolvedBankOffset).toEqual(0x0180);
  });

  it("changes shape when a label moves between scopes", () => {
    // --- A breakpoint that resolved to an address must not keep it once its label is only local.
    const wasGlobal = globalBp({ label: "Shared", resolvedAddress: 0x4321 });
    const localOnly: NexFileAnnotations = {
      schemaVersion: 2,
      banks: { "5": { offsetIndex: 1, regions: [], localLabels: [{ name: "Shared", value: 1 }] } }
    } as any;
    const [result] = resolveLabelBreakpointsFor([wasGlobal], SIDECAR, localOnly);
    expect(result.resolvedAddress).toEqual(undefined);
    expect(result.resolvedBank).toEqual(undefined);
  });
});
