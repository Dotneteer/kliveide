import { describe, expect, it } from "vitest";
import { findRunningScript } from "@renderer/features/documents/scriptingCommandHelpers";

describe("ScriptingCommandBar helpers", () => {
  it("finds the latest non-completed run for a script path", () => {
    expect(
      findRunningScript(
        [
          createScript(1, "/project/build.ksx", "running"),
          createScript(2, "/project/main.ksx", "completed"),
          createScript(3, "/project/main.ksx", "pending")
        ],
        "/project/main.ksx"
      )
    ).toEqual(expect.objectContaining({ id: 3 }));
  });

  it("ignores completed runs when checking whether a script is active", () => {
    expect(
      findRunningScript(
        [
          createScript(1, "/project/main.ksx", "completed"),
          createScript(2, "/project/main.ksx", "stopped")
        ],
        "/project/main.ksx"
      )
    ).toBeUndefined();
  });
});

function createScript(id: number, scriptFileName: string, status: string) {
  return {
    id,
    scriptFileName,
    status,
    runsInEmu: false,
    startTime: new Date(0)
  } as never;
}
