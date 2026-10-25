#!/usr/bin/env node
/*
 * F1 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md: the T80N single-instruction differential.
 *
 * Writes the case file both sides run: the T80N simulated from the FPGA's VHDL (cpu_tb.vhd) and
 * Klive's ZX Spectrum Next core (f1-klive.f1.ts). The set is fixed by the seed, so the count is
 * exact and known before anything runs (`--count` prints it without writing).
 *
 * One case = a prologue at $8000 that loads every register (I, R, both register sets, IX, IY, IM,
 * IFF, SP, and MEMPTR through LD A,(nn)) from a data block at $8080 and runs on into $8020, the
 * instruction(s) under test at $8020,
 * and random bytes at the addresses the instruction may read. Both sides run exactly these bytes.
 *
 * Line format (decimal, space separated):
 *   id m1 nInstr io nCode code[nCode] nData data[nData] nMem addr val ...
 *   m1     = M1 cycles of the instruction(s) under test (the testbench's end detection)
 *   nInstr = instructions under test (Klive steps this many)
 *   io     = the value every I/O read returns in this case: random for the single-port instructions,
 *            which read port $253B (NextReg $7F on Klive, set to it); IO_FE_VALUE for the block ones
 *   code   = bytes from $8000 (prologue, then the instruction at $8020), always CODE_LEN bytes
 *   data   = bytes from $8080 (the register values the prologue pops), always DATA_LEN bytes
 */
"use strict";
const fs = require("fs");
const path = require("path");

const SEED = 0x20261024;
const RANDOM_PER_OPCODE = 64;
const CODE_BASE = 0x8000;
const INSTR_ADDR = 0x8020;
const CODE_LEN = 0x28; // $8000-$8027: prologue (32 bytes) + up to 8 bytes at $8020
const DATA_BASE = 0x8080;
const DATA_LEN = 24;
// I/O. The block I/O instructions (INI..OTDR) change B, the port's high byte, so they use a port
// $xxFE (the ULA decodes any even port), which reads IO_FE_VALUE on Klive with no key pressed. The
// others read port $253B, which on Klive returns NextReg $7F: each case sets it to a random value.
const IO_PORT_LOW = 0xfe;
const IO_FE_VALUE = 0xbf;
const NR_PORT = 0x253b;

// --- Deterministic PRNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The opcodes under test
const PREFIXES = [0xcb, 0xdd, 0xed, 0xfd];
const HALT = 0x76;
const NEXTREG = [0x91, 0x92]; // ED 91/92 write NextRegs: machine side effects outside the CPU

function opcodeList() {
  const ops = [];
  for (let o = 0; o < 256; o++) if (!PREFIXES.includes(o) && o !== HALT) ops.push({ group: "main", bytes: [o], m1: 1 });
  for (let o = 0; o < 256; o++) ops.push({ group: "CB", bytes: [0xcb, o], m1: 2 });
  for (let o = 0; o < 256; o++) if (!NEXTREG.includes(o)) ops.push({ group: "ED", bytes: [0xed, o], m1: 2 });
  for (const p of [0xdd, 0xfd]) {
    const g = p === 0xdd ? "DD" : "FD";
    for (let o = 0; o < 256; o++) if (!PREFIXES.includes(o) && o !== HALT) ops.push({ group: g, bytes: [p, o], m1: 2 });
  }
  for (const p of [0xdd, 0xfd]) {
    const g = p === 0xdd ? "DDCB" : "FDCB";
    // DD CB d op: d is filled in per case; m1 = 2 (the two prefix fetches; d and op are memory reads)
    for (let o = 0; o < 256; o++) ops.push({ group: g, bytes: [p, 0xcb, null, o], m1: 2 });
  }
  return ops;
}

// I/O instructions: their port must be $xxFE on both sides (reads give a fixed value, writes only
// reach the border/beeper), so their C register or their port operand is forced.
const ED_IO_C = new Set([
  0x40, 0x48, 0x50, 0x58, 0x60, 0x68, 0x70, 0x78, // IN r,(C)
  0x41, 0x49, 0x51, 0x59, 0x61, 0x69, 0x71, 0x79, // OUT (C),r
  0xa2, 0xaa, 0xb2, 0xba, 0xa3, 0xab, 0xb3, 0xbb, // INI IND INIR INDR OUTI OUTD OTIR OTDR
  0x90, // OUTINB
  0x98 // JP (C)
]);
const MAIN_IO_N = new Set([0xd3, 0xdb]); // OUT (n),A / IN A,(n)

const ED_IO_BLOCK = new Set([0xa2, 0xaa, 0xb2, 0xba, 0xa3, 0xab, 0xb3, 0xbb]);

function ioKind(op) {
  const b = op.bytes;
  if (op.group === "ED" && ED_IO_BLOCK.has(b[1])) return "BLOCK";
  if (op.group === "ED" && ED_IO_C.has(b[1])) return "C";
  if (op.group === "main" && MAIN_IO_N.has(b[0])) return "N1";
  if ((op.group === "DD" || op.group === "FD") && MAIN_IO_N.has(b[1])) return "N2";
  return null;
}

