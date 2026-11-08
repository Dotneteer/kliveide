#!/usr/bin/env node
// Figures of "Wi-Fi: A Telegraph Clerk on a Serial Line"
// (docs/content/en/under-the-hood/emulator-internals/next-wifi.mdx).
//
// Run:
//   node docs/authoring/next-wifi/wifi-figures.cjs
//
// Sized for print (dev/ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-wifi.mdx");

// --- One colour per subject: as in the UART chapter, the UARTs are green and the device at the far end purple
const UART = "#30a46c"; // the Next's side, the serial line's text
const DEV = "#a855f7"; // the module, the radio side
const LINE = "#3b82f6"; // numbers on the line
const MARK = "#e5484d"; // reset, loss
const WARN = "#e8912d"; // boot pins, the tag
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
// Figure: the wires between the Next and the module
{
  const H = 304;
  const out = [svgOpen(700, H, "On the left the Next's FPGA, with five rows: the UART 0 transmitter, the UART 0 receiver, NextRegs $A8 and $A9 bit 0 for GPIO0, NextReg $A9 bit 2 for GPIO2, and NextReg $02 bit 7 for the reset line. In the middle wires run to the ESP-01 module's pins: transmitter to RX, TX back to the receiver, GPIO0 both ways, GPIO2 from the module only, and reset to RST, a line shared with the expansion bus. A dashed row shows the two flow control lines, present on issue 4 boards and later. On the right the module talks by radio to the Wi-Fi router.")];
  out.push(arrows("wf-w", [GREY, UART, WARN, MARK, DEV]));

  const FX = 0, FW = 250, MX = 410, MW = 120, RX = 606, RW = 94;
  const rows = [
    { y: 38, l: "UART 0 transmitter", p: "RX", wire: "bytes out", c: UART, m: "wf-w-1", dir: 1 },
    { y: 84, l: "UART 0 receiver", p: "TX", wire: "bytes in", c: UART, m: "wf-w-1", dir: -1 },
    { y: 130, l: "$A8, $A9 bit 0", p: "GPIO0", wire: "boot choice", c: WARN, m: "wf-w-2", dir: 2 },
    { y: 176, l: "$A9 bit 2", p: "GPIO2", wire: "read only", c: WARN, m: "wf-w-2", dir: -1 },
    { y: 222, l: "$02 bit 7", p: "RST", wire: "reset", c: MARK, m: "wf-w-3", dir: 1 }
  ];
  blk(out, FX, 8, FW, H - 8, [""], {});
  out.push(text(FX + FW / 2, 28, "the Next's FPGA", { anchor: "middle", size: FT, bold: true }));
  blk(out, MX, 8, MW, H - 8, [""], { c: DEV, fill: true, op: 0.08 });
  out.push(text(MX + MW / 2, 28, "ESP-01", { anchor: "middle", size: FT, bold: true, fill: DEV }));

  for (const r of rows) {
    out.push(rect(FX + 14, r.y, FW - 28, 36, { rx: 4, stroke: r.c, width: 1.6 }));
    out.push(text(FX + FW / 2, r.y + 23, r.l, { anchor: "middle", size: FS + 0.5, fill: r.c }));
    out.push(text(MX + MW / 2, r.y + 23, r.p, { anchor: "middle", size: FT, bold: true, fill: DEV }));
    const yw = r.y + 24;
    const x0 = FX + FW - 14, x1 = MX;
    out.push(text((FW + MX) / 2, r.y + 13, r.wire, { anchor: "middle", size: FS, fill: r.c }));
    if (r.dir === 1) out.push(line(x0, yw, x1 - 2, yw, { stroke: r.c, width: 1.8, marker: r.m }));
    else if (r.dir === -1) out.push(line(x1, yw, x0 + 2, yw, { stroke: r.c, width: 1.8, marker: r.m }));
    else {
      out.push(line(x0, yw, x1 - 2, yw, { stroke: r.c, width: 1.8, marker: r.m }));
      out.push(line(x1 - 12, yw, x0 + 2, yw, { stroke: r.c, width: 1.8, marker: r.m }));
    }
  }
  // Flow control: only on the newer boards
  const yFlow = 268;
  out.push(rect(FX + 14, yFlow, FW - 28, 30, { rx: 4, stroke: UART, width: 1.4, dash: "5 4" }));
  out.push(text(FX + FW / 2, yFlow + 20, "UART 0 flow control", { anchor: "middle", size: FS + 0.5, fill: UART }));
  out.push(text((FW + MX) / 2, yFlow + 12, "issue 4 and later", { anchor: "middle", size: FS, fill: UART }));
  out.push(line(FX + FW - 14, yFlow + 22, MX, yFlow + 22, { stroke: UART, width: 1.8, dash: "5 4" }));

  // The radio
  const yR = 140;
  blk(out, RX, yR - 44, RW, 88, ["router", "and the", "Internet"], { size: FS + 0.5 });
  out.push(text((MX + MW + RX) / 2, yR - 10, "Wi-Fi", { anchor: "middle", size: FS, bold: true, fill: DEV }));
  out.push(line(MX + MW, yR, RX - 2, yR, { stroke: DEV, width: 1.8, marker: "wf-w-4" }));
  out.push(line(RX - 14, yR, MX + MW + 2, yR, { stroke: DEV, width: 1.8, marker: "wf-w-4" }));
  figures.wires = out.concat(["</svg>"]);
}

