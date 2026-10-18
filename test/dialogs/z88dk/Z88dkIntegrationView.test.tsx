import { describe, expect, it, vi } from "vitest";

import { Z88dkIntegrationView } from "@renderer/appIde/dialogs/z88dk/Z88dkIntegrationView";
import type { Z88dkIntent } from "@renderer/appIde/dialogs/z88dk/Z88dkIntents";
import type { Z88dkViewModel } from "@renderer/appIde/dialogs/z88dk/Z88dkViewModel";

import { fireEvent, renderWithProviders, screen } from "../../react-test-utils";

// --- The Radix-backed Dropdown opens on pointer events jsdom does not produce; a native stand-in
// --- keeps these tests about the view (the same mock as the SJASMPLUS view test)
vi.mock("@renderer/controls/Dropdown", () => ({
  default: ({
    options,
    ariaLabel,
    testId,
    initialValue,
    enabled = true,
    onChanged
  }: {
    options: { value: string; label: string }[];
    ariaLabel?: string;
    testId?: string;
    initialValue?: string;
    enabled?: boolean;
    onChanged?: (value: string) => void;
  }) => (
    <select
      aria-label={ariaLabel}
      data-testid={testId}
      value={initialValue}
      disabled={!enabled}
      onChange={(event) => onChanged?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));

import { aReleaseList, aState, aViewModel, okProbe, type DeepPartial } from "./fakes";
import { reduce } from "@renderer/appIde/dialogs/z88dk/Z88dkModel";

/** The view is a function of its view model: markup in, intents out. */
function renderView(over?: DeepPartial<Z88dkViewModel>, state = aState()): (intent: Z88dkIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<Z88dkIntegrationView vm={aViewModel(over, state)} dispatch={dispatch} />);
  return dispatch;
}

describe("local source", () => {
  it("dispatches chooseFolderRequested", () => {
    const dispatch = renderView();
    fireEvent.click(screen.getByText("Choose folder..."));
    expect(dispatch).toHaveBeenCalledWith({ type: "chooseFolderRequested" });
  });

  it("lists detected installs and dispatches the clicked one by its folder", () => {
    const dispatch = renderView(undefined, aState({ pathSuggestions: [okProbe("/opt/z88dk")] }));
    fireEvent.click(screen.getByTestId("z88dk-suggestion"));
    expect(dispatch).toHaveBeenCalledWith({ type: "suggestionPicked", root: "/opt/z88dk" });
  });
});

describe("online source", () => {
  const onlineState = () =>
    reduce(aState({ setupMode: "online", downloadFolder: "/dl" }), { type: "releaseListSettled", result: aReleaseList() });

  it("shows the Linux instructions instead of a download", () => {
    renderView(undefined, aState({ setupMode: "online" }, { platform: "linux", isKliveProject: false, configured: { source: "none" } }));
    expect(screen.getByTestId("z88dk-no-download")).toHaveTextContent("no ready-made build for Linux");
    expect(screen.getByText("installation guide")).toHaveAttribute("href", "https://github.com/z88dk/z88dk/wiki/installation");
  });

  it("dispatches the download and the older-releases toggle", () => {
    const dispatch = renderView(undefined, onlineState());
    fireEvent.click(screen.getByText("Download and install"));
    expect(dispatch).toHaveBeenCalledWith({ type: "downloadRequested" });
    fireEvent.click(screen.getByLabelText("Show older releases"));
    expect(dispatch).toHaveBeenCalledWith({ type: "showOlderToggled", value: true });
  });

  it("renders the progress bar with its label and dispatches Cancel", () => {
    let state = reduce(onlineState(), { type: "downloadStarted" });
    state = reduce(state, { type: "downloadProgressed", progress: { phase: "downloading", receivedBytes: 35967013, totalBytes: 71934026 } });
    const dispatch = renderView(undefined, state);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByTestId("z88dk-progress-label")).toHaveTextContent("34.3 MB of 68.6 MB");
    fireEvent.click(screen.getByText("Cancel"));
    expect(dispatch).toHaveBeenCalledWith({ type: "cancelDownloadRequested" });
  });
});

describe("apply block", () => {
  it("shows the candidate and its verdict", () => {
    renderView({ apply: { candidatePath: "/dl/v2.4", validationLabel: "Passed", message: "ok" } });
    expect(screen.getByTestId("z88dk-candidate-path")).toHaveTextContent("/dl/v2.4");
    expect(screen.getByTestId("z88dk-validation")).toHaveTextContent("Passed");
  });
});
