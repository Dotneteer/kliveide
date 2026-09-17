import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MF_BANK, MF_ROM } from "@common/machines/constants";

const HEADER_SIZE = 512;
const BANK_SIZE = 0x4000;

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", {
    configurable: true,
    value: vi.fn(() => false)
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NexFileViewerPanel annotations", () => {
  it("shows missing sidecar state and creates a default annotation file", async () => {
    const readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist")));
    const saveFileContent = vi.fn(() => Promise.resolve());
    const dispatch = vi.fn();

    await renderNexViewer({ readFileContent, saveFileContent, dispatch });

    expect(await screen.findByText("No annotation file attached.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Click to create one!" })).toBeInTheDocument();
    expect(screen.queryByText("No annotation sidecar file found.")).not.toBeInTheDocument();
    expect(screen.queryByText("Open JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Click to create one!" }));

    await waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));
    expect(saveFileContent).toHaveBeenCalledWith(
      "/project/ScrollNutter.nex.dis",
      expect.any(String)
    );
    expect(JSON.parse(saveFileContent.mock.calls[0][1])).toMatchObject({
      // --- Schema 2: a newly created sidecar declares the version that has the `debug` subtree.
      schemaVersion: 2,
      source: { fileName: "ScrollNutter.nex" },
      banks: {
        "5": {
          offsetIndex: 1,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
        }
      }
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "INC_EXPLORER_VIEW_VERSION" }));
    await waitFor(() =>
      expect(screen.queryByText("No annotation file attached.")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Click to create one!" })).not.toBeInTheDocument();
    expect(screen.queryByText("Open JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("Reload")).not.toBeInTheDocument();
  });

  /*
   * The bank browser: a list of banks and the selected bank's details, replacing one expandable panel
   * per bank. Every bank still pops out into its own document — from its row's icon, by double-click
   * or Enter on the row, or from the details' Pop out button (and its menu for another view).
   */
  const sidecar = (bank: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          schemaVersion: 2,
          banks: {
            "5": {
              offsetIndex: 2,
              regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
              ...bank
            }
          },
          ...extra
        })
      )
    );

  const rowPopOut = () => screen.findByRole("button", { name: "Pop out Bank $05" });
  const details = () => screen.findByRole("complementary", { name: "Bank $05 details" });
  const bankRow = () => screen.findByRole("option", { name: /\$05/ });

  describe("bank browser", () => {
    it("pops a bank out from its row with the annotation file's offset, decimal flag and view", async () => {
      const openDocument = vi.fn(() => Promise.resolve());
      const readFileContent = sidecar({ lastView: "disassembly", decimalView: true });
      const { recordJump } = await renderNexViewer({ readFileContent, openDocument });

      // --- Wait for the sidecar to reach the list: the details then know the listing address.
      expect(within(await details()).getByText("$8000")).toBeInTheDocument();
      fireEvent.click(await rowPopOut());

      // --- Popping a bank out is a jump: Go Back returns to the viewer.
      await waitFor(() => expect(recordJump).toHaveBeenCalledWith("nexBank", expect.any(Function)));
      await waitFor(() =>
        expect(openDocument).toHaveBeenCalledWith(
          expect.objectContaining({
            // --- Keyed by the node's *full* path, not its project path ("ScrollNutter.nex"): the
            // --- debugger's PC reveal and go-to-definition open the same bank from the host path
            // --- `nex-run` recorded, and a different id would open the bank as a second document.
            id: "memoryDump-bankDump/project/ScrollNutter.nex:5"
          }),
          expect.objectContaining({
            disassemblyEnabled: true,
            disassOffset: 0x8000,
            decimalView: true,
            viewMode: "disassembly",
            nexAnnotationPath: "/project/ScrollNutter.nex.dis",
            nexAnnotationBank: 5
          }),
          false
        )
      );
      expect(readFileContent).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("No annotation file attached.")).not.toBeInTheDocument();
    });

    it("pops out in the Sprites view when that was the view the bank last showed", async () => {
      const openDocument = vi.fn(() => Promise.resolve());
      await renderNexViewer({
        readFileContent: sidecar({ lastView: "memory", sprites: { active: true } }),
        openDocument
      });

      const panel = await details();
      await waitFor(() => expect(within(panel).getByText("· Sprites")).toBeInTheDocument());
      fireEvent.click(within(panel).getByRole("button", { name: "Pop out in Sprites" }));

      await waitFor(() =>
        expect(openDocument).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ viewMode: "sprites", nexAnnotationBank: 5 }),
          false
        )
      );
    });

    it("pops out in another view from the details' menu", async () => {
      const openDocument = vi.fn(() => Promise.resolve());
      await renderNexViewer({ readFileContent: sidecar({ lastView: "disassembly" }), openDocument });

      const panel = await details();
      await waitFor(() => expect(within(panel).getByText("· Disassembly")).toBeInTheDocument());
      fireEvent.click(within(panel).getByRole("button", { name: "Pop out in another view" }));
      const memory = await screen.findByRole("menuitem", { name: /Pop Out in Memory/ });
      expect(screen.getByRole("menuitem", { name: /Pop Out in Disassembly/ })).toHaveTextContent("last used");
      expect(screen.getByRole("menuitem", { name: /Pop Out in Sprites/ })).toBeInTheDocument();
      fireEvent.click(memory);

      await waitFor(() =>
        expect(openDocument).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ viewMode: "memory" }),
          false
        )
      );
    });

    it("pops out by double-clicking a row, or with Enter", async () => {
      const openDocument = vi.fn(() => Promise.resolve());
      await renderNexViewer({ readFileContent: sidecar(), openDocument });
      await details();

      fireEvent.doubleClick(await bankRow());
      await waitFor(() => expect(openDocument).toHaveBeenCalledTimes(1));
      fireEvent.keyDown(screen.getByRole("listbox", { name: "Bank list" }), { key: "Enter" });
      await waitFor(() => expect(openDocument).toHaveBeenCalledTimes(2));
    });

    it("offers no Sprites view, and pops out without annotations, when there is no annotation file", async () => {
      const openDocument = vi.fn(() => Promise.resolve());
      await renderNexViewer({ openDocument });

      const panel = await details();
      fireEvent.click(within(panel).getByRole("button", { name: "Pop out in another view" }));
      await screen.findByRole("menuitem", { name: /Pop Out in Memory/ });
      expect(screen.queryByRole("menuitem", { name: /Pop Out in Sprites/ })).toBeNull();
      expect(within(panel).getByText(/Regions are recorded in the annotation file/)).toBeInTheDocument();

      fireEvent.click(await rowPopOut());
      await waitFor(() =>
        expect(openDocument).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ nexAnnotationPath: undefined, nexAnnotationBank: undefined }),
          false
        )
      );
    });

    it("shows the bank's facts, content mix and labels in the details", async () => {
      await renderNexViewer({
        contents: createNexWithLayer2AndBank5(),
        readFileContent: sidecar(
          {
            regions: [
              { start: 0, end: 0x1fff, type: "disassemble" },
              { start: 0x2000, end: 0x3fff, type: "bytes" }
            ],
            localLabels: [{ name: "Local", value: 0x10 }]
          },
          { globalLabels: [{ name: "Inside", value: 0x9000 }, { name: "Outside", value: 0x4000 }] }
        )
      });

      const panel = await details();
      await waitFor(() => expect(within(panel).getByText("Code 50%")).toBeInTheDocument());
      expect(within(panel).getByText("Bytes 50%")).toBeInTheDocument();
      expect(within(panel).getByText("16 KB")).toBeInTheDocument();
      expect(within(panel).getByText("Labels (2)")).toBeInTheDocument();
      expect(within(panel).getByText("Local")).toBeInTheDocument();
      expect(within(panel).getByText("Inside")).toBeInTheDocument();
      expect(within(panel).queryByText("Outside")).toBeNull();
      // --- No memory preview any more: the old panel's dump viewer is gone.
      expect(screen.queryByTestId("memory-viewer-bank-5")).toBeNull();
    });

    it("remembers the selected bank and the filter in view state", async () => {
      const { setDocumentViewState } = await renderNexViewer({ readFileContent: sidecar() });
      await details();

      fireEvent.click(await bankRow());
      fireEvent.click(screen.getByRole("button", { name: "Annotated" }));
      expect(await screen.findByText("No bank matches this filter.")).toBeInTheDocument();

      await waitFor(() =>
        expect(setDocumentViewState).toHaveBeenLastCalledWith(
          "/project/ScrollNutter.nex",
          expect.objectContaining({ selectedBank: 5, bankFilter: "annotated" })
        )
      );
    });
  });

  describe("bank comments", () => {
    it("shows the comment on one line in the list and in full in the details", async () => {
      await renderNexViewer({ readFileContent: sidecar({ comment: "Music player\n\nCalled from IsrMain" }) });

      const row = await bankRow();
      await waitFor(() => expect(row).toHaveTextContent("Music player \u00b7 Called from IsrMain"));
      const panel = await details();
      expect(within(panel).getByText(/Music player\s+Called from IsrMain/)).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: "Edit comment..." })).toBeInTheDocument();
    });

    it("offers to add a comment to a bank without one", async () => {
      await renderNexViewer({ readFileContent: sidecar() });
      const panel = await details();
      expect(await within(panel).findByRole("button", { name: "Add comment..." })).toBeInTheDocument();
    });

    it("offers no comment editing when there is no annotation file", async () => {
      await renderNexViewer({});
      const panel = await details();
      expect(within(panel).queryByRole("button", { name: /comment\.\.\./ })).toBeNull();
      expect(within(panel).getByText(/Comments are kept in the annotation file/)).toBeInTheDocument();
    });

    it("edits the comment from the details, and writes it", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      const openDialog = vi.fn(() => Promise.resolve({ comment: "Music\nIM2 handler" }));
      await renderNexViewer({ readFileContent: sidecar({ comment: "Music" }), saveFileContent, openDialog });

      const panel = await details();
      fireEvent.click(await within(panel).findByRole("button", { name: "Edit comment..." }));

      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      expect(openDialog.mock.calls[0][1]).toEqual({ bank: 5, initialComment: "Music" });
      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
      expect(saved.banks["5"].comment).toBe("Music\nIM2 handler");
      await waitFor(() => expect(bankRowSync()).toHaveTextContent("Music \u00b7 IM2 handler"));
    });

    it("changes nothing when the dialog is dismissed", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      const openDialog = vi.fn(() => Promise.resolve(undefined));
      await renderNexViewer({ readFileContent: sidecar({ comment: "Music" }), saveFileContent, openDialog });

      const panel = await details();
      fireEvent.click(await within(panel).findByRole("button", { name: "Edit comment..." }));
      await waitFor(() => expect(openDialog).toHaveBeenCalledTimes(1));
      await Promise.resolve();
      expect(saveFileContent).not.toHaveBeenCalled();
    });

    it("follows an edit published from a popped-out bank", async () => {
      await renderNexViewer({ readFileContent: sidecar({ comment: "Before" }) });
      const row = await bankRow();
      await waitFor(() => expect(row).toHaveTextContent("Before"));

      const session = await import("@renderer/appIde/DocumentPanels/Next/nexAnnotationSession");
      const current = session.peekNexAnnotationSession("/project/ScrollNutter.nex.dis");
      expect(current).toBeDefined();
      session.updateNexAnnotationSession("/project/ScrollNutter.nex.dis", {
        ...current!,
        banks: { "5": { ...current!.banks["5"], comment: "After" } }
      });

      await waitFor(() => expect(bankRowSync()).toHaveTextContent("After"));
    });

    it("clears the comment from the row's context menu", async () => {
      const saveFileContent = vi.fn(() => Promise.resolve());
      await renderNexViewer({ readFileContent: sidecar({ comment: "Music" }), saveFileContent });

      const row = await bankRow();
      await waitFor(() => expect(row).toHaveTextContent("Music"));
      fireEvent.contextMenu(row);
      fireEvent.click(await screen.findByRole("menuitem", { name: "Clear Bank Comment" }));

      await waitFor(() => expect(saveFileContent).toHaveBeenCalled());
      const saved = JSON.parse(saveFileContent.mock.calls.at(-1)[1]);
      expect(saved.banks["5"]).not.toHaveProperty("comment");
      await waitFor(() => expect(bankRowSync()).not.toHaveTextContent("Music"));
    });
  });

  function bankRowSync(): HTMLElement {
    return screen.getByRole("option", { name: /\$05/ });
  }

  /**
   * 112 bank flags is far too many to scan, and "how many banks does this file carry" is the
   * question you open the section to answer — so the section answers it while still collapsed.
   *
   * A chip, as PC and SP are on a bank heading: it is a fact *about* the section, not part of its
   * name. Only the count is worth showing — the denominator is always 112 — so the full sense lives
   * in the tooltip rather than in the chip.
   */
  it("counts the set bank flags in a chip on the section heading", async () => {
    await renderNexViewer({ contents: createNexWithLayer2AndBank5() });

    const row = (await screen.findByText(/Bank flags/)).closest(
      '[class*="expandableRowHeading"]'
    ) as HTMLElement;
    expect(row).not.toBeNull();

    const chip = row.querySelector('[class*="headingChip"]') as HTMLElement;
    expect(chip).not.toBeNull();
    // --- One bank in this fixture, and the bare number is all the chip carries.
    expect(chip.textContent).toBe("1");
    expect(chip.getAttribute("title")).toBe("1 of 112 bank flags set");
    expect(row.querySelector('[class*="headingMeta"]')).toBeNull();
  });

  /**
   * Every flag in the header takes the panel's own value colour.
   *
   * The loading-screen block flags — Layer2, ULA, LoRes, HiRes, HiColor, No palette — sit two to a
   * row, so they were written out longhand instead of going through `HeaderFlag`, and they were
   * left on the neutral `--color-value` when the wrapper was given the panel's colour. Asserted
   * over *all* of them rather than the six by name, so a seventh cannot be added on the default.
   */
  it("draws every header flag in the panel's value colour", async () => {
    await renderNexViewer({ contents: createNexWithLayer2AndBank5() });

    await screen.findByText(/Bank flags/);
    const flagIcons = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-testid="icon-circle-filled"], [data-testid="icon-circle-outline"]'
      )
    );
    expect(flagIcons.length).toBeGreaterThan(6);
    expect(flagIcons.map((icon) => icon.getAttribute("data-fill"))).toEqual(
      flagIcons.map(() => "--color-state-value")
    );
  });

  /**
   * The loading screen's action sits in the section header, beside the name it acts on.
   *
   * `Layer2Screen` used to carry a one-button header of its own, immediately below the section
   * header that already named it — two headers, and the action as far from the name as it could be.
   */
  it("opens the Layer 2 screen from its own section header", async () => {
    const openDocument = vi.fn(() => Promise.resolve());
    await renderNexViewer({
      contents: createNexWithLayer2AndBank5(),
      openDocument,
      viewState: { layer2LoadingScreenExpanded: true }
    });

    const heading = await screen.findByText("Layer 2 Loading Screen");
    const row = heading.closest('[class*="expandableRowHeading"]') as HTMLElement;
    const action = row.querySelector('[class*="headingAction"]') as HTMLElement;
    expect(action).not.toBeNull();

    // --- The same glyph a bank offers, not the old filled one.
    expect(
      action.querySelector('[data-testid="icon-square-arrow-out-up-right"]')
    ).not.toBeNull();

    fireEvent.click(within(action).getByRole("button"));
    await waitFor(() =>
      expect(openDocument).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.stringContaining("layer2ScreenDump") }),
        expect.anything(),
        false
      )
    );
  });

  it("shows a short error when an existing sidecar cannot be loaded", async () => {
    const readFileContent = vi.fn(() => Promise.resolve("{"));

    await renderNexViewer({ readFileContent });

    expect(await screen.findByText("Annotation file could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Click to create one!" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();
  });

  it("does not rerender the Layer 2 loading screen while the viewer scrolls", async () => {
    const layer2ScreenRender = vi.fn(() => <div data-testid="layer2-screen" />);

    const harness = await renderNexViewer({
      contents: createNexWithLayer2AndBank5(),
      layer2ScreenRender,
      viewState: {
        layer2LoadingScreenExpanded: true
      }
    });

    await screen.findByTestId("layer2-screen");
    const initialRenderCount = layer2ScreenRender.mock.calls.length;
    const panel = screen.getByTestId("generic-file-panel");
    fireEvent.scroll(panel, { target: { scrollTop: 320 } });

    await waitFor(() =>
      expect(harness.setDocumentViewState).toHaveBeenCalledWith(
        "/project/ScrollNutter.nex",
        expect.objectContaining({ scrollPosition: 320 })
      )
    );
    expect(layer2ScreenRender).toHaveBeenCalledTimes(initialRenderCount);
  });
});

