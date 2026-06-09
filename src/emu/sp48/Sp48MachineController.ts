import type { ILiteEvent } from "../../common/abstractions/ILiteEvent";
import type { MachineCommand } from "../../common/abstractions/MachineCommand";
import { MachineControllerState } from "../../common/abstractions/MachineControllerState";
import { LiteEvent } from "../utils/lite-event";
import {
  instantiateWasmZxSpectrum48Machine,
  loadWasmZxSpectrum48Machine,
  type Sp48AudioSample,
  type WasmZxSpectrum48Machine
} from "./WasmZxSpectrum48Machine";

export type Sp48MachineCommand = MachineCommand;
export type Sp48MachineState = MachineControllerState;

export type Sp48FrameCompletedEvent = {
  frames: number;
  tacts: number;
  audioSampleCount: number;
  audioSamples: Sp48AudioSample[];
  pixelBuffer: Uint32Array;
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
  private state: Sp48MachineState = MachineControllerState.None;

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
      case "debug":
        this.state = MachineControllerState.Running;
        break;

      case "pause":
        if (this.state === MachineControllerState.Running) {
          this.state = MachineControllerState.Paused;
        }
        break;

      case "stop":
        this.state = MachineControllerState.Stopped;
        this.machine.hardReset();
        break;

      case "restart":
        this.machine.hardReset();
        this.state = MachineControllerState.Running;
        break;

      case "stepInto":
      case "stepOver":
      case "stepOut":
        if (this.state !== MachineControllerState.Running) {
          this.state = MachineControllerState.Paused;
          this.executeFrame();
        }
        break;
    }
    return this.state;
  }

  tickFrame(): boolean {
    if (this.state !== MachineControllerState.Running) {
      return false;
    }
    this.executeFrame();
    return true;
  }

  renderInstantScreen(): Uint32Array {
    return this.machine.renderInstantScreen();
  }

  setKeyStatus(key: number, down: boolean): void {
    this.machine.setKeyStatus(key, down);
  }

  release(): void {
    this.frameCompletedEmitter.release();
  }

  private executeFrame(): void {
    this.machine.executeMachineFrame();
    this.frameCompletedEmitter.fire({
      frames: this.machine.frames,
      tacts: this.machine.tacts,
      audioSampleCount: this.machine.getAudioSampleCount(),
      audioSamples: this.machine.getAudioSamples(),
      pixelBuffer: this.machine.getPixelBuffer()
    });
  }
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
