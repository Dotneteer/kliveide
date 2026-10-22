import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveUserSettingAction } from "@state/actions";
import { Z88dkIntegrationDialog } from "@renderer/appIde/dialogs/z88dk/Z88dkIntegrationDialog";

import { act, createMockStore, fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/**
 * The container's own seams: Redux state reaching the model, MainApi reaching the ports, and the
 * Modal's dismissal routes reaching the controller. Every decision is covered headless.
 */

const V24 = "v23854-4d530b6eb7-20251002";

const mainApiMock = vi.hoisted(() => ({
  showOpenFolderDialog: vi.fn(),
  showOpenFileDialog: vi.fn(),
  probeZ88dkPath: vi.fn(),
  getZ88dkPathSuggestions: vi.fn(),
  listZ88dkReleases: vi.fn(),
  downloadZ88dkRelease: vi.fn(),
  getZ88dkDownloadProgress: vi.fn(),
  cancelZ88dkDownload: vi.fn(),
  getZ88dkDefaultDownloadFolder: vi.fn(),
  validateZ88dkInstall: vi.fn(),
  applyZ88dkIntegration: vi.fn()
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

function configuredStore() {
  const store = createMockStore();
  store.dispatch(saveUserSettingAction({ z88dk: { root: "/tools/z88dk", version: V24 } }), "ide");
  return store;
}

function resetMocks() {
  vi.clearAllMocks();
  mainApiMock.getZ88dkPathSuggestions.mockResolvedValue([]);
  mainApiMock.listZ88dkReleases.mockResolvedValue({ releases: [], targetPlatform: "macos" });
  mainApiMock.getZ88dkDefaultDownloadFolder.mockResolvedValue("/home/u/KliveTools/z88dk");
  mainApiMock.validateZ88dkInstall.mockImplementation(async (root: string) => ({ ok: true, root, version: V24, build: 23854, supported: true }));
  mainApiMock.probeZ88dkPath.mockImplementation(async (root: string) => ({ ok: true, root }));
  mainApiMock.applyZ88dkIntegration.mockResolvedValue(undefined);
}

describe("Z88dkIntegrationDialog wiring", () => {
  beforeEach(resetMocks);

  it("reads the configured install out of Redux and re-tests it through MainApi", async () => {
    renderWithProviders(<Z88dkIntegrationDialog onClose={vi.fn()} />, { store: configuredStore() });
    await waitFor(() => expect(mainApiMock.validateZ88dkInstall).toHaveBeenCalledWith("/tools/z88dk"));
    expect(await screen.findByTestId("z88dk-integrated-badge")).toBeInTheDocument();
    expect(screen.getByTestId("z88dk-root")).toHaveTextContent("/tools/z88dk");
    expect(screen.getByTestId("z88dk-version")).toHaveTextContent(V24);
  });

  it("does not re-test on a settings write that leaves z88dk alone", async () => {
    const store = configuredStore();
    renderWithProviders(<Z88dkIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("z88dk-integrated-badge");
    await act(async () => {
      store.dispatch(saveUserSettingAction({ z88dk: { root: "/tools/z88dk", version: V24 }, unrelated: 1 }), "ide");
    });
    expect(mainApiMock.validateZ88dkInstall).toHaveBeenCalledTimes(1);
  });

  it("chooses a folder, applies it through MainApi and closes", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/Users/me/z88dk");
    const onClose = vi.fn();
    renderWithProviders(<Z88dkIntegrationDialog onClose={onClose} />);
    fireEvent.click(screen.getByText("Choose folder..."));
    await waitFor(() => expect(screen.getByTestId("z88dk-validation")).toHaveTextContent("Passed"));
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(mainApiMock.applyZ88dkIntegration).toHaveBeenCalledWith({ scope: "user", root: "/Users/me/z88dk", version: V24 })
    );
    expect(onClose).toHaveBeenCalledWith("close");
  });

  it("routes Escape through the discard confirmation", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/Users/me/z88dk");
    const onClose = vi.fn();
    renderWithProviders(<Z88dkIntegrationDialog onClose={onClose} />);
    fireEvent.click(screen.getByText("Choose folder..."));
    await waitFor(() => expect(screen.getByTestId("z88dk-validation")).toHaveTextContent("Passed"));
    fireEvent.keyDown(document, { code: "Escape" });
    await screen.findByText("Discard the selection?");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Discard"));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
  });
});

describe("Z88dkIntegrationDialog under StrictMode", () => {
  beforeEach(resetMocks);

  it("finishes the opening smoke test in a development build", async () => {
    renderWithProviders(
      <StrictMode>
        <Z88dkIntegrationDialog onClose={vi.fn()} />
      </StrictMode>,
      { store: configuredStore() }
    );
    expect(await screen.findByTestId("z88dk-integrated-badge")).toBeInTheDocument();
    expect(screen.getByText("Choose folder...")).toBeEnabled();
    expect(screen.getByText("Test again")).toBeEnabled();
  });
});
