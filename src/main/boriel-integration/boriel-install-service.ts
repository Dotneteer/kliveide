import fs from "fs";
import path from "path";
import { execa } from "execa";

import type {
  BorielInstallation,
  BorielInstallResult,
  BorielSetupStatus
} from "@common/messaging/BorielIntegration";
import { extractArchive } from "../tool-install/archive";
import { BORIEL_DEFAULT_FOLDER_NAME, BORIEL_MARKER_FILE } from "./boriel-config";
import {
  locateBundledKit,
  verifyKitArchive,
  type BorielKitLocation,
  type LocatedKit
} from "./boriel-kit";
import {
  borielExecutableName,
  probeBoriel,
  resolveBorielExecutable,
  runZxbcVersion,
  type SettingsReaderLike,
  type VersionRunner
} from "./boriel-resolver";
import { compareBorielVersions } from "./boriel-version";

/*
 * Installing the bundled Boriel BASIC kit and reporting on what is installed
 * (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.2-§3.5). It never deletes a folder it did not
 * create, and an update replaces only a folder that carries Klive's marker.
 */

/** The user's earlier answer to the setup offer (`AppSettings.borielSetup`; `offeredVersion` "*": any). */
export type BorielSetupRecord = { offeredVersion?: string; declined?: boolean; installedVersion?: string };

export type BorielServiceDeps = {
  kitLocation: BorielKitLocation;
  platformKey: string;
  platform: string;
  homeDir: string;
  /** Folders an installation must never go into (the app's own). */
  protectedFolders: string[];
  settings: SettingsReaderLike;
  setupRecord: BorielSetupRecord | undefined;
  runner?: VersionRunner;
  clearQuarantine?: (folder: string) => Promise<void>;
};

/** The files of the kit that must be executable, whatever the archive recorded. */
const EXECUTABLES = [
  "zxbc",
  "zxbasm",
  "zxbpp",
  "tools/zxbpack",
  "tools/nextcreator",
  "tools/modman",
  "arch/zx81sd/tools/build_sd81",
  "arch/zx81sd/tools/gen_map",
  "arch/zx81sd/tools/split_sd81"
];

export function defaultBorielFolder(homeDir: string): string {
  return path.join(homeDir, BORIEL_DEFAULT_FOLDER_NAME);
}

/** "~/x" → `<home>/x`, then made absolute. */
export function normalizeFolder(folder: string, homeDir: string): string {
  const trimmed = (folder ?? "").trim();
  const expanded = trimmed === "~" || /^~[\\/]/.test(trimmed) ? path.join(homeDir, trimmed.slice(1)) : trimmed;
  return expanded ? path.resolve(expanded) : "";
}

export async function getBorielSetupStatus(deps: BorielServiceDeps): Promise<BorielSetupStatus> {
  const { kit } = locateBundledKit(deps.kitLocation, deps.platformKey);
  const installation = await readInstallation(deps, kit.kind === "available" ? kit.version : undefined);
  const record = deps.setupRecord ?? {};
  return {
    kit,
    installation,
    defaultFolder: defaultBorielFolder(deps.homeDir),
    // --- "*" declines every version (the Playwright harnesses seed it, so no offer blocks them)
    declined:
      !!record.declined &&
      kit.kind === "available" &&
      (record.offeredVersion === "*" || record.offeredVersion === kit.version)
  };
}

/** What Klive should do about Boriel BASIC at startup. */
export type BorielStartupAction =
  | { kind: "none" }
  | { kind: "offer"; status: BorielSetupStatus }
  // --- A working installation sits in the default folder but the settings do not know it yet
  | { kind: "adopt"; folder: string; executablePath: string; version: string };

export async function decideBorielStartup(deps: BorielServiceDeps): Promise<BorielStartupAction> {
  const status = await getBorielSetupStatus(deps);
  if (status.kit.kind !== "available") return { kind: "none" };
  const { installation } = status;
  if (installation.kind === "working" && !installation.outdated) return { kind: "none" };
  if (installation.kind === "notConfigured") {
    const folder = status.defaultFolder;
    const probe = await probeBoriel(
      path.join(folder, borielExecutableName(deps.platform === "win32")),
      deps.runner ?? runZxbcVersion,
      deps.platform
    );
    if (probe.ok && compareBorielVersions(probe.version, status.kit.version) >= 0) {
      return { kind: "adopt", folder, executablePath: probe.executablePath, version: probe.version! };
    }
  }
  return status.declined ? { kind: "none" } : { kind: "offer", status };
}

/** Why `folder` cannot receive an installation, or undefined when it can. */
export function validateInstallFolder(folder: string, deps: BorielServiceDeps): string | undefined {
  if (!folder) return "Choose a folder to install Boriel BASIC into.";
  if (!path.isAbsolute(folder)) return "The installation folder must be an absolute path.";
  for (const protectedFolder of deps.protectedFolders.filter(Boolean)) {
    const base = path.resolve(protectedFolder);
    if (folder === base || folder.startsWith(base + path.sep)) {
      return "Boriel BASIC cannot be installed inside Klive's own folders.";
    }
  }
  if (fs.existsSync(folder)) {
    if (!fs.statSync(folder).isDirectory()) return `${folder} is a file, not a folder.`;
    const entries = fs.readdirSync(folder).filter((name) => name !== ".DS_Store");
    if (entries.length > 0 && !fs.existsSync(path.join(folder, BORIEL_MARKER_FILE))) {
      return (
        `${folder} is not empty, and Klive did not install Boriel BASIC there. ` +
        "Choose an empty or a new folder."
      );
    }
  }
  return undefined;
}

