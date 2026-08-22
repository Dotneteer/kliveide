import type { ZxNextMachine } from "../ZxNextMachine";

import {
  OFFS_ALT_ROM_0,
  OFFS_ALT_ROM_1,
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_ROM,
  OFFS_ERR_PAGE,
  OFFS_MULTIFACE_MEM,
  OFFS_NEXT_RAM,
  OFFS_NEXT_ROM
} from "../MemoryDevice";

export const ZXNEXT_FRAME_TRACE_MAGIC = 0x5854465a;
export const ZXNEXT_FRAME_TRACE_VERSION = 1;
export const ZXNEXT_FRAME_TRACE_HEADER_SIZE = 64;
export const ZXNEXT_FRAME_TRACE_RECORD_SIZE = 128;
export const ZXNEXT_FRAME_TRACE_CAPACITY = 160_000;

export const ZXNEXT_FRAME_TRACE_TOTAL_BYTES =
  ZXNEXT_FRAME_TRACE_HEADER_SIZE +
  ZXNEXT_FRAME_TRACE_CAPACITY * ZXNEXT_FRAME_TRACE_RECORD_SIZE;

export const enum ZxNextTraceHeaderOffset {
  Magic = 0,
  Version = 4,
  RecordSize = 6,
  Capacity = 8,
  Count = 12,
  Overflow = 16,
  FrameIndex = 20,
  TactsInFrame28 = 24,
  StartTactsLow = 28,
  StartTactsHigh = 32,
  EndTactsLow = 36,
  EndTactsHigh = 40
}

export const enum ZxNextTraceRecordOffset {
  Sequence = 0,
  FrameTact28After = 4,
  MachineTactsLow = 8,
  MachineTactsHigh = 12,
  PcBefore = 16,
  PcAfter = 18,
  Af = 20,
  Bc = 22,
  De = 24,
  Hl = 26,
  AfAlt = 28,
  BcAlt = 30,
  DeAlt = 32,
  HlAlt = 34,
  Ix = 36,
  Iy = 38,
  Ir = 40,
  Wz = 42,
  Sp = 44,
  CpuFlagsPacked = 46,
  ExecutedInstructions = 48,
  TotalContentionDelay = 52,
  ContentionDelaySincePause = 56,
  LastMemoryAddress = 60,
  LastPortAddress = 62,
  LastMemoryValue = 64,
  LastPortValue = 65,
  LastMemoryFlags = 66,
  LastPortFlags = 67,
  CpuEffectiveSpeed = 68,
  CpuTactScale = 69,
  NextRegIndex = 70,
  Status2 = 71,
  MmuRaw = 72,
  ReadMap = 80,
  WriteMap = 96,
  PagingRegs = 112,
  ExtensionHash = 120,
  RecordFlags = 124
}

export type ZxNextFrameTraceHeader = {
  magic: number;
  version: number;
  recordSize: number;
  capacity: number;
  count: number;
  overflow: number;
  frameIndex: number;
  tactsInFrame28: number;
  startTacts: number;
  endTacts: number;
};

export type ZxNextFrameTraceRecord = {
  sequence: number;
  frameTact28After: number;
  machineTacts: number;
  pcBefore: number;
  pcAfter: number;
  af: number;
  bc: number;
  de: number;
  hl: number;
  afAlt: number;
  bcAlt: number;
  deAlt: number;
  hlAlt: number;
  ix: number;
  iy: number;
  ir: number;
  wz: number;
  sp: number;
  cpuFlagsPacked: number;
  executedInstructions: number;
  totalContentionDelay: number;
  contentionDelaySincePause: number;
  lastMemoryAddress: number;
  lastPortAddress: number;
  lastMemoryValue: number;
  lastPortValue: number;
  lastMemoryFlags: number;
  lastPortFlags: number;
  cpuEffectiveSpeed: number;
  cpuTactScale: number;
  nextRegIndex: number;
  status2: number;
  mmuRaw: number[];
  readMap: number[];
  writeMap: number[];
  pagingRegs: number[];
  extensionHash: number;
  recordFlags: number;
};

export type ZxNextFrameTraceField = {
  readonly name: string;
  readonly offset: number;
  readonly byteLength: number;
};

export type ZxNextFrameTraceDifference = {
  readonly kind: "match" | "header" | "overflow" | "record-count" | "record";
  readonly frameCount: number;
  readonly frameIndex: number;
  readonly instructionIndex?: number;
  readonly fieldName?: string;
  readonly typescriptValue?: string;
  readonly wasmValue?: string;
  readonly lastMatchingRecord?: ZxNextFrameTraceRecord;
  readonly typescriptRecord?: ZxNextFrameTraceRecord;
  readonly wasmRecord?: ZxNextFrameTraceRecord;
  readonly message: string;
};

