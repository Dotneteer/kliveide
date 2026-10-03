import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { expect } from "vitest";

/*
 * Recorded expectations for the ZX81 screen tests: a picture is stored as the SHA-256 of its pixels.
 * A golden is recorded once its picture has been checked by eye (`ZX8081_GOLDENS_RECORD=1`, then look
 * at the PNGs `ZX8081_GOLDENS_PNG=<dir>` writes). A picture that later differs is a finding, never a
 * file to regenerate without looking.
 */
const FILE = join(__dirname, "goldens.json");
const RECORD = process.env.ZX8081_GOLDENS_RECORD === "1";

export function pictureHash(pixels: Uint32Array): string {
  return createHash("sha256").update(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)).digest("hex");
}

/** A PNG of RGBA pixels (0xAABBGGRR words), for looking at a picture before recording it */
export function toPng(pixels: Uint32Array, width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

export function expectGolden(key: string, pixels: Uint32Array, width = 352): void {
  const pngDir = process.env.ZX8081_GOLDENS_PNG;
  if (pngDir) writeFileSync(join(pngDir, `${key}.png`), toPng(pixels, width, pixels.length / width));
  const stored: Record<string, string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
  const hash = pictureHash(pixels);
  if (RECORD) {
    stored[key] = hash;
    writeFileSync(FILE, JSON.stringify(stored, null, 1) + "\n");
    return;
  }
  expect(key in stored, `no golden '${key}' in goldens.json`).toBe(true);
  expect(hash, key).toBe(stored[key]);
}
