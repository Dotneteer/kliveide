import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { MachineApi } from "../../src/native/api";
import { ZxSpectrum48 } from "../../src/native/ZxSpectrum48";
import {
  ExecuteCycleOptions,
  EmulationMode,
} from "../../src/native/machine-state";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: MachineApi;
let machine: ZxSpectrum48;

describe("ZX Spectrum 48 - Ports", () => {
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

  it("ULA 2 with low timing", () => {
    machine.setUlaIssue(2);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.a).toBe(0xff);
  });

  it("ULA 2 with high timing", () => {
    machine.setUlaIssue(2);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.a).toBe(0xff);
  });

  it("ULA 3 with low timing", () => {
    machine.setUlaIssue(3);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.a).toBe(0xff);
  });

  it("ULA 3 with high timing", () => {
    machine.setUlaIssue(3);
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

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.a).toBe(0xbf);
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
      machine.setUlaIssue(c.u);
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

      machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
      const s = machine.getMachineState();
      expect(s.a).toBe(c.exp);
 
    });
  });
});
