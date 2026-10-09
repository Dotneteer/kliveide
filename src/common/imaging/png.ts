import { deflateSync } from "node:zlib";

/*
 * A minimal PNG encoder for emulated pictures (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D16). The
 * pixel buffers every machine renders are 32-bit words whose bytes read R, G, B, A in memory order
 * (0xAABBGGRR on a little-endian host), which is exactly PNG's 8-bit RGBA, so the rows are copied
 * as they are. Node only (zlib); the main process, the CLI and the tests use it.
 */

let crcTable: Uint32Array | undefined;

function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, sum]);
}

/**
 * Encodes RGBA pixels as a PNG.
 * @param pixels The pixels: 32-bit words (RGBA in memory order) or the same bytes
 * @param width Picture width
 * @param height Picture height
 */
export function encodePng(pixels: Uint32Array | Uint8Array | Uint8ClampedArray, width: number, height: number): Buffer {
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const rowBytes = width * 4;
  if (bytes.length < rowBytes * height) {
    throw new Error(`The pixel buffer holds ${bytes.length} bytes; a ${width}x${height} picture needs ${rowBytes * height}.`);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // --- bit depth
  header[9] = 6; // --- colour type: RGBA
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    // --- Filter type 0 (none) starts every row
    raw[y * (rowBytes + 1)] = 0;
    raw.set(bytes.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
