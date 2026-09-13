import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NexOperandLabelDialog,
  createCandidates,
  suggestUniqueLabelName
} from "@renderer/appIde/DocumentPanels/Next/NexOperandLabelDialog";

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

describe("NexOperandLabelDialog", () => {
  const operand = {
    instructionAddress: 0x8000,
    instructionOffset: 0,
    operandIndex: 0,
    operandValue: 0x8123,
    pragma: "L" as const,
    defaultText: "L8123"
  };

  it("groups exact and nearby candidates and suggests unique labels", () => {
    const candidates = createCandidates(
      [
        { scope: "global", name: "GlobalExact", value: 0x8123 },
        { scope: "local", bank: 5, name: "LocalNear", value: 0x0124 },
        { scope: "global", name: "FarAway", value: 0xc000 }
      ],
      0x8123,
      0x8000
    );

    expect(candidates).toEqual([
      expect.objectContaining({ name: "GlobalExact", group: "exact" }),
      expect.objectContaining({ name: "LocalNear", effectiveValue: 0x8124, group: "nearby" }),
      expect.objectContaining({ name: "FarAway", group: "all" })
    ]);
    expect(suggestUniqueLabelName([
      { scope: "local", bank: 5, name: "L_0123", value: 0x0123 }
    ], "local", 0x0123)).toBe("L_0123_1");
  });

  it("selects an explicit reference and applies a chosen candidate", () => {
    const controls = createControls();

    render(
      <NexOperandLabelDialog
        bank={5}
        bankAddressOffset={0x8000}
        instruction="call L8123"
        operands={[operand]}
        explicitReferences={[{ operandIndex: 0, scope: "local", name: "LocalExact" }]}
        labels={[
          { scope: "global", name: "GlobalExact", value: 0x8123 },
          { scope: "local", bank: 5, name: "LocalExact", value: 0x0123 }
        ]}
        controls={controls}
      />
    );

    expect(screen.getByText("call L8123")).toBeInTheDocument();
    expect(screen.getByText("$8123 (33059)")).toBeInTheDocument();
    expect(screen.getByText("LocalExact").closest("button")).toHaveAttribute(
      "data-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: "Clear Reference" })).not.toBeDisabled();

    fireEvent.click(screen.getByText("GlobalExact"));
    fireEvent.click(screen.getByRole("button", { name: "Apply Reference" }));

    expect(controls.close).toHaveBeenCalledWith({
      action: "apply",
      operandIndex: 0,
      scope: "global",
      name: "GlobalExact"
    });
  });

  it("creates labels and disables local creation outside the bank window", () => {
    const controls = createControls();

    render(
      <NexOperandLabelDialog
        bank={5}
        bankAddressOffset={0x8000}
        instruction="call L1234"
        operands={[{ ...operand, operandValue: 0x1234, defaultText: "L1234" }]}
        labels={[]}
        controls={controls}
      />
    );

    expect(screen.getByRole("button", { name: "Apply Reference" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Reference" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Bank Label" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Create Global Label" }));

    expect(controls.close).toHaveBeenCalledWith({
      action: "create-label",
      operandIndex: 0,
      scope: "global",
      name: "L_1234",
      value: 0x1234
    });
  });
});

function createControls() {
  return {
    id: "operand-label-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
