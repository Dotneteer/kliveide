import type { ILiteEvent } from "../../common/abstractions/ILiteEvent";
import type { MachineCommand } from "../../common/abstractions/MachineCommand";
import { MachineControllerState } from "../../common/abstractions/MachineControllerState";
import type { Sp48TapeBlock } from "../tape/tape-parser";
import { createSavedTapeTzx } from "../tape/tape-save";
import { LiteEvent } from "../utils/lite-event";
import {
  instantiateWasmZxSpectrum48Machine,
  loadWasmZxSpectrum48Machine,
  type Sp48AudioSample,
  type Sp48BusAccess,
  type Sp48CpuState,
  type WasmZxSpectrum48Machine
} from "./WasmZxSpectrum48Machine";

export type Sp48MachineCommand = MachineCommand;
export type Sp48MachineState = MachineControllerState;

export type Sp48FrameCompletedEvent = {
  frames: number;
  tacts: number;
  executionTimeInMs: number;
  audioSampleCount: number;
  audioSamples: Sp48AudioSample[];
  pixelBuffer: Uint32Array;
  savedTapeFileInfo?: Sp48SavedTapeFileInfo;
};

export type Sp48PendingSavedTapeFile = {
  name: string;
  headerBlock: Uint8Array;
  dataBlock: Uint8Array;
};

export type Sp48SavedTapeFileInfo = {
  name: string;
  contents: Uint8Array;
  blockCount: number;
};

export type Sp48MachineControllerOptions = {
  audioSampleRate?: number;
  is16k?: boolean;
  isNtsc?: boolean;
  romName?: string;
  wasmBytes?: BufferSource;
};

export class Sp48MachineController {
  private readonly frameCompletedEmitter = new LiteEvent<Sp48FrameCompletedEvent>();
  private readonly breakpoints = new Set<number>();
  private readonly stepOutStack: number[] = [];
  private state: Sp48MachineState = MachineControllerState.None;
  private isDebugging = false;
  private retainedSavedTapeHeaderBlock?: Uint8Array;
  private retainedSavedTapeName = "";
  private lastConsumedSavedTapeRevision = 0;
  private lastConsumedSavedTapeBlockIndex = 0;
  private pendingSavedTapeFile?: Sp48PendingSavedTapeFile;

  constructor(readonly machine: WasmZxSpectrum48Machine) {}

  get machineState(): Sp48MachineState {
    return this.state;
  }

  get frameCompleted(): ILiteEvent<Sp48FrameCompletedEvent> {
    return this.frameCompletedEmitter.expose();
  }

  issueMachineCommand(command: Sp48MachineCommand): Sp48MachineState {
    switch (command) {
      case "start":
        this.isDebugging = false;
        this.state = MachineControllerState.Running;
        break;

      case "debug":
        this.isDebugging = true;
        this.state = MachineControllerState.Running;
        if (this.breakpoints.size === 0) {
          this.state = MachineControllerState.Paused;
        }
        break;

      case "pause":
        if (this.state === MachineControllerState.Running) {
          this.state = MachineControllerState.Paused;
        }
        break;

      case "stop":
        this.isDebugging = false;
        this.stepOutStack.length = 0;
        this.state = MachineControllerState.Stopped;
        this.machine.hardReset();
        break;

      case "restart":
        this.stepOutStack.length = 0;
        this.machine.hardReset();
        this.state = MachineControllerState.Running;
        break;

      case "stepInto":
        if (this.state !== MachineControllerState.Running) {
          this.isDebugging = true;
          this.state = MachineControllerState.Paused;
          this.executeInstructionStep();
        }
        break;

      case "stepOver":
        if (this.state !== MachineControllerState.Running) {
          this.isDebugging = true;
          this.state = MachineControllerState.Paused;
          this.executeStepOver();
        }
        break;

      case "stepOut":
        if (this.state !== MachineControllerState.Running) {
          this.isDebugging = true;
          this.state = MachineControllerState.Paused;
          this.executeStepOut();
        }
        break;

      case "rewind":
        this.machine.rewindTape();
        break;
    }
    return this.state;
  }

  tickFrame(): boolean {
    if (this.state !== MachineControllerState.Running) {
      return false;
    }
    if (this.isDebugging) {
      this.executeDebugFrameSlice();
      return true;
    }
    this.executeFrame();
    return true;
  }

  getCpuState(): Sp48CpuState {
    return this.machine.getCpuState();
  }

  getLastMemoryAccess(): Sp48BusAccess {
    return this.machine.getLastMemoryAccess();
  }

  getLastPortAccess(): Sp48BusAccess {
    return this.machine.getLastPortAccess();
  }

