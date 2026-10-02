import type { RecordingQuality } from "@common/state/AppState";

/**
 * Maps a recording quality preference to the CRF value FFmpeg encodes with. Shared by the emulator
 * screen recording and the IDE + Emulator recording, so one menu choice means the same in both.
 */
export function recordingQualityToCrf(quality: RecordingQuality | undefined): number {
  switch (quality) {
    case "lossless":
      return 0;
    case "high":
      return 10;
    case "good":
    default:
      return 18;
  }
}
