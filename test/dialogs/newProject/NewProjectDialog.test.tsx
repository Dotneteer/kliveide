import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewProjectDialog } from "@renderer/appIde/dialogs/newProject/NewProjectDialog";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/**
 * Container-level tests assert wiring and nothing else: that the renderer
 * services reach the ports, that the validation service reaches the model, and
 * that the modal frame is what the old component put on screen. Every rule
 * about what the dialog *decides* — the creation sequence, its failure paths,
 * its timeouts — is covered headlessly in the controller suite.
 */

const validationMock = vi.hoisted(() => ({
  isValidPath: vi.fn(),
  isValidFilename: vi.fn()
}));

const mainApiMock = vi.hoisted(() => ({
  getTemplateDirectories: vi.fn(),
  createKliveProject: vi.fn(),
  openFolder: vi.fn(),
  showOpenFolderDialog: vi.fn(),
  displayMessageBox: vi.fn()
}));

const ideCommandsMock = vi.hoisted(() => ({ executeCommand: vi.fn() }));

const eventsMock = vi.hoisted(() => ({
  ensureProjectLoaded: vi.fn(),
  ensureWorkspaceLoaded: vi.fn(),
  ensureBuildRootsLoaded: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    validationService: {
      isValidPath: validationMock.isValidPath,
      isValidFilename: validationMock.isValidFilename
    },
    projectService: {},
    ideCommandsService: { executeCommand: ideCommandsMock.executeCommand }
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

// --- The three IDE bootstrap helpers are the container's own dependency, so
// --- this mock sits exactly at the container boundary the guide allows.
vi.mock("@renderer/appIde/IdeEventsHandler", () => ({
  ensureProjectLoaded: eventsMock.ensureProjectLoaded,
  ensureWorkspaceLoaded: eventsMock.ensureWorkspaceLoaded,
  ensureBuildRootsLoaded: eventsMock.ensureBuildRootsLoaded
}));

beforeEach(() => {
  validationMock.isValidPath.mockReturnValue(true);
  validationMock.isValidFilename.mockReturnValue(true);
  mainApiMock.getTemplateDirectories.mockResolvedValue(["default", "advanced"]);
  mainApiMock.createKliveProject.mockResolvedValue("/projects/MyProject");
  mainApiMock.openFolder.mockResolvedValue(undefined);
  mainApiMock.showOpenFolderDialog.mockResolvedValue("");
  mainApiMock.displayMessageBox.mockResolvedValue(undefined);
  ideCommandsMock.executeCommand.mockResolvedValue(undefined);
  eventsMock.ensureProjectLoaded.mockResolvedValue(true);
  eventsMock.ensureWorkspaceLoaded.mockResolvedValue(undefined);
  eventsMock.ensureBuildRootsLoaded.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

function nameAndSubmit(name = "MyProject"): void {
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

describe("NewProjectDialog — wiring", () => {
  it("puts the dialog title on screen", () => {
    renderWithProviders(<NewProjectDialog onClose={vi.fn()} />);

    expect(screen.getByText("Create a new Klive project")).toBeInTheDocument();
  });

  it("loads the templates of the machine it opens on", async () => {
    renderWithProviders(<NewProjectDialog onClose={vi.fn()} />);

    await waitFor(() =>
      expect(mainApiMock.getTemplateDirectories).toHaveBeenCalledWith("sp48")
    );
  });

  it("routes the whole creation sequence through the renderer services", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<NewProjectDialog onCreate={onCreate} onClose={onClose} />);
    await waitFor(() => expect(mainApiMock.getTemplateDirectories).toHaveBeenCalled());

    nameAndSubmit();

    await waitFor(() =>
      expect(mainApiMock.createKliveProject).toHaveBeenCalledWith(
        "sp48",
        "MyProject",
        "",
        "pal",
        "default"
      )
    );
    expect(mainApiMock.openFolder).toHaveBeenCalledWith("/projects/MyProject");
    expect(eventsMock.ensureProjectLoaded).toHaveBeenCalled();
    expect(eventsMock.ensureWorkspaceLoaded).toHaveBeenCalled();
    expect(eventsMock.ensureBuildRootsLoaded).toHaveBeenCalled();
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ projectName: "MyProject", machineId: "sp48" })
      )
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("routes the validation service into the field rules", async () => {
    validationMock.isValidFilename.mockReturnValue(false);
    renderWithProviders(<NewProjectDialog onClose={vi.fn()} />);

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "bad/name" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    );
  });

  it("routes the folder picker through MainApi", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/picked");
    renderWithProviders(<NewProjectDialog onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select the root project folder" }));

    await waitFor(() => expect(screen.getAllByRole("textbox")[0]).toHaveValue("/picked"));
    expect(mainApiMock.showOpenFolderDialog).toHaveBeenCalledWith("newProjectFolder");
  });

  it("reports a failed creation through the message box and stays open", async () => {
    mainApiMock.createKliveProject.mockRejectedValue(new Error("disk full"));
    const onClose = vi.fn();
    renderWithProviders(<NewProjectDialog onClose={onClose} />);

    nameAndSubmit();

    await waitFor(() =>
      expect(mainApiMock.displayMessageBox).toHaveBeenCalledWith(
        "error",
        "New Klive Project Error",
        "disk full"
      )
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels through the caller's onClose", () => {
    const onClose = vi.fn();
    renderWithProviders(<NewProjectDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("NewProjectDialog under StrictMode", () => {
  it("still works after the effect teardown/setup cycle", async () => {
    const onCreate = vi.fn();
    renderWithProviders(
      <StrictMode>
        <NewProjectDialog onCreate={onCreate} onClose={vi.fn()} />
      </StrictMode>
    );

    nameAndSubmit();

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });
});
