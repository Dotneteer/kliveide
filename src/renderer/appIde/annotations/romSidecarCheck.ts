import {
  formatRomSidecar,
  measureRomLevel,
  missingProvenance,
  strayProvenance,
  type RawRomSidecar
} from "@common/roms/romAnnotationTools";
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
  let raw: RawRomSidecar;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      problems: [`It is not valid JSON: ${(err as Error).message}`],
      levels,
      recordedLevel: 0,
      unlabelledTargets
    };
  }
  const recordedLevel = typeof raw.level === "number" ? raw.level : 0;

  // --- It validates as a ROM sidecar, with no global labels and no debug subtree
  const parsed = parseAnnotations(text);
  for (const diagnostic of parsed.diagnostics.filter((d) => d.severity === "error")) {
    problems.push(`${diagnostic.path}: ${diagnostic.message}`);
  }
  if (parsed.annotations && parsed.annotations.machine !== "rom") problems.push('Its machine is not "rom".');
  if (raw.globalLabels !== undefined) problems.push("It has global labels, which a ROM sidecar may not.");
  if (raw.debug !== undefined) problems.push("It has a debug subtree, which a ROM sidecar may not.");

  // --- It names its pages by CRC, and they are the ROM's
  for (const page of Object.keys(raw.banks ?? {})) {
    if (!raw.pages?.[page]) problems.push(`Page ${page} has annotations but no entry in "pages".`);
  }
  for (const [page, info] of Object.entries<{ crc32?: string }>(raw.pages ?? {})) {
    const bytes = pageBytes(Number(page));
    if (!bytes) {
      problems.push(`Page ${page}: the ROM it describes was not found.`);
      continue;
    }
    const crc = romPageIdentity(bytes).crc32;
    if (crc !== info.crc32) problems.push(`Page ${page}: it names CRC ${info.crc32}, the ROM's is ${crc}.`);
  }

  // --- Valid, unique identifiers
  for (const [page, bank] of Object.entries<any>(raw.banks ?? {})) {
    const names: string[] = (bank.localLabels ?? []).map((label: { name: string }) => label.name);
    const seen = new Set<string>();
    for (const name of names) {
      if (seen.has(name)) problems.push(`Page ${page}: the label ${name} is used twice.`);
      seen.add(name);
      if (!isValidLabelName(name)) problems.push(`Page ${page}: ${name} is not a valid label name.`);
    }
  }

  // --- Every entry has a provenance, and no provenance names nothing
  const missing = missingProvenance(raw);
  if (missing.length > 0) problems.push(`No provenance: ${missing.join(", ")}.`);
  const stray = strayProvenance(raw);
  if (stray.length > 0) problems.push(`Provenance for entries that are not there: ${stray.join(", ")}.`);
  for (const [key, value] of Object.entries(raw.provenance ?? {})) {
    if (!["observed", "manual", "derived"].includes(value as string)) {
      problems.push(`${key}: "${String(value)}" is not a provenance.`);
    }
  }

  // --- Labels sit on instruction starts inside code; the recorded level is no more than measured
  for (const [page, bank] of Object.entries<any>(raw.banks ?? {})) {
    const bytes = pageBytes(Number(page));
    if (!bytes) continue;
    const report = await measureRomLevel(bank, bytes, romDecoderFor(knownRomPageKind(romPageIdentity(bytes))));
    levels[page] = report.level;
    unlabelledTargets[page] = report.unlabelledTargets;
    for (const name of report.misplacedLabels) {
      problems.push(`Page ${page}: the label ${name} is not on an instruction start inside code.`);
    }
    if (report.level < recordedLevel) {
      problems.push(`Page ${page}: it records level ${recordedLevel}, but measures ${report.level}.`);
    }
  }

  // --- The canonical format
  if (text !== formatRomSidecar(raw)) problems.push("It is not in the format `npm run rom:annotations` writes.");

  return { problems, levels, recordedLevel, unlabelledTargets };
}
