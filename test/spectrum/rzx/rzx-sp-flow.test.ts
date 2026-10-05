/*
 * The emulator-side RZX flows (`.plans/RZX_PLAN.md` Phases 5-7) on a real `MachineController`
 * driving the real 48K core: record and save, play to the end (D12), a desync pausing the machine
 * (D11), an IDE edit ending playback (trap 4), rollback, and render to video with a stubbed screen
 * recorder - one video frame per picture (D19), stopping at the end and at a desync.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";
import type { ScreenRecordingState } from "@common/state/AppState";

import createAppStore from "@state/store";
import { setMachineTypeAction, setModelTypeAction } from "@state/actions";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MI_SPECTRUM_48 } from "@common/machines/constants";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { writeRzxFile } from "@common/spectrum/rzx/rzxWriter";
import { isPictureFrame, type RzxInputBlock } from "@common/spectrum/rzx/rzxModel";
import { playRzxRecording, renderRzxToVideo, type RzxPlaybackPorts, type RzxVideoRecorder } from "@renderer/appEmu/machines/rzxPlayback";
import {
  insertRzxRollbackPoint,
  rollbackRzxRecording,
  startRzxRecording,
  stopRzxRecording
} from "@renderer/appEmu/machines/rzxRecording";
import type { RzxRecorder } from "@emu/machines/zxSpectrum/rzx/RzxRecorder";
import { ResolvingMessenger } from "../../harness/z88";
import { createHarnessSpectrumMachine } from "../../harness/sp128";
import { createSp48Session } from "../../harness/sp48";

const CREATOR = { name: "Klive IDE", major: 0, minor: 63 };

/** Busy work with INs, an EI/HALT and a retriggered IM 2 handler (see `rzx-sp48-roundtrip.test.ts`) */
const PROGRAM = `
    .org $8000
Main:
    di
    ld sp,$ff00
    ld a,$90
    ld i,a
    im 2
    ld hl,$9000
    ld (hl),$91
    ld de,$9001
    ld bc,$0100
    ldir
    ld hl,$9191
    ld (hl),$fb
    inc hl
    ld (hl),$00
    inc hl
    ld (hl),$c9
    ei
Loop:
    ld b,40
Poll:
    ld a,$fe
    in a,($fe)
    in a,($ff)
    djnz Poll
    halt
    jr Loop
`;

class Emulator {
  readonly store: Store<AppState> = createAppStore("emu");
  controller!: MachineController;
  output: string[] = [];

  readonly ports: RzxPlaybackPorts = {
    getMachineController: () => this.controller,
    getEmulatorState: () => this.store.getState().emulatorState ?? {},
    setMachineType: async () => true
  };

  async build(): Promise<this> {
    const machine = await createHarnessSpectrumMachine(MI_SPECTRUM_48, "pal", {});
    this.controller = new MachineController(this.store, new ResolvingMessenger(), machine as any);
    this.controller.debugSupport = new DebugSupport(this.store);
    // --- Capture the output lines (the controller sends them to the IDE)
    const send = this.controller.sendOutput.bind(this.controller);
    this.controller.sendOutput = async (text, color) => {
      this.output.push(text);
      await send(text, color);
    };
    this.store.dispatch(setMachineTypeAction(MI_SPECTRUM_48), "emu");
    this.store.dispatch(setModelTypeAction("pal"), "emu");
    return this;
  }

  async until(check: () => boolean, timeoutMs = 20_000): Promise<void> {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > timeoutMs) throw new Error("Timed out");
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  get rzx() {
    return this.store.getState().emulatorState?.rzx;
  }
}

const emulators: Emulator[] = [];
afterEach(async () => {
  for (const emu of emulators.splice(0)) {
    await emu.controller?.stop();
    emu.controller?.dispose();
  }
});

async function emulator(): Promise<Emulator> {
  const emu = await new Emulator().build();
  emulators.push(emu);
  return emu;
}

let recorded: Uint8Array | undefined;

