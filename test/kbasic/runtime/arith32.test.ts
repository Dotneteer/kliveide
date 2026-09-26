import { beforeAll, describe, expect, it } from "vitest";

import { createRuntimeRig, type RuntimeRig } from "./runtime-kit";

/**
 * The arith32 routines take the left operand on the stack and the right one in DE:HL. `Op32` pushes
 * Left and calls the routine whose address is in Target with Right in DE:HL.
 */
const EXTRA = [
  "Op32:",
  "    ld hl,(Left+2)",
  "    push hl",
  "    ld hl,(Left)",
  "    push hl",
  "    ld hl,(Right)",
  "    ld de,(Right+2)",
  "    call Dispatch",
  "    ret",
  "Dispatch:",
  "    push hl",
  "    ld hl,(Target)",
  "    ex (sp),hl",
  "    ret",
  "Left:",
  "    .defs 4",
  "Right:",
  "    .defs 4",
  "Target:",
  "    .defw 0"
].join("\n");

/** Deterministic pseudo-random 32-bit values (a small LCG), so a failure reproduces. */
function* lcg(seed: number, count: number): Generator<bigint> {
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    const hi = x;
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    // --- A spread of magnitudes: shift the value right by 0..31 bits
    yield BigInt(((hi << 16) ^ x) >>> 0) >> BigInt(x % 32);
  }
}

const EDGE32 = [0n, 1n, 2n, 3n, 7n, 10n, 255n, 256n, 65535n, 65536n, 100000n, 0x7fffffffn, 0x80000000n, 0x80000001n, 0xfffffffen, 0xffffffffn];
const VALUES = [...EDGE32, ...lcg(7, 30)];

const u32 = (v: bigint) => BigInt.asUintN(32, v);
const i32 = (v: bigint) => BigInt.asIntN(32, v);

describe("Klive BASIC runtime - arith32", () => {
  let rig: RuntimeRig;
  beforeAll(async () => {
    rig = await createRuntimeRig({ uses: ["Mul32", "DivU32", "ModU32", "DivI32", "ModI32"], extra: EXTRA });
  });

  function op(routine: string, left: bigint, right: bigint): bigint {
    const s = rig.session;
    const put = (label: string, v: bigint) => s.pokeWord(rig.program.symbol(label), Number(u32(v) & 0xffffn)).pokeWord(rig.program.symbol(label) + 2, Number(u32(v) >> 16n));
    put("Left", left);
    put("Right", right);
    s.pokeWord(rig.program.symbol("Target"), rig.program.symbol(`core.${routine}`));
    const r = rig.call("Op32");
    return (BigInt(r.de) << 16n) | BigInt(r.hl);
  }

  it("Mul32 keeps the low 32 bits of every product", () => {
    for (const a of VALUES) for (const b of VALUES.slice(0, 16)) expect(op("Mul32", a, b), `${a} * ${b}`).toBe(u32(a * b));
  });

  it("DivU32 and ModU32 divide unsigned", () => {
    for (const a of VALUES) {
      for (const b of VALUES.slice(1, 18)) {
        expect(op("DivU32", a, b), `${a} / ${b}`).toBe(a / b);
        expect(op("ModU32", a, b), `${a} MOD ${b}`).toBe(a % b);
      }
    }
  });

  it("DivI32 and ModI32 truncate towards zero; the remainder takes the dividend's sign", () => {
    const signed = VALUES.map(i32);
    for (const a of signed) {
      for (const b of [...signed.slice(1, 12), -1n, -3n, -10n, -65536n]) {
        if (b === 0n) continue;
        // --- BigInt division truncates towards zero, as the routines do
        expect(i32(op("DivI32", a, b)), `${a} / ${b}`).toBe(i32(a / b));
        expect(i32(op("ModI32", a, b)), `${a} MOD ${b}`).toBe(a % b);
      }
    }
  });

  it("gives every bit set for a division by zero, and the dividend as the remainder", () => {
    expect(op("DivU32", 1234567n, 0n)).toBe(0xffffffffn);
    expect(op("ModU32", 1234567n, 0n)).toBe(1234567n);
  });
});
