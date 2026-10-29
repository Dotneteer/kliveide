#!/usr/bin/env node
// Figures of "The Beeper: EAR, MIC and the Tape" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/beeper.mdx).
//
// The waveforms and the spectrum come from the machine: the captures that
// test/zxnext-hw/audio/next-audio-scene.test.ts writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The two-voice timeline is the program's own arithmetic, and the input stage is simulated tick by tick
// from the hardware's rules (a debounce on the 1.75 MHz enable that needs two enables without a change,
// a relaxation that turns a 1 held for 64 enables of 512 master clocks into 0). Then:
//   node docs/authoring/next-audio/beeper-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units, about 10 pt when the figure spans a 16 cm text column.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PI, MIX, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/beeper.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/beeper", `${name}.json`), "utf8"));
const units = (d) => d.left.map((w) => w / d.gain);

const figures = {};
const numbers = [];
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const GREY = "currentColor";

// --- Print sizes: titles, labels, small notes (viewBox units of a 700-wide figure)
const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18; // line height for FT

/** A box with centred lines of text */
const blk = (out, x, y, w, h, t, o = {}) => {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? 0.12 : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
};

/** A time axis with ticks and labels under a plot box */
const axis = (out, b, y, T, step, unit, scale = 1) => {
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T + 1e-9; t += step) {
    out.push(line(b.px(t * scale), y - 5, b.px(t * scale), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(t * scale), y + 22, `${t} ${unit}`, { anchor: t === 0 ? "start" : Math.abs(t - T) < 1e-9 ? "end" : "middle", size: FS }));
  }
};

/** The first rising crossing of the midpoint after `from`, with the crossing interpolated inside the sample */
function risingEdge(values, from = 0) {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  for (let i = Math.max(1, from); i < values.length; i++) {
    if (values[i - 1] < mid && values[i] >= mid) return i - 1 + (mid - values[i - 1]) / (values[i] - values[i - 1]);
  }
  return from;
}

