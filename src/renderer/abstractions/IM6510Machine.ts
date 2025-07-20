import { IM6510Cpu } from "@emu/abstractions/IM6510Cpu";
import { IAnyMachine } from "./IAnyMachine";

/**
 * This interface defines the behavior of a virtual machine that integrates the emulator from separate hardware
 * components, including the Z80 CPU, the memory, screen, keyboard, and many other devices.
 */
export interface IM6510Machine extends IAnyMachine, IM6510Cpu {
}
