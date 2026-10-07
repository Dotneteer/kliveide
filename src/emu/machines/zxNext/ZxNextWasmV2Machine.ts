import { conditionStoreOf, type ConditionStore } from "../conditionStore";
import { WasmHistoryReader } from "../history/WasmHistoryReader";
import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import { readWasmLayout } from "../state/wasmLayout";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import {
  ULA_BORDER_COLOR_NAMES,
  type CpuState,
  type CopperHitEvent,
  type CopperState,
  type NextSpriteState,
  type NextTilemapState,
  type NextLayer2State,
  type NextLayerState,
  type NextLayerThumbnails,
  type NextRegWriteEvent,
  type NextMemoryMapping,
  type NextRegDescriptors,
  type NextRegState,
  type PaletteDeviceInfo,
  type UlaState
} from "@common/messaging/EmuApi";
import { nextRasterPosition, type IZxNextIdeMachine } from "./IZxNextIdeMachine";
import type {
  IZxNextHostInputMachine,
  JoystickConnector
} from "./IZxNextHostInputMachine";
import { NEXT_REG_DESCRIPTORS } from "./nextRegDescriptors";
import { BANK5_PHYSICAL, BANK7_PHYSICAL } from "@common/zxnext/tilemap/tilemapDecode";
import { isOutsideRam, LAYER2_RAM_PHYSICAL, LAYER2_READ_BYTES } from "@common/zxnext/layer2/layer2Decode";
import {
  decodeProbe,
  decodeRecomposeStatus,
  NO_LAYER_DEBUG,
  type NextLayerDebug,
  type NextPixelProbe,
  type RecomposeStatus
} from "@common/zxnext/layers/layerMix";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import { beamAt, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { NextRegDeviceState, RegValueState } from "./nextRegDescriptors";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { shouldStopAtDebugPoint } from "../DebugStepDecision";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { createMainApi } from "@common/messaging/MainApi";
import { loadZxNextWasmV2, ZXNEXT_NO_PARTITION } from "./wasm/ZxNextWasmV2Loader";
import {
  allRamBanksFor,
  OFFS_ALT_ROM_0,
  OFFS_ALT_ROM_1,
  OFFS_DIVMMC_RAM,
  OFFS_DIVMMC_ROM,
  OFFS_MULTIFACE_MEM,
  OFFS_NEXT_RAM,
  OFFS_NEXT_ROM,
  UNPAGED_PARTITION_LABEL
} from "./nextMemoryLayout";
import { ZxNextWasmHost } from "./ZxNextWasmHost";
import { NEXT_ROM_FLAGS } from "./nextMachineInfo";
import { rtcRegistersFromDate } from "./nextRtc";
import { AUDIO_SAMPLE_RATE } from "../machine-props";
import { importAccessLog } from "../wasmAccessLog";
import {
  captureWasmImage,
  restoreWasmImage,
  type MachineStateParts
} from "../state/wasmStateImage";

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

export type ZxNextWasmV2StopReason =
  | "reset"
  | "debugStep"
  | "wasmFrameCommand"
  | "wasmFrameComplete";

const ZXNEXT_SD_HOST_COMMAND_READ = 1;
const ZXNEXT_SD_HOST_COMMAND_WRITE = 2;
const ZXNEXT_SD_HOST_COMMAND_READ_CARD1 = 3;
const ZXNEXT_SD_HOST_COMMAND_WRITE_CARD1 = 4;
const ZXNEXT_SD_BYTES_PER_SECTOR = 512;

export type ZxNextWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  memoryBytes: number;
  flatMemoryBytes: number;
  screenWidth: number;
  screenHeight: number;
  frames: number;
  tacts: number;
  tactsInFrame: number;
  currentFrameTact: number;
  frameCompleted: boolean;
  normalFrames: number;
  debugSteps: number;
  lastWasmStopReason: ZxNextWasmV2StopReason;
  diagnosticFlags: number;
};

/** `zxnextGetMemoryPageWriteOffset` for a page that takes no writes (zxnext-memory.c ZXNEXT_NO_WRITE_OFFSET) */
const ZXNEXT_WASM_NO_WRITE_OFFSET = 0xffffffff;

/** The tape lines of the core: the tape mode and the EAR/MIC bits the ULA ports expose. */
export type ZxNextWasmTapeLines = {
  tapeMode: TapeMode;
  updateTapeMode(): void;
  getTapeEarBit(): boolean;
  micBit: boolean;
  processMicBit(micBit: boolean): void;
};

export type ZxNextWasmV2RomImages = {
  nextRom: Uint8Array;
  divMmcRom: Uint8Array;
  multifaceRom: Uint8Array;
  altRom: Uint8Array;
};

/**
 * Explicit ZX Spectrum Next WASM v2 adapter.
 *
 * This is a deterministic adapter for IDE integration while later migration
 * steps continue moving full Next subsystems into C/WASM.
 */
/**
 * A complete, restorable record of a `ZxNextWasmV2Machine`: the WASM core's whole linear memory plus
 * the fields this class mirrors outside it.
 */
type ZxNextWasmV2Checkpoint = {
  key: string;

  /**
   * The core's linear memory, minus every volatile range of its `klive.layout` stamp: the frame
   * trace, the execution-history ring, the layer captures and the other debugging buffers
   * (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` trap T7). They hold nothing a restored machine needs,
   * so leaving them out keeps the checkpoint small, and a restore leaves them as they are - the
   * history ring is the controller's to clear (D9), and a trace recorded across a restore stays
   * consistent with its own header. One entry per kept span, in address order.
   */
  memory: { offset: number; bytes: Uint8Array }[];

  normalFrames: number;
  debugSteps: number;
  lastStopReason: ZxNextWasmV2StopReason;
  audioSampleRate: number;
  sdCardInfoLoaded: boolean;
  lastRenderedFrameTact: number;
};

