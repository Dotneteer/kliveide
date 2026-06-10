import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BIT_0_PL,
  BIT_1_PL,
  PILOT_PL,
  SYNC_1_PL,
  SYNC_2_PL,
  TERM_SYNC
} from "@emu/tape/tape-const";
import { createTapeDataBlock } from "@emu/tape/tape-parser";
import {
  Sp48TapeMode,
  Sp48TapePlayPhase,
  instantiateWasmZxSpectrum48Machine
} from "@emu/sp48/WasmZxSpectrum48Machine";

const TapeDiagnosticFlags = {
  DataOverflow: 0x00000008
} as const;

async function createMachine() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  return instantiateWasmZxSpectrum48Machine(readFileSync(wasmPath));
}

describe("SP48 Wasm tape upload ABI", () => {
  it("uploads tape block metadata and bytes into static Wasm buffers", async () => {
    const machine = await createMachine();
    const firstBlock = createTapeDataBlock(new Uint8Array([0x00, 0x01, 0x02]));
    const secondBlock = {
      ...createTapeDataBlock(new Uint8Array([0xaa, 0xbb])),
      pauseAfter: 500,
      pilotPulseLength: 1000,
      sync1PulseLength: 600,
      sync2PulseLength: 700,
      zeroBitPulseLength: 800,
      oneBitPulseLength: 1600,
      endSyncPulseLength: 42,
      lastByteUsedBits: 7,
      pilotPulseCount: 3000
    };

    machine.uploadTape([firstBlock, secondBlock], "demo.tap");

    expect(machine.isTapeLoaded()).toBe(true);
    expect(machine.isTapeEof()).toBe(false);
    expect(machine.isTapeUploadActive()).toBe(false);
    expect(machine.getTapeBlockCount()).toBe(2);
    expect(machine.getTapeDataLength()).toBe(5);
    expect(machine.getTapeCurrentBlockIndex()).toBe(0);
    expect([...machine.getTapeData().slice(0, 5)]).toEqual([0x00, 0x01, 0x02, 0xaa, 0xbb]);
    expect(readCString(machine.getTapeFileNameBytes())).toBe("demo.tap");

    expect(machine.getTapeBlockInfo(0)).toEqual({
      offset: 0,
      length: 3,
      pauseAfter: 1000,
      pilotPulseLength: PILOT_PL,
      sync1PulseLength: SYNC_1_PL,
      sync2PulseLength: SYNC_2_PL,
      zeroBitPulseLength: BIT_0_PL,
      oneBitPulseLength: BIT_1_PL,
      endSyncPulseLength: TERM_SYNC,
      lastByteUsedBits: 8,
      pilotPulseCount: 0
    });
    expect(machine.getTapeBlockInfo(1)).toEqual({
      offset: 3,
      length: 2,
      pauseAfter: 500,
      pilotPulseLength: 1000,
      sync1PulseLength: 600,
      sync2PulseLength: 700,
      zeroBitPulseLength: 800,
      oneBitPulseLength: 1600,
      endSyncPulseLength: 42,
      lastByteUsedBits: 7,
      pilotPulseCount: 3000
    });
    expect(machine.getDiagnosticFlags()).toBe(0);
  });

  it("refuses uploads that exceed the static tape data capacity", async () => {
    const machine = await createMachine();
    const tooLargeBlock = createTapeDataBlock(new Uint8Array(machine.getTapeDataCapacity() + 1));

    expect(() => machine.uploadTape([tooLargeBlock], "too-large.tap")).toThrow(
      /Cannot begin SP48 tape upload/
    );
    expect(machine.isTapeLoaded()).toBe(false);
    expect(machine.getTapeBlockCount()).toBe(0);
    expect(machine.getDiagnosticFlags() & TapeDiagnosticFlags.DataOverflow).not.toBe(0);
  });

  it("preserves uploaded tape across hard reset and clears it on eject", async () => {
    const machine = await createMachine();
    const block = createTapeDataBlock(new Uint8Array([0x13, 0x37]));

    machine.uploadTape([block], "keep.tap");
    machine.hardReset();

    expect(machine.isTapeLoaded()).toBe(true);
    expect(machine.isTapeEof()).toBe(false);
    expect(machine.getTapeBlockCount()).toBe(1);
    expect([...machine.getTapeData().slice(0, 2)]).toEqual([0x13, 0x37]);
    expect(readCString(machine.getTapeFileNameBytes())).toBe("keep.tap");

    machine.clearTape();

    expect(machine.isTapeLoaded()).toBe(false);
    expect(machine.isTapeEof()).toBe(true);
    expect(machine.getTapeBlockCount()).toBe(0);
    expect(readCString(machine.getTapeFileNameBytes())).toBe("");
  });

  it("generates normal-load pilot EAR pulses", async () => {
    const machine = await createMachine();
    const block = createTapeDataBlock(new Uint8Array([0x00]));

    machine.uploadTape([block], "pilot.tap");
    machine.setTacts(0);
    machine.setTapeMode(Sp48TapeMode.Load);

    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Load);
    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Pilot);
    expect(machine.getTapeEarBit()).toBe(true);

    machine.setTacts(PILOT_PL - 1);
    expect(machine.getTapeEarBit()).toBe(true);

    machine.setTacts(PILOT_PL);
    expect(machine.getTapeEarBit()).toBe(false);

    machine.setTacts(PILOT_PL * 2);
    expect(machine.getTapeEarBit()).toBe(true);
  });

  it("generates pure data bit pulses for normal load", async () => {
    const machine = await createMachine();
    const block = {
      ...createTapeDataBlock(new Uint8Array([0x80])),
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0
    };

    machine.uploadTape([block], "data.tap");
    machine.setTacts(0);
    machine.setTapeMode(Sp48TapeMode.Load);

    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Data);
    expect(machine.getTapeEarBit()).toBe(false);

    machine.setTacts(BIT_1_PL - 1);
    expect(machine.getTapeEarBit()).toBe(false);

    machine.setTacts(BIT_1_PL);
    expect(machine.getTapeEarBit()).toBe(true);

    machine.setTacts(BIT_1_PL * 2);
    expect(machine.getTapeEarBit()).toBe(false);
    expect(machine.getTapeCurrentBitMask()).toBe(0x40);

    machine.setTacts(BIT_1_PL * 2 + BIT_0_PL);
    expect(machine.getTapeEarBit()).toBe(true);
  });

  it("advances to the next block after pause", async () => {
    const machine = await createMachine();
    const silence = {
      ...createTapeDataBlock(new Uint8Array(0)),
      pauseAfter: 1,
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0,
      zeroBitPulseLength: 0,
      oneBitPulseLength: 0,
      endSyncPulseLength: 0,
      lastByteUsedBits: 0
    };
    const data = {
      ...createTapeDataBlock(new Uint8Array([0x00])),
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0
    };

    machine.uploadTape([silence, data], "pause.tap");
    machine.setTacts(0);
    machine.setTapeMode(Sp48TapeMode.Load);

    expect(machine.getTapeCurrentBlockIndex()).toBe(0);
    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Pause);

    machine.setTacts(3_501);
    expect(machine.getTapeEarBit()).toBe(true);
    expect(machine.getTapeCurrentBlockIndex()).toBe(1);
    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Data);
  });

  it("routes tape EAR to port $FE bit 6 in load mode", async () => {
    const machine = await createMachine();
    const block = {
      ...createTapeDataBlock(new Uint8Array([0x80])),
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0
    };

    machine.uploadTape([block], "port.tap");
    machine.setTacts(0);
    machine.setTapeMode(Sp48TapeMode.Load);

    expect(machine.readPort(0x00fe) & 0x40).toBe(0x00);

    machine.setTacts(BIT_1_PL);
    expect(machine.readPort(0x00fe) & 0x40).toBe(0x40);
  });

  it("enters load mode when execution reaches the ROM LOAD routine", async () => {
    const machine = await createMachine();
    const block = createTapeDataBlock(new Uint8Array([0x00]));

    machine.uploadTape([block], "rom-load.tap");
    machine.setCpuPc(0x056c);
    machine.executeInstruction();

    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Load);
    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Pilot);
  });

  it("detects LOAD mode after an instruction branches to the ROM LOAD routine", async () => {
    const machine = await createMachine();
    const block = createTapeDataBlock(new Uint8Array([0x00]));

    machine.uploadTape([block], "branch-load.tap");
    expect(machine.getTapeFastLoad()).toBe(true);
    machine.setTapeFastLoad(false);
    expect(machine.getTapeFastLoad()).toBe(false);
    writeProgram(machine, 0x8000, [0xc3, 0x6c, 0x05]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x056c);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Load);
    expect(machine.getTapePlayPhase()).toBe(Sp48TapePlayPhase.Pilot);
    expect(machine.getTapeLoadStartCount()).toBe(1);
    expect(machine.getTapeLastModeChangePc()).toBe(0x056c);
    expect(machine.getTapeLastModeChangeTact()).toBeGreaterThan(0);
  });

  it("detects SAVE mode after an instruction branches to the ROM SAVE routine", async () => {
    const machine = await createMachine();

    writeProgram(machine, 0x8000, [0xc3, 0xc2, 0x04]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x04c2);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Save);
    expect(machine.getTapeSaveStartCount()).toBe(1);
    expect(machine.getTapeLastModeChangePc()).toBe(0x04c2);
  });

  it("leaves LOAD mode after an instruction branches to the ROM error restart", async () => {
    const machine = await createMachine();
    const block = createTapeDataBlock(new Uint8Array([0x00]));

    machine.uploadTape([block], "branch-error.tap");
    machine.setTapeMode(Sp48TapeMode.Load);
    writeProgram(machine, 0x8000, [0xc3, 0x08, 0x00]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x0008);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.getTapeLastModeChangePc()).toBe(0x0008);
    expect(machine.getTapeModeChangeCount()).toBeGreaterThanOrEqual(2);
  });

  it("renders audible beeper samples from tape EAR transitions", async () => {
    const machine = await createMachine();
    const block = {
      ...createTapeDataBlock(new Uint8Array([0x80])),
      pilotPulseLength: 0,
      sync1PulseLength: 0,
      sync2PulseLength: 0
    };

    machine.setAudioSampleRate(48_000);
    machine.uploadTape([block], "audio.tap");
    machine.setTacts(0);
    machine.setTapeMode(Sp48TapeMode.Load);

    expect(machine.readPort(0x00fe) & 0x40).toBe(0x00);
    machine.setTacts(BIT_1_PL);
    expect(machine.readPort(0x00fe) & 0x40).toBe(0x40);

    machine.executeMachineFrame();

    expect(machine.getAudioSamples().some((sample) => sample.left !== 0)).toBe(true);
  });
});

function readCString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? bytes.length : end));
}

function writeProgram(machine: Awaited<ReturnType<typeof createMachine>>, address: number, bytes: number[]): void {
  bytes.forEach((byte, index) => machine.writeMemory(address + index, byte));
}
