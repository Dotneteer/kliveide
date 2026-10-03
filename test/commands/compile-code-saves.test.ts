import { describe, expect, it, vi } from "vitest";
import { compileCode } from "@renderer/appIde/utils/compile-code";

describe("compileCode", () => {
  it("writes the editors' unsaved text before the compiler reads the files", async () => {
    const calls: string[] = [];
    const state = { project: { isKliveProject: true, folderPath: "/p", buildRoots: ["code/program.zxbas"] } };
    const output = { color: vi.fn(), write: vi.fn(), writeLine: vi.fn(), resetStyle: vi.fn(), severity: vi.fn() };
    const context = {
      output,
      store: { getState: () => state, dispatch: vi.fn() },
      service: {
        projectService: {
          releaseLocks: vi.fn(),
          performAllDelayedSavesNow: vi.fn(async () => {
            calls.push("save");
          })
        }
      },
      mainApi: {
        compileFile: vi.fn(async () => {
          calls.push("compile");
          throw new Error("stop here");
        })
      },
      messenger: {}
    };
    await compileCode(context as never).catch(() => undefined);
    expect(calls.slice(0, 2)).toEqual(["save", "compile"]);
  });
});
