import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BreakpointEnvironment } from "@renderer/appIde/utils/breakpoint-form";
import type { DropdownOption } from "@renderer/controls/Dropdown";
import { derivePartitionOptions } from "@renderer/features/memory/memoryViewModel";

import { BreakpointDialog } from "@renderer/appIde/dialogs/BreakpointDialog";
import { renderWithProviders } from "../react-test-utils";

afterEach(cleanup);

/*
 * These tests cover what the *view* decides: which fields exist for a given type, when an error is
 * allowed to appear, and the shape of the result it emits. The rules themselves belong to
 * `breakpoint-form.ts` and are tested in `test/debug/breakpoint-form.test.ts` without a DOM — a
 * rule is tested at the lowest layer that owns it, so it is not re-asserted here.
 */

const anEnv = (over: Partial<BreakpointEnvironment> = {}): BreakpointEnvironment => ({
  partitionLabels: {},
  supportsPartitions: false,
  existingKeys: [],
  ...over
});

const someControls = () => ({ cancel: vi.fn(), close: vi.fn(), id: "bp", reject: vi.fn() });

/**
 * A machine with a handful of banks: the list-shaped picker.
 *
 * Options carry the machine's own labels with the long forms as descriptions — `R0` / "ROM 0" —
 * which is the split the naming unification established.
 */
const aListMachine = {
  displayBankMatrix: false,
  segmentOptions: [
    { value: "-1", label: "R0", description: "ROM 0" },
    { value: "0", label: "B0", description: "Bank 0" },
    { value: "1", label: "B1", description: "Bank 1" }
  ] as DropdownOption[],
  partitionOptions: derivePartitionOptions(
    { [-1]: "R0", 0: "B0", 1: "B1" },
    { [-1]: "ROM 0", 0: "Bank 0", 1: "Bank 1" }
  )
};

/** A ZX Next-shaped machine: too many banks to list, so the matrix. */
const aMatrixMachine = {
  displayBankMatrix: true,
  segmentOptions: [] as DropdownOption[],
  partitionOptions: derivePartitionOptions(
    { [-1]: "R0", [-5]: "Q0", 0: "00", 1: "01" },
    { [-1]: "Next ROM 0", [-5]: "Alt ROM 0", 0: "Bank $00", 1: "Bank $01" }
  )
};

const addressBox = () => screen.getAllByRole("textbox")[0];
const typeAddress = (value: string) => fireEvent.change(addressBox(), { target: { value } });
const submit = (label = "Add") => fireEvent.click(screen.getByText(label));

describe("BreakpointDialog - adding", () => {
  it("starts as a blank execution breakpoint with no complaints", () => {
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />);

    expect((screen.getByLabelText("Execution") as HTMLInputElement).checked).toBe(true);
    // --- Greeting an empty Add form with "Enter an address." would be scolding the user for not
    // --- having typed yet.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("emits the breakpoint it describes", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("$8000");
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ address: 0x8000, exec: true }),
        replaces: undefined
      })
    );
  });

  it("emits the chosen type instead of execution", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    fireEvent.click(screen.getByLabelText("Memory write"));
    typeAddress("$8000");
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoint: expect.objectContaining({ memoryWrite: true, exec: false })
        })
      )
    );
  });

  it("maps the Enabled checkbox onto the disabled flag", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("$8000");
    fireEvent.click(screen.getByRole("checkbox", { name: "Enabled" }));
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({ breakpoint: expect.objectContaining({ disabled: true }) })
      )
    );
  });

  it("maps 'Remove after it stops' onto a session-owned one-shot (G1.6)", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("$8000");
    fireEvent.click(screen.getByRole("checkbox", { name: "Remove after it stops" }));
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoint: expect.objectContaining({ oneShot: true, owner: { kind: "session" } })
        })
      )
    );
  });

  it("cancels through the dialog controls", () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    fireEvent.click(screen.getByText("Cancel"));

    expect(controls.cancel).toHaveBeenCalled();
    expect(controls.close).not.toHaveBeenCalled();
  });
});

