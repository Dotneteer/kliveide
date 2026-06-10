import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTapeDataBlock } from "@emu/tape/tape-parser";
import {
  instantiateWasmZxSpectrum48Machine,
  Sp48TapeMode,
  type WasmZxSpectrum48Machine
} from "@emu/sp48/WasmZxSpectrum48Machine";

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
