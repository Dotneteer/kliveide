import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `rom-ann-open -create` (`.plans/ROM_ANNOTATIONS_MENU_PLAN.md` D4): a ROM with neither a working copy
 * nor shipped annotations gets an empty working copy, as `rom-ann-new` would make, and it opens.
 * Without the option the command still says the ROM has no annotations.
 */

const env = vi.hoisted(() => ({ createWorkingCopy: vi.fn(), reload: vi.fn() }));

vi.mock("@renderer/appIde/annotations/romWorkingCopy", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createWorkingCopy: env.createWorkingCopy
}));
vi.mock("@renderer/appIde/annotations/romAnnotations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestRomAnnotationsReload: env.reload
}));

import { RomAnnotationOpenCommand } from "@renderer/appIde/commands/RomAnnotationCommands";
import { setLanguage } from "@common/i18n/i18n";

function contextFor() {
  const openDocument = vi.fn(async () => {});
  const context: any = {
    store: { getState: () => ({ project: null }) },
    mainApi: {
      readBinaryFile: vi.fn(async (path: string) => {
        // --- A ROM Klive ships no annotations for: no index entry matches its bytes
        if (path === "roms/plain.rom") return new Uint8Array(0x2000).fill(0x55);
        throw new Error("File does not exist");
      }),
      readTextFile: vi.fn(async () => "{}"),
      resolveKliveHomePath: vi.fn(async (relative: string) => `/home/Klive/${relative}`),
      canWriteBeside: vi.fn(async () => false)
    },
    service: {
      projectService: {
        getActiveDocumentHubService: vi.fn(() => ({
          isOpen: vi.fn(() => false),
          setActiveDocument: vi.fn(),
          openDocument
        })),
        readFileContent: vi.fn(async () => {
          throw new Error("File does not exist");
        })
      }
    },
    output: { write: vi.fn(), writeLine: vi.fn(), color: vi.fn(), resetStyle: vi.fn(), bold: vi.fn() }
  };
  return { context, openDocument };
}

describe("rom-ann-open -create", () => {
  beforeEach(() => {
    setLanguage("en");
    vi.clearAllMocks();
  });

  it("declares the option", () => {
    const command = new RomAnnotationOpenCommand();
    expect(command.argumentInfo.commandOptions).toContain("-create");
    expect(command.usage).toContain("[-create]");
  });

  it("without it, says the ROM has no annotations and creates nothing", async () => {
    const { context } = contextFor();
    const result = await new RomAnnotationOpenCommand().execute(context, { rom: "plain.rom" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("has no annotations yet");
    expect(env.createWorkingCopy).not.toHaveBeenCalled();
  });

  it("with it, makes an empty working copy and opens it", async () => {
    env.createWorkingCopy.mockResolvedValue({ path: "/home/Klive/RomAnnotations/plain.rom.dis", from: "empty" });
    const { context, openDocument } = contextFor();
    const result = await new RomAnnotationOpenCommand().execute(context, { rom: "plain.rom", "-create": true });
    expect(result.success).toBe(true);
    expect(result.finalMessage).toContain("an empty sidecar for plain.rom");
    expect(env.createWorkingCopy).toHaveBeenCalledWith(
      context.mainApi,
      context.service.projectService,
      expect.objectContaining({ workingPath: "/home/Klive/RomAnnotations/plain.rom.dis", romName: "plain.rom" })
    );
    expect(env.reload).toHaveBeenCalled();
    expect(openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "romAnnotations:/home/Klive/RomAnnotations/plain.rom.dis" }),
      { sidecarPath: "/home/Klive/RomAnnotations/plain.rom.dis" },
      false
    );
  });

  it("reports a refused working copy", async () => {
    env.createWorkingCopy.mockResolvedValue({ reason: "The folder cannot be written." });
    const { context } = contextFor();
    const result = await new RomAnnotationOpenCommand().execute(context, { rom: "plain.rom", "-create": true });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("The folder cannot be written.");
  });
});