describe("BreakpointDialog - fields that depend on the type", () => {
  it("offers a port mask only for I/O breakpoints", () => {
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />);

    expect(screen.queryByText("Port mask")).toBeNull();

    fireEvent.click(screen.getByLabelText("I/O read"));

    expect(screen.getByText("Port mask")).toBeTruthy();
  });

  it("asks for a port rather than an address on an I/O breakpoint", () => {
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />);

    expect(screen.getByText("Address *")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("I/O write"));

    expect(screen.getByText("Port *")).toBeTruthy();
    expect(screen.queryByText("Address *")).toBeNull();
  });

  it("does not trap the user behind a field the type switch removed", async () => {
    // --- Regression: a port mask typed for an I/O breakpoint used to survive a switch back to
    // --- Execution, where the field is not rendered at all — so the form failed validation on
    // --- something with no visible cause and no way to fix it but Cancel.
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    fireEvent.click(screen.getByLabelText("I/O read"));
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "$00ff" } });
    fireEvent.click(screen.getByLabelText("Execution"));

    typeAddress("$8000");
    submit();

    await waitFor(() => expect(controls.close).toHaveBeenCalled());
    expect(controls.close.mock.calls[0][0].breakpoint.ioMask).toBeUndefined();
  });

  it("hides the partition row on a machine without partitions", () => {
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />);

    expect(screen.queryByText("Partition")).toBeNull();
  });

  it("shows the partition row on a machine with partitions", () => {
    renderWithProviders(
      <BreakpointDialog
        env={anEnv({ supportsPartitions: true, partitionLabels: { [-1]: "R0", 0: "00" } })}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );

    expect(screen.getByText("Partition")).toBeTruthy();
  });
});

describe("BreakpointDialog - the partition picker", () => {
  const withBanks = (over = {}) =>
    anEnv({
      supportsPartitions: true,
      partitionLabels: { [-1]: "R0", 0: "00", 1: "01" },
      ...over
    });

  const renderWithBanks = (controls: ReturnType<typeof someControls>, setup = aListMachine) =>
    renderWithProviders(
      <BreakpointDialog env={withBanks()} machineSetup={setup} controls={controls} />
    );

  it("defaults to no partition, so the picker stays out of the way", () => {
    // --- Most breakpoints are not partition-bound. The checkbox states that default plainly
    // --- instead of hiding it behind a "(none)" entry in an open menu.
    renderWithBanks(someControls());

    expect(screen.getByText("Break only in a specific partition")).toBeTruthy();
    expect(screen.queryByText("ROM 0")).toBeNull();
  });

  it("emits no partition while the box is unticked", async () => {
    const controls = someControls();
    renderWithBanks(controls);

    typeAddress("$8000");
    submit();

    await waitFor(() => expect(controls.close).toHaveBeenCalled());
    expect(controls.close.mock.calls[0][0].breakpoint.partition).toBeUndefined();
  });

  it("selects the machine's lowest partition when the box is ticked", async () => {
    // --- Not a hardcoded 0: on a machine whose ROM pages are indexed from -1, bank 0 is not the
    // --- first partition and picking it would silently mean something else.
    const controls = someControls();
    renderWithBanks(controls);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    typeAddress("$8000");
    submit();

    await waitFor(() => expect(controls.close).toHaveBeenCalled());
    expect(controls.close.mock.calls[0][0].breakpoint.partition).toBe(-1);
  });

  it("opens on the partition a breakpoint already carries", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={{ address: 0x8000, exec: true, partition: 1 }}
        env={withBanks({ existingKeys: ["01:$8000"], editingKey: "01:$8000" })}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );

    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
  });

  it("keeps the partition when saving an untouched edit", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        initial={{ address: 0x8000, exec: true, partition: 1 }}
        env={withBanks({ existingKeys: ["01:$8000"], editingKey: "01:$8000" })}
        machineSetup={aListMachine}
        controls={controls}
      />
    );

    submit("Save");

    await waitFor(() => expect(controls.close).toHaveBeenCalled());
    expect(controls.close.mock.calls[0][0].breakpoint.partition).toBe(1);
  });

  it("renders on a machine with hundreds of banks without listing them", () => {
    // --- The ZX Next shape. The matrix picker only appears once a partition is asked for, and it
    // --- is a grid rather than 247 dropdown rows.
    renderWithBanks(someControls(), aMatrixMachine);

    expect(screen.getByText("Break only in a specific partition")).toBeTruthy();
  });

  it("refuses a partition on a machine without banks", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );

    expect(screen.queryByText("Break only in a specific partition")).toBeNull();
  });

  it("explains why an I/O breakpoint cannot take one", () => {
    renderWithBanks(someControls());

    fireEvent.click(screen.getByLabelText("I/O read"));

    expect(screen.getByText("An I/O breakpoint watches a port, not a partition.")).toBeTruthy();
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).disabled).toBe(true);
  });

  it("drops a partition chosen before the type became I/O", async () => {
    const controls = someControls();
    renderWithBanks(controls);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByLabelText("I/O write"));
    typeAddress("$00fe");
    submit();

    await waitFor(() => expect(controls.close).toHaveBeenCalled());
    expect(controls.close.mock.calls[0][0].breakpoint.partition).toBeUndefined();
  });
});

