import { readFileSync } from "node:fs";

import type {
  ZxNextOracleComparison,
  ZxNextOracleDebugSnapshot,
  ZxNextOracleMemoryRead,
  ZxNextOracleMemorySnapshot,
  ZxNextOracleNextRegSnapshot,
  ZxNextOraclePortSnapshot,
  ZxNextOracleSnapshot
} from "./wasm-next-oracle-types";
import type {
  ZxNextWasmV2Diagnostics,
  ZxNextWasmV2ScaffoldSurface
} from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { buildZxNextWasm, productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";
import { createTestNextMachine, TestZxNextMachine } from "../../zxnext/TestNextMachine";
import {
  ZXNEXT_WASM_V2_SCAFFOLD_SURFACES,
  ZxNextWasmV2Machine
} from "@emu/machines/zxNext/ZxNextWasmV2Machine";

export const ZXNEXT_ORACLE_SCAFFOLD_SURFACES: ZxNextWasmV2ScaffoldSurface[] = [
  "registers",
  "memory",
  "disassembly",
  "ULA",
  "screen",
  "frame",
  "debug"
];

const MEMORY_SAMPLE_ADDRESSES = [0x0000, 0x4000, 0x8000, 0xc000];
const NEXT_REG_SAMPLE_IDS = [0x00, 0x01, 0x12, 0x15];
let zxNextWasmBuilt = false;

export type ZxNextOracleHarness = {
  oracle: TestZxNextMachine;
  wasm: ZxNextWasmV2Machine;
};

export async function buildZxNextWasmArtifact(force = false): Promise<void> {
  if (!force && zxNextWasmBuilt) return;
  buildZxNextWasm();
  zxNextWasmBuilt = true;
}

export async function createTestZxNextWasmMachine(): Promise<ZxNextWasmV2Machine> {
  await buildZxNextWasmArtifact();
  const machine = new ZxNextWasmV2Machine(
    undefined,
    undefined,
    undefined,
    {
      artifactName: "test-zxnext-oracle-harness.wasm",
      readArtifact: async () => readFileSync(productionOutput)
    }
  );
  await machine.setup();
  return machine;
}

export async function createOracleZxNextMachine(): Promise<TestZxNextMachine> {
  return createTestNextMachine();
}

export async function createZxNextOracleHarness(): Promise<ZxNextOracleHarness> {
  const oracle = await createOracleZxNextMachine();
  const wasm = await createTestZxNextWasmMachine();
  return { oracle, wasm };
}

export async function createZxNextOracleComparison(): Promise<ZxNextOracleComparison> {
  const { oracle, wasm } = await createZxNextOracleHarness();
  const oracleDebugSupport = new DebugSupport(undefined, [{ address: 0x8000, exec: true }]);
  const wasmDebugSupport = new DebugSupport(undefined, [{ address: 0x8000, exec: true }]);
  const snapshotOrder: ZxNextOracleComparison["snapshotOrder"] = [];

  const oracleSnapshot = captureMachineSnapshot(oracle, "typescript", oracleDebugSupport);
  snapshotOrder.push("typescript");
  const wasmSnapshot = captureMachineSnapshot(wasm, "wasm", wasmDebugSupport);
  snapshotOrder.push("wasm");

  return {
    oracle: oracleSnapshot,
    wasm: wasmSnapshot,
    wasmDiagnostics: wasm.getWasmV2Diagnostics(),
    snapshotOrder
  };
}

export function expectScaffoldDiagnosticsHaveOracleCoverage(
  diagnostics: Pick<ZxNextWasmV2Diagnostics, "implementationIncomplete" | "scaffoldSurfaces">,
  oracleSnapshot: ZxNextOracleSnapshot
): void {
  if (diagnostics.implementationIncomplete !== true) {
    throw new Error("ZX Next WASM diagnostics must keep implementationIncomplete=true until parity assertions replace the scaffold.");
  }
  for (const surface of diagnostics.scaffoldSurfaces) {
    if (!oracleSnapshot.coveredSurfaces.includes(surface)) {
      throw new Error(`ZX Next WASM scaffold surface '${surface}' has no TypeScript oracle snapshot coverage.`);
    }
  }
}

export function expectCurrentScaffoldDiagnosticsAreStillGuarded(
  diagnostics: Pick<ZxNextWasmV2Diagnostics, "scaffoldSurfaces">
): void {
  const actual = [...diagnostics.scaffoldSurfaces].sort();
  const expected = [...ZXNEXT_WASM_V2_SCAFFOLD_SURFACES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `ZX Next WASM scaffold diagnostics changed without updating oracle coverage. Actual: ${actual.join(", ")}; expected: ${expected.join(", ")}.`
    );
  }
}