// ---------------------------------------------------------------------------------------------
// Figure: one conversation, three parties
{
  const X = [80, 350, 620];
  const ROW = 32, Y0 = 62;
  const msgs = [
    [0, 1, 'AT+CIPSTART="TCP",...', UART],
    [1, 2, "opens a TCP connection", DEV],
    [1, 0, "CONNECT, OK", UART],
    [0, 1, "AT+CIPSEND=38", UART],
    [1, 0, "OK, then the > prompt", UART],
    [0, 1, "the 38 bytes of the request", UART],
    [1, 2, "the request, in a TCP packet", DEV],
    [1, 0, "SEND OK", UART],
    [2, 1, "the reply, in a TCP packet", DEV],
    [1, 0, "+IPD,31: and the 31 bytes", UART],
    [2, 1, "closes the connection", DEV],
    [1, 0, "CLOSED", UART]
  ];
  const H = Y0 + (msgs.length - 1) * ROW + 16;
  const out = [svgOpen(700, H, "A sequence chart with three vertical lines: your program on the Z80, the Wi-Fi module, and the server. Your program asks the module to open a connection, and the module opens it and answers CONNECT and OK. Your program sends AT+CIPSEND=38, gets the prompt, and sends the 38 bytes, which the module sends to the server in a TCP packet and answers SEND OK. The server's reply arrives in a TCP packet and the module passes it on as +IPD,31: followed by the 31 bytes. The server closes the connection and the module reports CLOSED.")];
  out.push(arrows("wf-s", [UART, DEV]));
  const names = [["your program"], ["the module"], ["the server"]];
  X.forEach((x, i) => {
    out.push(text(x, 18, names[i][0], { anchor: "middle", size: FT, bold: true, fill: i === 1 ? DEV : GREY }));
    out.push(line(x, 30, x, H - 2, { width: 1.4, opacity: 0.55 }));
  });
  msgs.forEach(([a, b, t, c], i) => {
    const y = Y0 + i * ROW;
    const dir = b > a ? 1 : -1;
    out.push(line(X[a] + dir * 2, y, X[b] - dir * 2, y, { stroke: c, width: 1.8, marker: c === UART ? "wf-s-0" : "wf-s-1" }));
    out.push(text((X[a] + X[b]) / 2, y - 7, t, { anchor: "middle", size: FS, fill: c }));
  });
  figures.conversation = out.concat(["</svg>"]);
}

