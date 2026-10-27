import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The shared Z80 core's M1 timing hook, H1 `Z80_DELAY_OPCODE_FETCH(address)`
 * (`.plans/VIDEOTON_TVC_PLAN.md` §5). When a core defines it, it replaces the memory-read delay of
 * every M1 cycle:
 *
 * - the unprefixed opcode fetch;
 * - the fetch of the byte after a CB/ED/DD/FD prefix, and of each repeated DD/FD;
 * - every halted cycle.
 *
 * It does not replace the delay of operand bytes or of the DDCB/FDCB displacement and opcode, which
 * are plain reads.
 *
 * No production core defines it yet, so this file builds its own test-only translation unit
 * (`z80-opcode-fetch-test.c`). Undefined, the hook compiles to exactly the old call, so the other
 * cores' own suites cover that they are unchanged.
 */

type Exports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };
let x: Exports;

function build(): Uint8Array {
  const root = resolve(__dirname, "../../..");
  const out = join(mkdtempSync(join(tmpdir(), "z80-opcode-fetch-")), "z80-opcode-fetch.wasm");
  const result = spawnSync(
    process.env.Z80_WASM_CC || "clang",
    [
      "--target=wasm32",
      "-std=c11",
      "-O2",
      "-ffreestanding",
      "-fno-builtin",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-all",
      "-Wl,--export-memory",
      "-Wl,--initial-memory=1048576",
      "-Wl,--max-memory=1048576",
      resolve(__dirname, "z80-opcode-fetch-test.c"),
      "-o",
      out
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`hook TU build failed:\n${result.stderr}`);
  return readFileSync(out);
}

function reset(code: number[], at = 0, extra = 0): void {
  x.z80Reset();
  const mem = new Uint8Array(x.memory.buffer, x.z80MemoryPtr(), 0x10000);
  mem.fill(0);
  code.forEach((b, i) => (mem[(at + i) & 0xffff] = b));
  x.z80SetPc(at);
  x.z80SetSp(0x8000);
  x.fetchClear();
  x.fetchSetExtraTacts(extra);
}

/** Runs one whole instruction (prefix bytes included). */
function step(): void {
  do {
    x.z80ExecuteCpuCycle();
  } while (x.z80GetPrefix() !== 0);
}

function fetchAddresses(): number[] {
  const result: number[] = [];
  for (let i = 0; i < x.fetchHookCount(); i++) result.push(x.fetchHookAddress(i));
  return result;
}

beforeAll(async () => {
  const { instance } = (await WebAssembly.instantiate(build())) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
  x = instance.exports as unknown as Exports;
});

// --- name, code, the M1 fetch addresses, the instruction's documented T-states
const cases: [string, number[], number[], number][] = [
  ["NOP", [0x00], [0x0000], 4],
  ["LD A,(nn): operands are plain reads", [0x3a, 0x34, 0x12], [0x0000], 13],
  ["RLC B (CB 00)", [0xcb, 0x00], [0x0000, 0x0001], 8],
  ["NEG (ED 44)", [0xed, 0x44], [0x0000, 0x0001], 8],
  ["LD IX,nn (DD 21 nn nn)", [0xdd, 0x21, 0x00, 0x00], [0x0000, 0x0001], 14],
  ["DD DD NOP: a repeated prefix is an M1", [0xdd, 0xdd, 0x00], [0x0000, 0x0001, 0x0002], 12],
  ["RLC (IX+d) (DD CB d 06): displacement and opcode are not M1s", [0xdd, 0xcb, 0x05, 0x06], [0x0000, 0x0001], 23],
  ["RLC (IY+d) (FD CB d 06)", [0xfd, 0xcb, 0x05, 0x06], [0x0000, 0x0001], 23]
];

describe("H1: Z80_DELAY_OPCODE_FETCH", () => {
  for (const [name, code, m1s, tacts] of cases) {
    it(`${name}: called once per M1, and the instruction keeps its length`, () => {
      reset(code, 0x4000);
      step();
      expect(fetchAddresses()).toEqual(m1s.map((a) => a + 0x4000));
      expect(x.z80GetTacts()).toBe(tacts);
    });

    it(`${name}: a slower M1 lengthens it by exactly the extra tacts per M1`, () => {
      reset(code, 0x4000, 2);
      step();
      expect(x.z80GetTacts()).toBe(tacts + 2 * m1s.length);
    });
  }

  it("runs at the start of each M1: the second M1 of CB 00 starts at T4", () => {
    reset([0xcb, 0x00]);
    step();
    expect(x.fetchHookTacts(0)).toBe(0);
    expect(x.fetchHookTacts(1)).toBe(4);
  });

  it("a halted cycle is an M1, fetching the byte after the HALT", () => {
    reset([0x76], 0x1000);
    step();
    x.fetchClear();
    x.z80ExecuteCpuCycle();
    x.z80ExecuteCpuCycle();
    expect(x.z80GetHalted()).toBe(1);
    expect(fetchAddresses()).toEqual([0x1001, 0x1001]);
    expect(x.z80GetTacts()).toBe(4 + 2 * 4);
  });
});