async function renderNexViewer({
  readFileContent = vi.fn(() => Promise.reject(new Error("File does not exist"))),
  saveFileContent = vi.fn(() => Promise.resolve()),
  dispatch = vi.fn(),
  openDocument = vi.fn(() => Promise.resolve()),
  contents = createNexWithBank5(),
  layer2ScreenRender = vi.fn(() => <div data-testid="layer2-screen" />),
  viewState = { bankExpanded: { 0: true } },
  openDialog = vi.fn(() => Promise.resolve(undefined))
}: {
  readFileContent?: ReturnType<typeof vi.fn>;
  saveFileContent?: ReturnType<typeof vi.fn>;
  dispatch?: ReturnType<typeof vi.fn>;
  openDocument?: ReturnType<typeof vi.fn>;
  contents?: Uint8Array;
  layer2ScreenRender?: ReturnType<typeof vi.fn>;
  viewState?: Record<string, unknown>;
  openDialog?: ReturnType<typeof vi.fn>;
}) {
  const setDocumentViewState = vi.fn();
  const recordJump = vi.fn(async (_reason: string, jump: () => unknown) => await jump());
  const projectService = {
    readFileContent,
    saveFileContent,
    getNodeForFile: vi.fn(() => undefined),
    getDocumentForProjectNode: vi.fn(() => Promise.resolve({}))
  };

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    // --- `machineService` was added for the header validation banner, which compares the file's
    // --- required core version and RAM against the current machine. The ZX Next's real feature
    // --- counts, so the banner these tests see is the one the app would show.
    useAppServices: () => ({
      projectService,
      navigationHistoryService: { recordJump },
      machineService: {
        getMachineInfo: () => ({
          machine: { machineId: "zxnext", features: { [MF_ROM]: 7, [MF_BANK]: 224 } }
        })
      }
    })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState,
      getDocument: vi.fn(() => undefined),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/controls/overlay/DialogProvider", () => ({
    useDialogs: () => ({ open: openDialog })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => dispatch,
    useRendererContext: () => ({
      store: { getState: () => ({}), dispatch },
      messenger: {},
      messageSource: "ide"
    }),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark", isWindows: false })
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
  /* --- `fill` is carried through so a test can assert which token an icon was drawn with. */
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName, fill }: { iconName: string; fill?: string }) => (
      <span data-testid={`icon-${iconName}`} data-fill={fill} />
    )
  }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({
    Panel: ({
      children,
      initialScrollPosition,
      onScrolled
    }: {
      children: ReactNode;
      initialScrollPosition?: number;
      onScrolled?: (pos: number) => void;
    }) => (
      <div
        data-testid="generic-file-panel"
        data-initial-scroll-position={initialScrollPosition}
        onScroll={(event) => onScrolled?.(event.currentTarget.scrollTop)}
      >
        {children}
      </div>
    )
  }));
  vi.doMock("@renderer/controls/Next/Layer2Screen", () => ({
    Layer2Screen: layer2ScreenRender
  }));
  vi.doMock("@renderer/controls/memory/MemoryDumpViewer", () => ({
    MemoryDumpViewer: (props: {
      bank?: number;
      disassOffset?: number;
      decimalView?: boolean;
      viewMode?: string;
      nexAnnotationPath?: string;
    }) => (
      <div
        data-testid={`memory-viewer-bank-${props.bank ?? "none"}`}
        data-offset={props.disassOffset}
        data-decimal-view={String(props.decimalView)}
        data-view-mode={props.viewMode}
        data-annotation-path={props.nexAnnotationPath}
      />
    )
  }));

  const { createNexFileViewerPanel } = await import(
    "@renderer/appIde/DocumentPanels/Next/NexFileViewerPanel"
  );

  render(
    createNexFileViewerPanel({
      document: {
        id: "/project/ScrollNutter.nex",
        name: "ScrollNutter.nex",
        type: "NexViewer",
        path: "/project/ScrollNutter.nex",
        node: {
          isFolder: false,
          name: "ScrollNutter.nex",
          fullPath: "/project/ScrollNutter.nex",
          projectPath: "ScrollNutter.nex"
        }
      },
      contents,
      viewState
    } as any)
  );

  return {
    setDocumentViewState,
    recordJump,
    openDialog
  };
}

