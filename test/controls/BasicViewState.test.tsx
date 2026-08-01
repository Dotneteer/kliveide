import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBasicViewState,
  useBasicViewStatePersistence
} from "@renderer/appIde/DocumentPanels/basicViewState";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BASIC view-state handling", () => {
  it("builds the per-view state payload", () => {
    expect(
      buildBasicViewState({
        autoRefresh: false,
        showCodes: true,
        showSpectrumFont: false,
        topIndex: 42
      })
    ).toEqual({
      autoRefresh: false,
      showCodes: true,
      showSpectrumFont: false,
      topIndex: 42
    });
  });

  it("persists split views to their own hub and document ID", async () => {
    const leftHub = { setDocumentViewState: vi.fn() };
    const rightHub = { setDocumentViewState: vi.fn() };
    const dispatch = vi.fn();

    const Subject = ({
      documentHubService,
      documentId,
      topIndex
    }: {
      documentHubService: typeof leftHub;
      documentId: string;
      topIndex: number;
    }) => {
      useBasicViewStatePersistence({
        autoRefresh: true,
        dispatch,
        documentHubService,
        documentId,
        incProjectFileVersion: vi.fn(),
        mainApi: { saveProject: vi.fn(() => Promise.resolve()) },
        showCodes: false,
        showSpectrumFont: true,
        topIndex
      });
      return null;
    };

    const { rerender } = render(
      <>
        <Subject documentHubService={leftHub} documentId="$basic" topIndex={0} />
        <Subject documentHubService={rightHub} documentId="$basic" topIndex={0} />
      </>
    );
    leftHub.setDocumentViewState.mockClear();
    rightHub.setDocumentViewState.mockClear();

    await act(async () => {
      rerender(
        <>
          <Subject documentHubService={leftHub} documentId="$basic" topIndex={12} />
          <Subject documentHubService={rightHub} documentId="$basic" topIndex={48} />
        </>
      );
      await Promise.resolve();
    });

    expect(leftHub.setDocumentViewState).toHaveBeenCalledWith(
      "$basic",
      expect.objectContaining({ topIndex: 12 })
    );
    expect(rightHub.setDocumentViewState).toHaveBeenCalledWith(
      "$basic",
      expect.objectContaining({ topIndex: 48 })
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_WORKSPACE_SETTINGS" })
    );
  });
});
