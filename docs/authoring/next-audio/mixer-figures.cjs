#!/usr/bin/env node
// Figures of "ZX Spectrum Next: The Mixer and the Outputs"
// (docs/content/en/under-the-hood/emulator-internals/next-audio/mixer.mdx).
//
// The hardware's sum and outputs are not emulated by Klive, so their figures are computed here from the
// hardware's rules (the mixer's inputs, the one-bit converter exactly as built, the 12-bit jack, HDMI's
// sampling). The last figure's Klive trace is a machine capture written by
// test/zxnext-hw/audio/next-audio-scene.test.ts (NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures).
//   node docs/authoring/next-audio/mixer-figures.cjs
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

// ---------------------------------------------------------------------------------------------
// Figure: the five inputs, their widths and where they sit in the 13-bit sum
{
  const CW = 38, X0 = 200, top = 40;
  const rows = [
    { name: "EAR", c: BEEPER, from: 9, to: 9, note: "512 or 0" },
    { name: "MIC", c: BEEPER, from: 7, to: 7, note: "128 or 0" },
    { name: "AY chips", c: PSG, from: 11, to: 0, note: "0–2,295" },
    { name: "DACs", c: DAC, from: 10, to: 2, note: "0–510, × 4: 0–2,040" },
    { name: "Pi", c: PI, from: 9, to: 0, note: "0–1,023" }
  ];
  const H = top + rows.length * 38 + 90;
  const out = [svgOpen(700, H, "Each of the mixer's five inputs drawn as the bits it occupies in the 13-bit sum, bit 12 on the left. EAR is a single bit at bit 9, worth 512. MIC is a single bit at bit 7, worth 128. The AY chips' sum takes bits 11 to 0, up to 2,295. The DACs' side, 9 bits, sits at bits 10 to 2, which multiplies it by 4: up to 2,040. The Pi's 10-bit sample takes bits 9 to 0, up to 1,023. All five are added into the sum, bits 12 to 0, 0 to 8,191.")];
  for (let b = 12; b >= 0; b--) out.push(text(X0 + (12 - b) * CW + CW / 2, top - 10, String(b), { anchor: "middle", size: 11 }));
  rows.forEach((row, i) => {
    const y = top + i * 38;
    out.push(text(10, y + 20, row.name, { size: 13, bold: true, fill: row.c }));
    for (let b = 12; b >= 0; b--) {
      const x = X0 + (12 - b) * CW;
      const on = b <= row.from && b >= row.to;
      out.push(rect(x + 1, y, CW - 2, 28, { rx: 3, stroke: on ? row.c : "currentColor", width: on ? 1.8 : 1, opacity: on ? 1 : 0.2, fill: on ? row.c : "none", fillOpacity: on ? 0.2 : undefined }));
    }
    out.push(text(10, y + 34, row.note, { size: 10.5 }));
  });
  const y = top + rows.length * 38 + 14;
  out.push(line(X0, y - 6, X0 + 13 * CW, y - 6, { opacity: 0.5 }));
  out.push(text(X0 - 12, y - 1, "+", { anchor: "end", size: 16 }));
  out.push(text(10, y + 22, "the sum", { size: 13, bold: true, fill: MIX }));
  for (let b = 12; b >= 0; b--) out.push(rect(X0 + (12 - b) * CW + 1, y + 2, CW - 2, 28, { rx: 3, stroke: MIX, width: 1.8, fill: MIX, fillOpacity: 0.15 }));
  out.push(text(10, y + 38, "0–8,191", { size: 10.5 }));
  out.push(text(X0, y + 58, "each box is one bit; the value of bit n is 2ⁿ (bit 9 = 512, bit 2 = 4)", { size: 11.5 }));
  out.push("</svg>");
  figures.inputs = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: how much of the range real mixes use, against the jack's 12 bits
{
  const scenarios = [
    { t: "silence", parts: [["DACs at rest", 1024, DAC], ["Pi off", 512, PI]] },
    { t: "a 128K tune, one chip at full volume", parts: [["", 1536, "currentColor"], ["AY", 510, PSG]] },
    { t: "TurboSound: nine channels at full volume", parts: [["", 1536, "currentColor"], ["AY", 1530, PSG]] },
    { t: "… and the beeper (EAR and MIC) on top", parts: [["", 1536, "currentColor"], ["AY", 1530, PSG], ["", 640, BEEPER]] },
    { t: "three chips in mono, full volume, and EAR", parts: [["", 1536, "currentColor"], ["AY", 2295, PSG], ["", 512, BEEPER]] },
    { t: "every source at its largest", parts: [["", 640, BEEPER], ["AY", 2295, PSG], ["DACs", 2040, DAC], ["Pi", 1023, PI]] }
  ];
  const X0 = 20, W = 660, FULL = 8191, rowH = 46, top = 30;
  const px = (v) => X0 + (v / FULL) * W;
  const jack = px(4095);
  const H = top + scenarios.length * rowH + 50;
  const out = [svgOpen(700, H, "Six mixes drawn to scale on the sum's range of 0 to 8,191, with a line at 4,095, the most the audio jack takes. Silence is 1,536. A 128K tune on one chip at full volume reaches 2,046. TurboSound's nine channels at full volume reach 3,066, and with the beeper's EAR and MIC on top 3,706: all below the line. Three chips in mono at full volume with EAR reach 4,343, past the jack's limit. Every source at its largest reaches 5,998, also past it, though well inside the sum's own range.")];
  scenarios.forEach((sc, i) => {
    const y = top + i * rowH;
    out.push(text(X0, y + 2, sc.t, { size: 12 }));
    let at = 0;
    for (const [label, v, c] of sc.parts) {
      const neutral = c === "currentColor";
      out.push(rect(px(at), y + 8, px(at + v) - px(at), 20, { fill: c, fillOpacity: neutral ? 0.15 : 0.75, stroke: c, width: 1, opacity: neutral ? 0.4 : 1 }));
      if (label && px(at + v) - px(at) > 44) out.push(text((px(at) + px(at + v)) / 2, y + 22, label, { anchor: "middle", size: 11, fill: "#ffffff", bold: true }));
      at += v;
    }
    const over = at > 4095;
    // --- a label that would cross the jack's line moves past it
    const lx = !over && px(at) + 40 > jack ? jack + 6 : px(at) + 6;
    out.push(text(lx, y + 22, fmt(at), { size: 12, bold: true, fill: over ? MIX : "currentColor" }));
    numbers.push(`headroom fig: ${sc.t}: ${at}${over ? " (past the jack)" : ""}`);
  });
  const yb = top + scenarios.length * rowH;
  out.push(line(jack, top - 12, jack, yb, { stroke: MIX, width: 2, dash: "6 4" }));
  out.push(text(jack + 4, top - 14, "4,095: the jack's limit", { size: 11.5, fill: MIX }));
  out.push(line(X0, yb + 8, X0 + W, yb + 8, { opacity: 0.5 }));
  for (const v of [0, 1536, 4095, 8191]) {
    out.push(line(px(v), yb + 4, px(v), yb + 12, { opacity: 0.5 }));
    out.push(text(px(v), yb + 26, fmt(v), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: 11 }));
  }
  out.push("</svg>");
  figures.headroom = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: what the jack makes of a sum past 4,095
{
  const T = 2; // ms
  const sum = (t) => 3000 + 1700 * Math.sin(2 * Math.PI * t); // t in ms: a 1,000 Hz tone on a level of 3,000
  const out = [svgOpen(700, 280, "Two milliseconds of a loud 1,000 Hz tone whose sum swings from 1,300 to 4,700, drawn as a dashed curve, with a line at 4,095. The jack takes only the lowest 12 bits of the sum, so wherever the sum passes 4,095 the jack's value drops by 4,096 and starts again near zero: the solid curve follows the sum until it reaches the line, then falls to the bottom of the range, climbs, and jumps back up when the sum comes down again.")];
  out.push(arrows("mx-wrap", ["currentColor"]));
  const b = box(80, 20, 600, 200, 0, T, 0, 5000);
  for (const v of [0, 4095]) out.push(line(b.x, b.py(v), b.x + b.w, b.py(v), { opacity: v ? 1 : 0.4, stroke: v ? MIX : "currentColor", dash: v ? "6 4" : undefined }));
  out.push(text(b.x - 6, b.py(4095) + 4, "4,095", { anchor: "end", size: 11, fill: MIX }));
  out.push(text(b.x - 6, b.py(0) + 4, "0", { anchor: "end", size: 11 }));
  out.push(text(b.x - 6, b.py(3000) + 4, "3,000", { anchor: "end", size: 11 }));
  const n = 800;
  const pts = [], jackPts = [];
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
  out.push(text(b.x + 6, b.py(4700) - 4, "the sum (dashed)", { size: 12 }));
  out.push(text(b.x + 150, b.py(4700) - 4, "what the jack takes (solid)", { size: 12, fill: MIX }));
  out.push(line(b.x, 246, b.x + b.w, 246, { opacity: 0.5, marker: "mx-wrap-0" }));
  for (let ms = 0; ms <= T; ms++) out.push(text(b.px(ms), 266, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: 11.5 }));
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
  const out = [svgOpen(700, 60 + values.length * 70, "The jack's one-bit converter, clock by clock, for three input values, 48 clocks of 28 MHz each. For 1,024 the output pin is on one clock in four; for 1,536, three clocks in eight; for 3,072, three clocks in four. The share of clocks the pin is on is the value divided by 4,096, and the resistor and capacitor after the pin turn that share into a voltage.")];
  const X0 = 150, CW = 10;
  values.forEach((x, i) => {
    const y = 30 + i * 70;
    const bits = convert(x, N + 4096).slice(4096, 4096 + N); // settled
    const all = convert(x, 4096 * 8).slice(4096);
    const share = all.reduce((a, c) => a + c, 0) / all.length;
    numbers.push(`converter fig: ${x} -> share ${share.toFixed(4)} (x / 4096 = ${(x / 4096).toFixed(4)})`);
    out.push(text(10, y + 18, `input ${fmt(x)}`, { size: 13, bold: true, fill: MIX }));
    out.push(text(10, y + 36, `on ${Math.round(share * 1000) / 10} % of clocks`, { size: 11.5 }));
    const pts = [];
    bits.forEach((bit, k) => {
      pts.push([k, bit], [k + 1, bit]);
    });
    const b = box(X0, y, N * CW, 34, 0, N, 0, 1);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.2 }));
    out.push(pathEl(poly(b, pts), { width: 1.8 }));
    out.push(line(b.x, b.py(share), b.x + b.w, b.py(share), { stroke: MIX, width: 1.5, dash: "5 4" }));
    out.push(text(b.x + b.w + 6, b.py(share) + 4, "average", { size: 11, fill: MIX }));
  });
  out.push(text(X0, 30 + values.length * 70, "48 clocks of 28 MHz: 1.7 µs; the dashed line is the pin's average level", { size: 11.5 }));
  out.push("</svg>");
  figures.converter = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: which bits each output takes
{
  const CW = 30, X0 = 210;
  const rows = [
    { name: "the sum (one side)", c: MIX, cells: [...Array(13)].map((_, k) => `${12 - k}`) },
    { name: "audio jack: 12 bits", c: MIX, cells: ["✕", ..."11 10 9 8 7 6 5 4 3 2 1 0".split(" ")] },
    { name: "HDMI word: 16 bits", c: MIX, cells: ["0", ..."12 11 10 9 8 7 6 5 4 3 2 1 0".split(" "), "0", "0"] },
    { name: "speaker, beeper only", c: BEEPER, cells: ["0", "0", "EAR", "0", "MIC", "0", "0", "0", "0", "0", "0", "0", "0"] }
  ];
  const out = [svgOpen(700, 60 + rows.length * 56, "How each output takes the 13-bit sum. The audio jack takes bits 11 to 0 and drops bit 12. HDMI audio sends a 16-bit word: a 0, the whole sum, and two 0 bits at the bottom, so the word is the sum times 4. The internal speaker, when it plays only the beeper, gets a 13-bit word of its own with EAR at bit 10 and MIC at bit 8; otherwise it gets the left and right jack values added together.")];
  rows.forEach((row, i) => {
    const y = 24 + i * 56;
    out.push(text(10, y + 20, row.name, { size: 12.5, bold: true, fill: row.c }));
    row.cells.forEach((cell, k) => {
      const x = X0 + k * CW;
      // --- a bit of the sum: every cell of row 0, the jack's cells after the dropped one, the HDMI
      //     word's 13 middle cells
      const isBit = i === 0 || (i === 1 && k >= 1) || (i === 2 && k >= 1 && k <= 13);
      const dropped = cell === "✕";
      const named = cell === "EAR" || cell === "MIC";
      const colour = dropped ? MIX : named ? BEEPER : row.c;
      out.push(rect(x + 1, y, CW - 2, 30, { rx: 3, stroke: colour, width: isBit || named ? 1.6 : 1, opacity: isBit || named || dropped ? 1 : 0.35, fill: isBit || named ? colour : "none", fillOpacity: isBit || named ? 0.14 : undefined }));
      out.push(text(x + CW / 2, y + 20, cell, { anchor: "middle", size: named ? 9.5 : 11, fill: dropped ? MIX : named ? BEEPER : "currentColor" }));
    });
  });
  out.push(text(X0, 30 + rows.length * 56, "numbers are bits of the sum; 0 is a constant 0 bit; ✕ is a bit the output drops", { size: 11.5 }));
  out.push("</svg>");
  figures.bits = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: HDMI takes the sum's value 48,000 times a second
{
  const rate = 48000, f = 6875; // Hz: a square wave whose half period is 3.49 sample periods
  const T = 0.6; // ms
  const sq = (tms) => (Math.floor((tms / 1000) * f * 2) % 2 === 0 ? 2048 : 1536);
  const out = [svgOpen(700, 270, "0.6 milliseconds of a beeper square wave of 6,875 Hz in the sum, drawn as a thin line whose edges fall anywhere in time. The dots are the moments HDMI takes the sum's value, 48,000 times a second, and the thick staircase is what HDMI sends: each edge moves to the next dot, so the steps are three or four samples long, not the even three and a half of the real wave.")];
  out.push(arrows("mx-hdmi", ["currentColor"]));
  const b = box(80, 30, 600, 170, 0, T, 1400, 2150);
  out.push(pathEl(poly(b, (() => { const p = []; for (let i = 0; i <= 3000; i++) { const t = (T * i) / 3000; p.push([t, sq(t)]); } return p; })()), { stroke: BEEPER, width: 1.5, opacity: 0.8 }));
  const dt = 1000 / rate;
  const vals = [];
  for (let k = 0; k * dt <= T; k++) vals.push(sq(k * dt));
  out.push(pathEl(sampleStairs(b, vals.slice(0, -1), 0, dt), { stroke: MIX, width: 3 }));
  vals.forEach((v, k) => out.push(`  <circle cx="${b.px(k * dt)}" cy="${b.py(v)}" r="3.5" fill="${MIX}" />`));
  let lens = [], run = 1;
  for (let k = 1; k < vals.length; k++) { if (vals[k] === vals[k - 1]) run++; else { lens.push(run); run = 1; } }
  numbers.push(`hdmi fig: half period ${(rate / f / 2).toFixed(2)} samples; runs ${lens.join(",")}`);
  out.push(text(b.x - 6, b.py(2048) + 4, "2,048", { anchor: "end", size: 11 }));
  out.push(text(b.x - 6, b.py(1536) + 4, "1,536", { anchor: "end", size: 11 }));
  out.push(text(b.x, 18, "the sum (thin)", { size: 12, fill: BEEPER }));
  out.push(text(b.x + 120, 18, "what HDMI sends, 48,000 samples a second (thick, dots)", { size: 12, fill: MIX }));
  out.push(line(b.x, 222, b.x + b.w, 222, { opacity: 0.5, marker: "mx-hdmi-0" }));
  for (const t of [0, 0.2, 0.4, 0.6]) out.push(text(b.px(t), 240, `${t} ms`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: 11.5 }));
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
  const out = [svgOpen(700, 360, "The same scene twice over 0.4 seconds: the beeper switched on from silence, a square wave of 104 Hz. Above, the hardware's digital sum inside the FPGA: the wave moves between 1,536 and 2,048, with silence at 1,536, all of it above zero. Below, Klive's mix, captured from the machine, which stands for the sound after the jack's capacitor: the same 512-unit square, which starts with its top at 512 above zero and drifts down over about a tenth of a second until it is centred on zero, from +256 to −256, as the capacitor after the jack's converter leaves the real machine's sound too.")];
  out.push(arrows("mx-klive", ["currentColor"]));
  const draw = (b, fn, colour) => {
    const pts = [];
    for (let i = 0; i < T / dt; i++) pts.push([i * dt, fn(i)]);
    out.push(pathEl(poly(b, pts), { stroke: colour, width: 1.1 }));
  };
  const b1 = box(90, 30, 590, 120, 0, T, 0, 2300);
  out.push(text(10, 24, "the hardware's digital sum, inside the FPGA (worked out from the rules)", { size: 12.5, bold: true }));
  for (const v of [0, 1536, 2048]) {
    out.push(line(b1.x, b1.py(v), b1.x + b1.w, b1.py(v), { opacity: v ? 0.25 : 0.5 }));
    out.push(text(b1.x - 6, b1.py(v) + 4, fmt(v), { anchor: "end", size: 11 }));
  }
  draw(b1, (i) => hw(i * dt), BEEPER);
  const b2 = box(90, 200, 590, 120, 0, T, -600, 600);
  out.push(text(10, 194, "Klive's mix (captured): the sound after the jack's capacitor", { size: 12.5, bold: true }));
  for (const v of [-256, 0, 256, 512]) {
    out.push(line(b2.x, b2.py(v), b2.x + b2.w, b2.py(v), { opacity: v ? 0.25 : 0.5 }));
    out.push(text(b2.x - 6, b2.py(v) + 4, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0", { anchor: "end", size: 11 }));
  }
  draw(b2, (i) => klive[i], MIX);
  out.push(line(b2.x, 336, b2.x + b2.w, 336, { opacity: 0.5, marker: "mx-klive-0" }));
  for (const t of [0, 100, 200, 300, 400]) out.push(text(b2.px(t), 354, `${t / 1000} s`, { anchor: t === 0 ? "start" : t === T ? "end" : "middle", size: 11.5 }));
  out.push("</svg>");
  figures.klive = out;
  const firstTop = Math.max(...klive.slice(20, 60));
  numbers.push(`klive fig: first top ${firstTop.toFixed(0)} units; ${d.hz.toFixed(2)} Hz`);
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
