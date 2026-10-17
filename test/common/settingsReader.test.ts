import { describe, expect, it } from "vitest";

import type { AppState } from "@common/state/AppState";
import { createSettingsReader } from "@common/utils/SettingsReader";

const reader = (userSettings: Record<string, any>, projectSettings: Record<string, any>) =>
  createSettingsReader({ userSettings, projectSettings } as unknown as AppState);

describe("SettingsReader", () => {
  it("lets a project override one key of a namespace without hiding the user's others", () => {
    // --- The bug this guards: a shallow merge dropped zxbasic.root once the project set zxbasic.compiler
    const r = reader({ zxbasic: { root: "/home/me/zxbasic2", compiler: "klive" } }, { zxbasic: { compiler: "boriel" } });
    expect(r.readSetting("zxbasic.compiler")).toBe("boriel");
    expect(r.readSetting("zxbasic.root")).toBe("/home/me/zxbasic2");
  });

  it("merges a namespace read as a whole, project keys winning", () => {
    const r = reader({ sjasmp: { root: "/a", keepTempFiles: false } }, { sjasmp: { keepTempFiles: true } });
    expect(r.readSetting("sjasmp")).toEqual({ root: "/a", keepTempFiles: true });
  });

  it("reads either side alone, and lets a project value replace a non-object", () => {
    expect(reader({ a: { b: 1 } }, {}).readSetting("a.b")).toBe(1);
    expect(reader({}, { a: { b: 2 } }).readSetting("a.b")).toBe(2);
    expect(reader({ a: [1, 2] }, { a: [3] }).readSetting("a")).toEqual([3]);
    expect(reader({ a: 1 }, { a: 0 }).readSetting("a")).toBe(0);
    expect(reader({}, {}).readSetting("x.y")).toBeUndefined();
  });
});
