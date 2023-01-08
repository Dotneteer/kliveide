import { expect } from "expect";
import { ICustomDisassembler } from "../../src/appIde/z80-disassembler/custom-disassembly";
import {
  intToX2,
  MemoryMap,
  MemorySection
} from "../../src/appIde/z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../../src/appIde/z80-disassembler/z80-disassembler";

/**
 * Helper class for Z80 Disassembler testing
 */
export class Z80Tester {
  /**
   * Tests if Z80 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async Test (expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes)
    );
    var output = await disassembler.disassemble();
    expect(output).not.toBeNull();
    if (output === null) {
      return;
    }
    expect(output.outputItems.length).toBe(1);
    const item = output.outputItems[0];
    expect(item.instruction).toBeTruthy();
    if (!item.instruction) {
      return;
    }
    expect(item.instruction.toLowerCase()).toBe(expected.toLowerCase());
    expect(item.opCodes ? item.opCodes.trim() : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if Z80 extended instruction set disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestExt (expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes),
      true
    );
    var output = await disassembler.disassemble();
    expect(output).not.toBeNull();
    if (output === null) {
      return;
    }
    expect(output.outputItems.length).toBe(1);
    const item = output.outputItems[0];
    expect(item.instruction).toBeTruthy();
    if (!item.instruction) {
      return;
    }
    expect(item.instruction.toLowerCase()).toBe(expected.toLowerCase());
    expect(item.opCodes ? item.opCodes.trim() : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests custom disassemblers
   * @provider Custom disassembler provider
   * @param expected Expected result
   * @param opCodes opcodes to disassemble
   */
  static async TestCustom (
    provider: ICustomDisassembler,
    expected: string[],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes)
    );
    disassembler.setCustomDisassembler(provider);
    var output = await disassembler.disassemble();
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
  }

  /**
   * Tests custom disassemblers
   * @provider Custom disassembler provider
   * @param expected Expected result
   * @param opCodes opcodes to disassemble
   */
  static async TestCustomWithComments (
    provider: ICustomDisassembler,
    expected: string[],
    comments: string[],
    opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(
      map.sections,
      new Uint8Array(opCodes)
    );
    disassembler.setCustomDisassembler(provider);
    var output = await disassembler.disassemble();
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
    expect(output.outputItems.length).toBe(comments.length);
    for (let i = 0; i < comments.length; i++) {
      const comment = output.outputItems[i].hardComment;
      if (!comment) {
        continue;
      }
      expect(comment.toLowerCase()).toBe(comments[i]);
    }
  }

  /**
   * Joins the opcodes into a string
   * @param opCodes Opecration codes
   */
  private static _joinOpCodes (opCodes: number[]): string {
    let result = "";
    for (let i = 0; i < opCodes.length; i++) {
      if (i > 0) {
        result += " ";
      }
      result += intToX2(opCodes[i]);
    }
    return result;
  }
}
