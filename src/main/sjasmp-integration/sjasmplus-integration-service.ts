import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { execa } from "execa";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import type {
  SjasmplusProbeResult,
  SjasmplusRelease,
  SjasmplusReleaseArch,
  SjasmplusReleaseAssetKind,
  SjasmplusReleaseAsset,
  SjasmplusReleaseDownloadRequest,
  SjasmplusReleaseDownloadResult,
  SjasmplusReleaseListRequest,
  SjasmplusReleaseListResult,
  SjasmplusReleasePlatform
} from "@common/messaging/SjasmplusIntegration";
import {
  getSjasmplusExecutableName,
  normalizeExecutablePath
} from "./sjasmplus-resolver";

const PROBE_SOURCE = [
  "  DEVICE ZXSPECTRUM48",
  "  ORG $8000",
  "start:",
  "  ld a, $42",
  "  ret",
  '  SAVEBIN "_probe.bin", start, $0003',
  ""
].join("\n");

const EXPECTED_PROBE_BYTES = [0x3e, 0x42, 0xc9];
const SJASMPLUS_RELEASES_URL = "https://api.github.com/repos/z00m128/sjasmplus/releases";

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  headers?: { get: (key: string) => string | null };
  arrayBuffer?: () => Promise<ArrayBuffer>;
  json: () => Promise<unknown>;
}>;

type GithubReleaseAsset = {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
};

