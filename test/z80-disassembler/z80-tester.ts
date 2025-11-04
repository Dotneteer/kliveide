import { expect } from "vitest";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { intToX2 } from "@renderer/appIde/disassemblers/utils";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { ICustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/custom-disassembly";

/**
 * Helper class for Z80 Disassembler testing
 */
export class Z80Tester {
  /**
   * Tests if Z80 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async Test(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes));
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
    expect(item.opCodes ? item.opCodes.map((oc) => toHexa2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if Z80 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestWithDecimal(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      decimalMode: true
    });
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
    expect(item.opCodes ? item.opCodes.map((oc) => toHexa2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if Z80 extended instruction set disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestExt(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      allowExtendedSet: true
    });
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
    expect(item.opCodes ? item.opCodes.map((oc) => toHexa2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if Z80 extended instruction set disassembly works
   * @param expectedComment Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestExtComment(expectedComment: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      allowExtendedSet: true
    });
    var output = await disassembler.disassemble();
    expect(output).not.toBeNull();
    if (output === null) {
      return;
    }
    expect(output.outputItems.length).toBe(1);
    const item = output.outputItems[0];
    expect(item.hardComment).toBe(expectedComment);
  }

  /**
   * Tests if Z80 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestWithTStates(
    expected: string,
    tstates: number | [number, number],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes));
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
    expect(item.opCodes ? item.opCodes.map((oc) => toHexa2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );

    if (typeof tstates === "number") {
      expect(item.tstates).toBe(tstates);
    } else {
      expect(item.tstates).toBe(tstates[0]);
      expect(item.tstates2).toBe(tstates[1]);
    }
  }

  /**
   * Tests if Z80 extended instruction set disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestExtWithTStates(
    expected: string,
    tstates: number | [number, number],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      allowExtendedSet: true
    });
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
    expect(item.opCodes ? item.opCodes.map((oc) => toHexa2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );

    if (typeof tstates === "number") {
      expect(item.tstates).toBe(tstates);
    } else {
      expect(item.tstates).toBe(tstates[0]);
      expect(item.tstates2).toBe(tstates[1]);
    }
  }

  /**
   * Tests custom disassemblers
   * @provider Custom disassembler provider
   * @param expected Expected result
   * @param opCodes opcodes to disassemble
   */
  static async TestCustom(
    provider: ICustomDisassembler,
    romPage: number,
    expected: string[],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      getRomPage: () => romPage
    });
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
  static async TestCustomWithDecimal(
    provider: ICustomDisassembler,
    romPage: number,
    expected: string[],
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      decimalMode: true,
      getRomPage: () => romPage
    });
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
  static async TestCustomWithComments(
    provider: ICustomDisassembler,
    romPage: number,
    expected: string[],
    comments: string[],
    opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      getRomPage: () => romPage
    });
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
   * Tests custom disassemblers
   * @provider Custom disassembler provider
   * @param expected Expected result
   * @param opCodes opcodes to disassemble
   */
  static async TestCustomWithCommentsAndDecimal(
    provider: ICustomDisassembler,
    romPage: number,
    expected: string[],
    comments: string[],
    opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));
    const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
      decimalMode: true,
      getRomPage: () => romPage
    });
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
  private static _joinOpCodes(opCodes: number[]): string {
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
