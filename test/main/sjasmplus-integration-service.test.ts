import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { afterEach, describe, expect, it } from "vitest";

import {
  downloadSjasmplusRelease,
  getSjasmplusPathSuggestions,
  listSjasmplusReleases,
  probeSjasmplusPath,
  validateSjasmplusExecutable
} from "@main/sjasmp-integration/sjasmplus-integration-service";

const tempFolders: string[] = [];

afterEach(() => {
  for (const folder of tempFolders.splice(0)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

describe("probeSjasmplusPath", () => {
  it("accepts a folder containing the platform executable", () => {
    const folder = createTempFolder();
    const executablePath = path.join(folder, "sjasmplus").replaceAll("\\", "/");
    fs.writeFileSync(executablePath, "");

    expect(probeSjasmplusPath(folder, false)).toEqual({
      ok: true,
      installFolder: folder,
      executablePath
    });
  });

  it("accepts an executable file directly", () => {
    const folder = createTempFolder();
    const executablePath = path.join(folder, "custom-sjasmplus").replaceAll("\\", "/");
    fs.writeFileSync(executablePath, "");

    expect(probeSjasmplusPath(executablePath, false)).toEqual({
      ok: true,
      installFolder: folder,
      executablePath
    });
  });

  it("reports a folder without the expected executable", () => {
    const folder = createTempFolder();
    const result = probeSjasmplusPath(folder, false);

    expect(result.ok).toBe(false);
    expect(result.installFolder).toBe(folder);
    expect(result.executablePath).toBe(`${folder}/sjasmplus`);
    expect(result.error).toContain("does not contain sjasmplus");
  });
});


// --- Real SJASMPLUS takes double-dash long options: "-nologo" is rejected as an
// --- unrecognized option. This fake enforces that contract so the smoke test
// --- cannot regress to a spelling that fails on a working assembler.
describe("validateSjasmplusExecutable", () => {
  it("validates a working assembler and reads its version", async () => {
    const executablePath = createFakeSjasmplus();

    const result = await validateSjasmplusExecutable(executablePath);

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    // --- The long banner is compacted to a one-line version
    expect(result.version).toBe("v1.21.0");
  });

  it("reports the assembler's own diagnostic instead of a bare exit code", async () => {
    const executablePath = createFakeSjasmplus({ failWith: "error: something went wrong" });

    const result = await validateSjasmplusExecutable(executablePath);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("error: something went wrong");
    expect(result.stderr).toContain("error: something went wrong");
  });
});

describe("getSjasmplusPathSuggestions", () => {
  it("returns executable SJASMPLUS candidates found on PATH", () => {
    const folder = createTempFolder();
    const executablePath = path.join(folder, "sjasmplus").replaceAll("\\", "/");
    fs.writeFileSync(executablePath, "");
    fs.chmodSync(executablePath, 0o755);

    expect(getSjasmplusPathSuggestions(folder, false)).toEqual([
      {
        ok: true,
        installFolder: folder,
        executablePath
      }
    ]);
  });

  it("deduplicates repeated PATH entries", () => {
    const folder = createTempFolder();
    const executablePath = path.join(folder, "sjasmplus").replaceAll("\\", "/");
    fs.writeFileSync(executablePath, "");
    fs.chmodSync(executablePath, 0o755);

    expect(getSjasmplusPathSuggestions(`${folder}${path.delimiter}${folder}`, false)).toHaveLength(1);
  });
});

describe("listSjasmplusReleases", () => {
  it("suggests the newest stable release with a compatible asset", async () => {
    const fetch = createFetch([
      createGithubRelease("v2.0.0", "2026-02-01T00:00:00Z", false, [
        createGithubAsset("sjasmplus-windows-x64.zip")
      ]),
      createGithubRelease("v1.0.0", "2026-01-01T00:00:00Z", false, [
        createGithubAsset("sjasmplus-linux-x64.zip")
      ])
    ]);

    const result = await listSjasmplusReleases(
      {},
      { fetch, platform: "linux", arch: "x64" }
    );

    expect(result.suggestedRelease?.tagName).toBe("v1.0.0");
    expect(result.suggestedAsset?.name).toBe("sjasmplus-linux-x64.zip");
    expect(result.releases.map((release) => release.tagName)).toEqual(["v2.0.0", "v1.0.0"]);
  });

  // --- Real upstream asset names. As of v1.24.0 sjasmplus ships Windows builds
  // --- and source archives only, so these are the shapes the dialog must handle.
  it("classifies the real upstream assets: Windows builds and source archives", async () => {
    const fetch = createFetch([
      createGithubRelease("v1.24.0", "2026-02-01T00:00:00Z", false, [
        createGithubAsset("sjasmplus-1.24.0-src.tar.xz"),
        createGithubAsset("sjasmplus-1.24.0.win.zip"),
        createGithubAsset("sjasmplus_1.24.0+dfsg.orig.tar.xz")
      ])
    ]);

    const onWindows = await listSjasmplusReleases({}, { fetch, platform: "windows", arch: "x64" });
    const assets = onWindows.releases[0].assets;

    expect(assets.map((asset) => asset.kind)).toEqual(["source", "binary", "source"]);
    expect(assets.map((asset) => asset.compatible)).toEqual([false, true, false]);
    expect(onWindows.suggestedAsset?.name).toBe("sjasmplus-1.24.0.win.zip");

    // --- Source archives never count as usable, whatever the platform
    const onMac = await listSjasmplusReleases({}, { fetch, platform: "macos", arch: "arm64" });

    expect(onMac.releases[0].compatibleAssets).toEqual([]);
    expect(onMac.suggestedRelease).toBeUndefined();
    expect(onMac.targetPlatform).toBe("macos");
  });

  it("hides prereleases by default and includes them on request", async () => {
    const fetch = createFetch([
      createGithubRelease("v2.0.0-beta", "2026-02-01T00:00:00Z", true, [
        createGithubAsset("sjasmplus-linux-x64.zip")
      ]),
      createGithubRelease("v1.0.0", "2026-01-01T00:00:00Z", false, [
        createGithubAsset("sjasmplus-linux-x64.zip")
      ])
    ]);

    const stableOnly = await listSjasmplusReleases(
      {},
      { fetch, platform: "linux", arch: "x64" }
    );
    const withPrereleases = await listSjasmplusReleases(
      { includePrereleases: true },
      { fetch, platform: "linux", arch: "x64" }
    );

    expect(stableOnly.releases.map((release) => release.tagName)).toEqual(["v1.0.0"]);
    expect(withPrereleases.releases.map((release) => release.tagName)).toEqual([
      "v2.0.0-beta",
      "v1.0.0"
    ]);
  });

  it("reports GitHub API failures", async () => {
    const fetch = async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => []
    });

    await expect(listSjasmplusReleases({}, { fetch })).rejects.toThrow(
      "GitHub returned 503 Service Unavailable"
    );
  });
});

describe("downloadSjasmplusRelease", () => {
  it("installs a direct executable asset into a versioned folder", async () => {
    const destinationFolder = createTempFolder();
    const result = await downloadSjasmplusRelease(
      {
        releaseTag: "v1.0.0",
        asset: createReleaseAsset("sjasmplus", "https://example.com/sjasmplus", 4),
        destinationFolder
      },
      { fetch: createDownloadFetch(Buffer.from([1, 2, 3, 4])), isWindows: false }
    );

    expect(result.ok).toBe(true);
    expect(result.installFolder).toBe(`${destinationFolder}/sjasmplus/v1.0.0`);
    expect(result.executablePath).toBe(`${destinationFolder}/sjasmplus/v1.0.0/sjasmplus`);
    expect(fs.existsSync(result.executablePath!)).toBe(true);
  });

  it("extracts a zip asset and finds the SJASMPLUS executable", async () => {
    const destinationFolder = createTempFolder();
    const zip = createStoredZip([
      {
        name: "sjasmplus-v1.0.0/bin/sjasmplus",
        data: Buffer.from([1, 2, 3, 4])
      }
    ]);
    const result = await downloadSjasmplusRelease(
      {
        releaseTag: "v1.0.0",
        asset: createReleaseAsset("sjasmplus-linux-x64.zip", "https://example.com/sjasmplus.zip", zip.length),
        destinationFolder
      },
      { fetch: createDownloadFetch(zip), isWindows: false }
    );

    expect(result.ok).toBe(true);
    expect(result.executablePath).toBe(
      `${destinationFolder}/sjasmplus/v1.0.0/sjasmplus-v1.0.0/bin/sjasmplus`
    );
  });

  it("extracts a tar.gz asset and finds the SJASMPLUS executable", async () => {
    const destinationFolder = createTempFolder();
    const archive = createTarGz([
      {
        name: "sjasmplus-v1.0.0/bin/sjasmplus",
        data: Buffer.from([1, 2, 3, 4])
      }
    ]);
    const result = await downloadSjasmplusRelease(
      {
        releaseTag: "v1.0.0",
        asset: createReleaseAsset(
          "sjasmplus-linux-x64.tar.gz",
          "https://example.com/sjasmplus.tar.gz",
          archive.length
        ),
        destinationFolder
      },
      { fetch: createDownloadFetch(archive), isWindows: false }
    );

    expect(result.ok).toBe(true);
    expect(result.executablePath).toBe(
      `${destinationFolder}/sjasmplus/v1.0.0/sjasmplus-v1.0.0/bin/sjasmplus`
    );
  });

  it("does not overwrite an existing release folder", async () => {
    const destinationFolder = createTempFolder();
    fs.mkdirSync(path.join(destinationFolder, "sjasmplus", "v1.0.0"), { recursive: true });

    const result = await downloadSjasmplusRelease(
      {
        releaseTag: "v1.0.0",
        asset: createReleaseAsset("sjasmplus", "https://example.com/sjasmplus", 4),
        destinationFolder
      },
      { fetch: createDownloadFetch(Buffer.from([1, 2, 3, 4])), isWindows: false }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("already exists");
  });
});

function createTempFolder(): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-sjasmplus-test-"));
  tempFolders.push(folder);
  return folder.replaceAll("\\", "/");
}

function createFetch(releases: any[]) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => releases
  });
}

