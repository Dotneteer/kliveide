import { describe, expect, it, vi } from "vitest";
import {
  RomAnnotationCheckCommand,
  RomAnnotationOpenCommand,
  romTargetOf
} from "@renderer/appIde/commands/RomAnnotationCommands";

/*
 * A relative path given to a `rom-ann-*` command with no project open is refused. Passed on, the main
 * process would resolve it against the app's own folder (the repository's `src/public` in
 * development). A shipped ROM's bare name still works without a project.
 */
function noProjectContext(readBinaryFile = vi.fn(async (_path: string): Promise<Uint8Array> => {
  throw new Error("File does not exist");
})) {
  const context: any = {
    store: { getState: () => ({ project: null }) },
    mainApi: {
      readBinaryFile,
      readTextFile: vi.fn(async () => "{}"),
      resolveKliveHomePath: vi.fn(async (relative: string) => `/home/Klive/${relative}`),
      canWriteBeside: vi.fn(async () => false)
    },
    service: {
      projectService: {
        getActiveDocumentHubService: vi.fn(() => ({ isOpen: vi.fn(() => false), setActiveDocument: vi.fn() })),
        readFileContent: vi.fn(async () => {
          throw new Error("File does not exist");
        })
      }
    },
    output: { write: vi.fn(), writeLine: vi.fn(), color: vi.fn(), resetStyle: vi.fn(), bold: vi.fn() }
  };
  return { context, readBinaryFile };
}

describe("rom-ann-* commands with no project open", () => {
  it("refuses a relative ROM path without reading it", async () => {
    const { context, readBinaryFile } = noProjectContext();
    const target = await romTargetOf(context, "roms/mine.rom");
    expect("error" in target && target.error).toContain("relative path");
    expect(readBinaryFile).not.toHaveBeenCalled();
  });

  it("says a bare name that is not shipped is unknown, without reading it as a path", async () => {
    const { context, readBinaryFile } = noProjectContext();
    const target = await romTargetOf(context, "nosuch.rom");
    expect("error" in target && target.error).toContain("neither a ROM Klive ships");
    // --- Only the shipped folder was tried
    expect(readBinaryFile.mock.calls.map((call) => call[0])).toEqual(["roms/nosuch.rom"]);
  });

  it("still finds a shipped ROM by its bare name", async () => {
    const { context } = noProjectContext(vi.fn(async (path: string) => {
      if (path === "roms/zx80.rom") return new Uint8Array(0x1000);
      throw new Error("File does not exist");
    }));
    const target = await romTargetOf(context, "zx80.rom");
    expect(target).toMatchObject({ workingPath: "/home/Klive/RomAnnotations/zx80.rom.dis" });
  });

  it("rom-ann-open and rom-ann-check refuse a relative .dis path", async () => {
    const { context } = noProjectContext();
    const open = await new RomAnnotationOpenCommand().execute(context, { rom: "zx80.rom.dis" });
    expect(open.success).toBe(false);
    expect(open.finalMessage).toContain("relative path");
    const check = await new RomAnnotationCheckCommand().execute(context, { rom: "zx80.rom.dis" });
    expect(check.success).toBe(false);
    expect(check.finalMessage).toContain("relative path");
  });
});
