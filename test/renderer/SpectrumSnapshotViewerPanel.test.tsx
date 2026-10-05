import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSna128, buildSna48, buildSzx, buildZ80, state128, state48 } from "../spectrum/snapshot/builders";

/*
 * The ZX Spectrum snapshot viewer panel (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.8, Phase 6): its
 * sections per format, the screen picture, an unloadable file still shown, an invalid file, the
 * "at PC" dumps and the RAM bank browser. The values it computes are tested without a DOM in
 * `test/spectrum/snapshot/spectrum-snapshot-view.test.ts`.
 */

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

async function renderViewer(name: string, contents: Uint8Array, viewState: Record<string, unknown> = {}) {
  const openDocument = vi.fn(() => Promise.resolve());
  const setDocumentViewState = vi.fn();
  const screens: Uint8Array[] = [];
  const recordJump = vi.fn(async (_reason: string, jump: () => unknown) => await jump());

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) },
      navigationHistoryService: { recordJump }
    })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState,
      getDocument: vi.fn(() => undefined),
      getDocumentViewState: vi.fn(() => ({})),
      getDocumentApi: vi.fn(() => undefined),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store: { getState: () => ({}), dispatch: vi.fn() }, messenger: {} }),
    useSelector: (selector: (state: any) => any) =>
      selector({ theme: "dark", isWindows: false, project: { folderPath: "/project" } })
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
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }));
  // --- jsdom has no canvas: record what the screen picture is drawn from
  vi.doMock("@renderer/controls/Next/ScreenCanvas", () => ({
    ScreenCanvas: ({ data }: { data: Uint8Array }) => {
      screens.push(data);
      return <div data-testid="screen" />;
    }
  }));

  const { createSpectrumSnapshotViewerPanel } = await import(
    "@renderer/appIde/DocumentPanels/Spectrum/SpectrumSnapshotViewerPanel"
  );
  render(
    createSpectrumSnapshotViewerPanel({
      document: {
        id: `/project/${name}`,
        name,
        type: "SpectrumSnapshotViewer",
        path: `/project/${name}`,
        node: { isFolder: false, name, fullPath: `/project/${name}`, projectPath: name }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument, setDocumentViewState, screens, recordJump };
}

describe("SpectrumSnapshotViewerPanel", () => {
  it.each([
    ["game.sna", () => buildSna48(state48()), ".sna 48K", "ZX Spectrum 48K"],
    ["game.z80", () => buildZ80(state128(), { version: 3, paged: true }), ".z80 v3", "ZX Spectrum 128K"],
    ["game.szx", () => buildSzx(state128(), { machineId: 5 }), ".szx 1.4", "ZX Spectrum +3, loads as ZX Spectrum +3E"]
  ])("shows every section of %s", async (name, build, format, machine) => {
    await renderViewer(name, build());
    expect(await screen.findByText(format)).toBeInTheDocument();
    expect(screen.getByText(machine)).toBeInTheDocument();
    for (const heading of ["Snapshot", "Z80 Registers", "ULA", "Paging and Address Space at PC", "RAM Banks"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByText("$8123 (33059)")).toBeInTheDocument();
  });

  it("draws the screen from bank 5, or bank 7 with the shadow screen", async () => {
    const t = state128({ port7ffd: 0x08 });
    let { screens } = await renderViewer("a.szx", buildSzx(t, { machineId: 2 }));
    await screen.findByTestId("screen");
    expect(screens.at(-1)).toEqual(t.ram.get(7));
    cleanup();
    vi.resetModules();
    ({ screens } = await renderViewer("a.sna", buildSna48(state48())));
    await screen.findByTestId("screen");
    expect(screens.at(-1)).toEqual(state48().ram.get(5));
  });

  it("shows the AY section for a 128K and decodes paging", async () => {
    await renderViewer("a.szx", buildSzx(state128({ port7ffd: 0x34 }), { machineId: 2 }));
    expect(await screen.findByText("AY-3-8912")).toBeInTheDocument();
    expect(screen.getByText("$34: bank 4, ROM 1, normal screen, locked")).toBeInTheDocument();
    expect(screen.getByText("bank 4")).toBeInTheDocument();
    expect(screen.getByText("ROM 1 (not in the snapshot)")).toBeInTheDocument();
  });

  it("says why a snapshot cannot be loaded, and still shows it", async () => {
    await renderViewer("p.szx", buildSzx(state128(), { machineId: 11 }));
    expect(await screen.findByText("Klive cannot emulate the ZX Spectrum SE")).toBeInTheDocument();
    expect(screen.getByText("Z80 Registers")).toBeInTheDocument();
  });

  it("reports a file that is not a snapshot (a PASTA/80 temp .z80)", async () => {
    await renderViewer("hello.z80", new Uint8Array(12));
    expect(await screen.findByText(/^Not a valid snapshot: A \.z80 file has a 30-byte header/)).toBeInTheDocument();
  });

  it.each([
    ["Disassembly at PC", "disassembly"],
    ["Memory dump at PC", "memory"]
  ])("%s opens the 64K at PC", async (button, viewMode) => {
    const { openDocument } = await renderViewer("a.sna", buildSna128(state128()));
    fireEvent.click(await screen.findByRole("button", { name: button }));
    const [doc, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc).toMatchObject({ id: "memoryDump-spectrumSnapshota.sna", name: "a.sna - 64K at PC" });
    expect(doc.contents).toHaveLength(0x1_0000);
    expect(viewState).toMatchObject({ disassemblyEnabled: true, viewMode, topAddress: 0x8123 });
  });

  it("lists the RAM banks and pops one out at the address it is paged in, recorded for Go Back", async () => {
    const { openDocument, setDocumentViewState, recordJump } = await renderViewer("a.sna", buildSna128(state128()), {
      selectedBank: 3
    });
    const list = await screen.findByRole("listbox", { name: "Bank list" });
    expect(within(list).getAllByRole("option")).toHaveLength(8);
    expect(screen.getByText("8 banks · 128 KB · 3 paged in")).toBeInTheDocument();
    const row = within(list).getAllByRole("option").find((r) => r.dataset.bank === "3")!;
    expect(row).toHaveAttribute("aria-selected", "true");
    fireEvent.doubleClick(row);
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc).toMatchObject({ id: "memoryDump-spectrumBankDump/project/a.sna:3", name: "a.sna - Bank 3" });
    expect(viewState).toMatchObject({ disassOffset: 0xc000 });
    expect(setDocumentViewState).toHaveBeenCalled();
    expect(recordJump).toHaveBeenCalledWith("spectrumBank", expect.any(Function));
  });
});
