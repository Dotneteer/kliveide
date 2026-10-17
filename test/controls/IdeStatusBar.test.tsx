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

  it("names the compiler of a focused BASIC file, and opens the Boriel BASIC dialog on a click", async () => {
    const runUiAction = vi.fn();
    const projectService = {
      getActiveDocumentHubService: () => ({
        getActiveDocument: () => ({ type: CODE_EDITOR, language: "zxbas", id: "code/program.zxbas" })
      })
    };
    mockIdeStatusBarDependencies(
      projectService,
      { userSettings: { zxbasic: { compiler: "klive" } }, projectSettings: { zxbasic: { compiler: "boriel" } } },
      runUiAction
    );
    const { IdeStatusBar } = await import("@renderer/appIde/StatusBar/IdeStatusBar");
    render(<IdeStatusBar show={true} />);

    // --- The project's choice wins over the user's
    const item = screen.getByRole("button", { name: "Boriel BASIC" });
    item.click();
    expect(runUiAction).toHaveBeenCalledWith("dialog:boriel");
  });

  it("shows no compiler for a file that is not BASIC", async () => {
    const projectService = {
      getActiveDocumentHubService: () => ({
        getActiveDocument: () => ({ type: CODE_EDITOR, language: "kz80-asm", id: "code/main.kz80.asm" })
      })
    };
    mockIdeStatusBarDependencies(projectService);
    const { IdeStatusBar } = await import("@renderer/appIde/StatusBar/IdeStatusBar");
    render(<IdeStatusBar show={true} />);
    expect(screen.queryByText("Klive BASIC")).toBeNull();
    expect(screen.queryByText("Boriel BASIC")).toBeNull();
  });
});

function mockIdeStatusBarDependencies(projectService: unknown, extraState: Record<string, unknown> = {}, runUiAction = vi.fn()) {
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ runUiAction })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (state: unknown) => unknown) =>
      selector({
        ...extraState,
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
