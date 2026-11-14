import { beforeEach, describe, expect, it, vi } from "vitest";
import os from "os";

/*
 * Machine › SD Card › Show TBBLUE.TBU (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5): on every Next
 * model, in any machine state, before a KS3's second-card items; a click brings up the IDE and runs
 * `show-tbu`, and a failure is said in a message box.
 */

const { state, executeCommand, showMessageBox, showIdeWindow } = vi.hoisted(() => ({
  state: { media: {}, emulatorState: {} } as { media: Record<string, any>; emulatorState: Record<string, any> },
  executeCommand: vi.fn(),
  showMessageBox: vi.fn(async () => ({ response: 0 })),
  showIdeWindow: vi.fn()
}));

vi.mock("electron", () => ({ app: { getPath: () => os.tmpdir() }, dialog: { showMessageBox }, BrowserWindow: class {} }));
vi.mock("@main/main-store", () => ({ mainStore: { getState: () => state, dispatch: vi.fn() } }));
vi.mock("@main/projects", () => ({ saveKliveProject: vi.fn() }));
vi.mock("@main/registeredMachines", () => ({ logEmuEvent: vi.fn(), setMachineType: vi.fn() }));
vi.mock("@main/settings-utils", () => ({
  appSettings: {},
  saveAppSettings: vi.fn(),
  getSettingValue: vi.fn(),
  setSettingValue: vi.fn()
}));
vi.mock("@main/index", () => ({ showIdeWindow }));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: vi.fn() }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: () => ({ executeCommand }) }));

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { sdCardMenuRenderer } from "@main/machine-menus/zx-next-menus";

const menuOf = (modelId: string, machineState = MachineControllerState.Running) => {
  state.emulatorState = { modelId, machineState };
  return sdCardMenuRenderer({ emuWindow: {}, ideWindow: {} } as any, undefined as any, undefined as any);
};

describe("Machine › SD Card › Show TBBLUE.TBU", () => {
  beforeEach(() => {
    executeCommand.mockReset();
    showMessageBox.mockClear();
    showIdeWindow.mockClear();
  });

  it("is on every Next model, enabled while the machine runs", () => {
    for (const model of ["ks2-30201", "ks2-30204", "ks2-30303", "ks3-30303"]) {
      const item = menuOf(model).find((i) => i.id === "show_tbu");
      expect(item, model).toBeDefined();
      expect(item!.label).toBe("Show TBBLUE.TBU");
      expect(item!.enabled).not.toBe(false);
    }
  });

  it("comes before a KS3's second-card items, which are about another card", () => {
    const ids = menuOf("ks3-30303").map((i) => i.id);
    expect(ids.indexOf("show_tbu")).toBeGreaterThan(ids.indexOf("reset_sd_card"));
    expect(ids.indexOf("show_tbu")).toBeLessThan(ids.indexOf("select_sd_card_2"));
  });

  it("brings up the IDE and runs show-tbu", async () => {
    executeCommand.mockResolvedValue({ success: true });
    await menuOf("ks2-30303").find((i) => i.id === "show_tbu")!.click!();
    expect(showIdeWindow).toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith("show-tbu");
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it("says a failure in a message box", async () => {
    executeCommand.mockResolvedValue({ success: false, finalMessage: "The SD card ks2.cim has no TBBLUE.TBU in its root folder." });
    await menuOf("ks2-30303").find((i) => i.id === "show_tbu")!.click!();
    expect(showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "error",
        title: "Cannot Show TBBLUE.TBU",
        message: "The SD card ks2.cim has no TBBLUE.TBU in its root folder."
      })
    );
  });
});
