import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveProjectSettingAction, saveUserSettingAction } from "@state/actions";
import {
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER,
  SJASMP_VERSION
} from "@main/sjasmp-integration/sjasmp-config";
import { SjasmplusIntegrationDialog } from "@renderer/appIde/dialogs/SjasmplusIntegrationDialog";
import {
  createMockStore,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor
} from "../react-test-utils";

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

describe("SjasmplusIntegrationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainApiMock.getSjasmplusPathSuggestions.mockResolvedValue([]);
    mainApiMock.listSjasmplusReleases.mockResolvedValue({
      releases: []
    });
    mainApiMock.downloadSjasmplusRelease.mockResolvedValue({
      ok: false,
      error: "Download not mocked."
    });
    // --- Opening the dialog re-tests whatever the settings point at, so every
    // --- configured-state test needs a verdict for that check.
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({ ok: true });
  });

  it("shows an empty configuration when no SJASMPLUS setting exists", () => {
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);

    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent(
      "No SJASMPLUS assembler is set up yet"
    );
    expect(screen.queryByTestId("sjasmplus-executable-path")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-candidate-path")).toHaveTextContent(
      "Nothing selected yet"
    );
    expect(screen.getByTestId("sjasmplus-message")).toHaveTextContent(
      "Pick a local executable or download a release below."
    );
  });

  it("shows the user-level install folder when only user settings define it", async () => {
    const store = createMockStore();
    store.dispatch(saveUserSettingAction({ sjasmp: { root: "/tools/sjasmplus" } }), "ide");

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Configured")
    );
    expect(screen.getByTestId("sjasmplus-scope")).toHaveTextContent("User settings");
    expect(screen.getByTestId("sjasmplus-executable-path")).toHaveTextContent(
      "/tools/sjasmplus/sjasmplus"
    );
  });

  it("marks a working integration with the success badge", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({ sjasmp: { root: "/tools/sjasmplus", version: "v1.24.0" } }),
      "ide"
    );

    const { unmount } = renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store
    });

    // --- The badge carries the meaning without relying on color alone
    expect(await screen.findByLabelText("SJASMPLUS is set up")).toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    unmount();

    // --- ...and is absent while nothing is configured
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);

    expect(screen.queryByTestId("sjasmplus-integrated-badge")).not.toBeInTheDocument();
  });

  it("prefers the explicit executable path when it exists", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: {
          root: "/tools/sjasmplus",
          executablePath: "/custom/bin/sjasmplus",
          version: "sjasmplus v1.23.0"
        }
      }),
      "ide"
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-executable-path")).toHaveTextContent(
        "/custom/bin/sjasmplus"
      )
    );
    expect(screen.getByTestId("sjasmplus-version")).toHaveTextContent("sjasmplus v1.23.0");
  });

  it("shows project settings as effective when both scopes define SJASMPLUS", async () => {
    const store = createMockStore();
    store.dispatch(saveUserSettingAction({ sjasmp: { root: "/user/sjasmplus" } }), "ide");
    store.dispatch(saveProjectSettingAction({ sjasmp: { root: "/project/sjasmplus" } }), "ide");

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-scope")).toHaveTextContent("Project settings")
    );
    expect(screen.getByTestId("sjasmplus-executable-path")).toHaveTextContent(
      "/project/sjasmplus/sjasmplus"
    );
  });

  it("resolves the Windows executable name from the current platform state", async () => {
    const store = createMockStore();
    store.dispatch(saveUserSettingAction({ sjasmp: { root: "C:/tools/sjasmplus" } }), "ide");
    store.resetTo({ ...store.getState(), isWindows: true });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-executable-path")).toHaveTextContent(
        "C:/tools/sjasmplus/sjasmplus.exe"
      )
    );
  });

  it("re-tests the configured executable when the dialog opens", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: { executablePath: "/tools/sjasmplus/sjasmplus", version: "v1.24.0" }
      }),
      "ide"
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    await waitFor(() =>
      expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledWith(
        "/tools/sjasmplus/sjasmplus"
      )
    );
    // --- The check is what earns the success highlight
    expect(await screen.findByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-status-error")).not.toBeInTheDocument();
  });

  it("does not report a configured executable as working when the test fails", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: { executablePath: "/moved/away/sjasmplus", version: "v1.24.0" }
      }),
      "ide"
    );
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: false,
      error: "Path does not exist: /moved/away/sjasmplus"
    });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });

    // --- A folder that was moved or deleted must not keep the success badge
    expect(await screen.findByTestId("sjasmplus-broken-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-integrated-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Not working");
    expect(screen.getByTestId("sjasmplus-status-error")).toHaveTextContent(
      "Path does not exist: /moved/away/sjasmplus"
    );
    // --- The stale version is not restated for a setup that cannot run
    expect(screen.queryByTestId("sjasmplus-version")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-message")).toHaveTextContent(
      "Pick a working executable below"
    );
    // --- ...and the settings cannot be re-applied on top of a failed test
    expect(screen.getByText("Apply")).toBeDisabled();
  });

  it("clears the failure when the restored executable passes a re-test", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({ sjasmp: { executablePath: "/moved/away/sjasmplus" } }),
      "ide"
    );
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: false,
      error: "Path does not exist: /moved/away/sjasmplus"
    });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-broken-badge");

    // --- The user can put the executable back and test it without reselecting it
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/moved/away",
      executablePath: "/moved/away/sjasmplus",
      version: "v1.24.0"
    });
    fireEvent.click(screen.getByText("Test again"));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
    expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenLastCalledWith(
      "/moved/away/sjasmplus"
    );
    // --- The configured executable works again, so the failure is gone for good
    expect(screen.getByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-broken-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Configured");
  });

  it("clears the failure when a re-test passes on a differently spelled path", async () => {
    // --- The `sjasm` command stores the path as typed, so settings can hold
    // --- backslashes while every probe result comes back with forward slashes
    const store = createMockStore();
    store.dispatch(saveUserSettingAction({ sjasmp: { root: "C:\\tools\\sjasmplus" } }), "ide");
    store.resetTo({ ...store.getState(), isWindows: true });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: false,
      error: "SJASMPLUS exited with code 1"
    });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-broken-badge");

    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "C:/Tools/SjasmPlus",
      executablePath: "C:/Tools/SjasmPlus/sjasmplus.exe",
      version: "v1.24.0"
    });
    fireEvent.click(screen.getByText("Test again"));

    // --- Same executable, so this is the configured setup working again, not a
    // --- replacement waiting to be applied
    expect(await screen.findByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Configured");
    expect(screen.queryByTestId("sjasmplus-status-note")).not.toBeInTheDocument();
  });

  it("drops the success badge while a tested executable is failing", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: { executablePath: "/tools/sjasmplus/sjasmplus", version: "v1.24.0" }
      }),
      "ide"
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-integrated-badge");

    // --- The user picks the wrong file; the working setup stays untouched, but a
    // --- success badge next to a failed test reads as a verdict on that test
    mainApiMock.showOpenFileDialog.mockResolvedValue("/downloads/readme.txt");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/downloads",
      executablePath: "/downloads/readme.txt"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: false,
      installFolder: "/downloads",
      executablePath: "/downloads/readme.txt",
      error: "SJASMPLUS exited with code 1"
    });
    fireEvent.click(screen.getByText("Select executable..."));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Failed")
    );
    expect(screen.queryByTestId("sjasmplus-integrated-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status-note")).toHaveTextContent(
      "Unchanged — the executable below failed its test."
    );
    // --- The saved setup is not the broken one, so it is not flagged either
    expect(screen.queryByTestId("sjasmplus-broken-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status")).toHaveTextContent("Configured");
    expect(screen.getByText("Apply")).toBeDisabled();
  });

  it("keeps the success badge when the configured executable is re-tested", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: { executablePath: "/tools/sjasmplus/sjasmplus", version: "v1.24.0" }
      }),
      "ide"
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-integrated-badge");

    fireEvent.click(screen.getByText("Test again"));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
    expect(screen.getByTestId("sjasmplus-integrated-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-status-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-version")).toHaveTextContent("v1.24.0");
  });

  it("stops flagging the old setup once a replacement passes its test", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({
        sjasmp: { executablePath: "/moved/away/sjasmplus", version: "v1.24.0" }
      }),
      "ide"
    );
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: false,
      error: "Path does not exist: /moved/away/sjasmplus"
    });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    await screen.findByTestId("sjasmplus-broken-badge");

    // --- The user picks a different, working executable
    mainApiMock.showOpenFileDialog.mockResolvedValue("/new/tools/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/new/tools",
      executablePath: "/new/tools/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/new/tools",
      executablePath: "/new/tools/sjasmplus",
      version: "v1.25.0"
    });
    fireEvent.click(screen.getByText("Select executable..."));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
    // --- The old setup is still the configured one, but the fix is a click away,
    // --- so the stale error stops being the headline
    expect(screen.queryByTestId("sjasmplus-broken-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sjasmplus-status-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("sjasmplus-status-note")).toHaveTextContent(
      "Press Apply to replace it with the executable below."
    );
    expect(screen.getByText("Apply")).toBeEnabled();
  });

  it("uses the exported SJASMPLUS setting key", () => {
    expect(SJASMP_INSTALL_FOLDER).toBe("sjasmp.root");
    expect(SJASMP_EXECUTABLE_PATH).toBe("sjasmp.executablePath");
    expect(SJASMP_VERSION).toBe("sjasmp.version");
  });

  it("selects, validates, and applies an executable candidate to user settings", async () => {
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
    mainApiMock.applySjasmplusIntegration.mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />);
    expect(screen.queryByText("Online Release")).not.toBeInTheDocument();
    expect(screen.queryByText("Select folder...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Select executable..."));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
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

  it("hides the PATH shortcut row when PATH holds nothing and shows the chosen path once", async () => {
    mainApiMock.showOpenFileDialog.mockResolvedValue("/Users/me/sjasmp/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/Users/me/sjasmp",
      executablePath: "/Users/me/sjasmp/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/Users/me/sjasmp",
      executablePath: "/Users/me/sjasmp/sjasmplus"
    });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);
    expect(screen.queryByText("On PATH")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Select executable..."));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-candidate-path")).toHaveTextContent(
        "/Users/me/sjasmp/sjasmplus"
      )
    );
    expect(screen.queryByText("On PATH")).not.toBeInTheDocument();
    // --- The path is shown once, in the "To apply" block, not next to the button
    expect(screen.getAllByText("/Users/me/sjasmp/sjasmplus")).toHaveLength(1);
  });

  it("can save a validated candidate to project settings when a Klive project is loaded", async () => {
    const store = createMockStore();
    store.resetTo({
      ...store.getState(),
      project: { isKliveProject: true }
    });
    mainApiMock.showOpenFileDialog.mockResolvedValue("/project/tools/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/project/tools",
      executablePath: "/project/tools/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/project/tools",
      executablePath: "/project/tools/sjasmplus"
    });
    mainApiMock.applySjasmplusIntegration.mockResolvedValue(undefined);

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, { store });
    fireEvent.click(screen.getByLabelText("Project settings"));
    fireEvent.click(screen.getByText("Select executable..."));
    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() =>
      expect(mainApiMock.applySjasmplusIntegration).toHaveBeenCalledWith({
        scope: "project",
        installFolder: "/project/tools",
        executablePath: "/project/tools/sjasmplus",
        version: undefined
      })
    );
  });

  it("closes without asking when nothing was set", async () => {
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
    expect(screen.queryByText("Discard")).not.toBeInTheDocument();
  });

  it("asks for confirmation when Close would drop an unapplied selection", async () => {
    mainApiMock.showOpenFileDialog.mockResolvedValue("/tools/sjasmplus/sjasmplus");
    mainApiMock.probeSjasmplusPath.mockResolvedValue({
      ok: true,
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus"
    });
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />);
    fireEvent.click(screen.getByText("Select executable..."));
    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );

    fireEvent.click(screen.getByText("Close"));

    // --- Keeping the edit leaves the dialog open
    await screen.findByText("Discard SJASMPLUS setup?");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep editing"));
    await waitFor(() =>
      expect(screen.queryByText("Discard SJASMPLUS setup?")).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();

    // --- Escape is guarded too, not just the Close button
    fireEvent.keyDown(document, { code: "Escape" });
    await screen.findByText("Discard SJASMPLUS setup?");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Keep editing"));
    await waitFor(() =>
      expect(screen.queryByText("Discard SJASMPLUS setup?")).not.toBeInTheDocument()
    );

    // --- Discarding closes the dialog
    fireEvent.click(screen.getByText("Close"));
    await screen.findByText("Discard SJASMPLUS setup?");
    fireEvent.click(screen.getByText("Discard"));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
  });

  it("does not ask when the configured setup is left untouched", async () => {
    const store = createMockStore();
    store.dispatch(
      saveUserSettingAction({ sjasmp: { executablePath: "/tools/sjasmplus/sjasmplus" } }),
      "ide"
    );
    const onClose = vi.fn();

    renderWithProviders(<SjasmplusIntegrationDialog onClose={onClose} />, { store });
    fireEvent.click(screen.getByText("Close"));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
  });

  it("keeps project scope disabled without a Klive project", () => {
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);

    expect(screen.getByLabelText("Project settings")).toBeDisabled();
  });

  it("shows PATH suggestions and validates the selected suggestion before applying it", async () => {
    mainApiMock.getSjasmplusPathSuggestions.mockResolvedValue([
      {
        ok: true,
        installFolder: "/usr/local/bin",
        executablePath: "/usr/local/bin/sjasmplus"
      }
    ]);
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/usr/local/bin",
      executablePath: "/usr/local/bin/sjasmplus",
      version: "sjasmplus v1.24.0"
    });
    mainApiMock.applySjasmplusIntegration.mockResolvedValue(undefined);

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);

    await screen.findByText("/usr/local/bin/sjasmplus");
    expect(screen.getByText("On PATH")).toBeInTheDocument();
    fireEvent.click(screen.getByText("/usr/local/bin/sjasmplus"));

    await waitFor(() =>
      expect(mainApiMock.validateSjasmplusExecutable).toHaveBeenCalledWith(
        "/usr/local/bin/sjasmplus"
      )
    );
    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() =>
      expect(mainApiMock.applySjasmplusIntegration).toHaveBeenCalledWith({
        scope: "user",
        installFolder: "/usr/local/bin",
        executablePath: "/usr/local/bin/sjasmplus",
        version: "sjasmplus v1.24.0"
      })
    );
  });

  it("shows the suggested stable release and compatible asset", async () => {
    mainApiMock.listSjasmplusReleases.mockResolvedValue(
      createReleaseListResult("v1.2.0", "sjasmplus-1.24.0.win.zip")
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: createWindowsStore()
    });
    fireEvent.click(screen.getByLabelText("Online release"));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-release-status")).toHaveTextContent(
        "Suggested v1.2.0"
      )
    );
    expect(screen.getByTestId("sjasmplus-release-select")).toHaveValue("v1.2.0");
    expect(screen.getByTestId("sjasmplus-asset-select")).toHaveTextContent(
      "sjasmplus-1.24.0.win.zip"
    );
    expect(screen.getByTestId("sjasmplus-download-folder")).toHaveTextContent("Not selected");
  });

  it("offers instructions and a repository link instead of downloads off Windows", async () => {
    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Online release"));

    expect(
      await screen.findByText(/Windows binaries only/)
    ).toBeInTheDocument();
    const link = screen.getByText("github.com/z00m128/sjasmplus");
    expect(link).toHaveAttribute("href", "https://github.com/z00m128/sjasmplus");
    expect(link).toHaveAttribute("target", "_blank");

    // --- Nothing is downloadable here, so GitHub is never queried
    expect(mainApiMock.listSjasmplusReleases).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sjasmplus-release-select")).not.toBeInTheDocument();
    expect(screen.queryByText("Download...")).not.toBeInTheDocument();
  });

  it("lists only usable Windows assets, with no show-all escape hatch", async () => {
    const releaseList = createReleaseListResult("v1.24.0", "sjasmplus-1.24.0.win.zip");
    // --- A source archive the service marked unusable must never be offered
    releaseList.releases[0].assets.unshift({
      name: "sjasmplus-1.24.0-src.tar.xz",
      downloadUrl: "https://example.invalid/src.tar.xz",
      size: 1024,
      kind: "source",
      platform: "unknown",
      arch: "unknown",
      compatible: false
    } as any);
    mainApiMock.listSjasmplusReleases.mockResolvedValue(releaseList);

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: createWindowsStore()
    });
    fireEvent.click(screen.getByLabelText("Online release"));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-asset-select")).toHaveTextContent(
        "sjasmplus-1.24.0.win.zip"
      )
    );
    expect(screen.getByTestId("sjasmplus-asset-select").querySelectorAll("option")).toHaveLength(1);
    expect(screen.queryByLabelText("Show all assets")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Show prereleases")).toBeInTheDocument();
  });

  it("reloads releases when prereleases are enabled", async () => {
    mainApiMock.listSjasmplusReleases.mockResolvedValueOnce({ releases: [] });
    mainApiMock.listSjasmplusReleases.mockResolvedValueOnce({ releases: [] });

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: createWindowsStore()
    });
    expect(mainApiMock.listSjasmplusReleases).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Online release"));

    await waitFor(() =>
      expect(mainApiMock.listSjasmplusReleases).toHaveBeenCalledWith({
        includePrereleases: false
      })
    );
    fireEvent.click(screen.getByLabelText("Show prereleases"));

    await waitFor(() =>
      expect(mainApiMock.listSjasmplusReleases).toHaveBeenCalledWith({
        includePrereleases: true
      })
    );
  });

  it("limits the release selector to the newest 20 releases", async () => {
    mainApiMock.listSjasmplusReleases.mockResolvedValue(
      createReleaseListResult(
        "v25.0.0",
        "sjasmplus-1.24.0.win.zip",
        Array.from({ length: 25 }, (_, index) => createRelease(`v${25 - index}.0.0`))
      )
    );

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: createWindowsStore()
    });
    fireEvent.click(screen.getByLabelText("Online release"));

    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-release-select").querySelectorAll("option")).toHaveLength(
        20
      )
    );
    expect(screen.getByTestId("sjasmplus-release-select")).toHaveTextContent("v25.0.0");
    expect(screen.getByTestId("sjasmplus-release-select")).not.toHaveTextContent("v5.0.0");
  });

  it("downloads the selected release and validates it before applying settings", async () => {
    const releaseList = createReleaseListResult("v1.2.0", "sjasmplus-1.24.0.win.zip");
    mainApiMock.listSjasmplusReleases.mockResolvedValue(releaseList);
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/downloads");
    mainApiMock.downloadSjasmplusRelease.mockResolvedValue({
      ok: true,
      installFolder: "/downloads/sjasmplus/v1.2.0",
      executablePath: "/downloads/sjasmplus/v1.2.0/bin/sjasmplus"
    });
    mainApiMock.validateSjasmplusExecutable.mockResolvedValue({
      ok: true,
      installFolder: "/downloads/sjasmplus/v1.2.0/bin",
      executablePath: "/downloads/sjasmplus/v1.2.0/bin/sjasmplus",
      version: "sjasmplus v1.2.0"
    });
    mainApiMock.applySjasmplusIntegration.mockResolvedValue(undefined);

    renderWithProviders(<SjasmplusIntegrationDialog onClose={vi.fn()} />, {
      store: createWindowsStore()
    });
    fireEvent.click(screen.getByLabelText("Online release"));

    await waitFor(() => expect(screen.getByText("Select folder...")).toBeEnabled());
    expect(screen.getByText("Download...")).toBeDisabled();
    fireEvent.click(screen.getByText("Select folder..."));
    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-download-folder")).toHaveTextContent("/downloads")
    );
    expect(screen.getByText("Download...")).toBeEnabled();
    fireEvent.click(screen.getByText("Download..."));

    await waitFor(() =>
      expect(mainApiMock.downloadSjasmplusRelease).toHaveBeenCalledWith({
        releaseTag: "v1.2.0",
        asset: releaseList.suggestedAsset,
        destinationFolder: "/downloads"
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("sjasmplus-validation")).toHaveTextContent("Passed")
    );
    fireEvent.click(screen.getByText("Apply"));

    await waitFor(() =>
      expect(mainApiMock.applySjasmplusIntegration).toHaveBeenCalledWith({
        scope: "user",
        installFolder: "/downloads/sjasmplus/v1.2.0/bin",
        executablePath: "/downloads/sjasmplus/v1.2.0/bin/sjasmplus",
        version: "sjasmplus v1.2.0"
      })
    );
  });
});