// ---------------------------------------------------------------------------------------------
// Figure: the byte stream, one cell per byte
{
  const cells = [
    ["O", 0], ["K", 0], ["CR", 0], ["LF", 0],
    ["+", 1], ["I", 1], ["P", 1], ["D", 1], [",", 1],
    ["5", 2], [":", 2],
    ["H", 4], ["e", 4], ["l", 4], ["l", 4], ["o", 4],
    ["CR", 0], ["LF", 0]
  ];
  const W = 700 / cells.length;
  const C = [GREY, WARN, LINE, GREY, UART]; // chatter, tag, length, (unused), data
  const out = [svgOpen(700, 118, 'A row of eighteen cells, one per byte, as they arrive on the serial line: O, K, CR, LF are the module\'s chatter; +, I, P, D and the comma are the tag; 5 is the length in decimal; a colon ends it; H, e, l, l, o are five bytes of data, which are counted, not searched; CR and LF that follow are chatter again.')];
  cells.forEach(([t, k], i) => {
    const x = i * W;
    out.push(rect(x, 8, W, 44, { stroke: C[k], width: 1.4, fill: k === 0 || k === 3 ? "none" : C[k], fillOpacity: k === 0 || k === 3 ? undefined : 0.14 }));
    out.push(text(x + W / 2, 37, t, { anchor: "middle", size: t.length > 1 ? FS : FT, bold: true, fill: C[k] }));
  });
  const span = (a, b, t, c, y = 84) => {
    const x0 = a * W + 3, x1 = (b + 1) * W - 3;
    out.push(pathEl(`M${x0},58 L${x0},66 L${x1},66 L${x1},58`, { stroke: c, width: 1.6 }));
    out.push(lines((x0 + x1) / 2, y, t, { anchor: "middle", size: FS, fill: c, lh: 17 }));
  };
  span(0, 3, ["chatter"], GREY);
  span(4, 8, ["the tag"], WARN);
  span(9, 10, ["length", "and colon"], LINE);
  span(11, 15, ["data: counted,", "never searched"], UART);
  span(16, 17, ["chatter"], GREY);
  figures.stream = out.concat(["</svg>"]);
}

// ---------------------------------------------------------------------------------------------
// Figure: where the guarantee ends
{
  const H = 178;
  const out = [svgOpen(700, H, "Left to right: the server, an arrow labelled Wi-Fi and TCP, a lost packet is sent again, the module, an arrow labelled serial line, a lost byte is gone, and the Next's 512-byte receive buffer. A red dashed line below the module marks where TCP's guarantee ends. Below, a green bar under the left half reads TCP checks and resends, and a red bar under the right half reads nothing checks.")];
  out.push(arrows("wf-g", [DEV, MARK]));
  const yB = 22, hB = 74, yM = yB + hB / 2;
  blk(out, 0, yB, 110, hB, ["the", "server"], { size: FS + 0.5 });
  blk(out, 295, yB, 110, hB, ["the", "module"], { c: DEV, fill: true, size: FS + 0.5 });
  blk(out, 590, yB, 110, hB, ["receive", "buffer, 512"], { c: UART, fill: true, size: FS + 0.5 });
  out.push(line(110, yM, 293, yM, { stroke: DEV, width: 2, marker: "wf-g-0" }));
  out.push(line(405, yM, 588, yM, { stroke: MARK, width: 2, marker: "wf-g-1" }));
  out.push(text(202, yM - 10, "Wi-Fi and TCP", { anchor: "middle", size: FS, bold: true, fill: DEV }));
  out.push(text(202, yM + 21, "a lost packet is sent again", { anchor: "middle", size: FS, fill: DEV }));
  out.push(text(497, yM - 10, "the serial line", { anchor: "middle", size: FS, bold: true, fill: MARK }));
  out.push(text(497, yM + 21, "a lost byte is gone", { anchor: "middle", size: FS, fill: MARK }));
  const yBar = 122;
  out.push(line(350, yB + hB, 350, H, { stroke: MARK, width: 2, dash: "6 4" }));
  out.push(rect(0, yBar, 340, 34, { rx: 4, stroke: DEV, width: 1.5, fill: DEV, fillOpacity: 0.12 }));
  out.push(text(170, yBar + 22, "TCP checks and resends", { anchor: "middle", size: FS + 0.5, fill: DEV }));
  out.push(rect(360, yBar, 340, 34, { rx: 4, stroke: MARK, width: 1.5, fill: MARK, fillOpacity: 0.1 }));
  out.push(text(530, yBar + 22, "nothing checks", { anchor: "middle", size: FS + 0.5, fill: MARK }));
  figures.guarantee = out.concat(["</svg>"]);
}

writeFigures(PAGE, figures);
