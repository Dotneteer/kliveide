import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MachineMenuItem } from "@common/machines/info-types";

/*
 * The Machine | Mouse submenu.
 *
 * It is the only place the mouse feature can be switched on: capture is off by default, and with it
 * off the toolbar button is disabled. If this menu ever stops being registered, or its checkbox
 * stops writing the setting, the whole feature becomes unreachable without hand-editing a settings
 * file - which is exactly what happened while it was still scheduled for a later step.
 */

const { getSettingValue, setSettingValue, logEmuEvent } = vi.hoisted(() => ({
  getSettingValue: vi.fn(),
  setSettingValue: vi.fn(),
  logEmuEvent: vi.fn(() => Promise.resolve())
}));

vi.mock("@main/settings-utils", () => ({ getSettingValue, setSettingValue }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent }));

import {
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_MOUSE_SENSITIVITY,
  SETTING_EMU_MOUSE_SHOW_POINTER
} from "@common/settings/setting-const";
import { mouseMenuRenderer } from "@main/machine-menus/zx-next-input-menus";

/** The settings the menu reads, with capture on or off. */
function withCapture(enabled: boolean, sensitivity: unknown = 1, pointer: unknown = "always"): void {
  getSettingValue.mockImplementation((id: string) => {
    if (id === SETTING_EMU_MOUSE_CAPTURE) return enabled;
    if (id === SETTING_EMU_MOUSE_SHOW_POINTER) return pointer;
    if (id === SETTING_EMU_MOUSE_SENSITIVITY) return sensitivity;
    return undefined;
  });
}

const mouseSubmenu = (): MachineMenuItem[] => {
  const [mouseMenu] = mouseMenuRenderer({} as any, undefined, undefined);
  return mouseMenu.submenu as MachineMenuItem[];
};

const item = (label: string): MachineMenuItem => {
  const found = mouseSubmenu().find((i) => i.label === label);
  if (!found) throw new Error(`No mouse menu item '${label}'`);
  return found;
};

describe("the Machine | Mouse menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withCapture(false);
  });

  it("offers the switch that makes the feature reachable at all", () => {
    expect(item("Capture the mouse").type).toBe("checkbox");
    expect(item("Capture the mouse").checked).toBe(false);
  });

  it("turns capture on", async () => {
    await item("Capture the mouse").click?.();
    expect(setSettingValue).toHaveBeenCalledWith(SETTING_EMU_MOUSE_CAPTURE, true);
  });

  it("turns capture off again", async () => {
    withCapture(true);
    expect(item("Capture the mouse").checked).toBe(true);

    await item("Capture the mouse").click?.();
    expect(setSettingValue).toHaveBeenCalledWith(SETTING_EMU_MOUSE_CAPTURE, false);
  });

  it("greys out everything that only matters once capture is on", () => {
    expect(item("Show the captured pointer").enabled).toBe(false);
    expect(item("Sensitivity (Normal (1x))").enabled).toBe(false);

    withCapture(true);
    expect(item("Show the captured pointer").enabled).toBe(true);
    expect(item("Sensitivity (Normal (1x))").enabled).toBe(true);
  });

  it("ticks the sensitivity in force and sets the one picked", async () => {
    withCapture(true, 2);
    // --- The label carries the current rung, so there is a hint that it can be adjusted at all.
    const rungs = item("Sensitivity (Fastest (2x))").submenu as MachineMenuItem[];
    expect(rungs.find((r) => r.checked)?.label).toMatch(/2x/);

    const slow = rungs.find((r) => r.label?.includes("0.5x"));
    await slow?.click?.();
    expect(setSettingValue).toHaveBeenCalledWith(SETTING_EMU_MOUSE_SENSITIVITY, 0.5);
  });

  it("offers the three pointer modes and ticks the one in force", () => {
    withCapture(true, 1, "unused");
    const modes = item("Show the captured pointer").submenu as MachineMenuItem[];
    expect(modes.map((m) => m.label)).toEqual([
      "Always",
      "Only while no program reads the mouse",
      "Never"
    ]);
    expect(modes.find((m) => m.checked)?.label).toBe("Only while no program reads the mouse");
  });

  it("migrates the checkbox this setting used to be", async () => {
    // --- It shipped as a boolean: true meant show it, false meant never.
    withCapture(true, 1, true);
    let modes = item("Show the captured pointer").submenu as MachineMenuItem[];
    expect(modes.find((m) => m.checked)?.label).toBe("Always");

    withCapture(true, 1, false);
    modes = item("Show the captured pointer").submenu as MachineMenuItem[];
    expect(modes.find((m) => m.checked)?.label).toBe("Never");
  });

  it("writes the picked pointer mode", async () => {
    withCapture(true);
    const modes = item("Show the captured pointer").submenu as MachineMenuItem[];
    await modes.find((m) => m.label === "Never")?.click?.();
    expect(setSettingValue).toHaveBeenCalledWith(SETTING_EMU_MOUSE_SHOW_POINTER, "never");
  });

  it("tops the ladder out at 2x, because the guest's DPI multiplies on top of it", () => {
    // --- With DPI 00 - which doubles, and which software sets freely - a host 2x already moves
    // --- the machine's pointer four times as far as the hand. A 4x rung meant 8x and was unusable.
    withCapture(true);
    const rungs = item("Sensitivity (Normal (1x))").submenu as MachineMenuItem[];
    expect(rungs.map((r) => r.label)).toEqual([
      "Very Slow (0.25x)",
      "Slow (0.5x)",
      "Normal (1x)",
      "Fast (1.5x)",
      "Fastest (2x)"
    ]);
  });

  it("falls back to a usable sensitivity when a retired or hand-edited value is stored", () => {
    // --- Settings files are hand-editable, older ones lack the key, and 4x was offered once.
    withCapture(true, 4);
    let rungs = item("Sensitivity (Normal (1x))").submenu as MachineMenuItem[];
    expect(rungs.find((r) => r.checked)?.label, "a stored 4x lands on the default").toMatch(/1x/);

    withCapture(true, "not a number");
    rungs = item("Sensitivity (Normal (1x))").submenu as MachineMenuItem[];
    expect(rungs.filter((r) => r.checked)).toHaveLength(1);
    expect(rungs.find((r) => r.checked)?.label).toMatch(/1x/);
  });

  it("does not try to capture the mouse itself", async () => {
    // --- A menu click runs in the main process with no transient activation, so it could only
    // --- ever arm the feature. The capture is the toolbar button, the screen, or Ctrl+M.
    withCapture(true);
    for (const menuItem of mouseSubmenu()) {
      await menuItem.click?.();
    }
    expect(setSettingValue.mock.calls.every(([id]) => id.startsWith("emuOptions.mouse"))).toBe(true);
  });
});
