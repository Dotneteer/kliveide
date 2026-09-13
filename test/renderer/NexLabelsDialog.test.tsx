import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NexLabelsDialog } from "@renderer/appIde/DocumentPanels/Next/NexLabelsDialog";
import type { NexLabelDialogLabel } from "@renderer/appIde/DocumentPanels/Next/NexLabelDialog";

/*
 * The sort control is the app's Radix-backed `Dropdown`, whose trigger opens a portalled listbox on
 * pointer events jsdom does not produce. Standing in a native select keeps these tests about the
 * dialog's own behaviour — which sort mode it applies — rather than about driving Radix, and is the
 * same substitution `StaticMemoryDump.test.tsx` makes for the same reason. `ariaLabel` is carried
 * through so the accessible name stays under test.
 */
/*
 * `Icon` reads the theme through context for its glyph table; the Edit and Delete commands are icon
 * buttons, so the dialog cannot render without one. Only `getIcon` is reached here.
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

describe("NexLabelsDialog", () => {
  it("shows current bank labels by default and reports row actions", () => {
    const controls = createControls();
    const actions = createActions();

    render(
      <NexLabelsDialog
        bank={5}
        {...actions}
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
    const actions = createActions();

    render(
      <NexLabelsDialog
        bank={5}
        {...actions}
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
    fireEvent.click(screen.getByRole("button", { name: "Edit GlobalEntry" }));

    // --- Handed to the caller to run, with the list still open behind whatever it opens.
    expect(actions.onEditLabel).toHaveBeenCalledWith({
      scope: "global",
      name: "GlobalEntry",
      value: 0xc000,
      referenceCount: 1
    });
    expect(controls.close).not.toHaveBeenCalled();
  });

  /**
   * The scope radios name two things the dialog never explained.
   *
   * "Bank 5 / Global / All" only means something to a reader who already knows the sidecar has two
   * label scopes, and the choice decides which of the two Add buttons they want.
   */
  it("explains what the two label scopes are", () => {
    const actions = createActions();
    const { container } = render(
      <NexLabelsDialog
        bank={5}
        {...actions}
        bankAddressOffset={0x8000}
        labels={[]}
        controls={createControls()}
      />
    );

    // --- By element, not by text: "Bank Label" also names one of the footer buttons.
    const intro = container.querySelector("p") as HTMLElement;
    expect(intro).not.toBeNull();
    expect(intro.textContent).toContain("bank 5");
    expect(intro.textContent).toContain("global label");
    expect(intro.textContent).toContain("every bank");
  });

  /**
   * The list box is a viewport, not a box that sizes to its contents.
   *
   * It had `max-height`, so filtering by scope grew and shrank it — switching between a bank,
   * Global and All resized the table, moved the footer, and resized the whole dialog under the
   * pointer.
   *
   * Asserted against the stylesheet source rather than a rendered height, because jsdom resolves
   * every CSS-module rule to `auto`: a `getComputedStyle` check here passes whatever the rule says.
   * Same approach as `row-size-contract.test.ts`.
   */
  it("sizes the label list to a stated row count rather than to its contents", () => {
    // --- From the repo root: this file runs in the jsdom project, where `import.meta.url` is not
    // --- a file URL and cannot be resolved against.
    const sheet = readFileSync(
      join(process.cwd(), "src/renderer/appIde/DocumentPanels/Next/NexLabelsDialog.module.scss"),
      "utf8"
    );
    const table = sheet.slice(sheet.indexOf("\n.table {"), sheet.indexOf("\n.tableHeader"));

    expect(table).not.toContain("max-height");
    // --- The height is the row height times the rows, not a measured pixel total, so the two
    // --- numbers stay legible and changing either keeps the arithmetic right.
    expect(table).toContain("--list-visible-rows: 8");
    expect(table).toMatch(
      /height:\s*calc\(var\(--list-row-height\) \* \(var\(--list-visible-rows\) \+ 1\)\)/
    );
  });

  it("shows the same list box whichever scope is selected", () => {
    const actions = createActions();
    const { container } = render(
      <NexLabelsDialog
        bank={5}
        {...actions}
        bankAddressOffset={0x8000}
        labels={[
          { scope: "local", bank: 5, name: "LocalLoop", value: 0x0123, referenceCount: 0 },
          { scope: "global", name: "TheOnlyGlobal", value: 0xc000, referenceCount: 0 }
        ]}
        controls={createControls()}
      />
    );

    const table = container.querySelector('[class*="table"]') as HTMLElement;
    expect(table).not.toBeNull();

    // --- The box survives the filter rather than being torn down and rebuilt at a new size.
    fireEvent.click(screen.getByRole("radio", { name: "Global" }));
    expect(screen.getByText("TheOnlyGlobal")).toBeInTheDocument();
    expect(container.querySelector('[class*="table"]')).toBe(table);

    fireEvent.change(screen.getByPlaceholderText("Search labels"), {
      target: { value: "nothing matches this" }
    });
    expect(screen.getByText("No matching labels")).toBeInTheDocument();
    expect(container.querySelector('[class*="table"]')).toBe(table);
  });

  /**
   * The footer is the shared band, not a seventh hand-rolled copy.
   *
   * Every Nex dialog carried `margin: 20px -20px -20px` to break out of the body's padding, while
   * `.dialogBody` pads with `var(--space-4)` — 16px — so each of them overhung the body by 4px a
   * side and spilled past the dialog's rounded corners. The breakout now comes from the same token,
   * which is what this asserts: the class is `DialogFooter`'s, so the number cannot drift again.
   */
  it("uses the shared dialog footer rather than its own band", () => {
    const actions = createActions();
    const { container } = render(
      <NexLabelsDialog
        bank={5}
        {...actions}
        bankAddressOffset={0x8000}
        labels={[]}
        controls={createControls()}
      />
    );

    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
    expect(footer!.className).toContain("dialogFooter");
    // --- `row-reverse`, so the dismiss is declared first and lands at the trailing edge.
    expect(footer!.firstElementChild?.textContent).toBe("Close");
  });

  it("starts add actions with the selected scope", async () => {
    const controls = createControls();
    const actions = createActions();

    render(
      <NexLabelsDialog
        bank={5}
        {...actions}
        bankAddressOffset={0x8000}
        labels={[]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Global Label" }));
    expect(actions.onAddLabel).toHaveBeenCalledWith("global");

    // --- One at a time: the second Add is refused until the first has settled, which is what stops
    // --- a double-click opening two editors on the same label.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add Bank Label" })).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Bank Label" }));
    expect(actions.onAddLabel).toHaveBeenCalledWith("local");

    // --- Neither ends the dialog: the editor they open stacks over this list.
    expect(controls.close).not.toHaveBeenCalled();
    expect(controls.cancel).not.toHaveBeenCalled();
  });
});

/**
 * The three things the list can do to the annotations.
 *
 * They are callbacks rather than dialog results because the list stays open while they run — that
 * is what puts the editor and the delete confirmation *over* it rather than in place of it. Each
 * answers with the list as it now stands, which is how the dialog refreshes without new props.
 */
function createActions(afterAction: NexLabelDialogLabel[] = []) {
  return {
    onAddLabel: vi.fn(async () => afterAction),
    onEditLabel: vi.fn(async () => afterAction),
    onDeleteLabel: vi.fn(async () => afterAction)
  };
}

function createControls() {
  return {
    id: "labels-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