export const ZXNEXT_TRACE_RECORD_FIELDS: ZxNextFrameTraceField[] = [
  { name: "sequence", offset: ZxNextTraceRecordOffset.Sequence, byteLength: 4 },
  { name: "frameTact28After", offset: ZxNextTraceRecordOffset.FrameTact28After, byteLength: 4 },
  { name: "machineTacts", offset: ZxNextTraceRecordOffset.MachineTactsLow, byteLength: 8 },
  { name: "pcBefore", offset: ZxNextTraceRecordOffset.PcBefore, byteLength: 2 },
  { name: "pcAfter", offset: ZxNextTraceRecordOffset.PcAfter, byteLength: 2 },
  { name: "af", offset: ZxNextTraceRecordOffset.Af, byteLength: 2 },
  { name: "bc", offset: ZxNextTraceRecordOffset.Bc, byteLength: 2 },
  { name: "de", offset: ZxNextTraceRecordOffset.De, byteLength: 2 },
  { name: "hl", offset: ZxNextTraceRecordOffset.Hl, byteLength: 2 },
  { name: "afAlt", offset: ZxNextTraceRecordOffset.AfAlt, byteLength: 2 },
  { name: "bcAlt", offset: ZxNextTraceRecordOffset.BcAlt, byteLength: 2 },
  { name: "deAlt", offset: ZxNextTraceRecordOffset.DeAlt, byteLength: 2 },
  { name: "hlAlt", offset: ZxNextTraceRecordOffset.HlAlt, byteLength: 2 },
  { name: "ix", offset: ZxNextTraceRecordOffset.Ix, byteLength: 2 },
  { name: "iy", offset: ZxNextTraceRecordOffset.Iy, byteLength: 2 },
  { name: "ir", offset: ZxNextTraceRecordOffset.Ir, byteLength: 2 },
  { name: "wz", offset: ZxNextTraceRecordOffset.Wz, byteLength: 2 },
  { name: "sp", offset: ZxNextTraceRecordOffset.Sp, byteLength: 2 },
  { name: "cpuFlagsPacked", offset: ZxNextTraceRecordOffset.CpuFlagsPacked, byteLength: 2 },
  { name: "executedInstructions", offset: ZxNextTraceRecordOffset.ExecutedInstructions, byteLength: 4 },
  { name: "totalContentionDelay", offset: ZxNextTraceRecordOffset.TotalContentionDelay, byteLength: 4 },
  { name: "contentionDelaySincePause", offset: ZxNextTraceRecordOffset.ContentionDelaySincePause, byteLength: 4 },
  { name: "lastMemoryAddress", offset: ZxNextTraceRecordOffset.LastMemoryAddress, byteLength: 2 },
  { name: "lastPortAddress", offset: ZxNextTraceRecordOffset.LastPortAddress, byteLength: 2 },
  { name: "lastMemoryValue", offset: ZxNextTraceRecordOffset.LastMemoryValue, byteLength: 1 },
  { name: "lastPortValue", offset: ZxNextTraceRecordOffset.LastPortValue, byteLength: 1 },
  { name: "lastMemoryFlags", offset: ZxNextTraceRecordOffset.LastMemoryFlags, byteLength: 1 },
  { name: "lastPortFlags", offset: ZxNextTraceRecordOffset.LastPortFlags, byteLength: 1 },
  { name: "cpuEffectiveSpeed", offset: ZxNextTraceRecordOffset.CpuEffectiveSpeed, byteLength: 1 },
  { name: "cpuTactScale", offset: ZxNextTraceRecordOffset.CpuTactScale, byteLength: 1 },
  { name: "nextRegIndex", offset: ZxNextTraceRecordOffset.NextRegIndex, byteLength: 1 },
  { name: "status2", offset: ZxNextTraceRecordOffset.Status2, byteLength: 1 },
  { name: "mmuRaw", offset: ZxNextTraceRecordOffset.MmuRaw, byteLength: 8 },
  { name: "readMap", offset: ZxNextTraceRecordOffset.ReadMap, byteLength: 16 },
  { name: "writeMap", offset: ZxNextTraceRecordOffset.WriteMap, byteLength: 16 },
  { name: "pagingRegs", offset: ZxNextTraceRecordOffset.PagingRegs, byteLength: 8 },
  { name: "extensionHash", offset: ZxNextTraceRecordOffset.ExtensionHash, byteLength: 4 },
  { name: "recordFlags", offset: ZxNextTraceRecordOffset.RecordFlags, byteLength: 4 }
];

