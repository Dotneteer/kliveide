import { describe, expect, it } from "vitest";
import { mapSp48ControllerToZ80CpuState } from "../../src/emu/sp48/z80CpuState";
import type { Sp48BusAccess, Sp48CpuState } from "../../src/emu/sp48/WasmZxSpectrum48Machine";

describe("SP48 Z80 CPU state mapper", () => {
  it("maps SP48 CPU snapshots to the IDE Z80 CPU DTO", () => {
    const state = mapSp48ControllerToZ80CpuState(
      createProvider(
        {
          af: 0x12af,
          bc: 0x2345,
          de: 0x3456,
          hl: 0x4567,
          afAlt: 0x5678,
          bcAlt: 0x6789,
          deAlt: 0x789a,
          hlAlt: 0x89ab,
          ix: 0x9abc,
          iy: 0xabcd,
          ir: 0x1c3d,
          wz: 0xcdef,
          pc: 0x8000,
          sp: 0xffff,
          tacts: 12345,
          prefix: 0,
          halted: true,
          iff1: true,
          interruptMode: 2,
          retExecuted: false,
          retnExecuted: false
        },
        { address: 0x4000, value: 0x44, isWrite: true },
        { address: 0x03fe, value: 0x7f, isWrite: false }
      )
    );

    expect(state).toMatchObject({
      af: 0x12af,
      bc: 0x2345,
      de: 0x3456,
      hl: 0x4567,
      af_: 0x5678,
      bc_: 0x6789,
      de_: 0x789a,
      hl_: 0x89ab,
      ix: 0x9abc,
      iy: 0xabcd,
      i: 0x1c,
      r: 0x3d,
      wz: 0xcdef,
      pc: 0x8000,
      sp: 0xffff,
      lastMemoryWrite: 0x44,
      lastIoRead: 0x7f,
      im: 2,
      iff1: true,
      halted: true,
      tacts: 12345
    });
    expect(state.lastMemoryRead).toBeUndefined();
    expect(state.lastIoWrite).toBeUndefined();
    expect(state.iff2).toBeUndefined();
  });

  it("maps read and write bus accesses to separate fields", () => {
    const readState = mapSp48ControllerToZ80CpuState(
      createProvider(baseCpuState(), { address: 0x4000, value: 0x11, isWrite: false }, {
        address: 0x03fe,
        value: 0x22,
        isWrite: false
      })
    );

    expect(readState.lastMemoryRead).toBe(0x11);
    expect(readState.lastMemoryWrite).toBeUndefined();
    expect(readState.lastIoRead).toBe(0x22);
    expect(readState.lastIoWrite).toBeUndefined();

    const writeState = mapSp48ControllerToZ80CpuState(
      createProvider(baseCpuState(), { address: 0x4000, value: 0x33, isWrite: true }, {
        address: 0x03fe,
        value: 0x44,
        isWrite: true
      })
    );

    expect(writeState.lastMemoryRead).toBeUndefined();
    expect(writeState.lastMemoryWrite).toBe(0x33);
    expect(writeState.lastIoRead).toBeUndefined();
    expect(writeState.lastIoWrite).toBe(0x44);
  });
});

function createProvider(cpu: Sp48CpuState, memory: Sp48BusAccess, port: Sp48BusAccess) {
  return {
    getCpuState: () => cpu,
    getLastMemoryAccess: () => memory,
    getLastPortAccess: () => port
  };
}

function baseCpuState(): Sp48CpuState {
  return {
    af: 0,
    bc: 0,
    de: 0,
    hl: 0,
    afAlt: 0,
    bcAlt: 0,
    deAlt: 0,
    hlAlt: 0,
    ix: 0,
    iy: 0,
    ir: 0,
    wz: 0,
    pc: 0,
    sp: 0,
    tacts: 0,
    prefix: 0,
    halted: false,
    iff1: false,
    interruptMode: 0,
    retExecuted: false,
    retnExecuted: false
  };
}
