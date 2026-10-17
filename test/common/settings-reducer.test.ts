import { describe, expect, it } from "vitest";

import type { AppState } from "@common/state/AppState";
import { applyProjectSettingAction, applyUserSettingAction } from "@common/state/actions";
import { appStateFlagsReducer } from "@common/state/app-state-flags-reducer";

/*
 * Setting a nested project or user setting (`zxbasic.compiler`). `useSelector` compares shallowly, so
 * the reducer must not change the previous state's nested objects in place: a shallow copy did, and
 * the status bar kept showing the old compiler after `set -p zxbasic.compiler klive`.
 */

describe("the settings reducers", () => {
  for (const [name, action, key] of [
    ["project", applyProjectSettingAction, "projectSettings"],
    ["user", applyUserSettingAction, "userSettings"]
  ] as const) {
    it(`sets a nested ${name} setting in new objects, leaving the previous state as it was`, () => {
      const before = { [key]: { zxbasic: { compiler: "boriel", root: "/z" }, other: 1 } } as unknown as AppState;
      const after = appStateFlagsReducer(before, action("zxbasic.compiler", "klive"));
      expect((after as any)[key]).toEqual({ zxbasic: { compiler: "klive", root: "/z" }, other: 1 });
      expect((before as any)[key].zxbasic.compiler).toBe("boriel");
      expect((after as any)[key].zxbasic).not.toBe((before as any)[key].zxbasic);
    });

    it(`removes a nested ${name} setting the same way`, () => {
      const before = { [key]: { zxbasic: { compiler: "boriel" } } } as unknown as AppState;
      const after = appStateFlagsReducer(before, action("zxbasic.compiler", undefined));
      expect((after as any)[key]).toEqual({ zxbasic: {} });
      expect((before as any)[key].zxbasic.compiler).toBe("boriel");
    });
  }
});
