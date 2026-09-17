import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MI_ZXNEXT } from "@common/machines/constants";

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
  /**
   * A paused ZX Next with this bank paged in, for the tests that need one.
   *
   * Most tests here set no machine at all, which is why the default mocks report a stopped one with
   * no paging. `machine` supplies what `useNexBankLocation` and `useNexBankPcOffset` actually read:
   * the machine id (they do nothing off a Next), the controller state, the MMU's 8K slots, and the
   * program counter.
   */
  type FakeMachine = {
    machineId?: string;
    machineState?: MachineControllerState;
    /** The 8K bank each of the eight slots holds, or `undefined` for a slot that is not RAM. */
    slots?: (number | undefined)[];
    pcValue?: number;
  };

  async function renderStaticMemoryDump(
    viewState: Record<string, unknown> = {},
    readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist"))),
    saveFileContent = vi.fn(() => Promise.resolve()),
    contents = new Uint8Array(0x4000),
    openDialog = vi.fn(() => Promise.resolve(undefined)),
    machine: FakeMachine = {}
  ) {
    vi.resetModules();

    const setDocumentViewState = vi.fn();
    const navigationHistoryService = {
      recordJump: vi.fn(async (_reason: string, jump: () => unknown) => await jump())
    };
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
        projectService,
        navigationHistoryService
      })
    }));
    // --- The panel reads its row heights through `useRowSizes`, which reads the panel font size.
    // --- Returning undefined lets `getRowSizes` fall back to its default, i.e. the 20/18px these
    // --- tests were written against.
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useGlobalSetting: () => undefined,
      // --- Added for the bank breakpoint gutter, which watches `breakpointsVersion`. The dump has
      // --- no breakpoints in these tests; how a bank-relative breakpoint is named in a row is
      // --- covered in `test/controls/DisassemblyRow.test.tsx`.
      /*
       * Selector-aware, because two different slices matter now.
       *
       * `breakpointsVersion` (and everything else) still answers 0, which is what the gutter wants.
       * The machine id and controller state are read by the bank-location and PC hooks, and a blunt
       * `() => 0` told them there is no Next and nothing paused — which is the right default for
       * most tests here and wrong for the ones about the "go to PC" button.
       */
      useSelector: (selector: any) => {
        const state = {
          emulatorState: {
            machineId: machine.machineId,
            machineState: machine.machineState ?? MachineControllerState.Stopped,
            breakpointsVersion: 0
          }
        };
        const value = typeof selector === "function" ? selector(state) : undefined;
        return value ?? 0;
      },
      // --- Added for the breakpoint dialog the gutter's double-click opens (`useBreakpointDialog`
      // --- reports a failure to open through the status bar). No test here opens it; that the
      // --- dialog accepts and produces a bank-relative breakpoint is covered without a DOM in
      // --- `test/renderer/breakpoint-form.test.ts`.
      useDispatch: () => vi.fn()
    }));
    /*
     * "Go to definition" reads the NEX back through `mainApi` when a label is in another bank, so
     * the panel now calls `useMainApi`. Mocked here rather than left to the real hook, which reaches
     * for `useRendererContext` — an export this file's `RendererProvider` mock deliberately does not
     * have. No test here follows a cross-bank jump; that decision is asserted without a DOM in
     * `test/dialogs/nexAnnotationEditor` and `test/renderer/nexGoToDefinition.test.ts`.
     */
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({
        readBinaryFile: async () => new Uint8Array(0)
      })
    }));
    vi.doMock("@renderer/core/EmuApi", () => ({
      useEmuApi: () => ({
        listBreakpoints: async () => ({ breakpoints: [] }),
        // --- Added for the header's "where is this bank" readout, which refreshes through
        // --- `useEmuStateListener`. That ticker polls `getCpuStateChunk`, and without it every
        // --- test in this file logged an unhandled rejection — passing, but with 25 errors in the
        // --- output that would have hidden a real one. These tests set no machine, so a stopped
        // --- one with no paging is the honest answer; what the readout says about a given mapping
        // --- is covered without a DOM in `test/renderer/nextBankLocation.test.ts`.
        getCpuStateChunk: async () => ({
          state: machine.machineState ?? MachineControllerState.Stopped,
          pcValue: machine.pcValue ?? 0,
          tacts: 0
        }),
        getNextMemoryMapping: async () => ({
          // --- `locateBank16k` matches on `bank8k` and ignores a slot with no `writeOffset`, which
          // --- is how it tells RAM from a ROM'd slot. An absent slot here is that ROM'd case.
          pageInfo: (machine.slots ?? []).map((bank8k) =>
            bank8k === undefined ? { bank8k: -1, writeOffset: null } : { bank8k, writeOffset: 0 }
          )
        }),
        // --- The listing names 16-bit data operands after the machine's system variables. One
        // --- entry is enough to tell a named operand from an unnamed one; the naming rule itself
        // --- is covered without a DOM in `test/renderer/sysVarOperandLabels.test.ts`.
        getSysVars: async () => [{ address: 0x5c08, name: "LAST-K", type: 0 }]
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
        fill,
        enable = true,
        clicked
      }: {
        title?: string;
        fill?: string;
        enable?: boolean;
        clicked?: () => void;
      }) => (
        <button data-fill={fill} disabled={!enable} onClick={clicked}>
          {title}
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
        revealUnmeasuredItems,
        scrollRowsHorizontally
      }: {
        apiLoaded?: (api: typeof virtualApi) => void;
        itemSize?: number;
        items?: any[];
        onScroll?: (offset: number) => void;
        onScrollEnd?: () => void;
        renderItem: (index: number, item: any) => ReactNode;
        revealUnmeasuredItems?: boolean;
        scrollRowsHorizontally?: boolean;
      }) => {
        virtualOnScroll = onScroll;
        virtualOnScrollEnd = onScrollEnd;
        apiLoaded?.(virtualApi);
        return (
          <div
            data-testid="static-dump-list"
            data-item-size={itemSize}
            data-reveal-unmeasured={String(revealUnmeasuredItems)}
            data-scroll-horizontally={String(!!scrollRowsHorizontally)}
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
      navigationHistoryService,
      getVirtualOnScroll: () => virtualOnScroll,
      getVirtualOnScrollEnd: () => virtualOnScrollEnd
    };
  }

  it("restores and saves the virtual list scroll offset without rerendering during scroll", async () => {
    const harness = await renderStaticMemoryDump({ scrollPosition: 128 });

    // --- M3: the memory row height comes from `useRowSizes().memory` now (20px at the default
    // --- panel font size), the same number `MemoryPanel` places its rows with.
    expect(screen.getByTestId("static-dump-list")).toHaveAttribute("data-item-size", "20");
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

  it("records Go To in the navigation history, reporting the new address inside the jump", async () => {
    const harness = await renderStaticMemoryDump({ disassOffset: 0x1000 });
    let during: unknown;
    harness.navigationHistoryService.recordJump.mockImplementationOnce(async (_reason, jump) => {
      await (jump as () => Promise<void>)();
      during = harness.getDocumentApi().getNavigationLocator();
    });

    fireEvent.click(screen.getByTestId("go-to-address"));

    await waitFor(() =>
      expect(harness.navigationHistoryService.recordJump).toHaveBeenCalledWith(
        "memoryGoTo",
        expect.any(Function)
      )
    );
    expect(during).toEqual({ kind: "address", address: 0x1234, viewMode: "memory", base: 0x1000 });
  });

  it("reveals a recorded location in the listing it was recorded in", async () => {
    const harness = await renderStaticMemoryDump({
      disassemblyEnabled: true,
      nexAnnotationBank: 5,
      viewMode: "disassembly",
      disassOffset: 0x8000
    });
    expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toEqual("disassembly");

    act(() =>
      harness.getDocumentApi().revealLocator({ kind: "address", address: 0x8120, viewMode: "memory" })
    );

    await waitFor(() =>
      expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toEqual("memory")
    );
    await waitFor(() =>
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0x12, { align: "start" })
    );
    expect(harness.getDocumentApi().getNavigationLocator()).toEqual({
      kind: "address",
      address: 0x8120,
      viewMode: "memory",
      base: 0x8000
    });
  });

  it("accounts for the disassembly offset when jumping to an address", async () => {
    /*
     * The rows are addressed by `disassOffset` while the virtual list is indexed from the start of
     * the dump. Without subtracting it, a bank shown at $1000 asked for row $1234/16 = 291 for an
     * address only 35 rows in. In a bank shown at $4000 the request ran past the end of the list
     * entirely. See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.15a.
     */
    const harness = await renderStaticMemoryDump({ disassOffset: 0x1000 });

    fireEvent.click(screen.getByTestId("go-to-address"));

    await waitFor(() =>
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0x23, {
        align: "start"
      })
    );
  });

  it("clamps a jump to an address outside the dump", async () => {
    // --- $1234 is below a bank shown at $4000, so the row index would be negative.
    const harness = await renderStaticMemoryDump({ disassOffset: 0x4000 });

    fireEvent.click(screen.getByTestId("go-to-address"));

    await waitFor(() =>
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
    );
  });

  it("scrolls an already-open document to a newly revealed address", async () => {
    /*
     * View state is read once, on mount, so re-pointing an open document by writing to it does
     * nothing — which is why the listing stopped following the program counter as soon as it stayed
     * inside a bank that was already showing. The document exposes `revealAddress` for this.
     * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.18.
     */
    const harness = await renderStaticMemoryDump({ disassOffset: 0x8000 });

    harness.getDocumentApi().revealAddress(0xa600);

    await waitFor(() =>
      // --- ($A600 - $8000) / 16 = row 0x260, not $A600 / 16.
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0x260, { align: "start" })
    );
  });

  it("opens a NEX bank as a disassembly by default", async () => {
    // --- A bank of a NEX is a slice of a program; the reason to open one is to read the code.
    await renderStaticMemoryDump({ disassemblyEnabled: true, nexAnnotationBank: 5 });

    expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toEqual("disassembly");
  });

  it("opens a plain dump as memory, and honours a remembered view for a NEX bank", async () => {
    // --- Nothing but a NEX bank gets the disassembly default...
    await renderStaticMemoryDump({ disassemblyEnabled: true });
    expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toEqual("memory");

    // --- ...and the default never overrides a choice the user already made.
    await renderStaticMemoryDump({
      disassemblyEnabled: true,
      nexAnnotationBank: 5,
      viewMode: "memory"
    });
    expect((screen.getAllByTestId("view-mode").at(-1) as HTMLSelectElement).value).toEqual(
      "memory"
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
    // --- Enabled with nothing selected: Bank Comment needs no row.
    expect(screen.getByText("Annotations")).not.toBeDisabled();
    expect(screen.queryByText("Manage Labels")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Regions")).not.toBeInTheDocument();
    expect(screen.queryByText("Annotate")).not.toBeInTheDocument();
    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-annotation-offset",
      "0"
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
      "data-annotation-region",
      "bytes"
    );
  });

  /*
   * "Go to PC" in a popped-out bank.
   *
   * A bank pop-out is one 16K slice, so unlike the live Disassembly view the program counter is
   * usually *not* in it — which is exactly why the button is gated rather than always live.
   */
  describe("the go-to-PC button", () => {
    const GO_TO_PC = "Go to the PC address in this bank";

    /** Bank 5 paged in contiguously at $8000: its 8K pages 10 and 11 in slots 4 and 5. */
    const BANK_5_AT_8000 = [0, 1, 2, 3, 10, 11, 6, 7];

    /** `ld hl,$1234` at the start of the bank, so the listing has rows to land on. */
    const CODE = () => {
      const contents = new Uint8Array(0x4000);
      contents.set([0x21, 0x34, 0x12, 0x00, 0x00, 0x00, 0x00, 0x00]);
      return contents;
    };

    const renderBank = (machine: Record<string, unknown>, viewState: Record<string, unknown> = {}) =>
      renderStaticMemoryDump(
        {
          disassemblyEnabled: true,
          viewMode: "disassembly",
          disassOffset: 0x8000,
          nexAnnotationBank: 5,
          ...viewState
        },
        undefined,
        undefined,
        CODE(),
        undefined,
        { machineId: MI_ZXNEXT, ...machine } as any
      );

    const button = () => screen.getByText(GO_TO_PC);

    it("is enabled when the machine is paused with PC inside this bank", async () => {
      await renderBank({
        machineState: MachineControllerState.Paused,
        slots: BANK_5_AT_8000,
        // --- $8004 is in slot 4, which holds this bank's low half: bank offset 4.
        pcValue: 0x8004
      });

      await waitFor(() => expect(button()).not.toBeDisabled());
    });

    it("is disabled while the machine is running", async () => {
      /*
       * Not a matter of taste. A running machine's PC has moved on by the time it is read, so the
       * row the button scrolled to would be an arbitrary instruction rather than the one about to
       * execute — the same rule the execution-point marker and `nex-label` follow.
       */
      await renderBank({
        machineState: MachineControllerState.Running,
        slots: BANK_5_AT_8000,
        pcValue: 0x8004
      });

      await waitFor(() => expect(screen.getByTestId("disassembly-row-0")).toBeInTheDocument());
      expect(button()).toBeDisabled();
    });

    it("is disabled when the PC is paused outside this bank", async () => {
      // --- Paused in slot 0, which holds a different bank; this bank has no row for it.
      await renderBank({
        machineState: MachineControllerState.Paused,
        slots: BANK_5_AT_8000,
        pcValue: 0x0100
      });

      await waitFor(() => expect(screen.getByTestId("disassembly-row-0")).toBeInTheDocument());
      expect(button()).toBeDisabled();
    });

    it("is disabled when the bank is not paged in at all", async () => {
      // --- The bytes are still readable — a NEX's banks all live in RAM — but the PC cannot be in
      // --- a bank the MMU is not pointing at, so there is nowhere to go.
      await renderBank({
        machineState: MachineControllerState.Paused,
        slots: [0, 1, 2, 3, 4, 5, 6, 7],
        pcValue: 0x8004
      });

      await waitFor(() => expect(screen.getByTestId("disassembly-row-0")).toBeInTheDocument());
      expect(button()).toBeDisabled();
    });

    it("is disabled with no machine at all", async () => {
      await renderStaticMemoryDump({
        disassemblyEnabled: true,
        viewMode: "disassembly",
        disassOffset: 0x8000,
        nexAnnotationBank: 5
      });

      await waitFor(() => expect(screen.getByTestId("disassembly-row-0")).toBeInTheDocument());
      expect(button()).toBeDisabled();
    });

    it("scrolls to the row the execution point is marked on", async () => {
      const harness = await renderBank({
        machineState: MachineControllerState.Paused,
        slots: BANK_5_AT_8000,
        // --- Bank offset 3, which is the `nop` after the three-byte `ld hl,$1234`: row 1.
        pcValue: 0x8003
      });

      await waitFor(() => expect(button()).not.toBeDisabled());
      harness.virtualApi.scrollToIndex.mockClear();
      fireEvent.click(button());

      await waitFor(() =>
        expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(1, { align: "start" })
      );
    });

    it("scrolls again when pressed a second time", async () => {
      /*
       * The jump is applied by an effect keyed on the target address, so asking twice for the same
       * one used to change no state and scroll nowhere — leaving the button dead after the user had
       * scrolled away and pressed it again.
       */
      const harness = await renderBank({
        machineState: MachineControllerState.Paused,
        slots: BANK_5_AT_8000,
        pcValue: 0x8003
      });

      await waitFor(() => expect(button()).not.toBeDisabled());
      fireEvent.click(button());
      await waitFor(() => expect(harness.virtualApi.scrollToIndex).toHaveBeenCalled());
      harness.virtualApi.scrollToIndex.mockClear();

      fireEvent.click(button());

      await waitFor(() =>
        expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(1, { align: "start" })
      );
    });

    it("follows the listing's own numbering, not the machine's", async () => {
      /*
       * The offset dropdown decides where this bank's byte 0 is numbered, and a bank can be listed
       * at an address it is not paged at. The button targets the row the execution-point marker is
       * on, which is `disassOffset + bankOffset` — so with the listing based at $C000 and the bank
       * paged at $8000, PC $8003 is still bank offset 3, still row 1.
       */
      const harness = await renderBank(
        {
          machineState: MachineControllerState.Paused,
          slots: BANK_5_AT_8000,
          pcValue: 0x8003
        },
        { disassOffset: 0xc000 }
      );

      await waitFor(() => expect(button()).not.toBeDisabled());
      harness.virtualApi.scrollToIndex.mockClear();
      fireEvent.click(button());

      await waitFor(() =>
        expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(1, { align: "start" })
      );
    });
  });

  describe("system variable names", () => {
    /** `ld hl,$5C08` — a 16-bit data operand that happens to be a system variable's address. */
    const LD_HL_LAST_K = () => {
      const contents = new Uint8Array(0x4000);
      contents.set([0x21, 0x08, 0x5c]);
      return contents;
    };

    const renderBank = (viewState: Record<string, unknown> = {}) =>
      renderStaticMemoryDump(
        {
          disassemblyEnabled: true,
          viewMode: "disassembly",
          disassOffset: 0x8000,
          nexAnnotationBank: 5,
          ...viewState
        },
        undefined,
        undefined,
        LD_HL_LAST_K()
      );

    it("names a data operand by default", async () => {
      await renderBank();

      expect(await screen.findByText("ld hl,LAST_K")).toBeInTheDocument();
      expect((screen.getByTestId("switch-Sys vars") as HTMLElement).dataset.value).toBe("true");
    });

    it("shows the address again when the switch is turned off", async () => {
      await renderBank();
      await screen.findByText("ld hl,LAST_K");

      await act(async () => {
        fireEvent.click(screen.getByTestId("switch-Sys vars"));
      });

      expect(await screen.findByText("ld hl,$5C08")).toBeInTheDocument();
      expect(screen.queryByText("ld hl,LAST_K")).not.toBeInTheDocument();
    });

    it("honours a remembered off state", async () => {
      await renderBank({ sysVarNames: false });

      expect(await screen.findByText("ld hl,$5C08")).toBeInTheDocument();
      expect((screen.getByTestId("switch-Sys vars") as HTMLElement).dataset.value).toBe("false");
    });
  });

  /**
   * The label column is sized to the listing, not to `L1234:`.
   *
   * A machine disassembly only ever generates `L<addr>:`, so the row's default column fits it. The
   * labels here are whatever the user typed into the sidecar, and the cell is `flex: 0 0 auto` with
   * an explicit width: a name longer than the column does not widen it, it paints over the
   * instruction beside it. Sized once across the listing so the columns after it still line up.
   */
  it("widens the label column to fit the longest annotation label", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 3, type: "bytes" }],
              localLabels: [{ name: "SixteenCharLabel", value: 0 }]
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

    // --- "SixteenCharLabel:" is 17 characters; the 10ch default would clip 7 of them.
    const label = await screen.findByText("SixteenCharLabel:");
    expect(label.style.width).toBe("17ch");
    // --- Shared, not per row: a row with no label reserves the same column.
    const labelCells = Array.from(
      screen.getByTestId("static-disassembly-list").querySelectorAll<HTMLElement>("span")
    ).filter((el) => el.className.includes("annotationLabel"));
    expect(labelCells.length).toBeGreaterThan(1);
    for (const cell of labelCells) {
      expect(cell.style.width).toBe("17ch");
    }
  });

  /**
   * A row wider than the panel scrolls rather than being clipped.
   *
   * The rows already carry `min-width: max-content`, but `virtua` wraps each one in an absolutely
   * positioned div pinned to the viewport width, so the scroll container measures no overflow and
   * OverlayScrollbars has nothing to show. `scrollRowsHorizontally` is what grows that wrapper.
   */
  it("lets a disassembly row wider than the panel scroll horizontally", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 3, type: "bytes" }],
              lineAnnotations: {
                "0": { comment: "an end-of-line comment long enough to run past a narrow panel" }
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

    await screen.findByText("; an end-of-line comment long enough to run past a narrow panel");
    expect(
      screen.getByTestId("static-disassembly-list").querySelector("[data-scroll-horizontally]")
    ).toHaveAttribute("data-scroll-horizontally", "true");
  });

  it("opens the labels manager from the toolbar and jumps to a selected label", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          globalLabels: [{ name: "GlobalEntry", value: 0x9234 }],
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              localLabels: [{ name: "LocalTarget", value: 2 }],
              operandReferences: {
                "0": [{ operandIndex: 0, scope: "local", name: "LocalTarget" }]
              }
            }
          }
        })
      )
    );
    const openDialog = vi.fn(() => Promise.resolve({
      action: "go-to",
      label: {
        scope: "local",
        bank: 5,
        name: "LocalTarget",
        value: 2,
        referenceCount: 1
      }
    }));

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Labels..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][0].name).toBe("NexLabelsDialog");
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      bank: 5,
      bankAddressOffset: 0x8000
    });
    expect(openDialog.mock.calls[0][1].labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "local",
          bank: 5,
          name: "LocalTarget",
          value: 2,
          referenced: true,
          referenceCount: 1
        }),
        expect.objectContaining({
          scope: "global",
          name: "GlobalEntry",
          value: 0x9234,
          referenceCount: 0
        })
      ])
    );
    await waitFor(() =>
      expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(2, {
        align: "start"
      })
    );
    // --- Going to a label is a jump the navigation history records, at the label's address.
    expect(harness.navigationHistoryService.recordJump).toHaveBeenCalledWith("nexLabel", expect.any(Function));
    expect(harness.getDocumentApi().getNavigationLocator()).toMatchObject({ address: 0x8002 });
  });

  /**
   * The Labels list is somewhere you stay.
   *
   * Editing used to end the session: one rename and you were back in the disassembly, having to
   * reopen Labels and find your place again. Add, edit and delete all reopen the list, against
   * freshly derived labels, so the change you just made is visible in it.
   */
  it("returns to the labels list after editing a label", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              localLabels: [{ name: "OldName", value: 0 }]
            }
          }
        })
      )
    );

    /*
     * The list stays open and hands the edit back as a callback, so the label editor stacks over it.
     * This mock is the user: it takes the `onEditLabel` the list was given and calls it, then reads
     * the refreshed list that comes back.
     */
    let refreshedLabels: any[] | undefined;
    const openDialog = vi.fn(async (_component: any, props: any, options?: any) => {
      if (options?.title === "Labels") {
        refreshedLabels = await props.onEditLabel({
          scope: "local",
          bank: 5,
          name: "OldName",
          value: 0,
          referenceCount: 0
        });
        // --- Dismissed afterwards, the way a user closes the list once they are done with it.
        return undefined;
      }
      return {
        action: "save",
        scope: "local",
        name: "NewName",
        value: 0,
        originalLabel: { scope: "local", bank: 5, name: "OldName", value: 0 }
      };
    });

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Labels..."));

    await waitFor(() => expect(refreshedLabels).toBeDefined());
    /*
     * The editor opened *while the list's own open was still outstanding* — that is the stacking:
     * two dialogs live at once, the editor over the list. One "Labels" entry also says it was
     * never closed and reopened around the edit.
     */
    expect(openDialog.mock.calls.map((call) => call[2]?.title)).toEqual(["Labels", "Label"]);
    // --- And what comes back carries the edit that just landed.
    expect(refreshedLabels).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "NewName" })])
    );
  });

  it("leaves the labels list when a label is used to navigate", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              localLabels: [{ name: "Target", value: 2 }]
            }
          }
        })
      )
    );
    const openDialog = vi.fn(() =>
      Promise.resolve({
        action: "go-to",
        label: { scope: "local", bank: 5, name: "Target", value: 2, referenceCount: 0 }
      })
    );

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Labels..."));

    // --- Opened once and not reopened: it would otherwise cover the row it just scrolled to.
    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openDialog).toHaveBeenCalledTimes(1);
  });

  /**
   * A label is a name the user chose and typed, and the list has no undo — so every delete is
   * confirmed, not only the referenced ones that used to be.
   */
  it("confirms an unreferenced label delete before applying it", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              localLabels: [{ name: "Unused", value: 0 }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());

    let refreshedLabels: any[] | undefined;
    let confirmRequest: any;
    const openDialog = vi.fn(async (_component: any, props: any, options?: any) => {
      if (options?.title === "Labels") {
        // --- The delete runs with the list still open, so the confirmation stacks over it.
        refreshedLabels = await props.onDeleteLabel({
          scope: "local",
          bank: 5,
          name: "Unused",
          value: 0,
          referenceCount: 0
        });
        return undefined;
      }
      confirmRequest = props;
      // --- Refused, so nothing should change.
      return false;
    });

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Labels..."));

    await waitFor(() => expect(confirmRequest).toBeDefined());
    expect(confirmRequest.code).toBe("Unused");
    expect(confirmRequest.danger).toBe(true);
    // --- Nothing else to warn about when no operand points at it.
    expect(confirmRequest.linesAfterCode).toBeUndefined();

    // --- Refused: the label survives, and the refreshed list still offers it.
    await waitFor(() => expect(refreshedLabels).toBeDefined());
    // --- The confirmation stacked over the still-open list, rather than replacing it.
    expect(openDialog.mock.calls.map((call) => call[2]?.title)).toEqual([
      "Labels",
      "Delete label"
    ]);
    expect(refreshedLabels).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Unused" })])
    );
    // --- And nothing was written, which is the part a refused confirmation has to guarantee.
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  /*
   * Keyboard shortcuts for the annotation actions.
   *
   * Bare letters, because every other family of keys is spoken for on at least one platform — see
   * `NEX_ANNOTATION_SHORTCUTS`. The table itself is asserted in the view model's own suite; what is
   * worth proving here is the wiring: the right dialog opens, on the right row, and the key is
   * consumed rather than left to travel on.
   */
  describe("annotation shortcuts", () => {
    /** An annotated bank of four-byte rows; row 0 is selected unless `select` says otherwise. */
    async function renderAnnotatedListing({ select = true }: { select?: boolean } = {}) {
      const readFileContent = vi.fn(() =>
        Promise.resolve(
          JSON.stringify({
            schemaVersion: 1,
            banks: {
              "5": { offsetIndex: 2, regions: [{ start: 0, end: 11, type: "bytes" }] }
            }
          })
        )
      );
      const contents = new Uint8Array(0x4000);
      contents.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const openDialog = vi.fn(() => Promise.resolve(undefined));
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
        contents,
        openDialog
      );
      await waitFor(() =>
        expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
          "data-annotation-region",
          "bytes"
        )
      );
      if (select) fireEvent.click(screen.getByTestId("disassembly-row-0"));
      return { openDialog, list: screen.getByTestId("static-disassembly-list") };
    }

    /** `fireEvent.keyDown` returns false when the handler called `preventDefault`. */
    const press = (list: HTMLElement, key: string, shiftKey = false) =>
      fireEvent.keyDown(list, { key, shiftKey });

    it("opens the bank comment dialog on B, with or without a selection", async () => {
      const { openDialog, list } = await renderAnnotatedListing({ select: false });

      expect(press(list, "b")).toBe(false);

      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][0].name).toBe("NexBankCommentDialog");
      expect(openDialog.mock.calls[0][1]).toEqual({ bank: 5, initialComment: undefined });
    });

    it("opens the label dialog on L, scoped global", async () => {
      const { openDialog, list } = await renderAnnotatedListing();

      expect(press(list, "l")).toBe(false);

      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][0].name).toBe("NexLabelDialog");
      expect(openDialog.mock.calls[0][1]).toMatchObject({ bank: 5, initialScope: "global" });
    });

    it("opens the same dialog scoped local on Shift+L", async () => {
      const { openDialog, list } = await renderAnnotatedListing();

      // --- `key` is the capital letter whenever Shift is down, which the lookup has to tolerate.
      expect(press(list, "L", true)).toBe(false);

      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][1]).toMatchObject({ initialScope: "local" });
    });

    it("opens the comment dialogs on C and Shift+C", async () => {
      const { openDialog, list } = await renderAnnotatedListing();

      expect(press(list, "c")).toBe(false);
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][0].name).toBe("NexEndOfLineCommentDialog");

      expect(press(list, "C", true)).toBe(false);
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(2));
      expect(openDialog.mock.calls[1][0].name).toBe("NexSynopsisCommentDialog");
    });

    it("opens the labels list on M and the regions list on R", async () => {
      const { openDialog, list } = await renderAnnotatedListing();

      expect(press(list, "m")).toBe(false);
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][0].name).toBe("NexLabelsDialog");

      expect(press(list, "r")).toBe(false);
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(2));
      expect(openDialog.mock.calls[1][0].name).toBe("NexRegionsDialog");
    });

    it("acts on the row the highlight is on, not on the last one right-clicked", async () => {
      /*
       * Nothing ever emits `contextTargetCleared`, so a right-click leaves the controller's
       * `contextTarget` pointing at that row for as long as the selection lives. Were the shortcut
       * to fall back to it, this would edit row 0 — the row the user right-clicked and then arrowed
       * away from — instead of row 2. Four-byte rows at `disassOffset` $8000, so row 2 is $8008.
       */
      const { openDialog, list } = await renderAnnotatedListing();
      fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
      fireEvent.keyDown(list, { key: "Escape" });

      press(list, "ArrowDown");
      press(list, "ArrowDown");
      await waitFor(() =>
        expect(screen.getByTestId("disassembly-row-2")).toHaveAttribute("data-selected", "true")
      );

      press(list, "L", true);

      await waitFor(() => expect(openDialog).toHaveBeenCalled());
      expect(openDialog.mock.calls[0][1]).toMatchObject({ initialLocalValue: 8 });
    });

    it("leaves an unclaimed key alone, so it can reach the emulated machine", async () => {
      /*
       * The emulator's keyboard is a `window` listener that runs whatever has focus, so a key this
       * panel does not claim must travel on untouched — and a claimed one must not, or pressing `N`
       * would open the dialog *and* type into the Spectrum.
       */
      const { openDialog, list } = await renderAnnotatedListing();

      expect(press(list, "x")).toBe(true);
      expect(press(list, "o", true)).toBe(true);
      // --- N carried the labels before they moved to L; it must be fully released.
      expect(press(list, "n")).toBe(true);
      expect(openDialog).not.toHaveBeenCalled();
    });

    it("defers a modified key to the app", async () => {
      // --- Ctrl/Cmd/Alt combinations belong to the app's own commands, not to this listing.
      const { openDialog, list } = await renderAnnotatedListing();

      expect(fireEvent.keyDown(list, { key: "l", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(list, { key: "l", metaKey: true })).toBe(true);
      expect(fireEvent.keyDown(list, { key: "l", altKey: true })).toBe(true);
      expect(openDialog).not.toHaveBeenCalled();
    });

    it("ignores a shortcut whose menu item is disabled", async () => {
      /*
       * Availability is read off the menu entry rather than re-derived, so the two can never
       * disagree. With the selection cleared every row action is disabled — but Manage Labels acts
       * on the whole bank and still answers.
       */
      // --- Never selected, rather than deselected: the listing has no gesture that clears a
      // --- selection once made, so an untouched listing is how this state is actually reached.
      const { openDialog, list } = await renderAnnotatedListing({ select: false });
      expect(screen.getByTestId("disassembly-row-0")).not.toHaveAttribute("data-selected");

      expect(press(list, "l")).toBe(true);
      expect(press(list, "c")).toBe(true);
      expect(openDialog).not.toHaveBeenCalled();

      // --- Manage Labels acts on the whole bank, so a rowless listing still reaches it.
      expect(press(list, "m")).toBe(false);
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));

      /*
       * Manage Regions is refused, not accepted-then-ignored. It reads as bank-wide, but the
       * controller seeds its dialog from the active row's offset and cannot run without one — so
       * its menu entry is disabled here, and the shortcut follows the entry rather than its own
       * idea of availability. `true` is the key travelling on untouched.
       */
      expect(press(list, "r")).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(openDialog).toHaveBeenCalledTimes(1);
    });
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
    expect(screen.getByText("Manage Labels...")).toBeInTheDocument();
    expect(screen.getByText("Manage Regions...")).toBeInTheDocument();
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
    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].lineAnnotations["0"]).toEqual({
      synopsis: "Entry point",
      comment: "updated note"
    });
  });

  it("clears row annotations for the selected disassembly range", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              lineAnnotations: {
                "0": { comment: "first note" },
                "1": { synopsis: "Second note", comment: "second note" },
                "3": { comment: "outside range" }
              }
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const contents = new Uint8Array(0x4000);
    contents.set([0x00, 0x00, 0x00, 0x00]);

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
      contents
    );

    await screen.findByText("; Second note");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByTestId("disassembly-row-2"), { shiftKey: true });
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));
    fireEvent.click(screen.getByText("Clear Row Annotations"));

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0")).not.toHaveAttribute("data-selected")
    );
    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].lineAnnotations).toEqual({
      "3": { comment: "outside range" }
    });
  });

  it("clears a selected byte region span by marking it as disassembly", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [
                { start: 0, end: 11, type: "bytes" },
                { start: 12, end: 0x3fff, type: "disassemble" }
              ]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]);

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
      contents
    );

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
        "data-annotation-offset",
        "4"
      )
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute(
      "data-annotation-region",
      "bytes"
    );

    fireEvent.click(screen.getByTestId("disassembly-row-1"));
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));
    fireEvent.click(screen.getByText("Clear Row Annotations"));

    expect(screen.getByTestId("disassembly-row-1")).not.toHaveAttribute("data-selected");
    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].regions).toEqual([
      { start: 0, end: 3, type: "bytes" },
      { start: 4, end: 7, type: "disassemble" },
      { start: 8, end: 11, type: "bytes" },
      { start: 12, end: 0x3fff, type: "disassemble" }
    ]);
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
    /*
     * Two dialogs now, not one: the label dialog returns the delete, and the delete is confirmed
     * through the app's own `ConfirmDialog` rather than `window.confirm`. The confirmation is
     * answered by its title, which is also what asserts it was asked at all.
     */
    const openDialog = vi.fn((_component: any, _props: any, options?: any) =>
      Promise.resolve(
        options?.title === "Delete label"
          ? true
          : {
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
            }
      )
    );
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

    // --- `call ` and `GlobalSetup` are separate elements: an annotated listing paints a resolved
    // --- operand label in its own colour, so the row's text is matched rather than one node's.
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0").textContent).toContain("call GlobalSetup")
    );
    fireEvent.contextMenu(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Add/Edit Global Label..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(2));
    expect(openDialog.mock.calls[0][1].labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "global",
          name: "GlobalSetup",
          referenced: true
        })
      ])
    );

    // --- The confirmation names the label and the second, invisible consequence of saying yes.
    const [confirmComponent, confirmRequest, confirmOptions] = openDialog.mock.calls[1] as any[];
    // --- By name, not identity: the component under test is imported through `vi.doMock`'s own
    // --- module registry, so its `ConfirmDialog` is a different instance from this file's would be.
    expect(confirmComponent.name).toBe("ConfirmDialog");
    expect(confirmRequest.code).toBe("GlobalSetup");
    expect(confirmRequest.linesAfterCode).toEqual([
      "2 operand references to it will be cleared."
    ]);
    expect(confirmRequest.danger).toBe(true);
    expect(confirmOptions.dialogRole).toBe("alertdialog");

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

    // --- `call ` and `GlobalSetup` are separate elements: an annotated listing paints a resolved
    // --- operand label in its own colour, so the row's text is matched rather than one node's.
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0").textContent).toContain("call GlobalSetup")
    );
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
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByTestId("disassembly-row-1"), { shiftKey: true });
    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-selected-range",
      "true"
    );
    expect(screen.getByTestId("disassembly-row-1")).toHaveAttribute("data-selected", "true");

    fireEvent.contextMenu(screen.getByTestId("disassembly-row-1"));
    fireEvent.click(screen.getByText("Mark As Bytes"));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      initialType: "bytes",
      initialStart: 0,
      initialEnd: 4,
      regions: [
        { start: 0, end: 3, type: "bytes" },
        { start: 4, end: 7, type: "disassemble" },
        { start: 8, end: 0x3fff, type: "bytes" }
      ]
    });
    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0")).not.toHaveAttribute(
        "data-selected-range"
      )
    );
    expect(screen.getByTestId("disassembly-row-1")).not.toHaveAttribute("data-selected");

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    const savedAnnotations = JSON.parse(saveFileContent.mock.calls[0][1]);
    expect(savedAnnotations.banks["5"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "bytes" }
    ]);
  });

  it("opens the region manager and then the memory region dialog from the toolbar", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [
                { start: 0, end: 3, type: "bytes" },
                { start: 4, end: 0x3fff, type: "disassemble" }
              ]
            }
          }
        })
      )
    );
    const openDialog = vi.fn()
      .mockResolvedValueOnce({
        action: "edit",
        region: { start: 0, end: 3, type: "bytes" }
      })
      .mockResolvedValueOnce(undefined);
    const contents = new Uint8Array(0x4000);
    contents.set([1, 2, 3, 4, 0]);

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
      contents,
      openDialog
    );

    await waitFor(() =>
      expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
        "data-annotation-region",
        "bytes"
      )
    );
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Regions..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(2));
    expect(openDialog.mock.calls[0][0].name).toBe("NexRegionsDialog");
    expect(openDialog.mock.calls[0][1]).toMatchObject({
      activeOffset: 0,
      regions: [
        { start: 0, end: 3, type: "bytes" },
        { start: 4, end: 0x3fff, type: "disassemble" }
      ]
    });
    expect(openDialog.mock.calls[1][0].name).toBe("NexRegionDialog");
    expect(openDialog.mock.calls[1][1]).toMatchObject({
      initialType: "bytes",
      initialStart: 0,
      initialEnd: 3,
      regions: [
        { start: 0, end: 3, type: "bytes" },
        { start: 4, end: 0x3fff, type: "disassemble" }
      ]
    });
  });

  describe("sprites view", () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {}
      })) as any);
    });

    const spriteSidecar = (bank: Record<string, unknown> = {}) =>
      vi.fn(() =>
        Promise.resolve(
          JSON.stringify({
            schemaVersion: 2,
            banks: {
              "5": {
                offsetIndex: 1,
                lastView: "disassembly",
                regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
                ...bank
              }
            }
          })
        )
      );

    const renderBank = (
      readFileContent: ReturnType<typeof vi.fn>,
      viewState: Record<string, unknown> = {},
      saveFileContent = vi.fn(() => Promise.resolve())
    ) =>
      renderStaticMemoryDump(
        {
          disassemblyEnabled: true,
          viewMode: "disassembly",
          disassOffset: 0x4000,
          nexAnnotationPath: "/project/game.nex.dis",
          nexAnnotationBank: 5,
          ...viewState
        },
        readFileContent,
        saveFileContent
      );

    const viewModes = () =>
      Array.from((screen.getByTestId("view-mode") as HTMLSelectElement).options).map((o) => o.value);

    it("is offered for a NEX bank and not for a plain dump", async () => {
      await renderBank(spriteSidecar());
      expect(viewModes()).toEqual(["memory", "disassembly", "sprites"]);
      cleanup();
      await renderStaticMemoryDump({ disassemblyEnabled: true });
      expect(viewModes()).toEqual(["memory", "disassembly"]);
    });

    it("falls back to memory when a plain dump's view state asks for sprites", async () => {
      await renderStaticMemoryDump({ disassemblyEnabled: true, viewMode: "sprites" });
      expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toBe("memory");
      expect(screen.queryByTestId("nex-sprites-sheet")).toBeNull();
    });

    it("switches to the sheet, remembering it without touching lastView", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      const harness = await renderBank(spriteSidecar(), {}, saveFileContent);
      await screen.findByTestId("disassembly-row-0");

      fireEvent.change(screen.getByTestId("view-mode"), { target: { value: "sprites" } });

      expect(await screen.findByTestId("nex-sprites-sheet")).toBeInTheDocument();
      expect(within(screen.getByTestId("nex-sprites-sheet")).getAllByRole("option").length).toBe(64);
      await waitFor(() =>
        expect(harness.setDocumentViewState).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({ viewMode: "sprites" })
        )
      );
      // --- Remembered as `sprites.active`, so a reopened bank shows it; `lastView` keeps the listing
      // --- an older build can open.
      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
      expect(saved.banks["5"].sprites).toEqual({ active: true });
      expect(saved.banks["5"].lastView).toBe("disassembly");
    });

    it("forgets the Sprites view when switching back to a listing", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      await renderBank(spriteSidecar({ sprites: { active: true } }), { viewMode: "sprites" }, saveFileContent);
      await screen.findByTestId("nex-sprites-sheet");

      fireEvent.change(screen.getByTestId("view-mode"), { target: { value: "memory" } });

      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
      expect(saved.banks["5"]).not.toHaveProperty("sprites");
      expect(saved.banks["5"].lastView).toBe("memory");
      // --- The one write must not have bounced the view back to Sprites.
      expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toBe("memory");
    });

    it("opens in Sprites when the sidecar says it was showing, whatever lastView says", async () => {
      await renderBank(spriteSidecar({ lastView: "memory", sprites: { active: true } }), {
        viewMode: "memory"
      });
      expect(await screen.findByTestId("nex-sprites-sheet")).toBeInTheDocument();
      expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toBe("sprites");
    });

    it("stays on sprites when the sidecar changes underneath it", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      await renderBank(spriteSidecar({ sprites: { active: true } }), { viewMode: "sprites" }, saveFileContent);
      await screen.findByTestId("nex-sprites-sheet");

      // --- A region edit publishes a new model; the remembered lastView must not win.
      fireEvent.click(screen.getAllByRole("button", { name: "Mark as Bytes" })[0]);
      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toBe("sprites");
      const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
      expect(saved.banks["5"].lastView).toBe("disassembly");
      expect(saved.banks["5"].regions).toContainEqual({ start: 0, end: 0xff, type: "bytes" });
    });

    it("reads format and offset from the sidecar, and writes changes back", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      await renderBank(
        spriteSidecar({ sprites: { format: "4bit", offset: 3, active: true } }),
        { viewMode: "sprites" },
        saveFileContent
      );

      await waitFor(() => expect(within(screen.getByTestId("nex-sprites-sheet")).getAllByRole("option").length).toBe(127));
      expect(screen.getByLabelText("Sprite start offset")).toHaveValue("$0003");

      fireEvent.click(screen.getByRole("button", { name: "8-bit" }));
      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      expect(JSON.parse(saveFileContent.mock.calls.at(-1)[1]).banks["5"].sprites).toEqual({
        offset: 3,
        active: true
      });

      fireEvent.click(screen.getByTitle("Back one byte"));
      await waitFor(() =>
        expect(JSON.parse(saveFileContent.mock.calls.at(-1)[1]).banks["5"].sprites).toEqual({
          offset: 2,
          active: true
        })
      );

      // --- Back to 8-bit at $0000: the defaults are not stored, only the flag remains.
      fireEvent.click(screen.getByTitle("Back one pattern"));
      await waitFor(() =>
        expect(JSON.parse(saveFileContent.mock.calls.at(-1)[1]).banks["5"].sprites).toEqual({
          active: true
        })
      );
    });

    it("keeps the palette and zoom in view state only", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      const harness = await renderBank(
        spriteSidecar({ sprites: { active: true } }),
        { viewMode: "sprites" },
        saveFileContent
      );
      await screen.findByTestId("nex-sprites-sheet");

      fireEvent.click(screen.getByRole("button", { name: "Secondary" }));
      fireEvent.click(screen.getByRole("button", { name: "4×" }));

      await waitFor(() =>
        expect(harness.setDocumentViewState).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({ spritePalette: 1, spriteZoom: 4 })
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(saveFileContent).not.toHaveBeenCalled();
    });

    it("says it is showing the default palette with no machine", async () => {
      await renderBank(spriteSidecar({ sprites: { active: true } }), { viewMode: "sprites" });
      expect(await screen.findByText("Default palette")).toBeInTheDocument();
    });

    it("opens Memory at a pattern, recorded so Go Back returns to it", async () => {
      const harness = await renderBank(spriteSidecar({ sprites: { active: true } }), {
        viewMode: "sprites",
        spriteAnchor: 9,
        spriteActive: 9
      });
      await screen.findByTestId("nex-sprites-sheet");
      expect(harness.getDocumentApi().getNavigationLocator()).toEqual({
        kind: "address",
        address: 0x4900,
        viewMode: "sprites",
        base: 0x4000
      });

      fireEvent.click(screen.getByRole("button", { name: "Show in Memory" }));

      await waitFor(() =>
        expect(harness.navigationHistoryService.recordJump).toHaveBeenCalledWith(
          "memoryGoTo",
          expect.any(Function)
        )
      );
      await waitFor(() =>
        expect((screen.getByTestId("view-mode") as HTMLSelectElement).value).toBe("memory")
      );
      await waitFor(() =>
        expect(harness.virtualApi.scrollToIndex).toHaveBeenCalledWith(0x90, { align: "start" })
      );

      act(() =>
        harness.getDocumentApi().revealLocator({
          kind: "address",
          address: 0x4a05,
          viewMode: "sprites"
        })
      );
      await waitFor(() => expect(within(screen.getByTestId("nex-sprites-sheet")).getAllByRole("option")[10]).toHaveAttribute("aria-selected", "true"));
    });

    it("still loads an old sidecar and writes no sprites block for a bank never changed", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      await renderBank(
        vi.fn(() =>
          Promise.resolve(
            JSON.stringify({
              schemaVersion: 1,
              banks: { "5": { offsetIndex: 1, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }] } }
            })
          )
        ),
        { viewMode: "sprites" },
        saveFileContent
      );
      await screen.findByTestId("nex-sprites-sheet");
      fireEvent.click(screen.getByRole("button", { name: "Secondary" }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(saveFileContent).not.toHaveBeenCalled();
    });
  });

  describe("bank comment chip and strip", () => {
    const commentSidecar = (comment?: string) =>
      vi.fn(() =>
        Promise.resolve(
          JSON.stringify({
            schemaVersion: 2,
            banks: {
              "5": {
                offsetIndex: 2,
                ...(comment ? { comment } : {}),
                regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
              }
            }
          })
        )
      );

    const renderBank = (
      readFileContent: ReturnType<typeof vi.fn>,
      viewState: Record<string, unknown> = {},
      saveFileContent = vi.fn(() => Promise.resolve()),
      openDialog = vi.fn(() => Promise.resolve(undefined))
    ) =>
      renderStaticMemoryDump(
        {
          disassemblyEnabled: true,
          viewMode: "disassembly",
          disassOffset: 0x8000,
          nexAnnotationPath: "/project/game.nex.dis",
          nexAnnotationBank: 5,
          ...viewState
        },
        readFileContent,
        saveFileContent,
        new Uint8Array(0x4000),
        openDialog
      );

    it("shows no chip for a bank without a comment", async () => {
      await renderBank(commentSidecar());
      await screen.findByTestId("disassembly-row-0");
      await waitFor(() => expect(screen.getByText("Annotations")).not.toBeDisabled());
      expect(screen.queryByRole("button", { name: /Music/ })).toBeNull();
      expect(screen.queryByRole("note", { name: "Bank comment" })).toBeNull();
    });

    it("shows the comment in a toolbar chip, and its whole text in a popover", async () => {
      await renderBank(commentSidecar("Music player\n\nIM2 handler"));

      const chip = await screen.findByRole("button", { name: /Music player/ });
      expect(chip.textContent).toContain("Music player \u00b7 IM2 handler");
      expect(chip).toHaveAttribute("aria-expanded", "false");
      // --- Takes no row: nothing is drawn under the toolbar until it is pinned.
      expect(screen.queryByRole("note", { name: "Bank comment" })).toBeNull();

      fireEvent.click(chip);
      const popover = await screen.findByRole("dialog", { name: "Bank $05 comment" });
      expect(popover.textContent).toContain("Music player\n\nIM2 handler");
      expect(chip).toHaveAttribute("aria-expanded", "true");

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Bank $05 comment" })).toBeNull()
      );
    });

    it("edits from the popover", async () => {
      const openDialog = vi.fn(() => Promise.resolve(undefined));
      await renderBank(commentSidecar("Music"), {}, undefined, openDialog);

      fireEvent.click(await screen.findByRole("button", { name: /Music/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Edit..." }));

      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][0].name).toBe("NexBankCommentDialog");
      expect(screen.queryByRole("dialog", { name: "Bank $05 comment" })).toBeNull();
    });

    it("pins the comment into a strip, in view state, without writing the sidecar", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      const harness = await renderBank(commentSidecar("Music player\nIM2 handler"), {}, saveFileContent);

      fireEvent.click(await screen.findByRole("button", { name: /Music player/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Pin" }));

      const strip = await screen.findByRole("note", { name: "Bank comment" });
      expect(strip.textContent).toContain("Music player \u00b7 IM2 handler");
      // --- Pinned replaces the chip rather than adding to it.
      expect(screen.queryByTitle("Show this bank's comment")).toBeNull();
      await waitFor(() =>
        expect(harness.setDocumentViewState).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({ bankCommentPinned: true })
        )
      );
      expect(saveFileContent).not.toHaveBeenCalled();
    });

    /** Make the strip's one-line text wider than the room it gets, as a long comment would be. */
    const overflowStrip = () => {
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(600);
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    };

    it("offers no expand button when the comment fits on its one line", async () => {
      // --- jsdom lays nothing out, so the measured copy is never wider than the text: it fits.
      await renderBank(commentSidecar("Music player\nIM2 handler"), {
        bankCommentPinned: true,
        // --- Left expanded from before: with nothing to reveal it still shows one line.
        bankCommentExpanded: true
      });

      const strip = await screen.findByRole("note", { name: "Bank comment" });
      expect(within(strip).queryByText("Show the whole comment")).toBeNull();
      expect(within(strip).queryByText("Show the comment on one line")).toBeNull();
      expect(within(strip).getByTitle("Edit the bank comment").textContent).toBe(
        "Music player \u00b7 IM2 handler"
      );
      expect(within(strip).getByText("Unpin the bank comment")).toBeInTheDocument();
    });

    it("expands and unpins the strip", async () => {
      overflowStrip();
      await renderBank(commentSidecar("Music player\nIM2 handler"), { bankCommentPinned: true });

      const strip = await screen.findByRole("note", { name: "Bank comment" });
      fireEvent.click(within(strip).getByText("Show the whole comment"));
      await waitFor(() =>
        expect(within(strip).getByTitle("Edit the bank comment").textContent).toBe(
          "Music player\nIM2 handler"
        )
      );

      fireEvent.click(within(strip).getByText("Unpin the bank comment"));
      await waitFor(() => expect(screen.queryByRole("note", { name: "Bank comment" })).toBeNull());
      expect(await screen.findByTitle("Show this bank's comment")).toBeInTheDocument();
    });
  });

  it("opens the toolbar menu without a row, offering only the whole-bank commands", async () => {
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
    const openDialog = vi.fn(() => Promise.resolve(undefined));

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    await waitFor(() => expect(screen.getByText("Annotations")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Annotations"));

    expect(await screen.findByText("Bank Comment...")).not.toBeDisabled();
    expect(screen.getByText("Synopsis Comment...")).toBeDisabled();
    expect(screen.getByText("Clear Row Annotations")).toBeDisabled();
    expect(openDialog).not.toHaveBeenCalled();
  });

  it("edits the bank comment from the toolbar menu and writes it", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 2,
          banks: {
            "5": {
              offsetIndex: 2,
              comment: "Old",
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
            }
          }
        })
      )
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const openDialog = vi.fn(() => Promise.resolve({ comment: "Music player\nIM2 handler" }));

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    await waitFor(() => expect(screen.getByText("Annotations")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(await screen.findByText("Bank Comment..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
    expect(openDialog.mock.calls[0][0].name).toBe("NexBankCommentDialog");
    expect(openDialog.mock.calls[0][1]).toEqual({ bank: 5, initialComment: "Old" });
    await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
    const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
    expect(saved.banks["5"].comment).toBe("Music player\nIM2 handler");
  });

  it("asks before applying a full-bank memory region change", async () => {
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
    const openDialog = vi.fn()
      .mockResolvedValueOnce({
        action: "edit",
        region: { start: 0, end: 0x3fff, type: "disassemble" }
      })
      .mockResolvedValueOnce({
        type: "bytes",
        start: 0,
        end: 0x3fff
      });
    vi.stubGlobal("confirm", vi.fn(() => false));

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
      new Uint8Array(0x4000),
      openDialog
    );

    await screen.findByTestId("disassembly-row-0");
    fireEvent.click(screen.getByTestId("disassembly-row-0"));
    fireEvent.click(screen.getByText("Annotations"));
    fireEvent.click(screen.getByText("Manage Regions..."));

    await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(window.confirm).toHaveBeenCalledWith(
        "This changes the entire 16K bank. Continue?"
      )
    );
    expect(saveFileContent).not.toHaveBeenCalled();
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
    expect(saveFileContent).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("view-mode"), {
      target: { value: "disassembly" }
    });
    fireEvent.click(screen.getByTestId("switch-Decimal"));
    fireEvent.change(screen.getByTestId("disassembly-offset"), {
      target: { value: "49152" }
    });

    // --- Written without being asked. Three settings, and the last write carries all three: the
    // --- session coalesces a burst rather than writing once per control.
    await waitFor(() => {
      const last = saveFileContent.mock.calls.at(-1);
      expect(last?.[0]).toBe("/project/game.nex.dis");
      expect(JSON.parse(last![1]).banks["5"]).toMatchObject({
        offsetIndex: 3,
        lastView: "disassembly",
        decimalView: true
      });
    });

    /*
     * And the tab was never marked unsaved.
     *
     * Switching a bank to Memory view used to leave the document dirty until the user pressed Save,
     * which is the clearest case for why the save was worth removing: a view setting is not an edit
     * anybody thinks of themselves as making.
     */
    expect(screen.queryByText("Annotations loaded")).not.toBeInTheDocument();
    expect(harness.document.savedVersionCount).toBe(harness.document.editVersionCount);
  });

  /*
   * Closing asks only when the sidecar could not be written.
   *
   * With every edit written as it is made, the old "discard unsaved changes?" question fired on
   * gestures nobody thought of as edits — switching a bank to Memory view was enough. What is left
   * is the case where the question is true: a write that failed, leaving edits nowhere but memory.
   */
  describe("disposal", () => {
    const SIDECAR = JSON.stringify({
      schemaVersion: 1,
      banks: {
        "5": {
          offsetIndex: 2,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
        }
      }
    });

    async function editedBank(saveFileContent: ReturnType<typeof vi.fn>) {
      const readFileContent = vi.fn(() => Promise.resolve(SIDECAR));
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
      fireEvent.change(screen.getByTestId("view-mode"), {
        target: { value: "disassembly" }
      });
      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      return harness;
    }

    it("closes without asking once the edit is written", async () => {
      vi.stubGlobal("confirm", vi.fn(() => false));
      const harness = await editedBank(vi.fn(() => Promise.resolve()));

      await expect(harness.getDocumentApi().beforeDocumentDisposal()).resolves.toBe(true);
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it("asks before discarding edits whose write failed", async () => {
      vi.stubGlobal("confirm", vi.fn(() => false));
      const harness = await editedBank(
        vi.fn(() => Promise.reject(new Error("EACCES: read-only")))
      );

      await waitFor(() => expect(harness.document.editVersionCount).not.toBe(
        harness.document.savedVersionCount
      ));
      await expect(harness.getDocumentApi().beforeDocumentDisposal()).resolves.toBe(false);
      expect(window.confirm).toHaveBeenCalledWith(
        "/project/game.nex.dis could not be written (EACCES: read-only).\n\n" +
          "Closing this bank discards the annotation changes it still holds. Close anyway?"
      );
    });
  });
});
