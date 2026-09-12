import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { incBreakpointsVersionAction, setMachineTypeAction } from "@state/actions";
import { MI_SPECTRUM_48, MI_SPECTRUM_128 } from "@common/machines/constants";

const emuApi = vi.hoisted(() => ({ listBreakpoints: vi.fn() }));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

import { BreakpointsBadge } from "@renderer/appIde/SiteBarPanels/BreakpointsBadge";

const bp = (over: any = {}) => ({ address: 0x8000, exec: true, ...over });

/**
 * The Breakpoints panel's header badge.
 *
 * Breakpoints are not in the renderer store — they are owned by the emulator and reached over IPC —
 * so what is actually under test is the refresh contract: fetch once, refetch when
 * `breakpointsVersion` changes, refetch on a machine change, and never poll.
 */
describe("BreakpointsBadge", () => {
  beforeEach(() => {
    emuApi.listBreakpoints.mockReset();
  });

  const render = (store = createMockStore()) => {
    const r = renderWithProviders(<BreakpointsBadge panelId="breakpointsPanel" expanded />, {
      store
    });
    return { ...r, store };
  };

  it("shows the number of breakpoints", async () => {
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp(), bp(), bp()] });
    render();
    expect(await screen.findByText("3")).toBeTruthy();
  });

  it("shows nothing at all when there are no breakpoints", async () => {
    // The empty case is the common one. A header reading "0" would draw the eye to the panel
    // precisely when it has nothing to show.
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });
    const { container } = render();
    await waitFor(() => expect(emuApi.listBreakpoints).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("names the disabled ones in its tooltip", async () => {
    emuApi.listBreakpoints.mockResolvedValue({
      breakpoints: [bp(), bp({ disabled: true }), bp({ disabled: true })]
    });
    render();
    expect(await screen.findByTitle("3 breakpoints, 2 disabled")).toBeTruthy();
  });

  it("says 'breakpoint', not 'breakpoints', for one", async () => {
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp()] });
    render();
    expect(await screen.findByTitle("1 breakpoint")).toBeTruthy();
  });

  it("refetches when breakpointsVersion changes", async () => {
    // This is the whole refresh mechanism: `DebugSupport` bumps that counter on every mutation,
    // and it is the only thing telling the badge its number went stale.
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp()] });
    const { store } = render();
    expect(await screen.findByText("1")).toBeTruthy();

    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp(), bp()] });
    store.dispatch(incBreakpointsVersionAction());
    expect(await screen.findByText("2")).toBeTruthy();
  });

  it("refetches when the machine changes", async () => {
    // A machine swap replaces the breakpoint set without necessarily bumping the version.
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp(), bp()] });
    const store = createMockStore();
    store.dispatch(setMachineTypeAction(MI_SPECTRUM_48));
    render(store);
    expect(await screen.findByText("2")).toBeTruthy();

    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });
    store.dispatch(setMachineTypeAction(MI_SPECTRUM_128));
    await waitFor(() => expect(screen.queryByText("2")).toBeNull());
  });

  it("does not poll", async () => {
    // `BreakpointsPanel` refreshes on a timer because its disassembly goes stale as the machine
    // runs. A count does not, and polling here would cost an IPC round trip per tick, forever.
    vi.useFakeTimers();
    try {
      emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [bp()] });
      render();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(emuApi.listBreakpoints).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays quiet when the emulator has no machine yet", async () => {
    // The badge is not the place to surface emulator trouble; the panel below it already does.
    emuApi.listBreakpoints.mockRejectedValue(new Error("no machine"));
    const { container } = render();
    await waitFor(() => expect(emuApi.listBreakpoints).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("ignores a reply that lands after it unmounts", async () => {
    // The badge unmounts when the user switches activity, and the IPC reply can land after that.
    let resolve!: (v: unknown) => void;
    emuApi.listBreakpoints.mockReturnValue(new Promise((r) => (resolve = r)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = render();
    unmount();
    resolve({ breakpoints: [bp(), bp()] });
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
