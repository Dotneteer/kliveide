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
  workspace?: Record<string, unknown>;
};

async function renderDisassemblyPanel({
  machineState = MachineControllerState.Paused,
  viewState = {},
  workspace = {}
}: HarnessOptions = {}) {
  vi.resetModules();

  const dispatch = vi.fn();
  const saveProject = vi.fn(() => Promise.resolve());
  const saveActiveDocumentState = vi.fn();
  const getMemoryContents = vi.fn(() =>
    Promise.resolve({
      memory: new Uint8Array(0x1_0000),
      pc: 0x6000,
      partitionLabels: ["R0", "R1"],
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
    workspaceSettings: {
      Disassembly: {
        autoRefresh: true,
        bankLabel: true,
        decimalView: false,
        isFullView: true,
        ram: true,
        screen: false,
        topAddress: 0,
        ...workspace
      }
    }
  };
  const documentHubService = {
    getDocumentViewState: vi.fn(() => viewState),
    saveActiveDocumentState
  };
  const emuApi = {
    getDisassemblySections: vi.fn(() => Promise.resolve([])),
    getMemoryContents,
    getPartitionLabels: vi.fn(() => Promise.resolve({ [-1]: "R0", 0: "B0" }))
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
    useSelector: (selector: (appState: typeof state) => unknown) => selector(state)
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
      renderItem
    }: {
      apiLoaded?: (api: typeof virtualApi) => void;
      itemSize?: number;
      items?: unknown[];
      onScroll?: () => void;
      onScrollEnd?: () => void;
      revealUnmeasuredItems?: boolean;
      renderItem: (index: number, item: unknown) => ReactNode;
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
          data-testid="disassembly-list"
        >
          {items.slice(0, 2).map((item, index) => (
            <div data-testid={`disassembly-row-${index}`} key={index}>
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
    saveActiveDocumentState,
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
  it("renders the initial disassembly rows and breakpoint state", async () => {
    const { disassemblerFactory, getMemoryContents } = await renderDisassemblyPanel();

    expect(getMemoryContents).toHaveBeenCalledWith(undefined);
    expect(disassemblerFactory).toHaveBeenCalled();
    expect(screen.getByTestId("disassembly-list")).toHaveAttribute("data-item-size", "18");
    expect(screen.getByTestId("disassembly-list")).toHaveAttribute(
      "data-reveal-unmeasured",
      "true"
    );
    expect(screen.getByText("LD A,1")).toBeInTheDocument();
    expect(screen.getByText("LD (4000H),A")).toBeInTheDocument();
    expect(screen.getByTestId("breakpoint-0:$6000")).toHaveAttribute("data-current", "true");
    expect(screen.getByTestId("breakpoint-0:$6000")).toHaveAttribute("data-has-breakpoint", "true");
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
      saveActiveDocumentState,
      saveProject,
      triggerVirtualScroll,
      triggerVirtualScrollEnd,
      virtualApi
    } = await renderDisassemblyPanel();
    virtualApi.findStartIndex.mockReturnValue(1);
    saveActiveDocumentState.mockClear();
    saveProject.mockClear();

    triggerVirtualScroll();
    await Promise.resolve();

    expect(saveActiveDocumentState).not.toHaveBeenCalled();
    expect(saveProject).not.toHaveBeenCalled();

    triggerVirtualScrollEnd();

    await waitFor(() => {
      expect(saveActiveDocumentState).toHaveBeenCalledWith(
        expect.objectContaining({ topAddress: 0x6002 })
      );
    });
  });
});
