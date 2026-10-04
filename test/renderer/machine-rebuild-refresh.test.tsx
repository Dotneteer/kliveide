import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { isMachineNotAvailableError, MACHINE_NOT_AVAILABLE_MESSAGE } from "@common/messaging/EmuApi";
import { filterMachineRebuildRejection } from "@renderer/machineRebuildRejections";

/*
 * While the emulator rebuilds its machine (a machine, model or Z88 LCD-size change) it has no
 * machine controller for a moment and answers every request with "Machine controller not
 * available". The IDE logged that as page errors on every rebuild. The poller now skips the round,
 * a panel refresh's failure is handled, and the window drops that one rejection.
 */

/** The error as the IDE receives it: `MessageProxy` rethrows the response's text */
const rebuildError = () => new Error(`Error: ${MACHINE_NOT_AVAILABLE_MESSAGE}`);

describe("the 'no machine during a rebuild' answer", () => {
  it("is recognised by its message, whatever wraps it", () => {
    expect(isMachineNotAvailableError(rebuildError())).toBe(true);
    expect(isMachineNotAvailableError(new Error("Unknown method foo"))).toBe(false);
    expect(isMachineNotAvailableError(MACHINE_NOT_AVAILABLE_MESSAGE)).toBe(false);
    expect(isMachineNotAvailableError(undefined)).toBe(false);
  });

  it("the window filter marks only that rejection as handled", () => {
    const handled = { reason: rebuildError(), preventDefault: vi.fn() };
    expect(filterMachineRebuildRejection(handled)).toBe(true);
    expect(handled.preventDefault).toHaveBeenCalledOnce();
    const other = { reason: new Error("boom"), preventDefault: vi.fn() };
    expect(filterMachineRebuildRejection(other)).toBe(false);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });
});

describe("the IDE's state poller across a machine rebuild", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("skips the rounds with no machine, then refreshes the panels from the new machine", async () => {
    vi.useFakeTimers();
    // --- A fresh module: the listener is a singleton bound to the first EmuApi it sees
    vi.resetModules();
    const { useEmuStateListener } = await import("@renderer/appIde/useStateRefresh");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let rebuilding = true;
    const emuApi = {
      getCpuStateChunk: vi.fn(async () => {
        if (rebuilding) throw rebuildError();
        return { state: MachineControllerState.Paused, pcValue: 0x15de, tacts: 1 };
      })
    };
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    // --- A panel whose own refresh also fails while there is no machine
    const refresh = vi.fn(async () => {
      if (rebuilding) throw rebuildError();
    });
    const { unmount } = renderHook(() => useEmuStateListener(emuApi as any, refresh));

    await vi.advanceTimersByTimeAsync(350);
    expect(emuApi.getCpuStateChunk).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    rebuilding = false;
    await vi.advanceTimersByTimeAsync(250);
    expect(refresh).toHaveBeenCalledWith(MachineControllerState.Paused);

    unmount();
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("still reports any other failure, as a console error rather than an unhandled rejection", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { useEmuStateListener } = await import("@renderer/appIde/useStateRefresh");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const emuApi = {
      getCpuStateChunk: vi.fn(async () => {
        throw new Error("the messenger is gone");
      })
    };
    const { unmount } = renderHook(() => useEmuStateListener(emuApi as any, vi.fn(async () => {})));
    await vi.advanceTimersByTimeAsync(150);
    unmount();
    expect(consoleError).toHaveBeenCalledWith("Refreshing the machine state failed:", expect.any(Error));
  });
});
