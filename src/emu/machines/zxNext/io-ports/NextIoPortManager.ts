import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { readSpectrumP3FdcStatusPort } from "./SpectrumP3FdcStatusPortHandler";
import {
  readSpectrumP3FdcControlPort,
  writeSpectrumP3FdcControlPort
} from "./SpectrumP3FdcControlPortHandler";
import { readI2cSclPort, writeI2cSclPort } from "./I2cSclPortHandler";
import { readI2cSdaPort, writeI2cSdaPort } from "./I2cSdaPortHandler";
import { readUartTxPort, writeUartTxPort } from "./UartTxPortHandler";
import { readUartRxPort, writeUartRxPort } from "./UartRxPortHandler";
import { readUartSelectPort, writeUartSelectPort } from "./UartSelectPortHandler";
import { readUartFramePort, writeUartFramePort } from "./UartFramePortHandler";
import { readCtcPort, writeCtcPort } from "./CtcPortHandler";
import { readUlaPlusDataPort, writeUlaPlusDataPort } from "./UlaPlusDataPortHandler";
import { readZ80DmaPort, writeZ80DmaPort } from "./Z80DmaPortHandler";
import { readZxnDmaPort, writeZxnDmaPort } from "./ZxnDmaPortHandler";
import { readAyRegPort, writeAyRegPort } from "./AyRegPortHandler";
import { readAyDatPort, writeAyDatPort } from "./AyDatPortHandler";
import {
  writeDacAPort,
  writeDacAandDPort,
  writeDacBPort,
  writeDacBandCPort,
  writeDacCPort,
  writeDacDPort
} from "./DacPortHandler";
import {
  readKempstonJoy1AliasPort,
  readKempstonJoy1Port,
  readKempstonJoy2Port,
  readKempstonMouseXPort,
  readKempstonMouseYPort,
  readKempstonMouseWheelPort
} from "./KempstonHandler";
import {
  readMultifacePort,
  writeMultifacePort
} from "./MultifacePortHandler";

type IoPortReaderFn = (port: number) => number;
type IoPortWriterFn = (port: number, value: number) => void | boolean;

/** Sentinel returned by a reader when the port group is disabled (value = 0xff, not handled). */
const NOT_HANDLED = 0x1ff;

type PortDescriptor = {
  pmask: number;
  value: number;
  port?: number;
  description: string;
  readerFns?: IoPortReaderFn | IoPortReaderFn[];
  writerFns?: IoPortWriterFn | IoPortWriterFn[];
};

export class NextIoPortManager {
  private readonly ports: PortDescriptor[] = [];
  private readonly portMap: Map<number, PortDescriptor> = new Map();
  private readonly portCollisions: Map<number, string[]> = new Map();
  private _portTimexValue = 0;

