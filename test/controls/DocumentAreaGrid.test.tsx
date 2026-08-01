import { act, cleanup, render, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { type DocumentAreaLayout } from "@renderer/features/documents/documentAreaLayout";
import { type DocumentAreaGridApi } from "@renderer/features/documents/DocumentAreaGrid";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("DocumentAreaGrid", () => {
  it("renders one area with the active hub by default", async () => {
    const activeHub = createDocumentHub(1);
    const projectService = createProjectService(activeHub);

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");

    const { getByText } = render(<DocumentAreaGrid />);

    expect(getByText("hub-1")).toBeTruthy();
  });

  it("renders a supplied horizontal split layout with independent hubs", async () => {
    const firstHub = createDocumentHub(1);
    const secondHub = createDocumentHub(2);
    const projectService = createProjectService(firstHub, [], [secondHub]);
    const layout: DocumentAreaLayout = {
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
    };

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");

    const { getByTestId, getByText } = render(
      <DocumentAreaGrid
        initialLayout={layout}
        initialHubs={{
          left: firstHub,
          right: secondHub
        }}
      />
    );

    expect(getByTestId("split-panel").dataset.primaryLocation).toBe("left");
    expect(getByTestId("split-panel").dataset.showSplitterBorder).toBe("true");
    expect(getByText("hub-1")).toBeTruthy();
    expect(getByText("hub-2")).toBeTruthy();
  });

  it("renders a supplied vertical split layout as a top split", async () => {
    const firstHub = createDocumentHub(1);
    const secondHub = createDocumentHub(2);
    const projectService = createProjectService(firstHub, [], [secondHub]);
    const layout: DocumentAreaLayout = {
      type: "split",
      direction: "vertical",
      first: {
        type: "leaf",
        areaId: "top"
      },
      second: {
        type: "leaf",
        areaId: "bottom"
      }
    };

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");

    const { getByTestId } = render(
      <DocumentAreaGrid
        initialLayout={layout}
        initialHubs={{
          top: firstHub,
          bottom: secondHub
        }}
      />
    );

    expect(getByTestId("split-panel").dataset.primaryLocation).toBe("top");
    expect(getByTestId("split-panel").dataset.showSplitterBorder).toBe("true");
  });

  it("splits the active area and opens the active document in the new hub", async () => {
    const document = createDocument("doc-a");
    const activeHub = createDocumentHub(1, [document]);
    const newHub = createDocumentHub(2);
    const projectService = createProjectService(activeHub, [newHub]);
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { getByTestId, getByText } = render(
      <DocumentAreaGrid apiLoaded={(loadedApi) => { api = loadedApi; }} />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.splitActiveArea("horizontal");
    });

    expect(projectService.createDocumentHubService).toHaveBeenCalledTimes(1);
    expect(newHub.openDocument).toHaveBeenCalledWith(document, { line: 7 }, false);
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(newHub);
    expect(getByTestId("split-panel").dataset.primaryLocation).toBe("left");
    expect(getByText("hub-1")).toBeTruthy();
    expect(getByText("hub-2")).toBeTruthy();
  });

  it("allows splitting an empty active area", async () => {
    const activeHub = createDocumentHub(1);
    const newHub = createDocumentHub(2);
    const projectService = createProjectService(activeHub, [newHub]);
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { getByTestId, getByText } = render(
      <DocumentAreaGrid apiLoaded={(loadedApi) => { api = loadedApi; }} />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.splitActiveArea("vertical");
    });

    expect(newHub.openDocument).not.toHaveBeenCalled();
    expect(getByTestId("split-panel").dataset.primaryLocation).toBe("top");
    expect(getByText("hub-1")).toBeTruthy();
    expect(getByText("hub-2")).toBeTruthy();
  });

  it("preserves a resized area size when it is split again", async () => {
    const firstHub = createDocumentHub(1, [createDocument("doc-a")]);
    const secondHub = createDocumentHub(2, [createDocument("doc-b")]);
    const thirdHub = createDocumentHub(3);
    const projectService = createProjectService(firstHub, [thirdHub], [secondHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { getAllByTestId, getByTestId } = render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: firstHub,
          right: secondHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      getByTestId("resize-split-panel").click();
    });
    await act(async () => {
      await api!.splitActiveArea("horizontal");
    });

    const splitPanels = getAllByTestId("split-panel");
    expect(splitPanels[0].dataset.initialPrimarySize).toBe("80%");
    expect(splitPanels[1].dataset.initialPrimarySize).toBe("50%");
  });

  it("moves the active document to the next area and removes the empty source area", async () => {
    const document = createDocument("doc-a");
    const sourceHub = createDocumentHub(1, [document]);
    const targetHub = createDocumentHub(2);
    const projectService = createProjectService(sourceHub, [], [targetHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { queryByText } = render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: sourceHub,
          right: targetHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.moveActiveDocumentToNextArea();
    });

    expect(targetHub.openDocument).toHaveBeenCalledWith(document, { line: 7 }, false);
    expect(sourceHub.detachDocument).toHaveBeenCalledWith(document.id);
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(targetHub);
    expect(queryByText("hub-1")).toBeNull();
    expect(queryByText("hub-2")).toBeTruthy();
  });

  it("moves the active document to the previous area", async () => {
    const document = createDocument("doc-a");
    const targetHub = createDocumentHub(1);
    const sourceHub = createDocumentHub(2, [document]);
    const projectService = createProjectService(sourceHub, [], [targetHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: targetHub,
          right: sourceHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.moveActiveDocumentToPreviousArea();
    });

    expect(targetHub.openDocument).toHaveBeenCalledWith(document, { line: 7 }, false);
    expect(sourceHub.detachDocument).toHaveBeenCalledWith(document.id);
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(targetHub);
  });

  it("moves a document to another area before the target tab", async () => {
    const sourceDocument = createDocument("doc-a");
    const targetDocument = createDocument("doc-b");
    const sourceHub = createDocumentHub(1, [sourceDocument]);
    const targetHub = createDocumentHub(2, [targetDocument]);
    const projectService = createProjectService(sourceHub, [], [targetHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: sourceHub,
          right: targetHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.moveDocumentToArea("left", "right", "doc-a", "doc-b", false);
    });

    expect(targetHub.openDocument).toHaveBeenCalledWith(sourceDocument, { line: 7 }, false);
    expect(targetHub.moveDocument).toHaveBeenCalledWith("doc-a", "doc-b", false);
    expect(sourceHub.detachDocument).toHaveBeenCalledWith("doc-a");
    expect(targetHub.getOpenDocuments().map((doc) => doc.id)).toEqual(["doc-a", "doc-b"]);
  });

  it("moves a document to the rightmost position in another area", async () => {
    const sourceDocument = createDocument("doc-a");
    const firstTargetDocument = createDocument("doc-b");
    const rightmostTargetDocument = createDocument("doc-c");
    const sourceHub = createDocumentHub(1, [sourceDocument]);
    const targetHub = createDocumentHub(2, [firstTargetDocument, rightmostTargetDocument]);
    const projectService = createProjectService(sourceHub, [], [targetHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: sourceHub,
          right: targetHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.moveDocumentToArea("left", "right", "doc-a", "doc-c", true);
    });

    expect(targetHub.moveDocument).toHaveBeenCalledWith("doc-a", "doc-c", true);
    expect(targetHub.getOpenDocuments().map((doc) => doc.id)).toEqual([
      "doc-b",
      "doc-c",
      "doc-a"
    ]);
  });

  it("closes the active area and activates a remaining area", async () => {
    const leftHub = createDocumentHub(1, [createDocument("doc-a")]);
    const rightHub = createDocumentHub(2, [createDocument("doc-b")]);
    const projectService = createProjectService(rightHub, [], [leftHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { queryByText } = render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: leftHub,
          right: rightHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.closeActiveArea();
    });

    expect(rightHub.closeAllDocuments).toHaveBeenCalledTimes(1);
    expect(queryByText("hub-2")).toBeNull();
    expect(queryByText("hub-1")).toBeTruthy();
    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(leftHub);
  });

  it("closes other areas and keeps the active area", async () => {
    const leftHub = createDocumentHub(1, [createDocument("doc-a")]);
    const rightHub = createDocumentHub(2, [createDocument("doc-b")]);
    const projectService = createProjectService(leftHub, [], [rightHub]);
    const layout: DocumentAreaLayout = {
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
    };
    let api: DocumentAreaGridApi | undefined;

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { queryByTestId, queryByText } = render(
      <DocumentAreaGrid
        apiLoaded={(loadedApi) => { api = loadedApi; }}
        initialLayout={layout}
        initialHubs={{
          left: leftHub,
          right: rightHub
        }}
      />
    );

    await waitFor(() => expect(api).toBeDefined());
    await act(async () => {
      await api!.closeOtherAreas();
    });

    expect(rightHub.closeAllDocuments).toHaveBeenCalledTimes(1);
    expect(leftHub.closeAllDocuments).not.toHaveBeenCalled();
    expect(queryByTestId("split-panel")).toBeNull();
    expect(queryByText("hub-1")).toBeTruthy();
    expect(queryByText("hub-2")).toBeNull();
  });

  it("removes the right area when its hub has been closed", async () => {
    const leftHub = createDocumentHub(1, [createDocument("doc-a")]);
    const rightHub = createDocumentHub(2, [createDocument("doc-b")]);
    const projectService = createProjectService(leftHub);
    const layout: DocumentAreaLayout = {
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
    };

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { queryByTestId, queryByText } = render(
      <DocumentAreaGrid
        initialLayout={layout}
        initialHubs={{
          left: leftHub,
          right: rightHub
        }}
      />
    );

    await waitFor(() => expect(queryByText("hub-2")).toBeNull());
    expect(queryByTestId("split-panel")).toBeNull();
    expect(queryByText("hub-1")).toBeTruthy();
  });

  it("removes the left area when its hub has been closed", async () => {
    const leftHub = createDocumentHub(1, [createDocument("doc-a")]);
    const rightHub = createDocumentHub(2, [createDocument("doc-b")]);
    const projectService = createProjectService(rightHub);
    const layout: DocumentAreaLayout = {
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
    };

    mockDocumentAreaGridDependencies(projectService);

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { queryByTestId, queryByText } = render(
      <DocumentAreaGrid
        initialLayout={layout}
        initialHubs={{
          left: leftHub,
          right: rightHub
        }}
      />
    );

    await waitFor(() => expect(queryByText("hub-1")).toBeNull());
    expect(queryByTestId("split-panel")).toBeNull();
    expect(queryByText("hub-2")).toBeTruthy();
  });

  it("restores a saved multi-area layout from workspace settings", async () => {
    const firstHub = createDocumentHub(1, [createDocument("doc-a")]);
    const secondHub = createDocumentHub(2, [createDocument("doc-b")]);
    const projectService = createProjectService(firstHub, [], [secondHub]);
    const layout: DocumentAreaLayout = {
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
    };

    mockDocumentAreaGridDependencies(projectService, {
      state: {
        ideView: { documentHubState: {} },
        project: {
          folderPath: "/project",
          workspaceLoaded: true
        },
        workspaceSettings: {
          docsWorkspace: {
            version: 2,
            layout,
            activeAreaId: "right",
            areas: [
              {
                areaId: "left",
                documents: []
              },
              {
                areaId: "right",
                documents: []
              }
            ]
          }
        }
      }
    });

    const { DocumentAreaGrid } = await import("@renderer/features/documents/DocumentAreaGrid");
    const { getByTestId, getByText } = render(<DocumentAreaGrid />);

    await waitFor(() => expect(getByTestId("split-panel")).toBeTruthy());
    expect(getByTestId("split-panel").dataset.primaryLocation).toBe("left");
    expect(getByText("hub-1")).toBeTruthy();
    expect(getByText("hub-2")).toBeTruthy();
  });
});

