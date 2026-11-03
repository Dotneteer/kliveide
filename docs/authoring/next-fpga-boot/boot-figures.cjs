#!/usr/bin/env node
// Figures of "The FPGA and Its Cores: How a Blank Chip Becomes a Next"
// (docs/content/en/under-the-hood/emulator-internals/next-fpga-boot.mdx).
//
// Run:
//   node docs/authoring/next-fpga-boot/boot-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, no
// text is smaller than 13.5 units, and the shared helper keeps 2 units of room around the viewBox.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-fpga-boot.mdx");

const AB = "#e5484d"; // the anti-brick core, slot 0
const NEXT = "#3b82f6"; // the Next core, slot 1
const EXTRA = "#e8912d"; // extra cores
const FW = "#30a46c"; // the firmware on the SD card
const UPD = "#a855f7"; // the updater
const GREY = "currentColor";
const FH = 16.5, FT = 15, FS = 13.5;

function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined, opacity: o.faint }));
  if (t.length) out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: the flash slots on the two boards
{
  const out = [svgOpen(700, 250, "Two bars, each a flash chip to scale within itself. Above, Issue 2 and Issue 3: 16 MB in 32 slots of 512K; slot 0 the anti-brick core, slot 1 the Next core, slots 2 to 7 reserved, slots 8 to 31 extra cores. Below, Issue 4: 32 MB in 15 slots of 2,176K; slot 0 the anti-brick core, slot 1 the Next core, slots 2 to 7 reserved, slots 8 to 14 unused by firmware 1.44.")];
  const bar = (y, title, n, extraLabel) => {
    out.push(text(0, y - 12, title, { size: FT, bold: true }));
    const w = 700 / n;
    for (let i = 0; i < n; i++) {
      const c = i === 0 ? AB : i === 1 ? NEXT : i < 8 ? null : EXTRA;
      const o = c ? { c, fill: true, op: i < 2 ? 0.3 : 0.14, rx: 2 } : { faint: 0.5, dash: "3 3", rx: 2 };
      blk(out, i * w + 1, y, w - 2, 40, n <= 16 ? [String(i)] : [], { ...o, size: FS, tc: GREY });
    }
    // --- a colour key under the bar, one entry per group, no leader lines
    const key = [["0: anti-brick core", AB], ["1: Next core", NEXT], [`2–7: reserved`, null], [extraLabel, EXTRA]];
    let kx = 0;
    const widths = [170, 130, 135];
    key.forEach(([label, c], i) => {
      out.push(rect(kx, y + 56, 18, 16, c ? { rx: 2, stroke: c, width: 2, fill: c, fillOpacity: 0.25 } : { rx: 2, dash: "3 3", opacity: 0.6 }));
      out.push(text(kx + 25, y + 69, label, { size: FS, fill: c ?? GREY }));
      kx += widths[i] ?? 0;
    });
  };
  bar(30, "Issue 2 and Issue 3: 16 MB, 32 slots of 512K", 32, "8–31: extra cores");
  bar(160, "Issue 4: 32 MB, 15 slots of 2,176K", 15, "8–14: unused by firmware 1.44");
  figures.flash = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the start-up chain
{
  const H = 604;
  const out = [svgOpen(700, H, "A flow from top to bottom. Power on; the FPGA loads slot 0, the anti-brick core; its boot ROM asks whether DRIVE and M1 are held. Yes leads right to the updater from TBBLUE.FW, which rewrites slot 1. No: NextReg $10 is written with $80, and the FPGA loads slot 1, the Next core, in config mode. A hard reset, F1 or NextReg $02, enters here from the left. The boot ROM loads a module of TBBLUE.FW, chosen by the keys held: Space the editor, U the updater, C the extra cores, shown to the right. Normally the boot module reads config.ini and loads the ROMs into the SRAM through NextReg $04; it writes NextReg $03 to leave config mode, and soft-resets into NextZXOS.")];
  out.push(arrows("boot-chain", [GREY, UPD, NEXT]));
  const cx = 170, cw = 330, bh = 46, gap = 26;
  const steps = [
    [["power on"], null],
    [["FPGA loads slot 0:", "the anti-brick core"], AB],
    [["its boot ROM:", "DRIVE and M1 held?"], AB],
    [["NextReg $10 = $80: FPGA loads", "slot 1, the Next core, config mode"], NEXT],
    [["boot ROM loads a module", "of TBBLUE.FW from the SD card"], FW],
    [["boot module: config.ini, ROMs", "into SRAM (NextReg $04), settings"], FW],
    [["NextReg $03: machine type,", "config mode off"], FW],
    [["soft reset: NextZXOS", "(or the chosen ROM) starts"], null]
  ];
  const yOf = (i) => i * (bh + gap);
  steps.forEach(([t, c], i) => {
    blk(out, cx, yOf(i), cw, bh, t, c ? { c, fill: true, op: 0.1, size: FS + 0.5, tc: c } : { size: FS + 0.5, bold: i === 0 });
    if (i < steps.length - 1) out.push(pathEl(`M${cx + cw / 2},${yOf(i) + bh} L${cx + cw / 2},${yOf(i + 1) - 3}`, { width: 1.8, marker: "boot-chain-0" }));
  });
  out.push(text(cx + cw / 2 + 8, yOf(3) - 8, "no", { size: FS, bold: true }));
  // --- yes: to the updater
  const ux = 550, uw = 150;
  out.push(pathEl(`M${cx + cw},${yOf(2) + bh / 2} L${ux - 3},${yOf(2) + bh / 2}`, { stroke: UPD, width: 1.8, marker: "boot-chain-1" }));
  out.push(text(cx + cw + 10, yOf(2) + bh / 2 - 8, "yes", { size: FS, bold: true, fill: UPD }));
  blk(out, ux, yOf(2) - 10, uw, bh + 20, ["updater from", "TBBLUE.FW:", "rewrites slot 1"], { c: UPD, fill: true, op: 0.12, size: FS });
  // --- keys: other modules
  out.push(pathEl(`M${cx + cw},${yOf(4) + bh / 2} L${ux - 3},${yOf(4) + bh / 2}`, { stroke: UPD, width: 1.8, marker: "boot-chain-1" }));
  out.push(text(cx + cw + 10, yOf(4) + bh / 2 - 8, "keys", { size: FS, bold: true, fill: UPD }));
  blk(out, ux, yOf(4) - 10, uw, bh + 20, ["Space: editor", "U: updater", "C: extra cores"], { c: UPD, size: FS });
  // --- hard reset enters at slot 1
  blk(out, 0, yOf(3) - 6, 130, bh + 12, ["hard reset:", "F1, NextReg $02"], { c: NEXT, size: FS });
  out.push(pathEl(`M130,${yOf(3) + bh / 2} L${cx - 3},${yOf(3) + bh / 2}`, { stroke: NEXT, width: 1.8, marker: "boot-chain-2" }));
  // --- colour key
  const ky = H - 20;
  [["FPGA and slots", AB], ["Next core", NEXT], ["firmware on the SD card", FW]].forEach(([l, c], i) => {
    const x = [0, 200, 380][i];
    out.push(rect(x, ky - 13, 18, 16, { rx: 2, stroke: c, width: 2, fill: c, fillOpacity: 0.15 }));
    out.push(text(x + 26, ky, l, { size: FS }));
  });
  figures.chain = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the TBBLUE.TBU header
{
  const out = [svgOpen(700, 330, "Three rows. First, the 512-byte header of a TBBLUE.TBU file: bytes 0 to 6 the magic word ZXNFILE, bytes 8 to 23 the text ZX SPECTRUM NEXT, then from byte 25 one record per core, and a byte $FF that ends the list. Second, one record of 15 bytes: byte 0 its length, 1 the slot, 2 the board ID, 3 the version, major and minor, 4 the sub-version, 5 to 8 the image's start and 9 to 12 its size, both in 512-byte sectors counted after the header, and 13 to 14 the checksum. Third, the file: the header followed by the images.")];
  out.push(text(0, 18, "the header, 512 bytes", { size: FT, bold: true }));
  blk(out, 0, 28, 150, 42, ["0–6: ZXNFILE"], { c: FW, fill: true, size: FS });
  blk(out, 154, 28, 220, 42, ["8–23: ZX SPECTRUM NEXT"], { c: FW, fill: true, size: FS });
  blk(out, 378, 28, 250, 42, ["from 25: records"], { c: UPD, fill: true, op: 0.16, size: FS, bold: true });
  blk(out, 632, 28, 68, 42, ["$FF"], { size: FS });
  out.push(text(0, 110, "one record, 15 bytes", { size: FT, bold: true }));
  const w = 700 / 15;
  const fields = [[0, 0, "len"], [1, 1, "slot"], [2, 2, "board"], [3, 3, "ver."], [4, 4, "sub"], [5, 8, "start (sectors)"], [9, 12, "size (sectors)"], [13, 14, "checksum"]];
  for (const [a, b, l] of fields) {
    blk(out, a * w + 1, 120, (b - a + 1) * w - 2, 42, [l], { c: UPD, fill: true, op: 0.12, size: FS });
    out.push(text(a * w + 3, 180, b > a ? `${a}–${b}` : String(a), { size: FS }));
  }
  out.push(text(0, 228, "the file", { size: FT, bold: true }));
  blk(out, 0, 238, 150, 42, ["header"], { c: FW, size: FS });
  blk(out, 154, 238, 270, 42, ["image of record 1"], { c: NEXT, fill: true, size: FS });
  blk(out, 428, 238, 210, 42, ["image of record 2"], { c: NEXT, fill: true, size: FS });
  blk(out, 642, 238, 58, 42, ["…"], { size: FS });
  out.push(text(0, 312, "version byte: major in bits 7–4, minor in bits 3–0; start and size are little-endian", { size: FS }));
  figures.tbu = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