describe("BreakpointDialog - errors", () => {
  it("does not submit an unparseable address, and says why", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("nonsense");
    submit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/valid address/));
    expect(controls.close).not.toHaveBeenCalled();
  });

  it("points a source spec at the editor margin instead of accepting it", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("[code/code.kz80.asm]:12");
    submit();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/editor's left margin/)
    );
    expect(controls.close).not.toHaveBeenCalled();
  });

  it("refuses a duplicate and names the clash", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        env={anEnv({ existingKeys: ["$8000"] })}
        machineSetup={aListMachine}
        controls={controls}
      />
    );

    typeAddress("$8000");
    submit();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/already exists at \$8000/)
    );
    expect(controls.close).not.toHaveBeenCalled();
  });

  it("clears the complaint once the address is corrected", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    typeAddress("nonsense");
    submit();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeNull());

    typeAddress("$8000");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    submit();
    await waitFor(() => expect(controls.close).toHaveBeenCalled());
  });
});

describe("BreakpointDialog - editing", () => {
  const initial = { address: 0x9000, memoryRead: true, disabled: true };

  it("opens on the breakpoint it was given", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={initial}
        env={anEnv({ existingKeys: ["$9000:R"], editingKey: "$9000:R" })}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );

    expect((addressBox() as HTMLInputElement).value).toBe("$9000");
    expect((screen.getByLabelText("Memory read") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Enabled" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("carries the original breakpoint back as the one it replaces", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        initial={initial}
        env={anEnv({ existingKeys: ["$9000:R"], editingKey: "$9000:R" })}
        machineSetup={aListMachine}
        controls={controls}
      />
    );

    typeAddress("$A000");
    submit("Save");

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ address: 0xa000, memoryRead: true }),
        replaces: initial
      })
    );
  });

  it("lets a breakpoint keep its own key", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        initial={initial}
        env={anEnv({ existingKeys: ["$9000:R"], editingKey: "$9000:R" })}
        machineSetup={aListMachine}
        controls={controls}
      />
    );

    submit("Save");

    // --- Editing only the Enabled box must not trip the duplicate check against itself.
    await waitFor(() => expect(controls.close).toHaveBeenCalled());
  });

  it("shows the live hit count and resets it", async () => {
    const onResetHits = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <BreakpointDialog
        initial={{ address: 0x9000, exec: true, hitCount: 42, currentHits: 7 }}
        env={anEnv()}
        machineSetup={aListMachine}
        onResetHits={onResetHits}
        controls={someControls()}
      />
    );

    expect(screen.getByTestId("breakpoint-hits").textContent).toBe("7");
    fireEvent.click(screen.getByText("Reset"));
    await waitFor(() => expect(screen.getByTestId("breakpoint-hits").textContent).toBe("0"));
    expect(onResetHits).toHaveBeenCalled();
  });

  it("shows no live count when adding", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );
    expect(screen.queryByTestId("breakpoint-hits")).toBeNull();
  });
});

/*
 * The sixth type. What matters here is what the *view* does when it is chosen: the address field
 * is replaced rather than re-labelled, the partition row disappears, and two controls the other
 * five never show appear. The rules behind them live in `breakpoint-form.ts`.
 */

const aNextEnv = (over: Partial<BreakpointEnvironment> = {}): BreakpointEnvironment =>
  anEnv({ supportsPartitions: true, supportsNextRegBreakpoints: true, ...over });

const chooseNextReg = () => fireEvent.click(screen.getByLabelText("NextReg write"));
const typeInto = (index: number, value: string) =>
  fireEvent.change(screen.getAllByRole("textbox")[index], { target: { value } });
