import { describe, expect, it, vi } from "vitest";
import { CODE_EDITOR, NEX_VIEWER } from "@common/state/common-ids";
import { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import { buildProjectTree, getFileTypeEntry } from "@renderer/appIde/project/project-node";

describe("NEX annotation file type", () => {
  it("opens .nex.dis files as read-only JSON code documents", () => {
    const entry = getFileTypeEntry("ScrollNutter.nex.dis", createStoreMock() as never);

    expect(entry).toMatchObject({
      pattern: ".nex.dis",
      editor: CODE_EDITOR,
      subType: "json",
      isReadOnly: true
    });
    expect(entry?.isBinary).toBeUndefined();
    expect(entry?.openPermanent).toBeUndefined();
  });

  it("keeps .nex files on the binary NEX viewer", () => {
    const entry = getFileTypeEntry("ScrollNutter.nex", createStoreMock() as never);

    expect(entry).toMatchObject({
      pattern: ".nex",
      editor: NEX_VIEWER,
      isBinary: true,
      isReadOnly: true,
      openPermanent: true
    });
  });

  it("marks NEX annotation files with JSON editor metadata in the Explorer tree", () => {
    const root: ProjectNodeWithChildren = {
      name: "project",
      fullPath: "/project",
      projectPath: "",
      isFolder: true,
      children: [
        {
          name: "ScrollNutter.nex.dis",
          fullPath: "/project/ScrollNutter.nex.dis",
          projectPath: "ScrollNutter.nex.dis",
          isFolder: false
        } as ProjectNodeWithChildren
      ]
    } as ProjectNodeWithChildren;

    const tree = buildProjectTree(root, createStoreMock() as never);
    const child = tree.rootNode.children[0].data;

    expect(child.editor).toBe(CODE_EDITOR);
    expect(child.subType).toBe("json");
    expect(child.isReadOnly).toBe(true);
    expect(child.isBinary).toBeUndefined();
    expect(child.openPermanent).toBeUndefined();
  });
});

function createStoreMock() {
  return {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({}))
  };
}