/**
 * Installs (or updates) the bundled kit into `folder`: verify the archive, extract it into a
 * temporary sibling, make the tools executable, clear macOS quarantine before anything runs,
 * probe the compiler, then move it into place. On any failure the previous state is restored.
 */
export async function installBoriel(folder: string, deps: BorielServiceDeps): Promise<BorielInstallResult> {
  const target = normalizeFolder(folder, deps.homeDir);
  const fail = (error: string): BorielInstallResult => ({ kind: "failed", folder: target, error });
  const invalid = validateInstallFolder(target, deps);
  if (invalid) return fail(invalid);

  const { kit, located } = locateBundledKit(deps.kitLocation, deps.platformKey);
  if (kit.kind !== "available" || !located) {
    return fail(kit.kind === "unavailable" ? kit.reason : "No Boriel BASIC kit.");
  }
  if (!verifyKitArchive(located)) return fail(`The kit ${located.entry.file} is damaged (checksum mismatch).`);

  const parent = path.dirname(target);
  let temp: string | undefined;
  let aside: string | undefined;
  try {
    fs.mkdirSync(parent, { recursive: true });
    temp = fs.mkdtempSync(path.join(parent, `.${path.basename(target)}.klive-new-`));
    extractKit(located, temp, deps.platform);
    if (deps.platform === "darwin") await (deps.clearQuarantine ?? clearMacQuarantine)(temp);

    const probe = await probeBoriel(
      path.join(temp, borielExecutableName(deps.platform === "win32")),
      deps.runner ?? runZxbcVersion,
      deps.platform
    );
    if (!probe.ok) return fail(`The installed compiler does not work: ${probe.error}`);
    if (compareBorielVersions(probe.version, located.manifest.version) !== 0) {
      return fail(`The kit says ${located.manifest.version}, but zxbc reports ${probe.version}.`);
    }
    fs.writeFileSync(
      path.join(temp, BORIEL_MARKER_FILE),
      JSON.stringify(
        {
          product: located.manifest.product,
          version: located.manifest.version,
          platformKey: deps.platformKey,
          kitSha256: located.entry.sha256,
          installedAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    // --- Into place. An existing folder is valid here only if empty or marked as Klive's
    if (fs.existsSync(target)) {
      aside = `${target}.klive-old-${Date.now()}`;
      fs.renameSync(target, aside);
    }
    fs.renameSync(temp, target);
    temp = undefined;
    if (aside) {
      fs.rmSync(aside, { recursive: true, force: true });
      aside = undefined;
    }
    const executablePath = path.join(target, borielExecutableName(deps.platform === "win32"));
    const previous = resolveBorielExecutable(deps.settings, deps.platform === "win32");
    return {
      kind: "installed",
      folder: target,
      executablePath,
      version: probe.version!,
      replacedPath: previous && path.resolve(previous) !== executablePath ? previous : undefined
    };
  } catch (error: any) {
    if (aside && !fs.existsSync(target)) fs.renameSync(aside, target);
    return fail(error?.message ?? String(error));
  } finally {
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  }
}

/** Accepts an installation the user already has: a folder holding zxbc, or zxbc itself. */
export async function useExistingBoriel(itemPath: string, deps: BorielServiceDeps): Promise<BorielInstallResult> {
  const resolved = normalizeFolder(itemPath, deps.homeDir);
  const isFolder = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  const executablePath = isFolder ? path.join(resolved, borielExecutableName(deps.platform === "win32")) : resolved;
  const folder = isFolder ? resolved : path.dirname(resolved);
  const probe = await probeBoriel(executablePath, deps.runner ?? runZxbcVersion, deps.platform);
  if (!probe.ok) return { kind: "failed", folder, error: probe.error ?? "zxbc does not work." };
  return { kind: "installed", folder, executablePath, version: probe.version! };
}

async function readInstallation(deps: BorielServiceDeps, kitVersion: string | undefined): Promise<BorielInstallation> {
  const executablePath = resolveBorielExecutable(deps.settings, deps.platform === "win32");
  if (!executablePath) return { kind: "notConfigured" };
  const folder = path.dirname(executablePath);
  const probe = await probeBoriel(executablePath, deps.runner ?? runZxbcVersion, deps.platform);
  if (!probe.ok) return { kind: "broken", folder, executablePath, error: probe.error ?? "zxbc does not work." };
  return {
    kind: "working",
    folder,
    executablePath,
    version: probe.version!,
    outdated: !!kitVersion && compareBorielVersions(probe.version, kitVersion) < 0
  };
}

function extractKit(located: LocatedKit, folder: string, platform: string): void {
  const isWindows = platform === "win32";
  extractArchive(located.archiveFile, folder, { stripComponents: 1, applyModes: !isWindows });
  if (isWindows) return;
  // --- The archive's own mode bits come first; this list makes sure the tools run regardless
  for (const relative of EXECUTABLES) {
    const file = path.join(folder, relative);
    if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
  }
}

async function clearMacQuarantine(folder: string): Promise<void> {
  // --- Files Klive writes carry no quarantine; this is the belt to that braces. Failure is harmless.
  await execa("xattr", ["-dr", "com.apple.quarantine", folder], { reject: false, timeout: 30_000 });
}