/*
 * The two filter fields have no visible label of their own - the `/` between them is what tells a
 * sighted reader which is which - so they carry an accessible name, and these address them by it
 * rather than by position.
 */
const typeNamed = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe("BreakpointDialog - NextReg write breakpoints", () => {
  it("offers the type only on a machine that has Next Registers", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("NextReg write")).toBeNull();

    cleanup();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("NextReg write")).not.toBeNull();
  });

  it("replaces the address field and hides the partition row", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    expect(screen.queryByText("Break only in a specific partition")).not.toBeNull();

    chooseNextReg();

    expect(screen.queryByText(/^Address/)).toBeNull();
    // --- Hidden, not disabled: a register has no location, so there is no "why not" to explain.
    expect(screen.queryByText("Break only in a specific partition")).toBeNull();
    expect(screen.queryByText("Register *")).not.toBeNull();
  });

  it("names the register as it is typed", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    chooseNextReg();

    typeInto(0, "$07");
    expect(screen.queryByText(/\$07 — CPU speed/)).not.toBeNull();

    // --- 256 registers are addressable but only 141 documented; the undocumented ones say so
    // --- rather than silently showing nothing.
    typeInto(0, "$7f");
    expect(screen.queryByText(/\$7F — /)).not.toBeNull();
  });

  it("states the timing contract, so the feature does not read as a write-veto", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    chooseNextReg();

    expect(screen.queryByText(/Stops after the instruction that wrote the register/)).not.toBeNull();
  });

  it("reveals the value and mask fields only once the filter is ticked", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    chooseNextReg();

    // --- Register only - and the Condition field every kind has.
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByLabelText("Value")).toBeNull();

    fireEvent.click(screen.getByLabelText("Break only on a specific value"));

    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    // --- Side by side, in the notation the key and the command both use: `=$03/$0F`.
    expect(screen.getByLabelText("Value")).toBeDefined();
    expect(screen.getByLabelText("Mask")).toBeDefined();
  });

  it("emits a bare NextReg breakpoint", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );

    chooseNextReg();
    typeInto(0, "$07");
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ nextReg: 0x07, exec: false }),
        replaces: undefined
      })
    );
  });

  it("emits the filter and the copper opt-in when they are set", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );

    chooseNextReg();
    typeInto(0, "$07");
    fireEvent.click(screen.getByLabelText("Break only on a specific value"));
    typeNamed("Value", "$03");
    typeNamed("Mask", "$0f");
    fireEvent.click(screen.getByLabelText("Also break on copper writes"));
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoint: expect.objectContaining({
            nextReg: 0x07,
            nextRegValue: 0x03,
            nextRegMask: 0x0f,
            nextRegCopper: true
          })
        })
      )
    );
  });

  it("drops an abandoned filter instead of leaving it to fail out of sight", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );

    chooseNextReg();
    typeInto(0, "$07");
    const filter = screen.getByLabelText("Break only on a specific value");
    fireEvent.click(filter);
    typeNamed("Value", "$03");
    fireEvent.click(filter);
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoint: expect.objectContaining({ nextReg: 0x07, nextRegValue: undefined })
        })
      )
    );
  });

  it("opens an existing NextReg breakpoint on the right type, with its fields filled", () => {
    renderWithProviders(
      <BreakpointDialog
        env={aNextEnv()}
        machineSetup={aMatrixMachine}
        controls={someControls()}
        initial={{ nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0x0f, nextRegCopper: true }}
      />
    );

    expect((screen.getByLabelText("NextReg write") as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("$07");
    expect((screen.getByLabelText("Value") as HTMLInputElement).value).toBe("$03");
    expect((screen.getByLabelText("Mask") as HTMLInputElement).value).toBe("$0F");
    expect((screen.getByLabelText("Also break on copper writes") as HTMLInputElement).checked).toBe(
      true
    );
  });

  it("clears the register when the type changes away, and the address when it changes back", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );

    typeAddress("$8000");
    chooseNextReg();
    typeInto(0, "$07");
    submit();

    await waitFor(() => expect(controls.close).toHaveBeenCalled());

    // --- The address typed before the switch must not travel with the register. Asserted on the
    // --- field directly: `objectContaining` treats an absent key and an undefined one differently,
    // --- and "absent" is exactly what this is checking for.
    const { breakpoint } = controls.close.mock.calls[0][0];
    expect(breakpoint).toMatchObject({ nextReg: 0x07 });
    expect(breakpoint.address).toBeUndefined();
    expect(breakpoint.partition).toBeUndefined();
  });
});

