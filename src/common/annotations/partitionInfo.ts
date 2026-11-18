/*
 * What each memory partition of a machine *is*: the model the Memory and Disassembly views' shared
 * frame reads (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §7) - the partition row's chips, the
 * Bank map's grid and the inspector's Location section.
 *
 * A machine already names its partitions (`getPartitionLabels/Descriptions/Groups`). This adds what
 * those maps cannot say: the partition's **kind** (ROM, RAM, a card's RAM, flash, an empty slot, a
 * mirror of another bank), its size, the card it belongs to, the 16K bank an 8K page is half of, and
 * how the Bank map lays the partitions out. The *roles* (which partition holds the ULA screen, the
 * Layer 2 picture, the tilemap) change while the machine runs, so they are computed apart
 * (`spectrumPartitionRoles`, `nextPartitionRoles`) on every refresh and never stored.
 *
 * Pure: every builder takes what the machine knows and returns plain data, so the emulator process
 * builds it and the renderer only draws it. No text is made here - names come from the machine's own
 * label maps, and anything the views spell out (a kind, a note about a card) is a fact the renderer
 * translates at display (`dev/ai/i18n-guide.md`, D7).
 */

/** What kind of memory a partition is */
export type PartitionKind =
  | "rom"
  | "ram"
  | "cardRam"
  | "flash"
  | "eprom"
  | "divRom"
  | "divRam"
  | "empty"
  | "mirror";

/** What the hardware uses a partition for right now (D8: from live register state only) */
export type PartitionRole = "ulaScreen" | "shadowScreen" | "layer2" | "layer2Shadow" | "tilemap";

/** Every role, in the order a legend lists them */
export const PARTITION_ROLES: readonly PartitionRole[] = [
  "ulaScreen",
  "shadowScreen",
  "layer2",
  "layer2Shadow",
  "tilemap"
];

/** The card a Z88 partition belongs to */
export type PartitionCard = {
  /** The slot, 0-3 */
  slot: number;
  /** What the card is; `empty` for a slot without one */
  kind: PartitionKind;
  /** The card's size in bytes (0 for an empty slot) */
  sizeInBytes: number;
  /** Slot 0's lower half is the ROM (OZ), its upper half the internal RAM */
  internal?: boolean;
};

/** One partition, as the shared frame shows it */
export type PartitionInfo = {
  /** The partition index, as every other API names it (`getPartitionLabels()` key) */
  id: number;
  /** The machine's own label (`R0`, `B3`, `0A`, `M3`) */
  name: string;
  /** The machine's long form ("Next ROM 0", "Bank $0A"), if it has one */
  description?: string;
  /** The machine's chooser caption ("DivMMC RAM"), if it has one */
  group?: string;
  kind: PartitionKind;
  /** 8K or 16K */
  size: number;
  /** The partition a mirror repeats (a Z88 card smaller than its slot) */
  mirrorOf?: number;
  /** The card the partition belongs to (Z88) */
  card?: PartitionCard;
  /** The 16K bank an 8K RAM page is half of (Next) */
  bank16?: { bank: number; half: 0 | 1 };
};

/**
 * One block of the Bank map. `chips` is a run of chips under a caption; `grid` lays the ids in rows
 * of `columns` with row and column headings (the Next's RAM pages, a Z88 slot's 64 banks).
 */
export type BankMapBlock = {
  /** Stable key, for React and for tests */
  key: string;
  /** The machine's caption for the block (a `getPartitionGroups()` string), if any */
  caption?: string;
  /** The Z88 slot the block shows; the renderer captions it */
  slot?: number;
  shape: "chips" | "grid";
  ids: number[];
  /** Cells per row of a grid */
  columns?: number;
};

/** Everything the frame needs about a machine's partitions that does not change while it runs */
export type PartitionInfoSet = {
  partitions: PartitionInfo[];
  layout: BankMapBlock[];
};

