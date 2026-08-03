import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { Sp48WasmLoaderOptions } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";

import { readFileSync } from "node:fs";

import { BinaryReader } from "@common/utils/BinaryReader";
import { BinaryWriter } from "@common/utils/BinaryWriter";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum48WasmMachine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmMachine";
import { resetSp48WasmModuleCache } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmLoader";
import { buildSp48Wasm, output } from "../../scripts/build-sp48-wasm.cjs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

class SmokeTypeScript48Machine extends ZxSpectrum48Machine {
  readonly beeperTransitions: Array<{ tact: number; value: number; ear: boolean; mic: boolean }> = [];
  private lastEar = false;
  private lastMic = false;

  constructor(
    private readonly rom: Uint8Array,
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(modelInfo, config);
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }

  protected override writePort0xFE(value: number): void {
    super.writePort0xFE(value);
    const ear = (value & 0x10) !== 0;
    const mic = (value & 0x08) !== 0;
    if (ear !== this.lastEar || mic !== this.lastMic) {
      this.beeperTransitions.push({
        tact: this.frameTacts,
        value: value & 0xff,
        ear,
        mic
      });
      this.lastEar = ear;
      this.lastMic = mic;
    }
  }
}

class SmokeWasm48Machine extends ZxSpectrum48WasmMachine {
  constructor(
    private readonly rom: Uint8Array,
    modelInfo?: MachineModel,
    config?: MachineConfigSet
  ) {
    super(modelInfo, config, actualLoaderOptions());
  }

  protected override async loadRomFromResource(): Promise<Uint8Array> {
    return this.rom;
  }
}