function createGithubRelease(
  tagName: string,
  publishedAt: string,
  prerelease: boolean,
  assets: any[]
) {
  return {
    tag_name: tagName,
    name: tagName,
    prerelease,
    published_at: publishedAt,
    html_url: `https://github.com/z00m128/sjasmplus/releases/tag/${tagName}`,
    assets
  };
}

function createGithubAsset(name: string) {
  return {
    name,
    browser_download_url: `https://github.com/z00m128/sjasmplus/releases/download/test/${name}`,
    size: 1024
  };
}

function createReleaseAsset(name: string, downloadUrl: string, size: number) {
  return {
    name,
    downloadUrl,
    size,
    platform: "linux" as const,
    arch: "x64" as const,
    compatible: true
  };
}

function createDownloadFetch(body: Buffer) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    json: async () => []
  });
}

function createStoredZip(entries: { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + entry.data.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralData.length, 12);
  endRecord.writeUInt32LE(localData.length, 16);

  return Buffer.concat([localData, centralData, endRecord]);
}

function createTarGz(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, "utf8");
    header.write("0000777", 100, "ascii");
    header.write("0000000", 108, "ascii");
    header.write("0000000", 116, "ascii");
    header.write(entry.data.length.toString(8).padStart(11, "0"), 124, "ascii");
    header.write("00000000000", 136, "ascii");
    header.fill(" ", 148, 156);
    header.write("0", 156, "ascii");
    header.write("ustar", 257, "ascii");
    const checksum = header.reduce((sum, value) => sum + value, 0);
    header.write(checksum.toString(8).padStart(6, "0"), 148, "ascii");
    header[154] = 0;
    header[155] = 0x20;

    parts.push(header, entry.data);
    const padding = (512 - (entry.data.length % 512)) % 512;
    if (padding > 0) {
      parts.push(Buffer.alloc(padding));
    }
  }
  parts.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

// --- Mimics the SJASMPLUS CLI: rejects single-dash long options, honours
// --- --nologo/--version, and assembles the probe source into _probe.bin.
function createFakeSjasmplus(options?: { failWith?: string }): string {
  const folder = createTempFolder();
  const executablePath = path.join(folder, "sjasmplus");
  const failure = options?.failWith;
  const script = [
    "#!/bin/sh",
    'BANNER="SjASMPlus Z80 Cross-Assembler v1.21.0"',
    "SOURCE=''",
    "for ARG in \"$@\"; do",
    "  case \"$ARG\" in",
    "    --version) echo \"$BANNER\"; exit 0 ;;",
    "    --nologo) ;;",
    "    -*) echo \"error: unrecognized option: $ARG\" >&2; exit 1 ;;",
    "    *) SOURCE=\"$ARG\" ;;",
    "  esac",
    "done",
    failure ? `echo "${failure}" >&2; exit 1` : "",
    '[ -n "$SOURCE" ] || { echo "error: no source file" >&2; exit 1; }',
    "printf '\\076\\102\\311' > _probe.bin",
    "exit 0"
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(executablePath, script + "\n", "utf8");
  fs.chmodSync(executablePath, 0o755);
  return executablePath.replaceAll("\\", "/");
}
