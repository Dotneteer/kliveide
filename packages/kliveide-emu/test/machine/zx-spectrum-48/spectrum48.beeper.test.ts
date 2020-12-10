import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/renderer/machines/wa-api";
import { ZxSpectrum48 } from "../../../src/renderer/machines/ZxSpectrum48";
import {
  ExecuteCycleOptions,
  EmulationMode,
  SpectrumMachineStateBase,
} from "../../../src/renderer/machines/machine-state";
import { MemoryHelper } from "../../../src/renderer/machines/memory-helpers";
import { importObject } from "../../import-object";
import { BEEPER_SAMPLE_BUFFER } from "../../../src/renderer/machines/memory-map";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../../build/sp48.wasm")
);
const romBuffer = fs.readFileSync(
  path.join(__dirname, "../../../roms/sp48/sp48.rom")
);

let api: MachineApi;
let machine: ZxSpectrum48;

describe("ZX Spectrum 48 - Beeper", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new ZxSpectrum48(api, [romBuffer]);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("setAudioSampleRate #1", () => {
    machine.setAudioSampleRate(44_100);
    const s = machine.getMachineState() as SpectrumMachineStateBase;

    expect(s.audioSampleRate).toBe(44_100);
    expect(s.audioSampleLength).toBe(79);
    expect(s.audioLowerGate).toBe(36508);
    expect(s.audioUpperGate).toBe(100000);
  });

  it("setAudioSampleRate #2", () => {
    machine.setAudioSampleRate(25_000);
    const s = machine.getMachineState() as SpectrumMachineStateBase;

    expect(s.audioSampleRate).toBe(25_000);
    expect(s.audioSampleLength).toBe(140);
    expect(s.audioLowerGate).toBe(0);
    expect(s.audioUpperGate).toBe(100000);
  });

  it("Beeper sample #1", () => {
    machine.setAudioSampleRate(10000);
    machine.injectCode([
      0xf3, // DI
      0x16,
      0x04, // LD D,$4
      0x3e,
      0x10, // LD A,$10
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x3e,
      0x00, // LD A,$00
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x15, // DEC D
      0xc2,
      0x03,
      0x80, // JP NZ,$8003
      0xfb, // EI
      0x76, // HALT
    ]);

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x8020);
    expect(s.tacts).toBe(13571);
    expect(s.frameCompleted).toBe(false);
    expect(s.audioSampleLength).toBe(350);
    expect(s.audioSampleCount).toBe(39);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "011110000011111000001111100000111100000";
    let samples = "";
    for (let i = 0; i < s.audioSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper sample #2", () => {
    machine.setAudioSampleRate(13000);
    machine.injectCode([
      0xf3, // DI
      0x16,
      0x04, // LD D,$4
      0x3e,
      0x10, // LD A,$10
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x3e,
      0x00, // LD A,$00
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x15, // DEC D
      0xc2,
      0x03,
      0x80, // JP NZ,$8003
      0xfb, // EI
      0x76, // HALT
    ]);

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x8020);
    expect(s.tacts).toBe(13571);
    expect(s.frameCompleted).toBe(false);
    expect(s.audioSampleLength).toBe(269);
    expect(s.audioSampleCount).toBe(51);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "011111100000011111100000001111110000001111111000000";
    let samples = "";
    for (let i = 0; i < s.audioSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper with frame end", () => {
    machine.setAudioSampleRate(18700);
    machine.injectCode([
      0xf3, // DI
      0x16,
      0x10, // LD D,$10
      0x3e,
      0x10, // LD A,$10
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x3e,
      0x00, // LD A,$00
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x15, // DEC D
      0xc2,
      0x03,
      0x80, // JP NZ,$8003
      0xfb, // EI
      0x76, // HALT
    ]);

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilFrameEnds));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x8020);
    expect(s.tacts).toBe(10);
    expect(s.frameCount).toBe(1);
    expect(s.frameCompleted).toBe(true);
    expect(s.audioSampleLength).toBe(187);
    expect(s.audioSampleCount).toBe(374);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected =
      "01111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    let samples = "";
    for (let i = 0; i < s.audioSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper with multiple frames", () => {
    machine.setAudioSampleRate(18700);
    machine.injectCode([
      0xf3, // DI
      0x16,
      0x40, // LD D,$40
      0x3e,
      0x10, // LD A,$10
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x3e,
      0x00, // LD A,$00
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x40,
      0x00, // LD BC,$0040
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x15, // DEC D
      0xc2,
      0x03,
      0x80, // JP NZ,$8003
      0xfb, // EI
      0x76, // HALT
    ]);

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilFrameEnds));
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilFrameEnds));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800b);
    expect(s.tacts).toBe(8);
    expect(s.frameCount).toBe(2);
    expect(s.frameCompleted).toBe(true);
    expect(s.audioSampleLength).toBe(187);
    expect(s.audioSampleCount).toBe(373);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected =
      "0000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111";
    let samples = "";
    for (let i = 0; i < s.audioSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Test sampling", () => {
    // --- Base data
    const sampleRate = 25000;
    const baseClockFrequency = 3_500_000;
    const clockMultiplier = 1;
    const tactsInFrame = 69_888;

    const sampleLength = (baseClockFrequency * clockMultiplier) / sampleRate;

    const lowerGap = Math.floor(sampleLength);
    const lowerGate = Math.floor((sampleLength - lowerGap) * 100_000);
    const upperGate = 100_000;

    let gateValue = (lowerGate + upperGate) / 2;
    let sampleTact = 0;
    for (let i = 0; i < 101; i++) {
      gateValue += lowerGate;
      sampleTact += lowerGap;
      if (gateValue >= upperGate) {
        sampleTact += 1;
        gateValue -= upperGate;
      }

      if (sampleTact >= tactsInFrame) {
        sampleTact -= tactsInFrame;
      }
    }
  });
});
