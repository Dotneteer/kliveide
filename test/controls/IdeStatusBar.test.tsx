import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_EDITOR, TEXT_EDITOR } from "@common/state/common-ids";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("IdeStatusBar", () => {
  it("uses the active document from the active document hub", async () => {
    const projectService = {
      getActiveDocumentHubService: vi.fn(() => ({
        getActiveDocument: () => ({ type: CODE_EDITOR })
      }))
    };

    mockIdeStatusBarDependencies(projectService);

    const { IdeStatusBar } = await import("@renderer/appIde/StatusBar/IdeStatusBar");

    render(<IdeStatusBar show={true} />);

    expect(projectService.getActiveDocumentHubService).toHaveBeenCalled();
    expect(screen.getByText("Ln")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Col")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides cursor coordinates when the active hub document is not a code editor", async () => {
    const projectService = {
      getActiveDocumentHubService: vi.fn(() => ({
        getActiveDocument: () => ({ type: TEXT_EDITOR })
      }))
    };

    mockIdeStatusBarDependencies(projectService);

    const { IdeStatusBar } = await import("@renderer/appIde/StatusBar/IdeStatusBar");

    render(<IdeStatusBar show={true} />);

    expect(screen.queryByText("Ln")).toBeNull();
    expect(screen.queryByText("Col")).toBeNull();
  });
});

function mockIdeStatusBarDependencies(projectService: unknown) {
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (state: unknown) => unknown) =>
      selector({
        compilation: {},
        emulatorState: {},
        ideView: {
          cursorColumn: 3,
          cursorLine: 12,
          documentHubState: { 1: 1 }
        },
        project: {
          isKliveProject: false
        }
      })
  }));
  vi.doMock("@controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span>{iconName}</span>
  }));
  vi.doMock("@controls/SpaceFiller", () => ({
    SpaceFiller: () => null
  }));
}
