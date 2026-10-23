import fs from "fs";

import { HT1080Z_BASIC_SNIFF_BYTES, isTokenisedHt1080zBasic, type FileContentKind } from "@common/ht1080z/basContent";

/**
 * What a file holds when its extension cannot tell (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2): a `.bas`
 * that is a tokenised HT-1080Z program rather than BASIC source. Reads at most the first 512 bytes;
 * an unreadable file has no kind.
 */
export function sniffFileContentKind(filePath: string): FileContentKind | undefined {
  if (!/\.bas$/i.test(filePath)) return undefined;
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, "r");
    const size = fs.fstatSync(fd).size;
    const buffer = Buffer.alloc(Math.min(size, HT1080Z_BASIC_SNIFF_BYTES));
    const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return isTokenisedHt1080zBasic(buffer.subarray(0, read), read === size) ? "ht1080zBasic" : undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
