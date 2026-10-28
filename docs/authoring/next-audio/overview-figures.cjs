#!/usr/bin/env node
// Figures of "ZX Spectrum Next: The Big Picture" of the audio series
// (docs/content/en/under-the-hood/emulator-internals/next-audio/overview.mdx).
//
// The diagrams are drawn from the facts below; the waveforms come from the machine: the captures that
// test/zxnext-hw/audio/next-audio-scene.test.ts writes (after checking them) with
//   NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures npm test -- test/zxnext-hw/audio/next-audio-scene.test.ts
// Then run this script, which rewrites the SVG between the page's {/* fig:<name> */} markers:
//   node docs/authoring/next-audio/overview-figures.cjs
"use strict";

const fs = require("fs");
const path = require("path");
const S = require("./_svg.cjs");
const { BEEPER, PSG, DAC, PI, MIX, box, poly, sampleStairs, svgOpen, text, lines, line, pathEl, rect, arrows } = S;

const PAGE = path.join(__dirname, "../../content/en/under-the-hood/emulator-internals/next-audio/overview.mdx");
const CAPTURES = path.join(__dirname, "captures/overview");
const capture = (name) => JSON.parse(fs.readFileSync(path.join(CAPTURES, `${name}.json`), "utf8"));

// Klive's mixer scales the hardware's sum by a gain to 16-bit words (zxnext-audio-mixer.c,
// ZXNEXT_MIXER_GAIN; each capture records it), so word / gain is back in the hardware's mixer units.
const units = (d) => d.left.map((w) => w / d.gain);

// The hardware's mixer, per side: these inputs, in these units (the audio mixer of the FPGA design).
const LEVELS = { ear: 512, mic: 128, ay: 2295, dac: 2040, pi: 1023 };
const FULL = 8191;

const figures = {};
const numbers = [];

/** First rising crossing of the midpoint after `from` */
function risingEdge(values, from = 0) {
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  for (let i = Math.max(1, from); i < values.length; i++) if (values[i - 1] < mid && values[i] >= mid) return i;
  return from;
}

// ---------------------------------------------------------------------------------------------
// Figure: the 48K's one bit beside the Next's sources
{
  const out = [svgOpen(700, 300, "Two diagrams side by side. Left, the ZX Spectrum 48K: port $FE bits 4 and 3 drive one speaker, and nothing else makes sound. Right, the ZX Spectrum Next: the same port $FE bits, three AY sound chips, four 8-bit DACs and the Raspberry Pi's audio link all feed one mixer, which has a left and a right side.")];
  out.push(arrows("ov-from", ["currentColor", MIX]));
  out.push(text(20, 22, "ZX Spectrum 48K", { size: 14, bold: true }));
  out.push(rect(20, 110, 150, 56, { rx: 6, stroke: BEEPER, width: 2 }));
  out.push(lines(95, 133, ["port $FE", "bits 4 and 3"], { anchor: "middle", size: 12, fill: BEEPER }));
  out.push(line(172, 138, 205, 138, { marker: "ov-from-0", width: 1.5 }));
  out.push(`  <path d="M212,128 L224,128 L240,112 L240,164 L224,148 L212,148 Z" fill="none" stroke="currentColor" strokeWidth="2" />`);
  out.push(text(226, 186, "speaker", { anchor: "middle", size: 12 }));
  out.push(line(285, 20, 285, 280, { opacity: 0.3, dash: "4 4" }));
  out.push(text(310, 22, "ZX Spectrum Next", { size: 14, bold: true }));
  const src = [
    ["beeper: port $FE bits 4, 3", BEEPER, "0"],
    ["AY chip 0", PSG, "0"],
    ["AY chip 1", PSG, "6 3"],
    ["AY chip 2", PSG, "2 3"],
    ["four 8-bit DACs", DAC, "0"],
    ["Raspberry Pi audio", PI, "0"]
  ];
  src.forEach(([label, c, dash], i) => {
    const y = 40 + i * 40;
    out.push(rect(310, y, 200, 30, { rx: 5, stroke: c, width: 2, dash: dash === "0" ? undefined : dash }));
    out.push(text(410, y + 20, label, { anchor: "middle", size: 12, fill: c }));
    out.push(line(512, y + 15, 572, 150, { stroke: c, width: 1.5, opacity: 0.8 }));
  });
  out.push(rect(575, 95, 105, 110, { rx: 8, stroke: MIX, width: 2.5 }));
  out.push(text(627, 128, "mixer", { anchor: "middle", size: 14, bold: true, fill: MIX }));
  out.push(line(585, 150, 670, 150, { stroke: MIX, opacity: 0.5 }));
  out.push(text(627, 144, "left", { anchor: "middle", size: 12, fill: MIX }));
  out.push(text(627, 168, "right", { anchor: "middle", size: 12, fill: MIX }));
  out.push(text(627, 230, "to the outputs", { anchor: "middle", size: 12 }));
  out.push(line(627, 207, 627, 216, { marker: "ov-from-1", stroke: MIX, width: 1.5 }));
  out.push("</svg>");
  figures.from = out;
}

