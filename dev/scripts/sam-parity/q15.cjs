/**
 * Analyses the "pic-q15" parity probe (plan Q15, the mode-change artefact cell): for every screen line, the
 * cell where SimCoupé's picture differs from Klive's, its 8 pixels as CLUT indices in both, and the bytes
 * the ASIC fetched for that cell in the line's first and second mode (replaying the probe's LFSR).
 *
 *   node dev/scripts/sam-parity/q15.cjs <run folder>/pic-q15 [--json out.json]
 */
const fs = require("fs");
const path = require("path");
const { REPO_ROOT } = require("../repo-root.cjs");
const sharp = require(path.join(REPO_ROOT, "node_modules", "sharp"));

// --- The pages, as the probe fills them
function pages() {
  let lfsr = 0xace1;
  const next = () => {
    for (let i = 0; i < 16; i++) {
      const lsb = lfsr & 1;
      lfsr >>>= 1;
      if (lsb) lfsr ^= 0xb400;
    }
    return lfsr & 0xff;
  };
  const p26 = Buffer.alloc(0x4000);
  const p28 = Buffer.alloc(0x4000);
  const p30 = Buffer.alloc(0x8000);
  for (let i = 0; i < 0x4000; i++) p26[i] = next();
  for (let i = 0; i < 0x4000; i++) p28[i] = next();
  for (let i = 0; i < 0x8000; i++) p30[i] = next();
  return { p26, p28, p30 };
}