type GithubRelease = {
  tag_name?: unknown;
  name?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

export function probeSjasmplusPath(
  itemPath: string,
  isWindows = process.platform === "win32"
): SjasmplusProbeResult {
  if (typeof itemPath !== "string" || !itemPath.trim()) {
    return { ok: false, error: "Path is empty." };
  }

  const normalizedInput = itemPath.trim();
  if (!fs.existsSync(normalizedInput)) {
    return { ok: false, error: `Path does not exist: ${normalizedInput}` };
  }

  const stat = fs.statSync(normalizedInput);
  if (stat.isDirectory()) {
    const executablePath = path.join(normalizedInput, getSjasmplusExecutableName(isWindows));
    if (!fs.existsSync(executablePath)) {
      return {
        ok: false,
        installFolder: normalizeExecutablePath(normalizedInput),
        executablePath: normalizeExecutablePath(executablePath),
        error: `The selected folder does not contain ${getSjasmplusExecutableName(isWindows)}.`
      };
    }
    return {
      ok: true,
      installFolder: normalizeExecutablePath(normalizedInput),
      executablePath: normalizeExecutablePath(executablePath)
    };
  }

  if (!stat.isFile()) {
    return { ok: false, error: `Path is not a file or folder: ${normalizedInput}` };
  }

  return {
    ok: true,
    installFolder: normalizeExecutablePath(path.dirname(normalizedInput)),
    executablePath: normalizeExecutablePath(normalizedInput)
  };
}

export function getSjasmplusPathSuggestions(
  envPath = process.env.PATH ?? "",
  isWindows = process.platform === "win32",
  pathExt = process.env.PATHEXT ?? ""
): SjasmplusProbeResult[] {
  const executableNames = getPathExecutableNames(isWindows, pathExt);
  const seenPaths = new Set<string>();
  const suggestions: SjasmplusProbeResult[] = [];

  for (const pathEntry of envPath.split(path.delimiter)) {
    const folder = stripPathEntryQuotes(pathEntry);
    if (!folder) continue;

    for (const executableName of executableNames) {
      const executablePath = path.join(folder, executableName);
      const normalizedPath = normalizeExecutablePath(executablePath);
      const lookupKey = isWindows ? normalizedPath.toLowerCase() : normalizedPath;
      if (seenPaths.has(lookupKey)) continue;
      seenPaths.add(lookupKey);

      if (!isUsablePathExecutable(executablePath, isWindows)) continue;

      const probe = probeSjasmplusPath(executablePath, isWindows);
      if (probe.ok) {
        suggestions.push(probe);
      }
    }
  }

  return suggestions;
}

export async function listSjasmplusReleases(
  request: SjasmplusReleaseListRequest = {},
  options: {
    fetch?: FetchLike;
    platform?: SjasmplusReleasePlatform;
    arch?: SjasmplusReleaseArch;
  } = {}
): Promise<SjasmplusReleaseListResult> {
  const fetcher = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
  if (!fetcher) {
    throw new Error("Network fetch is not available in this runtime.");
  }

  const response = await fetcher(SJASMPLUS_RELEASES_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "klive-ide-sjasmplus-integration"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Cannot list SJASMPLUS releases. GitHub returned ${response.status} ${response.statusText}.`
    );
  }

  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new Error("Cannot list SJASMPLUS releases. GitHub returned an unexpected response.");
  }

  const targetPlatform = options.platform ?? getCurrentReleasePlatform();
  const targetArch = options.arch ?? getCurrentReleaseArch();
  const releases = body
    .map((release) => mapGithubRelease(release as GithubRelease, targetPlatform, targetArch))
    .filter((release): release is SjasmplusRelease => !!release)
    .filter((release) => request.includePrereleases || !release.prerelease)
    .sort(compareReleasesByPublishedAtDesc);

  const suggestedRelease = releases.find((release) => release.compatibleAssets.length > 0);
  return {
    releases,
    suggestedRelease,
    suggestedAsset: suggestedRelease?.compatibleAssets[0],
    targetPlatform
  };
}

export async function downloadSjasmplusRelease(
  request: SjasmplusReleaseDownloadRequest,
  options: {
    fetch?: FetchLike;
    isWindows?: boolean;
  } = {}
): Promise<SjasmplusReleaseDownloadResult> {
  const error = validateDownloadRequest(request);
  if (error) {
    return { ok: false, error };
  }

  const fetcher = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
  if (!fetcher) {
    return { ok: false, error: "Network fetch is not available in this runtime." };
  }

  const isWindows = options.isWindows ?? (process.platform === "win32");
  const destinationFolder = request.destinationFolder.trim();
  const releaseTag = request.releaseTag.trim();
  const assetName = request.asset.name.trim();
  const installFolder = path.join(destinationFolder, "sjasmplus", sanitizePathSegment(releaseTag));
  const normalizedInstallFolder = normalizeExecutablePath(installFolder);

  if (!fs.existsSync(destinationFolder) || !fs.statSync(destinationFolder).isDirectory()) {
    return { ok: false, installFolder: normalizedInstallFolder, error: "Destination folder does not exist." };
  }

  if (fs.existsSync(installFolder)) {
    return {
      ok: false,
      installFolder: normalizedInstallFolder,
      error: `SJASMPLUS release folder already exists: ${normalizedInstallFolder}`
    };
  }

  const tempFolder = fs.mkdtempSync(path.join(destinationFolder, ".klive-sjasmplus-"));
  const tempInstallFolder = path.join(tempFolder, "install");
  const downloadFile = path.join(tempFolder, sanitizePathSegment(assetName));

  try {
    fs.mkdirSync(tempInstallFolder, { recursive: true });
    const downloadedBytes = await downloadAsset(fetcher, request.asset.downloadUrl, downloadFile);
    if (request.asset.size > 0 && downloadedBytes !== request.asset.size) {
      return {
        ok: false,
        installFolder: normalizedInstallFolder,
        releaseTag,
        assetName,
        error: `Downloaded ${downloadedBytes} bytes, expected ${request.asset.size}.`
      };
    }

    prepareDownloadedAsset(downloadFile, assetName, tempInstallFolder, isWindows);
    const executablePath = findSjasmplusExecutable(tempInstallFolder, isWindows);
    if (!executablePath) {
      return {
        ok: false,
        installFolder: normalizedInstallFolder,
        releaseTag,
        assetName,
        error: "Downloaded asset does not contain an SJASMPLUS executable."
      };
    }

    if (!isWindows) {
      fs.chmodSync(executablePath, 0o755);
    }

    fs.mkdirSync(path.dirname(installFolder), { recursive: true });
    fs.renameSync(tempInstallFolder, installFolder);
    const finalExecutablePath = path.join(
      installFolder,
      path.relative(tempInstallFolder, executablePath)
    );
    const probe = probeSjasmplusPath(finalExecutablePath, isWindows);
    return {
      ...probe,
      releaseTag,
      assetName
    };
  } catch (err: any) {
    return {
      ok: false,
      installFolder: normalizedInstallFolder,
      releaseTag,
      assetName,
      error: err?.message ?? String(err)
    };
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

export async function validateSjasmplusExecutable(
  executablePath: string
): Promise<SjasmplusProbeResult> {
  const probe = probeSjasmplusPath(executablePath);
  if (!probe.ok || !probe.executablePath) {
    return probe;
  }

  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-sjasmplus-"));
  const probeFile = path.join(tempFolder, "probe.asm");
  const outputFile = path.join(tempFolder, "_probe.bin");
  let stdout = "";
  let stderr = "";

  try {
    fs.writeFileSync(probeFile, PROBE_SOURCE, "utf8");
    const result = await execa(probe.executablePath, ["--nologo", probeFile], {
      cwd: tempFolder,
      reject: false,
      timeout: 15_000
    });
    stdout = result.stdout;
    stderr = result.stderr;

    if (result.exitCode !== 0) {
      return {
        ...probe,
        ok: false,
        stdout,
        stderr,
        error: describeFailure(`SJASMPLUS exited with code ${result.exitCode}`, stdout, stderr)
      };
    }

    if (!fs.existsSync(outputFile)) {
      return {
        ...probe,
        ok: false,
        stdout,
        stderr,
        error: describeFailure(
          "SJASMPLUS ran but did not create the test output file",
          stdout,
          stderr
        )
      };
    }

    const output = Array.from(fs.readFileSync(outputFile));
    const matchesExpected =
      output.length === EXPECTED_PROBE_BYTES.length &&
      output.every((value, index) => value === EXPECTED_PROBE_BYTES[index]);
    if (!matchesExpected) {
      return {
        ...probe,
        ok: false,
        stdout,
        stderr,
        error: describeFailure(
          "SJASMPLUS produced unexpected test output bytes",
          stdout,
          stderr
        )
      };
    }

    const version = await readSjasmplusVersion(probe.executablePath);
    return { ...probe, ok: true, version, stdout, stderr };
  } catch (err: any) {
    return {
      ...probe,
      ok: false,
      stdout,
      stderr,
      error: err?.message ?? String(err)
    };
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

function validateDownloadRequest(request: SjasmplusReleaseDownloadRequest): string | undefined {
  if (!request || typeof request !== "object") {
    return "Invalid SJASMPLUS download request.";
  }
  if (!request.releaseTag?.trim()) {
    return "SJASMPLUS release tag is required.";
  }
  if (!request.destinationFolder?.trim()) {
    return "Destination folder is required.";
  }
  if (!request.asset?.name?.trim() || !request.asset?.downloadUrl?.trim()) {
    return "SJASMPLUS release asset is required.";
  }
  return undefined;
}

async function downloadAsset(
  fetcher: FetchLike,
  downloadUrl: string,
  targetFile: string
): Promise<number> {
  const response = await fetcher(downloadUrl, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "klive-ide-sjasmplus-integration"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Cannot download SJASMPLUS release. Server returned ${response.status} ${response.statusText}.`
    );
  }

  if (response.body) {
    const nodeStream =
      typeof (Readable as any).fromWeb === "function"
        ? (Readable as any).fromWeb(response.body)
        : Readable.from(response.body as any);
    await pipeline(nodeStream, fs.createWriteStream(targetFile));
  } else if (response.arrayBuffer) {
    fs.writeFileSync(targetFile, Buffer.from(await response.arrayBuffer()));
  } else {
    throw new Error("Cannot download SJASMPLUS release. Response body is empty.");
  }

  return fs.statSync(targetFile).size;
}

