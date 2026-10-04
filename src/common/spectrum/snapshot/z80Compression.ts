/*
 * The `.z80` format's run-length scheme (https://worldofspectrum.org/faq/reference/z80format.htm):
 * a run of five or more equal bytes, and any run of two `$ED` bytes, is stored as `ED ED nn vv`
 * (`nn` copies of `vv`). Version 1 files end their single block with the marker `00 ED ED 00`.
 */

/**
 * Decompresses a Z80 file data block
 * @param data Data before decompression
 * @param expectEndMarker Stop at the version 1 end marker (`00 ED ED 00`)?
 * @returns The decompressed data
 */
export function decompressZ80DataBlock(
  data: Uint8Array,
  expectEndMarker: boolean = false
): Uint8Array {
  const result: number[] = [];
  let idx = 0;
  while (idx < data.length) {
    // --- Check for the end marker
    if (
      expectEndMarker &&
      data.length - idx >= 4 &&
      data[idx] === 0x00 &&
      data[idx + 1] === 0xed &&
      data[idx + 2] === 0xed &&
      data[idx + 3] === 0x00
    ) {
      break;
    }
    if (data.length - idx >= 4 && data[idx] === 0xed && data[idx + 1] === 0xed) {
      const repeat = data[idx + 2];
      const value = data[idx + 3];
      for (let i = 0; i < repeat; i++) {
        result.push(value);
      }
      idx += 4;
    } else {
      result.push(data[idx++]);
    }
  }
  return new Uint8Array(result);
}

/**
 * Compresses a block with the `.z80` scheme (the inverse of `decompressZ80DataBlock`).
 *
 * A single `$ED` followed by a run is written literally and the run starts after it, as the format
 * requires (`ED ED` would otherwise be read as a code).
 * @param data The bytes to compress
 * @param endMarker Append the version 1 end marker?
 */
export function compressZ80DataBlock(data: Uint8Array, endMarker = false): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === value && run < 255) run++;
    if (run >= 5 || (value === 0xed && run >= 2)) {
      out.push(0xed, 0xed, run, value);
      i += run;
    } else if (value === 0xed) {
      // --- A lone ED: write it, then the next byte literally, so it cannot start a code
      out.push(0xed);
      i++;
      if (i < data.length) {
        out.push(data[i]);
        i++;
      }
    } else {
      out.push(value);
      i++;
    }
  }
  if (endMarker) {
    out.push(0x00, 0xed, 0xed, 0x00);
  }
  return new Uint8Array(out);
}
