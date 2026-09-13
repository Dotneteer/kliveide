import { MachineControllerState } from "@abstractions/MachineControllerState";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const outputItems = [
  {
    address: 0x6000,
    opCodes: [0x3e, 0x01],
    instruction: "LD A,1",
    hasLabel: true,
    hardComment: "entry",
    tstates: 7
  },
  {
    address: 0x6002,
    opCodes: [0x32, 0x00, 0x40],
    instruction: "LD (4000H),A",
    hasLabel: false,
    tstates: 13
  }
];

type HarnessOptions = {
  machineState?: MachineControllerState;
  viewState?: Record<string, unknown>;
  /** Override the live paging, to page something other than the breakpoint's partition in. */
  pageLabels?: string[];
};

async function renderDisassemblyPanel({
  machineState = MachineControllerState.Paused,
  viewState = {},
  pageLabels
}: HarnessOptions = {}) {
  vi.resetModules();

  const dispatch = vi.fn();
  const saveProject = vi.fn(() => Promise.resolve());
  const setDocumentViewState = vi.fn();
  const getMemoryContents = vi.fn(() =>
    Promise.resolve({
      memory: new Uint8Array(0x1_0000),
      pc: 0x6000,
      // --- The live paging, one label per 8K page, exactly as `getCurrentPartitionLabels()`
      // --- reports it — eight entries, because the views index it with `address >> 13`. It used to
      // --- be a two-element stub, which was harmless only while nothing read past index 1.
      //
      // --- It now has to agree with `memBreakpoints` below: the breakpoint at `$6000` is scoped to
      // --- partition 0, and `$6000 >> 13` is page 3, so page 3 must hold partition 0 (`B0` in the
      // --- `getPartitionLabels` mock) for the gutter to show it. A partition-scoped breakpoint is
      // --- only displayed where its partition is actually paged in.
      partitionLabels: pageLabels ?? ["R0", "R0", "B0", "B0", "B0", "B0", "B0", "B0"],
      selectedRom: 0,
      memBreakpoints: [
        {
          address: 0x6000,
          partition: 0,
          resource: "memory",
          disabled: false
        }
      ]
    })
  );
  const disassemble = vi.fn(() =>
    Promise.resolve({
      outputItems
    })
  );
  const setAddressOffset = vi.fn();
  const setCustomDisassembler = vi.fn();
  const disassemblerFactory = vi.fn(() => ({
    disassemble,
    setAddressOffset,
    setCustomDisassembler
  }));
  const state = {
    compilation: {
      injectionVersion: 1
    },
    emulatorState: {
      breakpointsVersion: 1,
      emuViewVersion: 1,
      machineId: "sp128",
      machineState
    },
    workspaceSettings: {}
  };
  const documentHubService = {
    getDocumentViewState: vi.fn(() => viewState),
    setDocumentViewState
  };
  const emuApi = {
    getDisassemblySections: vi.fn(() => Promise.resolve([])),
    getMemoryContents,
    getPartitionLabels: vi.fn(() => Promise.resolve({ [-1]: "R0", 0: "B0" })),
    getPartitionDescriptions: vi.fn(() => Promise.resolve({})),
    getPartitionGroups: vi.fn(() => Promise.resolve({}))
  };
  const virtualApi = {
    findStartIndex: vi.fn(() => 0),
    getItemOffset: vi.fn(() => 0),
    scrollTo: vi.fn(),
    scrollToIndex: vi.fn()
  };
  let emuStateCallback: (() => Promise<void>) | undefined;
  let virtualOnScroll: (() => void) | undefined;
  let virtualOnScrollEnd: (() => void) | undefined;

  vi.doMock("@common/machines/machine-registry", () => ({
    machineRegistry: [
      {
        machineId: "sp128",
        features: {
          bank: 8,
          rom: 2
        },
        toolInfo: {
          disassembler: disassemblerFactory
        }
      }
    ]
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => dispatch,
    useSelector: (selector: (appState: typeof state) => unknown) => selector(state),
    // --- The panel reads the row height through `useRowSizes`, which reads the panel font size.
    // --- Returning undefined lets `getRowSizes` fall back to its default, i.e. the 20/18px these
    // --- characterizations were written against.
    useGlobalSetting: () => undefined
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => documentHubService
  }));
  vi.doMock("@renderer/core/EmuApi", () => ({
    useEmuApi: () => emuApi
  }));
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ saveProject })
  }));
  vi.doMock("@renderer/appIde/useStateRefresh", () => ({
    useEmuStateListener: (_emuApi: unknown, callback: () => Promise<void>) => {
      emuStateCallback = callback;
    }
  }));
  // --- The panel opens the breakpoint editor through this hook, which reaches `AppServicesProvider`
  // --- and from there drags Monaco into the module graph — Monaco touches `document` APIs jsdom
  // --- does not implement. The panel's own editing path is covered in `BreakpointsPanelActions`.
  vi.doMock("@renderer/appIde/dialogs/useBreakpointDialog", () => ({
    useBreakpointDialog: () => vi.fn().mockResolvedValue(false)
  }));
  vi.doMock("@renderer/appIde/DocumentPanels/BreakpointIndicator", () => ({
    BreakpointIndicator: ({
      address,
      current,
      hasBreakpoint,
      partition
    }: {
      address: number | string;
      current: boolean;
      hasBreakpoint: boolean;
      partition?: string;
    }) => (
      <span
        data-address={address}
        data-current={String(current)}
        data-has-breakpoint={String(hasBreakpoint)}
        data-partition={partition ?? ""}
        data-testid={`breakpoint-${address}`}
      />
    )
  }));
  vi.doMock("@renderer/controls/VirtualizedList", () => ({
    VirtualizedList: ({
      apiLoaded,
      itemSize,
      items = [],
      onScroll,
      onScrollEnd,
      revealUnmeasuredItems,
      renderItem,
      scrollRowsHorizontally
    }: {
      apiLoaded?: (api: typeof virtualApi) => void;
      itemSize?: number;
      items?: unknown[];
      onScroll?: () => void;
      onScrollEnd?: () => void;
      revealUnmeasuredItems?: boolean;
      renderItem: (index: number, item: unknown) => ReactNode;
      scrollRowsHorizontally?: boolean;
    }) => {
      virtualOnScroll = onScroll;
      virtualOnScrollEnd = onScrollEnd;
      React.useEffect(() => {
        apiLoaded?.(virtualApi);
      }, [apiLoaded]);
      return (
        <div
          data-item-size={String(itemSize)}
          data-reveal-unmeasured={String(revealUnmeasuredItems)}
          data-scroll-horizontally={String(!!scrollRowsHorizontally)}
          data-testid="disassembly-list"
        >
          {/* --- `-slot-`, not `-row-`: `DisassemblyRow` tags itself `disassembly-row-<index>`. */}
          {items.slice(0, 2).map((item, index) => (
            <div data-testid={`disassembly-row-slot-${index}`} key={index}>
              {renderItem(index, item)}
            </div>
          ))}
        </div>
      );
    }
  }));
  vi.doMock("@renderer/controls/AddressInput", () => ({
    AddressInput: ({
      decimalView,
      label,
      onAddressSent
    }: {
      decimalView: boolean;
      label: string;
      onAddressSent?: (address: number) => Promise<void>;
    }) => (
      <input
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void onAddressSent?.(parseInt(event.currentTarget.value, decimalView ? 10 : 16));
          }
        }}
      />
    )
  }));
  vi.doMock("@renderer/controls/IconButton", () => ({
    SmallIconButton: ({
      clicked,
      enable = true,
      title
    }: {
      clicked?: () => void;
      enable?: boolean;
      title: string;
    }) => (
      <button disabled={!enable} onClick={() => clicked?.()}>
        {title}
      </button>
    )
  }));
  vi.doMock("@renderer/controls/LabeledSwitch", () => ({
    LabeledSwitch: ({
      clicked,
      label,
      value
    }: {
      clicked?: (value: boolean) => void;
      label: string;
      value: boolean;
    }) => (
      <button onClick={() => clicked?.(!value)}>
        {label}:{value ? "on" : "off"}
      </button>
    )
  }));
  vi.doMock("@renderer/controls/Dropdown", () => ({
    default: ({
      initialValue,
      onChanged,
      options
    }: {
      initialValue?: string;
      onChanged?: (value: string) => void;
      options: { value: string; label: string }[];
    }) => (
      <select
        aria-label="dropdown"
        onChange={(event) => onChanged?.(event.currentTarget.value)}
        value={initialValue}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }));
  vi.doMock("@renderer/controls/new/BankDropdown", () => ({
    default: ({ onChanged }: { onChanged?: (value: number) => void }) => (
      <button onClick={() => onChanged?.(3)}>bank dropdown</button>
    )
  }));

  const { createBankedDisassemblyPanel: DisassemblyPanel } = await import(
    "@renderer/appIde/DocumentPanels/DisassemblyPanel"
  );

  const result = render(<DisassemblyPanel document={{ id: "disass-doc" } as never} />);
  await screen.findByText("LD A,1");

  return {
    ...result,
    dispatch,
    disassemble,
    disassemblerFactory,
    documentHubService,
    emuApi,
    emuStateCallback,
    getMemoryContents,
    setDocumentViewState,
    saveProject,
    triggerVirtualScroll: () => virtualOnScroll?.(),
    triggerVirtualScrollEnd: () => virtualOnScrollEnd?.(),
    virtualApi
  };
}

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("DisassemblyPanel refactor characterization", () => {
  /*
   * The gutter used to be keyed by address alone, so a breakpoint scoped to one bank lit up the
   * gutter while you were looking at another. This pins the negative half of the fix: the same
   * fixture as above, with a different bank paged in at the breakpoint's address.
   *
   * The positive half is the test below it, which only passes because page 3 holds `B0`.
   */
  it("hides a partition-scoped breakpoint when its partition is not paged in", async () => {
    // --- Arrange/Act: the breakpoint is scoped to partition 0 (`B0`) at `$6000` — page 3 — but
    // --- page 3 now holds ROM 0, so the breakpoint does not apply to any visible row.
    await renderDisassemblyPanel({
      pageLabels: ["R0", "R0", "R0", "R0", "R0", "R0", "R0", "R0"]
    });

    // --- Assert: the row renders, but with no breakpoint on it
    expect(screen.getByText("LD A,1")).toBeInTheDocument();
    expect(screen.queryByTestId("breakpoint-B0:$6000")).toBeNull();
    // --- With no breakpoint on the row, `DisassemblyRow` hands the indicator the raw address
    // --- rather than a display key — hence `24576` ($6000) rather than `B0:$6000`.
    expect(screen.getByTestId(`breakpoint-${0x6000}`)).toHaveAttribute(
      "data-has-breakpoint",
      "false"
    );
  });

  it("renders the initial disassembly rows and breakpoint state", async () => {
    const { disassemblerFactory, getMemoryContents } = await renderDisassemblyPanel();

    expect(getMemoryContents).toHaveBeenCalledWith(undefined);
    expect(disassemblerFactory).toHaveBeenCalled();
    expect(screen.getByTestId("disassembly-list")).toHaveAttribute("data-item-size", "18");
    /* --- Long operands and the bank/T-state columns overflow a narrow panel; see `MemoryPanel`. */
    expect(screen.getByTestId("disassembly-list")).toHaveAttribute(
      "data-scroll-horizontally",
      "true"
    );
    expect(screen.getByTestId("disassembly-list")).toHaveAttribute(
      "data-reveal-unmeasured",
      "true"
    );
    expect(screen.getByText("LD A,1")).toBeInTheDocument();
    expect(screen.getByText("LD (4000H),A")).toBeInTheDocument();
    // --- `B0:$6000`, not `0:$6000`: the row names a partition by its label now. It always showed
    // --- the label in `data-partition`; the address beside it used to disagree, giving one row two
    // --- names for one partition.
    const indicator = screen.getByTestId("breakpoint-B0:$6000");
    expect(indicator).toHaveAttribute("data-current", "true");
    expect(indicator).toHaveAttribute("data-has-breakpoint", "true");
    expect(indicator).toHaveAttribute("data-partition", "B0");

    // The row at the current PC (0x6000, matching the mocked `getMemoryContents().pc`) gets the
    // exec-point highlight; the other row does not.
    expect(screen.getByTestId("disassembly-row-slot-0").firstElementChild?.className).toContain(
      "execPoint"
    );
    expect(screen.getByTestId("disassembly-row-slot-1").firstElementChild?.className).not.toContain(
      "execPoint"
    );
  });

  /**
   * The label column stays at its default here.
   *
   * `DisassemblyRow` takes a `labelWidthCh` so the NEX annotation viewer — whose labels are named
   * by the user — can widen it. A machine disassembly only ever generates `L<addr>:`, so this panel
   * passes nothing and must keep the column it always had.
   */
  it("leaves the label column at the default width", async () => {
    await renderDisassemblyPanel();

    const labelCells = Array.from(
      screen.getByTestId("disassembly-list").querySelectorAll<HTMLElement>("span")
    ).filter((el) => el.className.includes("disassemblyLabel"));
    expect(labelCells.length).toBeGreaterThan(0);
    for (const cell of labelCells) {
      expect(cell.style.width).toBe("10ch");
    }
  });

  it("scrolls to the row containing a submitted address", async () => {
    const { virtualApi } = await renderDisassemblyPanel();

    const goTo = screen.getByLabelText("Go To");
    fireEvent.change(goTo, { target: { value: "6002" } });
    fireEvent.keyDown(goTo, { key: "Enter" });

    await waitFor(() => {
      expect(virtualApi.scrollToIndex).toHaveBeenCalledWith(1, { align: "start" });
    });
  });

  it("says so when Go To names an address past the disassembled range", async () => {
    /*
     * Regression: this scrolled nowhere and said nothing.
     *
     * The listing covers only the selected bank with the 64K view off, and about a kilobyte around
     * PC while Follow PC is on, so asking for an address outside it is ordinary. Discarding the
     * request silently is indistinguishable from Go To being broken — which is exactly how it was
     * reported.
     */
    const { virtualApi, dispatch } = await renderDisassemblyPanel();
    dispatch.mockClear();

    const goTo = screen.getByLabelText("Go To");
    fireEvent.change(goTo, { target: { value: "9000" } });
    fireEvent.keyDown(goTo, { key: "Enter" });

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const messages = dispatch.mock.calls
      .map((call: any) => JSON.stringify(call[0]))
      .join(" ");
    expect(messages).toContain("$9000");
    expect(messages).toContain("outside the disassembled range");
    expect(virtualApi.scrollToIndex).not.toHaveBeenCalled();
  });

  it("scrolls to the top for an address below the disassembled range", async () => {
    // --- No special case needed: `findIndex` lands on the first instruction at or after the
    // --- target, which is the top of the listing.
    const { virtualApi, dispatch } = await renderDisassemblyPanel();
    dispatch.mockClear();

    const goTo = screen.getByLabelText("Go To");
    fireEvent.change(goTo, { target: { value: "1000" } });
    fireEvent.keyDown(goTo, { key: "Enter" });

    await waitFor(() =>
      expect(virtualApi.scrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
    );
  });

  it("refreshes when the emulator state listener fires", async () => {
    const { emuStateCallback, getMemoryContents } = await renderDisassemblyPanel();
    getMemoryContents.mockClear();

    await emuStateCallback?.();

    await waitFor(() => {
      expect(getMemoryContents).toHaveBeenCalledWith(undefined);
    });
  });

  it("defers top-address persistence until virtual scrolling ends", async () => {
    const {
      setDocumentViewState,
      saveProject,
      triggerVirtualScroll,
      triggerVirtualScrollEnd,
      virtualApi
    } = await renderDisassemblyPanel();
    virtualApi.findStartIndex.mockReturnValue(1);
    setDocumentViewState.mockClear();
    saveProject.mockClear();

    triggerVirtualScroll();
    await Promise.resolve();

    expect(setDocumentViewState).not.toHaveBeenCalled();
    expect(saveProject).not.toHaveBeenCalled();

    triggerVirtualScrollEnd();

    await waitFor(() => {
      expect(setDocumentViewState).toHaveBeenCalledWith(
        "disass-doc",
        expect.objectContaining({ topAddress: 0x6002 })
      );
    });
  });

  it("refreshes with the follow-PC section immediately, not the stale manual one, when Follow PC is turned on", async () => {
    /*
     * Regression test for a stale-ref read: `onAutoRefreshChanged` used to call
     * `refreshDisassembly()` directly, which reads `cachedRefreshState.current.autoRefresh` - a
     * ref that `useDisassemblyViewStatePersistence` only updates in its own effect, one render
     * after this handler runs. So the very refresh this handler triggered still saw the *old*
     * `autoRefresh` (false), and ran a manual, full-range disassembly (via
     * `getDisassemblySections`) instead of the small ~1KB window around PC - the "few seconds"
     * delay this test guards against. `autoRefresh` is now a dependency of the effect that calls
     * `refreshDisassembly()`, which fires after the sync effect and so always sees the current
     * value.
     */
    const { disassemblerFactory } = await renderDisassemblyPanel({
      viewState: { autoRefresh: false }
    });
    disassemblerFactory.mockClear();

    fireEvent.click(screen.getByText("Follow PC:off"));

    await waitFor(() => {
      expect(disassemblerFactory).toHaveBeenCalled();
    });

    const [memSections] = disassemblerFactory.mock.calls.at(-1)!;
    // The follow-PC section: one section starting exactly at PC (0x6000, from the mocked
    // `getMemoryContents`) - not the empty list `getDisassemblySections` mocks for manual mode.
    expect(memSections).toHaveLength(1);
    expect(memSections[0].startAddress).toBe(0x6000);
  });
});
