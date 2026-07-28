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
});

function mockDocumentAreaGridDependencies(projectService: ReturnType<typeof createProjectService>) {
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (state: unknown) => unknown) =>
      selector({ ideView: { documentHubState: {} } })
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
      primaryLocation
    }: {
      children?: ReactNode;
      primaryLocation?: string;
    }) => (
      <div data-testid="split-panel" data-primary-location={primaryLocation}>
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
    openDocument: vi.fn((document: ProjectDocumentState) => {
      if (!documents.includes(document)) {
        documents.push(document);
      }
      return Promise.resolve();
    })
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
