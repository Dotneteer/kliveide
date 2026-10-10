import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * The ROM annotation editor (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R4, R7, §4.1): a selected ROM
 * sidecar is matched to its ROM, its pages open as bank documents that edit it, and a file with no
 * matching ROM is only a message.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const SHIPPED_TEXT = readFileSync(join(ROMS, "sp48.rom.dis"), "utf8");
const WORKING = "/home/me/Klive/RomAnnotations/sp48.rom.dis";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

async function renderEditor(path: string, files: Record<string, string>) {
  vi.resetModules();
  const opened: any[] = [];
  const projectService = {
    readFileContent: vi.fn(async (file: string) => {
      if (files[file] === undefined) throw new Error("File does not exist");
      return files[file];
    }),
    saveFileContent: vi.fn(async () => {})
  };
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ projectService })
  }));
  vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
    useDocumentHubService: () => ({})
  }));
  const mainApi = {
    readTextFile: vi.fn(async (file: string) => readFileSync(join(ROMS, file.replace(/^roms\//, "")), "utf8")),
    readBinaryFile: vi.fn(async (file: string) => {
      if (file.startsWith("roms/")) return new Uint8Array(readFileSync(join(ROMS, file.slice(5))));
      throw new Error("no such file");
    })
  };
  vi.doMock("@renderer/core/MainApi", () => ({ useMainApi: () => mainApi }));
  vi.doMock("@renderer/core/EmuApi", () => ({
    useEmuApi: () => ({ getRomSources: async () => ({}) })
  }));
  vi.doMock("@renderer/features/memory/StaticMemoryDump", () => ({
    openStaticMemoryDump: vi.fn(async (...args: any[]) => {
      opened.push(args);
    })
  }));
  const { resetRomAnnotationCachesForTests } = await import("@renderer/appIde/annotations/romAnnotationLoader");
  resetRomAnnotationCachesForTests();
  const { createRomAnnotationEditorPanel } = await import(
    "@renderer/appIde/DocumentPanels/Rom/RomAnnotationEditorPanel"
  );
  render(
    createRomAnnotationEditorPanel({
      document: { id: "x", name: "x", type: "RomAnnotationEditor" } as any,
      viewState: { sidecarPath: path }
    })
  );
  return { opened };
}

describe("the ROM annotation editor", () => {
  it("lists a working copy's pages, says it is ready to ship, and opens a page to edit", async () => {
    const { opened } = await renderEditor(WORKING, { [WORKING]: SHIPPED_TEXT });
    await waitFor(() => expect(screen.getByText(/Ready to ship · level/)).toBeInTheDocument());
    expect(screen.getByText("Working copy — edits are written here")).toBeInTheDocument();
    expect(screen.getByText("Page 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disassembly" }));
    await waitFor(() => expect(opened).toHaveLength(1));
    const [, id, , bytes, options] = opened[0];
    expect(id).toBe(`rom:${WORKING}:0`);
    expect(bytes.length).toBe(0x4000);
    expect(options).toMatchObject({
      disassemblyEnabled: true,
      disassOffset: 0,
      viewMode: "disassembly",
      annotationPath: WORKING,
      annotationBank: 0,
      annotationMachine: "rom",
      disassemblyFlavor: "rom",
      romPageKind: "sp48-basic"
    });
    expect(options.annotationReadOnly).toBeUndefined();
  });

  it("lists the problems that keep a file from being shipped", async () => {
    const raw = JSON.parse(SHIPPED_TEXT);
    raw.provenance["0:1:label"] = "observed";
    await renderEditor(WORKING, { [WORKING]: JSON.stringify(raw) });
    const chip = await screen.findByText(/problems? · level/);
    fireEvent.click(chip);
    expect(screen.getByText(/not in the format/)).toBeInTheDocument();
    expect(screen.getByText(/0:1:label/)).toBeInTheDocument();
  });

  it("shows a shipped sidecar read-only", async () => {
    const { opened } = await renderEditor("roms/sp48.rom.dis", {});
    await screen.findByText(/Shipped sidecar — read-only/);
    expect(screen.queryByText("New entries:")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disassembly" }));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0][4]).toMatchObject({ annotationPath: "roms/sp48.rom.dis", annotationReadOnly: true });
  });

  it("is only a message when no ROM matches the file", async () => {
    const raw = JSON.parse(SHIPPED_TEXT);
    raw.pages["0"].crc32 = "00000000";
    await renderEditor("/home/me/Klive/RomAnnotations/odd.rom.dis", {
      "/home/me/Klive/RomAnnotations/odd.rom.dis": JSON.stringify(raw)
    });
    expect(await screen.findByText(/No ROM matches odd\.rom\.dis: no ROM page has CRC 00000000/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disassembly" })).not.toBeInTheDocument();
  });

  it("refuses a file that is not a ROM sidecar", async () => {
    const path = "/home/me/Klive/RomAnnotations/game.rom.dis";
    await renderEditor(path, { [path]: JSON.stringify({ schemaVersion: 3, machine: "sp48", banks: {} }) });
    expect(await screen.findByText(/is not a ROM annotation file/)).toBeInTheDocument();
  });
});
