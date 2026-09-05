import { describe, expect, it, vi } from "vitest";

import { SjasmplusIntegrationView } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusIntegrationView";
import type { SjasmplusIntent } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusIntents";
import type { SjasmplusViewModel } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusViewModel";

import { fireEvent, renderWithProviders, screen } from "../../react-test-utils";
import { aConfiguredState, aState, aViewModel, deepMerge, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model, so these tests never touch a
 * port, a controller or a promise. They assert two things and nothing else:
 * that a view-model field reaches the markup, and that a DOM event dispatches
 * the right intent. What that intent then does is the controller's business.
 *
 * The provider tree is here only because `Icon` reads the theme; nothing in
 * these tests depends on the store.
 */
function renderView(
  over?: DeepPartial<SjasmplusViewModel>,
  state = aState()
): (intent: SjasmplusIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<SjasmplusIntegrationView vm={aViewModel(over, state)} dispatch={dispatch} />);
  return dispatch;
}

describe("status block", () => {
  it("renders the empty state when nothing is configured", () => {
    renderView();

    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent(
      "No SJASMPLUS assembler is set up yet"
    );
    expect(screen.queryByTestId("sjasmplus-executable-path")).not.toBeInTheDocument();
  });

  it("renders the success badge with a label that does not rely on color", () => {
    renderView({ status: { badge: "passed" } }, aConfiguredState({ statusCheck: "passed" }));

    expect(screen.getByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.getByLabelText("SJASMPLUS is set up")).toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-broken-badge")).not.toBeInTheDocument();
  });

  it("renders the failure badge and its reason", () => {
    renderView(
      undefined,
      aConfiguredState({ statusCheck: "failed", statusError: "Path does not exist: /moved/away" })
    );

    expect(screen.getByTestId("sjasmplus-broken-badge")).toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Not working");
    expect(screen.getByTestId("sjasmplus-status-error")).toHaveTextContent(
      "Path does not exist: /moved/away"
    );
    // --- A stale version is not restated for a setup that cannot run
    expect(screen.queryByTestId("sjasmplus-version")).not.toBeInTheDocument();
  });

  it("renders a note in place of a badge when the two verdicts disagree", () => {
    renderView({
      status: {
        kind: "configured",
        badge: "none",
        detail: { kind: "note", text: "Press Apply to replace it with the executable below." }
      }
    }, aConfiguredState());

    expect(screen.getByTestId("sjasmplus-status-note")).toHaveTextContent("Press Apply to replace");
    expect(screen.queryByTestId("sjasmplus-integrated-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-broken-badge")).not.toBeInTheDocument();
  });
});

describe("source and scope choices", () => {
  it("dispatches selectExecutableRequested from the picker button", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByText("Select executable..."));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectExecutableRequested" });
  });

  it("hides the PATH row when there is nothing on PATH", () => {
    renderView();

    expect(screen.queryByText("On PATH")).not.toBeInTheDocument();
  });

  it("dispatches the clicked suggestion by its path", () => {
    const dispatch = renderView({
      source: { local: { suggestions: ["/usr/local/bin/sjasmplus"] } }
    });

    expect(screen.getByText("On PATH")).toBeInTheDocument();
    fireEvent.click(screen.getByText("/usr/local/bin/sjasmplus"));

    expect(dispatch).toHaveBeenCalledWith({
      type: "suggestionPicked",
      executablePath: "/usr/local/bin/sjasmplus"
    });
  });

  it("dispatches the setup mode the user switched to", () => {
    const dispatch = renderView();

    fireEvent.click(screen.getByLabelText("Online release"));

    expect(dispatch).toHaveBeenCalledWith({ type: "setupModeSelected", mode: "online" });
  });

  it("disables project scope and explains why when there is no project", () => {
    renderView();

    expect(screen.getByLabelText("Project settings")).toBeDisabled();
    expect(screen.getByText("(no Klive project is open)")).toBeInTheDocument();
  });

  it("dispatches the chosen scope when a project is open", () => {
    const dispatch = renderView({ scopeChoice: { projectEnabled: true, note: undefined } });

    fireEvent.click(screen.getByLabelText("Project settings"));

    expect(dispatch).toHaveBeenCalledWith({ type: "scopeSelected", scope: "project" });
    expect(screen.queryByText("(no Klive project is open)")).not.toBeInTheDocument();
  });

  it("disables every control while work is in flight", () => {
    renderView({
      source: { disabled: true },
      scopeChoice: { disabled: true }
    });

    expect(screen.getByLabelText("Online release")).toBeDisabled();
    expect(screen.getByLabelText("User settings")).toBeDisabled();
    expect(screen.getByText("Select executable...")).toBeDisabled();
  });
});

