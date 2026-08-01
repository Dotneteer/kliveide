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

  it("loads each split Disassembly view from its own document hub", () => {
    const leftHub = {
      getDocumentViewState: vi.fn(() => ({ topAddress: 0x6000, currentSegment: 1 }))
    };
    const rightHub = {
      getDocumentViewState: vi.fn(() => ({ topAddress: 0x8000, currentSegment: 4 }))
    };
    const document = { id: "$disassembly" } as never;

    expect(loadDisassemblyPanelViewState(leftHub, document)).toEqual({
      topAddress: 0x6000,
      currentSegment: 1
    });
    expect(loadDisassemblyPanelViewState(rightHub, document)).toEqual({
      topAddress: 0x8000,
      currentSegment: 4
    });
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
    const setDocumentViewState = vi.fn();
    const saveProject = vi.fn(() => Promise.resolve());
    const incProjectFileVersion = vi.fn(() => ({ type: "INC_PROJECT_FILE_VERSION" }));

    const Subject = ({ topAddress }: { topAddress: number }) => {
      useDisassemblyViewStatePersistence({
        autoRefresh: false,
        bankLabel: true,
        cachedRefreshState,
        currentSegment: -1,
        decimalView: true,
        disassOffset: 0x2000,
        documentId: "$disassembly",
        dispatch,
        documentHubService: { setDocumentViewState },
        incProjectFileVersion,
        isFullView: false,
        mainApi: { saveProject },
        ram: false,
        screen: true,
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

    expect(setDocumentViewState).toHaveBeenCalledTimes(1);
    expect(setDocumentViewState).toHaveBeenCalledWith(
      "$disassembly",
      expect.objectContaining({ topAddress: 0x6002 })
    );
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "INC_PROJECT_FILE_VERSION" });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_WORKSPACE_SETTINGS" })
    );
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
    const setDocumentViewState = vi.fn();

    const Subject = ({ topAddress }: { topAddress: number }) => {
      useDisassemblyViewStatePersistence({
        autoRefresh: true,
        bankLabel: true,
        cachedRefreshState,
        currentSegment: 0,
        decimalView: false,
        disassOffset: 0,
        documentId: "$disassembly",
        dispatch: vi.fn(),
        documentHubService: { setDocumentViewState },
        incProjectFileVersion: vi.fn(),
        isFullView: true,
        mainApi: { saveProject: vi.fn() },
        ram: true,
        screen: false,
        topAddress
      });
      return null;
    };

    const { rerender, unmount } = render(<Subject topAddress={0x6000} />);
    rerender(<Subject topAddress={0x6002} />);
    unmount();

    vi.advanceTimersByTime(100);

    expect(setDocumentViewState).not.toHaveBeenCalled();
  });

  it("persists split views to their own hub and document ID", async () => {
    vi.useFakeTimers();
    const leftHub = { setDocumentViewState: vi.fn() };
    const rightHub = { setDocumentViewState: vi.fn() };
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

    const Subject = ({
      documentHubService,
      documentId,
      topAddress
    }: {
      documentHubService: typeof leftHub;
      documentId: string;
      topAddress: number;
    }) => {
      useDisassemblyViewStatePersistence({
        autoRefresh: true,
        bankLabel: true,
        cachedRefreshState,
        currentSegment: 0,
        decimalView: false,
        disassOffset: 0,
        documentId,
        dispatch: vi.fn(),
        documentHubService,
        incProjectFileVersion: vi.fn(),
        isFullView: true,
        mainApi: { saveProject: vi.fn() },
        ram: true,
        screen: false,
        topAddress
      });
      return null;
    };

    const { rerender } = render(
      <>
        <Subject documentHubService={leftHub} documentId="$disassembly" topAddress={0} />
        <Subject documentHubService={rightHub} documentId="$disassembly" topAddress={0} />
      </>
    );
    rerender(
      <>
        <Subject documentHubService={leftHub} documentId="$disassembly" topAddress={0x6000} />
        <Subject documentHubService={rightHub} documentId="$disassembly" topAddress={0x8000} />
      </>
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(leftHub.setDocumentViewState).toHaveBeenCalledWith(
      "$disassembly",
      expect.objectContaining({ topAddress: 0x6000 })
    );
    expect(rightHub.setDocumentViewState).toHaveBeenCalledWith(
      "$disassembly",
      expect.objectContaining({ topAddress: 0x8000 })
    );
  });
});