/*
 * Conditions and hit counts (Phase 5 of `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`, §4.4). The rules
 * are `breakpoint-form.ts`'s and tested there; these check what the view shows and emits.
 */
describe("BreakpointDialog - conditions and hit counts", () => {
  const conditionBox = () => screen.getByLabelText("Condition");

  it("emits the condition typed", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={anEnv({ machineId: "sp48" })} machineSetup={aListMachine} controls={controls} />
    );
    typeAddress("$8000");
    fireEvent.change(conditionBox(), { target: { value: "A == $FF && !ZF" } });
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ address: 0x8000, condition: "A == $FF && !ZF" }),
        replaces: undefined
      })
    );
  });

  it("shows a condition error with its column once the field is touched, and refuses to save", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={anEnv({ machineId: "sp48" })} machineSetup={aListMachine} controls={controls} />
    );
    typeAddress("$8000");
    fireEvent.change(conditionBox(), { target: { value: "A == == 1" } });

    expect(await screen.findByText("Column 6: Unexpected '=='; expected a value")).toBeTruthy();
    submit();
    expect(controls.close).not.toHaveBeenCalled();
  });

  it("shows an unknown-label warning but still saves", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        env={anEnv({ machineId: "sp48", conditionSymbols: {} })}
        machineSetup={aListMachine}
        controls={controls}
      />
    );
    typeAddress("$8000");
    fireEvent.change(conditionBox(), { target: { value: "w[score] > 3" } });

    expect(screen.getByRole("status").textContent).toContain("Unknown label score");
    submit();
    await waitFor(() => expect(controls.close).toHaveBeenCalled());
  });

  it("edits an existing hit rule's count", async () => {
    const controls = someControls();
    const initial = { address: 0x9000, exec: true, hitMode: "every" as const, hitCount: 4 };
    renderWithProviders(
      <BreakpointDialog initial={initial} env={anEnv({ machineId: "sp48" })} machineSetup={aListMachine} controls={controls} />
    );
    expect(screen.getByRole("combobox", { name: "Hit count rule" }).textContent).toContain("Every");
    fireEvent.change(screen.getByLabelText("Hit count"), { target: { value: "10" } });
    submit("Save");

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ hitMode: "every", hitCount: 10 }),
        replaces: initial
      })
    );
  });

  it("hides the count field while the rule is 'Always'", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("Hit count")).toBeNull();
  });

  it("focuses the hit count when asked to", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={{ address: 0x9000, exec: true, hitCount: 4 }}
        focus="hitCount"
        env={anEnv()}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Hit count"));
  });
});

describe("BreakpointDialog - source mode", () => {
  const source = {
    resource: "main.asm",
    line: 42,
    exec: true,
    resolvedAddress: 0x8012,
    condition: "B == 0",
    currentHits: 3
  };

  it("shows the location instead of the type, address and partition", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={source}
        env={anEnv({ supportsPartitions: true, partitionLabels: { 0: "B0" } })}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );
    expect(screen.getByText("main.asm:42 ($8012)")).toBeTruthy();
    expect(screen.queryByLabelText("Execution")).toBeNull();
    expect(screen.queryByText("Break only in a specific partition")).toBeNull();
    // --- The condition is the only text field, and it has the focus
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByLabelText("Condition"));
    expect(screen.getByTestId("breakpoint-hits").textContent).toBe("3");
  });

  it("says when the breakpoint is not resolved yet", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={{ resource: "main.asm", line: 7, column: 2, exec: true }}
        env={anEnv()}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );
    expect(screen.getByText("main.asm:7:3 (not resolved - build the project)")).toBeTruthy();
  });

  it("saves the same source breakpoint with the edited condition", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog initial={source} env={anEnv({ machineId: "sp48" })} machineSetup={aListMachine} controls={controls} />
    );
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "B == 1" } });
    submit("Save");

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: {
          resource: "main.asm",
          line: 42,
          exec: true,
          resolvedAddress: 0x8012,
          disabled: false,
          condition: "B == 1"
        },
        replaces: source
      })
    );
  });
});

