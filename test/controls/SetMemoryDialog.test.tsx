import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";
import { SetMemoryDialog } from "@renderer/appIde/dialogs/SetMemoryDialog";

const appServicesMock = vi.hoisted(() => ({
  executeCommand: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    ideCommandsService: {
      executeCommand: appServicesMock.executeCommand
    }
  })
}));

afterEach(() => {
  cleanup();
  appServicesMock.executeCommand.mockReset();
  vi.restoreAllMocks();
});

describe("SetMemoryDialog", () => {
  it("resolves RAM edits with value, size option, and endian flag", async () => {
    appServicesMock.executeCommand.mockResolvedValue({ success: true });
    const onSetMemory = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={onSetMemory}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => {
      expect(onSetMemory).toHaveBeenCalledWith({
        value: "$12",
        sizeOption: "-b8",
        bigEndian: false
      });
    });
    expect(appServicesMock.executeCommand).toHaveBeenCalledWith("num $12");
  });

  it("keeps the dialog open and displays an error when submit validation rejects a value", async () => {
    appServicesMock.executeCommand.mockImplementation((command: string) =>
      Promise.resolve({ success: command !== "num nope" })
    );

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid numeric value.");
    });
    expect(appServicesMock.executeCommand).toHaveBeenCalledWith("num nope");
  });

  it("hides the primary action and closes in ROM mode", async () => {
    appServicesMock.executeCommand.mockResolvedValue({ success: true });
    const onClose = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x0000}
        currentValue={0xff}
        decimal={false}
        isRom={true}
        onSetMemory={vi.fn()}
        onClose={onClose}
      />
    );

    expect(screen.queryByRole("button", { name: "Set" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  /*
   * Endianness is derived from the size, not remembered separately.
   *
   * Pick a multi-byte size, tick "Big-endian write", then go back to one byte: the checkbox
   * correctly disables itself, but the `true` it had set stayed in state and was still submitted,
   * so `MemoryPanel` appended `-be` to a single-byte write. The submitted value is now computed
   * from the current size, which removes the second place that had to be kept in step.
   */
  it("does not submit big-endian for a single-byte write", async () => {
    appServicesMock.executeCommand.mockResolvedValue({ success: true });
    const onSetMemory = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={onSetMemory}
        onClose={vi.fn()}
      />
    );

    // --- Tick the box while it is enabled, without changing the size away from one byte. The
    // --- checkbox's own `enabled` gate is a *view* concern; this asserts the submitted value.
    const checkbox = screen.getByRole("checkbox", { name: /Big-endian/i });
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => expect(onSetMemory).toHaveBeenCalled());
    expect(onSetMemory.mock.calls[0][0]).toMatchObject({ sizeOption: "-b8", bigEndian: false });
  });

  /*
   * A throw from the validating command is an error the dialog must show.
   *
   * Only `success === false` was handled; a rejection escaped through `DialogForm`'s
   * `await onSubmit()` as an unhandled promise, leaving the dialog open, silent, and apparently
   * ignoring the button.
   */
  it("shows an error when the validating command throws", async () => {
    appServicesMock.executeCommand.mockRejectedValue(new Error("emulator not running"));
    const onSetMemory = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={onSetMemory}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => expect(screen.getByText("emulator not running")).toBeTruthy());
    expect(onSetMemory).not.toHaveBeenCalled();
  });
});
