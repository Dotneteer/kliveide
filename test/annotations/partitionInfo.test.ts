import { describe, it, expect } from "vitest";

import {
  genericPartitionInfo,
  isWritableKind,
  nextPartitionInfo,
  nextPartitionRoles,
  partitionIndex,
  spectrumPartitionInfo,
  spectrumPartitionRoles,
  z88PartitionInfo,
  type NextRoleInput,
  type PartitionInfoSet
} from "@common/annotations/partitionInfo";
import {
  nextPartitionDescriptions,
  nextPartitionGroups,
  nextPartitionLabels
} from "@emu/machines/zxNext/nextMachineInfo";
import { z88PartitionLabels } from "@emu/machines/z88/z88MachineInfo";

/*
 * The partition model the Memory and Disassembly views' frame reads
 * (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §7, phase 1).
 */

const byId = (set: PartitionInfoSet, id: number) => partitionIndex(set).get(id)!;

const SP128_LABELS = { [-2]: "R1", [-1]: "R0", 0: "B0", 1: "B1", 2: "B2", 3: "B3", 4: "B4", 5: "B5", 6: "B6", 7: "B7" };

describe("spectrumPartitionInfo", () => {
  it("makes the 128K's ROMs and banks 16K partitions in two chip runs", () => {
    const set = spectrumPartitionInfo({ labels: SP128_LABELS });
    expect(set.partitions).toHaveLength(10);
    expect(byId(set, -1)).toMatchObject({ name: "R0", kind: "rom", size: 0x4000 });
    expect(byId(set, 5)).toMatchObject({ name: "B5", kind: "ram", size: 0x4000 });
    expect(set.layout.map((b) => [b.key, b.ids])).toEqual([
      ["rom", [-1, -2]],
      ["ram", [0, 1, 2, 3, 4, 5, 6, 7]]
    ]);
  });

  it("knows the DivMMC's 8K pages", () => {
    const labels: Record<number, string> = { ...SP128_LABELS, [-16]: "DR" };
    for (let b = 0; b < 16; b++) labels[-32 - b] = `D${b.toString(16).toUpperCase()}`;
    const set = spectrumPartitionInfo({ labels, groups: { [-16]: "DivMMC" } });
    expect(byId(set, -16)).toMatchObject({ kind: "divRom", size: 0x2000 });
    expect(byId(set, -47)).toMatchObject({ kind: "divRam", size: 0x2000, name: "DF" });
    expect(set.layout.find((b) => b.key === "div")?.ids).toHaveLength(17);
  });

  it("puts the screens in banks 5 and 7", () => {
    expect(spectrumPartitionRoles()).toEqual({ 5: ["ulaScreen"], 7: ["shadowScreen"] });
  });
});

describe("z88PartitionInfo", () => {
  const labels = z88PartitionLabels();
  const oz = { kind: "flash" as const, sizeInBytes: 0x80000 };

  it("splits slot 0 into the ROM and the internal RAM and leaves an empty slot empty", () => {
    const set = z88PartitionInfo({ labels, slots: [oz, undefined, undefined, undefined], internalRamBytes: 0x80000 });
    expect(set.partitions).toHaveLength(256);
    expect(byId(set, 0x00)).toMatchObject({ name: "00", kind: "flash", card: { slot: 0, internal: true } });
    expect(byId(set, 0x1f).kind).toBe("flash");
    expect(byId(set, 0x20)).toMatchObject({ kind: "ram", card: { slot: 0, kind: "ram", sizeInBytes: 0x80000 } });
    expect(byId(set, 0xc0)).toMatchObject({ kind: "empty", card: { slot: 3, kind: "empty", sizeInBytes: 0 } });
    expect(set.layout.map((b) => b.slot)).toEqual([0, 1, 2, 3]);
    expect(set.layout.every((b) => b.ids.length === 64 && b.columns === 16)).toBe(true);
  });

  it.each([
    [0x8000, 2],
    [0x10000, 4],
    [0x20000, 8],
    [0x40000, 16],
    [0x80000, 32],
    [0x100000, 64]
  ])("puts a %i-byte RAM card at the top of slot 1 and mirrors it below (%i banks)", (size, banks) => {
    const set = z88PartitionInfo({
      labels,
      slots: [oz, { kind: "ram", sizeInBytes: size }, undefined, undefined],
      internalRamBytes: 0x20000
    });
    const slot1 = set.partitions.filter((p) => p.id >= 0x40 && p.id < 0x80);
    const real = slot1.filter((p) => p.kind === "cardRam");
    const mirrors = slot1.filter((p) => p.kind === "mirror");
    expect(real).toHaveLength(banks);
    expect(mirrors).toHaveLength(64 - banks);
    expect(real[0].id).toBe(0x80 - banks);
    // --- A mirror repeats the real bank with the same low address bits
    for (const m of mirrors) {
      expect(m.mirrorOf! & (banks - 1)).toBe(m.id & (banks - 1));
      expect(m.mirrorOf!).toBeGreaterThanOrEqual(0x80 - banks);
    }
  });

  it("mirrors a small internal RAM upwards from $20", () => {
    const set = z88PartitionInfo({ labels, slots: [oz, undefined, undefined, undefined], internalRamBytes: 0x20000 });
    expect(byId(set, 0x27).kind).toBe("ram");
    expect(byId(set, 0x28)).toMatchObject({ kind: "mirror", mirrorOf: 0x20 });
    expect(byId(set, 0x3f)).toMatchObject({ kind: "mirror", mirrorOf: 0x27 });
  });

  it("names EPROM and ROM cards by kind", () => {
    const set = z88PartitionInfo({
      labels,
      slots: [{ kind: "rom", sizeInBytes: 0x20000 }, undefined, undefined, { kind: "eprom", sizeInBytes: 0x8000 }],
      internalRamBytes: 0x80000
    });
    expect(byId(set, 0x00).kind).toBe("rom");
    expect(byId(set, 0x08)).toMatchObject({ kind: "mirror", mirrorOf: 0x00 });
    expect(byId(set, 0xff).kind).toBe("eprom");
    expect(byId(set, 0xfd)).toMatchObject({ kind: "mirror", mirrorOf: 0xff });
  });
});

