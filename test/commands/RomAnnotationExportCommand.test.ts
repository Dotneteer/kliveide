import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { RomAnnotationExportCommand } from "@renderer/appIde/commands/RomAnnotationCommands";

/*
 * `rom-ann-export`: a ROM's annotations written as one source file, assembled and compared with the
 * ROM. Run on the shipped ZX80 ROM and its sidecar, with Klive's real assembler behind
 * `assembleText`.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const shippedFile = (path: string) => join(ROMS, path.replace(/^roms\//, ""));

function exportContext(sidecarText = readFileSync(join(ROMS, "zx80.rom.dis"), "utf8")) {
  const saved = new Map<string, string>();
  const output: string[] = [];
  const context: any = {
    store: { getState: () => ({ project: null }) },
    mainApi: {
      readBinaryFile: vi.fn(async (path: string) => new Uint8Array(readFileSync(shippedFile(path)))),
      readTextFile: vi.fn(async (path: string) => readFileSync(shippedFile(path), "utf8")),
      resolveKliveHomePath: vi.fn(async (relative: string) => `/home/Klive/${relative}`),
      canWriteBeside: vi.fn(async () => false),
      saveTextFile: vi.fn(async (path: string, text: string) => {
        saved.set(path, text);
        return path;
      }),
      assembleText: vi.fn(async (source: string) => {
        const result = await new Z80Assembler().compile(source, new AssemblerOptions());
        return {
          errors: result.errors.map((e) => ({ line: e.line, message: e.message, isWarning: e.isWarning })),
          segments: result.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: [...s.emittedCode] }))
        };
      })
    },
    service: {
      projectService: {
        // --- The working copy of zx80.rom.dis: the shipped text
        readFileContent: vi.fn(async () => sidecarText)
      },
      ideCommandsService: { executeCommand: vi.fn(async () => ({ success: true })) }
    },
    output: {
      write: vi.fn((text: string) => output.push(text)),
      writeLine: vi.fn((text = "") => output.push(text)),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn()
    }
  };
  return { context, saved, output };
}

describe("rom-ann-export", () => {
  it("writes the source and verifies it against the ROM", async () => {
    const { context, saved, output } = exportContext();
    const result = await new RomAnnotationExportCommand().execute(context, { rom: "zx80.rom", file: "/out/zx80.kz80.asm" });
    expect(result.success).toBe(true);
    expect(saved.get("/out/zx80.kz80.asm")).toContain(".org $0000");
    expect(output.join("")).toContain("Exported");
    // --- The verdict is the result, so a button or a menu that runs the command can show it
    expect(result.finalMessage).toBe("Verified: the source assembles to the ROM, byte for byte (4,096 bytes).");
    expect(result.value).toEqual({ identical: true, file: "/out/zx80.kz80.asm" });
  }, 60_000);

  it("refuses a relative output file with no project open", async () => {
    const { context, saved } = exportContext();
    const result = await new RomAnnotationExportCommand().execute(context, { rom: "zx80.rom", file: "zx80.kz80.asm" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("relative path");
    expect(saved.size).toBe(0);
  });

  it("fails when the source does not reassemble to the ROM", async () => {
    const { context } = exportContext();
    // --- An assembler that drops the last byte
    const real = context.mainApi.assembleText;
    context.mainApi.assembleText = vi.fn(async (source: string) => {
      const result = await real(source);
      result.segments[0].emittedCode.pop();
      return result;
    });
    const result = await new RomAnnotationExportCommand().execute(context, { rom: "zx80.rom", file: "/out/zx80.kz80.asm" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("page 0 $0FFF");
  }, 60_000);
  it("exports the shipped sidecar of a ROM with no working copy", async () => {
    const { context, saved } = exportContext();
    context.service.projectService.readFileContent = vi.fn(async () => {
      throw new Error("File does not exist");
    });
    const result = await new RomAnnotationExportCommand().execute(context, { rom: "zx80.rom", file: "/out/zx80.kz80.asm" });
    expect(result.success).toBe(true);
    expect(context.mainApi.readTextFile).toHaveBeenCalledWith("roms/zx80.rom.dis");
    expect(saved.get("/out/zx80.kz80.asm")).toContain("from zx80.rom.dis");
  }, 60_000);
});
