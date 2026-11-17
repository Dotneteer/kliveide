import { describe, expect, it, vi } from "vitest";

import { t } from "@common/i18n/i18n";
import type { MakeProjectIntent } from "@renderer/appIde/dialogs/makeProject/MakeProjectIntents";
import { MakeProjectView } from "@renderer/appIde/dialogs/makeProject/MakeProjectView";
import type { MakeProjectViewModel } from "@renderer/appIde/dialogs/makeProject/MakeProjectViewModel";

import { fireEvent, renderWithProviders, screen } from "../../react-test-utils";
import { aViewModel, type DeepPartial } from "./fakes";

/**
 * The view renders the view model and reports intents; the rules are tested in the model and the
 * view model.
 */
function renderView(over?: DeepPartial<MakeProjectViewModel>): (intent: MakeProjectIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<MakeProjectView vm={aViewModel(over)} dispatch={dispatch} />);
  return dispatch;
}

describe("MakeProjectView", () => {
  it("shows the lead and both choices", () => {
    renderView({ lead: "The folder is not a project." });

    expect(screen.getByTestId("make-project-lead")).toHaveTextContent("The folder is not a project.");
    expect(screen.getByRole("radio", { name: t("dialog.makeProject.choice.make") })).toBeChecked();
    expect(screen.getByRole("radio", { name: t("dialog.makeProject.choice.keep") })).not.toBeChecked();
  });

  it("reports the choice", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByRole("radio", { name: t("dialog.makeProject.choice.keep") }));

    expect(dispatch).toHaveBeenCalledWith({ type: "choiceSelected", choice: "keep" });
  });

  it("lists replaceable files as checkboxes and taken places as text", () => {
    const dispatch = renderView({
      conflicts: {
        visible: true,
        items: [
          { path: "build.ksx", canOverwrite: true, overwrite: false },
          { path: "code/program.zxbas", canOverwrite: false, overwrite: false }
        ]
      }
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "build.ksx" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "overwriteToggled", path: "build.ksx", overwrite: true });
    expect(
      screen.getByText(t("dialog.makeProject.conflicts.blocked", { path: "code/program.zxbas" }))
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("hides the conflict list when there is none", () => {
    renderView();
    expect(screen.queryByTestId("make-project-conflicts")).toBeNull();
  });

  it("submits with the label the view model gives", () => {
    const dispatch = renderView({ submitLabel: "Make Project", submitEnabled: true });

    fireEvent.click(screen.getByRole("button", { name: "Make Project" }));

    expect(dispatch).toHaveBeenCalledWith({ type: "submitRequested" });
  });
});