describe("nextPartitionInfo", () => {
  it("has 247 partitions on a 2 MB board, in five blocks", () => {
    const set = nextPartitionInfo({
      labels: nextPartitionLabels(),
      descriptions: nextPartitionDescriptions(),
      groups: nextPartitionGroups()
    });
    expect(set.partitions).toHaveLength(247);
    expect(byId(set, -1)).toMatchObject({ name: "R0", kind: "rom", size: 0x4000 });
    expect(byId(set, -5)).toMatchObject({ name: "X0", kind: "rom" });
    expect(byId(set, -7)).toMatchObject({ name: "DM", kind: "divRom", size: 0x2000 });
    expect(byId(set, -8)).toMatchObject({ name: "M0", kind: "divRam" });
    expect(byId(set, 0x0b)).toMatchObject({ name: "0B", kind: "ram", size: 0x2000, bank16: { bank: 5, half: 1 } });
    expect(set.layout.map((b) => [b.key, b.ids.length])).toEqual([
      ["rom", 4],
      ["altRom", 2],
      ["divRom", 1],
      ["divRam", 16],
      ["ram", 224]
    ]);
  });

  it("has 503 on a KS3, the Upper RAM as its own grid", () => {
    const options = { upperRam: true };
    const set = nextPartitionInfo({ labels: nextPartitionLabels(options), upperRam: true });
    expect(set.partitions).toHaveLength(503);
    expect(set.layout.at(-1)).toMatchObject({ key: "upper", columns: 16 });
    expect(set.layout.at(-1)!.ids).toHaveLength(256);
    expect(byId(set, 256).bank16).toEqual({ bank: 112, half: 0 });
  });
});

describe("nextPartitionRoles", () => {
  const base: NextRoleInput = {
    layer2Bank: 8,
    layer2ShadowBank: 11,
    layer2Banks: 3,
    tilemapBank7: false,
    tilemapMsb: 0x2c,
    tileDefBank7: false,
    tileDefMsb: 0x0c
  };

  it("reads the screens, Layer 2 and the tilemap from the registers", () => {
    const roles = nextPartitionRoles(base);
    expect(roles[0x0a]).toEqual(["ulaScreen", "tilemap"]);
    expect(roles[0x0b]).toEqual(["tilemap"]);
    expect(roles[0x0e]).toEqual(["shadowScreen"]);
    for (let page = 16; page < 22; page++) expect(roles[page]).toEqual(["layer2"]);
    for (let page = 22; page < 28; page++) expect(roles[page]).toEqual(["layer2Shadow"]);
    expect(roles[28]).toBeUndefined();
  });

  it("moves Layer 2 when $12 moves", () => {
    const roles = nextPartitionRoles({ ...base, layer2Bank: 20, layer2Banks: 5 });
    expect(roles[16]).toBeUndefined();
    expect(roles[40]).toEqual(["layer2"]);
    expect(roles[49]).toEqual(["layer2"]);
    expect(roles[50]).toBeUndefined();
  });

  it("leaves out pages past the RAM unless the board has Upper RAM", () => {
    expect(nextPartitionRoles({ ...base, layer2Bank: 111 })[224]).toBeUndefined();
    const upper = nextPartitionRoles({ ...base, layer2Bank: 111 }, true);
    expect(upper[223]).toEqual(["layer2"]);
    expect(upper[256]).toEqual(["layer2"]);
  });
});

describe("genericPartitionInfo", () => {
  it("makes negative partitions ROM and long runs grids", () => {
    const labels: Record<number, string> = { [-1]: "SYS" };
    for (let i = 0; i < 40; i++) labels[i] = i.toString(16);
    const set = genericPartitionInfo({ labels, groups: { [-1]: "ROM" } });
    expect(byId(set, -1).kind).toBe("rom");
    expect(byId(set, 3).kind).toBe("ram");
    expect(set.layout.map((b) => b.shape)).toEqual(["chips", "grid"]);
  });
});

describe("isWritableKind", () => {
  it("allows RAM and refuses ROM, flash and empty slots", () => {
    expect(isWritableKind("ram")).toBe(true);
    expect(isWritableKind("cardRam")).toBe(true);
    expect(isWritableKind("rom")).toBe(false);
    expect(isWritableKind("flash")).toBe(false);
    expect(isWritableKind("empty")).toBe(false);
  });
});
