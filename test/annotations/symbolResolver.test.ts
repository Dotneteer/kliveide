import { describe, it, expect } from "vitest";

import {
  sp128BankSpace,
  sp48BankSpace,
  zx8081BankSpace
} from "@common/annotations/bankSpace";
import {
  annotationRoutineLabels,
  createAddressSymbols,
  mergeRomLayers
} from "@renderer/appIde/annotations/symbolResolver";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import type { RomLayer } from "@renderer/appIde/annotations/romLayer";
import { buildRoutineMap } from "@common/profile/routineMap";
import { sp48ProfileLayout } from "@common/profile/layouts/sp48";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { routineText } from "@renderer/appIde/SideBarPanels/CallStackPanel";

/*
 * The shared resolver (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.4): one answer to "what
 * is this address called", for every view, from four sources in a fixed order.
 */

const PAGING_128 = [-1, -1, 5, 5, 2, 2, 7, 7];

const ANNOTATIONS: ProgramAnnotations = {
  schemaVersion: 3,
  machine: "sp128",
  globalLabels: [{ name: "Entry", value: 0x8000 }],
  banks: {
    "7": {
      offsetIndex: 3,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [
        { name: "Bank7Code", value: 0x0100 },
        { name: "Shared", value: 0x0200 }
      ]
    }
  }
};

function romLayer(kind: "user" | "shipped", labels: { name: string; value: number }[], extra: Partial<RomLayer> = {}): RomLayer {
  return {
    kind,
    path: kind === "user" ? "/home/Klive/RomAnnotations/x.rom.dis" : "roms/sp128-0.rom.dis",
    origin: kind === "user" ? "Your ROM annotations" : "ROM: sp128-0.rom",
    page: 0,
    annotations: {
      schemaVersion: 3,
      machine: "rom",
      banks: { "0": { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: labels } }
    },
    ...extra
  };
}

describe("createAddressSymbols", () => {
  it("names from the build first, then the annotations, then the ROM (A8)", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp128BankSpace,
      buildLabels: [{ name: "BuildName", address: 0xc200 }],
      annotations: ANNOTATIONS,
      annotationOrigin: "game.dis",
      romLayersOf: (partition) => (partition === -1 ? [romLayer("shipped", [{ name: "START", value: 0 }])] : [])
    });
    expect(symbols.labelAt(0xc200, PAGING_128)).toEqual({
      name: "BuildName",
      source: "build",
      origin: "Build"
    });
    // --- T9: the others are kept for the tooltip
    expect(symbols.allAt(0xc200, PAGING_128).map((hit) => `${hit.source}:${hit.name}`)).toEqual([
      "build:BuildName",
      "annotation:Shared"
    ]);
    expect(symbols.labelAt(0xc100, PAGING_128)?.name).toBe("Bank7Code");
    expect(symbols.labelAt(0x8000, PAGING_128)?.name).toBe("Entry");
    expect(symbols.labelAt(0x0000, PAGING_128)).toMatchObject({ name: "START", source: "rom", origin: "ROM: sp128-0.rom" });
  });

  it("names a bank's label only while its bank is paged", () => {
    const symbols = createAddressSymbols({ bankSpace: sp128BankSpace, annotations: ANNOTATIONS });
    expect(symbols.labelAt(0xc100, [-1, -1, 5, 5, 2, 2, 0, 0])).toBeUndefined();
    // --- ...and wherever it is paged: bank 7 at $C000 is the only place on a 128K, so a +3-style
    // --- paging is enough to show the rule
    expect(symbols.labelAt(0x4100, [4, 4, 7, 7, 6, 6, 3, 3])?.name).toBe("Bank7Code");
  });

  it("takes a banked build label only in its own partition", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp128BankSpace,
      buildLabels: [{ name: "InBank3", address: 0xc000, partition: 3 }]
    });
    expect(symbols.labelAt(0xc000, [-1, -1, 5, 5, 2, 2, 3, 3])?.name).toBe("InBank3");
    expect(symbols.labelAt(0xc000, PAGING_128)).toBeUndefined();
    // --- No paging to judge by (a history record): taken at its address
    expect(symbols.labelAt(0xc000, undefined)?.name).toBe("InBank3");
  });

  it("puts the user's ROM layer before the shipped one", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      romLayersOf: () => [
        romLayer("user", [{ name: "MINE", value: 0x0010 }]),
        romLayer("shipped", [{ name: "PRINT_A", value: 0x0010 }])
      ]
    });
    expect(symbols.labelAt(0x0010, [])?.name).toBe("MINE");
    expect(symbols.allAt(0x0010, []).map((hit) => hit.name)).toEqual(["MINE", "PRINT_A"]);
  });

  it("honours byte binding: a label off its bytes is not shown", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      romLayersOf: () => [
        romLayer("shipped", [
          { name: "KEPT", value: 0x0010 },
          { name: "LOST", value: 0x0020 }
        ], { bound: new Set([0x0010, 0x0011]) })
      ]
    });
    expect(symbols.labelAt(0x0010, [])?.name).toBe("KEPT");
    expect(symbols.labelAt(0x0020, [])).toBeUndefined();
  });

  it("hides ROM names when the ROM labels toggle is off", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      romLabels: false,
      romLayersOf: () => [romLayer("shipped", [{ name: "START", value: 0 }])]
    });
    expect(symbols.labelAt(0, [])).toBeUndefined();
    expect(symbols.empty).toBe(true);
  });

  it("names a ZX81 label at every mirror and says which", () => {
    const space = zx8081BankSpace("zx81", { ramKb: 16, rom8k: true });
    const symbols = createAddressSymbols({
      bankSpace: space,
      annotations: {
        schemaVersion: 3,
        machine: "zx81",
        banks: {
          "1": { offsetIndex: 1, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: [{ name: "Loop", value: 0x0082 }] }
        }
      }
    });
    expect(symbols.labelAt(0x4082, undefined)).toMatchObject({ name: "Loop" });
    expect(symbols.labelAt(0x4082, undefined)?.mirrorOf).toBeUndefined();
    expect(symbols.labelAt(0xc082, undefined)).toMatchObject({ name: "Loop", mirrorOf: 0x4082 });
  });
});

