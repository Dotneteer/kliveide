import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RendererProvider from "@renderer/core/RendererProvider";
import { Toolbar } from "@renderer/controls/Toolbar";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@common/state/common-ids";

const appServices = vi.hoisted(() => ({
  projectService: {
    getActiveDocumentHubService: vi.fn()
  },
  ideCommandsService: {
    executeCommand: vi.fn(() => Promise.resolve())
  }
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => appServices
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ setGlobalSettingsValue: vi.fn(() => Promise.resolve()) })
}));

vi.mock("@renderer/controls/ExecutionControls", () => ({
  ExecutionControls: () => null
}));

vi.mock("@renderer/controls/ViewControls", () => ({
  ViewControls: () => null
}));

vi.mock("@renderer/controls/ToolbarSeparator", () => ({
  ToolbarSeparator: () => null
}));

vi.mock("@renderer/controls/IconButton", () => ({
  IconButton: ({ title, selected, clicked }: any) => (
    <button aria-label={title} data-selected={String(!!selected)} onClick={clicked} />
  )
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Toolbar document panels", () => {
  it("reflects Memory and Disassembly visibility in the active hub only", () => {
    const leftHub = createHub([MEMORY_PANEL_ID, DISASSEMBLY_PANEL_ID]);
    const rightHub = createHub([]);
    let activeHub = leftHub;
    const store = createStore();
    appServices.projectService.getActiveDocumentHubService.mockImplementation(() => activeHub);

    renderToolbar(store);

    expect(screen.getByLabelText("Show Memory Panel")).toHaveAttribute("data-selected", "true");
    expect(screen.getByLabelText("Show Disassembly Panel")).toHaveAttribute("data-selected", "true");

    act(() => {
      activeHub = rightHub;
      store.notifyDocumentHubChanged();
    });

    expect(screen.getByLabelText("Show Memory Panel")).toHaveAttribute("data-selected", "false");
    expect(screen.getByLabelText("Show Disassembly Panel")).toHaveAttribute("data-selected", "false");
  });

  it("toggles the panel in the active hub rather than using another hub's visibility", () => {
    const leftHub = createHub([MEMORY_PANEL_ID]);
    const rightHub = createHub([]);
    let activeHub = rightHub;
    const store = createStore();
    appServices.projectService.getActiveDocumentHubService.mockImplementation(() => activeHub);

    renderToolbar(store);
    fireEvent.click(screen.getByLabelText("Show Memory Panel"));

    expect(appServices.ideCommandsService.executeCommand).toHaveBeenCalledWith("show-memory");

    appServices.ideCommandsService.executeCommand.mockClear();
    act(() => {
      activeHub = leftHub;
      store.notifyDocumentHubChanged();
    });
    fireEvent.click(screen.getByLabelText("Show Memory Panel"));

    expect(appServices.ideCommandsService.executeCommand).toHaveBeenCalledWith("hide-memory");
  });
});

function createHub(openDocumentIds: string[]) {
  return {
    isOpen: (documentId: string) => openDocumentIds.includes(documentId)
  };
}

function createStore() {
  let listeners: (() => void)[] = [];
  let version = 0;
  const state = {
    globalSettings: {},
    ideView: {
      documentHubState: { 1: version },
      volatileDocs: {}
    }
  };

  return {
    getState: () => state,
    dispatch: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
    notifyDocumentHubChanged: () => {
      version++;
      state.ideView.documentHubState = { 1: version };
      listeners.forEach((listener) => listener());
    }
  };
}

function renderToolbar(store: ReturnType<typeof createStore>) {
  render(
    <RendererProvider store={store as never} messenger={{} as never} messageSource="ide">
      <Toolbar ide={true} kliveProjectLoaded={true} />
    </RendererProvider>
  );
}