// --- One case
function makeCase(r, op, overrides = {}) {
  const b8 = () => Math.floor(r() * 256);
  const b16 = () => Math.floor(r() * 65536);
  const reg = {
    i: b8(), r: b8(),
    af_: b16(), bc_: b16(), de_: b16(), hl_: b16(),
    af: b16(), bc: b16(), de: b16(), hl: b16(),
    ix: b16(), iy: b16(), sp: b16(),
    im: Math.floor(r() * 3), ei: r() < 0.5
  };
  // The instruction bytes: opcode bytes, then 3 random operand bytes (n, nn, d, d+n...)
  const instr = op.bytes.map((x) => (x === null ? b8() : x));
  for (let k = 0; k < 3; k++) instr.push(b8());
  Object.assign(reg, overrides.reg || {});
  reg.wz = b16(); // the address LD A,(nn) reads in the prologue: MEMPTR = nn + 1
  const ioValue = b8();
  const io = ioKind(op);
  if (io === "BLOCK") reg.bc = (reg.bc & 0xff00) | IO_PORT_LOW;
  if (io === "C") reg.bc = NR_PORT;
  if (io === "N1" || io === "N2") {
    instr[io === "N1" ? 1 : 2] = NR_PORT & 0xff; // port = A:n
    reg.af = (NR_PORT & 0xff00) | (reg.af & 0xff);
  }
  const pre = overrides.pre || [];
  const allInstr = [...pre, ...instr];
  return {
    op, reg, instr: allInstr, io: io === "BLOCK" ? IO_FE_VALUE : ioValue,
    m1: op.m1 + (overrides.m1Extra || 0), nInstr: 1 + (overrides.instrExtra || 0)
  };
}

// --- The prologue (identical on both sides)
function prologue(reg) {
  const im = [0x46, 0x56, 0x5e][reg.im];
  const sp = reg.sp;
  const code = [
    0x31, DATA_BASE & 0xff, DATA_BASE >> 8, // LD SP,$8080
    0xf1, 0xed, 0x47, // POP AF / LD I,A
    0xf1, 0xed, 0x4f, // POP AF / LD R,A
    0xf1, 0xc1, 0xd1, 0xe1, // POP AF,BC,DE,HL (alternate set)
    0x08, 0xd9, // EX AF,AF' / EXX
    0x3a, reg.wz & 0xff, reg.wz >> 8, // LD A,(nn): MEMPTR = nn + 1 (A is loaded next)
    0xf1, 0xc1, 0xd1, 0xe1, // POP AF,BC,DE,HL (main set)
    0xdd, 0xe1, 0xfd, 0xe1, // POP IX / POP IY
    0xed, im, // IM n
    reg.ei ? 0xfb : 0xf3, // EI / DI
    0x31, sp & 0xff, sp >> 8 // LD SP,nn, then on into $8020
  ];
  if (code.length !== INSTR_ADDR - CODE_BASE) throw new Error(`prologue is ${code.length} bytes`);
  const w = (v) => [v & 0xff, (v >> 8) & 0xff];
  const data = [
    ...w(reg.i << 8), ...w(reg.r << 8), // POP AF gives F (low) then A (high)
    ...w(reg.af_), ...w(reg.bc_), ...w(reg.de_), ...w(reg.hl_),
    ...w(reg.af), ...w(reg.bc), ...w(reg.de), ...w(reg.hl),
    ...w(reg.ix), ...w(reg.iy)
  ];
  if (data.length !== DATA_LEN) throw new Error(`data block is ${data.length} bytes`);
  return { code, data };
}

// --- Random bytes where the instruction may read: around every register used as a pointer and
// around the operand bytes read as an address. Addresses inside the code and data blocks keep
// their bytes (both sides have the same ones there).
function memory(r, c) {
  const { reg, instr } = c;
  const s8 = (v) => (v > 127 ? v - 256 : v);
  const ptrs = [reg.bc, reg.de, reg.hl, reg.sp, reg.ix, reg.iy, reg.bc_, reg.de_, reg.hl_];
  for (let k = 1; k < instr.length; k++) {
    ptrs.push(instr[k] | ((instr[k + 1] ?? 0) << 8)); // operand bytes as nn
    ptrs.push((reg.ix + s8(instr[k])) & 0xffff, (reg.iy + s8(instr[k])) & 0xffff); // as d
  }
  const addrs = new Set();
  for (const p of ptrs) for (let d = -2; d <= 1; d++) addrs.add((p + d) & 0xffff);
  for (let d = 0; d < 8; d++) addrs.add(((reg.hl & 0xfff8) + d) & 0xffff); // LDPIRX's 8-byte pattern row
  const inBlock = (a) => (a >= CODE_BASE && a < CODE_BASE + CODE_LEN) || (a >= DATA_BASE && a < DATA_BASE + DATA_LEN);
  return [...addrs].filter((a) => !inBlock(a)).sort((x, y) => x - y).map((a) => [a, Math.floor(r() * 256)]);
}

