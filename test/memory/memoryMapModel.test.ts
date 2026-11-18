import { describe, it, expect } from "vitest";

import {
  nextPartitionInfo,
  partitionIndex,
  spectrumPartitionInfo,
  z88PartitionInfo
} from "@common/annotations/partitionInfo";
import { nextPartitionGroups, nextPartitionLabels } from "@emu/machines/zxNext/nextMachineInfo";
import { z88PartitionLabels } from "@emu/machines/z88/z88MachineInfo";
import {
  buildMapCells,
  cpuAddressOf,
  flagsText,
  matchesPartitionFilter,
  moveInBankMap,
  pagedSlotsOf,
  partitionAt,
  pushRecent,
  slotBadge
} from "@renderer/features/memoryMap/memoryMapModel";
import {
  parseGoToNumber,
  parseGoToTarget,
  partitionOfLabel,
  suggestLabels,
  type GoToContext
} from "@renderer/features/memoryMap/goToTarget";

const SP128 = spectrumPartitionInfo({
  labels: { [-2]: "R1", [-1]: "R0", 0: "B0", 1: "B1", 2: "B2", 3: "B3", 4: "B4", 5: "B5", 6: "B6", 7: "B7" }
});
const SP128_PAGING = [-2, -2, 5, 5, 2, 2, 0, 0];
const NEXT = nextPartitionInfo({ labels: nextPartitionLabels(), groups: nextPartitionGroups() });

describe("buildMapCells", () => {
  it("makes a 128K's 64K four 16K cells", () => {
    const cells = buildMapCells(SP128_PAGING, partitionIndex(SP128));
    expect(cells.map((c) => [c.start, c.end, c.name, c.kind])).toEqual([
      [0x0000, 0x3fff, "R1", "rom"],
      [0x4000, 0x7fff, "B5", "ram"],
      [0x8000, 0xbfff, "B2", "ram"],
      [0xc000, 0xffff, "B0", "ram"]
    ]);
  });

  it("keeps the Next's MMU pages apart and joins a ROM's halves", () => {
    const cells = buildMapCells([-1, -1, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01], partitionIndex(NEXT));
    expect(cells.map((c) => c.name)).toEqual(["R0", "0A", "0B", "04", "05", "00", "01"]);
    expect(cells[0].slots).toEqual([0, 1]);
  });

  it("falls back to ROM and RAM by flags without partitions", () => {
    const cells = buildMapCells(undefined, new Map(), [true, true, false, false, false, false, false, false]);
    expect(cells.map((c) => [c.start, c.kind])).toEqual([
      [0x0000, "rom"],
      [0x4000, "ram"],
      [0x8000, "ram"],
      [0xc000, "ram"]
    ]);
  });
});

describe("addresses and partitions", () => {
  const parts = partitionIndex(SP128);

  it("finds the partition and offset behind an address", () => {
    expect(partitionAt(SP128_PAGING, parts, 0x8008)).toEqual({ partition: 2, offset: 0x0008 });
    expect(partitionAt(SP128_PAGING, parts, 0xa000)).toEqual({ partition: 2, offset: 0x2000 });
  });

  it("finds where the CPU sees an offset", () => {
    expect(cpuAddressOf(SP128_PAGING, 2, 0x2008, 0x4000)).toBe(0xa008);
    expect(cpuAddressOf(SP128_PAGING, 7, 0, 0x4000)).toBeUndefined();
    expect(cpuAddressOf([-1, -1, 0x0a, 0x0b, 4, 5, 0, 1], 4, 8, 0x2000)).toBe(0x8008);
  });

  it("lists the slots a partition is paged into and labels them by paging unit", () => {
    const paged = pagedSlotsOf(SP128_PAGING);
    expect(paged.get(2)).toEqual([4, 5]);
    expect(slotBadge(paged.get(2)!, 0x4000)).toBe("2");
    expect(slotBadge([0, 1], 0x2000)).toBe("0·1");
  });
});

describe("pushRecent", () => {
  it("keeps the most recent first, unique and capped", () => {
    expect(pushRecent([3, 2, 1], 2)).toEqual([2, 3, 1]);
    expect(pushRecent([1, 2, 3, 4, 5], 6)).toEqual([6, 1, 2, 3, 4]);
  });
});

describe("matchesPartitionFilter", () => {
  const next = partitionIndex(NEXT);

  it("matches a label exactly when short, else by words", () => {
    expect(matchesPartitionFilter(next.get(0x47)!, "47")).toBe(true);
    expect(matchesPartitionFilter(next.get(0x46)!, "47")).toBe(false);
    expect(matchesPartitionFilter(next.get(-11)!, "m3")).toBe(true);
    expect(matchesPartitionFilter(next.get(-11)!, "divmmc")).toBe(true);
  });

  it("matches roles, kinds and slots", () => {
    expect(matchesPartitionFilter(next.get(0x0a)!, "screen", { roles: ["ulaScreen"], words: ["ULA screen"] })).toBe(true);
    expect(matchesPartitionFilter(next.get(-1)!, "rom")).toBe(true);
    expect(matchesPartitionFilter(next.get(4)!, "slot 4", { slots: [4] })).toBe(true);
    expect(matchesPartitionFilter(next.get(5)!, "slot 4", { slots: [5] })).toBe(false);
  });

  it("matches a Z88 bank's slot and kind", () => {
    const z88 = partitionIndex(
      z88PartitionInfo({ labels: z88PartitionLabels(), slots: [{ kind: "flash", sizeInBytes: 0x80000 }, { kind: "ram", sizeInBytes: 0x8000 }], internalRamBytes: 0x80000 })
    );
    expect(matchesPartitionFilter(z88.get(0x50)!, "mirror")).toBe(true);
    expect(matchesPartitionFilter(z88.get(0x50)!, "slot 1")).toBe(true);
    expect(matchesPartitionFilter(z88.get(0xc0)!, "empty")).toBe(true);
  });
});

