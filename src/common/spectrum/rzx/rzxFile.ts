/*
 * Reads an RZX input recording (`.plans/RZX_PLAN.md` §4.1, D5, D6). Pure: no Node, no DOM.
 *
 * Written from the RZX v0.13 description (https://worldofspectrum.net/RZXformat.html). The reader:
 *  - validates every length against the file;
 *  - inflates zlib-compressed snapshots and frame data;
 *  - expands repeat frames (IN count 65535), so the model never holds one;
 *  - skips blocks it does not use - security blocks and unknown IDs - by their length, with a note
 *    (D6: archive files from newer Spectaculator versions carry such blocks);
 *  - refuses what cannot be played faithfully (D5): external snapshot descriptors, protected input
 *    blocks, a repeat frame first in its block, and a file with no snapshot.
 */

import { unzlibSync } from "fflate";
import {
  RZX_BLOCK_CREATOR,
  RZX_BLOCK_INPUT,
  RZX_BLOCK_SECURITY_INFO,
  RZX_BLOCK_SECURITY_SIGNATURE,
  RZX_BLOCK_SNAPSHOT,
  RZX_REPEAT_FRAME,
  RZX_SIGNATURE,
  RzxError,
  type RzxBlock,
  type RzxCreator,
  type RzxFile,
  type RzxFrame
} from "./rzxModel";
import { t } from "@common/i18n/i18n";

const HEADER_LENGTH = 10;
const BLOCK_HEADER_LENGTH = 5;
const CREATOR_FIXED_LENGTH = 29;
const SNAPSHOT_FIXED_LENGTH = 17;
const INPUT_FIXED_LENGTH = 18;

/** Snapshot block flags */
const SNAPSHOT_EXTERNAL = 0x01;
const SNAPSHOT_COMPRESSED = 0x02;

/** Input block flags */
const INPUT_PROTECTED = 0x01;
const INPUT_COMPRESSED = 0x02;

/** The file starts with "RZX!" */
export function hasRzxSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && RZX_SIGNATURE.every((b, i) => bytes[i] === b);
}

/**
 * Parses an RZX file
 * @throws RzxError when the file is malformed or holds something Klive refuses (D5)
 */
export function parseRzxFile(bytes: Uint8Array): RzxFile {
  if (!hasRzxSignature(bytes)) {
    throw new RzxError(t("media.rzx.read.noSignature"));
  }
  if (bytes.length < HEADER_LENGTH) {
    throw new RzxError(t("media.rzx.read.headerTruncated"));
  }
  const major = bytes[4];
  const minor = bytes[5];
  const flags = dword(bytes, 6);
  const notes: string[] = [];
  if (major > 0 || minor > 13) {
    notes.push(t("media.rzx.read.newerVersion", { major: String(major), minor: String(minor) }));
  }
  if (flags & 0x01) {
    notes.push(t("media.rzx.read.signed"));
  }

  const blocks: RzxBlock[] = [];
  let creator: RzxCreator | undefined;
  let offset = HEADER_LENGTH;
  let index = 0;
  while (offset < bytes.length) {
    if (offset + BLOCK_HEADER_LENGTH > bytes.length) {
      throw new RzxError(t("media.rzx.read.blockTruncated", { block: String(index), offset: String(offset) }));
    }
    const id = bytes[offset];
    const length = dword(bytes, offset + 1);
    if (length < BLOCK_HEADER_LENGTH || offset + length > bytes.length) {
      throw new RzxError(
        t("media.rzx.read.blockLength", {
          block: String(index),
          id: hex2(id),
          offset: String(offset),
          length: String(length)
        })
      );
    }
    const body = bytes.subarray(offset + BLOCK_HEADER_LENGTH, offset + length);
    const where: Where = { block: String(index), offset: String(offset) };
    switch (id) {
      case RZX_BLOCK_CREATOR: {
        const block = readCreator(body, where);
        creator ??= block;
        blocks.push({ kind: "creator", creator: block });
        break;
      }
      case RZX_BLOCK_SNAPSHOT:
        blocks.push(readSnapshot(body, where));
        break;
      case RZX_BLOCK_INPUT:
        blocks.push(readInput(body, where, notes));
        break;
      case RZX_BLOCK_SECURITY_INFO:
      case RZX_BLOCK_SECURITY_SIGNATURE:
        blocks.push({ kind: "skipped", id, length });
        notes.push(
          id === RZX_BLOCK_SECURITY_INFO
            ? t("media.rzx.read.skippedSecurityInfo", where)
            : t("media.rzx.read.skippedSecuritySignature", where)
        );
        break;
      default:
        blocks.push({ kind: "skipped", id, length });
        notes.push(t("media.rzx.read.skippedUnknown", { ...where, id: hex2(id), length: String(length) }));
        break;
    }
    offset += length;
    index++;
  }

  if (!blocks.some((b) => b.kind === "snapshot")) {
    throw new RzxError(t("media.rzx.read.noSnapshot"));
  }
  return { major, minor, flags, creator, blocks, notes };
}