function prepareDownloadedAsset(
  downloadFile: string,
  assetName: string,
  installFolder: string,
  isWindows: boolean
): void {
  const lowerName = assetName.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    extractZip(downloadFile, installFolder);
    return;
  }

  if (lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")) {
    extractTarGz(downloadFile, installFolder);
    return;
  }

  fs.copyFileSync(downloadFile, safeJoin(installFolder, getSjasmplusExecutableName(isWindows)));
}

function extractZip(zipFile: string, outputFolder: string): void {
  const buffer = fs.readFileSync(zipFile);
  const centralDirectoryOffset = findZipCentralDirectoryOffset(buffer);
  let offset = centralDirectoryOffset;

  while (offset < buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (!entryName || entryName.endsWith("/")) {
      fs.mkdirSync(safeJoin(outputFolder, entryName), { recursive: true });
      continue;
    }

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${entryName}.`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let fileData: Buffer;
    if (compressionMethod === 0) {
      fileData = compressedData;
    } else if (compressionMethod === 8) {
      fileData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${entryName}.`);
    }
    if (fileData.length !== uncompressedSize) {
      throw new Error(`Invalid ZIP entry size for ${entryName}.`);
    }

    const targetPath = safeJoin(outputFolder, entryName);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, fileData);
  }
}

