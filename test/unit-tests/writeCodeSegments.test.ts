import { describe, expect, it } from "vitest";

import { writeCodeSegments } from "@emu/machines/writeCodeSegments";

/*
 * Banked segments go into their bank whatever is paged in (`.plans/Z80_UNIT_TESTS_PLAN.md` T5): a
 * 16K partition on the 128K family, two 8K pages on the Next.
 */

function fakeMachine(partitionSize: number) {
  const flat = new Uint8Array(0x10000);
  const partitions = new Map<number, Uint8Array>();
  return {
    flat,
    partitions,
    doWriteMemory: (address: number, value: number) => {
      flat[address] = value;
    },
    getMemoryPartition: (index: number) => {
      if (!partitions.has(index)) partitions.set(index, new Uint8Array(partitionSize));
      return partitions.get(index)!;
    }
  };
}

describe("writeCodeSegments", () => {
  it("writes an unbanked segment through the 64K address space", () => {
    const m = fakeMachine(0x4000);
    writeCodeSegments(m, [{ startAddress: 0xfffe, emittedCode: [1, 2, 3] }], false);
    expect([m.flat[0xfffe], m.flat[0xffff], m.flat[0]]).toEqual([1, 2, 3]);
  });

  it("writes a 128K bank into its 16K partition at the bank offset", () => {
    const m = fakeMachine(0x4000);
    writeCodeSegments(m, [{ bank: 3, bankOffset: 0x100, startAddress: 0xc100, emittedCode: [7, 8] }], false);
    expect(m.partitions.get(3)![0x100]).toBe(7);
    expect(m.partitions.get(3)![0x101]).toBe(8);
    expect(m.flat[0xc100]).toBe(0);
  });

  it("splits a Next bank across its two 8K pages", () => {
    const m = fakeMachine(0x2000);
    const code = new Array(0x2002).fill(0).map((_, i) => i & 0xff);
    writeCodeSegments(m, [{ bank: 20, bankOffset: 0, startAddress: 0xc000, emittedCode: code }], true);
    expect(m.partitions.get(40)![0x1fff]).toBe(0xff);
    expect(m.partitions.get(41)![0]).toBe(0x00);
    expect(m.partitions.get(41)![1]).toBe(0x01);
  });
});
