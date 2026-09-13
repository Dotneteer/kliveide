import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveUserSettingAction } from "@state/actions";
import { SjasmplusIntegrationDialog } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusIntegrationDialog";

import {
  act,
  createMockStore,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor
} from "../../react-test-utils";

/**
 * The container's own seams, and nothing else.
 *
 * Everything this dialog *decides* is covered without a DOM by
 * SjasmplusModel/ViewModel/Controller tests. What only a mounted tree can show
 * is the wiring: Redux state reaching the model, the main-process API reaching
 * the ports, and the Modal's dismissal routes reaching the controller.
 */

const mainApiMock = vi.hoisted(() => ({
  showOpenFolderDialog: vi.fn(),
  showOpenFileDialog: vi.fn(),
  probeSjasmplusPath: vi.fn(),
  getSjasmplusPathSuggestions: vi.fn(),
  listSjasmplusReleases: vi.fn(),
  downloadSjasmplusRelease: vi.fn(),
  validateSjasmplusExecutable: vi.fn(),
  applySjasmplusIntegration: vi.fn()
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

function configuredStore() {
  const store = createMockStore();
  store.dispatch(
    saveUserSettingAction({
      sjasmp: { executablePath: "/tools/sjasmplus/sjasmplus", version: "v1.24.0" }
    }),
    "ide"
  );
  return store;
}

// --- Selecting a working executable is the shortest route to an unapplied
// --- change, which is what the dismissal routes are guarded against.
async function selectAnExecutable() {
  fireEvent.click(screen.getByText("Select executable..."));
  await waitFor(() =>
    expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
  );
}

describe("SjasmplusIntegrationDialog wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainApiMock.getSjasmplusPathSuggestions.mockResolvedValue([]);
    mainApiMock.listSjasmplusReleases.mockResolvedValue({ releases: [] });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({ ok: true });
    mainApiMock.applySjasmplusIntegration.mockResolvedValue(undefined);
  });

  it("reads the configured install out of Redux and re-tests it through MainApi", async () => {
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: configuredStore()
    });

    await waitFor(() =>
      expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledWith(
        "/tools/sjasmplus/sjasmplus"
      )
    );
    expect(await screen.findByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-executable-path")).toHaveTextContent(
      "/tools/sjasmplus/sjasmplus"
    );
  });

  it("does not re-test on a settings write that leaves SJASMPLUS alone", async () => {
    const store = configuredStore();
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-integrated-badge");
    expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledTimes(1);

    // --- The store hands the container a fresh settings object; if that alone
    // --- counted as a change, the dialog would re-test itself forever.
    await act(async () => {
      store.dispatch(saveUserSettingAction({ unrelated: { value: 42 } }), "ide");
    });

    expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledTimes(1);
  });

  it("routes Escape through the discard confirmation instead of closing", async () => {
    mainApiMock.showOpenFileDialog.mockResolvedValue("/tools/sjasmplus/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus"
    });
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />);
    await selectAnExecutable();

    fireEvent.keyDown(document, { code: "Escape" });

    // --- The confirmation is the real ConfirmDialog, opened through the
    // --- DialogProvider the port depends on.
    await screen.findByText("Discard SJASMPLUS setup?");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Keep editing"));
    await waitFor(() =>
      expect(screen.queryByText("Discard SJASMPLUS setup?")).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Close"));
    fireEvent.click(await screen.findByText("Discard"));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
  });

  it("closes straight away when there is nothing to discard", async () => {
    const onClose = vi.fn();
    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />, {
      store: configuredStore()
    });
    await screen.findByTestId("sjasmplus-integrated-badge");

    fireEvent.click(screen.getByText("Close"));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
    expect(screen.queryByText("Discard SJASMPLUS setup?")).not.toBeInTheDocument();
  });

  it("wires the Modal footer buttons to the controller", async () => {
    mainApiMock.showOpenFileDialog.mockResolvedValue("/tools/sjasmplus/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus",
      version: "sjasmplus v1.23.0"
    });
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />);
    await selectAnExecutable();

    // --- Test again re-runs the smoke test...
    fireEvent.click(screen.getByText("Test again"));
    await waitFor(() =>
      expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledTimes(2)
    );

    // --- ...and Apply saves through MainApi, then closes the dialog
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(mainApiMock.applySjasmplusIntegration).toHaveBeenCalledWith({
        scope: "user",
        installFolder: "/tools/sjasmplus",
        executablePath: "/tools/sjasmplus/sjasmplus",
        version: "sjasmplus v1.23.0"
      })
    );
    expect(onClose).toHaveBeenCalledWith("close");
  });
});

describe("SjasmplusIntegrationDialog under StrictMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainApiMock.getSjasmplusPathSuggestions.mockResolvedValue([]);
    mainApiMock.listSjasmplusReleases.mockResolvedValue({ releases: [] });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({ ok: true });
  });

  it("finishes the opening smoke test in a development build", async () => {
    // --- StrictMode tears every effect down and re-runs it once. The dialog has
    // --- to survive that: the symptom of not surviving is a working
    // --- integration stuck forever on "Running smoke test...", with every
    // --- control disabled.
    renderWithProviders(
      <StrictMode>
        <SjasmplusIntegrationDialog onClose={vi.fn()} />
      </StrictMode>,
      { store: configuredStore() }
    );

    expect(await screen.findByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed");
    expect(screen.getByText("Select executable...")).toBeEnabled();
    expect(screen.getByText("Test again")).toBeEnabled();
  });
});
