/**
 * Decompresses a Z80 file data block
 * @param data Data before decompression
 * @param expectEndMarker Expect and end marker?
 * @returns The decompressed data
 */
export function decompressZ80DataBlock (
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
    if (
      data.length - idx >= 4 &&
      data[idx] === 0xed &&
      data[idx + 1] === 0xed
    ) {
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
