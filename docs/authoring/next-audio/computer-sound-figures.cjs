#!/usr/bin/env node
// Figures of "How a computer makes sound"
// (docs/content/en/under-the-hood/emulator-internals/computer-sound.mdx).
//
// Every waveform is computed here, so the figures stay exact and to scale. The script rewrites the
// figures in place, between the markers {/* fig:<name> */} and {/* /fig:<name> */} in the page, and
// prints the numbers the text quotes. Edit this script, not the generated SVG, then run:
//
//   node docs/authoring/next-audio/computer-sound-figures.cjs
//
// Sized for print (.ai/hardware-articles-guide.md, Figures): the drawings use the whole 700-unit width, and
// no text is smaller than 13.5 units, about 10 pt when the figure spans a 16 cm text column.
"use strict";

const fs = require("fs");
const path = require("path");

const PAGE = path.join(
  __dirname,
  "../../content/en/under-the-hood/emulator-internals/computer-sound.mdx"
);

// Colours of the page: the wanted sound blue, samples and the DAC's steps orange, the filtered result
// green, anything wrong (aliasing, clipping) red; structure in currentColor.
const BLUE = "#3b82f6";
const ORANGE = "#e8912d";
const GREEN = "#30a46c";
const RED = "#e5484d";
const PURPLE = "#a855f7";

// --- Print sizes: titles, labels, small notes (viewBox units of a 700-wide figure)
const FH = 16.5, FT = 15, FS = 13.5;
const LH = 18; // line height for FT

const r = (v) => Math.round(v * 10) / 10;

/** Maps time and level to a plot box. */
function box(x, y, w, h, t0, t1, v0, v1) {
  return {
    x, y, w, h,
    px: (t) => r(x + ((t - t0) / (t1 - t0)) * w),
    py: (v) => r(y + h - ((v - v0) / (v1 - v0)) * h)
  };
}

/** A smooth curve of fn over [t0, t1], n segments. */
function curve(b, fn, t0, t1, n = 400) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    pts.push(`${b.px(t)},${b.py(fn(t))}`);
  }
  return "M" + pts.join(" L");
}

/** A polyline through [t, v] points. */
function poly(b, pts) {
  return "M" + pts.map(([t, v]) => `${b.px(t)},${b.py(v)}`).join(" L");
}

/** A staircase: each value held until the next time. */
function stairs(b, times, values, tEnd) {
  const pts = [];
  for (let i = 0; i < values.length; i++) {
    const tNext = i + 1 < times.length ? times[i + 1] : tEnd;
    pts.push([times[i], values[i]], [tNext, values[i]]);
  }
  return poly(b, pts);
}

/** First-order low-pass filters in a row, run over a finely sampled input. */
function lowPass(input, dt, cutoffHz, stages, init = input[0]) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const a = dt / (rc + dt);
  let sig = input.slice();
  for (let s = 0; s < stages; s++) {
    const out = [];
    let y = init;
    for (const x of sig) {
      y += a * (x - y);
      out.push(y);
    }
    sig = out;
  }
  return sig;
}

const svgOpen = (h, label) =>
  `<svg viewBox="0 0 700 ${h}" role="img" aria-label="${label}" style={{ width: "100%", height: "auto" }}>`;
const text = (x, y, s, opts = {}) =>
  `  <text x="${r(x)}" y="${r(y)}"${opts.anchor ? ` textAnchor="${opts.anchor}"` : ""} fill="${opts.fill ?? "currentColor"}" fontSize="${opts.size ?? FT}"${opts.bold ? ' fontWeight="bold"' : ""}>${s}</text>`;
const line = (x1, y1, x2, y2, opts = {}) =>
  `  <line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${opts.stroke ?? "currentColor"}" strokeWidth="${opts.width ?? 1}"${opts.dash ? ` strokeDasharray="${opts.dash}"` : ""}${opts.opacity ? ` strokeOpacity="${opts.opacity}"` : ""}${opts.marker ? ` markerEnd="url(#${opts.marker})"` : ""} />`;
const pathEl = (d, opts = {}) =>
  `  <path d="${d}" fill="none" stroke="${opts.stroke ?? "currentColor"}" strokeWidth="${opts.width ?? 2}"${opts.dash ? ` strokeDasharray="${opts.dash}"` : ""}${opts.opacity ? ` strokeOpacity="${opts.opacity}"` : ""} strokeLinejoin="round" />`;
