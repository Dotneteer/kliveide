// Sample screen files for dev/plans/SCREEN_FILE_VIEWERS_PLAN.md, built with the real byte layouts.
// One source for two users: build-mockup.cjs inlines it into the mockup, and generate-samples.cjs
// writes the files to samples/ for the manual tests. Pass the 48K ROM's character set (768 bytes
// from $3D00); the pictures' text is drawn with it.
//
// Layouts (checked against Klive's Next core, src/emu/machines/zxNext/wasm/zxnext/):
// - SCR: 6,144 interleaved pixel bytes, then 768 attributes.
// - Layer 2 256x192: row-major (y << 8 | x). 320x256: column-major (x << 8 | y). 640x256: column-major
//   bytes of two pixels, the left one in the high nibble.
// - LoRes 128x96: one byte per pixel, row-major. Rows 0-47 at $4000, rows 48-95 at $6000; the
//   12,288-byte file is the two halves in order (zxnextLoResStandardAddress).
// - Timex hi-colour: the 6,144 SCR-layout pixel bytes, then 6,144 attribute bytes in the same
//   layout (one attribute per 8x1 strip, from $6000).
// - Timex hi-res 512x192: each 16-pixel word is a byte from $4000 (left) and the byte at the same
//   offset from $6000 (right); the file is the $4000 half, then the $6000 half.
// - A PLUS3DOS header is 128 bytes: "PLUS3DOS", $1A, 1, 0, the file length, then the BASIC header
//   (type 3 = CODE, length, load address, $8000) and the checksum of the first 127 bytes.
function screenSamples(FONT) {
  "use strict";
  const concat = (...parts) => {
    const o = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { o.set(p, at); at += p.length; }
    return o;
  };

  function plus3Header(dataLength, start) {
    const h = new Uint8Array(128);
    "PLUS3DOS".split("").forEach((c, i) => (h[i] = c.charCodeAt(0)));
    h[8] = 0x1a; h[9] = 1; h[10] = 0;
    const total = dataLength + 128;
    h[11] = total & 0xff; h[12] = (total >> 8) & 0xff; h[13] = (total >> 16) & 0xff; h[14] = (total >> 24) & 0xff;
    h[15] = 3; // CODE
    h[16] = dataLength & 0xff; h[17] = (dataLength >> 8) & 0xff;
    h[18] = start & 0xff; h[19] = (start >> 8) & 0xff;
    h[20] = 0x00; h[21] = 0x80;
    let sum = 0;
    for (let i = 0; i < 127; i++) sum = (sum + h[i]) & 0xff;
    h[127] = sum;
    return h;
  }
  const withHeader = (data, start) => concat(plus3Header(data.length, start), data);

  function drawText(set, text, x0, y0, scale = 1) {
    for (let n = 0; n < text.length; n++) {
      const code = text.charCodeAt(n) - 32;
      for (let r = 0; r < 8; r++) {
        const row = FONT[code * 8 + r];
        for (let b = 0; b < 8; b++) {
          if (!(row & (0x80 >> b))) continue;
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) set(x0 + (n * 8 + b) * scale + sx, y0 + r * scale + sy);
        }
      }
    }
  }
  /** The SCR interleave: the offset of the byte holding pixel column `col` (0-31) of row y */
  const scrOffset = (col, y) => ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) | col;
  const rgb332 = (r, g, b) => (r << 5) | (g << 2) | b;

  // ---------------------------------------------------------------------------------------------
  // SCR

  function scrScreen() {
    const s = new Uint8Array(6912);
    const pset = (x, y) => { if (x < 0 || y < 0 || x > 255 || y > 191) return; s[scrOffset(x >> 3, y)] |= 0x80 >> (x & 7); };
    const attr = (col, row, v) => (s[0x1800 + row * 32 + col] = v);
    for (let r = 0; r < 24; r++) for (let c = 0; c < 32; c++) attr(c, r, (1 << 3) | 7); // PAPER 1, INK 7
    const bars = [2, 6, 4, 5];
    for (let c = 0; c < 32; c++) for (let r = 0; r < 2; r++) attr(c, r, 0x40 | (bars[c >> 3] << 3));
    drawText(pset, "KLIVE IDE", 56, 32, 2);
    for (let c = 6; c < 26; c++) for (let r = 4; r < 6; r++) attr(c, r, 0x40 | (1 << 3) | 6); // BRIGHT, INK 6
    drawText(pset, "SCREEN FILE VIEWER", 56, 56);
    for (let c = 7; c < 25; c++) attr(c, 7, (1 << 3) | 5);
    for (let a = 0; a < 720; a++) { const t = (a / 720) * Math.PI * 2; pset(Math.round(128 + 36 * Math.cos(t)), Math.round(122 + 36 * Math.sin(t))); }
    for (let y = 100; y < 144; y += 4) for (let x = 104; x < 152; x++) if ((x - 128) ** 2 + (y - 122) ** 2 < 30 * 30) pset(x, y);
    for (let c = 11; c < 21; c++) for (let r = 10; r < 20; r++) attr(c, r, 0x40 | (1 << 3) | 4); // BRIGHT, INK 4
    drawText(pset, "PRESS ANY KEY", 76, 176);
    for (let c = 9; c < 23; c++) attr(c, 22, 0x80 | (7 << 3) | 2); // FLASH, PAPER 7, INK 2
    return s;
  }

  // ---------------------------------------------------------------------------------------------
  // Layer 2

  function l2Title() {
    const d = new Uint8Array(49152);
    const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < 256 && y < 192) d[(y << 8) | x] = v; };
    for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) {
      let v = rgb332(0, Math.min(7, Math.floor(y / 30)), 3 - Math.min(3, Math.floor(y / 48)));
      if (y > 120 + 14 * Math.sin(x / 23)) v = rgb332(0, 4 - Math.min(3, Math.floor((y - 120) / 20)), 0);
      if ((x - 190) ** 2 + (y - 60) ** 2 < 22 * 22) v = rgb332(7, 7 - Math.floor(Math.abs(y - 60) / 8), 0);
      put(x, y, v);
    }
    drawText((x, y) => put(x, y, 0xff), "LAYER 2", 20, 140, 3);
    return d;
  }
  /** A palette block: 256 entries of `RRRGGGBB`, `0000000B` */
  function paletteBlock(entry) {
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) { const v = entry(i); p[i * 2] = (v >> 1) & 0xff; p[i * 2 + 1] = v & 1; }
    return p;
  }
  const nine = (r, g, b) => (r << 6) | (g << 3) | b;
  /** The default palette with red and blue swapped: proves a viewer uses the file's palette */
  const swappedPalette = () => paletteBlock((i) => nine(i & 3 ? ((i & 3) << 1) | 1 : 0, (i >> 2) & 7, i >> 5));

  function l2City() {
    const pal = paletteBlock((i) => {
      if (i < 64) return nine(Math.min(7, Math.floor(i / 7)), Math.min(7, Math.floor(i / 14)), 7 - Math.floor(i / 10));
      if (i < 72) return nine(i - 64, i - 64, Math.min(7, i - 63));
      if (i === 200) return nine(7, 6, 2);
      if (i === 201) return nine(7, 7, 5);
      if (i === 255) return nine(7, 7, 7);
      return 0;
    });
    const d = new Uint8Array(81920);
    const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < 320 && y < 256) d[(x << 8) | y] = v; };
    for (let x = 0; x < 320; x++) for (let y = 0; y < 256; y++) put(x, y, Math.min(63, y >> 2));
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let bx = 0; bx < 320; ) {
      const w = 18 + Math.floor(rnd() * 26), h = 60 + Math.floor(rnd() * 130), shade = 64 + Math.floor(rnd() * 3);
      for (let x = bx; x < bx + w; x++) for (let y = 256 - h; y < 256; y++) put(x, y, shade);
      for (let x = bx + 3; x < bx + w - 3; x += 5) for (let y = 256 - h + 5; y < 250; y += 7) {
        if (rnd() > 0.45) { put(x, y, 200); put(x + 1, y, 200); put(x, y + 1, 201); put(x + 1, y + 1, 201); }
      }
      bx += w + 2;
    }
    drawText((x, y) => put(x, y, 255), "320x256", 12, 14, 2);
    return { pal, d };
  }

  function l2Hires() {
    const d = new Uint8Array(81920);
    const put = (x, y, v) => {
      if (x < 0 || y < 0 || x >= 640 || y >= 256) return;
      const o = ((x >> 1) << 8) | y;
      d[o] = x & 1 ? (d[o] & 0xf0) | v : (d[o] & 0x0f) | (v << 4);
    };
    for (let x = 0; x < 640; x++) for (let y = 0; y < 256; y++) put(x, y, ((Math.floor(x / 40) + Math.floor(y / 32)) & 1) ? 1 : 2);
    for (let a = 0; a < 2000; a++) {
      const t = (a / 2000) * Math.PI * 2;
      for (let k = 0; k < 3; k++) put(Math.round(320 + (200 - k) * Math.cos(t)), Math.round(128 + (100 - k / 2) * Math.sin(t)), 14);
    }
    drawText((x, y) => put(x, y, 15), "640x256 4BPP", 224, 116, 2);
    return d;
  }

  // ---------------------------------------------------------------------------------------------
  // LoRes, Timex hi-colour, Timex hi-res

  function lores() {
    const d = new Uint8Array(12288);
    const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < 128 && y < 96) d[(y << 7) | x] = v; };
    for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) {
      const r = Math.hypot(x - 64, y - 48);
      put(x, y, rgb332(Math.floor(r / 6) & 7, Math.floor(y / 12) & 7, Math.floor(x / 32) & 3));
    }
    for (let x = 0; x < 128; x++) { put(x, 47, 0xff); put(x, 48, 0xe0); } // the two halves' seam
    drawText((x, y) => put(x, y, 0xff), "LORES", 44, 8);
    drawText((x, y) => put(x, y, 0x00), "128x96", 40, 80);
    return d;
  }

  function hicolour() {
    const px = new Uint8Array(6144), at = new Uint8Array(6144);
    const pset = (x, y) => { if (x >= 0 && y >= 0 && x < 256 && y < 192) px[scrOffset(x >> 3, y)] |= 0x80 >> (x & 7); };
    drawText(pset, "HI-COLOUR", 20, 40, 3);
    drawText(pset, "8x1 ATTRIBUTES", 72, 120);
    for (let y = 150; y < 192; y++) for (let x = 0; x < 256; x++) if ((x + y) & 4) pset(x, y);
    // --- each pixel row gets its own colours: impossible on a 48K screen, whose cells are 8x8
    for (let y = 0; y < 192; y++) for (let col = 0; col < 32; col++) {
      const ink = 1 + ((y >> 1) + col) % 7, paper = y < 150 ? 0 : 7 - ((y >> 2) % 7);
      at[scrOffset(col, y)] = 0x40 | (paper << 3) | ink;
    }
    return concat(px, at);
  }

  function hires() {
    const a = new Uint8Array(6144), b = new Uint8Array(6144);
    const pset = (x, y) => {
      if (x < 0 || y < 0 || x >= 512 || y >= 192) return;
      const byteCol = x >> 3, half = byteCol & 1 ? b : a;
      half[scrOffset(byteCol >> 1, y)] |= 0x80 >> (x & 7);
    };
    drawText(pset, "TIMEX HI-RES", 64, 24, 4);
    drawText(pset, "512x192: EACH 16-PIXEL WORD = A $4000 BYTE + A $6000 BYTE", 32, 80);
    for (let x = 0; x < 512; x += 2) for (let y = 100; y < 120; y++) pset(x, y); // one-pixel stripes
    for (let x = 0; x < 512; x++) for (let y = 130; y < 190; y++) if (((x >> 3) & 1) === 0) pset(x, y); // byte columns alternate
    return concat(a, b);
  }

  // ---------------------------------------------------------------------------------------------
  // The files

  const scr = scrScreen();
  const title = l2Title();
  const city = l2City();
  const hiresL2 = l2Hires();
  const broken = Uint8Array.from({ length: 7000 }, (_, i) => (i * 37) & 0xff);
  const loresPic = lores(), hicolPic = hicolour(), hiresPic = hires();

  // --- `kind` is the viewer that opens it; `check` is what a manual test should see
  const files = [
    { name: "SCREEN.SCR", kind: "scr", bytes: scr, check: "A 48K screen: rainbow bars, BRIGHT title, green circle, a FLASH line (PRESS ANY KEY)." },
    { name: "SCREEN-HEADER.SCR", kind: "scr", bytes: withHeader(scr, 0x4000), check: "Same picture after a PLUS3DOS header (CODE at $4000)." },
    { name: "SCREEN-AT-8000.SCR", kind: "scr", bytes: withHeader(scr, 0x8000), check: "Same picture; the header loads at $8000, so the viewer warns (not an error)." },
    { name: "BROKEN.SCR", kind: "scr", bytes: broken, check: "7,000 bytes: refused with the size message." },
    { name: "TITLE.SL2", kind: "l2", bytes: withHeader(title, 0x0000), check: "Layer 2 256x192 after a PLUS3DOS header (the wiki's .sl2): sky, sun, hills, LAYER 2." },
    { name: "TITLE-BARE.SL2", kind: "l2", bytes: title, check: "Same picture, no header." },
    { name: "TITLE.NXI", kind: "l2", bytes: title, check: "256x192, no palette: the Next default palette." },
    { name: "TITLE-PALETTE.NXI", kind: "l2", bytes: concat(swappedPalette(), title), check: "256x192 with its own palette (red and blue swapped): the sky turns red, the sun blue." },
    { name: "CITY.NXI", kind: "l2", bytes: concat(city.pal, city.d), check: "320x256 with its own palette: a dusk skyline. Shown as 640x256 it is garbage." },
    { name: "HIRES.NXI", kind: "l2", bytes: hiresL2, check: "640x256 4-bit, no palette: a checkerboard, an ellipse, 640x256 4BPP. Shown as 320x256 it is garbage." },
    { name: "LORES.SLR", kind: "slr", bytes: loresPic, check: "LoRes 128x96: rings, LORES, 128x96; a white then a red line where the two 6K halves meet (rows 47/48)." },
    { name: "LORES-HEADER.SLR", kind: "slr", bytes: withHeader(loresPic, 0x4000), check: "Same picture after a PLUS3DOS header." },
    { name: "HICOLOUR.SHC", kind: "shc", bytes: hicolPic, check: "Timex hi-colour: HI-COLOUR with a different colour on every pixel row (8x1 attributes)." },
    { name: "HICOLOUR-HEADER.SHC", kind: "shc", bytes: withHeader(hicolPic, 0x4000), check: "Same picture after a PLUS3DOS header." },
    { name: "HIRES.SHR", kind: "shr", bytes: hiresPic, check: "Timex hi-res 512x192 mono: big TIMEX HI-RES, a line of 64-column text, one-pixel stripes, 8-pixel bars." },
    { name: "HIRES-HEADER.SHR", kind: "shr", bytes: withHeader(hiresPic, 0x4000), check: "Same picture after a PLUS3DOS header." }
  ];
  return { files, plus3Header };
}

if (typeof module !== "undefined") module.exports = screenSamples;
