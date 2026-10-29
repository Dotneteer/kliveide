#!/usr/bin/env node
// Figures of "From the Machine to Your Speakers" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/klive-audio.mdx).
//
// The sample counts and the spectra come from the machine: the captures that
// test/zxnext-hw/audio/next-audio-scene.test.ts writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The queue figure runs the rules of Klive's audio worklet (src/renderer/features/emulator/Sampling.worklet.js,
// its constants copied below) on a timeline; the diagrams are drawn from Klive's code. Then:
//   node docs/authoring/next-audio/klive-audio-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PSG, DAC, PI, MIX, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/klive-audio.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/klive-audio", `${name}.json`), "utf8"));
const GREY = "currentColor";
const KLIVE = "#e5484d";
const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18;

const figures = {};
const numbers = [];

const blk = (out, x, y, w, h, t, o = {}) => {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? 0.12 : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
};

const MASTER = 28_000_000;
const FRAME = 456 * 311 * 4; // --- 128K timing, 28 MHz clocks
const RATE = 48_000;

// ---------------------------------------------------------------------------------------------
// Figure: samples across a frame's end, and the counts per frame (captured)
{
  const d = capture("carry");
  const per = MASTER / RATE; // --- 583.33 clocks a sample
  numbers.push(`carry: ${d.exact.toFixed(3)} samples a frame; counts ${d.counts.slice(0, 12).join(",")}`);
  const out = [svgOpen(700, 350, "Two parts. Top, a time line across the end of one frame and the start of the next, in 28 MHz clocks. Sample moments are ticks every 583.3 clocks; the frame ends between two of them, and the next frame's first sample comes 583.3 clocks after the last one, not at the frame's start, so the fraction of a sample carries over. Bottom, the samples each of 40 frames carried, captured from the machine: 972 or 973, mostly 972, with a 973 about every second frame, averaging 972.45.")];
  // --- top: a stretch around the frame end
  const X0 = 0, W = 700;
  const t0 = FRAME - 3.6 * per, t1 = FRAME + 3.4 * per;
  const px = (t) => X0 + ((t - t0) / (t1 - t0)) * W;
  out.push(line(0, 70, 700, 70, { opacity: 0.5 }));
  const first = Math.ceil(t0 / per);
  for (let k = first; k * per <= t1; k++) {
    const t = k * per;
    const after = t >= FRAME;
    out.push(line(px(t), 50, px(t), 90, { stroke: KLIVE, width: 2.2 }));
    out.push(text(px(t), 110, after ? `+${fmt(t - FRAME, 0)}` : "", { anchor: "middle", size: FS, fill: KLIVE }));
  }
  out.push(line(px(FRAME), 24, px(FRAME), 130, { width: 2, dash: "6 4" }));
  out.push(text(px(FRAME) - 8, 30, "frame ends", { anchor: "end", size: FT, bold: true }));
  out.push(text(px(FRAME) + 8, 30, "next frame", { size: FT, bold: true }));
  out.push(text(0, 150, `a sample every 28,000,000 ÷ 48,000 = ${fmt(per, 1)} clocks; the numbers are clocks into the new frame`, { size: FS }));
  // --- bottom: the counts
  const by = 212, bh = 100;
  out.push(text(0, by - 12, "samples in each of 40 frames, captured", { size: FT, bold: true }));
  const bw = 700 / d.counts.length;
  const lo = Math.min(...d.counts);
  d.counts.forEach((c, i) => {
    const h = c > lo ? bh : bh * 0.55;
    out.push(rect(i * bw + 1.5, by + bh - h, bw - 3, h, { fill: c > lo ? KLIVE : GREY, fillOpacity: c > lo ? 0.75 : 0.25, stroke: "none" }));
  });
  out.push(text(0, by + bh + 26, `grey: ${lo}, red: ${lo + 1}; the average, ${fmt(d.exact, 2)}, is exact over every run of frames`, { size: FS }));
  out.push("</svg>");
  figures.carry = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: point sampling against averaging the window
{
  const out = [svgOpen(700, 290, "A beeper square wave whose edges fall anywhere between the sample moments. Top, the wave itself, with the sample windows marked by grid lines. Middle, point sampling: each sample takes the wave's level at its moment, so the steps are whole samples long and an edge jumps to the next sample. Bottom, averaging the window: each sample takes the share of its window the wave spent high, so a sample that an edge cuts lands between the two levels.")];
  const X = 140, W = 700 - X - 4;
  const N = 14; // --- samples shown
  const half = 187 * 8; // --- 9,358 Hz in 28 MHz clocks: 1,496
  const per = MASTER / RATE;
  const T = N * per;
  const wave = (t) => (Math.floor((t + 300) / half) % 2 === 0 ? 1 : 0);
  const row = (y, h, t, sub, c, vals, stairs) => {
    const b = box(X, y, W, h, 0, T, 0, 1);
    for (let k = 0; k <= N; k++) out.push(line(b.px(k * per), y - 4, b.px(k * per), y + h + 4, { opacity: 0.18 }));
    if (stairs) out.push(pathEl(sampleStairs(b, vals, 0, per), { stroke: c, width: 2.2 }));
    else {
      const pts = [];
      for (let t = 0; t <= T; t += 4) pts.push([t, wave(t)]);
      out.push(pathEl(poly(b, pts), { stroke: c, width: 1.6 }));
    }
    out.push(lines(0, y + h / 2 - 2, t, { size: FT, bold: true, fill: c, lh: LH }));
    if (sub) out.push(lines(0, y + h / 2 + 16, sub, { size: FS }));
  };
  row(14, 60, ["the wave"], ["9,358 Hz"], BEEPER, null, false);
  const point = [...Array(N)].map((_, k) => wave(k * per));
  const avg = [...Array(N)].map((_, k) => {
    let hi = 0;
    for (let t = k * per; t < (k + 1) * per; t += 1) hi += wave(t);
    return hi / per;
  });
  row(110, 60, ["point"], ["HDMI"], KLIVE, point, true);
  row(206, 60, ["averaged"], ["jack, speaker"], KLIVE, avg, true);
  out.push(text(X, 288, "grid: one sample window, 1/48,000 s", { size: FS }));
  out.push("</svg>");
  figures.average = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the spectra (captured)
{
  const jack = capture("jack"), hdmi = capture("hdmi");
  const spec = (v) => {
    const n = v.length;
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const out = [];
    for (let hz = 100; hz <= 24000; hz += 25) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const w = (2 * Math.PI * hz * i) / RATE;
        re += (v[i] - mean) * Math.cos(w);
        im += (v[i] - mean) * Math.sin(w);
      }
      out.push([hz, Math.hypot(re, im) / n]);
    }
    return out;
  };
  const toDb = (s) => {
    const peak = Math.max(...s.map((p) => p[1]));
    return s.map(([hz, m]) => [hz / 1000, Math.max(-60, 20 * Math.log10(m / peak))]);
  };
  const sj = toDb(spec(jack.left)), sh = toDb(spec(hdmi.left));
  const at = (s, khz) => s.reduce((b, p) => (Math.abs(p[0] - khz) < Math.abs(b[0] - khz) ? p : b))[1];
  numbers.push(`spectrum at 1.2 kHz: jack ${at(sj, 1.2).toFixed(1)} dB, hdmi ${at(sh, 1.2).toFixed(1)} dB; at 19.9 kHz: jack ${at(sj, 19.925).toFixed(1)}, hdmi ${at(sh, 19.925).toFixed(1)}`);
  const X = 140, W = 700 - X - 4, H = 130;
  const out = [svgOpen(700, 360, "Two spectra of the same captured beeper tone, from 0 to 24 kHz, the loudness of each frequency in decibels below the tone, down to 60. Point sampling, as HDMI does: the tone at 9.36 kHz, and an alias at 1.21 kHz about 14 decibels below it, plus another at 19.9 kHz and smaller ones. Averaging the window, as the jack does: the tone, nothing at 1.21 kHz, and the alias at 19.9 kHz still there, a few decibels weaker.")];
  const panel = (y, s, t, sub) => {
    const b = box(X, y, W, H, 0, 24, -60, 0);
    for (const db of [0, -20, -40, -60]) {
      out.push(line(b.x, b.py(db), b.x + b.w, b.py(db), { opacity: 0.18 }));
      out.push(text(b.x - 6, b.py(db) + 5, `${db}`, { anchor: "end", size: FS }));
    }
    out.push(pathEl(poly(b, s), { stroke: KLIVE, width: 1.5 }));
    out.push(lines(0, y + 40, t, { size: FT, bold: true, fill: KLIVE, lh: LH }));
    out.push(lines(0, y + 60 + (t.length - 1) * LH, sub, { size: FS }));
    return b;
  };
  const b1 = panel(14, sh, ["point"], ["HDMI"]);
  const b2 = panel(174, sj, ["averaged"], ["jack, speaker"]);
  for (const [b, s] of [[b1, sh], [b2, sj]]) {
    for (const [khz, t] of [[1.209, "alias 1.2 kHz"], [9.358, "the tone"], [19.925, "alias 19.9 kHz"]]) {
      const y = b.py(at(s, khz));
      out.push(text(b.px(khz) + 6, Math.max(b.y + 14, y - 6), t, { size: FS, fill: GREY }));
    }
  }
  const y = 334;
  out.push(line(X, y - 12, X + W, y - 12, { opacity: 0.5 }));
  for (const k of [0, 4, 8, 12, 16, 20, 24]) out.push(text(b2.px(k), y + 10, `${k} kHz`, { anchor: k === 0 ? "start" : k === 24 ? "end" : "middle", size: FS }));
  out.push(text(0, y + 10, "dB below the tone", { size: FS }));
  out.push("</svg>");
  figures.spectrum = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the pipeline
{
  const out = [svgOpen(700, 250, "The path of Klive's sound in five boxes from left to right. The emulated Next, which runs a frame at a time and takes one sample every 583 master clocks. A frame's samples, 972 or 973 pairs, are handed over when the frame ends. The renderer copies them into one block of floating-point numbers and passes it to the audio thread without copying. The worklet keeps a ring of eight frames and holds three back before it plays. The sound card pulls 512 samples at a time, every 10.7 milliseconds, at its own rate.")];
  out.push(arrows("ka-pl", [KLIVE]));
  const a = (x1, x2, y) => out.push(pathEl(`M${x1},${y} L${x2},${y}`, { stroke: KLIVE, width: 1.8, marker: "ka-pl-0" }));
  const W = 112, G = (700 - 5 * W) / 4;
  const boxes = [
    [["emulated", "Next"], ["a frame at a time;", "a sample every", "583 clocks"]],
    [["a frame's", "samples"], ["972 or 973 pairs,", "when the", "frame ends"]],
    [["renderer"], ["one block of", "numbers, handed", "over, not copied"]],
    [["worklet"], ["a ring of 8 frames;", "3 held back:", "about 60 ms"]],
    [["sound card"], ["pulls 512", "samples every", "10.7 ms"]]
  ];
  boxes.forEach(([t, sub], i) => {
    const x = i * (W + G);
    blk(out, x, 20, W, 70, t, { c: KLIVE, bold: true });
    out.push(lines(x + W / 2, 116, sub, { anchor: "middle", size: FS, lh: FS + 4 }));
    if (i < 4) a(x + W, x + W + G - 4, 55);
  });
  out.push(line(0, 196, 700, 196, { opacity: 0.4 }));
  out.push(text(0, 222, "the emulator's thread: the core (WebAssembly) and the renderer", { size: FS }));
  out.push(text(3 * (W + G), 222, "the audio thread and the card", { size: FS }));
  out.push("</svg>");
  figures.pipeline = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the worklet's queue on a timeline (its rules, run)
{
  // --- Sampling.worklet.js
  const FRAMES_DELAYED = 3, MAX_LAG_FRAMES = 5, LONE_WAIT_FRAMES = 2;
  const spf = (FRAME * RATE) / MASTER; // --- 972.45 samples a frame
  const spfStereo = (Math.floor(spf) + 1) * 2;
  const primeValues = FRAMES_DELAYED * (spfStereo - 8);
  const CALLBACK = 512;
  const frameMs = (FRAME / MASTER) * 1000; // --- 20.26 ms
  // --- arrivals: in step with real time, then a stretch where the machine runs slower (a frame every
  //     30 ms, as a busy debug run can), then in step again
  const arrivals = [];
  let t = frameMs;
  let carry = 0;
  while (t < 1200) {
    const slow = t > 400 && t < 760;
    carry += spf;
    const n = Math.floor(carry);
    carry -= n;
    arrivals.push([t, n]);
    t += slow ? 30 : frameMs;
  }
  let available = 0, priming = true, pairsSinceStore = 0;
  const trace = []; // [ms, queued ms, playing]
  let ai = 0;
  const msPerSample = 1000 / RATE;
  for (let s = 0; s * msPerSample < 1200; s += CALLBACK) {
    const now = s * msPerSample;
    while (ai < arrivals.length && arrivals[ai][0] <= now) {
      available += 2 * arrivals[ai][1];
      if (available > MAX_LAG_FRAMES * spfStereo) available = MAX_LAG_FRAMES * spfStereo;
      pairsSinceStore = 0;
      if (priming && available >= primeValues) priming = false;
      ai++;
    }
    let played = 0;
    for (let i = 0; i < CALLBACK; i++) {
      pairsSinceStore++;
      if (priming && available >= 2 && pairsSinceStore * 2 >= LONE_WAIT_FRAMES * spfStereo) priming = false;
      if (priming || available < 2) { priming = true; continue; }
      available -= 2;
      played++;
    }
    trace.push([now, (available / 2) * msPerSample, played > CALLBACK / 2]);
  }
  const dry = trace.filter((p) => !p[2]).length;
  const steady = trace.filter(([ms]) => ms > 100 && ms < 400).map((p) => p[1]);
  const first = trace.find((p) => p[2]);
  numbers.push(`queue: ${trace.length} callbacks, ${dry} not playing; first plays at ${first[0].toFixed(1)} ms; steady ${Math.min(...steady).toFixed(1)}-${Math.max(...steady).toFixed(1)} ms`);
  const X = 140, W = 700 - X - 4;
  const out = [svgOpen(700, 330, "A plot over 1.2 seconds of how much sound, in milliseconds, waits in Klive's audio queue. At the start the queue fills for three frames before anything plays, about 64 milliseconds. Then it rises by a frame, about 20 milliseconds, at each arrival and drains steadily between them, between about 34 and 53 milliseconds. From 0.4 to 0.76 seconds the machine delivers a frame only every 30 milliseconds: the queue drains, runs dry, and the sound stops in short gaps until a frame arrives. Back in step, it refills and plays on. A strip under the plot marks when sound plays.")];
  const b = box(X, 14, W, 200, 0, 1200, 0, 100);
  for (const ms of [0, 20, 40, 60, 80, 100]) {
    out.push(line(b.x, b.py(ms), b.x + b.w, b.py(ms), { opacity: 0.15 }));
    out.push(text(b.x - 6, b.py(ms) + 5, `${ms} ms`, { anchor: "end", size: FS }));
  }
  out.push(rect(b.px(400), b.y, b.px(760) - b.px(400), b.h, { fill: GREY, fillOpacity: 0.07, stroke: "none" }));
  out.push(text(b.px(580), b.y + 18, "a frame every 30 ms", { anchor: "middle", size: FS }));
  out.push(pathEl(poly(b, trace.map(([ms, q]) => [ms, q])), { stroke: KLIVE, width: 1.8 }));
  out.push(lines(0, 90, ["queued", "sound"], { size: FT, bold: true, fill: KLIVE, lh: LH }));
  // --- playing strip
  const sy = 236;
  out.push(lines(0, sy + 14, ["playing"], { size: FT, bold: true }));
  trace.forEach(([ms, , playing], i) => {
    if (!playing) return;
    const x2 = i + 1 < trace.length ? trace[i + 1][0] : 1200;
    out.push(rect(b.px(ms), sy, b.px(x2) - b.px(ms) + 0.3, 18, { fill: KLIVE, fillOpacity: 0.7, stroke: "none" }));
  });
  const y = 290;
  out.push(line(X, y, X + W, y, { opacity: 0.5 }));
  for (const ms of [0, 200, 400, 600, 800, 1000, 1200]) {
    out.push(line(b.px(ms), y - 5, b.px(ms), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(ms), y + 22, `${(ms / 1000).toFixed(1)} s`, { anchor: ms === 0 ? "start" : ms === 1200 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.queue = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the whole sound system, the series' map
{
  const out = [svgOpen(700, 380, "The whole sound system of the ZX Spectrum Next as the sound chapters told it. On the left, the sources: the beeper with EAR, MIC and the tape, three AY chips behind TurboSound, four 8-bit DACs and the Raspberry Pi's audio. They all go into one mixer with a left and a right side. The mixer's sums go to the audio jack, the internal speaker, HDMI and back to the Pi. Below, Klive: it samples one of those outputs 48,000 times a second and hands the samples to your computer's sound card.")];
  out.push(arrows("ka-map", [BEEPER, PSG, DAC, PI, MIX, KLIVE]));
  const src = [
    [["beeper, EAR, MIC", "and the tape"], BEEPER, 0],
    [["three AY chips", "behind TurboSound"], PSG, 1],
    [["four 8-bit", "DACs"], DAC, 2],
    [["the Raspberry", "Pi's audio"], PI, 3]
  ];
  src.forEach(([t, c, i], k) => {
    const y = 10 + k * 66;
    blk(out, 0, y, 200, 54, t, { c, size: FS, bold: true });
    out.push(pathEl(`M200,${y + 27} L276,${y + 27}`, { stroke: c, width: 1.8, marker: `ka-map-${i}` }));
  });
  blk(out, 280, 10, 140, 252, ["one mixer", "", "left side", "right side"], { c: MIX, bold: true });
  const outs = [["audio jack"], ["internal speaker"], ["HDMI"], ["back to the Pi"]];
  outs.forEach((t, k) => {
    const y = 10 + k * 66;
    blk(out, 500, y, 200, 54, t, { c: MIX, size: FS });
    out.push(pathEl(`M420,${y + 27} L496,${y + 27}`, { stroke: MIX, width: 1.8, marker: "ka-map-4" }));
  });
  blk(out, 280, 306, 420, 64, ["Klive: one of the outputs, 48,000 samples a second,", "to your computer's sound card"], { c: KLIVE, size: FS, bold: true });
  out.push(pathEl("M350,262 L350,302", { stroke: KLIVE, width: 1.8, marker: "ka-map-5" }));
  out.push("</svg>");
  figures.map = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
