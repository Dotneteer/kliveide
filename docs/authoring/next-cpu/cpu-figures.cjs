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

// A numbered step marker, drawn like the badges of the list under the figure (custom.css,
// "article figure + ol"): the site's accent square with the number in the accent's text colour.
function badge(out, cx, cy, n) {
  out.push(`  <rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="4" style={{ fill: "var(--site-accent)" }} />`);
  out.push(`  <text x="${cx}" y="${cy + 5}" textAnchor="middle" fontSize="${FS}" fontWeight="bold" style={{ fill: "var(--site-on-accent)" }}>${n}</text>`);
}

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
  const out = [svgOpen(700, 376, "The opcode fetch over four T-states, T1 to T4, drawn to scale. The address bus carries PC during T1 and T2 and the refresh address, I in the high half and R in the low half, during T3 and T4. /M1 is low from the start of T1 to the start of T3. /MREQ and /RD go low half way through T1 and rise at the start of T3, where the CPU takes the opcode from the data bus. /RFSH is low through T3 and T4, and /MREQ gives a second, short pulse from the middle of T3 to the middle of T4 for the refresh.")];
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
  out.push(line(X(2), 290, X(2), 348, { stroke: WAIT, width: 2 }));
  out.push(text(X(2) + 8, 292, "taken here", { size: FS, fill: WAIT }));
  // --- the steps of the list under the figure: 1 is T1, 2 is T2, 3 the moment the byte is taken,
  // 4 the refresh in T3 and T4
  const yb = 360;
  badge(out, X(0.5), yb, 1);
  badge(out, X(1.5), yb, 2);
  badge(out, X(2), yb, 3);
  badge(out, X(3), yb, 4);
  out.push(text(X(1), yb + 5, "fetch", { anchor: "middle", size: FS }));
  out.push(text(X(3) + 20, yb + 5, "refresh, R + 1", { size: FS }));
  figures.m1 = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figures: memory read, memory write and I/O, drawn like the opcode fetch. Edges are on the clock's
// half T-states, as in Zilog's timing figures: t = 1.5 is the falling edge in the middle of T2.
//   states: the T-state names; address: [label, colour], or bands: [[label, from, to, colour]];
//   wait: null leaves the /WAIT row out; sig: [name, [[from, to] low], colour];
//   data: [name, from, to, colour, label]; take: the moment the CPU takes the byte, or null;
//   wait: when /WAIT is sampled; takeLeft: a short label left of the line, where the right has no room; badges: the moment of each numbered step of the list below.
function busCycle(label, o) {
  const x0 = 130, T = o.states.length, k = (700 - x0) / T, X = (t) => x0 + t * k;
  const rows = o.sig.length + (o.wait === null ? 0 : 1) + o.data.length;
  const y0 = 112, step = 52, yEnd = y0 + (rows - 1) * step + 18;
  const yb = yEnd + 20, H = yb + 16;
  const out = [svgOpen(700, H, label)];
  for (let t = 0; t <= T; t++) out.push(line(X(t), 26, X(t), yEnd, { width: 1, dash: "3 4", opacity: 0.5 }));
  o.states.forEach((n, t) => out.push(text(X(t + 0.5), 18, n, { anchor: "middle", size: FT, bold: true, fill: n === "TW" ? WAIT : GREY })));
  const ya = 54;
  out.push(text(0, ya + 5, "address", { size: FT }));
  for (const [t, a, b, c] of o.bands ?? [[o.address[0], 0, T, o.address[1]]])
    blk(out, X(a), ya - 16, X(b) - X(a), 32, [t], { c, fill: true, bold: true });
  let y = y0;
  for (const [name, lows, c] of o.sig) {
    const hi = y - 12, lo = y + 12;
    out.push(text(0, y + 5, name, { size: FT, bold: true }));
    let d = `M${X(0)},${hi}`;
    for (const [a, b] of lows) d += ` L${X(a)},${hi} L${X(a)},${lo} L${X(b)},${lo} L${X(b)},${hi}`;
    out.push(pathEl(d + ` L${X(T)},${hi}`, { stroke: c, width: 2 }));
    y += step;
  }
  // /WAIT: high (nobody asks for time), with the moment the CPU looks at it
  if (o.wait !== null) {
    out.push(text(0, y + 5, "/WAIT", { size: FT, bold: true }));
    out.push(line(X(0), y - 12, X(T), y - 12, { width: 2, opacity: 0.5 }));
    out.push(line(X(o.wait), y - 22, X(o.wait), y + 4, { stroke: WAIT, width: 2 }));
    out.push(text(X(o.wait) + 8, y + 6, "sampled", { size: FS, fill: WAIT }));
    y += step;
  }
  const yData = y;
  for (const [name, a, b, c, t] of o.data) {
    out.push(text(0, y + 5, name, { size: FT }));
    blk(out, X(a), y - 14, X(b) - X(a), 28, [t], { c, fill: true, size: FS });
    y += step;
  }
  if (o.take !== null) {
    const yt = yData + (o.takeRow ?? 0) * step;
    out.push(line(X(o.take), yt - 32, X(o.take), yb - 12, { stroke: WAIT, width: 2 }));
    out.push(o.takeLeft
      ? text(X(o.take) - 8, yt - 20, "taken", { anchor: "end", size: FS, fill: WAIT })
      : text(X(o.take) + 8, yt - 30, "taken here", { size: FS, fill: WAIT }));
  }
  o.badges.forEach((t, i) => badge(out, X(t), yb, i + 1));
  return [...out, "</svg>"];
}

