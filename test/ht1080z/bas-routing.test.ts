import { describe, expect, it } from "vitest";

import type { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import {
  buildProjectTree,
  fileContentKindOf,
  getFileTypeEntry,
  registerFileContentKind,
  takeChangedContentKinds
} from "@renderer/appIde/project/project-node";
import { CODE_EDITOR, HT1080Z_TAPE_VIEWER } from "@state/common-ids";

/*
 * A `.bas` opens by its content (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2, D3, D7): the tree carries the
 * kind the main process sniffed, and the file type entry follows it.
 */
const store: any = { getState: () => ({}) };

describe("file types by content", () => {
  it("opens a tokenised .bas in the HT entry and a text one in the code editor", () => {
    registerFileContentKind("/p/demo.bas", "ht1080zBasic");
    expect(getFileTypeEntry("/p/demo.bas", store)).toMatchObject({ editor: HT1080Z_TAPE_VIEWER, isBinary: true, contentKind: "ht1080zBasic" });
    expect(getFileTypeEntry("/p/other.bas", store)?.editor).toBe(CODE_EDITOR);
    expect(getFileTypeEntry("/p/game.bas", store)).toMatchObject({ editor: CODE_EDITOR, subType: "zxbas" });
    registerFileContentKind("/p/demo.bas", undefined);
    expect(getFileTypeEntry("/p/demo.bas", store)?.editor).toBe(CODE_EDITOR);
  });

  it("opens .cas and .cmd files in the HT tape viewer", () => {
    expect(getFileTypeEntry("/p/hello.cas", store)?.editor).toBe(HT1080Z_TAPE_VIEWER);
    expect(getFileTypeEntry("/p/HELLO.CMD", store)?.editor).toBe(HT1080Z_TAPE_VIEWER);
  });

  it("takes the kinds from the tree, and a tokenised .bas is never a build root", () => {
    const tree: ProjectNodeWithChildren = {
      isFolder: true,
      name: "p",
      fullPath: "/q",
      children: [
        { isFolder: false, name: "demo.bas", fullPath: "/q/demo.bas", contentKind: "ht1080zBasic", children: [] },
        { isFolder: false, name: "game.bas", fullPath: "/q/game.bas", children: [] }
      ]
    };
    const view = buildProjectTree(tree, store);
    const nodes = view.rootNode.children.map((n) => n.data);
    const demo = nodes.find((n) => n.name === "demo.bas")!;
    const game = nodes.find((n) => n.name === "game.bas")!;
    expect(fileContentKindOf("/q/demo.bas")).toBe("ht1080zBasic");
    expect(demo).toMatchObject({ editor: HT1080Z_TAPE_VIEWER, canBeBuildRoot: false });
    expect(game.editor).toBe(CODE_EDITOR);
    expect(game.canBeBuildRoot).toBe(true);
  });

  it("reports a listed file whose kind changed, once", () => {
    takeChangedContentKinds();
    registerFileContentKind("/r/x.bas", undefined);
    expect(takeChangedContentKinds()).toEqual([]);
    registerFileContentKind("/r/x.bas", "ht1080zBasic");
    expect(takeChangedContentKinds()).toEqual(["/r/x.bas"]);
    expect(takeChangedContentKinds()).toEqual([]);
  });
});
