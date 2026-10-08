import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeDebugRecording, type DebugRecording } from "@common/debugRecording/debugRecordingFile";
import type { DebugRecordingCompatibility } from "@common/debugRecording/debugRecordingTypes";

/*
 * The debug recording viewer (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D19, Phase 3): the header,
 * the length, the note, breakpoints, media and sources - and whether this build opens it, which the
 * emulator answers when it runs the recording's core.
 */

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", { configurable: true, value: vi.fn(() => false) });
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

function recording(over: Partial<DebugRecording> = {}): DebugRecording {
  return {
    header: {
      machineId: "zxnext",
      modelId: "standard",
      machineName: "ZX Spectrum Next",
      kliveVersion: "0.64.0",
      coreId: "zxnext",
      fingerprint: "c0ffee".padEnd(32, "0"),
      codeHash: "abcdef12".padEnd(64, "0"),
      contractHash: "9".repeat(64),
      memorySize: 8192,
      pageSize: 4096,
      savedAt: "2026-10-08T10:00:00.000Z",
      base: { sequence: 1, sub: 1, phase: 0 },
      present: { sequence: 1_234_568, sub: 1, phase: 0 },
      frames: 618.5,
      seconds: 12.37,
      records: 1_234_567,
      keyframes: 25,
      sparse: true,
      pc: 0x6000
    },
    thumbnail: { width: 2, height: 2, rgba: new Uint8Array(16).fill(0x80) },
    pages: [new Uint8Array(4096)],
    keyframes: [
      { seed: { position: { sequence: 1, sub: 1, phase: 0 } }, frame: 0, journalIndex: 0, complete: true, pages: Int32Array.from([0, 0]) }
    ],
    journal: [],
    hits: [],
    present: { host: {}, frames: 618.5 },
    breakpoints: { schemaVersion: 1, breakpoints: [{ address: 0x8000, exec: true }, { address: 0x9000, memoryWrite: true }], watches: [{ symbol: "hl" }] },
    media: [{ id: "sdCard", fileName: "/c/ks2.cim", fingerprint: "f".repeat(32), size: 1, kind: "sd" }],
    sources: { mainFile: "code/main.asm", files: [{ path: "code/main.asm", sha256: "1".repeat(64), text: "nop" }, { path: "code/lib.asm", sha256: "2".repeat(64) }] },
    note: "Crashes after the second level",
    ...over
  };
}

async function renderViewer(contents: Uint8Array, compatibility: DebugRecordingCompatibility) {
  const checkDebugRecording = vi.fn(async () => compatibility);
  vi.doMock("@renderer/core/EmuApi", () => ({ useEmuApi: () => ({ checkDebugRecording }) }));
  vi.doMock("@renderer/core/MainApi", () => ({ useMainApi: () => ({ getAppVersion: async () => "0.64.0" }) }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) } })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({ setDocumentViewState: vi.fn(), getDocumentViewState: vi.fn(() => ({})), getDocumentApi: vi.fn(() => undefined) })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store: { getState: () => ({}), dispatch: vi.fn() }, messenger: {} }),
    useSelector: (selector: (state: any) => any) => selector({ theme: "dark" })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({ theme: { tone: "dark" }, getIcon: () => ({ width: 16, height: 16, path: "" }), getThemeProperty: () => "currentColor" }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/Icon", () => ({ Icon: () => <span /> }));
  vi.doMock("@renderer/controls/layout/Panel", () => ({ Panel: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
  vi.doMock("@renderer/controls/Next/ScreenCanvas", () => ({ ScreenCanvas: () => <div data-testid="screen" /> }));
  const { createDebugRecordingViewerPanel } = await import("@renderer/appIde/DocumentPanels/DebugRecording/DebugRecordingViewerPanel");
  render(
    createDebugRecordingViewerPanel({
      document: { id: "/p/bug.klr", name: "bug.klr", type: "DebugRecordingViewer", path: "/p/bug.klr" },
      contents,
      viewState: { fileExpanded: true, sourcesExpanded: true }
    } as any)
  );
  return { checkDebugRecording };
}

describe("DebugRecordingViewerPanel", () => {
  it("shows the machine, the build, the length, the note, breakpoints, media and sources", async () => {
    const bytes = await writeDebugRecording(recording());
    const { checkDebugRecording } = await renderViewer(bytes, { known: true });
    expect(await screen.findByText("ZX Spectrum Next")).toBeInTheDocument();
    expect(screen.getByText("Klive 0.64.0 (build abcdef12)")).toBeInTheDocument();
    expect(screen.getByText("12 s · 619 frames · 1,234,567 instructions")).toBeInTheDocument();
    expect(screen.getByText("25 (sparse: about a second apart)")).toBeInTheDocument();
    expect(screen.getByText("Crashes after the second level")).toBeInTheDocument();
    expect(screen.getByText("/c/ks2.cim")).toBeInTheDocument();
    expect(screen.getByText(/replays without the card/)).toBeInTheDocument();
    expect(screen.getByText(/every key typed/)).toBeInTheDocument();
    expect(screen.getByText("code/lib.asm")).toBeInTheDocument();
    expect(screen.getAllByText("Embedded:")).toHaveLength(1);
    expect(await screen.findByText(/Yes: this build made it/)).toBeInTheDocument();
    expect(checkDebugRecording).toHaveBeenCalledWith(expect.objectContaining({ coreId: "zxnext", codeHash: "abcdef12".padEnd(64, "0") }), "0.64.0");
    await screen.findByTestId("screen");
  });

  it("says when this build cannot replay it, and when it cannot tell yet", async () => {
    const bytes = await writeDebugRecording(recording());
    await renderViewer(bytes, { known: true, refusal: "The recording was recorded by Klive 0.60.0 (build 12345678); this build differs" });
    expect(await screen.findByText(/No\. The recording was recorded by Klive 0\.60\.0.*Its end state can still be opened/)).toBeInTheDocument();
    cleanup();
    vi.resetModules();
    await renderViewer(bytes, { known: false, liveCoreId: "sp48" });
    expect(await screen.findByText(/Not known yet: the emulator runs the sp48 core, not the zxnext core/)).toBeInTheDocument();
  });

  it("reports a file that is not a recording", async () => {
    await renderViewer(new Uint8Array([1, 2, 3]), { known: false });
    expect(await screen.findByText(/Not a valid Klive debug recording/)).toBeInTheDocument();
  });
});
