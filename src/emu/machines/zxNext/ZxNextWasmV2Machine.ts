import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import {
  ULA_BORDER_COLOR_NAMES,
  type CpuState,
  type NextMemoryMapping,
  type NextRegDescriptors,
  type NextRegState,
  type PaletteDeviceInfo,
  type UlaState
} from "@common/messaging/EmuApi";
import { nextRasterPosition, type IZxNextIdeMachine } from "./IZxNextIdeMachine";
import { NEXT_REG_DESCRIPTORS } from "./nextRegDescriptors";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { NextRegDeviceState, RegValueState } from "./nextRegDescriptors";
import type { ZxNextWasmV2LoaderOptions, ZxNextWasmV2Runtime } from "./wasm/ZxNextWasmV2Loader";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { shouldStopAtDebugPoint } from "../DebugStepDecision";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { MemorySectionType } from "@abstractions/MemorySection";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { createMainApi } from "@common/messaging/MainApi";
import { loadZxNextWasmV2 } from "./wasm/ZxNextWasmV2Loader";
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

const WASM_AUDIO_SAMPLE_SCALE = 32768.0;

export type ZxNextWasmV2MigrationSurface =
  | "registers"
  | "memory"
  | "disassembly"
  | "ULA"
  | "screen"
  | "frame"
  | "debug";

export type ZxNextWasmV2DefaultBlocker =
  | "ula-screen-tact-pipeline-parity"
  | "ula-timex-mode-rendering-parity"
  | "ula-next-plus-rendering-parity"
  | "screen-layer-composition-parity";

export type ZxNextWasmV2StopReason =
  | "reset"
  | "debugStep"
  | "wasmFrameCommand"
  | "wasmFrameComplete";

export const ZXNEXT_WASM_V2_MIGRATED_SURFACES: ZxNextWasmV2MigrationSurface[] = [
  "registers",
  "memory",
  "disassembly",
  "frame",
  "debug"
];

export const ZXNEXT_WASM_V2_DEFAULT_READY = false;
export const ZXNEXT_WASM_V2_DEFAULT_BLOCKERS: ZxNextWasmV2DefaultBlocker[] = [
  "ula-screen-tact-pipeline-parity",
  "ula-timex-mode-rendering-parity",
  "ula-next-plus-rendering-parity",
  "screen-layer-composition-parity"
];

const ZXNEXT_SD_HOST_COMMAND_READ = 1;
const ZXNEXT_SD_HOST_COMMAND_WRITE = 2;
const ZXNEXT_SD_HOST_COMMAND_READ_CARD1 = 3;
const ZXNEXT_SD_HOST_COMMAND_WRITE_CARD1 = 4;
const ZXNEXT_SD_BYTES_PER_SECTOR = 512;

export type ZxNextWasmV2Diagnostics = {
  backend: "wasm";
  engine: "v2";
  artifactName: string;
  defaultReady: boolean;
  defaultBlockers: ZxNextWasmV2DefaultBlocker[];
  migratedSurfaces: ZxNextWasmV2MigrationSurface[];
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
   * The core's linear memory, minus the frame-trace ring that sits between these two halves.
   *
   * That ring is ~19.5 MiB of the 32 MiB buffer and holds nothing but diagnostics, so leaving it out
   * takes the checkpoint from 32 MiB to roughly 13 MiB and lets a trace being recorded across a
   * restore stay intact - the ring's header lives inside the excluded span, so it stays consistent
   * with its own contents.
   */
  memoryBeforeTrace: Uint8Array;
  memoryAfterTrace: Uint8Array;

  normalFrames: number;
  debugSteps: number;
  lastStopReason: ZxNextWasmV2StopReason;
  audioSampleRate: number;
  sdCardInfoLoaded: boolean;
  lastRenderedFrameTact: number;
};

export class ZxNextWasmV2Machine extends ZxNextWasmHost implements IZxNextIdeMachine {
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
    const traceStart = runtime.exports.zxnextTraceGetStartOffset();
    const traceEnd = traceStart + runtime.frameTrace.byteLength;
    this.wasmV2Checkpoint = {
      key,
      memoryBeforeTrace: all.slice(0, traceStart),
      memoryAfterTrace: all.slice(traceEnd),
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
    all.set(checkpoint.memoryBeforeTrace, 0);
    all.set(checkpoint.memoryAfterTrace, all.length - checkpoint.memoryAfterTrace.length);
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
    return true;
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
      this.frameCompleted = false;
    }

    // --- Queued keystrokes are timed in tacts and held for whole frames, so the fast path above
    // --- plays them once per frame. Do the same here instead of once per instruction: the queue
    // --- cannot advance faster than the frame counter it is measured against anyway.
    this.emulateKeystroke();

    // --- Mirroring the core's bus activity costs ~7 boundary crossings per instruction and is only
    // --- ever read by the memory/IO breakpoint test, so decide once whether it is needed at all.
    const watchesBusAccess = debugSupport?.hasAccessBreakpoints() ?? false;

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
      if (watchesBusAccess && wasm.zxnextGetCpuPrefix() === 0) this.opStartAddress = this.pc;
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

