import { ProgramCounterInfo } from "../../shared/state/AppState";
import { Z80Cpu, Z80CpuState } from "../cpu/Z80Cpu";
import { MemoryHelper } from "./memory-helpers";
import { BLOCK_LOOKUP_TABLE } from "./memory-map";
import { VirtualMachineCoreBase } from "./VirtualMachineCoreBase";
import { MachineState } from "./vm-core-types";

/**
 * ZX Spectrum common core implementation
 */
export abstract class Z80MachineCoreBase extends VirtualMachineCoreBase {
  // --- The Z80 CPU instance behind the ZX Spectrum machine
  protected z80: Z80Cpu;

  /**
   * Creates the CPU instance
   */
  configureMachine(): void {
    this.z80 = new Z80Cpu(this.api);
  }

  /**
   * Override this method to determine the length of the subsequent CPU instruction
   * @returns The address of the next step-over-able instruction, if found; otherwise, -1
   */
  getNextInstructionAddress(): number {
    // --- Calculate the location of the step-over breakpoint
    const pc = this.z80.getCpuState().pc;
    const opCode = this.readMemory(pc);
    if (opCode === 0xcd) {
      // --- CALL
      return pc + 3;
    } else if ((opCode & 0xc7) === 0xc4) {
      // --- CALL with conditions
      return pc + 3;
    } else if ((opCode & 0xc7) === 0xc7) {
      // --- RST instruction
      return pc + 1;
    } else if (opCode === 0x76) {
      // --- HALT
      return pc + 1;
    } else if (opCode === 0xed) {
      // --- Block I/O and transfer
      const extOpCode = this.readMemory(pc + 1);
      return (extOpCode & 0xb4) === 0xb0 ? pc + 2 : -1;
    }
    return -1;
  }

  /**
   * Reads a byte from the memory
   * @param addr Memory address
   */
  readMemory(addr: number): number {
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    const pageStart = mh.readUint32(((addr >> 13) & 0x07) * 16);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
    return mem[addr & 0x1fff];
  }

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  writeMemory(addr: number, value: number): void {
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    const pageStart = mh.readUint32(((addr >> 13) & 0x07) * 16);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
    mem[addr & 0x1fff] = value;
  }

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  getMemoryContents(): Uint8Array {
    const result = new Uint8Array(0x10000);
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    for (let i = 0; i < 8; i++) {
      const offs = i * 0x2000;
      const pageStart = mh.readUint32(i * 16);
      const source = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
      for (let j = 0; j < 0x2000; j++) {
        result[offs + j] = source[j];
      }
    }
    return result;
  }
}
