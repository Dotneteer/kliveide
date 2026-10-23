import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

import { encodePng } from "@common/imaging/png";

/*
 * The pictures the documentation site publishes from the kit's runs
 * (`.plans/SPECTRUM_ACCURACY_DOCS_PLAN.md` §4.3), and the check that keeps them true.
 *
 * A test takes its pictures while it runs and settles them only after its assertions have passed, so
 * nothing is published from a run that fails. Settling either writes them (`KIT_PUBLISH=1`) to
 * `docs/public/images/spectrum-accuracy/`, or compares their pixels with the committed files: a core
 * change that alters a published result fails the slow tier, and the fix is to re-publish and re-read
 * the page (`docs/content/en/under-the-hood/emulator-internals/spectrum-accuracy.mdx`).
 *
 * The pictures are published 2x, nearest-neighbour, as paletted PNGs: the site's image pipeline
 * cannot blur them, and a picture of a few colours stays a few kilobytes. The comparison decodes the
 * PNG, so a different zlib, or a PNG optimiser run over the files, cannot fail it.
 */

/** Where the documentation site's accuracy pictures live */
export const PUBLISHED = join(__dirname, "../../docs/public/images/spectrum-accuracy");

/** An RGBA picture */
export type Picture = { width: number; height: number; pixels: Uint8Array };

/** Whether this run publishes its pictures instead of comparing them */
export const publishing = (): boolean => process.env.KIT_PUBLISH === "1";

/** The picture scaled 2x, nearest-neighbour */
export function scale2x({ width, height, pixels }: Picture): Picture {
  const out = new Uint8Array(width * height * 16);
  const rowBytes = width * 8;
  for (let y = 0; y < height; y++) {
    const row = out.subarray(y * 2 * rowBytes, (y * 2 + 1) * rowBytes);
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      row.set(pixels.subarray(from, from + 4), x * 8);
      row.set(pixels.subarray(from, from + 4), x * 8 + 4);
    }
    out.copyWithin((y * 2 + 1) * rowBytes, y * 2 * rowBytes, (y * 2 + 1) * rowBytes);
  }
  return { width: width * 2, height: height * 2, pixels: out };
}

// ------------------------------------------------------------------------------------------------
// PNG

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
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

/** Encodes an opaque picture as a paletted PNG; one of more than 256 colours as RGBA */
export function encodePalettePng({ width, height, pixels }: Picture): Buffer {
  const index = new Map<number, number>();
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // --- filter type 0 (none)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const rgb = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      let entry = index.get(rgb);
      if (entry === undefined) {
        if (index.size === 256) return encodePng(pixels, width, height);
        entry = index.size;
        index.set(rgb, entry);
      }
      raw[y * (width + 1) + 1 + x] = entry;
    }
  }
  const palette = Buffer.alloc(index.size * 3);
  for (const [rgb, entry] of index) {
    palette[entry * 3] = rgb >> 16;
    palette[entry * 3 + 1] = (rgb >> 8) & 0xff;
    palette[entry * 3 + 2] = rgb & 0xff;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // --- bit depth
  header[9] = 3; // --- colour type: paletted
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", palette),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/** Decodes an 8-bit, non-interlaced RGB, RGBA or paletted PNG to RGBA (alpha is not kept) */
export function decodePng(png: Buffer): Picture {
  let width = 0;
  let height = 0;
  let colourType = -1;
  let palette = Buffer.alloc(0);
  const data: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("ascii", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9];
      if (body[8] !== 8 || body[12] !== 0) throw new Error("Only 8-bit, non-interlaced PNGs are decoded.");
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "IDAT") {
      data.push(body);
    }
    at += 12 + length;
  }
  const bpp = colourType === 3 ? 1 : colourType === 2 ? 3 : colourType === 6 ? 4 : 0;
  if (!bpp) throw new Error(`PNG colour type ${colourType} is not decoded.`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * bpp;
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const from = colourType === 3 ? rows[i] * 3 : i * bpp;
    const source = colourType === 3 ? palette : rows;
    pixels[i * 4] = source[from];
    pixels[i * 4 + 1] = source[from + 1];
    pixels[i * 4 + 2] = source[from + 2];
    pixels[i * 4 + 3] = 255;
  }
  return { width, height, pixels };
}

/** The number of pixels in which two pictures differ in colour; -1 when their sizes differ */
export function pictureDifference(a: Picture, b: Picture): number {
  if (a.width !== b.width || a.height !== b.height) return -1;
  let count = 0;
  for (let i = 0; i < a.width * a.height * 4; i += 4) {
    if (a.pixels[i] !== b.pixels[i] || a.pixels[i + 1] !== b.pixels[i + 1] || a.pixels[i + 2] !== b.pixels[i + 2]) count++;
  }
  return count;
}

// ------------------------------------------------------------------------------------------------
// The published set

/**
 * The pictures one test publishes. `take` keeps a picture (scaled 2x) in memory; `settle`, called
 * after the test's assertions, publishes or checks them all.
 */
export class PublishedPictures {
  private readonly taken = new Map<string, Picture>();

  /** Keeps the session's current picture under `name` (the file name without `.png`) */
  take(s: { screenImage(): Picture }, name: string): void {
    const { width, height, pixels } = s.screenImage();
    this.taken.set(name, scale2x({ width, height, pixels: new Uint8Array(pixels) }));
  }

  /** Writes the pictures (`KIT_PUBLISH=1`) or throws if one differs from its published file */
  settle(): void {
    if (publishing()) {
      mkdirSync(PUBLISHED, { recursive: true });
      for (const [name, picture] of this.taken) writeFileSync(join(PUBLISHED, `${name}.png`), encodePalettePng(picture));
      return;
    }
    const problems: string[] = [];
    for (const [name, picture] of this.taken) {
      const path = join(PUBLISHED, `${name}.png`);
      if (!existsSync(path)) {
        problems.push(`${name}.png is not published`);
        continue;
      }
      const difference = pictureDifference(picture, decodePng(readFileSync(path)));
      if (difference !== 0) {
        problems.push(difference < 0 ? `${name}.png has another size` : `${name}.png differs in ${difference} pixels`);
      }
    }
    if (problems.length) {
      throw new Error(
        `The documentation's accuracy pictures no longer match Klive's runs: ${problems.join("; ")}. ` +
          "If the change is intended, re-publish them with KIT_PUBLISH=1 (npm run test:slow) and re-read " +
          "docs/content/en/under-the-hood/emulator-internals/spectrum-accuracy.mdx."
      );
    }
  }
}
