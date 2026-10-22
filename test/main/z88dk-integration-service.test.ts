import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cancelZ88dkDownload,
  classifyZ88dkAsset,
  clearZ88dkReleaseCache,
  downloadZ88dkRelease,
  getZ88dkDownloadProgress,
  getZ88dkPathSuggestions,
  listZ88dkReleases,
  probeZ88dkPath,
  topFolderOf,
  validateZ88dkInstall,
  Z88DK_INSTALL_MARKER
} from "@main/z88dk-integration/z88dk-integration-service";
import type { Z88dkReleaseAsset } from "@common/messaging/Z88dkIntegration";
import { zipBuffer } from "./helpers/zip-writer";

const BANNER = "zcc - Frontend for the z88dk Cross-C Compiler - v23854-4d530b6eb7-20251002";
const isWindows = process.platform === "win32";
let tempRoot: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "klive-z88dk-test-"));
  clearZ88dkReleaseCache();
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

/** A folder shaped like an install; `zcc` is a shell script that behaves like the real one. */
function fakeInstall(folder: string, options: { build?: number; failCompile?: boolean } = {}): string {
  fs.mkdirSync(path.join(folder, "bin"), { recursive: true });
  fs.mkdirSync(path.join(folder, "lib", "config"), { recursive: true });
  const banner = BANNER.replace("23854", String(options.build ?? 23854));
  const script = [
    "#!/bin/sh",
    `if [ $# -eq 0 ]; then echo "${banner}" >&2; exit 0; fi`,
    '[ -n "$ZCCCFG" ] || { echo "no ZCCCFG" >&2; exit 1; }',
    options.failCompile ? 'echo "probe.c:1:1: error: broken library" >&2; exit 1' : 'printf "\\303" > probe; exit 0',
    ""
  ].join("\n");
  fs.writeFileSync(path.join(folder, "bin", isWindows ? "zcc.exe" : "zcc"), script, { mode: 0o755 });
  return folder.replaceAll("\\", "/");
}

describe("classifyZ88dkAsset", () => {
  it("classifies the three real v2.4 asset names", () => {
    expect(classifyZ88dkAsset("z88dk-osx-2.4.zip")).toEqual({ kind: "binary", platform: "macos" });
    expect(classifyZ88dkAsset("z88dk-win32-2.4.zip")).toEqual({ kind: "binary", platform: "windows" });
    expect(classifyZ88dkAsset("z88dk-src-2.4.tgz")).toEqual({ kind: "source", platform: "unknown" });
  });

  it("classifies the v1.99C names with their capital letter", () => {
    expect(classifyZ88dkAsset("z88dk-osx-1.99C.zip").platform).toBe("macos");
    expect(classifyZ88dkAsset("z88dk-src-1.99C.tgz").kind).toBe("source");
  });
});

describe("probeZ88dkPath", () => {
  it("accepts an install folder, zcc itself, and the bin folder", () => {
    const root = fakeInstall(path.join(tempRoot, "z88dk"));
    expect(probeZ88dkPath(root, isWindows)).toMatchObject({ ok: true, root });
    expect(probeZ88dkPath(path.join(root, "bin", isWindows ? "zcc.exe" : "zcc"), isWindows)).toMatchObject({ ok: true, root });
    expect(probeZ88dkPath(path.join(root, "bin"), isWindows)).toMatchObject({ ok: true, root });
  });

  it("explains a folder that is not an install", () => {
    fs.mkdirSync(path.join(tempRoot, "empty"));
    const result = probeZ88dkPath(path.join(tempRoot, "empty"), isWindows);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/needs bin\/zcc(\.exe)? and lib\/config/);
  });

  it("reports a missing path and an empty one", () => {
    expect(probeZ88dkPath("", isWindows).error).toBe("Path is empty.");
    expect(probeZ88dkPath(path.join(tempRoot, "nope"), isWindows).error).toMatch(/does not exist/);
  });
});