// ---------------------------------------------------------------------------------------------
// Figure: port $FE written and read
{
  const X0 = 100, CW = (700 - X0) / 8;
  const out = [svgOpen(700, 206, "Port $FE as two strips of eight bits, bit 7 on the left. Written: bits 7 to 5 are ignored, bit 4 is EAR, the beeper, bit 3 is MIC, the tape output, and bits 2 to 0 are the border colour. Read: bit 7 reads 1, bit 6 is the tape input, bit 5 reads 1, and bits 4 to 0 are the keyboard, one bit per key of the selected rows, 0 for a key held. Any even port address is port $FE, and bit 6 also reads the EAR and MIC bits back.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 18, String(b), { anchor: "middle", size: FS }));
  const strip = (y, title, cells) => {
    out.push(text(0, y + 31, title, { size: FT, bold: true }));
    for (const c of cells) {
      const x = X0 + (7 - c.from) * CW;
      const w = (c.from - c.to + 1) * CW;
      const on = c.c !== GREY;
      out.push(rect(x + 2, y, w - 4, 52, { rx: 5, stroke: c.c, width: on ? 2 : 1.4, opacity: on ? 1 : 0.6, fill: on ? c.c : "none", fillOpacity: on ? 0.16 : undefined }));
      out.push(lines(x + w / 2, y + (c.t.length > 1 ? 22 : 31), c.t, { anchor: "middle", size: FT, bold: on, fill: on ? c.c : GREY, lh: LH }));
    }
  };
  strip(30, "write", [
    { from: 7, to: 5, t: ["ignored"], c: GREY },
    { from: 4, to: 4, t: ["EAR", "beeper"], c: BEEPER },
    { from: 3, to: 3, t: ["MIC", "tape out"], c: BEEPER },
    { from: 2, to: 0, t: ["border colour"], c: GREY }
  ]);
  strip(102, "read", [
    { from: 7, to: 7, t: ["1"], c: GREY },
    { from: 6, to: 6, t: ["tape", "input"], c: BEEPER },
    { from: 5, to: 5, t: ["1"], c: GREY },
    { from: 4, to: 0, t: ["keyboard: one bit per key", "of the selected rows, 0 = held"], c: GREY }
  ]);
  out.push(text(X0, 196, "any even port address is port $FE; bit 6 also reads the EAR and MIC bits back", { size: FT }));
  out.push("</svg>");
  figures.bits = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: EAR and MIC on the mixer's scale
{
  const out = [svgOpen(700, 318, "Two scales. Top, the mixer's whole range for one side, 0 to 8,191, as a long bar; EAR and MIC together take its first 640 units, a short blue stretch at the left end. Bottom, that stretch enlarged to 0 to 700, with the four levels the two bits can make drawn as bars to scale: neither bit 0, MIC alone 128, EAR alone 512, both 640.")];
  const X0 = 0, W = 700;
  const big = (v) => X0 + (v / 8191) * (W - 1);
  out.push(text(X0, 20, "the mixer's range, one side", { size: FT, bold: true }));
  out.push(rect(X0 + 0.5, 32, W - 1, 24, { opacity: 0.5 }));
  out.push(rect(X0 + 0.5, 32, big(640) - X0, 24, { fill: BEEPER, fillOpacity: 0.8, stroke: BEEPER }));
  for (const v of [0, 640, 2048, 4096, 6144, 8191]) {
    out.push(line(big(v), 56, big(v), 62, { opacity: 0.5 }));
    out.push(text(big(v), 78, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS, bold: v === 640, fill: v === 640 ? BEEPER : GREY }));
  }
  const ZX = 120, ZW = 580;
  const zoom = (v) => ZX + (v / 700) * ZW;
  // --- zoom lines from the short stretch to the enlarged scale
  out.push(line(X0, 84, ZX, 118, { opacity: 0.4, dash: "4 3" }));
  out.push(line(big(640), 84, zoom(640), 118, { opacity: 0.4, dash: "4 3" }));
  out.push(text(ZX, 112, "enlarged: 0 to 700", { size: FT, bold: true }));
  const rows = [["neither", 0], ["MIC", 128], ["EAR", 512], ["EAR + MIC", 640]];
  rows.forEach(([t, v], i) => {
    const y = 128 + i * 38;
    out.push(text(ZX - 10, y + 18, t, { anchor: "end", size: FT, bold: true, fill: BEEPER }));
    if (v) out.push(rect(ZX, y, zoom(v) - ZX, 26, { fill: BEEPER, fillOpacity: 0.75, stroke: BEEPER }));
    out.push(text(zoom(v) + 6, y + 18, fmt(v), { size: FT, bold: true }));
  });
  const ya = 128 + rows.length * 38 + 4;
  out.push(line(ZX, ya, ZX + ZW, ya, { opacity: 0.5 }));
  for (const v of [0, 128, 256, 384, 512, 640]) {
    out.push(line(zoom(v), ya - 4, zoom(v), ya + 4, { opacity: 0.5 }));
    out.push(text(zoom(v), ya + 22, String(v), { anchor: "middle", size: FS }));
  }
  out.push("</svg>");
  figures.levels = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the loop's note, captured
{
  const d = capture("note-35");
  const v = units(d);
  const dt = 1000 / d.rate; // ms per sample
  const T = 4; // ms
  const e0 = risingEdge(v, 40);
  const start = Math.floor(e0) - 6;
  const w = v.slice(start, start + Math.round(T / dt));
  const mean = (Math.max(...w) + Math.min(...w)) / 2;
  const half = (d.halfTacts / 3.5e6) * 1000; // ms
  const tEdge = (e0 - start) * dt;
  const out = [svgOpen(700, 330, `Four milliseconds of the loop's note, captured from the machine: a square wave of 994 Hz, 512 units from bottom to top, centred on zero. Each high and each low half is one pass of the loop, 1,760 T-states or 503 microseconds; a whole period, two passes, is 1,006 microseconds.`)];
  out.push(arrows("bp-note", [GREY, BEEPER]));
  const b = box(48, 54, 652, 170, 0, T, -360, 360);
  for (const lv of [-256, 0, 256]) {
    out.push(line(b.x, b.py(lv), b.x + b.w, b.py(lv), { opacity: lv ? 0.2 : 0.4 }));
    out.push(text(b.x - 6, b.py(lv) + 5, lv > 0 ? `+${lv}` : lv < 0 ? `−${-lv}` : "0", { anchor: "end", size: FS }));
  }
  out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: BEEPER, width: 2 }));
  // --- one pass and one period, measured from the first rising edge
  const y1 = 36, y2 = 246;
  const t1 = tEdge, t2 = tEdge + half, t3 = tEdge + 2 * half;
  out.push(line(b.px(t1), y1 + 4, b.px(t1), b.py(300), { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t2), y1 + 4, b.px(t2), y2 - 4, { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t3), b.py(-300), b.px(t3), y2 - 4, { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t1) + 2, y1, b.px(t2) - 2, y1, { stroke: BEEPER, width: 1.5, marker: "bp-note-1" }));
  out.push(line(b.px(t2) - 2, y1, b.px(t1) + 2, y1, { stroke: BEEPER, width: 1.5, marker: "bp-note-1" }));
  out.push(text(b.px(t1), y1 - 10, "one pass: 1,760 T-states, 503 µs", { size: FT, fill: BEEPER, bold: true }));
  out.push(line(b.px(t1) + 2, y2, b.px(t3) - 2, y2, { width: 1.5, marker: "bp-note-0" }));
  out.push(line(b.px(t3) - 2, y2, b.px(t1) + 2, y2, { width: 1.5, marker: "bp-note-0" }));
  out.push(text(b.px(t1), y2 + 20, "one period, two passes: 1,006 µs, so 994 Hz", { size: FT }));
  axis(out, b, 290, T, 1, "ms");
  out.push("</svg>");
  figures.note = out;
  numbers.push(`note fig: ${d.hz.toFixed(2)} Hz measured; half period ${(half * 1000).toFixed(1)} µs; swing ${(Math.max(...w) - Math.min(...w)).toFixed(0)} units; first edge at x ${b.px(t1)}`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the same loop at 3.5 MHz, at 7 MHz, and in contended memory
{
  const T = 18; // ms: most of a frame, so that the contended row shows border, picture and border
  const rows = [
    { name: "note-35", t: ["3.5 MHz"], sub: () => "994 Hz" },
    { name: "note-7", t: ["7 MHz"], sub: (d) => `${fmt(d.hz7)} Hz` },
    { name: "note-contended", t: ["3.5 MHz,", "contended"], sub: (d) => `994 / ${fmt(d.hzPicture)} Hz` }
  ];
  const out = [svgOpen(700, 394, "The same beeper loop captured three times, 18 milliseconds each, on one time scale. At 3.5 MHz it is an even square wave of 994 Hz. At 7 MHz the periods are half as long: 1,989 Hz. At 3.5 MHz with the loop in contended memory and contention on, the wave changes during the frame: in the border its periods are those of 994 Hz; in the shaded stretch, while the picture's lines are drawn, every pass is stretched from 1,760 to about 2,007 T-states and the note drops to about 872 Hz; then it comes back to 994 Hz in the border.")];
  const X = 120, W = 700 - X;
  rows.forEach((row, i) => {
    const d = capture(row.name);
    const v = units(d);
    const dt = 1000 / d.rate;
    const start = Math.floor(risingEdge(v, 0)) - 2;
    const w = v.slice(start, start + Math.round(T / dt));
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const y = 12 + i * 106;
    const b = box(X, y, W, 76, 0, T, -330, 330);
    if (row.name === "note-contended") {
      // --- shade the passes stretched by contention (half periods over 1,950 T-states)
      const mid = 0;
      const edges = [];
      const c = w.map((x) => x - mean);
      for (let k = 1; k < c.length; k++) if (c[k - 1] < mid !== c[k] < mid) edges.push((k - 1 + (mid - c[k - 1]) / (c[k] - c[k - 1])) * dt);
      let from = null, to = null;
      for (let k = 1; k < edges.length; k++) {
        const tacts = ((edges[k] - edges[k - 1]) / 1000) * 3.5e6;
        if (tacts > 1950) { if (from === null) from = edges[k - 1]; to = edges[k]; }
      }
      out.push(rect(b.px(from), y - 6, b.px(to) - b.px(from), 88, { fill: BEEPER, fillOpacity: 0.12, stroke: BEEPER, width: 1, opacity: 0.4 }));
      out.push(lines((b.px(from) + b.px(to)) / 2, y + 104, ["the picture's lines: a pass takes", `about ${fmt(d.pictureHalfTacts)} T-states, ${fmt(d.hzPicture)} Hz`], { anchor: "middle", size: FS, fill: BEEPER, bold: true, lh: FS + 4 }));
      out.push(lines((b.x + b.px(from)) / 2, y + 104, ["border:", "994 Hz"], { anchor: "middle", size: FS, lh: FS + 4 }));
      out.push(lines((b.px(to) + b.x + b.w) / 2, y + 104, ["border:", "994 Hz"], { anchor: "middle", size: FS, lh: FS + 4 }));
      numbers.push(`speeds fig: contended stretch ${from.toFixed(1)}-${to.toFixed(1)} ms, x ${b.px(from)}-${b.px(to)}`);
    }
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: BEEPER, width: 1.4 }));
    out.push(lines(0, y + 26, row.t, { size: FT, bold: true, fill: BEEPER, lh: LH }));
    out.push(text(0, y + 26 + row.t.length * LH, row.sub(d), { size: FS }));
  });
  axis(out, box(X, 0, W, 0, 0, T, 0, 1), 360, T, 3, "ms");
  out.push("</svg>");
  figures.speeds = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: two voices sharing the bit, from the program's own arithmetic
{
  const d = capture("two-voices");
  const PASS = d.passTacts, SLOT = d.slotTacts, [s1, s2] = d.steps;
  const CPU = 3.5e6;
  const T = 8; // ms
  const passes = Math.ceil((T / 1000) * CPU / PASS);
  let p1 = 0, p2 = 0;
  const pulses = [[], []]; // start times in ms
  for (let k = 0; k < passes; k++) {
    const t = (k * PASS) / CPU * 1000;
    p1 += s1; if (p1 > 255) { p1 -= 256; pulses[0].push(t); }
    p2 += s2; if (p2 > 255) { p2 -= 256; pulses[1].push(t + (SLOT / CPU) * 1000); }
  }
  const slotMs = (SLOT / CPU) * 1000;
  const out = [svgOpen(700, 418, "Eight milliseconds of the two-voice program, worked out from its arithmetic. Top row, voice 1: a short pulse every 2.05 milliseconds, 488 Hz. Middle row, voice 2: a short pulse about every 1.64 milliseconds, 610 Hz. Bottom row, the bit itself: both trains of pulses together. Under them, one pass of the loop enlarged: 112 T-states, of which the first 34 are voice 1's slot, the next 34 voice 2's, and the last 44 always off. One pass takes 32 microseconds, and the loop runs 31,250 passes a second.")];
  const X = 120, W = 700 - X;
  const b = box(X, 0, W, 0, 0, T, 0, 1);
  const row = (y, title, sub, list, colour) => {
    out.push(text(0, y + 16, title, { size: FT, bold: true, fill: colour }));
    out.push(text(0, y + 35, sub, { size: FS }));
    out.push(line(b.x, y + 40, b.x + b.w, y + 40, { stroke: colour, opacity: 0.5 }));
    for (const t of list) {
      const x = b.px(t);
      out.push(rect(x, y, Math.max(2, b.px(t + slotMs) - x), 40, { fill: colour, fillOpacity: 0.9, stroke: colour, width: 1 }));
    }
  };
  row(10, "voice 1", "488 Hz", pulses[0], BEEPER);
  row(76, "voice 2", "610 Hz", pulses[1], BEEPER);
  row(142, "the bit", "EAR: both", [...pulses[0], ...pulses[1]], MIX);
  axis(out, b, 204, T, 1, "ms");
  // --- one pass, enlarged
  const py = 264;
  out.push(lines(0, py + 24, ["one pass,", "enlarged"], { size: FT, bold: true, lh: LH }));
  const pb = box(X, 0, W, 0, 0, PASS, 0, 1);
  const seg = (t0, t1, label, sub, colour, filled) => {
    out.push(rect(pb.px(t0) + 1, py, pb.px(t1) - pb.px(t0) - 2, 56, { rx: 4, stroke: colour, width: 1.6, fill: filled ? colour : "none", fillOpacity: filled ? 0.18 : undefined, opacity: filled ? 1 : 0.5 }));
    out.push(text((pb.px(t0) + pb.px(t1)) / 2, sub ? py + 23 : py + 33, label, { anchor: "middle", size: FT, bold: true, fill: filled ? colour : GREY }));
    if (sub) out.push(text((pb.px(t0) + pb.px(t1)) / 2, py + 43, sub, { anchor: "middle", size: FS }));
  };
  seg(0, SLOT, "voice 1's slot", "on if its phase carried", BEEPER, true);
  seg(SLOT, 2 * SLOT, "voice 2's slot", "on if its phase carried", BEEPER, true);
  seg(2 * SLOT, PASS, "always off", "", GREY, false);
  const ya = py + 70;
  out.push(line(pb.x, ya, pb.x + pb.w, ya, { opacity: 0.5 }));
  for (const t of [0, SLOT, 2 * SLOT, PASS]) {
    out.push(line(pb.px(t), ya - 5, pb.px(t), ya + 5, { opacity: 0.5 }));
    out.push(text(pb.px(t), ya + 22, `${t} T`, { anchor: t === 0 ? "start" : t === PASS ? "end" : "middle", size: FS }));
  }
  out.push(text(pb.x + pb.w / 2, ya + 48, `one pass: 112 T-states, 32 µs; 31,250 passes a second`, { anchor: "middle", size: FT }));
  out.push("</svg>");
  figures.twovoice = out;
  numbers.push(`twovoice fig: ${pulses[0].length} + ${pulses[1].length} pulses in ${T} ms; slot ${(slotMs * 1000).toFixed(1)} µs; ${d.hz.map((h) => h.toFixed(1)).join(", ")} Hz`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the two-voice program's spectrum, from the capture
{
  const d = capture("two-voices");
  const sp = d.spectrum;
  const top = Math.max(...sp.map(([, m]) => m));
  const out = [svgOpen(700, 300, "The spectrum of the two-voice program's captured sound from 100 to 1,300 Hz: how strong each frequency is, the strongest drawn full height. There are four peaks and almost nothing between them: the two notes at 488 and 610 Hz, voices 1 and 2, and their overtones at twice their pitch, 977 and 1,221 Hz.")];
  const b = box(58, 50, 642, 200, 100, 1300, 0, 1.1);
  out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.5 }));
  out.push(pathEl(poly(b, sp.map(([hz, m]) => [hz, m / top])), { stroke: BEEPER, width: 2 }));
  const peak = (hz) => sp.reduce((best, p) => (Math.abs(p[0] - hz) <= 10 && p[1] > best[1] ? p : best), [hz, 0]);
  for (const [hz, label] of [[488.3, ["488 Hz", "voice 1"]], [610.4, ["610 Hz", "voice 2"]], [976.6, ["977 Hz"]], [1220.7, ["1,221 Hz"]]]) {
    const [ph, m] = peak(hz);
    out.push(lines(b.px(ph), b.py(m / top) - 10 - (label.length - 1) * LH, label, { anchor: "middle", size: FT, bold: true, fill: BEEPER, lh: LH }));
    numbers.push(`spectrum fig: peak near ${hz} at ${ph} Hz, ${(m / top).toFixed(2)}, label top at y ${b.py(m / top) - 10 - (label.length - 1) * LH - 12}`);
  }
  out.push(text(b.x - 8, b.py(1) + 5, "strong", { anchor: "end", size: FS }));
  out.push(text(b.x - 8, b.py(0) + 5, "none", { anchor: "end", size: FS }));
  for (const hz of [100, 300, 500, 700, 900, 1100, 1300]) {
    out.push(line(b.px(hz), b.py(0), b.px(hz), b.py(0) + 6, { opacity: 0.5 }));
    out.push(text(b.px(hz), b.py(0) + 24, `${fmt(hz)} Hz`, { anchor: hz === 1300 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.spectrum = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the beeper's lines: the input stage, bit 6 and the MIC line
{
  const out = [svgOpen(700, 548, "A diagram of the beeper's lines. Top: the EAR socket feeds the input stage, noise rejection then relaxation, whose output is the tape input. Right: the Pi's EAR bit. Port $FE bit 6 is an or of three things: the tape input exclusive-or the Pi's EAR bit; port $FE bit 4, EAR; and port $FE bit 3, MIC, and-ed with the issue 2 keyboard switch, NextReg $08 bit 0. Bottom: the MIC line is port $FE bit 3 exclusive-or the tape input exclusive-or the Pi's EAR bit; it goes to the MIC socket and into the mixer at 128 units.")];
  out.push(arrows("bp-in", [GREY, BEEPER, PI]));
  const arrow = (d, c = BEEPER) => out.push(pathEl(d, { stroke: c, width: 1.8, marker: c === PI ? "bp-in-2" : c === BEEPER ? "bp-in-1" : "bp-in-0" }));
  const wire = (d, c = BEEPER) => out.push(pathEl(d, { stroke: c, width: 1.8 }));
  const dot = (x, y, c = BEEPER) => out.push(`  <circle cx="${x}" cy="${y}" r="4" fill="${c}" />`);
  // --- the input stage
  blk(out, 0, 20, 112, 56, ["EAR socket"], { c: BEEPER, bold: true });
  blk(out, 146, 20, 160, 56, ["noise rejection", "under ~1 µs dropped"]);
  blk(out, 340, 20, 160, 56, ["relaxation", "1 held ~1.17 ms → 0"]);
  arrow("M112,48 L142,48");
  arrow("M306,48 L336,48");
  const TX = 512; // the tape input's line, down the left of the gates
  const GX = 538, GW = 128, GC = GX + GW / 2; // the gates' column
  wire(`M500,48 L${TX},48 L${TX},410`);
  out.push(text(TX - 8, 106, "tape input", { anchor: "end", size: FT, bold: true, fill: BEEPER }));
  // --- the Pi's EAR bit
  blk(out, 548, 20, 152, 56, ["Pi's EAR bit"], { c: PI });
  const PX = 694; // the Pi's line, down the right of the gates
  arrow(`M624,76 L624,92 L${PX},92 L${PX},424 L670,424`, PI);
  // --- bit 6: exclusive or, then or
  blk(out, GX, 120, GW, 48, ["exclusive or"]);
  arrow(`M${TX},134 L${GX - 4},134`);
  dot(TX, 134);
  arrow(`M${PX},154 L${GX + GW + 4},154`, PI);
  dot(PX, 154, PI);
  blk(out, GX, 210, GW, 64, ["or"]);
  arrow(`M${GC},168 L${GC},206`, GREY);
  // --- sources on the left
  blk(out, 0, 214, 220, 36, ["port $FE bit 4 (EAR)"], { c: BEEPER });
  blk(out, 0, 280, 220, 36, ["port $FE bit 3 (MIC)"], { c: BEEPER });
  blk(out, 0, 336, 220, 36, ["issue 2: NextReg $08 bit 0"]);
  arrow(`M220,232 L${GX - 4},232`);
  blk(out, 290, 284, 100, 84, ["and"]);
  arrow("M220,298 L286,298");
  arrow("M220,354 L286,354", GREY);
  arrow(`M390,326 L440,326 L440,256 L${GX - 4},256`, GREY);
  blk(out, GX, 306, GW, 44, ["port $FE bit 6"], { c: BEEPER, bold: true, fill: true });
  arrow(`M${GC},274 L${GC},302`, GREY);
  // --- the MIC line
  blk(out, GX, 396, GW, 48, ["exclusive or"]);
  wire("M254,298 L254,432");
  dot(254, 298);
  arrow(`M254,432 L${GX - 4},432`);
  arrow(`M${TX},410 L${GX - 4},410`);
  wire(`M${GC},444 L${GC},470`);
  dot(GC, 470);
  out.push(text(450, 462, "the MIC line", { anchor: "middle", size: FT, bold: true, fill: BEEPER }));
  blk(out, 300, 504, 140, 40, ["MIC socket"], { c: BEEPER, bold: true });
  blk(out, 530, 504, 170, 40, ["mixer: MIC, 128"], { c: MIX, bold: true });
  arrow(`M${GC},470 L370,470 L370,500`);
  arrow(`M${GC},470 L615,470 L615,500`);
  out.push("</svg>");
  figures.input = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the input stage at work, simulated tick by tick from its rules
{
  const MHZ = 28; // master clocks per µs
  // --- Noise rejection: a two-stage synchroniser; any difference between the stages clears a 2-bit
  //     count, which steps on the 1.75 MHz enable (every 16 clocks) until its top bit is set; while it
  //     is set, the output takes the level
  function debounce(input, n) {
    let b0 = 0, b1 = 0, count = 0, o = 0;
    const res = [];
    for (let k = 0; k < n; k++) {
      const noise = b0 ^ b1;
      const en = k % 16 === 0;
      const nb1 = b0, nb0 = input(k);
      let nc = count;
      if (noise) nc = 0;
      else if (en && !(count & 2)) nc = count + 1;
      if (count & 2) o = b1;
      b1 = nb1; b0 = nb0; count = nc;
      res.push(o);
    }
    return res;
  }
  // --- Relaxation: a count of 512-clock enables while the level is 1, cleared at 0; the output is
  //     the level unless the count has reached 64
  function relax(input, n) {
    let count = 0, o = 0;
    const res = [];
    for (let k = 0; k < n; k++) {
      const sig = input(k);
      const en = k % 512 === 0;
      const nc = !sig ? 0 : en && !(count & 64) ? count + 1 : count;
      o = sig && !(count & 64) ? 1 : 0;
      count = nc;
      res.push(o);
    }
    return res;
  }
  const out = [svgOpen(700, 452, "Two panels, worked out from the input stage's rules. Top, six microseconds: the input has a glitch half a microsecond long at 1 microsecond, which the noise rejection drops, and a real rising edge at 3 microseconds, which passes about a microsecond later. Bottom, five milliseconds: the input is a tone of 600-microsecond halves for two periods and is then left at 1; the tone passes the relaxation unchanged, and the level left at 1 falls to 0 about 1.17 milliseconds after it began.")];
  const X = 140, W = 700 - X;
  const trace = (b, vals, n, colour, lo, hi) => {
    const pts = [];
    let prev = vals[0];
    pts.push([0, prev ? hi : lo]);
    for (let k = 1; k < n; k++) if (vals[k] !== prev) { pts.push([k, prev ? hi : lo], [k, vals[k] ? hi : lo]); prev = vals[k]; }
    pts.push([n, prev ? hi : lo]);
    out.push(pathEl(poly(b, pts), { stroke: colour, width: 2 }));
  };
  const rowT = (y, title, vals, n, colour) => {
    out.push(lines(0, y + 22 - (title.length - 1) * 9, title, { size: FT, fill: colour, bold: true, lh: LH }));
    trace(box(X, y, W, 34, 0, n, 0, 1), vals, n, colour, 0.05, 0.95);
  };
  // --- panel A: noise rejection
  {
    const n = 6 * MHZ;
    const inp = (k) => (k >= 1.0 * MHZ && k < 1.5 * MHZ) || k >= 3.0 * MHZ ? 1 : 0;
    const res = debounce(inp, n);
    const rise = res.findIndex((v, k) => k > 2.5 * MHZ && v);
    numbers.push(`conditioning fig: glitch passed: ${res.slice(0, 2.5 * MHZ).some((v) => v)}; edge delay ${((rise - 3 * MHZ) / MHZ).toFixed(2)} µs`);
    out.push(text(0, 18, "noise rejection, over 6 µs", { size: FH, bold: true }));
    const b = box(X, 0, W, 0, 0, n, 0, 1);
    out.push(text(b.px(1.25 * MHZ), 44, "glitch, 0.5 µs: dropped", { anchor: "middle", size: FS, fill: MIX, bold: true }));
    rowT(54, ["the socket"], [...Array(n)].map((_, k) => inp(k)), n, GREY);
    rowT(106, ["after", "rejection"], res, n, BEEPER);
    out.push(text(b.px(rise) + 8, 132, `passes ${((rise - 3 * MHZ) / MHZ).toFixed(1)} µs late`, { size: FS }));
    axis(out, b, 160, 6, 1, "µs", MHZ);
  }
  // --- panel B: relaxation
  {
    const n = 5000 * MHZ;
    const half = 600 * MHZ;
    const inp = (k) => (k < 4 * half ? (Math.floor(k / half) % 2 === 0 ? 1 : 0) : 1);
    const res = relax(inp, n);
    const fall = res.findIndex((v, k) => k > 4 * half && !v);
    numbers.push(`conditioning fig: relaxed after ${((fall - 4 * half) / MHZ / 1000).toFixed(3)} ms`);
    out.push(text(0, 226, "relaxation, over 5 ms", { size: FH, bold: true }));
    const b = box(X, 0, W, 0, 0, n, 0, 1);
    out.push(text(b.px(2 * half), 252, "a tone: passes unchanged", { anchor: "middle", size: FS }));
    out.push(text(b.px(4 * half) + 6, 252, "left at 1", { size: FS }));
    rowT(262, ["before"], [...Array(n)].map((_, k) => inp(k)), n, GREY);
    rowT(314, ["after", "relaxation"], res, n, BEEPER);
    out.push(line(b.px(4 * half), 354, b.px(4 * half), 372, { opacity: 0.6 }));
    out.push(line(b.px(fall), 354, b.px(fall), 372, { opacity: 0.6 }));
    out.push(line(b.px(4 * half), 366, b.px(fall), 366, { stroke: MIX, width: 1.8 }));
    out.push(text(b.px(fall) + 8, 371, `${((fall - 4 * half) / MHZ / 1000).toFixed(2)} ms, then 0`, { size: FT, fill: MIX, bold: true }));
    axis(out, b, 404, 5, 1, "ms", 1000 * MHZ);
  }
  out.push("</svg>");
  figures.conditioning = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the beeper in the mix, and on the speaker alone
{
  const out = [svgOpen(700, 300, "Two diagrams side by side. Left, after power-on: EAR and MIC and the other sources are added in the mixer, and its sum goes to the audio jack, HDMI and the internal speaker. Right, with NextReg $06 bit 6 set and the speaker on: EAR and MIC go straight to the internal speaker, and the mixer adds only the other sources, for the jack and HDMI.")];
  out.push(arrows("bp-spk", [GREY, BEEPER, MIX]));
  const panel = (x0, title, sub, excl) => {
    out.push(text(x0, 20, title, { size: FH, bold: true }));
    out.push(text(x0, 42, sub, { size: FS }));
    const b = (x, y, w, h, t, c) => blk(out, x0 + x, y, w, h, t, { c: c === GREY ? undefined : c, bold: c !== GREY });
    b(0, 86, 116, 40, ["other sources"], GREY);
    b(0, 166, 116, 40, ["EAR and MIC"], BEEPER);
    b(148, 76, 64, 140, ["mixer"], MIX);
    b(244, 76, 96, 40, ["audio jack"], GREY);
    b(244, 140, 96, 40, ["HDMI"], GREY);
    b(244, 234, 96, 56, ["internal", "speaker"], excl ? BEEPER : GREY);
    const a = (d, c) => out.push(pathEl(d.replace(/(-?\d+),/g, (_, n) => `${+n + x0},`), { stroke: c, width: 1.8, marker: c === BEEPER ? "bp-spk-1" : c === MIX ? "bp-spk-2" : "bp-spk-0" }));
    a("M116,106 L144,106", GREY);
    a("M212,96 L240,96", MIX);
    a("M212,160 L240,160", MIX);
    if (!excl) {
      a("M116,186 L144,186", BEEPER);
      a("M180,216 L180,262 L240,262", MIX);
    } else {
      a("M58,206 L58,262 L240,262", BEEPER);
    }
  };
  panel(0, "after power-on", "the beeper is part of the mix", false);
  panel(360, "NextReg $06 bit 6 set", "the beeper on the speaker alone", true);
  out.push(line(350, 10, 350, 290, { opacity: 0.2 }));
  out.push("</svg>");
  figures.speaker = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