describe("moveInBankMap", () => {
  it("walks the Next's grid by rows and columns and across blocks", () => {
    const layout = NEXT.layout;
    expect(moveInBankMap(layout, 0x00, "ArrowRight")).toBe(0x01);
    expect(moveInBankMap(layout, 0x03, "ArrowDown")).toBe(0x13);
    expect(moveInBankMap(layout, 0x13, "ArrowUp")).toBe(0x03);
    // --- From the RAM grid's first row up into the DivMMC row above it
    expect(moveInBankMap(layout, 0x00, "ArrowUp")).toBe(-8);
    expect(moveInBankMap(layout, undefined, "ArrowDown")).toBe(-1);
    expect(moveInBankMap(layout, 0x10, "End")).toBe(0xdf);
  });

  it("skips hidden cells", () => {
    const visible = (id: number) => id % 2 === 0;
    expect(moveInBankMap(NEXT.layout, 0x02, "ArrowRight", visible)).toBe(0x04);
  });
});

describe("flagsText", () => {
  it("writes set flags in upper case", () => {
    expect(flagsText(0b01000001)).toBe("sZ5h3pnC".replace("5", "5"));
    expect(flagsText(0xff)).toBe("SZ5H3PNC");
    expect(flagsText(0)).toBe("sz5h3pnc");
  });
});

describe("parseGoToTarget", () => {
  const ctx: GoToContext = {
    registers: { PC: 0x8008, HL: 0x5812, "HL'": 0x1234 },
    partitionLabels: { [-1]: "R0", [-2]: "R1", 2: "B2", 5: "B5" },
    partitionSize: () => 0x4000,
    slotPartitions: SP128_PAGING,
    labels: [
      { name: "main", address: 0x8000 },
      { name: "PRINT_A", address: 0x0010, partition: -1 },
      { name: "banked", address: 0xc010, partition: 7 }
    ]
  };

  it("reads numbers in every form", () => {
    expect(parseGoToNumber("8000")).toBe(0x8000);
    expect(parseGoToNumber("8000", true)).toBe(8000);
    expect(parseGoToNumber("$8000", true)).toBe(0x8000);
    expect(parseGoToNumber("0x10")).toBe(0x10);
    expect(parseGoToNumber("#10")).toBe(0x10);
    expect(parseGoToNumber("%101")).toBe(5);
    expect(parseGoToNumber("100d")).toBe(100);
    expect(parseGoToNumber("zz")).toBeUndefined();
  });

  it("goes to a number, a register and a label", () => {
    expect(parseGoToTarget("$4000", ctx)).toEqual({ target: { kind: "address", address: 0x4000, via: "number" } });
    expect(parseGoToTarget("hl", ctx)).toEqual({ target: { kind: "address", address: 0x5812, via: "register", name: "HL" } });
    expect(parseGoToTarget("hl'", ctx)).toMatchObject({ target: { address: 0x1234 } });
    expect(parseGoToTarget("main", ctx)).toMatchObject({ target: { kind: "address", address: 0x8000, name: "main" } });
  });

  it("goes to a partition and offset", () => {
    expect(parseGoToTarget("r0:$10", ctx)).toEqual({ target: { kind: "partition", partition: -1, offset: 0x10, via: "number" } });
    expect(parseGoToTarget("B5:4000", ctx)).toEqual({ error: "range" });
    expect(parseGoToTarget("Q9:0", ctx)).toEqual({ error: "partition" });
  });

  it("opens a label's partition when it is not paged in", () => {
    // --- R0 is not paged in (R1 is), bank 7 neither
    expect(parseGoToTarget("PRINT_A", ctx)).toMatchObject({ target: { kind: "partition", partition: -1, offset: 0x10 } });
    expect(parseGoToTarget("banked", ctx)).toMatchObject({ target: { kind: "partition", partition: 7, offset: 0x10 } });
  });

  it("reports what is wrong", () => {
    expect(parseGoToTarget("", ctx)).toEqual({ error: "empty" });
    expect(parseGoToTarget("nothing_here", ctx)).toEqual({ error: "unknown" });
    expect(parseGoToTarget("$10000", ctx)).toEqual({ error: "range" });
  });

  it("resolves partition labels case-insensitively and suggests labels", () => {
    expect(partitionOfLabel("4", { 4: "04" })).toBe(4);
    expect(suggestLabels("pr", ctx.labels)).toEqual(["PRINT_A"]);
  });
});
