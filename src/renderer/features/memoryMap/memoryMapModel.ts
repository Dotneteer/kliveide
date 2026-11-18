import type { BankSite, BankSpace } from "@common/annotations/bankSpace";
import type {
  BankMapBlock,
  PartitionInfo,
  PartitionInfoSet,
  PartitionKind,
  PartitionRole
} from "@common/annotations/partitionInfo";

/*
 * The shared frame's model (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4): the memory map bar's
 * cells, the partition row's chips, the recent list, the Bank map's filter and keyboard moves.
 * Pure: the components draw what these return, and the tests pin it without a DOM.
 */

/** One cell of the memory map bar: a paging unit and what is in it */
export type MapCell = {
  /** The first CPU address of the unit */
  start: number;
  /** Its last CPU address */
  end: number;
  /** The 8K slots it covers */
  slots: number[];
  partition?: number;
  /** The partition's machine label, or a kind for a machine without partitions */
  name?: string;
  description?: string;
  kind: PartitionKind;
  /** Where in the partition the unit starts (the second 8K half of a 16K bank is `0x2000`) */
  partitionOffset: number;
};

/**
 * The bar's cells from the paging (`MemoryInfo.slotPartitions`, one partition per 8K slot).
 *
 * Two neighbouring slots showing the two halves of one 16K partition are one cell (a 128K's 16K
 * slots, a Next ROM in MMU 0-1); everything else is a cell per 8K slot (the Next's MMU pages, the
 * Z88's segment 0 halves). Without partitions the bar is the machine's ROM and RAM by `romFlags`.
 */
export function buildMapCells(
  slotPartitions: readonly (number | undefined)[] | undefined,
  partitions: ReadonlyMap<number, PartitionInfo>,
  romFlags: readonly boolean[] = []
): MapCell[] {
  const cells: MapCell[] = [];
  const hasPartitions = !!slotPartitions?.some((p) => p !== undefined) && partitions.size > 0;
  for (let slot = 0; slot < 8; slot++) {
    const start = slot * 0x2000;
    const partition = hasPartitions ? slotPartitions![slot] : undefined;
    const info = partition !== undefined ? partitions.get(partition) : undefined;
    const prev = cells[cells.length - 1];
    if (hasPartitions) {
      // --- The second half of the same 16K partition joins the cell before it
      if (
        prev &&
        partition !== undefined &&
        prev.partition === partition &&
        info?.size === 0x4000 &&
        prev.slots.length === 1 &&
        prev.partitionOffset === 0
      ) {
        prev.end = start + 0x1fff;
        prev.slots.push(slot);
        continue;
      }
      cells.push({
        start,
        end: start + 0x1fff,
        slots: [slot],
        partition,
        name: info?.name,
        description: info?.description,
        kind: info?.kind ?? "ram",
        partitionOffset: partitionAt(slotPartitions, partitions, start)?.offset ?? 0
      });
    } else {
      const kind: PartitionKind = romFlags[slot] ? "rom" : "ram";
      if (prev && prev.kind === kind && prev.end - prev.start < 0x3fff && slot % 2 === 1) {
        prev.end = start + 0x1fff;
        prev.slots.push(slot);
        continue;
      }
      cells.push({ start, end: start + 0x1fff, slots: [slot], kind, partitionOffset: 0 });
    }
  }
  return cells;
}

/** The cell an address falls in */
export function cellOf(cells: readonly MapCell[], address: number): MapCell | undefined {
  return cells.find((c) => address >= c.start && address <= c.end);
}

/** Where the CPU sees a partition offset now, if anywhere (the first slot that shows it) */
export function cpuAddressOf(
  slotPartitions: readonly (number | undefined)[] | undefined,
  partition: number,
  offset: number,
  size: number
): number | undefined {
  if (!slotPartitions) return undefined;
  for (let slot = 0; slot < 8; slot++) {
    if (slotPartitions[slot] !== partition) continue;
    // --- A 16K partition in an odd slot shows its upper half there
    const base = size === 0x4000 ? (slot % 2) * 0x2000 : 0;
    if (offset >= base && offset < base + 0x2000) return slot * 0x2000 + offset - base;
  }
  return undefined;
}

/** The partition and its offset an address of the 64K is in now */
export function partitionAt(
  slotPartitions: readonly (number | undefined)[] | undefined,
  partitions: ReadonlyMap<number, PartitionInfo>,
  address: number
): { partition: number; offset: number } | undefined {
  const slot = (address >> 13) & 0x07;
  const partition = slotPartitions?.[slot];
  if (partition === undefined) return undefined;
  const size = partitions.get(partition)?.size ?? 0x2000;
  // --- A 16K partition: the slot below it shows the same partition when this is its upper half
  const upper = size === 0x4000 && slot % 2 === 1 && slotPartitions?.[slot - 1] === partition;
  const lowerOnly = size === 0x4000 && slot % 2 === 1 && slotPartitions?.[slot - 1] !== partition;
  const base = upper || lowerOnly ? 0x2000 : 0;
  return { partition, offset: base + (address & 0x1fff) };
}

