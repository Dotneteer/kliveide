import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import {
  OFFS_ALT_ROM_0,
  OFFS_DIVMMC_ROM,
  OFFS_MULTIFACE_MEM,
  OFFS_NEXT_ROM
} from "@emu/machines/zxNext/MemoryDevice";
import { TestZxNextMachine } from "../../zxnext/TestNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createZxNextOracleHarness } from "./wasm-next-test-helpers";

const BOOT_STEP_COUNT = 2;
const ROM_SAMPLE_ADDRESSES = [0x0000, 0x0001, 0x0002, 0x0003, 0x00ef, 0x00f0];
const NEXT_REG_SAMPLE_IDS = [
  0x00, 0x01, 0x03, 0x07, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x8a, 0x8c, 0x8e, 0x8f,
  0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0xc0
];

type BootTraceMachine = TestZxNextMachine | ZxNextWasmV2Machine;

export type ZxNextBootRomImages = ReturnType<typeof readZxNextBootRomImages>;

export type ZxNextBootTraceSnapshot = {
  label: string;
  termination?: FrameTerminationMode;
  lastTerminationReason?: FrameTerminationMode;
  pc: number;
  sp: number;
  tacts: number;
  activeMmuPages: {
    page: number;
    readOffset: number;
    writeOffset: number | null;
    bank16k: number;
    bank8k: number;
  }[];
  romByteReads: Record<string, number>;
  nextRegs: Record<string, number>;
  interruptState: {
    iff1: boolean;
    iff2: boolean;
    interruptMode: number;
    sigInt: boolean;
    sigNmi: boolean;
  };
  sdState: {
    selectedCard: number;
    card0State: number;
    card1State: number;
    hostCommand: number;
    hostSector: number;
    responseReady0: boolean;
    responseReady1: boolean;
  };
  screenChecksum: number;
  stopReason: string;
};

export type ZxNextBootTraceResult = {
  oracle: ZxNextBootTraceSnapshot[];
  wasm: ZxNextBootTraceSnapshot[];
  wasmDiagnostics: {
    nextRomChecksum: number;
    divMmcRomChecksum: number;
    multifaceRomChecksum: number;
    altRomChecksum: number;
    physicalBytes: Record<string, number>;
  };
};

export async function createEarlyBootTrace(): Promise<ZxNextBootTraceResult> {
  return createBootTrace(BOOT_STEP_COUNT);
}

export async function createBootTrace(stepCount = BOOT_STEP_COUNT): Promise<ZxNextBootTraceResult> {
  const roms = readZxNextBootRomImages();
  const { oracle, wasm } = await createZxNextOracleHarness();
  wasm.uploadWasmV2RomImages(roms);

  initializeBootTraceMachine(oracle);
  initializeBootTraceMachine(wasm);

  const oracleTrace = collectBootTrace(oracle, stepCount);
  const wasmTrace = collectBootTrace(wasm, stepCount);

  return {
    oracle: oracleTrace,
    wasm: wasmTrace,
    wasmDiagnostics: {
      nextRomChecksum: wasm.wasmV2Runtime!.exports.zxnextChecksumPhysicalMemory(OFFS_NEXT_ROM, roms.nextRom.length) >>> 0,
      divMmcRomChecksum: wasm.wasmV2Runtime!.exports.zxnextChecksumPhysicalMemory(OFFS_DIVMMC_ROM, roms.divMmcRom.length) >>> 0,
      multifaceRomChecksum: wasm.wasmV2Runtime!.exports.zxnextChecksumPhysicalMemory(OFFS_MULTIFACE_MEM, roms.multifaceRom.length) >>> 0,
      altRomChecksum: wasm.wasmV2Runtime!.exports.zxnextChecksumPhysicalMemory(OFFS_ALT_ROM_0, roms.altRom.length) >>> 0,
      physicalBytes: {
        nextRom0: wasm.wasmV2Runtime!.exports.zxnextReadPhysicalMemory(OFFS_NEXT_ROM),
        divMmcRom0: wasm.wasmV2Runtime!.exports.zxnextReadPhysicalMemory(OFFS_DIVMMC_ROM),
        multifaceRom0: wasm.wasmV2Runtime!.exports.zxnextReadPhysicalMemory(OFFS_MULTIFACE_MEM),
        altRom0: wasm.wasmV2Runtime!.exports.zxnextReadPhysicalMemory(OFFS_ALT_ROM_0)
      }
    }
  };
}

export function readZxNextBootRomImages() {
  const romRoot = resolve(__dirname, "../../../src/public/roms");
  return {
    nextRom: readFileSync(resolve(romRoot, "enNextZX.rom")),
    divMmcRom: readFileSync(resolve(romRoot, "enNxtmmc.rom")),
    multifaceRom: readFileSync(resolve(romRoot, "enNextMf.rom")),
    altRom: readFileSync(resolve(romRoot, "enAltZX.rom"))
  };
}

export function checksumBytes(bytes: Uint8Array): number {
  let checksum = 2166136261;
  for (const byte of bytes) {
    checksum ^= byte;
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }
  return checksum >>> 0;
}

function initializeBootTraceMachine(machine: BootTraceMachine): void {
  machine.reset();
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
  machine.executionContext.debugSupport = new DebugSupport(undefined, []);
  machine.executionContext.lastTerminationReason = undefined;
}

