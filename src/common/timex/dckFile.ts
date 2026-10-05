/*
 * `.dck` cartridge images for the Timex 2068s (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b).
 *
 * A `.dck` file is one or more bank records, each a 9-byte header and the chunk images it announces:
 * - byte 0: the bank - 0 the DOCK (the cartridge), 254 the EXROM bank, 255 the HOME bank (1-253 are
 *   reserved for expansions);
 * - bytes 1-8: one byte per 8K chunk 0-7: bit 0 set for RAM (clear for ROM), bit 1 set when the
 *   file carries the chunk's 8K image.
 * The images of the chunks with bit 1 set follow the header, in chunk order. A chunk with neither
 * bit is not populated; a RAM chunk without an image starts cleared.
 *
 * Pure: no Node, no DOM.
 */

export const DCK_BANK_DOCK = 0;
export const DCK_BANK_EXROM = 254;
export const DCK_BANK_HOME = 255;

/** A chunk type bit: RAM rather than ROM */
export const DCK_CHUNK_RAM = 0x01;
/** A chunk type bit: the file carries the chunk's image */
export const DCK_CHUNK_IMAGE = 0x02;

const CHUNK_SIZE = 0x2000;

/** One bank record of a `.dck` file */
export type DckBank = {
  /** 0 DOCK, 254 EXROM, 255 HOME */
  bank: number;
  /** The type byte of chunks 0-7 */
  chunkTypes: number[];
  /** The 8K images, for the chunks that carry one */
  chunks: (Uint8Array | undefined)[];
};

/** A parsed cartridge */
export type DckImage = {
  banks: DckBank[];
};

/**
 * Parses a `.dck` file
 * @throws When a header or an image is truncated, or the file holds no bank
 */
export function parseDckFile(bytes: Uint8Array): DckImage {
  const banks: DckBank[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 9 > bytes.length) {
      throw new Error(`The .dck bank header at offset ${offset} is truncated`);
    }
    const bank = bytes[offset];
    const chunkTypes = Array.from(bytes.subarray(offset + 1, offset + 9));
    offset += 9;
    const chunks: (Uint8Array | undefined)[] = [];
    for (let chunk = 0; chunk < 8; chunk++) {
      if ((chunkTypes[chunk] & DCK_CHUNK_IMAGE) === 0) {
        chunks.push(undefined);
        continue;
      }
      if (offset + CHUNK_SIZE > bytes.length) {
        throw new Error(`The image of chunk ${chunk} of bank ${bank} is truncated`);
      }
      chunks.push(bytes.slice(offset, offset + CHUNK_SIZE));
      offset += CHUNK_SIZE;
    }
    banks.push({ bank, chunkTypes, chunks });
  }
  if (banks.length === 0) {
    throw new Error("The .dck file holds no bank");
  }
  return { banks };
}

/** The DOCK bank of a cartridge, or undefined when the file has none */
export function dockBankOf(image: DckImage): DckBank | undefined {
  return image.banks.find((b) => b.bank === DCK_BANK_DOCK);
}

/** Writes a `.dck` file (Klive's own cartridges in tests; the inverse of `parseDckFile`) */
export function writeDckFile(image: DckImage): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const b of image.banks) {
    const header = new Uint8Array(9);
    header[0] = b.bank;
    for (let chunk = 0; chunk < 8; chunk++) {
      const image8 = b.chunks[chunk];
      header[1 + chunk] = (b.chunkTypes[chunk] & DCK_CHUNK_RAM) | (image8 ? DCK_CHUNK_IMAGE : 0);
    }
    parts.push(header);
    for (let chunk = 0; chunk < 8; chunk++) {
      const image8 = b.chunks[chunk];
      if (image8) {
        const padded = new Uint8Array(CHUNK_SIZE);
        padded.set(image8.subarray(0, CHUNK_SIZE));
        parts.push(padded);
      }
    }
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
