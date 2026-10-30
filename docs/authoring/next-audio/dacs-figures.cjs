#!/usr/bin/env node
// Figures of "The 8-Bit DACs: Four Channels, Six Sound Cards" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/dacs.mdx).
//
// The waveforms come from the machine: the captures that test/zxnext-hw/audio/next-audio-scene.test.ts
// writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The diagrams, the port map and the level budget are drawn from the rules. Then:
//   node docs/authoring/next-audio/dacs-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { DAC, MIX, box, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/dacs.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/dacs", `${name}.json`), "utf8"));
/** Klive's mix centres a DAC on $80 and adds it x 4: one channel's byte back from a side's word */
const byteOf = (d, which = "left") => d[which].map((w) => 128 + w / d.gain / 4);
const GREY = "currentColor";
const DT = 1000 / 48000;
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const hex = (v) => "$" + v.toString(16).toUpperCase().padStart(2, "0");

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

/** Captured rows of one channel's byte, 0 to 255: a label column of 130 units, the plot to the right edge */
function rows(id, label, list, T, step, rowH = 80, marks = false) {
  const X = 140, W = 700 - X - 4;
  const GAP = marks ? 24 : 34; // --- room between a row's $00 and the next row's $FF
  const H = 12 + list.length * (rowH + GAP) + 40;
  const out = [svgOpen(700, H, label)];
  list.forEach((row, i) => {
    const y = 12 + i * (rowH + GAP);
    const b = box(X, y, W, rowH, 0, T, 0, 255);
    out.push(line(b.x, b.py(128), b.x + b.w, b.py(128), { opacity: 0.3, dash: "3 4" }));
    const v = row.values.slice(0, Math.round(T / DT));
    if (marks) {
      // --- a tick under the plot at every sample where the level changed: the writes, to 1/48 ms
      //     (a write inside a sample gives that sample an in-between level: one tick per write, not two)
      let lastTick = -10;
      v.forEach((x, k) => {
        if (k > 0 && Math.round(x) !== Math.round(v[k - 1]) && k - lastTick > 3) {
          out.push(line(b.px(k * DT), y + rowH + 2, b.px(k * DT), y + rowH + 10, { stroke: DAC, width: 2 }));
          lastTick = k;
        }
      });
    }
    out.push(pathEl(sampleStairs(b, v, 0, DT), { stroke: row.c ?? DAC, width: 1.8 }));
    out.push(lines(0, y + rowH / 2 - 6, row.t, { size: FT, bold: true, fill: row.c ?? DAC, lh: LH }));
    if (row.sub) out.push(lines(0, y + rowH / 2 + 13 + (row.t.length - 1) * LH, row.sub, { size: FS, lh: FS + 3 }));
    for (const lv of [0, 128, 255]) out.push(text(b.x - 6, b.py(lv) + 5, hex(lv), { anchor: "end", size: FS }));
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
// Figure: write, hold, write (the staircase)
{
  const d = capture("stair");
  numbers.push(`stair: ${d.stepTacts} T-states a step = ${(d.stepTacts / d.cpuHz * 1000).toFixed(3)} ms`);
  rows("stair", "Ten milliseconds of one DAC channel's level, from $00 to $FF, with a dashed line at the rest level $80. The level is a staircase: it jumps to each value the program writes, $80, $C0, $FF, $C0, $80, $40, $00, $40 and round again, and stays flat for a millisecond until the next write. Small ticks under the plot mark the moments the level changed.", [
    { t: ["port $DF"], sub: ["one write", "a millisecond"], values: byteOf(d) }
  ], 10, 2, 170, true);
}

// ---------------------------------------------------------------------------------------------
// Figure: four channels, two sides
{
  const out = [svgOpen(700, 310, "A diagram. Four DAC channel boxes, A, B, C and D, each holding 8 bits, $00 to $FF, $80 at rest. A and B add into the left side, 0 to 510, C and D into the right side, 0 to 510; the mixer multiplies each side by 4: 0 to 2,040 units a side.")];
  out.push(arrows("dac-ch", [DAC, MIX]));
  const a = (d, c = DAC) => out.push(pathEl(d, { stroke: c, width: 1.8, marker: c === MIX ? "dac-ch-1" : "dac-ch-0" }));
  const ch = [["A", 10], ["B", 80], ["C", 160], ["D", 230]];
  for (const [n, y] of ch) blk(out, 0, y, 200, 56, [`DAC ${n}`, "8 bits, $80 at rest"], { c: DAC, fill: true, size: FT });
  blk(out, 280, 38, 190, 70, ["left side", "A + B: 0–510"], { c: DAC, bold: true });
  blk(out, 280, 188, 190, 70, ["right side", "C + D: 0–510"], { c: DAC, bold: true });
  a("M200,38 L240,38 L240,63 L276,63");
  a("M200,108 L240,108 L240,83 L276,83");
  a("M200,188 L240,188 L240,213 L276,213");
  a("M200,258 L240,258 L240,233 L276,233");
  blk(out, 560, 38, 140, 70, ["mixer × 4", "0–2,040"], { c: MIX, bold: true });
  blk(out, 560, 188, 140, 70, ["mixer × 4", "0–2,040"], { c: MIX, bold: true });
  a("M470,73 L556,73", MIX);
  a("M470,223 L556,223", MIX);
  out.push(text(280, 300, "at rest: 256 a side, 1,024 units in the mixer", { size: FS }));
  out.push("</svg>");
  figures.channels = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the port map
{
  const fam = [
    ["Soundrive mode 1", 1, { A: "$1F", B: "$0F", C: "$4F", D: "$5F" }],
    ["Soundrive mode 2", 2, { A: "$F1", B: "$F3", C: "$F9", D: "$FB" }],
    ["Profi Covox", 3, { A: "$3F", D: "$5F" }],
    ["Covox", 4, { B: "$0F", C: "$4F" }],
    ["Pentagon, ATM", 5, { A: "$FB", D: "$FB" }, "only with mode 2 off"],
    ["GS Covox", 6, { B: "$B3", C: "$B3" }],
    ["Specdrum", 7, { A: "$DF", D: "$DF" }],
    ["NextRegs", null, { A: "$2D", B: "$2C", C: "$2E", D: "$2D" }]
  ];
  const RH = 40, Y0 = 62;
  const H = Y0 + fam.length * RH + 40;
  const out = [svgOpen(700, H, "A table drawn as a grid. One row per sound card the Next answers for, with the NextReg $84 bit that enables it and, in four columns A, B, C and D, the port that writes each DAC channel. Soundrive mode 1, bit 1: $1F, $0F, $4F, $5F. Soundrive mode 2, bit 2: $F1, $F3, $F9, $FB. Profi Covox, bit 3: $3F to A and $5F to D. Covox, bit 4: $0F to B and $4F to C. Pentagon and ATM, bit 5, only with Soundrive mode 2 off: $FB to both A and D. GS Covox, bit 6: $B3 to both B and C. Specdrum, bit 7: $DF to both A and D. Last, the NextRegs, which need no enable: $2D to A and D, $2C to B, $2E to C. Columns A and B are the left side, C and D the right side.")];
  const XB = 250, XC = 330, CW = (700 - XC) / 4;
  out.push(text(0, 22, "sound card", { size: FT, bold: true }));
  out.push(text(XB + 30, 22, "$84 bit", { anchor: "middle", size: FT, bold: true }));
  ["A", "B", "C", "D"].forEach((c, i) => out.push(text(XC + i * CW + CW / 2, 22, c, { anchor: "middle", size: FH, bold: true, fill: DAC })));
  out.push(text(XC + CW, 46, "left side", { anchor: "middle", size: FS }));
  out.push(text(XC + 3 * CW, 46, "right side", { anchor: "middle", size: FS }));
  out.push(line(XC + 2 * CW, 30, XC + 2 * CW, Y0 + fam.length * RH, { opacity: 0.5 }));
  fam.forEach(([name, bit, map, note], r) => {
    const y = Y0 + r * RH;
    if (r === fam.length - 1) out.push(line(0, y, 700, y, { opacity: 0.6 }));
    else out.push(line(0, y, 700, y, { opacity: 0.2 }));
    out.push(text(0, y + (note ? 18 : 26), name, { size: FT }));
    if (note) out.push(text(0, y + 35, note, { size: FS }));
    out.push(text(XB + 30, y + 26, bit === null ? "—" : String(bit), { anchor: "middle", size: FT }));
    ["A", "B", "C", "D"].forEach((c, i) => {
      if (!map[c]) return;
      const x = XC + i * CW;
      out.push(rect(x + 8, y + 7, CW - 16, RH - 14, { rx: 4, stroke: DAC, fill: DAC, fillOpacity: 0.15, width: 1.5 }));
      out.push(text(x + CW / 2, y + 26, map[c], { anchor: "middle", size: FT, bold: true, family: "monospace" }));
    });
  });
  out.push(line(0, Y0 + fam.length * RH, 700, Y0 + fam.length * RH, { opacity: 0.2 }));
  out.push(text(0, H - 10, "a port is its low byte: any high byte reaches the same channels", { size: FS }));
  out.push("</svg>");
  figures.ports = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: Covox stereo, captured
{
  const d = capture("covox");
  rows("covox", "Two captures of the same five milliseconds, from $00 to $FF. Left, DAC B written through port $0F: a 16-step sine. Right, DAC C written through port $4F: a 32-step sine, an octave lower. Neither appears on the other side.", [
    { t: ["left side"], sub: ["port $0F:", "DAC B"], values: byteOf(d, "left") },
    { t: ["right side"], sub: ["port $4F:", "DAC C"], values: byteOf(d, "right") }
  ], 5, 1, 90);
  numbers.push(`covox: ${d.stepTacts} T a step: left ${(d.cpuHz / d.stepTacts / 16).toFixed(1)} Hz, right ${(d.cpuHz / d.stepTacts / 32).toFixed(1)} Hz`);
}

// ---------------------------------------------------------------------------------------------
// Figure: who times the writes
{
  const out = [svgOpen(700, 360, "A diagram of four ways to time DAC writes. The CPU clock, 3.5, 7, 14 or 28 MHz as NextReg $07 sets it, drives a CPU loop: its rate follows the CPU's speed. The 28 MHz master clock drives the other three: the CTC, which divides it by 16 or 256 and then by its time constant and interrupts the CPU, whose interrupt routine writes the sample; the DMA, which moves one byte every 32 times its prescaler master clocks; and the Copper, which can write a DAC through its NextReg mirror once per line. Those three keep their rate at every CPU speed.")];
  out.push(arrows("dac-tm", [GREY, DAC]));
  const a = (d) => out.push(pathEl(d, { stroke: GREY, width: 1.8, marker: "dac-tm-0" }));
  blk(out, 0, 14, 170, 62, ["CPU clock", "3.5 / 7 / 14 / 28 MHz"], { bold: true, size: FS });
  blk(out, 0, 170, 170, 62, ["master clock", "28 MHz"], { bold: true, size: FS });
  const way = (y, t, how, rate) => {
    blk(out, 230, y, 200, 62, t, { c: DAC, bold: true, size: FS });
    out.push(lines(450, y + 24, how, { size: FS, lh: FS + 4 }));
    out.push(text(450, y + 24 + 2 * (FS + 4), rate, { size: FS, bold: true }));
  };
  way(14, ["a CPU loop", "writes the port"], ["one write every pass", "of the loop"], "follows the CPU's speed");
  way(104, ["the CTC", "interrupts the CPU"], ["28 MHz ÷ 16 or 256", "÷ the time constant"], "the same at every speed");
  way(194, ["the DMA", "copies a byte"], ["one byte every", "32 × prescaler clocks"], "about the same at every speed");
  way(284, ["the Copper", "writes NextReg $2D"], ["at most once a line,", "MOVE after WAIT"], "the same at every speed");
  a("M170,45 L226,45");
  a("M170,201 L200,201 L200,135 L226,135");
  a("M170,201 L200,201 L200,225 L226,225");
  a("M170,201 L200,201 L200,315 L226,315");
  out.push("</svg>");
  figures.timers = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the same sine at two CPU speeds, from three timers (captured)
{
  const r = (n, t, sub, c) => ({ t, sub, values: byteOf(capture(n)), c });
  const hz = (n) => capture(n).hz;
  for (const n of ["cpu35", "cpu7", "dma35", "dma7", "ctc35", "ctc14"]) numbers.push(`${n}: ${hz(n).toFixed(1)} Hz`);
  rows("speeds", "Six captures of five milliseconds each, from $00 to $FF: the same 16-step sine table played three ways, each at two CPU speeds. A CPU loop at 3.5 MHz plays five cycles; the same loop at 7 MHz plays ten, an octave up. The DMA at prescaler 55 plays just under five cycles at both 3.5 and 7 MHz. The CTC with prescaler 16 and time constant 109 plays five cycles at both 3.5 and 14 MHz.", [
    r("cpu35", ["CPU loop"], ["3.5 MHz:", `${fmt(hz("cpu35"))} Hz`]),
    r("cpu7", ["CPU loop"], ["7 MHz:", `${fmt(hz("cpu7"))} Hz`]),
    r("dma35", ["DMA"], ["3.5 MHz:", `${fmt(hz("dma35"))} Hz`]),
    r("dma7", ["DMA"], ["7 MHz:", `${fmt(hz("dma7"))} Hz`]),
    r("ctc35", ["CTC"], ["3.5 MHz:", `${fmt(hz("ctc35"))} Hz`]),
    r("ctc14", ["CTC"], ["14 MHz:", `${fmt(hz("ctc14"))} Hz`])
  ], 5, 1, 62);
}

// ---------------------------------------------------------------------------------------------
// Figure: a drum hit (captured)
{
  const d = capture("drum");
  const from = d.from;
  const v = byteOf(d).slice(from);
  const T = 150;
  numbers.push(`drum: ${d.samples} samples, ${d.lengthMs.toFixed(1)} ms`);
  const X = 140, W = 700 - X - 4, rowH = 180;
  const H = 10 + rowH + 20 + 44;
  const out = [svgOpen(700, H, "A capture of 150 milliseconds, from $00 to $FF: a drum hit played once by the DMA. It starts as noise filling almost the whole range and dies away towards the rest level $80 over about 100 milliseconds; after about 131 milliseconds the last sample holds and the line is flat.")];
  const b = box(X, 10, W, rowH, 0, T, 0, 255);
  out.push(line(b.x, b.py(128), b.x + b.w, b.py(128), { opacity: 0.3, dash: "3 4" }));
  out.push(pathEl(sampleStairs(b, v.slice(0, Math.round(T / DT)), 0, DT), { stroke: DAC, width: 1.2 }));
  // --- where the last sample starts to hold: the last change in the capture
  let last = 0;
  for (let k = 1; k < v.length; k++) if (Math.round(v[k]) !== Math.round(v[k - 1])) last = k;
  const endMs = last * DT;
  numbers.push(`drum: last change at ${endMs.toFixed(1)} ms (ideal ${d.lengthMs.toFixed(1)})`);
  const end = b.px(endMs);
  out.push(line(end, 10, end, 10 + rowH, { stroke: DAC, dash: "4 4", opacity: 0.8 }));
  out.push(text(end - 6, 28, "the last sample", { anchor: "end", size: FS, fill: DAC }));
  out.push(lines(0, 10 + rowH / 2 - 6, ["drum hit"], { size: FT, bold: true, fill: DAC }));
  out.push(lines(0, 10 + rowH / 2 + 13, ["2,048 samples,", "DMA, prescaler 55"], { size: FS, lh: FS + 3 }));
  for (const lv of [0, 128, 255]) out.push(text(b.x - 6, b.py(lv) + 5, hex(lv), { anchor: "end", size: FS }));
  const y = H - 34;
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T; t += 25) {
    out.push(line(b.px(t), y - 5, b.px(t), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(t), y + 22, `${t} ms`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.drum = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the DACs' share of the mixer's range
{
  const W = 700, FULL = 8191;
  const px = (v) => (v / FULL) * (W - 2);
  const out = [svgOpen(700, 230, "Two bars drawn to scale on the mixer's range of 0 to 8,191 for one side. The DACs' range on a side is 0 to 2,040 units, a quarter of the whole. At rest, both channels of the side at $80, they add 1,024 units, the middle of their range; a sample swings from there down to 0 and up to 2,040.")];
  const bar = (y, t, from, to, c, label) => {
    out.push(text(0, y, t, { size: FT }));
    out.push(rect(px(0), y + 10, px(FULL), 30, { opacity: 0.3 }));
    out.push(rect(px(from), y + 10, px(to) - px(from), 30, { fill: c, fillOpacity: 0.7, stroke: c, width: 1 }));
    if (label) out.push(text((px(from) + px(to)) / 2, y + 31, label, { anchor: "middle", size: FS, bold: true, fill: "#ffffff" }));
  };
  bar(22, "the DACs' range on one side: two channels × 255 × 4", 0, 2040, DAC, "0–2,040");
  bar(90, "at rest: both channels at $80", 0, 1024, DAC, "1,024");
  out.push(line(px(1024), 130, px(1024), 158, { stroke: DAC, width: 2, dash: "5 4" }));
  out.push(text(px(1024) + 8, 156, "a sample swings about here", { size: FS, fill: DAC }));
  out.push(line(0, 186, W, 186, { opacity: 0.5 }));
  for (const v of [0, 1024, 2040, 4095, 8191]) {
    out.push(line(px(v), 181, px(v), 191, { opacity: 0.5 }));
    out.push(text(px(v), 210, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.budget = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
