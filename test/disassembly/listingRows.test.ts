import { describe, it, expect } from "vitest";

import { partitionIndex, spectrumPartitionInfo, z88PartitionInfo } from "@common/annotations/partitionInfo";
import { z88PartitionLabels } from "@emu/machines/z88/z88MachineInfo";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { buildListingRows } from "@renderer/appIde/DocumentPanels/listingRows";
import { buildMapCells } from "@renderer/features/memoryMap/memoryMapModel";

const texts = {
  slotRule: (c: { start: number; name?: string }) => `slot@${c.start.toString(16)}:${c.name}`,
  emptySlot: (slot: number) => `empty ${slot}`
};
/** A listing with one row every `step` bytes */
const listing = (step: number) =>
  Array.from({ length: 0x10000 / step }, (_, i) => ({ address: i * step, instruction: "nop" }) as DisassemblyItem);

describe("buildListingRows", () => {
  it("puts a rule where the 64K enters another slot", () => {
    const set = spectrumPartitionInfo({ labels: { [-1]: "R0", 0: "B0", 2: "B2", 5: "B5" } });
    const parts = partitionIndex(set);
    const cells = buildMapCells([-1, -1, 5, 5, 2, 2, 0, 0], parts);
    const rows = buildListingRows(listing(0x1000), cells, parts, texts);
    const rules = rows.filter((r) => r.separator).map((r) => r.separator!.text);
    expect(rules).toEqual(["slot@0:R0", "slot@4000:B5", "slot@8000:B2", "slot@c000:B0"]);
    expect(rows).toHaveLength(16 + 4);
    expect(rows[5]).toMatchObject({ separator: { kind: "slot" }, address: 0x4000 });
  });

  it("folds an empty Z88 card slot into one row", () => {
    const set = z88PartitionInfo({
      labels: z88PartitionLabels(),
      slots: [{ kind: "flash", sizeInBytes: 0x80000 }, undefined, undefined, undefined],
      internalRamBytes: 0x80000
    });
    const parts = partitionIndex(set);
    // --- Segment 3 shows bank $C0, in the empty slot 3
    const cells = buildMapCells([0x20, 0x00, 0x00, 0x00, 0x02, 0x02, 0xc0, 0xc0], parts);
    const rows = buildListingRows(listing(0x1000), cells, parts, texts);
    expect(rows.some((r) => r.address >= 0xc000 && !r.separator)).toBe(false);
    expect(rows.at(-1)).toMatchObject({ separator: { kind: "empty", text: "empty 3" } });
  });
});
