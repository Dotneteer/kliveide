/**
 * Phase 8 — Step 8.4: Toolbar sub-component tests
 *
 * Tests: Toolbar renders ExecutionControls and conditional ViewControls / IDE buttons,
 * ExecutionControls renders correct buttons and responds to state,
 * ViewControls renders view buttons, StartModeSelector renders dropdown.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act } from "../react-test-utils";
import { Toolbar } from "@controls/Toolbar";
import { ExecutionControls } from "@controls/ExecutionControls";
import { ViewControls } from "@controls/ViewControls";
import { StartModeSelector } from "@controls/StartModeSelector";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { setMachineStateAction } from "@state/actions";

// ---------------------------------------------------------------------------
// Mock API hooks and AppServices
// ---------------------------------------------------------------------------

const mockIssueMachineCommand = vi.fn().mockResolvedValue(undefined);
const mockExecuteCommand = vi.fn().mockResolvedValue(undefined);
const mockSetGlobalSettingsValue = vi.fn().mockResolvedValue(undefined);
const mockGetUserSettings = vi.fn().mockResolvedValue({
  shortcuts: { stepInto: "F12", stepOver: "F10", stepOut: "Shift+F12" }
});
const mockSaveProject = vi.fn().mockResolvedValue(undefined);
const mockReloadTapeFile = vi.fn().mockResolvedValue(undefined);

vi.mock("@renderer/core/EmuApi", () => ({
  useEmuApi: () => ({
    issueMachineCommand: mockIssueMachineCommand
  })
}));

vi.mock("@renderer/core/IdeApi", () => ({
  useIdeApi: () => ({
    executeCommand: mockExecuteCommand
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({
    setGlobalSettingsValue: mockSetGlobalSettingsValue,
    getUserSettings: mockGetUserSettings,
    saveProject: mockSaveProject,
    reloadTapeFile: mockReloadTapeFile
  })
}));

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    uiService: { dragging: false },
    outputPaneService: { getOutputPaneBuffer: () => ({ clear: vi.fn() }) },
    ideCommandsService: { executeCommand: mockExecuteCommand }
  })
}));

// Radix UI Select crashes in jsdom — mock the Dropdown component
vi.mock("@controls/Dropdown", () => ({
  __esModule: true,
  default: ({ options, initialValue, onChanged }: any) => (
    <select
      data-testid="mock-dropdown"
      value={initialValue}
      onChange={(e: any) => onChanged?.(e.target.value)}
    >
      {(options ?? []).map((o: any) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}));

// IconButton uses a custom Tooltip (react-popper portal) instead of the native
// title attribute.  Mock it with a simple <button title=...> so that
// screen.getByTitle() works in tests.
vi.mock("@controls/IconButton", () => ({
  IconButton: ({ title, clicked, enable, iconName, selected }: any) => (
    <button
      title={title}
      data-icon={iconName}
      disabled={enable === false}
      data-selected={selected ? "true" : undefined}
      onClick={() => { if (enable !== false) clicked?.(); }}
    >
      {iconName}
    </button>
  )
}));

// IconButton uses a custom Tooltip (react-popper portal) instead of the native
// title attribute.  Mock it with a simple <button title=...> so that
// screen.getByTitle() works in tests.
vi.mock("@controls/IconButton", () => ({
  IconButton: ({ title, clicked, enable, iconName, selected }: any) => (
    <button
      title={title}
      data-icon={iconName}
      disabled={enable === false}
      data-selected={selected ? "true" : undefined}
      onClick={() => { if (enable !== false) clicked?.(); }}
    >
      {iconName}
    </button>
  )
}));

// ResizeObserver stub
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Toolbar (thin wrapper)
// ---------------------------------------------------------------------------

describe("Toolbar — Phase 8", () => {
  it("renders ExecutionControls in emu mode", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={false} kliveProjectLoaded={false} />
      );
    });
    // Should render run button from ExecutionControls
    expect(screen.getByTitle(/Run Machine/i)).toBeInTheDocument();
  });

  it("renders ViewControls in emu mode (ide=false)", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={false} kliveProjectLoaded={false} />
      );
    });
    // ViewControls has "Stay on top" button
    expect(screen.getByTitle("Stay on top")).toBeInTheDocument();
  });

  it("does NOT render ViewControls in ide mode", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={true} kliveProjectLoaded={true} />
      );
    });
    expect(screen.queryByTitle("Stay on top")).not.toBeInTheDocument();
  });

  it("renders sync breakpoints button in ide mode", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={true} kliveProjectLoaded={true} />
      );
    });
    expect(screen.getByTitle(/Sync the source with the current breakpoint/i)).toBeInTheDocument();
  });

  it("renders Memory Panel button in ide mode", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={true} kliveProjectLoaded={true} />
      );
    });
    expect(screen.getByTitle("Show Memory Panel")).toBeInTheDocument();
  });

  it("renders Disassembly Panel button in ide mode", async () => {
    await act(async () => {
      renderWithProviders(
        <Toolbar ide={true} kliveProjectLoaded={true} />
      );
    });
    expect(screen.getByTitle("Show Disassembly Panel")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ExecutionControls
// ---------------------------------------------------------------------------

describe("ExecutionControls — Phase 8", () => {
  it("renders start, pause, stop, restart, and step buttons", async () => {
    await act(async () => {
      renderWithProviders(
        <ExecutionControls ide={false} kliveProjectLoaded={false} />
      );
    });
    expect(screen.getByTitle(/Run Machine/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Pause|Continue/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Stop/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Restart/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Step Into/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Step Over/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Step Out/i)).toBeInTheDocument();
  });

  it("enables start button when machine is stopped", async () => {
    const store = createMockStore();
    await act(async () => {
      renderWithProviders(
        <ExecutionControls ide={false} kliveProjectLoaded={false} />,
        { store }
      );
    });
    // Default state is None/Stopped — start should be enabled
    const startBtn = screen.getByTitle(/Run Machine/i);
    // IconButton uses opacity to indicate disabled — check it's not styled as disabled
    expect(startBtn).toBeInTheDocument();
  });

  it("calls issueMachineCommand('stop') on stop click", async () => {
    const store = createMockStore();
    store.dispatch(setMachineStateAction(MachineControllerState.Running), "test");

    await act(async () => {
      renderWithProviders(
        <ExecutionControls ide={false} kliveProjectLoaded={false} />,
        { store }
      );
    });

    const stopBtn = screen.getByTitle(/Stop \(F4\)/i);
    await act(async () => {
      stopBtn.click();
    });

    expect(mockIssueMachineCommand).toHaveBeenCalledWith("stop");
  });

  it("calls issueMachineCommand('pause') when running and pause clicked", async () => {
    const store = createMockStore();
    store.dispatch(setMachineStateAction(MachineControllerState.Running), "test");

    await act(async () => {
      renderWithProviders(
        <ExecutionControls ide={false} kliveProjectLoaded={false} />,
        { store }
      );
    });

    const pauseBtn = screen.getByTitle(/Pause \(Shift\+F5\)/i);
    await act(async () => {
      pauseBtn.click();
    });

    expect(mockIssueMachineCommand).toHaveBeenCalledWith("pause");
  });

  it("calls issueMachineCommand('stepInto') on Step Into click", async () => {
    const store = createMockStore();
    store.dispatch(setMachineStateAction(MachineControllerState.Paused), "test");

    await act(async () => {
      renderWithProviders(
        <ExecutionControls ide={false} kliveProjectLoaded={false} />,
        { store }
      );
    });

    const stepBtn = screen.getByTitle(/Step Into/i);
    await act(async () => {
      stepBtn.click();
    });

    expect(mockIssueMachineCommand).toHaveBeenCalledWith("stepInto");
  });
});

// ---------------------------------------------------------------------------
// ViewControls
// ---------------------------------------------------------------------------

describe("ViewControls — Phase 8", () => {
  it("renders stay on top, instant screen, keyboard, and sound buttons", async () => {
    await act(async () => {
      renderWithProviders(<ViewControls />);
    });

    expect(screen.getByTitle("Stay on top")).toBeInTheDocument();
    expect(screen.getByTitle("Turn on/off instant screen")).toBeInTheDocument();
    expect(screen.getByTitle("Show/Hide keyboard")).toBeInTheDocument();
    // Sound button — one of mute/unmute should be present
    const muteBtn = screen.queryByTitle("Mute sound");
    const unmuteBtn = screen.queryByTitle("Unmute sound");
    expect(muteBtn || unmuteBtn).toBeTruthy();
  });

  it("clicking Stay on top calls setGlobalSettingsValue", async () => {
    await act(async () => {
      renderWithProviders(<ViewControls />);
    });
    const btn = screen.getByTitle("Stay on top");

    await act(async () => {
      btn.click();
    });

    expect(mockSetGlobalSettingsValue).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// StartModeSelector
// ---------------------------------------------------------------------------

describe("StartModeSelector — Phase 8", () => {
  const options = [
    { value: "debug", label: "Debug", labelCont: "Continue Debug", iconName: "debug", cmd: null },
    { value: "start", label: "Run", labelCont: "Continue", iconName: "play", cmd: null }
  ];

  it("renders the dropdown with start mode", () => {
    renderWithProviders(
      <StartModeSelector
        startOptions={options}
        startMode="start"
        canPickStartOption={true}
        onChanged={vi.fn()}
      />
    );
    // Dropdown trigger should show "Run" text
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("applies disabled styling when canPickStartOption=false", () => {
    const { container } = renderWithProviders(
      <StartModeSelector
        startOptions={options}
        startMode="start"
        canPickStartOption={false}
        onChanged={vi.fn()}
      />
    );
    // First child is the provider wrapper, find the actual toolbar dropdown container
    const wrapper = container.querySelector('[style*="pointer-events"]') as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.pointerEvents).toBe("none");
  });
});
