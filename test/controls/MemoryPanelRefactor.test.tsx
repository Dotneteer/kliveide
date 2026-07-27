import { MachineControllerState } from "@abstractions/MachineControllerState";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MemoryPanelHarnessOptions = {
  machineId?: string;
  machineState?: MachineControllerState;
  partitionLabels?: Record<number, string>;
  romFlags?: boolean[];
  viewState?: Record<string, unknown>;
};

type DumpSectionProps = {
  address: number;
  bytes: readonly number[];
  charDump?: boolean;
  decimalView?: boolean;
  editClicked?: (address: number) => void;
  lastJumpAddress?: number;
  partitionLabel?: string;
  showPartitions?: boolean;
};

type DumpRenderEntry = {
  address: number;
  byteCount: number;
};

const createMemoryResponse = (memory: Uint8Array, partitionLabels = ["ROM0", "BANK0"]) => ({
  memory,
  pc: 0x6000,
  af: 0,
  bc: 0x1000,
  de: 0x2000,
  hl: 0x3000,
  af_: 0,
  bc_: 0x4000,
  de_: 0x5000,
  hl_: 0x6000,
  sp: 0x7000,
  ix: 0x8000,
  iy: 0x9000,
  ir: 0xa000,
  wz: 0xb000,
  partitionLabels,
  osInitialized: true,
  memBreakpoints: []
});

