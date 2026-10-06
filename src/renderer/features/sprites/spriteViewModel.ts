/*
 * The Sprite Inspector's view model (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.4-§4.5). Pure: a snapshot
 * in, rows, cells, strip items and map shapes out, so the document's logic is tested without React.
 */

import type { NextSpriteState } from "@common/messaging/EmuApi";
import {
  decodeResolvedSprites,
  decodeSpriteSlots,
  findAnchor,
  formatSpritePattern,
  formatSpriteType,
  patternSlotOf,
  type DecodedSpriteSlot,
  type ResolvedSprite
} from "@common/zxnext/sprites/spriteAttributes";
import { spriteDiagnostics, type SpriteDiagnostic } from "@common/zxnext/sprites/spriteDiagnostics";
import {
  effectiveClipWindow,
  PAPER_RECT,
  spriteRect,
  type SpriteSpaceRect
} from "@common/zxnext/sprites/spriteGeometry";
import type { NexSpriteFormat } from "@common/zxnext/sprites/spritePatterns";
import {
  patternUsage,
  slotFormatAsUsed,
  slotUsers,
  type PatternSlotUsage
} from "@common/zxnext/sprites/spriteUsage";

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

// --- The model

export type SpriteModel = {
  state: NextSpriteState;
  slots: DecodedSpriteSlot[];
  resolved: ResolvedSprite[];
  usage: PatternSlotUsage[];
  /** `$15` decoded */
  enabled: boolean;
  overBorder: boolean;
  clippingEnabled: boolean;
  sprite0OnTop: boolean;
  /** `$15` bits 4-2 */
  layerPriority: number;
  /** The effective clip window in sprite space (T8) */
  clip: SpriteSpaceRect;
};

export function buildSpriteModel(state: NextSpriteState): SpriteModel {
  const slots = decodeSpriteSlots(state.attributes);
  const resolved = decodeResolvedSprites(state.resolved);
  const overBorder = (state.control & 0x02) !== 0;
  const clippingEnabled = (state.control & 0x20) !== 0;
  return {
    state,
    slots,
    resolved,
    usage: patternUsage(slots, resolved),
    enabled: (state.control & 0x01) !== 0,
    overBorder,
    clippingEnabled,
    sprite0OnTop: (state.control & 0x40) !== 0,
    layerPriority: (state.control >> 2) & 0x07,
    clip: effectiveClipWindow(state.clip, overBorder, clippingEnabled)
  };
}

/** The diagnostics of one slot, with the full snapshot as context. */
export function diagnosticsOf(model: SpriteModel, index: number): SpriteDiagnostic[] {
  return spriteDiagnostics(index, {
    slots: model.slots,
    resolved: model.resolved,
    spritesEnabled: model.enabled,
    clip: model.clip,
    patterns: model.state.patterns,
    transparencyIndex: model.state.transparencyIndex
  });
}

// --- The globals strip (§4.4, T12)

/** `$15` bits 4-2, as the layer order from top to bottom. */
const LAYER_ORDERS = ["SLU", "LSU", "SUL", "LUS", "USL", "ULS", "S(U+L)", "S(U-L)"];

export type GlobalsItem = {
  key: string;
  value: string;
  title?: string;
  /** Drawn as a flag that wants attention (a raised status bit, the sprite layer off) */
  flag?: boolean;
  /** Shown even when the strip is collapsed to one line (flags always are) */
  primary?: boolean;
};

/**
 * The strip in display order: flags first, then the primary items, then the rest. The collapsed
 * strip shows the flags and the primary items; the rest wait behind "+n more".
 */
export function orderGlobals(items: GlobalsItem[]): GlobalsItem[] {
  const rank = (g: GlobalsItem) => (g.flag ? 0 : g.primary ? 1 : 2);
  return items.map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g);
}

