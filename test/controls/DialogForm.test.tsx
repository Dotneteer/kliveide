import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DialogField } from "@renderer/controls/DialogField";
import { DialogForm } from "@renderer/controls/DialogForm";

afterEach(cleanup);

describe("DialogForm", () => {
  it("submits through the native form path and invokes cancel separately", async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <DialogForm submitLabel="Save" onSubmit={onSubmit} onCancel={onCancel}>
        <input aria-label="Name" />
      </DialogForm>
    );

    fireEvent.submit(screen.getByRole("textbox", { name: "Name" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables submit when the form is invalid", () => {
    render(
      <DialogForm submitLabel="Save" submitDisabled onSubmit={vi.fn()} onCancel={vi.fn()}>
        <div />
      </DialogForm>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("DialogField", () => {
  it("connects its label and error text to a field", () => {
    render(
      <DialogField label="Project name" htmlFor="project-name" required error="Name is required.">
        <input id="project-name" />
      </DialogField>
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("id", "project-name");
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
  });
});