  getRetainedSavedTapeName(): string {
    return this.retainedSavedTapeName;
  }

  getPendingSavedTapeFile(): Sp48PendingSavedTapeFile | undefined {
    return copyPendingSavedTapeFile(this.pendingSavedTapeFile);
  }

  consumePendingSavedTapeFile(): Sp48PendingSavedTapeFile | undefined {
    const pending = this.getPendingSavedTapeFile();
    this.pendingSavedTapeFile = undefined;
    return pending;
  }

  syncSavedTapeBlocks(): void {
    const revision = this.machine.getSavedTapeRevision();
    if (revision === this.lastConsumedSavedTapeRevision) {
      return;
    }

    const blockCount = this.machine.getSavedTapeBlockCount();
    if (blockCount < this.lastConsumedSavedTapeBlockIndex) {
      this.lastConsumedSavedTapeBlockIndex = 0;
    }

    for (let i = this.lastConsumedSavedTapeBlockIndex; i < blockCount; i++) {
      this.processSavedTapeBlock(this.machine.getSavedTapeBlock(i).data);
    }

    this.lastConsumedSavedTapeBlockIndex = blockCount;
    this.lastConsumedSavedTapeRevision = revision;
  }

  addBreakpoint(address: number): void {
    this.breakpoints.add(address & 0xffff);
  }

  removeBreakpoint(address: number): void {
    this.breakpoints.delete(address & 0xffff);
  }

  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  hasBreakpoint(address: number): boolean {
    return this.breakpoints.has(address & 0xffff);
  }

  getBreakpoints(): number[] {
    return [...this.breakpoints].sort((a, b) => a - b);
  }

  executeInstructionStep(): void {
    this.prepareStepOut();
    this.machine.executeInstruction();
    this.flushStepOut();
    if (this.machine.getFrameCompleted()) {
      this.machine.renderInstantScreen();
    }
  }

  renderInstantScreen(): Uint32Array {
    return this.machine.renderInstantScreen();
  }

  setKeyStatus(key: number, down: boolean): void {
    this.machine.setKeyStatus(key, down);
  }

  setTape(blocks: Sp48TapeBlock[], fileName: string): void {
    this.machine.uploadTape(blocks, fileName);
    void fileName;
  }

  clearTape(): void {
    this.machine.clearTape();
  }

  setTapeFastLoad(enabled: boolean): void {
    this.machine.setTapeFastLoad(enabled);
  }

  release(): void {
    this.frameCompletedEmitter.release();
  }

  private executeFrame(): void {
    const startedAt = performance.now();
    this.machine.executeMachineFrame();
    this.syncSavedTapeBlocks();
    const executionTimeInMs = performance.now() - startedAt;
    this.frameCompletedEmitter.fire(this.createFrameCompletedEvent(executionTimeInMs));
  }

  private executeDebugFrameSlice(): void {
    const startedAt = performance.now();
    const frameEndTact = this.machine.getNextFrameStartTact() + this.machine.tactsInFrame;
    const maxInstructions = 100_000;
    let instructions = 0;
    while (this.state === MachineControllerState.Running && this.machine.tacts < frameEndTact) {
      if (this.hasBreakpoint(this.machine.getCpuPc())) {
        this.state = MachineControllerState.Paused;
        break;
      }
      this.executeInstructionStep();
      this.syncSavedTapeBlocks();
      instructions++;
      if (instructions >= maxInstructions || this.machine.getFrameCompleted()) {
        break;
      }
    }
    if (this.machine.getFrameCompleted()) {
      const executionTimeInMs = performance.now() - startedAt;
      this.frameCompletedEmitter.fire(this.createFrameCompletedEvent(executionTimeInMs));
    }
  }

  private createFrameCompletedEvent(executionTimeInMs: number): Sp48FrameCompletedEvent {
    return {
      frames: this.machine.frames,
      tacts: this.machine.tacts,
      executionTimeInMs,
      audioSampleCount: this.machine.getAudioSampleCount(),
      audioSamples: this.machine.getAudioSamples(),
      pixelBuffer: this.machine.getPixelBuffer(),
      savedTapeFileInfo: this.consumeSavedTapeFileInfo()
    };
  }

  private consumeSavedTapeFileInfo(): Sp48SavedTapeFileInfo | undefined {
    const pending = this.consumePendingSavedTapeFile();
    if (!pending) {
      return undefined;
    }

    return {
      name: pending.name,
      contents: createSavedTapeTzx(pending.headerBlock, pending.dataBlock),
      blockCount: 2
    };
  }