export function globalsStrip(model: SpriteModel): GlobalsItem[] {
  const { state, clip } = model;
  const [x1, x2, y1, y2] = state.clip;
  const statusFlags = [state.status.tooMany && "too many", state.status.collision && "collision"].filter(
    Boolean
  ) as string[];
  const u = state.upload;
  return [
    {
      key: "Sprites",
      value: model.enabled ? "ON" : "OFF",
      flag: !model.enabled,
      primary: true,
      title: "NextReg $15 bit 0: the sprite layer is shown"
    },
    {
      key: "Over border",
      value: model.overBorder ? "yes" : "no",
      title: "NextReg $15 bit 1: sprites are drawn over the border"
    },
    {
      key: "Clip",
      primary: true,
      value: model.overBorder && !model.clippingEnabled
        ? "off (whole 320×256)"
        : `(${clip.x1},${clip.y1})-(${clip.x2},${clip.y2})`,
      title:
        `The effective clip window in sprite space.\n$19 = ${x1}, ${x2}, ${y1}, ${y2} (x1, x2, y1, y2); next write sets #${state.clipIndex}.\n` +
        (model.overBorder
          ? model.clippingEnabled
            ? "Over border with clipping ($15 bit 5): X is doubled."
            : "Over border without clipping ($15 bit 5 clear): no clip."
          : "Without over border the window is paper-relative (+32), and Y stops at 223.")
    },
    {
      key: "Order",
      value: LAYER_ORDERS[model.layerPriority],
      title: "NextReg $15 bits 4-2: the layer order, top first (S sprites, L Layer 2, U ULA)"
    },
    {
      key: "On top",
      value: model.sprite0OnTop ? "#0" : "#127",
      title: "NextReg $15 bit 6: which sprite wins where two overlap"
    },
    {
      key: "$4B",
      value: hex2(state.transparencyIndex),
      title: "The sprite transparency index (4-bit sprites use its low nibble)"
    },
    {
      key: "Last visible",
      primary: true,
      value: state.lastVisible < 0 ? "none" : `#${state.lastVisible}`,
      title: "The highest slot with its visible bit set: the engine does not look past it"
    },
    {
      key: "Status",
      value: statusFlags.length ? statusFlags.join(", ") : "clear",
      flag: statusFlags.length > 0,
      title: "Port $303B, peeked: reading it here does not clear it for the program"
    },
    {
      key: "Upload",
      value: `#${u.spriteIndex}.${u.spriteSub} pat ${u.patternIndex}.${hex2(u.patternSub)}`,
      title:
        `Port $57 writes attribute byte ${u.spriteSub} of sprite #${u.spriteIndex}.\n` +
        `Port $5B writes byte ${hex2(u.patternSub)} of pattern slot ${u.patternIndex} (pattern RAM ${hex4(
          (u.patternIndex << 8) | u.patternSub
        )}).`
    },
    {
      key: "Mirror",
      value: `#${u.mirrorIndex & 0x7f}${u.tied ? " (tied)" : ""}`,
      title:
        "NextReg $34: the sprite the attribute mirrors ($35-$39, $75-$79) write." +
        (u.tied ? "\nNextReg $09 bit 4 ties it to the port $57 upload index." : "")
    }
  ];
}

// --- The Sprites view (§4.5.1)

export type SpriteFilter = "all" | "upToLastVisible" | "visible" | "nonEmpty";

export const SPRITE_FILTERS: { value: SpriteFilter; label: string }[] = [
  { value: "upToLastVisible", label: "Up to last visible" },
  { value: "all", label: "All 128" },
  { value: "visible", label: "Visible only" },
  { value: "nonEmpty", label: "Non-empty" }
];