/** A recording of the program, made on the harness (its machine runs without a controller) */
async function recording(): Promise<Uint8Array> {
  if (recorded) return recorded;
  const s = await createSp48Session();
  s.bootToBasic();
  const program = await s.loadCode(PROGRAM);
  s.machine.pc = program.symbol("Main");
  s.startRzxRecording({ autosaveFrames: 0 });
  s.runFrames(120);
  recorded = s.stopRzxRecording();
  return recorded;
}

function pictures(bytes: Uint8Array): number {
  return parseRzxFile(bytes)
    .blocks.filter((b): b is RzxInputBlock => b.kind === "input")
    .reduce((sum, b) => sum + b.frames.filter(isPictureFrame).length, 0);
}

describe("RZX on the emulator's controller", () => {
  it("records from a running machine, and stops and finalises the file", async () => {
    const emu = await emulator();
    emu.controller.unthrottled = true;
    await emu.controller.start();
    await emu.until(() => emu.controller.machine.frames > 30);
    const started = await startRzxRecording(emu.ports, CREATOR);
    expect(started.machineName).toBe("ZX Spectrum 48K");
    expect(emu.rzx?.mode).toBe("recording");
    expect(emu.controller.state).toBe(MachineControllerState.Running);
    // --- The clock multiplier is pinned to 1 while recording (D14)
    emu.store.dispatch({ type: "SET_CLOCK_MULTIPLIER", payload: { numValue: 4 } } as any, "emu");
    await emu.until(() => emu.controller.rzxSession!.frame > 60);
    expect(emu.controller.machine.targetClockMultiplier).toBe(1);
    const result = await stopRzxRecording(emu.ports);
    expect(emu.controller.state).toBe(MachineControllerState.Paused);
    expect(result.frames).toBeGreaterThan(60);
    const file = parseRzxFile(result.bytes);
    expect(file.creator?.name).toBe("Klive IDE");
    expect(file.blocks.map((b) => b.kind)).toEqual(["creator", "snapshot", "input"]);
    expect(emu.rzx).toBeUndefined();
  }, 60_000);

  it("plays a recording to its end and pauses there (D12)", async () => {
    const bytes = await recording();
    const emu = await emulator();
    emu.controller.unthrottled = true;
    const result = await playRzxRecording(emu.ports, "test.rzx", bytes, "run");
    expect(result.frames).toBeGreaterThan(120);
    expect(emu.rzx?.mode).toBe("playing");
    await emu.until(() => emu.controller.state === MachineControllerState.Paused);
    expect(emu.output.join("\n")).toMatch(/RZX playback ended after \d+ frames/);
    expect(emu.controller.rzxSession).toBeUndefined();
    expect(emu.rzx?.stopMessage).toMatch(/ended/);
  }, 60_000);

  it("pauses at a desync, naming the frame (D11)", async () => {
    const file = parseRzxFile(await recording());
    const input = file.blocks.find((b) => b.kind === "input") as RzxInputBlock;
    const index = input.frames.findIndex((f, i) => i > 30 && f.ins.length > 0);
    input.frames[index] = { ...input.frames[index], ins: input.frames[index].ins.slice(1) };
    const emu = await emulator();
    emu.controller.unthrottled = true;
    await playRzxRecording(emu.ports, "test.rzx", writeRzxFile(file), "run");
    await emu.until(() => emu.controller.state === MachineControllerState.Paused);
    expect(emu.output.join("\n")).toMatch(new RegExp(`desynced at frame ${index + 1} of`));
  }, 60_000);

  it("plays under the debugger, stopping at the first instruction", async () => {
    const emu = await emulator();
    const result = await playRzxRecording(emu.ports, "test.rzx", await recording(), "debug");
    await emu.until(() => emu.controller.state === MachineControllerState.Paused);
    expect(emu.controller.machine.pc).toBe(result.pc);
    expect(emu.controller.rzxSession?.active).toBe(true);
  }, 60_000);

  it("ends playback when the IDE changes the machine from outside the CPU (trap 4)", async () => {
    const emu = await emulator();
    await playRzxRecording(emu.ports, "test.rzx", await recording(), "debug");
    await emu.until(() => emu.controller.state === MachineControllerState.Paused);
    await emu.controller.interruptRzx("memory was edited");
    expect(emu.output.join("\n")).toMatch(/RZX playback stopped at frame \d+ of \d+: memory was edited/);
    expect(emu.controller.rzxSession).toBeUndefined();
  }, 60_000);

  it("rolls a recording back to a rollback point", async () => {
    const emu = await emulator();
    emu.controller.unthrottled = true;
    await emu.controller.start();
    await emu.until(() => emu.controller.machine.frames > 10);
    await startRzxRecording(emu.ports, CREATOR);
    await emu.until(() => emu.controller.rzxSession!.frame > 20);
    await insertRzxRollbackPoint(emu.ports);
    const points = () => (emu.controller.rzxSession as RzxRecorder).segments.length;
    await emu.until(() => points() > 1);
    const point = points();
    await emu.until(() => emu.controller.rzxSession!.frame > 200);
    const back = await rollbackRzxRecording(emu.ports, 1);
    expect(back.points).toBe(point);
    expect(back.frame).toBeGreaterThan(20);
    expect(back.frame).toBeLessThan(200);
    expect(emu.controller.state).toBe(MachineControllerState.Paused);
    expect(emu.controller.rzxSession?.active).toBe(true);
    const result = await stopRzxRecording(emu.ports);
    expect(result.frames).toBe(back.frame);
  }, 60_000);
});

