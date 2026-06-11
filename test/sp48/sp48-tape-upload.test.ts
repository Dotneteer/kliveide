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
  Sp48TapeMicPulse,
  Sp48TapeMode,
  Sp48TapePlayPhase,
  Sp48TapeSavePhase,
  instantiateWasmZxSpectrum48Machine
} from "@emu/sp48/WasmZxSpectrum48Machine";

const TapeDiagnosticFlags = {
  DataOverflow: 0x00000008,
  SaveBlockOverflow: 0x00000080,
  SaveMalformedPulse: 0x00000100
} as const;

const FLAG_C = 0x0001;
const LOAD_BYTES_ROUTINE = 0x056c;
const LOAD_BYTES_INVALID_HEADER_ROUTINE = 0x05b6;
const LOAD_BYTES_RESUME_ROUTINE = 0x05e2;
const SAVE_BYTES_ROUTINE = 0x04c2;
const MIN_SAVE_PILOT_COUNT = 3000;

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
    machine.setTapeFastLoad(false);
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

  it("classifies SAVE MIC pulse widths with reference tolerances", async () => {
    const machine = await createMachine();

    expect(machine.classifyTapeSavePulse(BIT_0_PL)).toBe(Sp48TapeMicPulse.Bit0);
    expect(machine.classifyTapeSavePulse(BIT_1_PL)).toBe(Sp48TapeMicPulse.Bit1);
    expect(machine.classifyTapeSavePulse(PILOT_PL)).toBe(Sp48TapeMicPulse.Pilot);
    expect(machine.classifyTapeSavePulse(SYNC_1_PL)).toBe(Sp48TapeMicPulse.Sync1);
    expect(machine.classifyTapeSavePulse(SYNC_2_PL)).toBe(Sp48TapeMicPulse.Sync2);
    expect(machine.classifyTapeSavePulse(TERM_SYNC)).toBe(Sp48TapeMicPulse.TermSync);
    expect(machine.classifyTapeSavePulse(SYNC_1_PL - 25)).toBe(Sp48TapeMicPulse.TooShort);
    expect(machine.classifyTapeSavePulse(PILOT_PL + 49)).toBe(Sp48TapeMicPulse.TooLong);
  });

  it("captures a standard-speed SAVE data block from MIC pulses", async () => {
    const machine = await createMachine();

    writeProgram(machine, 0x8000, [0xc3, SAVE_BYTES_ROUTINE & 0xff, SAVE_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);
    machine.executeInstruction();

    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Save);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.None);
    expect(machine.getTapeSaveMicBit()).toBe(true);

    const pulse = createSavePulseEmitter(machine);
    for (let i = 0; i < MIN_SAVE_PILOT_COUNT; i++) {
      pulse(PILOT_PL);
    }
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Pilot);
    expect(machine.getTapeSavePilotPulseCount()).toBe(MIN_SAVE_PILOT_COUNT);

    pulse(SYNC_1_PL);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Sync1);

    pulse(SYNC_2_PL);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Sync2);

    emitSaveByte(pulse, 0xa5);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Data);

    pulse(TERM_SYNC);

    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.None);
    expect(machine.getSavedTapeBlockCount()).toBe(1);
    expect(machine.getSavedTapeDataLength()).toBe(1);
    expect(machine.getSavedTapeRevision()).toBe(1);
    expect(machine.getSavedTapeBlockInfo(0)).toEqual({ offset: 0, length: 1 });
    expect(machine.getTapeSaveData()[0]).toBe(0xa5);
  });

  it("records multiple SAVE blocks with stable offsets and one revision per block", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    const pulse = createSavePulseEmitter(machine);

    emitSaveBlock(pulse, [0x12, 0x34]);
    emitSaveBlock(pulse, [0xab]);

    expect(machine.getSavedTapeBlockCount()).toBe(2);
    expect(machine.getSavedTapeDataLength()).toBe(3);
    expect(machine.getSavedTapeRevision()).toBe(2);
    expect(machine.getSavedTapeBlockInfo(0)).toEqual({ offset: 0, length: 2 });
    expect(machine.getSavedTapeBlockInfo(1)).toEqual({ offset: 2, length: 1 });
    expect([...machine.getTapeSaveData().slice(0, 3)]).toEqual([0x12, 0x34, 0xab]);
  });

  it("clears captured SAVE blocks without disturbing the SAVE pulse classifier state", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    const pulse = createSavePulseEmitter(machine);
    emitSaveBlock(pulse, [0x5a]);

    expect(machine.getSavedTapeBlockCount()).toBe(1);
    expect(machine.getSavedTapeRevision()).toBe(1);

    machine.clearSavedTapeBlocks();

    expect(machine.getSavedTapeBlockCount()).toBe(0);
    expect(machine.getSavedTapeDataLength()).toBe(0);
    expect(machine.getSavedTapeRevision()).toBe(1);
    expect(machine.getSavedTapeBlockInfo(0)).toEqual({ offset: 0, length: 0 });
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Save);
  });

  it("sets a diagnostic flag when SAVE block capacity is exceeded", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    const pulse = createSavePulseEmitter(machine);
    const maxBlocks = machine.getTapeSaveMaxBlocks();

    for (let i = 0; i < maxBlocks; i++) {
      emitSaveBlock(pulse, []);
    }
    expect(machine.getSavedTapeBlockCount()).toBe(maxBlocks);
    expect(machine.getSavedTapeRevision()).toBe(maxBlocks);

    emitSaveBlock(pulse, []);

    expect(machine.getSavedTapeBlockCount()).toBe(maxBlocks);
    expect(machine.getSavedTapeRevision()).toBe(maxBlocks);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Error);
    expect(machine.getDiagnosticFlags() & TapeDiagnosticFlags.SaveBlockOverflow).not.toBe(0);
  });

  it("leaves SAVE mode after a too-long pause", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    writeProgram(machine, 0x9000, [0x00]);
    machine.setCpuPc(0x9000);
    machine.setTacts(machine.getTapeSaveLastMicBitTact() + 3_500_001);

    machine.executeInstruction();

    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.None);
    expect(machine.getTapeLastModeChangePc()).toBe(0x9000);
  });

  it("sets a diagnostic flag when SAVE pulses are malformed", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    const pulse = createSavePulseEmitter(machine);
    for (let i = 0; i < MIN_SAVE_PILOT_COUNT; i++) {
      pulse(PILOT_PL);
    }

    pulse(BIT_0_PL);

    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Error);
    expect(machine.getDiagnosticFlags() & TapeDiagnosticFlags.SaveMalformedPulse).not.toBe(0);
    expect(machine.getSavedTapeBlockCount()).toBe(0);
  });

  it("starts a clean SAVE capture after a previous SAVE error", async () => {
    const machine = await createMachine();

    enterSaveMode(machine);
    const badPulse = createSavePulseEmitter(machine);
    for (let i = 0; i < MIN_SAVE_PILOT_COUNT; i++) {
      badPulse(PILOT_PL);
    }
    badPulse(BIT_0_PL);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.Error);

    writeProgram(machine, 0x9000, [0xc3, 0x08, 0x00]);
    machine.setCpuPc(0x9000);
    machine.executeInstruction();
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);

    enterSaveMode(machine);
    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.None);
    expect(machine.getSavedTapeBlockCount()).toBe(0);
    expect(machine.getSavedTapeDataLength()).toBe(0);

    const goodPulse = createSavePulseEmitter(machine);
    emitSaveBlock(goodPulse, [0x5a]);

    expect(machine.getTapeSavePhase()).toBe(Sp48TapeSavePhase.None);
    expect(machine.getSavedTapeBlockCount()).toBe(1);
    expect(machine.getSavedTapeDataLength()).toBe(1);
    expect(machine.getTapeSaveData()[0]).toBe(0x5a);
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

  it("fast-loads a data block through the ROM load hook", async () => {
    const machine = await createMachine();
    const payload = new Uint8Array([0x3c, 0x5a, 0xa5, 0x18]);
    const targetAddress = 0x9000;

    machine.uploadTape([createTapeDataBlock(createTapBlock(0xff, payload))], "fast.tap");
    machine.setTapeFastLoad(true);
    machine.setCpuAfAlt(0xff01);
    machine.setCpuIx(targetAddress);
    machine.setCpuDe(payload.length);
    writeProgram(machine, 0x8000, [0xc3, LOAD_BYTES_ROUTINE & 0xff, LOAD_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect([...payload].map((_, index) => machine.readMemory(targetAddress + index))).toEqual([...payload]);
    expect(machine.getCpuPc()).toBe(LOAD_BYTES_RESUME_ROUTINE);
    expect(machine.getCpuIx()).toBe(targetAddress + payload.length);
    expect(machine.getCpuDe()).toBe(0);
    expect(machine.getCpuAf() & FLAG_C).toBe(FLAG_C);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.getTapeCurrentBlockIndex()).toBe(1);
    expect(machine.isTapeEof()).toBe(true);
  });

  it("fast-load verify succeeds when target bytes match", async () => {
    const machine = await createMachine();
    const payload = new Uint8Array([0x10, 0x20, 0x30]);
    const targetAddress = 0x9100;

    payload.forEach((byte, index) => machine.writeMemory(targetAddress + index, byte));
    machine.uploadTape([createTapeDataBlock(createTapBlock(0xff, payload))], "verify.tap");
    machine.setTapeFastLoad(true);
    machine.setCpuAfAlt(0xff00);
    machine.setCpuIx(targetAddress);
    machine.setCpuDe(payload.length);
    writeProgram(machine, 0x8000, [0xc3, LOAD_BYTES_ROUTINE & 0xff, LOAD_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(LOAD_BYTES_RESUME_ROUTINE);
    expect(machine.getCpuAf() & FLAG_C).toBe(FLAG_C);
    expect([...payload].map((_, index) => machine.readMemory(targetAddress + index))).toEqual([...payload]);
    expect(machine.isTapeEof()).toBe(true);
  });

  it("fast-load branches to the invalid-header routine for a wrong block type", async () => {
    const machine = await createMachine();
    const payload = new Uint8Array([0x55, 0xaa]);

    machine.uploadTape([createTapeDataBlock(createTapBlock(0x00, payload))], "wrong-type.tap");
    machine.setTapeFastLoad(true);
    machine.setCpuAfAlt(0xff01);
    machine.setCpuHl(0x1234);
    machine.setCpuIx(0x9200);
    machine.setCpuDe(payload.length);
    writeProgram(machine, 0x8000, [0xc3, LOAD_BYTES_ROUTINE & 0xff, LOAD_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(LOAD_BYTES_INVALID_HEADER_ROUTINE);
    expect(machine.getCpuAf() & FLAG_C).toBe(0);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.getTapeCurrentBlockIndex()).toBe(1);
    expect(machine.isTapeEof()).toBe(true);
  });

  it("fast-load reports checksum errors through carry clear", async () => {
    const machine = await createMachine();
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const block = createTapBlock(0xff, payload);
    block[block.length - 1] ^= 0x01;

    machine.uploadTape([createTapeDataBlock(block)], "bad-checksum.tap");
    machine.setTapeFastLoad(true);
    machine.setCpuAfAlt(0xff01);
    machine.setCpuIx(0x9300);
    machine.setCpuDe(payload.length);
    writeProgram(machine, 0x8000, [0xc3, LOAD_BYTES_ROUTINE & 0xff, LOAD_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(LOAD_BYTES_RESUME_ROUTINE);
    expect(machine.getCpuAf() & FLAG_C).toBe(0);
    expect(machine.getTapeMode()).toBe(Sp48TapeMode.Passive);
    expect(machine.isTapeEof()).toBe(true);
  });

  it("fast-load uses the machine memory map and does not write into ROM", async () => {
    const machine = await createMachine();
    const rom = new Uint8Array(0x4000).fill(0x42);
    const payload = new Uint8Array([0x11, 0x22, 0x33]);

    machine.uploadRomBytes(rom);
    machine.uploadTape([createTapeDataBlock(createTapBlock(0xff, payload))], "rom-target.tap");
    machine.setTapeFastLoad(true);
    machine.setCpuAfAlt(0xff01);
    machine.setCpuIx(0x0000);
    machine.setCpuDe(payload.length);
    writeProgram(machine, 0x8000, [0xc3, LOAD_BYTES_ROUTINE & 0xff, LOAD_BYTES_ROUTINE >> 8]);
    machine.setCpuPc(0x8000);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(LOAD_BYTES_RESUME_ROUTINE);
    expect(machine.getCpuAf() & FLAG_C).toBe(FLAG_C);
    expect([...payload].map((_, index) => machine.readMemory(index))).toEqual([0x42, 0x42, 0x42]);
    expect(machine.isTapeEof()).toBe(true);
  });
});

function readCString(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? bytes.length : end));
}

function writeProgram(machine: Awaited<ReturnType<typeof createMachine>>, address: number, bytes: number[]): void {
  bytes.forEach((byte, index) => machine.writeMemory(address + index, byte));
}

function enterSaveMode(machine: Awaited<ReturnType<typeof createMachine>>): void {
  writeProgram(machine, 0x8000, [0xc3, SAVE_BYTES_ROUTINE & 0xff, SAVE_BYTES_ROUTINE >> 8]);
  machine.setCpuPc(0x8000);
  machine.executeInstruction();
  expect(machine.getTapeMode()).toBe(Sp48TapeMode.Save);
}

function createSavePulseEmitter(machine: Awaited<ReturnType<typeof createMachine>>) {
  let micBit = true;
  let tacts = machine.tacts;
  return (length: number) => {
    tacts += length;
    micBit = !micBit;
    machine.setTacts(tacts);
    machine.writePort(0x00fe, micBit ? 0x08 : 0x00);
  };
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

function createTapBlock(flag: number, payload: Uint8Array): Uint8Array {
  let checksum = flag & 0xff;
  const block = new Uint8Array(payload.length + 2);
  block[0] = flag & 0xff;
  payload.forEach((byte, index) => {
    block[index + 1] = byte;
    checksum ^= byte;
  });
  block[block.length - 1] = checksum;
  return block;
}