export type SpriteRow = {
  index: number;
  slot: DecodedSpriteSlot;
  resolved: ResolvedSprite;
  /** The anchor slot of a relative, or `undefined` */
  anchor?: number;
  /** `effective`: drawn; `hiddenByAnchor`: its own bit is set, the anchor's is not; `clear` */
  visibility: "effective" | "hiddenByAnchor" | "clear";
  /** The full form, `40` or `81 (40·hi)` (T7), for tooltips */
  pattern: string;
  /** The number alone, as the pinned column shows it: `40`, or `81` for a 4-bit pattern */
  patternNumber: string;
  /** The 256-byte slot the thumbnail shows, and which 4-bit half */
  patternSlot: number;
  patternHalf?: 0 | 1;
  /** The effective position, and a relative's own offset */
  x: number;
  y: number;
  delta?: string;
  /** `8`, or `4·lo` / `4·hi`: which half of the 256-byte slot a 4-bit sprite reads */
  format: string;
  palette: string;
  scale: string;
  type: string;
  raw: string[];
  diagnostics: SpriteDiagnostic[];
  changed: boolean;
};

const isEmpty = (slot: DecodedSpriteSlot) => slot.raw.every((b) => b === 0);
const signed = (v: number) => (v < 0 ? `−${-v}` : `+${v}`);
const SCALES = ["1", "2", "4", "8"];

/** The filter the document opens with: *Up to last visible*, or *All* when nothing is visible. */
export function defaultFilter(state: NextSpriteState): SpriteFilter {
  return state.lastVisible < 0 ? "all" : "upToLastVisible";
}

/**
 * The table's rows (a pure function of the snapshot and the filter).
 * @param changed The slots whose raw bytes changed since the previous stop (D16)
 */
export function spriteRows(model: SpriteModel, filter: SpriteFilter, changed?: ReadonlySet<number>): SpriteRow[] {
  const { slots, resolved, state } = model;
  const rows: SpriteRow[] = [];
  for (let i = 0; i < 128; i++) {
    const slot = slots[i];
    const r = resolved[i];
    if (filter === "upToLastVisible" && i > state.lastVisible) break;
    if (filter === "visible" && !r.visible) continue;
    if (filter === "nonEmpty" && isEmpty(slot)) continue;
    const relative = slot.kind === "relative";
    rows.push({
      index: i,
      slot,
      resolved: r,
      anchor: findAnchor(slots, i),
      visibility: r.visible ? "effective" : slot.visibleBit ? "hiddenByAnchor" : "clear",
      pattern: formatSpritePattern(r.fourBit, r.pattern7),
      patternNumber: String(r.fourBit ? r.pattern7 : r.pattern7 >> 1),
      patternSlot: patternSlotOf(r),
      patternHalf: r.fourBit ? ((r.pattern7 & 1) as 0 | 1) : undefined,
      x: r.x,
      y: r.y,
      delta: relative ? `Δ${signed(slot.dx!)},${signed(slot.dy!)}` : undefined,
      format: r.fourBit ? `4·${r.pattern7 & 1 ? "hi" : "lo"}` : "8",
      palette: relative && slot.paletteRelative ? `+${slot.paletteOffset}` : String(r.paletteOffset),
      scale: `${SCALES[r.scaleX]}×${SCALES[r.scaleY]}`,
      type: formatSpriteType(slots, i),
      raw: slot.raw.map(hex2),
      diagnostics: diagnosticsOf(model, i),
      changed: changed?.has(i) ?? false
    });
  }
  return rows;
}

/** The slots whose five raw bytes differ between two attribute snapshots. */
export function changedSlots(before: ArrayLike<number> | undefined, after: ArrayLike<number>): Set<number> {
  const out = new Set<number>();
  if (!before) return out;
  for (let i = 0; i < 128; i++) {
    for (let k = 0; k < 5; k++) {
      if (before[i * 5 + k] !== after[i * 5 + k]) {
        out.add(i);
        break;
      }
    }
  }
  return out;
}

