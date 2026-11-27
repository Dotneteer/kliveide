/**
 * SAD and EDSK images back to the MGT layout (cylinder-major, the sides interleaved, ten 512-byte sectors),
 * to read a probe's result sector from what SimCoupé wrote back (test/sam-hw/parity/diskFormats.ts makes
 * them; the formats as src/emu/machines/samcoupe/SamDiskImage.ts reads them).
 */
const TRACK_BYTES = 10 * 512;

function sadToMgt(bytes) {
  const heads = bytes[18];
  const tracks = bytes[19];
  const trackBytes = bytes[20] * bytes[21] * 64;
  const out = Buffer.alloc(80 * 2 * TRACK_BYTES);
  for (let h = 0; h < heads; h++) {
    for (let t = 0; t < tracks && t < 80; t++) {
      const from = 22 + (h * tracks + t) * trackBytes;
      bytes.copy(out, (t * 2 + h) * TRACK_BYTES, from, from + TRACK_BYTES);
    }
  }
  return out;
}

function edskToMgt(bytes) {
  const extended = bytes.toString("latin1", 0, 8) === "EXTENDED";
  const tracks = bytes[0x30];
  const sides = bytes[0x31];
  const out = Buffer.alloc(80 * 2 * TRACK_BYTES);
  let at = 0x100;
  for (let t = 0; t < tracks; t++) {
    for (let s = 0; s < sides; s++) {
      const blockSize = extended ? bytes[0x34 + t * sides + s] * 256 : bytes[0x32] | (bytes[0x33] << 8);
      if (blockSize === 0) continue;
      const count = bytes[at + 0x15];
      let data = at + 0x100;
      for (let k = 0; k < count; k++) {
        const info = at + 0x18 + k * 8;
        const id = bytes[info + 2];
        const length = extended ? bytes[info + 6] | (bytes[info + 7] << 8) : 512;
        if (id >= 1 && id <= 10 && t < 80) bytes.copy(out, (t * 2 + s) * TRACK_BYTES + (id - 1) * 512, data, data + 512);
        data += length;
      }
      at += blockSize;
    }
  }
  return out;
}

module.exports = { sadToMgt, edskToMgt };
