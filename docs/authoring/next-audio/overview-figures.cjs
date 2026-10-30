#!/usr/bin/env node
// Figures of "The Big Picture: Four Sources, One Mixer" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/overview.mdx).
//
// The diagrams are drawn from the facts below; the waveforms come from the machine: the captures that
// test/zxnext-hw/audio/next-audio-scene.test.ts writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// Then run this script, which rewrites the SVG between the page's {/* fig:<name> */} markers:
//   node docs/authoring/next-audio/overview-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units, about 10 pt when the figure spans a 16 cm text column.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PSG, DAC, PI, MIX, box, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/overview.mdx");
const CAPTURES = path.join(__dirname, "captures/overview");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(CAPTURES, `${name}.json`), "utf8"));
const GREY = "currentColor";
const fmt = (v) => Math.round(v).toLocaleString("en-US");

// --- Print sizes: titles, labels, small notes (viewBox units of a 700-wide figure)
const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18; // line height for FT
const LS = 17; // line height for FS

// Klive's mixer scales the hardware's sum by a gain to 16-bit words (zxnext-audio-mixer.c,
// ZXNEXT_MIXER_GAIN; each capture records it), so word / gain is back in the hardware's mixer units.
const units = (d) => d.left.map((w) => w / d.gain);

// The hardware's mixer, per side: these inputs, in these units (the audio mixer of the FPGA design).
const LEVELS = { ear: 512, mic: 128, ay: 2295, dac: 2040, pi: 1023 };
const FULL = 8191;

const figures = {};
const numbers = [];

/** First rising crossing of the midpoint after `from` */
function risingEdge(values, from = 0) {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  for (let i = Math.max(1, from); i < values.length; i++) if (values[i - 1] < mid && values[i] >= mid) return i;
  return from;
}

/** A box with a bold title and lines of small text under it, left-aligned (or centred with `o.center`). */
function card(out, x, y, w, h, title, sub = [], o = {}) {
  const c = o.c ?? GREY;
  out.push(rect(x, y, w, h, { rx: 6, stroke: c, width: o.c ? 2 : 1.5, dash: o.dash }));
  const total = LH + sub.length * LS;
  const ty = y + (h - total) / 2 + FT * 0.85;
  const tx = o.center ? x + w / 2 : x + 12;
  const anchor = o.center ? "middle" : undefined;
  out.push(text(tx, ty, title, { anchor, size: FT, bold: true, fill: o.tc ?? c }));
  if (sub.length) out.push(lines(tx, ty + LS + 1, sub, { anchor, size: FS, lh: LS }));
}