/** "Copy attributes as nextreg": the mirror writes that recreate the slot. */
export function attributesAsNextreg(slot: DecodedSpriteSlot): string {
  const lines = [`nextreg $34,${slot.index}`];
  slot.raw.slice(0, slot.attr4Ignored ? 4 : 5).forEach((b, k) => lines.push(`nextreg $${(0x35 + k).toString(16).toUpperCase()},${hex2(b)}`));
  return lines.join("\n");
}

/** "Copy attributes as .db": the bytes port `$57` takes, 4 or 5. */
export function attributesAsDb(slot: DecodedSpriteSlot): string {
  return `.db ${slot.raw.slice(0, slot.attr4Ignored ? 4 : 5).map(hex2).join(",")}`;
}

// --- The Patterns view (§4.5.2)

export type PatternFormatMode = "asUsed" | "8bit" | "4bit";

export type PatternCell = {
  /** The cell's index in the sheet */
  index: number;
  /** The 256-byte slot, `0..63` */
  slot: number;
  format: NexSpriteFormat;
  /** A 4-bit cell's half: 0 the low 128 bytes, 1 the high */
  half?: 0 | 1;
  /** The number `patternPixels` takes: the slot (8-bit) or `slot * 2 + half` (4-bit) */
  pattern: number;
  /** The users of this cell: the sprites reading it in this format (and half) */
  users: number[];
  visibleUsers: number[];
  mixed: boolean;
  /** A label: `#40`, or `#81` with `40·hi` */
  number: string;
  secondary?: string;
};

/**
 * The sheet's cells. *8-bit* is 64 cells, *4-bit* 128; *As used* draws each slot the way its users
 * read it - one 8-bit cell or two 4-bit halves - and an unused one in `fallback` (D17).
 */
export function patternCells(model: SpriteModel, mode: PatternFormatMode, fallback: NexSpriteFormat): PatternCell[] {
  const cells: PatternCell[] = [];
  for (const u of model.usage) {
    const format = mode === "asUsed" ? slotFormatAsUsed(u, fallback) : mode;
    if (format === "8bit") {
      cells.push({
        index: cells.length,
        slot: u.slot,
        format,
        pattern: u.slot,
        users: u.users8,
        visibleUsers: u.visibleUsers.filter((i) => u.users8.includes(i)),
        mixed: u.mixed,
        number: `#${u.slot}`
      });
    } else {
      for (const half of [0, 1] as const) {
        const pattern = u.slot * 2 + half;
        const users = u.users4.filter((i) => (model.resolved[i].pattern7 & 1) === half);
        cells.push({
          index: cells.length,
          slot: u.slot,
          format,
          half,
          pattern,
          users,
          visibleUsers: u.visibleUsers.filter((i) => users.includes(i)),
          mixed: u.mixed,
          number: `#${pattern}`,
          secondary: `${u.slot}·${half ? "hi" : "lo"}`
        });
      }
    }
  }
  return cells;
}

/** The cell a sprite's pattern is drawn in, if the sheet shows it in that sprite's format. */
export function cellOfSprite(cells: PatternCell[], sprite: ResolvedSprite): PatternCell | undefined {
  const slot = patternSlotOf(sprite);
  return cells.find(
    (c) =>
      c.slot === slot &&
      (sprite.fourBit ? c.format === "4bit" && c.half === (sprite.pattern7 & 1) : c.format === "8bit")
  ) ?? cells.find((c) => c.slot === slot);
}

/** The cell that holds a `show-patterns <n>` number (an 8-bit slot number, `0..63`). */
export function cellOfSlot(cells: PatternCell[], slot: number): PatternCell | undefined {
  return cells.find((c) => c.slot === (slot & 0x3f));
}

/** The palette offset a cell is drawn with: *Fixed n*, or *From sprite* (its first visible user's). */
export function cellPaletteOffset(model: SpriteModel, cell: PatternCell, fixed: number | "fromSprite"): number {
  if (fixed !== "fromSprite") return fixed;
  const first = cell.visibleUsers[0] ?? cell.users[0];
  return first === undefined ? 0 : model.resolved[first].paletteOffset;
}

