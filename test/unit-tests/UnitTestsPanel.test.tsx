import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

import { createMockStore, renderWithProviders } from "../react-test-utils";
import {
  endCompileAction,
  openFolderAction,
  setBuildRootAction,
  setMachineTypeAction,
  unitTestEventAction,
  unitTestsRunEndedAction,
  unitTestsRunStartedAction
} from "@state/actions";
import { assembleWithInclude } from "./unitTestSupport";

/*
 * The Unit Tests panel and its badge (`.plans/Z80_UNIT_TESTS_PLAN.md` D13, D14, Phase 2): the tree of
 * suites and tests from the last build, statuses from the store, click-to-source, and the actions
 * running through the `test-*` commands.
 */

const executeCommand = vi.fn(async () => ({ success: true }));
const cancelUnitTests = vi.fn(async () => {});
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    ideCommandsService: { executeCommand },
    outputPaneService: { getOutputPaneBuffer: () => ({}) }
  })
}));
vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => ({ cancelUnitTests }) }));
vi.mock("@renderer/appIde/project/project-node", () => ({
  getFileTypeEntry: (file: string) => ({ subType: file.endsWith(".kz80.asm") ? "kz80-asm" : "zxbas" })
}));
// --- Every row rendered: jsdom has no layout for the virtualizer to measure
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: (props: { items?: unknown[]; renderItem: (index: number) => ReactNode }) => (
    <div>{(props.items ?? []).map((_, i) => props.renderItem(i))}</div>
  )
}));

import { UnitTestsPanel } from "@renderer/appIde/SideBarPanels/UnitTestsPanel";
import { UnitTestsBadge } from "@renderer/appIde/SideBarPanels/UnitTestsBadge";

const SOURCE = `
  .org $8000
  UNITTEST_INITIALIZE()
    ret
UT_root:
    TC_END()
  .module Maths
UT_add:
    TC_END()
UT_sub:
    TC_END()
  .endmodule
`;

async function projectStore() {
  const store = createMockStore();
  store.dispatch(openFolderAction("/proj", true));
  store.dispatch(setBuildRootAction(["code.kz80.asm"], true));
  store.dispatch(setMachineTypeAction("sp48"));
  const output = await assembleWithInclude(SOURCE);
  store.dispatch(endCompileAction(output as never, undefined, new Date(2026, 9, 8, 12, 0, 0).getTime()));
  return store;
}

