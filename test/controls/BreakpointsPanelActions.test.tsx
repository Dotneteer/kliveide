import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MI_SPECTRUM_128, MI_ZXNEXT } from "@common/machines/constants";
import { setMachineStateAction, setGlobalSettingAction } from "@state/actions";
import { SETTING_IDE_BP_GROUP_BY_KIND } from "@common/settings/setting-const";
import { MachineControllerState } from "@abstractions/MachineControllerState";

/*
 * What the *panel* decides: which actions a row offers, which API call each one makes, and that the
 * breakpoint indicator's own right-click does not also open the row menu.
 *
 * The dialog's own behaviour is covered in `BreakpointDialog.test.tsx` and the rules in
 * `test/debug/breakpoint-form.test.ts`, so `useDialogs` is faked here — this file asserts that the
 * panel opens it with the right arguments and applies what it returns, not what it contains.
 */

/*
 * `VirtualizedList` renders through `virtua`, which needs a `ResizeObserver` jsdom does not ship and
 * a measured viewport it will never get here — with either missing it renders no rows at all.
 * Rendering every item instead keeps this file about what it is testing: which actions a row
 * offers and what each one calls. Virtualization is not the subject.
 */
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: ({ items, renderItem }: any) => (
    <div data-testid="virtualized-list">
      {items.map((_: unknown, index: number) => (
        <div key={index}>{renderItem(index)}</div>
      ))}
    </div>
  )
}));

const emuApi = vi.hoisted(() => ({
  listBreakpoints: vi.fn(),
  getCpuState: vi.fn(),
  getPartitionLabels: vi.fn(),
  getPartitionDescriptions: vi.fn(),
  getPartitionGroups: vi.fn(),
  setBreakpoint: vi.fn(),
  removeBreakpoint: vi.fn(),
  enableBreakpoint: vi.fn(),
  eraseAllBreakpoints: vi.fn(),
  restoreBreakpoints: vi.fn(),
  getRomFlags: vi.fn()
}));

const dialogs = vi.hoisted(() => ({ open: vi.fn() }));
const mainApi = vi.hoisted(() => ({ setGlobalSettingsValue: vi.fn() }));
const confirmPort = vi.hoisted(() => ({ confirm: vi.fn() }));


vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));
vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => mainApi }));
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (): void => undefined
}));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand: vi.fn() } })
}));
vi.mock("@mvc/dialogs/useDialogPorts", () => ({ useConfirmPort: () => confirmPort }));
vi.mock("@renderer/controls/overlay/DialogProvider", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useDialogs: () => dialogs
}));

import { BreakpointsPanel } from "@renderer/appIde/SideBarPanels/BreakpointsPanel";

const execAt = (address: number, over: Partial<BreakpointInfo> = {}): BreakpointInfo => ({
  address,
  exec: true,
  ...over
});

const SOURCE_BP: BreakpointInfo = { resource: "code/code.kz80.asm", line: 12 };

/** Renders the panel with the given breakpoints already installed, and waits for the first paint. */
async function renderPanel(breakpoints: BreakpointInfo[], machineId?: string) {
  emuApi.listBreakpoints.mockResolvedValue({
    breakpoints,
    // --- `refreshBreakpoints` bails out before it stores anything when this is missing.
    memorySegments: breakpoints.map(() => new Uint8Array([0x00]))
  });
  const store = createMockStore();
  if (machineId) store.dispatch(setMachineTypeAction(machineId));
  const result = renderWithProviders(<BreakpointsPanel />, { store });
  if (breakpoints.length) {
    await waitFor(() => expect(screen.queryByText("No breakpoints defined")).toBeNull());
  }
  return result;
}

/** Right-clicks the row carrying `label` and returns once the menu is up. */
async function openRowMenu(label: string) {
  fireEvent.contextMenu(screen.getByText(label));
  // --- `queryAllByRole`, not `queryByRole`: the singular form throws on multiple matches, and a
  // --- menu that opened correctly has several.
  await waitFor(() => expect(screen.queryAllByRole("menuitem").length).toBeGreaterThan(0));
}

const menuItem = (text: string) =>
  screen.getAllByRole("menuitem").find((item) => item.textContent === text);

