#!/usr/bin/env node
// Figures of "UARTs: Two Serial Ports Behind One Door"
// (docs/content/en/under-the-hood/emulator-internals/next-uart.mdx).
//
// The frame is to scale in bit periods, the buffer in bytes. Run:
//   node docs/authoring/next-uart/uart-figures.cjs
//
// Sized for print (dev/ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-uart.mdx");

// --- One colour per subject in this chapter (the UARTs are green, as in the interrupts chapter)
const UART = "#30a46c"; // the UARTs, their buffers
const LINE = "#3b82f6"; // the serial line
const DEV = "#a855f7"; // the devices at the other end
const MARK = "#e5484d"; // sampling moments, limits, loss
const WARN = "#e8912d"; // near full
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
// Figure: the twins behind one door
{
  const out = [svgOpen(700, 292, "On the left, the CPU's ports $133B, $143B and $163B, and the UART select port $153B, whose bit 6 chooses which UART they reach. Two rows, UART 0 above and UART 1 below. In each, the CPU's bytes go into a 64-byte transmit buffer and on to the transmitter, which sends them to the device; the device's bytes come into the receiver and on into a 512-byte receive buffer, which the CPU reads. UART 0's device is the Wi-Fi module, UART 1's the Raspberry Pi's connector.")];
  out.push(arrows("ua-tw", [GREY, UART, DEV]));
  blk(out, 0, 96, 120, 100, ["ports", "$133B", "$143B, $163B"], { size: FS + 0.5 });
  blk(out, 150, 116, 100, 60, ["$153B", "bit 6"], { size: FS + 0.5, bold: true });
  out.push(line(120, 146, 150, 146, { width: 1.8 }));
  const row = (y, n, dev) => {
    out.push(text(290, y - 6, `UART ${n}`, { size: FT, bold: true, fill: UART }));
    blk(out, 290, y, 130, 44, ["TX buffer, 64"], { c: UART, fill: true, size: FS + 0.5 });
    blk(out, 440, y, 110, 44, ["transmitter"], { c: UART, size: FS + 0.5 });
    blk(out, 290, y + 56, 130, 44, ["RX buffer, 512"], { c: UART, fill: true, size: FS + 0.5 });
    blk(out, 440, y + 56, 110, 44, ["receiver"], { c: UART, size: FS + 0.5 });
    blk(out, 590, y, 110, 100, dev, { c: DEV, fill: true, size: FS + 0.5 });
    out.push(pathEl(`M420,${y + 22} L436,${y + 22}`, { stroke: UART, width: 1.8, marker: "ua-tw-1" }));
    out.push(pathEl(`M550,${y + 22} L586,${y + 22}`, { stroke: DEV, width: 1.8, marker: "ua-tw-2" }));
    out.push(pathEl(`M590,${y + 78} L554,${y + 78}`, { stroke: DEV, width: 1.8, marker: "ua-tw-2" }));
    out.push(pathEl(`M440,${y + 78} L424,${y + 78}`, { stroke: UART, width: 1.8, marker: "ua-tw-1" }));
    out.push(pathEl(`M266,${y + 22} L286,${y + 22}`, { width: 1.8, marker: "ua-tw-0" }));
    out.push(line(266, y + 78, 290, y + 78, { width: 1.8 }));
  };
  row(28, 0, ["Wi-Fi", "module", "(ESP)"]);
  row(188, 1, ["Pi's", "connector", "GPIO 14, 15"]);
  out.push(line(250, 146, 266, 146, { width: 1.8 }));
  out.push(line(266, 50, 266, 266, { width: 1.8 }));
  figures.twins = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: a frame, to scale in bit periods
{
  const N = 12, X0 = 130, W = 570, k = W / N;
  const px = (b) => X0 + b * k;
  const out = [svgOpen(700, 176, "The letter A, $41, in an 8N1 frame over twelve bit periods. One period of rest at 1; the start bit at 0; the data bits least significant first, b0 = 1, b1 to b5 = 0, b6 = 1, b7 = 0; the stop bit at 1; rest at 1. A red tick marks the middle of every bit from the start bit to the stop bit, where the receiver samples it.")];
  const levels = [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1];
  const names = ["rest", "start", "b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "stop", "rest"];
  const hi = 16, lo = 66;
  out.push(text(0, hi + 5, "1", { size: FS }));
  out.push(text(0, lo + 5, "0", { size: FS }));
  out.push(text(30, (hi + lo) / 2 + 5, "line", { size: FT, bold: true, fill: LINE }));
  let d = `M${px(0)},${levels[0] ? hi : lo}`;
  levels.forEach((v, i) => {
    const y = v ? hi : lo;
    d += ` L${px(i)},${y} L${px(i + 1)},${y}`;
  });
  out.push(pathEl(d, { stroke: LINE, width: 2.2 }));
  for (let i = 0; i <= N; i++) out.push(line(px(i), 4, px(i), 78, { width: 1, dash: "3 3", opacity: 0.4 }));
  names.forEach((n, i) => {
    out.push(text(px(i) + k / 2, 102, n, { size: FS, anchor: "middle", bold: i > 0 && i < N - 1, fill: i === 0 || i === N - 1 ? GREY : UART }));
    if (i >= 1 && i <= 10) out.push(line(px(i) + k / 2, 80, px(i) + k / 2, 88, { stroke: MARK, width: 2 }));
  });
  out.push(text(px(2) + k / 2, 126, "1", { size: FS, anchor: "middle" }));
  for (let i = 3; i <= 9; i++) out.push(text(px(i) + k / 2, 126, String(levels[i]), { size: FS, anchor: "middle" }));
  out.push(text(0, 126, "$41, b0 first:", { size: FS }));
  out.push(text(0, 164, "red: the receiver samples each bit in its middle; a bit is 243 master clocks at 115,200 baud", { size: FS }));
  figures.frame = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the receive buffer's levels
{
  const W = 470, k = W / 512;
  const px = (n) => n * k;
  const out = [svgOpen(700, 196, "Left, a bar to scale from 0 to 512 bytes, the receive buffer, with a mark at 384 bytes, three quarters. Right, its last bytes enlarged, 508 to 512 and one more: marks at 510 and 512, and the extra byte that waits behind a full buffer. A key below: 384, near full, status bit 3 and the near-full interrupt; 510, the flow control raises RTR and the sender stops; 512 full and one held, the next byte is lost, the overflow, status bit 2.")];
  out.push(rect(0, 30, W, 40, { rx: 3, stroke: UART, width: 2, fill: UART, fillOpacity: 0.1 }));
  out.push(rect(px(384), 31, W - px(384) - 1, 38, { stroke: WARN, width: 0, fill: WARN, fillOpacity: 0.2 }));
  out.push(text(0, 18, "0", { size: FS }));
  out.push(text(px(384), 18, "384", { size: FS, anchor: "middle", fill: WARN, bold: true }));
  out.push(line(px(384), 24, px(384), 76, { stroke: WARN, width: 2 }));
  out.push(text(W, 18, "512", { size: FS, anchor: "end" }));
  out.push(text(px(192), 56, "bytes waiting to be read", { size: FT, anchor: "middle", fill: UART }));
  // --- the last bytes, enlarged: 508 ... 512 and the one held
  const ZX = 520, zw = 30;
  const zx = (n) => ZX + (n - 507) * zw; // --- the boundary after n bytes
  for (let n = 507; n < 512; n++) out.push(rect(zx(n), 30, zw, 40, { stroke: UART, width: 1.4, fill: UART, fillOpacity: 0.12 }));
  out.push(rect(zx(512), 30, zw, 40, { stroke: GREY, width: 1.6, dash: "4 3", fill: UART, fillOpacity: 0.3 }));
  out.push(text(zx(510), 18, "510", { size: FS, anchor: "middle", fill: MARK, bold: true }));
  out.push(line(zx(510), 24, zx(510), 76, { stroke: MARK, width: 2.2 }));
  out.push(text(zx(512), 18, "512", { size: FS, anchor: "middle", bold: true }));
  out.push(line(zx(512), 24, zx(512), 76, { width: 2.2 }));
  out.push(text(zx(512) + zw / 2, 56, "+1", { size: FS, anchor: "middle", bold: true }));
  out.push(text((ZX + 700) / 2, 94, "the last bytes, enlarged", { size: FS, anchor: "middle" }));
  // --- the key
  out.push(text(0, 128, "384: near full, status bit 3, and the near-full interrupt", { size: FS, fill: WARN }));
  out.push(text(0, 150, "510: with flow control, RTR goes high and the sender stops", { size: FS, fill: MARK }));
  out.push(text(0, 172, "512: full; one more byte waits behind it, and the next is lost: overflow, status bit 2", { size: FS }));
  figures.fifo = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
