import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("DocumentTabs", () => {
  it("uses the document path when duplicate tab names would be ambiguous", async () => {
    vi.doMock("@renderer/appIde/DocumentArea/DocumentTab", () => ({
      CloseMode: { All: 0, Others: 1, This: 2 },
      DocumentTab: ({ name }: { name: string }) => <div>{name}</div>
    }));

    const { DocumentTabs } = await import("@renderer/appIde/DocumentArea/DocumentTabs");

    render(
      <DocumentTabs
        activeDocIndex={0}
        awaiting={false}
        isProjectDebugging={false}
        openDocs={[
          createDocument("folder-a/main.asm", "main.asm"),
          createDocument("folder-b/main.asm", "main.asm")
        ]}
        onTabClicked={vi.fn()}
        onTabCloseClicked={vi.fn()}
        onTabDisplayed={vi.fn()}
        onTabDoubleClicked={vi.fn()}
        tabsCount={2}
      />
    );

    expect(screen.getByText("folder-a/main.asm")).toBeInTheDocument();
    expect(screen.getByText("folder-b/main.asm")).toBeInTheDocument();
  });
});

describe("DocumentsHeader", () => {
  it("persists workspace document metadata and saves the project", async () => {
    const saveProject = vi.fn(() => Promise.resolve());
    const store = {
      dispatch: vi.fn(),
      getState: vi.fn(() => ({
        project: {
          folderPath: "/project",
          buildRoots: []
        },
        emulatorState: {
          isProjectDebugging: false
        },
        ideView: {
          editorVersion: 1
        }
      }))
    };
    const documentHubService = {
      closeAllExplorerDocuments: vi.fn(),
      getActiveDocumentIndex: vi.fn(() => 1),
      getDocumentViewState: vi.fn(() => ({})),
      getOpenDocuments: vi.fn(() => [
        createDocument("/project/src/a.asm", "a.asm", { line: 2, column: 4 }),
        createDocument("/project/src/b.asm", "b.asm", { line: 8, column: 1 }),
        createDocument("/outside/c.asm", "c.asm", { line: 1, column: 1 })
      ]),
      getOpenProjectFileDocument: vi.fn(() => Promise.resolve(undefined)),
      moveActiveToLeft: vi.fn(),
      moveActiveToRight: vi.fn(),
      setDocumentViewState: vi.fn()
    };
    const projectClosed = {
      on: vi.fn(),
      off: vi.fn()
    };

    vi.doMock("@renderer/core/RendererProvider", () => ({
      useDispatch: () => vi.fn(),
      useRendererContext: () => ({ store }),
      useSelector: (selector: (state: unknown) => unknown) => selector(store.getState())
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({ saveProject })
    }));
    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        projectService: { projectClosed },
        outputPaneService: { getOutputPaneBuffer: vi.fn() },
        ideCommandsService: { executeCommand: vi.fn() }
      })
    }));
    vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
      useDocumentHubService: () => documentHubService,
      useDocumentHubServiceVersion: () => 1
    }));
    vi.doMock("@renderer/appIde/project/project-node", () => ({
      getFileTypeEntry: () => undefined
    }));
    vi.doMock("@renderer/controls/ScrollViewer", () => ({
      default: ({
        apiLoaded,
        children
      }: {
        apiLoaded?: (api: unknown) => void;
        children?: ReactNode;
      }) => {
        apiLoaded?.({
          getScrollLeft: () => 0,
          scrollToHorizontal: vi.fn()
        });
        return <div>{children}</div>;
      }
    }));
    vi.doMock("@renderer/appIde/DocumentArea/DocumentTab", () => ({
      CloseMode: { All: 0, Others: 1, This: 2 },
      DocumentTab: ({ name }: { name: string }) => <div>{name}</div>
    }));
    vi.doMock("@controls/TabButton", () => ({
      TabButton: () => null,
      TabButtonSeparator: () => null,
      TabButtonSpace: () => null
    }));

    const { DOCS_WORKSPACE, DocumentsHeader } = await import(
      "@renderer/appIde/DocumentArea/DocumentsHeader"
    );

    render(<DocumentsHeader />);

    await waitFor(() =>
      expect(store.dispatch).toHaveBeenCalledWith(
        {
          type: "SET_WORKSPACE_SETTINGS",
          payload: {
            id: DOCS_WORKSPACE,
            value: {
              documents: [
                {
                  type: "code",
                  id: "/project/src/a.asm",
                  position: { line: 2, column: 4 }
                },
                {
                  type: "code",
                  id: "/project/src/b.asm",
                  position: { line: 8, column: 1 }
                }
              ],
              activeDocumentId: "/project/src/b.asm"
            }
          }
        },
        "ide"
      )
    );
    expect(saveProject).toHaveBeenCalled();
  });
});

function createDocument(id: string, name: string, editPosition = { line: 0, column: 0 }) {
  return {
    editPosition,
    editVersionCount: 0,
    iconFill: undefined,
    iconName: undefined,
    id,
    isLocked: false,
    isReadOnly: false,
    isTemporary: false,
    name,
    node: {
      fullPath: id,
      name,
      projectPath: id
    },
    path: id,
    savedVersionCount: 0,
    type: "code"
  };
}
