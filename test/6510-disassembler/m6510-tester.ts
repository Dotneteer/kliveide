import { expect } from "vitest";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { intToX2 } from "@renderer/appIde/disassemblers/utils";
import { M6510Disassembler } from "@renderer/appIde/disassemblers/6510-disassembler/m6510-disassembler";

/**
 * Helper class for M6510 Disassembler testing
 */
export class M6510Tester {
  /**
   * Tests if M6510 instruction disassembly works
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async Test(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(opCodes), undefined);
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
    expect(item.opCodes ? item.opCodes.map((oc) => intToX2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if M6510 instruction disassembly works with cycles
   * @param expected Expected disassembly text
   * @param expectedCycles Expected cycle count
   * @param opCodes Operation codes
   */
  static async TestWithCycles(
    expected: string,
    expectedCycles: number,
    ...opCodes: number[]
  ): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(opCodes), undefined);
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
    expect(item.tstates).toBe(expectedCycles);
    expect(item.opCodes ? item.opCodes.map((oc) => intToX2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if M6510 instruction disassembly works with decimal mode
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestWithDecimal(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, opCodes.length - 1));

    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(opCodes), {
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
    expect(item.opCodes ? item.opCodes.map((oc) => intToX2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Tests if M6510 instruction disassembly works with base address 0x1000
   * @param expected Expected disassembly text
   * @param opCodes Operation codes
   */
  static async TestAt1000(expected: string, ...opCodes: number[]): Promise<void> {
    const map = new MemoryMap();
    map.add(new MemorySection(0x1000, 0x1000 + opCodes.length - 1));

    const disassembler = new M6510Disassembler(map.sections, new Uint8Array(opCodes), undefined);
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
    expect(item.opCodes ? item.opCodes.map((oc) => intToX2(oc)).join(" ") : "").toBe(
      this._joinOpCodes(opCodes)
    );
  }

  /**
   * Helper to join opcode arrays into hex strings
   * @param opCodes Array of opcodes
   * @returns Hex string representation
   */
  private static _joinOpCodes(opCodes: number[]): string {
    return opCodes.map((oc) => intToX2(oc)).join(" ");
  }
}
