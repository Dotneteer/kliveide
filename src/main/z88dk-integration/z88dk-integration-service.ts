import fs from "fs";
import os from "os";
import path from "path";
import { execa } from "execa";

import type {
  Z88dkDownloadProgress,
  Z88dkProbeResult,
  Z88dkRelease,
  Z88dkReleaseAsset,
  Z88dkReleaseAssetKind,
  Z88dkReleaseDownloadRequest,
  Z88dkReleaseDownloadResult,
  Z88dkReleaseListResult,
  Z88dkReleasePlatform
} from "@common/messaging/Z88dkIntegration";
import { extractArchiveAsync } from "../tool-install/archive";
import { downloadToFile, isDownloadCancelled, type FetchLike } from "../tool-install/download";
import {
  isZ88dkRoot,
  normalizePath,
  rootOf,
  z88dkCandidateRoots,
  z88dkRunEnvironment,
  zccExecutableName,
  zccPathOf
} from "./z88dk-resolver";
import { formatZ88dkVersion, isSupportedBuild, isSupportedTag, compareTags, parseZccBanner } from "./z88dk-version";

/*
 * The main-process half of the Z88DK integration dialog (`.plans/Z88DK_INTEGRATION_PLAN.md` §4.2),
 * the counterpart of `sjasmplus-integration-service.ts`: probing a folder, detecting installs,
 * listing and installing GitHub releases, and the smoke test. Every zcc run uses
 * `z88dkRunEnvironment`, so the test runs zcc exactly as a build does.
 */

export const Z88DK_RELEASES_URL = "https://api.github.com/repos/z88dk/z88dk/releases";
export const Z88DK_RELEASES_PAGE = "https://github.com/z88dk/z88dk/releases";
const USER_AGENT = "klive-ide-z88dk-integration";

/** The marker an install made by Klive carries (`.ai/z88dk/README.md`). */
export const Z88DK_INSTALL_MARKER = ".klive-z88dk.json";

/** The smoke test's program: proves the driver, ZCCCFG, the compiler, the assembler and the libraries. */
const PROBE_SOURCE = "int main(void) { return 0; }\n";
const PROBE_TIMEOUT_MS = 60_000;
const VERSION_TIMEOUT_MS = 15_000;
/** The release list is fetched once per this period (GitHub allows 60 unauthenticated requests an hour). */
const RELEASE_CACHE_MS = 10 * 60_000;

