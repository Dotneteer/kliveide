import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BORIEL_MARKER_FILE } from "@main/boriel-integration/boriel-config";
import {
  decideBorielStartup,
  getBorielSetupStatus,
  installBoriel,
  normalizeFolder,
  useExistingBoriel,
  validateInstallFolder,
  type BorielServiceDeps
} from "@main/boriel-integration/boriel-install-service";
import { borielKitLocation, locateBundledKit } from "@main/boriel-integration/boriel-kit";
import { probeBoriel, resolveBorielExecutable, type VersionRunner } from "@main/boriel-integration/boriel-resolver";
import { compareBorielVersions, versionFromOutput } from "@main/boriel-integration/boriel-version";

const VERSION = "2.0.0-beta25";
const KEY = "darwin-arm64";
const isWindows = process.platform === "win32";

// --- A kit shaped like Boriel's: one top folder, zxbc at its root, a library file below
function makeKitArchive(): Buffer {
  const entries: { name: string; data: string; mode: number; type?: string }[] = [
    { name: "kit/", data: "", mode: 0o755, type: "5" },
    { name: "kit/zxbc", data: "#!fake", mode: 0o775 },
    { name: "kit/tools/zxbpack", data: "#!fake", mode: 0o644 },
    { name: "kit/lib/zx48k/stdlib/a.bas", data: "REM", mode: 0o664 }
  ];
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const data = Buffer.from(e.data);
    const h = Buffer.alloc(512);
    h.write(e.name, 0);
    h.write(e.mode.toString(8).padStart(7, "0") + "\0", 100, "latin1");
    h.write(data.length.toString(8).padStart(11, "0") + "\0", 124, "latin1");
    h.write(e.type ?? "0", 156, "latin1");
    h.write("ustar  \u0000", 257, "latin1");
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

const okRunner: VersionRunner = async () => ({ exitCode: 0, stdout: `zxbc ${VERSION}\n`, stderr: "", timedOut: false });

describe("Boriel BASIC versions", () => {
  it("orders releases, pre-releases and numeric pre-release parts", () => {
    expect(compareBorielVersions("2.0.0-beta3", "2.0.0-beta25")).toBeLessThan(0);
    expect(compareBorielVersions("2.0.0", "2.0.0-beta25")).toBeGreaterThan(0);
    expect(compareBorielVersions("2.1.0-beta1", "2.0.9")).toBeGreaterThan(0);
    expect(compareBorielVersions("2.0.0-beta25", "2.0.0-beta25")).toBe(0);
    expect(compareBorielVersions(undefined, "1.0.0")).toBeLessThan(0);
  });
  it("reads the version zxbc prints", () => {
    expect(versionFromOutput("zxbc 2.0.0-beta25\n")).toBe("2.0.0-beta25");
    expect(versionFromOutput("nothing")).toBeUndefined();
  });
});

describe("Boriel BASIC setup", () => {
  let root: string;
  let home: string;
  let vendor: string;
  let settings: Record<string, string>;
  let deps: BorielServiceDeps;

  const writeKit = (archive: Buffer, sha = createHash("sha256").update(archive).digest("hex")) => {
    fs.mkdirSync(path.join(vendor, "kits"), { recursive: true });
    fs.writeFileSync(path.join(vendor, "kits", "kit.tar.gz"), archive);
    fs.writeFileSync(
      path.join(vendor, "kit.json"),
      JSON.stringify({
        product: "Boriel BASIC",
        version: VERSION,
        urlBase: "https://example.invalid/",
        kits: { [KEY]: { file: "kit.tar.gz", size: archive.length, sha256: sha } }
      })
    );
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-"));
    home = path.join(root, "home");
    vendor = path.join(root, "app", "vendor", "boriel-basic");
    fs.mkdirSync(home, { recursive: true });
    writeKit(makeKitArchive());
    settings = {};
    deps = {
      kitLocation: borielKitLocation(false, "", path.join(root, "app")),
      platformKey: KEY,
      platform: isWindows ? "linux" : process.platform,
      homeDir: home,
      protectedFolders: [path.join(root, "app")],
      settings: { readSetting: (key) => settings[key] },
      setupRecord: undefined,
      runner: okRunner,
      clearQuarantine: async () => {}
    };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("finds the kit from a built app path below the repository (out/main)", () => {
    const fromBuild = borielKitLocation(false, "", path.join(root, "app", "out", "main"));
    expect(fromBuild.manifestFile).toBe(path.join(vendor, "kit.json"));
    expect(borielKitLocation(true, "/res", "/ignored").manifestFile).toBe(path.join("/res", "boriel", "kit.json"));
  });

  it("locates the bundled kit, or says why there is none", () => {
    expect(locateBundledKit(deps.kitLocation, KEY).kit).toMatchObject({ kind: "available", version: VERSION });
    expect(locateBundledKit(deps.kitLocation, "win32-arm64").kit.kind).toBe("unavailable");
    fs.rmSync(path.join(vendor, "kits", "kit.tar.gz"));
    expect(locateBundledKit(deps.kitLocation, KEY).kit).toMatchObject({ kind: "unavailable", reason: /missing/ });
  });

  it("installs into ~/zxbasic2: extracted, executable, marked, probed", async () => {
    const result = await installBoriel("~/zxbasic2", deps);
    const folder = path.join(home, "zxbasic2");
    expect(result).toMatchObject({ kind: "installed", folder, version: VERSION });
    expect(fs.existsSync(path.join(folder, "lib/zx48k/stdlib/a.bas"))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(folder, BORIEL_MARKER_FILE), "utf8")).version).toBe(VERSION);
    if (!isWindows) {
      expect(fs.statSync(path.join(folder, "zxbc")).mode & 0o111).not.toBe(0);
      expect(fs.statSync(path.join(folder, "tools/zxbpack")).mode & 0o111).not.toBe(0);
    }
    // --- No temporary or set-aside folders are left behind
    expect(fs.readdirSync(home)).toEqual(["zxbasic2"]);
  });

  it("refuses a folder with someone else's files, Klive's folders and a damaged kit", async () => {
    const busy = path.join(home, "busy");
    fs.mkdirSync(busy);
    fs.writeFileSync(path.join(busy, "notes.txt"), "mine");
    expect(validateInstallFolder(busy, deps)).toMatch(/not empty/);
    expect((await installBoriel(busy, deps)).kind).toBe("failed");
    expect(fs.readFileSync(path.join(busy, "notes.txt"), "utf8")).toBe("mine");
    expect(validateInstallFolder(path.join(root, "app", "x"), deps)).toMatch(/Klive's own/);
    expect(validateInstallFolder("relative/path", deps)).toMatch(/absolute/);

    writeKit(makeKitArchive(), "0".repeat(64));
    expect(await installBoriel(path.join(home, "zxbasic2"), deps)).toMatchObject({ kind: "failed", error: /checksum/ });
  });

  it("updates a folder Klive installed, and restores nothing-but-the-old one on failure", async () => {
    const folder = path.join(home, "zxbasic2");
    await installBoriel(folder, deps);
    fs.writeFileSync(path.join(folder, "old-file"), "x");
    // --- An update replaces the whole folder
    expect((await installBoriel(folder, deps)).kind).toBe("installed");
    expect(fs.existsSync(path.join(folder, "old-file"))).toBe(false);

    // --- A compiler that fails its probe leaves the previous installation untouched
    fs.writeFileSync(path.join(folder, "old-file"), "x");
    const broken = { ...deps, runner: (async () => ({ exitCode: 1, stdout: "", stderr: "boom", timedOut: false })) as VersionRunner };
    expect(await installBoriel(folder, broken)).toMatchObject({ kind: "failed", error: /does not work/ });
    expect(fs.existsSync(path.join(folder, "old-file"))).toBe(true);
    expect(fs.readdirSync(home)).toEqual(["zxbasic2"]);
  });

  it("rejects a kit whose zxbc reports another version", async () => {
    const other = { ...deps, runner: (async () => ({ exitCode: 0, stdout: "zxbc 2.0.0-beta24", stderr: "", timedOut: false })) as VersionRunner };
    expect(await installBoriel(path.join(home, "zxbasic2"), other)).toMatchObject({ kind: "failed", error: /reports 2.0.0-beta24/ });
  });

  it("reports the installation the settings point at", async () => {
    expect((await getBorielSetupStatus(deps)).installation.kind).toBe("notConfigured");
    await installBoriel(path.join(home, "zxbasic2"), deps);
    settings["zxbasic.root"] = path.join(home, "zxbasic2");
    expect((await getBorielSetupStatus(deps)).installation).toMatchObject({ kind: "working", outdated: false });
    const older = { ...deps, runner: (async () => ({ exitCode: 0, stdout: "zxbc 2.0.0-beta3", stderr: "", timedOut: false })) as VersionRunner };
    expect((await getBorielSetupStatus(older)).installation).toMatchObject({ kind: "working", outdated: true });
    settings["zxbasic.root"] = path.join(home, "gone");
    expect((await getBorielSetupStatus(deps)).installation.kind).toBe("broken");
  });

  it("decides at startup: offer, adopt, or stay quiet", async () => {
    expect((await decideBorielStartup(deps)).kind).toBe("offer");
    expect((await decideBorielStartup({ ...deps, setupRecord: { offeredVersion: VERSION, declined: true } })).kind).toBe("none");
    // --- A decline is per kit version: a newer kit asks again
    expect((await decideBorielStartup({ ...deps, setupRecord: { offeredVersion: "2.0.0-beta1", declined: true } })).kind).toBe("offer");
    // --- A working installation in the default folder is adopted without asking
    await installBoriel(path.join(home, "zxbasic2"), deps);
    expect(await decideBorielStartup(deps)).toMatchObject({ kind: "adopt", folder: path.join(home, "zxbasic2") });
    settings["zxbasic.root"] = path.join(home, "zxbasic2");
    expect((await decideBorielStartup(deps)).kind).toBe("none");
    // --- No kit, no offer
    fs.rmSync(path.join(vendor, "kit.json"));
    settings = {};
    expect((await decideBorielStartup(deps)).kind).toBe("none");
  });

  it("accepts an existing installation by folder or by executable", async () => {
    await installBoriel(path.join(home, "zxbasic2"), deps);
    expect(await useExistingBoriel(path.join(home, "zxbasic2"), deps)).toMatchObject({ kind: "installed", version: VERSION });
    expect((await useExistingBoriel(path.join(home, "nowhere"), deps)).kind).toBe("failed");
  });

  it("resolves the executable: explicit path first, then the folder", () => {
    expect(resolveBorielExecutable({ readSetting: () => undefined })).toBe("");
    expect(resolveBorielExecutable({ readSetting: (k) => (k === "zxbasic.root" ? "/opt/zx" : undefined) }, false)).toBe(
      path.join("/opt/zx", "zxbc")
    );
    expect(
      resolveBorielExecutable({ readSetting: (k) => (k === "zxbasic.executablePath" ? " /x/zxbc " : "/opt/zx") }, false)
    ).toBe("/x/zxbc");
    expect(normalizeFolder("~", home)).toBe(home);
  });

  it("explains a probe that times out, an old zxbc and a missing file", async () => {
    const file = path.join(root, "zxbc");
    fs.writeFileSync(file, "");
    const hung: VersionRunner = async () => ({ stdout: "", stderr: "", timedOut: true });
    expect((await probeBoriel(file, hung, "darwin")).error).toMatch(/quarantine/);
    const old: VersionRunner = async () => ({ exitCode: 0, stdout: "zxbc 1.18.7", stderr: "", timedOut: false });
    expect(await probeBoriel(file, old)).toMatchObject({ ok: false, version: "1.18.7", error: /too old/ });
    expect((await probeBoriel(path.join(root, "none"), okRunner)).error).toMatch(/not found/);
  });
});

// --- The real kit for this machine, with the real zxbc, when this checkout has fetched it
describe("Boriel BASIC setup with the real kit", () => {
  const appPath = path.resolve(__dirname, "../..");
  const location = borielKitLocation(false, "", appPath);
  const available = locateBundledKit(location).kit.kind === "available";
  let home: string;
  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-real-"));
  });
  afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

  it.skipIf(!available)("installs it and zxbc answers --version", async () => {
    const result = await installBoriel(path.join(home, "zxbasic2"), {
      kitLocation: location,
      platformKey: `${process.platform}-${process.arch}`,
      platform: process.platform,
      homeDir: home,
      protectedFolders: [],
      settings: { readSetting: () => undefined },
      setupRecord: undefined
    });
    expect(result).toMatchObject({ kind: "installed", version: "2.0.0-beta25" });
  }, 60_000);
});