// ---------------------------------------------------------------------------------------------
// Figure: the 48K's one bit beside the Next's sources
{
  const H = 390;
  const out = [svgOpen(700, H, "Two diagrams side by side. Left, the ZX Spectrum 48K: port $FE bits 4 and 3 drive one speaker, and nothing else makes sound. Right, the ZX Spectrum Next: the same port $FE bits, three AY sound chips, four 8-bit DACs and the Raspberry Pi's audio link all feed one mixer, which has a left and a right side and goes on to the outputs.")];
  out.push(arrows("ov-from", [GREY, BEEPER, PSG, DAC, PI, MIX]));
  // --- the 48K
  out.push(text(0, 22, "ZX Spectrum 48K", { size: FH, bold: true }));
  card(out, 0, 124, 170, 66, "port $FE", ["bits 4 and 3"], { c: BEEPER, center: true });
  out.push(line(85, 190, 85, 236, { stroke: BEEPER, width: 1.8, marker: "ov-from-1" }));
  // a speaker drawn upright: the magnet box and the cone, opening downwards
  out.push(`  <path d="M73,242 L97,242 L97,256 L115,276 L55,276 L73,256 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />`);
  out.push(text(85, 302, "speaker", { anchor: "middle", size: FT }));
  out.push(line(200, 8, 200, H - 8, { opacity: 0.3, dash: "4 4" }));
  // --- the Next
  out.push(text(228, 22, "ZX Spectrum Next", { size: FH, bold: true }));
  const src = [
    ["beeper: port $FE bits 4, 3", BEEPER, undefined, 1],
    ["AY chip 0", PSG, undefined, 2],
    ["AY chip 1", PSG, "6 3", 2],
    ["AY chip 2", PSG, "2 3", 2],
    ["four 8-bit DACs", DAC, undefined, 3],
    ["Raspberry Pi audio", PI, undefined, 4]
  ];
  const Y0 = 44, RH = 38, STEP = 50;
  const mixX = 548, mixY = Y0, mixH = (src.length - 1) * STEP + RH;
  src.forEach(([label, c, dash, m], i) => {
    const y = Y0 + i * STEP;
    out.push(rect(228, y, 262, RH, { rx: 5, stroke: c, width: 2, dash }));
    out.push(text(359, y + RH / 2 + 5, label, { anchor: "middle", size: FT, fill: c, bold: true }));
    out.push(line(490, y + RH / 2, mixX - 4, y + RH / 2, { stroke: c, width: 1.8, marker: `ov-from-${m}` }));
  });
  out.push(rect(mixX, mixY, 700 - mixX - 1, mixH, { rx: 8, stroke: MIX, width: 2.5 }));
  const mc = (mixX + 700) / 2, mm = mixY + mixH / 2;
  out.push(text(mc, mm - 34, "mixer", { anchor: "middle", size: FH, bold: true, fill: MIX }));
  out.push(text(mc, mm - 2, "left side", { anchor: "middle", size: FT, fill: MIX }));
  out.push(line(mixX + 14, mm + 10, 700 - 15, mm + 10, { stroke: MIX, opacity: 0.5 }));
  out.push(text(mc, mm + 34, "right side", { anchor: "middle", size: FT, fill: MIX }));
  out.push(line(mc, mixY + mixH, mc, mixY + mixH + 32, { stroke: MIX, width: 1.8, marker: "ov-from-5" }));
  out.push(text(mc, mixY + mixH + 54, "to the outputs", { anchor: "middle", size: FT }));
  out.push("</svg>");
  figures.from = out;
}

