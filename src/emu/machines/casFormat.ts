import { findSync } from "./ht1080z/Ht1080zTapeFile";
import { TVC_CAS_HEADER_LENGTH } from "./tvc/TvcCasFile";

/*
 * Which machine's tape a `.cas` file holds. Two unrelated formats share the extension:
 *
 * - The HT-1080Z's (TRS-80 Model I) is the cassette's bit stream: zero bytes of leader, then the A5h
 *   sync (`Ht1080zTapeFile.ts`). It has no header of its own.
 * - The Videoton TVC's is a container (`TvcCasFile.ts`): 11h, the record counts that give the file's
 *   length, a 144-byte header, then the payload.
 *
 * The TVC's is the one with a header, so it is checked first: a file is a TVC tape when it starts with
 * 11h and holds the whole 144-byte header. The record counts are not part of the check: some homebrew
 * writers fill them wrongly (the payload length at 82h-83h is right there), and a cut-off file is still
 * a TVC tape the viewer can say is short. An HT-1080Z tape starts with its leader's zero bytes (or the
 * A5h sync), so it never starts with 11h; anything else is an HT-1080Z tape when the sync is found.
 */

export type CasFormat = "ht1080z" | "tvc";

/** Whether `bytes` are a Videoton TVC `.cas` container */
export function isTvcCasContainer(bytes: ArrayLike<number>): boolean {
  return bytes.length >= TVC_CAS_HEADER_LENGTH && bytes[0] === 0x11;
}

/**
 * Tells which machine's tape a `.cas` file is
 * @returns the format, or undefined when it is neither
 */
export function detectCasFormat(bytes: Uint8Array): CasFormat | undefined {
  if (isTvcCasContainer(bytes)) return "tvc";
  // --- A 1500-baud (Model III) image is still a TRS-80 family tape: the HT viewer says why it cannot load
  return findSync(bytes) !== undefined ? "ht1080z" : undefined;
}
