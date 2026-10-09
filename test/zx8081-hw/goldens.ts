import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { encodePng } from "@common/imaging/png";

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

export function expectGolden(key: string, pixels: Uint32Array, width = 352): void {
  const pngDir = process.env.ZX8081_GOLDENS_PNG;
  if (pngDir) writeFileSync(join(pngDir, `${key}.png`), encodePng(pixels, width, pixels.length / width));
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
