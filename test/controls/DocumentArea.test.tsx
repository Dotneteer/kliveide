import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { DocumentApi } from "@renderer/abstractions/DocumentApi";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("DocumentAreaPane", () => {
  it("renders and registers document APIs against the explicit hub", async () => {
    const document = createDocument();
    const setPosition = vi.fn();
    const hub = createDocumentHub(1, document);
    const projectService = createProjectService(hub);

    mockDocumentAreaDependencies(projectService, {
      api: { beforeDocumentDisposal: vi.fn(), setPosition }
    });

    const { DocumentAreaPane } = await import("@renderer/features/documents/DocumentArea");

    render(<DocumentAreaPane hub={hub} />);

    await waitFor(() => expect(hub.setDocumentApi).toHaveBeenCalledWith(document.id, expect.any(Object)));
    expect(hub.getDocumentViewState).toHaveBeenCalledWith(document.id);
    expect(setPosition).toHaveBeenCalledWith(12, 3);
  });

  it("activates the explicit hub on pane interaction", async () => {
    const activeHub = createDocumentHub(1);
    const paneHub = createDocumentHub(2, createDocument());
    const projectService = createProjectService(activeHub);

    mockDocumentAreaDependencies(projectService);

    const { DocumentAreaPane } = await import("@renderer/features/documents/DocumentArea");
    const { getByTestId } = render(<DocumentAreaPane hub={paneHub} />);

    fireEvent.pointerDown(getByTestId("document-area-header"));

    expect(projectService.setActiveDocumentHubService).toHaveBeenCalledWith(paneHub);
  });
});

function mockDocumentAreaDependencies(
  projectService: ReturnType<typeof createProjectService>,
  options: { api?: DocumentApi } = {}
) {
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (state: unknown) => unknown) => selector(createRendererState())
  }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/features/documents/DocumentsHeader", () => ({
    DocumentsHeader: () => <div data-testid="document-area-header">Header</div>
  }));
  vi.doMock("@renderer/features/documents/DocumentsContainer", () => ({
    DocumentsContainer: ({
      apiLoaded,
      document
    }: {
      apiLoaded?: (api: DocumentApi) => void;
      document?: ProjectDocumentState;
    }) => {
      useEffect(() => {
        apiLoaded?.(options.api ?? { beforeDocumentDisposal: vi.fn() });
      }, [apiLoaded]);
      return <div data-testid="document-area-container">{document?.id}</div>;
    }
  }));
}

function createRendererState() {
  return {
    project: {
      projectViewStateVersion: 1
    },
    ideView: {
      documentHubState: {}
    }
  };
}

function createProjectService(activeHub: IDocumentHubService) {
  return {
    getActiveDocumentHubService: vi.fn(() => activeHub),
    getLockedFiles: vi.fn(() => []),
    setActiveDocumentHubService: vi.fn()
  };
}

function createDocumentHub(
  hubId: number,
  document?: ProjectDocumentState
): IDocumentHubService {
  return {
    hubId,
    getActiveDocument: vi.fn(() => document),
    getDocumentViewState: vi.fn(() => ({ cursor: "state" })),
    setDocumentApi: vi.fn()
  } as unknown as IDocumentHubService;
}

function createDocument(): ProjectDocumentState {
  return {
    editPosition: {
      column: 3,
      line: 12
    },
    editVersionCount: 0,
    id: "/project/src/main.asm",
    name: "main.asm",
    savedVersionCount: 0,
    type: "code"
  };
}
