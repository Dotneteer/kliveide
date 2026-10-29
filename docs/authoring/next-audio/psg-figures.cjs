#!/usr/bin/env node
// Figures of "ZX Spectrum Next: One AY Chip" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/psg.mdx).
//
// The waveforms come from the machine: the captures that test/zxnext-hw/audio/next-audio-scene.test.ts
// writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// The diagrams, the tone counter's timeline and the volume tables are drawn from the chip's rules. Then:
//   node docs/authoring/next-audio/psg-figures.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { PSG, MIX, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/psg.mdx");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "captures/psg", `${name}.json`), "utf8"));
const units = (d) => d.left.map((w) => w / d.gain);
const GREY = "currentColor";
const RATE = 48000;
const DT = 1000 / RATE; // ms per sample

const figures = {};
const numbers = [];
const fmt = (v) => Math.round(v).toLocaleString("en-US");

/** The chip's volume tables, in mixer units (one channel at full volume is 255) */
const YM = [0, 1, 1, 2, 2, 3, 3, 4, 6, 7, 9, 10, 12, 14, 17, 19, 23, 27, 32, 37, 44, 53, 62, 71, 84, 102, 119, 136, 161, 192, 224, 255];
const AY = [0, 3, 4, 6, 10, 15, 21, 34, 40, 65, 91, 114, 144, 181, 215, 255];

/** A plot of one capture in mixer units, 0 to `top`, with a 0 and a top line */
function trace(out, b, values, colour, width = 1.6) {
  out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.3 }));
  out.push(pathEl(sampleStairs(b, values, 0, DT), { stroke: colour, width }));
}
function timeAxis(out, b, y, T, step) {
  out.push(line(b.x, y, b.x + b.w, y, { opacity: 0.5 }));
  for (let t = 0; t <= T + 1e-9; t += step) {
    out.push(line(b.px(t), y - 4, b.px(t), y + 4, { opacity: 0.5 }));
    out.push(text(b.px(t), y + 19, `${+t.toFixed(2)} ms`, { anchor: t === 0 ? "start" : Math.abs(t - T) < 1e-9 ? "end" : "middle", size: 11.5 }));
  }
}

