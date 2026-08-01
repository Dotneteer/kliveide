import { describe, expect, it, vi } from "vitest";
import {
  CODE_EDITOR,
  DISASSEMBLY_EDITOR,
  DISASSEMBLY_PANEL_ID,
  MEMORY_EDITOR,
  MEMORY_PANEL_ID,
  TEXT_EDITOR
} from "@common/state/common-ids";
import { restoreLastOpenDocuments } from "@renderer/appIde/restoreLastOpenDocuments";

describe("restoreLastOpenDocuments", () => {
  it("stages restored tabs without loading every document and activates only the saved active tab", async () => {
    const documentHubService = {
      closeAllDocuments: vi.fn(() => Promise.resolve()),
      openDocumentTab: vi.fn(() => Promise.resolve()),
      setActiveDocument: vi.fn(() => Promise.resolve())
    };
    const getDocumentForProjectNode = vi.fn();
    const projectService = {
      setActiveDocumentHubService: vi.fn(),
      getActiveDocumentHubService: vi.fn(() => documentHubService),
      getDocumentForProjectNode,
      getDocumentShellForProjectNode: vi.fn((node) => ({
        id: node.fullPath,
        name: node.name,
        path: node.fullPath,
        type: node.editor,
        node
      })),
      getNodeForFile: vi.fn((id: string) => {
        if (!id.startsWith("/project/")) return undefined;
        const name = id.split("/").pop();
        return {
          data: {
            editor: CODE_EDITOR,
            fullPath: id,
            isFolder: false,
            name,
            projectPath: `src/${name}`
          }
        };
      })
    };
    const store = {
      getState: vi.fn(() => ({
        project: { folderPath: "/project" },
        workspaceSettings: {
          docsWorkspace: {
            documents: [
              {
                type: CODE_EDITOR,
                id: "/project/src/a.asm",
                position: { line: 12, column: 3 }
              },
              {
                type: TEXT_EDITOR,
                id: "/project/readme.txt",
                position: { line: 1, column: 0 }
              },
              {
                type: CODE_EDITOR,
                id: "/outside/src/c.asm",
                position: { line: 4, column: 1 }
              },
              {
                type: CODE_EDITOR,
                id: "/project/src/b.asm",
                position: { line: 22, column: 5 }
              }
            ],
            activeDocumentId: "/project/src/b.asm"
          }
        }
      }))
    };

    await restoreLastOpenDocuments(projectService as never, store as never);

    expect(documentHubService.closeAllDocuments).toHaveBeenCalledTimes(1);
    expect(projectService.getDocumentForProjectNode).not.toHaveBeenCalled();
    expect(documentHubService.openDocumentTab).toHaveBeenCalledTimes(2);
    expect(documentHubService.openDocumentTab).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "/project/src/a.asm",
        editPosition: { line: 12, column: 3 }
      }),
      undefined,
      false
    );
    expect(documentHubService.openDocumentTab).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "/project/src/b.asm",
        editPosition: { line: 22, column: 5 }
      }),
      undefined,
      false
    );
    expect(documentHubService.setActiveDocument).toHaveBeenCalledTimes(1);
    expect(documentHubService.setActiveDocument).toHaveBeenCalledWith("/project/src/b.asm");
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(documentHubService);
    expect(documentHubService.openDocumentTab.mock.invocationCallOrder[1]).toBeLessThan(
      documentHubService.setActiveDocument.mock.invocationCallOrder[0]
    );
  });

  it("restores a multi-area workspace with overlapping documents and skips missing files", async () => {
    const firstHub = createDocumentHubMock();
    const secondHub = createDocumentHubMock();
    const documentCache = new Map<string, unknown>();
    const projectService = {
      createDocumentHubService: vi.fn(() => secondHub),
      getActiveDocumentHubService: vi.fn(() => firstHub),
      getDocumentHubServiceInstances: vi.fn(() => [firstHub]),
      getDocumentShellForProjectNode: vi.fn((node) => {
        if (!documentCache.has(node.fullPath)) {
          documentCache.set(node.fullPath, {
            id: node.fullPath,
            name: node.name,
            path: node.fullPath,
            type: node.editor,
            node
          });
        }
        return documentCache.get(node.fullPath);
      }),
      getNodeForFile: vi.fn((id: string) => {
        if (id.endsWith("missing.asm")) return undefined;
        if (!id.startsWith("/project/")) return undefined;
        const name = id.split("/").pop();
        return {
          data: {
            editor: CODE_EDITOR,
            fullPath: id,
            isFolder: false,
            name,
            projectPath: `src/${name}`
          }
        };
      }),
      setActiveDocumentHubService: vi.fn()
    };
    const store = {
      getState: vi.fn(() => ({
        project: { folderPath: "/project" },
        workspaceSettings: {
          docsWorkspace: {
            version: 2,
            layout: {
              type: "split",
              direction: "horizontal",
              first: {
                type: "leaf",
                areaId: "left"
              },
              second: {
                type: "leaf",
                areaId: "right"
              }
            },
            activeAreaId: "right",
            areas: [
              {
                areaId: "left",
                activeDocumentId: "/project/src/a.asm",
                documents: [
                  {
                    type: CODE_EDITOR,
                    id: "/project/src/a.asm",
                    position: { line: 3, column: 2 },
                    viewState: { cursor: "left-a" }
                  }
                ]
              },
              {
                areaId: "right",
                activeDocumentId: "/project/src/b.asm",
                documents: [
                  {
                    type: CODE_EDITOR,
                    id: "/project/src/a.asm",
                    position: { line: 9, column: 1 },
                    viewState: { cursor: "right-a" }
                  },
                  {
                    type: CODE_EDITOR,
                    id: "/project/src/missing.asm",
                    position: { line: 1, column: 0 }
                  },
                  {
                    type: CODE_EDITOR,
                    id: "/project/src/b.asm",
                    position: { line: 12, column: 5 },
                    viewState: { cursor: "right-b" }
                  }
                ]
              }
            ]
          }
        }
      }))
    };

    await restoreLastOpenDocuments(projectService as never, store as never);

    expect(firstHub.closeAllDocuments).toHaveBeenCalledTimes(1);
    expect(projectService.createDocumentHubService).toHaveBeenCalledTimes(1);
    expect(firstHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "/project/src/a.asm"
      }),
      { cursor: "left-a" },
      false
    );
    expect(secondHub.openDocumentTab).toHaveBeenCalledTimes(2);
    expect(secondHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "/project/src/a.asm"
      }),
      { cursor: "right-a" },
      false
    );
    expect(secondHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "/project/src/b.asm",
        editPosition: { line: 12, column: 5 }
      }),
      { cursor: "right-b" },
      false
    );
    expect(secondHub.openDocumentTab).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "/project/src/missing.asm" }),
      undefined,
      false
    );
    expect(firstHub.setActiveDocument).toHaveBeenCalledWith("/project/src/a.asm");
    expect(secondHub.setActiveDocument).toHaveBeenCalledWith("/project/src/b.asm");
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(secondHub);
  });

  it("restores special documents in their saved hubs and migrates a missing view state once", async () => {
    const firstHub = createDocumentHubMock();
    const secondHub = createDocumentHubMock();
    const projectService = {
      createDocumentHubService: vi.fn(),
      getActiveDocumentHubService: vi.fn(() => firstHub),
      getDocumentHubServiceInstances: vi.fn(() => [firstHub, secondHub]),
      getDocumentShellForProjectNode: vi.fn(),
      getNodeForFile: vi.fn(),
      setActiveDocumentHubService: vi.fn()
    };
    const store = {
      getState: vi.fn(() => ({
        project: { folderPath: "/project" },
        workspaceSettings: {
          [DISASSEMBLY_EDITOR]: { currentSegment: 3, topAddress: 0x9000 },
          docsWorkspace: {
            version: 2,
            layout: {
              type: "split",
              direction: "horizontal",
              first: { type: "leaf", areaId: "left" },
              second: { type: "leaf", areaId: "right" }
            },
            activeAreaId: "right",
            areas: [
              {
                areaId: "left",
                activeDocumentId: MEMORY_PANEL_ID,
                documents: [
                  {
                    id: MEMORY_PANEL_ID,
                    type: MEMORY_EDITOR,
                    viewState: { topIndex: 12 }
                  }
                ]
              },
              {
                areaId: "right",
                activeDocumentId: DISASSEMBLY_PANEL_ID,
                documents: [
                  {
                    id: MEMORY_PANEL_ID,
                    type: MEMORY_EDITOR,
                    viewState: { topIndex: 48 }
                  },
                  {
                    id: DISASSEMBLY_PANEL_ID,
                    type: DISASSEMBLY_EDITOR
                  }
                ]
              }
            ]
          }
        }
      }))
    };

    await restoreLastOpenDocuments(projectService as never, store as never);

    expect(firstHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: MEMORY_PANEL_ID, type: MEMORY_EDITOR }),
      { topIndex: 12 },
      false
    );
    expect(secondHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: MEMORY_PANEL_ID, type: MEMORY_EDITOR }),
      { topIndex: 48 },
      false
    );
    expect(secondHub.openDocumentTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: DISASSEMBLY_PANEL_ID, type: DISASSEMBLY_EDITOR }),
      { currentSegment: 3, topAddress: 0x9000 },
      false
    );
    expect(firstHub.setActiveDocument).toHaveBeenCalledWith(MEMORY_PANEL_ID);
    expect(secondHub.setActiveDocument).toHaveBeenCalledWith(DISASSEMBLY_PANEL_ID);
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(secondHub);
  });
});

function createDocumentHubMock() {
  return {
    closeAllDocuments: vi.fn(() => Promise.resolve()),
    openDocumentTab: vi.fn(() => Promise.resolve()),
    setActiveDocument: vi.fn(() => Promise.resolve())
  };
}
