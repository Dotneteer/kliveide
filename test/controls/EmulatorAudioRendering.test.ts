import { describe, expect, it, vi } from "vitest";
import { createTestNextMachine } from "../zxnext/TestNextMachine";
import { renderMachineAudioFrame } from "@renderer/features/emulator/audioFrameRendering";
import { AudioRenderer } from "@renderer/features/emulator/AudioRenderer";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

describe("emulator audio frame rendering", () => {
  it("passes real non-zero ZX Next TurboSound samples from the machine to the renderer", async () => {
    const machine = await createTestNextMachine();
    const rendererSamples: AudioSample[][] = [];
    const recorderSamples: AudioSample[][] = [];
    const renderer = {
      storeSamples: vi.fn((samples: AudioSample[]) => {
        rendererSamples.push(samples);
      }),
      play: vi.fn(() => Promise.resolve())
    };
    const recorder = {
      submitAudioSamples: vi.fn((samples: AudioSample[]) => {
        recorderSamples.push(samples);
        return Promise.resolve();
      })
    };

    const writeAy = (register: number, value: number) => {
      machine.doWritePort(0xfffd, register);
      machine.doWritePort(0xbffd, value);
    };

    machine.onInitNewFrame(false);
    writeAy(0, 0x20);
    writeAy(1, 0x00);
    writeAy(7, 0x3e);
    writeAy(8, 0x0f);

    for (let i = 0; i < 3000 && !machine.frameCompleted; i++) {
      machine.tactPlusN(16);
      machine.afterInstructionExecuted();
    }

    const samples = await renderMachineAudioFrame(machine, renderer, 0.5, recorder);

    expect(samples.length).toBeGreaterThan(10);
    expect(samples.some(isNonZeroSample)).toBe(true);
    expect(renderer.storeSamples).toHaveBeenCalledWith(samples, 0.5);
    expect(renderer.play).toHaveBeenCalled();
    expect(recorder.submitAudioSamples).toHaveBeenCalledWith(samples);
    expect(rendererSamples[0].some(isNonZeroSample)).toBe(true);
    expect(recorderSamples[0].some(isNonZeroSample)).toBe(true);
  });

  it("posts non-zero interleaved float samples to the audio worklet", () => {
    const postedMessages: unknown[] = [];
    const context = {
      resume: vi.fn(() => Promise.resolve()),
      suspend: vi.fn(() => Promise.resolve())
    } as unknown as AudioContext;
    const worklet = {
      port: {
        postMessage: vi.fn((message: unknown) => postedMessages.push(message))
      }
    } as unknown as AudioWorkletNode;
    const renderer = new AudioRenderer({
      context,
      worklet,
      samplesPerFrame: 4
    });

    renderer.storeSamples(
      [
        { left: 0, right: 0 },
        { left: 0.25, right: -0.5 }
      ],
      0.5
    );

    expect(postedMessages).toEqual([{ samples: [0, 0, 0.125, -0.25] }]);
    const samples = (postedMessages[0] as { samples: number[] }).samples;
    expect(samples.some((sample) => sample !== 0)).toBe(true);
  });

  it("resumes a freshly constructed suspended audio context on first play", async () => {
    const context = {
      state: "suspended",
      resume: vi.fn(function (this: { state: string }) {
        this.state = "running";
        return Promise.resolve();
      }),
      suspend: vi.fn(() => Promise.resolve())
    } as unknown as AudioContext;
    const worklet = {
      port: {
        postMessage: vi.fn()
      }
    } as unknown as AudioWorkletNode;
    const renderer = new AudioRenderer({
      context,
      worklet,
      samplesPerFrame: 4
    });

    await renderer.play();

    expect(context.resume).toHaveBeenCalledTimes(1);
  });
});

function isNonZeroSample(sample: AudioSample): boolean {
  return Math.abs(sample.left) > 0.001 || Math.abs(sample.right) > 0.001;
}
