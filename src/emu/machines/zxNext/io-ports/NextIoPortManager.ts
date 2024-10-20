import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { readUlaPort } from "./UlaPortHandler";
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
import { writeUlaPlusRegisterPort } from "./UlaPlusRegisterPortHandler";
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
  writeDacCPort
} from "./DacPortHandler";
import { writeSpiCsPort } from "./SpiCsPortHandler";
import { readSpiDataPort, writeSpiDataPort } from "./SpiDataPortHandler";
import {
  readKempstonJoy1AliasPort,
  readKempstonJoy1Port,
  readKempstonJoy2Port,
  readKempstonMouseXPort,
  readKempstonMouseYPort
} from "./KempstonHandler";
import {
  readMultiface128DisablePort,
  readMultiface128EnablePort,
  readMultifaceDisablePort,
  readMultifaceEnablePort,
  readMultifaceP3DisablePort,
  readMultifaceP3EnablePort,
  writeMultiface128DisablePort,
  writeMultiface128EnablePort,
  writeMultifaceDisablePort,
  writeMultifaceEnablePort,
  writeMultifaceP3DisablePort,
  writeMultifaceP3EnablePort
} from "./MultifacePortHandler";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";

type IoPortReaderFn = (port: number) => number | { value: number; handled: boolean };
type IoPortWriterFn = (port: number, value: number) => void | boolean;

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

    r({
      description: "ULA",
      port: 0xfe,
      pmask: 0b0000_0000_0000_0001,
      value: 0b0000_0000_0000_0000,
      readerFns: (p) => readUlaPort(p),
      writerFns: (_, v) => {
        // --- Extract the border color
        machine.screenDevice.borderColor = v & 0x07;

        // // --- Store the last EAR bit
        // var bit4 = value & 0x10;
        // this.beeperDevice.setEarBit(bit4 !== 0);

        // // --- Set the last value of bit3
        // this._portBit3LastValue = (value & 0x08) !== 0;

        // // --- Instruct the tape device process the MIC bit
        // this.tapeDevice.processMicBit(this._portBit3LastValue);

        // // --- Manage bit 4 value
        // if (this._portBit4LastValue) {
        //   // --- Bit 4 was 1, is it now 0?
        //   if (!bit4) {
        //     this._portBit4ChangedFrom1Tacts = this.tacts;
        //     this._portBit4LastValue = false;
        //   }
        // } else {
        //   // --- Bit 4 was 0, is it now 1?
        //   if (bit4) {
        //     this._portBit4ChangedFrom0Tacts = this.tacts;
        //     this._portBit4LastValue = true;
        //   }
        // }
      }
    });
    r({
      description: "Timex video, floating bus",
      port: 0xff,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1111,
      readerFns: () => this._portTimexValue,
      writerFns: (_, v) => {
        this._portTimexValue = v & 0xff;
      }
    });
    r({
      description: "ZX Spectrum 128 memory",
      port: 0x7ffd,
      pmask: 0b1100_0000_0000_0011,
      value: 0b0100_0000_0000_0001,
      writerFns: (_, v) => {
        machine.memoryDevice.port7ffdValue = v;
      }
    });
    r({
      description: "Spectrum Next bank extension",
      port: 0xdffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b1101_0000_0000_0001,
      writerFns: (_, v) => {
        machine.memoryDevice.portDffdValue = v;
      }
    });
    r({
      description: "ZX Spectrum +3 memory",
      port: 0x1ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0001_0000_0000_0001,
      writerFns: (_, v) => {
        machine.memoryDevice.port1ffdValue = v;
      }
    });
    r({
      description: "ZX Spectrum +3 FDC status",
      port: 0x2ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0010_0000_0000_0001,
      readerFns: readSpectrumP3FdcStatusPort
    });
    r({
      description: "ZX Spectrum +3 FDC control",
      port: 0x3ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0011_0000_0000_0001,
      readerFns: readSpectrumP3FdcControlPort,
      writerFns: writeSpectrumP3FdcControlPort
    });
    r({
      description: "Pentagon 1024K memory",
      port: 0xeff7,
      pmask: 0b1111_0000_1111_1111,
      value: 0b1110_0000_1111_0111,
      writerFns: () => {}
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
      readerFns: readI2cSclPort,
      writerFns: writeI2cSclPort
    });
    r({
      description: "i2c SDA",
      port: 0x113b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0001_0011_1011,
      readerFns: readI2cSdaPort,
      writerFns: writeI2cSdaPort
    });
    r({
      description: "Layer 2",
      port: 0x123b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0010_0011_1011,
      readerFns: () => machine.layer2Device.port123bValue,
      writerFns: (_, v) => {
        machine.layer2Device.port123bValue = v;
      }
    });
    r({
      description: "UART Tx",
      port: 0x133b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0011_0011_1011,
      readerFns: readUartTxPort,
      writerFns: writeUartTxPort
    });
    r({
      description: "UART Rx",
      port: 0x143b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0100_0011_1011,
      readerFns: readUartRxPort,
      writerFns: writeUartRxPort
    });
    r({
      description: "UART Select",
      port: 0x153b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0101_0011_1011,
      readerFns: readUartSelectPort,
      writerFns: writeUartSelectPort
    });
    r({
      description: "UART Frame",
      port: 0x163b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0110_0011_1011,
      readerFns: readUartFramePort,
      writerFns: writeUartFramePort
    });
    r({
      description: "CTC 8 channels",
      port: 0x173b,
      pmask: 0b1111_1000_1111_1111,
      value: 0b0001_1000_0011_1011,
      readerFns: readCtcPort,
      writerFns: writeCtcPort
    });
    r({
      description: "ULA+ Register",
      port: 0xbf3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1011_1111_0011_1011,
      writerFns: writeUlaPlusRegisterPort
    });
    r({
      description: "ULA+ Data",
      port: 0xff3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1111_1111_0011_1011,
      readerFns: readUlaPlusDataPort,
      writerFns: writeUlaPlusDataPort
    });
    r({
      description: "Z80Dma",
      port: 0x0b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1011,
      readerFns: readZ80DmaPort,
      writerFns: writeZ80DmaPort
    });
    r({
      description: "ZxnDma",
      port: 0x6b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0110_1011,
      readerFns: readZxnDmaPort,
      writerFns: writeZxnDmaPort
    });
    r({
      description: "AY reg",
      port: 0xfffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1100_0000_0000_0101,
      readerFns: readAyRegPort,
      writerFns: writeAyRegPort
    });
    r({
      description: "AY data",
      port: 0xbffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1000_0000_0000_0101,
      readerFns: readAyDatPort,
      writerFns: writeAyDatPort
    });
    r({
      description: "AY info",
      port: 0xbff5,
      pmask: 0b1100_0000_0000_1111,
      value: 0b1000_0000_0000_0101,
      readerFns: readAyDatPort,
      writerFns: writeAyDatPort
    });
    r({
      description: "DAC A",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b1000_0000_0001_1111,
      writerFns: writeDacAPort
    });
    r({
      description: "DAC A",
      port: 0xf1,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0001,
      writerFns: writeDacAPort
    });
    r({
      description: "DAC A",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      writerFns: writeDacAPort
    });
    r({
      description: "DAC B",
      port: 0x0f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1111,
      writerFns: writeDacBPort
    });
    r({
      description: "DAC B",
      port: 0xf3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0011,
      writerFns: writeDacBPort
    });
    r({
      description: "DAC A,D",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      writerFns: writeDacAandDPort
    });
    r({
      description: "DAC A,D",
      port: 0xfb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1011,
      writerFns: writeDacAandDPort
    });
    r({
      description: "DAC B,C",
      port: 0xb3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_0011,
      writerFns: writeDacBandCPort
    });
    r({
      description: "DAC C",
      port: 0x4f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0100_1111,
      writerFns: writeDacCPort
    });
    r({
      description: "DAC C",
      port: 0xf9,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1001,
      writerFns: writeDacCPort
    });
    r({
      description: "DAC D",
      port: 0x5f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1111,
      writerFns: writeDacCPort
    });
    r({
      description: "SPI CS",
      port: 0xe7,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0111,
      writerFns: writeSpiCsPort
    });
    r({
      description: "SPI DATA",
      port: 0xeb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_1011,
      readerFns: readSpiDataPort,
      writerFns: writeSpiDataPort
    });
    r({
      description: "divMMC Control",
      port: 0xe3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0011,
      readerFns: () => machine.divMmcDevice.port0xe3Value,
      writerFns: (_, v) => {
        machine.divMmcDevice.port0xe3Value = v;
      }
    });
    r({
      description: "Kempston mouse x",
      port: 0xfbdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1011_1101_1111,
      readerFns: readKempstonMouseXPort
    });
    r({
      description: "Kempston mouse y",
      port: 0xffdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1111_1101_1111,
      readerFns: readKempstonMouseYPort
    });
    r({
      description: "Kempston mouse wheel, buttons",
      port: 0xfadf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1010_1101_1111,
      readerFns: readKempstonMouseYPort
    });
    r({
      description: "Kempston joy 1",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFns: readKempstonJoy1Port
    });
    r({
      description: "Kempston joy 1 alias",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      readerFns: readKempstonJoy1AliasPort
    });
    r({
      description: "Kempston joy 2",
      port: 0x37,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_0111,
      readerFns: readKempstonJoy2Port
    });
    r({
      description: "Multiface 1, 128 v87.12 disable",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFns: readMultifaceDisablePort,
      writerFns: writeMultifaceDisablePort
    });
    r({
      description: "Multiface 1, 128 v87.12 enable",
      port: 0x9f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1001_1111,
      readerFns: readMultifaceEnablePort,
      writerFns: writeMultifaceEnablePort
    });
    r({
      description: "Multiface 128 v87.2 disable",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFns: readMultiface128DisablePort,
      writerFns: writeMultiface128DisablePort
    });
    r({
      description: "Multiface 128 v87.2 disable",
      port: 0xbf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFns: readMultiface128EnablePort,
      writerFns: writeMultiface128EnablePort
    });
    r({
      description: "Multiface +3 disable",
      port: 0xbf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_1111,
      readerFns: readMultifaceP3DisablePort,
      writerFns: writeMultifaceP3DisablePort
    });
    r({
      description: "Multiface +3 enable",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFns: readMultifaceP3EnablePort,
      writerFns: writeMultifaceP3EnablePort
    });
    r({
      description: "Sprite slot, flags",
      port: 0x303b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0011_0000_0011_1011,
      readerFns: () => machine.spriteDevice.readPort303bValue(),
      writerFns: (_, v) => machine.spriteDevice.writePort303bValue(v)
    });
    r({
      description: "Sprite attributes",
      port: 0x57,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_0111,
      writerFns: (_, v) => machine.spriteDevice.writeSpriteAttribute(v)
    });
    r({
      description: "Sprite pattern",
      port: 0x5b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1011,
      writerFns: (_, v) => machine.spriteDevice.writeSpritePattern(v)
    });
  }

  getPortHandler(port: number): PortDescriptor | undefined {
    return this.portMap.get(port);
  }

  getPortCollisions(port: number): string[] {
    return this.portCollisions.get(port) ?? [];
  }

  readPort(port: number): number {
    let useLogger = false;
    if (!excluded.some((e) => (port & e.mask) === e.port)) {
      console.log(
        `R ${toHexa4(port)}: (${toHexa4(this.machine.pc)}, ${this.machine.memoryDevice.selectedRomLsb + this.machine.memoryDevice.selectedRomMsb})`
      );
      useLogger = true;
    }
    const descriptor = this.portMap.get(port);
    if (!descriptor?.readerFns) {
      return 0xff;
    }

    if (useLogger) {
      console.log(`  ${descriptor.description}`);
    }

    if (Array.isArray(descriptor.readerFns)) {
      // --- Multiple reader functions
      let lastValue = 0xff;
      for (const readerFn of descriptor.readerFns) {
        const value = readerFn(port);
        if (typeof value === "number") return value;
        lastValue = value.value ?? 0xff;
        if (value.handled) return lastValue;
      }
      return lastValue;
    }
    // --- Single reader function
    const value = descriptor.readerFns(port);
    if (typeof value === "number") return value;
    return value.value ?? 0xff;
  }

  writePort(port: number, value: number): void {
    if (!excluded.some((e) => (port & e.mask) === e.port)) {
      console.log(
        `W ${toHexa4(port)}: ${toHexa2(value)} (${toHexa4(this.machine.pc)}, ${this.machine.memoryDevice.selectedRomLsb + this.machine.memoryDevice.selectedRomMsb})`
      );
    }
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
    for (let i = 0; i < 0x1_0000; i++) {
      if ((i & mask) === value) {
        let mapping = this.portMap.get(i);
        if (mapping) {
          mapping = { ...mapping };
          if (mapping.readerFns) {
            const readerFnsArray = Array.isArray(readerFns) ? readerFns : [readerFns];
            mapping.readerFns = Array.isArray(mapping.readerFns)
              ? [...mapping.readerFns, ...readerFnsArray]
              : [mapping.readerFns, ...readerFnsArray];
          } else {
            mapping.readerFns = readerFns;
          }
          if (mapping.writerFns) {
            const writerFnsArray = Array.isArray(writerFns) ? writerFns : [writerFns];
            mapping.writerFns = Array.isArray(mapping.writerFns)
              ? [...mapping.writerFns, ...writerFnsArray]
              : [mapping.writerFns, ...writerFnsArray];
          } else {
            mapping.writerFns = writerFns;
          }
          this.portMap.set(i, mapping);
          this.portCollisions.set(i, [...this.portCollisions.get(i)!, description]);
        } else {
          this.portMap.set(i, { pmask: mask, value, description, readerFns, writerFns });
          this.portCollisions.set(i, [description]);
        }
      }
    }
  }
}

const excluded = [
  { port: 0x0000, mask: 0x0001 },
  { port: 0x243b, mask: 0xffff },
  { port: 0x253b, mask: 0xffff },
  { port: 0x7ffd, mask: 0xffff },
  { port: 0x1ffd, mask: 0xffff },
  { port: 0xdffd, mask: 0xffff },
  { port: 0x00e3, mask: 0x00ff }
];
