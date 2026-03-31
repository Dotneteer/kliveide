import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * DAC Port Handlers for ZX Spectrum Next
 *
 * The ZX Spectrum Next supports 4x 8-bit DAC channels through various I/O ports.
 * Each port is gated by enable8BitDacs (NextReg 0x08 bit 3) AND per-port enable
 * bits from NextReg 0x84.
 *
 * FPGA DAC Port-Channel Table:
 *   Port  | Mode(s)                  | Channel | Enable Bit(s)
 *   0x1F  | SoundDrive 1             | A       | bit 17
 *   0x0F  | SoundDrive 1 / Covox     | B       | bit 17 OR bit 20
 *   0x4F  | SoundDrive 1 / Covox     | C       | bit 17 OR bit 20
 *   0x5F  | SoundDrive 1 / Profi     | D       | bit 17 OR bit 19
 *   0xF1  | SoundDrive 2             | A       | bit 18
 *   0xF3  | SoundDrive 2             | B       | bit 18
 *   0xF9  | SoundDrive 2             | C       | bit 18
 *   0xFB  | Pentagon (A+D) / SD2 (D) | A+D / D | bit 21 OR bit 18
 *   0x3F  | Profi covox              | A       | bit 19
 *   0xDF  | Specdrum                 | A+D     | bit 23
 *   0xB3  | GS covox                 | B+C     | bit 22
 */

// --- Port 0x1F: SoundDrive mode 1, DAC A only (enable bit 17) ---
export function writeDacPort0x1F(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMode1Enabled) return;
  machine.audioControlDevice.getDacDevice().setDacA(value);
}

// --- Port 0x0F: SoundDrive mode 1 / Covox, DAC B (enable bit 17 OR bit 20) ---
export function writeDacPort0x0F(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  const nr = machine.nextRegDevice;
  if (!nr.portDacMode1Enabled && !nr.portDacStereoCovoxEnabled) return;
  machine.audioControlDevice.getDacDevice().setDacB(value);
}

// --- Port 0x4F: SoundDrive mode 1 / Covox, DAC C (enable bit 17 OR bit 20) ---
export function writeDacPort0x4F(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  const nr = machine.nextRegDevice;
  if (!nr.portDacMode1Enabled && !nr.portDacStereoCovoxEnabled) return;
  machine.audioControlDevice.getDacDevice().setDacC(value);
}

// --- Port 0x5F: SoundDrive mode 1 / Profi covox, DAC D (enable bit 17 OR bit 19) ---
export function writeDacPort0x5F(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  const nr = machine.nextRegDevice;
  if (!nr.portDacMode1Enabled && !nr.portDacStereoProfiCovoxEnabled) return;
  machine.audioControlDevice.getDacDevice().setDacD(value);
}

// --- Port 0xF1: SoundDrive mode 2, DAC A (enable bit 18) ---
export function writeDacPort0xF1(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMode2Enabled) return;
  machine.audioControlDevice.getDacDevice().setDacA(value);
}

// --- Port 0xF3: SoundDrive mode 2, DAC B (enable bit 18) ---
export function writeDacPort0xF3(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMode2Enabled) return;
  machine.audioControlDevice.getDacDevice().setDacB(value);
}

// --- Port 0xF9: SoundDrive mode 2, DAC C (enable bit 18) ---
export function writeDacPort0xF9(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMode2Enabled) return;
  machine.audioControlDevice.getDacDevice().setDacC(value);
}

// --- Port 0xFB: Pentagon/ATM (A+D, bit 21) or SoundDrive mode 2 (D, bit 18) ---
// FPGA: bit 21 operates only when SD2 is off. SD2 (bit 18) takes priority.
export function writeDacPort0xFB(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  const nr = machine.nextRegDevice;
  const dac = machine.audioControlDevice.getDacDevice();
  if (nr.portDacMode2Enabled) {
    // SoundDrive mode 2: D only
    dac.setDacD(value);
  } else if (nr.portDacMonoPentagonEnabled) {
    // Pentagon/ATM: A+D
    dac.setDacA(value);
    dac.setDacD(value);
  }
}

// --- Port 0x3F: Profi covox, DAC A only (enable bit 19) ---
export function writeDacPort0x3F(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacStereoProfiCovoxEnabled) return;
  machine.audioControlDevice.getDacDevice().setDacA(value);
}

// --- Port 0xDF: Specdrum, DAC A+D (enable bit 23) ---
export function writeDacPort0xDF(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMonoSpecdrumEnabled) return;
  const dac = machine.audioControlDevice.getDacDevice();
  dac.setDacA(value);
  dac.setDacD(value);
}

// --- Port 0xB3: GS covox, DAC B+C (enable bit 22) ---
export function writeDacPort0xB3(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  if (!machine.nextRegDevice.portDacMonoGsCovoxEnabled) return;
  const dac = machine.audioControlDevice.getDacDevice();
  dac.setDacB(value);
  dac.setDacC(value);
}

// --- Legacy generic handlers (kept for backward compatibility with tests) ---

export function writeDacAPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacA(value);
}

export function writeDacBPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacB(value);
}

export function writeDacCPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacC(value);
}

export function writeDacDPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacD(value);
}

export function writeDacAandDPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacA(value);
  machine.audioControlDevice.getDacDevice().setDacD(value);
}

export function writeDacBandCPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  machine.audioControlDevice.getDacDevice().setDacB(value);
  machine.audioControlDevice.getDacDevice().setDacC(value);
}

export function writeDacAllPort(machine: IZxNextMachine, value: number): void {
  if (!machine.soundDevice.enable8BitDacs) return;
  const dac = machine.audioControlDevice.getDacDevice();
  dac.setDacA(value);
  dac.setDacB(value);
  dac.setDacC(value);
  dac.setDacD(value);
}