/** The bytes a cell's fetch reads in `mode` (1, 2 or 4) for screen line y, column c */
function fetch(pg, mode, y, c) {
  if (mode === 4) return [...pg.p30.subarray(y * 128 + c * 4, y * 128 + c * 4 + 4)];
  if (mode === 2) return [pg.p28[y * 32 + c], pg.p28[0x2000 + y * 32 + c]];
  const data = ((y & 0xc0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2) | c;
  return [pg.p26[data], pg.p26[0x1800 + (y >> 3) * 32 + c]];
}

/** CLUT entry i's colour as RGB levels 0-7 (entry i = (i * 9 + 3) AND 7Fh) */
function clutLevels() {
  return Array.from({ length: 16 }, (_, i) => {
    const c = (i * 9 + 3) & 0x7f;
    const br = (c >> 3) & 1;
    return [((c >> 5) & 1) * 4 + ((c >> 1) & 1) * 2 + br, ((c >> 6) & 1) * 4 + ((c >> 2) & 1) * 2 + br, ((c >> 4) & 1) * 4 + (c & 1) * 2 + br];
  });
}

/** The picture's 256 logical pixels a row (centres of the 2-pixel pairs of the screen, x 64-575) as CLUT indices */
async function indices(file, sim) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lv = clutLevels();
  const nearest = (r, g, b) => {
    let best = 0;
    let bd = 1e9;
    for (let i = 0; i < 16; i++) {
      const d = (lv[i][0] * 36.4 - r) ** 2 + (lv[i][1] * 36.4 - g) ** 2 + (lv[i][2] * 36.4 - b) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const rows = [];
  for (let y = 0; y < 192; y++) {
    const r = 48 + y;
    const row = [];
    for (let p = 0; p < 256; p++) {
      const kx = 64 + p * 2; // the pair's first Klive pixel
      const px = sim ? kx * 3 + 3 : kx;
      const py = sim ? 64 + r * 6 + 3 : r;
      const i = (py * info.width + px) * 3;
      row.push(nearest(data[i], data[i + 1], data[i + 2]));
    }
    rows.push(row);
  }
  return rows;
}

const GROUPS = [
  [4, 2],
  [2, 4],
  [4, 1],
  [1, 4]
];

/** A cell's 8 logical pixels (CLUT indices) in `mode` from its fetched bytes; `flash` swaps FLASH cells */
function render(mode, bytes, flash) {
  if (mode === 4) return bytes.flatMap((b) => [b >> 4, b >> 4, b & 15, b & 15]).filter((_, i) => i % 2 === 0);
  const [data, attr] = bytes;
  const br = attr & 0x40 ? 8 : 0;
  let ink = br | (attr & 7);
  let paper = br | ((attr >> 3) & 7);
  if (attr & 0x80 && flash) [ink, paper] = [paper, ink];
  return Array.from({ length: 8 }, (_, i) => ((data >> (7 - i)) & 1 ? ink : paper));
}

const same = (a, b) => a.every((v, i) => v === b[i]);

/** Per line, each cell as A (the first mode's picture), B (the second's) or X (neither) */
function classify(rows, pg, flash) {
  const lines = [];
  for (let y = 0; y < 192; y++) {
    const [from, to] = y < 96 ? [4, 2] : [4, 1];
    let line = "";
    for (let c = 0; c < 32; c++) {
      const got = rows[y].slice(c * 8, c * 8 + 8);
      const a = render(from, fetch(pg, from, y, c), flash);
      const b = render(to, fetch(pg, to, y, c), flash);
      line += same(got, a) && same(got, b) ? "=" : same(got, a) ? "A" : same(got, b) ? "B" : "X";
    }
    lines.push(line);
  }
  return lines;
}

(async () => {
  const dir = process.argv[2];
  const k = await indices(path.join(dir, "klive.png"), false);
  const s = await indices(path.join(dir, "simcoupe.png"), true);
  const pg = pages();
  // --- The FLASH phase: the one that classifies more cells
  const best = (rows) => {
    const count = (f) => classify(rows, pg, f).join("").replace(/X/g, "").length;
    return count(false) >= count(true) ? false : true;
  };
  const kl = classify(k, pg, best(k));
  const sl = classify(s, pg, best(s));
  for (let y = 0; y < 192; y++) {
    if (y % 4 !== 0 && kl[y] === sl[y]) continue;
    const [from, to] = y < 96 ? [4, 2] : [4, 1];
    console.log(`${String(y).padStart(3)} ${from}->${to} K ${kl[y]}  S ${sl[y]}${kl[y] === sl[y] ? "" : "  <<"}`);
  }
  // --- The X cells: the new mode on some arrangement of the bytes fetched around it?
  const fitAt = process.argv.indexOf("--fit");
  if (fitAt > 0) {
    const flashS = best(s);
    const cases = { start2: [], end2: [], start1: [], end1: [] };
    for (let y = 0; y < 192; y++) {
      const line = sl[y];
      const mode = y < 96 ? 2 : 1;
      for (let c = 0; c < 32; c++) {
        if (line[c] !== "X") continue;
        const kind = (c + 1 < 32 && line[c + 1] === "B" ? "start" : "end") + mode;
        cases[kind].push({ y, c, got: s[y].slice(c * 8, c * 8 + 8) });
      }
    }
    for (const [kind, list] of Object.entries(cases)) {
      const mode = Number(kind.slice(-1));
      const newMode = kind.startsWith("start") ? mode : 4;
      // --- The candidate bytes: mode 4's four and the other mode's two, for this cell and its neighbours
      const pool = (y, c) => {
        const o = {};
        for (const d of [-1, 0, 1]) {
          if (c + d < 0 || c + d > 31) continue;
          fetch(pg, 4, y, c + d).forEach((b, i) => (o[`m4[${i}]@${d}`] = b));
          fetch(pg, mode, y, c + d).forEach((b, i) => (o[`m${mode}[${i}]@${d}`] = b));
        }
        return o;
      };
      const names = Object.keys(pool(list[0].y, Math.max(1, Math.min(30, list[0].c))));
      const width = newMode === 4 ? 4 : 2;
      const found = [];
      const tryCombo = (combo) => {
        const ok = list.every(({ y, c, got }) => {
          const p = pool(y, c);
          if (combo.some((n) => p[n] === undefined)) return false;
          return same(got, render(newMode, combo.map((n) => p[n]), flashS));
        });
        if (ok) found.push(combo.join(" "));
      };
      const rec = (prefix) => {
        if (found.length > 5) return;
        if (prefix.length === width) return tryCombo(prefix);
        for (const n of names) rec([...prefix, n]);
      };
      rec([]);
      console.log(`${kind} (${list.length} cells, rendered as mode ${newMode}): ${found.length ? found.join(" | ") : "no byte arrangement fits"}`);
      // --- Bit level: each output bit (pixel p, index bit j) against every input bit, and constants
      const bitNames = names.flatMap((n) => Array.from({ length: 8 }, (_, b) => [n, b]));
      const lines = [];
      for (let px = 0; px < 8; px++) {
        const parts = [];
        for (let j = 3; j >= 0; j--) {
          const outs = list.map(({ got }) => (got[px] >> j) & 1);
          if (outs.every((v) => v === 0)) { parts.push("0"); continue; }
          if (outs.every((v) => v === 1)) { parts.push("1"); continue; }
          const hits = [];
          for (const [n, b] of bitNames) {
            const ok = list.every(({ y, c }, i) => {
              const v = pool(y, c)[n];
              return v !== undefined && ((v >> b) & 1) === outs[i];
            });
            if (ok) hits.push(`${n}.${b}`);
            const inv = list.every(({ y, c }, i) => {
              const v = pool(y, c)[n];
              return v !== undefined && ((v >> b) & 1) !== outs[i];
            });
            if (inv) hits.push(`~${n}.${b}`);
          }
          parts.push(hits.length ? hits.slice(0, 2).join("/") : "?");
        }
        lines.push(`  px${px}: ${parts.join(" ")}`);
      }
      console.log(lines.join("\n"));
    }
  }
  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt > 0) fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ k, s }));
})();
