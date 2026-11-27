/**
 * The SAA 1099 differential test (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, Phase 6, sound step 1).
 * Developer tool, never CI.
 *
 * Klive's SAA 1099 is ported from SAASound (decision D1); this checks the port against SAASound itself.
 * Both are built natively into one runner (harness.cpp, klive-saa.c; SAASound from the pinned sources in
 * dev/research/sam-coupe/saasound/), fed the same timed register scripts, and their output levels compared
 * sample by sample (each side's mean level over the sample, SAASound's units, 0-2880):
 *
 * - edges: a sample is a mismatch when either stream's value lies outside the other's range over the
 *   neighbouring samples (i - 1 .. i + 1) by more than TOLERANCE: equal up to an edge moved by one sample;
 * - windows: the mean level over windows of WINDOW samples, the largest difference.
 *
 * SAASound steps per output sample (64 ticks a sample here) with 12-bit fractional periods; Klive keeps exact
 * edge times. That stepping is Klive's on purpose; anything beyond it is a port bug.
 *
 *   node dev/scripts/sam-parity/saasound-diff/saasound-diff.cjs [case...] [--rate <hz>] [--oversample <n>] [--fine]
 *
 * --avoid-ties holds back any write within 16 chip clocks of a generator edge until a clear sample (the same,
 * later write for both): a write that ties with an edge is decided by SAASound's stepping, not by the port.
 *
 * --fine runs SAASound at one tick per chip clock (2 MHz, 4x oversampling): its edges then land on the same
 * clocks as Klive's, which separates logic differences from stepping ones. The default is 44.1 kHz with
 * SAASound's 64x oversampling.
 *
 * Output: .local/sam-parity/saasound-diff/ (the runner, the scripts, report.md).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { REPO_ROOT } = require("../../repo-root.cjs");

const HERE = __dirname;
const SAASOUND = path.join(REPO_ROOT, "dev", "research", "sam-coupe", "saasound");
const OUT = path.join(REPO_ROOT, ".local", "sam-parity", "saasound-diff");
const TOLERANCE = 8;
const WINDOW = 441;
/** A blip: a mismatch run of at most this many samples (fine mode: 32 clocks, SAASound's period drift over seconds) */
let BLIP = 2;

function parseArgs(argv) {
  const opts = { cases: [], rate: 44100, oversample: 6 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--rate") opts.rate = Number(argv[++i]);
    else if (argv[i] === "--oversample") opts.oversample = Number(argv[++i]);
    else if (argv[i] === "--avoid-ties") opts.avoidTies = 16;
    else if (argv[i] === "--fine") {
      opts.rate = 2000000;
      opts.oversample = 2;
      BLIP = 8;
    }
    else opts.cases.push(argv[i]);
  }
  return opts;
}