function mockDocumentAreaGridDependencies(
  projectService: ReturnType<typeof createProjectService>,
  options: {
    state?: Record<string, unknown>;
  } = {}
) {
  const state = options.state ?? {
    ideView: { documentHubState: {} },
    project: {
      folderPath: "/project",
      workspaceLoaded: false
    },
    workspaceSettings: {}
  };
  const store = {
    dispatch: vi.fn(),
    getState: vi.fn(() => state)
  };
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useRendererContext: () => ({ store }),
    useSelector: (selector: (state: unknown) => unknown) =>
      selector(state)
  }));
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ saveProject: vi.fn(() => Promise.resolve()) })
  }));
  vi.doMock("@renderer/features/documents/DocumentAreaPane", () => ({
    DocumentAreaPane: ({
      hub,
      onActivated
    }: {
      hub: IDocumentHubService;
      onActivated?: () => void;
    }) => (
      <button data-testid="document-area-pane" onClick={onActivated}>
        hub-{hub.hubId}
      </button>
    )
  }));
  vi.doMock("@renderer/controls/SplitPanel", () => ({
    SplitPanel: ({
      children,
      initialPrimarySize,
      onPrimarySizeRatioUpdateCompleted,
      primaryLocation,
      showSplitterBorder
    }: {
      children?: ReactNode;
      initialPrimarySize?: number | string;
      onPrimarySizeRatioUpdateCompleted?: (ratio: number) => void;
      primaryLocation?: string;
      showSplitterBorder?: boolean;
    }) => (
      <div
        data-testid="split-panel"
        data-initial-primary-size={initialPrimarySize}
        data-primary-location={primaryLocation}
        data-show-splitter-border={String(!!showSplitterBorder)}
      >
        <button
          data-testid="resize-split-panel"
          onClick={() => onPrimarySizeRatioUpdateCompleted?.(0.8)}
        />
        {children}
      </div>
    )
  }));
}

