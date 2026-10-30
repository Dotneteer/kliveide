#!/usr/bin/env node
// Figures of "TurboSound: Three AY Chips Behind Two Ports" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/turbosound.mdx).
//
// The waveforms come from the machine: the captures that test/zxnext-hw/audio/next-audio-scene.test.ts
// writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The diagrams, the spread of the channels and the level budget are drawn from the rules. Then:
//   node docs/authoring/next-audio/turbosound-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units, about 10 pt when the figure spans a 16 cm text column.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PSG, MIX, box, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/turbosound.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/turbosound", `${name}.json`), "utf8"));
const unitsOf = (d, which = "left") => d[which].map((w) => w / d.gain);
const GREY = "currentColor";
const DT = 1000 / 48000;
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const CHIP_DASH = [undefined, "6 4", "2 3"]; // --- chips 0/1/2: solid, dashed, dotted (plan §0.3)

// --- Print sizes: titles, labels, small notes (viewBox units of a 700-wide figure)
const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18; // line height for FT

const figures = {};
const numbers = [];

const blk = (out, x, y, w, h, t, o = {}) => {
  const size = o.size ?? FT;
  const lh = size + 3;
  out.push(rect(x, y, w, h, { rx: 6, stroke: o.c ?? GREY, width: o.c ? 2 : 1.5, dash: o.dash, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? 0.12 : undefined }));
  out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * lh) / 2 + size * 0.35, t, { anchor: "middle", size, bold: o.bold, fill: o.tc ?? o.c ?? GREY, lh }));
};