async function renderMemoryPanel({
  machineId = "sp48",
  machineState = MachineControllerState.Paused,
  partitionLabels = {},
  romFlags = new Array(8).fill(false),
  viewState = {}
}: MemoryPanelHarnessOptions = {}) {
  vi.resetModules();

  const dispatch = vi.fn();
  const executeCommand = vi.fn(() => Promise.resolve({ success: true }));
  const saveProject = vi.fn(() => Promise.resolve());
  const saveActiveDocumentState = vi.fn();
  const openDialog = vi.fn(() =>
    Promise.resolve({ value: "$34", sizeOption: "-b8", bigEndian: false })
  );
  const state = {
    emulatorState: {
      emuViewVersion: 1,
      machineId,
      machineState
    },
    workspaceSettings: {
      Memory: {
        charDump: true,
        decimalView: false,
        twoColumns: true
      }
    }
  };
  const activeDocument = { id: "memory-doc" };
  const documentHubService = {
    getActiveDocument: vi.fn(() => activeDocument),
    getDocumentViewState: vi.fn(() => viewState),
    saveActiveDocumentState
  };
  const memory = new Uint8Array(0x1_0000);
  for (let i = 0; i < memory.length; i++) {
    memory[i] = i & 0xff;
  }
  const getMemoryContents = vi.fn((partition?: number) =>
    Promise.resolve(createMemoryResponse(memory, partition === undefined ? ["ROM0", "BANK0"] : ["BANKED"]))
  );
  const emuApi = {
    getMemoryContents,
    getPartitionLabels: vi.fn(() => Promise.resolve(partitionLabels)),
    getRomFlags: vi.fn(() => Promise.resolve(romFlags))
  };
  const virtualApi = {
    findStartIndex: vi.fn(() => 0),
    getItemOffset: vi.fn(() => 0),
    scrollToIndex: vi.fn(),
    scrollTo: vi.fn()
  };
  const dumpRenderLog: DumpRenderEntry[] = [];
  let emuStateCallback: ((state: MachineControllerState) => Promise<void>) | undefined;

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
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      ideCommandsService: { executeCommand }
    })
  }));
  vi.doMock("@renderer/appIde/useStateRefresh", () => ({
    useEmuStateListener: (
      _emuApi: unknown,
      callback: (state: MachineControllerState) => Promise<void>
    ) => {
      emuStateCallback = callback;
    }
  }));
  vi.doMock("@renderer/controls/overlay/DialogProvider", () => ({
    useDialogs: () => ({ open: openDialog })
  }));
  vi.doMock("@renderer/controls/VirtualizedList", () => ({
    VirtualizedList: ({
      apiLoaded,
      items = [],
      renderItem,
      startIndex
    }: {
      apiLoaded?: (api: typeof virtualApi) => void;
      items?: number[];
      renderItem: (index: number, item: number) => ReactNode;
      startIndex?: number;
    }) => {
      React.useEffect(() => {
        apiLoaded?.(virtualApi);
      }, [apiLoaded]);
      return (
        <div data-testid="memory-list" data-start-index={startIndex}>
          {items.slice(0, 2).map((item, index) => (
            <div data-testid={`virtual-row-${index}`} key={item}>
              {renderItem(index, item)}
            </div>
          ))}
        </div>
      );
    }
  }));
  vi.doMock("@renderer/features/memory/MemoryDumpSection", () => ({
    MemoryDumpSection: ({
      address,
      bytes,
      charDump,
      decimalView,
      editClicked,
      lastJumpAddress,
      partitionLabel,
      showPartitions
    }: DumpSectionProps) => {
      dumpRenderLog.push({ address, byteCount: bytes.length });
      return (
        <button
          data-testid={`dump-${address}`}
          data-byte-count={bytes.length}
          data-char-dump={String(charDump)}
          data-decimal-view={String(decimalView)}
          data-last-jump={lastJumpAddress}
          data-partition={showPartitions ? partitionLabel ?? "" : ""}
          onContextMenu={(event) => {
            event.preventDefault();
            editClicked?.(address);
          }}
        >
          {address}:{bytes[0]}
        </button>
      );
    }
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
  vi.doMock("@renderer/controls/AddressInput", () => ({
    AddressInput: ({
      decimalView,
      label,
      onAddressSent,
      onGotFocus
    }: {
      decimalView: boolean;
      label: string;
      onAddressSent?: (address: number) => Promise<void>;
      onGotFocus?: () => void;
    }) => (
      <input
        aria-label={label}
        onFocus={() => onGotFocus?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void onAddressSent?.(parseInt(event.currentTarget.value, decimalView ? 10 : 16));
          }
        }}
      />
    )
  }));
  vi.doMock("@renderer/controls/Dropdown", () => ({
    default: ({
      initialValue,
      onChanged,
      onOpenChange,
      options,
      width
    }: {
      initialValue?: string;
      onChanged?: (value: string) => void;
      onOpenChange?: (open: boolean) => void;
      options: { value: string; label: string }[];
      width?: string | number;
    }) => (
      <select
        aria-label={`dropdown-${width}`}
        onBlur={() => onOpenChange?.(false)}
        onChange={(event) => onChanged?.(event.currentTarget.value)}
        onFocus={() => onOpenChange?.(true)}
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
      <button onClick={() => onChanged?.(5)}>bank dropdown</button>
    )
  }));

  const { createMemoryPanel: MemoryPanel } = await import(
    "@renderer/features/memory/MemoryPanel"
  );

  const result = render(<MemoryPanel document={{ id: "memory-doc" } as never} />);
  await screen.findByTestId("memory-list");

  return {
    ...result,
    dispatch,
    documentHubService,
    dumpRenderLog,
    emuStateCallback,
    executeCommand,
    getMemoryContents,
    memory,
    openDialog,
    saveProject,
    virtualApi
  };
}

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("MemoryPanel refactor characterization", () => {
  it("renders the initial 64K two-column memory rows", async () => {
    const { getMemoryContents } = await renderMemoryPanel();

    await waitFor(() => {
      expect(getMemoryContents).toHaveBeenCalledWith(undefined);
    });

    expect(screen.getByTestId("dump-0")).toHaveAttribute("data-byte-count", "8");
    expect(screen.getByTestId("dump-8")).toHaveAttribute("data-byte-count", "8");
    expect(screen.getByTestId("dump-0")).toHaveAttribute("data-char-dump", "true");
  });

  it("updates rendered row sections when the view mode changes", async () => {
    await renderMemoryPanel();

    fireEvent.change(screen.getByLabelText("dropdown-90"), { target: { value: "16x1" } });

    await waitFor(() => {
      expect(screen.getByTestId("dump-0")).toHaveAttribute("data-byte-count", "16");
    });
    expect(screen.queryByTestId("dump-8")).not.toBeInTheDocument();
    expect(screen.getByTestId("dump-16")).toHaveAttribute("data-byte-count", "16");
  });

  it("scrolls to the row containing the submitted address", async () => {
    const { virtualApi } = await renderMemoryPanel();

    const goTo = screen.getByLabelText("Go To");
    fireEvent.focus(goTo);
    fireEvent.change(goTo, { target: { value: "20" } });
    fireEvent.keyDown(goTo, { key: "Enter" });

    await waitFor(() => {
      expect(virtualApi.scrollToIndex).toHaveBeenCalledWith(2, { align: "start" });
    });
  });

  it("shows bank controls and partition labels for banked machines", async () => {
    await renderMemoryPanel({
      machineId: "sp128",
      partitionLabels: { [-1]: "rom0", 0: "bank0" }
    });

    expect(await screen.findByText("64K View:on")).toBeInTheDocument();
    expect(screen.getByTestId("dump-0")).toHaveAttribute("data-partition", "ROM0");
  });

  it("opens the set-memory flow from a row edit action", async () => {
    const { executeCommand, openDialog } = await renderMemoryPanel();

    fireEvent.contextMenu(screen.getByTestId("dump-0"));

    await waitFor(() => {
      expect(openDialog).toHaveBeenCalledTimes(1);
      expect(executeCommand).toHaveBeenCalledWith(expect.stringMatching(/^setmem 0 \$34 -b8\s*$/));
    });
  });

  it("re-renders visible rows after a byte-only emulator refresh", async () => {
    const { emuStateCallback, memory } = await renderMemoryPanel();
    expect(screen.getByTestId("dump-0")).toHaveTextContent("0:0");

    memory[0] = 77;
    await emuStateCallback?.(MachineControllerState.Paused);

    await waitFor(() => {
      expect(screen.getByTestId("dump-0")).toHaveTextContent("0:77");
    });
  });

  it("keeps byte-only refresh rendering bounded to the visible row window", async () => {
    const { dumpRenderLog, emuStateCallback, memory } = await renderMemoryPanel();

    dumpRenderLog.length = 0;
    memory[0] = 88;
    await emuStateCallback?.(MachineControllerState.Paused);

    await waitFor(() => {
      expect(screen.getByTestId("dump-0")).toHaveTextContent("0:88");
    });

    const renderedAddresses = new Set(dumpRenderLog.map((entry) => entry.address));
    expect(renderedAddresses).toEqual(new Set([0, 8, 16, 24]));
    expect(dumpRenderLog.length).toBeLessThanOrEqual(8);
  });

  it("does not re-render visible rows when toolbar dropdown focus only pauses refresh", async () => {
    const { dumpRenderLog } = await renderMemoryPanel();

    dumpRenderLog.length = 0;
    const viewModeDropdown = screen.getByLabelText("dropdown-90");
    fireEvent.focus(viewModeDropdown);
    fireEvent.blur(viewModeDropdown);

    expect(dumpRenderLog).toHaveLength(0);
  });
});
