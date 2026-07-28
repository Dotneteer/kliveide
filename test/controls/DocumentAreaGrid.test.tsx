import { cleanup, render } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { type DocumentAreaLayout } from "@renderer/features/documents/documentAreaLayout";

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
    const projectService = createProjectService(firstHub);
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
    const projectService = createProjectService(firstHub);
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
});

function mockDocumentAreaGridDependencies(projectService: ReturnType<typeof createProjectService>) {
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/features/documents/DocumentAreaPane", () => ({
    DocumentAreaPane: ({ hub }: { hub: IDocumentHubService }) => (
      <div data-testid="document-area-pane">hub-{hub.hubId}</div>
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

function createProjectService(activeHub?: IDocumentHubService) {
  return {
    getActiveDocumentHubService: vi.fn(() => activeHub)
  };
}

function createDocumentHub(hubId: number): IDocumentHubService {
  return {
    hubId
  } as IDocumentHubService;
}
