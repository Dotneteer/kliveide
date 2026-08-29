import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
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
