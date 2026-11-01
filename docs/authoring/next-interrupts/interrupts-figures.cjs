#!/usr/bin/env node
// Figures of "Interrupts: Fourteen Voices, Two Wires"
// (docs/content/en/under-the-hood/emulator-internals/next-interrupts.mdx).
//
// Every figure is drawn from the rules; the timelines are to scale in CPU T-states. Run:
//   node docs/authoring/next-interrupts/interrupts-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-interrupts.mdx");

// --- One colour per kind of source in this chapter
const SCR = "#3b82f6"; // the screen's sources: the ULA and the line interrupt
const SER = "#30a46c"; // the UARTs
const CTC = "#e8912d"; // the CTC
const NMI = "#a855f7"; // the NMI and its sources
const WIN = "#e5484d"; // "taken", "in service", "lost"
const GREY = "currentColor";

const FH = 16.5, FT = 15, FS = 13.5;

/** A box with centred lines of text. */
function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined, opacity: o.faint ? 0.45 : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: the two wires
{
  const out = [svgOpen(700, 420, "The CPU on the right has two interrupt inputs. Above, the maskable sources, the line interrupt, the two UARTs' receive and transmit requests, the four CTC channels and the ULA's frame interrupt, feed the interrupt controller, which works in pulse mode or hardware IM2 mode as NextReg $C0 bit 0 chooses, and drives /INT. Below, the NMI sources, the M1 button, the DRIVE button, NextReg $02 and the I/O traps, feed the NMI arbiter, which drives /NMI.")];
  out.push(arrows("int-wires", [GREY, SCR, SER, CTC, NMI]));
  const a = (d, i = 0, dash) => out.push(pathEl(d, { stroke: [GREY, SCR, SER, CTC, NMI][i], width: 1.8, marker: `int-wires-${i}`, dash }));
  const srcs = [
    ["line interrupt", SCR, 1], ["UART 0 / 1 receive", SER, 2], ["CTC channels 0–3", CTC, 3],
    ["ULA frame interrupt", SCR, 1], ["UART 0 / 1 transmit", SER, 2]
  ];
  // --- every source joins one bus line at x = 232, which enters the controller with one arrow
  srcs.forEach(([label, c], i) => {
    const y = 6 + i * 46;
    blk(out, 0, y, 200, 36, [label], { c, fill: true, op: 0.1 });
    out.push(line(200, y + 18, 232, y + 18, { width: 1.8 }));
  });
  out.push(line(232, 24, 232, 208, { width: 1.8 }));
  a("M232,124 L256,124");
  blk(out, 260, 78, 220, 92, ["interrupt controller", "pulse or hardware IM2", "(NextReg $C0 bit 0)"], { bold: false });
  blk(out, 580, 150, 120, 120, ["Z80N", "CPU"], { bold: true, size: FH });
  a("M480,124 L540,124 L540,176 L576,176");
  out.push(text(492, 114, "/INT", { size: FT, bold: true }));
  const nsrc = [["M1 button (F9)", NMI], ["DRIVE button (F10)", NMI], ["NextReg $02", NMI], ["I/O trap", NMI]];
  nsrc.forEach(([label, c], i) => {
    const y = 252 + i * 42;
    blk(out, 0, y, 200, 32, [label], { c, size: FS + 0.5 });
    out.push(line(200, y + 16, 232, y + 16, { stroke: NMI, width: 1.8 }));
  });
  out.push(line(232, 268, 232, 394, { stroke: NMI, width: 1.8 }));
  a("M232,324 L256,324", 4);
  blk(out, 260, 284, 220, 80, ["NMI arbiter", "Multiface, DivMMC", "or expansion bus"], { c: NMI, fill: true });
  a("M480,324 L540,324 L540,244 L576,244", 4);
  out.push(text(492, 314, "/NMI", { size: FT, bold: true, fill: NMI }));
  figures.wires = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: fourteen voices in priority order
{
  const items = [
    ["line", SCR], ["UART 0", SER, "receive"], ["UART 1", SER, "receive"], ["CTC 0", CTC], ["CTC 1", CTC], ["CTC 2", CTC], ["CTC 3", CTC],
    ["CTC 4", CTC, "reserved"], ["CTC 5", CTC, "reserved"], ["CTC 6", CTC, "reserved"], ["CTC 7", CTC, "reserved"], ["ULA", SCR, "frame"], ["UART 0", SER, "transmit"], ["UART 1", SER, "transmit"]
  ];
  const w = 100, h = 74, y0 = 34, gap = 58;
  const H = y0 + 2 * h + gap + 46;
  const out = [svgOpen(700, H, "Fourteen boxes in two rows of seven, the interrupt sources in priority order, highest first, each with its index and the offset its vector adds. Index 0, the line interrupt, offset $00; 1, UART 0 receive, $02; 2, UART 1 receive, $04; 3 to 6, CTC channels 0 to 3, $06 to $0C; 7 to 10, CTC channels 4 to 7, reserved and never firing, $0E to $14; 11, the ULA's frame interrupt, $16; 12, UART 0 transmit, $18; 13, UART 1 transmit, $1A. The expansion bus comes after them all.")];
  out.push(arrows("int-chain", [GREY]));
  out.push(text(0, 20, "highest priority", { size: FS, bold: true }));
  out.push(text(700, 20, "each one passes its turn to the next", { size: FS, anchor: "end" }));
  items.forEach(([name, c, sub], i) => {
    const row = Math.floor(i / 7), col = i % 7;
    const x = col * w, y = y0 + row * (h + gap);
    const reserved = sub === "reserved";
    blk(out, x + 2, y, w - 4, h, [name, sub ?? " ", `${i} · +$${(i * 2).toString(16).toUpperCase().padStart(2, "0")}`], { c, fill: !reserved, op: 0.1, dash: reserved ? "5 4" : undefined, size: FS + 0.5 });
  });
  out.push(pathEl(`M${7 * w - 50},${y0 + h} L${7 * w - 50},${y0 + h + 22} L50,${y0 + h + 22} L50,${y0 + h + gap - 4}`, { width: 1.6, marker: "int-chain-0" }));
  out.push(text(0, H - 12, "index · vector offset;  dashed: no such channel in this core;  then the expansion bus", { size: FS }));
  figures.chain = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: pulse mode, taken and missed (to scale in T-states)
{
  const x0 = 130, T = 72, k = (700 - x0) / T;
  const X = (t) => x0 + t * k;
  const out = [svgOpen(700, 300, "Two timelines drawn to scale over 72 T-states, with /INT low for 32 T-states from T-state 8 to 40 in both. Above, interrupts enabled: instructions end at T-states 4, 15, 23 and 34, and the CPU takes the interrupt at the first end inside the pulse, at 15. Below, interrupts disabled until T-state 50: the instruction ends inside the pulse are ignored, the pulse ends at 40, and when EI takes effect at 50 nothing is left: the interrupt is lost, and only its status bit remembers it.")];
  out.push(arrows("int-pulse", [GREY, WIN]));
  for (let t = 0; t <= T; t += 8) {
    out.push(line(X(t), 30, X(t), 36, { width: 1.2 }));
    out.push(text(X(t), 22, String(t), { anchor: t === T ? "end" : "middle", size: FS }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const trace = (y, label, labelT = 40) => {
    out.push(text(0, y + 6, label, { size: FT, bold: true }));
    out.push(pathEl(`M${X(0)},${y - 14} L${X(8)},${y - 14} L${X(8)},${y + 14} L${X(40)},${y + 14} L${X(40)},${y - 14} L${X(T)},${y - 14}`, { width: 2 }));
    out.push(text(X(labelT) + 8, y + 19, "← /INT low for 32 T", { size: FS }));
  };
  // --- interrupts on
  trace(80, "EI");
  for (const t of [4, 15, 23, 34]) out.push(line(X(t), 52, X(t), 108, { width: 1, dash: "3 3" }));
  out.push(pathEl(`M${X(15)},134 L${X(15)},112`, { stroke: WIN, width: 1.8, marker: "int-pulse-1" }));
  out.push(text(X(15) + 8, 132, "taken at the first instruction end inside the pulse", { size: FS, fill: WIN }));
  // --- interrupts off until 50
  trace(210, "DI", 50); // --- the label starts after the EI line at 50
  out.push(rect(X(0), 176, X(50) - X(0), 62, { stroke: WIN, width: 1.2, fill: WIN, fillOpacity: 0.08, dash: "5 4" }));
  for (const t of [4, 15, 23, 34]) out.push(line(X(t), 182, X(t), 238, { width: 1, dash: "3 3", opacity: 0.5 }));
  out.push(line(X(50), 172, X(50), 242, { stroke: WIN, width: 1.8 }));
  out.push(text(700, 266, "EI takes effect at 50: the pulse is over, the interrupt is lost", { size: FS, fill: WIN, anchor: "end" }));
  out.push(text(X(0) + 6, 290, "dashed: instruction ends", { size: FS }));
  figures.pulse = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the hardware IM2 vector, with a worked example
{
  const x0 = 130, cw = (700 - x0) / 8;
  const out = [svgOpen(700, 250, "The vector byte, bit 7 on the left. Bits 7 to 5 come from NextReg $C0 bits 7 to 5; bits 4 to 1 are the source's index, 0 to 13; bit 0 is always 0. The worked example: NextReg $C0 holds $A1, so bits 7 to 5 are 101; CTC channel 0 has index 3, 0011; the vector is $A6, and with the I register at $BE the CPU reads the handler's address from $BEA6 and $BEA7.")];
  for (let b = 7; b >= 0; b--) out.push(text(x0 + (7 - b) * cw + cw / 2, 18, String(b), { anchor: "middle", size: FS }));
  out.push(lines(0, 52, ["vector", "byte"], { size: FT, bold: true, lh: 18 }));
  const fields = [[7, 5, ["NextReg $C0", "bits 7–5"], GREY], [4, 1, ["source index", "0–13"], CTC], [0, 0, ["0"], GREY]];
  for (const [hi, lo, label, c] of fields) {
    const x = x0 + (7 - hi) * cw, w = (hi - lo + 1) * cw;
    blk(out, x + 1, 28, w - 2, 52, label, { c: c === GREY ? undefined : c, fill: c !== GREY, op: 0.14, bold: true });
  }
  out.push(lines(0, 124, ["example", "CTC 0"], { size: FT, bold: true, lh: 18 }));
  const bits = "10100110";
  for (let i = 0; i < 8; i++) {
    const b = 7 - i;
    const c = b >= 1 && b <= 4 ? CTC : undefined;
    out.push(rect(x0 + i * cw + 1, 104, cw - 2, 44, { rx: 4, stroke: c ?? GREY, width: c ? 2 : 1.4, fill: c ?? "none", fillOpacity: c ? 0.14 : undefined }));
    out.push(text(x0 + i * cw + cw / 2, 132, bits[i], { anchor: "middle", size: FT, bold: true, fill: c ?? GREY }));
  }
  out.push(text(x0, 176, "$C0 = $A1 gives 101;  CTC 0 is index 3, 0011;  vector $A6", { size: FT }));
  out.push(text(x0, 202, "I = $BE: the handler's address is read from $BEA6 and $BEA7", { size: FT }));
  out.push(text(0, 238, "the highest vector is $C0's top bits + $1A, so a table needs only 28 bytes", { size: FS }));
  figures.vector = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the daisy chain with CTC 0 in service
{
  const items = [["line", SCR], ["UART 0|Rx", SER], ["UART 1|Rx", SER], ["CTC 0", CTC], ["CTC 1", CTC], ["CTC 2", CTC], ["CTC 3", CTC], ["ULA", SCR]];
  const w = 700 / 8, y = 64, h = 64;
  const out = [svgOpen(700, 198, "Eight devices of the chain in a row, from the line interrupt on the left to the ULA on the right, with CTC 0 in service, marked. The chain's permission passes from left to right: it reaches CTC 0 as 1, and leaves it as 0. The three devices before CTC 0, the line interrupt and the two UART receivers, may still interrupt, so a handler can be nested; the devices after it, CTC 1 to 3 and the ULA, are greyed out and must wait for CTC 0's RETI.")];
  items.forEach(([name, c], i) => {
    const x = i * w;
    const inService = i === 3, blocked = i > 3;
    blk(out, x + 6, y, w - 12, h, inService ? [name, "in service"] : name.split("|"), { c: inService ? WIN : c, fill: inService, op: 0.14, faint: blocked, bold: inService });
    if (i < 7) out.push(text(x + w, y - 10, i < 3 ? "1" : "0", { anchor: "middle", size: FT, bold: true, fill: i < 3 ? GREY : WIN }));
  });
  out.push(text(0, 22, "permission passed along the chain:", { size: FS }));
  out.push(pathEl(`M6,${y + h + 16} L6,${y + h + 26} L${3 * w - 6},${y + h + 26} L${3 * w - 6},${y + h + 16}`, { width: 1.5 }));
  out.push(lines(1.5 * w, y + h + 50, ["may still interrupt:", "a nested handler"], { anchor: "middle", size: FS, lh: 16 }));
  out.push(pathEl(`M${4 * w + 6},${y + h + 16} L${4 * w + 6},${y + h + 26} L${8 * w - 6},${y + h + 26} L${8 * w - 6},${y + h + 16}`, { stroke: WIN, width: 1.5 }));
  out.push(lines(6 * w, y + h + 50, ["must wait for CTC 0's RETI"], { anchor: "middle", size: FS, fill: WIN }));
  figures.daisy = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: a nested handler and a waiting one (not to scale: the order of events)
{
  const rows = [["main", GREY, 52], ["ULA (11)", SCR, 112], ["line (0)", SCR, 172], ["UART 0 Tx (12)", SER, 232]];
  const ev = [[180, 1], [300, 2], [350, 3], [420, 4], [500, 5], [580, 6]];
  const out = [svgOpen(700, 270, "Four rows, the main program, the ULA, the line interrupt and UART 0 transmit, along a line of time with six numbered moments. 1: the ULA rings and its handler starts; the main program stops. 2: the line interrupt rings and its handler runs inside the ULA's, which is paused but still in service. 3: UART 0 transmit rings and waits. 4: the line handler's RETI; the ULA's handler goes on. 5: the ULA handler's RETI; UART 0 transmit is taken at once and its handler runs. 6: its RETI; the main program goes on.")];
  for (const [label, c, y] of rows) out.push(text(0, y + 20, label, { size: FS + 0.5, bold: true, fill: c }));
  for (const [x, n] of ev) {
    out.push(line(x, 32, x, 262, { width: 1, dash: "3 3", opacity: 0.6 }));
    out.push(`  <circle cx="${x}" cy="16" r="12" fill="${WIN}" />`);
    out.push(text(x, 21, String(n), { anchor: "middle", size: FS, bold: true, fill: "#ffffff" }));
  }
  const bar = (x0, x1, y, c, label, o = {}) => {
    out.push(rect(x0, y, x1 - x0, 32, { rx: 4, stroke: c, width: o.dash ? 1.6 : 2, dash: o.dash, fill: o.dash ? "none" : c, fillOpacity: o.dash ? undefined : (c === GREY ? 0.12 : 0.16) }));
    out.push(text(o.lx ?? (x0 + x1) / 2, y + 21, label, { anchor: "middle", size: FS, fill: c === GREY ? GREY : c, bold: !o.dash }));
  };
  bar(130, 180, 52, GREY, "runs"); bar(580, 700, 52, GREY, "runs on");
  bar(180, 300, 112, SCR, "handler"); bar(300, 420, 112, SCR, "paused", { dash: "5 4", lx: 385 }); bar(420, 500, 112, SCR, "handler");
  bar(300, 420, 172, SCR, "handler");
  bar(350, 500, 232, WIN, "waiting", { dash: "5 4", lx: 460 }); bar(500, 580, 232, SER, "handler");
  figures.nesting = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: how fast the CPU answers (to scale in T-states)
{
  const x0 = 130, T = 48, k = (700 - x0) / T;
  const X = (t) => x0 + t * k;
  const out = [svgOpen(700, 250, "A timeline drawn to scale over 48 T-states. The request arrives at T-state 0, at the start of the longest instruction, 23 T-states long, which runs to its end; the CPU decides one T-state before the end, so up to 22 T-states pass before the answer starts. Then the IM 2 acknowledge takes 19 T-states: 7 for the acknowledge cycle with its two waits, 6 for pushing the return address, 6 for reading the handler's address. The handler's first instruction starts at T-state 42.")];
  for (let t = 0; t <= T; t += 6) {
    out.push(line(X(t), 30, X(t), 36, { width: 1.2 }));
    out.push(text(X(t), 22, String(t), { anchor: t === T ? "end" : "middle", size: FS }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const bar = (y, t0, t1, label, c, sub) => {
    out.push(rect(X(t0), y, X(t1) - X(t0), 40, { rx: 4, stroke: c ?? GREY, width: c ? 2 : 1.4, fill: c ?? "none", fillOpacity: c ? 0.12 : undefined }));
    out.push(text((X(t0) + X(t1)) / 2, y + 25, label, { anchor: "middle", size: FS, fill: c ?? GREY, bold: !!c }));
    if (sub) out.push(text(0, y + 25, sub, { size: FT, bold: true }));
  };
  bar(52, 0, 23, "an instruction of 23 T", undefined, "CPU");
  bar(52, 23, 30, "ack", WIN);
  bar(52, 30, 36, "push PC", WIN);
  bar(52, 36, 42, "vector", WIN);
  bar(52, 42, 48, "handler", SCR);
  out.push(pathEl(`M${X(0)},116 L${X(0)},100`, { width: 1.6, marker: undefined }));
  out.push(text(X(0), 136, "request", { size: FS }));
  out.push(pathEl(`M${X(22)},130 L${X(22)},100`, { width: 1.6 }));
  out.push(text(X(22), 150, "decision, 1 T before the end", { size: FS, anchor: "middle" }));
  out.push(pathEl(`M${X(23)},170 L${X(23)},178 L${X(42)},178 L${X(42)},170`, { stroke: WIN, width: 1.5 }));
  out.push(text((X(23) + X(42)) / 2, 200, "IM 2 acknowledge: 19 T (IM 1: 13 T)", { anchor: "middle", size: FS, fill: WIN }));
  out.push(text(0, 238, "waiting for the instruction to end: 0 to 22 T, 0 to 44 dots at 3.5 MHz (without waits)", { size: FS }));
  figures.latency = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the NMI arbiter
{
  const out = [svgOpen(700, 380, "The NMI's sources on the left: the M1 button, a NextReg $02 bit 3 write and an I/O trap ask for a Multiface NMI, allowed by NextReg $06 bit 3; the DRIVE button and a NextReg $02 bit 2 write ask for a DivMMC NMI, allowed by NextReg $06 bit 4; the expansion bus can ask too. The arbiter takes the Multiface first, unless the DivMMC is mapped in or port $E3 bit 7 is set; then the DivMMC, unless the Multiface is active; then the bus. Then /NMI goes low, through the states idle, fetch until the fetch at $0066, hold while the device holds, and end.")];
  out.push(arrows("int-nmi", [GREY, NMI]));
  const a = (d, i = 1) => out.push(pathEl(d, { stroke: [GREY, NMI][i], width: 1.8, marker: `int-nmi-${i}` }));
  blk(out, 0, 6, 196, 96, ["M1 button (F9)", "NextReg $02 bit 3", "I/O trap"], { c: NMI, size: FS + 0.5 });
  blk(out, 0, 124, 196, 72, ["DRIVE button (F10)", "NextReg $02 bit 2"], { c: NMI, size: FS + 0.5 });
  blk(out, 0, 218, 196, 40, ["expansion bus"], { c: NMI, size: FS + 0.5 });
  blk(out, 236, 30, 120, 48, ["$06 bit 3"], { size: FS + 0.5 });
  blk(out, 236, 136, 120, 48, ["$06 bit 4"], { size: FS + 0.5 });
  a("M196,54 L232,54"); a("M196,160 L232,160");
  blk(out, 396, 6, 304, 252, ["arbiter, in this order:", "1. Multiface, unless the", "DivMMC is mapped in or", "port $E3 bit 7 is set", "2. DivMMC, unless the", "Multiface is active", "3. the expansion bus"], { c: NMI, fill: true, op: 0.08, size: FS + 0.5 });
  a("M356,54 L392,54"); a("M356,160 L392,160"); a("M196,238 L392,238");
  const st = ["idle", "fetch", "hold", "end"];
  const sw = 700 / 4;
  st.forEach((name, i) => {
    blk(out, i * sw + 8, 300, sw - 40, 44, [name], { c: i === 1 ? WIN : undefined, bold: true, size: FT });
    if (i < 3) out.push(pathEl(`M${i * sw + sw - 32},322 L${(i + 1) * sw + 4},322`, { width: 1.8, marker: "int-nmi-0" }));
  });
  a("M548,258 L548,280 L68,280 L68,296");
  out.push(text(0, 372, "/NMI is low from the moment a source is taken until the fetch at $0066", { size: FS, fill: WIN }));
  figures.nmi = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: an ordinary NMI against a stackless one
{
  const out = [svgOpen(700, 300, "Two columns. Left, an ordinary NMI: the CPU pushes the return address, $8123, to the stack, SP goes down by 2, and the two bytes are written to memory; RETN pops them back. Right, a stackless NMI, NextReg $C0 bit 3 set: the CPU runs the same two push cycles and SP still goes down by 2, but the memory request is held off, so nothing is written; the return address is in NextRegs $C2 and $C3, and the first RETN reads it from there.")];
  out.push(arrows("int-stk", [GREY, NMI]));
  const col = (x, title, stack, regs, note) => {
    out.push(text(x, 22, title, { size: FH, bold: true }));
    blk(out, x + 90, 40, 150, 50, ["PC = $8123"], { bold: true });
    out.push(pathEl(`M${x + 140},90 L${x + 140},110 L${x + 75},110 L${x + 75},128`, { stroke: stack ? GREY : NMI, width: 1.8, marker: stack ? "int-stk-0" : "int-stk-1" }));
    out.push(pathEl(`M${x + 190},90 L${x + 190},110 L${x + 260},110 L${x + 260},128`, { stroke: NMI, width: 1.8, marker: "int-stk-1" }));
    blk(out, x, 132, 150, 70, stack ? ["stack:", "$23, $81"] : ["memory", "untouched"], { c: stack ? undefined : NMI, fill: !stack, op: 0.08 });
    blk(out, x + 190, 132, 140, 70, regs, { c: NMI, fill: true, op: 0.12 });
    out.push(lines(x, 232, note, { size: FS, lh: 18 }));
  };
  col(0, "ordinary NMI", true, ["$C2 = $23", "$C3 = $81"], ["SP − 2; the address is pushed,", "and $C2/$C3 record it too;", "RETN pops the stack"]);
  col(360, "stackless NMI", false, ["$C2 = $23", "$C3 = $81"], ["SP − 2 as well, but the push", "writes no memory; the first", "RETN reads $C2/$C3"]);
  figures.stackless = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
