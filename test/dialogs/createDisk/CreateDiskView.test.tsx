import { describe, expect, it, vi } from "vitest";

import type { CreateDiskIntent } from "@renderer/appEmu/dialogs/createDisk/CreateDiskIntents";
import { CreateDiskView } from "@renderer/appEmu/dialogs/createDisk/CreateDiskView";
import type { CreateDiskViewModel } from "@renderer/appEmu/dialogs/createDisk/CreateDiskViewModel";

import { fireEvent, renderWithProviders, screen } from "../../react-test-utils";
import { aViewModel, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model, so these tests never touch a
 * port, a controller or a promise. They assert two things and nothing else:
 * that a view-model field reaches the markup, and that a DOM event dispatches
 * the right intent. What that intent then does is the controller's business.
 */
function renderView(
  over?: DeepPartial<CreateDiskViewModel>
): (intent: CreateDiskIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<CreateDiskView vm={aViewModel(over)} dispatch={dispatch} />);
  return dispatch;
}

const folderInput = () => screen.getAllByRole("textbox")[0];
const filenameInput = () => screen.getAllByRole("textbox")[1];
const createButton = () => screen.getByRole("button", { name: "Create" });

describe("CreateDiskView — rendering", () => {
  it("shows the values the view model carries", () => {
    renderView({ folder: { value: "/disks" }, filename: { value: "game.dsk" } });

    expect(folderInput()).toHaveValue("/disks");
    expect(filenameInput()).toHaveValue("game.dsk");
  });

  it("renders a field error next to its input", () => {
    renderView({ folder: { error: "Choose a folder." } });

    expect(screen.getByText("Choose a folder.")).toBeInTheDocument();
    expect(folderInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("disables the submit button when the view model refuses submission", () => {
    renderView({ submitEnabled: false });

    expect(createButton()).toBeDisabled();
  });

  it("enables the submit button when the view model allows it", () => {
    renderView({ submitEnabled: true });

    expect(createButton()).toBeEnabled();
  });

  it("shows the form as working while a write runs", () => {
    renderView({ submitting: true, submitEnabled: false });

    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });
});

describe("CreateDiskView — intents", () => {
  it("reports an edited folder", () => {
    const dispatch = renderView();

    fireEvent.change(folderInput(), { target: { value: "/disks" } });

    expect(dispatch).toHaveBeenCalledWith({ type: "folderEdited", folder: "/disks" });
  });

  it("reports an edited file name", () => {
    const dispatch = renderView();

    fireEvent.change(filenameInput(), { target: { value: "game.dsk" } });

    expect(dispatch).toHaveBeenCalledWith({ type: "filenameEdited", filename: "game.dsk" });
  });

  it("reports a request to browse for the folder", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Select the root project folder" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectFolderRequested" });
  });

  it("reports a submission", () => {
    const dispatch = renderView({ submitEnabled: true });

    fireEvent.click(createButton());

    expect(dispatch).toHaveBeenCalledWith({ type: "createRequested" });
  });

  it("reports a cancellation", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "cancelRequested" });
  });

  it("reports nothing when a disabled submit button is clicked", () => {
    const dispatch = renderView({ submitEnabled: false });

    fireEvent.click(createButton());

    expect(dispatch).not.toHaveBeenCalled();
  });
});
