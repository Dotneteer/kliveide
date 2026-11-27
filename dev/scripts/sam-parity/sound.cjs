/**
 * The SAM parity probe "snd-mix" heard (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, Phase 6, sound step 2): measures
 * one recording of it, or compares two. Developer tool, never CI.
 *
 *   node dev/scripts/sam-parity/sound.cjs <klive.wav> [<simcoupe.wav>]
 *
 * Each part of the probe (test/sam-hw/parity/probes/snd-mix.kz80.asm) is found by its onset, so the
 * recordings need not start together, and the amplitude steps are found as the last stretch of sound, so an
 * emulator that drops bits of its output (SimCoupé on macOS splices its audio every 60-100 ms) stays measurable. Measured (left side): the 25 Hz beeper square's level and droop, the
 * 1 kHz beeper's and the 1 kHz SAA tone's RMS level and pitch, the beeper step's decay over 2-25 ms (the DC filter's
 * time constant; SimCoupé's output drops sharply about 32 ms after a step), the SAA amplitude steps' levels. Emulators scale their output differently, so the comparison is
 * of ratios: beeper to SAA, each amplitude step to amplitude 15, and the time constants.
 */
const fs = require("fs");

const FRAME = 1 / 50.08;

/** A 16-bit PCM WAV's left channel as numbers in -1..1, and its rate */
function readWav(file) {
  const b = fs.readFileSync(file);
  let at = 12;
  let fmt;
  let data;
  while (at + 8 <= b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(at + 10), rate: b.readUInt32LE(at + 12), bits: b.readUInt16LE(at + 22), format: b.readUInt16LE(at + 8) };
    if (id === "data") data = { at: at + 8, size: Math.min(size, b.length - at - 8) };
    at += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: not a WAV`);
  const frameBytes = (fmt.bits / 8) * fmt.channels;
  const n = Math.floor(data.size / frameBytes);
  const left = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = data.at + i * frameBytes;
    left[i] = fmt.format === 3 ? b.readFloatLE(p) : fmt.bits === 16 ? b.readInt16LE(p) / 32768 : b.readInt32LE(p) / 2147483648;
  }
  return { rate: fmt.rate, left };
}

function measure(file) {
  const { rate, left: x } = readWav(file);
  const at = (t) => Math.round(t * rate);
  // --- Activity: 5 ms windows whose peak-to-peak exceeds 2% of the recording's largest
  const win = at(0.005);
  const p2p = [];
  for (let i = 0; i + win <= x.length; i += win) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = i; j < i + win; j++) {
      lo = Math.min(lo, x[j]);
      hi = Math.max(hi, x[j]);
    }
    p2p.push(hi - lo);
  }
  const maxP2p = Math.max(...p2p);
  const active = (w) => p2p[w] > maxP2p * 0.02;
  const onset = (fromSec) => {
    for (let w = Math.floor(at(fromSec) / win); w < p2p.length; w++) if (active(w)) return (w * win) / rate;
    throw new Error(`${file}: no sound after ${fromSec.toFixed(3)} s`);
  };
  /** The end of activity after `fromSec`: the start of the first 60 ms without any */
  const quietAfter = (fromSec) => {
    const need = Math.ceil(0.06 / 0.005);
    let run = 0;
    for (let w = Math.floor(at(fromSec) / win); w < p2p.length; w++) {
      run = active(w) ? 0 : run + 1;
      if (run >= need) return ((w - need + 1) * win) / rate;
    }
    return x.length / rate;
  };
  /** The first onset after `fromSec` whose activity lasts at least `seconds` (key clicks are shorter) */
  const longOnset = (fromSec, seconds) => {
    for (let t = fromSec; ; ) {
      const o = onset(t);
      const q = quietAfter(o);
      if (q - o >= seconds) return o;
      t = q;
    }
  };
  const slice = (t0, t1) => x.subarray(at(t0), at(t1));
  const rms = (s) => {
    const m = s.reduce((a, b) => a + b, 0) / s.length;
    return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / s.length);
  };
  const pitch = (s) => {
    const m = s.reduce((a, b) => a + b, 0) / s.length;
    let up = 0;
    for (let i = 1; i < s.length; i++) if (s[i - 1] < m && s[i] >= m) up++;
    return (up * rate) / s.length;
  };

  // --- Part 1: the 25 Hz square from its first edge; the level just after each edge and just before the next
  const p1 = longOnset(0, 0.5);
  const half = FRAME;
  const starts = [];
  const ends = [];
  for (let k = 10; k < 40; k++) {
    const e = p1 + k * half;
    const after = slice(e + 0.0005, e + 0.0015);
    const before = slice(e + half - 0.0015, e + half - 0.0005);
    starts.push(Math.abs(after.reduce((a, b) => a + b, 0) / after.length));
    ends.push(Math.abs(before.reduce((a, b) => a + b, 0) / before.length));
  }
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const droop = avg(ends) / avg(starts);
  const p1End = quietAfter(p1 + 0.5);

  // --- Part 3: the 1 kHz beeper; part 5: the 1 kHz SAA tone
  const p3 = onset(p1End + 0.1);
  const p3End = quietAfter(p3 + 0.05);
  const beep = slice(p3 + 0.1 * (p3End - p3), p3End - 0.1 * (p3End - p3));
  const p5 = onset(p3End + 0.1);
  const saa = slice(p5 + 0.1, p5 + 50 * FRAME - 0.1);

  // --- Part 7: the step up 65 frames after part 5's start; its decay over 3-40 ms
  // --- The jump to the sample: the first sample above half the largest within 20 ms of the onset
  const p7w = onset(quietAfter(p5 + 50 * FRAME - 0.1));
  let jump = at(p7w);
  let peak = 0;
  for (let i = at(p7w - 0.01); i < at(p7w + 0.02); i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let i = at(p7w - 0.01); i < at(p7w + 0.02); i++) if (Math.abs(x[i]) > peak / 2) {
    jump = i;
    break;
  }
  const p7 = jump / rate;
  const decay = [];
  for (let ms = 2; ms <= 25; ms++) decay.push([ms / 1000, Math.abs(x[at(p7 + ms / 1000)])]);
  const usable = decay.filter(([, v]) => v > 1e-4);
  let tau = Infinity;
  if (usable.length > 5) {
    const n = usable.length;
    const sx = usable.reduce((a, [t]) => a + t, 0);
    const sy = usable.reduce((a, [, v]) => a + Math.log(v), 0);
    const sxx = usable.reduce((a, [t]) => a + t * t, 0);
    const sxy = usable.reduce((a, [t, v]) => a + t * Math.log(v), 0);
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    tau = slope < 0 ? -1 / slope : Infinity;
  }
  const stepHeight = Math.abs(x[at(p7 + 0.0015)]);

  // --- Part 8: the amplitude steps, the recording's last stretch of sound, in quarters (an emulator that drops
  // --- bits of its output stays in step this way; the middle 60% of each quarter is measured)
  let lastActive = p2p.length - 1;
  while (lastActive > 0 && !active(lastActive)) lastActive--;
  let first = lastActive;
  for (let quiet = 0; first > 0; first--) {
    quiet = active(first - 1) ? 0 : quiet + 1;
    if (quiet >= Math.ceil(0.06 / 0.005)) break;
  }
  const p8 = (first * win) / rate;
  const quarter = ((lastActive + 1 - first) * win) / rate / 4;
  const amps = [0, 1, 2, 3].map((i) => rms(slice(p8 + (i + 0.2) * quarter, p8 + (i + 0.8) * quarter)));

  return {
    file,
    rate,
    beeper25: { peakToPeak: 2 * avg(starts), droop, tauFromDroop: -half / Math.log(droop) },
    beeper1k: { rms: rms(beep), hz: pitch(beep), seconds: p3End - p3 },
    saa1k: { rms: rms(saa), hz: pitch(saa) },
    beeperToSaa: rms(beep) / rms(saa),
    step: { height: stepHeight, tau },
    amplitudes: amps.map((a) => a / amps[0]),
    amplitudeLevels: amps
  };
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("usage: sound.cjs <klive.wav> [<simcoupe.wav>]");
    process.exit(1);
  }
  const results = files.map(measure);
  const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : String(v));
  const rows = [
    ["DC filter tau from the step (ms)", (r) => f(r.step.tau * 1000, 1)],
    ["beeper 1 kHz pitch (Hz)", (r) => f(r.beeper1k.hz, 1)],
    ["SAA tone pitch (Hz)", (r) => f(r.saa1k.hz, 1)],
    ["beeper RMS / SAA RMS (amplitude 15, one channel)", (r) => f(r.beeperToSaa)],
    ["SAA amplitude 8 / 15", (r) => f(r.amplitudes[1])],
    ["SAA amplitude 4 / 15", (r) => f(r.amplitudes[2])],
    ["SAA amplitude 1 / 15", (r) => f(r.amplitudes[3])],
    ["beeper 1 kHz RMS (absolute)", (r) => f(r.beeper1k.rms, 4)],
    ["SAA RMS (absolute)", (r) => f(r.saa1k.rms, 4)]
  ];
  console.log(`| | ${results.map((r, i) => (i ? "SimCoupé" : "Klive")).join(" | ")} |`);
  console.log(`|---|${results.map(() => "---").join("|")}|`);
  for (const [name, get] of rows) console.log(`| ${name} | ${results.map(get).join(" | ")} |`);
}

module.exports = { measure };