describe("routineAt", () => {
  const symbols = createAddressSymbols({
    bankSpace: sp128BankSpace,
    buildLabels: [{ name: "Main", address: 0x8000 }],
    annotations: ANNOTATIONS,
    romLayersOf: () => [romLayer("shipped", [{ name: "PRINT_OUT", value: 0x09f4 }])]
  });

  it("gives the containing routine and the offset into it", () => {
    expect(symbols.routineAt(0x8012, PAGING_128)).toEqual({ name: "Main", offset: 0x12, source: "build" });
    expect(symbols.routineAt(0xc105, PAGING_128)).toEqual({ name: "Bank7Code", offset: 5, source: "annotation" });
    expect(symbols.routineAt(0x09f4 + 12, PAGING_128)).toEqual({ name: "PRINT_OUT", offset: 12, source: "rom" });
    expect(routineText(symbols.routineAt(0x09f4 + 12, PAGING_128))).toBe("PRINT_OUT+12");
    expect(routineText(symbols.routineAt(0x8000, PAGING_128))).toBe("Main");
  });

  it("looks no further back than the address's own 16K slot", () => {
    expect(symbols.routineAt(0x4010, PAGING_128)).toBeUndefined();
  });
});

describe("operandResolver", () => {
  it("names operands through every source, then the system variables", () => {
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      buildLabels: [{ name: "Main", address: 0x8000 }],
      sysVarResolver: (operand) => (operand.operandValue === 0x5c08 ? "LAST_K" : undefined)
    });
    const resolve = symbols.operandResolver([])!;
    const operand = (operandValue: number) =>
      ({ operandValue, operandIndex: 0, instructionAddress: 0, instructionOffset: 0, pragma: "W", defaultText: "" }) as any;
    expect(resolve(operand(0x8000))).toBe("Main");
    expect(resolve(operand(0x5c08))).toBe("LAST_K");
    expect(resolve(operand(0x1234))).toBeUndefined();
  });
});

describe("mergeRomLayers", () => {
  it("lays the user's data regions over the shipped ones, which a whole-page code region would hide", () => {
    const shipped = romLayer("shipped", []);
    shipped.annotations.banks["0"].regions = [
      { start: 0, end: 0x0fff, type: "disassemble" },
      { start: 0x1000, end: 0x10ff, type: "bytes" },
      { start: 0x1100, end: 0x3fff, type: "disassemble" }
    ];
    const user = romLayer("user", [{ name: "MINE", value: 0x2000 }]);
    user.annotations.banks["0"].regions = [
      { start: 0, end: 0x1fff, type: "disassemble" },
      { start: 0x2000, end: 0x200f, type: "words" },
      { start: 0x2010, end: 0x3fff, type: "disassemble" }
    ];
    const merged = mergeRomLayers([user, shipped])!;
    expect(merged.bankAnnotation.regions.filter((r) => r.type !== "disassemble")).toEqual([
      { start: 0x1000, end: 0x10ff, type: "bytes" },
      { start: 0x2000, end: 0x200f, type: "words" }
    ]);
    expect(merged.origin).toBe(user.path);
  });

  it("drops a shipped data region whose bytes did not bind", () => {
    const shipped = romLayer("shipped", [], { boundRegions: new Set<number>() });
    shipped.annotations.banks["0"].regions = [
      { start: 0, end: 0x0fff, type: "disassemble" },
      { start: 0x1000, end: 0x10ff, type: "bytes" },
      { start: 0x1100, end: 0x3fff, type: "disassemble" }
    ];
    expect(mergeRomLayers([shipped])!.bankAnnotation.regions.every((r) => r.type === "disassemble")).toBe(true);
  });
});

describe("the profiler's routine map", () => {
  it("takes annotation and ROM labels as routines between the build's labels and the call targets", () => {
    const labels = annotationRoutineLabels(
      {
        bankSpace: sp48BankSpace,
        annotations: {
          schemaVersion: 3,
          machine: "sp48",
          banks: {
            "2": { offsetIndex: 2, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: [{ name: "Game", value: 0x0100 }] }
          }
        },
        romLayersOf: () => [romLayer("shipped", [{ name: "BEEPER", value: 0x03b5 }])]
      },
      [-1]
    );
    expect(labels).toEqual([
      { name: "Game", address: 0x8100 },
      { name: "BEEPER", address: 0x03b5 }
    ]);
    const map = buildRoutineMap({
      layout: sp48ProfileLayout,
      offsetOf: (partition, address) => profileOffsetOf(sp48ProfileLayout, partition, address),
      annotationLabels: labels
    });
    expect(map.source).toBe("annotations");
    expect(map.routineAt(0x8105).name).toBe("Game");
    expect(map.routineAt(0x03b5 + 4).name).toBe("BEEPER");
  });
});