function readCreator(body: Uint8Array, where: Where): RzxCreator {
  if (body.length < CREATOR_FIXED_LENGTH - BLOCK_HEADER_LENGTH) {
    throw new RzxError(t("media.rzx.read.creatorShort", where));
  }
  return {
    name: asciiz(body, 0, 20),
    major: word(body, 20),
    minor: word(body, 22),
    custom: body.slice(24)
  };
}

function readSnapshot(body: Uint8Array, where: Where): RzxBlock {
  if (body.length < SNAPSHOT_FIXED_LENGTH - BLOCK_HEADER_LENGTH) {
    throw new RzxError(t("media.rzx.read.snapshotShort", where));
  }
  const flags = dword(body, 0);
  const extension = asciiz(body, 4, 4).toLowerCase().replace(/^\./, "");
  const length = dword(body, 8);
  if (flags & SNAPSHOT_EXTERNAL) {
    throw new RzxError(t("media.rzx.read.snapshotExternal", where));
  }
  const data = body.subarray(12);
  let snapshot: Uint8Array;
  const compressed = (flags & SNAPSHOT_COMPRESSED) !== 0;
  if (compressed) {
    snapshot = inflate(data, (error) => t("media.rzx.read.snapshotInflate", { ...where, error }));
  } else {
    snapshot = data.slice();
  }
  if (snapshot.length !== length) {
    throw new RzxError(
      t("media.rzx.read.snapshotLength", { ...where, declared: String(length), actual: String(snapshot.length) })
    );
  }
  return { kind: "snapshot", extension, bytes: snapshot, compressed };
}

function readInput(body: Uint8Array, where: Where, notes: string[]): RzxBlock {
  if (body.length < INPUT_FIXED_LENGTH - BLOCK_HEADER_LENGTH) {
    throw new RzxError(t("media.rzx.read.inputShort", where));
  }
  const frameCount = dword(body, 0);
  const tstates = dword(body, 5);
  const flags = dword(body, 9);
  if (flags & INPUT_PROTECTED) {
    throw new RzxError(t("media.rzx.read.inputProtected", where));
  }
  const compressed = (flags & INPUT_COMPRESSED) !== 0;
  const raw = body.subarray(13);
  const data = compressed ? inflate(raw, (error) => t("media.rzx.read.inputInflate", { ...where, error })) : raw;

  const frames: RzxFrame[] = [];
  let lastIns: Uint8Array | undefined;
  let pos = 0;
  for (let i = 0; i < frameCount; i++) {
    if (pos + 4 > data.length) {
      throw new RzxError(
        t("media.rzx.read.inputEndsEarly", { ...where, frames: String(frameCount), read: String(i) })
      );
    }
    const fetchCount = word(data, pos);
    const inCount = word(data, pos + 2);
    pos += 4;
    if (inCount === RZX_REPEAT_FRAME) {
      if (!lastIns) {
        throw new RzxError(t("media.rzx.read.repeatFirst", { ...where, frame: String(i) }));
      }
      frames.push({ fetchCount, ins: lastIns });
      continue;
    }
    if (pos + inCount > data.length) {
      throw new RzxError(t("media.rzx.read.inPastEnd", { ...where, frame: String(i), count: String(inCount) }));
    }
    const ins = data.slice(pos, pos + inCount);
    pos += inCount;
    frames.push({ fetchCount, ins });
    lastIns = ins;
  }
  if (pos !== data.length) {
    notes.push(
      t("media.rzx.read.trailingBytes", { ...where, bytes: String(data.length - pos), frames: String(frameCount) })
    );
  }
  return { kind: "input", tstates, frames, compressed };
}

/** Which block a message is about: its index and byte offset in the file (invariant numbers) */
type Where = { block: string; offset: string };

/** Inflates zlib data; `message` words the failure from the decompressor's error */
function inflate(data: Uint8Array, message: (error: string) => string): Uint8Array {
  try {
    return unzlibSync(data);
  } catch (err) {
    throw new RzxError(message(err instanceof Error ? err.message : String(err)));
  }
}

function word(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function dword(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

function asciiz(bytes: Uint8Array, offset: number, size: number): string {
  let text = "";
  for (let i = 0; i < size; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    text += String.fromCharCode(c);
  }
  return text;
}

function hex2(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
