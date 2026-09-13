import { describe, expect, it, vi } from "vitest";

import { useConfirmPort, useFilePickerPort } from "@mvc/dialogs/useDialogPorts";
import type { ConfirmRequest } from "@mvc/dialogs/DialogPorts";

import { fireEvent, renderWithProviders, screen, waitFor } from "../react-test-utils";

const mainApiMock = vi.hoisted(() => ({
  showOpenFileDialog: vi.fn(),
  showOpenFolderDialog: vi.fn()
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

const aConfirmRequest = (over?: Partial<ConfirmRequest>): ConfirmRequest => ({
  title: "Discard SJASMPLUS setup?",
  lines: ["This setup has not been applied yet:"],
  code: "/tools/sjasmplus/sjasmplus",
  linesAfterCode: ["Closing now leaves SJASMPLUS unchanged."],
  confirmLabel: "Discard",
  cancelLabel: "Keep editing",
  danger: true,
  ...over
});

// --- A probe that exercises a port from inside the provider tree and records
// --- whatever it resolved to.
function renderConfirmProbe(request = aConfirmRequest()) {
  const answers: (boolean | undefined)[] = [];
  const Probe = () => {
    const confirm = useConfirmPort();
    return (
      <button onClick={async () => answers.push(await confirm.confirm(request))}>ask</button>
    );
  };
  renderWithProviders(<Probe />);
  fireEvent.click(screen.getByText("ask"));
  return answers;
}

describe("useConfirmPort", () => {
  it("renders the request through DialogProvider and resolves true on confirm", async () => {
    const answers = renderConfirmProbe();

    expect(await screen.findByText("This setup has not been applied yet:")).toBeInTheDocument();
    expect(screen.getByText("/tools/sjasmplus/sjasmplus")).toBeInTheDocument();
    expect(screen.getByText("Closing now leaves SJASMPLUS unchanged.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Discard"));

    await waitFor(() => expect(answers).toEqual([true]));
  });

  it("resolves false when the user declines", async () => {
    const answers = renderConfirmProbe();
    fireEvent.click(await screen.findByText("Keep editing"));

    await waitFor(() => expect(answers).toEqual([false]));
  });

  it("resolves false when the dialog is dismissed without an answer", async () => {
    const answers = renderConfirmProbe();
    await screen.findByText("Discard");

    fireEvent.keyDown(document, { code: "Escape" });

    // --- A question nobody answered is not permission to proceed
    await waitFor(() => expect(answers).toEqual([false]));
  });

  it("omits the code block when the request carries no value to show", async () => {
    renderConfirmProbe(aConfirmRequest({ code: undefined, linesAfterCode: undefined }));

    await screen.findByText("Discard");
    expect(screen.queryByText("/tools/sjasmplus/sjasmplus")).not.toBeInTheDocument();
  });
});

describe("useFilePickerPort", () => {
  function renderPickerProbe() {
    const picked: (string | undefined)[] = [];
    const Probe = () => {
      const files = useFilePickerPort();
      return (
        <>
          <button
            onClick={async () =>
              picked.push(
                await files.pickFile([{ name: "Executable", extensions: ["exe"] }], "someKey")
              )
            }
          >
            file
          </button>
          <button onClick={async () => picked.push(await files.pickFolder("folderKey"))}>
            folder
          </button>
        </>
      );
    };
    renderWithProviders(<Probe />);
    return picked;
  }

  it("passes filters and the settings key through to the main process", async () => {
    mainApiMock.showOpenFileDialog.mockResolvedValue("/tools/sjasmplus/sjasmplus");
    const picked = renderPickerProbe();

    fireEvent.click(screen.getByText("file"));

    await waitFor(() => expect(picked).toEqual(["/tools/sjasmplus/sjasmplus"]));
    expect(mainApiMock.showOpenFileDialog).toHaveBeenCalledWith(
      [{ name: "Executable", extensions: ["exe"] }],
      "someKey"
    );
  });

  it("reports a dismissed picker as nothing chosen", async () => {
    // --- The main process answers a cancelled dialog with an empty string
    mainApiMock.showOpenFileDialog.mockResolvedValue("");
    mainApiMock.showOpenFolderDialog.mockResolvedValue(undefined);
    const picked = renderPickerProbe();

    fireEvent.click(screen.getByText("file"));
    fireEvent.click(screen.getByText("folder"));

    await waitFor(() => expect(picked).toEqual([undefined, undefined]));
  });

  it("passes the settings key through when picking a folder", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/downloads");
    const picked = renderPickerProbe();

    fireEvent.click(screen.getByText("folder"));

    await waitFor(() => expect(picked).toEqual(["/downloads"]));
    expect(mainApiMock.showOpenFolderDialog).toHaveBeenCalledWith("folderKey");
  });
});
