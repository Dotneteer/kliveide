import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpressionValueType } from "@abstractions/CompilerInfo";
import {
  integerSymbolsOf,
  mergedConditionSymbols,
  pushConditionSymbols,
  resetConditionSymbolsForTests,
  setBuildConditionSymbols,
  setSidecarConditionSymbols,
  sidecarSymbolsOf
} from "@renderer/appIde/utils/condition-symbols";
import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

/*
 * The symbol table breakpoint conditions bind to (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3.6, F3).
 */

const annotations: NexFileAnnotations = {
  schemaVersion: 2,
  globalLabels: [
    { name: "Score", value: 0x8000 },
    { name: "Shared", value: 0x1111 }
  ],
  banks: {
    "5": { offsetIndex: 1, regions: [], localLabels: [{ name: "Flags", value: 0x0123 }] }
  }
};

afterEach(() => resetConditionSymbolsForTests());

describe("condition symbols", () => {
  it("keeps only the integer symbols of a build, keyed lower-case", () => {
    expect(
      integerSymbolsOf({
        Lives: { value: { _type: ExpressionValueType.Integer, _value: 3 } },
        name: { value: { _type: ExpressionValueType.String, _value: "x" } },
        flag: { value: { _type: ExpressionValueType.Bool, _value: true } },
        broken: {}
      })
    ).toEqual({ lives: 3 });
    expect(integerSymbolsOf(undefined)).toEqual({});
  });

  it("reads a sidecar's global labels and its bank-local labels as <bank>:<name>", () => {
    expect(sidecarSymbolsOf(annotations)).toEqual({ score: 0x8000, shared: 0x1111, "5:flags": 0x0123 });
  });

  it("lets the build win where both define a name", () => {
    setSidecarConditionSymbols("/p/a.nex.dis", annotations);
    setBuildConditionSymbols({ shared: 0x2222, main: 0x8000 });
    expect(mergedConditionSymbols()).toEqual({
      score: 0x8000,
      shared: 0x2222,
      "5:flags": 0x0123,
      main: 0x8000
    });
  });

  it("forgets a sidecar handed no annotations", () => {
    setSidecarConditionSymbols("/p/a.nex.dis", annotations);
    setSidecarConditionSymbols("/p/a.nex.dis", undefined);
    expect(mergedConditionSymbols()).toEqual({});
  });

  it("pushes the merged table, and survives a missing machine", async () => {
    setBuildConditionSymbols({ main: 1 });
    const setConditionSymbols = vi.fn().mockResolvedValue(undefined);
    await pushConditionSymbols({ setConditionSymbols } as any);
    expect(setConditionSymbols).toHaveBeenCalledWith({ main: 1 });

    const failing = vi.fn().mockRejectedValue(new Error("no machine"));
    await expect(pushConditionSymbols({ setConditionSymbols: failing } as any)).resolves.toBeUndefined();
  });
});
