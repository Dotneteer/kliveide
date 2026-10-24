import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { diskFileName, hostFileToDiskFiles } from "@common/diskfs/importFiles";
import { PRINT_42 } from "./fixtures";

/* Host files put on a disk (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4) */

describe("host files as disk files", () => {
  it("splits a .tap into its files, with their headers' kinds and parameters", () => {
    const tap = new Uint8Array(fs.readFileSync(path.join(__dirname, "../testfiles/floatspy.tap")));
    const files = hostFileToDiskFiles("floatspy.tap", tap, { system: "+3dos" });
    expect(files.length).toBeGreaterThan(1);
    expect(files[0].kind).toBe("basic");
    expect(files.some((f) => f.kind === "code" && f.start !== undefined)).toBe(true);
    for (const f of files) expect(f.name).toMatch(/^[A-Z0-9!#$%&'()\-@^_{}~]{1,8}(\.[A-Z0-9]{1,3})?$/);
  });

  it("makes a SCREEN$ of a 6912-byte .scr", () => {
    const [file] = hostFileToDiskFiles("title.scr", new Uint8Array(6912), { system: "+3dos" });
    expect(file).toMatchObject({ name: "TITLE.SCR", kind: "code", start: 16384 });
  });

  it("tokenises a .bas", () => {
    const [file] = hostFileToDiskFiles("hello.bas", new TextEncoder().encode("10 PRINT 42\n"), { system: "trdos" });
    expect(file).toMatchObject({ name: "hello.B", kind: "basic", variablesOffset: 14 });
    expect(file.data).toEqual(PRINT_42);
  });

  it("puts any other file as CODE at the address asked for", () => {
    const [file] = hostFileToDiskFiles("/x/my game.bin", new Uint8Array(10), { system: "+3dos", codeStart: 24000 });
    expect(file).toMatchObject({ name: "MYGAME.BIN", kind: "code", start: 24000 });
  });

  it("fits names to each file system", () => {
    expect(diskFileName("a very long name", "data", "code", "+3dos")).toBe("AVERYLON.DAT");
    expect(diskFileName("a very long name", "", "basic", "trdos")).toBe("a very l.B");
    expect(diskFileName("***", "", "code", "+3dos")).toBe("FILE");
  });
});
