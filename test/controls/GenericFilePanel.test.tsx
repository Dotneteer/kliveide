import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useEffect, useState } from "react";

/**
 * Slice 7.3 collapsed `GenericFileViewerPanel` and `GenericFileEditorPanel` into one component and,
 * in doing so, fixed a bug neither had a test for: renderers were passed to `createElement`, so a
 * renderer defined inline at the call site was a *new component type* on every parent render and
 * React remounted the whole file view each time.
 */

const setDocumentViewState = vi.fn();
const saveFileContent = vi.fn().mockResolvedValue(undefined);
const getDocumentForProjectNode = vi.fn();

vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState })
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ projectService: { saveFileContent, getDocumentForProjectNode } })
}));

vi.mock("@renderer/controls/layout/Panel", () => ({
  Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));

const { GenericFilePanel } = await import(
  "@renderer/appIde/DocumentPanels/helpers/GenericFilePanel"
);

let mounts = 0;

/** A body with its own state, so a remount is observable. */
const Body = ({ label }: { label: string }) => {
  useEffect(() => {
    mounts++;
  }, []);
  return <div data-testid="body">{label}</div>;
};

const doc = { id: "doc-1" } as any;
const bytes = new Uint8Array([1, 2, 3]);

beforeEach(() => {
  mounts = 0;
  setDocumentViewState.mockClear();
  saveFileContent.mockClear();
  getDocumentForProjectNode.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("GenericFilePanel", () => {
  it("does not remount the rendered body when its parent re-renders", () => {
    const Host = () => {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button onClick={() => setTick(tick + 1)}>tick</button>
          <span data-testid="tick">{tick}</span>
          <GenericFilePanel
            document={doc}
            contents={bytes}
            viewState={{}}
            fileLoader={() => ({ fileInfo: { ok: true } })}
            // Defined inline, exactly as every real consumer does.
            validRenderer={() => <Body label="body" />}
          />
        </>
      );
    };

    render(<Host />);
    expect(mounts).toBe(1);

    fireEvent.click(screen.getByText("tick"));
    fireEvent.click(screen.getByText("tick"));

    // Guard against a vacuous assertion: the parent must really have re-rendered twice.
    expect(screen.getByTestId("tick").textContent).toBe("2");

    // Previously each parent render produced a new component type and a fresh mount.
    expect(mounts).toBe(1);
  });

  it("renders the invalid branch with the loader's error", () => {
    render(
      <GenericFilePanel
        document={doc}
        contents={bytes}
        viewState={{}}
        fileLoader={() => ({ error: "bad header" })}
        validRenderer={() => <Body label="valid" />}
      />
    );

    expect(screen.queryByTestId("body")).toBeNull();
    expect(document.body.textContent).toContain("bad header");
  });

  it("treats a throwing loader as invalid rather than crashing", () => {
    render(
      <GenericFilePanel
        document={doc}
        contents={bytes}
        viewState={{}}
        fileLoader={() => {
          throw new Error("boom");
        }}
        validRenderer={() => <Body label="valid" />}
      />
    );

    expect(document.body.textContent).toContain("boom");
  });

  it("exposes saveToFile to viewers and editors alike", async () => {
    let saver: ((data: Uint8Array) => Promise<void>) | undefined;
    render(
      <GenericFilePanel
        document={doc}
        contents={bytes}
        viewState={{}}
        fileLoader={() => ({ fileInfo: {} })}
        validRenderer={(ctx) => {
          saver = ctx.saveToFile;
          return <Body label="valid" />;
        }}
      />
    );

    // The editor/viewer split existed only because the editor's context had this one extra member.
    await saver?.(new Uint8Array([9]));
    expect(saveFileContent).toHaveBeenCalledWith("doc-1", new Uint8Array([9]));
  });
});

/*
 * A document restored at startup is opened as a *shell* — a tab with no bytes yet — and its contents
 * are read only when it is activated. The panel must never hand the loader that missing buffer:
 * `loadNexFileContents(undefined)` throws "Cannot read properties of undefined (reading 'length')"
 * from `BinaryReader`, which the panel then showed as if the file itself were broken.
 */
describe("GenericFilePanel without contents", () => {
  const shell = { id: "/p/game.nex", node: { name: "game.nex", fullPath: "/p/game.nex" } } as any;

  it("is the NEX loader's crash that was being shown as the file's error", async () => {
    const { loadNexFileContents } = await import(
      "@renderer/appIde/DocumentPanels/Next/nexFileLoader"
    );
    expect(() => loadNexFileContents(undefined as any)).toThrow(
      "Cannot read properties of undefined (reading 'length')"
    );
  });

  it("never hands the loader missing bytes, and reads them itself", async () => {
    getDocumentForProjectNode.mockResolvedValue({ ...shell, contents: bytes });
    const fileLoader = vi.fn((contents: Uint8Array) => ({ fileInfo: { size: contents.length } }));

    render(
      <GenericFilePanel
        document={shell}
        contents={undefined}
        viewState={{}}
        fileLoader={fileLoader}
        validRenderer={(ctx) => <Body label={`size ${(ctx.fileInfo as any).size}`} />}
      />
    );

    expect(await screen.findByText("size 3")).toBeInTheDocument();
    expect(getDocumentForProjectNode).toHaveBeenCalledWith(shell.node);
    expect(fileLoader).not.toHaveBeenCalledWith(undefined);
    expect(document.body.textContent).not.toContain("Cannot read properties");
  });

  it("uses the bytes the document area delivers later, and drops any earlier error", async () => {
    getDocumentForProjectNode.mockReturnValue(new Promise(() => {}));
    const fileLoader = vi.fn((contents: Uint8Array) =>
      contents.length ? { fileInfo: {} } : { error: "empty" }
    );
    const { rerender } = render(
      <GenericFilePanel
        document={shell}
        contents={undefined}
        viewState={{}}
        fileLoader={fileLoader}
        validRenderer={() => <Body label="valid" />}
      />
    );
    expect(screen.queryByTestId("body")).toBeNull();
    expect(fileLoader).not.toHaveBeenCalled();

    rerender(
      <GenericFilePanel
        document={shell}
        contents={new Uint8Array(0)}
        viewState={{}}
        fileLoader={fileLoader}
        validRenderer={() => <Body label="valid" />}
      />
    );
    expect(await screen.findByText("empty")).toBeInTheDocument();

    rerender(
      <GenericFilePanel
        document={shell}
        contents={bytes}
        viewState={{}}
        fileLoader={fileLoader}
        validRenderer={() => <Body label="valid" />}
      />
    );
    expect(await screen.findByTestId("body")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("empty");
  });

  it("says why when the file cannot be read", async () => {
    getDocumentForProjectNode.mockRejectedValue(new Error("File does not exist"));
    render(
      <GenericFilePanel
        document={shell}
        contents={undefined}
        viewState={{}}
        fileLoader={() => ({ fileInfo: {} })}
        validRenderer={() => <Body label="valid" />}
      />
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain("game.nex could not be read: File does not exist")
    );
  });

  it("says so for a document with no file behind it", async () => {
    render(
      <GenericFilePanel
        document={doc}
        contents={undefined}
        viewState={{}}
        fileLoader={() => ({ fileInfo: {} })}
        validRenderer={() => <Body label="valid" />}
      />
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain("This document has no contents to show.")
    );
    expect(getDocumentForProjectNode).not.toHaveBeenCalled();
  });
});
