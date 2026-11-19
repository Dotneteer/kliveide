import { describe, expect, it } from "vitest";
import { CODE_EDITOR, TAP_VIEWER } from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * Tape files open in the tape viewer whatever the case of their extension: tapes come from old
 * media and other systems, where GAME.TAP is as common as game.tap. `ignoreCase` is opt-in per
 * registry entry: the binary file types take it, source files keep the case-sensitive match.
 */

const store = { getState: () => ({}) } as never;

describe("tape file type", () => {
  it.each(["game.tap", "GAME.TAP", "Game.Tap", "game.tzx", "GAME.TZX", "my game.TzX"])(
    "opens %s in the tape viewer, with its load actions",
    (name) => {
      const entry = getFileTypeEntry(name, store);
      expect(entry?.editor).toBe(TAP_VIEWER);
      expect(entry?.contextMenuInfo).toBeDefined();
      expect(entry?.documentTabRenderer).toBeDefined();
    }
  );

  it("does not take a name that merely contains the letters", () => {
    expect(getFileTypeEntry("tap.txt", store)?.editor).not.toBe(TAP_VIEWER);
    expect(getFileTypeEntry("GAME.TAPX", store)?.editor).not.toBe(TAP_VIEWER);
  });

  it("keeps source file types case-sensitive", () => {
    expect(getFileTypeEntry("main.asm", store)?.editor).toBe(CODE_EDITOR);
    expect(getFileTypeEntry("MAIN.ASM", store)?.editor).not.toBe(CODE_EDITOR);
  });
});
