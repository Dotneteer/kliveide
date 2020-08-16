import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../src/native/api/api";
import { ZxSpectrum48 } from "../../src/native/api/ZxSpectrum48";
import { MemoryHelper } from "../../src/native/api/memory-helpers";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../build/spectrum.wasm")
);
let api: MachineApi;
let machine: ZxSpectrum48;

const BREAKPOINT_MAP = 0x1f_4300;

describe("ZX Spectrum - Breakpoints", () => {
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

  it("eraseBreakpoints works", () => {
    api.eraseBreakpoints();

    for (let i = 0; i < 1000; i++) {
      api.setBreakpoint(i * 4);
    }

    api.eraseBreakpoints();

    const mh = new MemoryHelper(api, BREAKPOINT_MAP);
    const brMap = mh.readBytes(0, 0x2000);
    let sum = 0;
    for (let i = 0; i < brMap.length; i++) {
      sum += brMap[i];
    }

    expect(sum).toBe(0);
  });

  it("setBreakpoints works", () => {
    api.eraseBreakpoints();

    for (let i = 0; i < 100; i++) {
      api.setBreakpoint(i * 4);
    }

    let count = 0;
    for (let i = 0; i < 1000; i++) {
      if (api.testBreakpoint(i)) count++;
    }
    expect(count).toBe(100);
  });

  it("removeBreakpoints works", () => {
    api.eraseBreakpoints();

    for (let i = 0; i < 100; i++) {
      api.setBreakpoint(i * 4);
    }

    for (let i = 0; i < 100; i++) {
      api.removeBreakpoint(i * 2);
    }

    let count = 0;
    for (let i = 0; i < 1000; i++) {
      if (api.testBreakpoint(i)) count++;
    }
    expect(count).toBe(50);
  });

});
