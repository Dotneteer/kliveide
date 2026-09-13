import { describe, expect, it } from "vitest";
import {
  createBranchCpuSnapshot,
  type BranchSnapshotSource
} from "@renderer/appIde/DocumentPanels/useDisassemblyRefresh";
import { evaluateBranch } from "@renderer/appIde/DocumentPanels/branchVerdict";
import type { DisassemblyBranchInfo } from "@renderer/appIde/disassemblers/common-types";

function source(overrides: Partial<BranchSnapshotSource> = {}): BranchSnapshotSource {
  return {
    memory: new Uint8Array(0x10000),
    pc: 0x8000,
    af: 0x1234,
    bc: 0x5678,
    hl: 0x9abc,
    ix: 0xdef0,
    iy: 0x1357,
    sp: 0x5bff,
    ...overrides
  };
}

describe("createBranchCpuSnapshot", () => {
  it("carries every register a branch verdict can depend on", () => {
    const snapshot = createBranchCpuSnapshot(source(), true);
    expect(snapshot).toMatchObject({
      af: 0x1234,
      bc: 0x5678,
      hl: 0x9abc,
      ix: 0xdef0,
      iy: 0x1357,
      sp: 0x5bff,
      pc: 0x8000
    });
  });

  it("offers a reader over the flat 64K image", () => {
    const memory = new Uint8Array(0x10000);
    memory[0x5bff] = 0x03;
    memory[0x5c00] = 0x13;
    const snapshot = createBranchCpuSnapshot(source({ memory }), true);
    expect(snapshot.readByte).toBeDefined();
    expect(snapshot.readByte!(0x5bff)).toBe(0x03);
    expect(snapshot.readByte!(0x5c00)).toBe(0x13);
  });

  it("offers no reader for a single partition, where an absolute address means nothing", () => {
    // --- A banked view hands over one bank indexed from zero. `memory[sp]` would be a real byte
    // --- from an unrelated place, which is worse than no answer.
    const snapshot = createBranchCpuSnapshot(source({ memory: new Uint8Array(0x4000) }), false);
    expect(snapshot.readByte).toBeUndefined();
  });

  it("returns undefined past the end of the image rather than reading out of bounds", () => {
    const snapshot = createBranchCpuSnapshot(source({ memory: new Uint8Array(0x100) }), true);
    expect(snapshot.readByte!(0xff)).toBe(0);
    expect(snapshot.readByte!(0x100)).toBeUndefined();
  });
});

describe("createBranchCpuSnapshot — end to end with evaluateBranch", () => {
  const RET_NZ: DisassemblyBranchInfo = {
    kind: "ret",
    condition: "nz",
    targetSource: "stack",
    tstatesTaken: 11,
    tstatesNotTaken: 5
  };

  /** A response whose flags clear Z (so `RET NZ` is taken) and whose stack holds $1303. */
  function readyToReturn(memory: Uint8Array) {
    memory[0x5bff] = 0x03;
    memory[0x5c00] = 0x13;
    return source({ memory, af: 0x0000, sp: 0x5bff });
  }

  it("resolves a return address from the 64K view", () => {
    const snapshot = createBranchCpuSnapshot(readyToReturn(new Uint8Array(0x10000)), true);
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, snapshot, true);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBe(0x1303);
  });

  it("reports the same return as unobtainable in a banked view", () => {
    // --- Same registers, same stack contents, different view: the honest outcome changes.
    const snapshot = createBranchCpuSnapshot(readyToReturn(new Uint8Array(0x10000)), false);
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, snapshot, true);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBeUndefined();
    expect(verdict.unobtainable).toBe("stack-unreadable");
  });

  it("feeds DJNZ from B, the high byte of BC", () => {
    const djnz: DisassemblyBranchInfo = {
      kind: "djnz",
      target: 0x0200,
      tstatesTaken: 13,
      tstatesNotTaken: 8
    };
    // --- BC = $01FF: B is 1, so the loop ends. Reading the low byte instead would say otherwise.
    const snapshot = createBranchCpuSnapshot(source({ bc: 0x01ff }), true);
    expect(evaluateBranch(djnz, 0x0210, 2, snapshot, true).taken).toBe(false);
  });

  it("feeds a flag condition from F, the low byte of AF", () => {
    const jrZ: DisassemblyBranchInfo = {
      kind: "jr",
      condition: "z",
      target: 0x0100,
      tstatesTaken: 12,
      tstatesNotTaken: 7
    };
    // --- AF = $4000 has A = $40 and F = $00: Z is clear, so `jr z` must not be taken.
    expect(
      evaluateBranch(jrZ, 0x0200, 2, createBranchCpuSnapshot(source({ af: 0x4000 }), true), true)
        .taken
    ).toBe(false);
    // --- AF = $0040 is the other way round.
    expect(
      evaluateBranch(jrZ, 0x0200, 2, createBranchCpuSnapshot(source({ af: 0x0040 }), true), true)
        .taken
    ).toBe(true);
  });
});
