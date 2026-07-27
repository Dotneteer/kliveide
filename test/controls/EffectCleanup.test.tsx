import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});

const rendererState = {
  project: {
    buildRoots: [],
    projectFileVersion: 1
  },
  emulatorState: {
    isProjectDebugging: false
  },
  ideView: {
    editorVersion: 1
  },
  globalSettings: {},
  dimMenu: false,
  isWindows: false
};

const rendererStore = {
  getState: vi.fn(() => rendererState),
  dispatch: vi.fn()
};

function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

function mockRendererProvider(dispatch = vi.fn()) {
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => dispatch,
    useGlobalSetting: () => false,
    useRendererContext: () => ({
      store: rendererStore,
      messenger: {}
    }),
    useSelector: (selector: (state: typeof rendererState) => unknown) =>
      selector(rendererState)
  }));
}

describe("effect cleanup fixes", () => {
  it("unsubscribes DocumentsHeader from projectClosed on unmount", async () => {
    const projectClosed = {
      on: vi.fn(),
      off: vi.fn()
    };
    const documentHubService = createDocumentHubServiceMock();

    mockRendererProvider();
    mockDocumentsHeaderDependencies(projectClosed, documentHubService);

    const { DocumentsHeader } = await import(
      "@renderer/features/documents/DocumentsHeader"
    );

    const { unmount } = render(<DocumentsHeader />);

    expect(projectClosed.on).toHaveBeenCalledTimes(1);

    unmount();

    expect(projectClosed.off).toHaveBeenCalledTimes(1);
    expect(projectClosed.off).toHaveBeenCalledWith(projectClosed.on.mock.calls[0][0]);
  });

  it("clears awaiting state after tab activation and close operations settle", async () => {
    const activate = deferred();
    const close = deferred();
    const documentHubService = createDocumentHubServiceMock({
      setActiveDocument: vi.fn(() => activate.promise),
      closeDocument: vi.fn(() => close.promise)
    });

    mockRendererProvider();
    mockDocumentsHeaderDependencies({ on: vi.fn(), off: vi.fn() }, documentHubService);

    const { DocumentsHeader } = await import(
      "@renderer/features/documents/DocumentsHeader"
    );

    render(<DocumentsHeader />);

    fireEvent.click(screen.getByText("Doc B"));
    await waitFor(() =>
      expect(screen.getByTestId("tab-doc-a")).toHaveAttribute("data-awaiting", "true")
    );

    await act(async () => {
      activate.resolve();
      await activate.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("tab-doc-a")).toHaveAttribute("data-awaiting", "false")
    );

    fireEvent.click(screen.getByTestId("close-doc-a"));
    await waitFor(() =>
      expect(screen.getByTestId("tab-doc-a")).toHaveAttribute("data-awaiting", "true")
    );

    await act(async () => {
      close.resolve();
      await close.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("tab-doc-a")).toHaveAttribute("data-awaiting", "false")
    );
  });

  it("creates one AudioContext and closes the same instance after reading sample rate", async () => {
    const dispatch = vi.fn();
    const close = vi.fn(() => Promise.resolve());
    const AudioContextMock = vi.fn(function AudioContext(this: { sampleRate: number; close: typeof close }) {
      this.sampleRate = 48_000;
      this.close = close;
    });

    vi.stubGlobal("AudioContext", AudioContextMock);
    (window as any).electron = {
      ipcRenderer: {
        on: vi.fn(),
        send: vi.fn()
      }
    };

    mockRendererProvider(dispatch);
    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({ machineService: {} })
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({})
    }));
    vi.doMock("@controls/BackDrop", () => ({
      BackDrop: () => null
    }));
    vi.doMock("@controls/Toolbar", () => ({
      Toolbar: () => null
    }));
    vi.doMock("@renderer/features/emulator/EmulatorArea", () => ({
      EmulatorArea: () => <div data-testid="emulator-area" />
    }));
    vi.doMock("@renderer/appEmu/StatusBar/EmuStatusBar", () => ({
      EmuStatusBar: () => null
    }));
    vi.doMock("@renderer/appEmu/recording/RecordingManager", () => ({
      RecordingManager: vi.fn()
    }));
    vi.doMock("@renderer/appEmu/MainToEmuProcessor", () => ({
      processMainToEmuMessages: vi.fn(),
      setEmuRecordingManager: vi.fn()
    }));
    vi.doMock("@renderer/os-utils", () => ({
      setIsWindows: vi.fn()
    }));

    const { default: EmuApp } = await import("@renderer/appEmu/EmuApp");
    const { DialogProvider } = await import("@renderer/controls/overlay/DialogProvider");

    render(
      <DialogProvider>
        <EmuApp />
      </DialogProvider>
    );

    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({
      type: "SET_AUDIO_SAMPLE_RATE",
      payload: { numValue: 48_000 }
    });
  });
});

function createDocumentHubServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    hubId: 1,
    getOpenDocuments: vi.fn(() => [
      createDocument("doc-a", "Doc A"),
      createDocument("doc-b", "Doc B")
    ]),
    getActiveDocumentIndex: vi.fn(() => 0),
    getOpenProjectFileDocument: vi.fn(() => Promise.resolve(undefined)),
    closeAllExplorerDocuments: vi.fn(),
    setActiveDocument: vi.fn(() => Promise.resolve()),
    setPermanent: vi.fn(),
    closeAllDocuments: vi.fn(() => Promise.resolve()),
    closeDocument: vi.fn(() => Promise.resolve()),
    moveActiveToLeft: vi.fn(),
    moveActiveToRight: vi.fn(),
    ...overrides
  };
}

function createDocument(id: string, name: string) {
  return {
    id,
    name,
    path: name,
    type: "code",
    editVersionCount: 0,
    savedVersionCount: 0,
    node: {
      name,
      projectPath: id,
      fullPath: id
    }
  };
}

function mockDocumentsHeaderDependencies(
  projectClosed: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> },
  documentHubService: ReturnType<typeof createDocumentHubServiceMock>
) {
  const appServices = {
    projectService: {
      projectClosed
    },
    outputPaneService: {
      getOutputPaneBuffer: vi.fn()
    },
    ideCommandsService: {
      executeCommand: vi.fn()
    }
  };

  vi.doMock("@appIde/services/AppServicesProvider", () => ({
    useAppServices: () => appServices
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => documentHubService,
    useDocumentHubServiceVersion: () => 1
  }));
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({
      saveProject: vi.fn(() => Promise.resolve())
    })
  }));
  vi.doMock("@renderer/appIde/project/project-node", () => ({
    getFileTypeEntry: () => undefined
  }));
  vi.doMock("@renderer/controls/ScrollViewer", () => ({
    default: ({ children, apiLoaded }: { children?: React.ReactNode; apiLoaded?: (api: unknown) => void }) => {
      apiLoaded?.({
        getScrollLeft: () => 0,
        scrollToHorizontal: vi.fn()
      });
      return <div>{children}</div>;
    }
  }));
  vi.doMock("@renderer/features/documents/DocumentTab", () => {
    enum CloseMode {
      All,
      Others,
      This
    }
    return {
      CloseMode,
      DocumentTab: ({
        name,
        awaiting,
        tabClicked,
        tabCloseClicked
      }: {
        name: string;
        awaiting?: boolean;
        tabClicked?: () => void;
        tabCloseClicked?: (mode: CloseMode) => void;
      }) => {
        const id = name.toLowerCase().replaceAll(" ", "-");
        return (
          <div data-testid={`tab-${id}`} data-awaiting={String(!!awaiting)}>
            <button type="button" onClick={tabClicked}>
              {name}
            </button>
            <button type="button" data-testid={`close-${id}`} onClick={() => tabCloseClicked?.(CloseMode.This)}>
              close
            </button>
          </div>
        );
      }
    };
  });
  vi.doMock("@controls/TabButton", () => ({
    TabButton: () => null,
    TabButtonSeparator: () => null,
    TabButtonSpace: () => null
  }));
}
