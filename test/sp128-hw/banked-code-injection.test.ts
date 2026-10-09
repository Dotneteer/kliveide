import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { injectSpectrumCode } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmHost";
import { writeCodeSegments } from "@emu/machines/writeCodeSegments";

import { createSp128Session, type Sp128SessionModel, type Sp128TestSession } from "../harness/sp128";

/*
 * Banked code injection into a bank that is paged in.
 *
 * The 128K and +2A/+3 cores keep a flat 64K copy of the paged-in memory (`sp128Memory`,
 * `spp3eMemory`) beside the banks. The Z80 reads through the slot pointers into the banks, but the
 * flat copy is `get64KFlatMemory()`, which the IDE's memory, disassembly, watch and system-variable
 * views read. A `.bank n` segment written into the bank's storage must reach that copy too when the
 * bank is visible (bank 5 at $4000, bank 2 at $8000, the selected bank at $C000), or those views show
 * the old bytes until the next paging write or reset.
 */

// --- LD A,$42 ; LD B,$37
const CODE = [0x3e, 0x42, 0x06, 0x37];

type Writer = (s: Sp128TestSession, bank: number, bankOffset: number, startAddress: number) => void;

const WRITERS: [string, Writer][] = [
  [
    "injectSpectrumCode (Run / Debug)",
    (s, bank, bankOffset, startAddress) => {
      const code = {
        model: "sp128",
        segments: [{ bank, bankOffset, startAddress, emittedCode: CODE }],
        options: { noCls: true }
      } as unknown as CodeToInject;
      injectSpectrumCode(s.machine, code);
    }
  ],
  [
    "writeCodeSegments (unit tests)",
    (s, bank, bankOffset, startAddress) =>
      writeCodeSegments(s.machine, [{ bank, bankOffset, startAddress, emittedCode: CODE }], false)
  ]
];

// --- The banks the 128K paging shows after a reset: bank 5, bank 2 and the selected bank 0
const SLOTS = [
  { bank: 5, offset: 0x1000, address: 0x5000 },
  { bank: 2, offset: 0x0100, address: 0x8100 },
  { bank: 0, offset: 0x0200, address: 0xc200 }
];

const MODELS: Sp128SessionModel[] = ["sp128", "pentagon", "scorpion", "plus2a"];

describe("banked code injection into a paged-in bank", () => {
  for (const model of MODELS) {
    for (const [name, write] of WRITERS) {
      for (const slot of SLOTS) {
        const where = `$${slot.address.toString(16).toUpperCase()}`;
        it(`${model}: ${name} into bank ${slot.bank} is what the CPU and the 64K view see at ${where}`, async () => {
          const s = await createSp128Session(model);
          expect(s.paging().bank).toBe(0);

          write(s, slot.bank, slot.offset, slot.address);

          // --- The bank as stored, the CPU's view of it and the flat 64K the IDE's views read
          expect(Array.from(s.bank(slot.bank).subarray(slot.offset, slot.offset + CODE.length))).toEqual(CODE);
          expect(CODE.map((_, i) => s.peek(slot.address + i))).toEqual(CODE);
          const flat = s.machine.get64KFlatMemory();
          expect(Array.from(flat.subarray(slot.address, slot.address + CODE.length))).toEqual(CODE);

          // --- And the CPU executes the new bytes
          s.machine.pc = slot.address;
          s.step(2);
          const cpu = s.cpu();
          expect(cpu.af >> 8).toBe(0x42);
          expect(cpu.bc >> 8).toBe(0x37);
        });
      }
    }
  }
});
