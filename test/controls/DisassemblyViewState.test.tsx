import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDisassemblyPanelViewState,
  type CachedRefreshState,
  loadDisassemblyPanelViewState,
  useDisassemblyViewStatePersistence
} from "@renderer/appIde/DocumentPanels/disassemblyViewState";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("disassembly view-state handling", () => {
  it("loads view state from the document prop", () => {
    const documentHubService = {
      getDocumentViewState: vi.fn((id: string) => ({ topAddress: id === "disass-doc" ? 0x6000 : 0 }))
    };

    expect(
      loadDisassemblyPanelViewState(documentHubService, { id: "disass-doc" } as never)
    ).toEqual({ topAddress: 0x6000 });
  });

  it("builds the persisted disassembly view-state payload", () => {
    expect(
      buildDisassemblyPanelViewState({
        autoRefresh: false,
        bankLabel: true,
        currentSegment: -1,
        decimalView: true,
        disassOffset: 0x2000,
        isFullView: false,
        ram: true,
        screen: false,
        topAddress: 0x6002
      })
    ).toEqual({
      autoRefresh: false,
      bankLabel: true,
      currentSegment: -1,
      decimalView: true,
      disassOffset: 0x2000,
      isFullView: false,
      ram: true,
      screen: false,
      topAddress: 0x6002
    });
  });

  it("debounces persistence and keeps the cached refresh state current", async () => {
    vi.useFakeTimers();
    const cachedRefreshState = {
      current: {
        autoRefresh: true,
        currentSegment: 0,
        decimalView: false,
        isFullView: true,
        ram: true,
        screen: false
      }
    } satisfies { current: CachedRefreshState };
    const dispatch = vi.fn();
    const saveActiveDocumentState = vi.fn();
    const saveProject = vi.fn(() => Promise.resolve());
    const setWorkspaceSettings = vi.fn((_id: string, value: unknown) => ({
      type: "SET_WORKSPACE_SETTINGS",
      value
    }));
    const incProjectFileVersion = vi.fn(() => ({ type: "INC_PROJECT_FILE_VERSION" }));

    const Subject = ({ topAddress }: { topAddress: number }) => {
      useDisassemblyViewStatePersistence({
        autoRefresh: false,
        bankLabel: true,
        cachedRefreshState,
        currentSegment: -1,
        decimalView: true,
        disassOffset: 0x2000,
        dispatch,
        documentHubService: { saveActiveDocumentState },
        incProjectFileVersion,
        isFullView: false,
        mainApi: { saveProject },
        ram: false,
        screen: true,
        setWorkspaceSettings,
        topAddress
      });
      return null;
    };

    const { rerender } = render(<Subject topAddress={0x6000} />);
    rerender(<Subject topAddress={0x6001} />);
    rerender(<Subject topAddress={0x6002} />);

    expect(cachedRefreshState.current).toEqual({
      autoRefresh: false,
      currentSegment: -1,
      decimalView: true,
      isFullView: false,
      ram: false,
      screen: true
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(saveActiveDocumentState).toHaveBeenCalledTimes(1);
    expect(saveActiveDocumentState).toHaveBeenCalledWith(
      expect.objectContaining({ topAddress: 0x6002 })
    );
    expect(setWorkspaceSettings).toHaveBeenCalledTimes(1);
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_WORKSPACE_SETTINGS" })
    );
    expect(dispatch).toHaveBeenCalledWith({ type: "INC_PROJECT_FILE_VERSION" });
  });

  it("cancels delayed saves on unmount", () => {
    vi.useFakeTimers();
    const cachedRefreshState = {
      current: {
        autoRefresh: true,
        currentSegment: 0,
        decimalView: false,
        isFullView: true,
        ram: true,
        screen: false
      }
    } satisfies { current: CachedRefreshState };
    const saveActiveDocumentState = vi.fn();

    const Subject = ({ topAddress }: { topAddress: number }) => {
      useDisassemblyViewStatePersistence({
        autoRefresh: true,
        bankLabel: true,
        cachedRefreshState,
        currentSegment: 0,
        decimalView: false,
        disassOffset: 0,
        dispatch: vi.fn(),
        documentHubService: { saveActiveDocumentState },
        incProjectFileVersion: vi.fn(),
        isFullView: true,
        mainApi: { saveProject: vi.fn() },
        ram: true,
        screen: false,
        setWorkspaceSettings: vi.fn(),
        topAddress
      });
      return null;
    };

    const { rerender, unmount } = render(<Subject topAddress={0x6000} />);
    rerender(<Subject topAddress={0x6002} />);
    unmount();

    vi.advanceTimersByTime(100);

    expect(saveActiveDocumentState).not.toHaveBeenCalled();
  });
});
