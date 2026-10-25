#!/usr/bin/env node
/*
 * F3 triage probes (.plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md §8): programs that wait an exact number of
 * T-states from the program's first fetch (which both machines start at the same raster position),
 * then read one value with a single IN and store it. A sweep of the wait, one T-state at a time,
 * finds the T-state at which the value changes on each machine; run-f3.cjs replays the sweep on Klive
 * and on the simulated core, and the two thresholds compared are a program-observable timing
 * difference, exact to the T-state.
 *
 *   node test/vhdl/f3/probes.cjs > probes.jsonl
 *   node test/vhdl/f3/run-f3.cjs --programs probes.jsonl ...
 *
 * Each program: DI (already), select the NextReg with OUT ($243B), wait, IN A,(C) on $253B, store A
 * at Result, write the ready marker. The wait is NOPs (4 T) with one 5/6/7 T instruction for the
 * remainder, so every whole number of T-states >= 4 is reachable. Runs from bank 2 ($8000), which
 * no timing contends, and port $253B, which is not contended.
 */
"use strict";

/** A delay of exactly t T-states (t >= 4; 1, 2, 3 are not reachable) */
function delay(t) {
  if (t < 4) throw new Error(`delay ${t} too short`);
  const extra = { 0: [], 1: ["ret nz"], 2: ["inc hl"], 3: ["ld a,0"] }[t % 4]; // 5, 6, 7 T (ret nz: Z set)
  const extraT = { 0: 0, 1: 5, 2: 6, 3: 7 }[t % 4];
  const nops = (t - extraT) / 4;
  if (nops < 0 || !Number.isInteger(nops)) throw new Error(`delay ${t}`);
  return [...extra, ...Array(nops).fill("nop")];
}

/**
 * One probe program. The fixed part before the wait (xor a / ld bc / ld a / out / ld b) is 4 + 10 +
 * 7 + 12 + 7 = 40 T, so the IN instruction starts at T = 40 + wait from the first fetch.
 */
function program(reg, wait) {
  const lines = [
    "        .org $8000",
    "Start:  xor a                 ; 4: Z set, so RET NZ in the delay is not taken",
    "        ld bc,$243b           ; 10",
    `        ld a,$${reg.toString(16)}  ; 7`,
    "        out (c),a             ; 12",
    "        ld b,$25              ; 7: BC = $253B",
    ...delay(wait).map((i) => `        ${i}`),
    "        in a,(c)",
    "        ld (Result),a",
    "        nextreg $7f,$a5",
    "Stop:   jr Stop",
    "Result: .defb 0"
  ];
  return lines.join("\n");
}

/** The sweeps: [name, register, first IN start T, last IN start T] */
const ONLY = process.argv[2];
const SWEEPS = [
  // P1: $1F changes from 99 to 100 during raw line 163 (+3 timing, 456 HC/line; cvc advances at
  // hc = ula_min_hactive, HC ~132 in Klive's coordinates; a first sweep of line 164 read 100 throughout)
  ["P1 line counter $1F", 0x1f, Math.floor((163 * 456 + 100) / 2), Math.floor((163 * 456 + 170) / 2)],
  // P2: the ULA interrupt starts ($22 bit 7), +3: line 1, HC 126 + 8 (Klive)
  ["P2 ULA interrupt start ($22 bit 7)", 0x22, Math.floor((456 + 110) / 2), Math.floor((456 + 160) / 2)],
  // P3: it ends 32 T later
  ["P3 ULA interrupt end ($22 bit 7)", 0x22, Math.floor((456 + 175) / 2), Math.floor((456 + 225) / 2)]
];

const FIXED_T = 40;
const out = [];
for (const [name, reg, from, to] of SWEEPS) {
  if (ONLY && !name.startsWith(ONLY)) continue;
  for (let inT = from; inT <= to; inT++) {
    const wait = inT - FIXED_T;
    out.push({
      testPath: "test/vhdl/f3/probes.cjs",
      testName: `${name}: IN at T ${inT}`,
      source: program(reg, wait),
      entry: "Start"
    });
  }
}
process.stdout.write(out.map((p) => JSON.stringify(p)).join("\n") + "\n");
process.stderr.write(`${out.length} probe programs\n`);