  private processSavedTapeBlock(data: Uint8Array): void {
    if (data.length === 0x13 && data[0] === 0x00) {
      this.retainedSavedTapeHeaderBlock = new Uint8Array(data);
      this.retainedSavedTapeName = extractSpectrumTapeHeaderName(data);
      return;
    }

    if (data.length > 0 && data[0] === 0xff && this.retainedSavedTapeHeaderBlock) {
      this.pendingSavedTapeFile = {
        name: `${this.retainedSavedTapeName}.tzx`,
        headerBlock: new Uint8Array(this.retainedSavedTapeHeaderBlock),
        dataBlock: new Uint8Array(data)
      };
    }
  }

  private executeStepOver(): void {
    const nextAddress = this.getCallInstructionReturnAddress();
    if (nextAddress === 0) {
      this.executeInstructionStep();
      return;
    }
    this.executeUntil(() => this.machine.getCpuPc() === nextAddress);
  }

  private executeStepOut(): void {
    const target = this.stepOutStack.at(-1) ?? this.readStackWord();
    this.executeUntil(() => this.machine.getCpuRetExecuted() && this.machine.getCpuPc() === target);
  }

  private executeUntil(stop: () => boolean): void {
    const maxInstructions = 100_000;
    for (let i = 0; i < maxInstructions; i++) {
      if (this.hasBreakpoint(this.machine.getCpuPc())) {
        break;
      }
      this.executeInstructionStep();
      if (stop()) {
        break;
      }
    }
  }

  private prepareStepOut(): void {
    const returnAddress = this.getCallInstructionReturnAddress();
    if (returnAddress !== 0) {
      this.stepOutStack.push(returnAddress);
    }
  }

  private flushStepOut(): void {
    if (this.machine.getCpuRetExecuted() && this.stepOutStack.length > 0) {
      this.stepOutStack.pop();
    }
  }

  private getCallInstructionReturnAddress(): number {
    if (this.machine.getCpuPrefix() !== 0) {
      return 0;
    }
    const pc = this.machine.getCpuPc();
    const opCode = this.machine.readMemory(pc);
    switch (opCode) {
      case 0xc4:
        return !this.isZFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xcc:
        return this.isZFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xcd:
        return (pc + 3) & 0xffff;
      case 0xd4:
        return !this.isCFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xdc:
        return this.isCFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xe4:
        return !this.isPvFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xec:
        return this.isPvFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xf4:
        return !this.isSFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xfc:
        return this.isSFlagSet() ? (pc + 3) & 0xffff : 0;
      case 0xc7:
      case 0xcf:
      case 0xd7:
      case 0xdf:
      case 0xe7:
      case 0xef:
      case 0xf7:
      case 0xff:
        return (pc + 1) & 0xffff;
      default:
        return 0;
    }
  }

  private readStackWord(): number {
    const sp = this.machine.getCpuSp();
    return this.machine.readMemory(sp) | (this.machine.readMemory((sp + 1) & 0xffff) << 8);
  }

  private isSFlagSet(): boolean {
    return (this.machine.getCpuAf() & 0x0080) !== 0;
  }

  private isZFlagSet(): boolean {
    return (this.machine.getCpuAf() & 0x0040) !== 0;
  }

  private isPvFlagSet(): boolean {
    return (this.machine.getCpuAf() & 0x0004) !== 0;
  }

  private isCFlagSet(): boolean {
    return (this.machine.getCpuAf() & 0x0001) !== 0;
  }
}

function extractSpectrumTapeHeaderName(headerBlock: Uint8Array): string {
  return String.fromCharCode(...headerBlock.slice(2, 12)).trimEnd();
}

function copyPendingSavedTapeFile(
  file: Sp48PendingSavedTapeFile | undefined
): Sp48PendingSavedTapeFile | undefined {
  if (!file) {
    return undefined;
  }
  return {
    name: file.name,
    headerBlock: new Uint8Array(file.headerBlock),
    dataBlock: new Uint8Array(file.dataBlock)
  };
}

export async function createSp48MachineController(
  readBinaryFile: (path: string, resolveIn?: string) => Promise<Uint8Array>,
  options: Sp48MachineControllerOptions = {}
): Promise<Sp48MachineController> {
  const machine = options.wasmBytes
    ? await instantiateWasmZxSpectrum48Machine(options.wasmBytes)
    : await loadWasmZxSpectrum48Machine();
  await machine.setup(readBinaryFile, options.romName);
  machine.hardReset(options.is16k ?? false, options.isNtsc ?? false);
  if (options.audioSampleRate !== undefined) {
    machine.setAudioSampleRate(options.audioSampleRate);
  }
  return new Sp48MachineController(machine);
}
