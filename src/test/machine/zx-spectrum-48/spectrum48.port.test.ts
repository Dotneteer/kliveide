import "mocha";
import * as expect from "expect";
import { DefaultZxSpectrumStateManager, loadWaModule, SilentAudioRenderer } from "../helpers";
import { setEngineDependencies } from "@modules-core/vm-engine-dependencies";
import { ZxSpectrum48Core } from "@modules/vm-zx-spectrum/ZxSpectrum48Core";
import {
  EmulationMode,
  ExecuteCycleOptions,
} from "@abstractions/vm-core-types";

let machine: ZxSpectrum48Core;

// --- Set up the virual machine engine service with the 
setEngineDependencies({
  waModuleLoader: (n) => loadWaModule(n),
  sampleRateGetter: () => 48000,
  audioRendererFactory: () => new SilentAudioRenderer(),
  spectrumStateManager: new DefaultZxSpectrumStateManager(),
})

describe("ZX Spectrum 48 - Ports", () => {
  before(async () => {
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

  it("ULA 2 with low timing", () => {
    machine.api.setUlaIssue(2);
    machine.injectCode([
      0x3e,
      0x18, // LD A,$18
      0xf6,
      0xf8, // OR A,$f8
      0xd3,
      0xfe, // OUT ($FE),A
      0x3e,
      0x08, // LD A,$08
      0xf6,
      0xe8, // OR A,$E8
      0xd3,
      0xfe, // OUT ($FE),A
      0x06,
      0x01, // LD B,2
      0xdd,
      0x21,
      0x00,
      0x00, // LD IX,0
      0x10,
      0xfa, // DJNZ $-4
      0xdb,
      0xfe, // IN A,($FE)
      0x76, // HALT
    ]);

    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s._af >> 8).toBe(0xff);
  });

  it("ULA 2 with high timing", () => {
    machine.api.setUlaIssue(2);
    machine.injectCode([
      0x3e,
      0x18, // LD A,$18
      0xf6,
      0xf8, // OR A,$F8
      0xd3,
      0xfe, // OUT ($FE),A
      0x3e,
      0x08, // LD A,$08
      0xf6,
      0xe8, // OR A,$E8
      0xd3,
      0xfe, // OUT ($FE),A
      0x06,
      0x08, // LD B,8
      0xdd,
      0x21,
      0x00,
      0x00, // LD IX,0
      0x10,
      0xfa, // DJNZ $-4
      0xdb,
      0xfe, // IN A,($FE)
      0x76, // HALT
    ]);

    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s._af >> 8).toBe(0xff);
  });

  it("ULA 3 with low timing", () => {
    machine.api.setUlaIssue(3);
    machine.injectCode([
      0x3e,
      0x18, // LD A,$18
      0xf6,
      0xf8, // OR A,$F8
      0xd3,
      0xfe, // OUT ($FE),A
      0x3e,
      0x08, // LD A,$08
      0xf6,
      0xe8, // OR A,$E8
      0xd3,
      0xfe, // OUT ($FE),A
      0x06,
      0x02, // LD B,4
      0xdd,
      0x21,
      0x00,
      0x00, // LD IX,0
      0x10,
      0xfa, // DJNZ $-4
      0xdb,
      0xfe, // IN A,($FE)
      0x76, // HALT
    ]);

    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s._af>> 8).toBe(0xff);
  });

  it("ULA 3 with high timing", () => {
    machine.api.setUlaIssue(3);
    machine.injectCode([
      0x3e,
      0x18, // LD A,$18
      0xf6,
      0xf8, // OR A,$F8
      0xd3,
      0xfe, // OUT ($FE),A
      0x3e,
      0x08, // LD A,$08
      0xf6,
      0xe8, // OR A,$E8
      0xd3,
      0xfe, // OUT ($FE),A
      0x06,
      0x08, // LD B,8
      0xdd,
      0x21,
      0x00,
      0x00, // LD IX,0
      0x10,
      0xfa, // DJNZ $-4
      0xdb,
      0xfe, // IN A,($FE)
      0x76, // HALT
    ]);

    machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s._af >> 8).toBe(0xbf);
  });

  const bit6Cases = [
    { v: 0xf8, u: 2, exp: 0xff },
    { v: 0xf8, u: 3, exp: 0xff },
    { v: 0xf0, u: 2, exp: 0xff },
    { v: 0xf0, u: 3, exp: 0xff },
    { v: 0xe8, u: 2, exp: 0xff },
    { v: 0xe8, u: 3, exp: 0xbf },
    { v: 0xe0, u: 2, exp: 0xbf },
    { v: 0xe0, u: 3, exp: 0xbf },
  ];
  bit6Cases.forEach((c, index) => {
    it(`bit6 value ${index + 1}`, () => {
      machine.api.setUlaIssue(c.u);
      machine.injectCode([
        0x3e,
        c.v, // LD A,$18
        0xd3,
        0xfe, // OUT ($FE),A
        0x06,
        0x06, // LD B,8
        0xdd,
        0x21,
        0x00,
        0x00, // LD IX,0
        0x10,
        0xfa, // DJNZ $-4
        0xdb,
        0xfe, // IN A,($FE)
        0x76, // HALT
      ]);

      machine.executeFrame(new ExecuteCycleOptions(EmulationMode.UntilHalt));
      const s = machine.getMachineState();
      expect(s._af >> 8).toBe(c.exp);
    });
  });
});
