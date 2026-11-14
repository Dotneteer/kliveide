import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TBU_SECTOR, fletcher16 } from "@common/zxnext/tbuFile";

/*
 * The TBBLUE.TBU viewer panel (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` Phase 2b): its sections, the
 * cores table and selection, a problem, the packet listing and the dumps. What it shows is computed by
 * `parseTbuFile` and `decodeBitstreamPackets`, tested without a DOM in `test/zxnext/`.
 */

/** A 7-series bitstream start: sync, an IDCODE write and a DESYNC */
function series7(idcode: number): number[] {
  const words = [0x30018001, idcode, 0x30008001, 0x0d];
  return [0xff, 0xff, 0xff, 0xff, 0xaa, 0x99, 0x55, 0x66, ...words.flatMap((w) => [w >>> 24, (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff])];
}

/** A Spartan-6 one: sync, a two-word IDCODE write, a DESYNC */
function spartan6(): number[] {
  return [0xaa, 0x99, 0x55, 0x66, 0x31, 0xc2, 0x04, 0x00, 0x20, 0x93, 0x30, 0xa1, 0x00, 0x0d];
}

type Core = { board: number; type?: number; bits: number[]; share?: number };

/** A multi-core file: header, then 3-sector images each ending in its identification sector */
function buildTbu(cores: Core[]): Uint8Array {
  const header = new Uint8Array(TBU_SECTOR).fill(0xff);
  header.set(Array.from("TBUFILE\0ZX SPECTRUM NEXT\0", (c) => c.charCodeAt(0)), 0);
  const images: Uint8Array[] = [];
  const placed: { offset: number; checksum: number }[] = [];
  cores.forEach((core, i) => {
    const type = core.type ?? 1;
    let where = core.share !== undefined ? placed[core.share] : undefined;
    if (!where) {
      const image = new Uint8Array(3 * TBU_SECTOR).fill(0xff);
      image.set(core.bits);
      const text = `ZX SPECTRUM NEXT\0ZXN ISSUE ${(core.board & 15) + 2} ZX SPECTRUM NEXT\0`;
      image.set(Array.from(text, (c) => c.charCodeAt(0)), 2 * TBU_SECTOR);
      image.set([7, type, core.board, 0x33, 3, 0xff, 0xff], 2 * TBU_SECTOR + text.length);
      where = { offset: images.length * 3, checksum: fletcher16(image) };
      images.push(image);
    }
    placed.push(where);
    const r = 25 + i * 15;
    header.set([15, type, core.board, 0x33, 3], r);
    const view = new DataView(header.buffer);
    view.setUint32(r + 5, where.offset, true);
    view.setUint32(r + 9, 3, true);
    view.setUint16(r + 13, where.checksum, true);
  });
  const file = new Uint8Array(TBU_SECTOR * (1 + images.length * 3));
  file.set(header);
  images.forEach((image, i) => file.set(image, TBU_SECTOR * (1 + i * 3)));
  return file;
}

const CLEAN = () =>
  buildTbu([
    { board: 0x20, bits: spartan6() },
    { board: 0x02, bits: series7(0x0362e093) },
    { board: 0x03, bits: series7(0x0362d093) },
    { board: 0x00, bits: [], share: 0 }
  ]);

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

  const { createTbuFileViewerPanel } = await import("@renderer/appIde/DocumentPanels/Next/TbuFileViewerPanel");
  render(
    createTbuFileViewerPanel({
      document: {
        id: "/sd/TBBLUE.TBU",
        name: "TBBLUE.TBU",
        type: "TbuViewer",
        path: "/sd/TBBLUE.TBU",
        node: { isFolder: false, name: "TBBLUE.TBU", fullPath: "/sd/TBBLUE.TBU", projectPath: "TBBLUE.TBU" }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument };
}

describe("TbuFileViewerPanel", () => {
  it("shows the file, the cores, the selected core and its bitstream", async () => {
    await renderViewer(CLEAN());
    expect(await screen.findByText("File")).toBeInTheDocument();
    expect(screen.getByText("No problems")).toBeInTheDocument();
    expect(screen.getByText("Multi-core")).toBeInTheDocument();
    expect(screen.getByText("4 of 32 records")).toBeInTheDocument();
    expect(screen.getByText("4 cores")).toBeInTheDocument();
    for (const board of ["Issue 2, variant 2", "Issue 4 (KS2)", "Issue 5 (KS3)", "Issue 2"]) {
      expect(screen.getAllByText(board).length).toBeGreaterThan(0);
    }
    // --- The first core is selected: a Spartan-6 image shared with record 4
    expect(screen.getByText("Core 1 · zxnext-2-30303.bin")).toBeInTheDocument();
    expect(screen.getAllByText("Same image as 4").length).toBeGreaterThan(0);
    const listing = screen.getByTestId("tbu-bitstream");
    expect(within(listing).getByText("IDCODE")).toBeInTheDocument();
    expect(within(listing).getByText("; XC6SLX16")).toBeInTheDocument();
    expect(within(listing).getByText("; DESYNC")).toBeInTheDocument();
    expect(screen.getByTestId("tbu-map")).toBeInTheDocument();
  });

  it("selects a core from the table", async () => {
    await renderViewer(CLEAN());
    fireEvent.click((await screen.findAllByText("Issue 4 (KS2)"))[0]);
    expect(await screen.findByText("Core 2 · zxnext-4-30303.bin")).toBeInTheDocument();
    expect(within(screen.getByTestId("tbu-bitstream")).getByText("; XC7A15T")).toBeInTheDocument();
  });

  it("says what is wrong with a damaged image", async () => {
    const data = CLEAN();
    data[TBU_SECTOR + 3 * TBU_SECTOR + 600] ^= 0x55;
    await renderViewer(data, { selected: 2 });
    expect(await screen.findByText("1 error")).toBeInTheDocument();
    expect(screen.getByText(/Core 2's checksum does not match/)).toBeInTheDocument();
    expect(screen.getByText(/stored, .* computed: the image is damaged/)).toBeInTheDocument();
  });

  it("refuses a file that is not a TBU", async () => {
    await renderViewer(new Uint8Array(1024));
    expect(await screen.findByText(/This is not a TBBLUE.TBU file/)).toBeInTheDocument();
  });

  it("opens the header and the image as memory dumps", async () => {
    const { openDocument } = await renderViewer(CLEAN());
    fireEvent.click(await screen.findByLabelText("Show the 512-byte header as a memory dump"));
    fireEvent.click(screen.getByLabelText("Show the image as a memory dump"));
    await vi.waitFor(() => expect(openDocument).toHaveBeenCalledTimes(2));
  });
});
