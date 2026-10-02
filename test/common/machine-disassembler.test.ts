import { describe, expect, it } from "vitest";
import { machineRegistry } from "@common/machines/machine-registry";
import { CT_DISASSEMBLER, MI_Z88 } from "@common/machines/constants";
import { MemorySectionType } from "@abstractions/MemorySection";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import type { DisassemblerFactory } from "@renderer/appIde/DocumentPanels/useDisassemblyRefresh";

/**
 * Every machine must register a disassembler factory.
 *
 * The disassembly view takes its disassembler from `toolInfo[CT_DISASSEMBLER]` and has no fallback:
 * a machine without one gets an empty view. The Cambridge Z88 was that machine - it registered only
 * its custom disassembler - so pausing it showed no lines at all.
 */
describe("CT_DISASSEMBLER", () => {
  it.each(machineRegistry.map((mi) => [mi.displayName, mi.machineId]))(
    "is registered for %s",
    (_name, machineId) => {
      const machine = machineRegistry.find((mi) => mi.machineId === machineId);
      expect(typeof machine?.toolInfo?.[CT_DISASSEMBLER]).toBe("function");
    }
  );

  it("disassembles Z80 code for the Cambridge Z88", async () => {
    const factory = machineRegistry.find((mi) => mi.machineId === MI_Z88)?.toolInfo?.[
      CT_DISASSEMBLER
    ] as DisassemblerFactory;
    const memory = new Uint8Array(0x10000);
    memory.set([0x3e, 0x2a, 0xc9]); // ld a,$2a; ret

    const output = await factory(
      [new MemorySection(0x0000, 0x0002, MemorySectionType.Disassemble)],
      memory
    ).disassemble(0x0000, 0x0002);

    expect(output?.outputItems.map((item) => item.address)).toEqual([0x0000, 0x0002]);
  });
});
