import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function entry(title: string, line: number, reason = "definition") {
  return {
    documentId: `/p/${title}`,
    documentType: "CodeEditor",
    title,
    iconName: "file-kz80-asm",
    locator: { kind: "text", line, column: 1 },
    reason,
    time: line
  };
}

function fakeHistory(overrides: Record<string, any> = {}) {
  const entries = [entry("main.asm", 5), entry("utils.asm", 28, "outputLink"), entry("input.asm", 6, "tabSwitch")];
  return {
    entries,
    index: 1,
    canGoBack: vi.fn(() => true),
    canGoForward: vi.fn(() => true),
    peekBack: vi.fn(() => entries[0]),
    peekForward: vi.fn(() => entries[2]),
    goBack: vi.fn(async () => true),
    goForward: vi.fn(async () => true),
    goTo: vi.fn(async () => true),
    clear: vi.fn(),
    describe: vi.fn((e: any) => `line ${e.locator.line}`),
    preview: vi.fn((e: any) => (e.title === "utils.asm" ? "call PutChar" : undefined)),
    getEntries() {
      return { entries: this.entries, index: this.index };
    },
    ...overrides
  };
}

async function renderControls(history: any, state: any = {}) {
  const appState = { userSettings: {}, ...state };
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (s: unknown) => unknown) => selector(appState),
    useRendererContext: () => ({ store: { getState: () => appState } })
  }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ navigationHistoryService: history })
  }));
  vi.doMock("@renderer/controls/IconButton", () => ({
    IconButton: ({ title, enable = true, selected, clicked, iconName }: any) => (
      <button
        data-icon={iconName}
        aria-label={title}
        disabled={!enable}
        data-selected={String(!!selected)}
        onClick={clicked}
      />
    )
  }));
  vi.doMock("@renderer/controls/ToolbarSeparator", () => ({ ToolbarSeparator: () => null }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-icon={iconName} />
  }));
  vi.doMock("@renderer/controls/overlay/useOverlayRoot", () => ({
    useOverlayRoot: () => document.body
  }));
  const { NavigationControls } = await import("@renderer/features/navigation/NavigationControls");
  return render(<NavigationControls />);
}

