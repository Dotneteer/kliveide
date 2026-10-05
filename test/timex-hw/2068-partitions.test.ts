import { describe, expect, it } from "vitest";

import { DCK_BANK_DOCK } from "@common/timex/dckFile";
import { createTimexSession } from "../harness/timex";

/*
 * The 2068s' 8K partitions in the debugger (`.plans/TIMEX_SCORPION_PLAN.md` Q5): HOME H0-H7, DOCK
 * D0-D7, EXROM X0-X7; ROMs numbered from -1 down, RAM from 0 up.
 */
describe("2068 partitions", () => {
  it("labels HOME, DOCK and EXROM chunks, and parses the labels back", async () => {
    const s = await createTimexSession({ model: "tc2068" });
    const labels = s.timex.getPartitionLabels();
    expect(labels[-1]).toBe("H0");
    expect(labels[-2]).toBe("H1");
    expect(labels[2]).toBe("H2");
    expect(labels[7]).toBe("H7");
    expect(labels[8]).toBe("D0");
    expect(labels[15]).toBe("D7");
    expect(labels[-3]).toBe("X0");
    expect(labels[-10]).toBe("X7");
    for (const [index, label] of Object.entries(labels)) {
      expect(s.timex.parsePartitionLabel(label.toLowerCase())).toBe(Number(index));
    }
    expect(s.timex.getPartitionGroups()[9]).toBe("DOCK");
  });

  it("follows the chunk map: current partitions, labels, ROM flags and the CPU's flat view", async () => {
    const s = await createTimexSession({ model: "ts2068" });
    s.bootToBasic();
    const ram = new Uint8Array(0x2000).fill(0x77);
    const rom = new Uint8Array(0x2000).fill(0x66);
    s.insertCartridge({
      banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 0, 0, 2, 1, 0, 0], chunks: [, , , , rom, ram] as never }]
    });
    for (let i = 0; i < 0x2000; i++) s.exports.timexUploadExromByte(i, 0x55);
    expect(s.timex.getCurrentPartitionLabels()).toEqual(["H0", "H1", "H2", "H3", "H4", "H5", "H6", "H7"]);
    expect(s.timex.getRomFlags()).toEqual([true, true, false, false, false, false, false, false]);

    s.out(0x00f4, 0x30);
    expect(s.timex.getCurrentPartitionLabels()).toEqual(["H0", "H1", "H2", "H3", "D4", "D5", "H6", "H7"]);
    expect(s.timex.getRomFlags()).toEqual([true, true, false, false, true, false, false, false]);
    expect(s.timex.getPartition(0x9234)).toBe(12);
    expect(s.timex.getMemoryPartition(12)[0x234]).toBe(0x66);
    const flat = s.timex.get64KFlatMemory();
    expect([flat[0x8000], flat[0xa000], flat[0x4000 + 0x1800]]).toEqual([0x66, 0x00, s.peek(0x5800)]);

    s.out(0x00ff, 0x80).out(0x00f4, 0x01);
    expect(s.timex.getCurrentPartitionLabels()[0]).toBe("X0");
    expect(s.timex.getPartition(0x0000)).toBe(-3);
    expect(s.timex.getMemoryPartition(-3)[0]).toBe(0x55);
    expect(s.timex.get64KFlatMemory()[0]).toBe(0x55);
  });

  it("the TC2048 has only its HOME chunks", async () => {
    const s = await createTimexSession();
    expect(Object.values(s.timex.getPartitionLabels()).sort()).toEqual(["H0", "H1", "H2", "H3", "H4", "H5", "H6", "H7"]);
    expect(s.timex.getCurrentPartitions()).toEqual([-1, -2, 2, 3, 4, 5, 6, 7]);
  });
});
