import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureKit, kitKey, readKitManifest, stageKit, VENDOR_FOLDER } from "../../scripts/boriel-kit.cjs";

/*
 * `scripts/boriel-kit.cjs`: a fresh clone re-creates the kits from `kit.json`
 * (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.1). Downloads go through an injected fetch.
 */

const BYTES = Buffer.from("a kit archive");
const SHA = createHash("sha256").update(BYTES).digest("hex");
const response = (body: Buffer, ok = true) => ({ ok, status: ok ? 200 : 404, arrayBuffer: async () => body });

describe("boriel-kit script", () => {
  let vendor: string;
  beforeEach(() => {
    vendor = fs.mkdtempSync(path.join(os.tmpdir(), "klive-boriel-kit-"));
    fs.writeFileSync(
      path.join(vendor, "kit.json"),
      JSON.stringify({
        product: "Boriel BASIC",
        version: "2.0.0-beta25",
        urlBase: "https://primary.example/v2",
        mirrors: ["https://mirror.example/kits/"],
        kits: { "darwin-arm64": { file: "kit.tar.gz", size: BYTES.length, sha256: SHA } }
      })
    );
  });
  afterEach(() => fs.rmSync(vendor, { recursive: true, force: true }));

  it("maps Node and electron-builder names to kit.json keys", () => {
    expect(kitKey("darwin", "arm64")).toBe("darwin-arm64");
    expect(kitKey("mac", "x64")).toBe("darwin-x64");
    expect(kitKey("linux", "armv7l")).toBe("linux-arm");
    expect(kitKey("win", "x64")).toBe("win32-x64");
    expect(() => kitKey("aix", "ppc")).toThrow(/Unknown/);
  });

  it("downloads a missing kit from urlBase and verifies it", async () => {
    const fetch = vi.fn(async () => response(BYTES));
    const file = await ensureKit("darwin-arm64", { vendorFolder: vendor, fetch });
    expect(fetch).toHaveBeenCalledWith("https://primary.example/v2/kit.tar.gz");
    expect(fs.readFileSync(file)).toEqual(BYTES);
    // --- A file that verifies is never fetched again
    await ensureKit("darwin-arm64", { vendorFolder: vendor, fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to a mirror, and never accepts a file whose hash differs", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("https://primary") ? response(Buffer.from("tampered")) : response(BYTES)
    );
    const file = await ensureKit("darwin-arm64", { vendorFolder: vendor, fetch });
    expect(fetch).toHaveBeenLastCalledWith("https://mirror.example/kits/kit.tar.gz");
    expect(fs.readFileSync(file)).toEqual(BYTES);
  });

  it("fails loudly when no source has the right file, leaving nothing behind", async () => {
    const fetch = vi.fn(async () => response(Buffer.alloc(0), false));
    await expect(ensureKit("darwin-arm64", { vendorFolder: vendor, fetch })).rejects.toThrow(
      /Cannot get the Boriel BASIC kit kit\.tar\.gz/
    );
    expect(fs.readdirSync(path.join(vendor, "kits"))).toEqual([]);
    await expect(ensureKit("win32-x64", { vendorFolder: vendor, fetch })).rejects.toThrow(/no kit for win32-x64/);
  });

  it("replaces a damaged local copy", async () => {
    fs.mkdirSync(path.join(vendor, "kits"));
    fs.writeFileSync(path.join(vendor, "kits", "kit.tar.gz"), "damaged");
    await ensureKit("darwin-arm64", { vendorFolder: vendor, fetch: async () => response(BYTES) });
    expect(fs.readFileSync(path.join(vendor, "kits", "kit.tar.gz"))).toEqual(BYTES);
  });

  it("stages exactly one kit plus kit.json", async () => {
    fs.mkdirSync(path.join(vendor, "stage"));
    fs.writeFileSync(path.join(vendor, "stage", "stale.zip"), "old");
    await stageKit("darwin-arm64", { vendorFolder: vendor, fetch: async () => response(BYTES) });
    expect(fs.readdirSync(path.join(vendor, "stage")).sort()).toEqual(["kit.json", "kit.tar.gz"]);
  });

  it("matches the repository's kit.json and package scripts", () => {
    const manifest = readKitManifest(VENDOR_FOLDER);
    expect(manifest.urlBase).toBe("https://files.boriel-basic.net/v2/");
    for (const kit of Object.values(manifest.kits)) expect(kit.sha256).toMatch(/^[0-9a-f]{64}$/);
    const pkg = JSON.parse(fs.readFileSync(path.join(VENDOR_FOLDER, "../../package.json"), "utf8"));
    for (const name of ["package:win", "package:mac", "package:mac:arm64", "package:linux", "package:linux:arm64"]) {
      expect(pkg.scripts[`pre${name}`]).toMatch(/^node scripts\/boriel-kit\.cjs stage --platform \S+ --arch \S+$/);
      const [, platform, arch] = /--platform (\S+) --arch (\S+)/.exec(pkg.scripts[`pre${name}`])!;
      expect(manifest.kits[kitKey(platform, arch)]).toBeDefined();
    }
    expect(pkg.build.extraResources[0]).toMatchObject({ from: "vendor/boriel-basic/stage", to: "boriel" });
    expect(pkg.build.files).toContain("!vendor");
  });
});
