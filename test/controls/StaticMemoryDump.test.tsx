import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", {
    configurable: true,
    value: vi.fn(() => false)
  });
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MiniMemoryDump", () => {
  it("derives dump rows from the current length prop", async () => {
    vi.doMock("@renderer/features/memory/MemoryDumpSection", () => ({
      MemoryDumpSection: ({ address, bytes }: { address: number; bytes: readonly number[] }) => (
        <div data-testid={`dump-${address}`} data-byte-count={bytes.length} />
      )
    }));
    const { MiniMemoryDump } = await import("@renderer/features/memory/StaticMemoryDump");
    const contents = new Uint8Array(32);

    const { rerender } = render(<MiniMemoryDump contents={contents} length={8} />);

    expect(screen.getByTestId("dump-0")).toHaveAttribute("data-byte-count", "8");
    expect(screen.queryByTestId("dump-8")).not.toBeInTheDocument();

    rerender(<MiniMemoryDump contents={contents} length={24} />);

    expect(screen.getByTestId("dump-0")).toHaveAttribute("data-byte-count", "8");
    expect(screen.getByTestId("dump-8")).toHaveAttribute("data-byte-count", "8");
    expect(screen.getByTestId("dump-16")).toHaveAttribute("data-byte-count", "8");
  });
});

describe("StaticMemoryDump", () => {
  async function renderStaticMemoryDump(viewState: Record<string, unknown> = {}) {
    vi.resetModules();

    const setDocumentViewState = vi.fn();
    const virtualApi = {
      scrollTo: vi.fn(),
      scrollToIndex: vi.fn()
    };
    let virtualOnScroll: ((offset: number) => void) | undefined;
    let virtualOnScrollEnd: (() => void) | undefined;

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
      useDocumentHubService: () => ({
        setDocumentViewState
      })
    }));
    vi.doMock("@renderer/controls/AddressInput", () => ({
      AddressInput: ({ onAddressSent }: { onAddressSent: (address: number) => Promise<void> }) => (
        <button data-testid="go-to-address" onClick={() => onAddressSent(0x1234)}>
          go
        </button>
      )
    }));
    vi.doMock("@renderer/features/memory/MemoryDumpSection", () => ({
      MemoryDumpSection: ({ address, bytes }: { address: number; bytes: readonly number[] }) => (
        <div data-testid={`dump-${address}`} data-byte-count={bytes.length} />
      )
    }));
    vi.doMock("@renderer/controls/VirtualizedList", () => ({
      VirtualizedList: ({
        apiLoaded,
        itemSize,
        items = [],
        onScroll,
        onScrollEnd,
        renderItem,
        revealUnmeasuredItems
      }: {
        apiLoaded?: (api: typeof virtualApi) => void;
        itemSize?: number;
        items?: number[];
        onScroll?: (offset: number) => void;
        onScrollEnd?: () => void;
        renderItem: (index: number, item: number) => ReactNode;
        revealUnmeasuredItems?: boolean;
      }) => {
        virtualOnScroll = onScroll;
        virtualOnScrollEnd = onScrollEnd;
        apiLoaded?.(virtualApi);
        return (
          <div
            data-testid="static-dump-list"
            data-item-size={itemSize}
            data-reveal-unmeasured={String(revealUnmeasuredItems)}
          >
            {items.slice(0, 2).map((item, index) => (
              <div key={item}>{renderItem(index, item)}</div>
            ))}
          </div>
        );
      }
    }));

    const { createStaticMemoryDump } = await import("@renderer/features/memory/StaticMemoryDump");
    const contents = new Uint8Array(0x4000);
    const document = { id: "static-dump-doc" };
    const result = render(
      createStaticMemoryDump({
        document,
        contents,
        viewState
      } as any)
    );

    return {
      ...result,
      setDocumentViewState,
      virtualApi,
      getVirtualOnScroll: () => virtualOnScroll,
      getVirtualOnScrollEnd: () => virtualOnScrollEnd
    };
  }

  it("restores and saves the virtual list scroll offset without rerendering during scroll", async () => {
    const harness = await renderStaticMemoryDump({ scrollPosition: 128 });

    expect(screen.getByTestId("static-dump-list")).toHaveAttribute("data-item-size", "22");
    expect(screen.getByTestId("static-dump-list")).toHaveAttribute("data-reveal-unmeasured", "true");
    expect(harness.virtualApi.scrollTo).toHaveBeenCalledWith(128);

    harness.setDocumentViewState.mockClear();

    act(() => {
      harness.getVirtualOnScroll()?.(512);
    });

    expect(harness.setDocumentViewState).not.toHaveBeenCalled();

    act(() => {
      harness.getVirtualOnScrollEnd()?.();
    });

    await waitFor(() =>
      expect(harness.setDocumentViewState).toHaveBeenCalledWith(
        "static-dump-doc",
        expect.objectContaining({ scrollPosition: 512 })
      )
    );
  });

  it("jumps to the row containing a submitted address", async () => {
    const harness = await renderStaticMemoryDump();

    fireEvent.click(screen.getByTestId("go-to-address"));

    await waitFor(() =>
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0x123, {
        align: "start"
      })
    );
    expect(harness.setDocumentViewState).toHaveBeenCalledWith(
      "static-dump-doc",
      expect.objectContaining({ topAddress: 0x1234 })
    );
  });

  it("opens static dumps with optional disassembly view state", async () => {
    const openDocument = vi.fn();
    const { openStaticMemoryDump } = await import("@renderer/features/memory/StaticMemoryDump");

    await openStaticMemoryDump(
      {
        isOpen: () => false,
        openDocument
      } as any,
      "bankDump",
      "Bank Dump",
      new Uint8Array(0x4000),
      {
        disassemblyEnabled: true,
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      }
    );

    expect(openDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "memoryDump-bankDump",
        name: "Bank Dump"
      }),
      expect.objectContaining({
        disassemblyEnabled: true,
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      }),
      false
    );
  });
});