function collectBootTrace(machine: BootTraceMachine, stepCount: number): ZxNextBootTraceSnapshot[] {
  const snapshots = [captureBootSnapshot(machine, "reset")];
  for (let step = 1; step <= stepCount; step++) {
    const termination = machine.executeMachineFrame();
    snapshots.push(captureBootSnapshot(machine, `step-${step}`, termination));
  }
  return snapshots;
}

function captureBootSnapshot(
  machine: BootTraceMachine,
  label: string,
  termination?: FrameTerminationMode
): ZxNextBootTraceSnapshot {
  const cpu = machine.getCpuState();
  return {
    label,
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    pc: cpu.pc,
    sp: cpu.sp,
    tacts: cpu.tacts,
    activeMmuPages: captureActiveMmuPages(machine),
    romByteReads: Object.fromEntries(
      ROM_SAMPLE_ADDRESSES.map(address => [hex(address), machine.doReadMemory(address)])
    ),
    nextRegs: Object.fromEntries(
      NEXT_REG_SAMPLE_IDS.map(reg => {
        const state = machine.nextRegDevice.getNextRegDeviceState().regs.find(item => item.id === reg);
        return [hex(reg, 2), state?.lastWrite ?? state?.value ?? 0];
      })
    ),
    interruptState: {
      iff1: cpu.iff1,
      iff2: cpu.iff2,
      interruptMode: cpu.interruptMode,
      sigInt: cpu.sigINT,
      sigNmi: machine.sigNMI
    },
    sdState: captureSdState(machine),
    screenChecksum: captureScreenChecksum(machine),
    stopReason: describeStopReason(machine, termination)
  };
}

function captureActiveMmuPages(machine: BootTraceMachine): ZxNextBootTraceSnapshot["activeMmuPages"] {
  if (machine instanceof ZxNextWasmV2Machine) {
    const wasm = machine.wasmV2Runtime!.exports;
    return Array.from({ length: 8 }, (_, page) => ({
      page,
      readOffset: wasm.zxnextGetMemoryPageReadOffset(page),
      writeOffset: normalizeWasmOffset(wasm.zxnextGetMemoryPageWriteOffset(page)),
      bank16k: wasm.zxnextGetMemoryPageBank16(page),
      bank8k: wasm.zxnextGetMemoryPageBank8(page)
    }));
  }

  return Array.from({ length: 8 }, (_, page) => {
    const pageInfo = machine.memoryDevice.getPageInfo(page);
    return {
      page,
      readOffset: pageInfo.readOffset,
      writeOffset: pageInfo.writeOffset,
      bank16k: pageInfo.bank16k ?? 0xff,
      bank8k: pageInfo.bank8k ?? 0xff
    };
  });
}

function hex(value: number, digits = 4): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}

function normalizeWasmOffset(offset: number): number | null {
  const normalized = offset >>> 0;
  return normalized === 0xffffffff ? null : normalized;
}

function captureSdState(machine: BootTraceMachine): ZxNextBootTraceSnapshot["sdState"] {
  if (machine instanceof ZxNextWasmV2Machine) {
    const wasm = machine.wasmV2Runtime!.exports;
    return {
      selectedCard: wasm.zxnextGetSdSelectedCard(),
      card0State: wasm.zxnextGetSdState(0),
      card1State: wasm.zxnextGetSdState(1),
      hostCommand: wasm.zxnextGetSdHostCommand(),
      hostSector: wasm.zxnextGetSdHostSector(),
      responseReady0: wasm.zxnextGetSdResponseReady(0) !== 0,
      responseReady1: wasm.zxnextGetSdResponseReady(1) !== 0
    };
  }

  const sdCardDevice = machine.sdCardDevice as any;
  return {
    selectedCard: sdCardDevice.selectedCard,
    card0State: sdCardDevice._state,
    card1State: sdCardDevice._state1,
    hostCommand: storageCommandId(machine.getFrameCommand()?.command),
    hostSector: machine.getFrameCommand()?.sector ?? 0,
    responseReady0: sdCardDevice._responseReady,
    responseReady1: sdCardDevice._responseReady1
  };
}

function storageCommandId(command: string | undefined): number {
  switch (command) {
    case "sd-read": return 1;
    case "sd-write": return 2;
    case "sd-read-card1": return 3;
    case "sd-write-card1": return 4;
    default: return 0;
  }
}

function checksumWords(words: Uint32Array): number {
  let checksum = 2166136261;
  for (const word of words) {
    checksum ^= word & 0xff;
    checksum = Math.imul(checksum, 16777619) >>> 0;
    checksum ^= (word >>> 8) & 0xff;
    checksum = Math.imul(checksum, 16777619) >>> 0;
    checksum ^= (word >>> 16) & 0xff;
    checksum = Math.imul(checksum, 16777619) >>> 0;
    checksum ^= (word >>> 24) & 0xff;
    checksum = Math.imul(checksum, 16777619) >>> 0;
  }
  return checksum >>> 0;
}

function captureScreenChecksum(machine: BootTraceMachine): number {
  machine.renderInstantScreen();
  return checksumWords(machine.getPixelBuffer().subarray(0, 64));
}

function describeStopReason(machine: BootTraceMachine, termination?: FrameTerminationMode): string {
  const frameCommand = machine.getFrameCommand();
  if (frameCommand != null) return `frame-command:${frameCommand.command}`;
  if (termination != null) return FrameTerminationMode[termination] ?? String(termination);
  return "sample";
}
