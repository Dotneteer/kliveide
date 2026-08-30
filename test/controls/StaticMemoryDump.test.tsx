import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode, useState } from "react";
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
  async function renderStaticMemoryDump(
    viewState: Record<string, unknown> = {},
    readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist"))),
    saveFileContent = vi.fn(() => Promise.resolve()),
    contents = new Uint8Array(0x4000),
    openDialog = vi.fn(() => Promise.resolve(undefined))
  ) {
    vi.resetModules();

    const setDocumentViewState = vi.fn();
    let documentApi: any;
    const signHubStateChanged = vi.fn();
    const documentHubService = {
      setDocumentViewState,
      setDocumentApi: vi.fn((_id: string, api: any) => {
        documentApi = api;
      }),
      signHubStateChanged
    };
    const projectService = {
      readFileContent,
      saveFileContent
    };
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
      useDocumentHubService: () => documentHubService
    }));
    vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({
        projectService
      })
    }));
    vi.doMock("@renderer/controls/overlay/DialogProvider", () => ({
      useDialogs: () => ({
        open: openDialog
      })
    }));
    vi.doMock("@renderer/theming/ThemeProvider", () => ({
      useTheme: () => ({
        theme: { tone: "dark" },
        getIcon: () => ({ width: 16, height: 16, path: "" }),
        getImage: () => ({ type: "png", data: "" }),
        getThemeProperty: () => "currentColor"
      }),
      default: ({ children }: { children: ReactNode }) => <>{children}</>
    }));
    vi.doMock("@renderer/controls/AddressInput", () => ({
      AddressInput: ({ onAddressSent }: { onAddressSent: (address: number) => Promise<void> }) => (
        <button data-testid="go-to-address" onClick={() => onAddressSent(0x1234)}>
          go
        </button>
      )
    }));
    vi.doMock("@renderer/controls/Dropdown", () => ({
      default: ({
        options,
        initialValue,
        onChanged,
        width
      }: {
        options: { value: string; label: string }[];
        initialValue?: string;
        onChanged?: (value: string) => void;
        width?: string | number;
      }) => (
        <select
          data-testid={width === 104 ? "view-mode" : "disassembly-offset"}
          value={initialValue}
          onChange={(event) => onChanged?.(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }));
    vi.doMock("@renderer/controls/LabeledSwitch", () => ({
      LabeledSwitch: ({
        label,
        value,
        clicked
      }: {
        label: string;
        value: boolean;
        clicked?: (value: boolean) => void;
      }) => (
        <button
          data-testid={`switch-${label}`}
          data-value={String(value)}
          onClick={() => clicked?.(!value)}
        >
          {label}
        </button>
      )
    }));
    vi.doMock("@renderer/controls/IconButton", () => ({
      SmallIconButton: ({
        title,
        enable = true,
        clicked
      }: {
        title?: string;
        enable?: boolean;
        clicked?: () => void;
      }) => (
        <button disabled={!enable} onClick={clicked}>
          {title}
        </button>
      )
    }));
    vi.doMock("@renderer/controls/ToolbarSplitButton", () => ({
      ToolbarSplitButton: ({
        dropdownTitle,
        enable = true,
        onAction
      }: {
        dropdownTitle?: string;
        enable?: boolean;
        onAction?: (value: string) => void;
      }) => (
        <button disabled={!enable} onClick={() => onAction?.("synopsis")}>
          {dropdownTitle}
        </button>
      )
    }));
    vi.doMock("@renderer/controls/ContextMenu", () => ({
      ContextMenu: ({
        children,
        state
      }: {
        children: ReactNode;
        state: { contextVisible: boolean };
      }) => state.contextVisible ? <div data-testid="annotation-context-menu">{children}</div> : null,
      ContextMenuItem: ({
        text,
        disabled,
        clicked
      }: {
        text?: string;
        disabled?: boolean;
        clicked?: () => void;
      }) => (
        <button disabled={disabled} onClick={clicked}>
          {text}
        </button>
      ),
      ContextMenuSeparator: () => <hr />,
      useContextMenuState: () => {
        const [state, setState] = useState({
          contextVisible: false,
          contextRef: null,
          contextX: 0,
          contextY: 0
        });
        return [
          state,
          {
            show: () => setState((current) => ({ ...current, contextVisible: true })),
            conceal: () => setState((current) => ({ ...current, contextVisible: false }))
          }
        ];
      }
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
        items?: any[];
        onScroll?: (offset: number) => void;
        onScrollEnd?: () => void;
        renderItem: (index: number, item: any) => ReactNode;
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
            {items.slice(0, 5).map((item, index) => (
              <div key={index}>{renderItem(index, item)}</div>
            ))}
          </div>
        );
      }
    }));

    const { createStaticMemoryDump } = await import("@renderer/features/memory/StaticMemoryDump");
    const document = {
      editVersionCount: 0,
      id: "static-dump-doc",
      savedVersionCount: 0
    };
    const result = render(
      createStaticMemoryDump({
        document,
        contents,
        viewState
      } as any)
    );

    return {
      ...result,
      document,
      readFileContent,
      saveFileContent,
      openDialog,
      setDocumentViewState,
      signHubStateChanged,
      virtualApi,
      getDocumentApi: () => documentApi,
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

  it("renders annotated NEX bank disassembly when a sidecar is available", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 3, type: "bytes" }],
              localLabels: [{ name: "BytesHere", value: 0 }],
              lineAnnotations: {
                "0": {
                  synopsis: "Packed data",
                  comment: "four values"
                }
              }
            }
          }
        })
      )
    );
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      vi.fn(() => Promise.resolve()),
      contents
    );

    expect(await screen.findByText("; Packed data")).toBeInTheDocument();
    expect(screen.getByText("BytesHere:")).toBeInTheDocument();
    expect(screen.getByText(".defb $01, $02, $03, $04")).toBeInTheDocument();
    expect(screen.getByText("; four values")).toBeInTheDocument();
    expect(screen.queryByText("Annotations loaded")).not.toBeInTheDocument();
    expect(screen.getByText("Manage Labels")).toBeInTheDocument();
    expect(screen.getByText("Manage Regions")).toBeInTheDocument();
    expect(screen.getByText("Annotate")).toBeInTheDocument();
    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-annotation-offset",
      "0"
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
      "data-annotation-region",
      "bytes"
    );
  });

  it("selects annotated disassembly rows with click, shift-click, and keyboard navigation", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 11, type: "bytes" }]
            }
          }
        })
      )
    );
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const harness = await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      vi.fn(() => Promise.resolve()),
      contents
    );

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
        "data-annotation-region",
        "bytes"
      )
    );
    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-annotation-length",
      "4"
    );

    fireEvent.click(screen.getByTestId("disassembly-row-0"));

    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("static-disassembly-list")).toHaveFocus();

    fireEvent.click(screen.getByTestId("disassembly-row-2"), { shiftKey: true });

    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-selected-range",
      "true"
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
      "data-selected-range",
      "true"
    );
    expect(screen.getByTestId("disassembly-row-2")).toHaveAttribute("data-selected", "true");

    const arrowKeyHandled = fireEvent.keyDown(screen.getByTestId("static-disassembly-list"), {
      key: "ArrowUp",
      shiftKey: true
    });

    expect(arrowKeyHandled).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute("data-selected", "true")
    );
    expect(screen.getByTestId("disassembly-row-2")).not.toHaveAttribute("data-selected");
    expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(1, {
      align: "nearest"
    });

    Object.defineProperty(screen.getByTestId("static-disassembly-list"), "clientHeight", {
      configurable: true,
      value: 36
    });

    const pageDownHandled = fireEvent.keyDown(screen.getByTestId("static-disassembly-list"), {
      key: "PageDown"
    });

    expect(pageDownHandled).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-3")).toHaveAttribute("data-selected", "true")
    );
    expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(3, {
      align: "nearest"
    });

    const pageUpHandled = fireEvent.keyDown(screen.getByTestId("static-disassembly-list"), {
      key: "PageUp"
    });

    expect(pageUpHandled).toBe(false);
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute("data-selected", "true")
    );
    expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(1, {
      align: "nearest"
    });

    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByTestId("disassembly-row-2"), { shiftKey: true });

    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));

    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-selected-range",
      "true"
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
      "data-selected-range",
      "true"
    );
    expect(screen.getByTestId("disassembly-row-2")).toHaveAttribute("data-selected", "true");

    fireEvent.contextMenu(screen.getByTestId("disassembly-row-3"));

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-3")).toHaveAttribute("data-selected", "true")
    );
    expect(screen.getByTestId("disassembly-row-0")).not.toHaveAttribute(
      "data-selected-range"
    );
    expect(screen.getByTestId("disassembly-row-2")).not.toHaveAttribute("data-selected");
  });

  it("opens an annotation context menu for annotated disassembly rows", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 3, type: "disassemble" }],
              lineAnnotations: {
                "0": { comment: "entry call" }
              }
            }
          }
        })
      )
    );
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x12, 0x00]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      vi.fn(() => Promise.resolve()),
      contents
    );

    expect(await screen.findByText("call L1234")).toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));

    expect(screen.getByTestId("annotation-context-menu")).toBeInTheDocument();
    expect(screen.getByText("Synopsis Comment...")).toBeInTheDocument();
    expect(screen.getByText("End-of-Line Comment...")).toBeInTheDocument();
    expect(screen.getByText("Add/Edit Global Label...")).toBeInTheDocument();
    expect(screen.getByText("Add/Edit Local Label...")).toBeInTheDocument();
    expect(screen.getByText("Assign Operand Label...")).not.toBeDisabled();
    expect(screen.getByText("Mark As Disassembly")).toBeInTheDocument();
    expect(screen.getByText("Mark As Bytes")).toBeInTheDocument();
    expect(screen.getByText("Mark As Words")).toBeInTheDocument();
    expect(screen.getByText("Mark As Skip")).toBeInTheDocument();
    expect(screen.getByText("Clear Row Annotations")).not.toBeDisabled();

    fireEvent.click(screen.getByText("Synopsis Comment..."));

    expect(screen.queryByTestId("annotation-context-menu")).not.toBeInTheDocument();
  });

  it("edits and saves a synopsis comment from the annotation context menu", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              lineAnnotations: {
                "0": { comment: "existing end note" }
              }
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      synopsis: "Entry point\n\nCalls setup"
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x12]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    expect(await screen.findByText("call L1234")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Synopsis Comment..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bank: 5,
      bankOffset: 0,
      effectiveAddress: 0x8000,
      initialSynopsis: undefined
    });
    await waitFor(() => expect(screen.getByText("Save annotations")).not.toBeDisabled());

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].lineAnnotations["0"]).toEqual({
      synopsis: "Entry point\n\nCalls setup",
      comment: "existing end note"
    });
  });

  it("edits and saves an end-of-line comment from the annotation context menu", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              lineAnnotations: {
                "0": {
                  synopsis: "Entry point",
                  comment: "old note"
                }
              }
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      comment: "updated note"
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x12]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
        "data-annotation-offset",
        "0"
      )
    );
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));
    fireEvent.click(screen.getByText("End-of-Line Comment..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bank: 5,
      bankOffset: 0,
      effectiveAddress: 0x8000,
      instruction: "call L1234",
      initialComment: "old note"
    });
    await waitFor(() => expect(screen.getByText("Save annotations")).not.toBeDisabled());

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].lineAnnotations["0"]).toEqual({
      synopsis: "Entry point",
      comment: "updated note"
    });
  });

  it("adds and saves a local label from the annotation context menu", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          globalLabels: [{ name: "GlobalEntry", value: 0x8000 }],
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      action: "save",
      scope: "local",
      name: "LocalEntry",
      value: 0,
      originalLabel: undefined
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x12]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    expect(await screen.findByText("call L1234")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Add/Edit Local Label..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bank: 5,
      initialScope: "local",
      initialGlobalValue: 0x8000,
      initialLocalValue: 0
    });
    expect(openDialog.mock.calls[0][1].labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "global",
          name: "GlobalEntry",
          value: 0x8000
        })
      ])
    );

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.globalLabels).toEqual([
      { name: "GlobalEntry", value: 0x8000 }
    ]);
    expect(savedAnnotations.banks["5"].localLabels).toEqual([
      { name: "LocalEntry", value: 0 }
    ]);
  });

  it("deletes a referenced global label and clears explicit operand references", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          globalLabels: [{ name: "GlobalSetup", value: 0x9234 }],
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              operandReferences: {
                "0": [{ operandIndex: 0, scope: "global", name: "GlobalSetup" }]
              }
            },
            "6": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              operandReferences: {
                "4": [{ operandIndex: 0, scope: "global", name: "GlobalSetup" }]
              }
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      action: "delete",
      scope: "global",
      name: "GlobalSetup",
      value: 0x9234,
      originalLabel: {
        scope: "global",
        name: "GlobalSetup",
        value: 0x9234,
        referenced: true
      }
    }));
    vi.stubGlobal("confirm", vi.fn(() => true));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x92]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    expect(await screen.findByText("call GlobalSetup")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Add/Edit Global Label..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1].labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "global",
          name: "GlobalSetup",
          referenced: true
        })
      ])
    );
    expect(window.confirm).toHaveBeenCalledWith(
      "Delete GlobalSetup and clear 2 operand references?"
    );

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.globalLabels).toEqual([]);
    expect(savedAnnotations.banks["5"].operandReferences).toBeUndefined();
    expect(savedAnnotations.banks["6"].operandReferences).toBeUndefined();
  });

  it("assigns and saves an operand label reference from the annotation context menu", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          globalLabels: [{ name: "GlobalSetup", value: 0x9234 }],
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      action: "apply",
      operandIndex: 0,
      scope: "global",
      name: "GlobalSetup"
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x34, 0x92]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    expect(await screen.findByText("call GlobalSetup")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Assign Operand Label..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bank: 5,
      bankAddressOffset: 0x8000,
      instruction: "call GlobalSetup",
      explicitReferences: undefined
    });
    expect(openDialog.mock.calls[0][1].operands).toEqual([
      expect.objectContaining({
        operandIndex: 0,
        operandValue: 0x9234
      })
    ]);

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].operandReferences).toEqual({
      "0": [{ operandIndex: 0, scope: "global", name: "GlobalSetup" }]
    });
  });

  it("creates a local label while assigning an operand label reference", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      action: "create-label",
      operandIndex: 0,
      scope: "local",
      name: "L_0123",
      value: 0x0123
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([0xcd, 0x23, 0x81]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    expect(await screen.findByText("call L8123")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Assign Operand Label..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bankAddressOffset: 0x8000,
      instruction: "call L8123"
    });

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].localLabels).toEqual([
      { name: "L_0123", value: 0x0123 }
    ]);
    expect(savedAnnotations.banks["5"].operandReferences).toEqual({
      "0": [{ operandIndex: 0, scope: "local", name: "L_0123" }]
    });
  });

  it("marks and saves memory regions from the annotation context menu", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [
                { start: 0, end: 3, type: "bytes" },
                { start: 4, end: 7, type: "disassemble" },
                { start: 8, end: 0x3fff, type: "bytes" }
              ]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({
      type: "bytes",
      start: 4,
      end: 7
    }));
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4, 0, 0, 0, 0, 8, 9, 10, 11]);

    await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent,
      contents,
      openDialog
    );

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
        "data-annotation-offset",
        "4"
      )
    );
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));
    fireEvent.click(screen.getByText("Mark As Bytes"));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      initialType: "bytes",
      initialStart: 4,
      initialEnd: 4,
      regions: [
        { start: 0, end: 3, type: "bytes" },
        { start: 4, end: 7, type: "disassemble" },
        { start: 8, end: 0x3fff, type: "bytes" }
      ]
    });

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "bytes" }
    ]);
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
        decimalView: true,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5,
        viewMode: "disassembly"
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
        decimalView: true,
        viewMode: "disassembly",
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      }),
      false
    );
  });

  it("stores and saves annotated bank disassembly view settings", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              decimalView: false,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());

    const harness = await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "memory",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent,
      saveFileContent
    );

    await waitFor(() => expect(readFileContent).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Annotations loaded")).not.toBeInTheDocument();
    expect(screen.queryByText("Annotations changed")).not.toBeInTheDocument();
    expect(screen.getByText("Save annotations")).toBeDisabled();

    fireEvent.change(screen.getByTestId("view-mode"), {
      target: { value: "disassembly" }
    });

    await waitFor(() => expect(screen.getByText("Save annotations")).not.toBeDisabled());
    expect(screen.queryByText("Annotations changed")).not.toBeInTheDocument();
    expect(harness.document.editVersionCount).toBe(1);
    expect(harness.document.savedVersionCount).toBe(0);

    fireEvent.click(screen.getByTestId("switch-Decimal"));
    fireEvent.change(screen.getByTestId("disassembly-offset"), {
      target: { value: "49152" }
    });

    fireEvent.click(screen.getByText("Save annotations"));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(saveFileContent.mock.calls[0][0]).toBe("/project/game.nex.dis");
    expect(savedAnnotations.banks["5"]).toMatchObject({
      offsetIndex: 3,
      lastView: "disassembly",
      decimalView: true
    });
    await waitFor(() => expect(screen.getByText("Save annotations")).toBeDisabled());
    expect(screen.queryByText("Annotations loaded")).not.toBeInTheDocument();
    expect(harness.document.savedVersionCount).toBe(harness.document.editVersionCount);
  });

  it("asks before discarding dirty annotation changes on disposal", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    vi.stubGlobal("confirm", vi.fn(() => false));

    const harness = await renderStaticMemoryDump(
      {
        disassemblyEnabled: true,
        viewMode: "memory",
        disassOffset: 0x8000,
        nexAnnotationPath: "/project/game.nex.dis",
        nexAnnotationBank: 5
      },
      readFileContent
    );

    await waitFor(() => expect(readFileContent).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByTestId("view-mode"), {
      target: { value: "disassembly" }
    });

    await waitFor(() => expect(screen.getByText("Save annotations")).not.toBeDisabled());
    expect(screen.queryByText("Annotations changed")).not.toBeInTheDocument();
    await expect(harness.getDocumentApi().beforeDocumentDisposal()).resolves.toBe(false);
    expect(window.confirm).toHaveBeenCalledWith(
      "Discard unsaved annotation changes in /project/game.nex.dis?"
    );
  });
});
