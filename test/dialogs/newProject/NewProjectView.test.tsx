import { describe, expect, it, vi } from "vitest";

import type { NewProjectIntent } from "@renderer/appIde/dialogs/newProject/NewProjectIntents";
import { MACHINE_OPTIONS } from "@renderer/appIde/dialogs/newProject/NewProjectModel";
import { NewProjectView } from "@renderer/appIde/dialogs/newProject/NewProjectView";
import type { NewProjectViewModel } from "@renderer/appIde/dialogs/newProject/NewProjectViewModel";

import { fireEvent, renderWithProviders, screen, within } from "../../react-test-utils";
import { aViewModel, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model: it never decides what is
 * valid or what can be submitted. Those rules live in the model and are tested
 * there; here we check that each field reaches the markup and that a DOM event
 * reports the right intent.
 */
function renderView(
  over?: DeepPartial<NewProjectViewModel>
): (intent: NewProjectIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<NewProjectView vm={aViewModel(over)} dispatch={dispatch} />);
  return dispatch;
}

const folderInput = () => screen.getAllByRole("textbox")[0];
const nameInput = () => screen.getAllByRole("textbox")[1];
const createButton = () => screen.getByRole("button", { name: "Create" });

describe("NewProjectView — rendering", () => {
  it("shows the values the view model carries", () => {
    renderView({
      projectFolder: { value: "/projects" },
      projectName: { value: "MyProject" }
    });

    expect(folderInput()).toHaveValue("/projects");
    expect(nameInput()).toHaveValue("MyProject");
  });

  it("renders a field error next to its input", () => {
    renderView({ projectName: { error: "Enter a file name." } });

    expect(screen.getByText("Enter a file name.")).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the label of the selected machine", () => {
    // --- Looked up rather than written out: this test is about the dropdown
    // --- showing the selection's label, not about what the registry calls it.
    // --- `getAllBy`, because the dropdown renders the label twice — once in the
    // --- visible trigger and once in the hidden native select it keeps for
    // --- accessibility — and two registry entries share this display name.
    const selected = MACHINE_OPTIONS.find((option) => option.value === "sp48:pal");
    renderView({ machine: { value: selected.value } });

    expect(screen.getAllByText(selected.label).length).toBeGreaterThan(0);
  });

  it("shows the selected template", () => {
    renderView({
      template: {
        options: [
          { value: "default", label: "default" },
          { value: "zxbasic", label: "zxbasic" }
        ],
        value: "zxbasic"
      }
    });

    expect(within(screen.getByTestId("new-project-templates")).getAllByText("zxbasic").length)
      .toBeGreaterThan(0);
  });

  it("disables the submit button when the view model refuses submission", () => {
    renderView({ submitEnabled: false });

    expect(createButton()).toBeDisabled();
  });

  it("shows the form as working while the sequence runs", () => {
    renderView({ submitting: true, submitEnabled: false });

    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
  });
});

describe("NewProjectView — intents", () => {
  it("reports an edited folder", () => {
    const dispatch = renderView();

    fireEvent.change(folderInput(), { target: { value: "/projects" } });

    expect(dispatch).toHaveBeenCalledWith({ type: "projectFolderEdited", folder: "/projects" });
  });

  it("reports an edited project name", () => {
    const dispatch = renderView();

    fireEvent.change(nameInput(), { target: { value: "MyProject" } });

    expect(dispatch).toHaveBeenCalledWith({ type: "projectNameEdited", name: "MyProject" });
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
});
