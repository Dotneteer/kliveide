import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("app shell startup hooks", () => {
  it("runs IDE startup once and unregisters IPC on unmount", async () => {
    const cleanupIpc = vi.fn();
    const registerMainToIdeIpc = vi.fn(() => cleanupIpc);
    const registerIdeCommands = vi.fn();
    const initializeMonaco = vi.fn();
    const setCachedAppServices = vi.fn();
    const setCachedStore = vi.fn();
    const setIsWindows = vi.fn();
    const dispatch = vi.fn();
    const close = vi.fn(() => Promise.resolve());

    vi.stubGlobal("AudioContext", vi.fn(function AudioContext(this: { sampleRate: number; close: typeof close }) {
      this.sampleRate = 44_100;
      this.close = close;
    }));
    vi.spyOn(window, "postMessage").mockImplementation(() => {});
    vi.doMock("@renderer/appIde/MainToIdeIpc", () => ({ registerMainToIdeIpc }));
    vi.doMock("@renderer/appIde/IdeCommands", () => ({ registerIdeCommands }));
    vi.doMock("@renderer/appIde/DocumentPanels/MonacoEditor", () => ({ initializeMonaco }));
    vi.doMock("@renderer/CachedServices", () => ({ setCachedAppServices, setCachedStore }));
    vi.doMock("@renderer/os-utils", () => ({ setIsWindows }));

    const { useIdeStartup } = await import("@renderer/appIde/useIdeStartup");
    const appServices = createAppServices();
    const store = { getState: vi.fn(() => ({ ideStateSynched: false })) };
    const messenger = {};

    const { rerender, unmount } = renderHook(() =>
      useIdeStartup({
        appPath: "/tmp/app",
        appServices: appServices as any,
        dispatch,
        ideLoaded: false,
        isWindows: true,
        messenger: messenger as any,
        store: store as any
      })
    );

    await waitFor(() => expect(registerMainToIdeIpc).toHaveBeenCalledTimes(1));
    expect(initializeMonaco).toHaveBeenCalledTimes(1);
    expect(setCachedAppServices).toHaveBeenCalledWith(appServices);
    expect(setCachedStore).toHaveBeenCalledWith(store);
    expect(registerIdeCommands).toHaveBeenCalledWith(appServices.ideCommandsService);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_AUDIO_SAMPLE_RATE",
      payload: { numValue: 44_100 }
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "IDE_LOADED" });
    expect(window.postMessage).toHaveBeenCalledWith({ payload: "removeLoading" }, "*");
    expect(setIsWindows).toHaveBeenCalledWith(true);

    rerender();
    expect(registerIdeCommands).toHaveBeenCalledTimes(1);

    unmount();
    expect(cleanupIpc).toHaveBeenCalledTimes(1);
  });

  it("loads the last IDE project after settings are synced", async () => {
    const openFolder = vi.fn(() => Promise.resolve());
    const getAppSettings = vi.fn(() =>
      Promise.resolve({ project: { folderPath: "c:\\workspace\\demo" } })
    );

    vi.stubGlobal("AudioContext", vi.fn(function AudioContext(this: { sampleRate: number; close: () => Promise<void> }) {
      this.sampleRate = 44_100;
      this.close = () => Promise.resolve();
    }));
    vi.spyOn(window, "postMessage").mockImplementation(() => {});
    vi.doMock("@renderer/core/RendererProvider", () => ({
      getGlobalSetting: () => true
    }));
    vi.doMock("@common/messaging/MainApi", () => ({
      createMainApi: () => ({ getAppSettings, openFolder })
    }));
    vi.doMock("@renderer/appIde/MainToIdeIpc", () => ({ registerMainToIdeIpc: vi.fn(() => vi.fn()) }));
    vi.doMock("@renderer/appIde/IdeCommands", () => ({ registerIdeCommands: vi.fn() }));
    vi.doMock("@renderer/appIde/DocumentPanels/MonacoEditor", () => ({ initializeMonaco: vi.fn() }));
    vi.doMock("@renderer/CachedServices", () => ({
      setCachedAppServices: vi.fn(),
      setCachedStore: vi.fn()
    }));
    vi.doMock("@renderer/os-utils", () => ({ setIsWindows: vi.fn() }));

    const { useIdeStartup } = await import("@renderer/appIde/useIdeStartup");
    const store = { getState: vi.fn(() => ({ ideStateSynched: true })) };

    renderHook(() =>
      useIdeStartup({
        appPath: "/tmp/app",
        appServices: createAppServices() as any,
        dispatch: vi.fn(),
        ideLoaded: true,
        isWindows: false,
        messenger: {} as any,
        store: store as any
      })
    );

    await waitFor(() => expect(openFolder).toHaveBeenCalledWith("c:/workspace/demo"));
  });

  it("runs EMU startup once and unregisters IPC on unmount", async () => {
    const cleanupIpc = vi.fn();
    const registerMainToEmuIpc = vi.fn(() => cleanupIpc);
    const dispatch = vi.fn();
    const setCachedAppServices = vi.fn();
    const setCachedMessenger = vi.fn();
    const setCachedStore = vi.fn();
    const setIsWindows = vi.fn();
    const close = vi.fn(() => Promise.resolve());

    vi.stubGlobal("AudioContext", vi.fn(function AudioContext(this: { sampleRate: number; close: typeof close }) {
      this.sampleRate = 48_000;
      this.close = close;
    }));
    vi.spyOn(window, "postMessage").mockImplementation(() => {});
    vi.doMock("@renderer/appEmu/MainToEmuIpc", () => ({ registerMainToEmuIpc }));
    vi.doMock("@renderer/CachedServices", () => ({
      setCachedAppServices,
      setCachedMessenger,
      setCachedStore
    }));
    vi.doMock("@renderer/os-utils", () => ({ setIsWindows }));

    const { useEmuStartup } = await import("@renderer/appEmu/useEmuStartup");
    const appServices = createAppServices();
    const store = {};
    const messenger = {};

    const { rerender, unmount } = renderHook(() =>
      useEmuStartup({
        appServices: appServices as any,
        dispatch,
        isWindows: true,
        messenger: messenger as any,
        store: store as any
      })
    );

    await waitFor(() => expect(registerMainToEmuIpc).toHaveBeenCalledTimes(1));
    expect(setCachedAppServices).toHaveBeenCalledWith(appServices);
    expect(setCachedMessenger).toHaveBeenCalledWith(messenger);
    expect(setCachedStore).toHaveBeenCalledWith(store);
    expect(dispatch).toHaveBeenCalledWith({ type: "EMU_LOADED" });
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_AUDIO_SAMPLE_RATE",
      payload: { numValue: 48_000 }
    });
    expect(window.postMessage).toHaveBeenCalledWith({ payload: "removeLoading" }, "*");
    expect(setIsWindows).toHaveBeenCalledWith(true);

    rerender();
    expect(dispatch.mock.calls.filter(([action]) => action.type === "EMU_LOADED")).toHaveLength(1);

    unmount();
    expect(cleanupIpc).toHaveBeenCalledTimes(1);
  });
});

