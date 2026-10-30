#!/usr/bin/env node
// Figures of "The Mixer: One Sum, Three Outputs" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/mixer.mdx).
//
// The hardware's sum and outputs are not emulated by Klive, so their figures are computed here from the
// hardware's rules (the mixer's inputs, the one-bit converter exactly as built, the 12-bit jack, HDMI's
// sampling). The last figure's Klive trace is a machine capture written by
// test/zxnext-hw/audio/next-audio-scene.test.ts (NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures).
//   node docs/authoring/next-audio/mixer-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units, about 10 pt when the figure spans a 16 cm text column.
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PSG, DAC, PI, MIX, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/mixer.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/mixer", `${name}.json`), "utf8"));

const figures = {};
const numbers = [];
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const GREY = "currentColor";

// --- Print sizes: titles, labels, small notes (viewBox units of a 700-wide figure)
const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18; // line height for FT
const SH = FS + 3; // line height for FS

// ---------------------------------------------------------------------------------------------
// Figure: the five inputs, their widths and where they sit in the 13-bit sum
{
  const X0 = 134, CW = (700 - X0) / 13, top = 30, pitch = 62, cellH = 40;
  const rows = [
    { name: "EAR", c: BEEPER, from: 9, to: 9, note: ["512 or 0"] },
    { name: "MIC", c: BEEPER, from: 7, to: 7, note: ["128 or 0"] },
    { name: "AY chips", c: PSG, from: 11, to: 0, note: ["0–2,295"] },
    { name: "DACs", c: DAC, from: 10, to: 2, note: ["0–510 × 4", "= 0–2,040"] },
    { name: "Pi", c: PI, from: 9, to: 0, note: ["0–1,023"] }
  ];
  const ySum = top + rows.length * pitch + 14;
  const H = ySum + cellH + 44;
  const out = [svgOpen(700, H, "Each of the mixer's five inputs drawn as the bits it occupies in the 13-bit sum, bit 12 on the left. EAR is a single bit at bit 9, worth 512. MIC is a single bit at bit 7, worth 128. The AY chips' sum takes bits 11 to 0, up to 2,295. The DACs' side, 9 bits, sits at bits 10 to 2, which multiplies it by 4: up to 2,040. The Pi's 10-bit sample takes bits 9 to 0, up to 1,023. All five are added into the sum, bits 12 to 0, 0 to 8,191.")];
  for (let b = 12; b >= 0; b--) out.push(text(X0 + (12 - b) * CW + CW / 2, top - 10, String(b), { anchor: "middle", size: FS }));
  const label = (y, name, c, note) => {
    out.push(text(0, y + 16, name, { size: FT, bold: true, fill: c }));
    out.push(lines(0, y + 16 + SH + 1, note, { size: FS, lh: SH }));
  };
  rows.forEach((row, i) => {
    const y = top + i * pitch;
    label(y, row.name, row.c, row.note);
    for (let b = 12; b >= 0; b--) {
      const x = X0 + (12 - b) * CW;
      const on = b <= row.from && b >= row.to;
      out.push(rect(x + 1.5, y, CW - 3, cellH, { rx: 3, stroke: on ? row.c : GREY, width: on ? 1.8 : 1, opacity: on ? 1 : 0.25, fill: on ? row.c : "none", fillOpacity: on ? 0.2 : undefined }));
    }
  });
  out.push(line(X0, ySum - 8, 700, ySum - 8, { opacity: 0.5 }));
  out.push(text(X0 - 8, ySum - 2, "+", { anchor: "end", size: FH, bold: true }));
  label(ySum, "the sum", MIX, ["0–8,191"]);
  for (let b = 12; b >= 0; b--) out.push(rect(X0 + (12 - b) * CW + 1.5, ySum, CW - 3, cellH, { rx: 3, stroke: MIX, width: 1.8, fill: MIX, fillOpacity: 0.15 }));
  out.push(text(0, H - 10, "each box is one bit; the value of bit n is 2ⁿ (bit 9 = 512, bit 2 = 4)", { size: FS }));
  out.push("</svg>");
  figures.inputs = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: how much of the range real mixes use, against the jack's 12 bits
{
  const scenarios = [
    { t: "silence: the DACs and the Pi at rest", parts: [["DACs", 1024, DAC], ["Pi", 512, PI]] },
    { t: "a 128K tune, one chip at full volume", parts: [["", 1536, GREY], ["AY", 510, PSG]] },
    { t: "TurboSound: nine channels at full volume", parts: [["", 1536, GREY], ["AY", 1530, PSG]] },
    { t: "… and the beeper (EAR and MIC) on top", parts: [["", 1536, GREY], ["AY", 1530, PSG], ["", 640, BEEPER]] },
    { t: "three chips in mono, full volume, and EAR", parts: [["", 1536, GREY], ["AY", 2295, PSG], ["", 512, BEEPER]] },
    { t: "every source at its largest", parts: [["", 640, BEEPER], ["AY", 2295, PSG], ["DACs", 2040, DAC], ["Pi", 1023, PI]] }
  ];
  const X0 = 0, W = 698, FULL = 8191, pitch = 64, top = 52, barH = 28;
  const px = (v) => X0 + (v / FULL) * W;
  const jack = px(4095);
  const yb = top + scenarios.length * pitch - 10;
  const H = yb + 44;
  const out = [svgOpen(700, H, "Six mixes drawn to scale on the sum's range of 0 to 8,191, with a dashed line at 4,095, the most the audio jack takes. Silence, the DACs and the Pi at rest, is 1,536. A 128K tune on one chip at full volume reaches 2,046. TurboSound's nine channels at full volume reach 3,066, and with the beeper's EAR and MIC on top 3,706: all below the line. Three chips in mono at full volume with EAR reach 4,343, past the jack's limit. Every source at its largest reaches 5,998, also past it, though well inside the sum's own range.")];
  scenarios.forEach((sc, i) => {
    const y = top + i * pitch;
    out.push(text(X0, y, sc.t, { size: FT }));
    let at = 0;
    for (const [label, v, c] of sc.parts) {
      const neutral = c === GREY;
      out.push(rect(px(at), y + 8, px(at + v) - px(at), barH, { fill: c, fillOpacity: neutral ? 0.15 : 0.75, stroke: c, width: 1, opacity: neutral ? 0.4 : 1 }));
      // --- a label the jack's line would cross moves to the wider piece of its part
      let cx = (px(at) + px(at + v)) / 2;
      if (px(at) < jack && px(at + v) > jack) cx = jack - px(at) > px(at + v) - jack ? (px(at) + jack) / 2 : (jack + px(at + v)) / 2;
      if (label && px(at + v) - px(at) > 30) out.push(text(cx, y + 8 + barH / 2 + 5, label, { anchor: "middle", size: FS, fill: "#ffffff", bold: true }));
      at += v;
    }
    const over = at > 4095;
    // --- a total that would cross the jack's line moves past it
    const lx = !over && px(at) + 52 > jack ? jack + 8 : px(at) + 8;
    out.push(text(lx, y + 8 + barH / 2 + 5, fmt(at), { size: FT, bold: true, fill: over ? MIX : GREY }));
    numbers.push(`headroom fig: ${sc.t}: ${at}${over ? " (past the jack)" : ""}`);
  });
  out.push(line(jack, 26, jack, yb, { stroke: MIX, width: 2.2, dash: "6 4" }));
  out.push(text(jack + 8, 18, "4,095: the jack's limit", { size: FS, fill: MIX }));
  out.push(line(X0, yb + 6, X0 + W, yb + 6, { opacity: 0.5 }));
  for (const v of [0, 1536, 4095, 8191]) {
    out.push(line(px(v), yb + 1, px(v), yb + 11, { opacity: 0.5 }));
    out.push(text(px(v), yb + 30, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.headroom = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: what the jack makes of a sum past 4,095
{
  const T = 2; // ms
  const sum = (t) => 3000 + 1700 * Math.sin(2 * Math.PI * t); // t in ms: a 1,000 Hz tone on a level of 3,000
  const out = [svgOpen(700, 306, "Two milliseconds of a loud 1,000 Hz tone whose sum swings from 1,300 to 4,700, drawn as a dashed curve, with a line at 4,095. The jack takes only the lowest 12 bits of the sum, so wherever the sum passes 4,095 the jack's value drops by 4,096 and starts again near zero: the solid curve follows the sum until it reaches the line, then falls to the bottom of the range, climbs, and jumps back up when the sum comes down again.")];
  out.push(arrows("mx-wrap", [GREY]));
  const b = box(52, 34, 646, 220, 0, T, 0, 5000);
  for (const v of [0, 4095]) out.push(line(b.x, b.py(v), b.x + b.w, b.py(v), { opacity: v ? 1 : 0.4, stroke: v ? MIX : GREY, dash: v ? "6 4" : undefined }));
  out.push(text(b.x - 6, b.py(4095) + 5, "4,095", { anchor: "end", size: FS, fill: MIX }));
  out.push(text(b.x - 6, b.py(0) + 5, "0", { anchor: "end", size: FS }));
  out.push(text(b.x - 6, b.py(3000) + 5, "3,000", { anchor: "end", size: FS }));
  const n = 800;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n;
    pts.push([t, sum(t)]);
  }
  out.push(pathEl(poly(b, pts), { width: 1.5, dash: "4 4", opacity: 0.7 }));
  // the jack's value, broken at each wrap
  let seg = [];
  const segs = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n;
    const v = Math.round(sum(t)) % 4096;
    if (prev !== null && Math.abs(v - prev) > 2000) {
      segs.push(seg);
      seg = [];
    }
    seg.push([t, v]);
    prev = v;
  }
  segs.push(seg);
  for (const sg of segs) out.push(pathEl(poly(b, sg), { stroke: MIX, width: 2.5 }));
  out.push(text(b.x, 18, "the sum (dashed)", { size: FT }));
  out.push(text(b.x + 170, 18, "what the jack takes (solid)", { size: FT, fill: MIX }));
  out.push(line(b.x, 270, b.x + b.w, 270, { opacity: 0.5, marker: "mx-wrap-0" }));
  for (let ms = 0; ms <= T; ms++) out.push(text(b.px(ms), 294, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: FS }));
  out.push("</svg>");
  figures.wrap = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the one-bit converter, bit by bit
{
  // The converter as built: a 14-bit accumulator; each clock it adds the 12-bit input and, when its own
  // top bit is set, takes 4,096 away (adds 3 << 12, modulo 2^14); the output is that top bit.
  function convert(x, n) {
    let acc = 1 << 12;
    const bits = [];
    for (let i = 0; i < n; i++) {
      const msb = (acc >> 13) & 1;
      bits.push(msb);
      acc = (acc + x + (msb ? 3 << 12 : 0)) % (1 << 14);
    }
    return bits;
  }
  const N = 48;
  const values = [1024, 1536, 3072];
  const top = 14, pitch = 80, plotH = 44;
  const H = top + values.length * pitch + 26;
  const out = [svgOpen(700, H, "The jack's one-bit converter, clock by clock, for three input values, 48 clocks of 28 MHz each. For 1,024 the output pin is on one clock in four; for 1,536, three clocks in eight; for 3,072, three clocks in four. A dashed line marks each pattern's average level. The share of clocks the pin is on is the value divided by 4,096, and the resistor and capacitor after the pin turn that share into a voltage.")];
  const X0 = 140, CW = (698 - X0) / N;
  values.forEach((x, i) => {
    const y = top + i * pitch;
    const bits = convert(x, N + 4096).slice(4096, 4096 + N); // settled
    const all = convert(x, 4096 * 8).slice(4096);
    const share = all.reduce((a, c) => a + c, 0) / all.length;
    numbers.push(`converter fig: ${x} -> share ${share.toFixed(4)} (x / 4096 = ${(x / 4096).toFixed(4)})`);
    out.push(text(0, y + 16, `input ${fmt(x)}`, { size: FT, bold: true, fill: MIX }));
    out.push(lines(0, y + 16 + SH + 1, [`on ${Math.round(share * 1000) / 10} %`, "of the clocks"], { size: FS, lh: SH }));
    const pts = [];
    bits.forEach((bit, k) => {
      pts.push([k, bit], [k + 1, bit]);
    });
    const b = box(X0, y + 4, N * CW, plotH, 0, N, 0, 1);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.2 }));
    out.push(pathEl(poly(b, pts), { width: 1.8 }));
    out.push(line(b.x, b.py(share), b.x + b.w, b.py(share), { stroke: MIX, width: 1.8, dash: "5 4" }));
  });
  out.push(text(0, H - 10, "48 clocks of 28 MHz: 1.7 µs; the dashed line is the pin's average level", { size: FS }));
  out.push("</svg>");
  figures.converter = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: which bits each output takes
{
  // --- 16 columns; bit n of the sum is column 1 + (12 - n) in every row, so the rows line up
  const X0 = 134, CW = (700 - X0) / 16, cellH = 36, pitch = 54, top = 10;
  const sumBits = "12 11 10 9 8 7 6 5 4 3 2 1 0".split(" ");
  const rows = [
    { name: ["the sum", "(one side)"], c: MIX, start: 1, cells: sumBits },
    { name: ["audio jack:", "12 bits"], c: MIX, start: 1, cells: ["✕", ...sumBits.slice(1)] },
    { name: ["HDMI word:", "16 bits"], c: MIX, start: 0, cells: ["0", ...sumBits, "0", "0"] },
    { name: ["speaker,", "beeper only"], c: BEEPER, start: 1, cells: ["0", "0", "EAR", "0", "MIC", "0", "0", "0", "0", "0", "0", "0", "0"] }
  ];
  const H = top + rows.length * pitch + 26;
  const out = [svgOpen(700, H, "How each output takes the 13-bit sum, with the sum's bits lined up in columns. The audio jack takes bits 11 to 0 and drops bit 12. HDMI audio sends a 16-bit word: a 0, the whole sum, and two 0 bits at the bottom, so the word is the sum times 4. The internal speaker, when it plays only the beeper, gets a 13-bit word of its own with EAR at bit 10 and MIC at bit 8; otherwise it gets the left and right jack values added together.")];
  rows.forEach((row, i) => {
    const y = top + i * pitch;
    out.push(lines(0, y + 14, row.name, { size: FT, bold: true, fill: row.c, lh: LH }));
    row.cells.forEach((cell, k) => {
      const x = X0 + (row.start + k) * CW;
      // --- a bit of the sum: every cell of row 0, the jack's cells after the dropped one, the HDMI
      //     word's 13 middle cells
      const isBit = i === 0 || (i === 1 && k >= 1) || (i === 2 && k >= 1 && k <= 13);
      const dropped = cell === "✕";
      const named = cell === "EAR" || cell === "MIC";
      const colour = dropped ? MIX : named ? BEEPER : row.c;
      out.push(rect(x + 1.5, y, CW - 3, cellH, { rx: 3, stroke: colour, width: isBit || named ? 1.6 : 1, opacity: isBit || named || dropped ? 1 : 0.35, fill: isBit || named ? colour : "none", fillOpacity: isBit || named ? 0.14 : undefined }));
      out.push(text(x + CW / 2, y + cellH / 2 + 5, cell, { anchor: "middle", size: FS, bold: named, fill: dropped ? MIX : named ? BEEPER : GREY }));
    });
  });
  out.push(text(0, H - 10, "numbers are bits of the sum; 0 is a constant 0 bit; ✕ is a bit the output drops", { size: FS }));
  out.push("</svg>");
  figures.bits = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: HDMI takes the sum's value 48,000 times a second
{
  const rate = 48000, f = 6875; // Hz: a square wave whose half period is 3.49 sample periods
  const T = 0.6; // ms
  const sq = (tms) => (Math.floor((tms / 1000) * f * 2) % 2 === 0 ? 2048 : 1536);
  const out = [svgOpen(700, 284, "0.6 milliseconds of a beeper square wave of 6,875 Hz in the sum, drawn as a thin line whose edges fall anywhere in time. The dots are the moments HDMI takes the sum's value, 48,000 times a second, and the thick staircase is what HDMI sends: each edge moves to the next dot, so the steps are three or four samples long, not the even three and a half of the real wave.")];
  out.push(arrows("mx-hdmi", [GREY]));
  const b = box(52, 38, 640, 180, 0, T, 1400, 2150);
  out.push(pathEl(poly(b, (() => { const p = []; for (let i = 0; i <= 3000; i++) { const t = (T * i) / 3000; p.push([t, sq(t)]); } return p; })()), { stroke: BEEPER, width: 1.5, opacity: 0.8 }));
  const dt = 1000 / rate;
  const vals = [];
  for (let k = 0; k * dt <= T; k++) vals.push(sq(k * dt));
  out.push(pathEl(sampleStairs(b, vals.slice(0, -1), 0, dt), { stroke: MIX, width: 3 }));
  vals.forEach((v, k) => out.push(`  <circle cx="${b.px(k * dt)}" cy="${b.py(v)}" r="3.5" fill="${MIX}" />`));
  let lens = [], run = 1;
  for (let k = 1; k < vals.length; k++) { if (vals[k] === vals[k - 1]) run++; else { lens.push(run); run = 1; } }
  numbers.push(`hdmi fig: half period ${(rate / f / 2).toFixed(2)} samples; runs ${lens.join(",")}`);
  out.push(text(b.x - 6, b.py(2048) + 5, "2,048", { anchor: "end", size: FS }));
  out.push(text(b.x - 6, b.py(1536) + 5, "1,536", { anchor: "end", size: FS }));
  out.push(text(b.x, 18, "the sum (thin)", { size: FT, fill: BEEPER }));
  out.push(text(b.x + 136, 18, "what HDMI sends, 48,000 samples a second (thick, dots)", { size: FT, fill: MIX }));
  out.push(line(b.x, 240, 698, 240, { opacity: 0.5, marker: "mx-hdmi-0" }));
  for (const t of [0, 0.2, 0.4, 0.6]) out.push(text(b.px(t), 266, `${t} ms`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: FS }));
  out.push("</svg>");
  figures.hdmi = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the hardware's sum and Klive's mix of the same scene
{
  const d = capture("beeper-start");
  const unit = d.gain; // words per mixer unit
  const T = 400; // ms
  const dt = 1000 / d.rate;
  const klive = d.left.map((w) => w / unit);
  const half = 1000 / d.hz / 2; // ms
  const hw = (t) => 1536 + (Math.floor(t / half) % 2 === 0 ? 512 : 0);
  const out = [svgOpen(700, 400, "The same scene twice over 0.4 seconds: the beeper switched on from silence, a square wave of 104 Hz. Above, the hardware's digital sum inside the FPGA: the wave moves between 1,536 and 2,048, with silence at 1,536, all of it above zero. Below, Klive's mix, captured from the machine, which stands for the sound after the jack's capacitor: the same 512-unit square, which starts with its top at 512 above zero and drifts down over about a tenth of a second until it is centred on zero, from +256 to −256, as the capacitor after the jack's converter leaves the real machine's sound too.")];
  out.push(arrows("mx-klive", [GREY]));
  const draw = (b, fn, colour) => {
    const pts = [];
    for (let i = 0; i < T / dt; i++) pts.push([i * dt, fn(i)]);
    out.push(pathEl(poly(b, pts), { stroke: colour, width: 1.2 }));
  };
  const b1 = box(52, 34, 646, 130, 0, T, 0, 2300);
  out.push(text(0, 18, "the hardware's digital sum, inside the FPGA (worked out from the rules)", { size: FT, bold: true }));
  for (const v of [0, 1536, 2048]) {
    out.push(line(b1.x, b1.py(v), b1.x + b1.w, b1.py(v), { opacity: v ? 0.25 : 0.5 }));
    out.push(text(b1.x - 6, b1.py(v) + 5, fmt(v), { anchor: "end", size: FS }));
  }
  draw(b1, (i) => hw(i * dt), BEEPER);
  const b2 = box(52, 214, 646, 130, 0, T, -330, 580);
  out.push(text(0, 198, "Klive's mix (captured): the sound after the jack's capacitor", { size: FT, bold: true }));
  for (const v of [-256, 0, 256, 512]) {
    out.push(line(b2.x, b2.py(v), b2.x + b2.w, b2.py(v), { opacity: v ? 0.25 : 0.5 }));
    out.push(text(b2.x - 6, b2.py(v) + 5, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0", { anchor: "end", size: FS }));
  }
  draw(b2, (i) => klive[i], MIX);
  out.push(line(b2.x, 362, b2.x + b2.w, 362, { opacity: 0.5, marker: "mx-klive-0" }));
  for (const t of [0, 100, 200, 300, 400]) out.push(text(b2.px(t), 386, `${t / 1000} s`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: FS }));
  out.push("</svg>");
  figures.klive = out;
  const firstTop = Math.max(...klive.slice(20, 60));
  numbers.push(`klive fig: first top ${firstTop.toFixed(0)} units; ${d.hz.toFixed(2)} Hz`);
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