export class ZxNextWasmV2Machine
  extends ZxNextWasmHost
  implements IZxNextIdeMachine, IZxNextHostInputMachine, IExecutionHistorySource
{
  public readonly implementation = "wasm" as const;
  public wasmV2Runtime?: ZxNextWasmV2Runtime;
  public readonly screenDevice: {
    readonly renderingTactTable: { phase: number }[];
    readonly borderColor: number;
  };
  /**
   * The tape's mode and EAR/MIC lines, read from and written to the core. The Next has no tape
   * *loading* path (neither core ever had one); this carries the lines the ULA ports expose.
   *
   * Typed locally rather than as the Spectrum family's `ITapeDevice`: that interface is an
   * `IGenericDevice<IZxSpectrumMachine>`, and its type graph reaches every TypeScript Next device
   * through the Spectrum device interfaces - which this machine must not depend on.
   */
  public readonly tapeDevice: ZxNextWasmTapeLines;
  /** The floating bus, sampled with a port read (so never from a polled panel). */
  public readonly floatingBusDevice: { readFloatingBus(): number };

  private wasmV2NormalFrames = 0;
  private wasmV2DebugSteps = 0;
  private wasmV2LastStopReason: ZxNextWasmV2StopReason = "reset";
  private wasmV2RomImages?: ZxNextWasmV2RomImages;
  private wasmV2SdCardInfoLoaded = false;
  private wasmV2AudioSampleRate = -1;
  private readonly wasmV2AudioSamples: AudioSample[] = [];
  private wasmV2Checkpoint?: ZxNextWasmV2Checkpoint;
  /** The core's since-pause contention count when the IDE last restarted it (see resetContentionDelaySincePause). */
  private wasmV2ContentionPauseBase = 0;
  constructor(
    public readonly requestedModelInfo?: MachineModel,
    public readonly requestedConfig?: MachineConfigSet,
    messenger?: MessengerBase,
    private readonly wasmV2LoaderOptions?: ZxNextWasmV2LoaderOptions
  ) {
    super(requestedModelInfo, requestedConfig, messenger);
    const wasmSelf = this;
    this.screenDevice = {
      renderingTactTable: [{ phase: 0 }],
      get borderColor() {
        return wasmSelf.wasmV2Runtime?.exports.zxnextGetBorderColor() ?? 0;
      }
    };
    this.tapeDevice = {
      get tapeMode() {
        return (wasmSelf.wasmV2Runtime?.exports.zxnextGetTapeMode() ?? TapeMode.Passive) as TapeMode;
      },
      set tapeMode(value: TapeMode) {
        wasmSelf.wasmV2Runtime?.exports.zxnextSetTapeMode(value);
      },
      updateTapeMode() {
        // Full ROM tape routine detection remains in TypeScript until storage/tape block migration.
      },
      getTapeEarBit() {
        return wasmSelf.wasmV2Runtime?.exports.zxnextGetTapeEarBit() !== 0;
      },
      get micBit() {
        return wasmSelf.wasmV2Runtime?.exports.zxnextGetTapeMicBit() !== 0;
      },
      set micBit(value: boolean) {
        wasmSelf.wasmV2Runtime?.exports.zxnextProcessTapeMicBit(value ? 1 : 0);
      },
      processMicBit(micBit: boolean) {
        wasmSelf.wasmV2Runtime?.exports.zxnextProcessTapeMicBit(micBit ? 1 : 0);
      },
    };
    this.floatingBusDevice = {
      readFloatingBus: () => this.doReadPort(0xffff)
    };
  }

  override get a(): number {
    return super.a;
  }

  override set a(value: number) {
    super.a = value;
    this.syncWasmV2AfFromFacade();
  }

  override get f(): number {
    return super.f;
  }

  override set f(value: number) {
    super.f = value;
    this.syncWasmV2AfFromFacade();
  }

  override get af(): number {
    return super.af;
  }

  override set af(value: number) {
    super.af = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuAf(super.af);
  }

  override get b(): number {
    return super.b;
  }

  override set b(value: number) {
    super.b = value;
    this.syncWasmV2BcFromFacade();
  }

  override get c(): number {
    return super.c;
  }

  override set c(value: number) {
    super.c = value;
    this.syncWasmV2BcFromFacade();
  }

  override get bc(): number {
    return super.bc;
  }

  override set bc(value: number) {
    super.bc = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuBc(super.bc);
  }

  override get d(): number {
    return super.d;
  }

  override set d(value: number) {
    super.d = value;
    this.syncWasmV2DeFromFacade();
  }

  override get e(): number {
    return super.e;
  }

  override set e(value: number) {
    super.e = value;
    this.syncWasmV2DeFromFacade();
  }

  override get de(): number {
    return super.de;
  }

  override set de(value: number) {
    super.de = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuDe(super.de);
  }

  override get h(): number {
    return super.h;
  }

  override set h(value: number) {
    super.h = value;
    this.syncWasmV2HlFromFacade();
  }

  override get l(): number {
    return super.l;
  }

  override set l(value: number) {
    super.l = value;
    this.syncWasmV2HlFromFacade();
  }

  override get hl(): number {
    return super.hl;
  }

  override set hl(value: number) {
    super.hl = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuHl(super.hl);
  }

  override get af_(): number {
    return super.af_;
  }

  override set af_(value: number) {
    super.af_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuAfAlt(super.af_);
  }

  override get bc_(): number {
    return super.bc_;
  }

  override set bc_(value: number) {
    super.bc_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuBcAlt(super.bc_);
  }

  override get de_(): number {
    return super.de_;
  }

  override set de_(value: number) {
    super.de_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuDeAlt(super.de_);
  }

  override get hl_(): number {
    return super.hl_;
  }

  override set hl_(value: number) {
    super.hl_ = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuHlAlt(super.hl_);
  }

  override get xh(): number {
    return super.xh;
  }

  override set xh(value: number) {
    super.xh = value;
    this.syncWasmV2IxFromFacade();
  }

  override get xl(): number {
    return super.xl;
  }

  override set xl(value: number) {
    super.xl = value;
    this.syncWasmV2IxFromFacade();
  }

  override get ix(): number {
    return super.ix;
  }

  override set ix(value: number) {
    super.ix = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIx(super.ix);
  }

  override get yh(): number {
    return super.yh;
  }

  override set yh(value: number) {
    super.yh = value;
    this.syncWasmV2IyFromFacade();
  }

  override get yl(): number {
    return super.yl;
  }

  override set yl(value: number) {
    super.yl = value;
    this.syncWasmV2IyFromFacade();
  }

  override get iy(): number {
    return super.iy;
  }

  override set iy(value: number) {
    super.iy = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIy(super.iy);
  }

  override get i(): number {
    return super.i;
  }

  override set i(value: number) {
    super.i = value;
    this.syncWasmV2IrFromFacade();
  }

  override get r(): number {
    return super.r;
  }

  override set r(value: number) {
    super.r = value;
    this.syncWasmV2IrFromFacade();
  }

  override get ir(): number {
    return super.ir;
  }

  override set ir(value: number) {
    super.ir = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIr(super.ir);
  }

  override get wz(): number {
    return super.wz;
  }

  override set wz(value: number) {
    super.wz = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuWz(super.wz);
  }

  override get pc(): number {
    return super.pc;
  }

  override set pc(value: number) {
    super.pc = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuPc(super.pc);
  }

  override get sp(): number {
    return super.sp;
  }

  override set sp(value: number) {
    super.sp = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuSp(super.sp);
  }

  override get iff1(): boolean {
    return super.iff1;
  }

  override set iff1(value: boolean) {
    super.iff1 = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIff1(value ? 1 : 0);
  }

  override get iff2(): boolean {
    return super.iff2;
  }

  override set iff2(value: boolean) {
    super.iff2 = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuIff2(value ? 1 : 0);
  }

  override get interruptMode(): number {
    return super.interruptMode;
  }

  override set interruptMode(value: number) {
    super.interruptMode = value;
    this.wasmV2Runtime?.exports.zxnextSetCpuInterruptMode(value & 0x03);
  }

  override async setup(): Promise<void> {
    this.wasmV2RomImages = await this.loadWasmV2RomImages();
    this.wasmV2Runtime = await loadZxNextWasmV2(this.wasmV2LoaderOptions);
    this.hardResetWasmV2(this.wasmV2Runtime);
    // --- The DS1307 holds the host's time, as the battery-backed clock of a machine set up before
    this.wasmV2Runtime.exports.zxnextRtcSetTime(...rtcRegistersFromDate(new Date()));
    this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
    this.syncCpuFromWasmV2(this.wasmV2Runtime);
  }

  override hardReset(): void {
    super.hardReset();
    if (this.wasmV2Runtime != null) {
      this.hardResetWasmV2(this.wasmV2Runtime);
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override reset(): void {
    super.reset();
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextReset();
      this.wasmV2ContentionPauseBase = 0;
      this.wasmV2NormalFrames = 0;
      this.wasmV2DebugSteps = 0;
      this.wasmV2LastStopReason = "reset";
      this.syncAudioSampleRateToWasmV2(this.wasmV2Runtime);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override setMachineProperty(key: string, value?: any): void {
    super.setMachineProperty(key, value);
    const runtime = this.wasmV2Runtime;
    if (runtime != null && key === AUDIO_SAMPLE_RATE) {
      this.syncAudioSampleRateToWasmV2(runtime);
    }
  }

  override executeMachineFrame(): FrameTerminationMode {
    // --- Nothing to run before `setup()` has loaded the core: never fall back to another CPU
    const runtime = this.requireWasmV2Runtime();
    // --- The machine draws again: the paused debug preview is over
    this.layerPreviewShown = false;
    this.beamPreviewShown = false;

    if (
      this.executionContext.debugStepMode !== DebugStepMode.NoDebug ||
      this.executionContext.frameTerminationMode !== FrameTerminationMode.Normal ||
      this.getFrameCommand()
    ) {
      return this.executeWasmV2DebugLoop(runtime);
    }

    this.emulateKeystroke();
    runtime.exports.zxnextExecuteFrame();
    this.syncCpuFromWasmV2(runtime);
    this.syncWasmV2StorageFrameCommand(runtime);
    this.frameCompleted = runtime.exports.zxnextGetFrameCompleted() !== 0;
    this.applyWasmV2ResetRequest(runtime);
    if (this.frameCompleted) {
      this.wasmV2NormalFrames++;
      this.wasmV2LastStopReason = "wasmFrameComplete";
    } else {
      this.wasmV2LastStopReason = "wasmFrameCommand";
    }
    this.executionContext.lastTerminationReason = FrameTerminationMode.Normal;
    return FrameTerminationMode.Normal;
  }

  executeWasmV2DebugStep(): FrameTerminationMode {
    const runtime = this.requireWasmV2Runtime();
    this.executeWasmV2Instruction(runtime);
    this.wasmV2LastStopReason = "debugStep";
    this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent;
    return FrameTerminationMode.DebugEvent;
  }

  executeWasmV2Instruction(runtime = this.requireWasmV2Runtime()): void {
    this.layerPreviewShown = false;
    this.beamPreviewShown = false;
    if (runtime.exports.zxnextGetCpuPrefix() === 0) this.opStartAddress = runtime.exports.zxnextGetCpuPc();
    runtime.exports.zxnextExecuteInstruction();
    this.wasmV2DebugSteps++;
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.syncWasmV2StorageFrameCommand(runtime);
    this.frameCompleted = runtime.exports.zxnextGetFrameCompleted() !== 0;
    this.applyWasmV2ResetRequest(runtime);
  }

  /**
   * NextReg $02 bit 0 / bit 1: the core stops the frame and reports the request; the reset runs here
   * so a hard reset also restores what this class owns (the ROM images, the audio rate).
   */
  private applyWasmV2ResetRequest(runtime: ZxNextWasmV2Runtime): boolean {
    const request = runtime.exports.zxnextTakeResetRequest();
    if (request === 2) this.hardReset();
    else if (request === 1) this.reset();
    return request !== 0;
  }

  /**
   * Captures the machine's whole state: the core's memory image plus this wrapper's own fields
   * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5). The machine must be paused. The SD
   * card image is a host file and not part of it (D12).
   */
  saveMachineState(): MachineStateParts {
    const runtime = this.requireWasmV2Runtime();
    return {
      ...captureWasmImage("zxnext", runtime.module, runtime.exports.memory.buffer),
      host: {
        normalFrames: this.wasmV2NormalFrames,
        debugSteps: this.wasmV2DebugSteps,
        lastStopReason: this.wasmV2LastStopReason,
        sdCardInfoLoaded: this.wasmV2SdCardInfoLoaded,
        lastRenderedFrameTact: this.lastRenderedFrameTact
      }
    };
  }

  /**
   * Puts the machine back into a saved state; the host-side caches are invalidated so the next
   * frame pushes the live host's settings. Queued work of the run being replaced is dropped.
   * @throws MachineStateMismatchError when the state was saved by another core or layout
   */
  loadMachineState(parts: MachineStateParts): void {
    const runtime = this.requireWasmV2Runtime();
    restoreWasmImage(parts, "zxnext", runtime.module, runtime.exports.memory.buffer);
    const host = parts.host as {
      normalFrames?: number;
      debugSteps?: number;
      lastStopReason?: ZxNextWasmV2StopReason;
      sdCardInfoLoaded?: boolean;
      lastRenderedFrameTact?: number;
    };
    this.wasmV2NormalFrames = host.normalFrames ?? 0;
    this.wasmV2DebugSteps = host.debugSteps ?? 0;
    this.wasmV2LastStopReason = host.lastStopReason ?? "reset";
    this.wasmV2SdCardInfoLoaded = !!host.sdCardInfoLoaded;
    this.lastRenderedFrameTact = host.lastRenderedFrameTact ?? 0;
    // --- As a checkpoint restore: queued work of the replaced run goes; the audio rate is re-pushed
    this.emulatedKeyStrokes.length = 0;
    this.setFrameCommand(null);
    this.wasmV2AudioSamples.length = 0;
    this.wasmV2AudioSampleRate = -1;
    this.invalidateCheckpoints();
    this.syncCpuFromWasmV2(runtime);
    this.reapplyLayerDebug(runtime);
  }


  /**
   * Captures everything needed to put this machine back exactly where it stands.
   *
   * The WASM core keeps its entire world - CPU, RAM, ROM, Next registers, every device - inside its
   * linear memory, and between exported calls the C shadow stack is unwound, so a copy of that
   * buffer is a complete and replay-deterministic record of the core. What it does not cover is the
   * handful of fields this class mirrors on the TypeScript side, which are captured alongside it.
   *
   * Deliberately NOT covered: the SD card, which lives in a real image file outside the emulator
   * (see `processWasmV2SdWriteFrameCommand`). Restoring rewinds the machine but cannot rewind that
   * file, so any write to it drops the checkpoint rather than risking a machine whose cached view of
   * the filesystem disagrees with what is on disk.
   * @param key Identifies what the captured state represents
   */
  captureCheckpoint(key: string): void {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return;
    const all = new Uint8Array(runtime.memoryBuffer);
    this.wasmV2Checkpoint = {
      key,
      memory: this.checkpointSpans(runtime).map(([from, to]) => ({ offset: from, bytes: all.slice(from, to) })),
      normalFrames: this.wasmV2NormalFrames,
      debugSteps: this.wasmV2DebugSteps,
      lastStopReason: this.wasmV2LastStopReason,
      audioSampleRate: this.wasmV2AudioSampleRate,
      sdCardInfoLoaded: this.wasmV2SdCardInfoLoaded,
      lastRenderedFrameTact: this.lastRenderedFrameTact
    };
  }

  /**
   * Puts the machine back into the state captured under the given key.
   * @param key The key the state was captured under
   * @returns True when the machine was restored; otherwise, false
   */
  tryRestoreCheckpoint(key: string): boolean {
    const runtime = this.wasmV2Runtime;
    const checkpoint = this.wasmV2Checkpoint;
    if (runtime == null || checkpoint == null || checkpoint.key !== key) return false;

    const all = new Uint8Array(runtime.memoryBuffer);
    for (const span of checkpoint.memory) all.set(span.bytes, span.offset);
    this.lastRenderedFrameTact = checkpoint.lastRenderedFrameTact;
    this.wasmV2NormalFrames = checkpoint.normalFrames;
    this.wasmV2DebugSteps = checkpoint.debugSteps;
    this.wasmV2LastStopReason = checkpoint.lastStopReason;
    this.wasmV2AudioSampleRate = checkpoint.audioSampleRate;
    this.wasmV2SdCardInfoLoaded = checkpoint.sdCardInfoLoaded;

    // --- Anything queued by the run that has just been rewound away would otherwise leak into the
    // --- restored machine: a half-played keystroke, a pending SD command, last frame's audio.
    // --- (The key matrix itself lives in the core's memory, which the restore has just put back.)
    this.emulatedKeyStrokes.length = 0;
    this.setFrameCommand(null);
    this.wasmV2AudioSamples.length = 0;

    this.syncCpuFromWasmV2(runtime);
    // --- The image carried the debug view of its time: put back today's (D2)
    this.reapplyLayerDebug(runtime);
    return true;
  }

  /**
   * The spans of linear memory a checkpoint keeps, `[from, to)` in address order: everything but the
   * volatile ranges of the core's layout stamp. A core without a stamp (a test double) leaves out
   * only the frame trace, as checkpoints always did.
   */
  private checkpointSpans(runtime: ZxNextWasmV2Runtime): [number, number][] {
    if (this.wasmV2CheckpointSpans?.runtime === runtime) return this.wasmV2CheckpointSpans.spans;
    const size = runtime.memoryBuffer.byteLength;
    const excluded = (readWasmLayout(runtime.module)?.volatile ?? []).map(
      (v) => [v.address, v.address + v.size] as [number, number]
    );
    if (!excluded.length) {
      const traceStart = runtime.exports.zxnextTraceGetStartOffset();
      excluded.push([traceStart, traceStart + runtime.frameTrace.byteLength]);
    }
    excluded.sort((a, b) => a[0] - b[0]);
    const spans: [number, number][] = [];
    let from = 0;
    for (const [start, end] of excluded) {
      if (start > from) spans.push([from, Math.min(start, size)]);
      from = Math.max(from, end);
    }
    if (from < size) spans.push([from, size]);
    this.wasmV2CheckpointSpans = { runtime, spans };
    return spans;
  }

  private wasmV2CheckpointSpans?: { runtime: ZxNextWasmV2Runtime; spans: [number, number][] };

  // ==============================================================================================
  // Execution history (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.4): the shared recorder in the
  // core, read through the shared reader

  readonly historyMachineId = "zxnext";

  private wasmV2HistoryReader?: { runtime: ZxNextWasmV2Runtime; reader: WasmHistoryReader };

  private historyReader(): WasmHistoryReader | undefined {
    const runtime = this.wasmV2Runtime;
    if (runtime == null) return undefined;
    if (this.wasmV2HistoryReader?.runtime !== runtime) {
      this.wasmV2HistoryReader = { runtime, reader: new WasmHistoryReader(runtime.exports, this.historyMachineId) };
    }
    return this.wasmV2HistoryReader.reader;
  }

  getHistoryInfo(): ExecutionHistoryInfo | undefined {
    return this.historyReader()?.info();
  }

  readHistory(fromSequence: number, count: number): ExecutionHistoryPage | undefined {
    return this.historyReader()?.read(fromSequence, count);
  }

  clearHistory(): void {
    this.historyReader()?.clear();
  }

  setHistoryEnabled(enabled: boolean): void {
    this.historyReader()?.setEnabled(enabled);
  }

  /**
   * Drops the held checkpoint, because something it was captured against has changed underneath it.
   */
  invalidateCheckpoints(): void {
    this.wasmV2Checkpoint = undefined;
  }

  uploadWasmV2RomImages(roms: ZxNextWasmV2RomImages): void {
    this.wasmV2RomImages = {
      nextRom: roms.nextRom.slice(),
      divMmcRom: roms.divMmcRom.slice(),
      multifaceRom: roms.multifaceRom.slice(),
      altRom: roms.altRom.slice()
    };
    const runtime = this.requireWasmV2Runtime();
    this.uploadCachedWasmV2RomImages(runtime);
    this.invalidateCheckpoints();
  }

  /**
   * Runs instructions one at a time until the frame ends or something asks the loop to stop.
   *
   * Everything outside `NoDebug` + `Normal` arrives here, which includes the plain non-debug
   * `ReachExecPoint` steps of a code-injection flow - so this loop, not just the debugger, carries
   * the whole NextZXOS boot whenever the IDE starts a compiled project. It therefore only mirrors
   * per instruction what the stop tests below actually read: the program counter and the frame flag.
   * The full register set is mirrored once, on the way out, by `finishWasmV2DebugLoop()`.
   */
  private executeWasmV2DebugLoop(runtime: ZxNextWasmV2Runtime): FrameTerminationMode {
    const wasm = runtime.exports;
    const debugSupport = this.executionContext.debugSupport;
    let instructionsExecuted = 0;
    this.executionContext.lastTerminationReason = undefined;

    this.syncCpuFromWasmV2(runtime);
    if (this.frameCompleted) {
      this.onInitNewFrame(false);
      // --- The new frame's audio starts empty, as `zxnextExecuteFrame` begins it. Without this the
      // --- sample buffers filled in the first frame run here and stayed full: no sound while debugging.
      wasm.zxnextBeginAudioFrame();
      this.frameCompleted = false;
    }

    // --- Queued keystrokes are timed in tacts and held for whole frames, so the fast path above
    // --- plays them once per frame. Do the same here instead of once per instruction: the queue
    // --- cannot advance faster than the frame counter it is measured against anyway.
    this.emulateKeystroke();

    // --- Mirroring the core's bus activity costs ~7 boundary crossings per instruction and is only
    // --- ever read by the memory/IO breakpoint test, so decide once whether it is needed at all.
    const watchesBusAccess = debugSupport?.hasAccessBreakpoints() ?? false;

    /*
     * The NextReg watch table is the core's copy of what this machine's NextReg breakpoints want.
     * Pushed whole on entry rather than kept in step with every edit - the same arrangement the Z88
     * core's breakpoint flags use, and correct because every breakpoint edit either pauses the
     * machine or precedes the next run.
     *
     * The `else` matters as much as the `if`: a table left in the core after the last NextReg
     * breakpoint was deleted would go on stopping the machine forever.
     */
    const watchesNextReg = debugSupport?.hasNextRegBreakpoints() ?? false;
    if (watchesNextReg) {
      runtime.nextRegWatch.set(debugSupport!.buildNextRegWatch());
    } else {
      wasm.zxnextClearNextRegWatch();
    }
    // --- Resuming starts a new search; the write the user already looked at is not a current one.
    this.lastNextRegWrite = undefined;

    /*
     * The Copper watch (`.plans/COPPER_DEBUGGING_PLAN.md` §4.6): pushed whole on entry like the
     * NextReg table, and disarmed when nothing watches, so the Copper's hot path stays free (T3).
     * A pending Copper step arms "any index" as a one-shot.
     */
    const watchesCopper = (debugSupport?.hasCopperBreakpoints() ?? false) || this.copperStepPending;
    if (watchesCopper) {
      if (debugSupport?.hasCopperBreakpoints()) {
        runtime.copperWatch.set(debugSupport.buildCopperWatch());
      } else {
        runtime.copperWatch.fill(0);
      }
      wasm.zxnextSetCopperWatchMode(1, this.copperStepPending ? 1 : 0);
    } else {
      wasm.zxnextSetCopperWatchMode(0, 0);
    }
    this.lastCopperHit = undefined;

    /*
     * Finish a reset the last run stopped in front of.
     *
     * A NextReg write breakpoint on `$02` catches the write that *asks* for a reset, and stops
     * before the reset is carried out, so the user can see who asked (below). The request is left
     * standing in the core, and this is where it is honoured - before another instruction runs, or
     * the machine would execute one more instruction than the program did.
     *
     * A no-op when nothing is pending, which is every other entry.
     */
    if (this.applyWasmV2ResetRequest(runtime)) {
      super.pc = wasm.zxnextGetCpuPc();
      this.frameCompleted = false;
    }

    if (debugSupport && this.pc !== debugSupport.lastStartupBreakpoint) {
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }
    }
    if (debugSupport) {
      debugSupport.lastStartupBreakpoint = undefined;
    }

    while (!this.frameCompleted) {
      // --- The instruction a memory/I/O breakpoint hit is reported against (the Breakpoints panel):
      // --- its first byte, as the TypeScript CPU records it - so not while a prefix is pending
      // --- `|| watchesNextReg`: a NextReg hit is reported against the instruction that wrote, the
      // --- same way a watchpoint hit is, so it needs this tracked too.
      if ((watchesBusAccess || watchesNextReg || watchesCopper) && wasm.zxnextGetCpuPrefix() === 0) {
        this.opStartAddress = this.pc;
      }
      wasm.zxnextExecuteInstruction();
      instructionsExecuted++;
      this.wasmV2DebugSteps++;

      // --- Assigning through `super` on purpose: this class mirrors `pc` with a setter that pushes
      // --- every write back into the core, and this value was just read out of that same core.
      super.pc = wasm.zxnextGetCpuPc();
      this.frameCompleted = wasm.zxnextGetFrameCompleted() !== 0;
      if (watchesBusAccess) {
        this.importWasmV2BusAccess(runtime);
      }
      this.syncWasmV2StorageFrameCommand(runtime);
      this.wasmV2LastStopReason = "debugStep";

      /*
       * The NextReg test runs **before** the reset request is applied, and that ordering is the
       * whole value of a breakpoint on `$02`.
       *
       * Writing `$02` bit 0 or 1 asks the machine to reset. The core only raises the request; the
       * reset itself happens in `applyWasmV2ResetRequest` below, and it throws away the two things
       * the user set the breakpoint to find out - the address of the instruction that wrote, and
       * the paging it wrote under. Worse, a *hard* reset re-initialises the core's NextReg state
       * and clears the latch with it, so the breakpoint did not fire at all.
       *
       * Stopping first leaves the request standing; the loop entry above honours it on resume.
       */
      if (watchesNextReg && this.acceptWasmV2NextRegHit(wasm.zxnextTakeNextRegHit())) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }
      // --- The Copper may complete a watched instruction during any Z80 instruction; the machine
      // --- stops at the end of it, while the Copper has run on to the end of it (T1).
      if (watchesCopper && this.acceptWasmV2CopperHit(runtime, wasm.zxnextTakeCopperHit())) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }

      if (this.applyWasmV2ResetRequest(runtime)) {
        super.pc = wasm.zxnextGetCpuPc();
        this.frameCompleted = false;
      }

      if (this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint) {
        const point = this.executionContext.terminationPoint;
        if (point != null && this.pc === (point & 0xffff)) {
          return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.UntilExecutionPoint);
        }
      }
      if (watchesBusAccess && this.hasWasmV2AccessBreakpoint()) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }
      if (this.shouldStopAtWasmV2Breakpoint(instructionsExecuted)) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }
      if (this.executionContext.debugStepMode === DebugStepMode.StepInto) {
        if (debugSupport) {
          debugSupport.imminentBreakpoint = undefined;
        }
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.DebugEvent);
      }
      if (this.getFrameCommand()) {
        return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.Normal);
      }
    }

    return this.finishWasmV2DebugLoop(runtime, FrameTerminationMode.Normal);
  }

  /**
   * Single exit of the debug loop: brings the TypeScript-side machine state back in step with the
   * WASM core before anyone can observe it. The loop itself only keeps `pc` and the frame flag up to
   * date, so every register, counter and bus mirror is refreshed here.
   */
  private finishWasmV2DebugLoop(
    runtime: ZxNextWasmV2Runtime,
    termination: FrameTerminationMode
  ): FrameTerminationMode {
    this.syncCpuFromWasmV2(runtime);
    this.importWasmV2BusAccess(runtime);
    this.executionContext.lastTerminationReason = termination;
    return termination;
  }

  /**
   * Records where a step-out should land, reading the core's shadow stack.
   *
   * The inherited implementation walks a stack that `Z80Cpu` pushes on every CALL and RST — code
   * that never runs here, because the CPU executes inside the WASM core. It therefore always
   * produced -1, so `stepOutAddress === pc` could never be true and step-out had nothing to stop
   * on. The core keeps the equivalent stack now; this reads the top of it.
   *
   * `0xffffffff` is the core's "nothing has been called" sentinel, mapped back to the -1 the rest
   * of the debugger expects.
   */
  /** Interrupt handlers running now, from the core's shadow stack (source stepping, plan §10.2.7). */
  override getInterruptDepth(): number {
    const w = this.wasmV2Runtime?.exports;
    return w ? w.zxnextGetInterruptDepth() : super.getInterruptDepth();
  }

  override markStepOutAddress(): void {
    const address = this.requireWasmV2Runtime().exports.zxnextGetStepOutAddress();
    this.stepOutAddress = address === 0xffffffff ? -1 : address;
  }

  private shouldStopAtWasmV2Breakpoint(instructionsExecuted: number): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;

    return shouldStopAtDebugPoint({
      debugSupport,
      debugStepMode: this.executionContext.debugStepMode,
      pc: this.pc,
      instructionsExecuted,
      getPartition: (address) => this.getPartition(address),
      getCallInstructionLength: () => this.getCallInstructionLength(),
      /*
       * From the core, not the mirrored fields: the debug loop keeps only PC in step per instruction
       * (the rest is synced when it exits), so `this.sp` would be the SP the run started with and a
       * source step over a call would stop inside the callee.
       */
      getSp: () => this.wasmV2Runtime?.exports.zxnextGetCpuSp() ?? this.sp,
      getInterruptDepth: () => this.getInterruptDepth(),
      getRegisters: () => {
        const w = this.wasmV2Runtime?.exports;
        return w
          ? { af: w.zxnextGetCpuAf(), bc: w.zxnextGetCpuBc(), de: w.zxnextGetCpuDe(), hl: w.zxnextGetCpuHl() }
          : { af: this.af, bc: this.bc, de: this.de, hl: this.hl };
      },
      stepOutAddress: this.stepOutAddress,
      /*
       * `false` now that the core keeps a step-out stack: `stepOutAddress` above is the exact
       * address this routine returns to, which is what `DebugStepMode.StepOut` means. The flag
       * fires on the first RET at *any* depth, including one returning from a nested call, so
       * leaving it on would stop short of the caller. Same reasoning as the interpreted path.
       */
      retExecuted: false
    });
  }

  /**
   * Unpacks a hit the core latched and asks whether any breakpoint actually wants it.
   *
   * The core's watch table over-approximates - one slot per register cannot hold two different
   * value filters - so a hit is a candidate, not a verdict. A rejected one costs the single
   * boundary crossing that fetched it and the loop carries on.
   *
   * @param packed `zxnextTakeNextRegHit`'s word: bit 31 presence, 24-25 origin, 16-23 new value,
   *   8-15 old value, 0-7 register.
   */
  private acceptWasmV2NextRegHit(packed: number): boolean {
    if ((packed & 0x8000_0000) === 0) return false;
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;

    const reg = packed & 0xff;
    const newValue = (packed >>> 16) & 0xff;
    const origin = ((packed >>> 24) & 0x03) === 2 ? "copper" : "cpu";
    if (!debugSupport.hasNextRegWrite(reg, newValue, origin)) return false;

    /*
     * The context is captured here, not read off the machine later: a write to `$02` is about to
     * reset it, and the loop stops in front of that reset precisely so these two values still
     * describe the moment of the write.
     *
     * `opStartAddress` rather than `pc`, for the same reason a watchpoint reports it: `pc` has
     * already moved past the instruction that did the writing.
     */
    const pc = this.opStartAddress;
    this.lastNextRegWrite = {
      reg,
      oldValue: (packed >>> 8) & 0xff,
      newValue,
      origin,
      pc,
      partition: this.getPartition(pc)
    };
    return true;
  }

  /**
   * Unpacks a Copper hit the core latched and decides whether it stops the machine: always, when a
   * Copper step is pending; otherwise when a `cu:` breakpoint's filters accept it (D6).
   *
   * @param packed `zxnextTakeCopperHit`'s word: bit 31 presence, 28-29 kind (1 WAIT, 2 MOVE,
   *   3 NOP), 19-27 `hc_ula`, 10-18 `cvc`, 0-9 the list index.
   */
  private acceptWasmV2CopperHit(runtime: ZxNextWasmV2Runtime, packed: number): boolean {
    if ((packed & 0x8000_0000) === 0) return false;
    const index = packed & 0x3ff;
    const kindCode = (packed >>> 28) & 0x03;
    const word = (runtime.copperMemory[index * 2] << 8) | runtime.copperMemory[index * 2 + 1];
    if (this.copperStepPending) {
      this.copperStepPending = false;
    } else {
      const debugSupport = this.executionContext.debugSupport;
      if (!debugSupport?.hasCopperHit(index, word)) return false;
    }
    const pc = this.opStartAddress;
    this.lastCopperHit = {
      index,
      kind: kindCode === 1 ? "wait" : kindCode === 2 ? "move" : "nop",
      word,
      line: (packed >>> 10) & 0x1ff,
      hc: (packed >>> 19) & 0x1ff,
      pc,
      partition: this.getPartition(pc)
    };
    return true;
  }

  private hasWasmV2AccessBreakpoint(): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    // --- All four asked, not short-circuited: a conditional breakpoint counts its hits (C11), so
    // --- a read that stops must not hide a write in the same instruction from its counter.
    const partitionOf = (addr: number) => this.getPartition(addr);
    const read = debugSupport.hasMemoryRead(
      this.lastMemoryReads,
      this.lastMemoryReadsCount,
      partitionOf,
      this.lastMemoryReadValues
    );
    const written = debugSupport.hasMemoryWrite(
      this.lastMemoryWrites,
      this.lastMemoryWritesCount,
      partitionOf,
      this.lastMemoryWriteValues
    );
    const portRead = debugSupport.hasIoRead(this.lastIoReadPort, this.lastIoReadValue);
    const portWritten = debugSupport.hasIoWrite(this.lastIoWritePort, this.lastIoWriteValue);
    return read || written || portRead || portWritten;
  }

  readScreenMemory(offset: number): number {
    return this.requireWasmV2Runtime().exports.zxnextReadScreenMemoryOffset(offset & 0x3fff);
  }

  override get64KFlatMemory(): Uint8Array {
    const flat = new Uint8Array(0x10000);
    for (let address = 0; address < flat.length; address++) {
      flat[address] = this.requireWasmV2Runtime().exports.zxnextReadMemory(address);
    }
    return flat;
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    let length = 0x2000;
    let offset = 0;
    if (index >= -4 && index <= -1) {
      length = 0x4000;
      offset = OFFS_NEXT_ROM + 0x4000 * (-index - 1);
    } else if (index === -5) {
      length = 0x4000;
      offset = OFFS_ALT_ROM_0;
    } else if (index === -6) {
      length = 0x4000;
      offset = OFFS_ALT_ROM_1;
    } else if (index === -7) {
      offset = OFFS_DIVMMC_ROM;
    } else if (index >= -23 && index <= -8) {
      offset = OFFS_DIVMMC_RAM + 0x2000 * (-index - 8);
    } else if (index >= 0 && index < 224) {
      offset = OFFS_NEXT_RAM + 0x2000 * index;
    }
    return runtime.memory.subarray(offset, offset + length);
  }

  override getCurrentPartitions(): number[] {
    const wasm = this.requireWasmV2Runtime().exports;
    return Array.from({ length: 8 }, (_, pageIndex) => {
      const bank8 = wasm.zxnextGetMemoryPageBank8(pageIndex);
      return bank8 < 0xff ? bank8 : 0xff;
    });
  }

  override getSelectedRomPage(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetMemorySelectedRomPage();
  }

  override getSelectedRamBank(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetMemorySelectedRamBank();
  }

  override getCurrentPartitionLabels(): string[] {
    // --- Names come from the machine's own partition map, so a page cannot be shown under a name
    // --- `parsePartitionLabel` would not accept back.
    const labels = this.getPartitionLabels();
    return Array.from({ length: 8 }, (_, pageIndex) => {
      const partition = this.getWasmV2PartitionForPage(pageIndex);
      return partition === undefined
        ? UNPAGED_PARTITION_LABEL
        : (labels[partition] ?? UNPAGED_PARTITION_LABEL);
    });
  }

  override getPartition(address: number): number | undefined {
    return this.getWasmV2PartitionForPage((address >>> 13) & 0x07);
  }

  getRomFlags(): boolean[] {
    return NEXT_ROM_FLAGS.slice();
  }

  override get isOsInitialized(): boolean {
    const runtime = this.wasmV2Runtime;
    return runtime != null && runtime.exports.zxnextGetCpuIy() === 0x5c3a;
  }

  override doReadMemory(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.zxnextReadMemory(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    return value;
  }

  override doWriteMemory(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextWriteMemory(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
  }

  override doReadPort(address: number): number {
    const runtime = this.requireWasmV2Runtime();
    const value = runtime.exports.zxnextReadPort(address & 0xffff);
    this.importWasmV2BusAccess(runtime);
    this.syncWasmV2StorageFrameCommand(runtime);
    return value;
  }

  override doWritePort(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    runtime.exports.zxnextWritePort(address & 0xffff, value & 0xff);
    this.importWasmV2BusAccess(runtime);
    this.syncWasmV2StorageFrameCommand(runtime);
  }

  /**
   * The Multiface (F9) and DivMMC (F10) NMI buttons feed the core's NMI state machine; the
   * TypeScript-side flags the base class sets are never read by the WASM CPU.
   */
  override async executeCustomCommand(command: string): Promise<any> {
    const runtime = this.wasmV2Runtime;
    if (runtime != null && command === "multifaceNmi") {
      runtime.exports.zxnextPressMultifaceNmiButton();
      return;
    }
    if (runtime != null && command === "divmmcNmi") {
      runtime.exports.zxnextPressDivMmcNmiButton();
      return;
    }
    // --- F8 / F5 / F6 (zxnext.vhd ~6290-6293, gated by $06 bit 7): the base class would change the
    // --- TypeScript devices, which the WASM core never reads. F8 increments nr_07_cpu_speed (~5736);
    // --- F5/F6 set or clear only $80 bit 7 (~2145-2148).
    if (runtime != null && (command === "cycleCpuSpeed" || command === "enableExpansionBus" || command === "disableExpansionBus")) {
      const ex = runtime.exports;
      if ((ex.zxnextGetNextRegisterDirect(0x06) & 0x80) === 0) return;
      if (command === "cycleCpuSpeed") {
        ex.zxnextSetNextRegisterDirect(0x07, (ex.zxnextGetNextRegisterDirect(0x07) + 1) & 0x03);
        return;
      }
      const bus = ex.zxnextGetNextRegisterDirect(0x80);
      ex.zxnextSetNextRegisterDirect(0x80, command === "enableExpansionBus" ? bus | 0x80 : bus & 0x7f);
      return (ex.zxnextGetNextRegisterDirect(0x80) & 0x80) !== 0;
    }
    // --- (The hotkeys set NextRegs directly: not being CPU writes, they are not a register's "last write".)
    // --- F2 / F3 / F7, the app's display hotkeys. They change the same NextReg bits a program
    // --- would, so the core applies them the way it applies a `$05` / `$09` write: the scandoubler
    // --- and 50/60 Hz bits take effect at the next frame start (zxnext.vhd ~6644-6649). Each
    // --- returns the new setting for the menu to report; F3 is gated by `$06` bit 5.
    // --- `nextRegs` holds the *stored* bits: the `$05` readback shows the effective ones, which
    // --- only change at the frame start, so two presses within a frame would read the same value.
    /*
     * `joystickMode:<side>:<mode>` - the Machine menu attaching a joystick.
     *
     * The payload rides in the command string because `executeCustomCommand` takes nothing else;
     * that is the seam every Next hotkey already uses. It writes NextReg `$05` exactly as a program
     * would, which is the *only* way to choose a mode - and means NextZXOS will overwrite it from
     * its own configuration at boot. The menu says so.
     */
    if (runtime != null && command.startsWith("joystickMode:")) {
      const [, side, mode] = command.split(":");
      const value = Number.parseInt(mode, 10) & 0x07;
      const nr05 = runtime.exports.zxnextGetNextRegisterDirect(0x05);
      // --- zxnext-input.c:34-37: joystick 1 is bit 3 + bits 7-6, joystick 2 is bit 1 + bits 5-4.
      const next =
        side === "left"
          ? (nr05 & 0x37) | ((value & 0x04) << 1) | ((value & 0x03) << 6)
          : (nr05 & 0xcd) | ((value & 0x04) >> 1) | ((value & 0x03) << 4);
      runtime.exports.zxnextSetNextRegisterDirect(0x05, next);
      return next;
    }
    if (runtime != null && command === "toggleScandoubler") {
      const nr05 = runtime.nextRegs[0x05] ^ 0x01;
      runtime.exports.zxnextSetNextRegisterDirect(0x05, nr05);
      return (nr05 & 0x01) !== 0;
    }
    if (runtime != null && command === "toggle5060Hz") {
      if ((runtime.exports.zxnextGetNextRegisterDirect(0x06) & 0x20) === 0) return;
      const nr05 = runtime.nextRegs[0x05] ^ 0x04;
      runtime.exports.zxnextSetNextRegisterDirect(0x05, nr05);
      return (nr05 & 0x04) !== 0;
    }
    if (runtime != null && command === "adjustScanlineWeight") {
      const ex = runtime.exports;
      const nr09 = runtime.nextRegs[0x09];
      const weight = ((nr09 & 0x03) + 1) & 0x03;
      // --- Bit 3 is a strobe (clear DivMMC mapram), never a stored setting: do not replay it
      ex.zxnextSetNextRegisterDirect(0x09, (nr09 & 0xf4) | weight);
      return weight;
    }
    return super.executeCustomCommand(command);
  }

  tbblueOut(address: number, value: number): void {
    const runtime = this.requireWasmV2Runtime();
    // --- NEXTREG leaves the $243B selection alone (zxnext.vhd ~4719-4725)
    runtime.exports.zxnextWriteNextRegister(address & 0xff, value & 0xff);
  }

  /**
   * Sets a key of the Next: 0-39 the 40-key matrix (`line * 5 + bit`), 40-55 the extra membrane keys
   * (`NextExtraKeyCode`). The core keeps the key state; the emulated keystroke queue plays through here.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    this.wasmV2Runtime?.exports.zxnextSetKeyStatus(key & 0xff, isDown ? 1 : 0);
  }

  /**
   * Holds the given 12 bits on a joystick connector (`IZxNextHostInputMachine`).
   *
   * Nothing is interpreted here. NextReg `$05` decides whether these pins show up on a Kempston
   * port, in NextReg `$B2`, or as membrane key presses through the joymap - all inside the core,
   * exactly as the FPGA does it.
   */
  setJoystickState(side: JoystickConnector, bits: number): void {
    const exports = this.wasmV2Runtime?.exports;
    if (side === "left") exports?.zxnextSetJoystickLeftState(bits & 0xfff);
    else exports?.zxnextSetJoystickRightState(bits & 0xfff);
  }

  /**
   * Delivers one PS/2 mouse packet (`IZxNextHostInputMachine`).
   *
   * The deltas are clamped to a signed byte rather than allowed to alias. The core takes
   * `(uint8_t)delta`, so 200 would arrive as -56 and the guest's pointer would jump *backwards*;
   * clamping keeps the direction right and merely makes an over-large movement short. It is a
   * guard, not the useful limit - see the note on `mousePacket` in the interface.
   */
  mousePacket(buttons: number, dx: number, dy: number, dz: number): void {
    this.wasmV2Runtime?.exports.zxnextMousePacket(
      buttons & 0x07,
      clampToSignedByte(dx),
      clampToSignedByte(dy),
      clampWheel(dz)
    );
  }

  /** How many times the CPU has read a mouse port (`IZxNextHostInputMachine`). */
  mousePortReadCount(): number {
    return this.wasmV2Runtime?.exports.zxnextMousePortReadCount() ?? 0;
  }

  /** The core's own DPI multiplier (`IZxNextHostInputMachine`). */
  mouseDeltaScale(): number {
    const nr0a = this.wasmV2Runtime?.exports.zxnextGetNextRegisterDirect(0x0a) ?? 0x01;
    return MOUSE_DPI_SCALE[nr0a & 0x03];
  }

  override setTacts(value: number): void {
    super.setTacts(value);
    if (this.wasmV2Runtime != null) {
      this.wasmV2Runtime.exports.zxnextSetTacts(value >>> 0);
      this.syncCpuFromWasmV2(this.wasmV2Runtime);
    }
  }

  override async processFrameCommand(messenger: MessengerBase): Promise<void> {
    const frameCommand = this.getFrameCommand();
    if (frameCommand == null) return;

    await this.ensureWasmV2SdCardInfo(messenger);

    switch (frameCommand.command) {
      case "sd-read":
      case "sd-read-card1":
        await this.processWasmV2SdReadFrameCommand(messenger, frameCommand);
        return;
      case "sd-write":
      case "sd-write-card1":
        await this.processWasmV2SdWriteFrameCommand(messenger, frameCommand);
        return;
      default:
        await super.processFrameCommand(messenger);
    }
  }

  private async processWasmV2SdReadFrameCommand(
    messenger: MessengerBase,
    frameCommand: { command: "sd-read" | "sd-read-card1"; sector: number }
  ): Promise<void> {
    const runtime = this.requireWasmV2Runtime();
    const card = frameCommand.command === "sd-read-card1" ? 1 : 0;
    try {
      const sectorData = await createMainApi(messenger).readSdCardSector(frameCommand.sector);
      const data = sectorData instanceof Uint8Array ? sectorData : new Uint8Array(sectorData);
      const ptr = runtime.exports.zxnextGetSdWriteBufferPtr();
      new Uint8Array(runtime.memoryBuffer).set(data.slice(0, ZXNEXT_SD_BYTES_PER_SECTOR), ptr);
      runtime.exports.zxnextSetSdReadResponse(card, ptr, Math.min(data.length, ZXNEXT_SD_BYTES_PER_SECTOR));
    } catch (err) {
      console.log(`${frameCommand.command === "sd-read-card1" ? "SD card 1" : "SD card"} sector read error`, err);
      this.setWasmV2SdInlineResponse(runtime, card, Uint8Array.from([0x0d, 0xff, 0xff]));
    }
    runtime.exports.zxnextClearSdHostCommand();
  }

  private async processWasmV2SdWriteFrameCommand(
    messenger: MessengerBase,
    frameCommand: { command: "sd-write" | "sd-write-card1"; sector: number; data: Uint8Array }
  ): Promise<void> {
    const runtime = this.requireWasmV2Runtime();
    const card = frameCommand.command === "sd-write-card1" ? 1 : 0;

    // --- The SD image is a real file on disk, so it is the one piece of machine state a checkpoint
    // --- cannot rewind. Once the machine has written to it, any checkpoint taken before that write
    // --- describes a machine whose cached view of the filesystem no longer matches the disk, so the
    // --- checkpoint has to go - a slow cold boot next time beats a corrupted card.
    this.invalidateCheckpoints();

    try {
      const result = await createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data);
      runtime.exports.zxnextSetSdWriteResponse(card, result?.persistenceConfirmed ? 1 : 0);
    } catch (err) {
      console.log(`${frameCommand.command === "sd-write-card1" ? "SD card 1" : "SD card"} sector write error`, err);
      runtime.exports.zxnextSetSdWriteResponse(card, 0);
    }
    runtime.exports.zxnextClearSdHostCommand();
  }

  private async ensureWasmV2SdCardInfo(messenger: MessengerBase): Promise<void> {
    if (this.wasmV2SdCardInfoLoaded) return;
    try {
      const info = await createMainApi(messenger).getSdCardInfo();
      this.requireWasmV2Runtime().exports.zxnextSetSdCardInfo(0, info.totalSectors);
      this.wasmV2SdCardInfoLoaded = true;
    } catch (err) {
      console.warn("SD card info fetch failed, using default CSD", err);
    }
  }

  private setWasmV2SdInlineResponse(runtime: ZxNextWasmV2Runtime, card: number, response: Uint8Array): void {
    const ptr = runtime.exports.zxnextGetSdWriteBufferPtr();
    new Uint8Array(runtime.memoryBuffer).set(response, ptr);
    runtime.exports.zxnextSetSdReadResponse(card, ptr, response.length);
  }

  override get screenWidthInPixels(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenWidth();
  }

  /** The width of a screen line: the composed screen's width, in 7 MHz tacts. */
  override get tactsInDisplayLine(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenHeight();
  }

  /** A Next screen pixel is half as wide as it is tall (the 640-pixel-wide buffer shows a 4:3 picture). */
  getAspectRatio = (): [number, number] => [0.5, 1];

  /** The picture the screen shows: the layer debug preview while one is up (§4.2), else the machine's */
  override getPixelBuffer(): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    return this.layerPreviewShown ? runtime.layerPreview : runtime.pixelBuffer;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    const runtime = this.requireWasmV2Runtime();
    return this.layerPreviewShown ? runtime.layerPreviewBytes : runtime.pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
    this.layerPreviewShown = false;
    this.beamPreviewShown = false;
    const snapshot = new Uint32Array(runtime.pixelBuffer);
    if (savedPixelBuffer != null) {
      runtime.pixelBuffer.set(savedPixelBuffer.subarray(0, runtime.pixelBuffer.length));
    } else {
      runtime.exports.zxnextRenderInstantScreen();
    }
    return snapshot;
  }

  override getBufferStartOffset(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetPixelBufferStartOffset();
  }

  getAudioSamples(): AudioSample[] {
    const runtime = this.requireWasmV2Runtime();
    const sampleCount = runtime.exports.zxnextGetAudioMixerSampleCount();
    this.wasmV2AudioSamples.length = 0;
    for (let i = 0; i < sampleCount; i++) {
      this.wasmV2AudioSamples.push({
        left: runtime.exports.zxnextGetAudioMixerSampleLeft(i) / WASM_AUDIO_SAMPLE_SCALE,
        right: runtime.exports.zxnextGetAudioMixerSampleRight(i) / WASM_AUDIO_SAMPLE_SCALE
      });
    }
    return this.wasmV2AudioSamples;
  }

  /**
   * "Snoozed" in the CPU panel: the frame ended while a DMA transfer held the bus, and the CPU has not
   * run an instruction since. (The TypeScript frame runner's own snooze path is not used here.)
   */
  override isCpuSnoozed(): boolean {
    return (this.wasmV2Runtime?.exports.zxnextGetCpuHeldByDma() ?? 0) !== 0;
  }

  /**
   * The NextReg write a breakpoint last stopped on, with the value the register held before it.
   *
   * Set by the debug loop when a watched write is accepted, and cleared when the machine resumes,
   * so the Breakpoints panel can highlight the row that fired and show `$00 -> $03` beside it.
   */
  lastNextRegWrite?: NextRegWriteEvent;

  /**
   * The Copper instruction a `cu:` breakpoint or a Copper step last stopped on. Set by the debug
   * loop, cleared when the machine resumes.
   */
  lastCopperHit?: CopperHitEvent;

  /**
   * "Step Copper" is pending: the next debug run stops after the Z80 instruction during which the
   * Copper completes its next instruction, whatever its index (plan §4.6).
   */
  copperStepPending = false;

  /** Arms (or cancels) a Copper step for the next debug run. */
  requestCopperStep(armed = true): void {
    this.copperStepPending = armed;
  }

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return {
      ...super.getCpuState(),
      lastNextRegWrite: this.lastNextRegWrite,
      lastCopperHit: this.lastCopperHit
    };
  }

  override getDisassemblySections(options: Record<string, any>) {
    const sections = super.getDisassemblySections(options);
    if (sections.length > 0) return sections;
    return [{
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    }];
  }

  /** @deprecated Use `getNextUlaState` (the `IZxNextIdeMachine` member both cores implement). */
  getWasmV2UlaState(): UlaState {
    return this.getNextUlaState();
  }

  // ─── IZxNextIdeMachine: what the IDE panels read, from the core's own state ─────────────────

  getNextUlaState(): UlaState {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    // --- `fcl` is the frame clock, a tact count (`vc * totalHc + hc`), as on the TypeScript core
    const frameTact = ex.zxnextGetCurrentFrameTact();
    const { line, hc } = nextRasterPosition(frameTact, ex.zxnextGetTimingTotalHc());
    return {
      fcl: frameTact,
      frm: ex.zxnextGetFrames(),
      ras: line,
      pos: hc,
      // --- `pix` is a RenderingPhase *name*; neither core keeps a phase table for the Next
      pix: "n/a",
      bor: ULA_BORDER_COLOR_NAMES[ex.zxnextGetBorderColor() & 0x07],
      // --- Sampling the floating bus is a port read; a polled panel must not perform one
      flo: 0xff,
      con: ex.zxnextGetTotalContentionDelaySinceStart(),
      lco: ex.zxnextGetContentionDelaySincePause() - this.wasmV2ContentionPauseBase,
      ear: ex.zxnextGetEarBit() !== 0,
      mic: ex.zxnextGetMicBit() !== 0,
      keyLines: Array.from(runtime.keyboardLines),
      romP: this.getSelectedRomPage(),
      ramB: this.getSelectedRamBank()
    };
  }

  getCopperState(): CopperState {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    const beam = ex.zxnextGetCopperBeam();
    const timing = ex.zxnextGetCopperTiming();
    return {
      // --- One copy of the whole 2K rather than 2048 calls across the boundary (T8)
      ram: runtime.copperMemory.slice(),
      startMode: ex.zxnextGetCopperStartMode() & 0x03,
      pc: ex.zxnextGetCopperListAddress() & 0x3ff,
      writeAddress: ex.zxnextGetCopperInstructionAddress() & 0x7ff,
      lineOffset: ex.zxnextGetCopperVerticalLineOffset() & 0xff,
      beam: { line: beam & 0x1ff, hc: (beam >>> 9) & 0x1ff, waiting: ((beam >>> 18) & 1) !== 0 },
      timing: {
        lines: timing & 0xffff,
        hcs: (timing >>> 16) & 0xffff,
        upperBorder: ex.zxnextGetCopperUpperBorder()
      },
      lastHit: this.lastCopperHit
    };
  }

  /**
   * The Sprite Inspector's snapshot (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.3). Every value comes from
   * a side-effect-free getter: the status is peeked, not read through `$303B` (T1), and the resolve
   * goes into the core's IDE buffer, never the render cache (T3).
   */
  getNextSpriteState(): NextSpriteState {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    // --- The core keeps 8 transformed variants per pattern; variant 0 of pattern N (row N * 8) is
    // --- the raw layout, so the 16K is 64 rows of 256 bytes at a stride of 2048 (T2).
    const patterns = new Uint8Array(0x4000);
    const variants = runtime.spritePatterns8;
    for (let n = 0; n < 64; n++) {
      const row = n * 8 * 256;
      patterns.set(variants.subarray(row, row + 256), n * 256);
    }
    const resolvedPtr = ex.zxnextResolveSpritesForIde();
    const resolved = new Uint8Array(runtime.memoryBuffer, resolvedPtr, 128 * 8).slice();
    const lastVisible = ex.zxnextGetLastVisibleSpriteIndex();
    const status = ex.zxnextGetSpriteStatusPeek();
    return {
      attributes: runtime.spriteAttributes.slice(),
      patterns,
      resolved,
      lastVisible: lastVisible === 0xffffffff || lastVisible < 0 ? -1 : lastVisible & 0x7f,
      control: ex.zxnextGetSpriteControl() & 0xff,
      clip: [0, 1, 2, 3].map((i) => ex.zxnextGetSpriteClip(i) & 0xff) as [number, number, number, number],
      clipIndex: ex.zxnextGetSpriteClipIndex() & 0x03,
      transparencyIndex: ex.zxnextGetSpriteTransparencyIndex() & 0xff,
      status: { tooMany: (status & 0x02) !== 0, collision: (status & 0x01) !== 0 },
      upload: {
        spriteIndex: ex.zxnextGetSpriteIndex() & 0x7f,
        spriteSub: ex.zxnextGetSpriteSubIndex() & 0x07,
        patternIndex: ex.zxnextGetSpritePatternIndex() & 0x3f,
        patternSub: ex.zxnextGetSpritePatternSubIndex() & 0xff,
        mirrorIndex: ex.zxnextGetSpriteMirrorIndex() & 0xff,
        tied: (ex.zxnextGetNextRegisterDirect(0x09) & 0x10) !== 0
      },
      spritePaletteBank: (ex.zxnextGetNextRegisterDirect(0x43) & 0x08) !== 0 ? 1 : 0
    };
  }

  /**
   * The Tilemap Inspector's snapshot (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.3). Side-effect free
   * (D8): the registers come from getters and direct NextReg reads, the banks are two copies of
   * physical memory, one call for the whole 32K rather than a read per byte.
   */
  getNextTilemapState(): NextTilemapState {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    const control = ex.zxnextGetTilemapControl() & 0xff;
    return {
      regs: {
        enabled: (control & 0x80) !== 0,
        control,
        defaultAttr: ex.zxnextGetTilemapDefaultAttr() & 0xff,
        mapBank7: ex.zxnextGetTilemapBaseAddressUseBank7() !== 0,
        mapMsb: ex.zxnextGetTilemapBaseAddressMsb() & 0x3f,
        defBank7: ex.zxnextGetTilemapDefinitionAddressUseBank7() !== 0,
        defMsb: ex.zxnextGetTilemapDefinitionAddressMsb() & 0x3f,
        scrollX: ex.zxnextGetTilemapScrollX() & 0x3ff,
        scrollY: ex.zxnextGetTilemapScrollY() & 0xff,
        transparencyIndex: ex.zxnextGetTilemapTransparencyIndex() & 0x0f,
        globalTransparency: ex.zxnextGetNextRegisterDirect(0x14) & 0xff,
        clip: [0, 1, 2, 3].map((i) => ex.zxnextGetTilemapClip(i) & 0xff) as [number, number, number, number],
        clipIndex: ex.zxnextGetTilemapClipIndex() & 0x03,
        ulaDisabled: (ex.zxnextGetNextRegisterDirect(0x68) & 0x80) !== 0
      },
      bank5: runtime.memory.slice(BANK5_PHYSICAL, BANK5_PHYSICAL + 0x4000),
      bank7: runtime.memory.slice(BANK7_PHYSICAL, BANK7_PHYSICAL + 0x4000),
      slotOffsets: Array.from({ length: 8 }, (_, slot) => ex.zxnextGetMemoryPageReadOffset(slot) >>> 0),
      copperRunning: (ex.zxnextGetCopperStartMode() & 0x03) !== 0
    };
  }

  /**
   * The Layer 2 Inspector's snapshot (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.3). Side-effect free (D8):
   * the registers come from getters (the `$123B` value from the module, not a port read), the banks
   * are copies of physical memory, 128K per set in one call (the 80K of the widest layer and the three
   * banks a scroll can reach past it, T4). The shadow set is copied only when asked
   * (T9). A bank past 2 MB reads as zeros; the decode leaves its pixels out (T5).
   */
  getNextLayer2State(options?: { shadow?: boolean }): NextLayer2State {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    const copySet = (base: number) => {
      const out = new Uint8Array(LAYER2_READ_BYTES);
      for (let i = 0; i < LAYER2_READ_BYTES / 0x4000; i++) {
        const bank = base + i;
        if (isOutsideRam(bank)) break;
        const start = LAYER2_RAM_PHYSICAL + bank * 0x4000;
        out.set(runtime.memory.subarray(start, start + 0x4000), i * 0x4000);
      }
      return out;
    };
    const activeBank = ex.zxnextGetLayer2ActiveBank() & 0x7f;
    const shadowBank = ex.zxnextGetLayer2ShadowBank() & 0x7f;
    return {
      regs: {
        enabled: ex.zxnextGetLayer2Enabled() !== 0,
        activeBank,
        shadowBank,
        port123B: ex.zxnextGetLayer2Port123BPeek() & 0xff,
        bankOffset: ex.zxnextGetLayer2BankOffset() & 0x07,
        resolution: ex.zxnextGetLayer2Resolution() & 0x03,
        paletteOffset: ex.zxnextGetLayer2PaletteOffset() & 0x0f,
        scrollX: ex.zxnextGetLayer2ScrollX() & 0x1ff,
        scrollY: ex.zxnextGetLayer2ScrollY() & 0xff,
        clip: [0, 1, 2, 3].map((i) => ex.zxnextGetLayer2Clip(i) & 0xff) as [number, number, number, number],
        clipIndex: ex.zxnextGetLayer2ClipIndex() & 0x03,
        globalTransparency: ex.zxnextGetNextRegisterDirect(0x14) & 0xff,
        secondPalette: (ex.zxnextGetNextRegisterDirect(0x43) & 0x04) !== 0
      },
      displayed: copySet(activeBank),
      shadow: options?.shadow ? copySet(shadowBank) : undefined,
      slotOffsets: Array.from({ length: 8 }, (_, slot) => ex.zxnextGetMemoryPageReadOffset(slot) >>> 0),
      copperRunning: (ex.zxnextGetCopperStartMode() & 0x03) !== 0
    };
  }

  // ─── Layer debugging (`.plans/LAYER_COMPOSITION_PLAN.md`) ────────────────────────────────

  /** The debug view the host last set; re-pushed after anything that rewrites the core's memory */
  private layerDebug: NextLayerDebug = { ...NO_LAYER_DEBUG };
  private layerCaptureOn = false;
  /** The screen shows the recomposed preview until the machine runs again */
  private layerPreviewShown = false;

  private reapplyLayerDebug(runtime: ZxNextWasmV2Runtime): void {
    const d = this.layerDebug ?? NO_LAYER_DEBUG;
    runtime.exports.zxnextSetLayerDebug(d.hidden & 0x0f, d.solo & 0x0f, d.showTransparent ? 1 : 0);
    // --- Off and on: the capture describes a picture that is no longer the core's (T3)
    runtime.exports.zxnextSetLayerCapture(0);
    runtime.exports.zxnextSetLayerCapture(this.layerCaptureOn ? 1 : 0);
    this.layerPreviewShown = false;
    this.beamPreviewShown = false;
  }

  setLayerDebug(debug: NextLayerDebug): void {
    this.layerDebug = {
      hidden: debug.hidden & 0x0f,
      solo: debug.solo & 0x0f,
      showTransparent: !!debug.showTransparent
    };
    const d = this.layerDebug;
    this.requireWasmV2Runtime().exports.zxnextSetLayerDebug(d.hidden, d.solo, d.showTransparent ? 1 : 0);
  }

  getLayerDebug(): NextLayerDebug {
    const v = this.requireWasmV2Runtime().exports.zxnextGetLayerDebug();
    return { hidden: v & 0x0f, solo: (v >> 4) & 0x0f, showTransparent: ((v >> 8) & 1) !== 0 };
  }

  setLayerCapture(on: boolean): void {
    this.layerCaptureOn = on;
    this.requireWasmV2Runtime().exports.zxnextSetLayerCapture(on ? 1 : 0);
  }

  recomposeForDebug(): RecomposeStatus {
    const ex = this.requireWasmV2Runtime().exports;
    const status = ex.zxnextRecomposeForDebug();
    this.layerPreviewShown = true;
    // --- The recompose splits at the raster; a picture rendered to the beam stays rendered to it
    if (this.beamPreviewShown) ex.zxnextRenderPreviewToBeam(1);
    return decodeRecomposeStatus(status);
  }

  dropLayerPreview(): void {
    this.layerPreviewShown = false;
    this.beamPreviewShown = false;
  }

  // ─── The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.2) ─────────────────

  /** The preview shows the picture rendered up to the beam (D3) until the machine runs again */
  private beamPreviewShown = false;

  /** The raster timing of the frame in progress, read fresh (T4): it changes with NextReg $03 */
  private readBeamInfo(): { info: Uint32Array; timing: BeamTiming } {
    const runtime = this.requireWasmV2Runtime();
    const info = new Uint32Array(runtime.memoryBuffer, runtime.exports.zxnextGetBeamInfo(), 12).slice();
    const [, , totalVc, totalHc, firstVc, firstHc, displayXStart, displayYStart] = info;
    const width = runtime.exports.zxnextGetScreenWidth();
    const height = runtime.exports.zxnextGetScreenHeight();
    const startRows = Math.floor(runtime.exports.zxnextGetPixelBufferStartOffset() / width);
    // --- Two buffer pixels per HC; buffer (0, 0) is at (firstVc, firstHc) on every timing
    const timing: BeamTiming = {
      unit: "HC",
      tactsPerLine: totalHc,
      linesPerFrame: totalVc,
      firstVisibleTact: (firstVc + startRows) * totalHc + firstHc,
      tactsPerBufferPixel: 0.5,
      bufferWidth: width,
      bufferHeight: height,
      paperLeft: (displayXStart - firstHc) * 2,
      paperTop: displayYStart - firstVc - startRows,
      paperWidth: 512,
      paperHeight: 192
    };
    return { info, timing };
  }

  getBeamPosition(): BeamPosition {
    const { info, timing } = this.readBeamInfo();
    const start = this.requireWasmV2Runtime().exports.zxnextGetPixelBufferStartOffset();
    const rasterPixel = info[8];
    const beamPixel = info[9];
    const drawn = this.beamPreviewShown ? Math.max(rasterPixel, beamPixel) : rasterPixel;
    const position = beamAt(timing, info[10], Math.max(0, drawn - start));
    // --- The core's own counters, not a division: VC and HC as the raster has them
    return { ...position, line: info[0], lineTact: info[1] };
  }

  renderToBeamPreview(): void {
    const ex = this.requireWasmV2Runtime().exports;
    // --- Over a layer debug recompose, so a hidden layer stays hidden past the old split
    ex.zxnextRenderPreviewToBeam(this.layerPreviewShown ? 1 : 0);
    this.layerPreviewShown = true;
    this.beamPreviewShown = true;
  }

  probePixel(x: number, y: number): NextPixelProbe {
    const runtime = this.requireWasmV2Runtime();
    const width = runtime.exports.zxnextGetScreenWidth();
    const height = runtime.exports.zxnextGetScreenHeight();
    const inside = x >= 0 && y >= 0 && x < width && y < height;
    // --- (x, y) on the screen; the buffer may start past its first pixel (getBufferStartOffset)
    const start = runtime.exports.zxnextGetPixelBufferStartOffset();
    const ptr = runtime.exports.zxnextProbePixel(inside ? start + y * width + x : 0xffffffff);
    const words = new Uint32Array(runtime.memoryBuffer, ptr, 12);
    return decodeProbe(x, y, Array.from(words));
  }

  getNextLayerState(options?: { thumbnails?: boolean }): NextLayerState {
    const runtime = this.requireWasmV2Runtime();
    const ex = runtime.exports;
    const reg = (r: number) => ex.zxnextGetNextRegisterDirect(r) & 0xff;
    const r15 = ex.zxnextGetSpriteControl() & 0xff;
    const r68 = reg(0x68);
    const r6b = ex.zxnextGetTilemapControl() & 0xff;
    const clip = (get: (i: number) => number) =>
      [0, 1, 2, 3].map((i) => get(i) & 0xff) as [number, number, number, number];
    const debugWord = ex.zxnextGetLayerDebug();
    return {
      regs: {
        priorities: (r15 >> 2) & 7,
        blendMode: (r68 >> 5) & 3,
        stencil: (r68 & 0x01) !== 0,
        ulaEnabled: (r68 & 0x80) === 0,
        loRes: (r15 & 0x80) !== 0,
        tilemapEnabled: (r6b & 0x80) !== 0,
        tilemapOnTop: (r6b & 0x01) !== 0,
        layer2Enabled: ex.zxnextGetLayer2Enabled() !== 0,
        layer2Resolution: ex.zxnextGetLayer2Resolution() & 0x03,
        spritesEnabled: (r15 & 0x01) !== 0,
        spritesOverBorder: (r15 & 0x02) !== 0,
        spritesClipping: (r15 & 0x20) !== 0,
        globalTransparency: reg(0x14),
        fallback: reg(0x4a),
        ulaClip: clip((i) => ex.zxnextGetUlaClip(i)),
        layer2Clip: clip((i) => ex.zxnextGetLayer2Clip(i)),
        spriteClip: clip((i) => ex.zxnextGetSpriteClip(i)),
        tilemapClip: clip((i) => ex.zxnextGetTilemapClip(i)),
        copperRunning: (ex.zxnextGetCopperStartMode() & 0x03) !== 0
      },
      debug: this.getLayerDebug(),
      capture: ((debugWord >> 9) & 1) !== 0,
      paperBufferY: ex.zxnextGetCopperUpperBorder(),
      thumbnails: options?.thumbnails ? this.layerThumbnails(runtime) : undefined
    };
  }

  /**
   * Half-width RGBA pictures of each layer (the capture while it is on) and the machine's own picture:
   * every other column, every row, because a buffer pixel is half as wide as it is tall (0.5:1)
   */
  private layerThumbnails(runtime: ZxNextWasmV2Runtime): NextLayerThumbnails {
    const ex = runtime.exports;
    const width = ex.zxnextGetScreenWidth();
    const height = ex.zxnextGetScreenHeight();
    const tw = width >> 1;
    const th = height;
    const rgba = new Uint32Array(512);
    for (let i = 0; i < 512; i++) rgba[i] = ex.zxnextGetRgbaForRgb333(i) >>> 0;
    const layer = (index: number): Uint8ClampedArray => {
      const src = new Uint16Array(runtime.memoryBuffer, ex.zxnextLayerBufferPtr(index), width * height);
      const out = new Uint32Array(tw * th);
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const v = src[y * width + (x << 1)];
          // --- Transparent stays transparent (alpha 0): the document draws its own checker under it
          out[y * tw + x] = v & 0x8000 ? rgba[v & 0x1ff] : 0;
        }
      }
      return new Uint8ClampedArray(out.buffer);
    };
    // --- The machine's own picture, composed by the core with no debug view (never the masked screen)
    const composite = new Uint32Array(runtime.memoryBuffer, ex.zxnextRenderLayerComposite(), tw * th).slice();
    return {
      width: tw,
      height: th,
      ula: layer(0),
      tm: layer(1),
      l2: layer(2),
      spr: layer(3),
      composite: new Uint8ClampedArray(composite.buffer)
    };
  }

  getNextRegDescriptors(): NextRegDescriptors["descriptors"] {
    return NEXT_REG_DESCRIPTORS.slice();
  }

  getNextRegState(): NextRegState {
    return this.getWasmNextRegDeviceState();
  }

  getNextMemoryMapping(): NextMemoryMapping {
    return this.getWasmMemoryMappings();
  }

  getPaletteDeviceInfo(): PaletteDeviceInfo {
    const ex = this.requireWasmV2Runtime().exports;
    // --- The core's palette RAMs, in the `$43` bits 6-4 order: 0-3 first ULA / Layer 2 / sprite /
    // --- tilemap palette, 4-7 the second ones. Entries are the 9-bit RRRGGGBBB values.
    const palette = (index: number) => Array.from({ length: 256 }, (_, i) => ex.zxnextGetPaletteEntry(index, i));
    return {
      ulaFirst: palette(0),
      layer2First: palette(1),
      spriteFirst: palette(2),
      tilemapFirst: palette(3),
      ulaSecond: palette(4),
      layer2Second: palette(5),
      spriteSecond: palette(6),
      tilemapSecond: palette(7),
      storedPaletteValue: ex.zxnextGetPaletteStoredValue(),
      spriteTransparencyIndex: ex.zxnextGetSpriteTransparencyIndex(),
      tilemapTransparencyIndex: ex.zxnextGetNextRegisterDirect(0x4c) & 0x0f,
      reg43Value: ex.zxnextGetNextRegisterDirect(0x43),
      reg6bValue: ex.zxnextGetNextRegisterDirect(0x6b),
      ulaNextFormat: ex.zxnextGetNextRegisterDirect(0x42)
    };
  }

  getWasmV2Diagnostics(): ZxNextWasmV2Diagnostics {
    const runtime = this.requireWasmV2Runtime();
    return {
      backend: "wasm",
      engine: "v2",
      artifactName: runtime.artifactName,
      memoryBytes: runtime.exports.zxnextGetMemorySize(),
      flatMemoryBytes: runtime.exports.zxnextGetFlatMemorySize(),
      screenWidth: runtime.exports.zxnextGetScreenWidth(),
      screenHeight: runtime.exports.zxnextGetScreenHeight(),
      frames: runtime.exports.zxnextGetFrames(),
      tacts: runtime.exports.zxnextGetTacts(),
      tactsInFrame: runtime.exports.zxnextGetTactsInFrame(),
      currentFrameTact: runtime.exports.zxnextGetCurrentFrameTact(),
      frameCompleted: runtime.exports.zxnextGetFrameCompleted() !== 0,
      normalFrames: this.wasmV2NormalFrames,
      debugSteps: this.wasmV2DebugSteps,
      lastWasmStopReason: this.wasmV2LastStopReason,
      diagnosticFlags: runtime.exports.zxnextGetDiagnosticFlags()
    };
  }

  private hardResetWasmV2(runtime: ZxNextWasmV2Runtime): void {
    runtime.exports.zxnextHardReset();
    this.uploadCachedWasmV2RomImages(runtime);
    // --- The debug view survives a reset (Q2)
    this.reapplyLayerDebug(runtime);
    this.wasmV2ContentionPauseBase = 0;
    this.wasmV2NormalFrames = 0;
    this.wasmV2DebugSteps = 0;
    this.wasmV2LastStopReason = "reset";
  }

  private async loadWasmV2RomImages(): Promise<ZxNextWasmV2RomImages> {
    return {
      nextRom: await this.loadRomFromFile("roms/enNextZX.rom"),
      divMmcRom: await this.loadRomFromFile("roms/enNxtmmc.rom"),
      multifaceRom: await this.loadRomFromFile("roms/enNextMf.rom"),
      altRom: await this.loadRomFromFile("roms/enAltZX.rom")
    };
  }

  private uploadCachedWasmV2RomImages(runtime: ZxNextWasmV2Runtime): void {
    const roms = this.wasmV2RomImages;
    if (!roms) return;
    runtime.memory.set(roms.nextRom, OFFS_NEXT_ROM);
    runtime.memory.set(roms.divMmcRom, OFFS_DIVMMC_ROM);
    runtime.memory.set(roms.multifaceRom, OFFS_MULTIFACE_MEM);
    runtime.memory.set(roms.altRom, OFFS_ALT_ROM_0);
  }



  private syncAudioSampleRateToWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number" && audioRate !== this.wasmV2AudioSampleRate) {
      runtime.exports.zxnextSetAudioSampleRate(audioRate);
      this.wasmV2AudioSampleRate = audioRate;
    }
  }

  private syncWasmV2StorageFrameCommand(runtime: ZxNextWasmV2Runtime): void {
    if (this.getFrameCommand() != null) return;

    const hostCommand = runtime.exports.zxnextGetSdHostCommand();
    if (hostCommand === 0) return;

    const sector = runtime.exports.zxnextGetSdHostSector();
    switch (hostCommand) {
      case ZXNEXT_SD_HOST_COMMAND_READ:
        this.setFrameCommand({ command: "sd-read", sector });
        break;
      case ZXNEXT_SD_HOST_COMMAND_READ_CARD1:
        this.setFrameCommand({ command: "sd-read-card1", sector });
        break;
      case ZXNEXT_SD_HOST_COMMAND_WRITE: {
        const ptr = runtime.exports.zxnextGetSdWriteBufferPtr();
        const length = runtime.exports.zxnextGetSdWriteBufferLength();
        const memory = new Uint8Array(runtime.memoryBuffer);
        this.setFrameCommand({
          command: "sd-write",
          sector,
          data: memory.slice(ptr, ptr + length)
        });
        break;
      }
      case ZXNEXT_SD_HOST_COMMAND_WRITE_CARD1: {
        const ptr = runtime.exports.zxnextGetSdWriteBufferPtr();
        const length = runtime.exports.zxnextGetSdWriteBufferLength();
        const memory = new Uint8Array(runtime.memoryBuffer);
        this.setFrameCommand({
          command: "sd-write-card1",
          sector,
          data: memory.slice(ptr, ptr + length)
        });
        break;
      }
      default:
        break;
    }
  }





  /**
   * The Next Memory Mapping panel's state, from the core's own paging registers and page table.
   */
  private getWasmMemoryMappings(): NextMemoryMapping {
    const ex = this.requireWasmV2Runtime().exports;
    const port1ffd = ex.zxnextGetMemoryPort1ffd();
    return {
      allRamBanks: allRamBanksFor(port1ffd),
      selectedRom: this.getSelectedRomPage(),
      selectedBank: this.getSelectedRamBank(),
      port7ffd: ex.zxnextGetMemoryPort7ffd(),
      port1ffd,
      portDffd: ex.zxnextGetMemoryPortDffd(),
      portEff7: ex.zxnextGetMemoryPortEff7(),
      // --- What a $123B read returns, peeked (LAYER2_INSPECTOR_PLAN §4.2)
      portLayer2: ex.zxnextGetLayer2Port123BPeek() & 0xff,
      portTimex: 0,
      divMmc: ex.zxnextGetDivMmcPortE3Value(),
      divMmcIn: ex.zxnextGetDivMmcConmem() !== 0 || ex.zxnextGetDivMmcAutoMapActive() !== 0,
      pageInfo: Array.from({ length: 8 }, (_, page) => {
        const writeOffset = ex.zxnextGetMemoryPageWriteOffset(page);
        return {
          // --- Offsets into the Next's physical memory: the same layout on both cores
          readOffset: ex.zxnextGetMemoryPageReadOffset(page),
          writeOffset: writeOffset >>> 0 === ZXNEXT_WASM_NO_WRITE_OFFSET ? null : writeOffset,
          bank16k: ex.zxnextGetMemoryPageBank16(page),
          bank8k: ex.zxnextGetMemoryPageBank8(page)
        };
      })
    };
  }

  /**
   * The partition index paged into an 8K page, or `undefined` when the page is not backed by one.
   *
   * The WASM counterpart of `MemoryDevice.getPartitionForPage`. The core decides
   * (`zxnextPartitionOfPage` in `zxnext.c`, the same function breakpoint conditions' `page()` uses),
   * the way the CPU reads code: in slots 0-1 the Multiface (no partition) wins over the DivMMC
   * (`DM`, `M0`..`MF`), and both over the MMU. Before, this read the MMU's page tables only, so
   * while the DivMMC was mapped it named the ROM underneath - for source mapping, partitioned
   * breakpoints and the execution history alike.
   */
  private getWasmV2PartitionForPage(pageIndex: number): number | undefined {
    const partition = this.requireWasmV2Runtime().exports.zxnextGetPartitionOfPage(pageIndex & 0x07);
    return partition === ZXNEXT_NO_PARTITION ? undefined : partition;
  }

  /**
   * The Next Registers panel's values: one entry per documented register, what a `$253B` read
   * returns (not for write-only registers) and the last value the CPU wrote to it (not for
   * read-only ones, nor before a write).
   */
  private getWasmNextRegDeviceState(): NextRegDeviceState {
    const ex = this.requireWasmV2Runtime().exports;
    const regs: RegValueState[] = NEXT_REG_DESCRIPTORS.map((d) => {
      const lastWrite = ex.zxnextGetNextRegisterLastWrite(d.id);
      return {
        id: d.id,
        lastWrite: d.isReadOnly || lastWrite > 0xff ? undefined : lastWrite,
        value: d.isWriteOnly ? undefined : ex.zxnextPeekNextRegister(d.id)
      };
    });
    return {
      lastRegisterIndex: ex.zxnextGetNextRegisterIndex(),
      regs
    };
  }

  /**
   * The core's breakpoint condition evaluator: its program store. The shared C evaluator reads the
   * registers and memory inside the core (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`).
   */
  getConditionStore(): ConditionStore | undefined {
    return this.wasmV2Runtime ? conditionStoreOf(this.wasmV2Runtime) : undefined;
  }


  private syncCpuFromWasmV2(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.af = wasm.zxnextGetCpuAf();
    this.af_ = wasm.zxnextGetCpuAfAlt();
    this.bc = wasm.zxnextGetCpuBc();
    this.bc_ = wasm.zxnextGetCpuBcAlt();
    this.de = wasm.zxnextGetCpuDe();
    this.de_ = wasm.zxnextGetCpuDeAlt();
    this.hl = wasm.zxnextGetCpuHl();
    this.hl_ = wasm.zxnextGetCpuHlAlt();
    this.ix = wasm.zxnextGetCpuIx();
    this.iy = wasm.zxnextGetCpuIy();
    this.ir = wasm.zxnextGetCpuIr();
    this.wz = wasm.zxnextGetCpuWz();
    this.pc = wasm.zxnextGetCpuPc();
    this.sp = wasm.zxnextGetCpuSp();
    this.tacts = wasm.zxnextGetTacts();
    this.frames = wasm.zxnextGetFrames();
    this.frameTacts = wasm.zxnextGetCurrentFrameTact();
    this.currentFrameTact = this.frameTacts;
    // --- The frame length in 28 MHz clocks, from the raster in effect (50/60 Hz, the timing mode):
    // --- `MachineController` paces frames by it and the keystroke queue counts in it.
    // --- The effective CPU speed ($07 bits 5-4) as a multiplier of the 3.5 MHz base clock: what
    // --- the status bar shows. Frame pacing does not read it (it goes by `tactsInFrame`).
    this.clockMultiplier = 1 << ((wasm.zxnextGetNextRegisterDirect(0x07) >> 4) & 0x03);
    this.setTactsInFrame(wasm.zxnextGetTactsInFrame());
    this.tactsInCurrentFrame = wasm.zxnextGetTactsInFrame();
    this.sigINT = wasm.zxnextGetCpuSigInt() !== 0;
    this.frameCompleted = wasm.zxnextGetFrameCompleted() !== 0;
    this.halted = wasm.zxnextGetCpuHalted() !== 0;
    this.opCode = wasm.zxnextGetCpuPrefix();
    this.iff1 = wasm.zxnextGetCpuIff1() !== 0;
    this.iff2 = wasm.zxnextGetCpuIff2() !== 0;
    this.interruptMode = wasm.zxnextGetCpuInterruptMode();
    // --- The core owns the contention counters; `contentionDelaySincePause` restarts at every run,
    // --- which the core's own counter does not, so it is measured from the base taken then.
    this.totalContentionDelaySinceStart = wasm.zxnextGetTotalContentionDelaySinceStart();
    this.contentionDelaySincePause = wasm.zxnextGetContentionDelaySincePause() - this.wasmV2ContentionPauseBase;
  }

  override resetContentionDelaySincePause(): void {
    this.wasmV2ContentionPauseBase = this.wasmV2Runtime?.exports.zxnextGetContentionDelaySincePause() ?? 0;
    this.contentionDelaySincePause = 0;
  }

  private importWasmV2BusAccess(runtime: ZxNextWasmV2Runtime): void {
    const wasm = runtime.exports;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;
    importAccessLog(this, runtime.accessLog, wasm.zxnextGetAccessLogCount());

    const portAddress = wasm.zxnextGetLastPortAddress();
    const portValue = wasm.zxnextGetLastPortValue();
    if (wasm.zxnextGetLastPortIsWrite() !== 0) {
      this.lastIoWritePort = portAddress;
      this.lastIoWriteValue = portValue;
    } else if (wasm.zxnextGetLastPortAccessed() !== 0) {
      this.lastIoReadPort = portAddress;
      this.lastIoReadValue = portValue;
    }
  }

  private syncWasmV2AfFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuAf(super.af);
  }

  private syncWasmV2BcFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuBc(super.bc);
  }

  private syncWasmV2DeFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuDe(super.de);
  }

  private syncWasmV2HlFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuHl(super.hl);
  }

  private syncWasmV2IxFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIx(super.ix);
  }

  private syncWasmV2IyFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIy(super.iy);
  }

  private syncWasmV2IrFromFacade(): void {
    this.wasmV2Runtime?.exports.zxnextSetCpuIr(super.ir);
  }

  private requireWasmV2Runtime(): ZxNextWasmV2Runtime {
    if (this.wasmV2Runtime == null) {
      throw new Error("ZX Spectrum Next WASM v2 runtime is not loaded.");
    }
    return this.wasmV2Runtime;
  }
}

/** A PS/2 packet carries each axis in one signed byte. */
function clampToSignedByte(value: number): number {
  const whole = Math.trunc(value) || 0;
  return whole < -128 ? -128 : whole > 127 ? 127 : whole;
}

/** The wheel is a 4-bit signed field. */
function clampWheel(value: number): number {
  const whole = Math.trunc(value) || 0;
  return whole < -8 ? -8 : whole > 7 ? 7 : whole;
}

/** NextReg `$0A` bits 1-0, as `ps2_mouse.v` applies them: doubled, as is, halved, quartered. */
const MOUSE_DPI_SCALE = [2, 1, 0.5, 0.25];
