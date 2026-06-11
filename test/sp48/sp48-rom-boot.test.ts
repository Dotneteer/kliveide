import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  createSp48MachineController,
  type Sp48FrameCompletedEvent
} from "@emu/sp48/Sp48MachineController";
import { createTapeDataBlock, parseTapeFile } from "@emu/tape/tape-parser";
import {
  instantiateWasmZxSpectrum48Machine,
  Sp48TapeMode,
  type WasmZxSpectrum48Machine
} from "@emu/sp48/WasmZxSpectrum48Machine";

const SAVE_BYTES_ROUTINE = 0x04c2;

async function createMachine(): Promise<WasmZxSpectrum48Machine> {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  const romPath = resolve(process.cwd(), "src/public/roms/sp48.rom");
  const machine = await instantiateWasmZxSpectrum48Machine(readFileSync(wasmPath));
  await machine.setup(async (path) => {
    if (path === "roms/sp48.rom") {
      return new Uint8Array(readFileSync(romPath));
    }
    return new Uint8Array(readFileSync(resolve(process.cwd(), path)));
  });
  machine.hardReset();
  return machine;
}

async function createController() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  const romPath = resolve(process.cwd(), "src/public/roms/sp48.rom");
  return createSp48MachineController(async (path) => {
    if (path === "roms/sp48.rom") {
      return new Uint8Array(readFileSync(romPath));
    }
    return new Uint8Array(readFileSync(resolve(process.cwd(), path)));
  }, {
    audioSampleRate: 44_100,
    wasmBytes: readFileSync(wasmPath)
  });
}

function bootUntilBasicReady(machine: WasmZxSpectrum48Machine, maxFrames = 120): void {
  for (let i = 0; i < maxFrames && machine.getCpuIy() !== 0x5c3a; i++) {
    machine.executeMachineFrame();
  }
}

describe("SP48 ROM boot smoke tests", () => {
  it("boots the real 48K ROM to the initialized BASIC loop", async () => {
    const machine = await createMachine();

    bootUntilBasicReady(machine);

    expect(machine.getCpuIy()).toBe(0x5c3a);
    expect(machine.frames).toBe(83);
    expect(machine.getCpuPc()).toBe(0x0e5d);
    expect(machine.getCpuSp()).toBe(0xff4a);
    expect(machine.getBorderColor()).toBe(7);
    expect(machine.readMemory(0x5c48)).toBe(0x38);
    expect(machine.readMemory(0x5c8d)).toBe(0x38);
    expect(machine.readMemory(0x5c8f)).toBe(0x38);
  });

  it("lets the 48K ROM observe a queued Q key press", async () => {
    const machine = await createMachine();

    bootUntilBasicReady(machine);
    machine.setKeyStatus(10, true);
    machine.executeMachineFrame();

    expect(machine.getCpuIy()).toBe(0x5c3a);
    expect(machine.getKeyboardLine(2)).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xbe);
    expect(machine.readMemory(0x5c08)).toBe(0xf6);
    expect(machine.readMemory(0x5c3b)).toBe(0x20);

    machine.setKeyStatus(10, false);
    for (let i = 0; i < 5; i++) {
      machine.executeMachineFrame();
    }

    expect(machine.getKeyboardLine(2)).toBe(0x00);
    expect(machine.readPort(0xfbfe)).toBe(0xbf);
    expect(machine.readMemory(0x5c04)).toBe(0xff);
  });

  it("runs a tiny injected RAM program through the SP48 bus", async () => {
    const machine = await createMachine();
    const program = [
      0x3e, 0x03,       // LD A,3
      0xd3, 0xfe,       // OUT ($FE),A
      0x32, 0x00, 0x40, // LD ($4000),A
      0x76              // HALT
    ];

    machine.setCpuPc(0x8000);
    machine.setCpuIff1(false);
    machine.setTacts(1_000);
    program.forEach((byte, index) => machine.writeMemory(0x8000 + index, byte));

    for (let i = 0; i < 4; i++) {
      machine.executeInstruction();
    }

    expect(machine.getCpuPc()).toBe(0x8007);
    expect(machine.getCpuAf() >> 8).toBe(0x03);
    expect(machine.getBorderColor()).toBe(3);
    expect(machine.readMemory(0x4000)).toBe(0x03);
    expect(machine.getCpuHalted()).toBe(true);
  });

  it("loads a small data block through the real ROM normal-load routine", async () => {
    const machine = await createMachine();
    const payload = new Uint8Array([0x3c, 0x5a, 0xa5, 0xc3]);
    const targetAddress = 0x8000;
    const block = createTapeDataBlock(createTapBlock(0xff, payload));

    machine.uploadTape([block], "normal-rom-load.tap");
    machine.setTapeFastLoad(false);
    machine.setCpuAf(0xff01);
    machine.setCpuIx(targetAddress);
    machine.setCpuDe(payload.length);
    machine.setCpuSp(0xff00);
    machine.setCpuPc(0x0556);

    const loaded = runFramesUntil(machine, 260, () =>
      payload.every((byte, index) => machine.readMemory(targetAddress + index) === byte)
    );
    machine.writeMemory(0x9000, 0x76);
    machine.setCpuPc(0x9000);
    const tapeCompleted = runFramesUntil(machine, 120, () =>
      machine.getTapeMode() === Sp48TapeMode.Passive && machine.isTapeEof()
    );

    expect(loaded).toBe(true);
    expect(tapeCompleted).toBe(true);
    expect([...payload].map((_, index) => machine.readMemory(targetAddress + index))).toEqual([...payload]);
    expect(machine.getTapeFastLoad()).toBe(false);
    expect(machine.getTapeLoadStartCount()).toBeGreaterThan(0);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.isTapeEof()).toBe(true);
    expect(machine.getTapeCurrentBlockIndex()).toBe(1);
  });

  it("saves header and data blocks through the real ROM normal-save routine", async () => {
    const controller = await createController();
    const machine = controller.machine;
    const headerAddress = 0x8200;
    const dataAddress = 0x8300;
    const saveStartAddress = 0x9000;
    const dataPayload = new Uint8Array([0x3c, 0x5a, 0xa5, 0xc3]);
    const headerPayload = createSpectrumSaveHeaderPayload("ROMSAVE", dataPayload.length, dataAddress);
    const expectedHeaderBlock = createTapBlock(0x00, headerPayload);
    const expectedDataBlock = createTapBlock(0xff, dataPayload);
    let savedEvent: Sp48FrameCompletedEvent | undefined;

    controller.frameCompleted.on((event) => {
      if (event?.savedTapeFileInfo) {
        savedEvent = event;
      }
    });

    writeBytes(machine, headerAddress, headerPayload);
    writeBytes(machine, dataAddress, dataPayload);
    writeProgram(machine, saveStartAddress, [
      0x3e, 0x00, // LD A,$00: header block
      0xdd, 0x21, headerAddress & 0xff, headerAddress >> 8, // LD IX,header
      0x11, headerPayload.length & 0xff, headerPayload.length >> 8, // LD DE,header length
      0xcd, SAVE_BYTES_ROUTINE & 0xff, SAVE_BYTES_ROUTINE >> 8, // CALL SA-BYTES
      0x3e, 0xff, // LD A,$FF: data block
      0xdd, 0x21, dataAddress & 0xff, dataAddress >> 8, // LD IX,data
      0x11, dataPayload.length & 0xff, dataPayload.length >> 8, // LD DE,data length
      0xcd, SAVE_BYTES_ROUTINE & 0xff, SAVE_BYTES_ROUTINE >> 8, // CALL SA-BYTES
      0x76 // HALT
    ]);
    machine.setCpuSp(0xff00);
    machine.setCpuPc(saveStartAddress);
    machine.setCpuIff1(false);

    controller.issueMachineCommand("start");
    const saved = runControllerFramesUntil(controller, 700, () => savedEvent !== undefined);

    expect(saved).toBe(true);
    expect(savedEvent?.savedTapeFileInfo?.name).toBe("ROMSAVE.tzx");
    expect(savedEvent?.savedTapeFileInfo?.blockCount).toBe(2);
    expect(controller.machineState).toBe(MachineControllerState.Running);
    expect(machine.getTapeSaveStartCount()).toBe(1);
    expect(machine.getSavedTapeBlockCount()).toBe(2);

    const parsed = parseTapeFile(savedEvent!.savedTapeFileInfo!.contents);
    expect(parsed.format).toBe("tzx");
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].data).toEqual(expectedHeaderBlock);
    expect(parsed.blocks[1].data).toEqual(expectedDataBlock);
  });
});

