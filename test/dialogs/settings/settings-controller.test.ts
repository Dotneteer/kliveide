import { describe, expect, it, vi } from "vitest";
import type { AppState } from "@common/state/AppState";
import { SettingsController, type SettingsPorts } from "@renderer/appIde/dialogs/settings/SettingsController";
import type { SettingsEnvironment } from "@renderer/appIde/dialogs/settings/SettingsModel";
import { formatFileValue } from "@renderer/appIde/dialogs/settings/SettingsViewModel";
import { harnessFor } from "../../mvc/ControllerHarness";
import { deferred } from "../../mvc/deferred";
import {
  SETTING_EDITOR_TABSIZE,
  SETTING_EMU_TC2068_ROM,
  SETTING_IDE_SIDEBAR_TO_RIGHT
} from "@common/settings/setting-const";
import { MC_TIMEX_MODEL } from "@common/machines/constants";

/*
 * The Settings dialog, driven headlessly (`.plans/MENU_REDESIGN_PLAN.md` §4): its pages and search,
 * and the writes each kind of row makes.
 */

const envOf = (appState: Record<string, unknown> = {}): SettingsEnvironment => ({
  appState: appState as unknown as AppState,
  platform: { isWindows: false }
});

function open(page?: string, appState: Record<string, unknown> = { emulatorState: { machineId: "sp48" } }) {
  const ports = {
    setSetting: vi.fn<SettingsPorts["setSetting"]>(() => Promise.resolve()),
    runAction: vi.fn<SettingsPorts["runAction"]>(() => Promise.resolve(undefined)),
    close: vi.fn()
  };
  const controller = new SettingsController(ports, page, envOf(appState));
  return harnessFor(controller, { ports });
}

const rowIds = (h: ReturnType<typeof open>) =>
  h.vm.sections.flatMap((s) => s.groups.flatMap((g) => g.rows.map((r) => r.id)));

describe("the Settings dialog — pages", () => {
  it("opens on General, or on the page it was asked for", () => {
    expect(open().vm.nav.find((p) => p.selected)?.id).toBe("general");
    expect(open("recording").vm.nav.find((p) => p.selected)?.id).toBe("recording");
    expect(open("no-such-page").vm.nav.find((p) => p.selected)?.id).toBe("general");
  });

  it("shows the selected page's rows in their groups", async () => {
    const h = open();
    await h.dispatch({ type: "pageSelected", page: "editor" });
    expect(h.vm.sections.map((s) => s.pageId)).toEqual(["editor"]);
    expect(h.vm.sections[0].groups.map((g) => g.title)).toEqual(["Text", "Indentation", "Assistance"]);
  });

  it("shows only the running machine's options on the Machine page", async () => {
    const h = open("machine", { emulatorState: { machineId: "z88" } });
    expect(rowIds(h)).toEqual(["z88KeyboardLayout", "z88Lcd"]);
    expect(h.vm.machineNote).toMatch(/Cambridge Z88/);
  });

  it("says so when the running machine has no options of its own", () => {
    const h = open("machine", { emulatorState: { machineId: "zxnext" } });
    expect(rowIds(h)).toEqual([]);
    expect(h.vm.emptyMessage).toMatch(/has no options of its own/);
  });
});

describe("the Settings dialog — search", () => {
  it("lists the hits of every page, and counts them in the page list", async () => {
    const h = open();
    await h.dispatch({ type: "queryChanged", query: "font" });
    expect(h.vm.searching).toBe(true);
    expect(h.vm.sections.map((s) => s.pageId)).toEqual(["appearance", "editor"]);
    expect(h.vm.nav.find((p) => p.id === "editor")?.matches).toBe(2);
    expect(h.vm.nav.find((p) => p.id === "recording")?.matches).toBe(0);
    expect(h.vm.nav.some((p) => p.selected)).toBe(false);
  });

  it("shows where a hit used to be in the menu", async () => {
    const h = open();
    await h.dispatch({ type: "queryChanged", query: "scanline" });
    const hit = h.vm.sections[0].groups[0].rows[0];
    expect(hit.replaces).toBe("Was: Machine › Scanline Effect");
  });

  it("says when nothing matches", async () => {
    const h = open();
    await h.dispatch({ type: "queryChanged", query: "xyzzy" });
    expect(h.vm.sections).toEqual([]);
    expect(h.vm.emptyMessage).toBe('No setting matches "xyzzy".');
  });

  it("leaves the search when a page is picked", async () => {
    const h = open();
    await h.dispatch({ type: "queryChanged", query: "font" });
    await h.dispatch({ type: "pageSelected", page: "debugging" });
    expect(h.vm.query).toBe("");
    expect(h.vm.sections.map((s) => s.pageId)).toEqual(["debugging"]);
  });
});