const TRACE_MAP_KIND_NONE = 0;
const TRACE_MAP_KIND_NEXT_ROM = 1;
const TRACE_MAP_KIND_MAIN_RAM = 2;
const TRACE_MAP_KIND_DIVMMC_ROM = 3;
const TRACE_MAP_KIND_DIVMMC_RAM = 4;
const TRACE_MAP_KIND_MULTIFACE = 5;
const TRACE_MAP_KIND_ALT_ROM = 6;
const TRACE_MAP_KIND_SENTINEL = 7;
const TRACE_MAP_READ_ONLY = 1 << 13;

export class ZxNextFrameTraceRecorder {
  readonly buffer: ArrayBuffer;
  readonly bytes: Uint8Array;
  private readonly view: DataView;
  private count = 0;
  private overflow = 0;
  private enabled = false;

  constructor(
    private readonly machine: ZxNextMachine,
    readonly capacity = ZXNEXT_FRAME_TRACE_CAPACITY
  ) {
    this.buffer = new ArrayBuffer(ZXNEXT_FRAME_TRACE_HEADER_SIZE + capacity * ZXNEXT_FRAME_TRACE_RECORD_SIZE);
    this.bytes = new Uint8Array(this.buffer);
    this.view = new DataView(this.buffer);
  }

  beginFrame(frameIndex = this.machine.frames): void {
    this.bytes.fill(0);
    this.count = 0;
    this.overflow = 0;
    this.enabled = true;
    writeTraceHeader(this.view, {
      capacity: this.capacity,
      count: 0,
      overflow: 0,
      frameIndex,
      tactsInFrame28: this.machine.tactsInFrame,
      startTacts: this.machine.tacts,
      endTacts: 0
    });
  }

  endFrame(): void {
    this.enabled = false;
    this.view.setUint32(ZxNextTraceHeaderOffset.Count, this.count, true);
    this.view.setUint32(ZxNextTraceHeaderOffset.Overflow, this.overflow, true);
    writeUint64Parts(this.view, ZxNextTraceHeaderOffset.EndTactsLow, this.machine.tacts);
  }

  recordInstruction(pcBefore: number): void {
    if (!this.enabled) return;
    if (this.count >= this.capacity) {
      if (this.overflow === 0) {
        this.overflow = this.count + 1;
        this.view.setUint32(ZxNextTraceHeaderOffset.Overflow, this.overflow, true);
      }
      return;
    }

    const offset = ZXNEXT_FRAME_TRACE_HEADER_SIZE + this.count * ZXNEXT_FRAME_TRACE_RECORD_SIZE;
    const machine = this.machine;
    this.view.setUint32(offset + ZxNextTraceRecordOffset.Sequence, this.count, true);
    this.view.setUint32(offset + ZxNextTraceRecordOffset.FrameTact28After, machine.frameTacts >>> 0, true);
    writeUint64Parts(this.view, offset + ZxNextTraceRecordOffset.MachineTactsLow, machine.tacts);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.PcBefore, pcBefore & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.PcAfter, machine.pc & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Af, machine.af & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Bc, machine.bc & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.De, machine.de & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Hl, machine.hl & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.AfAlt, machine.af_ & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.BcAlt, machine.bc_ & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.DeAlt, machine.de_ & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.HlAlt, machine.hl_ & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Ix, machine.ix & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Iy, machine.iy & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Ir, machine.ir & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Wz, machine.wz & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.Sp, machine.sp & 0xffff, true);
    this.view.setUint16(offset + ZxNextTraceRecordOffset.CpuFlagsPacked, packCpuFlags(machine), true);
    this.view.setUint32(offset + ZxNextTraceRecordOffset.ExecutedInstructions, this.count + 1, true);
    this.view.setUint32(offset + ZxNextTraceRecordOffset.TotalContentionDelay, machine.totalContentionDelaySinceStart >>> 0, true);
    this.view.setUint32(offset + ZxNextTraceRecordOffset.ContentionDelaySincePause, machine.contentionDelaySincePause >>> 0, true);
    writeLastAccesses(this.view, offset, machine);
    this.view.setUint8(offset + ZxNextTraceRecordOffset.CpuEffectiveSpeed, machine.cpuSpeedDevice.effectiveSpeed & 0xff);
    this.view.setUint8(offset + ZxNextTraceRecordOffset.CpuTactScale, machine.cpuTactScale & 0xff);
    this.view.setUint8(offset + ZxNextTraceRecordOffset.NextRegIndex, machine.nextRegDevice.getNextRegisterIndex() & 0xff);
    writeMemoryMaps(this.view, offset, machine);
    this.count++;
    this.view.setUint32(ZxNextTraceHeaderOffset.Count, this.count, true);
  }
}

