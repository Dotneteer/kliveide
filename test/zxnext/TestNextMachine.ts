import { MachineModel } from "@common/machines/info-types";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { FileProvider } from "./FileProvider";

export async function createTestNextMachine(modelInfo?: MachineModel): Promise<TestZxNextMachine> {
  const machine = new TestZxNextMachine(modelInfo);
  machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
  await machine.setup();
  return machine;
  
}

// --- ZX Next machine for test purposes
export class TestZxNextMachine extends ZxNextMachine {
  constructor(modelInfo?: MachineModel) {
    super(modelInfo);
  }

  initCode(code: number[], startAddress = 0x8000): void {
    const memoryDevice = this.memoryDevice;
    for (let i = 0; i < code.length; i++) {
      memoryDevice.writeMemory(startAddress + i, code[i])
    }
  }

  /**
   * Execute a single instruction (one opcode fetch)
   */
  executeOneInstruction(): void {
    const pcBefore = this.pc;
    this.beforeOpcodeFetch();
    this.executeCpuCycle();
    this.afterOpcodeFetch();
    
    // Check if this instruction was RETN by looking at memory at pcBefore
    // RETN is 0xED 0x45
    try {
      const byte1 = this.memoryDevice.readMemory(pcBefore);
      const byte2 = this.memoryDevice.readMemory(pcBefore + 1);
      if (byte1 === 0xED && byte2 === 0x45) {
        // RETN was executed, notify DivMMC
        this.divMmcDevice.handleRetnExecution();
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Execute instructions until a RETN is detected
   */
  executeUntilRetn(): void {
    const maxCycles = 10000;
    let cycleCount = 0;
    
    while (cycleCount < maxCycles) {
      this.beforeOpcodeFetch();
      this.executeCpuCycle();
      this.afterOpcodeFetch();
      
      // Check if we just executed a RETN instruction (0xED 0x45)
      // The PC will have moved past the RETN by now
      cycleCount++;
    }
  }

  runCode(startAddress = 0x8000, mode?: "one-instr" | "until-end" | "until-addr", endAddr?: number): void {
    // TODO: Implement this
  }
}