// --- `.plans/LOGPOINTS_PLAN.md` §4.5: the Action row and the log message field
describe("BreakpointDialog - logpoints", () => {
  it("shows the message field only for the Log message action, and emits the template", async () => {
    const controls = someControls();
    renderWithProviders(<BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={controls} />);

    expect((screen.getByLabelText("Stop") as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText("Log message", { selector: "input[type=text], input:not([type])" })).toBeNull();
    typeAddress("$8000");
    fireEvent.click(screen.getByLabelText("Log message", { selector: "input[type=radio]" }));
    const message = screen.getByLabelText("Log message", { selector: "input:not([type=radio])" });
    fireEvent.change(message, { target: { value: "[LOOP] B={B}" } });
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({
          breakpoint: expect.objectContaining({ address: 0x8000, logMessage: "[LOOP] B={B}" })
        })
      )
    );
  });

  it("opens on the message with the action set to log when asked to", () => {
    renderWithProviders(
      <BreakpointDialog
        env={anEnv()}
        machineSetup={aListMachine}
        controls={someControls()}
        initial={{ address: 0x8000, exec: true }}
        focus="logMessage"
      />
    );
    expect((screen.getByLabelText("Log message", { selector: "input[type=radio]" }) as HTMLInputElement).checked).toBe(
      true
    );
  });

  it("refuses a template that does not compile, with its column", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog
        env={anEnv()}
        machineSetup={aListMachine}
        controls={controls}
        initial={{ address: 0x8000, exec: true, logMessage: "x={A +}" }}
      />
    );
    submit("Save");
    await waitFor(() => expect(screen.getByText(/^Column \d+:/)).toBeTruthy());
    expect(controls.close).not.toHaveBeenCalled();
  });
});

describe("BreakpointDialog - Copper instruction breakpoints", () => {
  const chooseCopper = () => fireEvent.click(screen.getByLabelText("Copper instruction"));

  it("offers the type only on the ZX Spectrum Next", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("Copper instruction")).toBeNull();
    cleanup();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("Copper instruction")).not.toBeNull();
  });

  it("replaces the address with a list index and hides the partition row", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    chooseCopper();
    expect(screen.queryByText(/^Address/)).toBeNull();
    expect(screen.queryByText("Break only in a specific partition")).toBeNull();
    expect(screen.queryByText("List index *")).not.toBeNull();
  });

  it("emits a cu: breakpoint", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );
    chooseCopper();
    typeInto(0, "$00B");
    submit();
    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ copperIndex: 0x0b, exec: false })
      })
    );
    expect(controls.close.mock.calls[0][0].breakpoint.address).toBeUndefined();
  });
});

describe("BreakpointDialog - sprite attribute breakpoints", () => {
  const chooseSprite = () => fireEvent.click(screen.getByLabelText("Sprite attribute write"));

  it("offers the type only on the ZX Spectrum Next", () => {
    renderWithProviders(
      <BreakpointDialog env={anEnv()} machineSetup={aListMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("Sprite attribute write")).toBeNull();
    cleanup();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    expect(screen.queryByLabelText("Sprite attribute write")).not.toBeNull();
  });

  it("replaces the address with a sprite and attribute bytes, and hides the partition row", () => {
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={someControls()} />
    );
    chooseSprite();
    expect(screen.queryByText(/^Address/)).toBeNull();
    expect(screen.queryByText("Break only in a specific partition")).toBeNull();
    expect(screen.queryByText("Sprite *")).not.toBeNull();
    expect(screen.queryByText("0: X")).not.toBeNull();
    expect(screen.queryByText("4: attr4")).not.toBeNull();
  });

  it("emits an sp: breakpoint, narrowed to the ticked bytes", async () => {
    const controls = someControls();
    renderWithProviders(
      <BreakpointDialog env={aNextEnv()} machineSetup={aMatrixMachine} controls={controls} />
    );
    chooseSprite();
    typeInto(0, "$0C");
    // --- Untick attr2, attr3 and attr4: X and Y remain
    for (const label of ["2: palette, mirror, rotate, X8", "3: visible, pattern", "4: attr4"]) {
      fireEvent.click(screen.getByText(label));
    }
    submit();
    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith({
        breakpoint: expect.objectContaining({ spriteIndex: 0x0c, spriteAttrMask: 0x03, exec: false })
      })
    );
    expect(controls.close.mock.calls[0][0].breakpoint.address).toBeUndefined();
  });
});
