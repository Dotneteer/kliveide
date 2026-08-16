import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  executeOneInstruction,
  expectSameCpuRegisters,
  initCodeBytes
} from "./wasm-next-test-helpers";

const SPI_CS_PORT = 0x00e7;
const SPI_DATA_PORT = 0x00eb;
const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;

type MachinePair = {
  wasmMachine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>;
  oracleMachine: Awaited<ReturnType<typeof createOracleZxNextMachine>>;
};

describe("ZX Spectrum Next WASM v2 oracle program matrix", () => {
  it("matches TypeScript for a CPU program that switches banks, writes RAM, and reads the value back", async () => {
    const { wasmMachine, oracleMachine } = await createProgramPair([
      ...nextReg(0x56, 0x10),
      ...ldAN(0x6d),
      ...ldNnA(0xc000),
      ...ldAN(0x00),
      ...ldANni(0xc000)
    ]);

    runInstructions({ wasmMachine, oracleMachine }, 5);

    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "af"]);
    expect(wasmMachine.getCurrentPartitions()).toEqual(oracleMachine.getCurrentPartitions());
    expect(wasmMachine.getCurrentPartitions()[6]).toBe(0x08);
    expect(wasmMachine.doReadMemory(0xc000)).toBe(oracleMachine.doReadMemory(0xc000));
    expect(wasmMachine.wasmV2Runtime!.exports.zxnextReadPhysical(OFFS_NEXT_RAM + 0x10 * 0x2000)).toBe(0x6d);
  });

  it("matches TypeScript for a CPU program that reads keyboard and writes ULA screen state", async () => {
    const { wasmMachine, oracleMachine } = await createProgramPair([
      ...ldBCnn(0xfefe),
      ...inAC(),
      ...ldNnA(0x9000),
      ...ldAN(0x05),
      ...outN(0xfe),
      ...ldAN(0x80),
      ...ldNnA(0x4000),
      ...ldAN(0x47),
      ...ldNnA(0x5800)
    ]);
    wasmMachine.keyboardDevice.setKeyStatus(0, true);
    oracleMachine.keyboardDevice.setKeyStatus(0, true);

    runInstructions({ wasmMachine, oracleMachine }, 9);

    expectSameCpuRegisters(wasmMachine, oracleMachine, ["pc", "af"]);
    expect(wasmMachine.doReadMemory(0x9000)).toBe(oracleMachine.doReadMemory(0x9000));
    expect(wasmMachine.getWasmV2Diagnostics().ulaBorderColor).toBe(oracleMachine.composedScreenDevice.borderColor);
    expect(wasmMachine.readScreenMemory(0)).toBe(oracleMachine.readScreenMemory(0));
    expect(wasmMachine.readScreenMemory(0x1800)).toBe(oracleMachine.readScreenMemory(0x1800));

    wasmMachine.renderInstantScreen();
    oracleMachine.renderInstantScreen();
    const pixelOffset = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(wasmMachine.getPixelBuffer()[pixelOffset]).toBe(oracleMachine.getPixelBuffer()[pixelOffset]);
  });

  it("drives NextReg ports, PSG, and DAC setup from exact-port CPU OUT programs", async () => {
    const { wasmMachine, oracleMachine } = await createProgramPair([
      ...outC(0x243b, 0x43),
      ...outC(0x253b, 0x02),
      ...outC(0xfffd, 0x08),
      ...outC(0xbffd, 0x0f),
      ...outC(0x243b, 0x84),
      ...outC(0x253b, 0xff),
      ...outC(0x001f, 0x7f)
    ]);

    runInstructions({ wasmMachine, oracleMachine }, 21);

    expect(wasmMachine.nextRegDevice.directGetRegValue(0x43)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x43));
    expect(wasmMachine.doReadPort(0xbffd)).toBe(oracleMachine.doReadPort(0xbffd));
    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      paletteControl: 0x02,
      psgSelectedRegister: 8,
      dacA: 0x7f
    });
    expect(wasmMachine.getWasmV2Diagnostics().dacA).toBe(
      oracleMachine.audioControlDevice.getDacDevice().getDacA()
    );
  });

  it("uses a CPU SPI command sequence for SD initialization and matches the TypeScript response", async () => {
    const { wasmMachine, oracleMachine } = await createProgramPair([
      ...outC(SPI_CS_PORT, 0x02),
      ...outC(SPI_DATA_PORT, 0x40),
      ...outC(SPI_DATA_PORT, 0x00),
      ...outC(SPI_DATA_PORT, 0x00),
      ...outC(SPI_DATA_PORT, 0x00),
      ...outC(SPI_DATA_PORT, 0x00),
      ...outC(SPI_DATA_PORT, 0x95)
    ]);
    wasmMachine.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 2048);
    oracleMachine.sdCardDevice.setCardInfo(2048);

    runInstructions({ wasmMachine, oracleMachine }, 21);

    expect(wasmMachine.getWasmV2Diagnostics().sdSelectedCard).toBe(oracleMachine.sdCardDevice.selectedCard);
    expect(readBytes(wasmMachine, 3)).toEqual(readBytes(oracleMachine, 3));
    expect(wasmMachine.getWasmV2Diagnostics().sdCommandCount).toBe(1);
  });

  it("configures and runs a deterministic memory-to-memory DMA transfer", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.writeTestMemory(0x8200, 0xa1);
    machine.writeTestMemory(0x8201, 0xb2);

    initCodeBytes(machine, [
      ...outC(0x006b, 0x7d),
      ...outC(0x006b, 0x00),
      ...outC(0x006b, 0x82),
      ...outC(0x006b, 0x02),
      ...outC(0x006b, 0x00),
      ...outC(0x006b, 0x14),
      ...outC(0x006b, 0x10),
      ...outC(0x006b, 0xad),
      ...outC(0x006b, 0x00),
      ...outC(0x006b, 0x92),
      ...outC(0x006b, 0xcf),
      ...outC(0x006b, 0x87)
    ]);

    runWasmInstructions(machine, 36);
    expect(machine.wasmV2Runtime!.exports.zxnextRunDma(0)).toBe(2);

    expect(machine.readTestMemory(0x9200)).toBe(0xa1);
    expect(machine.readTestMemory(0x9201)).toBe(0xb2);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dmaBlockLength: 2,
      dmaTransferCount: 2,
      dmaBlockCompletionCount: 1
    });
  });

  it("acknowledges deterministic HW IM2 interrupt priority after CPU-programmed NextRegs", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    initCodeBytes(machine, [
      ...nextReg(0xc0, 0xe1),
      ...nextReg(0xc4, 0x03)
    ]);

    runWasmInstructions(machine, 2);
    wasm.zxnextCaptureUlaInterruptPulse();
    wasm.zxnextCaptureLineInterruptPulse();

    expect(machine.shouldRaiseInterrupt()).toBe(true);
    expect(wasm.zxnextDaisyAcknowledge()).toBe(0xe0);
    expect(machine.shouldRaiseInterrupt()).toBe(false);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      interruptHwIm2Mode: true,
      interruptDaisyInServiceMask: 1
    });
  });
});

