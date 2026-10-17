/*
 * Tilemap diagnostics (`.plans/TILEMAP_INSPECTOR_PLAN.md` D10, T1, T7). Pure.
 *
 * Overlap is the commonest tilemap bug and invisible until the program writes, so the map, the
 * definitions of the tiles the map uses, the ULA bitmap and the ULA attributes are checked against
 * one another. Overlap is a *warning*: sharing bank 5 is legal and often deliberate (T7), and the ULA
 * ranges are left out when `$68` bit 7 turns the ULA off.
 */
import {
  vramOffset,
  type DecodedCell,
  type TilemapMode,
  type TilemapRegs
} from "./tilemapDecode";
import type { MessageArgs } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import { withTranslatedTexts } from "../translatedTexts";

export type TilemapDiagnosticLevel = "warning" | "info";

export type TilemapDiagnostic = {
  level: TilemapDiagnosticLevel;
  /** Stable key */
  id: string;
  /** The chip's text, in the current language on each read */
  readonly chip: string;
  /** One sentence for the tooltip and the inspector, in the current language on each read */
  readonly sentence: string;
};

function diagnostic(
  id: string,
  level: TilemapDiagnosticLevel,
  chip: MessageKey,
  sentence: MessageKey,
  args?: MessageArgs
): TilemapDiagnostic {
  return withTranslatedTexts({ id, level }, { chip: { key: chip, args }, sentence: { key: sentence, args } });
}

/** A byte range in a bank, as half-open spans (a range that wraps has two). */
export type BankRange = {
  /** A stable id (`map`, `tiles`, `ulaBitmap`, ...), not display text */
  name: string;
  bank: 5 | 7;
  spans: [number, number][];
};

const bankSize = (bank: 5 | 7) => (bank === 7 ? 0x2000 : 0x4000);

/** `length` bytes from `start`, wrapped at the bank's end (8K for bank 7, 16K for bank 5; T1). */
export function bankRange(name: string, bank: 5 | 7, start: number, length: number): BankRange {
  const size = bankSize(bank);
  const len = Math.min(length, size);
  const end = start + len;
  return { name, bank, spans: end <= size ? [[start, end]] : [[start, size], [0, end - size]] };
}