  constructor(public readonly machine: IZxNextMachine) {
    const r = (val: PortDescriptor) => this.registerPort(val);

    // --- Port enable gate helpers: combine internal (NR $82–$85) with bus (NR $86–$89)
    const pe = (ri: number, bit: number) => machine.nextRegDevice.isPortGroupEnabled(ri, bit);
    const gR = (ri: number, bit: number, fn: (port: number) => number): IoPortReaderFn =>
      (p) => pe(ri, bit) ? fn(p) : NOT_HANDLED;
    const gW = (ri: number, bit: number, fn: (port: number, value: number) => void | boolean): IoPortWriterFn =>
      (p, v) => { if (pe(ri, bit)) return fn(p, v); };

    r({
      description: "ULA",
      port: 0xfe,
      pmask: 0b0000_0000_0000_0001,
      value: 0b0000_0000_0000_0000,
      readerFns: (p) => this.machine.ulaDevice.readPort0xfe(p),
      writerFns: (_, v) => { this.machine.ulaDevice.writePort0xfe(v) }
    });
    r({
      description: "Timex video, floating bus",
      port: 0xff,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1111,
      readerFns: () => {
        if (pe(0, 0)) {
          // Timex port is enabled
          return this._portTimexValue;
        }
        return 0xff;
      },
      writerFns: (_, v) => {
        if (pe(0, 0)) {
          // Timex port is enabled
          this._portTimexValue = v & 0xff;
          this.machine.interruptDevice.ulaInterruptDisabled = (v & 0x40) !== 0;
          this.machine.composedScreenDevice.timexPortValue = v & 0x3f;
        }
      }
    });
    r({
      description: "ZX Spectrum 128 memory",
      port: 0x7ffd,
      pmask: 0b1100_0000_0000_0011,
      value: 0b0100_0000_0000_0001,
      writerFns: gW(0, 1, (_, v) => {
        machine.memoryDevice.port7ffdValue = v;
      })
    });
    r({
      description: "Spectrum Next bank extension",
      port: 0xdffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b1101_0000_0000_0001,
      writerFns: gW(0, 2, (_, v) => {
        machine.memoryDevice.portDffdValue = v;
      })
    });
    r({
      description: "ZX Spectrum +3 memory",
      port: 0x1ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0001_0000_0000_0001,
      writerFns: gW(0, 3, (_, v) => {
        machine.memoryDevice.port1ffdValue = v;
        if (v & 0x08) {
          machine.floppyDevice.turnOnMotor();
        } else {
          machine.floppyDevice.turnOffMotor();
        }
      })
    });
    r({
      description: "ZX Spectrum +3 FDC status",
      port: 0x2ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0010_0000_0000_0001,
      readerFns: gR(0, 4, readSpectrumP3FdcStatusPort(machine))
    });
    r({
      description: "ZX Spectrum +3 FDC control",
      port: 0x3ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0011_0000_0000_0001,
      readerFns: gR(0, 4, readSpectrumP3FdcControlPort(machine)),
      writerFns: gW(0, 4, writeSpectrumP3FdcControlPort(machine))
    });
    r({
      description: "Pentagon 1024K memory",
      port: 0xeff7,
      pmask: 0b1111_0000_1111_1111,
      value: 0b1110_0000_1111_0111,
      writerFns: gW(3, 2, (_, v) => { machine.memoryDevice.portEff7Value = v & 0x0c; })
    });
    r({
      description: "NextREG Register Select",
      port: 0x243b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0010_0100_0011_1011,
      readerFns: () => machine.nextRegDevice.getNextRegisterIndex(),
      writerFns: (_, v) => machine.nextRegDevice.setNextRegisterIndex(v)
    });
    r({
      description: "NextREG Data",
      port: 0x253b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0010_0101_0011_1011,
      readerFns: () => machine.nextRegDevice.getNextRegisterValue(),
      writerFns: (_, v) => machine.nextRegDevice.setNextRegisterValue(v)
    });
    r({
      description: "i2c SCL",
      port: 0x103b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0000_0011_1011,
      readerFns: gR(1, 2, readI2cSclPort(machine)),
      writerFns: gW(1, 2, writeI2cSclPort(machine))
    });
    r({
      description: "i2c SDA",
      port: 0x113b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0001_0011_1011,
      readerFns: gR(1, 2, readI2cSdaPort(machine)),
      writerFns: gW(1, 2, writeI2cSdaPort(machine))
    });
    r({
      description: "Layer 2",
      port: 0x123b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0010_0011_1011,
      readerFns: () => pe(1, 7) ? machine.composedScreenDevice.port0x123bValue : 0xff,
      writerFns: (_, v) => {
        if (pe(1, 7)) machine.composedScreenDevice.port0x123bValue = v;
      }
    });
    r({
      description: "UART Tx",
      port: 0x133b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0011_0011_1011,
      readerFns: gR(1, 4, readUartTxPort(machine)),
      writerFns: gW(1, 4, writeUartTxPort(machine))
    });
    r({
      description: "UART Rx",
      port: 0x143b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0100_0011_1011,
      readerFns: gR(1, 4, readUartRxPort(machine)),
      writerFns: gW(1, 4, writeUartRxPort(machine))
    });
    r({
      description: "UART Select",
      port: 0x153b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0101_0011_1011,
      readerFns: gR(1, 4, readUartSelectPort(machine)),
      writerFns: gW(1, 4, writeUartSelectPort(machine))
    });
    r({
      description: "UART Frame",
      port: 0x163b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0110_0011_1011,
      readerFns: gR(1, 4, readUartFramePort(machine)),
      writerFns: gW(1, 4, writeUartFramePort(machine))
    });
    r({
      description: "CTC 8 channels",
      port: 0x173b,
      pmask: 0b1111_1000_1111_1111,
      value: 0b0001_1000_0011_1011,
      readerFns: gR(3, 3, readCtcPort(machine)),
      writerFns: gW(3, 3, writeCtcPort(machine))
    });
    r({
      description: "ULA+ Register",
      port: 0xbf3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1011_1111_0011_1011,
      readerFns: () => 0xff,
      writerFns: (_, v) => {
        if (!pe(3, 0)) return;
        machine.composedScreenDevice.ulaPlusMode = (v >> 6) & 0x03;
        if ((v >> 6) === 0x00) {
          // Only update palette index when mode is 00 (palette access)
          machine.composedScreenDevice.ulaPlusPaletteIndex = v & 0x3f;
        }
      }
    });
    r({
      description: "ULA+ Data",
      port: 0xff3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1111_1111_0011_1011,
      readerFns: () => pe(3, 0) ? readUlaPlusDataPort(machine) : 0xff,
      writerFns: (_, v) => { if (pe(3, 0)) writeUlaPlusDataPort(machine, v); }
    });
    r({
      description: "Z80Dma",
      port: 0x0b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1011,
      readerFns: () => pe(3, 1) ? readZ80DmaPort(machine) : 0xff,
      writerFns: (_, v) => { if (pe(3, 1)) writeZ80DmaPort(machine, v); }
    });
    r({
      description: "ZxnDma",
      port: 0x6b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0110_1011,
      readerFns: () => pe(0, 5) ? readZxnDmaPort(machine) : 0xff,
      writerFns: (_, v) => { if (pe(0, 5)) writeZxnDmaPort(machine, v); }
    });
    r({
      description: "AY reg",
      port: 0xfffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1100_0000_0000_0101,
      readerFns: (p) => pe(2, 0) ? readAyRegPort(machine, p) : 0xff,
      writerFns: (_, v) => { if (pe(2, 0)) writeAyRegPort(machine, v); }
    });
    r({
      description: "AY data",
      port: 0xbffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1000_0000_0000_0101,
      readerFns: (p) => pe(2, 0) ? readAyDatPort(machine, p) : 0xff,
      writerFns: (_, v) => { if (pe(2, 0)) writeAyDatPort(machine, v); }
    });
    r({
      description: "AY info",
      port: 0xbff5,
      pmask: 0b1100_0000_0000_1111,
      value: 0b1000_0000_0000_0101,
      readerFns: (p) => pe(2, 0) ? readAyDatPort(machine, p) : 0xff,
      writerFns: (_, v) => { if (pe(2, 0)) writeAyDatPort(machine, v); }
    });
    r({
      description: "DAC A (SD1)",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      writerFns: (_, v) => {
        if (pe(2, 1)) writeDacAPort(machine, v);
      }
    });
    r({
      description: "DAC A (SD2)",
      port: 0xf1,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0001,
      writerFns: (_, v) => {
        if (pe(2, 2)) writeDacAPort(machine, v);
      }
    });
    r({
      description: "DAC A+D (Profi Covox)",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      writerFns: (_, v) => {
        if (pe(2, 3)) writeDacAandDPort(machine, v);
      }
    });
    r({
      description: "DAC B (SD1/Covox)",
      port: 0x0f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1111,
      writerFns: (_, v) => {
        if (pe(2, 1) || pe(2, 4))
          writeDacBPort(machine, v);
      }
    });
    r({
      description: "DAC B (SD2)",
      port: 0xf3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0011,
      writerFns: (_, v) => {
        if (pe(2, 2)) writeDacBPort(machine, v);
      }
    });
    r({
      description: "DAC A+D (SpecDrum)",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      writerFns: (_, v) => {
        if (pe(2, 7)) writeDacAandDPort(machine, v);
      }
    });
    r({
      description: "DAC D/A+D (SD2/Pentagon)",
      port: 0xfb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1011,
      writerFns: (_, v) => {
        if (pe(2, 2)) {
          writeDacDPort(machine, v);
        } else if (pe(2, 5)) {
          writeDacAandDPort(machine, v);
        }
      }
    });
    r({
      description: "DAC B+C (GS Covox)",
      port: 0xb3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_0011,
      writerFns: (_, v) => {
        if (pe(2, 6)) writeDacBandCPort(machine, v);
      }
    });
    r({
      description: "DAC C (SD1/Covox)",
      port: 0x4f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0100_1111,
      writerFns: (_, v) => {
        if (pe(2, 1) || pe(2, 4))
          writeDacCPort(machine, v);
      }
    });
    r({
      description: "DAC C (SD2)",
      port: 0xf9,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1001,
      writerFns: (_, v) => {
        if (pe(2, 2)) writeDacCPort(machine, v);
      }
    });
    r({
      description: "DAC D (SD1/Profi Covox)",
      port: 0x5f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1111,
      writerFns: (_, v) => {
        if (pe(2, 1) || pe(2, 3))
          writeDacDPort(machine, v);
      }
    });
    r({
      description: "SPI CS",
      port: 0xe7,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0111,
      writerFns: (_, v) => {
        if (pe(1, 3)) {
          machine.sdCardDevice.spiCsWrite(v);
        }
      },
    });
    r({
      description: "SPI DATA",
      port: 0xeb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_1011,
      readerFns: () =>
        pe(1, 3) ? machine.sdCardDevice.readMmcData() : 0xff,
      writerFns: (_, v) => {
        if (pe(1, 3)) {
          machine.sdCardDevice.writeMmcData(v);
        }
      }
    });
    r({
      description: "divMMC Control",
      port: 0xe3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0011,
      readerFns: () => pe(1, 0) ? machine.divMmcDevice.port0xe3Value : 0xff,
      writerFns: (_, v) => {
        if (pe(1, 0)) machine.divMmcDevice.port0xe3Value = v;
      }
    });
    r({
      description: "Kempston mouse x",
      port: 0xfbdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1011_1101_1111,
      readerFns: gR(1, 5, readKempstonMouseXPort(machine))
    });
    r({
      description: "Kempston mouse y",
      port: 0xffdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1111_1101_1111,
      readerFns: gR(1, 5, readKempstonMouseYPort(machine))
    });
    r({
      description: "Kempston mouse wheel, buttons",
      port: 0xfadf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1010_1101_1111,
      readerFns: gR(1, 5, readKempstonMouseWheelPort(machine))
    });
    r({
      description: "Multiface port 0x1F",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFns: (p) => readMultifacePort(p, machine),
      writerFns: (p, v) => writeMultifacePort(p, v, machine)
    });
    r({
      description: "Multiface port 0x9F",
      port: 0x9f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1001_1111,
      readerFns: (p) => readMultifacePort(p, machine),
      writerFns: (p, v) => writeMultifacePort(p, v, machine)
    });
    r({
      description: "Multiface port 0x3F",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFns: (p) => readMultifacePort(p, machine),
      writerFns: (p, v) => writeMultifacePort(p, v, machine)
    });
    r({
      description: "Multiface port 0xBF",
      port: 0xbf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_1111,
      readerFns: (p) => readMultifacePort(p, machine),
      writerFns: (p, v) => writeMultifacePort(p, v, machine)
    });
    r({
      description: "Kempston joy 1",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFns: gR(0, 6, readKempstonJoy1Port(machine))
    });
    r({
      description: "Kempston joy 1 alias",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      readerFns: ((fn) =>
        (p: number): number =>
          pe(0, 6) && !pe(1, 5) ? fn(p) : NOT_HANDLED
      )(readKempstonJoy1AliasPort(machine))
    });
    r({
      description: "Kempston joy 2",
      port: 0x37,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_0111,
      readerFns: gR(0, 7, readKempstonJoy2Port(machine))
    });
    r({
      description: "Sprite slot, flags",
      port: 0x303b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0011_0000_0011_1011,
      readerFns: () => pe(1, 6) ? machine.spriteDevice.readPort303bValue() : 0xff,
      writerFns: (_, v) => { if (pe(1, 6)) machine.spriteDevice.writePort303bValue(v); }
    });
    r({
      description: "Sprite attributes",
      port: 0x57,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_0111,
      writerFns: (port, v) => { if (pe(1, 6)) machine.spriteDevice.writeSpriteAttribute(port, v); }
    });
    r({
      description: "Sprite pattern",
      port: 0x5b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1011,
      writerFns: (_, v) => { if (pe(1, 6)) machine.spriteDevice.writeSpritePattern(v); }
    });
  }

