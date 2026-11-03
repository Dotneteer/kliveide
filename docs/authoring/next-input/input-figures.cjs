#!/usr/bin/env node
// Figures of "Input: One Matrix, Many Hands"
// (docs/content/en/under-the-hood/emulator-internals/next-input.mdx).
//
// The shift timing is to scale in scans and the Mega Drive read in reader steps; the matrix and the
// block diagram are diagrams. Run:
//   node docs/authoring/next-input/input-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-input.mdx");

// --- One colour per subject in this chapter
const KEY = "#3b82f6"; // the 40 Spectrum keys, the matrix
const EXTRA = "#e8912d"; // the 16 extra keys
const JOY = "#a855f7"; // joysticks
const PS2 = "#30a46c"; // the PS/2 keyboard
const MARK = "#e5484d"; // moments, copies, warnings
const GREY = "currentColor";

const FT = 15, FS = 13.5;

/** A box with centred lines of text. */
function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: the 8 x 7 matrix
{
  const ROWS = [
    ["A8", "CAPS", "Z", "X", "C", "V", "EXTEND", "UP"],
    ["A9", "A", "S", "D", "F", "G", "CAPS LOCK", "GRAPH"],
    ["A10", "Q", "W", "E", "R", "T", "TRUE VID", "INV VID"],
    ["A11", "1", "2", "3", "4", "5", "BREAK", "EDIT"],
    ["A12", "0", "9", "8", "7", "6", ";", "\""],
    ["A13", "P", "O", "I", "U", "Y", ",", "."],
    ["A14", "ENTER", "L", "K", "J", "H", "DELETE", "RIGHT"],
    ["A15", "SPACE", "SYM", "M", "N", "B", "LEFT", "DOWN"]
  ];
  const LW = 64, CW = (700 - LW) / 7, RH = 30, TOP = 46;
  const H = TOP + 8 * RH + 12;
  const out = [svgOpen(700, H, "The Next's keyboard matrix: eight rows, selected by address lines A8 to A15, and seven columns. Columns 0 to 4, drawn in blue, are the Spectrum's 40 keys, read in bits 0 to 4 of port $FE: A8 CAPS SHIFT Z X C V, A9 A S D F G, A10 Q W E R T, A11 1 2 3 4 5, A12 0 9 8 7 6, A13 P O I U Y, A14 ENTER L K J H, A15 SPACE SYMBOL SHIFT M N B. Columns 5 and 6, drawn in orange, hold the sixteen extra keys: EXTEND and UP, CAPS LOCK and GRAPH, TRUE VIDEO and INV VIDEO, BREAK and EDIT, semicolon and quote, comma and full stop, DELETE and RIGHT, LEFT and DOWN.")];
  out.push(text(LW + 2.5 * CW, 16, "port $FE, bits 0-4", { size: FS, bold: true, fill: KEY, anchor: "middle" }));
  out.push(text(LW + 6 * CW, 16, "extra columns", { size: FS, bold: true, fill: EXTRA, anchor: "middle" }));
  for (let c = 0; c < 7; c++) out.push(text(LW + (c + 0.5) * CW, 38, c < 5 ? `bit ${c}` : `col ${c}`, { size: FS, anchor: "middle", fill: c < 5 ? KEY : EXTRA }));
  ROWS.forEach((row, r) => {
    const y = TOP + r * RH;
    out.push(text(0, y + RH / 2 + 5, row[0], { size: FS, bold: true }));
    for (let c = 0; c < 7; c++) {
      const col = c < 5 ? KEY : EXTRA;
      out.push(rect(LW + c * CW + 1.5, y + 1.5, CW - 3, RH - 3, { rx: 3, stroke: col, width: 1.4, fill: col, fillOpacity: c < 5 ? 0.08 : 0.14 }));
      out.push(text(LW + (c + 0.5) * CW, y + RH / 2 + 5, row[c + 1], { size: FS, anchor: "middle" }));
    }
  });
  figures.matrix = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: one matrix, many hands
{
  const H = 252;
  const out = [svgOpen(700, H, "Three sources on the left feed the same eight-by-seven matrix: the membrane keyboard, the PS/2 keyboard through its keymap, and joysticks in the key modes through the joystick map. A key counts as pressed when any of them presses it. In the middle the clerk scans the matrix one row every 18.3 microseconds and copies the whole matrix at the end of each scan. On the right, two readers take from that copy: port $FE, whose address lines A15 to A8 select rows and whose bits 0 to 4 give the columns, with the extra keys entering their two Spectrum keys unless NextReg $68 bit 4 stops it; and NextRegs $B0 and $B1, which report the sixteen extra keys themselves.")];
  out.push(arrows("in-h", [GREY, PS2, JOY, KEY, EXTRA]));
  blk(out, 0, 20, 170, 56, ["membrane", "8 rows, 7 columns"], { c: KEY, fill: true, size: FS + 0.5 });
  blk(out, 0, 98, 170, 56, ["PS/2 keyboard", "via the keymap"], { c: PS2, fill: true, size: FS + 0.5 });
  blk(out, 0, 176, 170, 56, ["joysticks, key modes", "via the joystick map"], { c: JOY, fill: true, size: FS + 0.5 });
  const SX = 230, SW = 180;
  blk(out, SX, 20, SW, 212, ["the clerk", "scans a row", "every 18.3 µs,", "copies the matrix", "after each scan"], { size: FS + 0.5 });
  out.push(pathEl(`M170,48 L${SX - 2},48`, { width: 1.8, marker: "in-h-3", stroke: KEY }));
  out.push(pathEl(`M170,126 L${SX - 2},126`, { width: 1.8, marker: "in-h-1", stroke: PS2 }));
  out.push(pathEl(`M170,204 L${SX - 2},204`, { width: 1.8, marker: "in-h-2", stroke: JOY }));
  const OX = 470, OW = 230;
  blk(out, OX, 20, OW, 96, ["port $FE", "rows by A15-A8,", "columns in bits 0-4,", "extra keys as pairs"], { c: KEY, size: FS + 0.5 });
  blk(out, OX, 136, OW, 96, ["NextRegs $B0, $B1", "the 16 extra keys", "themselves"], { c: EXTRA, size: FS + 0.5 });
  out.push(pathEl(`M${SX + SW},68 L${OX - 2},68`, { width: 1.8, marker: "in-h-3", stroke: KEY }));
  out.push(pathEl(`M${SX + SW},184 L${OX - 2},184`, { width: 1.8, marker: "in-h-4", stroke: EXTRA }));
  out.push(text(0, 250, "a key is down when any of the three presses it", { size: FS }));
  figures.hands = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: CAPS SHIFT leads and trails an extra key's other half (UP = CAPS SHIFT + 7)
{
  const N = 10, X0 = 150, W = (700 - X0) / N;
  const H = 196;
  const out = [svgOpen(700, H, "Three rows over ten scans. The UP key is held during scans 2, 3 and 4. In the copies the CPU reads, CAPS SHIFT is down after scans 2 to 7, and 7 is down after scans 3 to 5: CAPS SHIFT arrives one scan before the 7 and leaves two scans after it.")];
  const xs = (n) => X0 + n * W;
  const bar = (y, from, to, c, label) => {
    out.push(text(0, y + 19, label, { size: FS, bold: true, fill: c }));
    out.push(line(X0, y + 26, 700, y + 26, { opacity: 0.35 }));
    out.push(rect(xs(from) + 2, y + 6, (to - from) * W - 4, 20, { rx: 3, stroke: c, width: 1.6, fill: c, fillOpacity: 0.3 }));
  };
  for (let n = 0; n <= N; n++) out.push(line(xs(n), 8, xs(n), 140, { dash: "3 3", opacity: 0.35 }));
  for (let n = 0; n < N; n++) out.push(text(xs(n) + W / 2, 158, String(n), { size: FS, anchor: "middle" }));
  out.push(text(0, 158, "scan", { size: FS }));
  bar(8, 2, 5, EXTRA, "UP held");
  bar(52, 2, 8, KEY, "CAPS SHIFT");
  bar(96, 3, 6, KEY, "7");
  out.push(line(xs(2), 4, xs(2), 140, { stroke: MARK, width: 2 }));
  out.push(line(xs(8), 4, xs(8), 140, { stroke: MARK, width: 2 }));
  out.push(text(0, 190, "each column is one copy of the matrix, 164.6 µs; the CPU reads the latest", { size: FS }));
  figures.shift = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the Mega Drive read, to scale in reader steps
{
  const X0 = 110, STEPS = 16, W = (700 - X0) / STEPS;
  const H = 222;
  const out = [svgOpen(700, H, "The active part of the joystick reader's cycle, sixteen steps of 4.57 microseconds, to scale. Pin 7, the select line, is low for two steps, high for two, four times over. Each pair of steps reads the left connector, then the right. The first low reading starts afresh. The second low reading checks for a Mega Drive pad, pins 3 and 4 low, and then takes A and START. The second high reading takes up, down, left, right, B and C, which is all an ordinary joystick has. The third low reading looks for a six-button pad, pins 1 and 2 low; the third high reading then takes X, Y, Z and MODE. After the sixteen steps the reader rests for 496 steps, about 2.27 milliseconds, so the pads can reset.")];
  const xs = (t) => X0 + t * W;
  out.push(text(0, 30, "pin 7", { size: FT, bold: true, fill: JOY }));
  out.push(text(0, 47, "(select)", { size: FS, fill: JOY }));
  const HI = 14, LO = 50;
  const pts = [[0, LO]];
  for (let k = 0; k < 8; k++) {
    const level = k % 2 === 0 ? LO : HI;
    if (k > 0) pts.push([k * 2, level]);
    pts.push([(k + 1) * 2, level]);
    if (k < 7) pts.push([(k + 1) * 2, k % 2 === 0 ? HI : LO]);
  }
  out.push(pathEl("M" + pts.map(([t, y]) => `${S.r(xs(t))},${y}`).join(" L"), { stroke: JOY, width: 2.2 }));
  for (let t = 0; t <= STEPS; t += 2) out.push(line(xs(t), 6, xs(t), 72, { dash: "3 3", opacity: 0.35 }));
  // --- connector per step: L R
  out.push(text(0, 92, "connector", { size: FS }));
  for (let t = 0; t < STEPS; t++) out.push(text(xs(t) + W / 2, 92, t % 2 === 0 ? "L" : "R", { size: FS, anchor: "middle" }));
  // --- what each pair reads
  const what = [
    [0, ["start", "afresh"], GREY],
    [4, ["pad?", "A, START"], MARK],
    [6, ["U D L R", "B, C"], JOY],
    [8, ["six", "buttons?"], MARK],
    [10, ["X Y Z", "MODE"], MARK]
  ];
  for (const [t, ls, c] of what) {
    out.push(pathEl(`M${S.r(xs(t) + 3)},104 L${S.r(xs(t) + 3)},110 L${S.r(xs(t + 2) - 3)},110 L${S.r(xs(t + 2) - 3)},104`, { stroke: c, width: 1.6 }));
    out.push(lines(xs(t + 1), 128, ls, { size: FS, anchor: "middle", fill: c, lh: 17 }));
  }
  out.push(text(0, 184, "16 steps of 4.57 µs, 73 µs; then a rest of 496 steps, 2.27 ms; the cycle repeats every 2.34 ms", { size: FS }));
  out.push(text(0, 206, "purple: what any joystick answers; red: questions only a Mega Drive pad answers", { size: FS }));
  figures.md = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
