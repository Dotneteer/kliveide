import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

/*
 * The `.sl2` / `.nxi` viewer (`.plans/LAYER2_INSPECTOR_PLAN.md` Phase 7): a 48K file is 256×192, an
 * 80K one offers 320×256 and 640×256, the palette's source is labelled, and a wrong size is an error.
 */

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn() })
}));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ projectService: { saveFileContent: vi.fn(), getDocumentForProjectNode: vi.fn() } })
}));
vi.mock("@renderer/controls/layout/Panel", () => ({
  Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));

const { createLayer2FileViewerPanel } = await import("@renderer/appIde/DocumentPanels/Next/Layer2FileViewerPanel");

const doc = { id: "pic.sl2", node: { projectPath: "pic.sl2" } } as any;

afterEach(() => cleanup());

describe("Layer 2 picture viewer", () => {
  it("shows a 48K file at 256×192 with the default palette", async () => {
    renderWithProviders(createLayer2FileViewerPanel({ document: doc, contents: new Uint8Array(49152), viewState: {} } as any), { store: createMockStore() });
    await waitFor(() => expect(screen.getByRole("img", { name: "Layer 2 picture" })).toBeTruthy());
    expect(screen.getByText("256×192")).toBeTruthy();
    expect(screen.getByText("default Layer 2 palette (the file has none)")).toBeTruthy();
    const canvas = screen.getByRole("img", { name: "Layer 2 picture" }) as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([256, 192]);
  });

  it("switches an 80K file between 320×256 and 640×256, and labels a file's palette", async () => {
    renderWithProviders(createLayer2FileViewerPanel({ document: doc, contents: new Uint8Array(512 + 81920), viewState: {} } as any), { store: createMockStore() });
    await waitFor(() => expect(screen.getByRole("img", { name: "Layer 2 picture" })).toBeTruthy());
    expect(screen.getByText("palette from the file")).toBeTruthy();
    const canvas = () => screen.getByRole("img", { name: "Layer 2 picture" }) as HTMLCanvasElement;
    expect(canvas().width).toBe(320);
    fireEvent.click(screen.getByRole("button", { name: "640×256" }));
    await waitFor(() => expect(canvas().width).toBe(640));
  });

  it("explains a wrong size", async () => {
    renderWithProviders(createLayer2FileViewerPanel({ document: doc, contents: new Uint8Array(100), viewState: {} } as any), { store: createMockStore() });
    await waitFor(() => expect(screen.getByText(/Invalid file size \(100 bytes\)/)).toBeTruthy());
  });
});
