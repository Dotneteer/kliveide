import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { MachineApi } from "../../src/native/api";
import { ZxSpectrum48 } from "../../src/native/ZxSpectrum48";
import {
  ExecuteCycleOptions,
  EmulationMode,
} from "../../src/native/machine-state";
import { MemoryHelper } from "../../src/native/memory-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: MachineApi;
let machine: ZxSpectrum48;

const BEEPER_SAMPLE_BUFFER = 0x0b_2200;

describe("ZX Spectrum 48 - Beeper", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
      imports: { trace: (arg: number) => console.log(arg) },
    });
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new ZxSpectrum48(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("setBeeperSampleRate #1", () => {
    machine.setBeeperSampleRate(44_100);
    const s = machine.getMachineState();

    expect(s.beeperSampleRate).toBe(44_100);
    expect(s.beeperSampleLength).toBe(79);
    expect(s.beeperLowerGate).toBe(36508);
    expect(s.beeperUpperGate).toBe(100000);
  });

  it("setBeeperSampleRate #2", () => {
    machine.setBeeperSampleRate(25_000);
    const s = machine.getMachineState();

    expect(s.beeperSampleRate).toBe(25_000);
    expect(s.beeperSampleLength).toBe(140);
    expect(s.beeperLowerGate).toBe(0);
    expect(s.beeperUpperGate).toBe(100000);
  });

  it("Beeper sample #1", () => {
    machine.setBeeperSampleRate(10000);
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
    expect(s.beeperSampleLength).toBe(350);
    expect(s.beeperSampleCount).toBe(34);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "1111100000111110000011111000001111";
    let samples = "";
    for (let i = 0; i < s.beeperSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper sample #2", () => {
    machine.setBeeperSampleRate(13000);
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
    expect(s.beeperSampleLength).toBe(269);
    expect(s.beeperSampleCount).toBe(45);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "111111100000011111100000001111110000001111111";
    let samples = "";
    for (let i = 0; i < s.beeperSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper with frame end", () => {
    machine.setBeeperSampleRate(18700);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilUlaFrameEnds));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x8020);
    expect(s.tacts).toBe(6);
    expect(s.frameCount).toBe(1);
    expect(s.frameCompleted).toBe(true);
    expect(s.beeperSampleLength).toBe(187);
    expect(s.beeperSampleCount).toBe(374);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "11111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    let samples = "";
    for (let i = 0; i < s.beeperSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    expect(samples).toBe(expected);
  });

  it("Beeper with multiple frames", () => {
    machine.setBeeperSampleRate(18700);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilUlaFrameEnds));
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilUlaFrameEnds));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800b);
    expect(s.tacts).toBe(8);
    expect(s.frameCount).toBe(2);
    expect(s.frameCompleted).toBe(true);
    expect(s.beeperSampleLength).toBe(187);
    expect(s.beeperSampleCount).toBe(373);
    const mh = new MemoryHelper(api, BEEPER_SAMPLE_BUFFER);
    const expected = "0000000111111111000000000111111111000000000111111111000000000111111111000000000111111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000011111111100000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111111110000000001111";
    let samples = "";
    for (let i = 0; i < s.beeperSampleCount; i++) {
      samples += mh.readByte(i) === 1 ? "1" : "0";
    }
    //console.log(samples);
    expect(samples).toBe(expected);
  });


  it("Test sampling", () => {
    // --- Base data
    const sampleRate = 25000;
    const baseClockFrequency = 3_500_000;
    const clockMultiplier = 1;
    const tactsInFrame = 69_888;

    const sampleLength = (baseClockFrequency * clockMultiplier) / sampleRate;

    console.log(sampleLength);

    const lowerGap = Math.floor(sampleLength);
    const lowerGate = Math.floor((sampleLength - lowerGap) * 100_000);
    const upperGate = 100_000;

    console.log(lowerGate);
    console.log(upperGate);

    let gateValue = (lowerGate + upperGate) / 2;
    let sampleTact = 0;
    for (let i = 0; i < 101; i++) {
      console.log(sampleTact);

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
