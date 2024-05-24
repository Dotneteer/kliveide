import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

export function readLayer2Port(machine: IZxNextMachine): number {
  return machine.layer2Device.lastPortValue;
}

export function writeLayer2Port(machine: IZxNextMachine, value: number): void {
  const layer2Device = machine.layer2Device;
  const nextRegDevice = machine.nextRegDevice;

  if (value & 0x10) {
    layer2Device.lastPortValue = value;

    // --- Synch Bit 1 with Bit 7 of register 0x69
    let reg69Value = nextRegDevice.directGetRegValue(0x69) & 0x7f;
    if (value & 0x02) reg69Value |= 0x80;
    nextRegDevice.directSetRegValue(0x69, reg69Value);
  } else {
    layer2Device.layer2SecondByte = value;
  }
}
