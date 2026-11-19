import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { withHeader } from "@common/diskfs/plus3dos";
import { scrAttrOffset, scrPixelOffset } from "@common/screenFiles/zxScreen";

/*
 * The screen file viewers (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`): one frame for every format. The
 * picture, the facts, the probe, the pinned pixel, the colour and FLASH highlights, the resolution
 * switch of an 80K Layer 2 file, and the error card.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const openDump = vi.fn();
vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn(), isOpen: () => false })
}));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ projectService: { saveFileContent: vi.fn(), getDocumentForProjectNode: vi.fn() } })
}));
vi.mock("@renderer/features/memory/StaticMemoryDump", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  openStaticMemoryDump: (...args: unknown[]) => openDump(...args)
}));
vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => ({ showItemInFolder: vi.fn(), showSaveFileDialog: vi.fn(), saveBinaryFile: vi.fn() })
}));

const panels = await import("@renderer/appIde/DocumentPanels/Next/ScreenFileViewerPanels");

const doc = (name: string) => ({ id: name, name, path: `/projects/demo/${name}`, node: { projectPath: name } }) as any;

/** A screen with pixel (8, 8) set, cell (1, 1) BRIGHT red INK on blue PAPER, and one FLASH cell (2, 2) */
function screenBytes(): Uint8Array {
  const scr = new Uint8Array(6912);
  for (let i = 0; i < 768; i++) scr[0x1800 + i] = 0x38; // --- PAPER 7, INK 0
  scr[scrPixelOffset(8, 8)] = 0x80;
  scr[scrAttrOffset(8, 8)] = 0x40 | (1 << 3) | 2;
  scr[scrAttrOffset(16, 16)] = 0x80 | 0x38;
  return scr;
}

function render(create: (props: any) => React.ReactElement, name: string, contents: Uint8Array, viewState: object = {}) {
  return renderWithProviders(create({ document: doc(name), contents, viewState }), { store: createMockStore() });
}

afterEach(() => {
  cleanup();
  openDump.mockReset();
});

describe("screen file viewer: .scr", () => {
  it("draws the picture and says what the file is", async () => {
    render(panels.createScrFileViewerPanel, "pic.scr", screenBytes());
    const canvas = (await screen.findByRole("img", { name: "ZX Spectrum screen" })) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 192]);
    expect(screen.getByText("256×192")).toBeTruthy();
    expect(screen.getByText("6,912 bytes")).toBeTruthy();
    expect(screen.queryByText("Header")).toBeNull();
  });

  it("shows a PLUS3DOS header's facts, and warns about a load address that is not the screen's", async () => {
    render(panels.createScrFileViewerPanel, "pic.scr", withHeader({ name: "PIC.SCR", kind: "code", data: screenBytes(), start: 0x8000 }));
    await screen.findByText("Header");
    expect(screen.getByText("PLUS3DOS, CODE")).toBeTruthy();
    expect(screen.getByText("$8000")).toBeTruthy();
    expect(screen.getByText(/loads the file at \$8000, not at the screen \(\$4000\)/)).toBeTruthy();
  });

  it("probes the pixel under the mouse, and pins it on a click", async () => {
    render(panels.createScrFileViewerPanel, "pic.scr", screenBytes(), { zoom: 1 });
    const canvas = await screen.findByRole("img", { name: "ZX Spectrum screen" });
    const host = canvas.parentElement!;
    host.getBoundingClientRect = () => ({ left: 0, top: 0, right: 256, bottom: 192, width: 256, height: 192, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.mouseMove(host, { clientX: 8.5, clientY: 8.5 });
    const strip = (await screen.findByText(/cell 1,1/)).closest("div")!;
    expect(strip.textContent).toContain("x 8 y 8");
    expect(strip.textContent).toContain("$4021 (+0021)");
    expect(strip.textContent).toContain("$5821");
    expect(strip.textContent).toContain("INK 2 PAPER 1 BRIGHT");
    fireEvent.click(host, { clientX: 8.5, clientY: 8.5 });
    await waitFor(() => expect(screen.getByText("pinned")).toBeTruthy());
    expect(screen.getByText("column 1, row 1")).toBeTruthy();
  });

  it("highlights a colour and the FLASH cells, and the toolbar chip stops it", async () => {
    render(panels.createScrFileViewerPanel, "pic.scr", screenBytes());
    await screen.findByRole("img", { name: "ZX Spectrum screen" });
    fireEvent.click(screen.getByTitle(/^bright red: INK in 1 cells/));
    expect(await screen.findByText("Highlight: bright red")).toBeTruthy();
    fireEvent.click(screen.getByText("Highlight: bright red"));
    await waitFor(() => expect(screen.queryByText("Highlight: bright red")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "highlight" }));
    expect(await screen.findByText("Highlight: FLASH cells")).toBeTruthy();
  });

  it("opens Show bytes at the pinned pixel's byte", async () => {
    render(panels.createScrFileViewerPanel, "pic.scr", screenBytes(), { pin: [8, 8] });
    await screen.findByText("pinned");
    fireEvent.click(screen.getByRole("button", { name: "Show bytes, at the pinned pixel's byte" }));
    expect(openDump).toHaveBeenCalledTimes(1);
    expect(openDump.mock.calls[0][4]).toEqual({ topAddress: 0x0020 });
  });

  it("puts a file of the wrong size on the error card, with Show bytes", async () => {
    render(panels.createScrFileViewerPanel, "bad.scr", new Uint8Array(7000));
    expect(await screen.findByText("This file cannot be shown as a screen")).toBeTruthy();
    expect(screen.getByText(/It is 7,000 bytes long\. A \.scr file is 6,912 bytes, or 7,040/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show bytes" }));
    expect(openDump).toHaveBeenCalledTimes(1);
  });
});

describe("screen file viewer: Layer 2", () => {
  it("shows a 48K file at 256×192 with the default palette", async () => {
    render(panels.createLayer2FileViewerPanel, "pic.sl2", new Uint8Array(49152));
    const canvas = (await screen.findByRole("img", { name: "Layer 2 picture" })) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 192]);
    expect(screen.getByText("Layer 2 · Next default palette")).toBeTruthy();
  });

  it("switches an 80K file between 320×256 and 640×256, labels a file's palette, and shows one palette row at 4 bits", async () => {
    render(panels.createLayer2FileViewerPanel, "pic.nxi", new Uint8Array(512 + 81920));
    const canvas = () => screen.getByRole("img", { name: "Layer 2 picture" }) as HTMLCanvasElement;
    await screen.findByRole("img", { name: "Layer 2 picture" });
    expect(screen.getByText("Layer 2 · palette from the file")).toBeTruthy();
    expect(canvas().width).toBe(320);
    expect(screen.getByText("1 of 256")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "640×256" }));
    await waitFor(() => expect(canvas().width).toBe(640));
    expect(screen.getByText("1 of 16")).toBeTruthy();
  });

  it("explains a wrong size", async () => {
    render(panels.createLayer2FileViewerPanel, "pic.sl2", new Uint8Array(100));
    expect(await screen.findByText(/It is 100 bytes long\. A Layer 2 picture is 49,152 bytes/)).toBeTruthy();
  });
});

