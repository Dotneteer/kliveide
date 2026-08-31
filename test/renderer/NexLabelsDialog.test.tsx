import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexLabelsDialog } from "@renderer/appIde/DocumentPanels/Next/NexLabelsDialog";

afterEach(() => {
  cleanup();
});

describe("NexLabelsDialog", () => {
  it("shows current bank labels by default and reports row actions", () => {
    const controls = createControls();

    render(
      <NexLabelsDialog
        bank={5}
        bankAddressOffset={0x4000}
        labels={[
          { scope: "global", name: "GlobalEntry", value: 0xc000, referenceCount: 2 },
          { scope: "local", bank: 5, name: "LocalLoop", value: 0x0123, referenceCount: 1 }
        ]}
        controls={controls}
      />
    );

    expect(screen.getByText("LocalLoop")).toBeInTheDocument();
    expect(screen.getByText("$4123")).toBeInTheDocument();
    expect(screen.queryByText("GlobalEntry")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go To" }));

    expect(controls.close).toHaveBeenCalledWith({
      action: "go-to",
      label: {
        scope: "local",
        bank: 5,
        name: "LocalLoop",
        value: 0x0123,
        referenceCount: 1
      }
    });
  });

  it("filters all labels and sorts by reference count", () => {
    const controls = createControls();

    render(
      <NexLabelsDialog
        bank={5}
        bankAddressOffset={0x8000}
        labels={[
          { scope: "global", name: "GlobalEntry", value: 0xc000, referenceCount: 1 },
          { scope: "local", bank: 5, name: "LocalLoop", value: 0x0123, referenceCount: 4 }
        ]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    fireEvent.change(screen.getByPlaceholderText("Search labels"), {
      target: { value: "entry" }
    });

    expect(screen.getByText("GlobalEntry")).toBeInTheDocument();
    expect(screen.queryByText("LocalLoop")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sort labels"), {
      target: { value: "references" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(controls.close).toHaveBeenCalledWith({
      action: "edit",
      label: {
        scope: "global",
        name: "GlobalEntry",
        value: 0xc000,
        referenceCount: 1
      }
    });
  });

  it("starts add actions with the selected scope", () => {
    const controls = createControls();

    render(
      <NexLabelsDialog
        bank={5}
        bankAddressOffset={0x8000}
        labels={[]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Global" }));
    expect(controls.close).toHaveBeenCalledWith({ action: "add", scope: "global" });

    fireEvent.click(screen.getByRole("button", { name: "Add Bank Label" }));
    expect(controls.close).toHaveBeenCalledWith({ action: "add", scope: "local" });
  });
});

function createControls() {
  return {
    id: "labels-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
