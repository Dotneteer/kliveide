import { describe, expect, it } from "vitest";

import {
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_RAM_BANK_3,
  OFFS_DIVMMC_ROM
} from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  testRom
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 DivMMC", () => {
  it("matches TypeScript reset defaults for boot-relevant DivMMC NextRegs", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);
    const diagnostics = wasmMachine.getWasmV2Diagnostics();

    expect(diagnostics.divMmcEnabled).toBe(oracleMachine.divMmcDevice.enabled);
    expect(diagnostics.divMmcConmem).toBe(oracleMachine.divMmcDevice.conmem);
    expect(diagnostics.divMmcMapram).toBe(oracleMachine.divMmcDevice.mapram);
    expect(diagnostics.divMmcBank).toBe(oracleMachine.divMmcDevice.bank);
    expect(diagnostics.divMmcPortE3).toBe(oracleMachine.divMmcDevice.port0xe3Value);
    expect(diagnostics.divMmcEnableAutomap).toBe(oracleMachine.divMmcDevice.enableAutomap);
    expect(diagnostics.divMmcAutoMapActive).toBe(oracleMachine.divMmcDevice.autoMapActive);
    expect(diagnostics.divMmcRstTrapEnabledMask).toBe(oracleMachine.divMmcDevice.nextRegB8Value);
    expect((~diagnostics.divMmcRstTrapOnlyWithRom3Mask) & 0xff).toBe(oracleMachine.divMmcDevice.nextRegB9Value);
    expect(diagnostics.divMmcRstTrapInstantMask).toBe(oracleMachine.divMmcDevice.nextRegBAValue);
    expect(diagnostics.divMmcEntry1).toBe(oracleMachine.divMmcDevice.nextRegBBValue);
  });

  it("reads and writes port 0xe3 through the public machine API", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);

    wasmMachine.doWritePort(0x00e3, 0x85);
    oracleMachine.writeTestPort(0x00e3, 0x85);

    expect(wasmMachine.doReadPort(0x00e3)).toBe(oracleMachine.readTestPort(0x00e3));
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      divMmcConmem: true,
      divMmcMapram: false,
      divMmcBank: 5,
      divMmcPortE3: 0x85
    });
  });

  it("honors DivMMC port enable gating for port 0xe3", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);

    wasmMachine.nextRegDevice.directSetRegValue(0x83, 0x00);
    oracleMachine.nextRegDevice.directSetRegValue(0x83, 0x00);
    wasmMachine.doWritePort(0x00e3, 0x85);
    oracleMachine.writeTestPort(0x00e3, 0x85);

    expect(wasmMachine.doReadPort(0x00e3)).toBe(oracleMachine.readTestPort(0x00e3));
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      divMmcEnabled: false,
      divMmcPortE3: 0xff
    });
  });

  it("maps CONMEM reads to DivMMC ROM and selected RAM bank", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    wasm.zxnextUploadRomByte(1, 0x0100, 0xaa);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 5 * 0x2000 + 0x0100, 0xdd);
    oracleMachine.memoryDevice.memory[OFFS_DIVMMC_ROM + 0x0100] = 0xaa;
    oracleMachine.memoryDevice.memory[OFFS_DIVMMC_RAM + 5 * 0x2000 + 0x0100] = 0xdd;

    wasmMachine.doWritePort(0x00e3, 0x85);
    oracleMachine.writeTestPort(0x00e3, 0x85);

    expect(wasmMachine.doReadMemory(0x0100)).toBe(oracleMachine.readTestMemory(0x0100));
    expect(wasmMachine.doReadMemory(0x2100)).toBe(oracleMachine.readTestMemory(0x2100));
    expect(wasmMachine.get64KFlatMemory()[0x0100]).toBe(0xaa);
    expect(wasmMachine.get64KFlatMemory()[0x2100]).toBe(0xdd);
  });

  it("maps MAPRAM page 0 to DivMMC RAM bank 3 and protects read-only regions", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextUploadRomByte(1, 0x0100, 0xbb);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM_BANK_3 + 0x0100, 0xcc);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 5 * 0x2000 + 0x0100, 0xdd);
    machine.doWritePort(0x00e3, 0xc5);

    expect(machine.doReadMemory(0x0100)).toBe(0xcc);
    expect(machine.doReadMemory(0x2100)).toBe(0xdd);

    machine.doWriteMemory(0x0100, 0x11);
    expect(wasm.zxnextReadPhysical(OFFS_DIVMMC_RAM_BANK_3 + 0x0100)).toBe(0xcc);

    machine.doWriteMemory(0x2100, 0x22);
    expect(wasm.zxnextReadPhysical(OFFS_DIVMMC_RAM + 5 * 0x2000 + 0x0100)).toBe(0x22);

    machine.doWritePort(0x00e3, 0xc3);
    machine.doWriteMemory(0x2100, 0x33);
    expect(wasm.zxnextReadPhysical(OFFS_DIVMMC_RAM_BANK_3 + 0x0100)).toBe(0xcc);
  });

  it("activates delayed RST automap during C-owned instruction execution", async () => {
    const romSet = createTestZxNextRomSet({
      next: testRom([0x00], 0x10000),
      divMmc: testRom([0xd1], 0x4000)
    });
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(romSet),
      createOracleZxNextMachine(romSet)
    ]);

    wasmMachine.nextRegDevice.directSetRegValue(0x0a, 0x10);
    oracleMachine.nextRegDevice.directSetRegValue(0x0a, 0x10);
    wasmMachine.nextRegDevice.directSetRegValue(0xb8, 0x01);
    oracleMachine.nextRegDevice.directSetRegValue(0xb8, 0x01);
    wasmMachine.nextRegDevice.directSetRegValue(0xb9, 0x01);
    oracleMachine.nextRegDevice.directSetRegValue(0xb9, 0x01);
    wasmMachine.nextRegDevice.directSetRegValue(0xba, 0x00);
    oracleMachine.nextRegDevice.directSetRegValue(0xba, 0x00);

    wasmMachine.setTestCpuRegisters({ pc: 0x0000, sp: 0xfffe, tacts: 0 });
    oracleMachine.setTestCpuRegisters({ pc: 0x0000, sp: 0xfffe, tacts: 0 });
    wasmMachine.executeOne();
    oracleMachine.executeOne();

    expect(wasmMachine.getWasmV2Diagnostics().divMmcAutoMapActive).toBe(oracleMachine.divMmcDevice.autoMapActive);
    expect(wasmMachine.doReadMemory(0x0000)).toBe(oracleMachine.readTestMemory(0x0000));
    expect(wasmMachine.doReadMemory(0x0000)).toBe(0xd1);
  });

  it("clears automap on RETN while preserving manual CONMEM", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.nextRegDevice.directSetRegValue(0x0a, 0x10);
    machine.nextRegDevice.directSetRegValue(0xb8, 0x01);
    machine.nextRegDevice.directSetRegValue(0xb9, 0x01);
    machine.nextRegDevice.directSetRegValue(0xba, 0x01);
    machine.setTestCpuRegisters({ pc: 0x0000, sp: 0xfffe, tacts: 0 });
    machine.executeOne();
    expect(machine.getWasmV2Diagnostics().divMmcAutoMapActive).toBe(true);

    machine.doWritePort(0x00e3, 0x81);
    wasm.zxnextWriteMemory(0x8000, 0xed);
    wasm.zxnextWriteMemory(0x8001, 0x45);
    wasm.zxnextWriteMemory(0xfffe, 0x02);
    wasm.zxnextWriteMemory(0xffff, 0x80);
    machine.setTestCpuRegisters({ pc: 0x8000, sp: 0xfffe });
    machine.executeOne();

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      divMmcAutoMapActive: false,
      divMmcConmem: true,
      divMmcPortE3: 0x81
    });
  });
});