function runFramesUntil(
  machine: WasmZxSpectrum48Machine,
  maxFrames: number,
  condition: () => boolean
): boolean {
  for (let i = 0; i < maxFrames; i++) {
    if (condition()) {
      return true;
    }
    machine.executeMachineFrame();
  }
  return condition();
}

function runControllerFramesUntil(
  controller: Awaited<ReturnType<typeof createController>>,
  maxFrames: number,
  condition: () => boolean
): boolean {
  for (let i = 0; i < maxFrames; i++) {
    if (condition()) {
      return true;
    }
    controller.tickFrame();
  }
  return condition();
}

function writeBytes(machine: WasmZxSpectrum48Machine, address: number, bytes: Uint8Array): void {
  bytes.forEach((byte, index) => machine.writeMemory(address + index, byte));
}

function writeProgram(machine: WasmZxSpectrum48Machine, address: number, bytes: number[]): void {
  bytes.forEach((byte, index) => machine.writeMemory(address + index, byte));
}

function createSpectrumSaveHeaderPayload(
  name: string,
  dataLength: number,
  startAddress: number
): Uint8Array {
  const payload = new Uint8Array(17);
  payload[0] = 0x03;
  for (let i = 0; i < 10; i++) {
    payload[i + 1] = i < name.length ? name.charCodeAt(i) : 0x20;
  }
  writeWord(payload, 11, dataLength);
  writeWord(payload, 13, startAddress);
  writeWord(payload, 15, startAddress);
  return payload;
}

function writeWord(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
}

function createTapBlock(flag: number, payload: Uint8Array): Uint8Array {
  const data = new Uint8Array(payload.length + 2);
  data[0] = flag & 0xff;
  data.set(payload, 1);
  let checksum = data[0];
  for (const byte of payload) {
    checksum ^= byte;
  }
  data[data.length - 1] = checksum;
  return data;
}