// ---------------------------------------------------------------------------------------------
// Figure (hero): the whole audio system
{
  const out = [svgOpen(700, 456, "The Next's whole audio system as a flow from left to right. Sources: the MIC bit, port $FE bit 3, combined with the tape input and the Pi's EAR bit; the beeper, port $FE bit 4 (EAR); three AY chips behind ports $FFFD and $BFFD; four 8-bit DACs written through about a dozen ports and NextRegs $2C to $2E; and the Raspberry Pi's audio, received over I2S and controlled by NextReg $A2. Every source feeds both sides of one mixer, a left sum and a right sum. The sums go to four outputs: the audio jack, the internal speaker, HDMI audio and back to the Pi. The MIC line also goes straight to the MIC socket, for saving to tape.")];
  out.push(arrows("ov-hero", [GREY, BEEPER, PSG, DAC, PI, MIX]));
  const SX = 0, SW = 240, mixX = 300, mixW = 140, OX = 500, OW = 200;
  out.push(text(SX + SW / 2, 20, "sources", { anchor: "middle", size: FH, bold: true }));
  out.push(text(mixX + mixW / 2, 20, "mixer", { anchor: "middle", size: FH, bold: true, fill: MIX }));
  out.push(text(OX + OW / 2, 20, "outputs", { anchor: "middle", size: FH, bold: true }));
  const rows = [
    { h: 72, c: BEEPER, m: 1, title: "MIC and the tape", sub: ["port $FE bit 3, the tape", "input, the Pi's EAR bit"], mic: true },
    { h: 54, c: BEEPER, m: 1, title: "beeper (EAR)", sub: ["port $FE bit 4"] },
    { h: 72, c: PSG, m: 2, title: "three AY chips", sub: ["ports $FFFD, $BFFD", "NextRegs $06, $08, $09"], chips: true },
    { h: 72, c: DAC, m: 3, title: "four 8-bit DACs", sub: ["ports $0F … $FB, $DF", "NextRegs $08, $2C–$2E"] },
    { h: 72, c: PI, m: 4, title: "Raspberry Pi audio", sub: ["I2S link", "NextReg $A2"] }
  ];
  const Y0 = 64, GAP = 12;
  let y = Y0;
  let micMid = 0;
  for (const row of rows) {
    card(out, SX, y, SW, row.h, row.title, row.sub, { c: row.c });
    if (row.chips) {
      ["0", "1", "2"].forEach((n, k) => {
        const dash = [undefined, "6 3", "2 3"][k];
        out.push(rect(SX + 158 + k * 27, y + 10, 22, 22, { rx: 3, stroke: PSG, width: 1.8, dash }));
        out.push(text(SX + 169 + k * 27, y + 26, n, { anchor: "middle", size: FS, fill: PSG, bold: true }));
      });
    }
    if (row.mic) micMid = SX + 200;
    const yc = y + row.h / 2;
    out.push(line(SX + SW, yc, mixX - 4, yc, { stroke: row.c, width: 2, marker: `ov-hero-${row.m}` }));
    y += row.h + GAP;
  }
  const mixY = Y0, mixH = y - GAP - Y0;
  out.push(rect(mixX, mixY, mixW, mixH, { rx: 10, stroke: MIX, width: 2.5 }));
  out.push(lines(mixX + mixW / 2, mixY + 30, ["adds every", "source, per side"], { anchor: "middle", size: FS, fill: MIX, lh: LS }));
  const sum = (sy, t) => {
    out.push(rect(mixX + 14, sy, mixW - 28, 84, { rx: 6, stroke: MIX }));
    out.push(text(mixX + mixW / 2, sy + 37, t, { anchor: "middle", size: FT, bold: true, fill: MIX }));
    out.push(text(mixX + mixW / 2, sy + 59, "0–8191", { anchor: "middle", size: FS }));
  };
  sum(mixY + 86, "left sum");
  sum(mixY + 200, "right sum");
  // --- outputs: the MIC socket at the top, fed over the mixer; the mixer's four outputs under it
  card(out, OX, Y0, OW, 54, "MIC socket", ["saving to tape"], { c: BEEPER });
  out.push(pathEl(`M${micMid},${Y0} L${micMid},40 L${OX + OW / 2},40 L${OX + OW / 2},${Y0 - 4}`, { stroke: BEEPER, width: 1.8, dash: "6 4", marker: "ov-hero-1" }));
  const outs = [
    { t: "audio jack", s: "left and right" },
    { t: "internal speaker", s: "left + right, mono" },
    { t: "HDMI audio", s: "48,000 samples a second" },
    { t: "to the Pi", s: "over the I2S link" }
  ];
  outs.forEach((o, i) => {
    const oy = 150 + i * 72;
    card(out, OX, oy, OW, 58, o.t, [o.s]);
    out.push(line(mixX + mixW, oy + 29, OX - 4, oy + 29, { stroke: MIX, width: 1.8, marker: "ov-hero-5" }));
  });
  out.push("</svg>");
  figures.hero = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: a generator and a level writer, captured
{
  const psg = capture("psg"), dac = capture("dac");
  const rate = psg.rate, dt = 1000 / rate; // ms per sample
  const T = 4; // ms shown
  const n = Math.round(T / dt);
  const H = 384;
  const out = [svgOpen(700, H, "Two captures from the machine over the same four milliseconds. Top: an AY chip's tone at 1,003 Hz, a square wave that goes on by itself; the CPU wrote four registers to start it, before this stretch, and writes nothing while it plays. Bottom: a sine wave at 1,003 Hz played through a DAC; it is a staircase of 16 steps per cycle, and every step is one write by the CPU, marked under the wave: about 64 writes in the four milliseconds.")];
  const X = 104, W = 700 - X;
  const rows = [
    { name: ["an AY", "tone"], data: psg, c: PSG, y: 14 },
    { name: ["a DAC", "sine"], data: dac, c: DAC, y: 190 }
  ];
  for (const row of rows) {
    const v = units(row.data);
    const start = risingEdge(v, 50);
    const w = v.slice(start, start + n);
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const b = box(X, row.y, W, 100, 0, T, -560, 560);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: row.c, width: 2 }));
    out.push(lines(0, row.y + 44, row.name, { size: FT, bold: true, fill: row.c, lh: LH }));
    // CPU writes
    const markY = row.y + 130;
    out.push(lines(0, markY - 3, ["CPU", "writes"], { size: FS, lh: LS }));
    if (row.data === psg) {
      out.push(lines(b.x, markY - 3, ["none: four registers were written before this stretch,", "and the chip plays on by itself"], { size: FS, fill: PSG, lh: LS }));
    } else {
      out.push(line(b.x, markY, b.x + b.w, markY, { opacity: 0.25 }));
      let count = 0;
      for (let i = 1; i < w.length; i++) {
        if (w[i] !== w[i - 1]) {
          out.push(line(b.px(i * dt), markY - 8, b.px(i * dt), markY + 8, { stroke: DAC, width: 1.5 }));
          count++;
        }
      }
      numbers.push(`generator fig: ${count} DAC writes seen in ${T} ms (expected ${((T / 1000) * dac.cpuHz / dac.writePeriodTacts).toFixed(1)})`);
    }
  }
  const b = box(X, 0, W, 0, 0, T, 0, 1);
  const ay = H - 40;
  out.push(line(b.x, ay, b.x + b.w, ay, { opacity: 0.5 }));
  for (let ms = 0; ms <= T; ms++) {
    out.push(line(b.px(ms), ay - 5, b.px(ms), ay + 5, { opacity: 0.5 }));
    out.push(text(b.px(ms), ay + 24, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.generator = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: one capture of each source, on one level scale
{
  const T = 5; // ms
  const list = [
    { name: "beeper", title: "the beeper (EAR)", c: BEEPER, note: "994 Hz square wave, 512 units" },
    { name: "psg", title: "one AY channel", c: PSG, note: "1,003 Hz square wave, 255 units" },
    { name: "dac", title: "one DAC port (Specdrum)", c: DAC, note: "1,003 Hz sine in 16 steps, 1,016 units" },
    { name: "pi", title: "Raspberry Pi audio", c: PI, note: "1,000 Hz sine, 1,000 units" }
  ];
  const H = 420;
  const out = [svgOpen(700, H, "Four captures from the machine, five milliseconds each, all drawn on the same level scale in the mixer's units. The beeper: a square wave of 994 Hz whose step is 512 units. One AY channel: a square wave of 1,003 Hz, 255 units. A DAC fed a sine through the Specdrum port: a staircase of 16 steps per cycle at 1,003 Hz, 1,016 units from bottom to top. The Raspberry Pi's audio: a smooth 1,000 Hz sine of 1,000 units.")];
  const CW = 330, CG = 700 - 2 * CW, AX = 46;
  list.forEach((s, i) => {
    const d = capture(s.name);
    const dt = 1000 / d.rate;
    const v = units(d);
    const start = risingEdge(v, 50);
    const w = v.slice(start, start + Math.round(T / dt));
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const col = i % 2, rowI = Math.floor(i / 2);
    const x = col * (CW + CG), y = 20 + rowI * 190;
    const b = box(x + AX, y + 14, CW - AX, 120, 0, T, -560, 560);
    out.push(text(x, y, s.title, { size: FT, bold: true, fill: s.c }));
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(line(b.x, b.y, b.x, b.y + b.h, { opacity: 0.4 }));
    for (const lv of [-500, 500]) {
      out.push(line(b.x - 4, b.py(lv), b.x, b.py(lv), { opacity: 0.4 }));
      out.push(text(b.x - 6, b.py(lv) + 5, lv > 0 ? "+500" : "−500", { anchor: "end", size: FS }));
    }
    out.push(pathEl(sampleStairs(b, w.map((q) => q - mean), 0, dt), { stroke: s.c, width: 2 }));
    out.push(text(x, y + 158, s.note, { size: FS }));
    const sw = Math.max(...w) - Math.min(...w);
    numbers.push(`cast fig: ${s.name} swing ${sw.toFixed(0)} units (${d.hz} Hz)`);
  });
  out.push(text(0, H - 12, "5 ms each; the level scale is the same in all four, in the mixer's units", { size: FS }));
  out.push("</svg>");
  figures.cast = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the mixer's range, each source's largest share drawn to scale
{
  const H = 282;
  const out = [svgOpen(700, H, "Two bars drawn to scale on the mixer's range of 0 to 8,191 per side. The first bar stacks every source's largest contribution: the beeper's EAR 512, MIC 128, the three AY chips 2,295, the four DACs' side 2,040 and the Pi 1,023, together 5,998, leaving 2,193 unused at the top. The second bar shows silence: with every source quiet, the DACs still add 1,024 at their rest level and the Pi 512, so silence is 1,536, not zero.")];
  const X0 = 0, W = 699;
  const px = (v) => X0 + (v / FULL) * W;
  const parts = [
    ["EAR", LEVELS.ear, BEEPER],
    ["MIC", LEVELS.mic, BEEPER],
    ["three AY chips", LEVELS.ay, PSG],
    ["DACs", LEVELS.dac, DAC],
    ["Pi", LEVELS.pi, PI]
  ];
  const BH = 38;
  const drawBar = (y, segs, title) => {
    out.push(text(X0, y - 12, title, { size: FT, bold: true }));
    let at = 0;
    for (const [label, v, c] of segs) {
      out.push(rect(px(at), y, px(at + v) - px(at), BH, { fill: c, fillOpacity: label === "MIC" ? 0.45 : 0.8, stroke: c, width: 1 }));
      const mid = (px(at) + px(at + v)) / 2;
      if (px(at + v) - px(at) > 38) out.push(text(mid, y + BH / 2 + 5, label, { anchor: "middle", size: FS, fill: "#ffffff", bold: true }));
      at += v;
    }
    out.push(rect(X0, y, W, BH, { opacity: 0.6 }));
    return at;
  };
  const y1 = 36;
  const total = drawBar(y1, parts, "every source at its largest");
  out.push(line(px(total), y1 - 6, px(total), y1 + BH + 8, { stroke: MIX, width: 2.5 }));
  out.push(text(px(total), y1 + BH + 28, fmt(total), { anchor: "middle", size: FT, fill: MIX, bold: true }));
  out.push(text((px(total) + px(FULL)) / 2, y1 + BH / 2 + 5, `unused: ${fmt(FULL - total)}`, { anchor: "middle", size: FS }));
  out.push(text(px(LEVELS.ear + LEVELS.mic / 2), y1 + BH + 28, "MIC", { anchor: "middle", size: FS, fill: BEEPER, bold: true }));
  numbers.push(`budget fig: sum ${total}, unused ${FULL - total}`);
  const y2 = 160;
  const silence = drawBar(y2, [["DACs", 1024, DAC], ["Pi", 512, PI]], "silence: the DACs and the Pi at rest");
  out.push(line(px(silence), y2 - 6, px(silence), y2 + BH + 8, { stroke: MIX, width: 2.5 }));
  out.push(text(px(silence), y2 + BH + 28, fmt(silence), { anchor: "middle", size: FT, fill: MIX, bold: true }));
  const ay = H - 34;
  for (const v of [0, 2048, 4096, 6144, 8191]) {
    out.push(line(px(v), ay - 5, px(v), ay + 5, { opacity: 0.5 }));
    out.push(text(px(v), ay + 24, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS }));
  }
  out.push(line(X0, ay, X0 + W, ay, { opacity: 0.5 }));
  numbers.push(`budget fig: silence ${silence}`);
  out.push("</svg>");
  figures.budget = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the clocks
{
  const out = [svgOpen(700, 352, "The clocks behind the sound. The 28 MHz master clock feeds two separate branches. One divides it by 16 into the 1.75 MHz clock of the AY chips; inside each chip it is divided by 8 again, so the chip's counters step 218,750 times a second, and a tone's pitch is that rate divided by twice its period. The other branch is the CPU clock of 3.5, 7, 14 or 28 MHz, which times the program's loops, and with them the beeper's and the DACs' sound. Separately, HDMI audio is sent as 48,000 samples a second.")];
  out.push(arrows("ov-clk", [GREY, PSG]));
  const node = (x, y, w, h, t, s, c) => card(out, x, y, w, h, t, s, { c, center: true });
  const a = (d, c) => out.push(pathEl(d, { stroke: c ?? GREY, width: 1.8, marker: c === PSG ? "ov-clk-1" : "ov-clk-0" }));
  // --- the master clock, between the two branches
  node(0, 110, 110, 62, "28 MHz", ["master clock"]);
  // --- the AY chips' branch, on top
  const PY = 14, PH = 72, pc = PY + PH / 2;
  node(170, PY, 130, PH, "1.75 MHz", ["AY chips' clock"], PSG);
  node(345, PY, 150, PH, "218,750 Hz", ["the chip's counters"], PSG);
  node(540, PY, 160, PH, "a tone", ["218,750 ÷", "(2 × period)"], PSG);
  a(`M110,141 L130,141 L130,${pc} L166,${pc}`, PSG);
  out.push(text(137, pc - 8, "÷ 16", { size: FS, fill: PSG, bold: true }));
  a(`M300,${pc} L341,${pc}`, PSG);
  out.push(text(320, pc - 8, "÷ 8", { anchor: "middle", size: FS, fill: PSG, bold: true }));
  a(`M495,${pc} L536,${pc}`, PSG);
  // --- the CPU's branch, under it
  const CY = 196, CH = 72, cc = CY + CH / 2;
  node(170, CY, 170, CH, "the CPU", ["3.5, 7, 14 or 28 MHz"]);
  node(385, CY, 315, CH, "the program's loops", ["time the beeper's edges", "and the DACs' samples"]);
  a(`M110,141 L130,141 L130,${cc} L166,${cc}`);
  a(`M340,${cc} L381,${cc}`);
  // --- HDMI, apart from both
  card(out, 170, 286, 530, 60, "HDMI audio: 48,000 samples a second", ["how the finished sum is sent, not how it is made"], { center: true, dash: "5 4" });
  out.push("</svg>");
  figures.clocks = out;
  numbers.push(`clocks: 28e6/16 = ${28e6 / 16}; /8 = ${28e6 / 128}; A4 440 Hz period ${(28e6 / 128 / 2 / 440).toFixed(1)}`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the control registers, bit by bit
{
  const regs = [
    { name: "$06", bits: [["hotkeys"], [BEEPER, "beep only", "speaker"], ["hotkey"], ["NMI"], ["NMI"], ["PS/2"], [PSG, "chip", "mode", 2]] },
    { name: "$08", bits: [["7FFD"], ["contend"], [PSG, "ACB"], [MIX, "speaker", "on"], [DAC, "DACs", "on"], ["port FF"], [PSG, "Turbo-", "Sound"], [BEEPER, "issue 2"]] },
    { name: "$09", bits: [[PSG, "AY 2", "mono"], [PSG, "AY 1", "mono"], [PSG, "AY 0", "mono"], ["sprites"], ["divmmc"], [MIX, "HDMI", "silent"], ["scanlines", "", "", 2]] },
    { name: "$84", bits: [[DAC, "$DF"], [DAC, "$B3"], [DAC, "$FB"], [DAC, "Covox"], [DAC, "Profi"], [DAC, "SD 2"], [DAC, "SD 1"], [PSG, "AY", "ports"]] },
    { name: "$A2", bits: [[PI, "Pi on", "", 2], ["(0)"], [PI, "pins"], [PI, "mute L"], [PI, "mute R"], ["(1)"], [BEEPER, "Pi to", "EAR"]] }
  ];
  const X0 = 76, CW = (700 - X0) / 8, RH = 50, STEP = 62;
  const out = [svgOpen(700, 34 + regs.length * STEP, "Five registers as strips of eight bits, bit 7 on the left, each audio bit coloured by the source it controls and the others grey. NextReg $06: bit 6 sends the beeper only to the internal speaker; bits 1 and 0 are the AY chips' mode. NextReg $08: bit 5 ABC or ACB stereo, bit 4 the internal speaker, bit 3 the DACs, bit 1 TurboSound, bit 0 the issue 2 keyboard. NextReg $09: bits 7 to 5 put each AY chip in mono, bit 2 silences HDMI audio. NextReg $84: bit 0 the AY ports, bits 1 to 7 the seven families of DAC ports. NextReg $A2: bits 7 and 6 switch the Pi's audio on, bit 4 sets the direction of its data pins, bits 3 and 2 mute each side, bit 0 sends it to the tape input.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 18, String(b), { anchor: "middle", size: FS }));
  regs.forEach((reg, ri) => {
    const y = 28 + ri * STEP;
    out.push(lines(0, y + 21, ["NextReg", reg.name], { size: FT, bold: true, lh: LH }));
    let at = 0;
    for (const cell of reg.bits) {
      const coloured = cell[0].startsWith("#");
      const c = coloured ? cell[0] : GREY;
      const labelsAll = coloured ? cell.slice(1) : cell;
      const span = typeof labelsAll[labelsAll.length - 1] === "number" ? labelsAll[labelsAll.length - 1] : 1;
      const labels = labelsAll.filter((l) => typeof l === "string" && l);
      const x = X0 + at * CW;
      out.push(rect(x + 1.5, y, span * CW - 3, RH, { rx: 3, stroke: c, width: coloured ? 2 : 1, opacity: coloured ? 1 : 0.35, fill: coloured ? c : "none", fillOpacity: coloured ? 0.12 : undefined }));
      labels.forEach((l, k) =>
        out.push(text(x + (span * CW) / 2, y + (labels.length === 1 ? RH / 2 + 5 : RH / 2 - 4 + k * LS), l, { anchor: "middle", size: FS, bold: coloured, fill: c }))
      );
      at += span;
    }
  });
  out.push("</svg>");
  figures.registers = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: from the sum to the outputs
{
  const BH = 72, GAP = 14;
  const ways = [
    { t: "audio jack", s: ["one-bit converter per side at 28 MHz,", "then a resistor-capacitor filter"] },
    { t: "internal speaker", s: ["left + right, one one-bit converter;", "on: NextReg $08 bit 4; beeper only: $06 bit 6"] },
    { t: "HDMI audio", s: ["48,000 samples a second, 16-bit words;", "silenced by NextReg $09 bit 2"] },
    { t: "to the Raspberry Pi", s: ["over the I2S link"] }
  ];
  const H = ways.length * BH + (ways.length - 1) * GAP + 4;
  const out = [svgOpen(700, H, "The mixed sum, a 13-bit number per side, goes four ways. To the audio jack: a one-bit converter per side, running at 28 MHz, followed by a resistor and capacitor filter on the board. To the internal speaker: the left and right sums added into one, through one more one-bit converter; NextReg $08 bit 4 switches the speaker on, and with NextReg $06 bit 6 it plays only the beeper. To HDMI: 48,000 samples a second, each a 16-bit word, silenced by NextReg $09 bit 2. And to the Raspberry Pi over the I2S link.")];
  out.push(arrows("ov-out", [MIX]));
  const sy = (H - 110) / 2;
  card(out, 0, sy, 160, 110, "the sum", ["13 bits per side,", "left and right"], { c: MIX, center: true });
  const BX = 250, TRUNK = 200, sc = sy + 55;
  out.push(line(160, sc, TRUNK, sc, { stroke: MIX, width: 1.8 }));
  ways.forEach((w, i) => {
    const y = 2 + i * (BH + GAP);
    card(out, BX, y, 700 - BX - 1, BH, w.t, w.s);
    out.push(pathEl(`M${TRUNK},${sc} L${TRUNK},${y + BH / 2} L${BX - 4},${y + BH / 2}`, { stroke: MIX, width: 1.8, marker: "ov-out-0" }));
  });
  out.push("</svg>");
  figures.outputs = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
