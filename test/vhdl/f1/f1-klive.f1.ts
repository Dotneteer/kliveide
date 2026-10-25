import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { it, expect } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * F1, the Klive side: runs the cases of generate-cases.cjs on Klive's ZX Spectrum Next core and
 * writes one result line per case in the testbench's format (cpu_tb.vhd), for run-f1.cjs to compare.
 *
 * The machine is set up as the testbench's CPU sees its world: 64K of plain RAM (MMU slots 0-7 =
 * pages $20-$27, all zero), 3.5 MHz, no memory or I/O contention, no ULA interrupt. Each case writes
 * the same bytes as the testbench, runs the prologue to $8020, then steps the instruction(s).
 *
 * Environment: F1_CASES (comma-separated case files), F1_RESULTS (output file), F1_PROGRESS (a file
 * rewritten with the done count), F1_IO_VALUE (what port $xxFE must read: the block I/O cases' value
 * in the case file; the run fails at once if Klive reads something else). Each case's single-port
 * I/O instructions read port $253B, i.e. NextReg $7F, which is set to the case's I/O value.
 */

const CASES = (process.env.F1_CASES ?? "").split(",").filter(Boolean);
const RESULTS = process.env.F1_RESULTS ?? "";
const PROGRESS = process.env.F1_PROGRESS ?? "";
const IO_VALUE = Number(process.env.F1_IO_VALUE ?? "-1");
const PROGRESS_EVERY = 500;
const FIRST_PAGE = 0x20;
const CHUNK = 256;

it("F1: runs the cases on Klive's Next core", async () => {
  expect(CASES.length, "F1_CASES").toBeGreaterThan(0);
  const s = await createSession();
  // --- The CPU's world: flat RAM, base speed, no contention, no ULA interrupt
  for (let slot = 0; slot < 8; slot++) s.setNextReg(0x50 + slot, FIRST_PAGE + slot);
  s.setNextReg(0x07, 0x00);
  s.setNextReg(0x08, s.readNextReg(0x08) | 0x40);
  s.setNextReg(0x22, s.readNextReg(0x22) | 0x04);
  for (let a = 0; a < 0x10000; a += 0x1000) s.poke(a, new Uint8Array(0x1000));
  const view = s.ramPages(FIRST_PAGE, 8); // CPU address A is view[A]
  const mirror = new Uint8Array(0x10000); // what memory must hold before the instruction runs
  s.out(0x00fe, 0);
  const ioFe = s.in(0x00fe);
  expect(ioFe, "port $xxFE read value (the block I/O cases' value)").toBe(IO_VALUE);

  const out: string[] = [];
  let done = 0;
  writeFileSync(RESULTS, "");
  for (const file of CASES) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (const text of lines) {
      if (!text.trim()) continue;
      const v = text.split(" ").map(Number);
      let p = 0;
      const id = v[p++];
      p++; // m1 count: the testbench's business
      const nInstr = v[p++];
      const io = v[p++];
      const nCode = v[p++];
      const code = v.slice(p, p + nCode); p += nCode;
      const nData = v[p++];
      const data = v.slice(p, p + nData); p += nData;
      const nMem = v[p++];
      const memAddr: number[] = [];
      for (let k = 0; k < nMem; k++) {
        const a = v[p++], b = v[p++];
        memAddr.push(a);
        s.poke(a, b); mirror[a] = b;
      }
      s.poke(0x8000, code); mirror.set(code, 0x8000);
      s.poke(0x8080, data); mirror.set(data, 0x8080);
      s.out(0x00fe, 0);
      // --- What port $253B reads in this case (the single-port I/O instructions read it)
      s.setNextReg(0x7f, io);

      // --- Run the prologue, then the instruction(s)
      s.setRegisters({ pc: 0x8000 });
      s.runTo(0x8020, { maxFrames: 2 });
      const t0 = s.tacts;
      s.step(nInstr);
      const t = s.tacts - t0;
      const r = s.registers();

      // --- Memory changes: compare with what was there before
      const changed: number[] = [];
      for (let base = 0; base < 0x10000; base += CHUNK) {
        if (Buffer.compare(view.subarray(base, base + CHUNK), mirror.subarray(base, base + CHUNK)) === 0) continue;
        for (let a = base; a < base + CHUNK; a++) if (view[a] !== mirror[a]) changed.push(a);
      }
      const fields = [
        id, r.pc, (r.a << 8) | r.f, r.bc, r.de, r.hl, r.af_, r.bc_, r.de_, r.hl_, r.ix, r.iy, r.sp, r.i, r.r,
        r.iff1 ? 1 : 0, r.iff2 ? 1 : 0, r.im, t, changed.length
      ];
      for (const a of changed) fields.push(a, view[a]);
      out.push(fields.join(" ") + " io -");

      // --- Back to the baseline (all zero) where this case wrote or changed memory
      for (const a of memAddr) { s.poke(a, 0); mirror[a] = 0; }
      for (const a of changed) { s.poke(a, 0); mirror[a] = 0; }

      done++;
      if (done % PROGRESS_EVERY === 0) {
        appendFileSync(RESULTS, out.join("\n") + "\n");
        out.length = 0;
        if (PROGRESS) writeFileSync(PROGRESS, String(done));
      }
    }
  }
  if (out.length) appendFileSync(RESULTS, out.join("\n") + "\n");
  if (PROGRESS) writeFileSync(PROGRESS, `${done} DONE`);
});
