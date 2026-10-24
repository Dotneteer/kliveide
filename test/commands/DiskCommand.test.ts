import { describe, expect, it } from "vitest";

import { DiskCommand } from "@renderer/appIde/commands/DiskCommands";
import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";
import { TrdosFileSystem } from "@common/diskfs/trdos";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { createMockContextWithProject } from "./test-helpers/mock-context";

/*
 * `disk` (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B6) against a main process held in memory:
 * files by path, and the begin/commit edit pair.
 */

function context (files: Record<string, Uint8Array>) {
  const fs = new Map(Object.entries(files));
  const edits: string[] = [];
  const lines: string[] = [];
  const mainApi = {
    readBinaryFile: async (p: string) => {
      const data = fs.get(p);
      if (!data) throw new Error(`no file ${p}`);
      return data;
    },
    saveBinaryFile: async (p: string, data: Uint8Array) => {
      fs.set(p, data);
      return p;
    },
    beginDiskImageEdit: async (p: string) => {
      edits.push(`begin ${p}`);
      return { contents: fs.get(p)! };
    },
    commitDiskImageEdit: async (p: string, data: Uint8Array) => {
      edits.push(`commit ${p}`);
      fs.set(p, data);
    },
    cancelDiskImageEdit: async () => {
      edits.push("cancel");
    },
    createDiskFile: async (folder: string, name: string) => `${folder}/${name}`
  };
  const ctx = createMockContextWithProject("/proj", { mainApi: mainApi as any });
  (ctx.output as any).writeLine = (text?: string) => lines.push(text ?? "");
  (ctx.output as any).write = (text: string) => lines.push(text);
  return { ctx, fs, edits, lines };
}

const run = async (c: ReturnType<typeof context>, args: Record<string, unknown>) => {
  const command = new DiskCommand();
  const messages = await command.validateCommandArgs(c.ctx, args as any);
  if (messages.length) return { success: false, message: messages[0].message };
  return command.execute(c.ctx, args as any);
};

describe("disk command", () => {
  it("lists a disk's files", async () => {
    const image = new Plus3DosFileSystem(createBlankDsk("ss"));
    image.write({ name: "GAME.BIN", kind: "code", data: new Uint8Array(500), start: 32768 });
    const c = context({ "/proj/game.dsk": image.image() });
    const result = await run(c, { action: "ls", image: "game.dsk" });
    expect(result.success).toBe(true);
    expect((result as any).value.files).toEqual([{ name: "GAME.BIN", kind: "code", size: 500, start: 32768 }]);
    expect(c.lines.join("\n")).toContain("GAME.BIN");
  });

  it("adds, extracts, renames and deletes through the edit pair", async () => {
    const c = context({
      "/proj/d.trd": createBlankTrd({ cylinders: 80, sides: 2 }),
      "/proj/code.bin": new Uint8Array(300).fill(5)
    });
    expect((await run(c, { action: "add", image: "d.trd", arg1: "code.bin", "-start": 40000 })).success).toBe(true);
    expect((await run(c, { action: "mv", image: "d.trd", arg1: "code.C", arg2: "main.C" })).success).toBe(true);
    expect((await run(c, { action: "get", image: "d.trd", arg1: "main.C", arg2: "out.bin" })).success).toBe(true);
    expect(c.fs.get("/proj/out.bin")).toEqual(new Uint8Array(300).fill(5));
    expect(new TrdosFileSystem(c.fs.get("/proj/d.trd")!).list().map((f) => [f.name, f.start])).toEqual([["main.C", 40000]]);
    expect((await run(c, { action: "rm", image: "d.trd", arg1: "main.C" })).success).toBe(true);
    expect((await run(c, { action: "compact", image: "d.trd" })).success).toBe(true);
    expect(new TrdosFileSystem(c.fs.get("/proj/d.trd")!).list({ deleted: true })).toEqual([]);
    expect(c.edits.filter((e) => e.startsWith("commit")).length).toBe(4);
  });

  it("reports a refusal and abandons the edit", async () => {
    const c = context({ "/proj/a.dsk": createBlankDsk("ss") });
    const result = await run(c, { action: "rm", image: "a.dsk", arg1: "NOPE" });
    expect(result.success).toBe(false);
    expect((result as any).finalMessage ?? (result as any).message).toContain("NOPE is not on the disk");
    expect(c.edits).toEqual(["begin /proj/a.dsk", "cancel"]);
  });

  it("refuses an unknown subcommand or missing arguments", async () => {
    const c = context({});
    expect((await run(c, { action: "zap", image: "a.dsk" })).success).toBe(false);
    expect((await run(c, { action: "mv", image: "a.dsk", arg1: "x" })).success).toBe(false);
  });
});
