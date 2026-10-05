/*
 * The model of an RZX input recording (`.plans/RZX_PLAN.md` §4.1). Pure: no Node, no DOM.
 *
 * The format (RZX v0.13, https://worldofspectrum.net/RZXformat.html), in brief: a 10-byte header
 * ("RZX!", major, minor, a DWORD of flags), then blocks of an ID byte, a DWORD length that counts the
 * 5 header bytes, and the data. Klive reads and writes the creator, snapshot and input recording
 * blocks; every other block is skipped by its length, with a note (D6).
 */

/** "RZX!" */
export const RZX_SIGNATURE = [0x52, 0x5a, 0x58, 0x21] as const;

/** The version Klive writes: 0.13 */
export const RZX_VERSION_MAJOR = 0;
export const RZX_VERSION_MINOR = 13;

/** Block IDs */
export const RZX_BLOCK_CREATOR = 0x10;
export const RZX_BLOCK_SECURITY_INFO = 0x20;
export const RZX_BLOCK_SECURITY_SIGNATURE = 0x21;
export const RZX_BLOCK_SNAPSHOT = 0x30;
export const RZX_BLOCK_INPUT = 0x80;

/** The IN count that marks a frame repeating the previous non-repeated frame's INs */
export const RZX_REPEAT_FRAME = 0xffff;

/** A frame whose fetch count is at most this is an EI or retrigger frame: it completes no picture */
export const RZX_SHORT_FRAME_FETCHES = 4;

/** One recorded frame */
export type RzxFrame = {
  /** Opcode fetches (R increments, the INT acknowledge excluded) until the interrupt */
  fetchCount: number;
  /** The values the CPU read with IN, in order. Repeat frames are stored expanded. */
  ins: Uint8Array;
};

/** The program that wrote the file */
export type RzxCreator = {
  /** ASCIIZ[20] */
  name: string;
  major: number;
  minor: number;
  /** Creator-specific bytes after the fixed fields */
  custom: Uint8Array;
};

export type RzxCreatorBlock = { kind: "creator"; creator: RzxCreator };

export type RzxSnapshotBlock = {
  kind: "snapshot";
  /** The snapshot's format, lower case and without the dot: "z80", "sna", "szx" */
  extension: string;
  /** The snapshot file's bytes, uncompressed */
  bytes: Uint8Array;
  /** The block stored the snapshot zlib-compressed */
  compressed: boolean;
};

export type RzxInputBlock = {
  kind: "input";
  /** The frame tact at the block's first instruction */
  tstates: number;
  frames: RzxFrame[];
  /** The block stored its frames zlib-compressed */
  compressed: boolean;
};

/** A block Klive does not use; its bytes are kept so a note can name it */
export type RzxSkippedBlock = { kind: "skipped"; id: number; length: number };

export type RzxBlock = RzxCreatorBlock | RzxSnapshotBlock | RzxInputBlock | RzxSkippedBlock;

export type RzxFile = {
  major: number;
  minor: number;
  /** The header flags (b0: signed) */
  flags: number;
  /** The first creator block's content, if any */
  creator?: RzxCreator;
  blocks: RzxBlock[];
  /** What the reader skipped or noticed, for the viewer */
  notes: string[];
};

/** Thrown when a file is not an RZX file, or holds something Klive cannot play faithfully (D5) */
export class RzxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RzxError";
  }
}

/** The display name of a creator: "Fuse 1.10" */
export function rzxCreatorText(creator?: RzxCreator): string {
  return creator ? `${creator.name} ${creator.major}.${creator.minor}` : "unknown creator";
}

/** A frame that completes a picture (D19) */
export function isPictureFrame(frame: Pick<RzxFrame, "fetchCount">): boolean {
  return frame.fetchCount > RZX_SHORT_FRAME_FETCHES;
}
