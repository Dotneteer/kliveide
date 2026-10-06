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

export type TilemapDiagnosticLevel = "warning" | "info";

export type TilemapDiagnostic = {
  level: TilemapDiagnosticLevel;
  /** Stable key */
  id: string;
  /** The chip's text */
  chip: string;
  /** One sentence for the tooltip and the inspector */
  sentence: string;
};

/** A byte range in a bank, as half-open spans (a range that wraps has two). */
export type BankRange = {
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
  return bankRange("the map", bank, vramOffset(regs.mapBank7, regs.mapMsb, 0), mode.mapLength);
}

/** The whole definitions table: 256 or 512 tiles of 32 bytes, or 8 in text mode (T3, T4). */
export function definitionsRange(mode: TilemapMode, regs: TilemapRegs): BankRange {
  const bank = regs.defBank7 ? 7 : 5;
  return bankRange("the tile definitions", bank, vramOffset(regs.defBank7, regs.defMsb, 0), mode.defLength);
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
  return { name: "the used tile definitions", bank, spans: mergeSpans(spans) };
}

/** The ULA's bitmap and attributes in bank 5 ($4000-$57FF, $5800-$5AFF). */
export const ULA_BITMAP: BankRange = { name: "the ULA bitmap", bank: 5, spans: [[0x0000, 0x1800]] };
export const ULA_ATTRIBUTES: BankRange = { name: "the ULA attributes", bank: 5, spans: [[0x1800, 0x1b00]] };

/** A span list as `$4000-$57FF` text in the Z80's default view of bank 5 (bank 7 as `7:$0000`). */
export function describeSpans(bank: 5 | 7, spans: [number, number][]): string {
  const hex = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");
  return spans
    .map(([a, b]) => (bank === 5 ? `$${hex(0x4000 + a)}-$${hex(0x4000 + b - 1)}` : `7:$${hex(a)}-$${hex(b - 1)}`))
    .join(", ");
}

/** Whether a range runs past the end of its bank and wraps to the start (T1). */
export const wraps = (r: BankRange) => r.spans.length > 1;

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
    out.push({
      id: "disabled",
      level: "info",
      chip: "tilemap off",
      sentence: "The tilemap is disabled ($6B bit 7 is clear); the inspector shows what it would draw."
    });
  }

  const map = mapRange(mode, regs);
  const used = usedDefinitionsRange(mode, regs, new Set(cells.map((c) => c.tile)));
  const ula = regs.ulaDisabled ? [] : [ULA_BITMAP, ULA_ATTRIBUTES];
  const pairs: [BankRange, BankRange][] = [[map, used], ...ula.map((u) => [map, u] as [BankRange, BankRange]), ...ula.map((u) => [used, u] as [BankRange, BankRange])];
  for (const [a, b] of pairs) {
    const overlap = overlapOf(a, b);
    if (!overlap.length) continue;
    const shortA = a === map ? "map" : "tiles";
    const shortB = b === used ? "tiles" : b === ULA_BITMAP ? "ULA bitmap" : "ULA attributes";
    out.push({
      id: `overlap:${shortA}:${shortB}`,
      level: "warning",
      chip: `${shortA} overlaps ${shortB}`,
      sentence: `${cap(a.name)} overlap${a === map ? "s" : ""} ${b.name} at ${describeSpans(a.bank, overlap)}.`
    });
  }

  if (wraps(map)) {
    out.push({
      id: "wrap:map",
      level: "warning",
      chip: `map wraps in bank ${map.bank}`,
      sentence: `The map runs past the end of bank ${map.bank}${map.bank === 7 ? "'s 8K" : ""} and wraps to its start.`
    });
  }
  if (wrapsUsed(mode, regs, cells)) {
    out.push({
      id: "wrap:tiles",
      level: "warning",
      chip: `tiles wrap in bank ${used.bank}`,
      sentence: `Tiles the map uses run past the end of bank ${used.bank}${used.bank === 7 ? "'s 8K" : ""} and wrap to its start.`
    });
  } else if (wraps(definitionsRange(mode, regs))) {
    out.push({
      id: "wrap:definitions",
      level: "info",
      chip: "table wraps",
      sentence: `A full table of ${mode.tiles512 ? 512 : 256} tiles from this base would run past the end of bank ${used.bank}; the tiles in use do not.`
    });
  }

  if (mode.tiles512 && !mode.forceOnTop) {
    out.push({
      id: "512:below",
      level: "info",
      chip: "512 tiles: below ULA",
      sentence: "In 512-tile mode attribute bit 0 is tile bit 8, so every cell is below the ULA unless $6B bit 0 forces the tilemap on top."
    });
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