function createReleaseListResult(tagName: string, assetName: string, releases?: any[]) {
  const asset = createAsset(tagName, assetName);
  const release = createRelease(tagName, asset);
  return {
    releases: releases ?? [release],
    suggestedRelease: release,
    suggestedAsset: asset,
    targetPlatform: "windows"
  };
}

function createAsset(tagName: string, assetName: string) {
  return {
    name: assetName,
    downloadUrl: `https://github.com/z00m128/sjasmplus/releases/download/${tagName}/${assetName}`,
    size: 2048,
    kind: "binary",
    platform: "windows",
    arch: "x64",
    compatible: true
  };
}

// --- The download flow only exists on Windows, where upstream publishes builds.
function createWindowsStore() {
  const store = createMockStore();
  store.resetTo({ ...store.getState(), isWindows: true });
  return store;
}

function createRelease(tagName: string, asset?: any) {
  const releaseAsset = asset ?? createAsset(tagName, "sjasmplus-1.24.0.win.zip");
  return {
    tagName,
    name: tagName,
    prerelease: false,
    publishedAt: "2026-01-01T00:00:00Z",
    htmlUrl: `https://github.com/z00m128/sjasmplus/releases/tag/${tagName}`,
    assets: [releaseAsset],
    compatibleAssets: [releaseAsset]
  };
}