describe("the Settings dialog — writes", () => {
  it("writes a switch to its setting", async () => {
    const h = open("appearance");
    await h.dispatch({ type: "valueChanged", rowId: "sidebarToRight", value: true });
    expect(h.ports.setSetting).toHaveBeenCalledWith(SETTING_IDE_SIDEBAR_TO_RIGHT, true);
  });

  it("writes a select's value in the setting's own type", async () => {
    const h = open("editor");
    await h.dispatch({ type: "valueChanged", rowId: "tabSize", value: "8" });
    expect(h.ports.setSetting).toHaveBeenCalledWith(SETTING_EDITOR_TABSIZE, 8);
  });

  it("ignores a value the select does not offer", async () => {
    const h = open("editor");
    await h.dispatch({ type: "valueChanged", rowId: "tabSize", value: "3" });
    expect(h.ports.setSetting).not.toHaveBeenCalled();
  });

  it("writes an app-state value through its set: action", async () => {
    const h = open("appearance");
    await h.dispatch({ type: "valueChanged", rowId: "accent", value: "ember" });
    expect(h.ports.runAction).toHaveBeenCalledWith("set:accent", "ember");
    await h.dispatch({ type: "valueChanged", rowId: "theme", value: "light" });
    expect(h.ports.runAction).toHaveBeenCalledWith("set:theme", "light");
  });

  it("writes the running Timex model's own ROM setting", async () => {
    const h = open("machine", {
      emulatorState: { machineId: "timex", config: { [MC_TIMEX_MODEL]: "tc2068" } }
    });
    expect(rowIds(h)).toEqual(["timexRom"]);
    await h.dispatch({ type: "buttonClicked", rowId: "timexRom", index: 0 });
    expect(h.ports.runAction).toHaveBeenCalledWith("rom:timex:select");
    expect(SETTING_EMU_TC2068_ROM).toBeDefined();
  });

  it("does not write a locked row", async () => {
    const h = open("recording", { emulatorState: { machineId: "sp48", windowRecordingState: "recording" } });
    await h.dispatch({ type: "valueChanged", rowId: "windowRecordingHiDpi", value: true });
    expect(h.ports.runAction).not.toHaveBeenCalled();
    expect(h.vm.sections[0].groups[1].rows.every((r) => !r.enabled)).toBe(true);
  });

  it("closes itself before an action that opens another dialog", async () => {
    const h = open("integrations");
    await h.dispatch({ type: "buttonClicked", rowId: "sjasmplus", index: 0 });
    expect(h.ports.close).toHaveBeenCalledBefore(h.ports.runAction);
    expect(h.ports.runAction).toHaveBeenCalledWith("dialog:sjasmplus");
  });

  it("offers Reset only while a file row has a value", () => {
    const none = open("input");
    const keyMapping = (h: ReturnType<typeof open>) =>
      h.vm.sections[0].groups[0].rows.find((r) => r.id === "keyMapping")!;
    expect(keyMapping(none).buttons.map((b) => b.enabled)).toEqual([true, false]);
    expect(keyMapping(none).displayValue).toBe("None");
    const some = open("input", { keyMappingFile: "/k/my.keymap", emulatorState: { machineId: "sp48" } });
    expect(keyMapping(some).buttons.map((b) => b.enabled)).toEqual([true, true]);
    expect(keyMapping(some).displayValue).toBe("my.keymap");
  });

  it("disables a row while its write runs, and shows a failure", async () => {
    const h = open("appearance");
    const pending = deferred<string | undefined>();
    h.ports.runAction.mockReturnValueOnce(pending.promise);
    void h.send({ type: "valueChanged", rowId: "theme", value: "light" });
    const theme = () => h.vm.sections[0].groups[0].rows.find((r) => r.id === "theme")!;
    expect(theme().enabled).toBe(false);
    pending.resolve("Unknown theme: light");
    await h.settle();
    expect(theme().enabled).toBe(true);
    expect(h.vm.error).toBe("Unknown theme: light");
  });

  it("resets the page's rows that differ from their defaults", async () => {
    const h = open("appearance", {
      theme: "light",
      globalSettings: { ideViewOptions: { sideBarToRight: true } },
      emulatorState: { machineId: "sp48" }
    });
    await h.dispatch({ type: "resetPageRequested" });
    expect(h.ports.runAction).toHaveBeenCalledWith("set:theme", "dark");
    expect(h.ports.setSetting).toHaveBeenCalledWith(SETTING_IDE_SIDEBAR_TO_RIGHT, false);
    expect(h.ports.runAction).not.toHaveBeenCalledWith("set:accent", expect.anything());
  });

  it("follows the app state the container pushes in", async () => {
    const h = open("appearance");
    await h.dispatch({ type: "environmentChanged", env: envOf({ theme: "light" }) });
    expect(h.vm.sections[0].groups[0].rows.find((r) => r.id === "theme")!.value).toBe("light");
  });
});

describe("formatFileValue", () => {
  it("shows a file's name, or the empty text", () => {
    expect(formatFileValue("/a/b/c.rom", "Not set")).toBe("c.rom");
    expect(formatFileValue("C:\\roms\\48.rom", "Not set")).toBe("48.rom");
    expect(formatFileValue("", "Built-in ROM")).toBe("Built-in ROM");
  });
});