/** The slots each partition is paged into now, by partition */
export function pagedSlotsOf(slotPartitions: readonly (number | undefined)[] | undefined): Map<number, number[]> {
  const result = new Map<number, number[]>();
  slotPartitions?.forEach((partition, slot) => {
    if (partition === undefined) return;
    const list = result.get(partition) ?? [];
    list.push(slot);
    result.set(partition, list);
  });
  return result;
}

/**
 * The machine's paging unit: 8K on a machine whose RAM comes in 8K pages (the Next's MMU), 16K
 * elsewhere (the 128K's and the Z88's slots and segments)
 */
export function pagingUnitOf(set: PartitionInfoSet | undefined): number {
  return set?.partitions.some((p) => p.kind === "ram" && p.size === 0x2000) ? 0x2000 : 0x4000;
}

/**
 * A paged-in badge's slot numbers in the machine's paging unit: 16K slots (`0`, `2`) or 8K MMU
 * slots (`0·1`, `4`)
 */
export function slotBadge(slots: readonly number[], unit: number): string {
  if (unit === 0x4000) {
    return Array.from(new Set(slots.map((s) => s >> 1))).join("·");
  }
  return slots.join("·");
}

/** The partition row's chips for a machine with at most this many partitions; more get the Bank map */
export const PARTITION_ROW_MAX_CHIPS = 16;

/** Add a partition to the front of the recent list (most recent first, unique, capped) */
export function pushRecent(recent: readonly number[], partition: number, max = 5): number[] {
  return [partition, ...recent.filter((p) => p !== partition)].slice(0, max);
}

/** What the Bank map's filter matches a partition against */
export type PartitionFilterFacts = {
  roles?: readonly PartitionRole[];
  /** The slots it is paged into */
  slots?: readonly number[];
  /** The translated words for its kind and roles, so the filter speaks the UI's language */
  words?: readonly string[];
};

/**
 * Whether a partition matches the Bank map's filter: its label, description, group, kind, roles (as
 * ids and as the translated words) or slot (`slot 2`, `s2`). Every word of the filter must match.
 */
export function matchesPartitionFilter(
  partition: PartitionInfo,
  filter: string,
  facts: PartitionFilterFacts = {}
): boolean {
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    partition.name,
    partition.description ?? "",
    partition.group ?? "",
    partition.kind,
    ...(facts.roles ?? []),
    ...(facts.words ?? []),
    ...(facts.slots ?? []).map((s) => `slot${s} s${s}`),
    partition.card ? `slot${partition.card.slot}` : ""
  ]
    .join(" ")
    .toLowerCase();
  // --- "slot 2" is one word pair: join a lone "slot" with the number after it
  const joined: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === "slot" && i + 1 < words.length && /^\d+$/.test(words[i + 1])) {
      joined.push(`slot${words[i + 1]}`);
      i++;
    } else joined.push(words[i]);
  }
  const name = partition.name.toLowerCase();
  return joined.every((w) => (w.length <= 2 && name === w) || hay.includes(w));
}

/** A cell's place in the Bank map, for the arrow keys */
type GridPlace = { block: number; row: number; col: number; columns: number };

function placesOf(layout: readonly BankMapBlock[]): Map<number, GridPlace> {
  const places = new Map<number, GridPlace>();
  layout.forEach((block, b) => {
    const columns = block.shape === "grid" ? block.columns ?? 16 : block.ids.length;
    block.ids.forEach((id, i) => {
      places.set(id, { block: b, row: Math.floor(i / columns), col: i % columns, columns });
    });
  });
  return places;
}

/**
 * The partition an arrow key moves to in the Bank map. Left and right walk the cells in order
 * (across blocks); up and down keep the column within a grid and step to the block above or below
 * at its edge, landing on the nearest column. Cells the filter hides are skipped.
 */
