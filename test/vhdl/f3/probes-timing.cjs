#!/usr/bin/env node
/*
 * F3 triage, second round (.plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md §8, "F3 triage"): probes for the
 * open timing candidates. Each program starts at the aligned first fetch, does one precise operation
 * and writes the ready marker at once, so the F3 stop time (frame, line, HC) *is* the measurement;
 * a sweep of one parameter separates a fixed offset from a per-cycle one. The CTC probe instead
 * reads the counter with one IN (as probes.cjs does).
 *
 *   node test/vhdl/f3/probes-timing.cjs [group] > probes.jsonl      (groups: C S D N T)
 *
 * C  +3 contention: LD A,(HL) / LD (HL),A on bank 7 (contended in +3 timing at 3.5 MHz) started at
 *    16 consecutive T-states inside the paper area, and on bank 2 (never contended) as the control.
 * S  CPU speed switches: NEXTREG $07 up (3.5 -> 28 MHz) and down (28 -> 3.5 MHz) at 8 phases, then
 *    a fixed run of NOPs; and 400 NOPs at 28 MHz from SRAM (bank 2) and from block RAM (bank 5).
 * D  DMA: the DMA-017 continuous copy with lengths 1, 2, 3, 4, 8, 16, 256, at two start phases.
 * N  NEXTREG writes: 1 to 64 `NEXTREG $41,A` at each CPU speed.
 * T  CTC: channel 0 as a timer (prescaler 16, time constant 10), its counter read by one IN at 24
 *    consecutive T-states.
 */
"use strict";

/** A delay of exactly t T-states at the current speed (0, or t >= 4) */
function delay(t) {
  if (t === 0) return [];
  if (t < 4) throw new Error(`delay ${t} too short`);
  const extra = { 0: [], 1: ["ret nz"], 2: ["inc hl"], 3: ["ld a,0"] }[t % 4]; // 5, 6, 7 T (Z is set)
  const extraT = { 0: 0, 1: 5, 2: 6, 3: 7 }[t % 4];
  return [...extra, ...Array((t - extraT) / 4).fill("nop")];
}

const programs = [];
const add = (group, name, lines, extraSegments = "") =>
  programs.push({
    testPath: "test/vhdl/f3/probes-timing.cjs",
    testName: `${group} ${name}`,
    source: ["        .org $8000", "Start:  xor a", ...lines.map((l) => `        ${l}`), "        nextreg $7f,$a5", "Stop:   jr Stop", extraSegments].join("\n"),
    entry: "Start"
  });

// ---- C: +3 contention. Line 100, HC ~200 (Klive) is inside the 256x192 paper (lines 64-255,
// ---- HC 144-399): about T 22,900 from the first fetch. Setup: page 14 (bank 7) at $C000, HL there.
const C_SETUP = ["nextreg $56,$0e", "ld hl,$c000", "ld bc,$1234"]; // 4 + 20 + 10 + 10 T with xor a
const C_SETUP_T = 4 + 20 + 10 + 10;
for (const [op, code] of [["read", "ld a,(hl)"], ["write", "ld (hl),a"]]) {
  for (let k = 0; k < 16; k++) {
    const d = 22900 + k - C_SETUP_T;
    add("C", `contended ${op} at T ${22900 + k}`, [...C_SETUP, ...delay(d), code]);
  }
}
for (let k = 0; k < 8; k++) {
  const d = 22900 + k - C_SETUP_T;
  add("C", `uncontended read (bank 2) at T ${22900 + k}`, ["nextreg $56,$0e", "ld hl,$8000", "ld bc,$1234", ...delay(d), "ld a,(hl)"]);
}

// ---- S: speed switches
for (let k = 0; k < 8; k++) add("S", `switch up at phase ${k}`, [...delay(1000 + k), "nextreg $07,$03", ...Array(40).fill("nop")]);
for (let k = 0; k < 8; k++) add("S", `switch down at phase ${k}`, ["nextreg $07,$03", ...delay(1000 + k), "nextreg $07,$00", ...Array(10).fill("nop")]);
add("S", "400 NOPs at 28 MHz from SRAM (bank 2)", ["nextreg $07,$03", ...Array(400).fill("nop")]);
add("S", "400 NOPs at 28 MHz from block RAM (bank 5)", ["nextreg $07,$03", "call Bram"],
  ["        .org $6000", "Bram:", ...Array(400).fill("        nop"), "        ret"].join("\n"));

// ---- D: DMA-017's continuous memory-to-memory copy, other lengths
for (const len of [1, 2, 3, 4, 8, 16, 256]) {
  for (const phase of [0, 1]) {
    const setup = [0x83, 0x7d, 0x00, 0xc0, len & 0xff, len >> 8, 0x14, 0x10, 0xad, 0x00, 0xd0, 0x82, 0xcf];
    add("D", `continuous copy of ${len} bytes, phase ${phase}`, [
      "nextreg $07,0", "ld hl,Setup", `ld b,${setup.length}`, "ld c,$6b", "otir", ...delay(phase ? 5 : 0),
      "ld a,$87", "ld bc,$006b", "out (c),a", "nop"
    ], `Setup: .defb ${setup.map((b) => "$" + b.toString(16)).join(",")}`);
  }
}

// ---- N: NEXTREG write timing at each speed
for (const speed of [0, 1, 2, 3]) {
  for (const n of [1, 2, 4, 8, 16, 32, 64]) {
    add("N", `${n} x NEXTREG $41,A at speed ${speed}`, [`nextreg $07,${speed}`, "ld a,$81", ...Array(n).fill("nextreg $41,a")]);
  }
}

// ---- T: the CTC counter (channel 0, port $183B): timer, prescaler 16, time constant 10, read by IN
for (let k = 0; k < 24; k++) {
  add("T", `CTC counter read at +${k} T`, [
    "nextreg $07,0", "ld bc,$183b", "ld a,$05", "out (c),a", "ld a,10", "out (c),a", ...delay(100 + k), "in a,(c)", "ld (Result),a"
  ], "Result: .defb 0");
}

const only = process.argv[2];
const chosen = only ? programs.filter((p) => p.testName.startsWith(only + " ")) : programs;
process.stdout.write(chosen.map((p) => JSON.stringify(p)).join("\n") + "\n");
process.stderr.write(`${chosen.length} probe programs\n`);