  getPortHandler(port: number): PortDescriptor | undefined {
    return this.portMap.get(port);
  }

  getPortCollisions(port: number): string[] {
    return this.portCollisions.get(port) ?? [];
  }

  readPort(port: number): number {
    const descriptor = this.portMap.get(port);
    if (!descriptor?.readerFns) {
      return 0xff;
    }

    if (Array.isArray(descriptor.readerFns)) {
      // --- Multiple reader functions
      let lastValue = 0xff;
      for (const readerFn of descriptor.readerFns) {
        const value = readerFn(port);
        if (!(value & 0x100)) return value; // bit 8 clear = handled
        lastValue = value & 0xff;           // bit 8 set = not handled
      }
      return lastValue;
    }
    // --- Single reader function
    const value = descriptor.readerFns(port);
    return (value & 0x100) ? (value & 0xff) : value;
  }

  writePort(port: number, value: number): void {
    const descriptor = this.portMap.get(port);
    if (!descriptor) return;

    if (Array.isArray(descriptor.writerFns)) {
      // --- Multiple writer functions
      for (const writerFn of descriptor.writerFns) {
        const handled = writerFn(port, value);
        if (handled) return;
      }
    } else if (descriptor.writerFns) {
      // --- Single writer function
      descriptor.writerFns(port, value);
    }
  }

