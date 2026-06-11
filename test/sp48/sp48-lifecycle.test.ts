import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { createSp48MachineController } from "@emu/sp48/Sp48MachineController";
import { Sp48TapeMode } from "@emu/sp48/WasmZxSpectrum48Machine";
import {
  BIT_0_PL,
  BIT_1_PL,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL,
  TERM_SYNC
} from "@emu/tape/tape-const";
import { createTapeDataBlock, parseTapeFile } from "@emu/tape/tape-parser";

const SAVE_BYTES_ROUTINE = 0x04c2;
const MIN_SAVE_PILOT_COUNT = 3000;

async function createController() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  return createSp48MachineController(async (path) => {
    if (path === "roms/sp48.rom") {
      return new Uint8Array(readFileSync(resolve(process.cwd(), "src/public/roms/sp48.rom")));
    }
    return new Uint8Array(readFileSync(resolve(process.cwd(), path)));
  }, {
    audioSampleRate: 44_100,
    wasmBytes: readFileSync(wasmPath)
  });
}

describe("SP48 Wasm machine lifecycle", () => {
  it("does not advance frames while stopped", async () => {
    const controller = await createController();

    expect(controller.machineState).toBe(MachineControllerState.None);
    expect(controller.tickFrame()).toBe(false);
    expect(controller.machine.frames).toBe(0);
  });

  it("starts, emits frame completion, and submits Wasm audio metadata", async () => {
    const controller = await createController();
    const events: number[] = [];
    let audioSampleCount = 0;

    controller.frameCompleted.on((event) => {
      events.push(event?.frames ?? -1);
      audioSampleCount = event?.audioSampleCount ?? 0;
    });

    controller.issueMachineCommand("start");

    expect(controller.machineState).toBe(MachineControllerState.Running);
    expect(controller.tickFrame()).toBe(true);
    expect(controller.machine.frames).toBe(1);
    expect(controller.machine.tacts).toBeGreaterThanOrEqual(controller.machine.tactsInFrame);
    expect(controller.machine.getNextFrameStartTact()).toBe(controller.machine.tactsInFrame);
    expect(events).toEqual([1]);
    expect(audioSampleCount).toBeGreaterThan(0);
  });

  it("pauses and single-steps while paused", async () => {
    const controller = await createController();

    controller.issueMachineCommand("start");
    controller.tickFrame();
    controller.issueMachineCommand("pause");

    expect(controller.machineState).toBe(MachineControllerState.Paused);
    expect(controller.tickFrame()).toBe(false);
    expect(controller.machine.frames).toBe(1);

    const previousPc = controller.machine.getCpuPc();
    const previousInstructions = controller.machine.getCpuInstructionsExecuted();
    controller.issueMachineCommand("stepInto");

    expect(controller.machineState).toBe(MachineControllerState.Paused);
    expect(controller.machine.frames).toBe(1);
    expect(controller.machine.getCpuInstructionsExecuted()).toBe(previousInstructions + 1);
    expect(controller.machine.getCpuPc()).not.toBe(previousPc);
  });

  it("stops and restarts the Wasm machine", async () => {
    const controller = await createController();

    controller.issueMachineCommand("start");
    controller.tickFrame();
    controller.issueMachineCommand("stop");

    expect(controller.machineState).toBe(MachineControllerState.Stopped);
    expect(controller.machine.frames).toBe(0);

    controller.issueMachineCommand("restart");

    expect(controller.machineState).toBe(MachineControllerState.Running);
    expect(controller.machine.frames).toBe(0);
    expect(controller.tickFrame()).toBe(true);
    expect(controller.machine.frames).toBe(1);
  });

  it("keeps keyboard input routed through the controller", async () => {
    const controller = await createController();

    controller.setKeyStatus(10, true);

    expect(controller.machine.getKeyboardLine(2)).toBe(0x01);
    expect(controller.machine.readPort(0xfbfe)).toBe(0xbe);
    expect(controller.renderInstantScreen().length).toBe(352 * (288 + 4));
  });

  it("routes tape media upload and eject through the controller", async () => {
    const controller = await createController();
    const block = createTapeDataBlock(new Uint8Array([0x00, 0x03, 0x13, 0x37]));

    controller.setTape([block], "controller.tap");

    expect(controller.machine.isTapeLoaded()).toBe(true);
    expect(controller.machine.getTapeBlockCount()).toBe(1);
    expect(controller.machine.getTapeDataLength()).toBe(4);
    expect([...controller.machine.getTapeData().slice(0, 4)]).toEqual([0x00, 0x03, 0x13, 0x37]);

    controller.issueMachineCommand("rewind");

    expect(controller.machine.getTapeCurrentBlockIndex()).toBe(0);

    controller.clearTape();

    expect(controller.machine.isTapeLoaded()).toBe(false);
    expect(controller.machine.getTapeBlockCount()).toBe(0);
  });

  it("extracts a trimmed filename from a completed saved header block", async () => {
    const controller = await createController();
    const header = createSpectrumTapeHeader("DEMO");
    enterSaveMode(controller);

    emitSaveBlock(createSavePulseEmitter(controller), [...header]);
    controller.syncSavedTapeBlocks();

    expect(controller.getRetainedSavedTapeName()).toBe("DEMO");
    expect(controller.getPendingSavedTapeFile()).toBeUndefined();
  });

  it("pairs a saved data block with the retained header block", async () => {
    const controller = await createController();
    const header = createSpectrumTapeHeader("GAME");
    const data = new Uint8Array([0xff, 0x01, 0x02, 0x03]);
    const pulse = createSavePulseEmitter(controller);
    enterSaveMode(controller);

    emitSaveBlock(pulse, [...header]);
    emitSaveBlock(pulse, [...data]);
    controller.syncSavedTapeBlocks();

    expect(controller.getPendingSavedTapeFile()).toEqual({
      name: "GAME.tzx",
      headerBlock: header,
      dataBlock: data
    });
  });

  it("ignores a saved data block when no header has been retained", async () => {
    const controller = await createController();
    enterSaveMode(controller);

    emitSaveBlock(createSavePulseEmitter(controller), [0xff, 0x11, 0x22]);
    controller.syncSavedTapeBlocks();

    expect(controller.getRetainedSavedTapeName()).toBe("");
    expect(controller.getPendingSavedTapeFile()).toBeUndefined();
  });

  it("uses the latest saved header block before pairing data", async () => {
    const controller = await createController();
    const firstHeader = createSpectrumTapeHeader("FIRST");
    const secondHeader = createSpectrumTapeHeader("SECOND");
    const data = new Uint8Array([0xff, 0xaa, 0xbb]);
    const pulse = createSavePulseEmitter(controller);
    enterSaveMode(controller);

    emitSaveBlock(pulse, [...firstHeader]);
    controller.syncSavedTapeBlocks();
    emitSaveBlock(pulse, [...secondHeader]);
    emitSaveBlock(pulse, [...data]);
    controller.syncSavedTapeBlocks();

    expect(controller.getRetainedSavedTapeName()).toBe("SECOND");
    expect(controller.getPendingSavedTapeFile()).toEqual({
      name: "SECOND.tzx",
      headerBlock: secondHeader,
      dataBlock: data
    });
  });

  it("emits a generated TZX file once on frame completion", async () => {
    const controller = await createController();
    const header = createSpectrumTapeHeader("SNAPSHOT");
    const data = new Uint8Array([0xff, 0x10, 0x20, 0x30]);
    const events: Array<string | undefined> = [];
    const contents: Uint8Array[] = [];
    controller.frameCompleted.on((event) => {
      events.push(event?.savedTapeFileInfo?.name);
      if (event?.savedTapeFileInfo) {
        contents.push(event.savedTapeFileInfo.contents);
      }
    });

    emitSavedHeaderAndData(controller, header, data);
    controller.issueMachineCommand("start");

    expect(controller.tickFrame()).toBe(true);
    expect(controller.tickFrame()).toBe(true);

    expect(events).toEqual(["SNAPSHOT.tzx", undefined]);
    expect(contents).toHaveLength(1);
    expectSavedTzx(contents[0], header, data);
    expect(controller.getPendingSavedTapeFile()).toBeUndefined();
  });

  it("emits a generated TZX file from the debug frame path", async () => {
    const controller = await createController();
    const header = createSpectrumTapeHeader("DEBUG");
    const data = new Uint8Array([0xff, 0x44, 0x55]);
    let savedName: string | undefined;
    let savedContents: Uint8Array | undefined;
    controller.frameCompleted.on((event) => {
      savedName = event?.savedTapeFileInfo?.name;
      savedContents = event?.savedTapeFileInfo?.contents;
    });

    emitSavedHeaderAndData(controller, header, data);
    controller.machine.setTacts(0);
    controller.addBreakpoint(0xffff);
    controller.issueMachineCommand("debug");

    expect(controller.tickFrame()).toBe(true);

    expect(savedName).toBe("DEBUG.tzx");
    expect(savedContents).toBeDefined();
    expectSavedTzx(savedContents!, header, data);
  });
});

