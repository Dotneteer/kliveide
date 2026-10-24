import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractArchive, safeJoin } from "@main/tool-install/archive";

type TarEntry = { name: string; data?: string; mode?: number; type?: "0" | "5"; prefix?: string };

// --- A minimal tar writer: enough header fields for the reader (name, mode, size, type, magic)
function tarGz(entries: TarEntry[], magic: "ustar" | "gnu"): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? "");
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, "utf8");
    header.write(((entry.mode ?? 0o644).toString(8)).padStart(7, "0") + "\0", 100, "latin1");
    header.write(data.length.toString(8).padStart(11, "0") + "\0", 124, "latin1");
    header.write(entry.type ?? "0", 156, "latin1");
    header.write(magic === "ustar" ? "ustar\u000000" : "ustar  \u0000", 257, "latin1");
    if (entry.prefix) header.write(entry.prefix, 345, "utf8");
    if (magic === "gnu") header.write("12345670123", 345, "latin1"); // --- GNU atime: not a prefix
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

// --- A minimal zip writer (stored entries), with Unix modes in the external attributes
function zip(entries: { name: string; data?: string; mode?: number }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data ?? "");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0o644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

describe("tool-install archive extraction", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-archive-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (name: string, bytes: Buffer) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes);
    return file;
  };
  const out = () => path.join(dir, "out");

  it("extracts a GNU tar, strips the top folder and keeps the mode bits", () => {
    const file = write(
      "kit.tar.gz",
      tarGz(
        [
          { name: "kit-1.0/", type: "5", mode: 0o755 },
          { name: "kit-1.0/zxbc", data: "BIN", mode: 0o775 },
          { name: "kit-1.0/lib/a.bas", data: "REM", mode: 0o664 }
        ],
        "gnu"
      )
    );
    const entries = extractArchive(file, out(), { stripComponents: 1, applyModes: true });
    expect(entries.map((e) => e.path)).toEqual(["zxbc", "lib/a.bas"]);
    expect(fs.readFileSync(path.join(out(), "zxbc"), "utf8")).toBe("BIN");
    expect(entries[0].mode).toBe(0o775);
    if (process.platform !== "win32") {
      expect(fs.statSync(path.join(out(), "zxbc")).mode & 0o777).toBe(0o775);
      expect(fs.statSync(path.join(out(), "lib/a.bas")).mode & 0o111).toBe(0);
    }
  });

  it("does not read a GNU header's time fields as a name prefix", () => {
    const file = write("kit.tar.gz", tarGz([{ name: "zxbc", data: "x" }], "gnu"));
    expect(extractArchive(file, out()).map((e) => e.path)).toEqual(["zxbc"]);
  });

  it("joins a ustar name prefix", () => {
    const file = write("kit.tgz", tarGz([{ name: "file.txt", prefix: "deep/folder", data: "y" }], "ustar"));
    expect(extractArchive(file, out()).map((e) => e.path)).toEqual(["deep/folder/file.txt"]);
  });

  it("leaves out entries the filter rejects", () => {
    const file = write(
      "kit.zip",
      zip([
        { name: "kit/zxbc.exe", data: "MZ" },
        { name: "kit/zxbc.pdb", data: "PDB" }
      ])
    );
    const entries = extractArchive(file, out(), {
      stripComponents: 1,
      include: (p) => !p.endsWith(".pdb")
    });
    expect(entries.map((e) => e.path)).toEqual(["zxbc.exe"]);
    expect(fs.existsSync(path.join(out(), "zxbc.pdb"))).toBe(false);
  });

  it("reads Unix modes from a zip's external attributes", () => {
    const file = write("kit.zip", zip([{ name: "tool", data: "x", mode: 0o755 }]));
    expect(extractArchive(file, out(), { applyModes: true })[0].mode).toBe(0o755);
  });

  it("refuses an entry that escapes the output folder", () => {
    const file = write("evil.tar.gz", tarGz([{ name: "../escape.txt", data: "no" }], "ustar"));
    expect(() => extractArchive(file, out())).toThrow(/escapes the install folder/);
    expect(fs.existsSync(path.join(dir, "escape.txt"))).toBe(false);
    expect(() => safeJoin(out(), "/etc/passwd")).toThrow();
  });

  it("rejects an unknown archive type", () => {
    expect(() => extractArchive(write("kit.rar", Buffer.alloc(4)), out())).toThrow(/Unsupported/);
  });

  // --- The real kit that vendor/boriel-basic/kit.json pins, when this checkout has fetched it
  // --- (vendor/boriel-basic/README.md)
  const vendorFolder = path.resolve(__dirname, "../../vendor/boriel-basic");
  const pinned = JSON.parse(fs.readFileSync(path.join(vendorFolder, "kit.json"), "utf8"));
  const realKit = path.join(vendorFolder, "kits", pinned.kits["darwin-arm64"].file);
  it.skipIf(!fs.existsSync(realKit))("extracts the Boriel BASIC kit with its nine executables", () => {
    const entries = extractArchive(realKit, out(), { stripComponents: 1, applyModes: true });
    expect(entries).toHaveLength(754);
    const executables = entries.filter((e) => e.mode & 0o100).map((e) => e.path).sort();
    expect(executables).toEqual([
      "arch/zx81sd/tools/build_sd81",
      "arch/zx81sd/tools/gen_map",
      "arch/zx81sd/tools/split_sd81",
      "tools/modman",
      "tools/nextcreator",
      "tools/zxbpack",
      "zxbasm",
      "zxbc",
      "zxbpp"
    ]);
  });
});
