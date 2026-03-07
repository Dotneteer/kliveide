import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unified multiface port handlers.
 *
 * The same physical port address (0x1F, 0x3F, 0x9F, 0xBF) serves as either
 * the enable or disable port depending on the current multifaceType (NR 0x0A).
 * The MultifaceDevice.handlePortRead/Write methods dynamically resolve which
 * operation to perform, mirroring the VHDL's port_mf_enable_io_a /
 * port_mf_disable_io_a address selection logic.
 */

export function readMultifacePort(port: number, machine: IZxNextMachine): number {
  return machine.multifaceDevice.handlePortRead(port);
}

export function writeMultifacePort(port: number, value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.handlePortWrite(port, value);
}
