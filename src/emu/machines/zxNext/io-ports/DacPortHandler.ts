import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * DAC Port Handlers for ZX Spectrum Next
 *
 * The ZX Spectrum Next supports 4x 8-bit DAC channels through various I/O ports:
 * - Ports 0x1F, 0xF1, 0x3F → DAC A (left channel)
 * - Ports 0x0F, 0xF3 → DAC B (left channel)
 * - Ports 0x4F, 0xF9 → DAC C (right channel)
 * - Port 0x5F → DAC D (right channel)
 * - Ports 0xDF, 0xFB → DAC A + D (mono or combined channels)
 * - Port 0xB3 → DAC B + C (combined channels)
 *
 * All ports are write-only. Each write updates the corresponding DAC channel value.
 */

export function writeDacAPort(machine: IZxNextMachine, value: number): void {
  machine.audioControlDevice.getDacDevice().setDacA(value);
}

export function writeDacBPort(machine: IZxNextMachine, value: number): void {
  machine.audioControlDevice.getDacDevice().setDacB(value);
}

export function writeDacCPort(machine: IZxNextMachine, value: number): void {
  machine.audioControlDevice.getDacDevice().setDacC(value);
}

export function writeDacDPort(machine: IZxNextMachine, value: number): void {
  machine.audioControlDevice.getDacDevice().setDacD(value);
}

export function writeDacAandDPort(machine: IZxNextMachine, value: number): void {
  // Write the same value to both DAC A and DAC D (for SpecDrum mono playback)
  machine.audioControlDevice.getDacDevice().setDacA(value);
  machine.audioControlDevice.getDacDevice().setDacD(value);
}

export function writeDacBandCPort(machine: IZxNextMachine, value: number): void {
  // Write the same value to both DAC B and DAC C (for stereo playback)
  machine.audioControlDevice.getDacDevice().setDacB(value);
  machine.audioControlDevice.getDacDevice().setDacC(value);
}
