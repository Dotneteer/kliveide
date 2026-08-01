import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { NewItemDialog } from "@renderer/appIde/dialogs/NewItemDialog";
import { RenameDialog } from "@renderer/appIde/dialogs/RenameDialog";
import { renderWithProviders } from "../react-test-utils";

const validationServiceMock = vi.hoisted(() => ({
  isValidFilename: vi.fn((value: string) => Boolean(value) && !value.includes("/"))
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ validationService: validationServiceMock })
}));

afterEach(cleanup);

describe("filename dialogs", () => {
  it("submits a valid new item through the form's Enter path", async () => {
    const controls = { cancel: vi.fn(), close: vi.fn(), id: "new-item", reject: vi.fn() };

    renderWithProviders(
      <NewItemDialog path="src" itemNames={[]} controls={controls} />
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "main.asm" } });
    fireEvent.submit(input);

    await waitFor(() => expect(controls.close).toHaveBeenCalledWith({ name: "main.asm" }));
  });

  it("keeps rename disabled until the name is changed to a valid value", () => {
    renderWithProviders(
      <RenameDialog
        oldPath="main.asm"
        controls={{ cancel: vi.fn(), close: vi.fn(), id: "rename", reject: vi.fn() }}
      />
    );

    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "entry.asm" } });

    expect(screen.getByRole("button", { name: "Rename" })).toBeEnabled();
  });
});
