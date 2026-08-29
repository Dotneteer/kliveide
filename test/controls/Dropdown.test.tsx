import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "@renderer/controls/Dropdown";

vi.mock("@renderer/core/useThemeRoot", () => ({
  useThemeRoot: () => document.body
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

  it("syncs its selected item when the initial value changes externally", () => {
    const { rerender } = render(<Dropdown options={options} initialValue="sp48:pal" />);

    rerender(<Dropdown options={options} initialValue="zxnext" />);

    expect(screen.getByRole("combobox")).toHaveTextContent("ZX Spectrum Next");
  });
});