// ---------------------------------------------------------------------------------------------
// Figure (hero): the whole audio system
{
  const H = 470;
  const out = [svgOpen(700, H, "The Next's whole audio system as a flow from left to right. Sources: the beeper, port $FE bit 4 (EAR); the MIC bit, port $FE bit 3, combined with the tape input and the Pi's EAR bit; three AY chips behind ports $FFFD and $BFFD; four 8-bit DACs written through about a dozen ports and NextRegs $2C to $2E; and the Raspberry Pi's audio, received over I2S and controlled by NextReg $A2. Every source feeds both sides of one mixer, a left sum and a right sum. The sums go to four outputs: the audio jack, the internal speaker, HDMI audio and back to the Pi. The MIC line also goes straight to the MIC socket, for saving to tape.")];
  out.push(arrows("ov-hero", ["currentColor", BEEPER, PSG, DAC, PI, MIX]));
  // Column headings
  out.push(text(100, 20, "sources", { anchor: "middle", size: 13, bold: true }));
  out.push(text(430, 20, "mixer", { anchor: "middle", size: 13, bold: true, fill: MIX }));
  out.push(text(600, 20, "outputs", { anchor: "middle", size: 13, bold: true }));
  const rows = [
    { y: 40, h: 48, c: BEEPER, m: 1, title: "beeper (EAR)", sub: ["port $FE bit 4"] },
    { y: 98, h: 64, c: BEEPER, m: 1, title: "MIC and the tape", sub: ["port $FE bit 3, the tape", "input, the Pi's EAR bit"] },
    { y: 172, h: 92, c: PSG, m: 2, title: "three AY chips", sub: ["ports $FFFD, $BFFD", "NextRegs $06, $08, $09"], chips: true },
    { y: 274, h: 64, c: DAC, m: 3, title: "four 8-bit DACs", sub: ["ports $0F … $FB, $DF", "NextRegs $08, $2C–$2E"] },
    { y: 348, h: 64, c: PI, m: 4, title: "Raspberry Pi audio", sub: ["I2S link", "NextReg $A2"] }
  ];
  const mixX = 360, mixY = 60, mixW = 140, mixH = 330;
  for (const row of rows) {
    out.push(rect(10, row.y, 230, row.h, { rx: 6, stroke: row.c, width: 2 }));
    out.push(text(22, row.y + 19, row.title, { size: 13, bold: true, fill: row.c }));
    out.push(lines(22, row.y + 37, row.sub, { size: 11.5 }));
    if (row.chips) {
      ["0", "1", "2"].forEach((n, k) => {
        const dash = ["", "6 3", "2 3"][k];
        out.push(rect(162 + k * 25, row.y + 50, 20, 20, { rx: 3, stroke: PSG, width: 1.8, dash: dash || undefined }));
        out.push(text(172 + k * 25, row.y + 64, n, { anchor: "middle", size: 11, fill: PSG }));
      });
    }
    const yc = row.y + row.h / 2;
    out.push(line(242, yc, mixX - 4, yc, { stroke: row.c, width: 2, marker: `ov-hero-${row.m}` }));
  }
  out.push(rect(mixX, mixY, mixW, mixH, { rx: 10, stroke: MIX, width: 2.5 }));
  out.push(text(mixX + mixW / 2, mixY + 26, "adds every", { anchor: "middle", size: 12, fill: MIX }));
  out.push(text(mixX + mixW / 2, mixY + 42, "source, per side", { anchor: "middle", size: 12, fill: MIX }));
  out.push(rect(mixX + 15, mixY + 70, mixW - 30, 80, { rx: 6, stroke: MIX }));
  out.push(text(mixX + mixW / 2, mixY + 108, "left sum", { anchor: "middle", size: 13, bold: true, fill: MIX }));
  out.push(text(mixX + mixW / 2, mixY + 126, "0–8191", { anchor: "middle", size: 11 }));
  out.push(rect(mixX + 15, mixY + 170, mixW - 30, 80, { rx: 6, stroke: MIX }));
  out.push(text(mixX + mixW / 2, mixY + 208, "right sum", { anchor: "middle", size: 13, bold: true, fill: MIX }));
  out.push(text(mixX + mixW / 2, mixY + 226, "0–8191", { anchor: "middle", size: 11 }));
  const outs = [
    { y: 60, t: "audio jack", s: "left and right" },
    { y: 130, t: "internal speaker", s: "left + right, mono" },
    { y: 200, t: "HDMI audio", s: "48,000 samples a second" },
    { y: 270, t: "to the Pi", s: "over the I2S link" }
  ];
  for (const o of outs) {
    out.push(rect(530, o.y, 160, 50, { rx: 6 }));
    out.push(text(542, o.y + 21, o.t, { size: 13, bold: true }));
    out.push(text(542, o.y + 39, o.s, { size: 11.5 }));
    out.push(line(mixX + mixW + 2, o.y + 25, 526, o.y + 25, { stroke: MIX, width: 1.8, marker: "ov-hero-5" }));
  }
  // MIC straight to the MIC socket
  out.push(rect(530, 400, 160, 50, { rx: 6, stroke: BEEPER }));
  out.push(text(542, 421, "MIC socket", { size: 13, bold: true, fill: BEEPER }));
  out.push(text(542, 439, "saving to tape", { size: 11.5 }));
  out.push(pathEl("M240,140 L270,140 L270,440 L526,440", { stroke: BEEPER, width: 1.8, dash: "6 4", marker: "ov-hero-1" }));
  out.push("</svg>");
  figures.hero = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: a generator and a level writer, captured
{
  const psg = capture("psg"), dac = capture("dac");
  const rate = psg.rate, dt = 1000 / rate; // ms per sample
  const T = 4; // ms shown
  const n = Math.round(T / dt);
  const out = [svgOpen(700, 330, "Two captures from the machine over the same four milliseconds. Top: an AY chip's tone at 1,003 Hz, a square wave that goes on by itself; the CPU wrote four registers to start it, before this stretch, and writes nothing while it plays. Bottom: a sine wave at 1,003 Hz played through a DAC; it is a staircase of 16 steps per cycle, and every step is one write by the CPU, marked under the wave: about 64 writes in the four milliseconds.")];
  const rows = [
    { name: "an AY tone", data: psg, c: PSG, y: 30 },
    { name: "a DAC sine", data: dac, c: DAC, y: 175 }
  ];
  for (const row of rows) {
    const v = units(row.data);
    const start = risingEdge(v, 50);
    const w = v.slice(start, start + n);
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const b = box(90, row.y, 600, 90, 0, T, -560, 560);
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(pathEl(sampleStairs(b, w.map((x) => x - mean), 0, dt), { stroke: row.c, width: 2 }));
    out.push(text(10, row.y + 40, row.name, { size: 13, bold: true, fill: row.c }));
    // CPU writes
    const markY = row.y + 112;
    out.push(text(10, markY + 4, "CPU writes", { size: 11.5 }));
    out.push(line(b.x, markY, b.x + b.w, markY, { opacity: 0.25 }));
    if (row.data === psg) {
      out.push(text(b.x + 8, markY + 4, "none: four registers were written before this stretch, and the chip plays on by itself", { size: 11.5, fill: PSG }));
    } else {
      let count = 0;
      for (let i = 1; i < w.length; i++) {
        if (w[i] !== w[i - 1]) {
          out.push(line(b.px(i * dt), markY - 7, b.px(i * dt), markY + 7, { stroke: DAC, width: 1.5 }));
          count++;
        }
      }
      numbers.push(`generator fig: ${count} DAC writes seen in ${T} ms (expected ${((T / 1000) * dac.cpuHz / dac.writePeriodTacts).toFixed(1)})`);
    }
  }
  const b = box(90, 0, 600, 0, 0, T, 0, 1);
  const ay = 318;
  out.push(line(b.x, ay - 10, b.x + b.w, ay - 10, { opacity: 0.5 }));
  for (let ms = 0; ms <= T; ms++) {
    out.push(line(b.px(ms), ay - 14, b.px(ms), ay - 6, { opacity: 0.5 }));
    out.push(text(b.px(ms), ay + 8, `${ms} ms`, { anchor: ms === 0 ? "start" : ms === T ? "end" : "middle", size: 11.5 }));
  }
  out.push("</svg>");
  figures.generator = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: one capture of each source, on one level scale
{
  const T = 5; // ms
  const list = [
    { name: "beeper", title: "the beeper (EAR)", c: BEEPER, note: "994 Hz square wave, 512 units" },
    { name: "psg", title: "one AY channel", c: PSG, note: "1,003 Hz square wave, 255 units" },
    { name: "dac", title: "one DAC port (Specdrum)", c: DAC, note: "1,003 Hz sine in 16 steps, 1,016 units" },
    { name: "pi", title: "Raspberry Pi audio", c: PI, note: "1,000 Hz sine, 1,000 units" }
  ];
  const out = [svgOpen(700, 400, "Four captures from the machine, five milliseconds each, all drawn on the same level scale in the mixer's units. The beeper: a square wave of 994 Hz whose step is 512 units. One AY channel: a square wave of 1,003 Hz, 255 units. A DAC fed a sine through the Specdrum port: a staircase of 16 steps per cycle at 1,003 Hz, 1,016 units from bottom to top. The Raspberry Pi's audio: a smooth 1,000 Hz sine of 1,000 units.")];
  list.forEach((s, i) => {
    const d = capture(s.name);
    const dt = 1000 / d.rate;
    const v = units(d);
    const start = risingEdge(v, 50);
    const w = v.slice(start, start + Math.round(T / dt));
    const mean = (Math.max(...w) + Math.min(...w)) / 2;
    const col = i % 2, rowI = Math.floor(i / 2);
    const x = 50 + col * 340, y = 24 + rowI * 180;
    const b = box(x, y + 12, 300, 110, 0, T, -560, 560);
    out.push(text(x, y, s.title, { size: 13, bold: true, fill: s.c }));
    out.push(line(b.x, b.py(0), b.x + b.w, b.py(0), { opacity: 0.25 }));
    out.push(line(b.x, b.y, b.x, b.y + b.h, { opacity: 0.4 }));
    for (const lv of [-500, 500]) {
      out.push(line(b.x - 4, b.py(lv), b.x, b.py(lv), { opacity: 0.4 }));
      out.push(text(b.x - 6, b.py(lv) + 4, lv > 0 ? "+500" : "−500", { anchor: "end", size: 10 }));
    }
    out.push(pathEl(sampleStairs(b, w.map((q) => q - mean), 0, dt), { stroke: s.c, width: 2 }));
    out.push(text(x, y + 144, s.note, { size: 11.5 }));
    const sw = Math.max(...w) - Math.min(...w);
    numbers.push(`cast fig: ${s.name} swing ${sw.toFixed(0)} units (${d.hz} Hz)`);
  });
  out.push(text(50, 392, "5 ms each; the level scale is the same in all four, in the mixer's units", { size: 11.5 }));
  out.push("</svg>");
  figures.cast = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the mixer's range, each source's largest share drawn to scale
{
  const out = [svgOpen(700, 250, "Two bars drawn to scale on the mixer's range of 0 to 8,191 per side. The first bar stacks every source's largest contribution: the beeper's EAR 512, MIC 128, the three AY chips 2,295, the four DACs' side 2,040 and the Pi 1,023, together 5,998, leaving 2,193 unused at the top. The second bar shows silence: with every source quiet, the DACs still add 1,024 at their rest level and the Pi 512, so silence is 1,536, not zero.")];
  const X0 = 20, W = 660;
  const px = (v) => X0 + (v / FULL) * W;
  const parts = [
    ["EAR", LEVELS.ear, BEEPER],
    ["MIC", LEVELS.mic, BEEPER],
    ["three AY chips", LEVELS.ay, PSG],
    ["DACs", LEVELS.dac, DAC],
    ["Pi", LEVELS.pi, PI]
  ];
  const drawBar = (y, segs, title) => {
    out.push(text(X0, y - 10, title, { size: 13, bold: true }));
    let at = 0;
    for (const [label, v, c] of segs) {
      out.push(rect(px(at), y, px(at + v) - px(at), 34, { fill: c, fillOpacity: label === "MIC" ? 0.45 : 0.8, stroke: c, width: 1 }));
      const mid = (px(at) + px(at + v)) / 2;
      if (px(at + v) - px(at) > 40) out.push(text(mid, y + 22, label, { anchor: "middle", size: 12, fill: "#ffffff", bold: true }));
      at += v;
    }
    out.push(rect(X0, y, W, 34, { opacity: 0.6 }));
    return at;
  };
  const total = drawBar(40, parts, "every source at its largest");
  out.push(line(px(total), 34, px(total), 82, { stroke: MIX, width: 2.5 }));
  out.push(text(px(total), 98, `${total.toLocaleString("en-US")}`, { anchor: "middle", size: 12, fill: MIX, bold: true }));
  out.push(text((px(total) + px(FULL)) / 2, 62, `unused: ${(FULL - total).toLocaleString("en-US")}`, { anchor: "middle", size: 12 }));
  out.push(text(px(LEVELS.ear + LEVELS.mic / 2), 98, "MIC", { anchor: "middle", size: 11, fill: BEEPER }));
  numbers.push(`budget fig: sum ${total}, unused ${FULL - total}`);
  const silence = drawBar(150, [["DACs at rest", 1024, DAC], ["Pi", 512, PI]], "silence");
  out.push(line(px(silence), 144, px(silence), 192, { stroke: MIX, width: 2.5 }));
  out.push(text(px(silence), 208, silence.toLocaleString("en-US"), { anchor: "middle", size: 12, fill: MIX, bold: true }));
  for (const v of [0, 2048, 4096, 6144, 8191]) {
    out.push(line(px(v), 222, px(v), 230, { opacity: 0.5 }));
    out.push(text(px(v), 244, v.toLocaleString("en-US"), { anchor: v === 0 ? "start" : v === 8191 ? "end" : "middle", size: 11 }));
  }
  out.push(line(X0, 226, X0 + W, 226, { opacity: 0.5 }));
  numbers.push(`budget fig: silence ${silence}`);
  out.push("</svg>");
  figures.budget = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: the clocks
{
  const out = [svgOpen(700, 300, "The clocks behind the sound. The 28 MHz master clock feeds two separate branches. One divides it by 16 into the 1.75 MHz clock of the AY chips; inside each chip it is divided by 8 again, so the chip's counters step 218,750 times a second, and a tone's pitch is that rate divided by twice its period. The other branch is the CPU clock of 3.5, 7, 14 or 28 MHz, which times the program's loops, and with them the beeper's and the DACs' sound. Separately, HDMI audio is sent as 48,000 samples a second.")];
  out.push(arrows("ov-clk", ["currentColor", PSG]));
  const node = (x, y, w, t, s, c = "currentColor") => {
    out.push(rect(x, y, w, 52, { rx: 6, stroke: c, width: 1.8 }));
    out.push(text(x + w / 2, y + 22, t, { anchor: "middle", size: 13, bold: true, fill: c }));
    if (s) out.push(text(x + w / 2, y + 40, s, { anchor: "middle", size: 11.5 }));
  };
  node(10, 110, 120, "28 MHz", "master clock");
  // PSG branch
  node(185, 30, 130, "1.75 MHz", "AY chips' clock", PSG);
  node(370, 30, 140, "218,750 Hz", "the chip's counters", PSG);
  node(565, 30, 125, "a tone", "218,750 ÷ (2 × period)", PSG);
  out.push(pathEl("M130,136 L155,136 L155,56 L181,56", { marker: "ov-clk-1", stroke: PSG, width: 1.8 }));
  out.push(text(158, 48, "÷ 16", { size: 12, fill: PSG }));
  out.push(line(317, 56, 366, 56, { marker: "ov-clk-1", stroke: PSG, width: 1.8 }));
  out.push(text(341, 48, "÷ 8", { anchor: "middle", size: 12, fill: PSG }));
  out.push(line(512, 56, 561, 56, { marker: "ov-clk-1", stroke: PSG, width: 1.8 }));
  // CPU branch
  node(185, 170, 130, "3.5 / 7 / 14 / 28", "MHz: the CPU");
  node(370, 170, 320, "the program's loops", "time the beeper's edges and the DACs' samples");
  out.push(pathEl("M130,136 L155,136 L155,196 L181,196", { marker: "ov-clk-0", width: 1.8 }));
  out.push(line(317, 196, 366, 196, { marker: "ov-clk-0", width: 1.8 }));
  // HDMI, separate
  out.push(rect(370, 245, 320, 46, { rx: 6, dash: "5 4" }));
  out.push(text(530, 265, "HDMI audio: 48,000 samples a second", { anchor: "middle", size: 12.5, bold: true }));
  out.push(text(530, 282, "how the finished sum is sent, not how it is made", { anchor: "middle", size: 11.5 }));
  out.push("</svg>");
  figures.clocks = out;
  numbers.push(`clocks: 28e6/16 = ${28e6 / 16}; /8 = ${28e6 / 128}; A4 440 Hz period ${(28e6 / 128 / 2 / 440).toFixed(1)}`);
}

// ---------------------------------------------------------------------------------------------
// Figure: the control registers, bit by bit
{
  const regs = [
    { name: "NextReg $06", bits: [["hotkeys"], [BEEPER, "beep only", "speaker"], ["hotkey"], ["NMI"], ["NMI"], ["PS/2"], [PSG, "chip", "mode", 2]] },
    { name: "NextReg $08", bits: [["7FFD"], ["contend"], [PSG, "ACB"], [MIX, "speaker", "on"], [DAC, "DACs", "on"], ["port FF"], [PSG, "Turbo-", "Sound"], [BEEPER, "issue 2"]] },
    { name: "NextReg $09", bits: [[PSG, "AY 2 mono"], [PSG, "AY 1 mono"], [PSG, "AY 0 mono"], ["sprites"], ["divmmc"], [MIX, "HDMI", "silent"], ["scanlines", "", "", 2]] },
    { name: "NextReg $84", bits: [[DAC, "$DF"], [DAC, "$B3"], [DAC, "$FB"], [DAC, "Covox"], [DAC, "Profi"], [DAC, "SD 2"], [DAC, "SD 1"], [PSG, "AY", "ports"]] },
    { name: "NextReg $A2", bits: [[PI, "Pi on", "", 2], ["(0)"], [PI, "pins"], [PI, "mute L"], [PI, "mute R"], ["(1)"], [BEEPER, "Pi to", "EAR"]] }
  ];
  const CW = 66, X0 = 130, RH = 40;
  const out = [svgOpen(700, 60 + regs.length * 58, "Five registers as strips of eight bits, bit 7 on the left, each audio bit coloured by the source it controls and the others grey. NextReg $06: bit 6 sends the beeper only to the internal speaker; bits 1 and 0 are the AY chips' mode. NextReg $08: bit 5 ABC or ACB stereo, bit 4 the internal speaker, bit 3 the DACs, bit 1 TurboSound, bit 0 the issue 2 keyboard. NextReg $09: bits 7 to 5 put each AY chip in mono, bit 2 silences HDMI audio. NextReg $84: bit 0 the AY ports, bits 1 to 7 the seven families of DAC ports. NextReg $A2: bits 7 and 6 switch the Pi's audio on, bit 4 sets the direction of its data pins, bits 3 and 2 mute each side, bit 0 sends it to the tape input.")];
  for (let b = 7; b >= 0; b--) out.push(text(X0 + (7 - b) * CW + CW / 2, 22, String(b), { anchor: "middle", size: 11 }));
  regs.forEach((reg, ri) => {
    const y = 34 + ri * 58;
    out.push(text(10, y + 25, reg.name, { size: 13, bold: true }));
    let at = 0;
    for (const cell of reg.bits) {
      const coloured = cell[0].startsWith("#");
      const c = coloured ? cell[0] : "currentColor";
      const labelsAll = coloured ? cell.slice(1) : cell;
      const span = typeof labelsAll[labelsAll.length - 1] === "number" ? labelsAll[labelsAll.length - 1] : 1;
      const labels = labelsAll.filter((l) => typeof l === "string" && l);
      const x = X0 + at * CW;
      out.push(rect(x + 1, y, span * CW - 2, RH, { rx: 3, stroke: c, width: coloured ? 2 : 1, opacity: coloured ? 1 : 0.35, fill: coloured ? c : "none", fillOpacity: coloured ? 0.12 : undefined }));
      labels.forEach((l, k) =>
        out.push(text(x + (span * CW) / 2, y + (labels.length === 1 ? 25 : 17 + k * 14), l, { anchor: "middle", size: 11, fill: coloured ? c : "currentColor" }))
      );
      at += span;
    }
  });
  out.push("</svg>");
  figures.registers = out;
}

// ---------------------------------------------------------------------------------------------
// Figure: from the sum to the outputs
{
  const out = [svgOpen(700, 300, "The mixed sum, a 13-bit number per side, goes four ways. To the audio jack: a one-bit converter per side, running at 28 MHz, followed by a resistor and capacitor filter on the board. To the internal speaker: the left and right sums added into one, through one more one-bit converter; NextReg $08 bit 4 switches the speaker on, and with NextReg $06 bit 6 it plays only the beeper. To HDMI: 48,000 samples a second, each a 16-bit word, silenced by NextReg $09 bit 2. And to the Raspberry Pi over the I2S link.")];
  out.push(arrows("ov-out", [MIX, "currentColor"]));
  out.push(rect(10, 95, 140, 110, { rx: 8, stroke: MIX, width: 2.5 }));
  out.push(lines(80, 135, ["the sum", "13 bits per side", "left and right"], { anchor: "middle", size: 12.5, fill: MIX }));
  const ways = [
    { y: 10, t: "audio jack", s: ["one-bit converter per side at 28 MHz,", "then a resistor-capacitor filter"] },
    { y: 82, t: "internal speaker", s: ["left + right, one one-bit converter;", "on: NextReg $08 bit 4; beeper only: $06 bit 6"] },
    { y: 154, t: "HDMI audio", s: ["48,000 samples a second, 16-bit words;", "silenced by NextReg $09 bit 2"] },
    { y: 226, t: "to the Raspberry Pi", s: ["over the I2S link (article 6)"] }
  ];
  for (const w of ways) {
    out.push(rect(330, w.y, 360, 62, { rx: 6 }));
    out.push(text(344, w.y + 21, w.t, { size: 13, bold: true }));
    out.push(lines(344, w.y + 38, w.s, { size: 11.5 }));
    out.push(pathEl(`M152,150 C240,150 240,${w.y + 31} 326,${w.y + 31}`, { stroke: MIX, width: 1.8, marker: "ov-out-0" }));
  }
  out.push("</svg>");
  figures.outputs = out;
}

S.writeFigures(PAGE, figures);
console.log(numbers.join("\n"));
