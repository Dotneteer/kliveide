import { IM6510Cpu } from "@emu/abstractions/IM6510Cpu";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import { C64VicDevice } from "./vic/C64VicDevice";
import { C64SidDevice } from "./C64SidDevice";
import { C64KeyboardDevice } from "./C64KeyboardDevice";
import { C64Cia1Device } from "./C64Cia1Device";
import { C64Cia2Device } from "./C64Cia2Device";
import { C64IoExpansionDevice } from "./C64IoExpansionDevice";
import { C64CpuPortDevice } from "./C64CpuPortDevice";
import { C64TapeDevice } from "./C64TapeDevice";
import { C64MemoryDevice } from "./C64MemoryDevice";
import { VicState } from "@common/messaging/EmuApi";

export interface IC64Machine extends IAnyMachine, IM6510Cpu {
  /**
   * The physical memory of the machine
   */
  readonly memoryDevice: C64MemoryDevice;

  readonly cpuPortDevice: C64CpuPortDevice;

  readonly vicDevice: C64VicDevice;

  readonly sidDevice: C64SidDevice;

  readonly keyboardDevice: C64KeyboardDevice;

  readonly cia1Device: C64Cia1Device;

  readonly cia2Device: C64Cia2Device;

  readonly ioExpansionDevice: C64IoExpansionDevice;

  readonly tapeDevice: C64TapeDevice;

  isIrqActive(): boolean;

  isNmiActive(): boolean;

  /**
   * Retrieves the current VIC state.
   */
  getVicState(): VicState;
}