import { describe, expect, it, vi } from "vitest";
import { AudioRenderer } from "../../src/renderer/lib/EmulatorPanel/AudioRenderer";

describe("AudioRenderer", () => {
  it("renders the audible Spectrum speaker from EAR only", async () => {
    const postMessage = vi.fn();
    const renderer = new AudioRenderer({
      context: {
        resume: vi.fn(),
        suspend: vi.fn()
      } as unknown as AudioContext,
      worklet: {
        port: { postMessage }
      } as unknown as AudioWorkletNode,
      samplesPerFrame: 0,
      sampleRate: 48_000
    });

    await renderer.play();
    renderer.storeSamples(
      [
        { left: 32768, right: -32768 },
        { left: 0, right: 32768 }
      ],
      0.5
    );

    expect(postMessage).toHaveBeenLastCalledWith({ samples: [0.5, 0.5, 0, 0] });
  });
});