describe("UnitTestsPanel", () => {
  beforeEach(() => {
    executeCommand.mockClear();
    cancelUnitTests.mockClear();
  });

  it("asks for a build before there is one", () => {
    const store = createMockStore();
    store.dispatch(openFolderAction("/proj", true));
    store.dispatch(setBuildRootAction(["code.kz80.asm"], true));
    renderWithProviders(<UnitTestsPanel />, { store });
    expect(screen.getByText("Build the project to find its unit tests")).toBeTruthy();
  });

  it("shows the suites and tests of the last build, with the build's time", async () => {
    const store = await projectStore();
    renderWithProviders(<UnitTestsPanel />, { store });
    expect(screen.getByText("UT_root")).toBeTruthy();
    expect(screen.getByText("Maths")).toBeTruthy();
    expect(screen.getByText("UT_add")).toBeTruthy();
    expect(screen.getByText("UT_sub")).toBeTruthy();
    expect(screen.getByText(/^Built /)).toBeTruthy();
    expect(screen.getAllByLabelText("Not run")).toHaveLength(4);
  });

  it("follows a run's events: running, results, failure messages, summary", async () => {
    const store = await projectStore();
    renderWithProviders(<UnitTestsPanel />, { store });
    act(() => {
      store.dispatch(unitTestsRunStartedAction(["UT_root", "Maths.UT_add", "Maths.UT_sub"], 1));
      store.dispatch(unitTestEventAction({ kind: "started", id: "UT_root" }));
    });
    expect(screen.getByLabelText("Running")).toBeTruthy();
    expect(screen.getAllByLabelText("Queued").length).toBeGreaterThan(0);
    act(() => {
      store.dispatch(unitTestEventAction({ kind: "result", result: { id: "UT_root", status: "passed", tstates: 1234 } }));
      store.dispatch(
        unitTestEventAction({
          kind: "result",
          result: {
            id: "Maths.UT_add",
            status: "failed",
            tstates: 99,
            message: "ASSERTION failed at code.kz80.asm:9: A == B  (A=$07, B=$05)",
            location: { file: "/proj/code.kz80.asm", line: 9 }
          }
        })
      );
      store.dispatch(
        unitTestEventAction({
          kind: "result",
          result: { id: "Maths.UT_sub", status: "error", errorKind: "timeout", tstates: 3_500_000, message: "UT_sub did not finish" }
        })
      );
      store.dispatch(unitTestEventAction({ kind: "finished", summary: { total: 3, passed: 1, failed: 1, errors: 1 } }));
      store.dispatch(unitTestsRunEndedAction(2));
    });
    expect(screen.getByText("1,234 T")).toBeTruthy();
    expect(screen.getByLabelText("Passed")).toBeTruthy();
    expect(screen.getAllByLabelText("Failed").length).toBe(2); // the test and its suite
    expect(screen.getByLabelText("Error")).toBeTruthy();
    expect(screen.getByText(/A == B \(A=\$07, B=\$05\)/)).toBeTruthy();
    expect(screen.getByText(/3 tests: 1 passed, 1 failed, 1 error/)).toBeTruthy();
    expect(screen.getByText("2 of 2 failing")).toBeTruthy();
  });

  it("goes to a test's label on a click, and to the failing line from its message", async () => {
    const store = await projectStore();
    renderWithProviders(<UnitTestsPanel />, { store });
    fireEvent.click(screen.getByText("UT_add"));
    expect(executeCommand).toHaveBeenCalledWith(expect.stringMatching(/^nav "#" \d+ -r unitTest$/));
    act(() => {
      store.dispatch(
        unitTestEventAction({
          kind: "result",
          result: { id: "UT_root", status: "failed", tstates: 1, message: "boom", location: { file: "/proj/t.asm", line: 42 } }
        })
      );
    });
    fireEvent.click(screen.getByText("boom"));
    expect(executeCommand).toHaveBeenCalledWith('nav "/proj/t.asm" 42 -r unitTest');
  });

  it("runs, re-runs failed, debugs the selection and stops through the commands", async () => {
    const store = await projectStore();
    renderWithProviders(<UnitTestsPanel />, { store });
    fireEvent.click(screen.getByLabelText("Run all tests (builds first)"));
    await act(async () => {});
    expect(executeCommand).toHaveBeenCalledWith("test-run", expect.anything());

    fireEvent.click(screen.getByText("UT_sub"));
    fireEvent.click(screen.getByLabelText("Debug Maths.UT_sub in the emulator"));
    await act(async () => {});
    expect(executeCommand).toHaveBeenCalledWith("test-debug Maths.UT_sub", expect.anything());

    act(() => {
      store.dispatch(unitTestsRunStartedAction(["UT_root"], 1));
    });
    fireEvent.click(screen.getByLabelText("Stop the run"));
    expect(cancelUnitTests).toHaveBeenCalled();
  });

  it("filters by name and message", async () => {
    const store = await projectStore();
    renderWithProviders(<UnitTestsPanel />, { store });
    fireEvent.change(screen.getByLabelText("Filter unit tests"), { target: { value: "sub" } });
    expect(screen.queryByText("UT_root")).toBeNull();
    expect(screen.getByText("UT_sub")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("offers to add unit-test support to a program without the frame", async () => {
    const store = createMockStore();
    store.dispatch(openFolderAction("/proj", true));
    store.dispatch(setBuildRootAction(["code.kz80.asm"], true));
    const { Z80Assembler } = await import("@main/z80-compiler/z80-assembler");
    const { AssemblerOptions } = await import("@main/compiler-common/assembler-in-out");
    store.dispatch(endCompileAction((await new Z80Assembler().compile("UT_a:\n ret\n", new AssemblerOptions())) as never));
    renderWithProviders(<UnitTestsPanel />, { store });
    expect(screen.getByText(/UNITTEST_INITIALIZE/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Add unit-test support/));
    await act(async () => {});
    expect(executeCommand).toHaveBeenCalledWith("test-init", expect.anything());
  });
});

describe("UnitTestsBadge", () => {
  it("counts the tests that did not pass", () => {
    const store = createMockStore();
    const { container } = renderWithProviders(<UnitTestsBadge panelId="unitTestsPanel" expanded />, { store });
    expect(container.textContent).toBe("");
    act(() => {
      store.dispatch(unitTestEventAction({ kind: "result", result: { id: "a", status: "failed", tstates: 0 } }));
      store.dispatch(unitTestEventAction({ kind: "result", result: { id: "b", status: "error", tstates: 0 } }));
      store.dispatch(unitTestEventAction({ kind: "result", result: { id: "c", status: "passed", tstates: 0 } }));
    });
    expect(screen.getByTitle("2 failing unit tests").textContent).toBe("2");
  });
});
