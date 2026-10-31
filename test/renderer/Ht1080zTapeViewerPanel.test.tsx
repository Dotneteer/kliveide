import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHt1080zCmd } from "@common/ht1080z/cmdFile";
import { basToBasicTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import { buildTvcCasFile } from "@emu/machines/tvc/TvcCasFile";

/*
 * The HT-1080Z tape file viewer (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D5): a `.cas`, a `.cmd` and a
 * tokenised `.bas` in the panel - the summary, the graphics, the parts, the details and the pop-outs.
 * The model is tested without a DOM in `test/ht1080z/tape-view.test.ts`.
 */

const DEMO = new Uint8Array(readFileSync(join(__dirname, "../../scripts/doc-shots/recipes/ht1080z-demo.bas")));
const DEMO_CAS = basToBasicTape(DEMO, "D");
const CODE = [0x21, 0x00, 0x3c, 0x36, 0x48, 0xc9];
const HELLO_CMD = buildHt1080zCmd([{ startAddress: 0x7000, emittedCode: CODE }], 0x7000, "HELLO");

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

async function renderViewer(
  name: string,
  contents: Uint8Array,
  viewState: Record<string, unknown> = {},
  emulatorState: Record<string, unknown> = {}
) {
  const openDocument = vi.fn(() => Promise.resolve());
  const setDocumentViewState = vi.fn();
  const recordJump = vi.fn(async (_reason: string, jump: () => unknown) => await jump());

  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { getDocumentForProjectNode: vi.fn(() => Promise.resolve({})) },
      navigationHistoryService: { recordJump },
      machineService: { getMachineInfo: () => undefined }
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
    useRendererContext: () => ({
      store: { getState: () => ({}), dispatch: vi.fn() },
      messenger: {}
    }),
    useSelector: (selector: (state: any) => any) =>
      selector({ theme: "dark", isWindows: false, project: { folderPath: "/project" }, emulatorState })
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

  const { createHt1080zTapeViewerPanel } =
    await import("@renderer/appIde/DocumentPanels/Ht1080zTape/Ht1080zTapeViewerPanel");
  render(
    createHt1080zTapeViewerPanel({
      document: {
        id: `/project/${name}`,
        name,
        type: "Ht1080zTapeViewer",
        path: `/project/${name}`,
        node: { isFolder: false, name, fullPath: `/project/${name}`, projectPath: name }
      },
      contents,
      viewState
    } as any)
  );
  return { openDocument, setDocumentViewState, recordJump };
}

describe("Ht1080zTapeViewerPanel", () => {
  it("shows a BASIC tape: summary, timeline, parts and the program's listing", async () => {
    await renderViewer("demo.cas", DEMO_CAS);
    const summary = await screen.findByLabelText("File summary");
    expect(within(summary).getByText("CAS · BASIC program tape")).toBeInTheDocument();
    expect(within(summary).getByText('"D"')).toBeInTheDocument();
    expect(within(summary).getByText("16K and 48K models")).toBeInTheDocument();

    const list = screen.getByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(5);
    expect(within(list).getByText('BASIC program "D"')).toBeInTheDocument();
    expect(within(list).getByText('CLOAD "D"')).toBeInTheDocument();
    expect(screen.getByTestId("ht-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("ht-memory-map")).toBeInTheDocument();

    // --- The program is selected first, and listed with its keywords picked out
    const details = screen.getByRole("complementary", { name: "#3 details" });
    const listing = within(details).getByTestId("ht-tape-listing");
    expect(listing.children).toHaveLength(6);
    expect(listing.textContent).toMatch(/^10 /);
    expect(listing.querySelector("span.keyword, [class*='keyword']")).not.toBeNull();
  });

  it("pops the program out as an HT listing in the character set shown", async () => {
    const { openDocument } = await renderViewer("demo.cas", DEMO_CAS, {}, { machineId: "ht1080z", config: { htModel: "s1" } });
    // --- An HT runs: its model decides the characters
    expect((await screen.findByRole("button", { name: "Series I" })).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pop out the listing" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.type).toBe("TapeBlockViewer");
    expect(state).toMatchObject({ view: "basic", format: "ht1080z", htCharSet: "s1" });
    // --- The program is relinked at 42E9h, and ends with a 0000h link
    expect(doc.contents[0] | (doc.contents[1] << 8)).toBeGreaterThan(0x42e9);
    expect(Array.from(doc.contents.slice(-2))).toEqual([0, 0]);
  });

  it("remembers the character set picked for the document", async () => {
    const { setDocumentViewState } = await renderViewer("demo.cas", DEMO_CAS);
    const series2 = await screen.findByRole("button", { name: "Series II" });
    expect(series2.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "/64" }));
    await waitFor(() =>
      expect(setDocumentViewState).toHaveBeenLastCalledWith("/project/demo.cas", expect.objectContaining({ charSet: "s64" }))
    );
    expect(screen.getByRole("button", { name: "/64" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a .cmd's records, where its code loads, and the record's bytes", async () => {
    await renderViewer("hello.cmd", HELLO_CMD);
    const summary = await screen.findByLabelText("File summary");
    expect(within(summary).getByText("CMD · load module")).toBeInTheDocument();
    expect(within(summary).getByText("$7000")).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(within(list).getByText("$7000–$7005")).toBeInTheDocument();
    expect(screen.queryByTestId("ht-timeline")).toBeNull();
    const block = screen.getByTestId("ht-memory-map").querySelector("[data-index='1']") as HTMLElement;
    expect(block.style.left).toBe(`${(0x7000 / 0x10000) * 100}%`);

    const details = screen.getByRole("complementary", { name: "#1 details" });
    expect(within(details).getByText("Every model: it loads below $8000")).toBeInTheDocument();
    const strip = within(details).getByTestId("ht-tape-bytes-strip");
    // --- Type 01, length 08 (the address and six bytes), address 7000h, the code
    expect(strip.textContent).toBe("01" + "08" + "0070" + "21003C3648C9");
  });

  it("selects the record that holds the start address from the summary, clearing a filter", async () => {
    await renderViewer("hello.cmd", HELLO_CMD, { partFilter: "loads" });
    const list = await screen.findByRole("listbox", { name: "Part list" });
    // --- The Loads filter hides the transfer record
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "$7000" }));
    expect(await screen.findByRole("complementary", { name: "#2 details" })).toBeInTheDocument();
    expect(within(list).getAllByRole("option")).toHaveLength(3);
  });

  it("leaves the start address plain when no record holds it", async () => {
    await renderViewer("demo.cas", DEMO_CAS);
    const summary = await screen.findByLabelText("File summary");
    expect(within(summary).queryByRole("button", { name: /^\$/ })).toBeNull();
  });

  it("pops a load block out as a disassembly at its address", async () => {
    const { openDocument } = await renderViewer("hello.cmd", HELLO_CMD);
    fireEvent.click(await screen.findByRole("button", { name: "Pop out in Disassembly" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.type).toBe("StaticMemoryDumpViewer");
    expect(Array.from(doc.contents)).toEqual(CODE);
    expect(state).toMatchObject({ disassOffset: 0x7000, viewMode: "disassembly" });
  });

  it("pops the file's own bytes out", async () => {
    const { openDocument } = await renderViewer("hello.cmd", HELLO_CMD);
    fireEvent.click(await screen.findByRole("button", { name: "Pop out the file's bytes" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc] = openDocument.mock.calls[0] as unknown as [any];
    expect(Array.from(doc.contents)).toEqual(Array.from(HELLO_CMD));
  });

  it("shows a .bas line by line, with the line's bytes and its keyword tokens", async () => {
    await renderViewer("demo.bas", DEMO);
    const list = await screen.findByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(7);
    expect(screen.getByTestId("ht-line-strip")).toBeInTheDocument();
    const details = screen.getByRole("complementary", { name: "#0 details" });
    expect(within(details).getByText("Line bytes")).toBeInTheDocument();
    const strip = within(details).getByTestId("ht-tape-bytes-strip");
    expect(strip.querySelector("[class*='token']")).not.toBeNull();
  });

  it("explains why a text .bas cannot be shown", async () => {
    await renderViewer("game.bas", new TextEncoder().encode('10 PRINT "HI"\n'));
    expect(await screen.findByText(/BASIC source text, not a tokenised HT-1080Z program/)).toBeInTheDocument();
  });
});

/** 10 PRINT 42 as TVC BASIC stores it, the closing 00h, and three bytes of code */
const TVC_CAS = buildTvcCasFile(Uint8Array.from([0x08, 0x0a, 0x00, 0xdd, 0x20, 0x34, 0x32, 0xff, 0x00, 0x3e, 0x01, 0xc9]), 0x01, true);

describe("Ht1080zTapeViewerPanel - a Videoton TVC .cas", () => {
  it("recognises the TVC's format whatever machine runs, and shows its parts and listing", async () => {
    await renderViewer("hello.cas", TVC_CAS, {}, { machineId: "sp48" });
    const summary = await screen.findByLabelText("File summary");
    expect(within(summary).getByText("CAS · Videoton TVC tape")).toBeInTheDocument();
    expect(within(summary).getByText("Program (01h)")).toBeInTheDocument();
    expect(within(summary).getByText("Runs after loading")).toBeInTheDocument();
    expect(screen.queryByText(/No HT-1080Z file follows the sync byte/)).toBeNull();

    const list = screen.getByRole("listbox", { name: "Part list" });
    expect(within(list).getAllByRole("option")).toHaveLength(4);
    expect(within(list).getByText('LOAD "HELLO"')).toBeInTheDocument();
    expect(screen.getByTestId("ht-memory-map")).toBeInTheDocument();

    // --- The program is selected first and listed
    const details = screen.getByRole("complementary", { name: "#2 details" });
    expect(within(details).getByTestId("tvc-tape-listing").textContent).toMatch(/^10\s*PRINT\s42/);
  });

  it("pops the program out as a TVC listing", async () => {
    const { openDocument } = await renderViewer("hello.cas", TVC_CAS);
    fireEvent.click(await screen.findByRole("button", { name: "Pop out the listing" }));
    await waitFor(() => expect(openDocument).toHaveBeenCalled());
    const [doc, state] = openDocument.mock.calls[0] as unknown as [any, any];
    expect(doc.type).toBe("TapeBlockViewer");
    expect(state).toMatchObject({ view: "basic", format: "tvc", basicEnd: 9 });
  });

  it("explains a .cas in neither format", async () => {
    await renderViewer("notes.cas", new TextEncoder().encode("hello"));
    expect(await screen.findByText(/neither a Videoton TVC tape/)).toBeInTheDocument();
  });
});
