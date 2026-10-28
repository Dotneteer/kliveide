#!/usr/bin/env node
// Figures of "ZX Spectrum Next: The Beeper, EAR and MIC" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/beeper.mdx).
//
// The waveforms and the spectrum come from the machine: the captures that
// test/zxnext-hw/audio/next-audio-scene.test.ts writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The two-voice timeline is the program's own arithmetic, and the input stage is simulated tick by tick
// from the hardware's rules (a debounce on the 1.75 MHz enable that needs two enables without a change,
// a relaxation that turns a 1 held for 64 enables of 512 master clocks into 0). Then:
//   node docs/authoring/next-audio/beeper-figures.cjs
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
  const CW = 66, X0 = 110;
  const out = [svgOpen(700, 200, "Port $FE as two strips of eight bits, bit 7 on the left. Written: bits 7 to 5 are ignored, bit 4 is EAR, the beeper, bit 3 is MIC, the tape output, and bits 2 to 0 are the border colour. Read: bit 7 reads 1, bit 6 is the tape input, bit 5 reads 1, and bits 4 to 0 are the keyboard's columns, 0 for a key held.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 22, String(b), { anchor: "middle", size: 11 }));
  const strip = (y, title, cells) => {
    out.push(text(10, y + 26, title, { size: 13, bold: true }));
    for (const c of cells) {
      const x = X0 + (7 - c.from) * CW;
      const w = (c.from - c.to + 1) * CW;
      const on = c.c !== GREY;
      out.push(rect(x + 2, y, w - 4, 40, { rx: 4, stroke: c.c, width: on ? 1.8 : 1, opacity: on ? 1 : 0.45, fill: on ? c.c : "none", fillOpacity: on ? 0.18 : undefined }));
      out.push(lines(x + w / 2, y + (c.t.length > 1 ? 17 : 25), c.t, { anchor: "middle", size: 12, bold: on, fill: on ? c.c : GREY, lh: 14 }));
    }
  };
  strip(32, "write", [
    { from: 7, to: 5, t: ["ignored"], c: GREY },
    { from: 4, to: 4, t: ["EAR", "beeper"], c: BEEPER },
    { from: 3, to: 3, t: ["MIC", "tape out"], c: BEEPER },
    { from: 2, to: 0, t: ["border colour"], c: GREY }
  ]);
  strip(100, "read", [
    { from: 7, to: 7, t: ["1"], c: GREY },
    { from: 6, to: 6, t: ["tape", "input"], c: BEEPER },
    { from: 5, to: 5, t: ["1"], c: GREY },
    { from: 4, to: 0, t: ["keyboard: one bit per key of the selected rows, 0 = held"], c: GREY }
  ]);
  out.push(text(X0, 172, "any even port address is port $FE; bit 6 also reads the EAR and MIC bits back (Part 6)", { size: 11.5 }));
  out.push("</svg>");
  figures.bits = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: EAR and MIC on the mixer's scale
{
  const out = [svgOpen(700, 300, "Two scales. Top, the mixer's whole range for one side, 0 to 8,191, as a long bar; EAR and MIC together take its first 640 units, a short blue stretch at the left end. Bottom, that stretch enlarged to 0 to 700, with the four levels the two bits can make drawn as bars to scale: neither bit 0, MIC alone 128, EAR alone 512, both 640.")];
  const X0 = 30, W = 640;
  const big = (v) => X0 + (v / 8191) * W;
  out.push(text(X0, 22, "the mixer's range, one side", { size: 12.5, bold: true }));
  out.push(rect(X0, 32, W, 22, { opacity: 0.5 }));
  out.push(rect(X0, 32, big(640) - X0, 22, { fill: BEEPER, fillOpacity: 0.8, stroke: BEEPER }));
  for (const v of [0, 640, 2048, 4096, 6144, 8191]) {
    out.push(line(big(v), 54, big(v), 60, { opacity: 0.5 }));
    out.push(text(big(v), 74, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: 11, fill: v === 640 ? BEEPER : GREY }));
  }
  const ZX = 140, ZW = 520;
  const zoom = (v) => ZX + (v / 700) * ZW;
  // --- zoom lines from the short stretch to the enlarged scale
  out.push(line(X0, 80, ZX, 108, { opacity: 0.4, dash: "4 3" }));
  out.push(line(big(640), 80, zoom(640), 108, { opacity: 0.4, dash: "4 3" }));
  out.push(text(ZX, 104, "enlarged: 0 to 700", { size: 12.5, bold: true }));
  const rows = [["neither", 0], ["MIC", 128], ["EAR", 512], ["EAR + MIC", 640]];
  rows.forEach(([t, v], i) => {
    const y = 118 + i * 34;
    out.push(text(ZX - 10, y + 17, t, { anchor: "end", size: 12.5, bold: true, fill: BEEPER }));
    if (v) out.push(rect(ZX, y, zoom(v) - ZX, 22, { fill: BEEPER, fillOpacity: 0.75, stroke: BEEPER }));
    out.push(text(zoom(v) + 6, y + 16, fmt(v), { size: 12, bold: true }));
  });
  const ya = 118 + rows.length * 34 + 4;
  out.push(line(ZX, ya, ZX + ZW, ya, { opacity: 0.5 }));
  for (const v of [0, 128, 256, 384, 512, 640]) {
    out.push(line(zoom(v), ya - 3, zoom(v), ya + 3, { opacity: 0.5 }));
    out.push(text(zoom(v), ya + 17, String(v), { anchor: "middle", size: 11 }));
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
  const out = [svgOpen(700, 300, `Four milliseconds of the loop's note, captured from the machine: a square wave of 994 Hz, 512 units from bottom to top, centred on zero. Each high and each low half is one pass of the loop, 1,760 T-states or 503 microseconds; a whole period, two passes, is 1,006 microseconds.`)];
  out.push(arrows("bp-note", [GREY, BEEPER]));
  const b = box(80, 50, 600, 160, 0, T, -360, 360);
  for (const lv of [-256, 0, 256]) {
    out.push(line(b.x, b.py(lv), b.x + b.w, b.py(lv), { opacity: lv ? 0.2 : 0.4 }));
    out.push(text(b.x - 6, b.py(lv) + 4, lv > 0 ? `+${lv}` : lv < 0 ? `−${-lv}` : "0", { anchor: "end", size: 11 }));
  }
  out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: BEEPER, width: 2 }));
  // --- one pass and one period, measured from the first rising edge
  const y1 = 32, y2 = 236;
  const t1 = tEdge, t2 = tEdge + half, t3 = tEdge + 2 * half;
  out.push(line(b.px(t1), y1 + 4, b.px(t1), b.py(300), { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t2), y1 + 4, b.px(t2), y2 - 4, { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t3), b.py(-300), b.px(t3), y2 - 4, { opacity: 0.35, dash: "3 3" }));
  out.push(line(b.px(t1) + 2, y1, b.px(t2) - 2, y1, { stroke: BEEPER, width: 1.5, marker: "bp-note-1" }));
  out.push(line(b.px(t2) - 2, y1, b.px(t1) + 2, y1, { stroke: BEEPER, width: 1.5, marker: "bp-note-1" }));
  out.push(text((b.px(t1) + b.px(t2)) / 2, y1 - 6, "one pass: 1,760 T-states, 503 µs", { anchor: "middle", size: 11.5, fill: BEEPER, bold: true }));
  out.push(line(b.px(t1) + 2, y2, b.px(t3) - 2, y2, { width: 1.2, marker: "bp-note-0" }));
  out.push(line(b.px(t3) - 2, y2, b.px(t1) + 2, y2, { width: 1.2, marker: "bp-note-0" }));
  out.push(text((b.px(t1) + b.px(t3)) / 2, y2 + 15, "one period, two passes: 1,006 µs, so 994 Hz", { anchor: "middle", size: 11.5 }));
  out.push(line(b.x, 262, b.x + b.w, 262, { opacity: 0.5 }));
  for (let ms = 0; ms <= T; ms++) {
    out.push(line(b.px(ms), 258, b.px(ms), 266, { opacity: 0.5 }));
    out.push(text(b.px(ms), 282, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: 11.5 }));
  }
  out.push("</svg>");
  figures.note = out;
  numbers.push(`note fig: ${d.hz.toFixed(2)} Hz measured; half period ${(half * 1000).toFixed(1)} µs; swing ${(Math.max(...w) - Math.min(...w)).toFixed(0)} units`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the same loop at 3.5 MHz, at 7 MHz, and in contended memory
{
  const T = 10; // ms
  const rows = [
    { name: "note-35", t: "3.5 MHz", hz: (d) => d.hz },
    { name: "note-7", t: "7 MHz", hz: (d) => d.hz7 },
    { name: "note-contended", t: "3.5 MHz, contended", hz: (d) => d.hzContendedLow }
  ];
  const out = [svgOpen(700, 380, "The same beeper loop captured three times, ten milliseconds each, on one time scale. At 3.5 MHz it is a square wave of 994 Hz, about ten periods. At 7 MHz the periods are half as long: 1,989 Hz, about twenty periods. At 3.5 MHz with the loop in contended memory and contention on, the periods are longer and slightly uneven: about 918 Hz on average.")];
  rows.forEach((row, i) => {
    const d = capture(row.name);
    const v = units(d);
    const dt = 1000 / d.rate;
    const start = Math.floor(risingEdge(v, 40)) - 4;
    const w = v.slice(start, start + Math.round(T / dt));
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const y = 30 + i * 105;
    const b = box(150, y, 530, 70, 0, T, -330, 330);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: BEEPER, width: 1.6 }));
    out.push(text(10, y + 30, row.t, { size: 13, bold: true, fill: BEEPER }));
    out.push(text(10, y + 48, `${fmt(row.hz(d))} Hz`, { size: 12.5 }));
    numbers.push(`speeds fig: ${row.t}: ${row.hz(d).toFixed(1)} Hz`);
  });
  const b = box(150, 0, 530, 0, 0, T, 0, 1);
  out.push(line(b.x, 340, b.x + b.w, 340, { opacity: 0.5 }));
  for (let ms = 0; ms <= T; ms += 2) {
    out.push(line(b.px(ms), 336, b.px(ms), 344, { opacity: 0.5 }));
    out.push(text(b.px(ms), 360, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: 11.5 }));
  }
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
  const out = [svgOpen(700, 400, "Eight milliseconds of the two-voice program, worked out from its arithmetic. Top row, voice 1: a short pulse every 2.05 milliseconds, 488 Hz. Middle row, voice 2: a short pulse about every 1.64 milliseconds, 610 Hz. Bottom row, the bit itself: both trains of pulses together. Under them, one pass of the loop enlarged: 112 T-states, of which the first 34 are voice 1's slot, the next 34 voice 2's, and the last 44 always off.")];
  const b = box(130, 0, 550, 0, 0, T, 0, 1);
  const row = (y, title, sub, list, colour) => {
    out.push(text(10, y + 14, title, { size: 13, bold: true, fill: colour }));
    out.push(text(10, y + 30, sub, { size: 11.5 }));
    out.push(line(b.x, y + 34, b.x + b.w, y + 34, { stroke: colour, opacity: 0.5 }));
    for (const t of list) {
      const x = b.px(t);
      out.push(rect(x, y, Math.max(2, b.px(t + slotMs) - x), 34, { fill: colour, fillOpacity: 0.9, stroke: colour, width: 1 }));
    }
  };
  row(20, "voice 1", "488 Hz", pulses[0], BEEPER);
  row(84, "voice 2", "610 Hz", pulses[1], BEEPER);
  row(148, "the bit (EAR)", "both", [...pulses[0], ...pulses[1]], MIX);
  out.push(line(b.x, 198, b.x + b.w, 198, { opacity: 0.5 }));
  for (let ms = 0; ms <= T; ms++) {
    out.push(line(b.px(ms), 194, b.px(ms), 202, { opacity: 0.5 }));
    out.push(text(b.px(ms), 218, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: 11.5 }));
  }
  // --- one pass, enlarged
  const py = 262;
  out.push(text(10, py + 20, "one pass,", { size: 13, bold: true }));
  out.push(text(10, py + 36, "enlarged", { size: 13, bold: true }));
  const pb = box(130, 0, 550, 0, 0, PASS, 0, 1);
  const seg = (t0, t1, label, sub, colour, filled) => {
    out.push(rect(pb.px(t0) + 1, py, pb.px(t1) - pb.px(t0) - 2, 44, { rx: 4, stroke: colour, width: 1.6, fill: filled ? colour : "none", fillOpacity: filled ? 0.18 : undefined, opacity: filled ? 1 : 0.5 }));
    out.push(text((pb.px(t0) + pb.px(t1)) / 2, py + 19, label, { anchor: "middle", size: 12, bold: true, fill: filled ? colour : GREY }));
    out.push(text((pb.px(t0) + pb.px(t1)) / 2, py + 35, sub, { anchor: "middle", size: 11 }));
  };
  seg(0, SLOT, "voice 1's slot", "on if its phase carried", BEEPER, true);
  seg(SLOT, 2 * SLOT, "voice 2's slot", "on if its phase carried", BEEPER, true);
  seg(2 * SLOT, PASS, "always off", "", GREY, false);
  out.push(line(pb.x, py + 56, pb.x + pb.w, py + 56, { opacity: 0.5 }));
  for (const t of [0, SLOT, 2 * SLOT, PASS]) {
    out.push(line(pb.px(t), py + 52, pb.px(t), py + 60, { opacity: 0.5 }));
    out.push(text(pb.px(t), py + 76, `${t} T`, { anchor: t === 0 ? "start" : t === PASS ? "end" : "middle", size: 11.5 }));
  }
  out.push(text(pb.x + pb.w / 2, py + 100, `one pass: 112 T-states, 32 µs; 31,250 passes a second`, { anchor: "middle", size: 11.5 }));
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
  const out = [svgOpen(700, 300, "The spectrum of the two-voice program's captured sound from 100 to 1,300 Hz: how strong each frequency is, the strongest drawn full height. There are four peaks and almost nothing between them: the two notes at 488 and 610 Hz, and their overtones at twice their pitch, 977 and 1,221 Hz.")];
  const b = box(80, 40, 600, 190, 100, 1300, 0, 1.1);
  out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.5 }));
  out.push(pathEl(poly(b, sp.map(([hz, m]) => [hz, m / top])), { stroke: BEEPER, width: 2 }));
  const peak = (hz) => sp.reduce((best, p) => (Math.abs(p[0] - hz) <= 10 && p[1] > best[1] ? p : best), [hz, 0]);
  for (const [hz, label] of [[488.3, "488 Hz: voice 1"], [610.4, "610 Hz: voice 2"], [976.6, "977 Hz"], [1220.7, "1,221 Hz"]]) {
    const [ph, m] = peak(hz);
    out.push(text(b.px(ph), b.py(m / top) - 8, label, { anchor: "middle", size: 11.5, bold: true, fill: BEEPER }));
    numbers.push(`spectrum fig: peak near ${hz} at ${ph} Hz, ${(m / top).toFixed(2)}`);
  }
  out.push(text(b.x - 8, b.py(1) + 4, "strong", { anchor: "end", size: 11 }));
  out.push(text(b.x - 8, b.py(0) + 4, "none", { anchor: "end", size: 11 }));
  for (const hz of [100, 300, 500, 700, 900, 1100, 1300]) {
    out.push(line(b.px(hz), b.py(0), b.px(hz), b.py(0) + 6, { opacity: 0.5 }));
    out.push(text(b.px(hz), b.py(0) + 22, `${fmt(hz)} Hz`, { anchor: hz === 1300 ? "end" : "middle", size: 11.5 }));
  }
  out.push("</svg>");
  figures.spectrum = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the beeper's lines: the input stage, bit 6 and the MIC line
{
  const out = [svgOpen(700, 470, "A diagram of the beeper's lines. Top: the EAR socket feeds the input stage, noise rejection then relaxation, whose output is the tape input. Right: the Pi's EAR bit. Port $FE bit 6 is an or of three things: the tape input exclusive-or the Pi's EAR bit; port $FE bit 4, EAR; and port $FE bit 3, MIC, and-ed with the issue 2 keyboard switch, NextReg $08 bit 0. Bottom: the MIC line is port $FE bit 3 exclusive-or the tape input exclusive-or the Pi's EAR bit; it goes to the MIC socket and into the mixer at 128 units.")];
  out.push(arrows("bp-in", [GREY, BEEPER, PI]));
  const box2 = (x, y, w, h, t, o = {}) => {
    out.push(rect(x, y, w, h, { rx: 6, stroke: o.c ?? GREY, width: o.c ? 1.8 : 1.4, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? 0.12 : undefined }));
    out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * 14) / 2 + 4, t, { anchor: "middle", size: o.size ?? 12, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh: 14 }));
  };
  const arrow = (d, c = BEEPER, dash) => out.push(pathEl(d, { stroke: c, width: 1.6, dash, marker: c === PI ? "bp-in-2" : c === BEEPER ? "bp-in-1" : "bp-in-0" }));
  const wire = (d, c = BEEPER) => out.push(pathEl(d, { stroke: c, width: 1.6 }));
  const dot = (x, y, c = BEEPER) => out.push(`  <circle cx="${x}" cy="${y}" r="3.5" fill="${c}" />`);
  // --- the input stage
  box2(10, 30, 110, 44, ["EAR socket"], { c: BEEPER, bold: true });
  box2(150, 30, 140, 44, ["noise rejection", "under ~1 µs dropped"], { size: 11.5 });
  box2(305, 30, 125, 44, ["relaxation", "1 held ~1.17 ms → 0"], { size: 11.5 });
  arrow("M120,52 L146,52");
  arrow("M290,52 L301,52");
  const TX = 450; // the tape input's line, down the left of the gates
  wire(`M430,52 L${TX},52 L${TX},370`);
  dot(TX, 52);
  out.push(text(TX + 8, 47, "tape input", { size: 12, bold: true, fill: BEEPER }));
  // --- the Pi's EAR bit
  box2(560, 30, 130, 44, ["Pi's EAR bit", "(article 6)"], { c: PI, size: 11.5 });
  const PX = 680; // the Pi's line, down the right of the gates
  wire(`M625,74 L625,86 L${PX},86 L${PX},440`, PI);
  // --- bit 6: exclusive or, then or
  box2(470, 110, 180, 40, ["exclusive or"], { size: 12 });
  arrow(`M${TX},122 L466,122`);
  dot(TX, 122);
  arrow(`M${PX},138 L654,138`, PI);
  dot(PX, 138, PI);
  box2(470, 190, 180, 56, ["or"], { size: 12 });
  arrow("M560,150 L560,186", GREY);
  // --- sources on the left
  box2(10, 180, 190, 32, ["port $FE bit 4 (EAR)"], { c: BEEPER, size: 12 });
  box2(10, 250, 190, 32, ["port $FE bit 3 (MIC)"], { c: BEEPER, size: 12 });
  box2(10, 300, 190, 32, ["issue 2: NextReg $08 bit 0"], { size: 12 });
  arrow("M200,196 L466,206");
  box2(270, 260, 110, 52, ["and"], { size: 12 });
  arrow("M200,266 L266,276");
  arrow("M200,316 L266,298", GREY);
  arrow("M380,286 L420,286 L420,234 L466,234", GREY);
  box2(470, 280, 180, 36, ["port $FE bit 6"], { c: BEEPER, bold: true, fill: true });
  arrow("M560,246 L560,276", GREY);
  // --- the MIC line
  box2(470, 360, 180, 40, ["exclusive or"], { size: 12 });
  wire("M235,266 L235,384");
  dot(235, 266);
  arrow("M235,384 L466,384");
  arrow(`M${TX},370 L466,370`);
  arrow(`M${PX},440 L${PX},380 L654,380`, PI);
  out.push(text(330, 412, "the MIC line", { size: 12, bold: true, fill: BEEPER }));
  box2(330, 426, 120, 36, ["MIC socket"], { c: BEEPER, bold: true });
  box2(520, 426, 140, 36, ["mixer: MIC, 128"], { c: MIX, bold: true });
  wire("M560,400 L560,418");
  dot(560, 418);
  arrow("M560,418 L390,418 L390,422");
  arrow("M560,418 L590,418 L590,422");
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
  const out = [svgOpen(700, 440, "Two panels, worked out from the input stage's rules. Top, six microseconds: the input has a glitch half a microsecond long at 1 microsecond, which the noise rejection drops, and a real rising edge at 3 microseconds, which passes about a microsecond later. Bottom, five milliseconds: the input is a tone of 600-microsecond halves for two periods and is then left at 1; the tone passes the relaxation unchanged, and the level left at 1 falls to 0 about 1.17 milliseconds after it began.")];
  const trace = (b, vals, n, colour, lo, hi) => {
    const pts = [];
    let prev = vals[0];
    pts.push([0, prev ? hi : lo]);
    for (let k = 1; k < n; k++) if (vals[k] !== prev) { pts.push([k, prev ? hi : lo], [k, vals[k] ? hi : lo]); prev = vals[k]; }
    pts.push([n, prev ? hi : lo]);
    out.push(pathEl(poly(b, pts), { stroke: colour, width: 2 }));
  };
  // --- panel A: noise rejection
  {
    const n = 6 * MHZ;
    const inp = (k) => (k >= 1.0 * MHZ && k < 1.5 * MHZ) || k >= 3.0 * MHZ ? 1 : 0;
    const res = debounce(inp, n);
    const rise = res.findIndex((v, k) => k > 2.5 * MHZ && v);
    numbers.push(`conditioning fig: glitch passed: ${res.slice(0, 2.5 * MHZ).some((v) => v)}; edge delay ${((rise - 3 * MHZ) / MHZ).toFixed(2)} µs`);
    out.push(text(10, 22, "noise rejection, over 6 µs", { size: 13, bold: true }));
    const b = box(150, 0, 530, 0, 0, n, 0, 1);
    const rowA = (y, title, vals, colour) => {
      out.push(text(10, y + 22, title, { size: 12, fill: colour, bold: true }));
      trace(box(150, y, 530, 30, 0, n, 0, 1), vals, n, colour, 0.05, 0.95);
    };
    rowA(34, "the socket", [...Array(n)].map((_, k) => inp(k)), GREY);
    rowA(80, "after rejection", res, BEEPER);
    out.push(text(b.px(1.25 * MHZ), 30, "glitch, 0.5 µs: dropped", { anchor: "middle", size: 11, fill: MIX }));
    out.push(text(b.px(rise) + 6, 98, `passes ${((rise - 3 * MHZ) / MHZ).toFixed(1)} µs late`, { size: 11 }));
    out.push(line(b.x, 128, b.x + b.w, 128, { opacity: 0.5 }));
    for (let us = 0; us <= 6; us++) {
      out.push(line(b.px(us * MHZ), 124, b.px(us * MHZ), 132, { opacity: 0.5 }));
      out.push(text(b.px(us * MHZ), 148, `${us} µs`, { anchor: us === 0 ? "start" : us === 6 ? "end" : "middle", size: 11.5 }));
    }
  }
  // --- panel B: relaxation
  {
    const n = 5000 * MHZ;
    const half = 600 * MHZ;
    const inp = (k) => (k < 4 * half ? (Math.floor(k / half) % 2 === 0 ? 1 : 0) : 1);
    const res = relax(inp, n);
    const fall = res.findIndex((v, k) => k > 4 * half && !v);
    numbers.push(`conditioning fig: relaxed after ${((fall - 4 * half) / MHZ / 1000).toFixed(3)} ms`);
    out.push(text(10, 196, "relaxation, over 5 ms", { size: 13, bold: true }));
    const b = box(150, 0, 530, 0, 0, n, 0, 1);
    const rowB = (y, title, vals, colour) => {
      out.push(text(10, y + 22, title, { size: 12, fill: colour, bold: true }));
      trace(box(150, y, 530, 30, 0, n, 0, 1), vals, n, colour, 0.05, 0.95);
    };
    rowB(226, "before", [...Array(n)].map((_, k) => inp(k)), GREY);
    rowB(290, "after relaxation", res, BEEPER);
    out.push(text(b.px(2 * half), 218, "a tone: passes unchanged", { anchor: "middle", size: 11 }));
    out.push(text(b.px(4 * half) + 4, 218, "left at 1", { size: 11 }));
    out.push(line(b.px(4 * half), 330, b.px(4 * half), 346, { opacity: 0.6 }));
    out.push(line(b.px(fall), 330, b.px(fall), 346, { opacity: 0.6 }));
    out.push(line(b.px(4 * half), 340, b.px(fall), 340, { stroke: MIX, width: 1.5 }));
    out.push(text((b.px(4 * half) + b.px(fall)) / 2, 360, `${((fall - 4 * half) / MHZ / 1000).toFixed(2)} ms, then 0`, { anchor: "middle", size: 11.5, fill: MIX, bold: true }));
    out.push(line(b.x, 384, b.x + b.w, 384, { opacity: 0.5 }));
    for (let ms = 0; ms <= 5; ms++) {
      out.push(line(b.px(ms * 1000 * MHZ), 380, b.px(ms * 1000 * MHZ), 388, { opacity: 0.5 }));
      out.push(text(b.px(ms * 1000 * MHZ), 404, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === 5 ? "end" : "middle", size: 11.5 }));
    }
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
    out.push(text(x0, 22, title, { size: 13, bold: true }));
    out.push(text(x0, 40, sub, { size: 11.5 }));
    const b = (x, y, w, h, t, c) => {
      out.push(rect(x0 + x, y, w, h, { rx: 6, stroke: c, width: c === GREY ? 1.4 : 1.8 }));
      out.push(lines(x0 + x + w / 2, y + h / 2 - ((t.length - 1) * 14) / 2 + 4, t, { anchor: "middle", size: 12, bold: c !== GREY, fill: c, lh: 14 }));
    };
    b(0, 70, 110, 40, ["other sources"], GREY);
    b(0, 150, 110, 40, ["EAR and MIC"], BEEPER);
    b(140, 100, 70, 70, ["mixer"], MIX);
    b(240, 70, 90, 34, ["audio jack"], GREY);
    b(240, 130, 90, 34, ["HDMI"], GREY);
    b(240, 210, 90, 44, ["internal", "speaker"], excl ? BEEPER : GREY);
    const a = (d, c) => out.push(pathEl(d.replace(/(-?\d+),/g, (_, n) => `${+n + x0},`), { stroke: c, width: 1.6, marker: c === BEEPER ? "bp-spk-1" : c === MIX ? "bp-spk-2" : "bp-spk-0" }));
    a("M110,90 L136,118", GREY);
    a("M210,125 L236,87", MIX);
    a("M210,140 L236,147", MIX);
    if (!excl) {
      a("M110,170 L136,150", BEEPER);
      a("M210,158 L236,225", MIX);
    } else {
      a("M55,190 L55,232 L236,232", BEEPER);
    }
  };
  panel(10, "after power-on", "the beeper is part of the mix", false);
  panel(370, "NextReg $06 bit 6 set", "the beeper on the speaker alone", true);
  out.push(line(355, 20, 355, 280, { opacity: 0.2 }));
  out.push("</svg>");
  figures.speaker = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
