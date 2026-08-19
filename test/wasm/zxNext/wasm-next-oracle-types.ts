import type { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { IMemorySection } from "@abstractions/MemorySection";
import type {
  ZxNextWasmV2Diagnostics,
  ZxNextWasmV2ScaffoldSurface
} from "@emu/machines/zxNext/ZxNextWasmV2Machine";

export type ZxNextOracleBackend = "typescript" | "wasm";

export type ZxNextOracleCpuSnapshot = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  pc: number;
  sp: number;
  iff1: boolean;
  iff2: boolean;
  interruptMode: number;
  halted: boolean;
  prefix: number;
  tacts: number;
  frameTacts: number;
  currentFrameTact: number;
  frames: number;
};

export type ZxNextOracleMemoryRead = {
  address: number;
  partition?: number;
  value: number;
};

export type ZxNextOracleMemorySnapshot = {
  flatReads: ZxNextOracleMemoryRead[];
  mappedReads: ZxNextOracleMemoryRead[];
  currentPartitions: number[];
  partitionLabels: string[];
  selectedRom: number;
  selectedBank: number;
};

export type ZxNextOraclePortSnapshot = {
  writeAddress: number;
  writeValue: number;
  readAddress: number;
  readValue: number;
  lastIoWritePort?: number;
  lastIoWriteValue?: number;
  lastIoReadPort?: number;
  lastIoReadValue?: number;
};

export type ZxNextOracleNextRegSnapshot = {
  selectedRegister: number;
  selectedLastWrite?: number;
  selectedValue?: number;
  lastRegisterIndex: number;
  sampledValues: Record<number, number | undefined>;
};

export type ZxNextOracleDebugSnapshot = {
  termination: FrameTerminationMode;
  lastTerminationReason?: FrameTerminationMode;
  breakpointCount: number;
  disassemblySections: IMemorySection[];
  disassemblyPreview: number[];
};

export type ZxNextOracleSnapshot = {
  backend: ZxNextOracleBackend;
  coveredSurfaces: ZxNextWasmV2ScaffoldSurface[];
  cpu: ZxNextOracleCpuSnapshot;
  memory: ZxNextOracleMemorySnapshot;
  ports: ZxNextOraclePortSnapshot;
  nextRegs: ZxNextOracleNextRegSnapshot;
  debug: ZxNextOracleDebugSnapshot;
  screen: {
    width: number;
    height: number;
    pixelCount: number;
  };
};

export type ZxNextOracleComparison = {
  oracle: ZxNextOracleSnapshot;
  wasm: ZxNextOracleSnapshot;
  wasmDiagnostics: ZxNextWasmV2Diagnostics;
  snapshotOrder: ZxNextOracleBackend[];
};
