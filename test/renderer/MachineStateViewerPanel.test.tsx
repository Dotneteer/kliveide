import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeKliveStateFile, type KliveStateFile } from "@common/machineState/kliveStateFile";

/*
 * The Klive state viewer (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.9, Phase 8): the
 * header, the thumbnail, the media and the portable part, from a file read without its image.
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

function stateFile(over: Partial<KliveStateFile> = {}): Uint8Array {
  return writeKliveStateFile({
    header: {
      machineId: "zxnext",
      modelId: "standard",
      kliveVersion: "0.62.1",
      coreId: "zxnext",
      fingerprint: "c0ffee".padEnd(32, "0"),
      memorySize: 1024,
      savedAt: "2026-10-04T10:00:00.000Z",
      pc: 0x6000,
      machineName: "ZX Spectrum Next"
    },
    thumbnail: { width: 2, height: 2, rgba: new Uint8Array(16).fill(0x80) },
    image: new Uint8Array(1024),
    host: {},
    media: [{ id: "sdCard", fileName: "/c/ks2.cim", fingerprint: "f".repeat(32), size: 1 }],
    ...over
  });
}

async function renderViewer(contents: Uint8Array) {
  const screens: Uint8Array[] = [];
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) }
    })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({
      setDocumentViewState: vi.fn(),
      getDocumentViewState: vi.fn(() => ({})),
      getDocumentApi: vi.fn(() => undefined)
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store: { getState: () => ({}), dispatch: vi.fn() }, messenger: {} }),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark" })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({
      theme: { tone: "dark" },
      getIcon: () => ({ width: 16, height: 16, path: "" }),
      getThemeProperty: () => "currentColor"
    }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/Icon", () => ({ Icon: () => <span /> }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }));
  vi.doMock("@renderer/controls/Next/ScreenCanvas", () => ({
    ScreenCanvas: ({ data }: { data: Uint8Array }) => {
      screens.push(data);
      return <div data-testid="screen" />;
    }
  }));
  const { createMachineStateViewerPanel } = await import(
    "@renderer/appIde/DocumentPanels/MachineState/MachineStateViewerPanel"
  );
  render(
    createMachineStateViewerPanel({
      document: { id: "/p/s.kls", name: "s.kls", type: "MachineStateViewer", path: "/p/s.kls" },
      contents,
      viewState: { fileExpanded: true }
    } as any)
  );
  return { screens };
}

describe("MachineStateViewerPanel", () => {
  it("shows the machine, the version, PC, the media and the thumbnail", async () => {
    const { screens } = await renderViewer(stateFile());
    expect(await screen.findByText("ZX Spectrum Next")).toBeInTheDocument();
    expect(screen.getByText("Klive 0.62.1")).toBeInTheDocument();
    expect(screen.getByText("$6000")).toBeInTheDocument();
    expect(screen.getByText("/c/ks2.cim")).toBeInTheDocument();
    expect(screen.getByText(/Loads only into a Klive whose core is unchanged/)).toBeInTheDocument();
    expect(screen.getByText("zxnext / standard")).toBeInTheDocument();
    await screen.findByTestId("screen");
    expect(screens.at(-1)).toEqual(new Uint8Array(16).fill(0x80));
  });

  it("says when a portable .szx part is there, and that disks are detached", async () => {
    await renderViewer(
      stateFile({
        szx: new Uint8Array([1]),
        media: [{ id: "diskA", fileName: "/d/a.dsk" }]
      })
    );
    expect(await screen.findByText(/from its .szx part/)).toBeInTheDocument();
    expect(screen.getByText(/detached from these files/)).toBeInTheDocument();
  });

  it("reports a file that is not a state", async () => {
    await renderViewer(new Uint8Array([1, 2, 3]));
    expect(await screen.findByText(/Not a valid Klive state file/)).toBeInTheDocument();
  });
});