export function writeTraceHeader(
  view: DataView,
  values: {
    capacity: number;
    count: number;
    overflow: number;
    frameIndex: number;
    tactsInFrame28: number;
    startTacts: number;
    endTacts: number;
  }
): void {
  view.setUint32(ZxNextTraceHeaderOffset.Magic, ZXNEXT_FRAME_TRACE_MAGIC, true);
  view.setUint16(ZxNextTraceHeaderOffset.Version, ZXNEXT_FRAME_TRACE_VERSION, true);
  view.setUint16(ZxNextTraceHeaderOffset.RecordSize, ZXNEXT_FRAME_TRACE_RECORD_SIZE, true);
  view.setUint32(ZxNextTraceHeaderOffset.Capacity, values.capacity >>> 0, true);
  view.setUint32(ZxNextTraceHeaderOffset.Count, values.count >>> 0, true);
  view.setUint32(ZxNextTraceHeaderOffset.Overflow, values.overflow >>> 0, true);
  view.setUint32(ZxNextTraceHeaderOffset.FrameIndex, values.frameIndex >>> 0, true);
  view.setUint32(ZxNextTraceHeaderOffset.TactsInFrame28, values.tactsInFrame28 >>> 0, true);
  writeUint64Parts(view, ZxNextTraceHeaderOffset.StartTactsLow, values.startTacts);
  writeUint64Parts(view, ZxNextTraceHeaderOffset.EndTactsLow, values.endTacts);
}

export function readTraceHeader(trace: ArrayBuffer | Uint8Array): ZxNextFrameTraceHeader {
  const view = toDataView(trace);
  return {
    magic: view.getUint32(ZxNextTraceHeaderOffset.Magic, true),
    version: view.getUint16(ZxNextTraceHeaderOffset.Version, true),
    recordSize: view.getUint16(ZxNextTraceHeaderOffset.RecordSize, true),
    capacity: view.getUint32(ZxNextTraceHeaderOffset.Capacity, true),
    count: view.getUint32(ZxNextTraceHeaderOffset.Count, true),
    overflow: view.getUint32(ZxNextTraceHeaderOffset.Overflow, true),
    frameIndex: view.getUint32(ZxNextTraceHeaderOffset.FrameIndex, true),
    tactsInFrame28: view.getUint32(ZxNextTraceHeaderOffset.TactsInFrame28, true),
    startTacts: readUint64Parts(view, ZxNextTraceHeaderOffset.StartTactsLow),
    endTacts: readUint64Parts(view, ZxNextTraceHeaderOffset.EndTactsLow)
  };
}

