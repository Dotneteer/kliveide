import { describe, expect, it, vi } from "vitest";
import { createTestZxNextWasmMachine } from "../wasm/zxNext/wasm-next-test-helpers";
import { renderMachineAudioFrame } from "@renderer/features/emulator/audioFrameRendering";
import { AudioRenderer } from "@renderer/features/emulator/AudioRenderer";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { createZ88Session } from "../harness/z88";

describe("emulator audio frame rendering", () => {
  it("passes real non-zero ZX Next TurboSound samples from the machine to the renderer", async () => {
    const machine = await createTestZxNextWasmMachine();
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

    // --- A HALT at $8000 keeps the CPU out of the way; the PSG plays a channel-A tone at full
    // --- volume, so the frame's samples must be audibly non-zero.
    machine.hardReset();
    machine.doWriteMemory(0x8000, 0x76);
    machine.pc = 0x8000;
    writeAy(0, 0x20);
    writeAy(1, 0x00);
    writeAy(7, 0x3e);
    writeAy(8, 0x0f);

    machine.executeMachineFrame();
    expect(machine.frameCompleted).toBe(true);

    const samples = await renderMachineAudioFrame(machine, renderer, 0.5, recorder);

    expect(samples.length).toBeGreaterThan(10);
    expect(samples.some(isNonZeroSample)).toBe(true);
    expect(renderer.storeSamples).toHaveBeenCalledWith(samples, 0.5);
    expect(renderer.play).toHaveBeenCalled();
    expect(recorder.submitAudioSamples).toHaveBeenCalledWith(samples);
    expect(rendererSamples[0].some(isNonZeroSample)).toBe(true);
    expect(recorderSamples[0].some(isNonZeroSample)).toBe(true);
  });

  it("records each frame's samples even when the machine reuses its sample objects", async () => {
    // --- The Cambridge Z88 reuses its sample objects, and its eight-frame burst runs the next
    // --- frames while `play()` is pending. The recorder used to see the last frame's values for
    // --- every frame (issue #1374).
    const shared: AudioSample[] = [
      { left: 0.5, right: 0.5 },
      { left: -0.5, right: -0.5 }
    ];
    const machine = { getAudioSamples: () => shared };
    const recorded: number[][] = [];
    const renderer = {
      storeSamples: vi.fn(),
      play: vi.fn(async () => {
        // --- The next frame overwrites the objects before this frame's await resumes
        shared[0].left = shared[0].right = 0;
        shared[1].left = shared[1].right = 0;
      })
    };
    const recorder = {
      submitAudioSamples: vi.fn(async (samples: AudioSample[]) => {
        recorded.push(samples.map((sample) => sample.left));
      })
    };

    await renderMachineAudioFrame(machine, renderer, 1, recorder);

    expect(recorded).toEqual([[0.5, -0.5]]);
  });

  it("records a Cambridge Z88 beep as the speaker plays it, through an eight-frame burst", async () => {
    // --- The real core and the controller's pattern: eight frames back to back, each handing its
    // --- samples over without the burst waiting for the hand-off to finish (issue #1374)
    const s = await createZ88Session({ audioSampleRate: 44_100 });
    await s.loadCode(`
      .org $8000
start: ld a,$04           ; COM.RAMS, as loadCode maps it; SRUN clear, so SBIT drives the speaker
beep:  xor $40            ; toggle SBIT
      out ($b0),a
      ld b,60
wait:  djnz wait
      jr beep
    `, { entry: "start" });
    s.runFrames(2);

    const played: number[] = [];
    const recorded: number[] = [];
    const renderer = {
      storeSamples: (samples: AudioSample[]) => played.push(...samples.map((x) => x.left)),
      play: () => Promise.resolve()
    };
    const recorder = {
      submitAudioSamples: async (samples: AudioSample[]) => {
        recorded.push(...samples.map((x) => x.left));
      }
    };
    const handOffs: Promise<unknown>[] = [];
    for (let frame = 0; frame < 8; frame++) {
      s.machine.executeMachineFrame();
      handOffs.push(renderMachineAudioFrame(s.machine, renderer, 1, recorder));
    }
    await Promise.all(handOffs);

    // --- A square wave: plenty of level changes, and the recording is the very same signal
    expect(played.length).toBeGreaterThan(8 * 200);
    expect(new Set(played.map((v) => v.toFixed(3))).size).toBeGreaterThan(20);
    expect(recorded).toEqual(played);
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
