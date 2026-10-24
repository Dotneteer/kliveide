import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { runCli } from "../../src/cli/run-cli";
import type { CliIo } from "../../src/cli/io";
import { Plus3DosFileSystem } from "@common/diskfs/plus3dos";

/* `klive disk` (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B6), in-process on a scratch folder */

function io (cwd: string) {
  const out: string[] = [];
  const err: string[] = [];
  const cli: CliIo = {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    outBytes: () => {},
    writeFile: (f) => f,
    env: {},
    cwd,
    waitForInterrupt: () => new Promise(() => {})
  };
  return { cli, out, err };
}

describe("klive disk", () => {
  it("makes a disk, adds, lists, renames, extracts and deletes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-disk-verb-"));
    fs.writeFileSync(path.join(dir, "hello.bas"), "10 PRINT 42\n");
    fs.writeFileSync(path.join(dir, "code.bin"), new Uint8Array(500).fill(9));
    const run = async (...args: string[]) => {
      const x = io(dir);
      const code = await runCli(["disk", ...args], x.cli);
      return { code, ...x };
    };
    expect((await run("new", "game.dsk", "sse")).code).toBe(0);
    expect((await run("add", "game.dsk", "hello.bas")).code).toBe(0);
    expect((await run("add", "game.dsk", "code.bin", "--start", "40000")).code).toBe(0);
    expect((await run("mv", "game.dsk", "CODE.BIN", "MAIN.BIN")).code).toBe(0);
    const ls = await run("ls", "game.dsk", "--json");
    expect(JSON.parse(ls.out.join("\n")).map((f: { name: string; start?: number }) => [f.name, f.start])).toEqual([
      ["HELLO", undefined],
      ["MAIN.BIN", 40000]
    ]);
    expect((await run("get", "game.dsk", "MAIN.BIN", "out.bin")).code).toBe(0);
    expect(new Uint8Array(fs.readFileSync(path.join(dir, "out.bin")))).toEqual(new Uint8Array(500).fill(9));
    expect((await run("rm", "game.dsk", "HELLO")).code).toBe(0);
    expect(new Plus3DosFileSystem(new Uint8Array(fs.readFileSync(path.join(dir, "game.dsk")))).list().map((f) => f.name)).toEqual(["MAIN.BIN"]);
    expect(fs.existsSync(path.join(dir, "game.dsk.bak"))).toBe(true);
  });

  it("fails with a reason the disk gives, and refuses bad usage", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-disk-verb-"));
    const a = io(dir);
    expect(await runCli(["disk", "new", "d.trd", "trd80ds"], a.cli)).toBe(0);
    const b = io(dir);
    expect(await runCli(["disk", "rm", "d.trd", "nothere.C"], b.cli)).toBe(1);
    expect(b.err.join()).toContain("nothere.C is not on the disk");
    const c = io(dir);
    expect(await runCli(["disk", "zap", "d.trd"], c.cli)).toBe(3);
  });

  it("makes and edits a FAT hard-disk image: folders, a host folder copied, files out", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-disk-verb-"));
    fs.mkdirSync(path.join(dir, "games", "sub"), { recursive: true });
    fs.writeFileSync(path.join(dir, "games", "Long file name.tap"), new Uint8Array(3000).fill(7));
    fs.writeFileSync(path.join(dir, "games", "sub", "x.bin"), new Uint8Array([1, 2, 3]));
    const run = async (...args: string[]) => {
      const x = io(dir);
      const code = await runCli(["disk", ...args], x.cli);
      return { code, ...x };
    };
    expect((await run("new", "card.img", "fat16", "32", "--label", "KLIVE")).code).toBe(0);
    expect((await run("mkdir", "card.img", "bin/tools")).code).toBe(0);
    expect((await run("add", "card.img", "games")).code).toBe(0);
    expect((await run("add", "card.img", "games/sub/x.bin", "bin/tools")).code).toBe(0);
    const root = JSON.parse((await run("ls", "card.img", "--json")).out.join("\n"));
    expect(root.map((f: { name: string }) => f.name).sort()).toEqual(["bin", "games"]);
    const games = JSON.parse((await run("ls", "card.img", "games", "--json")).out.join("\n"));
    expect(games.map((f: { name: string }) => f.name).sort()).toEqual(["games/Long file name.tap", "games/sub"]);
    expect((await run("mv", "card.img", "games/Long file name.tap", "game.tap")).code).toBe(0);
    expect((await run("get", "card.img", "games/game.tap", "out.tap")).code).toBe(0);
    expect(new Uint8Array(fs.readFileSync(path.join(dir, "out.tap")))).toEqual(new Uint8Array(3000).fill(7));
    expect((await run("rm", "card.img", "bin/tools/x.bin")).code).toBe(0);
    const info = JSON.parse((await run("info", "card.img", "--json")).out.join("\n"));
    expect(info.info.system).toBe("FAT16");
    expect(info.info.label).toBe("KLIVE");
    expect(info.partitions).toHaveLength(1);
    expect((await run("compact", "card.img")).code).toBe(3);
    expect((await run("new", "bad.img", "fat12", "32")).code).toBe(3);
  });
});
