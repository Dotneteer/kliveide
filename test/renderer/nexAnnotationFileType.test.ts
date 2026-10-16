import { describe, expect, it, vi } from "vitest";
import { CODE_EDITOR, NEX_VIEWER, ROM_ANNOTATION_EDITOR } from "@common/state/common-ids";
import { ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import { buildProjectTree, getFileTypeEntry } from "@renderer/appIde/project/project-node";

describe("NEX annotation file type", () => {
  it("opens .nex.dis files as read-only JSON code documents", () => {
    const entry = getFileTypeEntry("ScrollNutter.nex.dis", createStoreMock() as never);

    expect(entry).toMatchObject({
      pattern: ".dis",
      editor: CODE_EDITOR,
      subType: "json",
      isReadOnly: true
    });
    expect(entry?.isBinary).toBeUndefined();
    expect(entry?.openPermanent).toBeUndefined();
  });

  it("opens every program's annotation sidecar the same way: a snapshot's, a project's", () => {
    for (const name of ["jetpac.z80.dis", "annotations.dis", "game.p.dis"]) {
      expect(getFileTypeEntry(name, createStoreMock() as never)).toMatchObject({
        pattern: ".dis",
        editor: CODE_EDITOR,
        subType: "json",
        isReadOnly: true
      });
    }
  });

  it("opens a ROM's sidecar in the ROM annotation editor (ROM_ANNOTATION_EDITING_PLAN R4)", () => {
    for (const name of ["sp48.rom.dis", "my-custom.rom.dis"]) {
      expect(getFileTypeEntry(name, createStoreMock() as never)).toMatchObject({
        pattern: ".rom.dis",
        editor: ROM_ANNOTATION_EDITOR,
        isReadOnly: true
      });
    }
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
