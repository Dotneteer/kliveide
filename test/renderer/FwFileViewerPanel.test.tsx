import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FW_BLOCK } from "@common/zxnext/fwFile";

/*
 * The TBBLUE.FW viewer panel (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md` Phase 2, layout A): its sections,
 * the modules table with aliases and key caps, selection, the listing of a code module, the test card
 * section, a problem and the dumps. What it shows is computed by `parseFwFile`, tested in
 * `test/zxnext/fwFile.test.ts`.
 */

const text = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
/** `ld sp,$FFFF / di / jp $6010`, then texts */
const code = (texts: string[]) => [0x31, 0xff, 0xff, 0xf3, 0xc3, 0x10, 0x60, ...texts.flatMap((s) => [0, ...text(s)]), 0];

/** The current layout: boot, its two aliases, the updater, editor, cores, test card, reset, screens */
function buildFw({ cut = false } = {}): Uint8Array {
  const modules: { bytes: number[]; blocks: number }[] = [
    { bytes: code(["Firmware v", "<none>"]).concat(text("1.46"), [0]), blocks: 1 },
    { bytes: code(["Anti-Brick Updater"]), blocks: 1 },
    { bytes: code(["Settings menu"]), blocks: 1 },
    { bytes: code(["Extra cores"]), blocks: 1 },
    { bytes: code(["Cycling modes"]), blocks: 1 },
    { bytes: code(["Settings reset to defaults"]), blocks: 1 },
    { bytes: [...new Array(49152).fill(1), 0, 0, 0xff, 0x01], blocks: 97 }
  ];
  const map = new Uint8Array(FW_BLOCK);
  const order = [0, -1, 1, -1, 2, 3, 4, 5, 6];
  const starts: number[] = [];
  let next = 0;
  for (const m of modules) {
    starts.push(next);
    next += m.blocks;
  }
  order.forEach((m, i) => {
    const which = m < 0 ? 0 : m;
    map.set([starts[which] & 0xff, starts[which] >> 8, modules[which].blocks, 0], i * 4);
  });
  const file = new Uint8Array(FW_BLOCK * (1 + next));
  file.set(map);
  modules.forEach((m, i) => file.set(m.bytes, FW_BLOCK * (1 + starts[i])));
  return cut ? file.subarray(0, file.length - FW_BLOCK) : file;
}

beforeEach(() => {
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

async function renderViewer(contents: Uint8Array, viewState: Record<string, unknown> = {}) {
  const openDocument = vi.fn(() => Promise.resolve());
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) } })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState: vi.fn(),
      getDocument: vi.fn(() => undefined),
      getDocumentViewState: vi.fn(() => ({})),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store: { getState: () => ({}), dispatch: vi.fn() }, messenger: {} }),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark", isWindows: false, project: {} })
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
  // --- jsdom has no 2D canvas; the picture's drawing is not what this test is about
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

  const { createFwFileViewerPanel } = await import("@renderer/appIde/DocumentPanels/Next/FwFileViewerPanel");
  render(
    createFwFileViewerPanel({
      document: {
        id: "/sd/TBBLUE.FW",
        name: "TBBLUE.FW",
        type: "FwViewer",
        path: "/sd/TBBLUE.FW",
        node: { isFolder: false, name: "TBBLUE.FW", fullPath: "/sd/TBBLUE.FW", projectPath: "TBBLUE.FW" }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument };
}

describe("FwFileViewerPanel", () => {
  it("shows the file, the modules with their keys and aliases, and the boot module", async () => {
    await renderViewer(buildFw());
    expect(await screen.findByText("File")).toBeInTheDocument();
    expect(screen.getByText("No problems")).toBeInTheDocument();
    expect(screen.getByText("1.46")).toBeInTheDocument();
    expect(screen.getByText("9 of 128 entries, 2 of them aliases")).toBeInTheDocument();
    expect(screen.getByText("9 entries")).toBeInTheDocument();
    for (const name of ["Updater", "Editor", "Cores", "Test card", "Reset", "Screens"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Same blocks as module 0, for old loaders")).toHaveLength(2);
    // --- Key caps: Space for the editor, N + X for the reset
    expect(screen.getByText("Space").tagName).toBe("KBD");
    expect(screen.getByText("N").tagName).toBe("KBD");
    // --- The boot module is selected: its texts and the start of its listing
    expect(screen.getByText("Module 0 · Boot")).toBeInTheDocument();
    expect(screen.getByText("Firmware v")).toBeInTheDocument();
    const listing = await screen.findByTestId("fw-listing");
    expect(await within(listing).findByText("ld sp,$FFFF")).toBeInTheDocument();
    expect(screen.getByTestId("fw-map")).toBeInTheDocument();
  });

  it("selects a module from the table", async () => {
    await renderViewer(buildFw());
    fireEvent.click((await screen.findAllByText("Updater"))[0]);
    expect(await screen.findByText("Module 2 · Updater")).toBeInTheDocument();
    expect(screen.getByText("U, or DRIVE + M1 held at power-on")).toBeInTheDocument();
    expect(screen.getByText("Anti-Brick Updater")).toBeInTheDocument();
  });

  it("shows an alias as the module it repeats", async () => {
    await renderViewer(buildFw(), { selected: 1 });
    expect(await screen.findByText("Module 1 · Old editor")).toBeInTheDocument();
    expect(screen.getAllByText("Same blocks as module 0, for old loaders").length).toBeGreaterThan(0);
    expect(await within(await screen.findByTestId("fw-listing")).findByText("ld sp,$FFFF")).toBeInTheDocument();
  });

  it("shows the screens block's test card instead of a listing", async () => {
    await renderViewer(buildFw(), { selected: 8 });
    expect(await screen.findByText("Module 8 · Screens")).toBeInTheDocument();
    expect(screen.getByTestId("fw-picture")).toBeInTheDocument();
    expect(screen.queryByTestId("fw-listing")).toBeNull();
  });

  it("says what is wrong with a file cut short", async () => {
    await renderViewer(buildFw({ cut: true }));
    expect(await screen.findByText("1 error")).toBeInTheDocument();
    expect(screen.getByText("Module 8 lies beyond the end of the file.")).toBeInTheDocument();
  });

  it("refuses a file that is not a firmware file", async () => {
    await renderViewer(new Uint8Array(2048));
    expect(await screen.findByText(/This is not a TBBLUE.FW file/)).toBeInTheDocument();
  });

  it("opens the map and a module as memory dumps", async () => {
    const { openDocument } = await renderViewer(buildFw());
    fireEvent.click(await screen.findByLabelText("Show the 512-byte module map as a memory dump"));
    fireEvent.click(screen.getByLabelText("Show the whole module's disassembly"));
    await vi.waitFor(() => expect(openDocument).toHaveBeenCalledTimes(2));
  });
});