function findZipCentralDirectoryOffset(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = Math.max(minimumOffset, buffer.length - 22); offset >= minimumOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return buffer.readUInt32LE(offset + 16);
    }
  }
  throw new Error("Invalid ZIP archive. End of central directory not found.");
}

function extractTarGz(tarGzFile: string, outputFolder: string): void {
  const buffer = zlib.gunzipSync(fs.readFileSync(tarGzFile));
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entryName = prefix ? `${prefix}/${name}` : name;
    const size = parseInt(readTarString(header, 124, 12).trim() || "0", 8);
    const typeFlag = readTarString(header, 156, 1);
    offset += 512;

    if (typeFlag === "5") {
      fs.mkdirSync(safeJoin(outputFolder, entryName), { recursive: true });
    } else if (typeFlag === "" || typeFlag === "0") {
      const targetPath = safeJoin(outputFolder, entryName);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, buffer.subarray(offset, offset + size));
    }

    offset += Math.ceil(size / 512) * 512;
  }
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const end = buffer.indexOf(0, offset);
  const safeEnd = end >= offset && end < offset + length ? end : offset + length;
  return buffer.toString("utf8", offset, safeEnd).trim();
}

function findSjasmplusExecutable(folder: string, isWindows: boolean): string | undefined {
  const expectedName = getSjasmplusExecutableName(isWindows).toLowerCase();
  const queue = [folder];

  while (queue.length > 0) {
    const currentFolder = queue.shift()!;
    for (const entry of fs.readdirSync(currentFolder, { withFileTypes: true })) {
      const entryPath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase() === expectedName) {
        return entryPath;
      }
    }
  }

  return undefined;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "release";
}

