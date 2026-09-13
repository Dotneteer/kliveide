import { describe, it, expect } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  breakpointPartition,
  buildBreakpointMap,
  buildPartitionIndexByLabel,
  resolveMem64kPartitions,
  resolveRowPartition,
  selectRowBreakpoint
} from "@renderer/appIde/DocumentPanels/breakpointRowMatch";

// --- A 128K-shaped label map: ROMs at -1/-2, banks 0..7.
const LABELS: Record<number, string> = {
  [-1]: "R0",
  [-2]: "R1",
  0: "B0",
  1: "B1",
  2: "B2",
  3: "B3",
  4: "B4",
  5: "B5",
  6: "B6",
  7: "B7"
};

describe("buildBreakpointMap", () => {
  it("keeps every breakpoint at a shared address", () => {
    // --- Arrange
    const b3: BreakpointInfo = { address: 0x8000, partition: 3, exec: true };
    const b5: BreakpointInfo = { address: 0x8000, partition: 5, exec: true };

    // --- Act
    const map = buildBreakpointMap([b3, b5]);

    // --- Assert: the old Map<number, BreakpointInfo> could only hold one of these
    expect(map.get(0x8000)).toEqual([b3, b5]);
  });

  it("indexes a source breakpoint under its resolved address", () => {
    // --- Arrange
    const bp: BreakpointInfo = { resource: "main.asm", line: 12, resolvedAddress: 0x8010, exec: true };

    // --- Act
    const map = buildBreakpointMap([bp]);

    // --- Assert
    expect(map.get(0x8010)).toEqual([bp]);
  });

  it("indexes a breakpoint carrying both addresses under both", () => {
    // --- Arrange
    const bp: BreakpointInfo = { address: 0x8000, resolvedAddress: 0x9000, exec: true };

    // --- Act
    const map = buildBreakpointMap([bp]);

    // --- Assert
    expect(map.get(0x8000)).toEqual([bp]);
    expect(map.get(0x9000)).toEqual([bp]);
  });

  it("ignores a breakpoint with no address at all", () => {
    // --- Act
    const map = buildBreakpointMap([{ resource: "main.asm", line: 12, exec: true }]);

    // --- Assert
    expect(map.size).toEqual(0);
  });
});

describe("breakpointPartition", () => {
  it("prefers an explicit partition, falls back to the resolved one", () => {
    expect(breakpointPartition({ address: 1, partition: 3 })).toEqual(3);
    expect(breakpointPartition({ address: 1, resolvedPartition: 4 })).toEqual(4);
    expect(breakpointPartition({ address: 1 })).toEqual(undefined);
  });

  it("treats partition 0 as a partition", () => {
    // --- The truthiness trap that broke bank 0 in DebugSupport; do not repeat it here.
    expect(breakpointPartition({ address: 1, partition: 0 })).toEqual(0);
  });
});

describe("buildPartitionIndexByLabel", () => {
  it("inverts the machine's label map, negatives included", () => {
    const byLabel = buildPartitionIndexByLabel(LABELS);
    expect(byLabel.get("B3")).toEqual(3);
    expect(byLabel.get("B0")).toEqual(0);
    expect(byLabel.get("R1")).toEqual(-2);
  });

  it("has no entry for an unpaged label", () => {
    // --- `UNPAGED_PARTITION_LABEL` is deliberately absent from the map, so it inverts to nothing.
    expect(buildPartitionIndexByLabel(LABELS).get("UN")).toEqual(undefined);
  });

  it("survives a missing map", () => {
    expect(buildPartitionIndexByLabel(undefined).size).toEqual(0);
  });
});

