import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { SPRITE_PATTERN_SNAPSHOT_VIEWER } from "@common/state/common-ids";
import {
  NEX_SPRITE_TRANSPARENT,
  patternPixels,
  type NexSpriteFormat
} from "@common/zxnext/sprites/spritePatterns";
import { serializeSprFile } from "@renderer/features/sprite-editor/sprite-file";
import { t as translate, uiLocale } from "@common/i18n/i18n";

/*
 * A sprite pattern popped out of the Sprite Inspector into a read-only sprite editor: the pattern as
 * the related sprite shows it, frozen at the moment it was taken.
 *
 * The sprite editor edits 8-bit sprites, so the snapshot is one 256-byte 8-bit sprite:
 * - a 4-bit pattern's nibbles become `paletteOffset << 4 | nibble`, as the hardware draws them;
 * - an 8-bit pattern's bytes take the palette offset on their high nibble, as the hardware adds it;
 * - a transparent pixel (the byte, or the nibble, equal to `$4B`) becomes the transparency index.
 * With palette offset 0, an 8-bit pattern's bytes are copied unchanged.
 */

export type PatternSnapshotRequest = {
  /** The sprite pattern RAM (16K) */
  patterns: Uint8Array;
  format: NexSpriteFormat;
  /** The pattern number: the 256-byte slot (8-bit) or `slot * 2 + half` (4-bit) */
  pattern: number;
  paletteOffset: number;
  /** `$4B` */
  transparencyIndex: number;
  /** The sprite the snapshot was taken for, if any */
  sprite?: number;
  /** When it was taken (for the title); defaults to now */
  takenAt?: Date;
};

/** The pattern as the 256 bytes of one 8-bit sprite, as the related sprite shows it. */
export function patternSnapshotBytes(r: Pick<PatternSnapshotRequest, "patterns" | "format" | "pattern" | "paletteOffset" | "transparencyIndex">): Uint8Array {
  const pixels = patternPixels(r.patterns, r.pattern, {
    format: r.format,
    offset: 0,
    paletteOffset: r.paletteOffset,
    transparencyIndex: r.transparencyIndex
  });
  return Uint8Array.from(pixels, (p) => (p === NEX_SPRITE_TRANSPARENT ? r.transparencyIndex & 0xff : p));
}

/** `40` for 8-bit, `81 (40·hi)` for 4-bit, as the inspector names patterns. */
export function patternLabel(format: NexSpriteFormat, pattern: number): string {
  return format === "8bit" ? String(pattern) : `${pattern} (${pattern >> 1}·${pattern & 1 ? "hi" : "lo"})`;
}

/** What the read-only bar describes; its text is formatted at display, in the current language */
export type PatternSnapshotInfo = {
  format: NexSpriteFormat;
  pattern: number;
  paletteOffset: number;
  sprite?: number;
  /** When it was taken, as epoch milliseconds */
  takenAt: number;
};

export type PatternSnapshotViewState = {
  /** The read-only bar's text, as it was when taken (the bar prefers `snapshotInfo`) */
  snapshotTitle: string;
  snapshotDetail: string;
  snapshotInfo?: PatternSnapshotInfo;
  selectedSpriteIndex: number;
};

/** The read-only bar's title and detail line, in the current language. */
export function patternSnapshotTexts(
  info: PatternSnapshotInfo,
  t: typeof translate = translate
): { title: string; detail: string } {
  const time = new Date(info.takenAt).toLocaleTimeString(uiLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const facts = [
    info.sprite !== undefined ? t("panels.sprites.snapshot.asSprite", { sprite: info.sprite }) : undefined,
    t("panels.sprites.snapshot.paletteOffset", { offset: info.paletteOffset & 0x0f }),
    t("panels.sprites.snapshot.taken", { time })
  ].filter(Boolean);
  return {
    title: t("panels.sprites.snapshot.title", {
      pattern: patternLabel(info.format, info.pattern),
      format: info.format === "8bit" ? t("panels.sprites.format.8bit") : t("panels.sprites.format.4bit")
    }),
    detail: facts.join(" · ")
  };
}

/** The document id: one per pattern and format, so taking it again refreshes the same tab. */
export const patternSnapshotId = (format: NexSpriteFormat, pattern: number) =>
  `spritePatternSnapshot-${format}-${pattern}`;

export function patternSnapshotViewState(r: PatternSnapshotRequest): PatternSnapshotViewState {
  const info: PatternSnapshotInfo = {
    format: r.format,
    pattern: r.pattern,
    paletteOffset: r.paletteOffset,
    sprite: r.sprite,
    takenAt: (r.takenAt ?? new Date()).getTime()
  };
  const { title, detail } = patternSnapshotTexts(info);
  return {
    snapshotTitle: title,
    snapshotDetail: detail,
    snapshotInfo: info,
    selectedSpriteIndex: 0
  };
}

/**
 * Opens (or, when that pattern's snapshot is already open, retakes) a read-only snapshot document.
 */
export async function openPatternSnapshot(hub: IDocumentHubService, r: PatternSnapshotRequest): Promise<void> {
  const id = patternSnapshotId(r.format, r.pattern);
  if (hub.isOpen(id)) await hub.closeDocument(id);
  await hub.openDocument(
    {
      id,
      name:
        r.format === "8bit"
          ? translate("panels.sprites.snapshot.name8", { pattern: r.pattern })
          : translate("panels.sprites.snapshot.name4", { pattern: r.pattern }),
      type: SPRITE_PATTERN_SNAPSHOT_VIEWER,
      iconName: "sprites",
      contents: serializeSprFile([patternSnapshotBytes(r)])
    },
    patternSnapshotViewState(r),
    false
  );
}
