import { describe, expect, it } from "vitest";

import {
  OFFS_DIVMMC_RAM,
  OFFS_MULTIFACE_MEM
} from "@emu/machines/zxNext/MemoryDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const NMI_STATE_IDLE = 0;
const NMI_STATE_FETCH = 1;
const NMI_STATE_HOLD = 2;
const NMI_STATE_END = 3;

describe("ZX Spectrum Next WASM v2 Multiface and expansion bus", () => {
  it("implements expansion bus NextRegs, status bits, IO propagation, and speed forcing", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      expansionEnabled: false,
      expansionRomcsReplacement: false,
      expansionDisableIoCycles: false,
      expansionDisableMemCycles: false,
      expansionExternalBusData: 0xff
    });

    machine.nextRegDevice.directSetRegValue(0x07, 0x03);
    expect(machine.getWasmV2Diagnostics().cpuEffectiveSpeed).toBe(3);

    machine.nextRegDevice.directSetRegValue(0x80, 0xf5);
    expect(machine.nextRegDevice.directGetRegValue(0x80)).toBe(0xf5);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      expansionEnabled: true,
      expansionRomcsReplacement: true,
      expansionDisableIoCycles: true,
      expansionDisableMemCycles: true,
      expansionSoftResetPersistence: 0x05,
      cpuProgrammedSpeed: 3,
      cpuEffectiveSpeed: 0
    });

    machine.nextRegDevice.directSetRegValue(0x80, 0x00);
    expect(machine.getWasmV2Diagnostics().cpuEffectiveSpeed).toBe(3);

    machine.nextRegDevice.directSetRegValue(0x81, 0xf0);
    expect(machine.nextRegDevice.directGetRegValue(0x81)).toBe(0x70);
    wasm.zxnextSetExpansionRomcsSignal(1);
    expect(machine.nextRegDevice.directGetRegValue(0x81)).toBe(0xf0);

    machine.nextRegDevice.directSetRegValue(0x80, 0x80);
    machine.nextRegDevice.directSetRegValue(0x8a, 0xff);
    expect(machine.nextRegDevice.directGetRegValue(0x8a)).toBe(0x3f);
    expect(wasm.zxnextShouldPropagateIo(0)).toBe(1);
    expect(wasm.zxnextShouldPropagateIo(5)).toBe(1);
    expect(wasm.zxnextShouldPropagateIo(6)).toBe(0);
    machine.nextRegDevice.directSetRegValue(0x80, 0x00);
    expect(wasm.zxnextShouldPropagateIo(5)).toBe(0);
  });

  it("maps ROMCS reads to external bus data or replacement RAM pages", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 14 * 0x2000 + 0x0123, 0x6e);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 15 * 0x2000 + 0x0123, 0x7d);
    wasm.zxnextSetExpansionExternalBusData(0x5a);
    wasm.zxnextSetExpansionRomcsSignal(1);

    machine.nextRegDevice.directSetRegValue(0x80, 0x80);
    expect(machine.getWasmV2Diagnostics().expansionRomcsClaimed).toBe(true);
    expect(machine.doReadMemory(0x0123)).toBe(0x5a);
    expect(machine.get64KFlatMemory()[0x0123]).toBe(0x5a);

    machine.nextRegDevice.directSetRegValue(0x80, 0xc0);
    expect(machine.doReadMemory(0x0123)).toBe(0x6e);
    expect(machine.doReadMemory(0x2123)).toBe(0x7d);

    machine.nextRegDevice.directSetRegValue(0x80, 0xd0);
    expect(machine.getWasmV2Diagnostics().expansionRomcsClaimed).toBe(false);
  });

  it("tracks Multiface type, selected ports, port state transitions, and gate reset", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceType: 0,
      multifaceEnabled: true,
      multifaceNmiActive: false,
      multifaceMfEnabled: false,
      multifaceInvisible: true,
      multifaceEnablePortAddress: 0x3f,
      multifaceDisablePortAddress: 0xbf
    });

    wasm.zxnextSetMultifaceType(1);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceEnablePortAddress: 0xbf,
      multifaceDisablePortAddress: 0x3f
    });
    wasm.zxnextSetMultifaceType(2);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceEnablePortAddress: 0x9f,
      multifaceDisablePortAddress: 0x1f
    });
    wasm.zxnextSetMultifaceType(3);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceEnablePortAddress: 0x9f,
      multifaceDisablePortAddress: 0x1f
    });

    machine.nextRegDevice.directSetRegValue(0x03, 0x07);
    machine.nextRegDevice.directSetRegValue(0x0a, 0x40);
    expect(machine.getWasmV2Diagnostics().multifaceType).toBe(1);

    wasm.zxnextPressMultifaceNmiButton();
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceNmiActive: true,
      multifaceInvisible: false,
      multifaceIsActive: true,
      multifaceNmiHold: true
    });

    machine.doWritePort(0x7ffd, 0x08);
    expect(machine.doReadPort(0x00bf)).toBe(0xff);
    expect(machine.getWasmV2Diagnostics().multifaceMfEnabled).toBe(true);
    expect(machine.doReadPort(0x003f)).toBe(0xff);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceMfEnabled: false,
      multifaceNmiActive: true
    });

    machine.nextRegDevice.directSetRegValue(0x83, 0xfd);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      multifaceEnabled: false,
      multifaceNmiActive: false,
      multifaceMfEnabled: false,
      multifaceInvisible: true
    });
  });

  it("maps Multiface memory with priority over DivMMC and protects page 0 writes", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextUploadRomByte(2, 0x0050, 0x55);
    wasm.zxnextUploadRomByte(2, 0x0080, 0x11);
    wasm.zxnextUploadRomByte(2, 0x0100, 0xab);
    wasm.zxnextWritePhysical(OFFS_MULTIFACE_MEM + 0x2100, 0xcd);
    wasm.zxnextWritePhysical(OFFS_DIVMMC_RAM + 5 * 0x2000 + 0x0080, 0x22);

    wasm.zxnextPressMultifaceNmiButton();
    wasm.zxnextMultifaceOnFetch0066();

    expect(machine.doReadMemory(0x0100)).toBe(0xab);
    expect(machine.doReadMemory(0x2100)).toBe(0xcd);

    machine.doWriteMemory(0x0050, 0x42);
    expect(wasm.zxnextReadPhysical(OFFS_MULTIFACE_MEM + 0x0050)).toBe(0x55);

    machine.doWriteMemory(0x2050, 0x99);
    expect(wasm.zxnextReadPhysical(OFFS_MULTIFACE_MEM + 0x2050)).toBe(0x99);
    expect(machine.doReadMemory(0x2050)).toBe(0x99);

    machine.doWritePort(0x00e3, 0x85);
    expect(machine.doReadMemory(0x0080)).toBe(0x11);
  });

  it("accepts expansion bus NMI causes and releases them through the NMI states", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    wasm.zxnextSetExpansionNmiPending(1);
    wasm.zxnextNmiBeforeOpcodeFetch(0x8000);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      expansionNmiPending: true,
      nmiSourceExpBus: false,
      sigNmi: false,
      nmiState: NMI_STATE_IDLE
    });

    machine.nextRegDevice.directSetRegValue(0x80, 0x80);
    wasm.zxnextNmiBeforeOpcodeFetch(0x8000);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      expansionNmiPending: false,
      nmiSourceExpBus: true,
      sigNmi: true,
      nmiState: NMI_STATE_FETCH
    });

    wasm.zxnextNmiBeforeOpcodeFetch(0x0066);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      sigNmi: false,
      nmiState: NMI_STATE_HOLD
    });
    wasm.zxnextNmiBeforeOpcodeFetch(0x8000);
    expect(machine.getWasmV2Diagnostics().nmiState).toBe(NMI_STATE_END);
    wasm.zxnextNmiBeforeOpcodeFetch(0x8000);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      nmiSourceExpBus: false,
      nmiState: NMI_STATE_IDLE
    });
  });

  it("prioritizes Multiface NMI over a pending expansion bus NMI", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.nextRegDevice.directSetRegValue(0x06, 0x98);
    machine.nextRegDevice.directSetRegValue(0x80, 0x80);
    wasm.zxnextRequestMfNmi();
    wasm.zxnextSetExpansionNmiPending(1);

    wasm.zxnextNmiBeforeOpcodeFetch(0x8000);

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      nmiSourceMf: true,
      nmiSourceExpBus: false,
      expansionNmiPending: true,
      multifaceNmiActive: true,
      sigNmi: true,
      nmiState: NMI_STATE_FETCH
    });
  });
});