function createNexWithBank5(): Uint8Array {
  const contents = new Uint8Array(HEADER_SIZE + BANK_SIZE);
  contents.set([0x4e, 0x65, 0x78, 0x74], 0); // Next
  contents.set([0x56, 0x31, 0x2e, 0x32], 4); // V1.2
  contents[9] = 1;
  contents[18 + 5] = 1;
  contents[HEADER_SIZE] = 0x55;
  return contents;
}

function createNexWithLayer2AndBank5(): Uint8Array {
  const contents = new Uint8Array(HEADER_SIZE + 512 + 0xc000 + BANK_SIZE);
  contents.set([0x4e, 0x65, 0x78, 0x74], 0); // Next
  contents.set([0x56, 0x31, 0x2e, 0x32], 4); // V1.2
  contents[9] = 1;
  contents[10] = 0x01;
  contents[18 + 5] = 1;
  contents[HEADER_SIZE + 512] = 0x22;
  contents[HEADER_SIZE + 512 + 0xc000] = 0x55;
  return contents;
}

/*
 * The pre-launch validation banner.
 *
 * The rules themselves are covered without a DOM in `test/renderer/nexValidation.test.ts`; what
 * these two check is that the viewer actually shows them, and — the more easily broken half — that
 * it shows nothing for a sound file. See `.plans/NEX_DEBUGGING_PLAN.md` §12.
 */
