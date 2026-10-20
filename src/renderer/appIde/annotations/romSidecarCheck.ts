import {
  formatRomSidecar,
  measureRomLevel,
  missingProvenance,
  strayProvenance,
  type RawRomSidecar
} from "@common/roms/romAnnotationTools";
import { t } from "@common/i18n/i18n";
import { knownRomPageKind, romPageIdentity } from "@common/roms/romIdentity";

import { isValidLabelName, parseAnnotations } from "./programAnnotations";
import { romDecoderFor } from "./romDecoder";

/*
 * Is a working copy ready to be copied into `src/public/roms/`? (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`
 * R7.)
 *
 * The same assertions `test/annotations/shippedRomSidecars.test.ts` makes about every shipped
 * sidecar, run in process, so the answer is known *before* the copy rather than from CI after it.
 * `test/annotations/romSidecarCheck.test.ts` holds the two in step: every shipped sidecar passes here.
 */

export type RomSidecarCheck = {
  /** Every reason the file could not be shipped as it is. Empty: it can. */
  problems: string[];
  /** The measured completeness level of each page that has bytes to measure against. */
  levels: Record<string, number>;
  /** The level the file records (`level`), which the IDE never raises (R9). */
  recordedLevel: number;
  /** Per page, the control-transfer targets in code that have no label yet: the level 1 to-do list. */
  unlabelledTargets: Record<string, number[]>;
  /** Per page, how many labels have no synopsis yet: what level 2 still needs. */
  labelsWithoutSynopsis: Record<string, number>;
};

/**
 * Check a ROM sidecar's text.
 *
 * @param pageBytes The bytes of a page of the ROM the sidecar is named after, or `undefined` when
 *   that ROM (or page) cannot be found — which is itself a reason it cannot be shipped
 */
export async function checkRomSidecar(
  text: string,
  pageBytes: (page: number) => Uint8Array | undefined
): Promise<RomSidecarCheck> {
  const problems: string[] = [];
  const levels: Record<string, number> = {};
  const unlabelledTargets: Record<string, number[]> = {};
  const labelsWithoutSynopsis: Record<string, number> = {};
  let raw: RawRomSidecar;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      problems: [t("media.romCheck.notJson", { message: (err as Error).message })],
      levels,
      recordedLevel: 0,
      unlabelledTargets,
      labelsWithoutSynopsis
    };
  }
  const recordedLevel = typeof raw.level === "number" ? raw.level : 0;

  // --- It validates as a ROM sidecar, with no global labels and no debug subtree
  const parsed = parseAnnotations(text);
  for (const diagnostic of parsed.diagnostics.filter((d) => d.severity === "error")) {
    problems.push(`${diagnostic.path}: ${diagnostic.message}`);
  }
  if (parsed.annotations && parsed.annotations.machine !== "rom") problems.push(t("media.romCheck.machineNotRom"));
  if (raw.globalLabels !== undefined) problems.push(t("media.romCheck.globalLabels"));
  if (raw.debug !== undefined) problems.push(t("media.romCheck.debugSubtree"));

  // --- It names its pages by CRC, and they are the ROM's
  for (const page of Object.keys(raw.banks ?? {})) {
    if (!raw.pages?.[page]) problems.push(t("media.romCheck.pageNotListed", { page }));
  }
  for (const [page, info] of Object.entries<{ crc32?: string }>(raw.pages ?? {})) {
    const bytes = pageBytes(Number(page));
    if (!bytes) {
      problems.push(t("media.romCheck.romNotFound", { page }));
      continue;
    }
    const crc = romPageIdentity(bytes).crc32;
    if (crc !== info.crc32) problems.push(t("media.romCheck.crcMismatch", { page, named: String(info.crc32), actual: crc }));
  }

  // --- Valid, unique identifiers
  for (const [page, bank] of Object.entries<any>(raw.banks ?? {})) {
    const names: string[] = (bank.localLabels ?? []).map((label: { name: string }) => label.name);
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) problems.push(t("media.romCheck.duplicateLabel", { page, name }));
      seen.add(name);
      if (!isValidLabelName(name)) problems.push(t("media.romCheck.invalidLabel", { page, name }));
    }
  }

  // --- Every entry has a provenance, and no provenance names nothing
  const missing = missingProvenance(raw);
  if (missing.length > 0) problems.push(t("media.romCheck.noProvenance", { entries: missing.join(", ") }));
  const stray = strayProvenance(raw);
  if (stray.length > 0) problems.push(t("media.romCheck.strayProvenance", { entries: stray.join(", ") }));
  for (const [key, value] of Object.entries(raw.provenance ?? {})) {
    if (!["observed", "manual", "derived"].includes(value as string)) {
      problems.push(t("media.romCheck.badProvenance", { key, value: String(value) }));
    }
  }

  // --- Labels sit on instruction starts inside code; the recorded level is no more than measured
  for (const [page, bank] of Object.entries<any>(raw.banks ?? {})) {
    const bytes = pageBytes(Number(page));
    if (!bytes) continue;
    const report = await measureRomLevel(bank, bytes, romDecoderFor(knownRomPageKind(romPageIdentity(bytes))));
    levels[page] = report.level;
    unlabelledTargets[page] = report.unlabelledTargets;
    labelsWithoutSynopsis[page] = report.labelsWithoutSynopsis.length;
    for (const name of report.misplacedLabels) {
      problems.push(t("media.romCheck.misplacedLabel", { page, name }));
    }
    if (report.level < recordedLevel) {
      problems.push(t("media.romCheck.levelTooHigh", { page, recorded: recordedLevel, measured: report.level }));
    }
  }

  // --- The canonical format
  if (text !== formatRomSidecar(raw)) problems.push(t("media.romCheck.notCanonical"));

  return { problems, levels, recordedLevel, unlabelledTargets, labelsWithoutSynopsis };
}