export function readTraceRecord(trace: ArrayBuffer | Uint8Array, index: number): ZxNextFrameTraceRecord {
  const view = toDataView(trace);
  const offset = ZXNEXT_FRAME_TRACE_HEADER_SIZE + index * ZXNEXT_FRAME_TRACE_RECORD_SIZE;
  return {
    sequence: view.getUint32(offset + ZxNextTraceRecordOffset.Sequence, true),
    frameTact28After: view.getUint32(offset + ZxNextTraceRecordOffset.FrameTact28After, true),
    machineTacts: readUint64Parts(view, offset + ZxNextTraceRecordOffset.MachineTactsLow),
    pcBefore: view.getUint16(offset + ZxNextTraceRecordOffset.PcBefore, true),
    pcAfter: view.getUint16(offset + ZxNextTraceRecordOffset.PcAfter, true),
    af: view.getUint16(offset + ZxNextTraceRecordOffset.Af, true),
    bc: view.getUint16(offset + ZxNextTraceRecordOffset.Bc, true),
    de: view.getUint16(offset + ZxNextTraceRecordOffset.De, true),
    hl: view.getUint16(offset + ZxNextTraceRecordOffset.Hl, true),
    afAlt: view.getUint16(offset + ZxNextTraceRecordOffset.AfAlt, true),
    bcAlt: view.getUint16(offset + ZxNextTraceRecordOffset.BcAlt, true),
    deAlt: view.getUint16(offset + ZxNextTraceRecordOffset.DeAlt, true),
    hlAlt: view.getUint16(offset + ZxNextTraceRecordOffset.HlAlt, true),
    ix: view.getUint16(offset + ZxNextTraceRecordOffset.Ix, true),
    iy: view.getUint16(offset + ZxNextTraceRecordOffset.Iy, true),
    ir: view.getUint16(offset + ZxNextTraceRecordOffset.Ir, true),
    wz: view.getUint16(offset + ZxNextTraceRecordOffset.Wz, true),
    sp: view.getUint16(offset + ZxNextTraceRecordOffset.Sp, true),
    cpuFlagsPacked: view.getUint16(offset + ZxNextTraceRecordOffset.CpuFlagsPacked, true),
    executedInstructions: view.getUint32(offset + ZxNextTraceRecordOffset.ExecutedInstructions, true),
    totalContentionDelay: view.getUint32(offset + ZxNextTraceRecordOffset.TotalContentionDelay, true),
    contentionDelaySincePause: view.getUint32(offset + ZxNextTraceRecordOffset.ContentionDelaySincePause, true),
    lastMemoryAddress: view.getUint16(offset + ZxNextTraceRecordOffset.LastMemoryAddress, true),
    lastPortAddress: view.getUint16(offset + ZxNextTraceRecordOffset.LastPortAddress, true),
    lastMemoryValue: view.getUint8(offset + ZxNextTraceRecordOffset.LastMemoryValue),
    lastPortValue: view.getUint8(offset + ZxNextTraceRecordOffset.LastPortValue),
    lastMemoryFlags: view.getUint8(offset + ZxNextTraceRecordOffset.LastMemoryFlags),
    lastPortFlags: view.getUint8(offset + ZxNextTraceRecordOffset.LastPortFlags),
    cpuEffectiveSpeed: view.getUint8(offset + ZxNextTraceRecordOffset.CpuEffectiveSpeed),
    cpuTactScale: view.getUint8(offset + ZxNextTraceRecordOffset.CpuTactScale),
    nextRegIndex: view.getUint8(offset + ZxNextTraceRecordOffset.NextRegIndex),
    status2: view.getUint8(offset + ZxNextTraceRecordOffset.Status2),
    mmuRaw: readByteArray(view, offset + ZxNextTraceRecordOffset.MmuRaw, 8),
    readMap: readUint16Array(view, offset + ZxNextTraceRecordOffset.ReadMap, 8),
    writeMap: readUint16Array(view, offset + ZxNextTraceRecordOffset.WriteMap, 8),
    pagingRegs: readByteArray(view, offset + ZxNextTraceRecordOffset.PagingRegs, 8),
    extensionHash: view.getUint32(offset + ZxNextTraceRecordOffset.ExtensionHash, true),
    recordFlags: view.getUint32(offset + ZxNextTraceRecordOffset.RecordFlags, true)
  };
}

export function compareZxNextFrameTraces(
  typescriptTrace: ArrayBuffer | Uint8Array,
  wasmTrace: ArrayBuffer | Uint8Array,
  frameCount: number
): ZxNextFrameTraceDifference {
  const tsHeader = readTraceHeader(typescriptTrace);
  const wasmHeader = readTraceHeader(wasmTrace);
  const headerProblem = validateComparableHeaders(tsHeader, wasmHeader, frameCount);
  if (headerProblem) return headerProblem;

  const frameIndex = tsHeader.frameIndex;
  if (tsHeader.overflow !== 0 || wasmHeader.overflow !== 0) {
    return {
      kind: "overflow",
      frameCount,
      frameIndex,
      typescriptValue: `${tsHeader.overflow}`,
      wasmValue: `${wasmHeader.overflow}`,
      message: `Trace overflow at frame ${frameCount}: TypeScript=${tsHeader.overflow}, WASM=${wasmHeader.overflow}.`
    };
  }

  const commonCount = Math.min(tsHeader.count, wasmHeader.count);
  for (let index = 0; index < commonCount; index++) {
    const field = findFirstDifferentRecordField(typescriptTrace, wasmTrace, index);
    if (field) {
      return createRecordDifference(typescriptTrace, wasmTrace, frameCount, frameIndex, index, field);
    }
  }

  if (tsHeader.count !== wasmHeader.count) {
    return {
      kind: "record-count",
      frameCount,
      frameIndex,
      instructionIndex: commonCount,
      fieldName: "count",
      typescriptValue: `${tsHeader.count}`,
      wasmValue: `${wasmHeader.count}`,
      lastMatchingRecord: commonCount > 0 ? readTraceRecord(typescriptTrace, commonCount - 1) : undefined,
      message: `Trace record count differs at frame ${frameCount}: TypeScript=${tsHeader.count}, WASM=${wasmHeader.count}.`
    };
  }

  return {
    kind: "match",
    frameCount,
    frameIndex,
    message: `Frame ${frameCount} matched (${tsHeader.count} instruction records).`
  };
}