describe("online panel", () => {
  const ONLINE_VM: DeepPartial<SjasmplusViewModel> = {
    source: {
        mode: "online",
        online: {
          kind: "available",
          releases: [{ value: "v1.24.0", label: "v1.24.0 — 1 build for Windows" }],
          selectedTag: "v1.24.0",
          releaseSelectDisabled: false,
          assets: [{ value: "sjasmplus.win.zip", label: "sjasmplus.win.zip — Windows x64 build" }],
          selectedAssetName: "sjasmplus.win.zip",
          assetSelectDisabled: false,
          includePrereleases: false,
          prereleasesDisabled: false,
          refreshDisabled: false,
          downloadFolder: undefined,
          downloadEnabled: false,
          statusText: "Suggested v1.24.0",
          statusFailed: false
        }
      }
  };

  // --- Deep-merged, so an override names one field instead of restating the
  // --- whole panel.
  const online = (over?: DeepPartial<SjasmplusViewModel>) =>
    renderView(deepMerge(ONLINE_VM, over) as DeepPartial<SjasmplusViewModel>);

  it("renders the release and asset pickers from the view model", () => {
    online();

    expect(screen.getByTestId("sjasmplus-release-select")).toHaveValue("v1.24.0");
    expect(screen.getByTestId("sjasmplus-asset-select")).toHaveTextContent("sjasmplus.win.zip");
    expect(screen.getByTestId("sjasmplus-release-status")).toHaveTextContent("Suggested v1.24.0");
    expect(screen.getByTestId("sjasmplus-download-folder")).toHaveTextContent("Not selected");
  });

  it("dispatches the prerelease toggle and the download request", () => {
    const dispatch = online({
      source: { online: { downloadEnabled: true, downloadFolder: "/downloads" } }
    });

    fireEvent.click(screen.getByLabelText("Show prereleases"));
    expect(dispatch).toHaveBeenCalledWith({ type: "prereleasesToggled", value: true });

    fireEvent.click(screen.getByText("Download..."));
    expect(dispatch).toHaveBeenCalledWith({ type: "downloadRequested" });
  });

  it("keeps Download disabled until the view model enables it", () => {
    online();

    expect(screen.getByText("Download...")).toBeDisabled();
  });

  it("offers instructions and a repository link where no build is published", () => {
    renderView({
      source: {
        mode: "online",
        online: {
          kind: "unavailable",
          repositoryUrl: "https://github.com/z00m128/sjasmplus",
          repositoryLabel: "github.com/z00m128/sjasmplus"
        }
      }
    } as DeepPartial<SjasmplusViewModel>);

    expect(screen.getByText(/Windows binaries only/)).toBeInTheDocument();
    const link = screen.getByText("github.com/z00m128/sjasmplus");
    expect(link).toHaveAttribute("href", "https://github.com/z00m128/sjasmplus");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.queryByTestId("sjasmplus-release-select")).not.toBeInTheDocument();
  });
});

describe("apply block", () => {
  it("says nothing is selected yet", () => {
    renderView();

    expect(screen.getByTestId("sjasmplus-candidate-path")).toHaveTextContent(
      "Nothing selected yet"
    );
    expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Not tested");
    expect(screen.getByTestId("sjasmplus-message")).toHaveTextContent(
      "Pick a local executable or download a release below."
    );
  });

  it("shows the candidate path once, and only in the apply block", () => {
    renderView({
      apply: { candidatePath: "/Users/me/sjasmp/sjasmplus", validationLabel: "Passed" }
    });

    expect(screen.getAllByText("/Users/me/sjasmp/sjasmplus")).toHaveLength(1);
    expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed");
  });
});
