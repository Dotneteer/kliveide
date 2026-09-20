import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";
import { SETTING_EMU_MOUSE_CAPTURE } from "@common/settings/setting-const";
import { setGlobalSettingAction, setMachineTypeAction, setMouseCapturedAction } from "@state/actions";

import { createMockStore, renderWithProviders } from "../react-test-utils";

/*
 * The toolbar's mouse-capture button.
 *
 * The button is the one piece of the capture UI the user actually aims at, so it is worth rendering
 * for real rather than asserting on the hook alone. Only the two IPC-backed hooks are mocked; the
 * store, the theme and the icon pipeline are the real ones.
 */

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ setGlobalSettingsValue: vi.fn(), saveProject: vi.fn() })
}));
vi.mock("@renderer/core/EmuApi", () => ({
  useEmuApi: () => ({ issueMachineCommand: vi.fn() })
}));

const captureRequests = vi.hoisted(() => ({ count: 0 }));
vi.mock("@renderer/features/emulator/mouseCaptureBridge", () => ({
  requestMouseCapture: () => {
    captureRequests.count++;
    return true;
  }
}));

afterEach(() => {
  cleanup();
  captureRequests.count = 0;
  vi.restoreAllMocks();
});

/** Renders the emulator toolbar group for a machine, with capture on or off. */
async function renderControls(machineId: string, captureEnabled: boolean, captured = false) {
  const store = createMockStore();
  store.dispatch(setMachineTypeAction(machineId), "test");
  store.dispatch(setGlobalSettingAction(SETTING_EMU_MOUSE_CAPTURE, captureEnabled), "test");
  store.dispatch(setMouseCapturedAction(captured), "test");

  const { ViewControls } = await import("@renderer/controls/ViewControls");
  renderWithProviders(<ViewControls />, { store });
  return store;
}

/**
 * The button is icon-only. `IconButton` renders its `title` as `aria-label` (and as a tooltip),
 * not as a `title` attribute, so that is what identifies it.
 */
const mouseButton = (): HTMLElement | null =>
  screen.queryByLabelText(/capture the mouse|mouse captured|mouse capture is switched off/i);

describe("the toolbar mouse-capture button", () => {
  it("is offered for a machine that has a mouse", async () => {
    await renderControls(MI_ZXNEXT, true);
    expect(mouseButton()).not.toBeNull();
  });

  it("is not offered for a machine that has none", async () => {
    // --- A ZX Spectrum 48 has no pointing device at all; MF_MOUSE_SUPPORT is what decides.
    await renderControls(MI_SPECTRUM_48, true);
    expect(mouseButton()).toBeNull();
  });

  it("asks the screen to capture when clicked", async () => {
    await renderControls(MI_ZXNEXT, true);

    fireEvent.click(mouseButton()!);

    // --- Straight through the bridge: pointer lock needs this click's own activation.
    expect(captureRequests.count).toBe(1);
  });

  it("reports the captured state and points at Esc, since it cannot release", async () => {
    await renderControls(MI_ZXNEXT, true, true);

    const button = mouseButton()!;
    expect(button.getAttribute("aria-pressed")).toBe("true");
    // --- While the lock is held every mouse event goes to the locked element, so this button
    // --- cannot be clicked at all; it is a lamp at that point, not a toggle. The label says Esc
    // --- rather than promising a toggle it cannot honour.
    expect(button.getAttribute("aria-label")).toMatch(/captured/i);
    expect(button.getAttribute("aria-label")).toMatch(/Esc/);
  });

  it("is disabled, with a reason, while capture is switched off", async () => {
    await renderControls(MI_ZXNEXT, false);

    const button = mouseButton()!;
    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-label")).toMatch(/switched off/i);
    fireEvent.click(button);
    expect(captureRequests.count).toBe(0);
  });
});