export function formatZxNextFrameTraceDifference(diff: ZxNextFrameTraceDifference): string {
  if (diff.kind === "match") return diff.message;
  const lines = [
    `ZX Spectrum Next frame diff stopped at frameCount=${diff.frameCount} frameIndex=${diff.frameIndex}.`,
    diff.message
  ];
  if (diff.lastMatchingRecord) {
    lines.push(
      "Last matching instruction:",
      `  index=${diff.lastMatchingRecord.sequence} pcBefore=${hex16(diff.lastMatchingRecord.pcBefore)} pcAfter=${hex16(diff.lastMatchingRecord.pcAfter)}`
    );
  }
  if (diff.typescriptRecord && diff.wasmRecord) {
    lines.push(
      "First divergence:",
      `  frameCount=${diff.frameCount}`,
      `  index=${diff.instructionIndex} instructionPc=${hex16(diff.typescriptRecord.pcBefore)}`,
      `  TypeScript pcBefore=${hex16(diff.typescriptRecord.pcBefore)} pcAfter=${hex16(diff.typescriptRecord.pcAfter)} frameTact28=${diff.typescriptRecord.frameTact28After}`,
      `  WASM       pcBefore=${hex16(diff.wasmRecord.pcBefore)} pcAfter=${hex16(diff.wasmRecord.pcAfter)} frameTact28=${diff.wasmRecord.frameTact28After}`,
      `  firstDifferentField=${diff.fieldName}`,
      `  TypeScript ${diff.fieldName}=${diff.typescriptValue}`,
      `  WASM       ${diff.fieldName}=${diff.wasmValue}`,
      `  TypeScript lastPortAddress=${hex16(diff.typescriptRecord.lastPortAddress)} lastPortValue=${hex8(diff.typescriptRecord.lastPortValue)} lastPortFlags=${hex8(diff.typescriptRecord.lastPortFlags)}`,
      `  WASM       lastPortAddress=${hex16(diff.wasmRecord.lastPortAddress)} lastPortValue=${hex8(diff.wasmRecord.lastPortValue)} lastPortFlags=${hex8(diff.wasmRecord.lastPortFlags)}`,
      `  TypeScript mmu=${formatHexArray(diff.typescriptRecord.mmuRaw, 2)} readMap=${formatHexArray(diff.typescriptRecord.readMap, 4)} writeMap=${formatHexArray(diff.typescriptRecord.writeMap, 4)}`,
      `  WASM       mmu=${formatHexArray(diff.wasmRecord.mmuRaw, 2)} readMap=${formatHexArray(diff.wasmRecord.readMap, 4)} writeMap=${formatHexArray(diff.wasmRecord.writeMap, 4)}`
    );
  }
  return lines.join("\n");
}

function validateComparableHeaders(
  tsHeader: ZxNextFrameTraceHeader,
  wasmHeader: ZxNextFrameTraceHeader,
  frameCount: number
): ZxNextFrameTraceDifference | undefined {
  const checks: Array<[string, number, number]> = [
    ["magic", tsHeader.magic, wasmHeader.magic],
    ["version", tsHeader.version, wasmHeader.version],
    ["recordSize", tsHeader.recordSize, wasmHeader.recordSize],
    ["frameIndex", tsHeader.frameIndex, wasmHeader.frameIndex]
  ];
  for (const [name, tsValue, wasmValue] of checks) {
    if (tsValue !== wasmValue) {
      return {
        kind: "header",
        frameCount,
        frameIndex: tsHeader.frameIndex,
        fieldName: name,
        typescriptValue: `${tsValue}`,
        wasmValue: `${wasmValue}`,
        message: `Trace header field '${name}' differs at frame ${frameCount}: TypeScript=${tsValue}, WASM=${wasmValue}.`
      };
    }
  }
  return undefined;
}

