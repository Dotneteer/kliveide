import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The hook the sprite editor draws with, now also used by a NEX bank's Sprites view. Two options were
 * added for that caller — a controlled palette bank and an `enabled` switch — and the sprite editor,
 * which passes neither, must behave exactly as before.
 */

const getPalettedDeviceInfo = vi.fn();
let stateListener: (() => void) | undefined;

vi.mock("@renderer/core/EmuApi", () => ({
  useEmuApi: () => ({ getPalettedDeviceInfo })
}));
vi.mock("@renderer/appIde/useStateRefresh", async () => {
  const React = await import("react");
  return {
    useEmuStateListener: (_api: unknown, callback: () => void, onInit = true) => {
      stateListener = callback;
      React.useEffect(() => {
        if (onInit) void callback();
      }, []);
    }
  };
});

import { useSpritePalette } from "@renderer/features/sprite-editor/useSpritePalette";

const deviceInfo = (reg43Value: number) => ({
  spriteFirst: Array.from({ length: 256 }, () => 0x02), // device value -> register code 0x01
  spriteSecond: Array.from({ length: 256 }, () => 0x04), // -> 0x02
  reg43Value,
  spriteTransparencyIndex: 0xe3
});

beforeEach(() => {
  getPalettedDeviceInfo.mockReset();
  stateListener = undefined;
});

afterEach(() => {
  cleanup();
});

describe("useSpritePalette", () => {
  it("shows the palette the machine selects when nothing is chosen", async () => {
    getPalettedDeviceInfo.mockResolvedValue(deviceInfo(0x08));
    const { result } = renderHook(() => useSpritePalette());
    await waitFor(() => expect(result.current.source).toBe("machine"));
    expect(result.current.liveBank).toBe(1);
    expect(result.current.shownBank).toBe(1);
    expect(result.current.palette[0]).toBe(0x02);
  });

  it("shows a controlled bank over the machine's choice", async () => {
    getPalettedDeviceInfo.mockResolvedValue(deviceInfo(0x08));
    const { result } = renderHook(() => useSpritePalette({ bank: 0 }));
    await waitFor(() => expect(result.current.source).toBe("machine"));
    expect(result.current.shownBank).toBe(0);
    expect(result.current.liveBank).toBe(1);
    expect(result.current.palette[0]).toBe(0x01);
  });

  it("reads nothing while disabled, and reads at once when enabled", async () => {
    getPalettedDeviceInfo.mockResolvedValue(deviceInfo(0));
    const { result, rerender } = renderHook(({ enabled }) => useSpritePalette({ enabled }), {
      initialProps: { enabled: false }
    });
    await stateListener?.();
    expect(getPalettedDeviceInfo).not.toHaveBeenCalled();
    expect(result.current.source).toBe("default");

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.source).toBe("machine"));
    expect(getPalettedDeviceInfo).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default palette when there is no Next machine", async () => {
    getPalettedDeviceInfo.mockRejectedValue(new Error("not a Next"));
    const { result } = renderHook(() => useSpritePalette());
    await waitFor(() => expect(getPalettedDeviceInfo).toHaveBeenCalled());
    expect(result.current.source).toBe("default");
    expect(result.current.liveBank).toBeUndefined();
  });
});