/** The common inputs: the machine's own maps */
export type PartitionNameMaps = {
  labels: Record<number, string>;
  descriptions?: Record<number, string>;
  groups?: Record<number, string>;
};

const KB8 = 0x2000;
const KB16 = 0x4000;

/** The partition ids of a label map, in the order choosers draw them (ROMs nearest zero first) */
export function sortedPartitionIds(labels: Record<number, string>): number[] {
  return Object.keys(labels ?? {})
    .map((key) => parseInt(key, 10))
    .filter((id) => !Number.isNaN(id))
    .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b));
}

function partitionOf(
  maps: PartitionNameMaps,
  id: number,
  kind: PartitionKind,
  size: number
): PartitionInfo {
  const info: PartitionInfo = { id, name: maps.labels[id] ?? String(id), kind, size };
  const description = maps.descriptions?.[id];
  if (description) info.description = description;
  const group = maps.groups?.[id];
  if (group) info.group = group;
  return info;
}

/** Consecutive ids sharing a group caption become one block */
function blocksByCaption(
  partitions: PartitionInfo[],
  shapeOf: (caption: string | undefined, ids: number[]) => Pick<BankMapBlock, "shape" | "columns">
): BankMapBlock[] {
  const blocks: BankMapBlock[] = [];
  for (const p of partitions) {
    const last = blocks[blocks.length - 1];
    if (last && last.caption === p.group) {
      last.ids.push(p.id);
    } else {
      blocks.push({ key: `b${blocks.length}`, caption: p.group, shape: "chips", ids: [p.id] });
    }
  }
  for (const block of blocks) Object.assign(block, shapeOf(block.caption, block.ids));
  return blocks;
}

/**
 * A machine nothing more is known about: a negative partition is ROM (every machine here numbers its
 * ROM and special pages downwards from -1), the rest RAM, all of one size. Runs of more than sixteen
 * become a grid of sixteen.
 * @param romIds Partitions the machine reports as ROM although their index is not negative
 */
export function genericPartitionInfo(
  maps: PartitionNameMaps,
  size = KB16,
  romIds: readonly number[] = []
): PartitionInfoSet {
  const partitions = sortedPartitionIds(maps.labels).map((id) =>
    partitionOf(maps, id, id < 0 || romIds.includes(id) ? "rom" : "ram", size)
  );
  return {
    partitions,
    layout: blocksByCaption(partitions, (_caption, ids) =>
      ids.length > 16 ? { shape: "grid", columns: 16 } : { shape: "chips" }
    )
  };
}

// ─── The ZX Spectrum family ───────────────────────────────────────────────────────────────────────

/** The DivMMC's partitions on a Spectrum (`divMmcCoreBridge.ts`): its 8K ROM and sixteen 8K RAM banks */
export const SPECTRUM_DIVMMC_ROM_PARTITION = -16;
export const SPECTRUM_DIVMMC_RAM_PARTITION_BASE = -32;

function spectrumKind(id: number): { kind: PartitionKind; size: number } {
  if (id === SPECTRUM_DIVMMC_ROM_PARTITION) return { kind: "divRom", size: KB8 };
  if (id <= SPECTRUM_DIVMMC_RAM_PARTITION_BASE && id > SPECTRUM_DIVMMC_RAM_PARTITION_BASE - 16) {
    return { kind: "divRam", size: KB8 };
  }
  return { kind: id < 0 ? "rom" : "ram", size: KB16 };
}

/**
 * The 128K, +2, +2A/+3, +3E and Scorpion: 16K ROM pages and RAM banks, and the DivMMC's 8K pages when
 * one is fitted. The Bank map is three runs of chips: the ROMs (with Interface 1 or TR-DOS), the RAM
 * banks and the DivMMC.
 */