/** A screen recorder that opens its file a little after the machine runs */
class StubRecorder implements RzxVideoRecorder {
  state: ScreenRecordingState = "idle";
  frames = 0;
  disarms = 0;
  arm(): void {
    this.state = "armed";
    setTimeout(() => (this.state = "recording"), 30);
  }
  async disarm(): Promise<void> {
    this.disarms++;
    this.state = "idle";
  }
}

async function render(emu: Emulator, bytes: Uint8Array) {
  const recorder = new StubRecorder();
  // --- The emulator panel's hook: one video frame per completed picture
  emu.controller.beforeFrameDelay = async () => {
    if (recorder.state === "recording") recorder.frames++;
  };
  let finished: string | undefined;
  await renderRzxToVideo(
    { ...emu.ports, getRecorder: () => recorder, getVideoFile: () => "video.mp4" },
    "test.rzx",
    bytes,
    { unthrottled: true },
    (stop, file) => (finished = `${stop?.kind}:${file}`)
  );
  expect(emu.rzx?.mode).toBe("rendering");
  await emu.until(() => finished !== undefined);
  return { recorder, finished: finished! };
}

describe("RZX render to video (D17-D19)", () => {
  it("records one frame per picture and stops at the end", async () => {
    const bytes = await recording();
    const emu = await emulator();
    const { recorder, finished } = await render(emu, bytes);
    expect(finished).toBe("ended:video.mp4");
    expect(recorder.frames).toBe(pictures(bytes));
    expect(recorder.disarms).toBe(1);
    expect(emu.controller.unthrottled).toBe(false);
    expect(emu.controller.state).toBe(MachineControllerState.Paused);
  }, 60_000);

  it("stops the video at a desync", async () => {
    const file = parseRzxFile(await recording());
    const input = file.blocks.find((b) => b.kind === "input") as RzxInputBlock;
    const index = input.frames.findIndex((f, i) => i > 30 && f.ins.length > 0);
    input.frames[index] = { ...input.frames[index], ins: Uint8Array.from([...input.frames[index].ins, 1]) };
    const emu = await emulator();
    const { recorder, finished } = await render(emu, writeRzxFile(file));
    expect(finished).toBe("desync:video.mp4");
    expect(recorder.disarms).toBe(1);
    expect(recorder.frames).toBeLessThan(pictures(await recording()));
  }, 60_000);

  it("refuses while a screen recording is already armed", async () => {
    const emu = await emulator();
    const recorder = new StubRecorder();
    recorder.state = "armed";
    await expect(
      renderRzxToVideo({ ...emu.ports, getRecorder: () => recorder, getVideoFile: () => undefined }, "x.rzx", await recording())
    ).rejects.toThrow(/already armed/);
  }, 60_000);
});