describe("app shell dialog hosts", () => {
  it("renders IDE dialogs from the registry and dispatches close", async () => {
    vi.doMock("@renderer/appIde/dialogs/NewProjectDialog", () => ({
      NewProjectDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>new project close</button>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/ExportCodeDialog", () => ({
      ExportCodeDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>export close</button>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/ExcludedProjectItemsDialog", () => ({
      ExcludedProjectItemsDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>excluded close</button>
      )
    }));
    vi.doMock("@renderer/appIde/dialogs/FirstStartDialog", () => ({
      FirstStartDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>first close</button>
      )
    }));

    const { NEW_PROJECT_DIALOG } = await import("@messaging/dialog-ids");
    const { IdeDialogHost } = await import("@renderer/appIde/IdeDialogHost");
    const onClose = vi.fn();

    render(<IdeDialogHost dialogId={NEW_PROJECT_DIALOG} onClose={onClose} />);
    fireEvent.click(screen.getByText("new project close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders EMU dialogs from the registry with dialog data", async () => {
    vi.doMock("@renderer/appIde/dialogs/FirstStartDialog", () => ({
      FirstStartDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>first close</button>
      )
    }));
    vi.doMock("@renderer/appEmu/dialogs/Z88RemoveCardDialog", () => ({
      Z88RemoveCardDialog: ({ slot, onClose }: { slot: number; onClose: () => void }) => (
        <button onClick={onClose}>remove {slot}</button>
      )
    }));
    vi.doMock("@renderer/appEmu/dialogs/Z88InsertCardDialog", () => ({
      Z88InsertCardDialog: ({ slot, onClose }: { slot: number; onClose: () => void }) => (
        <button onClick={onClose}>insert {slot}</button>
      )
    }));
    vi.doMock("@renderer/appEmu/dialogs/Z88ExportCardDialog", () => ({
      Z88ExportCardDialog: ({ slot, onClose }: { slot: number; onClose: () => void }) => (
        <button onClick={onClose}>export {slot}</button>
      )
    }));
    vi.doMock("@renderer/appEmu/dialogs/Z88ChangeRamDialog", () => ({
      Z88ChangeRamDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>change ram</button>
      )
    }));
    vi.doMock("@renderer/appEmu/dialogs/CreateDiskDialog", () => ({
      CreateDiskDialog: ({ onClose }: { onClose: () => void }) => (
        <button onClick={onClose}>create disk</button>
      )
    }));

    const { Z88_REMOVE_CARD_DIALOG } = await import("@common/messaging/dialog-ids");
    const { EmuDialogHost } = await import("@renderer/appEmu/EmuDialogHost");
    const onClose = vi.fn();

    render(<EmuDialogHost dialogId={Z88_REMOVE_CARD_DIALOG} dialogData={3} onClose={onClose} />);
    fireEvent.click(screen.getByText("remove 3"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function createAppServices() {
  return {
    ideCommandsService: {
      registerCommand: vi.fn()
    },
    projectService: {
      getActiveDocumentHubService: vi.fn(),
      createDocumentHubService: vi.fn()
    }
  };
}
