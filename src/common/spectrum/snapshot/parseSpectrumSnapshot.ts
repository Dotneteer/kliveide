/*
 * Detects a snapshot's format and parses it (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.2).
 *
 * The extension decides the format; the content must agree with it, or the error says which check
 * failed. A `.z80` has no magic, so "not a snapshot" shows up as a parse error.
 */

import { t } from "@common/i18n/i18n";
import { parseSnaFile, isSnaSize } from "./snaFile";
import { parseSzxFile, hasSzxMagic } from "./szxFile";
import { parseZ80File } from "./z80File";
import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "./spectrumSnapshot";

/** The extensions Klive reads as ZX Spectrum snapshots */
export const SPECTRUM_SNAPSHOT_EXTENSIONS: readonly string[] = [".sna", ".z80", ".szx"];

/** The snapshot format a file name stands for, if any (case-insensitive) */
export function snapshotFormatOfName(name: string): SpectrumSnapshotFormat | undefined {
  const lower = name.toLowerCase();
  if (lower.endsWith(".sna")) return "sna";
  if (lower.endsWith(".z80")) return "z80";
  if (lower.endsWith(".szx") || lower.endsWith(".zx-state")) return "szx";
  return undefined;
}

/**
 * The format of a snapshot file, from its name, checked against its content
 * @throws When the name is not a snapshot's or the content does not match it
 */
export function detectSnapshotFormat(name: string, bytes: Uint8Array): SpectrumSnapshotFormat {
  const format = snapshotFormatOfName(name);
  if (!format) {
    throw new Error(t("media.snapshot.error.notSnapshotName", { name }));
  }
  if (format === "szx" && !hasSzxMagic(bytes)) {
    throw new Error(t("media.snapshot.error.szxNoHeader"));
  }
  if (format === "sna" && !isSnaSize(bytes.length)) {
    throw new Error(t("media.snapshot.error.snaBadLength", { length: bytes.length }));
  }
  if (format === "z80" && hasSzxMagic(bytes)) {
    throw new Error(t("media.snapshot.error.z80IsSzx"));
  }
  return format;
}

/**
 * Parses a snapshot file of any of the three formats
 * @param name The file name (its extension picks the format)
 * @param bytes The file's contents
 * @throws When the file is not a snapshot of its format
 */
export function parseSpectrumSnapshot(name: string, bytes: Uint8Array): SpectrumSnapshot {
  switch (detectSnapshotFormat(name, bytes)) {
    case "sna":
      return parseSnaFile(bytes);
    case "z80":
      return parseZ80File(bytes);
    case "szx":
      return parseSzxFile(bytes);
  }
}
