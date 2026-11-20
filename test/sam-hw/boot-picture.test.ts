import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { createSamSession, type SamTestSession } from "../harness/samcoupe";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";

/*
 * The boot pictures (plan Phase 3): ROM 3.0's copyright screen on both models (the colour bars, the
 * company line and the memory size), and SAM BASIC's empty screen with its cursor after a key. The hashes were recorded only after the pictures were checked by eye; `SAM_SHOTS_PNG=<dir>`
 * writes them as PNGs.
 */

const EXPECTED: Record<string, string> = {
  "sam512-copyright": "77033815ed408858ea1b6f24f994e518e7e86d797b94156a31bd03a6fc14a9b8",
  "sam256-copyright": "7bcbcc810a3ea875d529f4e0749858aa1f2cd70518b20b605ccdef6b500014bc",
  "sam512-basic": "c014a4682054d3094f285b298532ba55a084ce0277d6af45c3b90cbf3bc30b51"
};

function png(width: number, height: number, rgba: Uint8Array): Buffer {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b: Buffer) => {
    let c = -1;
    for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function shot(s: SamTestSession, name: string): string {
  const pixels = s.machine.getPixelBufferBytes();
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.length);
  const dir = process.env.SAM_SHOTS_PNG;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.png`), png(640, 288, bytes));
  }
  return createHash("sha256").update(bytes).digest("hex");
}

describe("SAM boot pictures", () => {
  it("the copyright screen on both models, and SAM BASIC's screen", async () => {
    const s512 = await createSamSession();
    s512.bootToCopyright().runFrames(20);
    const s256 = await createSamSession({ model: "sam256" });
    s256.bootToCopyright().runFrames(20);
    const basic = await createSamSession();
    basic.bootToCopyright().runFrames(5).pressKey(SamKeyCode.Space).runFrames(100);
    const hashes = {
      "sam512-copyright": shot(s512, "sam512-copyright"),
      "sam256-copyright": shot(s256, "sam256-copyright"),
      "sam512-basic": shot(basic, "sam512-basic")
    };
    expect(hashes).toEqual(EXPECTED);
  });
});
