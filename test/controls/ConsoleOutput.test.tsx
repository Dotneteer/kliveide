import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { type ReactNode } from "react";
import type { IOutputBuffer, OutputContentLine, OutputSpan } from "@renderer/appIde/ToolArea/abstractions";

/**
 * `ConsoleOutput` is the app's shared ANSI/rich-text renderer, used by four panels across two
 * folders, and until slice 7.1 it had no test at all. These cover the three things that slice
 * changed and that nothing else would catch: how it scrolls, what an actionable span *is*, and
 * whether it lets go of the buffer.
 */

const scrollToIndex = vi.fn();
const scrollTo = vi.fn();
const executeCommand = vi.fn().mockResolvedValue(undefined);

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand } })
}));

vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: ({
    apiLoaded,
    items = [],
    renderItem
  }: {
    apiLoaded?: (api: unknown) => void;
    items?: unknown[];
    renderItem: (index: number, item: unknown) => ReactNode;
  }) => {
    React.useEffect(() => {
      apiLoaded?.({ scrollToIndex, scrollTo, getItemOffset: () => 0 });
    }, [apiLoaded]);
    return <div>{items.map((item, i) => <div key={i}>{renderItem(i, item)}</div>)}</div>;
  }
}));

const { ConsoleOutput } = await import("@renderer/appIde/DocumentPanels/helpers/ConsoleOutput");

/** A buffer with a real listener list, so subscribe/unsubscribe is observable. */
function makeBuffer(lines: OutputSpan[][]) {
  const handlers = new Set<() => void>();
  const contents: OutputContentLine[] = lines.map((spans) => ({ spans }) as OutputContentLine);
  return {
    handlers,
    buffer: {
      getContents: () => contents,
      contentsChanged: {
        on: (h: () => void) => handlers.add(h),
        off: (h: () => void) => handlers.delete(h)
      }
    } as unknown as IOutputBuffer
  };
}

const plain = (text: string): OutputSpan => ({ text }) as OutputSpan;

beforeEach(() => {
  scrollToIndex.mockClear();
  scrollTo.mockClear();
  executeCommand.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("ConsoleOutput", () => {
  it("follows the tail by scrolling to the last line's index", () => {
    const { buffer } = makeBuffer([[plain("one")], [plain("two")], [plain("three")]]);
    render(<ConsoleOutput buffer={buffer} followTail />);

    // The previous implementation passed a `SCROLL_END = 5_000_000` sentinel and relied on the
    // virtualizer clamping it, which stops being true for a buffer longer than the sentinel.
    expect(scrollToIndex).toHaveBeenCalledWith(2);
    expect(scrollToIndex).not.toHaveBeenCalledWith(5_000_000);
  });

  it("does not scroll when not following the tail", () => {
    const { buffer } = makeBuffer([[plain("one")], [plain("two")]]);
    render(<ConsoleOutput buffer={buffer} />);

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("renders an actionable span as a button so it can be reached without a mouse", async () => {
    const { buffer } = makeBuffer([
      [plain("at "), { text: "main.asm", actionable: true, data: { type: "@navigate", payload: { file: "main.asm", line: 12, column: 3 } } } as unknown as OutputSpan]
    ]);
    render(<ConsoleOutput buffer={buffer} />);

    const action = screen.getByRole("button", { name: "main.asm" });
    expect(action.tagName).toBe("BUTTON");
    // Plain text stays plain: only the actionable span becomes focusable.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("runs the navigate command when an actionable span is activated", async () => {
    const { buffer } = makeBuffer([
      [{ text: "main.asm", actionable: true, data: { type: "@navigate", payload: { file: "main.asm", line: 12, column: 3 } } } as unknown as OutputSpan]
    ]);
    render(<ConsoleOutput buffer={buffer} />);

    screen.getByRole("button", { name: "main.asm" }).click();
    expect(executeCommand).toHaveBeenCalledTimes(1);
    // Column is reported 1-based.
    expect(executeCommand.mock.calls[0][0]).toContain('nav "main.asm" 12 4');
  });

  it("never emits an invalid var(transparent) background", () => {
    const { buffer } = makeBuffer([[plain("no background here")]]);
    const { container } = render(<ConsoleOutput buffer={buffer} />);

    // `var(transparent)` is not a custom-property reference, so the declaration was always dropped.
    expect(container.innerHTML).not.toContain("var(transparent)");
  });

  it("unsubscribes from the buffer on unmount", () => {
    const { buffer, handlers } = makeBuffer([[plain("one")]]);
    const { unmount } = render(<ConsoleOutput buffer={buffer} />);

    expect(handlers.size).toBe(1);
    unmount();
    expect(handlers.size).toBe(0);
  });
});
