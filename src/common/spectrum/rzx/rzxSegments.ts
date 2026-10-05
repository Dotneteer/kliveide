/*
 * The segments of an RZX file (`.plans/RZX_PLAN.md` §4.1): a snapshot plus the input blocks that
 * follow it, up to the next snapshot. Playback walks segments, and the viewer lists them as jump
 * points. Pure: no Node, no DOM.
 */

import {
  RzxError,
  isPictureFrame,
  type RzxFile,
  type RzxFrame,
  type RzxInputBlock,
  type RzxSnapshotBlock
} from "./rzxModel";

/** The Spectrum's frame rate, for durations */
export const RZX_FRAMES_PER_SECOND = 50;

export type RzxSegment = {
  /** 0-based position among the segments */
  index: number;
  snapshot: RzxSnapshotBlock;
  inputs: RzxInputBlock[];
  /** Frames in all of the segment's input blocks */
  frameCount: number;
  /** Frames that complete a picture (D19): the playing time is `pictureFrames / 50` seconds */
  pictureFrames: number;
  /** The frame number, counted over the whole file, of the segment's first frame */
  firstFrame: number;
};

/**
 * Splits a file into segments
 * @throws RzxError when an input block comes before any snapshot
 */
export function rzxSegments(file: RzxFile): RzxSegment[] {
  const segments: RzxSegment[] = [];
  let current: RzxSegment | undefined;
  let frameNo = 0;
  for (const block of file.blocks) {
    if (block.kind === "snapshot") {
      current = {
        index: segments.length,
        snapshot: block,
        inputs: [],
        frameCount: 0,
        pictureFrames: 0,
        firstFrame: frameNo
      };
      segments.push(current);
    } else if (block.kind === "input") {
      if (!current) {
        throw new RzxError("An input recording block comes before any snapshot; there is no state to play it from");
      }
      current.inputs.push(block);
      current.frameCount += block.frames.length;
      current.pictureFrames += block.frames.filter(isPictureFrame).length;
      frameNo += block.frames.length;
    }
  }
  return segments;
}

/** Every frame of a segment, in order */
export function* segmentFrames(segment: RzxSegment): Generator<RzxFrame> {
  for (const input of segment.inputs) yield* input.frames;
}

/** The total frames of a file */
export function rzxFrameCount(file: RzxFile): number {
  let count = 0;
  for (const block of file.blocks) if (block.kind === "input") count += block.frames.length;
  return count;
}

/** A frame count as a duration: "1:23.4" */
export function formatRzxDuration(pictureFrames: number): string {
  const seconds = pictureFrames / RZX_FRAMES_PER_SECOND;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}
