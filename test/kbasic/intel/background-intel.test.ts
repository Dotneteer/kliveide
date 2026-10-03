import { describe, expect, it } from "vitest";
import type { AssemblerErrorInfo, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { BasicIntelData } from "@abstractions/BasicIntel";
import { backgroundIntelActions, hasErrorSeverity } from "@main/compiler-integration/backgroundIntel";
import { compilationReducer } from "@common/state/compilation-reducer";
import { setBasicIntelAction, setLanguageIntelAction } from "@common/state/actions";

const warning: AssemblerErrorInfo = {
  errorCode: "W100",
  filename: "/p/main.zxbas",
  line: 1,
  startPosition: 0,
  endPosition: 1,
  startColumn: 0,
  endColumn: 1,
  message: "implicit",
  isWarning: true
};
const error: AssemblerErrorInfo = { ...warning, errorCode: "E300", isWarning: undefined };

function intel(rootFile: string): BasicIntelData {
  return { rootFile, caseInsensitive: false, files: [], symbols: [], occurrences: [], scopes: [], outline: [], defines: [], headerOptions: [] };
}

describe("background intel publishing (plan E3, E4)", () => {
  it("warnings are not errors", () => {
    expect(hasErrorSeverity([warning])).toBe(false);
    expect(hasErrorSeverity([warning, error])).toBe(true);
    expect(hasErrorSeverity(undefined)).toBe(false);
  });

  it("publishes the assembler's intel when there are only warnings", () => {
    const actions = backgroundIntelActions("kz80-asm", { errors: [warning] } as KliveCompilerOutput);
    expect(actions.map((a) => a.type)).toEqual(["SET_LANGUAGE_INTEL"]);
  });

  it("keeps the assembler's last good intel on an error", () => {
    expect(backgroundIntelActions("kz80-asm", { errors: [error] } as KliveCompilerOutput)).toEqual([]);
  });

  it("a BASIC check never publishes the assembler's intel", () => {
    expect(backgroundIntelActions("zxbas", { errors: [] } as KliveCompilerOutput)).toEqual([]);
    const actions = backgroundIntelActions("zxbas", { errors: [warning], basicIntel: [intel("/p/main.zxbas")] } as unknown as KliveCompilerOutput);
    expect(actions.map((a) => a.type)).toEqual(["SET_BASIC_INTEL"]);
  });

  it("ignores a failed worker's message", () => {
    expect(backgroundIntelActions("kz80-asm", "Error: boom" as unknown as KliveCompilerOutput)).toEqual([]);
  });
});

describe("compilation reducer: basicIntel", () => {
  it("stores snapshots by root and replaces them", () => {
    let state = compilationReducer({}, setBasicIntelAction(intel("/p/a.zxbas")));
    state = compilationReducer(state, setBasicIntelAction(intel("/p/b.zxbas")));
    const next = { ...intel("/p/a.zxbas"), caseInsensitive: true };
    state = compilationReducer(state, setBasicIntelAction(next));
    expect(Object.keys(state.basicIntel!)).toEqual(["/p/a.zxbas", "/p/b.zxbas"]);
    expect(state.basicIntel!["/p/a.zxbas"]).toBe(next);
  });

  it("a BASIC snapshot leaves the assembler's intel alone, and the reverse", () => {
    const asm = { symbolDefinitions: [], symbolReferences: [], documentOutline: [], sourceFiles: [], lineInfo: [] };
    let state = compilationReducer({}, setLanguageIntelAction(asm));
    state = compilationReducer(state, setBasicIntelAction(intel("/p/a.zxbas")));
    expect(state.languageIntel).toBe(asm);
    state = compilationReducer(state, setLanguageIntelAction({ ...asm }));
    expect(state.basicIntel!["/p/a.zxbas"]).toBeDefined();
  });

  it("is cleared when the project or the build root changes", () => {
    const state = compilationReducer({}, setBasicIntelAction(intel("/p/a.zxbas")));
    expect(compilationReducer(state, { type: "CLOSE_FOLDER" }).basicIntel).toBeUndefined();
    expect(compilationReducer(state, { type: "SET_BUILD_ROOT", payload: { files: [], flag: true } }).basicIntel).toBeUndefined();
  });
});
