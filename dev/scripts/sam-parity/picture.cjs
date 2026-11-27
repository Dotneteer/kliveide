/**
 * Compares a picture probe's two pictures (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, channel 3): for every row
 * of Klive's 640 x 288 picture with a white run, where the run starts and ends in both, as hc (T-states:
 * Klive x / 2 + 96 within the line, the next line's hc 0-31 past x 576).
 *
 * SimCoupé's window ("Full Active", -scale 2, -tvaspect 0, on a Retina display) shows the same area at 3
 * window pixels a Klive pixel across and 6 a row down, the picture starting at window y 64
 * (dev/ai/sam-coupe.md, "Oracle runs"); the script checks the size and gives up on any other.
 *
 *   node dev/scripts/sam-parity/picture.cjs <klive.png> <simcoupe.png>                 white runs
 *   node dev/scripts/sam-parity/picture.cjs --full <klive.png> <simcoupe.png> [diff.png]  every pixel
 */
const path = require("path");
const { REPO_ROOT } = require("../repo-root.cjs");
const sharp = require(path.join(REPO_ROOT, "node_modules", "sharp"));

const SIM = { sx: 3, sy: 6, ox: 0, oy: 64, width: 1920 };

async function rows(file, map) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (map && info.width !== map.width) throw new Error(`${file}: ${info.width} px wide, expected ${map.width}`);
  const white = (x, r) => {
    const px = map ? map.ox + Math.floor(x * map.sx + map.sx / 2) : x;
    const py = map ? map.oy + Math.floor(r * map.sy + map.sy / 2) : r;
    if (py >= info.height) return false;
    const i = (py * info.width + px) * 3;
    return data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200;
  };
  const out = new Map();
  for (let r = 0; r < 288; r++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < 640; x++) if (white(x, r)) { if (a < 0) a = x; b = x; }
    if (a >= 0) out.set(r, { a, b: b + 1 });
  }
  return out;
}

const hc = (x) => (x < 576 ? 96 + x / 2 : (x - 576) / 2 + 384);

async function comparePictures(klivePng, simPng) {
  const k = await rows(klivePng);
  const s = await rows(simPng, SIM);
  const lines = [];
  for (const r of [...new Set([...k.keys(), ...s.keys()])].sort((x, y) => x - y)) {
    const a = k.get(r);
    const b = s.get(r);
    lines.push({
      row: r,
      klive: a && [hc(a.a), hc(a.b)],
      simcoupe: b && [hc(b.a), hc(b.b)],
      startDiff: a && b ? hc(b.a) - hc(a.a) : undefined
    });
  }
  return lines;
}

/** SimCoupé's window as a 640 x 288 RGB picture (the centre of each 3 x 6 block) */
async function simAsKlive(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIM.width) throw new Error(`${file}: ${info.width} px wide, expected ${SIM.width}`);
  const out = Buffer.alloc(640 * 288 * 3);
  for (let r = 0; r < 288; r++) {
    const py = SIM.oy + Math.floor(r * SIM.sy + SIM.sy / 2);
    for (let x = 0; x < 640; x++) {
      const px = SIM.ox + Math.floor(x * SIM.sx + SIM.sx / 2);
      const i = (py * info.width + px) * 3;
      data.copy(out, (r * 640 + x) * 3, i, i + 3);
    }
  }
  return out;
}

/**
 * The whole picture, pixel by pixel. Each Klive colour is mapped to the SimCoupé colour it meets most often
 * (so palette levels do not count); a pixel differs when SimCoupé shows anything else there. SimCoupé's
 * window blurs every colour edge over about four window pixels (the Retina scaling, even with -filter 0),
 * so a pixel next to a colour edge in Klive's picture (left, right, above or below) is not judged, nor are the
 * window's rounded bottom corners. Returns the
 * mapping, the count of differing pixels, the rows with differences (first and last x) and, with `diffPng`,
 * writes a picture of them (red on a dimmed copy of Klive's).
 */
async function compareFull(klivePng, simPng, diffPng) {
  const k = (await sharp(klivePng).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
  const s = await simAsKlive(simPng);
  const key = (b, i) => (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
  const counts = new Map();
  for (let i = 0; i < 640 * 288 * 3; i += 3) {
    const kc = key(k, i);
    const sc = key(s, i);
    if (!counts.has(kc)) counts.set(kc, new Map());
    const m = counts.get(kc);
    m.set(sc, (m.get(sc) ?? 0) + 1);
  }
  const map = new Map();
  for (const [kc, m] of counts) map.set(kc, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  let differing = 0;
  const rows = [];
  const diff = Buffer.alloc(640 * 288 * 3);
  const at = (x, r) => key(k, (r * 640 + x) * 3);
  const nearEdge = (x, r) => {
    const c = at(x, r);
    return (
      (x > 0 && at(x - 1, r) !== c) ||
      (x < 639 && at(x + 1, r) !== c) ||
      (r > 0 && at(x, r - 1) !== c) ||
      (r < 287 && at(x, r + 1) !== c)
    );
  };
  // --- The window's rounded bottom corners
  const corner = (x, r) => r >= 280 && (x < 8 || x > 631);
  for (let r = 0; r < 288; r++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < 640; x++) {
      const i = (r * 640 + x) * 3;
      const bad = !nearEdge(x, r) && !corner(x, r) && map.get(key(k, i)) !== key(s, i);
      if (bad) {
        differing++;
        if (first < 0) first = x;
        last = x;
        diff[i] = 255;
      } else {
        diff[i] = k[i] >> 2;
        diff[i + 1] = k[i + 1] >> 2;
        diff[i + 2] = k[i + 2] >> 2;
      }
    }
    if (first >= 0) rows.push({ row: r, first, last });
  }
  if (diffPng) await sharp(diff, { raw: { width: 640, height: 288, channels: 3 } }).png().toFile(diffPng);
  const hex = (c) => `#${c.toString(16).padStart(6, "0")}`;
  // --- Two Klive colours shown as one SimCoupé colour: a difference the mapping would otherwise hide
  const seen = new Map();
  const merged = [];
  for (const [kc, sc] of map) {
    if (seen.has(sc)) merged.push([hex(seen.get(sc)), hex(kc), hex(sc)]);
    else seen.set(sc, kc);
  }
  return {
    differing,
    rows,
    merged,
    mapping: [...map.entries()].map(([kc, sc]) => [hex(kc), hex(sc)])
  };
}

module.exports = { comparePictures, compareFull };

if (require.main === module && process.argv[2] === "--full") {
  compareFull(process.argv[3], process.argv[4], process.argv[5]).then((r) => {
    console.log(`${r.differing} pixels differ in ${r.rows.length} rows; ${r.merged.length} colour pairs merged`);
    for (const row of r.rows.slice(0, 40)) console.log(`row ${row.row}: x ${row.first}-${row.last}`);
    console.log("colours (Klive -> SimCoupé):", r.mapping.map((m) => m.join("->")).join(" "));
  });
} else if (require.main === module) {
  comparePictures(process.argv[2], process.argv[3]).then((lines) => {
    console.log("row\tKlive start-end\tSimCoupé start-end\tstart diff (T)");
    for (const l of lines) {
      console.log(`${l.row}\t${l.klive ? l.klive.join("-") : "-"}\t${l.simcoupe ? l.simcoupe.join("-") : "-"}\t${l.startDiff ?? ""}`);
    }
  });
}
