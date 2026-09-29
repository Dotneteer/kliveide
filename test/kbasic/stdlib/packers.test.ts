import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const packers = require("../../../scripts/kbasic-packers.cjs") as {
  zx0Pack(data: number[], o?: { classic?: boolean; backwards?: boolean }): number[];
  megaLzPack(data: number[]): number[];
  rcsEncode(screen: number[]): number[];
  rcsAddress(i: number): number;
};

/** ZX0 decoded as its format describes (the test's own reading, independent of the packer). */
function zx0Unpack(input: number[], classic = false, backwards = false): number[] {
  const out: number[] = [];
  let pos = 0;
  let mask = 0;
  let value = 0;
  let last = 0;
  let backtrack = false;
  const readByte = () => (last = input[pos++]);
  const bit = () => {
    if (backtrack) {
      backtrack = false;
      return last & 1;
    }
    mask >>= 1;
    if (!mask) {
      mask = 0x80;
      value = readByte();
    }
    return value & mask ? 1 : 0;
  };
  // --- Backwards data (read from its end): the flag bits flipped, the MSB plain, the LSB (offset - 1)
  const gamma = (inv: number) => {
    let v = 1;
    while (bit() === (backwards ? 1 : 0)) v = (v << 1) | (bit() ^ inv);
    return v;
  };
  let offset = 1;
  let state: "lit" | "last" | "new" = "lit";
  for (;;) {
    if (state === "lit") {
      const n = gamma(0);
      for (let i = 0; i < n; i++) out.push(readByte());
      state = bit() ? "new" : "last";
    } else if (state === "last") {
      const n = gamma(0);
      for (let i = 0; i < n; i++) out.push(out[out.length - offset]);
      state = bit() ? "new" : "lit";
    } else {
      const msb = gamma(classic || backwards ? 0 : 1);
      if (msb === 256) return out;
      offset = backwards ? (msb - 1) * 128 + (readByte() >> 1) + 1 : msb * 128 - (readByte() >> 1);
      backtrack = true;
      const n = gamma(0) + 1;
      for (let i = 0; i < n; i++) out.push(out[out.length - offset]);
      state = bit() ? "new" : "lit";
    }
  }
}

/** MegaLZ decoded as its format describes. */
function megaLzUnpack(input: number[]): number[] {
  let pos = 0;
  const out = [input[pos++]];
  let bits = input[pos++];
  let left = 8;
  const bit = () => {
    if (!left) {
      bits = input[pos++];
      left = 8;
    }
    left--;
    const b = (bits >> 7) & 1;
    bits = (bits << 1) & 0xff;
    return b;
  };
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bit();
    return v;
  };
  const copy = (disp: number, n: number) => {
    for (let i = 0; i < n; i++) out.push(out[out.length + disp]);
  };
  const far = (n: number) => {
    if (!bit()) copy(-256 | input[pos++], n);
    else {
      const b = take(4);
      copy(((-16 | b) - 1) * 256 + input[pos++], n);
    }
  };
  for (;;) {
    if (bit()) {
      out.push(input[pos++]);
      continue;
    }
    const kind = take(2);
    if (kind === 0) copy(-8 | take(3), 1);
    else if (kind === 1) copy(-256 | input[pos++], 2);
    else if (kind === 2) far(3);
    else {
      let n = 0;
      do n++;
      while (!bit());
      if (n === 9) return out;
      far(2 + (1 << n) + take(n));
    }
  }
}

const TEXT = [..."Klive BASIC packs: abcabcabcabc, the rain in Spain stays mainly in the plain; 0000000000 plain plain!"].map((c) => c.charCodeAt(0));
const NOISE = Array.from({ length: 3000 }, (_, i) => ((i * 7919) % 251) & (i % 3 ? 255 : 15));

describe("test-data packers (compatibility plan C6)", () => {
  it.each([["text", TEXT], ["noise", NOISE]])("ZX0 round-trips %s, in both formats and backwards", (_, data) => {
    expect(zx0Unpack(packers.zx0Pack(data))).toEqual(data);
    expect(zx0Unpack(packers.zx0Pack(data, { classic: true }), true)).toEqual(data);
    expect(zx0Unpack(packers.zx0Pack(data, { backwards: true }).reverse(), false, true).reverse()).toEqual(data);
  });

  it.each([["text", TEXT], ["noise", NOISE]])("MegaLZ round-trips %s", (_, data) => {
    expect(megaLzUnpack(packers.megaLzPack(data))).toEqual(data);
  });

  it("maps RCS bytes to every bitmap address once", () => {
    const seen = new Set(Array.from({ length: 6144 }, (_, i) => packers.rcsAddress(i)));
    expect(seen.size).toBe(6144);
    expect(packers.rcsAddress(1)).toBe(256);
    expect(packers.rcsAddress(8)).toBe(32);
    expect(packers.rcsAddress(64)).toBe(1);
  });
});
