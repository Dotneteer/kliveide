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
    fireEvent.click(screen.getByRole("checkbox"));
    submit();

    await waitFor(() =>
      expect(controls.close).toHaveBeenCalledWith(
        expect.objectContaining({ breakpoint: expect.objectContaining({ disabled: true }) })
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
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
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

  it("shows the hit count the emulator reports, without offering to edit it", () => {
    renderWithProviders(
      <BreakpointDialog
        initial={{ address: 0x9000, exec: true, hitCount: 42 }}
        env={anEnv()}
        machineSetup={aListMachine}
        controls={someControls()}
      />
    );

    expect(screen.getByText("Hit count: 42")).toBeTruthy();
  });
});
