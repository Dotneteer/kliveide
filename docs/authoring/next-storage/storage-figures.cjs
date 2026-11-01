#!/usr/bin/env node
// Figures of "Storage: an SD Card on a Serial Bus"
// (docs/content/en/under-the-hood/emulator-internals/next-storage.mdx).
//
// The byte timeline is to scale in CPU clocks. Run:
//   node docs/authoring/next-storage/storage-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
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
  blk(out, 0, 85, 190, 110, ["SPI master", "$E7: select", "$EB: data"], { c: SPI, fill: true });
  const devs = [
    ["SD card 0", "$E7 = xxxxxx10", CARD],
    ["SD card 1", "$E7 = xxxxxx01", CARD],
    ["Pi SPI 0", "$E7 = $FB", OTHER],
    ["Pi SPI 1", "$E7 = $F7", OTHER],
    ["flash (cores)", "$E7 = $7F, locked", OTHER]
  ];
  out.push(line(190, 140, 380, 140, { stroke: SPI, width: 2.5 }));
  out.push(text(206, 130, "SCK, MOSI →", { size: FS, fill: SPI }));
  out.push(text(206, 162, "← MISO", { size: FS, fill: SPI }));
  out.push(line(380, 26, 380, 262, { stroke: SPI, width: 2.5 }));
  devs.forEach(([name, sel, c], i) => {
    const y = 4 + i * 58;
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

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