describe("NexFileViewerPanel: header validation", () => {
  it("warns that the entry bank is not in the file", async () => {
    /*
     * `createNexWithBank5` is a minimal fixture: it declares bank 5 and leaves the entry bank, the
     * program counter and the stack pointer all at zero. So it is an invalid NEX three times over,
     * which makes it a good demonstration that the banner appears — NextZXOS would page whatever
     * was in bank 0 at `$C000` and jump into it, reporting success.
     */
    await renderNexViewer({ contents: createNexWithBank5() });

    expect(await screen.findByText(/This NEX file has 3 problems/)).toBeTruthy();
    // --- The worst one is spelled out beside the summary; the rest are in the row's tooltip.
    expect(screen.getByText(/entry bank \$00 is not one of the banks/)).toBeTruthy();
  });

  it("says nothing for a sound header", async () => {
    /*
     * The same file with all three faults corrected: the entry bank is the one it contains, and the
     * program counter and stack pointer are in RAM rather than in the ROM that is paged at `$0000`
     * when a program starts.
     */
    const contents = createNexWithBank5();
    contents[12] = 0x00; // --- SP $FF00
    contents[13] = 0xff;
    contents[14] = 0x00; // --- PC $4000, inside bank 5
    contents[15] = 0x40;
    contents[139] = 5; // --- entry bank 5

    await renderNexViewer({ contents });

    expect(screen.queryByText(/This NEX file has/)).toBeNull();
  });
});
