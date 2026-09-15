import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MachineControllerState } from "@abstractions/MachineControllerState";

/*
 * The annotation shortcuts, driven against the *real* dialog stack.
 *
 * `StaticMemoryDump.test.tsx` mocks `DialogProvider` away, which is right for asserting what the
 * panel asks for — but it means no `Modal` ever mounts, so nothing there can see what opening and
 * closing a real dialog does to focus. That is exactly the reported failure: a shortcut works once
 * and then goes dead until a row is clicked again. So this file mocks the same infrastructure and
 * keeps the dialog stack real.
 */

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", {
    configurable: true,
    value: vi.fn(() => false)
  });
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderPanel() {
  vi.resetModules();

  const documentHubService = {
    setDocumentViewState: vi.fn(),
    setDocumentApi: vi.fn(),
    signHubStateChanged: vi.fn()
  };
  const projectService = {
    readFileContent: vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 1,
          banks: { "5": { offsetIndex: 2, regions: [{ start: 0, end: 11, type: "bytes" }] } }
        })
      )
    ),
    saveFileContent: vi.fn(() => Promise.resolve())
  };

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });

  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => documentHubService
  }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  /*
   * `Modal` reads the store through this too, so the mock has to serve both callers — and the
   * value must be **stable**. `Modal` keys its focus bookkeeping on `[isOpen, messageSource,
   * modalId, store]`; a fresh object per call makes that effect tear down and re-run on every
   * render, which no real app does (the store is created once and passed in as a prop) and which
   * invents focus churn that is not the bug under test.
   */
  const rendererContext = {
    store: { dispatch: vi.fn(), getState: () => ({}), subscribe: () => () => {} },
    messageSource: "ide"
  };
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useGlobalSetting: () => undefined,
    useSelector: () => 0,
    useDispatch: () => vi.fn(),
    useRendererContext: () => rendererContext
  }));
  vi.doMock("@renderer/core/EmuApi", () => ({
    useEmuApi: () => ({
      listBreakpoints: async () => ({ breakpoints: [] }),
      getCpuStateChunk: async () => ({
        state: MachineControllerState.Stopped,
        pcValue: 0,
        tacts: 0
      }),
      getNextMemoryMapping: async () => ({ pageInfo: [] })
    })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({
      theme: { tone: "dark" },
      getIcon: () => ({ width: 16, height: 16, path: "" }),
      getImage: () => ({ type: "png", data: "" }),
      getThemeProperty: () => "currentColor"
    }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/AddressInput", () => ({
    AddressInput: () => <button data-testid="go-to-address">go</button>
  }));
  vi.doMock("@renderer/controls/Dropdown", () => ({
    default: () => <select />
  }));
  vi.doMock("@renderer/controls/LabeledSwitch", () => ({
    LabeledSwitch: ({ label }: { label: string }) => <button>{label}</button>
  }));
  vi.doMock("@renderer/controls/IconButton", () => ({
    SmallIconButton: ({ title, clicked }: { title?: string; clicked?: () => void }) => (
      <button onClick={clicked}>{title}</button>
    )
  }));
  vi.doMock("@renderer/features/memory/MemoryDumpSection", () => ({
    MemoryDumpSection: () => <div />
  }));
  // --- The list is the one piece that has to be flattened: `virtua` measures, and jsdom does not.
  vi.doMock("@renderer/controls/VirtualizedList", () => ({
    VirtualizedList: ({
      items = [],
      renderItem
    }: {
      items?: unknown[];
      renderItem?: (index: number, item: unknown) => ReactNode;
    }) => (
      <div>
        {items.slice(0, 5).map((item, index) => (
          <div key={index}>{renderItem?.(index, item)}</div>
        ))}
      </div>
    )
  }));

  const { DialogProvider } = await import("@renderer/controls/overlay/DialogProvider");
  const { createStaticMemoryDump } = await import("@renderer/features/memory/StaticMemoryDump");

  const result = render(
    <DialogProvider>
      {createStaticMemoryDump({
        document: { editVersionCount: 0, id: "static-dump-doc", savedVersionCount: 0 },
        contents: (() => {
          const contents = new Uint8Array(0x4000);
          contents.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
          return contents;
        })(),
        viewState: {
          disassemblyEnabled: true,
          viewMode: "disassembly",
          disassOffset: 0x8000,
          nexAnnotationPath: "/project/game.nex.dis",
          nexAnnotationBank: 5
        }
      } as any)}
    </DialogProvider>
  );

  await waitFor(() =>
    expect(screen.getByTestId("disassembly-row-0")).toHaveAttribute(
      "data-annotation-region",
      "bytes"
    )
  );
  fireEvent.click(screen.getByTestId("disassembly-row-0"));
  return { ...result, list: screen.getByTestId("static-disassembly-list") };
}

describe("annotation shortcuts against the real dialog stack", () => {
  it("opens the comment dialog again after the first one is cancelled", async () => {
    const { list } = await renderPanel();

    fireEvent.keyDown(list, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("End-of-line preview")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("End-of-line preview")).not.toBeInTheDocument()
    );

    /*
     * The reported symptom, stated as the thing that must hold.
     *
     * The shortcuts are bare letters, heard only while the listing is focused, so focus landing on
     * `<body>` after a dialog is what made them look broken — nothing worked until the user clicked
     * a row again.
     */
    expect(document.activeElement).toBe(list);

    fireEvent.keyDown(list, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("End-of-line preview")).toBeInTheDocument());
  });

  it("takes focus back even when nothing restores it", async () => {
    /*
     * The panel's own backstop, with the modal's restore removed.
     *
     * Returning focus to the opener is the modal's job, and it does it — but the shortcuts are the
     * panel's feature, and a keyboard surface that only works while a shared component behaves is
     * a fragile one. Blanking focus the moment the dialog resolves stands in for any way it could
     * be lost: `<body>` is the browser saying nothing holds focus, and the listing claims it back.
     */
    const { list } = await renderPanel();

    fireEvent.keyDown(list, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("End-of-line preview")).toBeInTheDocument());

    const realFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, ...args: any[]) {
      // --- Let the panel's own reclaim through; suppress the modal's restore.
      if (this !== list) return;
      return realFocus.apply(this, args as any);
    };
    (window.document.activeElement as HTMLElement)?.blur?.();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("End-of-line preview")).not.toBeInTheDocument()
    );
    HTMLElement.prototype.focus = realFocus;

    await waitFor(() => expect(window.document.activeElement).toBe(list));

    fireEvent.keyDown(list, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("End-of-line preview")).toBeInTheDocument());
  });
});
