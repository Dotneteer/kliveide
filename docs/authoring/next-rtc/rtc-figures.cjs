#!/usr/bin/env node
// Figures of "Real-Time Clock: A Watchman on Two Wires"
// (docs/content/en/under-the-hood/emulator-internals/next-rtc.mdx).
//
// The waveform is to scale in clock periods; the bus, the counter chain and the transaction are
// diagrams. Run:
//   node docs/authoring/next-rtc/rtc-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-rtc.mdx");

// --- One colour per subject in this chapter
const LINE = "#3b82f6"; // the bus lines, and what the Next sends on them
const RTC = "#e8912d"; // the DS1307, the watchman, and what it sends
const PI = "#a855f7"; // the Raspberry Pi's pins
const MARK = "#e5484d"; // START and STOP: SDA changing while SCL is high
const GREY = "currentColor";

const FT = 15, FS = 13.5;

/** A box with centred lines of text. */
function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}
const dot = (x, y, c) => `  <circle cx="${x}" cy="${y}" r="3.5" fill="${c}" />`;

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: two wires, everyone pulls down
{
  const H = 300;
  const out = [svgOpen(700, H, "Two horizontal lines, SCL above and SDA below, run across the figure. At the right, a pull-up resistor ties each line to the supply. Below the lines hang three devices, each wired to both lines: the FPGA with ports $103B and $113B, the DS1307 real-time clock, and an internal connector. At the far left, the Raspberry Pi's GPIO 2 and 3 connect only to the FPGA, through its own pair of wires, once NextReg $A0 bit 3 joins them. A key says that any device can pull a line low, none drives it high, and the line is high only when nobody pulls.")];
  const SCL = 110, SDA = 150, X0 = 170;
  out.push(text(X0 - 10, SCL + 5, "SCL", { size: FT, bold: true, fill: LINE, anchor: "end" }));
  out.push(text(X0 - 10, SDA + 5, "SDA", { size: FT, bold: true, fill: LINE, anchor: "end" }));
  out.push(line(X0, SCL, 700, SCL, { stroke: LINE, width: 2.4 }));
  out.push(line(X0, SDA, 700, SDA, { stroke: LINE, width: 2.4 }));
  // --- the pull-ups: the supply rail, a resistor to each line
  const RAIL = 24;
  out.push(line(600, RAIL, 700, RAIL, { width: 2 }));
  out.push(text(590, RAIL + 5, "supply", { size: FS, anchor: "end" }));
  for (const [x, y] of [[630, SCL], [680, SDA]]) {
    out.push(line(x, RAIL, x, RAIL + 14, { width: 1.8 }));
    out.push(rect(x - 7, RAIL + 14, 14, 36, { width: 1.8 }));
    out.push(line(x, RAIL + 50, x, y, { width: 1.8 }));
    out.push(dot(x, y, GREY));
  }
  out.push(text(530, 70, "pull-ups", { size: FS, anchor: "middle" }));
  // --- the devices, each with a drop to both lines
  const dev = (x, w, t, c, fill) => {
    blk(out, x, 200, w, 70, t, { c, fill, size: FS + 0.5 });
    const xs = [x + w * 0.3, x + w * 0.7];
    out.push(line(xs[0], SCL, xs[0], 200, { stroke: LINE, width: 1.8 }));
    out.push(dot(xs[0], SCL, LINE));
    out.push(line(xs[1], SDA, xs[1], 200, { stroke: LINE, width: 1.8 }));
    out.push(dot(xs[1], SDA, LINE));
  };
  dev(170, 150, ["FPGA", "ports $103B, $113B"]);
  dev(370, 150, ["DS1307", "the watchman"], RTC, true);
  dev(570, 130, ["internal", "connector"]);
  // --- the Pi, behind the FPGA
  blk(out, 0, 200, 110, 70, ["Pi's", "GPIO 2, 3"], { c: PI, fill: true, size: FS + 0.5 });
  out.push(line(110, 222, 170, 222, { stroke: PI, width: 1.8 }));
  out.push(line(110, 248, 170, 248, { stroke: PI, width: 1.8 }));
  out.push(text(0, 192, "NextReg $A0 bit 3", { size: FS, fill: PI }));
  out.push(text(0, 296, "any device pulls a line low; none drives it high; a line is high only when nobody pulls", { size: FS }));
  figures.bus = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: START, the address $D0, the ACK and STOP, to scale in clock periods
{
  const H = 214;
  const out = [svgOpen(700, H, "Two waveforms over eleven and a half clock periods, SCL above, SDA below. Both lines rest high. START: SDA falls while SCL is high. Then nine clock pulses: during each, SDA holds a bit, changing only while SCL is low. The first eight carry the address byte $D0: 1, 1, 0, 1, 0, 0, 0 for address $68, then 0 for write. On the ninth pulse the watchman pulls SDA low: the ACK, drawn in orange. STOP: SDA rises while SCL is high. Red marks show the two moments SDA changes while SCL is high.")];
  const X0 = 80, P = (700 - X0) / 11.5;
  const tx = (t) => X0 + t * P;
  const HI = (y) => y, LO = (y) => y + 40;
  const SCLY = 18, SDAY = 92;
  out.push(text(0, SCLY + 25, "SCL", { size: FT, bold: true, fill: LINE }));
  out.push(text(0, SDAY + 25, "SDA", { size: FT, bold: true, fill: LINE }));
  // --- SCL: high until 1, then for each of the 9 bits low for half a period, high for half; then the STOP's clock
  const scl = [[0, HI(SCLY)], [1, HI(SCLY)], [1, LO(SCLY)]];
  for (let i = 0; i < 9; i++) {
    const t = 1 + i;
    scl.push([t + 0.5, LO(SCLY)], [t + 0.5, HI(SCLY)], [t + 1, HI(SCLY)], [t + 1, LO(SCLY)]);
  }
  scl.push([10.5, LO(SCLY)], [10.5, HI(SCLY)], [11.5, HI(SCLY)]);
  out.push(pathEl("M" + scl.map(([t, y]) => `${S.r(tx(t))},${y}`).join(" L"), { stroke: LINE, width: 2.2 }));
  // --- SDA: high, START at 0.5, then the bits change at the start of each period (SCL low)
  const bits = [1, 1, 0, 1, 0, 0, 0, 0];
  const sda = [[0, 1], [0.5, 1], [0.5, 0], [1, 0]];
  bits.forEach((b, i) => {
    const t = 1 + i;
    sda.push([t + 0.15, sda[sda.length - 1][1]], [t + 0.15, b], [t + 1, b]);
  });
  // --- the master releases SDA for the ACK: the watchman's part is drawn on its own
  out.push(pathEl("M" + sda.map(([t, v]) => `${S.r(tx(t))},${v ? HI(SDAY) : LO(SDAY)}`).join(" L"), { stroke: LINE, width: 2.2 }));
  out.push(pathEl(`M${S.r(tx(9))},${LO(SDAY)} L${S.r(tx(9.15))},${LO(SDAY)} L${S.r(tx(10))},${LO(SDAY)}`, { stroke: RTC, width: 3.2 }));
  // --- STOP: low from 10, rises at 10.75 while SCL is high
  out.push(pathEl(`M${S.r(tx(10))},${LO(SDAY)} L${S.r(tx(10.75))},${LO(SDAY)} L${S.r(tx(10.75))},${HI(SDAY)} L${S.r(tx(11.5))},${HI(SDAY)}`, { stroke: LINE, width: 2.2 }));
  // --- period grid
  for (let t = 1; t <= 10; t++) out.push(line(tx(t), 8, tx(t), 140, { dash: "3 3", opacity: 0.35 }));
  // --- START and STOP marks
  for (const t of [0.5, 10.75]) out.push(line(tx(t), 8, tx(t), 140, { stroke: MARK, width: 2 }));
  out.push(text(tx(0.5), 160, "START", { size: FS, bold: true, fill: MARK, anchor: "middle" }));
  out.push(text(tx(10.9), 160, "STOP", { size: FS, bold: true, fill: MARK, anchor: "middle" }));
  // --- the bit values, in the middle of each pulse
  ["1", "1", "0", "1", "0", "0", "0", "0"].forEach((v, i) => out.push(text(tx(1.5 + i), 160, v, { size: FS, anchor: "middle", bold: true, fill: LINE })));
  out.push(text(tx(9.5), 160, "ACK", { size: FS, anchor: "middle", bold: true, fill: RTC }));
  // --- what the bits mean, with brackets
  const bracket = (t0, t1, y, label, c) => {
    out.push(pathEl(`M${S.r(tx(t0) + 3)},${y - 6} L${S.r(tx(t0) + 3)},${y} L${S.r(tx(t1) - 3)},${y} L${S.r(tx(t1) - 3)},${y - 6}`, { stroke: c, width: 1.6 }));
    out.push(text((tx(t0) + tx(t1)) / 2, y + 18, label, { size: FS, anchor: "middle", fill: c }));
  };
  bracket(1, 8, 176, "address $68", LINE);
  bracket(8, 9, 176, "write", LINE);
  bracket(9, 10, 176, "watchman", RTC);
  figures.wave = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the watchman inside, the counter chain and the snapshot
{
  const H = 168;
  const out = [svgOpen(700, H, "Across the top, a chain of boxes linked by arrows: a 32,768 Hz crystal divided by 32,768, giving one pulse a second, then the counters for seconds, minutes, hours, day and date, month and year, each carrying into the next. Below the six counters, a band: the snapshot, copied from the counters on every START. Every read over the bus comes from the snapshot, while the counters keep running.")];
  out.push(arrows("rt-ch", [GREY, RTC]));
  const W0 = 92, G = 18;
  const w = (700 - W0 - 6 * G) / 6;
  blk(out, 0, 10, W0, 56, ["32,768 Hz", "÷ 32,768"], { size: FS });
  const names = [["seconds"], ["minutes"], ["hours"], ["day,", "date"], ["month"], ["year"]];
  const xs = names.map((_, i) => W0 + G + i * (w + G));
  names.forEach((t, i) => blk(out, xs[i], 10, w, 56, t, { c: RTC, fill: true, size: FS + 0.5 }));
  out.push(pathEl(`M${W0},38 L${S.r(xs[0] - 2)},38`, { width: 1.8, marker: "rt-ch-0" }));
  for (let i = 1; i < 6; i++) out.push(pathEl(`M${S.r(xs[i - 1] + w)},38 L${S.r(xs[i] - 2)},38`, { stroke: RTC, width: 1.8, marker: "rt-ch-1" }));
  out.push(text(W0 / 2, 86, "1 Hz", { size: FS, anchor: "middle" }));
  // --- copies down into the snapshot
  for (const x of xs) out.push(pathEl(`M${S.r(x + w / 2)},66 L${S.r(x + w / 2)},104`, { stroke: RTC, width: 1.6, dash: "4 3", marker: "rt-ch-1" }));
  blk(out, xs[0], 106, 700 - xs[0], 40, ["the snapshot: copied on every START, read over the bus"], { c: RTC, size: FS + 0.5, op: 0.06, fill: true });
  out.push(text(0, 164, "the counters keep running while a read takes its bytes from the snapshot", { size: FS }));
  figures.chain = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: reading the time, the whole conversation
{
  const H = 230;
  const out = [svgOpen(700, H, "Two rows of cells, read left to right, blue for what the Next sends and orange for what the watchman sends. The first row sets the register pointer: START, the address $D0 to write, the watchman's ACK, the pointer $00, the watchman's ACK. The second row reads: a repeated START, the address $D1 to read, the watchman's ACK, then the seconds $56 with the Next's ACK, the minutes $34 with ACK, the hours $12 with ACK, three more bytes, the year $26, the Next's NACK, and STOP.")];
  const NW = 40, BW = 66, CH = 40;
  const cell = (x, y, wd, t, who) => blk(out, x, y, wd, CH, [t], { c: who, fill: true, size: FS, bold: true, op: who === RTC ? 0.18 : 0.1 });
  const row = (y, cells) => {
    let x = 0;
    const at = [];
    for (const [t, who, wide] of cells) {
      const wd = wide ? BW : NW;
      cell(x, y, wd, t, who);
      at.push([x, wd]);
      x += wd;
    }
    return at;
  };
  out.push(text(0, 18, "set the pointer to $00", { size: FS, bold: true }));
  row(26, [["S", LINE], ["$D0", LINE, 1], ["A", RTC], ["$00", LINE, 1], ["A", RTC]]);
  out.push(text(0, 98, "read from $00 on", { size: FS, bold: true }));
  const at = row(106, [
    ["Sr", LINE], ["$D1", LINE, 1], ["A", RTC],
    ["$56", RTC, 1], ["A", LINE], ["$34", RTC, 1], ["A", LINE], ["$12", RTC, 1], ["A", LINE],
    ["…", GREY], ["$26", RTC, 1], ["N", LINE], ["P", LINE]
  ]);
  const under = (i, label) => out.push(text(at[i][0] + at[i][1] / 2, 166, label, { size: FS, anchor: "middle", fill: RTC }));
  under(3, "seconds");
  under(5, "minutes");
  under(7, "hours");
  under(10, "year");
  out.push(text(0, 200, "S START, Sr repeated START, P STOP, A ACK (pulled low), N NACK (left high)", { size: FS }));
  out.push(text(0, 222, "blue: the Next sends; orange: the watchman sends", { size: FS }));
  figures.read = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