// ---------------------------------------------------------------------------------------------
// Figure: one chip's parts
{
  const out = [svgOpen(700, 330, "A block diagram of one AY chip. On the left, the clock of 218,750 ticks a second feeds three tone generators, one per channel, the noise generator and the envelope generator. The tone generators and the noise generator go into the mixer register R7, which makes one on/off signal per channel. The envelope's level goes to all three channels' amplitude registers, each of which picks a fixed volume or the envelope's; the volume table turns that into a level; the three outputs A, B and C leave the chip on the right.")];
  out.push(arrows("ay-blk", [GREY, PSG]));
  const blk = (x, y, w, h, t, o = {}) => {
    out.push(rect(x, y, w, h, { rx: 6, stroke: o.c ?? GREY, width: o.c ? 1.8 : 1.4, fill: o.fill ? o.c : "none", fillOpacity: o.fill ? 0.12 : undefined }));
    out.push(lines(x + w / 2, y + h / 2 - ((t.length - 1) * 14) / 2 + 4, t, { anchor: "middle", size: o.size ?? 12, bold: o.bold, fill: o.c ?? GREY, lh: 14 }));
  };
  const a = (d, c = GREY) => out.push(pathEl(d, { stroke: c, width: 1.5, marker: c === PSG ? "ay-blk-1" : "ay-blk-0" }));
  blk(10, 130, 90, 60, ["clock", "218,750", "ticks/s"], { size: 11.5 });
  const tones = [40, 90, 140];
  tones.forEach((y, i) => blk(140, y, 120, 36, [`tone ${"ABC"[i]}`, `R${2 * i}, R${2 * i + 1}`], { size: 11.5 }));
  blk(140, 196, 120, 36, ["noise", "R6"], { size: 11.5 });
  blk(140, 260, 120, 40, ["envelope", "R11, R12, R13"], { size: 11.5 });
  for (const y of [58, 108, 158, 214]) a(`M100,160 L120,160 L120,${y} L136,${y}`);
  a("M120,160 L120,280 L136,280");
  blk(300, 40, 110, 192, ["mixer", "register", "R7", "", "tone and/or", "noise", "per channel"], { size: 11.5 });
  for (const y of [58, 108, 158]) a(`M260,${y} L296,${y}`);
  a("M260,214 L296,214");
  // --- per channel: amplitude and volume table
  tones.forEach((y, i) => {
    blk(450, y, 110, 36, [`amplitude R${8 + i}`, "fixed or envelope"], { size: 11 });
    a(`M410,${y + 18} L446,${y + 18}`);
    blk(590, y, 60, 36, ["table"], { size: 11.5 });
    a(`M560,${y + 18} L586,${y + 18}`);
    a(`M650,${y + 18} L686,${y + 18}`, PSG);
    out.push(text(690, y + 10, "ABC"[i], { anchor: "end", size: 13, bold: true, fill: PSG }));
  });
  // --- the envelope's level, one bus up the gap between the mixer and the amplitudes, into all three
  out.push(pathEl("M260,280 L430,280 L430,70", { stroke: GREY, width: 1.5 }));
  for (const y of tones) {
    a(`M430,${y + 30} L446,${y + 30}`);
    out.push(`  <circle cx="430" cy="${y + 30}" r="2.5" fill="currentColor" />`);
  }
  out.push(text(440, 262, "the envelope's level,", { size: 11 }));
  out.push(text(440, 276, "shared by A, B and C", { size: 11 }));
  out.push(text(620, 205, "outputs, 0–255", { anchor: "middle", size: 11.5, fill: PSG }));
  out.push("</svg>");
  figures.block = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the register map
{
  const regs = [
    ["R0", "tone A, low 8 bits", 8], ["R1", "tone A, top 4 bits", 4], ["R2", "tone B, low 8 bits", 8], ["R3", "tone B, top 4 bits", 4],
    ["R4", "tone C, low 8 bits", 8], ["R5", "tone C, top 4 bits", 4], ["R6", "noise period", 5], ["R7", "mixer", 8, true],
    ["R8", "amplitude A", 5], ["R9", "amplitude B", 5], ["R10", "amplitude C", 5], ["R11", "envelope period, low", 8],
    ["R12", "envelope period, high", 8], ["R13", "envelope shape", 4], ["R14", "I/O port A", 8, "io"], ["R15", "I/O port B", 8, "io"]
  ];
  const rowH = 30, top = 34, CW = 15;
  const out = [svgOpen(700, top + 8 * rowH + 30, "The sixteen registers in two columns, each with the bits it uses drawn as boxes, bit 7 on the left. R0, R2 and R4, the low 8 bits of the tone periods of channels A, B and C; R1, R3 and R5, their top 4 bits. R6, the noise period, 5 bits. R7, the mixer, 8 bits: the I/O directions in bits 7 and 6, noise off for C, B, A in bits 5 to 3, tone off for C, B, A in bits 2 to 0. R8, R9 and R10, the amplitudes, 5 bits. R11 and R12, the envelope period's low and high bytes. R13, the envelope shape, 4 bits. R14 and R15, the I/O ports A and B, 8 bits each.")];
  regs.forEach(([name, what, bits, kind], i) => {
    const col = Math.floor(i / 8), row = i % 8;
    const x = 10 + col * 350, y = top + row * rowH;
    out.push(text(x, y + 18, name, { size: 12.5, bold: true, fill: kind === "io" ? GREY : PSG }));
    out.push(text(x + 38, y + 18, what, { size: 12 }));
    const bx = x + 200;
    for (let b = 7; b >= 0; b--) {
      const used = b < bits;
      const c = !used ? GREY : kind === "io" || (kind === true && b >= 6) ? GREY : PSG;
      const on = used && c === PSG;
      out.push(rect(bx + (7 - b) * CW, y + 6, CW - 2, 18, { rx: 2, stroke: c, width: used ? 1.4 : 1, opacity: used ? 1 : 0.25, fill: on ? PSG : "none", fillOpacity: on ? 0.25 : undefined }));
    }
  });
  for (const col of [0, 1]) {
    const bx = 10 + col * 350 + 200;
    out.push(text(bx + CW / 2 - 1, top - 6, "7", { anchor: "middle", size: 10.5 }));
    out.push(text(bx + 7 * CW + CW / 2 - 1, top - 6, "0", { anchor: "middle", size: 10.5 }));
  }
  out.push(text(10, top + 8 * rowH + 20, "R7, bit 7 to 0: port B and port A direction, noise off C, B, A, tone off C, B, A (active low)", { size: 11.5 }));
  out.push("</svg>");
  figures.regmap = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: a tone counter with period 3, tick by tick
{
  const P = 3, N = 19;
  const out = [svgOpen(700, 200, "Nineteen ticks of the chip on a time line. Under them, the tone counter with period 3: it reads 0, 1, 2, 0, 1, 2 and so on. Each time it starts again from 0, the square wave below flips, so the wave stays high for 3 ticks, low for 3 ticks, and a whole period is 6 ticks.")];
  const X0 = 110, W = 570, cw = W / N;
  out.push(text(10, 34, "ticks", { size: 12.5, bold: true }));
  out.push(text(10, 74, "counter", { size: 12.5, bold: true }));
  out.push(text(10, 124, "square wave", { size: 12.5, bold: true, fill: PSG }));
  let count = 0, op = 0;
  const wave = [];
  for (let k = 0; k < N; k++) {
    const x = X0 + k * cw;
    out.push(line(x, 24, x, 40, { opacity: 0.5 }));
    out.push(text(x + cw / 2, 34, String(k), { anchor: "middle", size: 10.5 }));
    out.push(rect(x + 2, 58, cw - 4, 24, { rx: 3, opacity: 0.6 }));
    out.push(text(x + cw / 2, 75, String(count), { anchor: "middle", size: 12 }));
    wave.push(op);
    if (count >= P - 1) { count = 0; op ^= 1; } else count++;
  }
  const pts = [];
  wave.forEach((v, k) => { const y = v ? 104 : 140; pts.push([X0 + k * cw, y], [X0 + (k + 1) * cw, y]); });
  out.push(pathEl("M" + pts.map(([x, y]) => `${S.r(x)},${y}`).join(" L"), { stroke: PSG, width: 2.2 }));
  out.push(line(X0, 160, X0 + 6 * cw, 160, { stroke: PSG }));
  out.push(line(X0, 155, X0, 165, { stroke: PSG }));
  out.push(line(X0 + 6 * cw, 155, X0 + 6 * cw, 165, { stroke: PSG }));
  out.push(text(X0 + 3 * cw, 180, "one period: 2 × 3 = 6 ticks", { anchor: "middle", size: 11.5, fill: PSG }));
  out.push(text(X0 + 10 * cw, 180, "the wave flips when the counter starts again", { size: 11.5 }));
  out.push("</svg>");
  figures.counter = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the noise generator's shift register
{
  const out = [svgOpen(700, 170, "Seventeen boxes in a row, bit 16 on the left and bit 0 on the right. Arrows show every bit moving one place to the right at each step. Bit 0 leaves the register on the right as the noise signal. Bit 0 and bit 2 are taken into an exclusive-or, whose result goes back round to become the new bit 16.")];
  out.push(arrows("ay-lfsr", [GREY, PSG]));
  const X0 = 40, CW = 34, y = 60;
  for (let b = 16; b >= 0; b--) {
    const x = X0 + (16 - b) * CW;
    const tap = b === 0 || b === 2;
    out.push(rect(x + 1, y, CW - 2, 30, { rx: 3, stroke: tap ? PSG : GREY, width: tap ? 1.8 : 1.2, fill: tap ? PSG : "none", fillOpacity: tap ? 0.18 : undefined }));
    out.push(text(x + CW / 2, y + 20, String(b), { anchor: "middle", size: 11.5, bold: tap, fill: tap ? PSG : GREY }));
  }
  out.push(text(X0 + 8.5 * CW, y + 50, "every step: each bit moves one place right →", { anchor: "middle", size: 11.5 }));
  const xb0 = X0 + 16 * CW + CW / 2, xb2 = X0 + 14 * CW + CW / 2;
  out.push(pathEl(`M${X0 + 17 * CW},${y + 15} L${X0 + 17 * CW + 40},${y + 15}`, { stroke: PSG, width: 1.8, marker: "ay-lfsr-1" }));
  out.push(text(X0 + 17 * CW + 4, y + 36, "noise", { size: 12, bold: true, fill: PSG }));
  // --- the exclusive-or and the feedback
  const gx = (xb0 + xb2) / 2, gy = 22;
  out.push(rect(gx - 32, gy - 13, 64, 22, { rx: 11, stroke: PSG, width: 1.6 }));
  out.push(text(gx, gy + 3, "excl. or", { anchor: "middle", size: 11, fill: PSG }));
  out.push(pathEl(`M${xb0},${y} L${xb0},${gy + 9} L${gx + 20},${gy + 9}`, { stroke: PSG, width: 1.4 }));
  out.push(pathEl(`M${xb2},${y} L${xb2},${gy + 9} L${gx - 20},${gy + 9}`, { stroke: PSG, width: 1.4 }));
  out.push(pathEl(`M${gx - 32},${gy - 2} L${X0 + CW / 2},${gy - 2} L${X0 + CW / 2},${y - 4}`, { stroke: PSG, width: 1.6, marker: "ay-lfsr-1" }));
  out.push(text(X0 + CW, gy - 7, "the new bit 16", { size: 11.5, fill: PSG }));
  out.push("</svg>");
  figures.lfsr = out;
}

// ---------------------------------------------------------------------------------------------
// Captured rows: a helper for figures of one or more 10 ms captures stacked
function rows(id, label, list, T, step, top = 255, rowH = 80) {
  const H = 20 + list.length * (rowH + 14) + 40;
  const out = [svgOpen(700, H, label)];
  list.forEach((row, i) => {
    const y = 16 + i * (rowH + 14);
    const rowTop = row.top ?? top;
    const b = box(170, y, 510, rowH, 0, T, 0, rowTop * 1.05);
    const n = Math.round(T / DT);
    trace(out, b, row.values.slice(0, n), row.c ?? PSG);
    out.push(lines(10, y + rowH / 2 - 4, row.t, { size: 12.5, bold: true, fill: row.c ?? PSG, lh: 16 }));
    if (row.sub) out.push(text(10, y + rowH / 2 + 12 + (row.t.length - 1) * 16, row.sub, { size: 11.5 }));
    out.push(text(b.x - 6, b.py(0) + 4, "0", { anchor: "end", size: 10.5 }));
    out.push(text(b.x - 6, b.py(rowTop) + 4, fmt(rowTop), { anchor: "end", size: 10.5 }));
  });
  const b = box(170, 0, 510, 0, 0, T, 0, 1);
  timeAxis(out, b, H - 30, T, step);
  out.push("</svg>");
  figures[id] = out;
}

// --- Figure: A4
{
  const d = capture("a4");
  const v = units(d);
  rows("a4", "Six milliseconds of channel A with period 249 at full volume, captured from the machine: a square wave of 439.3 Hz between 0 and 255 units. Each half lasts 249 ticks of the chip, 1.14 milliseconds, and a whole period 2.28 milliseconds.", [{ t: ["channel A", "period 249"], sub: "439.3 Hz", values: v }], 6, 1, 255, 110);
}

// --- Figure: noise at two periods
{
  rows("noise", "Two captures of noise on channel A, ten milliseconds each, from 0 to 255 units. Period 1: the level changes so fast that most samples fall between on and off, a dense band. Period 31: long runs of on and off of uneven length, which change about 1,800 times a second.", [
    { t: ["noise", "period 1"], sub: "109,375 steps/s", values: units(capture("noise-1")) },
    { t: ["noise", "period 31"], sub: "3,528 steps/s", values: units(capture("noise-31")) }
  ], 10, 2);
}

// --- Figure: R7's four cases
{
  rows("mix", "Four captures of channel A, ten milliseconds each, from 0 to 255 units, with tone period 109 and noise period 8. Tone only: a square wave of 1,003 Hz. Noise only: random on and off. Tone and noise: the noise during the tone's high halves, silence during its low halves. Neither: a flat line at 255, the channel's volume as a steady level.", [
    { t: ["tone only"], sub: "R7 = $3E", values: units(capture("mix-tone")) },
    { t: ["noise only"], sub: "R7 = $37", values: units(capture("mix-noise")) },
    { t: ["tone and noise"], sub: "R7 = $36", values: units(capture("mix-both")) },
    { t: ["neither"], sub: "R7 = $3F", values: units(capture("mix-neither")) }
  ], 10, 2, 255, 56);
}

// ---------------------------------------------------------------------------------------------
// Figure: the volume tables
{
  const out = [svgOpen(700, 330, "A chart of the level each fixed volume 0 to 15 gives, in mixer units from 0 to 255. Two lines of points: YM2149 mode, which uses every other entry of its 32-entry table, and AY-3-8910 mode, its own 16 entries. Both start at 0 and end at 255 and curve upwards, rising slowly at first and steeply at the top. The AY line lies above the YM line at every volume from 1 to 14: volume 8 gives 40 in AY mode and 27 in YM mode.")];
  const b = box(70, 30, 600, 240, 0, 15, 0, 270);
  for (const v of [0, 64, 128, 192, 255]) {
    out.push(line(b.x, b.py(v), b.x + b.w, b.py(v), { opacity: v ? 0.15 : 0.5 }));
    out.push(text(b.x - 8, b.py(v) + 4, String(v), { anchor: "end", size: 11 }));
  }
  const ym = [...Array(16)].map((_, v) => [v, v ? YM[2 * v + 1] : 0]);
  const ay = [...Array(16)].map((_, v) => [v, AY[v]]);
  for (const [pts, c] of [[ym, MIX], [ay, PSG]]) {
    out.push(pathEl(poly(b, pts), { stroke: c, width: 2 }));
    for (const [v, l] of pts) out.push(`  <circle cx="${b.px(v)}" cy="${b.py(l)}" r="3.5" fill="${c}" />`);
  }
  out.push(text(b.px(8) - 8, b.py(40) - 10, "AY: 40", { anchor: "end", size: 11.5, bold: true, fill: PSG }));
  out.push(text(b.px(8) + 8, b.py(27) + 16, "YM: 27", { size: 11.5, bold: true, fill: MIX }));
  out.push(text(b.x + 10, 26, "AY-3-8910 mode", { size: 12.5, bold: true, fill: PSG }));
  out.push(text(b.x + 150, 26, "YM2149 mode", { size: 12.5, bold: true, fill: MIX }));
  for (let v = 0; v <= 15; v++) out.push(text(b.px(v), b.py(0) + 20, String(v), { anchor: "middle", size: 11 }));
  out.push(text(b.x + b.w / 2, b.py(0) + 40, "fixed volume (R8–R10 bits 3–0)", { anchor: "middle", size: 11.5 }));
  out.push("</svg>");
  figures.volume = out;
  numbers.push(`volume fig: AY vs YM ${ay.map(([v, l]) => `${v}:${l}/${ym[v][1]}`).join(" ")}`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the sixteen envelope shapes, captured
{
  const d = capture("envelopes");
  const shapes = d.shapes.map((v) => v.map((x) => (x * 32768) / d.gain));
  const same = { 0: 9, 1: 9, 2: 9, 3: 9, 4: 15, 5: 15, 6: 15, 7: 15 };
  const out = [svgOpen(700, 470, "Sixteen small captures in a grid of four by four, ten milliseconds each, one per envelope shape 0 to 15, each labelled with its four bits CONT, ATT, ALT, HOLD. Shapes 0 to 3 fall once and stay silent; shapes 4 to 7 climb once and fall silent; these eight are drawn faint, marked as the same as shape 9 and shape 15. Shape 8 falls again and again, a saw tooth. Shape 9 falls once and stays silent. Shape 10 falls and climbs, a triangle. Shape 11 falls once and jumps to full volume. Shape 12 climbs again and again. Shape 13 climbs once and holds at full volume. Shape 14 climbs and falls, a triangle. Shape 15 climbs once and falls silent.")];
  const cw = 170, ch = 110;
  shapes.forEach((v, shape) => {
    const col = shape % 4, row = Math.floor(shape / 4);
    const x = 10 + col * cw, y = 10 + row * ch;
    const dup = same[shape] !== undefined;
    const b = box(x + 4, y + 26, cw - 18, 58, 0, 10, 0, 270);
    out.push(rect(x, y, cw - 10, ch - 10, { rx: 5, opacity: 0.35 }));
    out.push(text(x + 8, y + 17, `${shape}`, { size: 13, bold: true, fill: dup ? GREY : PSG }));
    out.push(text(x + 30, y + 17, shape.toString(2).padStart(4, "0"), { size: 11.5, family: "monospace" }));
    if (dup) out.push(text(x + cw - 16, y + 17, `= ${same[shape]}`, { anchor: "end", size: 11.5 }));
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(pathEl(sampleStairs(b, v.slice(0, 480), 0, DT), { stroke: dup ? GREY : PSG, width: 1.5, opacity: dup ? 0.45 : 1 }));
  });
  out.push(text(10, 458, "bits: CONT ATT ALT HOLD (R13 bits 3–0); 10 ms each, a ramp of 2.9 ms", { size: 11.5 }));
  out.push("</svg>");
  figures.envgrid = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the climb in YM and AY modes
{
  rows("climb", "Two captures of envelope shape 13, climb and hold, with a period of 60 ticks, 12.5 milliseconds each, from 0 to 255 units. YM2149 mode: a fine staircase of 32 steps, each 274 microseconds, reaching 255 after 8.8 milliseconds. AY-3-8910 mode: a coarser staircase of 16 steps, each twice as long, reaching 255 at the same moment.", [
    { t: ["YM2149"], sub: "32 steps", values: units(capture("climb-ym")), c: MIX },
    { t: ["AY-3-8910"], sub: "16 steps", values: units(capture("climb-ay")) }
  ], 12.5, 2.5, 255, 110);
}

// ---------------------------------------------------------------------------------------------
// Figure: a chord, each channel alone and the three added
{
  const d = capture("chord");
  const ch = d.channels.map((v) => v.map((w) => w / d.gain));
  const sum = ch[0].map((_, i) => ch[0][i] + ch[1][i] + ch[2][i]);
  rows("chord", "Four rows over six milliseconds. Channel A plays C, a square wave of 523.3 Hz; channel B plays E, 658.9 Hz; channel C plays G, 781.3 Hz; each from 0 to 255 units. The bottom row adds the three, drawn on a scale of 0 to 765 units: a stepped wave whose pattern of steps changes all the time as the three square waves drift past each other.", [
    { t: ["A: C5"], sub: "period 209", values: ch[0] },
    { t: ["B: E5"], sub: "period 166", values: ch[1] },
    { t: ["C: G5"], sub: "period 140", values: ch[2] },
    { t: ["A + B + C"], sub: "the three added", values: sum, c: MIX, top: 765 }
  ], 6, 1, 255, 56);
  numbers.push(`chord fig: max sum ${Math.max(...sum).toFixed(0)}`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the envelope as a waveform
{
  rows("buzz", "Two captures, five milliseconds each, from 0 to 255 units. Envelope shape 8 with a period of 14 ticks: a falling saw tooth that repeats at 488.3 Hz, each tooth a staircase from 255 down to 0. Envelope shape 10 with a period of 7 ticks: a triangle at the same 488.3 Hz.", [
    { t: ["shape 8", "period 14"], sub: "saw tooth", values: units(capture("buzz-saw")) },
    { t: ["shape 10", "period 7"], sub: "triangle", values: units(capture("buzz-tri")) }
  ], 5, 1, 255, 90);
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
