/**
 * Small, greedy packers for the compressed formats Klive BASIC's library decompresses (compatibility
 * plan C6): they make test data for `zx0.bas` and `megalz.bas`. They aim at valid streams, not at
 * good ratios. Written from the formats' descriptions (ZX0: Einar Saukas' README and reference
 * decompressor; MegaLZ: lvd's mhmt depacker), not from any upstream ZX BASIC code.
 */

/** A bit writer whose bit bytes sit in the stream where a reader that fetches lazily meets them. */
class BitStream {
  constructor() {
    this.out = [];
    this.bitIndex = -1;
    this.mask = 0;
  }
  byte(b) {
    this.out.push(b & 0xff);
  }
  bit(b) {
    if (this.mask === 0) {
      this.bitIndex = this.out.length;
      this.out.push(0);
      this.mask = 0x80;
    }
    if (b) this.out[this.bitIndex] |= this.mask;
    this.mask >>= 1;
  }
  bits(value, count) {
    for (let i = count - 1; i >= 0; i--) this.bit((value >> i) & 1);
  }
}

/** The longest earlier match for `data` at `pos` within `window` bytes, at most `maxLen` long. */
function longestMatch(data, pos, window, maxLen) {
  let best = { len: 0, offset: 0 };
  for (let offset = 1; offset <= Math.min(window, pos); offset++) {
    let len = 0;
    while (len < maxLen && pos + len < data.length && data[pos + len - offset] === data[pos + len]) len++;
    if (len > best.len) best = { len, offset };
  }
  return best;
}

// ------------------------------------------------------------------------------------------------
// ZX0

/**
 * ZX0 (format 2 unless `classic`): a literal block first, then new-offset matches and literal
 * blocks; the end is a new-offset code whose MSB is 256. Lengths and the offset MSB are interlaced
 * Elias gamma codes (the MSB's bits inverted in format 2); the offset LSB byte holds 7 bits, and its
 * bit 0 is the first bit of the match length's code. Backwards data (the Einar Saukas compressor's
 * backwards mode) is the reversed data packed with the flag bits' sense flipped, the MSB not inverted
 * and the LSB byte holding (offset - 1) mod 128, then reversed.
 */
function zx0Pack(input, { classic = false, backwards = false } = {}) {
  const data = backwards ? [...input].reverse() : [...input];
  const out = [];
  let mask = 0;
  let bitIndex = -1;
  let backtrack = false;
  const bit = (b) => {
    if (backtrack) {
      // --- The bit rides in bit 0 of the offset byte just written
      if (b) out[out.length - 1] |= 1;
      backtrack = false;
      return;
    }
    if (mask === 0) {
      bitIndex = out.length;
      out.push(0);
      mask = 0x80;
    }
    if (b) out[bitIndex] |= mask;
    mask >>= 1;
  };
  // --- Backwards data: the flag bits have the other sense (1 goes on, 0 ends a code)
  const gamma = (value, inverted = false) => {
    const width = Math.floor(Math.log2(value));
    for (let i = width - 1; i >= 0; i--) {
      bit(backwards ? 1 : 0);
      bit(((value >> i) & 1) ^ (inverted ? 1 : 0));
    }
    bit(backwards ? 0 : 1);
  };
  // --- Tokens: literal runs and matches; a literal run never follows a literal run
  const tokens = [];
  let pos = 0;
  while (pos < data.length) {
    const m = pos === 0 ? { len: 0 } : longestMatch(data, pos, 32640, 65535);
    if (m.len >= 2) {
      tokens.push({ kind: "match", len: m.len, offset: m.offset });
      pos += m.len;
    } else {
      const last = tokens[tokens.length - 1];
      if (last?.kind === "lit") last.bytes.push(data[pos]);
      else tokens.push({ kind: "lit", bytes: [data[pos]] });
      pos++;
    }
  }
  tokens.forEach((t, k) => {
    if (t.kind === "lit") {
      if (k > 0) bit(0);
      gamma(t.bytes.length);
      for (const b of t.bytes) out.push(b);
    } else {
      bit(1);
      const msb = ((t.offset - 1) >> 7) + 1;
      gamma(msb, !classic && !backwards);
      const lsb = backwards ? (t.offset - 1) % 128 : msb * 128 - t.offset;
      out.push((lsb << 1) & 0xff);
      backtrack = true;
      gamma(t.len - 1);
    }
  });
  bit(1);
  gamma(256, !classic && !backwards);
  return backwards ? out.reverse() : out;
}

/** The inverse of RCS: the RCS stream of a 6912-byte screen image (the bitmap reordered). */
function rcsEncode(screen) {
  const out = [...screen];
  for (let i = 0; i < 6144; i++) out[i] = screen[rcsAddress(i)];
  return out;
}

/** Where RCS byte `i` of the bitmap (0-6143) goes, as an offset from 16384. */
function rcsAddress(i) {
  const sector = i >> 11;
  const column = (i >> 6) & 31;
  const row = (i >> 3) & 7;
  const line = i & 7;
  return sector * 2048 + line * 256 + row * 32 + column;
}

// ------------------------------------------------------------------------------------------------
// MegaLZ

/**
 * MegaLZ: the first byte as is, then the first bit byte; codes (MSB first): `1`+byte a literal,
 * `000`+3 bits one byte from -8..-1, `001`+byte two from -256..-1, `010` three and `011`+length
 * longer ones with a far offset (`0`+byte -256..-1, `1`+4 bits+byte -4352..-257); `011` with nine
 * length bits ending in 1 is the end.
 */
function megaLzPack(input) {
  const data = [...input];
  const s = new BitStream();
  s.byte(data[0]);
  // --- The first bit byte is fetched at once, before any code
  s.bitIndex = s.out.length;
  s.out.push(0);
  s.mask = 0x80;
  const far = (disp) => {
    if (disp >= -256) {
      s.bit(0);
      s.byte(disp);
    } else {
      const hi = Math.floor(disp / 256) + 1;
      s.bit(1);
      s.bits(hi & 15, 4);
      s.byte(disp - Math.floor(disp / 256) * 256);
    }
  };
  let pos = 1;
  while (pos < data.length) {
    const m = longestMatch(data, pos, 4352, 255);
    const disp = -m.offset;
    if (m.len >= 3) {
      s.bits(0, 1);
      if (m.len === 3) s.bits(0b10, 2);
      else {
        s.bits(0b11, 2);
        const b = Math.floor(Math.log2(m.len - 2));
        for (let i = 1; i < b; i++) s.bit(0);
        s.bit(1);
        s.bits(m.len - 2 - (1 << b), b);
      }
      far(disp);
      pos += m.len;
    } else if (m.len === 2 && disp >= -256) {
      s.bits(0b0001, 3);
      s.byte(disp);
      pos += 2;
    } else if (m.len >= 1 && disp >= -8) {
      s.bits(0b000, 3);
      s.bits(disp & 7, 3);
      pos += 1;
    } else {
      s.bit(1);
      s.byte(data[pos]);
      pos++;
    }
  }
  // --- The end: `011` and a length code of nine bits
  s.bits(0b011, 3);
  s.bits(1, 9);
  return s.out;
}

module.exports = { zx0Pack, rcsEncode, rcsAddress, megaLzPack };
