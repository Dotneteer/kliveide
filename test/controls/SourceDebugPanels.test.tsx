/**
 * The symbolic Call Stack and the Variables panel of a Klive BASIC program (plan §10.6–§10.8): what
 * they show for a paused program, and how they drive the IDE — frame selection, Run to Frame, and
 * the BASIC watch list.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act, fireEvent } from "../react-test-utils";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { endCompileAction, setMachineStateAction } from "@state/actions";
import { CallStackPanel } from "@renderer/appIde/SideBarPanels/CallStackPanel";
import { VariablesPanel } from "@renderer/appIde/debugger/source/VariablesPanel";

const memory = new Uint8Array(0x10000);
// --- The global `score` (UInteger) at $9000; routine f's frame: IX = $FF00, its parameter n at IX+5
memory[0x9000] = 0x39;
memory[0x9001] = 0x30; // 12345
memory[0xff05] = 7;

const chain = [
  { callableIndex: 1, kind: "routine", baseline: 0xfefe, returnSlot: 0xff02, ix: 0xff00, callSite: { returnAddress: 0x8010, statementIndex: 0, callerIndex: 0, kind: "function", calleeIndex: 1, moreCallsFollow: false, order: 0 } },
  { callableIndex: 0, kind: "main", baseline: 0xff40 }
];
const stop = { kind: "statement", pc: 0x8100, statementIndex: 1, returned: [] };

const emu = {
  getSourceCallStack: vi.fn().mockResolvedValue(chain),
  getSourceStopInfo: vi.fn().mockResolvedValue(stop),
  getCpuState: vi.fn().mockResolvedValue({ pc: 0x8100, sp: 0xfefe }),
  getMemoryContents: vi.fn().mockResolvedValue({ memory }),
  getCpuStateChunk: vi.fn().mockResolvedValue({ state: {} }),
  sourceStep: vi.fn().mockResolvedValue(undefined),
  setMemoryContent: vi.fn().mockResolvedValue(undefined),
  getCallStack: vi.fn().mockResolvedValue({ sp: 0xfefe, frames: [] })
};
const commands = { executeCommand: vi.fn().mockResolvedValue(undefined) };

vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emu }));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({ useAppServices: () => ({ ideCommandsService: commands }) }));
vi.mock("@renderer/controls/IconButton", () => ({
  IconButton: ({ title, clicked }: any) => (
    <button title={title} onClick={(e) => clicked?.(e)}>
      {title}
    </button>
  )
}));

(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const span = { file: 0, start: 0, end: 0 };
const result = {
  segments: [],
  sourceFileList: [{ filename: "/p/code/main.bas" }],
  sourceMap: {},
  listFileItems: [],
  errors: [],
  sourceLevelDebug: {
    files: [{ filename: "/p/code/main.bas" }],
    statements: [
      { index: 0, fileIndex: 0, startLine: 9, startColumn: 0, endLine: 9, endColumn: 10, startAddress: 0x800c, endAddress: 0x8014, kind: "assign", span },
      { index: 1, fileIndex: 0, startLine: 3, startColumn: 2, endLine: 3, endColumn: 14, startAddress: 0x8100, endAddress: 0x8108, kind: "return", span }
    ],
    callables: [
      { index: 0, name: "main", kind: "entrypoint" },
      { index: 1, name: "f", kind: "function" }
    ],
    addressToStatement: [],
    extensions: {
      variables: [
        { name: "score", displayName: "score", type: "uinteger", kind: "global", location: { at: "absolute", address: 0x9000 }, scope: "global", declaredAt: { fileIndex: 0, line: 1, column: 0 } },
        { name: "n", displayName: "n", type: "ubyte", kind: "parameter", location: { at: "frame", ixOffset: 5 }, scope: { callableIndex: 1 }, declaredAt: { fileIndex: 0, line: 2, column: 11 } }
      ],
      callSites: [],
      frames: [
        { callableIndex: 0, convention: "entrypoint", startAddress: 0x8000, bodyStart: 0x8000, epilogueStart: 0x8020, endAddress: 0x8020 },
        { callableIndex: 1, convention: "frame", returnSlotOffset: 4, argBytes: 2, startAddress: 0x80f0, bodyStart: 0x8100, epilogueStart: 0x8110, endAddress: 0x8118, returnType: "ubyte" }
      ],
      mainBaselineSymbol: 0x9100,
      runtimeSymbols: [],
      optimizationLevel: 0
    }
  }
};

async function renderPaused(ui: React.ReactElement) {
  const store = createMockStore();
  store.dispatch(endCompileAction(result));
  store.dispatch(setMachineStateAction(MachineControllerState.Paused), "emu");
  await act(async () => {
    renderWithProviders(ui, { store });
  });
  return store;
}

describe("the symbolic Call Stack panel (§10.6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the activations with where each stands", async () => {
    await renderPaused(<CallStackPanel />);
    expect(screen.getByText("f")).toBeInTheDocument();
    expect(screen.getByText("main.bas:3")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("main.bas:9")).toBeInTheDocument();
  });

  it("selects a frame and moves the editor to it", async () => {
    const store = await renderPaused(<CallStackPanel />);
    await act(async () => {
      fireEvent.click(screen.getByText("main"));
    });
    expect(store.getState().ideView.sourceFrame).toBe(1);
    expect(commands.executeCommand).toHaveBeenCalledWith('nav "/p/code/main.bas" 9 1');
  });

  it("offers Run to this frame in a frame's context menu", async () => {
    await renderPaused(<CallStackPanel />);
    await act(async () => {
      fireEvent.contextMenu(screen.getByText("main"));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByText("Run to this frame").find((e) => e.closest('[role="menuitem"]'))!);
    });
    expect(emu.sourceStep).toHaveBeenCalledWith("runToFrame", { targetFrame: 1 });
  });

  it("runs to an outer frame", async () => {
    await renderPaused(<CallStackPanel />);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Run to this frame"));
    });
    expect(emu.sourceStep).toHaveBeenCalledWith("runToFrame", { targetFrame: 1 });
  });
});

describe("the Variables panel (§10.7, §10.8)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the selected frame's parameters and the globals, decoded", async () => {
    await renderPaused(<VariablesPanel />);
    expect(screen.getByText("Locals — f")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("writes an edited number to memory", async () => {
    await renderPaused(<VariablesPanel />);
    await act(async () => {
      fireEvent.doubleClick(screen.getByText("12345"));
    });
    const input = screen.getByLabelText("New value of score");
    await act(async () => {
      fireEvent.change(input, { target: { value: "258" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(emu.setMemoryContent).toHaveBeenCalledWith(0x9000, 2, 8, false);
    expect(emu.setMemoryContent).toHaveBeenCalledWith(0x9001, 1, 8, false);
  });

  it("keeps the editor open with the reason when the value does not fit", async () => {
    await renderPaused(<VariablesPanel />);
    await act(async () => {
      fireEvent.doubleClick(screen.getByText("12345"));
    });
    const input = screen.getByLabelText("New value of score");
    await act(async () => {
      fireEvent.change(input, { target: { value: "70000" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(screen.getByText("UInteger holds 0 to 65535")).toBeInTheDocument();
    expect(emu.setMemoryContent).not.toHaveBeenCalled();
  });

  it("evaluates BASIC watches the user adds, and removes them", async () => {
    const store = await renderPaused(<VariablesPanel />);
    const input = screen.getByLabelText("Add a BASIC watch expression");
    await act(async () => {
      fireEvent.change(input, { target: { value: "score + n" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(store.getState().basicWatches).toEqual(["score + n"]);
    expect(screen.getByText("12352")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTitle("Remove this watch"));
    });
    expect(store.getState().basicWatches).toEqual([]);
  });

  it("asks for a Klive BASIC program when there is no source-level info", async () => {
    const store = createMockStore();
    await act(async () => {
      renderWithProviders(<VariablesPanel />, { store });
    });
    expect(screen.getByText("Build a Klive BASIC program to see its variables")).toBeInTheDocument();
  });
});
