import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The shared Z80 core's hooks for the Sinclair ZX80/ZX81 ULA (`.plans/ZX8081_WASM_PLAN.md` §5):
 *
 * - C1 `Z80_REFRESH(address)`: every refresh, with I:R before the increment, immediately before the
 *   refresh tact on the fetch paths;
 * - C2 the `Z80_AFTER_OPCODE_FETCH` contract: the hook may replace `cpu.opCode`;
 * - C3 `Z80_NMI_ACK_WAIT()`: two tacts into the NMI acknowledge; `Z80_INT_ACK()`: after the INT
 *   acknowledge's six tacts.
 *
 * No production core defines them, so this file builds its own test-only translation unit
 * (`z80-hooks-test.c`). That the hooks leave the other cores tact-identical is covered by their own
 * suites and the Z80 corpus.
 */

type Exports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };
let x: Exports;
let mem: Uint8Array;

function build(): Uint8Array {
  const root = resolve(__dirname, "../../..");
  const out = join(mkdtempSync(join(tmpdir(), "z80-hooks-")), "z80-hooks.wasm");
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
      resolve(__dirname, "z80-hooks-test.c"),
      "-o",
      out
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`hook TU build failed:\n${result.stderr}`);
  return readFileSync(out);
}

function reset(code: number[], at = 0): void {
  x.z80Reset();
  mem = new Uint8Array(x.memory.buffer, x.z80MemoryPtr(), 0x10000);
  mem.fill(0);
  code.forEach((b, i) => (mem[(at + i) & 0xffff] = b));
  x.z80SetPc(at);
  x.z80SetSp(0x8000);
  x.hooksClear();
  x.hooksSetForceNopAbove(0);
  x.hooksSetNmiWaitTacts(0);
}

/** Runs one whole instruction (prefix bytes included). */
function step(): void {
  do {
    x.z80ExecuteCpuCycle();
  } while (x.z80GetPrefix() !== 0);
}

beforeAll(async () => {
  const { instance } = (await WebAssembly.instantiate(build())) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
  x = instance.exports as unknown as Exports;
});

describe("C1: Z80_REFRESH", () => {
  it("an unprefixed M1 passes I:R before the increment, one tact before the refresh ends", () => {
    reset([0x00]);
    x.z80SetIr(0x3a7f);
    step();
    expect(x.hooksRefreshCount()).toBe(1);
    expect(x.hooksRefreshAddress(0)).toBe(0x3a7f);
    expect(x.hooksRefreshTacts(0)).toBe(3);
    expect(x.z80GetTacts()).toBe(4);
    expect(x.z80GetIr()).toBe(0x3a00);
  });

  it("each M1 of a prefixed instruction refreshes: CB, ED, DD and FD", () => {
    for (const code of [[0xcb, 0x00], [0xed, 0x44], [0xdd, 0x21, 0, 0], [0xfd, 0x21, 0, 0]]) {
      reset(code);
      x.z80SetIr(0x2010);
      step();
      expect(x.hooksRefreshCount()).toBe(2);
      expect(x.hooksRefreshAddress(0)).toBe(0x2010);
      expect(x.hooksRefreshAddress(1)).toBe(0x2011);
      // --- the second M1's hook runs after its 3-T read
      expect(x.hooksRefreshTacts(1)).toBe(7);
      expect(x.z80GetIr()).toBe(0x2012);
    }
  });

  it("DDCB/FDCB refresh twice: their displacement and opcode are not M1s", () => {
    reset([0xdd, 0xcb, 0x00, 0x06]);
    step();
    expect(x.hooksRefreshCount()).toBe(2);
    expect(x.z80GetTacts()).toBe(23);
  });

  it("a HALTed cycle refreshes", () => {
    reset([0x76]);
    x.z80SetIr(0x1005);
    step();
    x.hooksClear();
    x.z80ExecuteCpuCycle();
    x.z80ExecuteCpuCycle();
    expect(x.z80GetHalted()).toBe(1);
    expect(x.hooksRefreshCount()).toBe(2);
    expect(x.hooksRefreshAddress(0)).toBe(0x1006);
    expect(x.hooksRefreshTacts(0)).toBe(4 + 3);
    expect(x.hooksRefreshAddress(1)).toBe(0x1007);
    expect(x.hooksRefreshTacts(1)).toBe(8 + 3);
  });

  it("the INT and NMI acknowledges refresh", () => {
    reset([0x00]);
    x.z80SetIr(0x4040);
    x.z80SetIff1(1);
    x.z80SetInterruptMode(1);
    x.z80SetSigInt(1);
    x.z80ExecuteCpuCycle();
    expect(x.z80GetPc()).toBe(0x0038);
    expect(x.hooksRefreshCount()).toBe(1);
    expect(x.hooksRefreshAddress(0)).toBe(0x4040);

    reset([0x00]);
    x.z80SetIr(0x4041);
    x.z80SetSigNmi(1);
    x.z80ExecuteCpuCycle();
    expect(x.z80GetPc()).toBe(0x0066);
    expect(x.hooksRefreshCount()).toBe(1);
    expect(x.hooksRefreshAddress(0)).toBe(0x4041);
  });
});

describe("C2: the opcode-substitution contract of Z80_AFTER_OPCODE_FETCH", () => {
  it("a NOP forced at $C000 replaces LD B,$01: B is unchanged, PC moves by 1, 4 T pass", () => {
    reset([0x06, 0x01], 0xc000);
    x.z80SetBc(0x5500);
    x.hooksSetForceNopAbove(0xc000);
    step();
    expect(x.hooksLastForcedOpcode()).toBe(0x06);
    expect(x.z80GetBc()).toBe(0x5500);
    expect(x.z80GetPc()).toBe(0xc001);
    expect(x.z80GetTacts()).toBe(4);
  });

  it("without the substitution the same code loads B", () => {
    reset([0x06, 0x01], 0xc000);
    x.z80SetBc(0x5500);
    step();
    expect(x.z80GetBc()).toBe(0x0100);
    expect(x.z80GetPc()).toBe(0xc002);
    expect(x.z80GetTacts()).toBe(7);
  });
});

describe("C3: the acknowledge hooks", () => {
  it("Z80_NMI_ACK_WAIT runs two tacts into the acknowledge and its wait tacts add up", () => {
    reset([0x00]);
    x.z80SetSigNmi(1);
    x.z80ExecuteCpuCycle();
    expect(x.hooksNmiAckWaitCount()).toBe(1);
    expect(x.hooksNmiAckWaitTacts()).toBe(2);
    expect(x.z80GetTacts()).toBe(11);

    reset([0x00]);
    x.hooksSetNmiWaitTacts(5);
    x.z80SetSigNmi(1);
    x.z80ExecuteCpuCycle();
    expect(x.z80GetTacts()).toBe(16);
    expect(x.z80GetPc()).toBe(0x0066);
  });

  it("Z80_INT_ACK runs after the six acknowledge tacts", () => {
    reset([0x00]);
    x.z80SetIff1(1);
    x.z80SetInterruptMode(1);
    x.z80SetSigInt(1);
    x.z80ExecuteCpuCycle();
    expect(x.hooksIntAckCount()).toBe(1);
    expect(x.hooksIntAckTacts()).toBe(6);
    expect(x.z80GetTacts()).toBe(13);
  });
});