function captureMachineSnapshot(
  machine: TestZxNextMachine | ZxNextWasmV2Machine,
  backend: ZxNextOracleSnapshot["backend"],
  debugSupport: DebugSupport
): ZxNextOracleSnapshot {
  machine.hardReset();
  seedMachineState(machine);
  const memory = captureMemorySnapshot(machine);
  const nextRegs = captureNextRegSnapshot(machine);
  const ports = capturePortSnapshot(machine);
  const debug = captureDebugSnapshot(machine, debugSupport);
  const cpu = machine.getCpuState();

  return {
    backend,
    coveredSurfaces: ZXNEXT_ORACLE_SCAFFOLD_SURFACES.slice(),
    cpu: {
      af: cpu.af,
      bc: cpu.bc,
      de: cpu.de,
      hl: cpu.hl,
      af_: cpu.af_,
      bc_: cpu.bc_,
      de_: cpu.de_,
      hl_: cpu.hl_,
      ix: cpu.ix,
      iy: cpu.iy,
      ir: cpu.ir,
      wz: cpu.wz,
      pc: cpu.pc,
      sp: cpu.sp,
      iff1: cpu.iff1,
      iff2: cpu.iff2,
      interruptMode: cpu.interruptMode,
      halted: cpu.halted,
      tacts: cpu.tacts,
      frameTacts: machine.frameTacts,
      currentFrameTact: machine.currentFrameTact,
      frames: machine.frames
    },
    memory,
    ports,
    nextRegs,
    debug,
    screen: {
      width: machine.screenWidthInPixels,
      height: machine.screenHeightInPixels,
      pixelCount: machine.getPixelBuffer().length
    }
  };
}

function seedMachineState(machine: TestZxNextMachine | ZxNextWasmV2Machine): void {
  machine.af = 0x1234;
  machine.bc = 0x5678;
  machine.de = 0x9abc;
  machine.hl = 0xdef0;
  machine.af_ = 0x0102;
  machine.bc_ = 0x0304;
  machine.de_ = 0x0506;
  machine.hl_ = 0x0708;
  machine.ix = 0x1111;
  machine.iy = 0x2222;
  machine.ir = 0x3344;
  machine.wz = 0x5566;
  machine.pc = 0x8000;
  machine.sp = 0xff00;
  machine.iff1 = true;
  machine.iff2 = true;
  machine.interruptMode = 1;
  machine.doWriteMemory(0x4000, 0x5a);
  machine.doWriteMemory(0x8000, 0x00);
  machine.doWriteMemory(0xc000, 0xa5);
}

function captureMemorySnapshot(
  machine: TestZxNextMachine | ZxNextWasmV2Machine
): ZxNextOracleMemorySnapshot {
  const flatMemory = machine.get64KFlatMemory();
  const flatReads = MEMORY_SAMPLE_ADDRESSES.map<ZxNextOracleMemoryRead>(address => ({
    address,
    partition: machine.getPartition(address),
    value: flatMemory[address]
  }));
  const mappedReads = MEMORY_SAMPLE_ADDRESSES.map<ZxNextOracleMemoryRead>(address => ({
    address,
    partition: machine.getPartition(address),
    value: machine.doReadMemory(address)
  }));
  return {
    flatReads,
    mappedReads,
    currentPartitions: machine.getCurrentPartitions(),
    partitionLabels: machine.getCurrentPartitionLabels(),
    selectedRom: machine.getSelectedRomPage(),
    selectedBank: machine.getSelectedRamBank()
  };
}

function captureNextRegSnapshot(
  machine: TestZxNextMachine | ZxNextWasmV2Machine
): ZxNextOracleNextRegSnapshot {
  machine.tbblueOut(0x12, 0x34);
  const state = machine.nextRegDevice.getNextRegDeviceState();
  const sampledValues: Record<number, number | undefined> = {};
  for (const id of NEXT_REG_SAMPLE_IDS) {
    sampledValues[id] = state.regs.find(reg => reg.id === id)?.value;
  }
  const selected = state.regs.find(reg => reg.id === 0x12);
  return {
    selectedRegister: 0x12,
    selectedLastWrite: selected?.lastWrite,
    selectedValue: selected?.value,
    lastRegisterIndex: state.lastRegisterIndex,
    sampledValues
  };
}

function capturePortSnapshot(
  machine: TestZxNextMachine | ZxNextWasmV2Machine
): ZxNextOraclePortSnapshot {
  machine.doWritePort(0x00fe, 0x18);
  const writePort = machine.lastIoWritePort;
  const writeValue = machine.lastIoWriteValue;
  const readValue = machine.doReadPort(0x00fe);
  return {
    writeAddress: 0x00fe,
    writeValue: 0x18,
    readAddress: 0x00fe,
    readValue,
    lastIoWritePort: writePort,
    lastIoWriteValue: writeValue,
    lastIoReadPort: machine.lastIoReadPort,
    lastIoReadValue: machine.lastIoReadValue
  };
}

function captureDebugSnapshot(
  machine: TestZxNextMachine | ZxNextWasmV2Machine,
  debugSupport: DebugSupport
): ZxNextOracleDebugSnapshot {
  machine.pc = 0x8000;
  machine.doWriteMemory(0x8000, 0x00);
  machine.executionContext.frameTerminationMode = FrameTerminationMode.DebugEvent;
  machine.executionContext.debugStepMode = DebugStepMode.StepInto;
  machine.executionContext.debugSupport = debugSupport;
  const termination = machine.executeMachineFrame();
  const disassemblySections = machine.getDisassemblySections({ ram: true, screen: true });
  const disassemblyPreview = [
    machine.doReadMemory(0x8000),
    machine.doReadMemory(0x8001),
    machine.doReadMemory(0x8002),
    machine.doReadMemory(0x8003)
  ];

  return {
    termination,
    lastTerminationReason: machine.executionContext.lastTerminationReason,
    breakpointCount: debugSupport.breakpoints.length,
    disassemblySections: disassemblySections.filter(
      section => section.sectionType === MemorySectionType.Disassemble
    ),
    disassemblyPreview
  };
}