describe.skipIf(isWindows)("validateZ88dkInstall (fake zcc)", () => {
  it("reads the version and passes the smoke test", async () => {
    const root = fakeInstall(path.join(tempRoot, "z88dk"));
    const result = await validateZ88dkInstall(root, false);
    expect(result).toMatchObject({ ok: true, root, version: "v23854-4d530b6eb7-20251002", build: 23854, supported: true });
  });

  it("marks an older build as unsupported but still usable", async () => {
    const root = fakeInstall(path.join(tempRoot, "z88dk"), { build: 22110 });
    const result = await validateZ88dkInstall(root, false);
    expect(result).toMatchObject({ ok: true, build: 22110, supported: false });
  });

  it("reports zcc's own diagnostic when the test compile fails", async () => {
    const root = fakeInstall(path.join(tempRoot, "z88dk"), { failCompile: true });
    const result = await validateZ88dkInstall(root, false);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("The z88dk test compile failed (exit code 1): probe.c:1:1: error: broken library");
    expect(result.version).toBe("v23854-4d530b6eb7-20251002");
  });
});

describe.skipIf(isWindows)("getZ88dkPathSuggestions", () => {
  it("finds zcc on PATH, the Z88DK variable and Klive's download folder, once each", async () => {
    const onPath = fakeInstall(path.join(tempRoot, "onpath"));
    const fromEnv = fakeInstall(path.join(tempRoot, "fromenv"));
    const downloaded = fakeInstall(path.join(tempRoot, "home", "KliveTools", "z88dk", "v2.4"));
    const suggestions = await getZ88dkPathSuggestions(
      { PATH: `${path.join(onPath, "bin")}:${path.join(onPath, "bin")}`, Z88DK: fromEnv },
      { isWindows: false, home: path.join(tempRoot, "home") }
    );
    const roots = suggestions.map((s) => s.root);
    expect(roots.slice(0, 3)).toEqual([onPath, fromEnv, downloaded]);
    expect(suggestions[0]).toMatchObject({ version: "v23854-4d530b6eb7-20251002", supported: true });
  });
});

describe("listZ88dkReleases", () => {
  const github = [
    release("v2.3", "2023-12-20T11:20:17Z", [
      asset("z88dk-osx-2.3.zip", 63894084),
      asset("z88dk-src-2.3.tgz", 47993432),
      asset("z88dk-win32-2.3.zip", 106298674)
    ]),
    release("v2.4", "2025-10-02T07:36:53Z", [
      asset("z88dk-osx-2.4.zip", 71934026, "sha256:96af39ddb264a1158846c176c2ca3cc0f34b8b29b8233dd554229f11d8650d07"),
      asset("z88dk-src-2.4.tgz", 55296853),
      asset("z88dk-win32-2.4.zip", 117797132)
    ]),
    release("v1.99c", "2019-01-19T12:09:48Z", [asset("z88dk-osx-1.99C.zip", 46356194)])
  ];

  it("lists supported releases first and suggests the newest supported one for this platform", async () => {
    const result = await listZ88dkReleases({}, { fetch: jsonFetch(github), platform: "macos" });
    expect(result.releases.map((r) => [r.tagName, r.supported])).toEqual([
      ["v2.4", true],
      ["v2.3", false],
      ["v1.99c", false]
    ]);
    expect(result.suggestedRelease?.tagName).toBe("v2.4");
    expect(result.suggestedAsset).toMatchObject({
      name: "z88dk-osx-2.4.zip",
      size: 71934026,
      digest: "sha256:96af39ddb264a1158846c176c2ca3cc0f34b8b29b8233dd554229f11d8650d07"
    });
  });

  it("offers nothing on Linux, where no binary is published", async () => {
    const result = await listZ88dkReleases({}, { fetch: jsonFetch(github), platform: "linux" });
    expect(result.releases.every((r) => r.compatibleAssets.length === 0)).toBe(true);
    expect(result.suggestedRelease).toBeUndefined();
    expect(result.targetPlatform).toBe("linux");
  });

  it("asks GitHub once and serves the cached list until a refresh", async () => {
    let calls = 0;
    const fetch = async (...args: any[]) => {
      calls++;
      return jsonFetch(github)(...args);
    };
    await listZ88dkReleases({}, { fetch, platform: "windows", now: 1000 });
    await listZ88dkReleases({}, { fetch, platform: "windows", now: 2000 });
    expect(calls).toBe(1);
    await listZ88dkReleases({ refresh: true }, { fetch, platform: "windows", now: 3000 });
    expect(calls).toBe(2);
  });

  it("explains GitHub's rate limit", async () => {
    const fetch = async () => ({ ok: false, status: 403, statusText: "Forbidden", json: async () => ({}) });
    await expect(listZ88dkReleases({}, { fetch, platform: "macos" })).rejects.toThrow(
      /GitHub returned 403 Forbidden\. GitHub limits how often releases can be listed.*github\.com\/z88dk\/z88dk\/releases/
    );
  });
});

