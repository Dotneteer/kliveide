/*
 * Writes a snapshot model in one of the three formats
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.2, D1–D3). Callers pick the format from the
 * file extension with `snapshotFormatOfName`; `.szx` is the one that keeps everything Klive captures.
 */

import type { SpectrumSnapshot, SpectrumSnapshotFormat } from "./spectrumSnapshot";
import type { SnapshotWriteResult } from "./snapshotBytes";
import { writeSnaFile } from "./snaWriter";
import { writeSzxFile, type SzxCreator } from "./szxWriter";
import { writeZ80File } from "./z80Writer";

/**
 * Writes a snapshot
 * @param creator The program written into a `.szx` file's CRTR block
 * @throws SnapshotRefusedError when the format cannot hold this state (see the writers)
 */
export function writeSpectrumSnapshot(
  snapshot: SpectrumSnapshot,
  format: SpectrumSnapshotFormat,
  creator?: SzxCreator
): SnapshotWriteResult {
  switch (format) {
    case "sna":
      return writeSnaFile(snapshot);
    case "z80":
      return writeZ80File(snapshot);
    case "szx":
      return writeSzxFile(snapshot, creator);
  }
}