type GithubAsset = { name?: unknown; browser_download_url?: unknown; size?: unknown; digest?: unknown };
type GithubRelease = {
  tag_name?: unknown;
  name?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

// ─── Probing and detection ──────────────────────────────────────────────────

/** Whether a folder (or zcc itself) is a z88dk install; no zcc run. */
export function probeZ88dkPath(itemPath: string, isWindows = process.platform === "win32"): Z88dkProbeResult {
  if (typeof itemPath !== "string" || !itemPath.trim()) return { ok: false, error: "Path is empty." };
  const input = itemPath.trim();
  if (!fs.existsSync(input)) return { ok: false, error: `Path does not exist: ${input}` };
  const stat = fs.statSync(input);
  // --- Picking `bin` itself is a common slip: its parent is the install
  let root = stat.isDirectory() ? normalizePath(input).replace(/\/+$/, "") : rootOf(input, isWindows);
  if (stat.isDirectory() && path.basename(root).toLowerCase() === "bin" && !isZ88dkRoot(root, isWindows)) {
    root = normalizePath(path.dirname(root));
  }
  if (!isZ88dkRoot(root, isWindows)) {
    return {
      ok: false,
      root,
      zccPath: zccPathOf(root, isWindows),
      error: `The selected folder is not a z88dk installation: it needs bin/${zccExecutableName(isWindows)} and lib/config.`
    };
  }
  return { ok: true, root, zccPath: zccPathOf(root, isWindows) };
}

/** The version an install's zcc reports, or undefined when it does not run. */
export async function readZ88dkVersion(
  root: string,
  isWindows = process.platform === "win32"
): Promise<{ version: string; build: number } | undefined> {
  try {
    const result = await execa(zccPathOf(root, isWindows), [], {
      env: z88dkRunEnvironment(root, process.env, isWindows),
      extendEnv: false,
      reject: false,
      stdin: "ignore",
      timeout: VERSION_TIMEOUT_MS
    });
    const parsed = parseZccBanner(`${result.stderr ?? ""}\n${result.stdout ?? ""}`);
    return parsed ? { version: formatZ88dkVersion(parsed), build: parsed.build } : undefined;
  } catch {
    return undefined;
  }
}

/** The installs found on this machine (`.ai/z88dk/README.md`, "Detection"), each with its version. */
export async function getZ88dkPathSuggestions(
  env: NodeJS.ProcessEnv = process.env,
  options: { isWindows?: boolean; home?: string; downloadFolders?: string[] } = {}
): Promise<Z88dkProbeResult[]> {
  const isWindows = options.isWindows ?? process.platform === "win32";
  const home = options.home ?? os.homedir();
  const downloadFolders = options.downloadFolders ?? kliveDownloadedRoots(path.join(home, "KliveTools", "z88dk"));
  const roots = z88dkCandidateRoots(env, { isWindows, home, downloadFolders }).filter((root) =>
    isZ88dkRoot(root, isWindows)
  );
  const suggestions: Z88dkProbeResult[] = [];
  for (const root of roots) {
    const version = await readZ88dkVersion(root, isWindows);
    suggestions.push({
      ok: true,
      root,
      zccPath: zccPathOf(root, isWindows),
      version: version?.version,
      build: version?.build,
      supported: version ? isSupportedBuild(version.build) : undefined
    });
  }
  return suggestions;
}

/** The release folders under Klive's download folder (`<folder>/<tag>`). */
export function kliveDownloadedRoots(folder: string): string[] {
  try {
    return fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => normalizePath(path.join(folder, entry.name)));
  } catch {
    return [];
  }
}

// ─── The smoke test ─────────────────────────────────────────────────────────

/**
 * Probes the folder, reads zcc's version and compiles a one-line program for `+zx`: that proves
 * ZCCCFG, the libraries and the bundled compiler work, not just that the driver starts (§4.1).
 */