export function spectrumPartitionInfo(maps: PartitionNameMaps): PartitionInfoSet {
  const partitions = sortedPartitionIds(maps.labels).map((id) => {
    const { kind, size } = spectrumKind(id);
    return partitionOf(maps, id, kind, size);
  });
  const rom = partitions.filter((p) => p.kind === "rom").map((p) => p.id);
  const ram = partitions.filter((p) => p.kind === "ram").map((p) => p.id);
  const div = partitions.filter((p) => p.kind === "divRom" || p.kind === "divRam").map((p) => p.id);
  const layout: BankMapBlock[] = [];
  if (rom.length) layout.push({ key: "rom", shape: "chips", ids: rom });
  if (ram.length) layout.push({ key: "ram", shape: ram.length > 16 ? "grid" : "chips", ids: ram, columns: 16 });
  if (div.length) layout.push({ key: "div", caption: maps.groups?.[div[0]], shape: "chips", ids: div });
  return { partitions, layout };
}

/**
 * The 128K family's roles: bank 5 holds the normal screen, bank 7 the shadow one, whichever the ULA
 * is showing. Static on these machines, but computed like the Next's so the frame has one path.
 */
export function spectrumPartitionRoles(): Record<number, PartitionRole[]> {
  return { 5: ["ulaScreen"], 7: ["shadowScreen"] };
}

// ─── The Cambridge Z88 ────────────────────────────────────────────────────────────────────────────

/** A Z88 slot's card, as the machine knows it (`Z88CardSpec`, reduced to what the frame shows) */
export type Z88SlotCard = {
  kind: "ram" | "rom" | "eprom" | "flash";
  sizeInBytes: number;
};

export type Z88PartitionInput = {
  labels: Record<number, string>;
  /** Slots 0-3; slot 0 is the ROM card, `undefined` an empty slot */
  slots: (Z88SlotCard | undefined)[];
  /** The internal RAM's size (banks $20-$3F), `MC_Z88_INTRAM` resolved */
  internalRamBytes: number;
};

/** The banks a card of this size fills (a 32K card is two 16K banks) */
function banksOf(sizeInBytes: number): number {
  return Math.max(0, Math.min(64, Math.floor(sizeInBytes / KB16)));
}

/**
 * The Z88's 256 banks as four card slots of 64 (`z88-memory.c`): a card smaller than its window is
 * decoded through its chip mask and so repeats across it. The slot 0 ROM and the internal RAM sit at
 * the bottom of their 32-bank halves (OZ boots from bank $00, the RAM starts at $20); a card in slots
 * 1-3 sits at the top of its slot, where OZ looks for its header, so its banks are the topmost ones
 * and everything below repeats them. An empty slot is `empty`, all 64 banks.
 */
export function z88PartitionInfo(input: Z88PartitionInput): PartitionInfoSet {
  const partitions: PartitionInfo[] = [];
  const add = (id: number, kind: PartitionKind, card: PartitionCard, mirrorOf?: number) => {
    const p: PartitionInfo = { id, name: input.labels[id] ?? String(id), kind, size: KB16, card };
    if (mirrorOf !== undefined) p.mirrorOf = mirrorOf;
    partitions.push(p);
  };

  /** Fill a window of banks with a card: the real banks, then mirrors of them */
  const fill = (
    first: number,
    count: number,
    cardBytes: number,
    kind: PartitionKind,
    card: PartitionCard,
    alignTop: boolean
  ) => {
    const n = banksOf(cardBytes);
    if (n === 0) {
      for (let i = 0; i < count; i++) add(first + i, "empty", { ...card, kind: "empty", sizeInBytes: 0 });
      return;
    }
    const realFirst = alignTop ? first + count - Math.min(n, count) : first;
    for (let i = 0; i < count; i++) {
      const id = first + i;
      const offset = id - realFirst;
      if (offset >= 0 && offset < n) {
        add(id, kind, card);
      } else {
        // --- The chip decodes only its own address lines: bank `id` reads the real bank with the
        // --- same low bits
        const real = realFirst + (((offset % n) + n) % n);
        add(id, "mirror", card, real);
      }
    }
  };

  const kindOf = (card: Z88SlotCard, slot: number): PartitionKind =>
    card.kind === "ram" ? (slot === 0 ? "ram" : "cardRam") : card.kind;

  // --- Slot 0: the ROM card in $00-$1F, the internal RAM in $20-$3F
  const rom = input.slots[0];
  if (rom) {
    fill(0x00, 0x20, rom.sizeInBytes, kindOf(rom, 0), { slot: 0, kind: kindOf(rom, 0), sizeInBytes: rom.sizeInBytes, internal: true }, false);
  } else {
    fill(0x00, 0x20, 0, "empty", { slot: 0, kind: "empty", sizeInBytes: 0, internal: true }, false);
  }
  fill(0x20, 0x20, input.internalRamBytes, "ram", { slot: 0, kind: "ram", sizeInBytes: input.internalRamBytes, internal: true }, false);

  // --- Slots 1-3: a card each, at the top of the slot
  for (let slot = 1; slot < 4; slot++) {
    const card = input.slots[slot];
    const kind = card ? kindOf(card, slot) : "empty";
    fill(slot * 0x40, 0x40, card?.sizeInBytes ?? 0, kind, { slot, kind, sizeInBytes: card?.sizeInBytes ?? 0 }, true);
  }

  const layout: BankMapBlock[] = [0, 1, 2, 3].map((slot) => ({
    key: `slot${slot}`,
    slot,
    shape: "grid" as const,
    columns: 16,
    ids: Array.from({ length: 0x40 }, (_, i) => slot * 0x40 + i)
  }));
  return { partitions, layout };
}

