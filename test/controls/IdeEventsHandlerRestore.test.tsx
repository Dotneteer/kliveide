import { describe, expect, it, vi } from "vitest";
import { CODE_EDITOR, TEXT_EDITOR } from "@common/state/common-ids";
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
    expect(documentHubService.openDocumentTab.mock.invocationCallOrder[1]).toBeLessThan(
      documentHubService.setActiveDocument.mock.invocationCallOrder[0]
    );
  });
});