describe("ZX Spectrum 48K WASM rollout smoke pack", () => {
  beforeAll(() => buildSp48Wasm());
  afterEach(() => resetSp48WasmModuleCache());

  it.each([
    ["TAP", makeTapFile([0xff, 0x42, 0x24])],
    ["TZX", makeTzxFile([0xff, 0x42, 0x24])]
  ])("fast-loads a selected %s tape block with TypeScript parity", async (_format, contents) => {
    const blocks = parseSelectedTapeBlocks(contents);
    const ts = await createTsMachine(testRom([]));
    const wasm = await createWasmMachine(testRom([]));
    prepareFastLoadStateBeforeLoadRoutine(ts);
    prepareFastLoadStateBeforeLoadRoutine(wasm);
    ts.setMachineProperty(MEDIA_TAPE, blocks);
    wasm.setMachineProperty(MEDIA_TAPE, cloneTapeBlocks(blocks));

    const tsTermination = ts.executeMachineFrame();
    const wasmTermination = wasm.executeMachineFrame();

    expect(wasmTermination).toBe(tsTermination);
    expect(Array.from(wasm.get64KFlatMemory().subarray(0x8000, 0x8002))).toEqual(
      Array.from(ts.get64KFlatMemory().subarray(0x8000, 0x8002))
    );
    expect(wasm.tapeDevice.tapeMode).toBe(ts.tapeDevice.tapeMode);
  });

  it("runs a border/audio demo frame with TypeScript trace parity", async () => {
    const rom = testRom([
      0x3e, 0x10, 0xd3, 0xfe,
      0x3e, 0x1b, 0xd3, 0xfe,
      0x3e, 0x00, 0xd3, 0xfe
    ]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);
    ts.setTactsInFrame(96);
    wasm.setTactsInFrame(96);

    expect(wasm.executeMachineFrame()).toBe(ts.executeMachineFrame());
    expect(wasm.getWasmAudioTrace()).toEqual(ts.beeperTransitions);
    expect(wasm.getWasmBorderTrace().map(({ tact, value, color }) => ({ tact, value, color }))).toEqual([
      { tact: 36, value: 0x1b, color: 3 },
      { tact: 54, value: 0x00, color: 0 }
    ]);
  });

  it("runs a keyboard polling smoke frame with TypeScript memory parity", async () => {
    const rom = testRom([
      0x3e, 0xfd,
      0xdb, 0xfe,
      0x32, 0x00, 0x40
    ]);
    const ts = await createTsMachine(rom);
    const wasm = await createWasmMachine(rom);
    ts.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    wasm.keyboardDevice.setKeyStatus(SpectrumKeyCode.A, true);
    ts.setTactsInFrame(64);
    wasm.setTactsInFrame(64);

    expect(wasm.executeMachineFrame()).toBe(ts.executeMachineFrame());
    expect(wasm.doReadMemory(0x4000)).toBe(ts.doReadMemory(0x4000));
    expect(wasm.getWasmAdapterSyncStats().keyboardRowWrites).toBeGreaterThan(0);
  });

  it("supports debugger StepInto smoke execution through WASM", async () => {
    const ts = await createTsMachine(testRom([0x3e, 0x12, 0x3c, 0x00]));
    const wasm = await createWasmMachine(testRom([0x3e, 0x12, 0x3c, 0x00]));
    wasm.executionContext.debugStepMode = DebugStepMode.StepInto;
    wasm.executionContext.frameTerminationMode = FrameTerminationMode.Normal;

    executeTsInstructions(ts, 1);
    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(wasm.af).toBe(ts.af);
    expect(wasm.pc).toBe(ts.pc);

    executeTsInstructions(ts, 1);
    expect(wasm.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(wasm.af).toBe(ts.af);
    expect(wasm.pc).toBe(ts.pc);
  });
});

async function createTsMachine(rom: Uint8Array): Promise<SmokeTypeScript48Machine> {
  const machine = new SmokeTypeScript48Machine(rom);
  await machine.setup();
  return machine;
}

async function createWasmMachine(rom: Uint8Array): Promise<SmokeWasm48Machine> {
  const machine = new SmokeWasm48Machine(rom);
  await machine.setup();
  return machine;
}

function actualLoaderOptions(): Sp48WasmLoaderOptions {
  return {
    artifactName: "t9-rollout-smoke.wasm",
    readArtifact: async () => readFileSync(output)
  };
}

function parseSelectedTapeBlocks(contents: Uint8Array): TapeDataBlock[] {
  const reader = new BinaryReader(contents);
  const tzxReader = new TzxReader(reader);
  let result = tzxReader.readContent();
  if (result) {
    reader.seek(0);
    const tapReader = new TapReader(reader);
    result = tapReader.readContent();
    if (result) {
      throw new Error(`Smoke tape parse failed: ${result}`);
    }
    return tapReader.dataBlocks;
  }
  return tzxReader.dataBlocks.map((block) => block.getDataBlock()).filter(Boolean);
}

function cloneTapeBlocks(blocks: TapeDataBlock[]): TapeDataBlock[] {
  return blocks.map((block) => {
    const clone = new TapeDataBlock();
    clone.data = new Uint8Array(block.data);
    clone.pauseAfter = block.pauseAfter;
    clone.pilotPulseLength = block.pilotPulseLength;
    clone.pilotPulseCount = block.pilotPulseCount;
    clone.sync1PulseLength = block.sync1PulseLength;
    clone.sync2PulseLength = block.sync2PulseLength;
    clone.zeroBitPulseLength = block.zeroBitPulseLength;
    clone.oneBitPulseLength = block.oneBitPulseLength;
    clone.endSyncPulseLength = block.endSyncPulseLength;
    clone.lastByteUsedBits = block.lastByteUsedBits;
    return clone;
  });
}

function executeTsInstructions(machine: ZxSpectrum48Machine, count: number): void {
  for (let i = 0; i < count; i++) {
    do {
      machine.executeCpuCycle();
    } while (machine.instructionExecutionInProgress());
  }
}

function makeTapFile(payloadWithoutChecksum: number[]): Uint8Array {
  const blockData = tapeBlockData(payloadWithoutChecksum);
  const writer = new BinaryWriter();
  writer.writeUint16(blockData.length);
  writer.writeBytes(blockData);
  return writer.buffer;
}

function makeTzxFile(payloadWithoutChecksum: number[]): Uint8Array {
  const blockData = tapeBlockData(payloadWithoutChecksum);
  const writer = new BinaryWriter();
  writer.writeBytes(new Uint8Array([0x5a, 0x58, 0x54, 0x61, 0x70, 0x65, 0x21, 0x1a, 0x01, 0x14]));
  writer.writeByte(0x10);
  writer.writeUint16(1000);
  writer.writeUint16(blockData.length);
  writer.writeBytes(blockData);
  return writer.buffer;
}

function tapeBlockData(payloadWithoutChecksum: number[]): Uint8Array {
  const checksum = payloadWithoutChecksum.reduce((acc, value) => acc ^ value, 0);
  return new Uint8Array([...payloadWithoutChecksum, checksum]);
}

function prepareFastLoadStateBeforeLoadRoutine(machine: ZxSpectrum48Machine): void {
  machine.pc = 0x056c;
  machine.af_ = 0xff00;
  machine.ix = 0x8000;
  machine.de = 2;
  machine.setTactsInFrame(128);
}

function testRom(bytes: number[]): Uint8Array {
  const rom = new Uint8Array(0x4000);
  rom.set(bytes);
  return rom;
}
