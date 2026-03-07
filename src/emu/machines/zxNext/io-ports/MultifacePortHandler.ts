import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * All multiface port handlers delegate to MultifaceDevice, which internally
 * resolves which operation to perform based on the current multifaceType.
 *
 * The port addresses 0x1F/0x9F/0x3F/0xBF are shared across MF48, MF128 and
 * MF+3 modes. The device resolves enable vs. disable based on the active mode.
 */

export function readMultifaceDisablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readDisablePort();
}

export function writeMultifaceDisablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeDisablePort(_value);
}

export function readMultifaceEnablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readEnablePort();
}

export function writeMultifaceEnablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeEnablePort(_value);
}

// MF128 v87.2 variants — same logic, device resolves mode
export function readMultiface128DisablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readDisablePort();
}

export function writeMultiface128DisablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeDisablePort(_value);
}

export function readMultiface128EnablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readEnablePort();
}

export function writeMultiface128EnablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeEnablePort(_value);
}

// MF+3 variants — same logic, device resolves mode
export function readMultifaceP3DisablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readDisablePort();
}

export function writeMultifaceP3DisablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeDisablePort(_value);
}

export function readMultifaceP3EnablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readEnablePort();
}

export function writeMultifaceP3EnablePort(_port: number, _value: number, machine: IZxNextMachine): void {
  machine.multifaceDevice.writeEnablePort(_value);
}