// ---------------------------------------------------------------------------------------------
// Figure: how a port $FFFD write is sorted
{
  const out = [svgOpen(700, 360, "A flow diagram. A value written to port $FFFD is tested. If bits 7 to 5 are 000, it selects a register in the selected chip. If bit 7 is 1 and bits 4 to 2 are 111, and TurboSound is on, it selects chip 0, 1 or 2 and sets that chip's pan. Anything else is ignored. Separately, port $BFFD writes the selected register of the selected chip. Of the three chips, the selected one is marked as the one the ports reach.")];
  out.push(arrows("ts-flow", [GREY, PSG]));
  const a = (d, c = GREY) => out.push(pathEl(d, { stroke: c, width: 1.8, marker: c === PSG ? "ts-flow-1" : "ts-flow-0" }));
  blk(out, 0, 132, 128, 60, ["a write to", "port $FFFD"], { bold: true });
  // --- the decision boxes start 50 units after the source box, so that every arrow's last straight run is
  //     longer than its arrowhead
  blk(out, 178, 20, 252, 62, ["bits 7–5 = 000:", "select a register"]);
  blk(out, 178, 131, 252, 62, ["bit 7 = 1, bits 4–2 = 111,", "TurboSound on: select a chip"]);
  blk(out, 178, 242, 252, 50, ["anything else: ignored"]);
  a("M128,162 L144,162 L144,51 L174,51");
  a("M128,162 L174,162");
  a("M144,162 L144,267 L174,267");
  for (let chip = 0; chip < 3; chip++) {
    const y = 20 + chip * 96;
    const sel = chip === 1;
    blk(out, 530, y, 170, 72, sel ? [`chip ${chip}`, "the selected chip"] : [`chip ${chip}`], { c: PSG, dash: CHIP_DASH[chip], fill: sel, bold: true });
  }
  out.push(text(440, 42, "its register", { size: FS }));
  a("M430,51 L500,51 L500,140 L526,140", PSG);
  out.push(text(440, 154, "which chip", { size: FS }));
  a("M430,162 L526,162", PSG);
  blk(out, 178, 304, 252, 50, ["port $BFFD: write it"]);
  a("M430,329 L480,329 L480,182 L526,182", PSG);
  out.push("</svg>");
  figures.flow = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: port $FFFD's two forms as bit strips
{
  const X0 = 100, CW = (700 - X0) / 8;
  const out = [svgOpen(700, 220, "Two strips of eight bits, bit 7 on the left. A register select: bits 7, 6 and 5 are 0, and bits 4 to 0 hold the register number, 0 to 31. A chip select: bit 7 is 1, bit 6 is the left pan, bit 5 the right pan, bits 4 to 2 are 1, 1, 1, and bits 1 to 0 choose the chip: 11 chip 0, 10 chip 1, 01 chip 2.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 18, String(b), { anchor: "middle", size: FS }));
  const strip = (y, title, cells) => {
    out.push(lines(0, y + 24, title, { size: FT, bold: true, lh: LH }));
    for (const c of cells) {
      const x = X0 + (7 - c.from) * CW, w = (c.from - c.to + 1) * CW;
      out.push(rect(x + 2, y, w - 4, 52, { rx: 5, stroke: c.c, width: c.c === GREY ? 1.4 : 2, fill: c.c === GREY ? "none" : c.c, fillOpacity: c.c === GREY ? undefined : 0.16 }));
      out.push(lines(x + w / 2, y + (c.t.length > 1 ? 22 : 31), c.t, { anchor: "middle", size: FT, bold: c.c !== GREY, fill: c.c, lh: LH }));
    }
  };
  strip(30, ["register", "select"], [
    { from: 7, to: 7, t: ["0"], c: GREY }, { from: 6, to: 6, t: ["0"], c: GREY }, { from: 5, to: 5, t: ["0"], c: GREY },
    { from: 4, to: 0, t: ["register number, 0–31"], c: PSG }
  ]);
  strip(112, ["chip", "select"], [
    { from: 7, to: 7, t: ["1"], c: GREY }, { from: 6, to: 6, t: ["pan", "left"], c: PSG }, { from: 5, to: 5, t: ["pan", "right"], c: PSG },
    { from: 4, to: 4, t: ["1"], c: GREY }, { from: 3, to: 3, t: ["1"], c: GREY }, { from: 2, to: 2, t: ["1"], c: GREY },
    { from: 1, to: 0, t: ["chip: 11 = 0,", "10 = 1, 01 = 2"], c: PSG }
  ]);
  out.push(text(X0, 206, "$FF, $FE and $FD select chips 0, 1 and 2 on both sides", { size: FT }));
  out.push("</svg>");
  figures.fffd = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: a sequence of writes on a time line
{
  const writes = [
    ["$FFFD ← $FE", "select chip 1", null],
    ["$FFFD ← $00", "select R0", 1],
    ["$BFFD ← $F9", "R0 = $F9", 1],
    ["$FFFD ← $08", "select R8", 1],
    ["$BFFD ← $0F", "R8 = 15", 1]
  ];
  const out = [svgOpen(700, 270, "Five writes from left to right on a time line, each with the chip it reaches. First, $FE to port $FFFD selects chip 1 and reaches no register. Then $00 to port $FFFD selects register 0 of chip 1; $F9 to port $BFFD writes chip 1's R0; $08 to port $FFFD selects chip 1's R8; $0F to port $BFFD writes it. Rows for chips 0 and 2 receive nothing.")];
  out.push(arrows("ts-seq", [GREY]));
  const X0 = 70, cw = (700 - X0) / writes.length;
  writes.forEach(([w, what], i) => {
    const x = X0 + i * cw;
    out.push(rect(x + 3, 10, cw - 6, 56, { rx: 5 }));
    out.push(text(x + cw / 2, 33, w, { anchor: "middle", size: FS, bold: true, family: "monospace" }));
    out.push(text(x + cw / 2, 55, what, { anchor: "middle", size: FS }));
  });
  out.push(line(X0, 80, 700, 80, { opacity: 0.5, marker: "ts-seq-0" }));
  out.push(text(700, 98, "time", { anchor: "end", size: FS }));
  for (let chip = 0; chip < 3; chip++) {
    const y = 110 + chip * 42;
    out.push(text(0, y + 21, `chip ${chip}`, { size: FT, bold: true, fill: PSG }));
    out.push(line(X0, y + 15, 700, y + 15, { stroke: PSG, opacity: 0.4, dash: CHIP_DASH[chip] }));
    writes.forEach(([, what, to], i) => {
      if (to === chip) {
        const x = X0 + i * cw;
        out.push(rect(x + 8, y + 1, cw - 16, 28, { rx: 4, stroke: PSG, fill: PSG, fillOpacity: 0.2, width: 1.8 }));
        out.push(text(x + cw / 2, y + 20, what, { anchor: "middle", size: FS, fill: PSG, bold: true }));
      }
    });
  }
  out.push(text(X0, 256, "the chip select chooses the chip; it reaches no register", { size: FS }));
  out.push("</svg>");
  figures.sequence = out;
}

// ---------------------------------------------------------------------------------------------
// Captured rows: a label column of 130 units, the plot to the right edge
function rows(id, label, list, T, step, top, rowH = 80) {
  const X = 140, W = 700 - X - 4;
  const H = 10 + list.length * (rowH + 20) + 44;
  const out = [svgOpen(700, H, label)];
  list.forEach((row, i) => {
    const y = 10 + i * (rowH + 20);
    const b = box(X, y, W, rowH, 0, T, 0, top * 1.05);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.3 }));
    out.push(pathEl(sampleStairs(b, row.values.slice(0, Math.round(T / DT)), 0, DT), { stroke: row.c ?? PSG, width: 1.8 }));
    out.push(lines(0, y + rowH / 2 - 6, row.t, { size: FT, bold: true, fill: row.c ?? PSG, lh: LH }));
    if (row.sub) out.push(lines(0, y + rowH / 2 + 13 + (row.t.length - 1) * LH, row.sub, { size: FS, lh: FS + 3 }));
    out.push(text(b.x - 6, b.py(0) + 5, "0", { anchor: "end", size: FS }));
    out.push(text(b.x - 6, b.py(top) + 5, fmt(top), { anchor: "end", size: FS }));
  });
  const b = box(X, 0, W, 0, 0, T, 0, 1);
  const y = H - 34;
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T + 1e-9; t += step) {
    out.push(line(b.px(t), y - 5, b.px(t), y + 5, { opacity: 0.5 }));
    out.push(text(b.px(t), y + 22, `${t} ms`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures[id] = out;
}

// --- Figure: TurboSound on, off, frozen
rows("onoff", "Three captures of the left side, ten milliseconds each, from 0 to 765 units. TurboSound on: three square waves added, C, E and G, a stepped wave reaching 765. TurboSound off from the start: a single square wave, G, 255 units. TurboSound switched off after the chord was set up: again a single square wave, G, now chip 2's.", [
  { t: ["TurboSound", "on"], sub: ["C + E + G"], values: unitsOf(capture("on")) },
  { t: ["off from", "the start"], sub: ["chip 0: G"], values: unitsOf(capture("off")) },
  { t: ["switched", "off after"], sub: ["chip 2: G"], values: unitsOf(capture("frozen")) }
], 10, 2, 765);

// --- Figure: panned chips, left and right
{
  const d = capture("panned");
  rows("panned", "Two captures of the same moment, ten milliseconds each, from 0 to 510 units. The left side: chip 0's C and chip 1's E added. The right side: chip 1's E and chip 2's G added. Chip 0 is missing on the right and chip 2 on the left.", [
    { t: ["left side"], sub: ["chip 0 (C) +", "chip 1 (E)"], values: unitsOf(d, "left") },
    { t: ["right side"], sub: ["chip 1 (E) +", "chip 2 (G)"], values: unitsOf(d, "right") }
  ], 10, 2, 510, 100);
}

// --- Figure: nine channels, left and right
{
  const d = capture("nine");
  const l = unitsOf(d, "left"), r = unitsOf(d, "right");
  numbers.push(`nine fig: max left ${Math.max(...l).toFixed(0)}, right ${Math.max(...r).toFixed(0)}`);
  rows("nine", "Two captures of the same 20 milliseconds, from 0 to 1,530 units: the left and right sides of nine channels at full volume on three chips in ABC. Each is a busy stepped wave that spends most of its time well below 1,000 units and touches 1,530 only at the rare moments when all its channels are high together.", [
    { t: ["left side"], sub: ["A + B of", "each chip"], values: l },
    { t: ["right side"], sub: ["C + B of", "each chip"], values: r }
  ], 20, 4, 1530, 110);
}

// ---------------------------------------------------------------------------------------------
// Figure: where one chip's channels go in ABC, ACB and mono
{
  const modes = [
    { t: "ABC", L: ["A", "B"], R: ["C", "B"] },
    { t: "ACB", L: ["A", "C"], R: ["C", "B"] },
    { t: "mono", L: ["A", "B", "C"], R: ["A", "B", "C"] }
  ];
  const out = [svgOpen(700, 290, "Three panels: ABC, ACB and mono. In each, channels A, B and C are drawn as small boxes placed between a left and a right label according to where they are heard, with the sum each side adds. ABC: A at the left, B in the middle, C at the right; left A plus B, right C plus B, at most 510 each. ACB: A at the left, C in the middle, B at the right; left A plus C, right C plus B. Mono: A, B and C all in the middle; both sides A plus B plus C, at most 765.")];
  const PW = 228, GAP = (700 - 3 * PW) / 2;
  modes.forEach((m, i) => {
    const x0 = i * (PW + GAP);
    out.push(rect(x0 + 1, 2, PW - 2, 284, { rx: 6, opacity: 0.35 }));
    out.push(text(x0 + PW / 2, 30, m.t, { anchor: "middle", size: FH + 2, bold: true, fill: PSG }));
    out.push(text(x0 + 12, 60, "left", { size: FT, bold: true }));
    out.push(text(x0 + PW - 12, 60, "right", { anchor: "end", size: FT, bold: true }));
    out.push(line(x0 + 16, 72, x0 + PW - 16, 72, { opacity: 0.4 }));
    const place = (ch) => {
      const l = m.L.includes(ch), r = m.R.includes(ch);
      return l && r ? 0.5 : l ? 0 : 1;
    };
    const slots = {};
    for (const ch of ["A", "B", "C"]) {
      const p = place(ch);
      slots[p] = (slots[p] ?? 0) + 1;
      const k = slots[p] - 1;
      const cx = x0 + 34 + p * (PW - 68);
      const cy = 102 + k * 42;
      out.push(rect(cx - 21, cy - 17, 42, 34, { rx: 5, stroke: PSG, fill: PSG, fillOpacity: 0.2, width: 2 }));
      out.push(text(cx, cy + 6, ch, { anchor: "middle", size: FH, bold: true, fill: PSG }));
    }
    out.push(text(x0 + PW / 2, 232, `L = ${m.L.join(" + ")}`, { anchor: "middle", size: FT, family: "monospace" }));
    out.push(text(x0 + PW / 2, 254, `R = ${m.R.join(" + ")}`, { anchor: "middle", size: FT, family: "monospace" }));
    out.push(text(x0 + PW / 2, 276, `at most ${m.L.length * 255} a side`, { anchor: "middle", size: FS }));
  });
  out.push("</svg>");
  figures.spread = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the three chips' largest sums on the mixer's range
{
  const X0 = 0, W = 700, FULL = 8191;
  const px = (v) => X0 + (v / FULL) * (W - 2);
  const rowsB = [
    { t: "three chips in stereo, every channel at full volume", parts: [["silence", 1536, GREY], ["AY 1,530", 1530, PSG]] },
    { t: "three chips in mono, every channel at full volume", parts: [["silence", 1536, GREY], ["AY 2,295", 2295, PSG]] },
    { t: "… and the beeper's EAR on top", parts: [["silence", 1536, GREY], ["AY 2,295", 2295, PSG], ["", 512, BEEPER]] }
  ];
  const out = [svgOpen(700, 290, "Three bars drawn to scale on the mixer's range of 0 to 8,191, with a dashed line at 4,095, the audio jack's limit. Each bar starts with the silent level of 1,536. Three chips in stereo at full volume add 1,530, reaching 3,066, under the line. Three chips in mono add 2,295, reaching 3,831, still under it. With the beeper's EAR on top, 512 more, the sum reaches 4,343, past the line.")];
  const jack = px(4095);
  rowsB.forEach((rw, i) => {
    const y = 24 + i * 66;
    const total = rw.parts.reduce((t, p) => t + p[1], 0);
    out.push(text(X0, y, rw.t, { size: FT }));
    let at = 0;
    for (const [label, v, c] of rw.parts) {
      const neutral = c === GREY;
      out.push(rect(px(at), y + 10, px(at + v) - px(at), 30, { fill: c, fillOpacity: neutral ? 0.15 : 0.75, stroke: c, width: 1, opacity: neutral ? 0.4 : 1 }));
      if (label && px(at + v) - px(at) > 70) out.push(text((px(at) + px(at + v)) / 2, y + 31, label, { anchor: "middle", size: FS, bold: !neutral, fill: neutral ? GREY : "#ffffff" }));
      at += v;
    }
    out.push(text(W, y + 31, `sum ${fmt(total)}`, { anchor: "end", size: FT, bold: true, fill: total > 4095 ? MIX : GREY }));
  });
  out.push(line(jack, 12, jack, 226, { stroke: MIX, width: 2.2, dash: "6 4" }));
  out.push(text(jack + 6, 224, "4,095: the jack's limit", { size: FS, fill: MIX }));
  out.push(line(X0, 246, W, 246, { opacity: 0.5 }));
  for (const v of [0, 1536, 4095, 8191]) {
    out.push(line(px(v), 241, px(v), 251, { opacity: 0.5 }));
    out.push(text(px(v), 270, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.budget = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
