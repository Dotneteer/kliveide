import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync, zipSync } from "fflate";

/*
 * The `.z88` viewer panel (`.plans/Z88_SNAPSHOT_PLAN.md` §4.8, Phase 5): its sections, the
 * loadability report, and the "at PC" dumps. The values it computes are tested without a DOM in
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

async function renderViewer(contents: Uint8Array, viewState: Record<string, unknown> = {}) {
  const openDocument = vi.fn(() => Promise.resolve());
  const memoryViewers: Record<string, unknown>[] = [];

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) }
    })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState: vi.fn(),
      getDocument: vi.fn(() => undefined),
      isOpen: vi.fn(() => false),
      setActiveDocument: vi.fn(),
      openDocument
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store: { getState: () => ({}), dispatch: vi.fn() }, messenger: {} }),
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
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }));
  vi.doMock("@renderer/controls/Dropdown", () => ({
    default: ({ options, initialValue }: { options: { value: string }[]; initialValue: string }) => (
      <span data-testid="bank-dropdown" data-value={initialValue} data-count={options.length} />
    )
  }));
  vi.doMock("@renderer/controls/memory/MemoryDumpViewer", () => ({
    MemoryDumpViewer: (props: Record<string, unknown>) => {
      memoryViewers.push(props);
      return <div data-testid={`memory-viewer-${props.bank}`} data-offset={props.disassOffset} />;
    }
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
  return { openDocument, memoryViewers };
}

describe("Z88SnapshotViewerPanel", () => {
  it("shows every section of the sample", async () => {
    await renderViewer(SAMPLE);
    expect(await screen.findByText("Snapshot")).toBeInTheDocument();
    for (const heading of [
      "Z80 Registers",
      "Blink",
      "Address Space at PC",
      "Slot 0: ROM area: AMD Flash (29F), 512K",
      "Slot 0: internal RAM: RAM, 128K",
      "Slot 2: UV EPROM (27C), 32K",
      "Slot 3: UV EPROM (27C), 32K",
      "Breakpoints (0)"
    ]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    expect(screen.getByText("loads as AMDF29F040B")).toBeInTheDocument();
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
    expect(screen.getByText("not supported in slot 0")).toBeInTheDocument();
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
      topAddress: 0xf523
    });
  });

  it("opens the 64K at PC as a memory dump", async () => {
    const { openDocument } = await renderViewer(SAMPLE);
    fireEvent.click(await screen.findByRole("button", { name: "Memory dump at PC" }));
    const [, viewState] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(viewState).toMatchObject({ viewMode: "memory", topAddress: 0xf523 });
  });

  it("shows a card's selected bank, disassembled where the snapshot pages it", async () => {
    const { memoryViewers } = await renderViewer(SAMPLE, {
      cardExpanded: { slot2: true },
      cardBank: { slot2: 0x80 }
    });
    await screen.findByText("Snapshot");
    expect(screen.getByTestId("bank-dropdown").dataset.value).toBe(String(0x80));
    // --- SR2 = $BE pages bank $80 (the 32K card is mirrored across slot 2) at $8000
    const viewer = memoryViewers.find((props) => props.bank === 0x80)!;
    expect(viewer).toMatchObject({ allowDisassembly: true, disassOffset: 0x8000 });
    expect((viewer.contents as Uint8Array).length).toBe(0x4000);
  });
});
