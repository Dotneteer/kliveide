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
class TestZxNextMachine extends ZxNextMachine {
  constructor(modelInfo?: MachineModel) {
    super(modelInfo);
  }

  initCode(code: number[], startAddress = 0x8000): void {
    const memoryDevice = this.memoryDevice;
    for (let i = 0; i < code.length; i++) {
      memoryDevice.writeMemory(startAddress + i, code[i])
    }
  }

  runCode(startAddress = 0x8000, mode?: "one-instr" | "until-end" | "until-addr", endAddr?: number): void {
    // TODO: Implement this
  }
}
