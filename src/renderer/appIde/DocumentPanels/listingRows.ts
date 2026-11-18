import type { PartitionInfo } from "@common/annotations/partitionInfo";
import type { MapCell } from "@renderer/features/memoryMap/memoryMapModel";
import type { DisassemblyItem } from "../disassemblers/common-types";

/*
 * The rows the live Disassembly view lists (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §6.1): the
 * listing, with a rule row where the 64K view enters another slot, and an empty Z88 card slot folded
 * into one row instead of 16K of `rst $38`. Display only: the annotation, breakpoint and coverage
 * logic keep reading the listing itself.
 */

export type ListingRowTexts = {
  /** The rule's caption for a cell: `Slot 2 · $8000–$BFFF · B2 Bank 2` */
  slotRule: (cell: MapCell) => string;
  /** The one row of an empty card slot */
  emptySlot: (slot: number) => string;
};

export function buildListingRows(
  items: readonly DisassemblyItem[],
  cells: readonly MapCell[],
  partitions: ReadonlyMap<number, PartitionInfo>,
  texts: ListingRowTexts
): DisassemblyItem[] {
  if (items.length === 0 || cells.length === 0) return items as DisassemblyItem[];
  const out: DisassemblyItem[] = [];
  let cell = -1;
  for (const item of items) {
    const at = cells.findIndex((c) => item.address >= c.start && item.address <= c.end);
    if (at !== cell) {
      cell = at;
      const c = cells[at];
      if (c) {
        out.push({ address: item.address, instruction: "", separator: { kind: "slot", text: texts.slotRule(c) } } as DisassemblyItem);
        if (c.kind === "empty") {
          const p = c.partition !== undefined ? partitions.get(c.partition) : undefined;
          out.push({
            address: item.address,
            instruction: "",
            separator: { kind: "empty", text: texts.emptySlot(p?.card?.slot ?? c.slots[0]) }
          } as DisassemblyItem);
        }
      }
    }
    if (cells[cell]?.kind === "empty") continue;
    out.push(item);
  }
  return out;
}
