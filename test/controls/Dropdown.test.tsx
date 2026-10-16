import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "@renderer/controls/Dropdown";

vi.mock("@renderer/controls/overlay/useOverlayRoot", () => ({
  useOverlayRoot: () => document.body
}));

vi.mock("@renderer/controls/Icon", () => ({
  Icon: () => null
}));

describe("Dropdown", () => {
  afterEach(() => {
    cleanup();
  });

  beforeAll(() => {
    HTMLElement.prototype.hasPointerCapture ??= vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture ??= vi.fn();
    HTMLElement.prototype.releasePointerCapture ??= vi.fn();
    HTMLElement.prototype.scrollIntoView ??= vi.fn();
  });

  const options = [
    { value: "sp48:pal", label: "ZX Spectrum 48K" },
    { value: "sp128", label: "ZX Spectrum 128K" },
    { value: "zxnext", label: "ZX Spectrum Next" }
  ];

  it("keeps the selected item visible after a user selection", async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();

    render(<Dropdown options={options} initialValue="sp48:pal" onChanged={onChanged} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "ZX Spectrum 128K" }));

    expect(onChanged).toHaveBeenCalledWith("sp128");
    expect(screen.getByRole("combobox")).toHaveTextContent("ZX Spectrum 128K");
  });

  it("shows group headings above consecutive options of a group", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        options={[
          { value: "sp48", label: "ZX Spectrum 48K", group: "ZX Spectrum" },
          { value: "zxnext", label: "ZX Spectrum Next", group: "ZX Spectrum" },
          { value: "zx81", label: "Sinclair ZX81", group: "Other Z80 machines" }
        ]}
        initialValue="sp48"
      />
    );

    await user.click(screen.getByRole("combobox"));
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent(/^ZX Spectrum/);
    expect(groups[1]).toHaveTextContent("Other Z80 machines");
    // --- A heading is not an option
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("syncs its selected item when the initial value changes externally", () => {
    const { rerender } = render(<Dropdown options={options} initialValue="sp48:pal" />);

    rerender(<Dropdown options={options} initialValue="zxnext" />);

    expect(screen.getByRole("combobox")).toHaveTextContent("ZX Spectrum Next");
  });
});
