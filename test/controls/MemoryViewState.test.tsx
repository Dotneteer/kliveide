import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMemoryPanelViewState,
  loadMemoryPanelViewState,
  useMemoryViewStatePersistence
} from "@renderer/features/memory/useMemoryViewState";
import type { CachedRefreshState } from "@renderer/features/memory/memoryViewModel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("memory view-state handling", () => {
  it("loads view state from the document prop before falling back to the active document", () => {
    const documentHubService = {
      getActiveDocument: vi.fn(() => ({ id: "active-doc" })),
      getDocumentViewState: vi.fn((id: string) => ({ topIndex: id === "prop-doc" ? 10 : 20 }))
    };

    expect(loadMemoryPanelViewState(documentHubService, { id: "prop-doc" } as never))
      .toEqual({ topIndex: 10 });
    expect(loadMemoryPanelViewState(documentHubService)).toEqual({ topIndex: 20 });
  });

  it("builds the persisted memory view-state payload", () => {
    expect(buildMemoryPanelViewState({
      bankLabel: true,
      charDump: false,
      currentSegment: -1,
      decimalView: true,
      isFullView: false,
      topIndex: 12,
      viewMode: "16x1"
    })).toEqual({
      bankLabel: true,
      charDump: false,
      currentSegment: -1,
      decimalView: true,
      isFullView: false,
      topIndex: 12,
      viewMode: "16x1"
    });
  });

  it("keeps cached refresh state current even while persistence is suppressed", () => {
    const cachedRefreshState = {
      current: {
        currentSegment: 0,
        decimalView: false,
        isFullView: true
      }
    };

    const Subject = ({ currentSegment }: { currentSegment: number }) => {
      useMemoryViewStatePersistence({
        bankLabel: true,
        cachedRefreshState,
        charDump: true,
        currentSegment,
        decimalView: true,
        dispatch: vi.fn(),
        documentHubService: { saveActiveDocumentState: vi.fn() },
        incProjectFileVersion: vi.fn(),
        isFullView: false,
        isInitializing: true,
        mainApi: { saveProject: vi.fn() },
        topIndex: 0,
        viewMode: "8x1"
      });
      return null;
    };

    const { rerender } = render(<Subject currentSegment={3} />);
    expect(cachedRefreshState.current).toEqual({
      currentSegment: 3,
      decimalView: true,
      isFullView: false
    });

    rerender(<Subject currentSegment={4} />);
    expect(cachedRefreshState.current.currentSegment).toBe(4);
  });

  it("debounces persistence and cancels the previous pending save", async () => {
    vi.useFakeTimers();
    const cachedRefreshState = {
      current: {
        currentSegment: 0,
        decimalView: false,
        isFullView: true
      }
    } satisfies { current: CachedRefreshState };
    const dispatch = vi.fn();
    const saveActiveDocumentState = vi.fn();
    const saveProject = vi.fn(() => Promise.resolve());
    const incProjectFileVersion = vi.fn(() => ({ type: "INC_PROJECT_FILE_VERSION" }));

    const Subject = ({ topIndex }: { topIndex: number }) => {
      useMemoryViewStatePersistence({
        bankLabel: true,
        cachedRefreshState,
        charDump: true,
        currentSegment: 0,
        decimalView: false,
        dispatch,
        documentHubService: { saveActiveDocumentState },
        incProjectFileVersion,
        isFullView: true,
        isInitializing: false,
        mainApi: { saveProject },
        topIndex,
        viewMode: "8x2"
      });
      return null;
    };

    const { rerender } = render(<Subject topIndex={0} />);
    rerender(<Subject topIndex={1} />);
    rerender(<Subject topIndex={2} />);

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(saveActiveDocumentState).toHaveBeenCalledTimes(1);
    expect(saveActiveDocumentState).toHaveBeenCalledWith(expect.objectContaining({ topIndex: 2 }));
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "INC_PROJECT_FILE_VERSION" });
  });
});