/** The cell the next `$5B` byte writes into (the upload cursor, T12). */
export function uploadCell(model: SpriteModel, cells: PatternCell[]): PatternCell | undefined {
  const { patternIndex, patternSub } = model.state.upload;
  return cells.find(
    (c) => c.slot === patternIndex && (c.format === "8bit" || c.half === (patternSub >> 7))
  );
}

/** The byte range of a cell in pattern RAM. */
export function cellRange(cell: PatternCell): { start: number; end: number } {
  if (cell.format === "8bit") return { start: cell.slot * 256, end: cell.slot * 256 + 255 };
  const start = cell.pattern * 128;
  return { start, end: start + 127 };
}

/** All users of a slot, any format: the inspector's "used by". */
export function usersOfSlot(model: SpriteModel, slot: number): number[] {
  return slotUsers(model.usage[slot & 0x3f]);
}

// --- Selection (§4.5.3, Phase 7)

export type SpriteSelection =
  | { kind: "sprite"; index: number }
  | { kind: "pattern"; slot: number; half?: 0 | 1 };

/**
 * Keeps the two views in step: selecting a sprite selects its pattern's cell in the sheet, and
 * selecting a cell selects that pattern. Returns the highlighted cell, the highlighted rows, and the
 * selected sprite (when the selection is one).
 */
export function syncSelection(
  model: SpriteModel,
  cells: PatternCell[],
  selection: SpriteSelection | undefined
): { cell?: PatternCell; rows: number[]; sprite?: number } {
  if (!selection) return { rows: [] };
  if (selection.kind === "sprite") {
    const sprite = model.resolved[selection.index];
    return { cell: sprite ? cellOfSprite(cells, sprite) : undefined, rows: [selection.index], sprite: selection.index };
  }
  const cell =
    cells.find((c) => c.slot === selection.slot && (selection.half === undefined || c.half === selection.half)) ??
    cellOfSlot(cells, selection.slot);
  return { cell, rows: cell ? cell.users : usersOfSlot(model, selection.slot) };
}

// --- The sprite-space map (§4.5.3)

export type SpriteMapShape = {
  index: number;
  rect: SpriteSpaceRect;
  selected: boolean;
};

export type SpriteMap = {
  width: number;
  height: number;
  paper: SpriteSpaceRect;
  clip: SpriteSpaceRect;
  sprites: SpriteMapShape[];
};

/**
 * Every visible sprite's outline in sprite space, with the paper and the clip window. `selected` is
 * one sprite, or several (a pattern's users); a selected sprite is drawn even when it is hidden.
 */
export function spriteMap(model: SpriteModel, selected?: number | readonly number[]): SpriteMap {
  const chosen = new Set(selected === undefined ? [] : typeof selected === "number" ? [selected] : selected);
  return {
    width: 320,
    height: 256,
    paper: PAPER_RECT,
    clip: model.clip,
    sprites: model.resolved
      .filter((r) => r.visible || chosen.has(r.index))
      .map((r) => ({ index: r.index, rect: spriteRect(r), selected: chosen.has(r.index) }))
  };
}

/**
 * The sprite under a map point, the topmost first: with sprite 0 on top the lowest index wins,
 * otherwise the highest (a later sprite overwrites an earlier one).
 */
export function spriteAtMapPoint(map: SpriteMap, x: number, y: number, sprite0OnTop: boolean): number | undefined {
  const hits = map.sprites.filter(
    (s) => x >= s.rect.x1 && x <= s.rect.x2 && y >= s.rect.y1 && y <= s.rect.y2
  );
  if (!hits.length) return undefined;
  return sprite0OnTop ? hits[0].index : hits[hits.length - 1].index;
}

// --- Change detection and hashing (T9)