beforeEach(() => {
  vi.clearAllMocks();
  emuApi.getCpuState.mockResolvedValue({ pc: 0x0000 });
  emuApi.getPartitionLabels.mockResolvedValue({});
  emuApi.getPartitionDescriptions.mockResolvedValue({});
  emuApi.getPartitionGroups.mockResolvedValue({});
  emuApi.removeBreakpoint.mockResolvedValue(true);
  emuApi.enableBreakpoint.mockResolvedValue(true);
  emuApi.eraseAllBreakpoints.mockResolvedValue(undefined);
  dialogs.open.mockResolvedValue(undefined);
  confirmPort.confirm.mockResolvedValue(false);
  emuApi.getRomFlags.mockResolvedValue([]);
  mainApi.setGlobalSettingsValue.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("BreakpointsPanel - toolbar", () => {
  it("opens the dialog in add mode with no breakpoint to edit", async () => {
    await renderPanel([]);

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    const [, props, options] = dialogs.open.mock.calls[0];
    expect(props.initial).toBeUndefined();
    expect(options.title).toBe("Add breakpoint");
  });

  it("tells the dialog which keys are taken, so it can refuse a duplicate", async () => {
    await renderPanel([execAt(0x8000), { address: 0x9000, memoryRead: true }]);

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    const [, props] = dialogs.open.mock.calls[0];
    expect(props.env.existingKeys).toEqual(["$8000", "$9000:R"]);
    expect(props.env.editingKey).toBeUndefined();
  });

  it("reports partition support from the running machine, not from a guess", async () => {
    // --- A 128K Spectrum pages ROMs and banks; the setup hook the Memory view uses is what says
    // --- so, which is why the dialog and that view can never disagree about it.
    await renderPanel([], MI_SPECTRUM_128);

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    const [, props] = dialogs.open.mock.calls[0];
    expect(props.env.supportsPartitions).toBe(true);
    /*
     * Assert the *derived* setup, not a `machineId` prop.
     *
     * This used to check `props.machineId`, which the call site passed and `BreakpointDialog`
     * declared no prop for — so it reached the component and was dropped, and the assertion pinned
     * a value that could not affect anything. `banksView` is the same claim made where it lands: it
     * is `true` here only because `derivePartitionSetup` was given the running 128K, which is what
     * "from the running machine, not from a guess" means.
     */
    expect(props.machineSetup.banksView).toBe(true);
  });

  it("reports no partition support on a machine without banks", async () => {
    await renderPanel([]);

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    expect(dialogs.open.mock.calls[0][1].env.supportsPartitions).toBe(false);
  });

  it("applies what the dialog returns", async () => {
    await renderPanel([]);
    dialogs.open.mockResolvedValue({ breakpoint: execAt(0x8000) });

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(emuApi.setBreakpoint).toHaveBeenCalledWith(execAt(0x8000)));
  });

  it("changes nothing when the dialog is cancelled", async () => {
    await renderPanel([]);
    dialogs.open.mockResolvedValue(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Add breakpoint" }));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    expect(emuApi.setBreakpoint).not.toHaveBeenCalled();
    expect(emuApi.restoreBreakpoints).not.toHaveBeenCalled();
  });

  it("offers Remove all only when there is something to remove", async () => {
    await renderPanel([]);

    expect(screen.getByRole("button", { name: "Remove all breakpoints" })).toBeDisabled();
  });
});

describe("BreakpointsPanel - remove all", () => {
  it("asks before erasing, and does nothing if the answer is no", async () => {
    await renderPanel([execAt(0x8000)]);
    confirmPort.confirm.mockResolvedValue(false);

    fireEvent.click(screen.getByRole("button", { name: "Remove all breakpoints" }));

    await waitFor(() => expect(confirmPort.confirm).toHaveBeenCalled());
    expect(emuApi.eraseAllBreakpoints).not.toHaveBeenCalled();
  });

  it("erases everything once confirmed", async () => {
    await renderPanel([execAt(0x8000)]);
    confirmPort.confirm.mockResolvedValue(true);

    fireEvent.click(screen.getByRole("button", { name: "Remove all breakpoints" }));

    await waitFor(() => expect(emuApi.eraseAllBreakpoints).toHaveBeenCalled());
  });

  it("warns that source-code breakpoints go too", async () => {
    // --- `bp-ea` semantics are kept deliberately, so the question has to name what the user cannot
    // --- otherwise tell from a panel whose dialog only authors binary breakpoints.
    await renderPanel([execAt(0x8000), SOURCE_BP, { resource: "a.asm", line: 3 }]);

    fireEvent.click(screen.getByRole("button", { name: "Remove all breakpoints" }));

    await waitFor(() => expect(confirmPort.confirm).toHaveBeenCalled());
    const lines: string[] = confirmPort.confirm.mock.calls[0][0].lines;
    expect(lines.join(" ")).toMatch(/all 3 breakpoints/);
    expect(lines.join(" ")).toMatch(/includes 2 source-code breakpoints/);
  });

  it("says nothing about source breakpoints when there are none", async () => {
    await renderPanel([execAt(0x8000)]);

    fireEvent.click(screen.getByRole("button", { name: "Remove all breakpoints" }));

    await waitFor(() => expect(confirmPort.confirm).toHaveBeenCalled());
    const lines: string[] = confirmPort.confirm.mock.calls[0][0].lines;
    expect(lines.join(" ")).not.toMatch(/source-code/);
    expect(lines.join(" ")).toMatch(/all 1 breakpoint\?/);
  });
});

describe("BreakpointsPanel - row context menu", () => {
  it("offers Edit on a binary breakpoint", async () => {
    await renderPanel([execAt(0x8000)]);

    await openRowMenu("$8000");

    expect(menuItem("Edit breakpoint...")).toBeTruthy();
  });

  it("opens the dialog on the row it was invoked from, letting it keep its own key", async () => {
    await renderPanel([execAt(0x8000), execAt(0x9000)]);

    await openRowMenu("$9000");
    fireEvent.click(menuItem("Edit breakpoint...")!);

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    const [, props, options] = dialogs.open.mock.calls[0];
    expect(props.initial).toMatchObject({ address: 0x9000 });
    expect(props.env.editingKey).toBe("$9000");
    expect(options.title).toBe("Edit breakpoint");
  });

  it("labels the toggle by what it will do", async () => {
    await renderPanel([execAt(0x8000, { disabled: true })]);

    await openRowMenu("$8000");

    expect(menuItem("Enable breakpoint")).toBeTruthy();
    expect(menuItem("Disable breakpoint")).toBeUndefined();
  });

  it("toggles a breakpoint the other way", async () => {
    await renderPanel([execAt(0x8000, { disabled: true })]);

    await openRowMenu("$8000");
    fireEvent.click(menuItem("Enable breakpoint")!);

    await waitFor(() =>
      expect(emuApi.enableBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({ address: 0x8000 }),
        true
      )
    );
  });

  it("removes just that breakpoint", async () => {
    await renderPanel([execAt(0x8000), execAt(0x9000)]);

    await openRowMenu("$9000");
    fireEvent.click(menuItem("Remove breakpoint")!);

    await waitFor(() =>
      expect(emuApi.removeBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({ address: 0x9000 })
      )
    );
  });

  it("reaches Remove all from the row menu too", async () => {
    await renderPanel([execAt(0x8000)]);
    confirmPort.confirm.mockResolvedValue(true);

    await openRowMenu("$8000");
    fireEvent.click(menuItem("Remove all breakpoints")!);

    await waitFor(() => expect(emuApi.eraseAllBreakpoints).toHaveBeenCalled());
  });
});

describe("BreakpointsPanel - source-code breakpoints", () => {
  const sourceLabel = "[code/code.kz80.asm]:12";

  it("does not offer to edit one, and says where to", async () => {
    // --- The editor's glyph margin owns these: it places them by clicking a line and tracks them
    // --- as lines move. A dialog asking for a filename and a line number would be worse.
    await renderPanel([SOURCE_BP]);

    await openRowMenu(sourceLabel);

    expect(menuItem("Edit breakpoint...")).toBeUndefined();
    expect(menuItem("Edit from the editor's left margin")).toBeTruthy();
    expect(menuItem("Edit from the editor's left margin")).toBeDisabled();
  });

  it("still offers the set operations, which are not authoring", async () => {
    await renderPanel([SOURCE_BP]);

    await openRowMenu(sourceLabel);

    expect(menuItem("Disable breakpoint")).toBeTruthy();
    expect(menuItem("Remove breakpoint")).toBeTruthy();
  });

  it("removes one on request", async () => {
    await renderPanel([SOURCE_BP]);

    await openRowMenu(sourceLabel);
    fireEvent.click(menuItem("Remove breakpoint")!);

    await waitFor(() =>
      expect(emuApi.removeBreakpoint).toHaveBeenCalledWith(expect.objectContaining(SOURCE_BP))
    );
  });

  it("ignores a double-click rather than opening a dialog it cannot fill", async () => {
    await renderPanel([SOURCE_BP]);

    fireEvent.doubleClick(screen.getByText(sourceLabel));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dialogs.open).not.toHaveBeenCalled();
  });
});

describe("BreakpointsPanel - gesture collision", () => {
  it("does not open the row menu when the indicator's own right-click fires", async () => {
    // --- The indicator deletes the breakpoint on right-click and lives inside every row. Without
    // --- the wrapper's `stopPropagation` the row menu would open on top of a silent delete.
    await renderPanel([execAt(0x8000)]);

    fireEvent.contextMenu(screen.getByRole("checkbox"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("still opens the row menu from the row itself", async () => {
    await renderPanel([execAt(0x8000)]);

    await openRowMenu("$8000");

    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
  });
});

describe("BreakpointsPanel - editing opens on a double-click", () => {
  it("opens the dialog on the breakpoint that was double-clicked", async () => {
    await renderPanel([execAt(0x8000)]);

    fireEvent.doubleClick(screen.getByText("$8000"));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    expect(dialogs.open.mock.calls[0][1].initial).toMatchObject({ address: 0x8000 });
  });
});

/*
 * A NextReg write breakpoint in the list. It is the first shape with no address at all, so what
 * matters here is that the panel treats it as a first-class row rather than as a source breakpoint
 * that has not resolved: it is editable, it reports its register, and the machine's last write
 * reaches it.
 */

const NEXT_REG_BP: BreakpointInfo = { nextReg: 0x07 };

describe("BreakpointsPanel - NextReg write breakpoints", () => {
  it("lists it by its key and names the register beside it", async () => {
    await renderPanel([NEXT_REG_BP], MI_ZXNEXT);

    expect(screen.queryByText("NR:$07")).not.toBeNull();
    // --- The documented name, from the same table the Next Registers panel reads.
    expect(screen.queryByText("CPU speed")).not.toBeNull();
  });

  it("says so when the register has no documentation", async () => {
    await renderPanel([{ nextReg: 0xfe }], MI_ZXNEXT);

    expect(screen.queryByText("Undocumented register")).not.toBeNull();
  });

  it("offers Edit and honours a double-click, unlike a source breakpoint", async () => {
    await renderPanel([NEXT_REG_BP], MI_ZXNEXT);

    await openRowMenu("NR:$07");
    expect(menuItem("Edit breakpoint...")).toBeDefined();

    fireEvent.click(menuItem("Edit breakpoint...")!);
    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
    const [, props] = dialogs.open.mock.calls[0];
    expect(props.initial).toMatchObject({ nextReg: 0x07 });
  });

  it("opens the editor on a double-click of the row", async () => {
    await renderPanel([NEXT_REG_BP], MI_ZXNEXT);

    fireEvent.doubleClick(screen.getByText("NR:$07"));

    await waitFor(() => expect(dialogs.open).toHaveBeenCalled());
  });

  it("removes and disables it like any other breakpoint", async () => {
    await renderPanel([NEXT_REG_BP], MI_ZXNEXT);

    await openRowMenu("NR:$07");
    fireEvent.click(menuItem("Remove breakpoint")!);

    await waitFor(() =>
      expect(emuApi.removeBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({ nextReg: 0x07 })
      )
    );
  });

  it("shows the previous and new values once the machine has stopped on it", async () => {
    emuApi.getCpuState.mockResolvedValue({
      pc: 0x8005,
      lastNextRegWrite: {
        reg: 0x07,
        oldValue: 0x00,
        newValue: 0x03,
        origin: "cpu",
        // --- Required on the event: the breakpoint records where the write came from, because
        // --- on `$02` the reset that follows takes it away.
        pc: 0x8002,
        partition: 0
      }
    });
    const { store } = await renderPanel([NEXT_REG_BP], MI_ZXNEXT);
    store.dispatch(setMachineStateAction(MachineControllerState.Paused));

    // --- The pair is what makes a stop that physically happens *after* the write read as "before".
    await waitFor(() => expect(screen.queryByText("$00 → $03")).not.toBeNull());
    // --- And the site it came from, which on `$02` is the only chance to see it: resuming applies
    // --- the reset and takes the address and the paging with it.
    expect(screen.queryByText(/@\$8002/)).not.toBeNull();
  });

  it("says nothing about a write to some other register", async () => {
    emuApi.getCpuState.mockResolvedValue({
      pc: 0x8005,
      lastNextRegWrite: {
        reg: 0x4c,
        oldValue: 0x00,
        newValue: 0x03,
        origin: "cpu",
        pc: 0x8002,
        partition: 0
      }
    });
    const { store } = await renderPanel([NEXT_REG_BP], MI_ZXNEXT);
    store.dispatch(setMachineStateAction(MachineControllerState.Paused));

    await waitFor(() => expect(screen.queryByText("NR:$07")).not.toBeNull());
    expect(screen.queryByText("$00 → $03")).toBeNull();
  });
});

/*
 * Grouping. The rule itself - what order, which headers - is tested without a DOM in
 * `test/debug/breakpoint-grouping.test.ts`; this is about what the panel does with the result.
 */
describe("BreakpointsPanel - grouping", () => {
  it("heads each kind present, and only those", async () => {
    await renderPanel([
      execAt(0x8000),
      { address: 0x9000, memoryWrite: true },
      { nextReg: 0x07 }
    ], MI_ZXNEXT);

    expect(screen.queryByText("Execution")).not.toBeNull();
    expect(screen.queryByText("Memory write")).not.toBeNull();
    expect(screen.queryByText("NextReg write")).not.toBeNull();
    // --- Nothing is an I/O breakpoint here, so no header for one.
    expect(screen.queryByText("I/O read")).toBeNull();
    expect(screen.queryByText("I/O write")).toBeNull();
  });

  it("opens no menu on a header, which is not a breakpoint", async () => {
    await renderPanel([execAt(0x8000)]);

    fireEvent.contextMenu(screen.getByText("Execution"));

    // --- A header has nothing to edit, disable or remove; binding the row menu to one would offer
    // --- actions with no subject.
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("turns grouping off through the setting, not through local state", async () => {
    // --- A view preference held in the component resets on every remount, which is an annoyance
    // --- rather than a preference.
    await renderPanel([execAt(0x8000)]);

    fireEvent.click(screen.getByRole("button", { name: "Ungroup breakpoints" }));

    await waitFor(() =>
      expect(mainApi.setGlobalSettingsValue).toHaveBeenCalledWith(
        SETTING_IDE_BP_GROUP_BY_KIND,
        false
      )
    );
  });

  it("still lists every breakpoint when the headers are gone", async () => {
    const store = createMockStore();
    store.dispatch(setGlobalSettingAction(SETTING_IDE_BP_GROUP_BY_KIND, false));
    emuApi.listBreakpoints.mockResolvedValue({
      breakpoints: [execAt(0x8000), { address: 0x9000, memoryWrite: true }],
      memorySegments: [new Uint8Array([0x00]), new Uint8Array([0x00])]
    });
    renderWithProviders(<BreakpointsPanel />, { store });

    await waitFor(() => expect(screen.queryByText("$8000")).not.toBeNull());
    expect(screen.queryByText("$9000")).not.toBeNull();
    expect(screen.queryByText("Execution")).toBeNull();
    expect(screen.getByRole("button", { name: "Group breakpoints by kind" })).toBeDefined();
  });
});