async function createProgramPair(code: number[]): Promise<MachinePair> {
  const romSet = createTestZxNextRomSet({ next: patternedBytes(0x10000, 0x21) });
  const wasmMachine = await createTestZxNextWasmMachine(romSet);
  const oracleMachine = await createOracleZxNextMachine(romSet);
  initCodeBytes(wasmMachine, code);
  initCodeBytes(oracleMachine, code);
  return { wasmMachine, oracleMachine };
}

function runInstructions(pair: MachinePair, count: number): void {
  for (let i = 0; i < count; i++) {
    executeWasmInstruction(pair.wasmMachine);
    executeOneInstruction(pair.oracleMachine);
  }
}

function runWasmInstructions(machine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>, count: number): void {
  for (let i = 0; i < count; i++) executeWasmInstruction(machine);
}

function executeWasmInstruction(machine: Awaited<ReturnType<typeof createTestZxNextWasmMachine>>): void {
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
}

function readBytes(machine: { doReadPort: (address: number) => number }, count: number): number[] {
  return Array.from({ length: count }, () => machine.doReadPort(SPI_DATA_PORT));
}

function ldAN(value: number): number[] {
  return [0x3e, value & 0xff];
}

function ldBCnn(address: number): number[] {
  return [0x01, address & 0xff, (address >> 8) & 0xff];
}

function ldNnA(address: number): number[] {
  return [0x32, address & 0xff, (address >> 8) & 0xff];
}

function ldANni(address: number): number[] {
  return [0x3a, address & 0xff, (address >> 8) & 0xff];
}

function inAC(): number[] {
  return [0xed, 0x78];
}

function outN(portLowByte: number): number[] {
  return [0xd3, portLowByte & 0xff];
}

function outCA(): number[] {
  return [0xed, 0x79];
}

function outC(port: number, value: number): number[] {
  return [
    ...ldBCnn(port),
    ...ldAN(value),
    ...outCA()
  ];
}

function nextReg(reg: number, value: number): number[] {
  return [0xed, 0x91, reg & 0xff, value & 0xff];
}

function patternedBytes(size: number, seed: number): Uint8Array {
  const result = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    result[i] = (seed + i * 13) & 0xff;
  }
  return result;
}