const button = (icon: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-icon="${icon}"]`)!;

describe("NavigationControls", () => {
  it("names the targets in the tooltips, with the shortcut", async () => {
    await renderControls(fakeHistory());
    // --- jsdom reports no platform, so the Windows/Linux defaults apply.
    expect(button("arrow-left").getAttribute("aria-label")).toBe(
      "Back to main.asm · line 5 (Alt+←)"
    );
    expect(button("arrow-right").getAttribute("aria-label")).toBe(
      "Forward to input.asm · line 6 (Alt+→)"
    );
  });

  it("uses a configured shortcut in the tooltips", async () => {
    await renderControls(fakeHistory(), {
      userSettings: { shortcuts: { navigateBack: "Ctrl+[" } }
    });
    expect(button("arrow-left").getAttribute("aria-label")).toContain("(Ctrl+[)");
  });

  it("disables what has nowhere to go, and the list when the history is empty", async () => {
    await renderControls(
      fakeHistory({
        entries: [],
        index: -1,
        canGoBack: () => false,
        canGoForward: () => false,
        peekBack: () => undefined,
        peekForward: () => undefined
      })
    );
    expect(button("arrow-left").disabled).toBe(true);
    expect(button("arrow-right").disabled).toBe(true);
    expect(button("chevron-down").disabled).toBe(true);
    expect(button("arrow-left").getAttribute("aria-label")).toBe("Go Back (Alt+←)");
  });

  it("goes back and forward", async () => {
    const history = fakeHistory();
    await renderControls(history);
    fireEvent.click(button("arrow-left"));
    fireEvent.click(button("arrow-right"));
    expect(history.goBack).toHaveBeenCalledTimes(1);
    expect(history.goForward).toHaveBeenCalledTimes(1);
  });

  it("lists the history newest first, marking the current entry and the ones ahead", async () => {
    await renderControls(fakeHistory());
    fireEvent.click(button("chevron-down"));

    const dialog = screen.getByRole("dialog", { name: "Navigation history" });
    const rows = within(dialog).getAllByRole("option");
    expect(rows.map((r) => r.textContent)).toEqual([
      "input.asmline 6tab",
      "utils.asmline 28call PutCharoutput link",
      "main.asmline 5definition"
    ]);
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
    expect(rows[0].className).toMatch(/ahead/);
    expect(rows[2].className).not.toMatch(/ahead/);
    // --- The current row takes focus, so arrows and Enter work straight away.
    expect(document.activeElement).toBe(rows[1]);
  });

  it("goes to a chosen entry and closes", async () => {
    const history = fakeHistory();
    await renderControls(history);
    fireEvent.click(button("chevron-down"));
    fireEvent.click(screen.getAllByRole("option")[2]);
    expect(history.goTo).toHaveBeenCalledWith(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves between rows with the arrow keys and closes on Escape", async () => {
    await renderControls(fakeHistory());
    fireEvent.click(button("chevron-down"));
    const rows = screen.getAllByRole("option");
    fireEvent.keyDown(rows[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(rows[2], { key: "ArrowUp" });
    fireEvent.keyDown(rows[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on a press outside, and clears", async () => {
    const history = fakeHistory();
    await renderControls(history);
    fireEvent.click(button("chevron-down"));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button("chevron-down"));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(history.clear).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("useNavigationShortcuts", () => {
  async function mountHook(history: any, state: any = {}) {
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useRendererContext: () => ({ store: { getState: () => state } })
    }));
    vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({ navigationHistoryService: history })
    }));
    const { useNavigationShortcuts } = await import(
      "@renderer/features/navigation/useNavigationShortcuts"
    );
    const Host = () => {
      useNavigationShortcuts();
      return <textarea aria-label="editor" />;
    };
    return render(<Host />);
  }

  it("handles the shortcuts before the focused element sees them", async () => {
    const history = fakeHistory();
    await mountHook(history);
    const editor = screen.getByLabelText("editor");
    const seenByEditor = vi.fn();
    editor.addEventListener("keydown", seenByEditor);

    const back = new KeyboardEvent("keydown", { code: "ArrowLeft", key: "ArrowLeft", altKey: true, bubbles: true, cancelable: true });
    act(() => {
      editor.dispatchEvent(back);
    });
    expect(history.goBack).toHaveBeenCalledTimes(1);
    // --- Handled: the page marks it so Electron does not also run the menu accelerator.
    expect(back.defaultPrevented).toBe(true);
    expect(seenByEditor).not.toHaveBeenCalled();

    act(() => {
      editor.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", altKey: true, bubbles: true, cancelable: true }));
    });
    expect(history.goForward).toHaveBeenCalledTimes(1);
  });

  it("leaves other keys alone", async () => {
    const history = fakeHistory();
    await mountHook(history);
    const plain = new KeyboardEvent("keydown", { code: "ArrowLeft", bubbles: true, cancelable: true });
    act(() => {
      screen.getByLabelText("editor").dispatchEvent(plain);
    });
    expect(history.goBack).not.toHaveBeenCalled();
    expect(plain.defaultPrevented).toBe(false);
  });

  it("follows a configured shortcut", async () => {
    const history = fakeHistory();
    await mountHook(history, { userSettings: { shortcuts: { navigateBack: "Ctrl+[" } } });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", altKey: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "BracketLeft", ctrlKey: true, cancelable: true }));
    });
    expect(history.goBack).toHaveBeenCalledTimes(1);
  });

  it("goes back and forward with the mouse's side buttons", async () => {
    const history = fakeHistory();
    await mountHook(history);
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { button: 3, cancelable: true }));
      window.dispatchEvent(new MouseEvent("mouseup", { button: 4, cancelable: true }));
      window.dispatchEvent(new MouseEvent("mouseup", { button: 0, cancelable: true }));
    });
    expect(history.goBack).toHaveBeenCalledTimes(1);
    expect(history.goForward).toHaveBeenCalledTimes(1);
  });
});

describe("formatAccelerator", () => {
  it("uses the macOS glyphs on a Mac", async () => {
    const { formatAccelerator } = await import("@renderer/features/navigation/useNavigationShortcuts");
    expect(formatAccelerator("Ctrl+-", true)).toBe("⌃-");
    expect(formatAccelerator("Ctrl+Shift+-", true)).toBe("⌃⇧-");
    expect(formatAccelerator("Cmd+[", true)).toBe("⌘[");
    expect(formatAccelerator("Alt+Left", false)).toBe("Alt+←");
  });
});
