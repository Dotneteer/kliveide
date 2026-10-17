import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BorielSetupDialog } from "@renderer/appIde/dialogs/boriel/BorielSetupDialog";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/**
 * The container's seams only: MainApi reaching the ports, the Modal's buttons reaching the
 * controller, and StrictMode's setup → cleanup → setup leaving a live dialog (MVC trap 1).
 * The decisions are covered without a DOM in BorielSetupController.test.ts.
 */

const mainApiMock = vi.hoisted(() => ({
  showOpenFolderDialog: vi.fn(),
  showOpenFileDialog: vi.fn(),
  getBorielSetupStatus: vi.fn(),
  installBoriel: vi.fn(),
  useExistingBoriel: vi.fn(),
  recordBorielSetupDecision: vi.fn(),
  setBasicCompiler: vi.fn()
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

const STATUS = {
  kit: { kind: "available", version: "2.0.0-beta25", file: "kit.tar.gz", platformKey: "darwin-arm64" },
  installation: { kind: "notConfigured" },
  defaultFolder: "/home/me/zxbasic2",
  declined: false,
  compiler: "klive",
  compilerFromProject: false
};

describe("BorielSetupDialog wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainApiMock.getBorielSetupStatus.mockResolvedValue(STATUS);
    mainApiMock.installBoriel.mockResolvedValue({
      kind: "installed",
      folder: "/home/me/zxbasic2",
      executablePath: "/home/me/zxbasic2/zxbc",
      version: "2.0.0-beta25"
    });
    mainApiMock.recordBorielSetupDecision.mockResolvedValue(undefined);
  });

  it("installs through MainApi from the primary button, under StrictMode", async () => {
    renderWithProviders(
      <StrictMode>
        <BorielSetupDialog onClose={vi.fn()} />
      </StrictMode>
    );
    expect(await screen.findByText("Not installed")).toBeInTheDocument();
    expect(screen.getByLabelText("Installation folder")).toHaveValue("/home/me/zxbasic2");
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => expect(mainApiMock.installBoriel).toHaveBeenCalledWith("/home/me/zxbasic2"));
    expect(await screen.findByTestId("boriel-message")).toHaveTextContent(
      "Boriel BASIC 2.0.0-beta25 is installed in /home/me/zxbasic2."
    );
  });

  it("records 'Not now' and closes, in the offer", async () => {
    const onClose = vi.fn();
    renderWithProviders(<BorielSetupDialog mode="offer" onClose={onClose} />);
    expect(await screen.findByTestId("boriel-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("close"));
    expect(mainApiMock.recordBorielSetupDecision).toHaveBeenCalledWith("postponed");
  });
});