export async function validateZ88dkInstall(
  itemPath: string,
  isWindows = process.platform === "win32"
): Promise<Z88dkProbeResult> {
  const probe = probeZ88dkPath(itemPath, isWindows);
  if (!probe.ok || !probe.root) return probe;
  const root = probe.root;

  const version = await readZ88dkVersion(root, isWindows);
  if (!version) {
    return { ...probe, ok: false, error: "zcc did not start, or did not report its version." };
  }
  const versioned: Z88dkProbeResult = {
    ...probe,
    version: version.version,
    build: version.build,
    supported: isSupportedBuild(version.build)
  };

  const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-z88dk-"));
  let stdout = "";
  let stderr = "";
  try {
    fs.writeFileSync(path.join(tempFolder, "probe.c"), PROBE_SOURCE, "utf8");
    const result = await execa(zccPathOf(root, isWindows), ["+zx", "-o", "probe", "probe.c"], {
      cwd: tempFolder,
      env: z88dkRunEnvironment(root, process.env, isWindows),
      extendEnv: false,
      reject: false,
      stdin: "ignore",
      timeout: PROBE_TIMEOUT_MS
    });
    stdout = String(result.stdout ?? "");
    stderr = String(result.stderr ?? "");
    if (result.timedOut) {
      return { ...versioned, ok: false, stdout, stderr, error: "The z88dk test compile did not finish in time." };
    }
    if (result.exitCode !== 0) {
      return {
        ...versioned,
        ok: false,
        stdout,
        stderr,
        error: describeFailure(`The z88dk test compile failed (exit code ${result.exitCode})`, stdout, stderr)
      };
    }
    const output = path.join(tempFolder, "probe");
    if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
      return {
        ...versioned,
        ok: false,
        stdout,
        stderr,
        error: describeFailure("zcc ran but did not write the test program", stdout, stderr)
      };
    }
    return { ...versioned, ok: true, stdout, stderr };
  } catch (error: any) {
    return { ...versioned, ok: false, stdout, stderr, error: error?.message ?? String(error) };
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

/** The first line zcc printed that explains the failure, appended to the summary. */
function describeFailure(summary: string, stdout: string, stderr: string): string {
  const detail = [stderr, stdout]
    .flatMap((text) => (text ?? "").split(/\r?\n/))
    .map((line) => line.trim())
    .find((line) => line && !/^zcc - Frontend/i.test(line));
  return detail ? `${summary}: ${detail}` : `${summary}.`;
}

// ─── Releases ───────────────────────────────────────────────────────────────

let releaseCache: { at: number; body: unknown[] } | undefined;

/** Forgets the cached release list (tests, and the dialog's Refresh). */
export function clearZ88dkReleaseCache(): void {
  releaseCache = undefined;
}

export async function listZ88dkReleases(
  request: { refresh?: boolean } = {},
  options: { fetch?: FetchLike; platform?: Z88dkReleasePlatform; now?: number } = {}
): Promise<Z88dkReleaseListResult> {
  const now = options.now ?? Date.now();
  let body = !request.refresh && releaseCache && now - releaseCache.at < RELEASE_CACHE_MS ? releaseCache.body : undefined;
  if (!body) {
    const fetcher = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetcher) throw new Error("Network fetch is not available in this runtime.");
    const response = await fetcher(`${Z88DK_RELEASES_URL}?per_page=50`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT }
    });
    if (!response.ok) {
      const limited = response.status === 403 || response.status === 429;
      throw new Error(
        `Cannot list z88dk releases. GitHub returned ${response.status} ${response.statusText}.` +
          (limited ? ` GitHub limits how often releases can be listed; try again later, or download from ${Z88DK_RELEASES_PAGE}.` : "")
      );
    }
    const json = await response.json();
    if (!Array.isArray(json)) throw new Error("Cannot list z88dk releases. GitHub returned an unexpected response.");
    body = json;
    releaseCache = { at: now, body };
  }

  const targetPlatform = options.platform ?? currentPlatform();
  const releases = body
    .map((release) => mapRelease(release as GithubRelease, targetPlatform))
    .filter((release): release is Z88dkRelease => !!release && !release.prerelease)
    .sort(compareReleases);
  const suggestedRelease = releases.find((release) => release.supported && release.compatibleAssets.length > 0);
  return {
    releases,
    suggestedRelease,
    suggestedAsset: suggestedRelease?.compatibleAssets[0],
    targetPlatform
  };
}

/** Supported releases first; newest first within each group. */
function compareReleases(left: Z88dkRelease, right: Z88dkRelease): number {
  if (left.supported !== right.supported) return left.supported ? -1 : 1;
  const byTag = compareTags(right.tagName, left.tagName);
  return byTag || Date.parse(right.publishedAt || "0") - Date.parse(left.publishedAt || "0");
}

function mapRelease(release: GithubRelease, targetPlatform: Z88dkReleasePlatform): Z88dkRelease | undefined {
  const tagName = readString(release.tag_name);
  if (!tagName) return undefined;
  const assets = Array.isArray(release.assets)
    ? release.assets
        .map((asset) => mapAsset(asset as GithubAsset, targetPlatform))
        .filter((asset): asset is Z88dkReleaseAsset => !!asset)
    : [];
  return {
    tagName,
    name: readString(release.name) || tagName,
    prerelease: release.prerelease === true,
    publishedAt: readString(release.published_at),
    htmlUrl: readString(release.html_url),
    supported: isSupportedTag(tagName),
    assets,
    compatibleAssets: assets.filter((asset) => asset.compatible)
  };
}

function mapAsset(asset: GithubAsset, targetPlatform: Z88dkReleasePlatform): Z88dkReleaseAsset | undefined {
  const name = readString(asset.name);
  const downloadUrl = readString(asset.browser_download_url);
  if (!name || !downloadUrl) return undefined;
  const { kind, platform } = classifyZ88dkAsset(name);
  const digest = readString(asset.digest);
  return {
    name,
    downloadUrl,
    size: typeof asset.size === "number" ? asset.size : 0,
    kind,
    platform,
    ...(digest ? { digest } : {}),
    compatible: kind === "binary" && platform !== "unknown" && platform === targetPlatform
  };
}