// --- The whole set
function buildCases() {
  const r = rng(SEED);
  const out = [];
  const ops = opcodeList();
  for (const op of ops) for (let n = 0; n < RANDOM_PER_OPCODE; n++) out.push({ set: "random", ...makeCase(r, op) });
  // Targeted 1: DAA for every A and every N/H/C combination (other flag bits random)
  const daa = { group: "main", bytes: [0x27], m1: 1 };
  for (let a = 0; a < 256; a++)
    for (let f = 0; f < 8; f++) {
      const c = makeCase(r, daa);
      const flags = (c.reg.af & 0xec) | (f & 1) | ((f & 2) ? 0x02 : 0) | ((f & 4) ? 0x10 : 0);
      c.reg.af = (a << 8) | flags;
      out.push({ set: "daa", ...c });
    }
  // Targeted 2: block instructions at their counter's edge values
  const blockOps = [0xa0, 0xa8, 0xb0, 0xb8, 0xa1, 0xa9, 0xb1, 0xb9, 0xa2, 0xaa, 0xb2, 0xba, 0xa3, 0xab, 0xb3, 0xbb,
    0xa4, 0xac, 0xb4, 0xbc, 0xb7, 0xa5]; // + LDIX LDDX LDIRX LDDRX LDPIRX LDWS
  for (const o of blockOps) {
    const op = { group: "ED", bytes: [0xed, o], m1: 2 };
    const io = ED_IO_C.has(o);
    for (const v of io ? [0x00, 0x01, 0x02, 0x80, 0xff] : [0x0000, 0x0001, 0x0002, 0x0100, 0xffff]) {
      const c = makeCase(r, op);
      c.reg.bc = io ? (v << 8) | IO_PORT_LOW : v;
      out.push({ set: "block", ...c });
    }
  }
  // Targeted 3: SCF/CCF after no instruction, a non-flag instruction, and a flag-setting one (Q)
  for (const o of [0x37, 0x3f]) {
    const op = { group: "main", bytes: [o], m1: 1 };
    for (const prev of [[], [0x40], [0xc6, null]]) {
      for (let n = 0; n < 16; n++) {
        const pre = prev.map((x) => (x === null ? Math.floor(r() * 256) : x));
        const extra = prev.length ? 1 : 0;
        out.push({ set: "scf-ccf", ...makeCase(r, op, { pre, m1Extra: extra, instrExtra: extra }) });
      }
    }
  }
  // Memory, prologue, ids
  return out.map((c, id) => ({ id, ...c, mem: memory(r, c), ...prologue(c.reg) }));
}

function line(c) {
  const code = [...c.code, ...c.instr];
  while (code.length < CODE_LEN) code.push(0);
  if (code.length > CODE_LEN) throw new Error(`case ${c.id}: code too long`);
  return [c.id, c.m1, c.nInstr, c.io, CODE_LEN, ...code, DATA_LEN, ...c.data, c.mem.length, ...c.mem.flat()].join(" ");
}

function main() {
  const args = process.argv.slice(2);
  const cases = buildCases();
  const groups = {};
  for (const c of cases) {
    const k = c.set === "random" ? `random ${c.op.group}` : c.set;
    groups[k] = (groups[k] || 0) + 1;
  }
  const summary = { seed: SEED, perOpcode: RANDOM_PER_OPCODE, opcodes: opcodeList().length, total: cases.length, groups };
  if (args.includes("--count")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const outDir = args[args.indexOf("--out") + 1];
  const shards = Number(args.includes("--shards") ? args[args.indexOf("--shards") + 1] : 1);
  const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : cases.length;
  fs.mkdirSync(outDir, { recursive: true });
  // --sample: the bring-up sample, the first case of every opcode (1,775 cases)
  const pool = args.includes("--sample") ? cases.filter((c) => c.set === "random" && c.id % RANDOM_PER_OPCODE === 0) : cases;
  const only = args.includes("--ids") ? new Set(args[args.indexOf("--ids") + 1].split(",").map(Number)) : null;
  const chosen = (only ? pool.filter((c) => only.has(c.id)) : pool).slice(0, limit);
  const per = Math.ceil(chosen.length / shards);
  for (let s = 0; s < shards; s++) {
    const part = chosen.slice(s * per, (s + 1) * per);
    fs.writeFileSync(path.join(outDir, `cases-${s}.txt`), part.map(line).join("\n") + "\n");
  }
  // What each case is, for the report: id, set, group, opcode bytes (hex)
  const hex = (b) => b.map((x) => (x === null ? "d" : x.toString(16).padStart(2, "0"))).join(" ");
  fs.writeFileSync(
    path.join(outDir, "cases-meta.tsv"),
    chosen.map((c) => [c.id, c.set, c.op.group, hex(c.op.bytes)].join("\t")).join("\n") + "\n"
  );
  fs.writeFileSync(path.join(outDir, "cases-summary.json"), JSON.stringify({ ...summary, written: chosen.length, shards }, null, 2));
  console.log(JSON.stringify({ ...summary, written: chosen.length, shards }));
}

if (require.main === module) main();
module.exports = { buildCases, CODE_BASE, INSTR_ADDR, CODE_LEN, DATA_BASE, DATA_LEN, IO_PORT_LOW, IO_FE_VALUE, NR_PORT };