describe("resolveRowPartition", () => {
  const mem64kPartitions = resolveMem64kPartitions(
    // --- 8 pages of 8K: ROM 0, ROM 0, B5, B5, B2, B2, B0, unpaged
    ["R0", "R0", "B5", "B5", "B2", "B2", "B0", "UN"],
    buildPartitionIndexByLabel(LABELS)
  );

  it("uses the selected partition in a bank view", () => {
    expect(resolveRowPartition(0x0000, false, 3, mem64kPartitions)).toEqual(3);
    expect(resolveRowPartition(0x3fff, false, 3, mem64kPartitions)).toEqual(3);
  });

  it("uses the live paging in the 64K view", () => {
    expect(resolveRowPartition(0x0000, true, undefined, mem64kPartitions)).toEqual(-1);
    expect(resolveRowPartition(0x4000, true, undefined, mem64kPartitions)).toEqual(5);
    expect(resolveRowPartition(0x8000, true, undefined, mem64kPartitions)).toEqual(2);
    expect(resolveRowPartition(0xc000, true, undefined, mem64kPartitions)).toEqual(0);
  });

  it("reports no partition for an unpaged page", () => {
    expect(resolveRowPartition(0xe000, true, undefined, mem64kPartitions)).toEqual(undefined);
  });
});

describe("selectRowBreakpoint", () => {
  it("shows a partition-scoped breakpoint only in its own partition", () => {
    // --- Arrange: this is the reported bug — a B3 breakpoint lighting up the B5 gutter
    const b3: BreakpointInfo = { address: 0x8000, partition: 3, exec: true };
    const candidates = buildBreakpointMap([b3]).get(0x8000);

    // --- Act/Assert
    expect(selectRowBreakpoint(candidates, 3)).toEqual(b3);
    expect(selectRowBreakpoint(candidates, 5)).toEqual(undefined);
    expect(selectRowBreakpoint(candidates, undefined)).toEqual(undefined);
  });

  it("picks the right one of two breakpoints sharing an address", () => {
    // --- Arrange
    const b3: BreakpointInfo = { address: 0x8000, partition: 3, exec: true };
    const b5: BreakpointInfo = { address: 0x8000, partition: 5, exec: true };
    const candidates = buildBreakpointMap([b3, b5]).get(0x8000);

    // --- Act/Assert
    expect(selectRowBreakpoint(candidates, 3)).toEqual(b3);
    expect(selectRowBreakpoint(candidates, 5)).toEqual(b5);
    expect(selectRowBreakpoint(candidates, 1)).toEqual(undefined);
  });

  it("shows a partitionless breakpoint in every partition", () => {
    // --- Arrange: unchanged behaviour, deliberately
    const any: BreakpointInfo = { address: 0x8000, exec: true };
    const candidates = buildBreakpointMap([any]).get(0x8000);

    // --- Act/Assert
    expect(selectRowBreakpoint(candidates, 3)).toEqual(any);
    expect(selectRowBreakpoint(candidates, 5)).toEqual(any);
    expect(selectRowBreakpoint(candidates, undefined)).toEqual(any);
  });

  it("prefers the partition-scoped breakpoint over a partitionless one at the same address", () => {
    // --- Arrange
    const any: BreakpointInfo = { address: 0x8000, exec: true };
    const b5: BreakpointInfo = { address: 0x8000, partition: 5, exec: true };
    const candidates = buildBreakpointMap([any, b5]).get(0x8000);

    // --- Act/Assert
    expect(selectRowBreakpoint(candidates, 5)).toEqual(b5);
    // --- …and falls back to the partitionless one elsewhere
    expect(selectRowBreakpoint(candidates, 3)).toEqual(any);
  });

  it("matches a breakpoint in partition 0", () => {
    // --- Arrange
    const b0: BreakpointInfo = { address: 0xc000, partition: 0, exec: true };
    const candidates = buildBreakpointMap([b0]).get(0xc000);

    // --- Act/Assert
    expect(selectRowBreakpoint(candidates, 0)).toEqual(b0);
    expect(selectRowBreakpoint(candidates, 1)).toEqual(undefined);
  });

  it("returns nothing for an address with no breakpoints", () => {
    expect(selectRowBreakpoint(undefined, 3)).toEqual(undefined);
    expect(selectRowBreakpoint([], 3)).toEqual(undefined);
  });
});