function createProjectService(
  activeHub?: IDocumentHubService,
  createdHubs: IDocumentHubService[] = [],
  registeredHubs: IDocumentHubService[] = []
) {
  const documentHubServices = [activeHub, ...registeredHubs].filter(Boolean);
  return {
    createDocumentHubService: vi.fn(() => {
      const hub = createdHubs.shift();
      if (hub) {
        documentHubServices.push(hub);
      }
      return hub;
    }),
    getActiveDocumentHubService: vi.fn(() => activeHub),
    getDocumentHubServiceInstances: vi.fn(() => documentHubServices),
    setActiveDocumentHubService: vi.fn()
  };
}

function createDocumentHub(
  hubId: number,
  initialDocuments: ProjectDocumentState[] = []
): IDocumentHubService {
  let documents = [...initialDocuments];
  const hub = {
    detachDocument: vi.fn((id: string) => {
      const document = documents.find((doc) => doc.id === id);
      documents = documents.filter((doc) => doc.id !== id);
      return document;
    }),
    getActiveDocument: vi.fn(() => documents[0]),
    getDocument: vi.fn((id: string) => documents.find((doc) => doc.id === id)),
    getDocumentViewState: vi.fn(() => ({ line: 7 })),
    getOpenDocuments: vi.fn(() => documents),
    hubId,
    closeAllDocuments: vi.fn(() => {
      documents = [];
      return Promise.resolve();
    }),
    moveDocument: vi.fn((sourceId: string, targetId: string, after = false) => {
      const sourceIndex = documents.findIndex((doc) => doc.id === sourceId);
      const targetIndex = documents.findIndex((doc) => doc.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

      let insertIndex = targetIndex;
      if (sourceIndex < targetIndex) {
        insertIndex--;
      }
      if (after) {
        insertIndex++;
      }
      const [document] = documents.splice(sourceIndex, 1);
      documents.splice(insertIndex, 0, document);
    }),
    openDocument: vi.fn((document: ProjectDocumentState) => {
      if (!documents.includes(document)) {
        documents.push(document);
      }
      return Promise.resolve();
    }),
    openDocumentTab: vi.fn((document: ProjectDocumentState) => {
      if (!documents.includes(document)) {
        documents.push(document);
      }
      return Promise.resolve();
    }),
    setActiveDocument: vi.fn(() => Promise.resolve())
  };
  return hub as unknown as IDocumentHubService;
}

function createDocument(id: string): ProjectDocumentState {
  return {
    editVersionCount: 0,
    id,
    isTemporary: false,
    name: id,
    savedVersionCount: 0,
    type: "code"
  };
}