figures.mread = busCycle("A memory read over three T-states, T1 to T3, drawn to scale. The address is on the bus for all three. /MREQ and /RD go low half way through T1 and rise half way through T3. The CPU samples /WAIT half way through T2 and takes the byte from the data bus half way through T3.", {
  states: ["T1", "T2", "T3"],
  address: ["memory address", ZILOG],
  sig: [["/MREQ", [[0.5, 2.5]], GREY], ["/RD", [[0.5, 2.5]], ZILOG]],
  wait: 1.5,
  data: [["data in", 1.6, 2.5, READ, "byte"]],
  take: 2.5,
  badges: [0.5, 1.5, 2.5]
});

figures.mwrite = busCycle("A memory write over three T-states, T1 to T3, drawn to scale. The address is on the bus for all three. /MREQ goes low half way through T1 and the byte goes on the data bus at the same time, staying to the end of T3. /WR goes low half way through T2, when the CPU also samples /WAIT, and rises with /MREQ half way through T3.", {
  states: ["T1", "T2", "T3"],
  address: ["memory address", ZILOG],
  sig: [["/MREQ", [[0.5, 2.5]], GREY], ["/WR", [[1.5, 2.5]], ZILOG]],
  wait: 1.5,
  data: [["data out", 0.5, 3, ZILOG, "byte"]],
  take: null,
  badges: [0.5, 1.5, 2.5]
});

figures.io = busCycle("An I/O cycle over four T-states, T1, T2, the automatic wait state TW and T3, drawn to scale. The 16-bit port address is on the bus for all four. /IORQ goes low at the start of T2, with /RD for an IN or /WR for an OUT, and they rise half way through T3. The CPU samples /WAIT half way through TW. An IN takes the byte half way through T3; an OUT puts its byte on the data bus half way through T1 and keeps it there to the end of T3.", {
  states: ["T1", "T2", "TW", "T3"],
  address: ["port address: BC, or A : n", ZILOG],
  sig: [["/IORQ", [[1, 3.5]], GREY], ["/RD (IN)", [[1, 3.5]], READ], ["/WR (OUT)", [[1, 3.5]], ZILOG]],
  wait: 2.5,
  data: [["data, OUT", 0.5, 4, ZILOG, "byte"], ["data, IN", 2.6, 3.5, READ, "byte"]],
  take: 3.5,
  takeRow: 1,
  takeLeft: true,
  badges: [0.5, 1, 2.5, 3.5]
});

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
// Figures: the interrupt acknowledge, the three responses to scale, and the instruction after EI
figures.intack = busCycle("The interrupt acknowledge cycle over six T-states, T1, T2, two automatic wait states and T3 and T4, drawn to scale. The address bus carries PC up to T3 and the refresh address, I and R, in T3 and T4. /M1 is low from the start of T1 to the start of T3. /MREQ and /RD stay high until the refresh, so no memory is read; /MREQ gives only the refresh pulse in T3 and T4. /IORQ goes low half way through the first wait state and rises at the start of T3, where the CPU takes the vector byte from the data bus. /RFSH is low in T3 and T4.", {
  states: ["T1", "T2", "TW", "TW", "T3", "T4"],
  bands: [["PC", 0, 4, ZILOG], ["I : R", 4, 6, UNDOC]],
  sig: [["/M1", [[0, 4]], ZILOG], ["/MREQ", [[4.5, 5.5]], GREY], ["/IORQ", [[2.5, 4]], WAIT], ["/RFSH", [[4, 6]], UNDOC]],
  wait: null,
  data: [["data in", 3.1, 4, READ, "vector"]],
  take: 4,
  takeLeft: true,
  badges: [0.5, 2.5, 4, 5]
});

