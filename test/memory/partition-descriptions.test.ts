import { describe, it, expect } from "vitest";

import { createZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory";
import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { createZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { Z88TestMachine } from "../z88/Z88TestMachine";
import {
  derivePartitionOptions,
  toCaptionedBlocks
} from "@renderer/features/memory/memoryViewModel";

/*
 * Descriptions are presentation; labels are identity. These tests hold that line: a description
 * exists for every partition a machine names, and it is never mistaken for a name — nothing here
 * asserts that a description parses, because none of them should.
 *
 * See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §3 and §5.1.
 */

type DescribedMachine = {
  getPartitionLabels(): Record<number, string>;
  getPartitionDescriptions(): Record<number, string>;
  getPartitionGroups(): Record<number, string>;
  parsePartitionLabel(label: string): number | undefined;
};

const machines: [string, () => DescribedMachine][] = [
  ["ZX Spectrum 128K", () => createZxSpectrum128Machine() as unknown as DescribedMachine],
  ["ZX Spectrum +2/+3E", () => createZxSpectrumP3eMachine() as unknown as DescribedMachine],
  ["ZX Spectrum Next", () => new ZxNextMachine() as unknown as DescribedMachine],
  ["Cambridge Z88", () => new Z88TestMachine() as unknown as DescribedMachine]
];

describe.each(machines)("%s partition descriptions", (_name, create) => {
  it("describes every partition it labels, and no others", () => {
    const machine = create();
    expect(Object.keys(machine.getPartitionDescriptions()).sort()).toEqual(
      Object.keys(machine.getPartitionLabels()).sort()
    );
  });

  it("describes each partition with something other than its label", () => {
    // --- A description that merely repeats the label earns no room in a chooser.
    const machine = create();
    const labels = machine.getPartitionLabels();

    for (const [index, description] of Object.entries(machine.getPartitionDescriptions())) {
      expect(description, index).not.toBe(labels[Number(index)]);
      expect(description.length, description).toBeGreaterThan(2);
    }
  });
});

describe("machines without partitions", () => {
  it("gives the 48K no descriptions, because it has no partitions", () => {
    const machine = createZxSpectrum48Machine() as unknown as DescribedMachine;
    expect(machine.getPartitionLabels()).toEqual({});
    expect(machine.getPartitionDescriptions()).toEqual({});
  });
});

describe("ZX Spectrum 128K descriptions", () => {
  it("names its two ROMs and eight banks", () => {
    const d = (createZxSpectrum128Machine() as unknown as DescribedMachine).getPartitionDescriptions();
    expect(d[-1]).toBe("ROM 0");
    expect(d[-2]).toBe("ROM 1");
    expect(d[-3]).toBeUndefined();
    expect(d[0]).toBe("Bank 0");
    expect(d[7]).toBe("Bank 7");
  });
});

describe("ZX Spectrum +2/+3E descriptions", () => {
  it("names four ROMs, not two", () => {
    const d = (createZxSpectrumP3eMachine() as unknown as DescribedMachine).getPartitionDescriptions();
    expect(d[-1]).toBe("ROM 0");
    expect(d[-4]).toBe("ROM 3");
    expect(d[-5]).toBeUndefined();
  });
});

describe("ZX Spectrum Next descriptions", () => {
  const next = () => new ZxNextMachine() as unknown as DescribedMachine;

  it("spells out the names the bank chooser used to use as labels", () => {
    // --- `NROM0`, `ALTR0` and `DivMR` were names; they are glosses now.
    const d = next().getPartitionDescriptions();
    expect(d[-1]).toBe("Next ROM 0");
    expect(d[-5]).toBe("Alt ROM 0");
    expect(d[-6]).toBe("Alt ROM 1");
    expect(d[-7]).toBe("DivMMC ROM");
    expect(d[-8]).toBe("DivMMC RAM 0");
    expect(d[-23]).toBe("DivMMC RAM 15");
    expect(d[0]).toBe("Bank $00");
    expect(d[223]).toBe("Bank $DF");
  });

  it("does not let a description be parsed as a partition", () => {
    // --- The distinction that matters: `X0` identifies the alt ROM, "Alt ROM 0" only explains it.
    const machine = next();
    for (const description of Object.values(machine.getPartitionDescriptions())) {
      expect(machine.parsePartitionLabel(description), description).toBeUndefined();
    }
  });
});

describe("derivePartitionOptions", () => {
  it("pairs every label with its description", () => {
    const options = derivePartitionOptions({ [-1]: "R0", 0: "B0" }, { [-1]: "ROM 0", 0: "Bank 0" });

    expect(options).toEqual([
      { index: -1, label: "R0", description: "ROM 0", group: "special" },
      { index: 0, label: "B0", description: "Bank 0", group: "bank" }
    ]);
  });

  it("orders special pages before banks, each ascending from zero outward", () => {
    const options = derivePartitionOptions({ 1: "B1", [-2]: "R1", 0: "B0", [-1]: "R0" });

    expect(options.map((o) => o.index)).toEqual([-1, -2, 0, 1]);
  });

  it("works for a machine that supplies no descriptions", () => {
    const options = derivePartitionOptions({ 0: "00", 1: "01" });

    expect(options.map((o) => o.description)).toEqual([undefined, undefined]);
    expect(options.every((o) => o.group === "bank")).toBe(true);
  });

  it("returns nothing for a machine with no partitions", () => {
    expect(derivePartitionOptions({})).toEqual([]);
    expect(derivePartitionOptions(undefined as any)).toEqual([]);
  });

  it("groups a real machine's partitions the way a chooser lays them out", () => {
    const machine = new ZxNextMachine() as unknown as DescribedMachine;
    const options = derivePartitionOptions(
      machine.getPartitionLabels(),
      machine.getPartitionDescriptions()
    );

    // --- 4 Next ROMs + 2 alt ROMs + DivMMC ROM + 16 DivMMC RAM pages, then 224 banks.
    expect(options.filter((o) => o.group === "special")).toHaveLength(23);
    expect(options.filter((o) => o.group === "bank")).toHaveLength(224);
    expect(options[0]).toMatchObject({ index: -1, label: "R0", description: "Next ROM 0" });
  });
});

describe("Cambridge Z88 descriptions", () => {
  it("describes its 256 banks and claims no ROM partitions", () => {
    // --- The Z88's ROM is a card in slot 0, not a fixed page, so a bank-only map is complete
    // --- rather than missing entries. See the plan's §8, decision 2.
    const machine = new Z88TestMachine() as unknown as DescribedMachine;
    const labels = machine.getPartitionLabels();
    const descriptions = machine.getPartitionDescriptions();

    expect(Object.keys(labels)).toHaveLength(256);
    expect(Object.keys(labels).every((key) => Number(key) >= 0)).toBe(true);
    expect(descriptions[0]).toBe("Bank $00");
    expect(descriptions[255]).toBe("Bank $FF");
  });

  it("returns a real record, not an array wearing one as a type", () => {
    // --- `getPartitionLabels` used to build a `string[]` and return it as a `Record`. It worked by
    // --- index, but it made the Z88 the one machine whose map behaved differently from its type.
    const labels = (new Z88TestMachine() as unknown as DescribedMachine).getPartitionLabels();

    expect(Array.isArray(labels)).toBe(false);
    expect(labels[0]).toBe("00");
    expect(labels[255]).toBe("FF");
  });
});

describe("ZX Spectrum Next partition groups", () => {
  const next = () => new ZxNextMachine() as unknown as DescribedMachine;

  it("puts the special partitions into four captioned blocks", () => {
    const groups = next().getPartitionGroups();

    expect(groups[-1]).toBe("Next ROM");
    expect(groups[-4]).toBe("Next ROM");
    expect(groups[-5]).toBe("Alt ROM");
    expect(groups[-6]).toBe("Alt ROM");
    expect(groups[-7]).toBe("DivMMC ROM");
    expect(groups[-8]).toBe("DivMMC RAM");
    expect(groups[-23]).toBe("DivMMC RAM");
  });

  it("captions the RAM banks too, which costs no height beside the grid", () => {
    // --- The caption sits to the *left* of the bank grid's first row rather than above it, so
    // --- naming 224 banks adds no row.
    const groups = next().getPartitionGroups();

    expect(groups[0]).toBe("RAM Banks");
    expect(groups[223]).toBe("RAM Banks");
  });

  it("gives every partition a caption", () => {
    const machine = next();
    const captions = machine.getPartitionGroups();

    for (const index of Object.keys(machine.getPartitionLabels())) {
      expect(captions[Number(index)], index).toBeDefined();
    }
  });

  it("collapses to four blocks a chooser can head once each", () => {
    // --- The point of the captions: sixteen DivMMC RAM banks become one row headed once, rather
    // --- than sixteen chips each spelling out "DivMMC RAM n".
    const machine = next();
    const options = derivePartitionOptions(
      machine.getPartitionLabels(),
      machine.getPartitionDescriptions(),
      machine.getPartitionGroups()
    );
    const special = options.filter((o) => o.group === "special");

    const blocks = toCaptionedBlocks(special);

    expect(blocks.map((b) => b.caption)).toEqual([
      "Next ROM",
      "Alt ROM",
      "DivMMC ROM",
      "DivMMC RAM"
    ]);
    expect(blocks.map((b) => b.options.length)).toEqual([4, 2, 1, 16]);
    expect(blocks[3].options.map((o) => o.label)).toEqual([
      "M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7",
      "M8", "M9", "MA", "MB", "MC", "MD", "ME", "MF"
    ]);
  });

  it("keeps the indexed description for hover, even though the chip shows only the label", () => {
    const machine = next();
    expect(machine.getPartitionDescriptions()[-19]).toBe("DivMMC RAM 11");
    expect(machine.getPartitionGroups()[-19]).toBe("DivMMC RAM");
  });
});

describe("toCaptionedBlocks", () => {
  const option = (index: number, caption?: string) => ({
    index,
    label: `L${index}`,
    caption,
    group: "special" as const
  });

  it("runs consecutive options sharing a caption together", () => {
    const blocks = toCaptionedBlocks([option(1, "A"), option(2, "A"), option(3, "B")]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].options).toHaveLength(2);
  });

  it("starts a new block when a caption reappears later", () => {
    // --- Consecutive, not grouped-by-value: the option order is the draw order, so a caption that
    // --- comes back is a second block rather than a continuation of the first.
    const blocks = toCaptionedBlocks([option(1, "A"), option(2, "B"), option(3, "A")]);

    expect(blocks.map((b) => b.caption)).toEqual(["A", "B", "A"]);
  });

  it("keeps uncaptioned options in their own block", () => {
    const blocks = toCaptionedBlocks([option(1), option(2)]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].caption).toBeUndefined();
  });

  it("returns nothing for nothing", () => {
    expect(toCaptionedBlocks([])).toEqual([]);
  });
});
