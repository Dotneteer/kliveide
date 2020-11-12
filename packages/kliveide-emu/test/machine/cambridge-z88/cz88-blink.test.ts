import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/native/api/api";
import { importObject } from "../../import-object";
import { CambridgeZ88 } from "../../../src/native/api/CambridgeZ88";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../../build/spectrum.wasm")
);
let api: MachineApi;
let machine: CambridgeZ88;

describe("Cambridge Z88 - Blink", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new CambridgeZ88(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("blink reset", () => {
    machine.reset();

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(0x98);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
    expect(s.TMK).toBe(0);

    expect(s.PB0).toBe(0);
    expect(s.PB1).toBe(0);
    expect(s.PB2).toBe(0);
    expect(s.PB3).toBe(0);
    expect(s.SBR).toBe(0);
    expect(s.SCW).toBe(0xff);
    expect(s.SCH).toBe(0xff);
  });

  it("RTC inc with 1", () => {
    machine.api.testIncZ88Rtc(1);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(0x99);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 2", () => {
    machine.api.testIncZ88Rtc(2);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(0x9a);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 48", () => {
    machine.api.testIncZ88Rtc(48);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(200);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 49", () => {
    machine.api.testIncZ88Rtc(49);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(0);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 49 + 128", () => {
    machine.api.testIncZ88Rtc(49 + 128);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(128);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 49 + 129", () => {
    machine.api.testIncZ88Rtc(49 + 129);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(129);
    expect(s.TIM1).toBe(1);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC inc with 49 + 200", () => {
    machine.api.testIncZ88Rtc(49 + 200);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0);

    expect(s.TIM0).toBe(200);
    expect(s.TIM1).toBe(1);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });

  it("RTC reset requested", () => {
    machine.api.testIncZ88Rtc(100);
    machine.api.testSetZ88COM(0x10);
    machine.api.testIncZ88Rtc(1);

    const s = machine.getMachineState();

    expect(s.INT).toBe(0);
    expect(s.STA).toBe(0);
    expect(s.COM).toBe(0x10);

    expect(s.TIM0).toBe(0x98);
    expect(s.TIM1).toBe(0);
    expect(s.TIM2).toBe(0);
    expect(s.TIM3).toBe(0);
    expect(s.TIM4).toBe(0);
    expect(s.TSTA).toBe(0);
  });


});
