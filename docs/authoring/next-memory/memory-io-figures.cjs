#!/usr/bin/env node
// Figures of "Memory, Ports and NextRegs: How the Z80N Reaches the Machine"
// (docs/content/en/under-the-hood/emulator-internals/next-memory-io.mdx).
//
// Every figure is drawn from the rules (no captures): the slots and the SRAM map to scale where the text
// says so. Run:
//   node docs/authoring/next-memory/memory-io-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units.
"use strict";

const path = require("path");
const S = require("../next-audio/_svg.cjs");
const { svgOpen, text, lines, line, pathEl, rect, arrows, writeFigures } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-memory-io.mdx");

// --- One colour per subject in this chapter
const MEM = "#3b82f6"; // memory, the MMU, the SRAM
const IO = "#30a46c"; // I/O ports and devices
const NR = "#e8912d"; // NextRegs
const OVL = "#a855f7"; // the overlays: boot ROM, Multiface, DivMMC, interrupts
const WIN = "#e5484d"; // "this one wins", "this changed"
const GREY = "currentColor";

// --- Print sizes: titles, labels, small notes
const FH = 16.5, FT = 15, FS = 13.5;

const hex2 = (v) => "$" + v.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (v) => "$" + v.toString(16).toUpperCase().padStart(4, "0");

/** A box with centred lines of text. */
function blk(out, x, y, w, h, t, o = {}) {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: o.rx ?? 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? (o.fillC ?? o.c) : "none", fillOpacity: o.fill ? (o.op ?? 0.12) : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
}

const figures = {};

