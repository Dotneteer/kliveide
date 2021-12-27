import "mocha";
import * as expect from "expect";
import {
  loadWaModule,
  SilentAudioRenderer,
} from "../helpers";
import { ZxSpectrum48Core } from "@modules/vm-zx-spectrum/ZxSpectrum48Core";
import { SpectrumMachineStateBase } from "@modules/vm-zx-spectrum/ZxSpectrumCoreBase";
import {
  EmulationMode,
  ExecuteCycleOptions,
} from "@abstractions/vm-core-types";
import { MemoryHelper } from "@modules-core/memory-helpers";
import {
  COLORIZATION_BUFFER,
  PIXEL_RENDERING_BUFFER,
} from "@modules/vm-zx-spectrum/wa-memory-map";
import { createTestDependencies } from "./test-dependencies";

let machine: ZxSpectrum48Core;


describe("ZX Spectrum 48 - Screen", () => {
  before(async () => {
    createTestDependencies();
    machine = new ZxSpectrum48Core({
      baseClockFrequency: 3_276_800,
      tactsInFrame: 16384,
      firmware: [new Uint8Array(32768)],
    });
    await machine.setupMachine();
  });

  beforeEach(async () => {
    await machine.setupMachine();
  });

  it("ULA frame tact is OK", () => {
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s.tactsInFrame).toBe(69888);
  });

  it("Flash toggle rate is OK", () => {
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s.flashFrames).toBe(25);
  });

  it("Setting border value does not change invisible area", () => {
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x10,
      0x00, // LD BC,$0010
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0xfb, // EI
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s._pc).toBe(0x800e);
    expect(s.tacts).toBe(451);
    expect(s.frameCompleted).toBe(false);
    const mh = new MemoryHelper(machine.api, PIXEL_RENDERING_BUFFER);
    let sum = 0x00;
    for (let row = 0; row < s.screenHeight; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        sum += mh.readByte(row * s.screenWidth + col);
      }
    }
    expect(sum).toBe(0xff * s.screenHeight * s.screenWidth);
  });

  it("Colorize border + empty pixels", () => {
    machine.api.setupMachine();
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x75,
      0x0a, // LD BC,$0A75
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    machine.api.colorize();
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s._pc).toBe(0x800d);
    expect(s.tacts).toBe(69633);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(machine.api, COLORIZATION_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 48; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readUint32((row * s.screenWidth + col) * 4);
        if (pixel === 0xffaaaa00 - 0x100000000) {
          sum++;
        }
      }
    }
  });
});

/**
 *
 * @param data Pixel buffer data
 */
function fillPixelBuffer(data: number): void {
  const s = machine.getMachineState() as SpectrumMachineStateBase;
  const mh = new MemoryHelper(machine.api, PIXEL_RENDERING_BUFFER);
  const visibleLines =
    s.screenHeight - s.nonVisibleBorderTopLines - s.nonVisibleBorderTopLines;
  const visibleColumns = (s.screenLineTime - s.nonVisibleBorderRightTime) * 2;
  const pixels = visibleLines * visibleColumns;
  for (let i = 0; i < pixels; i++) {
    mh.writeByte(i, data);
  }
}