function findFirstDifferentRecordField(
  typescriptTrace: ArrayBuffer | Uint8Array,
  wasmTrace: ArrayBuffer | Uint8Array,
  index: number
): ZxNextFrameTraceField | undefined {
  const tsBytes = toUint8Array(typescriptTrace);
  const wasmBytes = toUint8Array(wasmTrace);
  const base = ZXNEXT_FRAME_TRACE_HEADER_SIZE + index * ZXNEXT_FRAME_TRACE_RECORD_SIZE;
  for (const field of ZXNEXT_TRACE_RECORD_FIELDS) {
    for (let pos = 0; pos < field.byteLength; pos++) {
      if (tsBytes[base + field.offset + pos] !== wasmBytes[base + field.offset + pos]) {
        return field;
      }
    }
  }
  return undefined;
}

function createRecordDifference(
  typescriptTrace: ArrayBuffer | Uint8Array,
  wasmTrace: ArrayBuffer | Uint8Array,
  frameCount: number,
  frameIndex: number,
  index: number,
  field: ZxNextFrameTraceField
): ZxNextFrameTraceDifference {
  const typescriptRecord = readTraceRecord(typescriptTrace, index);
  const wasmRecord = readTraceRecord(wasmTrace, index);
  return {
    kind: "record",
    frameCount,
    frameIndex,
    instructionIndex: index,
    fieldName: field.name,
    typescriptValue: formatFieldValue(typescriptRecord, field.name),
    wasmValue: formatFieldValue(wasmRecord, field.name),
    lastMatchingRecord: index > 0 ? readTraceRecord(typescriptTrace, index - 1) : undefined,
    typescriptRecord,
    wasmRecord,
    message: `First trace difference at frame ${frameCount}, instruction ${index}, field '${field.name}'.`
  };
}

function packCpuFlags(machine: ZxNextMachine): number {
  return (
    (machine.iff1 ? 0x0001 : 0) |
    (machine.iff2 ? 0x0002 : 0) |
    ((machine.interruptMode & 0x03) << 2) |
    (machine.halted ? 0x0010 : 0) |
    ((machine.prefix & 0x0f) << 5) |
    (machine.sigINT ? 0x0200 : 0) |
    (machine.sigNMI ? 0x0400 : 0) |
    (machine.retExecuted ? 0x0800 : 0) |
    (machine.retnExecuted ? 0x1000 : 0)
  );
}

function writeLastAccesses(view: DataView, offset: number, machine: ZxNextMachine): void {
  let memoryFlags = 0;
  let memoryAddress = 0;
  let memoryValue = 0;
  if (machine.lastMemoryWritesCount > 0) {
    memoryFlags = 0x03;
    memoryAddress = machine.lastMemoryWrites[machine.lastMemoryWritesCount - 1];
    memoryValue = machine.lastMemoryWriteValue ?? 0;
  } else if (machine.lastMemoryReadsCount > 0) {
    memoryFlags = 0x01;
    memoryAddress = machine.lastMemoryReads[machine.lastMemoryReadsCount - 1];
    memoryValue = machine.lastMemoryReadValue ?? 0;
  }

  let portFlags = 0;
  let portAddress = 0;
  let portValue = 0;
  if (machine.lastIoWritePort !== undefined) {
    portFlags = 0x03;
    portAddress = machine.lastIoWritePort;
    portValue = machine.lastIoWriteValue ?? 0;
  } else if (machine.lastIoReadPort !== undefined) {
    portFlags = 0x01;
    portAddress = machine.lastIoReadPort;
    portValue = machine.lastIoReadValue ?? 0;
  }

  view.setUint16(offset + ZxNextTraceRecordOffset.LastMemoryAddress, memoryAddress & 0xffff, true);
  view.setUint16(offset + ZxNextTraceRecordOffset.LastPortAddress, portAddress & 0xffff, true);
  view.setUint8(offset + ZxNextTraceRecordOffset.LastMemoryValue, memoryValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.LastPortValue, portValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.LastMemoryFlags, memoryFlags);
  view.setUint8(offset + ZxNextTraceRecordOffset.LastPortFlags, portFlags);
}

