import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/*
 * The audio context is replaced when the machine is: `initAudio` closes the old one and builds the
 * next, asynchronously. A machine started inside that window - a `.z88` snapshot runs straight after
 * the machine it needed is rebuilt (`.plans/Z88_SNAPSHOT_PLAN.md` Phase 7) - used to call `play()` on
 * the old renderer and raise "Cannot resume a closed AudioContext".
 */

type FakeContext = { state: string; resume: ReturnType<typeof vi.fn>; suspend: ReturnType<typeof vi.fn> };

function fakeContext(state: string): FakeContext {
  return {
    state,
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve())
  };
}

describe("emulator audio - replacing the context", () => {
  it("a renderer whose context is closed neither resumes nor suspends it", async () => {
    const { AudioRenderer } = await import("@renderer/features/emulator/AudioRenderer");
    const context = fakeContext("closed");
    const renderer = new AudioRenderer({
      context: context as any,
      worklet: { port: { postMessage: vi.fn() } } as any,
      samplesPerFrame: 100
    });
    await renderer.play();
    await renderer.suspend();
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.suspend).not.toHaveBeenCalled();
  });

  it("a renderer whose context is suspended resumes it", async () => {
    const { AudioRenderer } = await import("@renderer/features/emulator/AudioRenderer");
    const context = fakeContext("suspended");
    const renderer = new AudioRenderer({
      context: context as any,
      worklet: { port: { postMessage: vi.fn() } } as any,
      samplesPerFrame: 100
    });
    await renderer.play();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("initAudio drops the old renderer before closing its context", async () => {
    vi.resetModules();
    let finishBuilding: (info: unknown) => void = () => {};
    const release = vi.fn(() => Promise.resolve());
    const build = vi.fn(() => new Promise((resolve) => (finishBuilding = resolve)));
    vi.doMock("@renderer/features/emulator/AudioRenderer", () => ({
      releaseBeeperContext: release,
      getBeeperContext: build,
      AudioRenderer: class {
        constructor(readonly info: unknown) {}
      }
    }));
    const { useEmulatorAudio } = await import("@renderer/features/emulator/useEmulatorAudio");
    const { result } = renderHook(() => useEmulatorAudio());
    const old = { play: vi.fn() };
    result.current.beeperRenderer.current = old as any;

    let pending: Promise<void>;
    act(() => {
      pending = result.current.initAudio(16384, 3_276_800, 44100, 8);
    });
    // --- While the new context is being built, a frame finds no renderer to play
    expect(release).toHaveBeenCalledTimes(1);
    expect(result.current.beeperRenderer.current).toBeUndefined();

    await vi.waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    expect(result.current.beeperRenderer.current).toBeUndefined();

    const info = { context: {}, worklet: {}, samplesPerFrame: 1 };
    await act(async () => {
      finishBuilding(info);
      await pending;
    });
    expect((result.current.beeperRenderer.current as any).info).toBe(info);
    vi.doUnmock("@renderer/features/emulator/AudioRenderer");
  });
});
