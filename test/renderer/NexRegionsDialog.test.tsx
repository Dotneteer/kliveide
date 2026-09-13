import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexRegionsDialog } from "@renderer/appIde/DocumentPanels/Next/NexRegionsDialog";

/*
 * The type filter is the app's Radix-backed `Dropdown`, whose trigger opens a portalled listbox on
 * pointer events jsdom does not produce; a native select keeps these tests about the dialog's own
 * behaviour. `Icon` reads the theme through context, which nothing provides here.
 */
vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({
    theme: { tone: "dark" },
    getIcon: () => ({ width: 16, height: 16, path: "" }),
    getImage: () => ({ type: "png", data: "" }),
    getThemeProperty: () => "currentColor"
  })
}));

vi.mock("@renderer/controls/Dropdown", () => ({
  default: ({
    options,
    ariaLabel,
    initialValue,
    onChanged
  }: {
    options: { value: string; label: string }[];
    ariaLabel?: string;
    initialValue?: string;
    onChanged?: (value: string) => void;
  }) => (
    <select
      aria-label={ariaLabel}
      value={initialValue}
      onChange={(event) => onChanged?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));


afterEach(() => {
  cleanup();
});

describe("NexRegionsDialog", () => {
  it("selects the active region by default and reports row actions", async () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={5}
        bytes={[1, 2, 3, 4, 0, 0, 0, 0]}
        regions={[
          { start: 0, end: 3, type: "bytes" },
          { start: 4, end: 0x3fff, type: "disassemble" }
        ]}
        controls={controls}
      />
    );

    /*
     * A real disassembly of the region's own bytes, not a sentence describing it. The four bytes
     * from $0004 are zeros, so the listing is four `nop`s — which is the point: it reads the memory
     * rather than reporting the region's length back at you.
     */
    await waitFor(() =>
      expect(screen.getByLabelText("Region preview")).toHaveTextContent("$0004 nop")
    );
    expect(screen.getByLabelText("Region preview")).not.toHaveTextContent("Z80 disassembly");
    fireEvent.click(screen.getAllByRole("button", { name: "Go To" })[1]);

    expect(controls.close).toHaveBeenCalledWith({
      action: "go-to",
      region: { start: 4, end: 0x3fff, type: "disassemble" }
    });
  });

  it("filters regions by address and type", () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={0}
        bytes={[1, 2, 3, 4, 0, 0, 0, 0]}
        regions={[
          { start: 0, end: 3, type: "bytes" },
          { start: 4, end: 7, type: "words" },
          { start: 8, end: 0x3fff, type: "skip" }
        ]}
        controls={controls}
      />
    );

    fireEvent.change(screen.getByLabelText("Filter region type"), {
      target: { value: "words" }
    });

    expect(screen.getByText("words")).toBeInTheDocument();
    expect(screen.queryByText("bytes")).not.toBeInTheDocument();

    // --- An address *inside* a region finds it; it no longer has to be a boundary.
    fireEvent.change(screen.getByPlaceholderText("Find address, e.g. $1A00"), {
      target: { value: "$0100" }
    });
    fireEvent.change(screen.getByLabelText("Filter region type"), {
      target: { value: "all" }
    });

    expect(screen.getByText("skip")).toBeInTheDocument();
    expect(screen.queryByText("words")).not.toBeInTheDocument();
  });

  /**
   * The field answers "which region covers this address", which is the only lookup a region list
   * has. It used to be a text search over the start offset, the end offset and the type name: the
   * type half duplicated the filter beside it, and the offset half only matched a region's own
   * boundaries — so finding the region covering $1A00 meant already knowing where it began.
   */
  it("finds the region covering an address that is not one of its boundaries", () => {
    render(
      <NexRegionsDialog
        activeOffset={0}
        bytes={[1, 2, 3, 4, 0, 0, 0, 0]}
        regions={[
          { start: 0, end: 3, type: "bytes" },
          { start: 4, end: 0x3fff, type: "disassemble" }
        ]}
        controls={createControls()}
      />
    );

    const find = screen.getByPlaceholderText("Find address, e.g. $1A00");
    // --- $1A00 is neither region's start nor end; it is simply inside the second one.
    fireEvent.change(find, { target: { value: "$1A00" } });
    expect(screen.getByText("disassembly")).toBeInTheDocument();
    expect(screen.queryByText("bytes")).not.toBeInTheDocument();
    expect(find).toHaveAttribute("aria-invalid", "false");

    // --- Text that is not an address narrows nothing, and the field says why.
    fireEvent.change(find, { target: { value: "nonsense" } });
    expect(screen.getByText("bytes")).toBeInTheDocument();
    expect(screen.getByText("disassembly")).toBeInTheDocument();
    expect(find).toHaveAttribute("aria-invalid", "true");
  });

  it("reports edit, split, revert, and add actions", () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={0}
        bytes={[1, 2, 3, 4]}
        regions={[{ start: 0, end: 3, type: "bytes" }]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "edit",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "split",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "revert",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));
    expect(controls.close).toHaveBeenCalledWith({ action: "add" });
  });
});

function createControls() {
  return {
    id: "regions-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
