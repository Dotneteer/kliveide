import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState })
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ projectService: { saveFileContent } })
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
