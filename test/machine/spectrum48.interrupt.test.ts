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

describe("ZX Spectrum 48 - Interrupt", () => {
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

  it("Disabled interrupt not raised", () => {
    machine.injectCode([
      0xed,
      0x56, // IM 1
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x00,
      0x0a, // LD BC,$0A00
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800f);
    expect(s.tacts).toBeGreaterThanOrEqual(66599);
  });

  it("Enabled interrupt is raised", () => {
    machine.injectCode([
      0xed,
      0x56, // IM 1
      0xfb, // EI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x00,
      0x0a, // LD BC,$0A00
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    let s = machine.getMachineState();
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    s = machine.getMachineState();
    expect(s.pc).toBe(0x800f);
    expect(s.tacts).toBeGreaterThanOrEqual(67553);
  });

  it("Interrupt not raised too early", () => {
    const TEST_INT_TACT = 13;
    machine.api.setInterruptTact(TEST_INT_TACT);
    for (let tact = 0; tact < TEST_INT_TACT; tact++) {
      machine.api.checkForInterrupt(tact);
      const s = machine.getMachineState();
      expect(s.interruptRaised).toBe(false);
      expect(s.interruptRevoked).toBe(false);
      expect(s.stateFlags & 0x01).toBe(0x00);
    }
  });

  it("Interrupt not raised too late", () => {
    const TEST_INT_TACT = 13;
    const LATE_TACT = TEST_INT_TACT + 23 + 1;
    machine.api.setInterruptTact(TEST_INT_TACT);
    for (let tact = LATE_TACT; tact < LATE_TACT + 10; tact++) {
      machine.api.checkForInterrupt(tact);
      const s = machine.getMachineState();
      expect(s.interruptRaised).toBe(false);
      expect(s.interruptRevoked).toBe(true);
      expect(s.stateFlags & 0x01).toBe(0x00);
    }
  });

  it("Interrupt raised within allowed range", () => {
    const TEST_INT_TACT = 13;
    const LATE_TACT = TEST_INT_TACT + 23;
    machine.api.setInterruptTact(TEST_INT_TACT);
    for (let tact = TEST_INT_TACT; tact <= LATE_TACT; tact++) {
      machine.api.checkForInterrupt(tact);
      const s = machine.getMachineState();
      expect(s.interruptRaised).toBe(true);
      expect(s.interruptRevoked).toBe(false);
      expect(s.stateFlags & 0x01).toBe(0x01);
    }
  });
});