// ─── The ZX Spectrum Next ─────────────────────────────────────────────────────────────────────────

/** The KS3's Upper RAM pages are numbered from here (`nextMachineInfo.ts`) */
export const NEXT_UPPER_PARTITION_FIRST = 256;
/** The 2 MB board's RAM pages: 0-223 */
export const NEXT_RAM_PAGE_COUNT = 224;

export type NextPartitionInput = PartitionNameMaps & {
  /** A 4 MB KS3 board, with 256 Upper RAM pages */
  upperRam?: boolean;
};

/**
 * The Next's partitions (`nextMachineInfo.ts`): the four Next ROMs and two Alt ROMs (16K each, named
 * by 16K page), the DivMMC ROM (8K) and RAM (sixteen 8K banks), and the RAM pages - 224 8K pages, 256
 * more on a KS3. A RAM page is half of a 16K bank: page 2B is its low half, 2B+1 its high half.
 */
export function nextPartitionInfo(input: NextPartitionInput): PartitionInfoSet {
  const partitions = sortedPartitionIds(input.labels).map((id) => {
    let kind: PartitionKind;
    let size = KB8;
    if (id >= -4 && id <= -1) {
      kind = "rom";
      size = KB16;
    } else if (id === -5 || id === -6) {
      kind = "rom";
      size = KB16;
    } else if (id === -7) {
      kind = "divRom";
    } else if (id <= -8) {
      kind = "divRam";
    } else {
      kind = "ram";
    }
    const info = partitionOf(input, id, kind, size);
    if (kind === "ram") {
      const page = id >= NEXT_UPPER_PARTITION_FIRST ? id - NEXT_UPPER_PARTITION_FIRST : id;
      const bank = (id >= NEXT_UPPER_PARTITION_FIRST ? NEXT_RAM_PAGE_COUNT : 0) + page;
      info.bank16 = { bank: Math.floor(bank / 2), half: (bank % 2) as 0 | 1 };
    }
    return info;
  });
  const ids = (pred: (id: number) => boolean) => partitions.map((p) => p.id).filter(pred);
  const caption = (id: number) => input.groups?.[id];
  const layout: BankMapBlock[] = [
    { key: "rom", caption: caption(-1), shape: "chips", ids: ids((id) => id <= -1 && id >= -4) },
    { key: "altRom", caption: caption(-5), shape: "chips", ids: ids((id) => id === -5 || id === -6) },
    { key: "divRom", caption: caption(-7), shape: "chips", ids: ids((id) => id === -7) },
    { key: "divRam", caption: caption(-8), shape: "grid", columns: 16, ids: ids((id) => id <= -8) },
    { key: "ram", caption: caption(0), shape: "grid", columns: 16, ids: ids((id) => id >= 0 && id < NEXT_UPPER_PARTITION_FIRST) }
  ];
  if (input.upperRam) {
    layout.push({
      key: "upper",
      caption: caption(NEXT_UPPER_PARTITION_FIRST),
      shape: "grid",
      columns: 16,
      ids: ids((id) => id >= NEXT_UPPER_PARTITION_FIRST)
    });
  }
  return { partitions, layout: layout.filter((block) => block.ids.length > 0) };
}