/** Merges sorted or unsorted spans into a minimal list. */
function mergeSpans(spans: [number, number][]): [number, number][] {
  const sorted = spans.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** The overlapping bytes of two ranges, as spans; empty when they are in different banks. */
export function overlapOf(a: BankRange, b: BankRange): [number, number][] {
  if (a.bank !== b.bank) return [];
  const out: [number, number][] = [];
  for (const [a1, a2] of a.spans) {
    for (const [b1, b2] of b.spans) {
      const s = Math.max(a1, b1);
      const e = Math.min(a2, b2);
      if (s < e) out.push([s, e]);
    }
  }
  return mergeSpans(out);
}

/** The map's bytes. */
export function mapRange(mode: TilemapMode, regs: TilemapRegs): BankRange {
  const bank = regs.mapBank7 ? 7 : 5;
  return bankRange("map", bank, vramOffset(regs.mapBank7, regs.mapMsb, 0), mode.mapLength);
}

/** The whole definitions table: 256 or 512 tiles of 32 bytes, or 8 in text mode (T3, T4). */
export function definitionsRange(mode: TilemapMode, regs: TilemapRegs): BankRange {
  const bank = regs.defBank7 ? 7 : 5;
  return bankRange("definitions", bank, vramOffset(regs.defBank7, regs.defMsb, 0), mode.defLength);
}

/** The bytes of the tiles the map uses. */
export function usedDefinitionsRange(
  mode: TilemapMode,
  regs: TilemapRegs,
  usedTiles: Iterable<number>
): BankRange {
  const bank = regs.defBank7 ? 7 : 5;
  const spans: [number, number][] = [];
  for (const tile of usedTiles) {
    const start = vramOffset(regs.defBank7, regs.defMsb, tile * mode.tileBytes);
    spans.push(...bankRange("", bank, start, mode.tileBytes).spans);
  }
  return { name: "tiles", bank, spans: mergeSpans(spans) };
}

/** The ULA's bitmap and attributes in bank 5 ($4000-$57FF, $5800-$5AFF). */
export const ULA_BITMAP: BankRange = { name: "ulaBitmap", bank: 5, spans: [[0x0000, 0x1800]] };
export const ULA_ATTRIBUTES: BankRange = { name: "ulaAttributes", bank: 5, spans: [[0x1800, 0x1b00]] };

/** A span list as `$4000-$57FF` text in the Z80's default view of bank 5 (bank 7 as `7:$0000`). */
export function describeSpans(bank: 5 | 7, spans: [number, number][]): string {
  const hex = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");
  return spans
    .map(([a, b]) => (bank === 5 ? `$${hex(0x4000 + a)}-$${hex(0x4000 + b - 1)}` : `7:$${hex(a)}-$${hex(b - 1)}`))
    .join(", ");
}

/** Whether a range runs past the end of its bank and wraps to the start (T1). */
export const wraps = (r: BankRange) => r.spans.length > 1;

/** The texts of each overlap pair: one whole message per pair */
const OVERLAP_KEYS: Record<string, { chip: MessageKey; sentence: MessageKey }> = {
  "map:tiles": {
    chip: "gfxCommon.tilemap.diag.overlapMapTiles.chip",
    sentence: "gfxCommon.tilemap.diag.overlapMapTiles.sentence"
  },
  "map:ULA bitmap": {
    chip: "gfxCommon.tilemap.diag.overlapMapUlaBitmap.chip",
    sentence: "gfxCommon.tilemap.diag.overlapMapUlaBitmap.sentence"
  },
  "map:ULA attributes": {
    chip: "gfxCommon.tilemap.diag.overlapMapUlaAttributes.chip",
    sentence: "gfxCommon.tilemap.diag.overlapMapUlaAttributes.sentence"
  },
  "tiles:ULA bitmap": {
    chip: "gfxCommon.tilemap.diag.overlapTilesUlaBitmap.chip",
    sentence: "gfxCommon.tilemap.diag.overlapTilesUlaBitmap.sentence"
  },
  "tiles:ULA attributes": {
    chip: "gfxCommon.tilemap.diag.overlapTilesUlaAttributes.chip",
    sentence: "gfxCommon.tilemap.diag.overlapTilesUlaAttributes.sentence"
  }
};

/**
 * The diagnostics, warnings first. `cells` is the decoded map (for the used tiles); the full
 * definitions table running past the bank's end is an info, the used tiles doing so a warning.
 */
export function tilemapDiagnostics(
  mode: TilemapMode,
  regs: TilemapRegs,
  cells: readonly DecodedCell[]
): TilemapDiagnostic[] {
  const out: TilemapDiagnostic[] = [];
  if (!regs.enabled) {
    out.push(diagnostic("disabled", "info", "gfxCommon.tilemap.diag.disabled.chip", "gfxCommon.tilemap.diag.disabled.sentence"));
  }

  const map = mapRange(mode, regs);
  const used = usedDefinitionsRange(mode, regs, new Set(cells.map((c) => c.tile)));
  const ula = regs.ulaDisabled ? [] : [ULA_BITMAP, ULA_ATTRIBUTES];
  const pairs: [BankRange, BankRange][] = [[map, used], ...ula.map((u) => [map, u] as [BankRange, BankRange]), ...ula.map((u) => [used, u] as [BankRange, BankRange])];
  for (const [a, b] of pairs) {
    const overlap = overlapOf(a, b);
    if (!overlap.length) continue;
    // --- The id stays the stable English form; the texts are one whole message per pair
    const shortA = a === map ? "map" : "tiles";
    const shortB = b === used ? "tiles" : b === ULA_BITMAP ? "ULA bitmap" : "ULA attributes";
    const keys = OVERLAP_KEYS[`${shortA}:${shortB}`];
    out.push(
      diagnostic(
        `overlap:${shortA}:${shortB}`,
        "warning",
        keys.chip,
        keys.sentence,
        { ranges: describeSpans(a.bank, overlap) }
      )
    );
  }

  if (wraps(map)) {
    out.push(
      diagnostic(
        "wrap:map",
        "warning",
        "gfxCommon.tilemap.diag.wrapMap.chip",
        map.bank === 7 ? "gfxCommon.tilemap.diag.wrapMap8k.sentence" : "gfxCommon.tilemap.diag.wrapMap.sentence",
        { bank: map.bank }
      )
    );
  }
  if (wrapsUsed(mode, regs, cells)) {
    out.push(
      diagnostic(
        "wrap:tiles",
        "warning",
        "gfxCommon.tilemap.diag.wrapTiles.chip",
        used.bank === 7 ? "gfxCommon.tilemap.diag.wrapTiles8k.sentence" : "gfxCommon.tilemap.diag.wrapTiles.sentence",
        { bank: used.bank }
      )
    );
  } else if (wraps(definitionsRange(mode, regs))) {
    out.push(
      diagnostic(
        "wrap:definitions",
        "info",
        "gfxCommon.tilemap.diag.wrapDefinitions.chip",
        "gfxCommon.tilemap.diag.wrapDefinitions.sentence",
        { tiles: mode.tiles512 ? 512 : 256, bank: used.bank }
      )
    );
  }

  if (mode.tiles512 && !mode.forceOnTop) {
    out.push(diagnostic("512:below", "info", "gfxCommon.tilemap.diag.below512.chip", "gfxCommon.tilemap.diag.below512.sentence"));
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1));
}

/** Whether a used tile's bytes cross the bank end (a tile split across the wrap). */
function wrapsUsed(mode: TilemapMode, regs: TilemapRegs, cells: readonly DecodedCell[]): boolean {
  const size = regs.defBank7 ? 0x2000 : 0x4000;
  const base = vramOffset(regs.defBank7, regs.defMsb, 0);
  for (const tile of new Set(cells.map((c) => c.tile))) {
    if (base + tile * mode.tileBytes + mode.tileBytes > size) return true;
  }
  return false;
}