function writeMemoryMaps(view: DataView, offset: number, machine: ZxNextMachine): void {
  const memory = machine.memoryDevice;
  for (let slot = 0; slot < 8; slot++) {
    const page = memory.getPageInfo(slot);
    view.setUint8(offset + ZxNextTraceRecordOffset.MmuRaw + slot, memory.getNextRegMmuValue(slot));
    view.setUint16(offset + ZxNextTraceRecordOffset.ReadMap + slot * 2, encodeMemoryMapOffset(page.readOffset, false), true);
    view.setUint16(offset + ZxNextTraceRecordOffset.WriteMap + slot * 2, encodeMemoryMapOffset(page.writeOffset, true), true);
  }
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs, memory.port7ffdValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 1, memory.port1ffdValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 2, memory.portDffdValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 3, memory.portEff7Value & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 4, machine.divMmcDevice.port0xe3Value & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 5, 0);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 6, memory.nextReg8CValue & 0xff);
  view.setUint8(offset + ZxNextTraceRecordOffset.PagingRegs + 7, machine.multifaceDevice.mfEnabled ? 1 : 0);
}

export function encodeMemoryMapOffset(offset: number | null, writeMap: boolean): number {
  if (offset == null || offset < 0 || offset === 0xffffffff) {
    return TRACE_MAP_READ_ONLY;
  }
  let kind = TRACE_MAP_KIND_NONE;
  let page = 0x1ff;
  if (offset >= OFFS_ERR_PAGE) {
    kind = TRACE_MAP_KIND_SENTINEL;
    page = 0x1ff;
  } else if (offset >= OFFS_NEXT_RAM) {
    kind = TRACE_MAP_KIND_MAIN_RAM;
    page = ((offset - OFFS_NEXT_RAM) >>> 13) & 0x1ff;
  } else if (offset >= OFFS_DIVMMC_RAM) {
    kind = TRACE_MAP_KIND_DIVMMC_RAM;
    page = ((offset - OFFS_DIVMMC_RAM) >>> 13) & 0x1ff;
  } else if (offset >= OFFS_ALT_ROM_0 && offset < OFFS_ALT_ROM_1 + 0x4000) {
    kind = TRACE_MAP_KIND_ALT_ROM;
    page = ((offset - OFFS_ALT_ROM_0) >>> 13) & 0x1ff;
  } else if (offset >= OFFS_MULTIFACE_MEM && offset < OFFS_MULTIFACE_MEM + 0x4000) {
    kind = TRACE_MAP_KIND_MULTIFACE;
    page = ((offset - OFFS_MULTIFACE_MEM) >>> 13) & 0x1ff;
  } else if (offset >= OFFS_DIVMMC_ROM && offset < OFFS_DIVMMC_ROM + 0x4000) {
    kind = TRACE_MAP_KIND_DIVMMC_ROM;
    page = ((offset - OFFS_DIVMMC_ROM) >>> 13) & 0x1ff;
  } else if (offset >= OFFS_NEXT_ROM && offset < OFFS_NEXT_ROM + 0x10000) {
    kind = TRACE_MAP_KIND_NEXT_ROM;
    page = ((offset - OFFS_NEXT_ROM) >>> 13) & 0x1ff;
  }
  return page | (kind << 9) | (writeMap ? 0 : 0);
}

function formatFieldValue(record: ZxNextFrameTraceRecord, fieldName: string): string {
  const value = record[fieldName as keyof ZxNextFrameTraceRecord];
  if (Array.isArray(value)) {
    return formatHexArray(value, fieldName.endsWith("Map") ? 4 : 2);
  }
  if (typeof value === "number") {
    if (fieldName.toLowerCase().includes("pc") || fieldName === "sp" || fieldName.length <= 5) {
      return hex16(value);
    }
    return `${value}`;
  }
  return `${value}`;
}

function writeUint64Parts(view: DataView, offset: number, value: number): void {
  const low = value >>> 0;
  const high = Math.floor(value / 0x1_0000_0000) >>> 0;
  view.setUint32(offset, low, true);
  view.setUint32(offset + 4, high, true);
}

function readUint64Parts(view: DataView, offset: number): number {
  return view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 0x1_0000_0000;
}

function readByteArray(view: DataView, offset: number, length: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) result.push(view.getUint8(offset + i));
  return result;
}

function readUint16Array(view: DataView, offset: number, length: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) result.push(view.getUint16(offset + i * 2, true));
  return result;
}

function toDataView(trace: ArrayBuffer | Uint8Array): DataView {
  if (trace instanceof Uint8Array) {
    return new DataView(trace.buffer, trace.byteOffset, trace.byteLength);
  }
  return new DataView(trace);
}

function toUint8Array(trace: ArrayBuffer | Uint8Array): Uint8Array {
  return trace instanceof Uint8Array ? trace : new Uint8Array(trace);
}

function hex16(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

function hex8(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

function formatHexArray(values: number[], width: number): string {
  return `[${values.map(value => `$${value.toString(16).padStart(width, "0")}`).join(",")}]`;
}
