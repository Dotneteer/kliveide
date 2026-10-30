#!/usr/bin/env node
// Figures of "Audio from the Raspberry Pi: Samples on Four Wires" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/pi-audio.mdx).
//
// The waveforms come from the machine: the captures that test/zxnext-hw/audio/next-audio-scene.test.ts
// writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The diagrams, the timing, the word and the level budget are drawn from the rules. Then:
//   node docs/authoring/next-audio/pi-audio-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { PI, BEEPER, MIX, box, sampleStairs, poly, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/pi-audio.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/pi-audio", `${name}.json`), "utf8"));
/** Klive's mix adds the Pi's word as (word - 512) units: the word back from a side */
const wordOf = (d, which = "left") => d[which].map((w) => 512 + w / d.gain);
const GREY = "currentColor";
const DT = 1000 / 48000;
const fmt = (v) => Math.round(v).toLocaleString("en-US");

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

/** Captured rows of the Pi's word on one side, $000 to $3FF */
function rows(id, label, list, T, step, rowH = 70) {
  const X = 140, W = 700 - X - 4, GAP = 34;
  // --- a row may set its own gap below it (pairs of rows sit closer together)
  const ys = [];
  let at = 12;
  list.forEach((row) => { ys.push(at); at += rowH + (row.gap ?? GAP); });
  const H = at - (list[list.length - 1].gap ?? GAP) + 34 + 40;
  const out = [svgOpen(700, H, label)];
  list.forEach((row, i) => {
    const y = ys[i];
    const b = box(X, y, W, rowH, 0, T, 0, 1023);
    out.push(line(b.x, b.py(512), b.x + b.w, b.py(512), { opacity: 0.3, dash: "3 4" }));
    out.push(pathEl(sampleStairs(b, row.values.slice(0, Math.round(T / DT)), 0, DT), { stroke: row.c ?? PI, width: 1.8 }));
    out.push(lines(0, y + rowH / 2 - 6, row.t, { size: FT, bold: true, fill: row.c ?? PI, lh: LH }));
    if (row.sub) out.push(lines(0, y + rowH / 2 + 13 + (row.t.length - 1) * LH, row.sub, { size: FS, lh: FS + 3 }));
    for (const [lv, t] of [[0, "$000"], [512, "$200"], [1023, "$3FF"]]) out.push(text(b.x - 6, b.py(lv) + 5, t, { anchor: "end", size: FS }));
  });
  const b = box(X, 0, W, 0, 0, T, 0, 1);
  const y = H - 34;
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T + 1e-9; t += step) {
    out.push(line(b.px(t), y - 5, b.px(t), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(t), y + 22, `${+t.toFixed(1)} ms`, { anchor: t === 0 ? "start" : Math.abs(t - T) < 1e-9 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures[id] = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the link, both ways
{
  const out = [svgOpen(700, 360, "A diagram of the link between the Raspberry Pi and the Next. On the left, the Pi, which drives the bit clock and the word select into the Next, and sends its samples on one data pin. The Next's receiver latches a left and a right word. NextReg $A2 chooses and mutes them, and they go to the NextRegs $2C, $2D and $2E for a program to read and into the mixer. Above, routed to EAR, the receiver's words pass a threshold into port $FE bit 6 and the MIC line. Below, the mixer's sum goes back to the Pi on the other data pin. NextReg $A2 bit 4 decides which data pin is which.")];
  out.push(arrows("pi-fl", [GREY, PI, MIX, BEEPER]));
  const a = (d, c = PI) => out.push(pathEl(d, { stroke: c, width: 1.8, marker: c === MIX ? "pi-fl-2" : c === BEEPER ? "pi-fl-3" : c === GREY ? "pi-fl-0" : "pi-fl-1" }));
  blk(out, 0, 20, 130, 270, ["Raspberry", "Pi"], { c: PI, fill: true, bold: true, size: FH });
  const wire = (y, t, c) => { out.push(text(142, y - 7, t, { size: FS })); a(`M130,${y} L276,${y}`, c); };
  wire(122, "bit clock", GREY);
  wire(150, "word select", GREY);
  wire(178, "samples in", PI);
  blk(out, 280, 100, 140, 96, ["receiver:", "a left and", "a right word"], { c: PI });
  // --- top row: routed to EAR
  a("M350,100 L350,50 L456,50", BEEPER);
  blk(out, 460, 20, 120, 60, ["EAR rule", "if routed"], { c: BEEPER });
  a("M580,50 L606,50", BEEPER);
  blk(out, 610, 20, 90, 60, ["port $FE", "bit 6, MIC"], { c: BEEPER, size: FS });
  // --- middle row: the choice and the reads
  a("M420,148 L456,148");
  blk(out, 460, 118, 120, 60, ["NextReg $A2:", "choose, mute"], { c: PI, size: FS });
  a("M580,148 L606,148");
  blk(out, 610, 118, 90, 60, ["$2C–$2E", "reads"], { c: PI, size: FS });
  // --- bottom row: the mixer, and the way back
  a("M520,178 L520,250 L424,250");
  blk(out, 280, 220, 140, 60, ["mixer", "both sides"], { c: MIX, bold: true });
  a("M280,250 L134,250", MIX);
  out.push(text(160, 243, "the Next's mix", { size: FS, fill: MIX }));
  out.push(text(0, 322, "data pins: NextReg $A2 bit 4 decides which pin is which", { size: FS }));
  out.push(text(0, 346, "the Pi drives both clocks; the Next only listens to them", { size: FS }));
  out.push("</svg>");
  figures.link = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: I2S timing for one sample
{
  const out = [svgOpen(700, 300, "A timing diagram of one sample period on the I2S link. The bit clock ticks steadily. The word select is low for the first half of the period, the left word, and high for the second half, the right word. The data line carries each word's bits, most significant first, starting one clock after the word select changes. A mark at the word select's rise, in the middle of the period, says the left word is latched there; a mark at its fall, at the end of the period, says the right word is latched there.")];
  out.push(arrows("pi-tm", [PI]));
  const X0 = 120, W = 700 - X0 - 4, N = 32; // --- 16-bit slots: 32 clocks a sample
  const cw = W / N;
  const row = (y, t) => out.push(lines(0, y, t, { size: FT, bold: true, lh: LH }));
  row(52, ["bit clock"]);
  let d = `M${X0},60`;
  for (let i = 0; i < N; i++) d += ` L${X0 + i * cw},36 L${X0 + (i + 0.5) * cw},36 L${X0 + (i + 0.5) * cw},60 L${X0 + (i + 1) * cw},60`;
  out.push(pathEl(d, { width: 1.4 }));
  row(110, ["word select"]);
  out.push(pathEl(`M${X0},120 L${X0 + W / 2},120 L${X0 + W / 2},92 L${X0 + W},92 L${X0 + W},120`, { width: 2 }));
  out.push(text(X0 + W / 4, 112, "low: left", { anchor: "middle", size: FS }));
  out.push(text(X0 + (3 * W) / 4, 86, "high: right", { anchor: "middle", size: FS }));
  row(170, ["data"]);
  const word = (from, t) => {
    out.push(rect(X0 + (from + 1) * cw, 150, 15 * cw, 28, { rx: 3, stroke: PI, fill: PI, fillOpacity: 0.15, width: 1.5 }));
    out.push(text(X0 + (from + 8.5) * cw, 169, t, { anchor: "middle", size: FS, bold: true, fill: PI }));
  };
  word(0, "left word, MSB first");
  word(16, "right word, MSB first");
  out.push(text(X0 + 0.5 * cw, 200, "one clock late", { size: FS }));
  const latch = (x, t, anchor) => {
    out.push(line(x, 132, x, 236, { stroke: PI, width: 2, dash: "4 3" }));
    out.push(text(x + (anchor === "end" ? -8 : 8), 236, t, { anchor, size: FS, bold: true, fill: PI }));
  };
  latch(X0 + W / 2, "left word latched", "end");
  latch(X0 + W - 1, "right word latched", "end");
  out.push(text(X0, 280, "one sample period: a left word, then a right word", { size: FS }));
  out.push("</svg>");
  figures.timing = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: NextReg $A2
{
  const X0 = 90, CW = (700 - X0) / 8;
  const out = [svgOpen(700, 200, "NextReg $A2 as a strip of eight bits, bit 7 on the left. Bits 7 and 6 enable the left and right words: 00 off, 01 mono from the right word, 10 mono from the left word, 11 stereo. Bit 5 must be 0. Bit 4 sets which data pin is which. Bits 3 and 2 mute the left and the right side. Bit 1 must be 1. Bit 0 sends the Pi's audio to EAR, port $FE bit 6.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 18, String(b), { anchor: "middle", size: FS }));
  out.push(lines(0, 50, ["NextReg", "$A2"], { size: FT, bold: true, lh: LH }));
  const cells = [
    { from: 7, to: 6, t: ["enable:", "left, right"], c: PI },
    { from: 5, to: 5, t: ["0"], c: GREY },
    { from: 4, to: 4, t: ["data", "pins"], c: PI },
    { from: 3, to: 3, t: ["mute", "left"], c: PI },
    { from: 2, to: 2, t: ["mute", "right"], c: PI },
    { from: 1, to: 1, t: ["1"], c: GREY },
    { from: 0, to: 0, t: ["to", "EAR"], c: BEEPER }
  ];
  for (const c of cells) {
    const x = X0 + (7 - c.from) * CW, w = (c.from - c.to + 1) * CW;
    out.push(rect(x + 2, 30, w - 4, 56, { rx: 5, stroke: c.c, width: c.c === GREY ? 1.4 : 2, fill: c.c === GREY ? "none" : c.c, fillOpacity: c.c === GREY ? undefined : 0.16 }));
    out.push(lines(x + w / 2, 30 + (c.t.length > 1 ? 24 : 34), c.t, { anchor: "middle", size: FT, bold: c.c !== GREY, fill: c.c, lh: LH }));
  }
  out.push(lines(X0, 120, ["bits 7–6: 00 off, 01 mono from the right word, 10 mono from the left word, 11 stereo", "bit 0: the Pi's audio leaves the mixer and drives port $FE bit 6 and the MIC line instead"], { size: FS, lh: 22 }));
  out.push(text(X0, 184, "after a reset: $02, off", { size: FS }));
  out.push("</svg>");
  figures.a2 = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the four modes, captured
{
  const m = (n, t) => [
    { t: [t], sub: ["left side"], values: wordOf(capture(n), "left"), gap: 22 },
    { t: [""], sub: ["right side"], values: wordOf(capture(n), "right"), gap: 50 }
  ];
  rows("modes", "Eight captures of five milliseconds, in four pairs, the left and the right side, from $000 to $3FF. The Pi streams a 1,000 Hz sine on its left word and a 1,500 Hz sine on its right word. Stereo, NextReg $A2 = $C0: 1,000 Hz on the left, 1,500 Hz on the right. Mono from the left word, $80: 1,000 Hz on both sides. Mono from the right word, $40: 1,500 Hz on both sides. Stereo with the left side muted, $C8: the left side flat at $200, 1,500 Hz on the right.", [
    ...m("stereo", "$C0 stereo"),
    ...m("monoLeft", "$80 mono L"),
    ...m("monoRight", "$40 mono R"),
    ...m("muteLeft", "$C8 mute L")
  ], 5, 1, 50);
}

// ---------------------------------------------------------------------------------------------
// Figure: a signed sample to the Next's 10-bit word
{
  const X0 = 140, CW = (700 - X0) / 16;
  const out = [svgOpen(700, 300, "Three strips of bits. Top, a signed 16-bit sample from the Pi, bit 15, the sign, on the left. The receiver keeps the top 13 bits, bits 15 to 3. The Next uses the top 10, bits 15 to 6, and inverts the sign bit, which turns the signed number into one counted from 0: the bottom strip, a 10-bit word. Below, three examples: the most negative sample, -32,768, becomes $000; silence, 0, becomes $200; the most positive, 32,767, becomes $3FF.")];
  for (let b = 15; b >= 0; b--) out.push(text(X0 + (15 - b) * CW + CW / 2, 18, String(b), { anchor: "middle", size: FS }));
  const strip = (y, title, from, to, c, sign) => {
    out.push(lines(0, y + 20, title, { size: FT, bold: true, lh: LH }));
    for (let b = 15; b >= 0; b--) {
      const on = b <= from && b >= to;
      const x = X0 + (15 - b) * CW;
      out.push(rect(x + 1.5, y, CW - 3, 34, { rx: 3, stroke: on ? c : GREY, width: on ? 1.8 : 1, opacity: on ? 1 : 0.3, fill: on ? c : "none", fillOpacity: on ? 0.16 : undefined }));
      if (on && b === 15 && sign) out.push(text(x + CW / 2, y + 23, sign, { anchor: "middle", size: FS, bold: true, fill: c }));
    }
  };
  strip(30, ["the Pi's", "sample"], 15, 0, PI, "±");
  strip(90, ["kept"], 15, 3, PI, "±");
  strip(150, ["used", "sign inverted"], 15, 6, PI, "¬");
  out.push(lines(0, 224, ["–32,768 → $000", "0 → $200", "32,767 → $3FF"], { size: FT, lh: 22, family: "monospace" }));
  out.push(lines(330, 224, ["10-bit word = ((sample >> 6) & $3FF) xor $200", "a 16-, 24- or 32-bit slot gives the same word"], { size: FS, lh: 22 }));
  out.push("</svg>");
  figures.word = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the left word half a period before the right (captured)
{
  const d = capture("latch");
  rows("latch", "Two captures of the same ten milliseconds, from $000 to $3FF: a stream of 1,000 samples a second whose samples alternate between two levels, the same on both sides. Both sides are square waves with a step every millisecond, but the left side steps half a millisecond before the right.", [
    { t: ["left side"], sub: ["latched at", "mid-period"], values: wordOf(d, "left") },
    { t: ["right side"], sub: ["latched at", "the end"], values: wordOf(d, "right") }
  ], 10, 2, 70);
}

// ---------------------------------------------------------------------------------------------
// Figure: the EAR rule on a noisy slow wave (captured)
{
  const d = capture("ear");
  const u = d.left.map((w) => w / d.gain);
  // --- the EAR bit from the captured MIC line: one level change per edge (an edge inside a sample spreads
  //     over two samples)
  const edges = [];
  u.forEach((y, i) => { if (i > 1 && Math.abs(y - u[i - 2]) > 100 && (edges.length === 0 || i - edges[edges.length - 1] > 3)) edges.push(i - 1); });
  const firstUp = u[edges[0] + 2] > u[edges[0] - 2];
  let bit = !firstUp;
  const bits = u.map((_, i) => { if (edges.includes(i)) bit = !bit; return bit ? 1 : 0; });
  const plain = d.input.map((s) => (s >= 0 ? 1 : 0));
  numbers.push(`ear: ${edges.length} captured edges, ${plain.filter((e, i) => i > 0 && e !== plain[i - 1]).length} for a plain threshold`);
  const T = 12;
  const n = Math.round(T / DT);
  const X = 140, W = 700 - X - 4;
  const out = [svgOpen(700, 400, "Three rows over 12 milliseconds. Top, the Pi's stream: a slow 250 Hz sine with noise on it, from -32,768 to 32,767, with a dashed line at -16,384, where both words' top two bits read 00, and a line at 0, where a rising wave first makes them read 11 together. Middle, the EAR bit captured from the machine: a clean square wave that rises as the wave crosses 0 upwards and falls once it has dropped below -16,384, two edges a cycle. Bottom, for comparison, what a plain threshold at 0 would give on the same wave: a square wave that chatters, switching many times at every crossing.")];
  const bw = box(X, 12, W, 150, 0, T, -32768, 32767);
  out.push(line(bw.x, bw.py(0), bw.x + bw.w, bw.py(0), { opacity: 0.5 }));
  out.push(line(bw.x, bw.py(-16384), bw.x + bw.w, bw.py(-16384), { stroke: BEEPER, dash: "5 4", width: 1.6 }));
  out.push(pathEl(poly(bw, d.input.slice(0, n).map((v, i) => [i * DT, v])), { stroke: PI, width: 1.4 }));
  out.push(lines(0, 70, ["the Pi's", "stream"], { size: FT, bold: true, fill: PI, lh: LH }));
  out.push(lines(0, 110, ["noisy 250 Hz"], { size: FS }));
  out.push(text(bw.x - 6, bw.py(0) + 5, "0", { anchor: "end", size: FS }));
  out.push(text(bw.x - 6, bw.py(-16384) + 5, "–16,384", { anchor: "end", size: FS, fill: BEEPER }));
  const bitRow = (y, vals, t, sub, c) => {
    const b = box(X, y, W, 50, 0, T, 0, 1);
    out.push(pathEl(sampleStairs(b, vals.slice(0, n), 0, DT), { stroke: c, width: 2 }));
    out.push(lines(0, y + 20, t, { size: FT, bold: true, fill: c, lh: LH }));
    out.push(lines(0, y + 40 + (t.length - 1) * LH, sub, { size: FS }));
    out.push(text(b.x - 6, b.py(1) + 5, "1", { anchor: "end", size: FS }));
    out.push(text(b.x - 6, b.py(0) + 5, "0", { anchor: "end", size: FS }));
  };
  bitRow(190, bits, ["EAR bit"], ["captured"], BEEPER);
  bitRow(276, plain, ["a plain"], ["threshold at 0"], GREY);
  const y = 366;
  const b = box(X, 0, W, 0, 0, T, 0, 1);
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T; t += 2) {
    out.push(line(b.px(t), y - 5, b.px(t), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(t), y + 22, `${t} ms`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.ear = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: reading a sample in two reads
{
  const out = [svgOpen(700, 276, "A diagram of reading the Pi's left word. The 10-bit word is drawn as ten cells. A read of NextReg $2C returns its top eight bits, and at the same moment the bottom two bits are copied into a latch. A later read of NextReg $2D returns the latched two bits in its bits 7 and 6. NextReg $2E does the same for the right word.")];
  out.push(arrows("pi-rd", [PI]));
  const a = (d) => out.push(pathEl(d, { stroke: PI, width: 1.8, marker: "pi-rd-0" }));
  const X0 = 140, CW = 50;
  out.push(lines(0, 46, ["the left", "word"], { size: FT, bold: true, fill: PI, lh: LH }));
  for (let i = 0; i < 10; i++) {
    const hi = i < 8;
    out.push(rect(X0 + i * CW + 2, 22, CW - 4, 40, { rx: 4, stroke: PI, width: 1.8, fill: PI, fillOpacity: hi ? 0.2 : 0.08 }));
    out.push(text(X0 + i * CW + CW / 2, 48, String(9 - i), { anchor: "middle", size: FS }));
  }
  blk(out, X0, 120, 8 * CW - 4, 50, ["a read of NextReg $2C: bits 9–2"], { c: PI, bold: true });
  blk(out, X0 + 8 * CW + 12, 120, 2 * CW + 6, 50, ["latch", "bits 1–0"], { c: PI, size: FS });
  a(`M${X0 + 4 * CW},62 L${X0 + 4 * CW},116`);
  a(`M${X0 + 9 * CW},62 L${X0 + 9 * CW},116`);
  blk(out, X0 + 8 * CW + 12, 220, 2 * CW + 6, 50, ["$2D", "bits 7–6"], { c: PI, bold: true, size: FS });
  a(`M${X0 + 9 * CW + 9},170 L${X0 + 9 * CW + 9},216`);
  out.push(lines(X0, 236, ["then a read of NextReg $2D", "returns the low two bits"], { size: FS, lh: FS + 5 }));
  out.push("</svg>");
  figures.read = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the Pi's share of the mixer's range
{
  const W = 700, FULL = 8191;
  const px = (v) => (v / FULL) * (W - 2);
  const out = [svgOpen(700, 170, "A bar drawn to scale on the mixer's range of 0 to 8,191 for one side. The Pi's word takes 0 to 1,023 units, an eighth of the range. At rest, the word $200, it adds 512, the middle of its range.")];
  out.push(text(0, 22, "the Pi's word on one side: 0–1,023 units, one unit a step", { size: FT }));
  out.push(rect(px(0), 32, px(FULL), 30, { opacity: 0.3 }));
  out.push(rect(0, 32, px(1023), 30, { fill: PI, fillOpacity: 0.7, stroke: PI, width: 1 }));
  out.push(line(px(512), 32, px(512), 90, { stroke: PI, width: 2, dash: "5 4" }));
  out.push(text(px(512) + 8, 88, "at rest: $200, 512 units", { size: FS, fill: PI }));
  out.push(line(0, 122, W, 122, { opacity: 0.5 }));
  for (const v of [0, 512, 1023, 2040, 4095, 8191]) {
    out.push(line(px(v), 117, px(v), 127, { opacity: 0.5 }));
    out.push(text(px(v), 148, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.budget = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
