import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import {
  FPS_STEPS,
  useSpriteAnimation
} from "@renderer/features/sprite-editor/useSpriteAnimation";

/** A probe that renders the hook's output so the tests can read it without a real preview. */
let api: ReturnType<typeof useSpriteAnimation>;
const Probe = ({ count, fps, onFps }: { count: number; fps?: number; onFps?: (n: number) => void }) => {
  api = useSpriteAnimation(count, fps ?? 12, onFps);
  return <span data-testid="frame">{String(api.frame)}</span>;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("useSpriteAnimation", () => {
  it("shows the selected sprite until it is played", () => {
    render(<Probe count={4} />);
    expect(api.playing).toBe(false);
    expect(api.frame).toBeUndefined();
  });

  it("advances one frame per interval at the chosen rate", () => {
    render(<Probe count={4} fps={8} />);
    act(() => api.toggle());
    expect(api.frame).toBe(0);
    tick(125);
    expect(api.frame).toBe(1);
    tick(125);
    expect(api.frame).toBe(2);
  });

  it("wraps at the end of the sheet", () => {
    render(<Probe count={3} fps={8} />);
    act(() => api.toggle());
    tick(125 * 3);
    expect(api.frame).toBe(0);
  });

  it("refuses to play a single-sprite sheet", () => {
    // One frame flashing at itself is not an animation; the button is disabled for the same reason.
    render(<Probe count={1} />);
    act(() => api.toggle());
    expect(api.playing).toBe(false);
    expect(api.frame).toBeUndefined();
  });

  it("stops, and returns to showing the selection", () => {
    render(<Probe count={4} fps={8} />);
    act(() => api.toggle());
    tick(125);
    act(() => api.toggle());
    expect(api.playing).toBe(false);
    expect(api.frame).toBeUndefined();
  });

  it("cycles the frame rate and reports it", () => {
    const onFps = vi.fn();
    render(<Probe count={4} fps={FPS_STEPS[0]} onFps={onFps} />);
    expect(api.fps).toBe(FPS_STEPS[0]);
    act(() => api.cycleFps());
    expect(api.fps).toBe(FPS_STEPS[1]);
    expect(onFps).toHaveBeenCalledWith(FPS_STEPS[1]);
    // And it wraps rather than sticking at the top.
    for (let i = 1; i < FPS_STEPS.length; i++) act(() => api.cycleFps());
    expect(api.fps).toBe(FPS_STEPS[0]);
  });

  it("falls back to a sane rate for a nonsense persisted value", () => {
    render(<Probe count={4} fps={999} />);
    expect(FPS_STEPS).toContain(api.fps as never);
  });

  /*
   * A timer left running behind another tab is invisible work, and in Electron a document panel can
   * sit hidden for a long time.
   */
  it("stops itself when the window is hidden", () => {
    render(<Probe count={4} fps={8} />);
    act(() => api.toggle());
    expect(api.playing).toBe(true);

    const spy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(api.playing).toBe(false);
    spy.mockRestore();
  });

  it("stops the timer on unmount", () => {
    const { unmount } = render(<Probe count={4} fps={8} />);
    act(() => api.toggle());
    unmount();
    // No pending interval is left to fire into an unmounted tree.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers when the sheet shrinks under a running animation", () => {
    const { rerender } = render(<Probe count={6} fps={8} />);
    act(() => api.toggle());
    tick(125 * 5);
    expect(api.frame).toBe(5);
    rerender(<Probe count={2} fps={8} />);
    // Deleting sprites must not leave the preview reading past the end of the sheet.
    expect(api.frame).toBeLessThan(2);
  });
});