/** Builds the runner (Xcode's clang; no exceptions, so no C++ runtime beyond the basics) */
function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = path.join(SAASOUND, "src");
  const object = path.join(OUT, "klive-saa.o");
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`);
      process.exit(1);
    }
  };
  run("xcrun", ["clang", "-O2", "-c", path.join(HERE, "klive-saa.c"), "-o", object]);
  run("xcrun", [
    "clang++", "-O2", "-std=c++14", "-w", "-fno-exceptions", "-DHAVE_CONFIG_H",
    `-I${HERE}`, `-I${src}`, `-I${path.join(SAASOUND, "include")}`,
    path.join(HERE, "harness.cpp"),
    ...["SAADevice", "SAAFreq", "SAANoise", "SAAEnv", "SAAAmp"].map((f) => path.join(src, `${f}.cpp`)),
    object, "-o", path.join(OUT, "harness")
  ]);
}

// ---------------------------------------------------------------------------------------------------------
// The register scripts. A script is a list of [sample, register, value] writes (an address write, then a
// data write, at the same sample) and address-only writes [sample, register] (the external envelope clock).

/** A small deterministic generator (mulberry32) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ms = (rate, t) => Math.round((t * rate) / 1000);

/** Every channel at full volume on both sides, tones on, noise off, output on */
const allOn = () => [
  ...[0, 1, 2, 3, 4, 5].map((ch) => [0, ch, 0xff]),
  [0, 0x14, 0x3f],
  [0, 0x15, 0x00],
  [0, 0x1c, 0x01]
];

function cases(rate) {
  const at = (t) => ms(rate, t);
  const list = {};

  // --- Tones: one channel, then all six at different pitches and stereo amplitudes
  list["tone-one"] = {
    length: at(500),
    writes: [[0, 0x00, 0xa5], [0, 0x08, 100], [0, 0x10, 0x03], [0, 0x14, 0x01], [0, 0x1c, 0x01]]
  };
  list["tone-six"] = {
    length: at(500),
    writes: [
      ...[0, 1, 2, 3, 4, 5].map((ch) => [0, ch, ((ch * 3 + 1) & 15) | ((15 - ch * 2) << 4)]),
      ...[0, 1, 2, 3, 4, 5].map((ch) => [0, 0x08 + ch, 20 + ch * 40]),
      [0, 0x10, 0x21], [0, 0x11, 0x43], [0, 0x12, 0x65],
      [0, 0x14, 0x3f], [0, 0x1c, 0x01]
    ]
  };
  // --- Every octave and a sweep of offsets, one channel, a new value every 20 ms
  {
    const writes = [[0, 0x00, 0xff], [0, 0x14, 0x01], [0, 0x1c, 0x01]];
    let t = 0;
    for (let oct = 0; oct < 8; oct++) {
      for (const off of [0, 17, 128, 200, 255]) {
        writes.push([at(t), 0x10, oct], [at(t), 0x08, off]);
        t += 20;
      }
    }
    list["tone-sweep"] = { length: at(t + 20), writes };
  }
  // --- Octave and offset write orders (the half-cycle rules): offset alone, octave alone, offset then
  // --- octave, octave then offset, and both written twice inside one half cycle
  {
    const writes = [[0, 0x00, 0xff], [0, 0x14, 0x01], [0, 0x1c, 0x01], [0, 0x10, 0x02], [0, 0x08, 50]];
    const r = rng(7);
    let t = 5;
    for (let i = 0; i < 200; i++) {
      const s = at(t);
      const kind = i % 5;
      const oct = Math.floor(r() * 4) + 1;
      const off = Math.floor(r() * 256);
      if (kind === 0) writes.push([s, 0x08, off]);
      else if (kind === 1) writes.push([s, 0x10, oct]);
      else if (kind === 2) writes.push([s, 0x08, off], [s + 1, 0x10, oct]);
      else if (kind === 3) writes.push([s, 0x10, oct], [s + 1, 0x08, off]);
      else writes.push([s, 0x08, off], [s, 0x10, oct], [s + 2, 0x08, (off + 99) & 255], [s + 2, 0x10, (oct + 1) & 7]);
      t += 2 + r() * 6;
    }
    list["tone-orders"] = { length: at(t + 20), writes };
  }
  // --- Noise: each source for each generator, noise alone and with the tone
  for (const source of [0, 1, 2, 3]) {
    list[`noise-src${source}`] = {
      length: at(400),
      writes: [
        ...allOn(),
        [0, 0x08, 150], [0, 0x0b, 60], [0, 0x10, 0x05], [0, 0x11, 0x03],
        [0, 0x14, 0x00], [0, 0x15, 0x3f], [0, 0x16, source | (source << 4)],
        [at(200), 0x14, 0x3f]
      ]
    };
  }
  // --- Noise source changes mid-period (the fraction kept)
  {
    const writes = [...allOn(), [0, 0x14, 0x00], [0, 0x15, 0x09], [0, 0x08, 80], [0, 0x0b, 200], [0, 0x10, 0x04], [0, 0x11, 0x20]];
    const r = rng(11);
    let t = 0;
    for (let i = 0; i < 150; i++) {
      writes.push([at(t), 0x16, Math.floor(r() * 4) | (Math.floor(r() * 4) << 4)]);
      t += 0.5 + r() * 5;
    }
    list["noise-switch"] = { length: at(t + 20), writes };
  }
  // --- Envelopes: every shape, 4 and 3 bits, inverted right side, internal clock (tones 1 and 4)
  for (let shape = 0; shape < 8; shape++) {
    for (const bits3 of [0, 1]) {
      const control = 0x80 | (bits3 << 4) | (shape << 1) | (shape & 1);
      list[`env-s${shape}-${bits3 ? "3b" : "4b"}`] = {
        length: at(300),
        writes: [
          ...allOn(),
          [0, 0x09, 0x80], [0, 0x0c, 0x30], [0, 0x10, 0x60], [0, 0x11, 0x06],
          [0, 0x0a, 0x10], [0, 0x0d, 0xf0], [0, 0x12, 0x33],
          [0, 0x18, control], [0, 0x19, control ^ 0x01],
          [at(150), 0x18, control & 0x7f]
        ]
      };
    }
  }
  // --- Envelopes clocked externally (address writes of 18h/19h)
  {
    const writes = [...allOn(), [0, 0x0a, 0x10], [0, 0x0d, 0x40], [0, 0x12, 0x44], [0, 0x18, 0xa4], [0, 0x19, 0xab]];
    let t = 1;
    for (let i = 0; i < 300; i++) {
      writes.push([at(t), 0x18], [at(t) + 3, 0x19]);
      t += 1.3;
    }
    list["env-external"] = { length: at(t + 20), writes };
  }
  // --- Envelope control written mid-shape: the resolution switch at once, the rest at points (3)/(4)
  {
    const writes = [...allOn(), [0, 0x09, 0x20], [0, 0x0c, 0xc0], [0, 0x10, 0x50], [0, 0x11, 0x05], [0, 0x0a, 0x80], [0, 0x0d, 0x10]];
    const r = rng(23);
    let t = 0;
    for (let i = 0; i < 120; i++) {
      const v = 0x80 | Math.floor(r() * 0x40);
      writes.push([at(t), 0x18 + (i & 1), r() < 0.1 ? v & 0x7f : v]);
      t += 1 + r() * 8;
    }
    list["env-midshape"] = { length: at(t + 20), writes };
  }
  // --- Sync on and off, the output enable, amplitude changes
  {
    const writes = [...allOn(), [0, 0x15, 0x24], [0, 0x16, 0x21], ...[0, 1, 2, 3, 4, 5].map((ch) => [0, 0x08 + ch, ch * 37]), [0, 0x10, 0x32], [0, 0x11, 0x54], [0, 0x12, 0x76]];
    const r = rng(5);
    let t = 3;
    for (let i = 0; i < 80; i++) {
      const what = Math.floor(r() * 4);
      if (what === 0) writes.push([at(t), 0x1c, 0x03], [at(t + 0.2 + r() * 3), 0x1c, 0x01]);
      else if (what === 1) writes.push([at(t), 0x1c, 0x00], [at(t + 1), 0x1c, 0x01]);
      else if (what === 2) writes.push([at(t), Math.floor(r() * 6), Math.floor(r() * 256)]);
      else writes.push([at(t), 0x08 + Math.floor(r() * 6), Math.floor(r() * 256)]);
      t += 4 + r() * 6;
    }
    writes.sort((a, b) => a[0] - b[0]);
    list["sync-mute-amp"] = { length: at(t + 20), writes };
  }
  // --- Random writes to every register, several seeds
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const r = rng(seed * 101);
    const writes = [[0, 0x1c, 0x01]];
    let t = 0;
    for (let i = 0; i < 1500; i++) {
      const reg = Math.floor(r() * 32);
      if (reg === 0x1c) writes.push([at(t), 0x1c, r() < 0.15 ? 0x03 : 0x01]);
      else if (r() < 0.05) writes.push([at(t), 0x18 + Math.floor(r() * 2)]);
      else writes.push([at(t), reg, Math.floor(r() * 256)]);
      t += r() * 2;
    }
    list[`random-${seed}`] = { length: at(t + 20), writes };
  }
  return list;
}

/** A case as the runner's script */
function scriptText({ length, writes }) {
  const hex = (v) => v.toString(16).toUpperCase().padStart(2, "0");
  const lines = [];
  for (const w of writes) {
    lines.push(`${w[0]} A ${hex(w[1])}`);
    if (w.length > 2) lines.push(`${w[0]} D ${hex(w[2])}`);
  }
  lines.push(`${length} END`);
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------------------

function compare(file, oversample) {
  const bytes = fs.readFileSync(file);
  const f = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  const n = f.length / 4;
  // --- Per side: blips (mismatch runs of at most BLIP samples: an edge one tick apart) and divergences (longer runs)
  const result = { samples: n, blips: [0, 0], divergences: [0, 0], first: [-1, -1], window: [0, 0], peak: 0 };
  for (let side = 0; side < 2; side++) {
    const k = (i) => f[i * 4 + side];
    const s = (i) => f[i * 4 + 2 + side];
    const outside = (v, other, i) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = Math.max(0, i - 1); j <= Math.min(n - 1, i + 1); j++) {
        lo = Math.min(lo, other(j));
        hi = Math.max(hi, other(j));
      }
      // --- SAASound places an edge to 1/2^oversample of a sample: allow two of those steps of the jump
      const tolerance = TOLERANCE + (hi - lo) / (1 << Math.max(0, oversample - 1));
      return v < lo - tolerance || v > hi + tolerance;
    };
    let wk = 0;
    let ws = 0;
    let run = 0;
    const endRun = (i) => {
      if (run === 0) return;
      if (run <= BLIP) result.blips[side]++;
      else if (result.divergences[side]++ === 0) result.first[side] = i - run;
      run = 0;
    };
    for (let i = 0; i < n; i++) {
      result.peak = Math.max(result.peak, k(i), s(i));
      if (outside(k(i), s, i) || outside(s(i), k, i)) run++;
      else endRun(i);
      wk += k(i);
      ws += s(i);
      if ((i + 1) % WINDOW === 0) {
        result.window[side] = Math.max(result.window[side], Math.abs(wk - ws) / WINDOW);
        wk = ws = 0;
      }
    }
    endRun(n);
  }
  return result;
}

(() => {
  const opts = parseArgs(process.argv.slice(2));
  build();
  const all = cases(opts.rate);
  const names = opts.cases.length ? opts.cases : Object.keys(all);
  const lines = [
    `# SAA 1099: Klive's port against SAASound ${fs.readFileSync(path.join(SAASOUND, "COMMIT"), "utf8").split(" ")[0].slice(0, 7)}`,
    "",
    `${opts.rate} Hz, ${1 << opts.oversample}x oversampling in SAASound; a mismatch is a sample outside the other's ` +
      `neighbouring range by more than ${TOLERANCE} plus two oversampling steps of the jump; a blip is a run of at most ` +
      `${BLIP} such samples (an edge moved by SAASound's stepping), a divergence a longer one; windows of ${WINDOW} samples.`,
    "",
    "| Case | Samples | Peak | Blips L / R | Divergences L / R | First divergence L / R | Largest window difference L / R |",
    "|---|---|---|---|---|---|---|"
  ];
  let failing = 0;
  for (const name of names) {
    const c = all[name];
    if (!c) {
      console.error(`No case ${name}`);
      process.exit(1);
    }
    const script = path.join(OUT, `${name}.txt`);
    const data = path.join(OUT, `${name}.f32`);
    fs.writeFileSync(script, scriptText(c));
    const r = spawnSync(path.join(OUT, "harness"), [script, data, String(opts.rate), String(opts.oversample)], {
      env: { ...process.env, ...(opts.avoidTies ? { SAA_AVOID_TIES: String(opts.avoidTies) } : {}) }
    });
    if (r.status !== 0) {
      console.error(`${name}: the runner failed (${r.status})`);
      process.exit(1);
    }
    const res = compare(data, opts.oversample);
    if (res.divergences[0] || res.divergences[1]) failing++;
    lines.push(
      `| ${name} | ${res.samples} | ${Math.round(res.peak)} | ${res.blips.join(" / ")} | ${res.divergences.join(" / ")} | ${res.first.join(" / ")} | ` +
        `${res.window.map((v) => v.toFixed(2)).join(" / ")} |`
    );
  }
  lines.push("", failing ? `**${failing} case(s) diverge.**` : "No divergences.");
  fs.writeFileSync(path.join(OUT, "report.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
  process.exit(failing ? 2 : 0);
})();