/** FNV-1a over the bytes: the Patterns view re-decodes its sheet only when this changes. */
export function hashBytes(bytes: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// --- The inspector (§4.5.3)

export type SpriteField = {
  name: string;
  /** The effective value: what the engine draws */
  value: string;
  /** The slot's own reading, when it differs (a relative's offset, a palette added to the anchor's) */
  own?: string;
};

const SCALE_FACTORS = ["1", "2", "4", "8"];
const yesNo = (v: boolean | undefined) => (v ? "yes" : "no");
const xform = (r: { rotate: boolean; xmirror: boolean; ymirror: boolean }) =>
  `${r.rotate ? "R" : "-"}${r.xmirror ? "X" : "-"}${r.ymirror ? "Y" : "-"}`;

/**
 * A sprite's fields for the inspector: two columns, the effective value and - only where it differs -
 * what the slot's own bytes say. The raw bytes are not a field; the pane draws them itself.
 */
export function spriteFields(model: SpriteModel, index: number): SpriteField[] {
  const slot = model.slots[index];
  const r = model.resolved[index];
  const relative = slot.kind === "relative";
  const anchor = findAnchor(model.slots, index);
  const fields: SpriteField[] = [];
  fields.push({
    name: "Type",
    value: slot.kind === "anchor4" ? "anchor, 4-byte" : slot.kind === "anchor5" ? "anchor, 5-byte" : "relative",
    own: relative
      ? anchor === undefined
        ? "no anchor"
        : `anchor #${anchor}, ${model.slots[anchor].relType}`
      : slot.kind === "anchor5"
        ? `relatives ${slot.relType}`
        : undefined
  });
  fields.push({
    name: "Visible",
    value: yesNo(r.visible),
    own: slot.visibleBit !== r.visible ? `own bit ${yesNo(slot.visibleBit)}` : undefined
  });
  fields.push({ name: "X", value: String(r.x), own: relative ? `own Δ${signed(slot.dx!)}` : undefined });
  fields.push({ name: "Y", value: String(r.y), own: relative ? `own Δ${signed(slot.dy!)}` : undefined });
  const ownPattern = relative
    ? `own ${slot.pattern6}${slot.n6 ? "+N6" : ""}${slot.patternRelative ? " + anchor's" : ""}`
    : undefined;
  const effectivePattern = formatSpritePattern(r.fourBit, r.pattern7);
  fields.push({
    name: "Pattern",
    value: effectivePattern,
    own: relative && (slot.patternRelative || slot.pattern6 !== patternSlotOf(r)) ? ownPattern : undefined
  });
  fields.push({ name: "Format", value: r.fourBit ? "4-bit" : "8-bit", own: relative ? "from anchor" : undefined });
  fields.push({
    name: "Palette",
    value: String(r.paletteOffset),
    own: relative && slot.paletteRelative ? `own +${slot.paletteOffset}` : undefined
  });
  const ownXform = xform(slot);
  fields.push({ name: "Transform", value: xform(r), own: ownXform !== xform(r) ? `own ${ownXform}` : undefined });
  const scale = `${SCALE_FACTORS[r.scaleX]}×${SCALE_FACTORS[r.scaleY]}`;
  const ownScale = `${SCALE_FACTORS[slot.scaleX]}×${SCALE_FACTORS[slot.scaleY]}`;
  fields.push({ name: "Scale", value: scale, own: ownScale !== scale ? `own ${ownScale}` : undefined });
  return fields;
}

/** The inspector's one-line summary of a sprite: `drawn · 120,69 · pattern 9 · 8-bit`. */
export function spriteSummary(model: SpriteModel, index: number): string {
  const r = model.resolved[index];
  const hidden = diagnosticsOf(model, index).some((d) => d.level === "hidden");
  return [
    r.visible && !hidden ? "drawn" : "hidden",
    `${r.x},${r.y}`,
    `pattern ${formatSpritePattern(r.fourBit, r.pattern7)}`,
    r.fourBit ? "4-bit" : "8-bit"
  ].join(" · ");
}