  private registerPort({
    pmask: mask,
    value,
    description,
    readerFns,
    writerFns
  }: PortDescriptor): void {
    this.ports.push({ pmask: mask, value, description, readerFns, writerFns });
    // Analytically enumerate all ports matching (port & mask) === value.
    // Uses submask enumeration: iterates exactly 2^popcount(~mask & 0xffff) times
    // instead of always 65536 times, reducing ~5.2M iterations to ~20K at startup.
    const free = 0xffff & ~mask;
    let sub = free;
    do {
      const i = value | sub;
      const mapping = this.portMap.get(i);
      if (mapping) {
        // Mutate in-place instead of creating a spread copy
        if (readerFns) {
          if (mapping.readerFns) {
            const readerFnsArray = Array.isArray(readerFns) ? readerFns : [readerFns];
            mapping.readerFns = Array.isArray(mapping.readerFns)
              ? [...mapping.readerFns, ...readerFnsArray]
              : [mapping.readerFns, ...readerFnsArray];
          } else {
            mapping.readerFns = readerFns;
          }
        }
        if (writerFns) {
          if (mapping.writerFns) {
            const writerFnsArray = Array.isArray(writerFns) ? writerFns : [writerFns];
            mapping.writerFns = Array.isArray(mapping.writerFns)
              ? [...mapping.writerFns, ...writerFnsArray]
              : [mapping.writerFns, ...writerFnsArray];
          } else {
            mapping.writerFns = writerFns;
          }
        }
        this.portCollisions.set(i, [...this.portCollisions.get(i)!, description]);
      } else {
        this.portMap.set(i, { pmask: mask, value, description, readerFns, writerFns });
        this.portCollisions.set(i, [description]);
      }
      sub = (sub - 1) & free;
    } while (sub !== free);
  }
}

const excluded = [
  { port: 0x0000, mask: 0x0001 },
  { port: 0x243b, mask: 0xffff },
  { port: 0x253b, mask: 0xffff },
  { port: 0x7ffd, mask: 0xffff },
  { port: 0x1ffd, mask: 0xffff },
  { port: 0xdffd, mask: 0xffff },
  { port: 0x00e3, mask: 0x00ff },
  { port: 0x00e7, mask: 0x00ff },
  { port: 0x00eb, mask: 0x00ff },
  { port: 0x001f, mask: 0x00ff },
];