{
  const x0 = 150, T = 21, k = (700 - x0) / T, X = (t) => x0 + t * k;
  const out = [svgOpen(700, 270, "Three bars to scale in T-states. IM 0 with the Next's $FF, and IM 1: an acknowledge of 7 and two writes of 3 that push the return address, 13 T-states, then $0038. IM 2: the same 13, and two reads of 3 that fetch the handler's address from the table at I and the vector, 19 T-states. NMI: an opcode fetch of 5 whose byte is ignored and the two pushes, 11 T-states, then $0066.")];
  for (let t = 0; t <= 20; t += 1) {
    out.push(line(X(t), 30, X(t), 36, { width: 1.2 }));
    if (t % 2 === 0) out.push(text(X(t), 22, String(t), { anchor: "middle", size: FS }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const rows = [
    ["IM 0, IM 1", "then $0038", [["acknowledge", 7, ZILOG], ["push", 3, UNDOC], ["push", 3, UNDOC]]],
    ["IM 2", "then (I : vector)", [["acknowledge", 7, ZILOG], ["push", 3, UNDOC], ["push", 3, UNDOC], ["read", 3, READ], ["read", 3, READ]]],
    ["NMI", "then $0066", [["fetch", 5, GREY], ["push", 3, UNDOC], ["push", 3, UNDOC]]]
  ];
  rows.forEach(([name, dest, cyc], i) => {
    const y = 50 + i * 72;
    out.push(text(0, y + 18, name, { size: FT, bold: true }));
    out.push(text(0, y + 37, dest, { size: FS }));
    let t = 0;
    for (const [label, n, c] of cyc) {
      blk(out, X(t), y, n * k, 44, [label], { c: c === GREY ? undefined : c, fill: c !== GREY, size: FS });
      t += n;
    }
    out.push(text(X(t) + 8, y + 27, `${t} T`, { size: FT, bold: true }));
  });
  out.push(text(0, 262, "push: a memory write of the return address; read: the handler's address from the table", { size: FS }));
  figures.intresp = [...out, "</svg>"];
}

{
  const x0 = 130, T = 48, k = (700 - x0) / T, X = (t) => x0 + t * k;
  const out = [svgOpen(700, 226, "A timeline to scale over 48 T-states at the end of an interrupt handler. /INT is held low by a 32 T-state pulse from T-state 1 to 33. The instructions are POP HL, 10 T-states, EI, 4, and RETI, 14. The CPU looks at /INT one T-state before each instruction ends: at 9 it ignores it, because IFF1 is 0; at 13 it ignores it, because the instruction just ending is EI; at 27, after RETI, it takes it, and answers the interrupt when RETI ends at 28.")];
  for (let t = 0; t <= T; t += 4) {
    out.push(line(X(t), 30, X(t), 36, { width: 1.2 }));
    if (t < T) out.push(text(X(t), 22, String(t), { anchor: "middle", size: FS }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  // /INT, a 32-T pulse
  const yi = 70;
  out.push(text(0, yi + 5, "/INT", { size: FT, bold: true }));
  out.push(pathEl(`M${X(0)},${yi - 12} L${X(1)},${yi - 12} L${X(1)},${yi + 12} L${X(33)},${yi + 12} L${X(33)},${yi - 12} L${X(T)},${yi - 12}`, { stroke: WAIT, width: 2 }));
  // the instructions
  const yr = 110;
  out.push(text(0, yr + 26, "instructions", { size: FT }));
  const ins = [["POP HL", 10, ZILOG], ["EI", 4, ZILOG], ["RETI", 14, ZILOG]];
  let t = 0;
  for (const [label, n, c] of ins) {
    blk(out, X(t), yr, n * k, 42, [label], { c, fill: true, size: FS });
    t += n;
  }
  // the moments the CPU looks at /INT
  const looks = [[9, "IFF1 is 0: ignored", GREY], [13, "just after EI: ignored", GREY], [27, "taken: answered as soon as RETI ends", WAIT]];
  looks.forEach(([at, label, c], i) => {
    const y = 176 + i * 22;
    out.push(line(X(at), yi + 14, X(at), y - 4, { stroke: c === GREY ? WAIT : c, width: 2, dash: c === GREY ? "4 3" : undefined }));
    out.push(i !== 1
      ? text(X(at) - 6, y, label, { anchor: "end", size: FS, fill: c === GREY ? GREY : c })
      : text(X(at) + 6, y, label, { size: FS, fill: c === GREY ? GREY : c }));
  });
  figures.eishadow = [...out, "</svg>"];
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
