import type { IZ80Cpu } from "./IZ80Cpu";
import { IAnyMachine } from "./IAnyMachine";

/**
 * This interface defines the behavior of a virtual machine that integrates the emulator from separate hardware
 * components, including the Z80 CPU, the memory, screen, keyboard, and many other devices.
 */
export interface IZ80Machine extends IAnyMachine, IZ80Cpu {
}