function safeJoin(baseFolder: string, itemPath: string): string {
  const targetPath = path.resolve(baseFolder, itemPath);
  const resolvedBase = path.resolve(baseFolder);
  if (targetPath !== resolvedBase && !targetPath.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Archive entry escapes the install folder: ${itemPath}`);
  }
  return targetPath;
}

function mapGithubRelease(
  release: GithubRelease,
  targetPlatform: SjasmplusReleasePlatform,
  targetArch: SjasmplusReleaseArch
): SjasmplusRelease | undefined {
  const tagName = readOptionalString(release.tag_name);
  if (!tagName) return undefined;

  const assets = Array.isArray(release.assets)
    ? release.assets
        .map((asset) =>
          mapGithubReleaseAsset(asset as GithubReleaseAsset, targetPlatform, targetArch)
        )
        .filter((asset): asset is SjasmplusReleaseAsset => !!asset)
    : [];

  return {
    tagName,
    name: readOptionalString(release.name) || tagName,
    prerelease: release.prerelease === true,
    publishedAt: readOptionalString(release.published_at),
    htmlUrl: readOptionalString(release.html_url),
    assets,
    compatibleAssets: assets.filter((asset) => asset.compatible)
  };
}

function mapGithubReleaseAsset(
  asset: GithubReleaseAsset,
  targetPlatform: SjasmplusReleasePlatform,
  targetArch: SjasmplusReleaseArch
): SjasmplusReleaseAsset | undefined {
  const name = readOptionalString(asset.name);
  const downloadUrl = readOptionalString(asset.browser_download_url);
  if (!name || !downloadUrl) return undefined;

  const kind = classifyAssetKind(name);
  const platform = classifyAssetPlatform(name);
  const arch = classifyAssetArch(name);
  return {
    name,
    downloadUrl,
    size: typeof asset.size === "number" ? asset.size : 0,
    kind,
    platform,
    arch,
    compatible: kind === "binary" && isCompatibleAsset(platform, arch, targetPlatform, targetArch)
  };
}

// --- Source archives ("...-src.tar.xz", "..._1.24.0+dfsg.orig.tar.xz") need a
// --- compiler, so they can never satisfy the integration.
function classifyAssetKind(assetName: string): SjasmplusReleaseAssetKind {
  const name = assetName.toLowerCase();
  if (/(-src\.|\.orig\.|[-_.]sources?[-_.])/.test(name) || /\.tar\.xz$/.test(name)) {
    return "source";
  }
  return "binary";
}

function classifyAssetPlatform(assetName: string): SjasmplusReleasePlatform {
  const name = assetName.toLowerCase();
  if (/(^|[^a-z])(win|windows|mingw|msvc)([^a-z]|$)/.test(name) || name.endsWith(".exe")) {
    return "windows";
  }
  if (/(^|[^a-z])(macos|darwin|osx|mac)([^a-z]|$)/.test(name)) {
    return "macos";
  }
  if (/(^|[^a-z])linux([^a-z]|$)/.test(name)) {
    return "linux";
  }
  return "unknown";
}

function classifyAssetArch(assetName: string): SjasmplusReleaseArch {
  const name = assetName.toLowerCase();
  if (/(^|[^a-z0-9])(arm64|aarch64)([^a-z0-9]|$)/.test(name)) {
    return "arm64";
  }
  if (/(^|[^a-z0-9])(x64|x86_64|amd64)([^a-z0-9]|$)/.test(name)) {
    return "x64";
  }
  if (/(^|[^a-z0-9])(x86|i386|i686)([^a-z0-9]|$)/.test(name)) {
    return "x86";
  }
  return "unknown";
}

function isCompatibleAsset(
  platform: SjasmplusReleasePlatform,
  arch: SjasmplusReleaseArch,
  targetPlatform: SjasmplusReleasePlatform,
  targetArch: SjasmplusReleaseArch
): boolean {
  if (platform !== targetPlatform) return false;
  return arch === targetArch || arch === "unknown";
}

function getCurrentReleasePlatform(): SjasmplusReleasePlatform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

function getCurrentReleaseArch(): SjasmplusReleaseArch {
  switch (process.arch) {
    case "x64":
      return "x64";
    case "arm64":
      return "arm64";
    case "ia32":
      return "x86";
    default:
      return "unknown";
  }
}

function compareReleasesByPublishedAtDesc(left: SjasmplusRelease, right: SjasmplusRelease): number {
  return Date.parse(right.publishedAt || "0") - Date.parse(left.publishedAt || "0");
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPathExecutableNames(isWindows: boolean, pathExt: string): string[] {
  if (!isWindows) {
    return ["sjasmplus"];
  }

  const extensions = pathExt
    .split(";")
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean);
  const normalizedExtensions = extensions.length > 0 ? extensions : [".exe", ".cmd", ".bat", ".com"];
  const names = ["sjasmplus.exe", "sjasmplus"];
  for (const extension of normalizedExtensions) {
    const suffix = extension.startsWith(".") ? extension : `.${extension}`;
    names.push(`sjasmplus${suffix}`);
  }

  return Array.from(new Set(names));
}

function stripPathEntryQuotes(pathEntry: string): string {
  return pathEntry.trim().replace(/^"(.*)"$/, "$1");
}

function isUsablePathExecutable(executablePath: string, isWindows: boolean): boolean {
  try {
    if (!fs.existsSync(executablePath) || !fs.statSync(executablePath).isFile()) {
      return false;
    }
    if (!isWindows) {
      fs.accessSync(executablePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

// --- The banner is long ("SjASMPlus Z80 Cross-Assembler v1.21.0 (https://...)").
// --- Keep just the version so it fits one line in the dialog and stays usable as
// --- stored metadata.
function compactVersion(banner: string): string {
  const version = /\bv?\d+\.\d+(?:\.\d+)?\b/.exec(banner);
  if (version) {
    return version[0].startsWith("v") ? version[0] : `v${version[0]}`;
  }
  return banner.replace(/\s*\(https?:\/\/[^)]*\)\s*$/, "").trim();
}

// --- Appends the first real diagnostic line SJASMPLUS printed, so a failure
// --- explains itself instead of showing only an exit code.
function describeFailure(summary: string, stdout: string, stderr: string): string {
  const detail = [stderr, stdout]
    .flatMap((output) => (output ?? "").split(/\r?\n/))
    .map((line) => line.trim())
    .find((line) => line && !/^SjASMPlus Z80 Cross-Assembler/i.test(line));
  return detail ? `${summary}: ${detail}` : `${summary}.`;
}

async function readSjasmplusVersion(executablePath: string): Promise<string | undefined> {
  try {
    for (const args of [["--version"], ["-version"]]) {
      const result = await execa(executablePath, args, {
        reject: false,
        timeout: 5_000
      });
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      if (result.exitCode === 0 && output) {
        return compactVersion(output.split(/\r?\n/)[0].trim());
      }
    }
  } catch {
    // Version detection is metadata only; the smoke compile above is the real validation.
  }
  return undefined;
}
