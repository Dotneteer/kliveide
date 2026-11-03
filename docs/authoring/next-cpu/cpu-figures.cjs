#!/usr/bin/env node
// Figures of "The Z80N: A Familiar Heart and Twenty-Nine New Tricks"
// (docs/content/en/under-the-hood/emulator-internals/next-cpu.mdx).
//
// The timelines are to scale in CPU T-states. Run:
//   node docs/authoring/next-cpu/cpu-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-cpu.mdx");

const ZILOG = "#3b82f6"; // Zilog's own (documented) behaviour
const UNDOC = "#a855f7"; // undocumented Zilog behaviour
const Z80N = "#e8912d"; // the Z80N's additions
const WAIT = "#e5484d"; // wait states, the hidden opcode
const READ = "#30a46c"; // reads (the y bits in PIXELAD)
const GREY = "currentColor";
const FH = 16.5, FT = 15, FS = 13.5;

function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 4, stroke: o.c ?? GREY, width: o.c ? 2 : 1.4, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined, opacity: o.faint }));
  if (t.length) out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: the opcode fetch, signal by signal, in half T-states
{
  const x0 = 130, T = 4, k = (700 - x0) / T, X = (t) => x0 + t * k;
  const out = [svgOpen(700, 372, "The opcode fetch over four T-states, T1 to T4, drawn to scale. The address bus carries PC during T1 and T2 and the refresh address, I in the high half and R in the low half, during T3 and T4. /M1 is low from the start of T1 to the start of T3. /MREQ and /RD go low half way through T1 and rise at the start of T3, where the CPU takes the opcode from the data bus. /RFSH is low through T3 and T4, and /MREQ gives a second, short pulse from the middle of T3 to the middle of T4 for the refresh.")];
  // --- T-state grid
  for (let t = 0; t <= T; t++) out.push(line(X(t), 26, X(t), 340, { width: 1, dash: "3 4", opacity: 0.5 }));
  for (let t = 0; t < T; t++) out.push(text(X(t + 0.5), 18, `T${t + 1}`, { anchor: "middle", size: FT, bold: true }));
  // --- address bus as two bands
  const ya = 54;
  out.push(text(0, ya + 5, "address", { size: FT }));
  blk(out, X(0), ya - 16, X(2) - X(0), 32, ["PC"], { c: ZILOG, fill: true, bold: true });
  blk(out, X(2), ya - 16, X(4) - X(2), 32, ["I (high) : R (low)"], { c: UNDOC, fill: true, bold: true });
  // --- active-low signals: [name, [[from, to] low intervals], colour]
  const sig = [
    ["/M1", [[0, 2]], ZILOG],
    ["/MREQ", [[0.5, 2], [2.5, 3.5]], GREY],
    ["/RD", [[0.5, 2]], ZILOG],
    ["/RFSH", [[2, 4]], UNDOC]
  ];
  sig.forEach(([name, lows, c], i) => {
    const y = 112 + i * 52, hi = y - 12, lo = y + 12;
    out.push(text(0, y + 5, name, { size: FT, bold: true }));
    let d = `M${X(0)},${lows[0][0] === 0 ? lo : hi}`;
    let level = lows[0][0] === 0 ? lo : hi;
    for (const [a, b] of lows) {
      if (level !== lo) d += ` L${X(a)},${hi} L${X(a)},${lo}`;
      d += ` L${X(b)},${lo} L${X(b)},${hi}`;
      level = hi;
    }
    d += ` L${X(T)},${hi}`;
    out.push(pathEl(d, { stroke: c, width: 2 }));
  });
  // --- data bus: opcode taken at the start of T3
  const yd = 322;
  out.push(text(0, yd + 5, "data", { size: FT }));
  blk(out, X(1.2), yd - 14, X(2) - X(1.2), 28, ["opcode"], { c: READ, fill: true, size: FS });
  out.push(line(X(2), 290, X(2), yd + 18, { stroke: WAIT, width: 2 }));
  out.push(text(X(2) + 8, 292, "taken here", { size: FS, fill: WAIT }));
  out.push(text(X(1), 356, "fetch", { anchor: "middle", size: FS }));
  out.push(text(X(3), 356, "refresh, R + 1", { anchor: "middle", size: FS }));
  figures.m1 = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: LD A,(nn) and LD (nn),A at 3.5 MHz and 28 MHz
{
  const x0 = 150, T = 17, k = (700 - x0) / 19, X = (t) => x0 + t * k;
  const out = [svgOpen(700, 300, "Four bars to scale in T-states. LD A,(nn) at 3.5 MHz: an opcode fetch of 4, two operand reads of 3 and a data read of 3, 13 T-states. LD A,(nn) at 28 MHz: each of the four reads gets one wait state, 5, 4, 4 and 4, 17 T-states. LD (nn),A at 3.5 MHz: fetch 4, two reads of 3 and a write of 3, 13. LD (nn),A at 28 MHz: the three reads get a wait state each and the write none, 5, 4, 4 and 3, 16 T-states.")];
  for (let t = 0; t <= T; t++) {
    out.push(line(X(t), 30, X(t), 36, { width: 1.2 }));
    out.push(text(X(t), 22, String(t), { anchor: "middle", size: FS }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const rows = [
    ["LD A,(nn)", "3.5 MHz", [["M1", 4], ["read", 3], ["read", 3], ["read", 3]], false],
    ["LD A,(nn)", "28 MHz", [["M1", 4], ["read", 3], ["read", 3], ["read", 3]], true],
    ["LD (nn),A", "3.5 MHz", [["M1", 4], ["read", 3], ["read", 3], ["write", 3]], false],
    ["LD (nn),A", "28 MHz", [["M1", 4], ["read", 3], ["read", 3], ["write", 3]], true]
  ];
  rows.forEach(([ins, speed, cyc, fast], i) => {
    const y = 48 + i * 60 + (i >= 2 ? 10 : 0);
    out.push(text(0, y + 18, ins, { size: FT, bold: true }));
    out.push(text(0, y + 36, speed, { size: FS }));
    let t = 0;
    for (const [name, n] of cyc) {
      const isRead = name !== "write";
      blk(out, X(t), y, n * k, 42, [name], { c: isRead ? READ : ZILOG, fill: true, size: FS });
      t += n;
      if (fast && isRead) {
        blk(out, X(t), y, k, 42, ["W"], { c: WAIT, fill: true, op: 0.2, size: FS, bold: true });
        t += 1;
      }
    }
    out.push(text(X(t) + 6, y + 26, `${t} T`, { size: FT, bold: true }));
  });
  figures.wait = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the flag register
{
  const out = [svgOpen(700, 176, "The flag register's eight bits, bit 7 on the left. Bit 7 S, the sign; bit 6 Z, zero; bit 5 Y, undocumented, usually bit 5 of the result; bit 4 H, half carry; bit 3 X, undocumented, usually bit 3 of the result; bit 2 P/V, parity or overflow; bit 1 N, subtract; bit 0 C, carry.")];
  const bits = [["S", ["sign"]], ["Z", ["zero"]], ["Y", ["bit 5 of", "the result"]], ["H", ["half", "carry"]], ["X", ["bit 3 of", "the result"]], ["P/V", ["parity or", "overflow"]], ["N", ["subtract"]], ["C", ["carry"]]];
  const w = 700 / 8;
  bits.forEach(([name, role], i) => {
    const x = i * w, undoc = name === "X" || name === "Y";
    out.push(text(x + w / 2, 18, `bit ${7 - i}`, { anchor: "middle", size: FS }));
    blk(out, x + 2, 30, w - 4, 52, [name], { c: undoc ? UNDOC : ZILOG, fill: true, op: undoc ? 0.18 : 0.08, dash: undoc ? "5 4" : undefined, bold: true, size: FH });
    out.push(lines(x + w / 2, 106, role, { anchor: "middle", size: FS, fill: undoc ? UNDOC : GREY, lh: 17 }));
  });
  out.push(text(0, 166, "dashed: undocumented by Zilog", { size: FS, fill: UNDOC }));
  figures.flags = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the ED page
{
  const DOC = new Set([
    0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4d, 0x4f,
    0x50, 0x51, 0x52, 0x53, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x5b, 0x5e, 0x5f,
    0x60, 0x61, 0x62, 0x67, 0x68, 0x69, 0x6a, 0x6f, 0x72, 0x73, 0x78, 0x79, 0x7a, 0x7b,
    0xa0, 0xa1, 0xa2, 0xa3, 0xa8, 0xa9, 0xaa, 0xab, 0xb0, 0xb1, 0xb2, 0xb3, 0xb8, 0xb9, 0xba, 0xbb
  ]);
  const UND = new Set([0x4c, 0x4e, 0x54, 0x55, 0x5c, 0x5d, 0x63, 0x64, 0x65, 0x66, 0x6b, 0x6c, 0x6d, 0x6e, 0x70, 0x71, 0x74, 0x75, 0x76, 0x7c, 0x7d, 0x7e]);
  const ZN = new Set([0x23, 0x24, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x8a, 0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x98, 0xa4, 0xa5, 0xac, 0xb4, 0xb7, 0xbc]);
  const lx = 36, cw = (700 - lx) / 16, ch = 24, y0 = 30;
  const H = y0 + 16 * ch + 58;
  const out = [svgOpen(700, H, "A grid of 16 by 16 cells, the opcodes ED 00 to ED FF, the high digit by row and the low digit by column. Zilog's documented instructions fill most of rows 4 to 7 and the block instructions at A0 to A3, A8 to AB, B0 to B3 and B8 to BB. Zilog's undocumented ones fill the rest of rows 4 to 7 except 77 and 7F. The Z80N's 29 instructions are at 23, 24, 27, 28 to 2C, 30 to 36, 8A, 90 to 95, 98, A4, A5, AC, B4, B7 and BC. ED B6, off the list, acts as LDIRX. Every other cell is an 8 T-state NOP.")];
  const hx = (v) => v.toString(16).toUpperCase();
  for (let c = 0; c < 16; c++) out.push(text(lx + c * cw + cw / 2, 20, `x${hx(c)}`, { anchor: "middle", size: FS }));
  for (let r0 = 0; r0 < 16; r0++) {
    const y = y0 + r0 * ch;
    out.push(text(0, y + ch / 2 + 5, `${hx(r0)}x`, { size: FS }));
    for (let c = 0; c < 16; c++) {
      const op = r0 * 16 + c, x = lx + c * cw;
      let o = { faint: 0.25 };
      if (DOC.has(op)) o = { c: ZILOG, fill: true, op: 0.22 };
      else if (UND.has(op)) o = { c: UNDOC, fill: true, op: 0.22 };
      else if (ZN.has(op)) o = { c: Z80N, fill: true, op: 0.3 };
      else if (op === 0xb6) o = { c: WAIT, dash: "4 3" };
      const label = o.c ? [hx(op).padStart(2, "0")] : [];
      blk(out, x + 1, y + 1, cw - 2, ch - 2, label, { ...o, rx: 2, size: FS, tc: GREY });
    }
  }
  const ly = y0 + 16 * ch + 24;
  const legend = [["Zilog", ZILOG, {}], ["Zilog, undocumented", UNDOC, {}], ["Z80N", Z80N, {}], ["ED B6: acts as LDIRX", WAIT, { dash: "4 3" }], ["empty: 8 T NOP", null, {}]];
  let lxp = 0;
  const widths = [90, 190, 80, 200, 140];
  legend.forEach(([name, c, o], i) => {
    blk(out, lxp, ly, 20, 18, [], c ? { c, fill: !o.dash, op: 0.25, dash: o.dash } : { faint: 0.25 });
    out.push(text(lxp + 26, ly + 14, name, { size: FS }));
    lxp += widths[i];
  });
  figures.edmap = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: PIXELAD's bit mapping
{
  const w = 700 / 16;
  const out = [svgOpen(700, 254, "Above, the sixteen bits of D and E: D holds the row, y7 to y0, E the column, x7 to x0. Below, the sixteen bits of HL that PIXELAD builds. H is 0, 1, 0, then y7, y6, then y2, y1, y0. L is y5, y4, y3, then x7, x6, x5, x4, x3. The column's low bits x2, x1 and x0 are not in the address; SETAE turns them into the dot's bit in the byte.")];
  const cell = (i, y, label, c) => blk(out, i * w + 1, y, w - 2, 36, [label], c ? { c, fill: true, op: 0.16, size: FS } : { size: FS });
  out.push(text(0, 18, "D: the row (y)", { size: FT, bold: true, fill: READ }));
  out.push(text(350, 18, "E: the column (x)", { size: FT, bold: true, fill: Z80N }));
  for (let i = 0; i < 8; i++) cell(i, 28, `y${7 - i}`, READ);
  for (let i = 0; i < 8; i++) cell(8 + i, 28, `x${7 - i}`, i >= 5 ? WAIT : Z80N);
  out.push(text(0, 112, "H", { size: FT, bold: true }));
  out.push(text(350, 112, "L", { size: FT, bold: true }));
  const hl = [["0"], ["1"], ["0"], ["y7", READ], ["y6", READ], ["y2", READ], ["y1", READ], ["y0", READ], ["y5", READ], ["y4", READ], ["y3", READ], ["x7", Z80N], ["x6", Z80N], ["x5", Z80N], ["x4", Z80N], ["x3", Z80N]];
  hl.forEach(([l, c], i) => cell(i, 122, l, c));
  out.push(lines(0, 190, ["H starts with 010: the screen begins at $4000. The row's bits", "are split into its third, its character row and its dot row."], { size: FS, lh: 18 }));
  out.push(text(0, 244, "x2–x0 (red) are not in the address: SETAE makes them A = $80 >> (x & 7).", { size: FS, fill: WAIT }));
  figures.pixelad = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
