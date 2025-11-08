import { IAnyMachine } from "@emuabstr/IAnyMachine";
import { IDebugSupport } from "@emuabstr/IDebugSupport";
import { IStandardKeyboardDevice } from "@emuabstr/IGenericKeyboardDevice";
import { MessengerBase } from "@messaging/MessengerBase";
import { C64Cia1Device } from "./C64Cia1Device";
import { C64Cia2Device } from "./C64Cia2Device";
import { C64CpuPortDevice } from "./C64CpuPortDevice";
import { C64IoExpansionDevice } from "./C64IoExpansionDevice";
import { C64KeyboardDevice } from "./C64KeyboardDevice";
import { C64MemoryDevice } from "./C64MemoryDevice";
import { C64SidDevice } from "./C64SidDevice";
import { C64VicDevice } from "./vic/C64VicDevice";
import { C64TapeDevice } from "./C64TapeDevice";
import { VicState } from "@messaging/EmuApi";
import { IM6510VaCpu } from "@emuabstr/IM6510VaCpu";

export interface IC64Machine extends IAnyMachine, IM6510VaCpu {
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