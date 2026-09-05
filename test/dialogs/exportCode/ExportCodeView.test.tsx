import { describe, expect, it, vi } from "vitest";

import type { ExportCodeIntent } from "@renderer/appIde/dialogs/exportCode/ExportCodeIntents";
import { ExportCodeView } from "@renderer/appIde/dialogs/exportCode/ExportCodeView";
import type { ExportCodeViewModel } from "@renderer/appIde/dialogs/exportCode/ExportCodeViewModel";

import { fireEvent, renderWithProviders, screen } from "../../react-test-utils";
import { aState, aViewModel, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model. Whether the loader checkbox or
 * the startup options appear is a `kind` field it reads, not a conditional
 * about the export format — that rule lives in the model and is tested there.
 */
function renderView(
  over?: DeepPartial<ExportCodeViewModel>,
  state = aState()
): (intent: ExportCodeIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<ExportCodeView vm={aViewModel(over, state)} dispatch={dispatch} />);
  return dispatch;
}

// --- A view model with everything on, for the tests about the full form.
const fullForm = aState({
  settings: {
    exportName: "game",
    formatId: "tzx",
    startBlock: true,
    screenFilename: "title.scr",
    startAddress: "32768"
  }
});

describe("ExportCodeView — sections", () => {
  it("hides the loader checkbox when the view model hides it", () => {
    renderView({ loader: { kind: "hidden" }, startup: { kind: "hidden" } });

    expect(screen.queryByText("Create BASIC loader")).not.toBeInTheDocument();
  });

  it("shows the loader checkbox when the view model shows it", () => {
    renderView(undefined, fullForm);

    expect(screen.getByText("Create BASIC loader")).toBeInTheDocument();
  });

  it("hides the startup options when the view model hides them", () => {
    renderView({ startup: { kind: "hidden" } });

    expect(screen.queryByText("Add CLEAR")).not.toBeInTheDocument();
    expect(screen.queryByText("Startup options:")).not.toBeInTheDocument();
  });

  it("shows every startup option when the view model shows them", () => {
    renderView(undefined, fullForm);

    expect(screen.getByText("Add CLEAR")).toBeInTheDocument();
    expect(screen.getByText("Add PAUSE 0")).toBeInTheDocument();
    expect(screen.getByText("Use a single code block")).toBeInTheDocument();
    expect(screen.getByText("Set border color:")).toBeInTheDocument();
    expect(screen.getByText("Code start address:")).toBeInTheDocument();
  });
});

describe("ExportCodeView — rendering", () => {
  it("shows the values the view model carries", () => {
    renderView(undefined, fullForm);
    const inputs = screen.getAllByRole("textbox");

    // --- Folder, export name, program name, screen file, start address.
    expect(inputs[1]).toHaveValue("game");
    expect(inputs[3]).toHaveValue("title.scr");
    expect(inputs[4]).toHaveValue("32768");
  });

  it("renders a field error next to its input", () => {
    renderView({ exportName: { error: "Enter a file name." } });

    expect(screen.getByText("Enter a file name.")).toBeInTheDocument();
  });

  it("disables the submit button when the view model refuses submission", () => {
    renderView({ submitEnabled: false });

    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
  });

  it("shows the form as working while the export runs", () => {
    renderView({ submitting: true, submitEnabled: false });

    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
  });
});

describe("ExportCodeView — intents", () => {
  it("reports an edited export name", () => {
    const dispatch = renderView();

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "game" } });

    expect(dispatch).toHaveBeenCalledWith({
      type: "settingEdited",
      patch: { exportName: "game" }
    });
  });

  it("reports a toggled loader checkbox", () => {
    const dispatch = renderView(undefined, fullForm);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    expect(dispatch).toHaveBeenCalledWith({
      type: "settingEdited",
      patch: { startBlock: false }
    });
  });

  it("reports a request to browse for the export folder", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Select the root project folder" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectExportFolderRequested" });
  });

  it("reports a request to browse for the screen file", () => {
    const dispatch = renderView(undefined, fullForm);

    fireEvent.click(screen.getByRole("button", { name: "Select the screen file" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectScreenFileRequested" });
  });

  it("reports a submission", () => {
    const dispatch = renderView({ submitEnabled: true });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "exportRequested" });
  });

  it("reports a cancellation", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "cancelRequested" });
  });
});
