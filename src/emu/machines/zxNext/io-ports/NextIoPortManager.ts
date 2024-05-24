import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { readFloatingBusPort, writeFloatingBusPort } from "./FloatingBusHandler";
import { writeSpectrum128MemoryPort } from "./Spectrum128MemoryPortHandler";
import { readUlaPort, writeUlaPort } from "./UlaPortHandler";
import { writeNextBankExtensionPort } from "./NextBankExtensionPortHandler";
import { writeSpectrumP3MemoryPort } from "./SpectrumP3MemoryPortHandler";
import { readSpectrumP3FdcStatusPort } from "./SpectrumP3FdcStatusPortHandler";
import {
  readSpectrumP3FdcControlPort,
  writeSpectrumP3FdcControlPort
} from "./SpectrumP3FdcControlPortHandler";
import { writePentagon1024MemoryPort } from "./PentagonMemoryPortHandler";
import { readNextRegSelectPort, writeNextRegSelectPort } from "./NextRegSelectPort";
import { readNextRegDataPort, writeNextRegDataPort } from "./NextRegDataPort";
import { readI2cSclPort, writeI2cSclPort } from "./I2cSclPortHandler";
import { readI2cSdaPort, writeI2cSdaPort } from "./I2cSdaPortHandler";
import { readLayer2Port, writeLayer2Port } from "./Layer2PortHandler";
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
import { readDivMmcControlPort, writeDivMmmcControlPort } from "./DivMmmcControlPortHandler";
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
import {
  readSpriteAttributePort,
  readSpritePatternPort,
  readSpriteSlotPort,
  writeSpriteAttributePort,
  writeSpritePatternPort,
  writeSpriteSlotPort
} from "./SpritePortHandler";

type IoPortReaderFn = (machine: IZxNextMachine, port: number) => number;
type IoPortWriterFn = (machine: IZxNextMachine, port: number, value: number) => void;

type PortDescriptor = {
  pmask: number;
  value: number;
  port?: number;
  description: string;
  readerFn?: IoPortReaderFn;
  writerFn?: IoPortWriterFn;
};

export class NextIoPortManager {
  private readonly ports: PortDescriptor[] = [];
  private readonly portMap: Map<number, PortDescriptor> = new Map();