const dot = (x, y, opts = {}) =>
  `  <circle cx="${r(x)}" cy="${r(y)}" r="${opts.r ?? 4}" fill="${opts.fill ?? ORANGE}" />`;
const arrowDefs = (id, color = "currentColor") =>
  `  <defs>\n    <marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">\n      <path d="M0,0 L10,5 L0,10 z" fill="${color}" />\n    </marker>\n  </defs>`;

/** The zero line and a time axis label under a plot box. */
function axes(b, opts = {}) {
  const out = [];
  if (opts.zero !== undefined) {
    out.push(line(b.x, b.py(opts.zero), b.x + b.w, b.py(opts.zero), { opacity: 0.35 }));
  }
  out.push(line(b.x, b.y, b.x, b.y + b.h, { opacity: 0.5 }));
  if (opts.time) {
    out.push(line(b.x, b.y + b.h + 8, b.x + b.w, b.y + b.h + 8, { opacity: 0.5, marker: opts.marker }));
    out.push(text(b.x + b.w, b.y + b.h + 26, opts.time, { anchor: "end", size: FS }));
  }
  return out;
}

const figures = {};
const numbers = [];

// ---------------------------------------------------------------------------------------------
// Figure: the chain, numbers -> DAC -> filter -> amplifier -> speaker -> air
{
  // --- six boxes over the whole width; the gaps leave every arrow a shaft longer than its head
  const W = 88, X0 = 0, Y = 34, H = 150;
  const GAP = (700 - 6 * W) / 5;
  const steps = ["Numbers", "DAC", "Filter", "Amplifier", "Speaker", "Air"];
  const out = [svgOpen(232, "The chain from numbers to sound, six boxes left to right: a list of numbers; the DAC, which turns them into a staircase of voltages; the filter, which smooths the staircase into a wave; the amplifier, which makes the wave larger; the speaker, whose cone moves with it; and the air, where the movement travels as bands of higher and lower pressure. Under the first two boxes: digital, a list of numbers; from the third on: analogue, a voltage that changes smoothly.")];
  out.push(arrowDefs("snd-chain-arrow"));
  const n = 16;
  const samples = [...Array(n)].map((_, i) => Math.round(128 + 127 * Math.sin((2 * Math.PI * i) / n)));
  steps.forEach((s, i) => {
    const x = X0 + i * (W + GAP);
    out.push(`  <rect x="${r(x)}" y="${Y}" width="${W}" height="${H}" rx="8" fill="none" stroke="currentColor" strokeOpacity="0.5" />`);
    out.push(text(x + W / 2, Y - 12, s, { anchor: "middle", size: FH, bold: true }));
    if (i < steps.length - 1) {
      out.push(line(x + W + 3, Y + H / 2, x + W + GAP - 3, Y + H / 2, { marker: "snd-chain-arrow", width: 1.8 }));
    }
  });
  // 1: numbers
  {
    const x = X0;
    samples.slice(0, 8).forEach((v, k) => {
      out.push(text(x + W / 2, Y + 24 + k * 16, String(v), { anchor: "middle", size: FS, fill: ORANGE }));
    });
    out.push(text(x + W / 2, Y + H - 6, "⋮", { anchor: "middle", size: FS, fill: ORANGE }));
  }
  const inner = (i) => box(X0 + i * (W + GAP) + 8, Y + 25, W - 16, H - 50, 0, 1, -1.25, 1.25);
  // 2: staircase
  {
    const b = inner(1);
    const times = samples.map((_, k) => k / n);
    out.push(pathEl(stairs(b, times, samples.map((v) => (0.5 * (v - 128)) / 127), 1), { stroke: ORANGE, width: 2 }));
  }
  // 3: filtered
  {
    const b = inner(2);
    out.push(pathEl(curve(b, (t) => 0.5 * Math.sin(2 * Math.PI * t), 0, 1), { stroke: GREEN, width: 2.5 }));
  }
  // 4: amplified: the filter's wave, twice as tall
  {
    const b = inner(3);
    out.push(pathEl(curve(b, (t) => 1.15 * Math.sin(2 * Math.PI * t), 0, 1), { stroke: GREEN, width: 3 }));
  }
  // 5: speaker: a magnet and a cone, seen from the side, with the cone's travel
  {
    const x = X0 + 4 * (W + GAP);
    const cx = x + 30, cy = Y + H / 2 - 10;
    out.push(`  <rect x="${r(cx - 24)}" y="${cy - 14}" width="16" height="28" fill="currentColor" fillOpacity="0.35" />`);
    out.push(`  <path d="M${r(cx - 8)},${cy - 10} L${r(cx + 20)},${cy - 40} L${r(cx + 20)},${cy + 40} L${r(cx - 8)},${cy + 10} Z" fill="none" stroke="currentColor" strokeWidth="2" />`);
    out.push(line(cx + 32, cy - 30, cx + 32, cy + 30, { stroke: GREEN, width: 1.5, dash: "3 3" }));
    out.push(line(cx + 40, cy, cx + 52, cy, { stroke: GREEN, width: 2, marker: "snd-chain-arrow" }));
    out.push(line(cx + 40, cy, cx + 28, cy, { stroke: GREEN, width: 2, marker: "snd-chain-arrow" }));
    out.push(text(x + W / 2, Y + H - 12, "cone moves", { anchor: "middle", size: FS }));
  }
  // 6: air: bands of pressure
  {
    const x = X0 + 5 * (W + GAP);
    for (let k = 0; k < 32; k++) {
      const p = Math.sin(2 * Math.PI * (k / 12));
      const lx = x + 10 + k * 2.2;
      out.push(line(lx, Y + 20, lx, Y + H - 40, { width: 1.2, opacity: r(0.25 + 0.35 * (p + 1)) }));
    }
    out.push(text(x + W / 2, Y + H - 12, "pressure", { anchor: "middle", size: FS }));
  }
  out.push(text(X0, 220, "digital: a list of numbers", { size: FT, fill: ORANGE }));
  out.push(text(X0 + 2 * (W + GAP), 220, "analogue: a voltage that changes smoothly", { size: FT, fill: GREEN }));
  out.push("</svg>");
  figures.chain = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: a wave and its samples at two rates
{
  const f = 1000; // Hz
  const T = 0.002; // two cycles
  const rates = [16000, 5000];
  const out = [svgOpen(330, "A 1,000 Hz wave drawn twice over two milliseconds. Above, it is sampled 16,000 times a second: 32 dots sit on the curve and trace it closely. Below, it is sampled 5,000 times a second: only 10 dots, which give a much coarser outline of the same wave.")];
  out.push(arrowDefs("snd-samples-arrow"));
  rates.forEach((rate, i) => {
    const b = box(0, 30 + i * 150, 700, 100, 0, T, -1.15, 1.15);
    out.push(...axes(b, { zero: 0 }));
    out.push(pathEl(curve(b, (t) => Math.sin(2 * Math.PI * f * t), 0, T), { stroke: BLUE, width: 1.5, opacity: 0.7 }));
    const count = Math.round(rate * T);
    for (let k = 0; k < count; k++) {
      const t = k / rate;
      const v = Math.sin(2 * Math.PI * f * t);
      out.push(line(b.px(t), b.py(0), b.px(t), b.py(v), { stroke: ORANGE, width: 1.5 }));
      out.push(dot(b.px(t), b.py(v), { r: 3.5 }));
    }
    out.push(text(b.x, b.y - 8, rate.toLocaleString("en-US") + " samples a second", { size: FT, fill: ORANGE }));
    numbers.push(`samples fig: ${rate} Hz -> ${count} samples in 2 ms, ${rate / f} per cycle`);
  });
  const b = box(0, 30 + 150, 700, 100, 0, T, -1.15, 1.15);
  out.push(line(b.x, b.y + b.h + 20, b.x + b.w, b.y + b.h + 20, { opacity: 0.5, marker: "snd-samples-arrow" }));
  for (let ms = 0; ms <= 2; ms++) {
    const x = b.px(ms / 1000);
    out.push(line(x, b.y + b.h + 16, x, b.y + b.h + 24, { opacity: 0.5 }));
    out.push(text(x, b.y + b.h + 40, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === 2 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.samples = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the DAC's staircase and the filtered wave
{
  const f = 1000, rate = 16000, T = 0.002, levels = 16; // 4-bit numbers: 16 levels, to make steps visible
  const fine = 200; // simulation steps per sample
  const dt = 1 / (rate * fine);
  const N = Math.round(T * 3 / dt); // run three times longer, and show the last two milliseconds settled
  const quant = (v) => Math.round(((v + 1) / 2) * (levels - 1)); // 0..15
  const held = [];
  for (let i = 0; i < N; i++) {
    const k = Math.floor(i / fine);
    held.push((quant(Math.sin((2 * Math.PI * f * k) / rate)) / (levels - 1)) * 2 - 1);
  }
  const cutoff = 3000, stages = 2;
  const filtered = lowPass(held, dt, cutoff, stages);
  const start = N - Math.round(T / dt);
  const out = [svgOpen(250, "A 1,000 Hz wave as a DAC delivers it: 16 steps a millisecond, each number held as a flat voltage until the next one, so the output is a staircase with only 16 possible heights. Drawn over it, the same output after a low-pass filter: a smooth wave with no steps, arriving slightly later than the staircase.")];
  out.push(arrowDefs("snd-dac-arrow"));
  const b = box(50, 20, 650, 180, 0, T, -1.15, 1.15);
  out.push(...axes(b, { zero: 0 }));
  // levels grid
  for (let l = 0; l < levels; l++) {
    const v = (l / (levels - 1)) * 2 - 1;
    out.push(line(b.x, b.py(v), b.x + b.w, b.py(v), { opacity: 0.12 }));
  }
  const times = [], vals = [];
  for (let k = 0; k < rate * T; k++) {
    times.push(k / rate);
    vals.push(held[start + k * fine]);
  }
  out.push(pathEl(stairs(b, times, vals, T), { stroke: ORANGE, width: 2 }));
  const fpts = [];
  for (let i = start; i < N; i += 20) fpts.push([(i - start) * dt, filtered[i]]);
  out.push(pathEl(poly(b, fpts), { stroke: GREEN, width: 3 }));
  out.push(line(b.x, b.y + b.h + 20, b.x + b.w, b.y + b.h + 20, { opacity: 0.5, marker: "snd-dac-arrow" }));
  for (let ms = 0; ms <= 2; ms++) {
    const x = b.px(ms / 1000);
    out.push(line(x, b.y + b.h + 16, x, b.y + b.h + 24, { opacity: 0.5 }));
    out.push(text(x, b.y + b.h + 40, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === 2 ? "end" : "middle", size: FS }));
  }
  out.push(text(b.x - 8, b.py(1) + 5, "15", { anchor: "end", size: FS }));
  out.push(text(b.x - 8, b.py(-1) + 5, "0", { anchor: "end", size: FS }));
  out.push(text(b.x - 30, b.y + b.h / 2, "number", { anchor: "middle", size: FS }).replace("<text", `<text transform="rotate(-90 ${b.x - 30} ${b.y + b.h / 2})"`));
  out.push("</svg>");
  figures.dac = out;
  // Measure the delay and the amplitude of the filtered wave, for the text.
  let peakI = start;
  for (let i = start; i < start + Math.round(1 / f / dt); i++) if (filtered[i] > filtered[peakI]) peakI = i;
  const delayUs = ((peakI - start) * dt - 0.25 / f) * 1e6;
  numbers.push(`dac fig: 4-bit, 16 samples/ms, cutoff ${cutoff} Hz x${stages}; filtered peak ${filtered[peakI].toFixed(3)}, delay ${delayUs.toFixed(0)} us`);
}

// ---------------------------------------------------------------------------------------------
// Figure: aliasing, 7,000 Hz sampled 8,000 times a second
{
  const f = 7000, rate = 8000, T = 0.001;
  const alias = Math.abs(f - rate);
  numbers.push(`alias fig: ${f} Hz sampled at ${rate}/s -> looks like ${alias} Hz; limit ${rate / 2} Hz`);
  const out = [svgOpen(246, "One millisecond of a 7,000 Hz wave, drawn as a thin fast curve with seven cycles. It is sampled 8,000 times a second: nine dots in the millisecond. The dots do not follow the fast wave; they lie on a slow 1,000 Hz wave, drawn as a thick dashed curve, which is what the samples describe and what would be heard.")];
  out.push(arrowDefs("snd-alias-arrow"));
  const b = box(0, 34, 700, 160, 0, T, -1.2, 1.2);
  out.push(...axes(b, { zero: 0 }));
  out.push(pathEl(curve(b, (t) => Math.sin(2 * Math.PI * f * t), 0, T, 800), { stroke: BLUE, width: 1.5, opacity: 0.8 }));
  out.push(pathEl(curve(b, (t) => -Math.sin(2 * Math.PI * alias * t), 0, T), { stroke: RED, width: 3, dash: "8 5" }));
  for (let k = 0; k <= rate * T; k++) {
    const t = k / rate;
    out.push(dot(b.px(t), b.py(Math.sin(2 * Math.PI * f * t)), { r: 5 }));
  }
  out.push(text(0, 16, "7,000 Hz: what goes in", { fill: BLUE, size: FT }));
  out.push(text(350, 16, "8,000 samples a second", { fill: ORANGE, size: FT, anchor: "middle" }));
  out.push(text(700, 16, "1,000 Hz: what comes out", { fill: RED, size: FT, anchor: "end" }));
  out.push(line(b.x, b.y + b.h + 20, b.x + b.w, b.y + b.h + 20, { opacity: 0.5, marker: "snd-alias-arrow" }));
  for (const [t, s, a] of [[0, "0", "start"], [0.0005, "0.5 ms", "middle"], [0.001, "1 ms", "end"]]) {
    const x = b.px(t);
    out.push(line(x, b.y + b.h + 16, x, b.y + b.h + 24, { opacity: 0.5 }));
    out.push(text(x, b.y + b.h + 40, s, { anchor: a, size: FS }));
  }
  out.push("</svg>");
  figures.alias = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: one-bit sound, pulse trains at 25 %, 50 % and 75 % on-time and the filtered level
{
  const period = 1; // arbitrary unit: one pulse period
  const perSeg = 8;
  const duties = [0.25, 0.5, 0.75];
  const fine = 400;
  const total = duties.length * perSeg * period;
  const dt = period / fine;
  const input = [];
  for (let i = 0; i < total * fine; i++) {
    const t = i * dt;
    const seg = Math.floor(t / (perSeg * period));
    const phase = (t % period) / period;
    input.push(phase < duties[seg] ? 1 : 0);
  }
  // A filter whose cut-off is well below the pulse rate, two stages, starting settled at the first level.
  const filtered = lowPass(input, dt, 0.15 / period, 2, duties[0]);
  const out = [svgOpen(244, "A one-bit signal that is only ever on or off. For the first eight pulses it is on a quarter of each pulse period, for the next eight half of it, for the last eight three quarters of it. Drawn over it, the filtered output: it rises and settles near a quarter of the full level, then near a half, then near three quarters, with a small ripple left over.")];
  out.push(arrowDefs("snd-pwm-arrow"));
  const b = box(36, 30, 664, 170, 0, total, -0.1, 1.1);
  out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.35 }));
  out.push(line(b.x, b.y, b.x, b.y + b.h, { opacity: 0.5 }));
  const pts = [];
  for (let i = 0; i < input.length; i++) {
    if (i === 0 || input[i] !== input[i - 1]) {
      if (i > 0) pts.push([i * dt, input[i - 1]]);
      pts.push([i * dt, input[i]]);
    }
  }
  pts.push([total, input[input.length - 1]]);
  out.push(pathEl(poly(b, pts), { stroke: BLUE, width: 1.2, opacity: 0.75 }));
  const fpts = [];
  for (let i = 0; i < filtered.length; i += 10) fpts.push([i * dt, filtered[i]]);
  out.push(pathEl(poly(b, fpts), { stroke: GREEN, width: 3.5 }));
  duties.forEach((d, s) => {
    const x0 = b.px(s * perSeg), x1 = b.px((s + 1) * perSeg);
    out.push(line(x0, b.py(d), x1, b.py(d), { stroke: GREEN, dash: "4 4", width: 1 }));
    out.push(text((x0 + x1) / 2, 20, `on ${d * 100} % of the time`, { anchor: "middle", size: FT }));
    if (s > 0) out.push(line(x0, 26, x0, b.y + b.h, { opacity: 0.3, dash: "2 4" }));
    const end = filtered[Math.round((s + 1) * perSeg * fine) - 1];
    numbers.push(`pwm fig: duty ${d} -> filtered level at segment end ${end.toFixed(3)}`);
  });
  out.push(text(b.x - 6, b.py(1) + 5, "on", { anchor: "end", size: FS }));
  out.push(text(b.x - 6, b.py(0) + 5, "off", { anchor: "end", size: FS }));
  out.push(line(b.x, b.y + b.h + 16, b.x + b.w, b.y + b.h + 16, { opacity: 0.5, marker: "snd-pwm-arrow" }));
  out.push(text(b.x + b.w, b.y + b.h + 34, "time: 24 pulse periods", { anchor: "end", size: FS }));
  out.push("</svg>");
  figures.pwm = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: mixing, two waves added and the sum clipped
{
  const T = 0.002;
  const a = (t) => 0.6 * Math.sin(2 * Math.PI * 1000 * t);
  const c = (t) => 0.55 * Math.sin(2 * Math.PI * 3000 * t + Math.PI);
  const sum = (t) => a(t) + c(t);
  const clip = (v) => Math.max(-1, Math.min(1, v));
  const out = [svgOpen(416, "Three plots over the same two milliseconds. Top: a 1,000 Hz wave. Middle: a quieter 3,000 Hz wave. Bottom: their sum, worked out moment by moment, drawn against the top and bottom of the range a converter can deliver. Where the sum would go past the range, the output is flattened against the limit; those clipped stretches are marked.")];
  out.push(arrowDefs("snd-mix-arrow"));
  const rows = [
    { fn: a, label: "1,000 Hz", y: 20, color: BLUE },
    { fn: c, label: "3,000 Hz", y: 120, color: PURPLE }
  ];
  rows.forEach((row) => {
    const b = box(100, row.y, 600, 70, 0, T, -1.25, 1.25);
    out.push(...axes(b, { zero: 0 }));
    out.push(pathEl(curve(b, row.fn, 0, T), { stroke: row.color, width: 2 }));
    out.push(text(0, row.y + 40, row.label, { fill: row.color, size: FT, bold: true }));
  });
  out.push(text(30, 110, "+", { size: 20, anchor: "middle" }));
  out.push(text(30, 214, "=", { size: 20, anchor: "middle" }));
  const b = box(100, 230, 600, 140, 0, T, -1.35, 1.35);
  out.push(...axes(b, { zero: 0 }));
  for (const lim of [1, -1]) out.push(line(b.x, b.py(lim), b.x + b.w, b.py(lim), { stroke: RED, dash: "6 4", width: 1.2 }));
  out.push(text(b.x + b.w, b.py(1) - 6, "top of the range", { anchor: "end", size: FS, fill: RED }));
  out.push(text(b.x + b.w, b.py(-1) + 22, "bottom of the range", { anchor: "end", size: FS, fill: RED }));
  out.push(pathEl(curve(b, sum, 0, T), { stroke: "currentColor", width: 1.2, dash: "3 3", opacity: 0.6 }));
  out.push(pathEl(curve(b, (t) => clip(sum(t)), 0, T, 800), { stroke: GREEN, width: 2.5 }));
  // Clipped stretches in red.
  let runStart = null, peak = 0;
  const n = 2000;
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n;
    const over = Math.abs(sum(t)) > 1;
    peak = Math.max(peak, Math.abs(sum(t)));
    if (over && runStart === null) runStart = t;
    if ((!over || i === n) && runStart !== null) {
      const lim = sum(runStart) > 0 ? 1 : -1;
      out.push(line(b.px(runStart), b.py(lim), b.px(t), b.py(lim), { stroke: RED, width: 5 }));
      runStart = null;
    }
  }
  numbers.push(`mix fig: peak of the sum ${peak.toFixed(3)} of range 1`);
  out.push(text(0, 290, "the sum", { size: FT, bold: true }));
  out.push(line(b.x, b.y + b.h + 16, b.x + b.w, b.y + b.h + 16, { opacity: 0.5, marker: "snd-mix-arrow" }));
  for (let ms = 0; ms <= 2; ms++) {
    const x = b.px(ms / 1000);
    out.push(line(x, b.y + b.h + 12, x, b.y + b.h + 20, { opacity: 0.5 }));
    out.push(text(x, b.y + b.h + 36, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === 2 ? "end" : "middle", size: FS }));
  }
  out.push("</svg>");
  figures.mix = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: panning, the same sound at different levels on the two sides
{
  const cases = [
    { title: "left only", l: 1, r: 0 },
    { title: "equal: centre", l: 0.7, r: 0.7 },
    { title: "more on the right", l: 0.3, r: 0.8 }
  ];
  const out = [svgOpen(256, "Three cases, each seen from above: two speakers in front of a listener, and the level the sound has in each channel. Left only: the left channel at full level, the right silent, and the sound seems to come from the left speaker. Equal levels on both sides: the sound seems to come from the centre, between the speakers. More on the right than on the left: the sound seems to come from between the centre and the right speaker.")];
  cases.forEach((c, i) => {
    // --- three panels of 220 units, 20 apart, over the whole width
    const x = i * 240;
    const sl = x + 30, sr = x + 190, sy = 56;
    out.push(text(x + 110, 20, c.title, { anchor: "middle", size: FH, bold: true }));
    out.push(line(sl + 12, sy, sr - 12, sy, { opacity: 0.35, dash: "4 4" }));
    for (const [sx, col, lab] of [[sl, BLUE, "L"], [sr, PURPLE, "R"]]) {
      out.push(`  <rect x="${sx - 12}" y="${sy - 14}" width="24" height="28" rx="3" fill="none" stroke="${col}" strokeWidth="2" />`);
      out.push(text(sx, sy + 5, lab, { anchor: "middle", size: FT, fill: col, bold: true }));
    }
    // The listener, seen from above: a head with two ears.
    const hx = x + 110, hy = 126;
    out.push(`  <circle cx="${hx}" cy="${hy}" r="16" fill="none" stroke="currentColor" strokeWidth="2" />`);
    out.push(`  <ellipse cx="${hx - 18}" cy="${hy}" rx="3" ry="6" fill="currentColor" />`);
    out.push(`  <ellipse cx="${hx + 18}" cy="${hy}" rx="3" ry="6" fill="currentColor" />`);
    out.push(`  <path d="M${hx - 5},${hy - 15} L${hx},${hy - 22} L${hx + 5},${hy - 15}" fill="none" stroke="currentColor" strokeWidth="2" />`);
    // Where the sound seems to come from.
    const pos = c.r / (c.l + c.r);
    const px = sl + pos * (sr - sl);
    out.push(`  <circle cx="${r(px)}" cy="${sy - (pos === 0 || pos === 1 ? 26 : 0)}" r="8" fill="${GREEN}" />`);
    // Level bars.
    [[c.l, BLUE, "left"], [c.r, PURPLE, "right"]].forEach(([v, col, lab], k) => {
      const by = 172 + k * 28;
      out.push(text(x + 40, by + 14, lab, { anchor: "end", size: FS, fill: col }));
      out.push(`  <rect x="${x + 48}" y="${by}" width="172" height="18" fill="none" stroke="currentColor" strokeOpacity="0.4" />`);
      if (v > 0) out.push(`  <rect x="${x + 48}" y="${by}" width="${r(172 * v)}" height="18" fill="${col}" fillOpacity="0.85" />`);
    });
  });
  out.push(text(0, 248, "Bars: the level in each channel. The green dot: where the sound seems to come from.", { size: FS }));
  out.push("</svg>");
  figures.pan = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: echoes in a room, the paths off the walls and what reaches the ear over time
{
  const Lx = 12, Ly = 8; // metres
  const src = [3, 3], ear = [8, 5.5];
  const c = 343; // speed of sound, m/s
  const absorb = 0.6; // level kept at each wall
  const arrivals = [];
  for (let nx = -2; nx <= 2; nx++) {
    for (let ny = -2; ny <= 2; ny++) {
      const order = Math.abs(nx) + Math.abs(ny);
      if (order > 2) continue;
      const ix = nx * Lx + (nx % 2 === 0 ? src[0] : Lx - src[0]);
      const iy = ny * Ly + (ny % 2 === 0 ? src[1] : Ly - src[1]);
      const d = Math.hypot(ix - ear[0], iy - ear[1]);
      arrivals.push({ order, d, ms: (d / c) * 1000, image: [ix, iy] });
    }
  }
  const direct = arrivals.find((a) => a.order === 0);
  arrivals.forEach((a) => (a.level = (direct.d / a.d) * absorb ** a.order));
  const out = [svgOpen(300, "Left: a room 12 by 8 metres seen from above, with a speaker and a listener. The sound reaches the listener straight away along the direct path, and also along four paths that bounce once off each wall, which are longer. Right: what reaches the listener's ear over the first 60 milliseconds: the direct sound first, at about 16 milliseconds, then the four single echoes between about 26 and 40 milliseconds, quieter, then a crowd of even quieter echoes that bounced twice. Together they are the room's reverberation.")];
  out.push(arrowDefs("snd-room-arrow"));
  // Room, 27 units per metre.
  const S = 27, rx = 1.5, ry = 40;
  const X = (m) => rx + m * S, Y = (m) => ry + (Ly - m) * S;
  out.push(text(0, 24, "a room seen from above (12 × 8 m)", { size: FH, bold: true }));
  out.push(`  <rect x="${rx}" y="${ry}" width="${Lx * S}" height="${Ly * S}" fill="none" stroke="currentColor" strokeWidth="3" />`);
  for (const a of arrivals.filter((a) => a.order === 1)) {
    // The bounce point: where the line from the ear to the image source crosses the wall.
    const [ix, iy] = a.image;
    let t;
    if (ix < 0) t = (0 - ear[0]) / (ix - ear[0]);
    else if (ix > Lx) t = (Lx - ear[0]) / (ix - ear[0]);
    else if (iy < 0) t = (0 - ear[1]) / (iy - ear[1]);
    else t = (Ly - ear[1]) / (iy - ear[1]);
    const bx = ear[0] + t * (ix - ear[0]), by = ear[1] + t * (iy - ear[1]);
    out.push(`  <path d="M${X(src[0])},${Y(src[1])} L${r(X(bx))},${r(Y(by))} L${X(ear[0])},${Y(ear[1])}" fill="none" stroke="${ORANGE}" strokeWidth="1.5" strokeDasharray="5 4" />`);
  }
  out.push(line(X(src[0]), Y(src[1]), X(ear[0]) - 10, Y(ear[1]) - 5, { stroke: BLUE, width: 2.5, marker: "snd-room-arrow" }));
  out.push(`  <rect x="${X(src[0]) - 9}" y="${Y(src[1]) - 9}" width="18" height="18" rx="3" fill="currentColor" />`);
  out.push(text(X(src[0]), Y(src[1]) + 26, "speaker", { anchor: "middle", size: FS }));
  out.push(`  <circle cx="${X(ear[0])}" cy="${Y(ear[1])}" r="9" fill="${GREEN}" />`);
  out.push(text(X(ear[0]), Y(ear[1]) + 26, "listener", { anchor: "middle", size: FS }));
  // Arrivals over time.
  const b = box(390, 50, 310, 196, 0, 60, 0, 1.05);
  out.push(text(b.x, 24, "what reaches the ear", { size: FH, bold: true }));
  out.push(line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, { opacity: 0.5, marker: "snd-room-arrow" }));
  out.push(line(b.x, b.y, b.x, b.y + b.h, { opacity: 0.5 }));
  arrivals.sort((p, q) => q.order - p.order).forEach((a) => {
    if (a.ms > 60) return;
    const col = a.order === 0 ? BLUE : ORANGE;
    out.push(line(b.px(a.ms), b.py(0), b.px(a.ms), b.py(a.level), { stroke: col, width: a.order === 0 ? 4 : 3, opacity: a.order === 2 ? 0.5 : undefined }));
  });
  for (const ms of [0, 20, 40, 60]) {
    out.push(line(b.px(ms), b.y + b.h, b.px(ms), b.y + b.h + 5, { opacity: 0.5 }));
    out.push(text(b.px(ms), b.y + b.h + 20, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === 60 ? "end" : "middle", size: FS }));
  }
  out.push(text(b.x - 8, b.y + 8, "level", { anchor: "end", size: FS }));
  out.push(text(b.x, 292, "direct", { fill: BLUE, size: FS }));
  out.push(text(b.x + 58, 292, "one bounce", { fill: ORANGE, size: FS }));
  out.push(text(b.x + b.w, 292, "two bounces (fainter)", { fill: ORANGE, size: FS, anchor: "end" }));
  out.push("</svg>");
  figures.room = out;
  for (const a of arrivals.sort((p, q) => p.ms - q.ms)) {
    if (a.order < 2) numbers.push(`room fig: order ${a.order}, ${a.d.toFixed(2)} m, ${a.ms.toFixed(1)} ms, level ${a.level.toFixed(2)}`);
  }
  numbers.push(`room fig: ${arrivals.filter((a) => a.order === 2 && a.ms <= 60).length} two-bounce echoes within 60 ms`);
}

// ---------------------------------------------------------------------------------------------
// Numbers the text quotes, worked out once.
numbers.push(`CD: 44,100 x 2 sides x 16 bits = ${44100 * 2 * 16} bits/s; 2^16 = ${2 ** 16} values; limit ${44100 / 2} Hz`);
numbers.push(`telephone: 8,000/s -> limit ${8000 / 2} Hz`);
numbers.push(`A4 440 Hz: period ${(1000 / 440).toFixed(2)} ms; the bit flips ${2 * 440} times a second`);

// ---------------------------------------------------------------------------------------------
let page = fs.readFileSync(PAGE, "utf8");
for (const [name, lines] of Object.entries(figures)) {
  const re = new RegExp(`(\\{/\\* fig:${name} \\*/\\}\\n)[\\s\\S]*?(\\{/\\* /fig:${name} \\*/\\})`);
  if (!re.test(page)) throw new Error(`marker for figure "${name}" not found`);
  page = page.replace(re, (_, open, close) => open + lines.join("\n") + "\n" + close);
}
fs.writeFileSync(PAGE, page);
console.log(numbers.join("\n"));
