#!/usr/bin/env node
// Figures of "CTC: Four Timers in a Ring"
// (docs/content/en/under-the-hood/emulator-internals/next-ctc.mdx).
//
// The timeline is to scale in 28 MHz master clocks. Run:
//   node docs/authoring/next-ctc/ctc-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-ctc.mdx");

// --- One colour per subject in this chapter
const CLK = "#3b82f6"; // the master clock and the prescaler
const CTC = "#e8912d"; // the channels
const TRG = "#30a46c"; // the trigger input
const ZC = "#e5484d"; // ZC/TO, the zero count
const GREY = "currentColor";

const FH = 16.5, FT = 15, FS = 13.5;

/** A box with centred lines of text. */
function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: one channel
{
  const out = [svgOpen(700, 300, "One CTC channel. The 28 MHz master clock feeds the prescaler, which divides by 16 or 256 as bit 5 of the control word says. The trigger input, the previous channel's ZC/TO, goes through an edge detector, rising or falling as bit 4 says. A mode switch, bit 6, picks the prescaler's pulses in timer mode or the trigger's edges in counter mode, and each one counts the 8-bit down-counter down. At zero the counter sends a ZC/TO pulse, to the interrupt controller and the next channel, and reloads from the time constant register.")];
  out.push(arrows("ctc-ch", [GREY, CLK, TRG, CTC, ZC]));
  blk(out, 0, 20, 150, 60, ["master clock", "28 MHz"], { c: CLK });
  blk(out, 190, 20, 150, 60, ["prescaler", "÷16 or ÷256"], { c: CLK, fill: true });
  out.push(pathEl("M150,50 L186,50", { stroke: CLK, width: 1.8, marker: "ctc-ch-1" }));
  blk(out, 0, 200, 150, 60, ["trigger in:", "previous ZC/TO"], { c: TRG, size: FS + 0.5 });
  blk(out, 190, 200, 150, 60, ["edge", "rising or falling"], { c: TRG, fill: true, size: FS + 0.5 });
  out.push(pathEl("M150,230 L186,230", { stroke: TRG, width: 1.8, marker: "ctc-ch-2" }));
  blk(out, 370, 110, 120, 60, ["mode", "timer/counter"], { size: FS });
  out.push(pathEl("M340,50 L430,50 L430,106", { stroke: CLK, width: 1.8, marker: "ctc-ch-1" }));
  out.push(pathEl("M340,230 L430,230 L430,174", { stroke: TRG, width: 1.8, marker: "ctc-ch-2" }));
  blk(out, 520, 110, 180, 60, ["down-counter", "8 bits"], { c: CTC, fill: true, bold: true });
  out.push(pathEl("M490,140 L516,140", { width: 1.8, marker: "ctc-ch-0" }));
  blk(out, 520, 230, 180, 56, ["time constant"], { c: CTC });
  out.push(pathEl("M610,230 L610,174", { stroke: CTC, width: 1.8, marker: "ctc-ch-3" }));
  out.push(text(600, 208, "reload at zero", { size: FS, anchor: "end", fill: CTC }));
  blk(out, 520, 0, 180, 60, ["ZC/TO: interrupt,", "next channel"], { c: ZC, size: FS + 0.5 });
  out.push(pathEl("M610,110 L610,64", { stroke: ZC, width: 1.8, marker: "ctc-ch-4" }));
  figures.channel = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: prescaler 16, time constant 3, to scale in master clocks
{
  const T = 112, X0 = 130, W = 570, k = W / T;
  const px = (t) => X0 + t * k;
  const out = [svgOpen(700, 250, "A timeline to scale over 112 master clocks. The prescaler pulses every 16 clocks, at 16, 32, 48 and on. The count starts at 3 and goes to 2 at clock 16, 1 at 32 and 0 at 48. For the one clock it reads 0, ZC/TO is high; on the next clock the count is 3 again. The count goes 2 at 64, 1 at 80 and 0 at 96, with the next ZC/TO, 48 clocks after the first.")];
  for (let t = 0; t <= T; t += 16) {
    out.push(line(px(t), 30, px(t), 36, { width: 1.2 }));
    out.push(text(px(t), 22, String(t), { size: FS, anchor: t === T ? "end" : "middle" }));
  }
  out.push(text(0, 22, "clocks", { size: FS }));
  // --- prescaler pulses
  out.push(text(0, 66, "prescaler", { size: FT, bold: true, fill: CLK }));
  out.push(line(px(0), 70, px(T), 70, { stroke: CLK, width: 1.2, opacity: 0.6 }));
  for (let t = 16; t <= T; t += 16) out.push(rect(px(t) - 3, 48, 6, 22, { stroke: CLK, width: 1.2, fill: CLK, fillOpacity: 0.6 }));
  // --- the count
  out.push(text(0, 116, "count", { size: FT, bold: true, fill: CTC }));
  const segs = [[0, 16, "3"], [16, 32, "2"], [32, 48, "1"], [48, 49, "0"], [49, 64, "3"], [64, 80, "2"], [80, 96, "1"], [96, 97, "0"], [97, 112, "3"]];
  for (const [a, b, v] of segs) {
    const zero = v === "0";
    out.push(rect(px(a), 96, (b - a) * k, 30, { rx: zero ? 0 : 3, stroke: zero ? ZC : CTC, width: 1.4, fill: zero ? ZC : CTC, fillOpacity: zero ? 0.6 : 0.12 }));
    if (!zero) out.push(text((px(a) + px(b)) / 2, 116, v, { size: FT, anchor: "middle", bold: true, fill: CTC }));
  }
  for (const t of [48, 96]) out.push(text(px(t) + 2.5, 90, "0", { size: FS, anchor: "middle", bold: true, fill: ZC }));
  // --- ZC/TO
  out.push(text(0, 172, "ZC/TO", { size: FT, bold: true, fill: ZC }));
  out.push(pathEl(`M${px(0)},176 L${px(48)},176 L${px(48)},154 L${px(49)},154 L${px(49)},176 L${px(96)},176 L${px(96)},154 L${px(97)},154 L${px(97)},176 L${px(T)},176`, { stroke: ZC, width: 1.8 }));
  // --- the period
  out.push(pathEl(`M${px(48)},196 L${px(48)},206 L${px(96)},206 L${px(96)},196`, { width: 1.4 }));
  out.push(text((px(48) + px(96)) / 2, 228, "48 clocks: prescaler × time constant", { size: FS, anchor: "middle" }));
  figures.tick = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the ring
{
  const out = [svgOpen(700, 306, "Four boxes in a square: channel 0 at port $183B top left, channel 1 at $193B top right, channel 2 at $1A3B bottom right, channel 3 at $1B3B bottom left. Arrows labelled ZC/TO run from channel 0 to 1, 1 to 2, 2 to 3 and 3 back to 0. In the middle: every ZC/TO also sets a status bit and is an interrupt request. Below channel 3, its ZC/TO can also clock joystick pin 7.")];
  out.push(arrows("ctc-ring", [ZC]));
  const box = (x, y, n, port) => blk(out, x, y, 220, 70, [`channel ${n}`, port], { c: CTC, fill: true, bold: true, size: FT });
  box(0, 6, 0, "$183B");
  box(480, 6, 1, "$193B");
  box(480, 176, 2, "$1A3B");
  box(0, 176, 3, "$1B3B");
  const a = (d) => out.push(pathEl(d, { stroke: ZC, width: 1.8, marker: "ctc-ring-0" }));
  a("M220,41 L476,41");
  out.push(text(350, 31, "ZC/TO", { size: FS, anchor: "middle", bold: true, fill: ZC }));
  a("M590,76 L590,172");
  out.push(text(600, 130, "ZC/TO", { size: FS, bold: true, fill: ZC }));
  a("M480,211 L224,211");
  out.push(text(350, 231, "ZC/TO", { size: FS, anchor: "middle", bold: true, fill: ZC }));
  a("M110,176 L110,80");
  out.push(text(120, 130, "ZC/TO", { size: FS, bold: true, fill: ZC }));
  out.push(lines(350, 122, ["every ZC/TO also sets a status", "bit and requests an interrupt"], { size: FS, anchor: "middle", lh: 18 }));
  a("M110,246 L110,274");
  out.push(text(122, 294, "channel 3 can also clock joystick pin 7", { size: FS, fill: ZC }));
  figures.ring = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: an exact 50 Hz
{
  const out = [svgOpen(700, 130, "A chain of dividers from left to right: the 28 MHz master clock; the prescaler divides by 16, giving 1.75 MHz; channel 0, a timer with time constant 140, gives 12.5 kHz; channel 1, a counter with time constant 250, gives 50 Hz. 16 times 140 times 250 is 560,000 clocks, 20 ms.")];
  out.push(arrows("ctc-div", [GREY]));
  out.push(lines(34, 46, ["28 MHz", "clock"], { size: FT, anchor: "middle", bold: true, fill: CLK, lh: 18 }));
  blk(out, 96, 20, 124, 60, ["prescaler", "÷16"], { c: CLK, fill: true });
  blk(out, 316, 20, 124, 60, ["channel 0", "timer ÷140"], { c: CTC, fill: true });
  blk(out, 536, 20, 124, 60, ["channel 1", "counter ÷250"], { c: CTC, fill: true });
  out.push(pathEl("M72,50 L92,50", { width: 1.8, marker: "ctc-div-0" }));
  out.push(pathEl("M220,50 L312,50", { width: 1.8, marker: "ctc-div-0" }));
  out.push(pathEl("M440,50 L532,50", { width: 1.8, marker: "ctc-div-0" }));
  out.push(text(266, 40, "1.75 MHz", { size: FS, anchor: "middle" }));
  out.push(text(486, 40, "12.5 kHz", { size: FS, anchor: "middle" }));
  out.push(pathEl("M660,50 L672,50 L672,96", { width: 1.8, marker: "ctc-div-0" }));
  out.push(text(700, 118, "50 Hz", { size: FT, anchor: "end", bold: true, fill: ZC }));
  out.push(text(0, 118, "16 × 140 × 250 = 560,000 clocks = 20 ms", { size: FS }));
  figures.divider = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
