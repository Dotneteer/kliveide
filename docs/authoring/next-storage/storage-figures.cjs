#!/usr/bin/env node
// Figures of "Storage: an SD Card on a Serial Bus"
// (docs/content/en/under-the-hood/emulator-internals/next-storage.mdx).
//
// The byte timeline is to scale in CPU clocks. Run:
//   node docs/authoring/next-storage/storage-figures.cjs
//
// Sized for print (dev/ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-storage.mdx");

// --- One colour per subject in this chapter
const SPI = "#3b82f6"; // the SPI master and the clock
const HOST = "#e8912d"; // what the host sends (MOSI)
const CARD = "#30a46c"; // the SD cards and what they send (MISO)
const OTHER = "#a855f7"; // the Pi and the flash
const MARK = "#e5484d"; // the data token, the moment a bit is taken
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
// Figure: the bus
{
  const out = [svgOpen(700, 290, "On the left, the FPGA's SPI master, with port $E7 choosing a device and port $EB moving the data. From it the bus, SCK and MOSI out and MISO back, runs to five devices on the right, each with the $E7 value that selects it: SD card 0, low bits 10; SD card 1, low bits 01; the Pi's SPI device 0, $FB; the Pi's device 1, $F7; the FPGA's flash, $7F, in config mode or after power-on only.")];
  out.push(arrows("st-bus", [GREY, SPI]));
  const ROW = (i) => 4 + i * 58; // --- the devices' rows; each branch is 22 below a row's top
  const MID = ROW(2) + 22; // --- the master's line meets the trunk level with the branch to Pi SPI 0
  blk(out, 0, MID - 55, 190, 110, ["SPI master", "$E7: select", "$EB: data"], { c: SPI, fill: true });
  const devs = [
    ["SD card 0", "$E7 = xxxxxx10", CARD],
    ["SD card 1", "$E7 = xxxxxx01", CARD],
    ["Pi SPI 0", "$E7 = $FB", OTHER],
    ["Pi SPI 1", "$E7 = $F7", OTHER],
    ["flash (cores)", "$E7 = $7F, locked", OTHER]
  ];
  out.push(line(190, MID, 380, MID, { stroke: SPI, width: 2.5 }));
  out.push(text(206, MID - 10, "SCK, MOSI →", { size: FS, fill: SPI }));
  out.push(text(206, MID + 22, "← MISO", { size: FS, fill: SPI }));
  // --- the trunk runs exactly from the first branch to the last (half a branch stroke past each, to close the corners)
  out.push(line(380, ROW(0) + 22 - 0.9, 380, ROW(4) + 22 + 0.9, { stroke: SPI, width: 2.5 }));
  devs.forEach(([name, sel, c], i) => {
    const y = ROW(i);
    out.push(pathEl(`M380,${y + 22} L446,${y + 22}`, { stroke: SPI, width: 1.8, marker: "st-bus-1" }));
    out.push(rect(450, y, 250, 44, { rx: 6, stroke: c, width: 2, fill: c, fillOpacity: 0.1 }));
    out.push(text(462, y + 27, name, { size: FT, bold: true, fill: c }));
    out.push(text(690, y + 27, sel, { size: FS, anchor: "end", fill: c }));
  });
  figures.bus = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: one byte, to scale in CPU clocks
{
  const T = 16, X0 = 130, W = 570, k = W / T;
  const px = (t) => X0 + t * k;
  const out = [svgOpen(700, 238, "Sixteen CPU clocks, to scale. SCK rests low and is high in every second clock, eight pulses. MOSI carries bits b7 to b0, each for two clocks, changing while SCK is low. Each MISO bit is taken as SCK rises. The byte that came in on MISO is what the next read of port $EB returns.")];
  for (let t = 0; t <= T; t += 2) {
    out.push(line(px(t), 30, px(t), 36, { width: 1.2 }));
    out.push(text(px(t), 22, String(t), { size: FS, anchor: t === T ? "end" : "middle" }));
  }
  out.push(text(0, 22, "CPU clocks", { size: FS }));
  // --- SCK: low in even clocks, high in odd ones
  out.push(text(0, 76, "SCK", { size: FT, bold: true, fill: SPI }));
  let d = `M${px(0)},80`;
  for (let t = 0; t < T; t += 2) d += ` L${px(t + 1)},80 L${px(t + 1)},56 L${px(t + 2)},56 L${px(t + 2)},80`;
  out.push(pathEl(d, { stroke: SPI, width: 2 }));
  // --- MOSI and MISO bit cells
  const cells = (y, label, c, sub) => {
    out.push(text(0, y + 21, label, { size: FT, bold: true, fill: c }));
    if (sub) out.push(text(0, y + 39, sub, { size: FS }));
    for (let b = 0; b < 8; b++) {
      out.push(rect(px(2 * b), y, 2 * k, 30, { rx: 3, stroke: c, width: 1.4, fill: c, fillOpacity: 0.12 }));
      out.push(text(px(2 * b + 1), y + 20, `b${7 - b}`, { size: FS, anchor: "middle", bold: true, fill: c }));
    }
  };
  cells(100, "MOSI", HOST, "master");
  cells(156, "MISO", CARD, "slave");
  for (let b = 0; b < 8; b++) out.push(pathEl(`M${px(2 * b + 1)},140 L${px(2 * b + 1)},154`, { stroke: MARK, width: 1.8 }));
  out.push(text(700, 226, "red ticks: a MISO bit is taken as SCK rises", { size: FS, anchor: "end", fill: MARK }));
  figures.byte = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: one real byte, $51 out and $FF back, to scale in CPU clocks
{
  const T = 16, X0 = 130, W = 570, k = W / T;
  const px = (t) => X0 + t * k;
  const VAL = 0x51; // --- CMD17's first byte, the command the chapter's listing sends
  const bits = Array.from({ length: 8 }, (_, i) => (VAL >> (7 - i)) & 1); // --- b7 first
  const out = [svgOpen(700, 300, "Sixteen CPU clocks, to scale, while the host sends $51 and the card answers $FF. The CPU clock ticks sixteen times; SCK, the CPU clock halved, rests low and rises in the middle of every bit. MOSI carries $51, most significant bit first: 0, 1, 0, 1, 0, 0, 0, 1, each level held for two clocks and changing as SCK falls. MISO stays high: the card sends $FF, eight 1s. Red ticks mark the rising edges of SCK, where each bit is taken.")];
  for (let t = 0; t <= T; t += 2) {
    out.push(line(px(t), 30, px(t), 36, { width: 1.2 }));
    out.push(text(px(t), 22, String(t), { size: FS, anchor: t === T ? "end" : "middle" }));
  }
  out.push(text(0, 22, "CPU clocks", { size: FS }));
  const wave = (y0, y1, levels, step, c) => {
    let d = `M${px(0)},${levels[0] ? y0 : y1}`;
    levels.forEach((v, i) => {
      const y = v ? y0 : y1;
      d += ` L${px(i * step)},${y} L${px((i + 1) * step)},${y}`;
    });
    out.push(pathEl(d, { stroke: c, width: 2 }));
  };
  // --- the CPU clock: high in the first half of every clock
  out.push(text(0, 66, "CPU clock", { size: FT, bold: true }));
  wave(50, 72, Array.from({ length: 2 * T }, (_, i) => (i % 2 === 0 ? 1 : 0)), 0.5, GREY);
  // --- SCK: low in even clocks, high in odd ones
  out.push(text(0, 116, "SCK", { size: FT, bold: true, fill: SPI }));
  wave(98, 120, Array.from({ length: T }, (_, i) => i % 2), 1, SPI);
  // --- MOSI: $51, each bit two clocks
  out.push(text(0, 162, "MOSI", { size: FT, bold: true, fill: HOST }));
  out.push(text(0, 180, "host: $51", { size: FS, fill: HOST }));
  wave(146, 172, bits, 2, HOST);
  bits.forEach((b, i) => {
    out.push(text(px(2 * i + 1), 196, `b${7 - i} = ${b}`, { size: FS, anchor: "middle", fill: HOST }));
  });
  // --- MISO: $FF
  out.push(text(0, 238, "MISO", { size: FT, bold: true, fill: CARD }));
  out.push(text(0, 256, "card: $FF", { size: FS, fill: CARD }));
  wave(222, 248, Array(8).fill(1), 2, CARD);
  for (let i = 0; i < 8; i++) out.push(text(px(2 * i + 1), 268, "1", { size: FS, anchor: "middle", fill: CARD }));
  // --- where each bit is taken: SCK's rising edges
  for (let i = 0; i < 8; i++) {
    const x = px(2 * i + 1);
    out.push(line(x, 138, x, 178, { stroke: MARK, width: 1.6, dash: "3 3" }));
    out.push(line(x, 214, x, 254, { stroke: MARK, width: 1.6, dash: "3 3" }));
  }
  out.push(text(700, 294, "red: each bit is taken as SCK rises, in the middle of its two clocks", { size: FS, anchor: "end", fill: MARK }));
  figures.bytewave = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: CMD17, byte by byte
{
  const out = [svgOpen(700, 190, "Two rows of bytes, not to scale. The host row: the six-byte command, $51, four bytes of the sector number and the CRC, then $FF bytes for as long as the read goes on. The card row: $FF while the command arrives and for up to eight bytes more, R1 = $00, $FF while it fetches the sector, the data token $FE, 512 data bytes and two CRC bytes.")];
  out.push(text(0, 24, "host", { size: FT, bold: true, fill: HOST }));
  out.push(text(0, 42, "MOSI", { size: FS, fill: HOST }));
  out.push(text(0, 110, "card", { size: FT, bold: true, fill: CARD }));
  out.push(text(0, 128, "MISO", { size: FS, fill: CARD }));
  const X0 = 80;
  const seg = (y, x, w, s, c, o = {}) => {
    out.push(rect(X0 + x, y, w, 40, { rx: 4, stroke: c, width: o.bold ? 2 : 1.4, fill: o.fill ? c : "none", fillOpacity: o.fill ? 0.16 : undefined, dash: o.dash }));
    out.push(lines(X0 + x + w / 2, y + (o.two ? 17 : 25), s, { size: FS, anchor: "middle", bold: o.bold, fill: c, lh: 16 }));
  };
  // --- host: command, then $FF
  seg(8, 0, 150, ["$51  sector  CRC"], HOST, { fill: true, bold: true });
  seg(8, 152, 468, ["$FF  $FF  $FF  …  for as long as the card talks"], HOST, { dash: "5 4" });
  // --- card
  seg(94, 0, 150, ["$FF …"], CARD, { dash: "5 4" });
  seg(94, 152, 54, ["$FF", "0–8"], CARD, { dash: "5 4", two: true });
  seg(94, 208, 54, ["R1", "$00"], CARD, { fill: true, bold: true, two: true });
  seg(94, 264, 70, ["$FF …", "wait"], CARD, { dash: "5 4", two: true });
  seg(94, 336, 54, ["$FE"], MARK, { fill: true, bold: true });
  seg(94, 392, 170, ["512 data bytes"], CARD, { fill: true, bold: true });
  seg(94, 564, 56, ["CRC", "2"], CARD, { two: true });
  out.push(text(X0 + 363, 160, "token", { size: FS, anchor: "middle", fill: MARK }));
  out.push(text(0, 184, "each byte the host sends brings back the card's byte below it", { size: FS }));
  figures.cmd17 = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the listing's conversation, exchange by exchange
{
  // --- [exchange, CPU, MOSI, MISO, what the IN returns (null for an OUT)]
  const band1 = [
    [1, "OUT", "$51", "$FF", null], [2, "OUT", "$00", "$FF", null], [3, "OUT", "$00", "$FF", null],
    [4, "OUT", "$00", "$FF", null], [5, "OUT", "$05", "$FF", null], [6, "OUT", "$01", "$FF", null],
    [7, "IN", "$FF", "$FF", "$FF"], [8, "IN", "$FF", "$00", "$FF"], [9, "IN", "$FF", "$FF", "$00"]
  ];
  const band2 = [
    [10, "IN", "$FF", "$FF", "$FF"], [11, "IN", "$FF", "$FE", "$FF"], [12, "IN", "$FF", "D0", "$FE"],
    [13, "IN", "$FF", "D1", "D0"], [14, "IN", "$FF", "D2", "D1"], ["…", "", "", "", ""],
    [524, "IN", "$FF", "C1", "D511"], [525, "IN", "$FF", "C2", "C1"], [526, "IN", "$FF", "$FF", "C2"]
  ];
  const spans1 = [[0, 5, "OTIR: CMD17, sector 5, CRC", HOST], [6, 8, "Resp: polls for R1", CARD]];
  const spans2 = [[0, 2, "Token: polls for $FE", MARK], [3, 6, "INIR × 2: 512 bytes", CARD], [7, 8, "the CRC", GREY]];
  const X0 = 150, CW = (700 - X0) / 9, BH = 244;
  const xc = (i) => X0 + i * CW + CW / 2;
  const out = [svgOpen(700, 2 * BH + 14, "The sector read of the chapter's listing as 526 exchanges in two bands, each exchange a column: the CPU's instruction, the byte the host sends on MOSI, the byte the card sends on MISO, and what the IN returns. Exchanges 1 to 6: OTIR sends $51, $00, $00, $00, $05 and the CRC $01; the card sends $FF. Exchanges 7 to 9: the Resp loop's INs send $FF; the card sends $FF, then R1 = $00 in exchange 8, then $FF; the INs return $FF, $FF and, in exchange 9, the $00. Exchanges 10 to 12: the Token loop; the card sends $FF, the token $FE in exchange 11, and data byte D0 in 12; the INs return $FF, $FF and, in exchange 12, the $FE. From exchange 13, INIR: each IN returns the data byte of the exchange before, D0 in 13, up to D511 in 524; exchanges 525 and 526 return the two CRC bytes C1 and C2. Arrows show every IN returning the card's byte from the exchange before.")];
  out.push(arrows("st-conv", [GREY]));
  const band = (y0, cols, spans, fromLeft) => {
    // --- the code that runs, over its exchanges
    for (const [a, b, label, c] of spans) {
      out.push(pathEl(`M${X0 + a * CW + 4},${y0 + 14} L${X0 + a * CW + 4},${y0 + 8} L${X0 + (b + 1) * CW - 4},${y0 + 8} L${X0 + (b + 1) * CW - 4},${y0 + 14}`, { stroke: c, width: 1.4 }));
      out.push(text((X0 + a * CW + X0 + (b + 1) * CW) / 2, y0, label, { size: FS, anchor: "middle", bold: true, fill: c }));
    }
    const rows = [["exchange", y0 + 36], ["CPU", y0 + 58]];
    out.push(text(0, rows[0][1], "exchange", { size: FS }));
    out.push(text(0, rows[1][1], "instruction", { size: FS }));
    out.push(text(0, y0 + 90, "MOSI: host", { size: FS, bold: true, fill: HOST }));
    out.push(text(0, y0 + 126, "MISO: card", { size: FS, bold: true, fill: CARD }));
    out.push(text(0, y0 + 198, "the IN returns", { size: FS, bold: true }));
    const yMosi = y0 + 70, yMiso = y0 + 106, yRet = y0 + 178, BHt = 30;
    cols.forEach(([n, cpu, mosi, miso, ret], i) => {
      const x = X0 + i * CW + 3, w = CW - 6;
      out.push(text(xc(i), rows[0][1], String(n), { size: FS, anchor: "middle" }));
      if (n === "…") {
        out.push(text(xc(i), yMiso + 20, "…", { size: FT, anchor: "middle" }));
        return;
      }
      out.push(text(xc(i), rows[1][1], cpu, { size: FS, anchor: "middle", bold: true }));
      out.push(rect(x, yMosi, w, BHt, { rx: 3, stroke: HOST, width: 1.4, fill: HOST, fillOpacity: mosi === "$FF" ? 0.04 : 0.16 }));
      out.push(text(xc(i), yMosi + 20, mosi, { size: FS, anchor: "middle", fill: HOST, bold: mosi !== "$FF" }));
      const hot = miso !== "$FF";
      const mc = miso === "$FE" ? MARK : CARD;
      out.push(rect(x, yMiso, w, BHt, { rx: 3, stroke: mc, width: hot ? 2 : 1.4, fill: mc, fillOpacity: hot ? 0.2 : 0.04 }));
      out.push(text(xc(i), yMiso + 20, miso, { size: FS, anchor: "middle", fill: mc, bold: hot }));
      if (ret === null) {
        out.push(text(xc(i), yRet + 20, "–", { size: FS, anchor: "middle", fill: GREY }));
        return;
      }
      const rhot = ret !== "$FF";
      const rc = ret === "$FE" ? MARK : rhot ? CARD : GREY;
      out.push(rect(x, yRet, w, BHt, { rx: 3, stroke: rc, width: rhot ? 2 : 1.4, fill: rc, fillOpacity: rhot ? 0.2 : 0.04 }));
      out.push(text(xc(i), yRet + 20, ret, { size: FS, anchor: "middle", fill: rc, bold: rhot }));
      // --- the IN returns the card's byte of the exchange before: a step from the right part of the MISO
      // --- box to the left part of the next column's box, so that neighbouring arrows never touch
      const yMid = yMiso + BHt + 14;
      const prev = i - 1;
      const from = (j) => xc(j) + CW * 0.22;
      const to = xc(i) - CW * 0.22;
      if (prev >= 0 && cols[prev][0] !== "…") {
        out.push(pathEl(`M${from(prev)},${yMiso + BHt} L${from(prev)},${yMid} L${to},${yMid} L${to},${yRet - 2}`, { width: 1.4, marker: "st-conv-0" }));
      } else if (prev < 0 && fromLeft) {
        out.push(pathEl(`M${X0 - 4},${yMid} L${to},${yMid} L${to},${yRet - 2}`, { width: 1.4, marker: "st-conv-0" }));
        out.push(text(X0 - 8, yMid + 5, fromLeft, { size: FS, anchor: "end" }));
      } else if (prev >= 0) {
        out.push(pathEl(`M${xc(prev)},${yMid} L${to},${yMid} L${to},${yRet - 2}`, { width: 1.4, marker: "st-conv-0", dash: "3 3" }));
      }
    });
  };
  band(14, band1, spans1, null);
  band(14 + BH, band2, spans2, "from 9");
  out.push(text(0, 2 * BH + 10, "D0 … D511: the sector's bytes; C1, C2: its CRC; every IN sends $FF and returns the byte before", { size: FS }));
  figures.conversation = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