export function moveInBankMap(
  layout: readonly BankMapBlock[],
  current: number | undefined,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End",
  visible: (id: number) => boolean = () => true
): number | undefined {
  const order = layout.flatMap((b) => b.ids).filter(visible);
  if (!order.length) return undefined;
  if (current === undefined || !order.includes(current)) return order[0];
  if (key === "Home") return order[0];
  if (key === "End") return order[order.length - 1];
  const at = order.indexOf(current);
  if (key === "ArrowLeft") return order[Math.max(0, at - 1)];
  if (key === "ArrowRight") return order[Math.min(order.length - 1, at + 1)];

  const places = placesOf(layout);
  const here = places.get(current)!;
  const down = key === "ArrowDown";
  // --- The same block, the next row, the same column
  const sameBlock = layout[here.block].ids.filter(visible);
  const candidates = sameBlock
    .map((id) => ({ id, p: places.get(id)! }))
    .filter(({ p }) => (down ? p.row > here.row : p.row < here.row));
  const pickNearest = (list: { id: number; p: GridPlace }[], wantRow: (rows: number[]) => number) => {
    if (!list.length) return undefined;
    const row = wantRow(list.map((c) => c.p.row));
    const inRow = list.filter((c) => c.p.row === row);
    // --- Columns compared as a fraction of the row, so a chip run and a 16-wide grid line up roughly
    const frac = here.col / Math.max(1, here.columns - 1);
    return inRow.reduce((best, c) =>
      Math.abs(c.p.col / Math.max(1, c.p.columns - 1) - frac) <
      Math.abs(best.p.col / Math.max(1, best.p.columns - 1) - frac)
        ? c
        : best
    ).id;
  };
  const inBlock = pickNearest(candidates, (rows) => (down ? Math.min(...rows) : Math.max(...rows)));
  if (inBlock !== undefined) return inBlock;
  // --- The next block that has a visible cell
  for (let b = here.block + (down ? 1 : -1); b >= 0 && b < layout.length; b += down ? 1 : -1) {
    const list = layout[b].ids.filter(visible).map((id) => ({ id, p: places.get(id)! }));
    const id = pickNearest(list, (rows) => (down ? Math.min(...rows) : Math.max(...rows)));
    if (id !== undefined) return id;
  }
  return current;
}

/** The partition set's ids in Bank map order */
export function bankMapOrder(set: PartitionInfoSet | undefined): number[] {
  return set ? set.layout.flatMap((b) => b.ids) : [];
}

/**
 * The 16K bank site of a byte of a RAM partition, for a bank-relative breakpoint
 * (`bp-set <bank>:+<offset>`, which fires wherever the bank is paged): a Next 8K page is half of a
 * 16K bank (`bank16`), a 16K RAM partition is its own bank. Checked against the machine's bank
 * space - the bank exists and maps back to this partition - so a ROM page, a DivMMC page or a
 * machine without bank breakpoints gets `undefined`.
 */
export function bankSiteOf(
  space: Pick<BankSpace, "bankBreakpoints" | "maxBank" | "partitionOf"> | undefined,
  partition: PartitionInfo,
  offset: number
): BankSite | undefined {
  if (!space?.bankBreakpoints) return undefined;
  let site: BankSite | undefined;
  if (partition.bank16) {
    site = { bank: partition.bank16.bank, offset: partition.bank16.half * 0x2000 + offset };
  } else if ((partition.kind === "ram" || partition.kind === "cardRam") && partition.size === 0x4000) {
    site = { bank: partition.id, offset };
  }
  if (!site || site.bank < 0 || site.bank > space.maxBank || site.offset < 0 || site.offset > 0x3fff) return undefined;
  const back = space.partitionOf(site);
  return back === undefined || back === partition.id ? site : undefined;
}

/** The registers that hold addresses, in the strip's order; the rest go behind `⋯` */
export const PRIMARY_REGISTERS = ["PC", "SP", "HL", "DE", "BC", "IX", "IY"] as const;
export const SECONDARY_REGISTERS = ["HL'", "DE'", "BC'", "IR", "WZ"] as const;

/** The register values of a `MemoryInfo`, by the names Go to and the strip use */
export function registerValuesOf(info: {
  pc: number;
  sp: number;
  hl: number;
  de: number;
  bc: number;
  ix: number;
  iy: number;
  hl_: number;
  de_: number;
  bc_: number;
  ir: number;
  wz: number;
}): Record<string, number> {
  return {
    PC: info.pc,
    SP: info.sp,
    HL: info.hl,
    DE: info.de,
    BC: info.bc,
    IX: info.ix,
    IY: info.iy,
    "HL'": info.hl_,
    "DE'": info.de_,
    "BC'": info.bc_,
    IR: info.ir,
    WZ: info.wz
  };
}

/** The flags chip's text, `SZ5H3PNC` with a cleared flag in lower case */
export function flagsText(f: number): string {
  const names = "SZ5H3PNC";
  let out = "";
  for (let bit = 7; bit >= 0; bit--) {
    const ch = names[7 - bit];
    out += (f >> bit) & 1 ? ch : ch.toLowerCase();
  }
  return out;
}
