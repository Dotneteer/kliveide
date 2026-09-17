import { describe, expect, it } from "vitest";

import {
  defaultNavigationShortcuts,
  matchesAccelerator,
  parseAccelerator,
  readNavigationShortcuts
} from "@common/utils/navigationShortcuts";

function key(code: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) {
  return {
    key: "",
    code,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
    metaKey: !!mods.meta
  };
}

describe("navigation shortcuts", () => {
  it("defaults to VS Code's", () => {
    expect(defaultNavigationShortcuts(true)).toEqual({ back: "Ctrl+-", forward: "Ctrl+Shift+-" });
    expect(defaultNavigationShortcuts(false)).toEqual({ back: "Alt+Left", forward: "Alt+Right" });
  });

  it("reads overrides from user settings, and project settings over those", () => {
    expect(
      readNavigationShortcuts({ userSettings: { shortcuts: { navigateBack: "Cmd+[" } } } as any, true)
    ).toEqual({ back: "Cmd+[", forward: "Ctrl+Shift+-" });
    // --- `SettingsReader` merges the two scopes shallowly: a project `shortcuts` object replaces
    // --- the user's, as it does for the stepping shortcuts.
    const state: any = {
      userSettings: { shortcuts: { navigateBack: "Cmd+[" } },
      projectSettings: { shortcuts: { navigateForward: "Cmd+]" } }
    };
    expect(readNavigationShortcuts(state, true)).toEqual({ back: "Ctrl+-", forward: "Cmd+]" });
    expect(readNavigationShortcuts({ userSettings: { shortcuts: { navigateBack: " " } } } as any, false))
      .toEqual({ back: "Alt+Left", forward: "Alt+Right" });
  });

  it("matches by physical key, so Shift+- is not confused by the '_' it types", () => {
    expect(matchesAccelerator(key("Minus", { ctrl: true }), "Ctrl+-", true)).toBe(true);
    expect(matchesAccelerator({ ...key("Minus", { ctrl: true, shift: true }), key: "_" }, "Ctrl+Shift+-", true)).toBe(true);
  });

  it("requires exactly the accelerator's modifiers", () => {
    // --- Back must not also fire for Forward's chord, which only adds Shift.
    expect(matchesAccelerator(key("Minus", { ctrl: true, shift: true }), "Ctrl+-", true)).toBe(false);
    expect(matchesAccelerator(key("ArrowLeft"), "Alt+Left", false)).toBe(false);
    expect(matchesAccelerator(key("ArrowLeft", { alt: true }), "Alt+Left", false)).toBe(true);
    expect(matchesAccelerator(key("ArrowLeft", { alt: true, ctrl: true }), "Alt+Left", false)).toBe(false);
  });

  it("resolves CmdOrCtrl per platform", () => {
    expect(matchesAccelerator(key("BracketLeft", { meta: true }), "CmdOrCtrl+[", true)).toBe(true);
    expect(matchesAccelerator(key("BracketLeft", { ctrl: true }), "CmdOrCtrl+[", false)).toBe(true);
    expect(matchesAccelerator(key("BracketLeft", { ctrl: true }), "CmdOrCtrl+[", true)).toBe(false);
  });

  it("understands letters, digits, function keys and 'Plus'", () => {
    expect(matchesAccelerator(key("KeyB", { alt: true }), "Alt+B", false)).toBe(true);
    expect(matchesAccelerator(key("Digit7", { ctrl: true }), "Ctrl+7", false)).toBe(true);
    expect(matchesAccelerator(key("F9", { shift: true }), "Shift+F9", false)).toBe(true);
    expect(matchesAccelerator(key("Equal", { ctrl: true }), "Ctrl+Plus", false)).toBe(true);
  });

  it("never matches an accelerator it cannot parse", () => {
    expect(parseAccelerator("Hyper+-", false)).toBeUndefined();
    expect(parseAccelerator("Ctrl+NoSuchKey", false)).toBeUndefined();
    expect(parseAccelerator("", false)).toBeUndefined();
    expect(matchesAccelerator(key("Minus", { ctrl: true }), "Ctrl+", true)).toBe(false);
  });
});
