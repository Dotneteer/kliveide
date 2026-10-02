import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync, zipSync } from "fflate";

/*
 * The `.z88` viewer panel (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8, Phase 5): its sections, the
 * loadability report, the "at PC" dumps, and the Slots browser with its bank pop-outs
 * (`.plans/Z88_SLOT_BROWSER_PLAN.md`). The values it computes are tested without a DOM in
 * `test/z88/snapshot/z88-snapshot-view.test.ts`.
 */

const SAMPLE = new Uint8Array(
  readFileSync(join(__dirname, "../z88/snapshot/fixtures/mm+jsw-oz5.z88"))
);

function sampleWithSetting(key: string, value: string): Uint8Array {
  const entries = unzipSync(SAMPLE);
  const text = new TextDecoder("latin1").decode(entries["snapshot.settings"]);
  entries["snapshot.settings"] = new TextEncoder().encode(
    text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
  );
  return zipSync(entries);
}

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
  // --- jsdom has no object URLs; the LCD picture needs one
  URL.createObjectURL = vi.fn(() => "blob:lcd");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderViewer(
  contents: Uint8Array,
  viewState: Record<string, unknown> = {},
  { openIds = [] as string[] } = {}
) {
  const openDocument = vi.fn(() => Promise.resolve());
  const setActiveDocument = vi.fn();
  const setDocumentViewState = vi.fn();
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
      isOpen: vi.fn((id: string) => openIds.includes(id)),
      setActiveDocument,
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

  const { createZ88SnapshotViewerPanel } = await import(
    "@renderer/appIde/DocumentPanels/Z88/Z88SnapshotViewerPanel"
  );
  render(
    createZ88SnapshotViewerPanel({
      document: {
        id: "/project/mm.z88",
        name: "mm.z88",
        type: "Z88SnapshotViewer",
        path: "/project/mm.z88",
        node: { isFolder: false, name: "mm.z88", fullPath: "/project/mm.z88", projectPath: "mm.z88" }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument, setActiveDocument, setDocumentViewState, recordJump };
}

describe("Z88SnapshotViewerPanel", () => {
  it("shows every section of the sample", async () => {
    await renderViewer(SAMPLE);
    expect(await screen.findByText("Snapshot")).toBeInTheDocument();
    for (const heading of [
      "Z80 Registers",
      "Blink",
      "Address Space at PC",
      "Slots",
      "Breakpoints (0)"
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    // --- Each card is a group header in the Slots list: its title, then type, size and loading
    const list = screen.getByRole("listbox", { name: "Bank list" });
    for (const [title, meta] of [
      ["Slot 0: ROM area", "AMD Flash (29F), 512K · loads as AMDF29F040B"],
      ["Slot 0: internal RAM", "RAM, 128K · loads as internal RAM"],
      ["Slot 2", "UV EPROM (27C), 32K · loads as EPROMUV32"],
      ["Slot 3", "UV EPROM (27C), 32K · loads as EPROMUV32"]
    ]) {
      expect(within(list).getByText(title)).toBeInTheDocument();
      expect(within(list).getAllByText(meta).length).toBeGreaterThan(0);
    }
    // --- Slots 2 and 3 hold the same kind of card
    expect(within(list).getAllByText("UV EPROM (27C), 32K · loads as EPROMUV32")).toHaveLength(2);
  });

  it("shows the registers, the Blink bits and where PC is", async () => {
    await renderViewer(SAMPLE);
    expect(await screen.findByText("$F523 (62755)")).toBeInTheDocument();
    expect(screen.getByText("$05 (RAMS LCDON)")).toBeInTheDocument();
    expect(screen.getByText("$F523 = bank $BF, offset $3523")).toBeInTheDocument();
    expect(screen.getByText("bank $21 (RAM), upper 8K")).toBeInTheDocument();
    expect(screen.getByText("bank $BF (Slot 2)")).toBeInTheDocument();
    expect(screen.getByText("640 x 64 pixels")).toBeInTheDocument();
  });

  it("lists the archive's members one per row, so a long list cannot widen the viewer", async () => {
    await renderViewer(SAMPLE);
    expect(await screen.findByText("Contents:")).toBeInTheDocument();
    for (const member of ["rom.bin (524288 bytes)", "ram.bin (131072 bytes)", "slot2.bin (32768 bytes)"]) {
      expect(screen.getByText(member)).toBeInTheDocument();
    }
  });

  it("shows the LCD picture the file carries", async () => {
    await renderViewer(SAMPLE);
    const picture = await screen.findByAltText("The LCD when the snapshot was saved");
    expect(picture.getAttribute("src")).toBe("blob:lcd");
  });

  it("says why a snapshot cannot be loaded, and still shows it", async () => {
    await renderViewer(sampleWithSetting("SLOT0TYPE", "2"));
    expect(
      await screen.findByText("Slot 0: a 512K RAM card is not supported in slot 0")
    ).toBeInTheDocument();
    expect(screen.getByText("Z80 Registers")).toBeInTheDocument();
    expect(screen.getByText("RAM, 512K · not supported in slot 0")).toBeInTheDocument();
  });

  it("reports a file that is not a snapshot", async () => {
    await renderViewer(new Uint8Array([1, 2, 3]));
    expect(await screen.findByText(/^Invalid Z88 snapshot: Not a ZIP archive/)).toBeInTheDocument();
  });

  it("opens the 64K at PC as a disassembly", async () => {
    const { openDocument } = await renderViewer(SAMPLE);
    fireEvent.click(await screen.findByRole("button", { name: "Disassembly at PC" }));
    expect(openDocument).toHaveBeenCalledTimes(1);
    const [doc, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc).toMatchObject({ id: "memoryDump-z88Snapshotmm.z88", name: "mm.z88 - 64K at PC" });
    expect(doc.contents).toHaveLength(0x1_0000);
    expect(viewState).toMatchObject({
      disassemblyEnabled: true,
      disassOffset: 0,
      viewMode: "disassembly",
      topAddress: 0xf523,
      disassemblyFlavor: "z88"
    });
  });

  it("opens the 64K at PC as a memory dump", async () => {
    const { openDocument } = await renderViewer(SAMPLE);
    fireEvent.click(await screen.findByRole("button", { name: "Memory dump at PC" }));
    const [, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(viewState).toMatchObject({ viewMode: "memory", topAddress: 0xf523 });
  });

  it("lists every card's banks in the Slots browser, and shows the selected one's details", async () => {
    await renderViewer(SAMPLE, { selectedBank: 0x81 });
    const list = await screen.findByRole("listbox", { name: "Bank list" });
    expect(within(list).getAllByRole("option")).toHaveLength(32 + 8 + 2 + 2);
    expect(screen.getByText("44 banks · 704 KB · 4 paged in")).toBeInTheDocument();
    const row = within(list).getAllByRole("option").find((r) => r.dataset.bank === String(0x81))!;
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(within(row).getByText("PC $F523")).toBeInTheDocument();
    expect(within(row).getByText("SR3")).toBeInTheDocument();
    const details = screen.getByRole("complementary", { name: "Bank $81 details" });
    expect(within(details).getByText("SR3: $C000-$FFFF")).toBeInTheDocument();
    expect(within(details).getByText("$83, $85, ... $BF (31 banks)")).toBeInTheDocument();
  });

  it("remembers the selected bank and the filter", async () => {
    const { setDocumentViewState } = await renderViewer(SAMPLE);
    const list = await screen.findByRole("listbox", { name: "Bank list" });
    fireEvent.click(within(list).getAllByRole("option").find((r) => r.dataset.bank === "128")!);
    fireEvent.click(screen.getByRole("button", { name: "Paged in" }));
    await waitFor(() =>
      expect(setDocumentViewState).toHaveBeenLastCalledWith(
        "/project/mm.z88",
        expect.objectContaining({ selectedBank: 0x80, slotFilter: "pagedIn" })
      )
    );
  });

  it("pops a bank out as Z88 code, where the snapshot pages it, recorded for Go Back", async () => {
    const { openDocument, recordJump, setDocumentViewState } = await renderViewer(SAMPLE, {
      selectedBank: 0x80
    });
    fireEvent.click(await screen.findByRole("button", { name: "Pop out in Disassembly" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalledTimes(1));
    expect(recordJump).toHaveBeenCalledWith("z88Bank", expect.any(Function));
    const [doc, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    // --- Keyed by the full path; titled by the project-relative one
    expect(doc).toMatchObject({
      id: "memoryDump-z88BankDump/project/mm.z88:128",
      name: "mm.z88 - Bank $80"
    });
    expect(doc.contents).toHaveLength(0x4000);
    // --- SR2 = $BE pages bank $80 (the 32K card is mirrored across slot 2) at $8000
    expect(viewState).toMatchObject({
      disassemblyEnabled: true,
      disassOffset: 0x8000,
      viewMode: "disassembly",
      disassemblyFlavor: "z88"
    });
    expect(setDocumentViewState).toHaveBeenCalledWith(
      "/project/mm.z88",
      expect.objectContaining({ bankView: { [0x80]: "disassembly" } })
    );
  });

  it("pops RAM out as memory by default, and focuses a bank already open", async () => {
    const id = "memoryDump-z88BankDump/project/mm.z88:32";
    const { openDocument, setActiveDocument } = await renderViewer(
      SAMPLE,
      { selectedBank: 0x20 },
      { openIds: [id] }
    );
    fireEvent.click(await screen.findByRole("button", { name: "Pop out in Memory" }));
    await waitFor(() => expect(setActiveDocument).toHaveBeenCalledWith(id));
    expect(openDocument).not.toHaveBeenCalled();
  });
});