/** The Next registers the roles are read from */
export type NextRoleInput = {
  /** NextReg $12: Layer 2's displayed 16K bank */
  layer2Bank: number;
  /** NextReg $13: Layer 2's shadow 16K bank */
  layer2ShadowBank: number;
  /** How many 16K banks a Layer 2 picture takes at the current resolution (3 or 5) */
  layer2Banks: number;
  /** NextReg $6E: the tilemap is in bank 7 (bit 7), at this MSB of the offset (bits 5-0) */
  tilemapBank7: boolean;
  tilemapMsb: number;
  /** NextReg $6F: the tile definitions, the same way */
  tileDefBank7: boolean;
  tileDefMsb: number;
};

/** The 8K page of an offset in bank 5 or 7 */
function ulaBankPage(bank7: boolean, msb: number): number {
  return (bank7 ? 0x0e : 0x0a) + ((msb & 0x3f) >= 0x20 ? 1 : 0);
}

/**
 * Which 8K pages hold what right now, from the Next's registers (D8: never from the program's
 * labels). Bank 5's low page is the ULA screen and bank 7's the shadow screen; the Layer 2 sets are
 * the banks from `$12` and `$13` on; the tilemap and its tile definitions are where `$6E` and `$6F`
 * point. A page past the RAM is left out.
 */
export function nextPartitionRoles(input: NextRoleInput, upperRam = false): Record<number, PartitionRole[]> {
  const roles: Record<number, PartitionRole[]> = {};
  const lastPage = NEXT_RAM_PAGE_COUNT - 1;
  const add = (page: number, role: PartitionRole) => {
    if (page < 0 || page > lastPage) {
      if (!upperRam || page < NEXT_RAM_PAGE_COUNT) return;
      const upper = page - NEXT_RAM_PAGE_COUNT;
      if (upper >= 256) return;
      page = NEXT_UPPER_PARTITION_FIRST + upper;
    }
    const list = (roles[page] ??= []);
    if (!list.includes(role)) list.push(role);
  };
  add(0x0a, "ulaScreen");
  add(0x0e, "shadowScreen");
  const count = Math.max(1, input.layer2Banks | 0);
  for (let i = 0; i < count; i++) {
    const bank = (input.layer2Bank & 0x7f) + i;
    add(bank * 2, "layer2");
    add(bank * 2 + 1, "layer2");
    const shadow = (input.layer2ShadowBank & 0x7f) + i;
    add(shadow * 2, "layer2Shadow");
    add(shadow * 2 + 1, "layer2Shadow");
  }
  add(ulaBankPage(input.tilemapBank7, input.tilemapMsb), "tilemap");
  add(ulaBankPage(input.tileDefBank7, input.tileDefMsb), "tilemap");
  return roles;
}

// ─── Lookups the views share ──────────────────────────────────────────────────────────────────────

/** A partition by id, built once per set */
export function partitionIndex(set: PartitionInfoSet | undefined): Map<number, PartitionInfo> {
  return new Map((set?.partitions ?? []).map((p) => [p.id, p]));
}

/** Whether a partition's bytes can be written from the IDE */
export function isWritableKind(kind: PartitionKind | undefined): boolean {
  return kind === undefined || kind === "ram" || kind === "cardRam" || kind === "divRam" || kind === "mirror";
}