/**
 * What a release asset is (`.ai/z88dk/releases.md`): `z88dk-osx-<v>.zip` is the macOS build
 * (universal), `z88dk-win32-<v>.zip` the Windows build, `z88dk-src-<v>.tgz` the source.
 */
export function classifyZ88dkAsset(name: string): { kind: Z88dkReleaseAssetKind; platform: Z88dkReleasePlatform } {
  const lower = name.toLowerCase();
  if (/(^|[-_.])src([-_.]|$)/.test(lower) || /\.(tgz|tar\.gz|tar\.bz2|tar\.xz)$/.test(lower)) {
    return { kind: "source", platform: "unknown" };
  }
  if (/(^|[-_.])(osx|macos|darwin|mac)([-_.]|$)/.test(lower)) return { kind: "binary", platform: "macos" };
  if (/(^|[-_.])(win32|win64|windows|win)([-_.]|$)/.test(lower)) return { kind: "binary", platform: "windows" };
  if (/(^|[-_.])linux([-_.]|$)/.test(lower)) return { kind: "binary", platform: "linux" };
  return { kind: "binary", platform: "unknown" };
}

function currentPlatform(): Z88dkReleasePlatform {
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

// ─── Download and install ───────────────────────────────────────────────────

let progress: Z88dkDownloadProgress = { phase: "idle", receivedBytes: 0 };
let activeDownload: AbortController | undefined;

/** What the running download is doing; `idle` when none runs. */
export function getZ88dkDownloadProgress(): Z88dkDownloadProgress {
  return { ...progress };
}

/** Stops the running download (or extraction); the install folder is left untouched. */
export function cancelZ88dkDownload(): void {
  activeDownload?.abort();
}

export type Z88dkDownloadOptions = {
  fetch?: FetchLike;
  isWindows?: boolean;
  isMac?: boolean;
  /** The smoke test; replaced in tests, which have no zcc to run. */
  validate?: (root: string) => Promise<Z88dkProbeResult>;
  /** Removes macOS's quarantine attribute from the extracted tree (replaced in tests). */
  unquarantine?: (folder: string) => Promise<void>;
  now?: () => Date;
};

/**
 * Downloads a release asset and installs it as `<destination>/<tag>`: into a temp folder beside it,
 * checked (size, and sha256 when GitHub gives a digest), extracted without the archive's top
 * `z88dk/` folder, un-quarantined on macOS and smoke-tested, then renamed into place with
 * `.klive-z88dk.json` - so a failed or cancelled install leaves nothing behind.
 */
export async function downloadZ88dkRelease(
  request: Z88dkReleaseDownloadRequest,
  options: Z88dkDownloadOptions = {}
): Promise<Z88dkReleaseDownloadResult> {
  const requestError = validateDownloadRequest(request);
  if (requestError) return { ok: false, error: requestError };
  if (activeDownload) return { ok: false, error: "A z88dk download is already running." };
  const fetcher = options.fetch ?? (globalThis.fetch as FetchLike | undefined);
  if (!fetcher) return { ok: false, error: "Network fetch is not available in this runtime." };

  const isWindows = options.isWindows ?? process.platform === "win32";
  const isMac = options.isMac ?? process.platform === "darwin";
  const destination = request.destinationFolder.trim();
  const releaseTag = request.releaseTag.trim();
  const assetName = request.asset.name.trim();
  const installFolder = path.join(destination, sanitizeSegment(releaseTag));
  const root = normalizePath(installFolder);
  const base = { root, releaseTag, assetName };

  try {
    fs.mkdirSync(destination, { recursive: true });
  } catch (error: any) {
    return { ok: false, ...base, error: `Cannot create the download folder: ${error?.message ?? error}` };
  }
  if (fs.existsSync(installFolder)) {
    return { ok: false, ...base, error: `A z88dk release folder already exists: ${root}. Choose it under Local installation, or pick another folder.` };
  }

  const controller = new AbortController();
  activeDownload = controller;
  const tempFolder = fs.mkdtempSync(path.join(destination, ".klive-z88dk-"));
  const tempInstall = path.join(tempFolder, "install");
  const archive = path.join(tempFolder, sanitizeSegment(assetName));
  try {
    progress = { phase: "downloading", receivedBytes: 0, totalBytes: request.asset.size || undefined };
    const { bytes, sha256 } = await downloadToFile(fetcher, request.asset.downloadUrl, archive, {
      userAgent: USER_AGENT,
      what: "the z88dk release",
      signal: controller.signal,
      expectedBytes: request.asset.size || undefined,
      onProgress: (p) => (progress = { phase: "downloading", ...p })
    });
    if (request.asset.size > 0 && bytes !== request.asset.size) {
      return { ok: false, ...base, error: `Downloaded ${bytes} bytes, expected ${request.asset.size}.` };
    }
    progress = { ...progress, phase: "verifying" };
    const expected = /^sha256:([0-9a-f]{64})$/i.exec(request.asset.digest ?? "")?.[1]?.toLowerCase();
    if (expected && expected !== sha256) {
      return { ok: false, ...base, error: "The downloaded file does not match the checksum GitHub published for it." };
    }

    progress = { ...progress, phase: "extracting" };
    await extractArchiveAsync(archive, tempInstall, {
      stripComponents: topFolderOf(archive) ? 1 : 0,
      applyModes: !isWindows,
      signal: controller.signal
    });
    fs.rmSync(archive, { force: true });
    if (isMac) await (options.unquarantine ?? removeQuarantine)(tempInstall);

    progress = { ...progress, phase: "testing" };
    const tested = await (options.validate ?? ((folder: string) => validateZ88dkInstall(folder, isWindows)))(tempInstall);
    if (!tested.ok) {
      return { ...tested, ...base, ok: false, error: tested.error ?? "The downloaded z88dk failed its test." };
    }
    fs.writeFileSync(
      path.join(tempInstall, Z88DK_INSTALL_MARKER),
      JSON.stringify({ releaseTag, assetName, installedAt: (options.now?.() ?? new Date()).toISOString() }, null, 2)
    );
    fs.renameSync(tempInstall, installFolder);
    return {
      ...tested,
      ok: true,
      ...base,
      zccPath: zccPathOf(installFolder, isWindows)
    };
  } catch (error: any) {
    if (controller.signal.aborted || isDownloadCancelled(error)) {
      return { ok: false, ...base, cancelled: true, error: "The download was cancelled." };
    }
    return { ok: false, ...base, error: error?.message ?? String(error) };
  } finally {
    activeDownload = undefined;
    progress = { phase: "idle", receivedBytes: 0 };
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

/** Whether every entry of the zip sits in one top-level folder (both z88dk zips: `z88dk/`). */
export function topFolderOf(zipFile: string): string | undefined {
  // --- Reads the central directory only: the names, not the data
  const buffer = fs.readFileSync(zipFile);
  let tail = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      tail = offset;
      break;
    }
  }
  if (tail < 0) return undefined;
  let offset = buffer.readUInt32LE(tail + 16);
  let top: string | undefined;
  while (offset < buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength).replaceAll("\\", "/");
    offset += 46 + nameLength + extraLength + commentLength;
    const first = name.split("/")[0];
    if (!name.includes("/") || (top !== undefined && first !== top)) return undefined;
    top = first;
  }
  return top;
}

async function removeQuarantine(folder: string): Promise<void> {
  // --- Harmless when the attribute is absent (Klive's own download does not set it)
  await execa("xattr", ["-dr", "com.apple.quarantine", folder], { reject: false, timeout: 60_000 });
}

function validateDownloadRequest(request: Z88dkReleaseDownloadRequest): string | undefined {
  if (!request || typeof request !== "object") return "Invalid z88dk download request.";
  if (!request.releaseTag?.trim()) return "The z88dk release tag is required.";
  if (!request.destinationFolder?.trim()) return "The download folder is required.";
  if (!request.asset?.name?.trim() || !request.asset?.downloadUrl?.trim()) return "The z88dk release asset is required.";
  return undefined;
}

function sanitizeSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "release";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