  constructor() {
    const r = (val: PortDescriptor) => this.registerPort(val);
    r({
      description: "ULA",
      port: 0xfe,
      pmask: 0b0000_0000_0000_0001,
      value: 0b0000_0000_0000_0000,
      readerFn: readUlaPort,
      writerFn: writeUlaPort
    });
    r({
      description: "Timex video, floating bus",
      port: 0xff,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1111,
      readerFn: readFloatingBusPort,
      writerFn: writeFloatingBusPort
    });
    r({
      description: "ZX Spectrum 128 memory",
      port: 0x7ffd,
      pmask: 0b1100_0000_0000_0011,
      value: 0b0100_0000_0000_0001,
      writerFn: writeSpectrum128MemoryPort
    });
    r({
      description: "Spectrum Next bank extension",
      port: 0xdffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b1101_0000_0000_0001,
      writerFn: writeNextBankExtensionPort
    });
    r({
      description: "ZX Spectrum +3 memory",
      port: 0x1ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0001_0000_0000_0001,
      writerFn: writeSpectrumP3MemoryPort
    });
    r({
      description: "ZX Spectrum +3 FDC status",
      port: 0x2ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0010_0000_0000_0001,
      readerFn: readSpectrumP3FdcStatusPort
    });
    r({
      description: "ZX Spectrum +3 FDC control",
      port: 0x3ffd,
      pmask: 0b1111_0000_0000_0011,
      value: 0b0011_0000_0000_0001,
      readerFn: readSpectrumP3FdcControlPort,
      writerFn: writeSpectrumP3FdcControlPort
    });
    r({
      description: "Pentagon 1024K memory",
      port: 0xeff7,
      pmask: 0b1111_0000_1111_1111,
      value: 0b1110_0000_1111_0111,
      writerFn: writePentagon1024MemoryPort
    });
    r({
      description: "NextREG Register Select",
      port: 0x243b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0010_0100_0011_1011,
      readerFn: readNextRegSelectPort,
      writerFn: writeNextRegSelectPort
    });
    r({
      description: "NextREG Data",
      port: 0x253b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0010_0101_0011_1011,
      readerFn: readNextRegDataPort,
      writerFn: writeNextRegDataPort
    });
    r({
      description: "i2c SCL",
      port: 0x103b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0000_0011_1011,
      readerFn: readI2cSclPort,
      writerFn: writeI2cSclPort
    });
    r({
      description: "i2c SDA",
      port: 0x113b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0001_0011_1011,
      readerFn: readI2cSdaPort,
      writerFn: writeI2cSdaPort
    });
    r({
      description: "Layer 2",
      port: 0x123b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0010_0011_1011,
      readerFn: readLayer2Port,
      writerFn: writeLayer2Port
    });
    r({
      description: "UART Tx",
      port: 0x133b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0011_0011_1011,
      readerFn: readUartTxPort,
      writerFn: writeUartTxPort
    });
    r({
      description: "UART Rx",
      port: 0x143b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0100_0011_1011,
      readerFn: readUartRxPort,
      writerFn: writeUartRxPort
    });
    r({
      description: "UART Select",
      port: 0x153b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0101_0011_1011,
      readerFn: readUartSelectPort,
      writerFn: writeUartSelectPort
    });
    r({
      description: "UART Frame",
      port: 0x163b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0001_0110_0011_1011,
      readerFn: readUartFramePort,
      writerFn: writeUartFramePort
    });
    r({
      description: "CTC 8 channels",
      port: 0x173b,
      pmask: 0b1111_1000_1111_1111,
      value: 0b0001_1000_0011_1011,
      readerFn: readCtcPort,
      writerFn: writeCtcPort
    });
    r({
      description: "ULA+ Register",
      port: 0xbf3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1011_1111_0011_1011,
      writerFn: writeUlaPlusRegisterPort
    });
    r({
      description: "ULA+ Data",
      port: 0xff3b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b1111_1111_0011_1011,
      readerFn: readUlaPlusDataPort,
      writerFn: writeUlaPlusDataPort
    });
    r({
      description: "Z80Dma",
      port: 0x0b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1011,
      readerFn: readZ80DmaPort,
      writerFn: writeZ80DmaPort
    });
    r({
      description: "ZxnDma",
      port: 0x6b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0110_1011,
      readerFn: readZxnDmaPort,
      writerFn: writeZxnDmaPort
    });
    r({
      description: "AY reg",
      port: 0xfffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1100_0000_0000_0101,
      readerFn: readAyRegPort,
      writerFn: writeAyRegPort
    });
    r({
      description: "AY data",
      port: 0xbffd,
      pmask: 0b1100_0000_0000_0111,
      value: 0b1000_0000_0000_0101,
      readerFn: readAyDatPort,
      writerFn: writeAyDatPort
    });
    r({
      description: "AY info",
      port: 0xbff5,
      pmask: 0b1100_0000_0000_1111,
      value: 0b1000_0000_0000_0101,
      readerFn: readAyDatPort,
      writerFn: writeAyDatPort
    });
    r({
      description: "DAC A",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b1000_0000_0001_1111,
      writerFn: writeDacAPort
    });
    r({
      description: "DAC A",
      port: 0xf1,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0001,
      writerFn: writeDacAPort
    });
    r({
      description: "DAC A",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      writerFn: writeDacAPort
    });
    r({
      description: "DAC B",
      port: 0x0f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0000_1111,
      writerFn: writeDacBPort
    });
    r({
      description: "DAC B",
      port: 0xf3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_0011,
      writerFn: writeDacBPort
    });
    r({
      description: "DAC A,D",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      writerFn: writeDacAandDPort
    });
    r({
      description: "DAC A,D",
      port: 0xfb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1011,
      writerFn: writeDacAandDPort
    });
    r({
      description: "DAC B,C",
      port: 0xb3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_0011,
      writerFn: writeDacBandCPort
    });
    r({
      description: "DAC C",
      port: 0x4f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0100_1111,
      writerFn: writeDacCPort
    });
    r({
      description: "DAC C",
      port: 0xf9,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1111_1001,
      writerFn: writeDacCPort
    });
    r({
      description: "DAC D",
      port: 0x5f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1111,
      writerFn: writeDacCPort
    });
    r({
      description: "SPI CS",
      port: 0xe7,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0111,
      writerFn: writeSpiCsPort
    });
    r({
      description: "SPI DATA",
      port: 0xeb,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_1011,
      readerFn: readSpiDataPort,
      writerFn: writeSpiDataPort
    });
    r({
      description: "divMMC Control",
      port: 0xe3,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1110_0011,
      readerFn: readDivMmcControlPort,
      writerFn: writeDivMmmcControlPort
    });
    r({
      description: "Kempston mouse x",
      port: 0xfbdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1011_1101_1111,
      readerFn: readKempstonMouseXPort
    });
    r({
      description: "Kempston mouse y",
      port: 0xffdf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1111_1101_1111,
      readerFn: readKempstonMouseYPort
    });
    r({
      description: "Kempston mouse wheel, buttons",
      port: 0xfadf,
      pmask: 0b0000_1111_1111_1111,
      value: 0b0000_1010_1101_1111,
      readerFn: readKempstonMouseYPort
    });
    r({
      description: "Kempston joy 1",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFn: readKempstonJoy1Port
    });
    r({
      description: "Kempston joy 1 alias",
      port: 0xdf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1101_1111,
      readerFn: readKempstonJoy1AliasPort
    });
    r({
      description: "Kempston joy 2",
      port: 0x37,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_0111,
      readerFn: readKempstonJoy2Port
    });
    r({
      description: "Multiface 1, 128 v87.12 disable",
      port: 0x1f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0001_1111,
      readerFn: readMultifaceDisablePort,
      writerFn: writeMultifaceDisablePort
    });
    r({
      description: "Multiface 1, 128 v87.12 enable",
      port: 0x9f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1001_1111,
      readerFn: readMultifaceEnablePort,
      writerFn: writeMultifaceEnablePort
    });
    r({
      description: "Multiface 128 v87.2 disable",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFn: readMultiface128DisablePort,
      writerFn: writeMultiface128DisablePort
    });
    r({
      description: "Multiface 128 v87.2 disable",
      port: 0xbf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFn: readMultiface128EnablePort,
      writerFn: writeMultiface128EnablePort
    });
    r({
      description: "Multiface +3 disable",
      port: 0xbf,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_1011_1111,
      readerFn: readMultifaceP3DisablePort,
      writerFn: writeMultifaceP3DisablePort
    });
    r({
      description: "Multiface +3 enable",
      port: 0x3f,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0011_1111,
      readerFn: readMultifaceP3EnablePort,
      writerFn: writeMultifaceP3EnablePort
    });
    r({
      description: "Sprite slot, flags",
      port: 0x303b,
      pmask: 0b1111_1111_1111_1111,
      value: 0b0011_0000_0011_1011,
      readerFn: readSpriteSlotPort,
      writerFn: writeSpriteSlotPort
    });
    r({
      description: "Sprite attributes",
      port: 0x57,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_0111,
      readerFn: readSpriteAttributePort,
      writerFn: writeSpriteAttributePort
    });
    r({
      description: "Sprite pattern",
      port: 0x5b,
      pmask: 0b0000_0000_1111_1111,
      value: 0b0000_0000_0101_1011,
      readerFn: readSpritePatternPort,
      writerFn: writeSpritePatternPort
    });
  }

  /**
   * Gets the reader function for the specified port
   * @param port Port number
   * @returns Reader function, if any
   */
  getPortReaderFn(port: number): IoPortReaderFn | undefined {
    return this.portMap.get(port)?.readerFn;
  }

  /**
   * Gets the writer function for the specified port
   * @param port Port number
   * @returns Writer function, if any
   */
  getPortWriterFn(port: number): IoPortWriterFn | undefined {
    return this.portMap.get(port)?.writerFn;
  }

  private registerPort({
    pmask: mask,
    value,
    description,
    readerFn,
    writerFn
  }: PortDescriptor): void {
    this.ports.push({ pmask: mask, value, description, readerFn, writerFn });
    for (let i = 0; i < 0x1_0000; i++) {
      if ((i & mask) === value) {
        this.portMap.set(i, { pmask: mask, value, description, readerFn, writerFn });
      }
    }
  }
}