  private hasWasmV2AccessBreakpoint(): boolean {
    const debugSupport = this.executionContext.debugSupport;
    if (!debugSupport) return false;
    return (
      debugSupport.hasMemoryRead(this.lastMemoryReads, this.lastMemoryReadsCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasMemoryWrite(this.lastMemoryWrites, this.lastMemoryWritesCount, (addr) => this.getPartition(addr)) ||
      debugSupport.hasIoRead(this.lastIoReadPort) ||
      debugSupport.hasIoWrite(this.lastIoWritePort)
    );
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

  /** The width of a screen line, as the TypeScript core reports it (the composed screen's width). */
  override get tactsInDisplayLine(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenWidth();
  }

  override get screenHeightInPixels(): number {
    return this.requireWasmV2Runtime().exports.zxnextGetScreenHeight();
  }

  /** A Next screen pixel is half as wide as it is tall (the 640-pixel-wide buffer shows a 4:3 picture). */
  getAspectRatio = (): [number, number] => [0.5, 1];

  override getPixelBuffer(): Uint32Array {
    return this.requireWasmV2Runtime().pixelBuffer;
  }

  getPixelBufferBytes(): Uint8ClampedArray {
    return this.requireWasmV2Runtime().pixelBufferBytes;
  }

  override renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    const runtime = this.requireWasmV2Runtime();
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

  override getCpuState(): CpuState {
    const runtime = this.wasmV2Runtime;
    if (runtime != null) {
      this.syncCpuFromWasmV2(runtime);
      this.importWasmV2BusAccess(runtime);
    }
    return super.getCpuState();
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
      defaultReady: ZXNEXT_WASM_V2_DEFAULT_READY,
      defaultBlockers: ZXNEXT_WASM_V2_DEFAULT_BLOCKERS.slice(),
      migratedSurfaces: ZXNEXT_WASM_V2_MIGRATED_SURFACES.slice(),
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
   * The Next Memory Mapping panel's state, from the core's own paging registers and page table -
   * the same fields `MemoryDevice.getMemoryMappings` reports on the TypeScript core.
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
      portLayer2: 0,
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
   * The WASM counterpart of `MemoryDevice.getPartitionForPage`, and the only offset-to-index
   * function on this path. It replaces a pair — one building a label from offsets, one parsing that
   * label back — whose vocabularies (`A0`/`A1`, `D0`..`DF`) matched each other and nothing else in
   * the system.
   *
   * The `bank8 < 224` threshold is carried over verbatim from the function this replaces; see
   * `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8, decision 3.
   */
  private getWasmV2PartitionForPage(pageIndex: number): number | undefined {
    const wasm = this.requireWasmV2Runtime().exports;
    const bank8 = wasm.zxnextGetMemoryPageBank8(pageIndex);
    // --- The 8K page itself, not `>> 1`. See `MemoryDevice.getPartitionForPage`.
    if (bank8 < 224) return bank8;

    const readOffset = wasm.zxnextGetMemoryPageReadOffset(pageIndex);
    if (readOffset >= OFFS_NEXT_RAM) return undefined;
    if (readOffset >= OFFS_DIVMMC_RAM) {
      // --- DivMMC RAM pages 0..15 occupy partitions -8..-23 ("M0".."MF")
      return -8 - ((readOffset - OFFS_DIVMMC_RAM) >> 13);
    }
    if (readOffset >= OFFS_ALT_ROM_1 && readOffset < OFFS_ALT_ROM_1 + 0x4000) {
      return -6; // --- Alt ROM 1, "X1"
    }
    if (readOffset >= OFFS_ALT_ROM_0 && readOffset < OFFS_ALT_ROM_0 + 0x4000) {
      return -5; // --- Alt ROM 0, "X0"
    }
    if (readOffset >= OFFS_DIVMMC_ROM && readOffset < OFFS_DIVMMC_ROM + 0x2000) {
      return -7; // --- DivMMC ROM, "DM"
    }
    if (readOffset < OFFS_NEXT_ROM + 0x10000) {
      // --- Next ROM 0..3 occupy partitions -1..-4
      return -1 - (readOffset >> 14);
    }
    return undefined;
  }

  /**
   * The Next Registers panel's values, the way the TypeScript core's `getNextRegDeviceState` reports
   * them: one entry per documented register, what a `$253B` read returns (not for write-only
   * registers) and the last value the CPU wrote to it (not for read-only ones, nor before a write).
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
    this.lastMemoryReadsCount = 0;
    this.lastMemoryWritesCount = 0;
    this.lastIoReadPort = undefined;
    this.lastIoWritePort = undefined;

    const memoryAddress = wasm.zxnextGetLastMemoryAddress();
    const memoryValue = wasm.zxnextGetLastMemoryValue();
    if (wasm.zxnextGetLastMemoryIsWrite() !== 0) {
      this.lastMemoryWrites[this.lastMemoryWritesCount++] = memoryAddress;
      this.lastMemoryWriteValue = memoryValue;
    } else if (wasm.zxnextGetLastMemoryAccessed() !== 0) {
      this.lastMemoryReads[this.lastMemoryReadsCount++] = memoryAddress;
      this.lastMemoryReadValue = memoryValue;
    }

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
