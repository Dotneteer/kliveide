#!/usr/bin/env node
// Figures of "DMA: One Bus, Two Masters"
// (docs/content/en/under-the-hood/emulator-internals/next-dma.mdx).
//
// The timelines are to scale in CPU T-states at 3.5 MHz. Run:
//   node docs/authoring/next-dma/dma-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-dma.mdx");

// --- One colour per subject in this chapter
const CPU = "#3b82f6"; // the CPU
const DMA = "#e8912d"; // the DMA
const MEM = "#30a46c"; // memory
const IO = "#a855f7"; // I/O ports
const MARK = "#e5484d"; // waits, the moment of the grant
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
// Figure: the shared bus
{
  const out = [svgOpen(700, 330, "On the left, the Z80N CPU above and the DMA below. The DMA asks for the bus with /BUSRQ, an arrow up to the CPU; the CPU answers with /BUSAK, an arrow down to the DMA. Both send their address, data and control lines into a bus switch in the middle, which /BUSAK controls: while it is low, the DMA's lines pass. From the switch one bus goes to the MMU and the memory, ROM, RAM and the Layer 2 mapping, and to the port decoder and the devices, NextRegs, sprites, DACs and the SD card. The DMA's own ports do not answer while it holds the bus.")];
  out.push(arrows("dma-bus", [GREY, CPU, DMA, MEM, IO]));
  blk(out, 0, 20, 180, 80, ["Z80N CPU"], { c: CPU, fill: true, bold: true, size: FH });
  blk(out, 0, 200, 180, 80, ["DMA", "the courier"], { c: DMA, fill: true, bold: true, size: FH });
  // --- /BUSRQ up, /BUSAK down, between the two boxes
  out.push(pathEl("M40,200 L40,104", { stroke: DMA, width: 1.8, marker: "dma-bus-2" }));
  out.push(text(48, 146, "/BUSRQ", { size: FS, bold: true, fill: DMA }));
  out.push(pathEl("M130,100 L130,196", { stroke: CPU, width: 1.8, marker: "dma-bus-1" }));
  out.push(text(138, 170, "/BUSAK", { size: FS, bold: true, fill: CPU }));
  // --- both into the switch
  blk(out, 270, 90, 140, 120, ["bus switch", "/BUSAK low:", "the DMA's lines"], { size: FS + 0.5 });
  out.push(pathEl("M180,60 L230,60 L230,120 L266,120", { stroke: CPU, width: 1.8, marker: "dma-bus-1" }));
  out.push(pathEl("M180,240 L230,240 L230,180 L266,180", { stroke: DMA, width: 1.8, marker: "dma-bus-2" }));
  out.push(text(186, 34, "address, data,", { size: FS, fill: CPU }));
  out.push(text(186, 268, "address, data,", { size: FS, fill: DMA }));
  out.push(text(186, 286, "control", { size: FS, fill: DMA }));
  out.push(text(186, 52, "control", { size: FS, fill: CPU }));
  // --- one bus out to memory and ports
  blk(out, 500, 20, 200, 90, ["MMU and memory", "ROM, RAM,", "Layer 2 mapping"], { c: MEM, fill: true, size: FS + 0.5 });
  blk(out, 500, 190, 200, 90, ["port decoder", "NextRegs, sprites,", "DACs, SD card"], { c: IO, fill: true, size: FS + 0.5 });
  out.push(line(410, 150, 450, 150, { width: 1.8 }));
  out.push(line(450, 65, 450, 235, { width: 1.8 }));
  out.push(pathEl("M450,65 L496,65", { stroke: MEM, width: 1.8, marker: "dma-bus-3" }));
  out.push(pathEl("M450,235 L496,235", { stroke: IO, width: 1.8, marker: "dma-bus-4" }));
  out.push(text(700, 316, "the DMA's own ports, $6B and $0B, do not answer while it holds the bus", { size: FS, anchor: "end" }));
  figures.bus = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: base byte patterns
{
  const rows = [
    ["WR0", "0xxxxx??", "direction, port A, length", { 0: "≠ 00" }],
    ["WR1", "0xxxx100", "port A: kind, step, timing"],
    ["WR2", "0xxxx000", "port B: kind, step, timing"],
    ["WR3", "1xxxxx00", "enable (mask, match ignored)"],
    ["WR4", "1xxxxx01", "mode, port B address"],
    ["WR5", "10xxx010", "auto restart"],
    ["WR6", "1xxxxx11", "commands"]
  ];
  const X0 = 70, CW = 38, RH = 36, Y0 = 34;
  const H = Y0 + rows.length * RH + 6;
  const out = [svgOpen(700, H, "Seven rows, one per register group, each showing the base byte's eight bits, bit 7 on the left, with the fixed bits shaded. WR0: bit 7 is 0 and bits 1 and 0 are not both 0; direction, port A address and block length. WR1: 0, then four setting bits, then 100; port A. WR2: 0, four setting bits, 000; port B. WR3: 1, five setting bits, 00; enable. WR4: 1, five setting bits, 01; mode and port B address. WR5: 10, three setting bits, 010; auto restart. WR6: 1, five bits, 11; commands.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 20, String(b), { size: FS, anchor: "middle" }));
  out.push(text(X0 + 8 * CW + 20, 20, "what it sets", { size: FS }));
  rows.forEach(([name, pat, what, special], i) => {
    const y = Y0 + i * RH;
    out.push(text(0, y + RH / 2 + 5, name, { size: FT, bold: true, fill: DMA }));
    const bits = [...pat];
    for (let k = 0; k < 8; k++) {
      const x = X0 + k * CW;
      const ch = bits[k];
      if (ch === "?") continue;
      const fixed = ch !== "x";
      out.push(rect(x + 1, y + 3, CW - 2, RH - 6, { rx: 3, stroke: fixed ? DMA : GREY, width: fixed ? 1.8 : 1, fill: fixed ? DMA : "none", fillOpacity: fixed ? 0.16 : undefined, opacity: fixed ? undefined : 0.5 }));
      out.push(text(x + CW / 2, y + RH / 2 + 5, fixed ? ch : "·", { size: FT, anchor: "middle", bold: fixed, fill: fixed ? DMA : GREY }));
    }
    if (special) {
      const x = X0 + 6 * CW;
      out.push(rect(x + 1, y + 3, 2 * CW - 2, RH - 6, { rx: 3, stroke: DMA, width: 1.8, fill: DMA, fillOpacity: 0.16 }));
      out.push(text(x + CW, y + RH / 2 + 5, special[0], { size: FT, anchor: "middle", bold: true, fill: DMA }));
    }
    out.push(text(X0 + 8 * CW + 20, y + RH / 2 + 5, what, { size: FT }));
  });
  figures.decode = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: one byte, to scale
{
  const T = 42, X0 = 130, W = 570, k = W / T;
  const px = (t) => X0 + t * k;
  const out = [svgOpen(700, 232, "A timeline to scale over 42 T-states. LDIR: two bytes of 21 T-states each. The DMA with three-clock cycles: seven bytes of 6 T-states, each a 3 T-state read and a 3 T-state write. The DMA with two-clock cycles: ten bytes and a half of 4 T-states, each a 2 T-state read and a 2 T-state write.")];
  for (let t = 0; t <= T; t += 6) {
    out.push(line(px(t), 30, px(t), 36, { width: 1.2 }));
    out.push(text(px(t), 22, String(t), { size: FS, anchor: t === T ? "end" : "middle" }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const row = (y, label, sub, cells) => {
    out.push(text(0, y + 20, label, { size: FT, bold: true }));
    if (sub) out.push(text(0, y + 38, sub, { size: FS }));
    for (const [t0, t1, s, c, op] of cells) {
      out.push(rect(px(t0), y, (t1 - t0) * k, 36, { rx: 3, stroke: c, width: 1.6, fill: c, fillOpacity: op }));
      if (s) out.push(text((px(t0) + px(t1)) / 2, y + 23, s, { size: FS, anchor: "middle", bold: true, fill: c }));
    }
  };
  row(52, "LDIR", null, [[0, 21, "one byte, 21 T", CPU, 0.12], [21, 42, "the next byte", CPU, 0.12]]);
  const dma = (len) => {
    const cells = [];
    for (let t = 0; t + len <= T + 0.001; t += 2 * len) {
      cells.push([t, t + len, "R", DMA, 0.22]);
      if (t + 2 * len <= T + 0.001) cells.push([t + len, t + 2 * len, "W", DMA, 0.08]);
    }
    return cells;
  };
  row(110, "DMA", "3-clock cycles", dma(3));
  row(168, "DMA", "2-clock cycles", dma(2));
  out.push(text(700, 228, "R: read cycle, W: write cycle; a byte is one of each", { size: FS, anchor: "end" }));
  figures.byte = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: prescaler 10, continuous against burst
{
  const P = 10, PER = 4 * P + 3; // --- 43 T a byte, bus held
  const T = 106, X0 = 130, W = 570, k = W / T;
  const px = (t) => X0 + t * k;
  const out = [svgOpen(700, 330, "Two pairs of rows to scale over 106 T-states at prescaler 10. Continuous mode: DMA bytes of 6 T-states at 0, 43 and 86, the DMA waiting in between while it keeps the bus, and the CPU stopped throughout. Burst mode: a byte at 0; the DMA lets go of the bus and the CPU runs from T-state 9; at T-state 45 the DMA asks for the bus again, the CPU finishes its machine cycle, and the next byte starts a few T-states later, about T-state 50, and the next about 100.")];
  out.push(arrows("dma-pace", [MARK]));
  for (let t = 0; t <= 100; t += 10) {
    out.push(line(px(t), 30, px(t), 36, { width: 1.2 }));
    out.push(text(px(t), 22, String(t), { size: FS, anchor: "middle" }));
  }
  out.push(text(0, 22, "T-states", { size: FS }));
  const bar = (y, t0, t1, c, op, s, o = {}) => {
    out.push(rect(px(t0), y, (t1 - t0) * k, 30, { rx: 3, stroke: c, width: 1.6, fill: op ? c : "none", fillOpacity: op, dash: o.dash }));
    if (s) out.push(text((px(t0) + px(t1)) / 2, y + 20, s, { size: FS, anchor: "middle", bold: o.bold, fill: c }));
  };
  // --- continuous
  out.push(text(0, 66, "continuous", { size: FT, bold: true }));
  out.push(text(0, 84, "DMA", { size: FS, fill: DMA }));
  out.push(text(0, 120, "CPU", { size: FS, fill: CPU }));
  for (const t of [0, PER, 2 * PER]) bar(52, t, t + 6, DMA, 0.3, null);
  bar(52, 6, PER, DMA, 0, "waits, keeps the bus", { dash: "5 4" });
  bar(52, PER + 6, 2 * PER, DMA, 0, "waits", { dash: "5 4" });
  bar(98, 0, T, GREY, 0.08, "stopped for the whole block");
  // --- burst
  const B2 = 50, B3 = 100;
  out.push(text(0, 182, "burst", { size: FT, bold: true }));
  out.push(text(0, 200, "DMA", { size: FS, fill: DMA }));
  out.push(text(0, 236, "CPU", { size: FS, fill: CPU }));
  for (const t of [0, B2, B3]) bar(168, t, t + 6, DMA, 0.3, null);
  bar(168, 6, 45, DMA, 0, "waits, bus free", { dash: "5 4" });
  bar(168, B2 + 6, 95, DMA, 0, "waits", { dash: "5 4" });
  bar(214, 0, 9, GREY, 0.08, null);
  bar(214, 9, 45, CPU, 0.14, "runs", { bold: true });
  bar(214, 45, B2, MARK, 0.14, null);
  bar(214, B2, B2 + 9, GREY, 0.08, null);
  bar(214, B2 + 9, 95, CPU, 0.14, "runs", { bold: true });
  bar(214, 95, B3, MARK, 0.14, null);
  out.push(pathEl(`M${px(47.5)},290 L${px(47.5)},250`, { stroke: MARK, width: 1.8, marker: "dma-pace-0" }));
  out.push(text(px(47.5) + 8, 286, "the DMA asks; the CPU ends its M-cycle", { size: FS, fill: MARK }));
  out.push(text(0, 320, "grey: the CPU held for a byte and the handover; red: waiting for the grant", { size: FS }));
  figures.pace = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
