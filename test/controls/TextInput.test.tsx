import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { TextInput } from "@renderer/controls/TextInput";
import { renderWithProviders } from "../react-test-utils";

afterEach(cleanup);

describe("TextInput", () => {
  it("renders the current controlled value after its parent changes it", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<TextInput value="first" onChange={onChange} />);

    rerender(<TextInput value="second" onChange={onChange} />);

    expect(screen.getByRole("textbox")).toHaveValue("second");
  });

  it("reports input changes directly to its owner", () => {
    const onChange = vi.fn();
    renderWithProviders(<TextInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "next" } });

    expect(onChange).toHaveBeenCalledWith("next");
  });

  it("uses a selected browse value through the same change callback", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TextInput
        value=""
        onChange={onChange}
        buttonIcon="folder"
        buttonTitle="Choose folder"
        browse={async () => "/tmp/project"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith("/tmp/project"));
  });

  it("exposes an invalid value and its error to assistive technology", () => {
    renderWithProviders(<TextInput value="bad" onChange={vi.fn()} error="Use a valid filename." />);

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Use a valid filename.");
  });
});
