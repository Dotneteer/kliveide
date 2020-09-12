import * as expect from "expect";
import { Z80Tester } from "./z80-tester";
import {
  SpectrumSpecificDisassemblyFlags,
  MemorySection,
  MemoryMap,
  MemorySectionType,
} from "../../src/disassembler/disassembly-helper";
import { Z80Disassembler } from "../../src/disassembler/z80-disassembler";

describe("Disassembler - ZX Spectrum-specific", () => {
  it("RST #08 work as expected", async () => {
    // --- Act
    await Z80Tester.TestZx(
      SpectrumSpecificDisassemblyFlags.Spectrum48,
      ["rst #08", ".defb #0a"],
      0xcf,
      0x0a
    );
  });

  it("RST #08 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestZx(
      SpectrumSpecificDisassemblyFlags.Spectrum48,
      ["rst #08", ".defb #0a", "nop"],
      0xcf,
      0x0a,
      0x00
    );
  });

  it("RST #28 goes on as expected", async () => {
    // --- Act
    await Z80Tester.TestZx(
      SpectrumSpecificDisassemblyFlags.Spectrum48,
      ["rst #28", ".defb #38", "nop"],
      0xef,
      0x38,
      0x00
    );
  });

  it("RST #28 section works as expected", async () => {
    // --- Arrange
    const opCodes = [0x02, 0xe1, 0x34, 0xf1, 0x38, 0xaa, 0x3b, 0x29, 0x00];
    const expected = [
      ".defb #02",
      ".defb #e1",
      ".defb #34",
      ".defb #f1, #38, #aa, #3b, #29",
      "nop",
    ];
    const expComment = [
      "(delete)",
      "(get-mem-1)",
      "(stk-data)",
      "(1.442695)",
      undefined,
    ];

    // --- Act
    const map = new MemoryMap();
    map.sections.push(
      new MemorySection(
        0x0000,
        opCodes.length - 2,
        MemorySectionType.Rst28Calculator
      )
    );
    map.sections.push(
      new MemorySection(opCodes.length - 1, opCodes.length - 1)
    );
    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes)
    );
    const output = await disassembler.disassemble();

    // --- Assert
    expect(output).not.toBeNull();
    if (output === null) {
      return;
    }
    expect(output.outputItems.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const instr = output.outputItems[i].instruction;
      expect(instr).toBeTruthy();
      if (!instr) {
        continue;
      }
      expect(instr.toLowerCase()).toBe(expected[i]);
    }
    expect(output.outputItems.length).toBe(expComment.length);
    for (let i = 0; i < expected.length; i++) {
      let comment = output.outputItems[i].hardComment;
      if (comment) {
        comment = comment.toLowerCase();
      }
      expect(comment).toBe(expComment[i]);
    }
  });
});
