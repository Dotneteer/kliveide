import { describe, expect, it } from "vitest";
import { sp48BankSpace, sp128BankSpace } from "@common/annotations/bankSpace";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { compareAssembly, kliveDialect } from "@common/reverse/sourceExport";
import { buildExport } from "@renderer/appIde/reverse/exportRun";
import type { MemoryInfo } from "@common/messaging/EmuApi";

/*
 * `export-asm`'s orchestration (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7.2): a range of the 64K
 * view is cut at bank boundaries, each piece exported with its own `.org`, and the whole file still
 * reassembles to the bytes.
 */

const projectService = {
  readFileContent: async () => {
    throw new Error("missing");
  },
  saveFileContent: async () => undefined
} as any;

function ports(memory: Uint8Array, slotPartitions?: (number | undefined)[], partitions: Record<number, Uint8Array> = {}) {
  return {
    async getMemoryContents(partition?: number) {
      return { memory: partition === undefined ? memory : partitions[partition], slotPartitions } as unknown as MemoryInfo;
    }
  };
}

describe("buildExport", () => {
  it("cuts a range at the bank boundary and reassembles it", async () => {
    const memory = new Uint8Array(0x10000);
    // --- $7FFC in bank 5: ld hl,$8002 ; jp $8000 straddles into bank 2
    memory.set([0x21, 0x02, 0x80, 0xc3, 0x00, 0x80], 0x7ffa);
    memory.set([0x3e, 0x01, 0xcd, 0x00, 0x30, 0xc9], 0x8000);
    const result = await buildExport(
      ports(memory),
      {
        bankSpace: sp48BankSpace,
        romPartition: () => undefined,
        projectService,
        externalNames: () => ({ operandValue }) => (operandValue === 0x3000 ? "ROMROUTINE" : undefined)
      },
      { kind: "range", from: 0x7ffa, to: 0x8005 },
      { header: ["test"] }
    );
    expect(result.pieces).toBe(2);
    const source = kliveDialect.render(result.lines);
    expect(source.match(/\.org/g)).toHaveLength(2);
    expect(source).toContain("ROMROUTINE .equ $3000");
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    expect(output.errorCount).toBe(0);
    expect(compareAssembly(result.expected, output.segments).identical).toBe(true);
  });

  it("exports an unpaged 128K bank from its partition, with .bank", async () => {
    const memory = new Uint8Array(0x10000);
    const bank3 = new Uint8Array(0x4000);
    bank3.set([0xaf, 0xc9]);
    // --- Bank 0 is paged at $C000; bank 3 is read as a partition
    const result = await buildExport(
      ports(memory, [-1, -1, 5, 5, 2, 2, 0, 0], { 3: bank3 }),
      {
        bankSpace: sp128BankSpace,
        romPartition: () => undefined,
        projectService,
        model: "Spectrum128",
        bankDirectiveFor: (bank, base) => (base === 0xc000 ? bank : undefined)
      },
      { kind: "bank", bank: 3, start: 0, end: 7 },
      {}
    );
    const source = kliveDialect.render(result.lines);
    expect(source).toContain(".model Spectrum128");
    expect(source).toContain(".bank 3");
    const output = await new Z80Assembler().compile(source, new AssemblerOptions());
    expect(output.errorCount).toBe(0);
    expect(output.segments[0].bank).toBe(3);
    expect(compareAssembly(result.expected, output.segments).identical).toBe(true);
  });
});
