import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { MachineApi } from "../../src/native/api";
import { ZxSpectrum48 } from "../../src/native/ZxSpectrum48";
import {
  MemoryContentionType,
  ExecuteCycleOptions,
  EmulationMode,
} from "../../src/native/machine-state";
import { MemoryHelper } from "../../src/native/memory-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: MachineApi;
let machine: ZxSpectrum48;

describe("ZX Spectrum 48", () => {
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

  it("Reset", () => {
    machine.reset();
  });

  it("Default ULA issue to 3", () => {
    const s = machine.getMachineState();
    expect(s.ulaIssue).toBe(3);
  });

  it("Set ULA issue to 2", () => {
    machine.setUlaIssue(2);
    const s = machine.getMachineState();
    expect(s.ulaIssue).toBe(2);
  });

  it("Machine configured", () => {
    const s = machine.getMachineState();
    expect(s.baseClockFrequency).toBe(3_500_000);
    expect(s.clockMultiplier).toBe(1);
    expect(s.supportsNextOperations).toBeFalsy();

    expect(s.numberOfRoms).toBe(1);
    expect(s.romContentsAddress).toBe(0x01_1d00);
    expect(s.spectrum48RomIndex).toBe(0);
    expect(s.contentionType).toBe(MemoryContentionType.Ula);
    expect(s.nextMemorySize).toBe(0);

    expect(s.interruptTact).toBe(11);
    expect(s.verticalSyncLines).toBe(8);
    expect(s.nonVisibleBorderTopLines).toBe(8);
    expect(s.borderTopLines).toBe(48);
    expect(s.borderBottomLines).toBe(48);
    expect(s.nonVisibleBorderBottomLines).toBe(8);
    expect(s.displayLines).toBe(192);
    expect(s.borderLeftTime).toBe(24);
    expect(s.borderRightTime).toBe(24);
    expect(s.displayLineTime).toBe(128);
    expect(s.horizontalBlankingTime).toBe(40);
    expect(s.nonVisibleBorderRightTime).toBe(8);
    expect(s.pixelDataPrefetchTime).toBe(2);
    expect(s.attributeDataPrefetchTime).toBe(1);

    expect(s.screenLines).toBe(288);
    expect(s.firstDisplayLine).toBe(64);
    expect(s.borderLeftPixels).toBe(48);
    expect(s.borderRightPixels).toBe(48);
    expect(s.displayWidth).toBe(256);
    expect(s.screenWidth).toBe(352);
    expect(s.screenLineTime).toBe(224);
    expect(s.rasterLines).toBe(312);
    expect(s.tactsInFrame).toBe(69888);
    expect(s.firstDisplayPixelTact).toBe(14360);
    expect(s.firstScreenPixelTact).toBe(3584);

    // --- Test ROM setup
    const mh = new MemoryHelper(api, 0);
    expect(mh.readByte(0x0000)).toBe(0xf3);
    expect(mh.readByte(0x0001)).toBe(0xaf);
    expect(mh.readByte(0x3ffe)).toBe(0x42);
    expect(mh.readByte(0x3fff)).toBe(0x3c);
  });

  it("ExecuteCycle", () => {
    const options: ExecuteCycleOptions = new ExecuteCycleOptions(
      EmulationMode.UntilUlaFrameEnds
    );
    const start = Date.now().valueOf();
    for (let i = 0; i < 1000; i++) {
      machine.executeCycle(options);
    }
    console.log(Date.now().valueOf() - start);
  });

  it("Key status", () => {
    for (let i = 0; i < 40; i++) {
      machine.setKeyStatus(i, true);
      expect(machine.getKeyStatus(i)).toBe(true);
      machine.setKeyStatus(i, false);
      expect(machine.getKeyStatus(i)).toBe(false);
    }
  });
});