describe("downloadZ88dkRelease", () => {
  const releaseZip = () =>
    zipBuffer([
      { name: "z88dk/", data: "" },
      { name: "z88dk/bin/zcc", data: "#!/bin/sh\n", mode: 0o755 },
      { name: "z88dk/lib/config/zx.cfg", data: "CRT0 zx\n", deflate: true },
      { name: "z88dk/include/stdio.h", data: "/* stdio */\n".repeat(50), deflate: true }
    ]);

  it("installs the release as <folder>/<tag>, without the zip's top folder, with the marker", async () => {
    const body = releaseZip();
    const destination = path.join(tempRoot, "KliveTools", "z88dk");
    const validated: string[] = [];
    const result = await downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: zipAsset(body), destinationFolder: destination },
      {
        fetch: bodyFetch(body),
        isWindows: false,
        isMac: false,
        validate: async (root) => {
          validated.push(root);
          return { ok: true, root, version: "v23854-4d530b6eb7-20251002", build: 23854, supported: true };
        },
        now: () => new Date("2026-10-18T12:00:00Z")
      }
    );
    const root = path.join(destination, "v2.4");
    expect(result).toMatchObject({ ok: true, root: root.replaceAll("\\", "/"), releaseTag: "v2.4", build: 23854 });
    expect(fs.readFileSync(path.join(root, "lib", "config", "zx.cfg"), "utf8")).toBe("CRT0 zx\n");
    expect(fs.existsSync(path.join(root, "z88dk"))).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(root, Z88DK_INSTALL_MARKER), "utf8"))).toEqual({
      releaseTag: "v2.4",
      assetName: "z88dk-osx-2.4.zip",
      installedAt: "2026-10-18T12:00:00.000Z"
    });
    // --- The test ran on the extracted tree before it was moved into place
    expect(validated[0]).not.toBe(root);
    // --- No temp folder is left behind
    expect(fs.readdirSync(destination)).toEqual(["v2.4"]);
    if (!isWindows) expect(fs.statSync(path.join(root, "bin", "zcc")).mode & 0o111).not.toBe(0);
  });

  it("refuses a download whose size differs from GitHub's", async () => {
    const body = releaseZip();
    const destination = path.join(tempRoot, "dl");
    const result = await downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: { ...zipAsset(body), size: body.length + 1 }, destinationFolder: destination },
      { fetch: bodyFetch(body), isMac: false, validate: async () => ({ ok: true }) }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe(`Downloaded ${body.length} bytes, expected ${body.length + 1}.`);
    expect(fs.readdirSync(destination)).toEqual([]);
  });

  it("refuses a download that does not match GitHub's sha256 digest", async () => {
    const body = releaseZip();
    const destination = path.join(tempRoot, "dl");
    const result = await downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: { ...zipAsset(body), digest: `sha256:${"0".repeat(64)}` }, destinationFolder: destination },
      { fetch: bodyFetch(body), isMac: false, validate: async () => ({ ok: true }) }
    );
    expect(result.error).toMatch(/does not match the checksum/);
    expect(fs.readdirSync(destination)).toEqual([]);
  });

  it("keeps nothing when the smoke test fails", async () => {
    const body = releaseZip();
    const destination = path.join(tempRoot, "dl");
    const result = await downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: zipAsset(body), destinationFolder: destination },
      { fetch: bodyFetch(body), isMac: false, validate: async () => ({ ok: false, error: "zcc did not start." }) }
    );
    expect(result).toMatchObject({ ok: false, error: "zcc did not start." });
    expect(fs.readdirSync(destination)).toEqual([]);
  });

  it("does not overwrite an existing release folder", async () => {
    const body = releaseZip();
    const destination = path.join(tempRoot, "dl");
    fs.mkdirSync(path.join(destination, "v2.4"), { recursive: true });
    const result = await downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: zipAsset(body), destinationFolder: destination },
      { fetch: bodyFetch(body), isMac: false, validate: async () => ({ ok: true }) }
    );
    expect(result.error).toMatch(/already exists/);
  });

  it("reports progress while it downloads and stops on Cancel", async () => {
    const destination = path.join(tempRoot, "dl");
    const seen: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    // --- A body that delivers one chunk, then waits for the test to cancel
    const fetch = async (_url: string, init?: { signal?: AbortSignal }) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (key: string) => (key === "content-length" ? "2000" : null) },
      body: {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array(1000);
          await gate;
          if (init?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
          yield new Uint8Array(1000);
        }
      },
      json: async () => ({})
    });
    const running = downloadZ88dkRelease(
      { releaseTag: "v2.4", asset: { ...zipAsset(Buffer.alloc(2000)), size: 2000 }, destinationFolder: destination },
      { fetch, isMac: false, validate: async () => ({ ok: true }) }
    );
    for (let i = 0; i < 50 && getZ88dkDownloadProgress().receivedBytes === 0; i++) await new Promise((r) => setTimeout(r, 5));
    seen.push(getZ88dkDownloadProgress().receivedBytes);
    expect(getZ88dkDownloadProgress()).toMatchObject({ phase: "downloading", receivedBytes: 1000, totalBytes: 2000 });
    cancelZ88dkDownload();
    release();
    const result = await running;
    expect(result).toMatchObject({ ok: false, cancelled: true });
    expect(seen).toEqual([1000]);
    expect(getZ88dkDownloadProgress().phase).toBe("idle");
    expect(fs.readdirSync(destination)).toEqual([]);
  });
});

