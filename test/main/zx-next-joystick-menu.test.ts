import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MachineMenuItem } from "@common/machines/info-types";

/*
 * The Machine | Joystick submenu.
 *
 * Two independent axes, and keeping them apart is the point: "driven by" is Klive's (which host
 * device moves the pins) and "mode" is the machine's (what NextReg $05 makes the pins mean).
 */

const { getSettingValue, setSettingValue, logEmuEvent, issueMachineCommand, displayDialog } =
  vi.hoisted(() => ({
    getSettingValue: vi.fn(),
    setSettingValue: vi.fn(),
    logEmuEvent: vi.fn(() => Promise.resolve()),
    issueMachineCommand: vi.fn(() => Promise.resolve(0)),
    displayDialog: vi.fn(() => Promise.resolve())
  }));

vi.mock("@main/settings-utils", () => ({ getSettingValue, setSettingValue }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent }));
vi.mock("@common/messaging/MainToEmuMessenger", () => ({
  getEmuApi: () => ({ issueMachineCommand, displayDialog })
}));

import { SETTING_EMU_JOYSTICK_BINDINGS } from "@common/settings/setting-const";
import { joystickMenuRenderer } from "@main/machine-menus/zx-next-input-menus";

const sideMenu = (label: string): MachineMenuItem[] => {
  const [root] = joystickMenuRenderer({} as any, undefined, undefined);
  const side = (root.submenu as MachineMenuItem[]).find((i) => i.label === label);
  if (!side) throw new Error(`No joystick side '${label}'`);
  return side.submenu as MachineMenuItem[];
};

const sub = (sideLabel: string, itemPrefix: string): MachineMenuItem[] => {
  const found = sideMenu(sideLabel).find((i) => i.label?.startsWith(itemPrefix));
  if (!found) throw new Error(`No '${itemPrefix}' under '${sideLabel}'`);
  return found.submenu as MachineMenuItem[];
};

describe("the Machine | Joystick menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingValue.mockReturnValue(undefined); // --- falls back to the shipped defaults
  });

  it("offers both connectors and a way into the bindings", () => {
    const [root] = joystickMenuRenderer({} as any, undefined, undefined);
    const labels = (root.submenu as MachineMenuItem[]).map((i) => i.label).filter(Boolean);
    expect(labels).toEqual([
      "Joystick 1 (left)",
      "Joystick 2 (right)",
      "Configure bindings..."
    ]);
  });

  it("opens the bindings dialog in the emulator renderer", async () => {
    const [root] = joystickMenuRenderer({} as any, undefined, undefined);
    const configure = (root.submenu as MachineMenuItem[]).find(
      (i) => i.label === "Configure bindings..."
    );
    await configure?.click?.();
    // --- 1007: the emulator's own dialog registry, not the IDE's.
    expect(displayDialog).toHaveBeenCalledWith(1007);
  });

  it("ticks the source in force", () => {
    // --- Joystick 1 ships connected to the keyboard, joystick 2 connected to nothing.
    expect(sub("Joystick 1 (left)", "Driven by").find((i) => i.checked)?.label).toBe("Host keyboard");
    expect(sub("Joystick 2 (right)", "Driven by").find((i) => i.checked)?.label).toBe("Not connected");
  });

  it("changes only the side it was asked about", async () => {
    const pad = sub("Joystick 2 (right)", "Driven by").find((i) => i.label === "Host gamepad");
    await pad?.click?.();

    const [[id, written]] = setSettingValue.mock.calls;
    expect(id).toBe(SETTING_EMU_JOYSTICK_BINDINGS);
    expect(written.right.source).toBe("gamepad");
    expect(written.left.source, "the other connector is untouched").toBe("keyboard");
    expect(written.right.keys, "and so are its keys").toBeDefined();
  });

  it("writes the machine's register for a mode, rather than a setting", async () => {
    const modes = sub("Joystick 1 (left)", "Set machine mode");
    await modes.find((m) => m.label?.startsWith("Kempston 1"))?.click?.();

    // --- NextReg $05 is the machine's state; only the machine can be asked to change it.
    expect(issueMachineCommand).toHaveBeenCalledWith("custom", "joystickMode:left:1");
    expect(setSettingValue).not.toHaveBeenCalled();
  });

  it("names the right connector in the mode command", async () => {
    const modes = sub("Joystick 2 (right)", "Set machine mode");
    await modes.find((m) => m.label?.startsWith("MD 2"))?.click?.();
    expect(issueMachineCommand).toHaveBeenCalledWith("custom", "joystickMode:right:6");
  });

  it("warns in the label that the machine may overwrite the mode", () => {
    // --- NextZXOS writes $05 from its own configuration at boot; a mode set before that is lost.
    const label = sideMenu("Joystick 1 (left)").find((i) => i.label?.startsWith("Set machine mode"))?.label;
    expect(label).toMatch(/NextZXOS may override/i);
  });

  it("offers every mode the register encodes, keys-pressing ones included", () => {
    const modes = sub("Joystick 1 (left)", "Set machine mode");
    expect(modes).toHaveLength(8);
    expect(modes.map((m) => m.label)).toContain("Cursor / Protek");
    expect(modes.map((m) => m.label)).toContain("User-defined (joymap)");
  });
});
