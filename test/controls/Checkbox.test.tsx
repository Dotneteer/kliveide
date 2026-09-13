import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";
import { Checkbox } from "@renderer/controls/Checkbox";

/**
 * The shared checkbox.
 *
 * Its label and its input were siblings with nothing associating them — no `htmlFor`, no `id`, no
 * wrapping. Clicking the label worked, because the label carried its own `onClick`, so the defect
 * was invisible in use: the checkbox simply had **no accessible name**. A screen reader announced
 * "checkbox, unchecked" with nothing to say which setting it was.
 *
 * Associating them introduced the opposite risk, which is what most of this file is for: with
 * `htmlFor` in place the browser forwards a label click to the input, so the label's own handler
 * would have fired *alongside* it and toggled twice per click.
 */
describe("Checkbox", () => {
  it("gives the input an accessible name from its label", () => {
    renderWithProviders(<Checkbox label="Big-endian write" />);
    expect(screen.getByRole("checkbox", { name: "Big-endian write" })).toBeTruthy();
  });

  it("reports one change per click on the input", () => {
    const onChange = vi.fn();
    renderWithProviders(<Checkbox label="Big-endian write" onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Big-endian write" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  /*
   * The double-toggle guard. Clicking the label reaches the input through `htmlFor`; if the label
   * also handled the click itself, this would report twice and settle back on `false`.
   */
  it("reports one change per click on the label", () => {
    const onChange = vi.fn();
    renderWithProviders(<Checkbox label="Big-endian write" onChange={onChange} />);

    fireEvent.click(screen.getByText("Big-endian write"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Big-endian write" })).toBeChecked();
  });

  it("toggles back on a second click", () => {
    const onChange = vi.fn();
    renderWithProviders(<Checkbox label="Big-endian write" onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Big-endian write" });

    fireEvent.click(box);
    fireEvent.click(box);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(box).not.toBeChecked();
  });

  it("does not report a change while disabled", () => {
    const onChange = vi.fn();
    renderWithProviders(<Checkbox label="Big-endian write" enabled={false} onChange={onChange} />);

    fireEvent.click(screen.getByText("Big-endian write"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Big-endian write" })).not.toBeChecked();
  });

  it("gives each instance its own id", () => {
    renderWithProviders(
      <>
        <Checkbox label="First" />
        <Checkbox label="Second" />
      </>
    );

    const first = screen.getByRole("checkbox", { name: "First" });
    const second = screen.getByRole("checkbox", { name: "Second" });
    expect(first.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });
});