describe("topFolderOf", () => {
  it("finds the single top folder of a release zip, and none for a flat one", () => {
    const nested = path.join(tempRoot, "nested.zip");
    fs.writeFileSync(nested, zipBuffer([{ name: "z88dk/bin/zcc" }, { name: "z88dk/README.md" }]));
    expect(topFolderOf(nested)).toBe("z88dk");
    const flat = path.join(tempRoot, "flat.zip");
    fs.writeFileSync(flat, zipBuffer([{ name: "bin/zcc" }, { name: "README.md" }]));
    expect(topFolderOf(flat)).toBeUndefined();
  });
});

// --- A real install, when this machine has one (never in CI)
const realRoot = process.env.Z88DK_ROOT || path.join(os.homedir(), "z88dk");
describe.skipIf(!fs.existsSync(path.join(realRoot, "lib", "config")))("validateZ88dkInstall (real z88dk)", () => {
  it("compiles the smoke test", async () => {
    const result = await validateZ88dkInstall(realRoot);
    expect(result.ok, result.error).toBe(true);
    expect(result.build).toBeGreaterThan(20000);
  }, 60_000);
});

// --- The real download: ~72-118 MB, opt-in only
describe.skipIf(process.env.Z88DK_DOWNLOAD_TEST !== "1")("downloadZ88dkRelease (real GitHub)", () => {
  it("installs and tests the newest supported release", async () => {
    const list = await listZ88dkReleases({ refresh: true });
    expect(list.suggestedAsset).toBeDefined();
    const result = await downloadZ88dkRelease({
      releaseTag: list.suggestedRelease!.tagName,
      asset: list.suggestedAsset!,
      destinationFolder: path.join(tempRoot, "real")
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.supported).toBe(true);
  }, 900_000);
});

function release(tag: string, publishedAt: string, assets: any[]) {
  return { tag_name: tag, name: tag, prerelease: false, published_at: publishedAt, html_url: `https://github.com/z88dk/z88dk/releases/tag/${tag}`, assets };
}

function asset(name: string, size: number, digest: string | null = null) {
  return { name, size, digest, browser_download_url: `https://github.com/z88dk/z88dk/releases/download/x/${name}` };
}

function jsonFetch(body: unknown) {
  return async (..._args: any[]) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });
}

function zipAsset(body: Buffer): Z88dkReleaseAsset {
  return {
    name: "z88dk-osx-2.4.zip",
    downloadUrl: "https://example.invalid/z88dk-osx-2.4.zip",
    size: body.length,
    kind: "binary",
    platform: "macos",
    digest: `sha256:${crypto.createHash("sha256").update(body).digest("hex")}`,
    compatible: true
  };
}

function bodyFetch(body: Buffer) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    json: async () => ({})
  });
}