describe("screen file viewer: LoRes and the Timex modes", () => {
  it("names a NextZXOS LAYER header and shows no load address for it", async () => {
    // --- What NextZXOS's SAVE ... LAYER writes for a LAYER 1 picture: type 4, load address 0
    const bytes = withHeader({ name: "PIC.SLR", kind: "code", data: new Uint8Array(12288), start: 0 });
    bytes[15] = 4;
    let sum = 0;
    for (let i = 0; i < 127; i++) sum = (sum + bytes[i]) & 0xff;
    bytes[127] = sum;
    render(panels.createSlrFileViewerPanel, "pic.slr", bytes);
    expect(await screen.findByText("PLUS3DOS, LAYER 1")).toBeTruthy();
    expect(screen.queryByText("Load address")).toBeNull();
    expect(screen.queryByText(/not at the screen/)).toBeNull();
  });

  it("draws a LoRes picture with the ULA palette, or RGB332 on request", async () => {
    render(panels.createSlrFileViewerPanel, "pic.slr", new Uint8Array(12288));
    const canvas = (await screen.findByRole("img", { name: "LoRes screen" })) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([128, 96]);
    expect(screen.getByText("the Next's ULA palette (none in the file)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RGB332" }));
    expect(await screen.findByText("RGB332 (none in the file)")).toBeTruthy();
  });

  it("draws hi-colour at 256×192 and hi-res at 512×192 with an ink choice", async () => {
    render(panels.createShcFileViewerPanel, "pic.shc", new Uint8Array(12288));
    expect(((await screen.findByRole("img", { name: "Timex hi-colour screen" })) as HTMLCanvasElement).width).toBe(256);
    cleanup();
    render(panels.createShrFileViewerPanel, "pic.shr", new Uint8Array(12288));
    expect(((await screen.findByRole("img", { name: "Timex hi-res screen" })) as HTMLCanvasElement).width).toBe(512);
    fireEvent.click(screen.getByTitle("INK 1 (blue) on PAPER 6 (yellow)"));
    expect(await screen.findByText(/INK 1 \(blue\) on PAPER 6 \(yellow\), chosen in the toolbar/)).toBeTruthy();
  });
});