type TestController = Awaited<ReturnType<typeof createController>>;

function writeProgram(controller: TestController, address: number, bytes: number[]): void {
  bytes.forEach((byte, index) => controller.machine.writeMemory(address + index, byte));
}

function enterSaveMode(controller: TestController): void {
  writeProgram(controller, 0x8000, [0xc3, SAVE_BYTES_ROUTINE & 0xff, SAVE_BYTES_ROUTINE >> 8]);
  controller.machine.setCpuPc(0x8000);
  controller.machine.executeInstruction();
  expect(controller.machine.getTapeMode()).toBe(Sp48TapeMode.Save);
}

function createSavePulseEmitter(controller: TestController) {
  let micBit = true;
  let tacts = controller.machine.tacts;
  return (length: number) => {
    tacts += length;
    micBit = !micBit;
    controller.machine.setTacts(tacts);
    controller.machine.writePort(0x00fe, micBit ? 0x08 : 0x00);
  };
}

function emitSavedHeaderAndData(controller: TestController, header: Uint8Array, data: Uint8Array): void {
  const pulse = createSavePulseEmitter(controller);
  enterSaveMode(controller);
  emitSaveBlock(pulse, [...header]);
  emitSaveBlock(pulse, [...data]);
}

function emitSaveBlock(pulse: (length: number) => void, bytes: number[]): void {
  for (let i = 0; i < MIN_SAVE_PILOT_COUNT; i++) {
    pulse(PILOT_PL);
  }
  pulse(SYNC_1_PL);
  pulse(SYNC_2_PL);
  if (bytes.length === 0) {
    pulse(BIT_0_PL);
  } else {
    bytes.forEach((byte) => emitSaveByte(pulse, byte));
  }
  pulse(TERM_SYNC);
}

function emitSaveByte(pulse: (length: number) => void, value: number): void {
  for (let bit = 7; bit >= 0; bit--) {
    const length = (value & (1 << bit)) === 0 ? BIT_0_PL : BIT_1_PL;
    pulse(length);
    pulse(length);
  }
}

function createSpectrumTapeHeader(name: string): Uint8Array {
  const header = new Uint8Array(0x13);
  header[0] = 0x00;
  for (let i = 0; i < 10; i++) {
    header[i + 2] = i < name.length ? name.charCodeAt(i) : 0x20;
  }
  return header;
}

function expectSavedTzx(contents: Uint8Array, header: Uint8Array, data: Uint8Array): void {
  const parsed = parseTapeFile(contents);
  expect(parsed.format).toBe("tzx");
  expect(parsed.blocks).toHaveLength(2);
  expect(parsed.blocks[0].data).toEqual(header);
  expect(parsed.blocks[1].data).toEqual(data);
}
