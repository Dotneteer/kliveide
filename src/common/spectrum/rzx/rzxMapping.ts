/*
 * Which Klive machine plays an RZX file (`.plans/RZX_PLAN.md` §4.5, trap 6): the machine of its first
 * snapshot, mapped as a snapshot load maps it (`spectrumSnapshotMapping.ts`), with one difference.
 *
 * The ROM is not in the file. A program that calls a ROM routine at an address the +E ROMs moved
 * desyncs, so a +2A/+3 recording prefers the Amstrad models (G9.2's ROM sets) over the +E ones a
 * snapshot opens on by default; the +E warning stays only when the recording ends up on +E ROMs. A
 * grey +2 on the 128K ROM is safe: only the menu text differs.
 */

import { parseSpectrumSnapshot } from "../snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive, type SpectrumSnapshotMapping } from "../snapshot/spectrumSnapshotMapping";
import type { SpectrumSnapshot } from "../snapshot/spectrumSnapshot";
import { p3ModelRomSet } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { RzxError, type RzxFile } from "./rzxModel";
import { rzxSegments, type RzxSegment } from "./rzxSegments";

/** The warning for a +2A/+3 recording that plays on the +E ROMs */
export const RZX_E_ROM_WARNING =
  "The recording was made on a +2A/+3, and plays here with the +E ROMs: a program that calls ROM routines the +E ROMs moved will desync";

export type RzxMachineMapping = {
  segment: RzxSegment;
  /** The segment's snapshot, parsed */
  snapshot: SpectrumSnapshot;
  /** The snapshot mapping, with the models reordered for RZX and the warnings it implies */
  mapping: SpectrumSnapshotMapping;
};

/**
 * Maps a segment's snapshot to a Klive machine
 * @throws RzxError when the snapshot cannot be parsed or Klive has no machine for it
 */
export function mapRzxToKlive(file: RzxFile, segmentIndex = 0): RzxMachineMapping {
  const segment = rzxSegments(file)[segmentIndex];
  if (!segment) throw new RzxError(`The recording has no segment ${segmentIndex + 1}`);
  let snapshot: SpectrumSnapshot;
  try {
    snapshot = parseSpectrumSnapshot(`recording.${segment.snapshot.extension}`, segment.snapshot.bytes);
  } catch (err) {
    throw new RzxError(
      `The recording's .${segment.snapshot.extension} snapshot cannot be read: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const base = mapSpectrumSnapshotToKlive(snapshot);
  if (base.errors.length) throw new RzxError(`The recording cannot be played: ${base.errors.join("; ")}`);

  if (!base.eRomWarning) return { segment, snapshot, mapping: base };
  // --- A +2A/+3 recording: the Amstrad models first
  const amstrad = base.modelIds.filter((m) => m !== undefined && p3ModelRomSet(m).amstrad);
  const others = base.modelIds.filter((m) => !amstrad.includes(m));
  const modelIds = [...amstrad, ...others];
  const onE = modelIds[0] === undefined || !p3ModelRomSet(modelIds[0]).amstrad;
  const warnings = base.warnings.filter((w) => w !== base.eRomWarning);
  if (onE) warnings.push(RZX_E_ROM_WARNING);
  return {
    segment,
    snapshot,
    mapping: { ...base, modelIds, warnings, eRomWarning: onE ? RZX_E_ROM_WARNING : undefined }
  };
}
