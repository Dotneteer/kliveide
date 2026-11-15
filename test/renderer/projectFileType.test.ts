import { describe, expect, it } from "vitest";
import { CODE_EDITOR } from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * Files known by their exact name must keep their entry when the matcher is given a full path, as the
 * explorer does: `klive.project` lost its JSON highlighting and its read-only state when callers moved
 * from `node.name` to `node.fullPath` and the entry still compared the whole string.
 */

const store = { getState: () => ({}) } as never;

describe("exact-name file types", () => {
  it.each([
    "klive.project",
    "/Users/me/KliveProjects/game/klive.project",
    "C:\\KliveProjects\\game\\klive.project"
  ])("opens %s as read-only JSON", (path) => {
    const entry = getFileTypeEntry(path, store);
    expect(entry).toMatchObject({
      editor: CODE_EDITOR,
      subType: "json",
      isReadOnly: true,
      icon: "file-project"
    });
  });

  it.each(["build.ksx", "/Users/me/KliveProjects/game/build.ksx", "C:\\KliveProjects\\game\\build.ksx"])(
    "opens %s as the editable build script",
    (path) => {
      const entry = getFileTypeEntry(path, store);
      expect(entry).toMatchObject({ editor: CODE_EDITOR, subType: "ksx", icon: "combine" });
      expect(entry?.isReadOnly).toBeFalsy();
    }
  );

  it.each(["/x/myklive.project", "/x/klive.project.bak", "/klive.project/readme.txt"])(
    "does not treat %s as the project file",
    (path) => {
      expect(getFileTypeEntry(path, store)?.icon).not.toBe("file-project");
    }
  );
});
