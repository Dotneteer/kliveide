/*
 * Writes an RZX input recording (`.plans/RZX_PLAN.md` §4.1, D15). Pure: no Node, no DOM.
 *
 * Written from the RZX v0.13 description (https://worldofspectrum.net/RZXformat.html):
 *  - the header says version 0.13, unsigned;
 *  - the creator block comes first (the file's own, or the one passed in the options);
 *  - snapshots and frame data are zlib-compressed when `compress` is on (the default), otherwise
 *    each block keeps the `compressed` flag it carries;
 *  - a frame whose INs equal the previous non-repeated frame's becomes a repeat frame, unless it
 *    has no INs (a zero-IN frame is as short as a repeat).
 * Skipped blocks are not written: their bytes were never kept.
 */

import { zlibSync } from "fflate";
import { SnapshotBytes } from "../snapshot/snapshotBytes";
import {
  RZX_BLOCK_CREATOR,
  RZX_BLOCK_INPUT,
  RZX_BLOCK_SNAPSHOT,
  RZX_REPEAT_FRAME,
  RZX_SIGNATURE,
  RZX_VERSION_MAJOR,
  RZX_VERSION_MINOR,
  type RzxCreator,
  type RzxFile,
  type RzxFrame,
  type RzxInputBlock,
  type RzxSnapshotBlock
} from "./rzxModel";

export type RzxWriteOptions = {
  /**
   * true: compress every snapshot and input block; false: none; undefined: keep each block's own
   * flag. Defaults to true.
   */
  compress?: boolean;
  /** The creator written first; defaults to the file's own creator */
  creator?: RzxCreator;
};

/** Writes an RZX file */
export function writeRzxFile(file: RzxFile, options: RzxWriteOptions = { compress: true }): Uint8Array {
  const out = new SnapshotBytes();
  out.byte(...RZX_SIGNATURE, RZX_VERSION_MAJOR, RZX_VERSION_MINOR).dword(0);

  const creator = options.creator ?? file.creator;
  if (creator) writeCreator(out, creator);

  const compressOf = (own: boolean) => ("compress" in options ? (options.compress ?? own) : true);
  for (const block of file.blocks) {
    switch (block.kind) {
      case "snapshot":
        writeSnapshot(out, block, compressOf(block.compressed));
        break;
      case "input":
        writeInput(out, block, compressOf(block.compressed));
        break;
      // --- The creator was written first; skipped blocks have no bytes to write
    }
  }
  return out.toArray();
}

function writeCreator(out: SnapshotBytes, creator: RzxCreator): void {
  out.byte(RZX_BLOCK_CREATOR).dword(29 + creator.custom.length);
  out.fixedString(creator.name.slice(0, 19), 20);
  out.word(creator.major).word(creator.minor);
  out.bytes(creator.custom);
}

function writeSnapshot(out: SnapshotBytes, block: RzxSnapshotBlock, compress: boolean): void {
  const data = compress ? zlibSync(block.bytes, { level: 9 }) : block.bytes;
  out.byte(RZX_BLOCK_SNAPSHOT).dword(17 + data.length);
  out.dword(compress ? 0x02 : 0x00);
  out.fixedString(block.extension.slice(0, 3), 4);
  out.dword(block.bytes.length);
  out.bytes(data);
}

function writeInput(out: SnapshotBytes, block: RzxInputBlock, compress: boolean): void {
  const raw = encodeFrames(block.frames);
  const data = compress ? zlibSync(raw, { level: 9 }) : raw;
  out.byte(RZX_BLOCK_INPUT).dword(18 + data.length);
  out.dword(block.frames.length);
  out.byte(0);
  out.dword(block.tstates);
  out.dword(compress ? 0x02 : 0x00);
  out.bytes(data);
}

/** The frames of an input block, uncompressed, with repeats collapsed */
export function encodeFrames(frames: RzxFrame[]): Uint8Array {
  const out = new SnapshotBytes();
  let last: Uint8Array | undefined;
  for (const frame of frames) {
    out.word(frame.fetchCount);
    if (last && frame.ins.length > 0 && sameBytes(frame.ins, last)) {
      out.word(RZX_REPEAT_FRAME);
      continue;
    }
    out.word(frame.ins.length);
    out.bytes(frame.ins);
    last = frame.ins;
  }
  return out.toArray();
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