// ---------------------------------------------------------------------------------------------
// Figure: three doors into the machine
{
  const out = [svgOpen(700, 372, "The CPU on the left has three ways into the machine. The memory door: a read or write with MREQ and a 16-bit address goes through the eight MMU slots to 2 MB of SRAM and the block RAM that holds bank 5 and half of bank 7. The I/O door: an IN or OUT with IORQ and a 16-bit port address goes through the port decoder and its enables to some thirty devices. The NextReg door: ports $243B and $253B, or the NEXTREG instruction, reach a file of 256 register numbers. Dashed arrows from the register file point up to the MMU and to the port enables, because NextRegs configure the other two doors.")];
  out.push(arrows("mio-doors", [GREY, MEM, IO, NR]));
  const a = (d, i) => out.push(pathEl(d, { stroke: [GREY, MEM, IO, NR][i], width: 1.8, marker: `mio-doors-${i}` }));
  blk(out, 0, 128, 100, 96, ["Z80N", "CPU"], { bold: true, size: FH });
  const rows = [
    { y: 14, c: MEM, label: ["MREQ, address", "$0000–$FFFF"], mid: ["eight MMU slots", "of 8K"], end: ["2 MB SRAM,", "bank 5 in block RAM"] },
    { y: 138, c: IO, label: ["IORQ, port", "$0000–$FFFF"], mid: ["port decoder", "and enables"], end: ["about thirty", "devices"] },
    { y: 262, c: NR, label: ["$243B / $253B", "or NEXTREG"], mid: ["register file,", "256 numbers"], end: ["the machine's", "settings"] }
  ];
  rows.forEach((rw, i) => {
    const cy = rw.y + 38;
    out.push(lines(186, rw.y + 8, rw.label, { anchor: "middle", size: FS, fill: rw.c, lh: 17 }));
    blk(out, 268, rw.y + 10, 190, 56, rw.mid, { c: rw.c, fill: true, bold: true });
    blk(out, 510, rw.y + 10, 190, 56, rw.end, { c: rw.c });
    a(`M100,176 L118,176 L118,${cy} L264,${cy}`, i + 1);
    a(`M458,${cy} L506,${cy}`, i + 1);
  });
  // --- NextRegs configure the MMU and the enables: dashed arrows up from the register file
  out.push(pathEl("M300,272 L300,208", { stroke: NR, width: 1.8, dash: "6 4", marker: "mio-doors-3" }));
  out.push(pathEl("M430,272 L430,236 L484,236 L484,110 L430,110 L430,84", { stroke: NR, width: 1.8, dash: "6 4", marker: "mio-doors-3" }));
  out.push(text(310, 232, "configures the other two", { size: FS, fill: NR }));
  figures.doors = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: eight slots of 8K, with the values after a reset
{
  const out = [svgOpen(700, 230, "The CPU's 64K drawn as eight equal slots of 8K, from $0000 on the left to $FFFF on the right. Each slot is set by one NextReg, $50 to $57. After a reset they hold $FF, $FF, $0A, $0B, $04, $05, $00 and $01: the ROM in the first two slots, then 16K bank 5 as pages $0A and $0B, bank 2 as pages $04 and $05, and bank 0 as pages $00 and $01.")];
  const x0 = 0, w = 700 / 8;
  const vals = [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01];
  for (let i = 0; i < 8; i++) {
    const x = x0 + i * w;
    out.push(text(x + 2, 18, hex4(i * 0x2000), { size: FS }));
    blk(out, x + 2, 28, w - 4, 70, [`slot ${i}`, hex2(vals[i])], { c: MEM, fill: i >= 2, op: 0.12, bold: true, tc: MEM });
    out.push(text(x + w / 2, 120, `NextReg ${hex2(0x50 + i)}`, { anchor: "middle", size: FS }));
  }
  // --- what the pages are: braces as lines under pairs of slots
  const groups = [["the ROM", 0, 2, GREY], ["bank 5", 2, 4, MEM], ["bank 2", 4, 6, MEM], ["bank 0", 6, 8, MEM]];
  for (const [label, a, b, c] of groups) {
    const xa = a * w + 6, xb = b * w - 6;
    out.push(pathEl(`M${xa},140 L${xa},150 L${xb},150 L${xb},140`, { stroke: c, width: 1.6 }));
    out.push(text((xa + xb) / 2, 174, label, { anchor: "middle", size: FT, bold: true, fill: c }));
  }
  out.push(text(0, 214, "16K bank n is the two 8K pages 2n and 2n + 1; $FF in slot 0 or 1 means “the ROM”", { size: FS }));
  figures.slots = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: from a CPU address to an SRAM address, with a worked example
{
  const out = [svgOpen(700, 330, "How a CPU address becomes an SRAM address, with the example $C123. The top bit strip is the 16-bit CPU address: bits 15 to 13 are 110, slot 6, and bits 12 to 0 are the offset $0123. Slot 6 holds page $10 in NextReg $56. Adding $20 gives SRAM page $30. The bottom strip is the 21-bit SRAM address: the 8 bits of the SRAM page above the same 13-bit offset, $060123.")];
  out.push(arrows("mio-addr", [GREY, MEM]));
  const cw = 34, x0 = 152;
  const bitsTop = 0xc123;
  out.push(lines(0, 52, ["CPU address", "$C123"], { size: FT, bold: true, lh: 18 }));
  for (let b = 15; b >= 0; b--) {
    const x = x0 + (15 - b) * cw;
    const v = (bitsTop >> b) & 1;
    out.push(text(x + cw / 2, 18, String(b), { anchor: "middle", size: FS }));
    out.push(rect(x + 1, 28, cw - 2, 40, { rx: 4, stroke: b >= 13 ? MEM : GREY, width: b >= 13 ? 2 : 1.4, fill: b >= 13 ? MEM : "none", fillOpacity: b >= 13 ? 0.16 : undefined }));
    out.push(text(x + cw / 2, 54, String(v), { anchor: "middle", size: FT, fill: b >= 13 ? MEM : GREY, bold: b >= 13 }));
  }
  out.push(text(x0 + 1.5 * cw, 88, "slot 6", { anchor: "middle", size: FT, bold: true, fill: MEM }));
  out.push(text(x0 + 3 * cw + 6.5 * cw, 88, "offset $0123 (13 bits), passed on unchanged", { anchor: "middle", size: FT }));
  // --- the lookup
  out.push(pathEl(`M${x0 + 1.5 * cw},96 L${x0 + 1.5 * cw},126`, { stroke: MEM, width: 1.8, marker: "mio-addr-1" }));
  blk(out, x0 - 30, 130, 162, 56, ["NextReg $56", "holds page $10"], { c: MEM, fill: true, bold: true });
  out.push(pathEl(`M${x0 + 132},158 L${x0 + 190},158`, { stroke: MEM, width: 1.8, marker: "mio-addr-1" }));
  blk(out, x0 + 194, 130, 170, 56, ["page + $20 =", "SRAM page $30"], { c: MEM, bold: true });
  out.push(pathEl(`M${x0 + 279},186 L${x0 + 279},226`, { stroke: MEM, width: 1.8, marker: "mio-addr-1" }));
  out.push(pathEl(`M${x0 + 3 * cw + 6.5 * cw},96 L${x0 + 3 * cw + 6.5 * cw},112 L${x0 + 15 * cw + 20},112 L${x0 + 15 * cw + 20},252 L${x0 + 15 * cw - 2 + 20 - 18},252`, { stroke: GREY, width: 1.8, marker: "mio-addr-0" }));
  // --- the SRAM address: 8 bits of page, 13 bits of offset
  out.push(lines(0, 254, ["SRAM address", "$060123"], { size: FT, bold: true, lh: 18 }));
  const sx = 152, sw = 520;
  out.push(rect(sx, 230, sw * 8 / 21, 44, { rx: 4, stroke: MEM, width: 2, fill: MEM, fillOpacity: 0.16 }));
  out.push(text(sx + (sw * 8 / 21) / 2, 257, "SRAM page $30", { anchor: "middle", size: FT, bold: true, fill: MEM }));
  out.push(rect(sx + sw * 8 / 21, 230, sw * 13 / 21, 44, { rx: 4, stroke: GREY, width: 1.4 }));
  out.push(text(sx + sw * 8 / 21 + (sw * 13 / 21) / 2, 257, "offset $0123", { anchor: "middle", size: FT }));
  out.push(text(sx, 296, "bits 20–13", { size: FS }));
  out.push(text(sx + sw * 8 / 21 + 4, 296, "bits 12–0", { size: FS }));
  out.push(text(0, 322, "$30 × 8K + $0123 = $060123: 21 bits reach 2 MB", { size: FS }));
  figures.address = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the SRAM map, to scale, and its first 256K, to scale
{
  const out = [svgOpen(700, 380, "Two strips drawn to scale. The top strip is the whole 2 MB of SRAM: the first 256K, one eighth of it, is the system area, and the rest is RAM pages $00 to $DF; on a machine with 1 MB, RAM ends at page $5F, at the 1 MB mark. The bottom strip enlarges the first 256K: 64K of the Next's four ROMs, 8K of DivMMC ROM, 8K unused, 16K of Multiface ROM and RAM, 16K each for the two alternate ROMs, and 128K of DivMMC RAM. Page $00 of RAM begins at SRAM address $040000.")];
  const W = 700;
  const top = 46, H = 56;
  const k = (bytes) => (bytes / (2048 * 1024)) * W;
  out.push(text(0, 22, "the whole SRAM, 2 MB", { size: FT, bold: true }));
  out.push(rect(0, top, k(256 * 1024), H, { stroke: OVL, width: 2, fill: OVL, fillOpacity: 0.16 }));
  out.push(rect(k(256 * 1024), top, k(768 * 1024), H, { stroke: MEM, width: 2, fill: MEM, fillOpacity: 0.2 }));
  out.push(rect(k(1024 * 1024), top, k(1024 * 1024), H, { stroke: MEM, width: 2, fill: MEM, fillOpacity: 0.08, dash: "6 4" }));
  out.push(text(k(640 * 1024), top + 34, "RAM pages $00–$5F", { anchor: "middle", size: FT, bold: true, fill: MEM }));
  out.push(text(k(1536 * 1024), top + 25, "pages $60–$DF", { anchor: "middle", size: FT, bold: true, fill: MEM }));
  out.push(text(k(1536 * 1024), top + 43, "(only with 2 MB)", { anchor: "middle", size: FS, fill: MEM }));
  for (const [b, l] of [[0, "$000000"], [256 * 1024, "$040000"], [1024 * 1024, "$100000: 1 MB"], [2048 * 1024, "$1FFFFF"]]) {
    const x = Math.min(k(b), W);
    out.push(line(x, top + H, x, top + H + 8, { width: 1.4 }));
    // --- $000000 and $040000 start at their ticks: centred, $040000 would run into $000000 (87.5 units apart)
    const anchor = b <= 256 * 1024 ? undefined : b === 2048 * 1024 ? "end" : "middle";
    out.push(text(x, top + H + 24, l, { size: FS, anchor }));
  }
  // --- the zoom: lines from the first eighth down to the full width
  const zt = 196, zh = 60;
  out.push(line(0, top + H + 30, 0, zt - 6, { width: 1, dash: "3 3" }));
  out.push(line(k(256 * 1024), top + H + 30, W, zt - 6, { width: 1, dash: "3 3" }));
  const kz = (bytes) => (bytes / (256 * 1024)) * W;
  const parts = [
    [0, 64, "4 ROMs", GREY, true],
    [64, 8, "", OVL, false],
    [72, 8, "", GREY, false],
    [80, 16, "", OVL, false],
    [96, 16, "", GREY, false],
    [112, 16, "", GREY, false],
    [128, 128, "DivMMC RAM, 16 × 8K", OVL, true]
  ];
  for (const [s, l, label, c, big] of parts) {
    out.push(rect(kz(s * 1024), zt, kz(l * 1024), zh, { stroke: c, width: c === GREY ? 1.4 : 2, fill: c === GREY ? "none" : c, fillOpacity: c === GREY ? undefined : 0.14 }));
    if (big) out.push(text(kz((s + l / 2) * 1024), zt + 35, label, { anchor: "middle", size: FT, bold: true, fill: c }));
  }
  // --- labels for the narrow parts, on leader lines under the strip: each leader has its own height, so
  //     that no drop crosses another leader's level run
  const small = [
    [68, ["DivMMC", "ROM 8K"], OVL, 110, 10],
    [76, ["unused", "8K"], GREY, 212, 10],
    [88, ["Multiface", "16K"], OVL, 316, 34],
    [104, ["alt ROM 0", "16K"], GREY, 420, 24],
    [120, ["alt ROM 1", "16K"], GREY, 524, 14]
  ];
  small.forEach(([mid, lab, c, lx, lv]) => {
    const x = kz(mid * 1024);
    out.push(pathEl(`M${x},${zt + zh} L${x},${zt + zh + lv} L${lx},${zt + zh + lv} L${lx},${zt + zh + 44}`, { stroke: c, width: 1.2 }));
    out.push(lines(lx, zt + zh + 62, lab, { anchor: "middle", size: FS, fill: c, lh: 16 }));
  });
  out.push(text(0, zt + zh + 112, "the first 256K, enlarged: nothing the MMU can name lives here", { size: FS }));
  figures.sram = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: who answers an address
{
  const out = [svgOpen(700, 380, "Three columns for three parts of the CPU's 64K, each a stack of candidates in priority order, the highest at the top; the first one that claims the address answers. $0000 to $3FFF: the boot ROM (reads only, while the machine starts), the Multiface, the DivMMC, the Layer 2 mapping, RAM through the MMU, the config bank of NextReg $04, and last the ROM or the alternate ROM. $4000 to $BFFF: the Layer 2 mapping, when it covers all 48K, then the MMU. $C000 to $FFFF: the MMU alone.")];
  out.push(arrows("mio-prio", [GREY, WIN]));
  const cols = [
    { x: 0, w: 258, title: "$0000–$3FFF", items: [["boot ROM (reads, at start-up)", OVL], ["Multiface", OVL], ["DivMMC", OVL], ["Layer 2 mapping", "#e8912d"], ["RAM through the MMU", MEM], ["config bank, NextReg $04", MEM], ["the ROM or the alt ROM", GREY]] },
    { x: 300, w: 190, title: "$4000–$BFFF", items: [["Layer 2 mapping", "#e8912d"], ["the MMU", MEM]] },
    { x: 530, w: 170, title: "$C000–$FFFF", items: [["the MMU", MEM]] }
  ];
  for (const c of cols) {
    out.push(text(c.x + c.w / 2, 20, c.title, { anchor: "middle", size: FH, bold: true }));
    c.items.forEach(([label, col], i) => {
      blk(out, c.x, 34 + i * 44, c.w, 36, [label], { c: col === GREY ? undefined : col, fill: col !== GREY, op: 0.1, size: FT });
    });
  }
  out.push(pathEl("M300,128 L300,330", { stroke: WIN, width: 1.8, marker: "mio-prio-1" }));
  out.push(lines(316, 160, ["the first candidate", "that claims the", "address answers;", "the ones below it", "never see it"], { size: FT, fill: WIN, lh: 19 }));
  out.push(text(530, 140, "Layer 2 maps here only", { size: FS }));
  out.push(text(530, 157, "when its segment is 11", { size: FS }));
  out.push(text(0, 360, "a write to a read-only candidate (a ROM) is dropped; it does not fall through to the next one", { size: FS }));
  figures.priority = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: what a $7FFD write does to the eight slots
{
  const out = [svgOpen(700, 262, "Two rows of the eight MMU slots, before and after writing 5 to port $7FFD. Before: $0A, $0B, $0A, $20, $04, $05, $00, $01, set by the program. After: $FF, $FF, $0A, $20, $04, $05, $0A, $0B. The write puts the ROM back in slots 0 and 1 and bank 5 in slots 6 and 7, marked as changed; slots 2 to 5 keep what the program put there, including the $20 in slot 3.")];
  out.push(arrows("mio-7ffd", [GREY]));
  const before = [0x0a, 0x0b, 0x0a, 0x20, 0x04, 0x05, 0x00, 0x01];
  const after = [0xff, 0xff, 0x0a, 0x20, 0x04, 0x05, 0x0a, 0x0b];
  const x0 = 100, w = 75;
  const row = (y, vals, lab, mark) => {
    out.push(lines(0, y + 22, lab, { size: FT, bold: true, lh: 18 }));
    vals.forEach((v, i) => {
      const changed = mark && (i < 2 || i > 5);
      blk(out, x0 + i * w + 2, y, w - 4, 52, [hex2(v)], { c: changed ? WIN : MEM, fill: true, op: changed ? 0.14 : 0.08, bold: true });
    });
  };
  for (let i = 0; i < 8; i++) out.push(text(x0 + i * w + w / 2, 18, `slot ${i}`, { anchor: "middle", size: FS }));
  row(28, before, ["before"], false);
  out.push(pathEl("M60,92 L60,132", { width: 1.8, marker: "mio-7ffd-0" }));
  out.push(text(76, 117, "OUT ($7FFD), 5: bank 5, ROM 0", { size: FT, bold: true }));
  row(140, after, ["after"], true);
  out.push(text(x0 + w, 220, "ROM again", { anchor: "middle", size: FT, bold: true, fill: WIN }));
  out.push(text(x0 + 4 * w, 220, "left alone", { anchor: "middle", size: FT, bold: true, fill: MEM }));
  out.push(text(x0 + 7 * w, 220, "bank 5", { anchor: "middle", size: FT, bold: true, fill: WIN }));
  out.push(text(0, 250, "slots 2–5 change only when a program leaves the +3's all-RAM layout", { size: FS }));
  figures.p7ffd = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the +3's four all-RAM layouts ($1FFD bit 0 set), from zxnext.vhd's special-mode slot formulas
{
  const layouts = [["00", [0, 1, 2, 3]], ["01", [4, 5, 6, 7]], ["10", [4, 5, 6, 3]], ["11", [4, 7, 6, 3]]];
  const x0 = 130, w = (700 - x0) / 4, rowH = 62, y0 = 34;
  const H = y0 + layouts.length * rowH + 34;
  const out = [svgOpen(700, H, "Four rows, one for each value of port $1FFD bits 2 to 1 with bit 0 set, each showing the CPU's 64K as four 16K blocks, $0000, $4000, $8000 and $C000, with the bank in each and its two MMU pages. Bits 00: banks 0, 1, 2 and 3. Bits 01: banks 4, 5, 6 and 7. Bits 10: banks 4, 5, 6 and 3. Bits 11: banks 4, 7, 6 and 3. Banks 5 and 7, the two screens, are filled. There is no ROM in any of the layouts.")];
  out.push(lines(0, 14, ["$1FFD", "bits 2–1"], { size: FS, bold: true, lh: 16 }));
  for (let i = 0; i < 4; i++) out.push(text(x0 + i * w + 4, 24, hex4(i * 0x4000), { size: FS }));
  layouts.forEach(([bits, banks], r) => {
    const y = y0 + r * rowH;
    out.push(text(0, y + 32, bits, { size: FH, bold: true }));
    banks.forEach((bank, i) => {
      const screen = bank === 5 || bank === 7;
      blk(out, x0 + i * w + 2, y, w - 4, rowH - 10, [`bank ${bank}`, `pages ${hex2(2 * bank)}, ${hex2(2 * bank + 1)}`], { c: MEM, fill: screen, op: 0.22, bold: false, tc: MEM });
    });
  });
  out.push(rect(0, H - 22, 18, 14, { rx: 3, stroke: MEM, width: 1.2, fill: MEM, fillOpacity: 0.22 }));
  out.push(text(24, H - 10, "banks 5 and 7, the two screens; no layout has a ROM anywhere", { size: FS }));
  figures.allram = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: which address bits a port decodes
{
  const rowsDef = [
    { name: ["$FE", "the ULA"], bits: { 0: "0" } },
    { name: ["$7FFD", "128K paging"], bits: { 15: "0", 14: "1*", 1: "0", 0: "1" } },
    { name: ["$FFFD", "AY register"], bits: { 15: "1", 14: "1", 2: "1", 1: "0", 0: "1" } },
    { name: ["$243B", "NextReg select"], bits: Object.fromEntries([...Array(16)].map((_, b) => [b, String((0x243b >> b) & 1)])) }
  ];
  const H = 32 + rowsDef.length * 62 + 34;
  const out = [svgOpen(700, H, "A grid of the sixteen address bits of a port, bit 15 on the left, for four ports. Port $FE decodes only bit 0, which must be 0, so every even address is the ULA. Port $7FFD decodes bit 15 = 0, bit 1 = 0 and bit 0 = 1, and bit 14 = 1 only in +3 timing. Port $FFFD decodes bits 15 and 14 = 1, bit 2 = 1, bit 1 = 0 and bit 0 = 1. Port $243B decodes all sixteen bits. A dot marks a bit the port ignores.")];
  const x0 = 140, cw = 35;
  for (let b = 15; b >= 0; b--) out.push(text(x0 + (15 - b) * cw + cw / 2, 20, String(b), { anchor: "middle", size: FS }));
  rowsDef.forEach((rw, i) => {
    const y = 32 + i * 62;
    out.push(lines(0, y + 20, rw.name, { size: FT, bold: true, lh: 18 }));
    for (let b = 15; b >= 0; b--) {
      const x = x0 + (15 - b) * cw;
      const v = rw.bits[b];
      const plus3 = v && v.endsWith("*");
      out.push(rect(x + 1, y, cw - 2, 46, { rx: 4, stroke: v ? IO : GREY, width: v ? 2 : 1, fill: v ? IO : "none", fillOpacity: v ? 0.16 : undefined, dash: plus3 ? "4 3" : undefined, opacity: v ? undefined : 0.5 }));
      out.push(text(x + cw / 2, y + 29, v ? v.replace("*", "") : "·", { anchor: "middle", size: FT, bold: !!v, fill: v ? IO : GREY }));
    }
  });
  out.push(text(0, H - 12, "· = ignored;  dashed = decoded only in +3 timing", { size: FS }));
  figures.decode = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the read path of an IN
{
  const out = [svgOpen(700, 330, "The read path of an IN instruction. Every device compares the port address with its own; a device that matches puts its byte out, one that does not puts out 0. The bytes of all devices are ORed together into one byte. If some device inside the machine claimed the port, the CPU reads that byte. If none did, it reads the expansion bus when the bus is on and allowed to answer I/O, and $FF otherwise.")];
  out.push(arrows("mio-read", [GREY, IO, WIN]));
  const devs = [["ULA, $FE", "matches: its byte"], ["AY, $FFFD", "no match: 0"], ["Kempston, $1F", "no match: 0"], ["NextReg, $253B", "no match: 0"]];
  devs.forEach(([a, b], i) => {
    const y = 12 + i * 74;
    blk(out, 0, y, 190, 60, [a, b], { c: IO, fill: i === 0, op: 0.12 });
    out.push(pathEl(`M190,${y + 30} L222,${y + 30} L222,150 L246,150`, { stroke: IO, width: 1.8, marker: i === 1 ? "mio-read-1" : undefined }));
  });
  blk(out, 250, 118, 92, 64, ["OR of", "all bytes"], { c: IO, bold: true });
  out.push(pathEl("M342,150 L382,150", { stroke: GREY, width: 1.8, marker: "mio-read-0" }));
  blk(out, 386, 112, 150, 76, ["did a device", "inside claim", "the port?"], { bold: true });
  blk(out, 580, 12, 120, 60, ["yes: the", "ORed byte"], { c: WIN, bold: true });
  blk(out, 580, 140, 120, 76, ["no, bus on:", "the bus's", "byte"], {});
  blk(out, 580, 254, 120, 60, ["no: $FF"], { c: WIN, bold: true });
  out.push(pathEl("M461,112 L461,42 L576,42", { width: 1.8, marker: "mio-read-0" }));
  out.push(pathEl("M536,178 L576,178", { width: 1.8, marker: "mio-read-0" }));
  out.push(pathEl("M461,188 L461,284 L576,284", { width: 1.8, marker: "mio-read-0" }));
  figures.readpath = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: the ways into the register file
{
  const out = [svgOpen(700, 372, "Four writers reach the NextReg file. A write to port $243B stores the register number in the selection latch, which port $243B reads back and every reset sets to $24. A write to port $253B queues a write to the selected number. The NEXTREG instruction queues a write with its own number, 20 T-states for NEXTREG n,v and 17 for NEXTREG n,A, and leaves the selection alone. A Copper MOVE writes registers $01 to $7F. An arbiter gives the Copper priority; a CPU write waits one 28 MHz tick and is never lost. Reads go only through port $253B, which reads the selected register.")];
  out.push(arrows("mio-nr", [GREY, NR, WIN]));
  blk(out, 0, 14, 210, 56, ["OUT to $243B", "(select)"], { c: NR });
  blk(out, 0, 112, 210, 56, ["OUT to $253B", "(write)"], { c: NR });
  blk(out, 0, 200, 210, 76, ["NEXTREG n,v  20 T", "NEXTREG n,A  17 T", "(number in the opcode)"], { c: NR, fill: true, size: FS + 0.5 });
  blk(out, 0, 300, 210, 56, ["Copper MOVE", "registers $01–$7F"], { c: NR });
  blk(out, 270, 14, 190, 56, ["selection latch", "after reset: $24"], { c: NR, bold: true });
  blk(out, 270, 150, 140, 168, ["arbiter:", "the Copper", "first; the CPU", "waits one", "tick"], { c: WIN, bold: true });
  blk(out, 490, 150, 210, 168, ["register file", "$00–$FF"], { c: NR, fill: true, bold: true, size: FH });
  const a = (d, i = 1) => out.push(pathEl(d, { stroke: [GREY, NR, WIN][i], width: 1.8, marker: `mio-nr-${i}` }));
  a("M210,42 L266,42");
  a("M210,140 L240,140 L240,170 L266,170");
  a("M210,238 L266,238");
  a("M210,328 L240,328 L240,300 L266,300");
  a("M365,70 L365,100 L340,100 L340,146");
  out.push(text(374, 96, "number", { size: FS, fill: NR }));
  a("M410,234 L486,234", 2);
  out.push(lines(520, 40, ["reads: IN from", "$253B returns the", "selected register;", "NEXTREG cannot read"], { size: FS, lh: 17 }));
  figures.nrpaths = [...out, "</svg>"];
}

// ---------------------------------------------------------------------------------------------
// Figure: a map of the 256 numbers
{
  const listed = new Set();
  const add = (a, b = a) => { for (let i = a; i <= b; i++) listed.add(i); };
  [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0e, 0x0f].forEach((v) => add(v));
  add(0x10, 0x1c); add(0x1e, 0x20); add(0x22, 0x24); add(0x26, 0x39); add(0x40, 0x44); add(0x4a, 0x4c);
  add(0x50, 0x57); add(0x60, 0x64); add(0x68, 0x6c); add(0x6e, 0x71); add(0x75, 0x79); add(0x7f);
  add(0x80, 0x8a); add(0x8c); add(0x8e, 0x8f); add(0x90, 0x93); add(0x98, 0x9b); add(0xa0); add(0xa2); add(0xa8, 0xa9);
  add(0xb0, 0xb2); add(0xb8, 0xbb); add(0xc0); add(0xc2, 0xce); add(0xcf); add(0xd8, 0xda); add(0xf0); add(0xf8, 0xfa); add(0xff);
  listed.delete(0xc1);
  const group = (n) => {
    if (n === 0x04 || (n >= 0x50 && n <= 0x57) || n === 0x8c || n === 0x8e || n === 0x8f) return MEM;
    if ((n >= 0x28 && n <= 0x2b) || (n >= 0x80 && n <= 0x8a) || (n >= 0x90 && n <= 0xbb) || (n >= 0xd8 && n <= 0xfa)) return IO;
    if (n === 0x20 || n === 0x22 || n === 0x23 || (n >= 0xc0 && n <= 0xcf)) return OVL;
    if ((n >= 0x12 && n <= 0x1f) || (n >= 0x26 && n <= 0x79)) return NR;
    return GREY;
  };
  const x0 = 46, cw = 40.875, ch = 25;
  const H = 30 + 16 * ch + 82;
  const out = [svgOpen(700, H, "A sixteen by sixteen grid of the NextReg numbers $00 to $FF, one row per high hex digit. Numbers the register list documents are filled with their group's colour; the rest are empty. Grey: the machine and its settings, $00 to $11, the reserved $24, the user register $7F and $FF. Blue: memory, NextReg $04, the MMU at $50 to $57, and $8C to $8F. Orange: video and sound, the bulk of $12 to $79. Green: ports, inputs and peripherals, the keymap at $28 to $2B, the expansion bus and port enables at $80 to $8A, the Pi and ESP GPIO at $90 to $A9, the extended keys and DivMMC entry points at $B0 to $BB, the I/O traps at $D8 to $DA and the XDEV and XADC registers at $F0 to $FA. Purple: interrupts, $20, $22, $23 and $C0 to $CF. Registers $80 and up, below the dashed line, are out of the Copper's reach.")];
  for (let c = 0; c < 16; c++) out.push(text(x0 + c * cw + cw / 2, 20, c.toString(16).toUpperCase(), { anchor: "middle", size: FS }));
  for (let r0 = 0; r0 < 16; r0++) {
    const y = 28 + r0 * ch;
    out.push(text(0, y + 17, `$${r0.toString(16).toUpperCase()}x`, { size: FS }));
    for (let c = 0; c < 16; c++) {
      const n = r0 * 16 + c;
      const x = x0 + c * cw;
      if (listed.has(n)) {
        const g = group(n);
        out.push(rect(x + 1, y + 1, cw - 2, ch - 2, { rx: 3, stroke: g, width: 1.2, fill: g, fillOpacity: g === GREY ? 0.22 : 0.3 }));
      } else {
        out.push(rect(x + 1, y + 1, cw - 2, ch - 2, { rx: 3, stroke: GREY, width: 0.8, opacity: 0.3 }));
      }
    }
  }
  out.push(line(x0 - 44, 28 + 8 * ch, 700, 28 + 8 * ch, { width: 1.6, dash: "6 4" }));
  const ly = 28 + 16 * ch + 26;
  const legend = [["machine", GREY], ["memory", MEM], ["video and sound", NR], ["ports and peripherals", IO], ["interrupts", OVL]];
  let lx = 0;
  for (const [l, c] of legend) {
    out.push(rect(lx, ly - 13, 18, 16, { rx: 3, stroke: c, width: 1.2, fill: c, fillOpacity: c === GREY ? 0.22 : 0.3 }));
    out.push(text(lx + 24, ly, l, { size: FS }));
    lx += 24 + l.length * 7.4 + 22;
  }
  out.push(text(0, ly + 30, "below the dashed line, $80–$FF: the CPU only; the Copper reaches $01–$7F", { size: FS }));
  figures.map = [...out, "</svg>"];
}

writeFigures(PAGE, figures);
console.log("figures written:", Object.keys(figures).join(", "));
