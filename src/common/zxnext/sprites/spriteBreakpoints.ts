/*
 * Sprite-attribute breakpoints (`sp:`), the pure parts: the attribute-byte filter's text form and the
 * stop message (`.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`).
 *
 * Pure: no React, no Node. The command line, the breakpoint dialog, the Breakpoints panel and the
 * machine controller share it.
 */

import type { SpriteWriteEvent, SpriteWriteOrigin } from "@common/messaging/EmuApi";

/** All five attribute bytes. */
export const SPRITE_ATTR_ALL = 0x1f;

/** The highest sprite index. */
export const SPRITE_INDEX_MAX = 0x7f;

/**
 * What each attribute byte holds, briefly, for an anchor sprite (`spriteAttributes.ts` has the full
 * layout). Used in the stop message and as the dialog's checkbox hints.
 */
export const SPRITE_ATTRIBUTE_LABELS: readonly string[] = [
  "X",
  "Y",
  "palette, mirror, rotate, X8",
  "visible, pattern",
  "attr4"
];

/**
 * Parses an attribute-byte list as `-attr` takes it: digits `0`-`4` separated by commas, with
 * `a-b` ranges (`0,2`, `0-3`, `1,3-4`). Returns the 5-bit mask, or `undefined` when the text is
 * not such a list.
 */
export function parseSpriteAttrList(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  let mask = 0;
  for (const part of trimmed.split(",")) {
    const m = /^\s*([0-4])\s*(?:-\s*([0-4])\s*)?$/.exec(part);
    if (!m) return undefined;
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (to < from) return undefined;
    for (let a = from; a <= to; a++) mask |= 1 << a;
  }
  return mask;
}

/**
 * A 5-bit mask as `-attr` text, ranges collapsed: `0,2`, `0-3`, `1,3-4`. All five come out as
 * `0-4`; callers omit the option for that.
 */
export function formatSpriteAttrList(mask: number): string {
  const parts: string[] = [];
  let a = 0;
  while (a < 5) {
    if ((mask & (1 << a)) === 0) {
      a++;
      continue;
    }
    let b = a;
    while (b + 1 < 5 && mask & (1 << (b + 1))) b++;
    parts.push(b === a ? `${a}` : b === a + 1 ? `${a},${b}` : `${a}-${b}`);
    a = b + 1;
  }
  return parts.join(",");
}

/** A sprite index as the key and messages show it: `$0C`. */
export function formatSpriteIndex(sprite: number): string {
  return `$${(sprite & 0x7f).toString(16).toUpperCase().padStart(2, "0")}`;
}

const hex2 = (value: number) => `$${(value & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (value: number) => `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

/** Who wrote, as the stop message and the Breakpoints panel name it. */
export function describeSpriteWriteOrigin(origin: SpriteWriteOrigin): string {
  switch (origin) {
    case "port":
      return "port $57";
    case "dma":
      return "the DMA";
    case "nextreg":
      return "a NextReg mirror";
    case "copper":
      return "the Copper";
  }
}

/**
 * The stop message of a sprite-attribute breakpoint. It names the sprite, the attribute byte, the
 * value it replaced and the writer, and where the CPU was:
 *
 *   Sprite breakpoint: sprite $0C attr 2 (palette, mirror, rotate, X8) $00 -> $41 through port $57, written at $8012 in R0
 *   Sprite breakpoint: sprite $14 attr 3 (visible, pattern) $00 -> $C0 by the Copper, with the CPU at $8003
 */
export function describeSpriteStop(
  write: SpriteWriteEvent,
  partitionLabels?: Record<number, string>
): string {
  const label = SPRITE_ATTRIBUTE_LABELS[write.attribute];
  const what =
    `sprite ${formatSpriteIndex(write.sprite)} attr ${write.attribute}${label ? ` (${label})` : ""} ` +
    `${hex2(write.oldValue)} -> ${hex2(write.newValue)}`;
  const paged =
    write.partition === undefined ? "" : ` in ${partitionLabels?.[write.partition] ?? write.partition}`;
  const site = `${hex4(write.pc)}${paged}`;
  let from: string;
  switch (write.origin) {
    case "port":
      from = `through port $57, written at ${site}`;
      break;
    case "nextreg":
      from = `through a NextReg mirror, written at ${site}`;
      break;
    case "dma":
      from = `by the DMA, with the CPU at ${site}`;
      break;
    case "copper":
      from = `by the Copper, with the CPU at ${site}`;
      break;
  }
  return `Sprite breakpoint: ${what} ${from}`;
}
