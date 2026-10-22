import fs from "fs";
import os from "os";
import path from "path";

import { Z88DK_CONFIGURED_FAILED_MESSAGE, Z88DK_INSTALL_FOLDER } from "./z88dk-config";

/*
 * Where z88dk is and how to run it (`.plans/Z88DK_INTEGRATION_PLAN.md` §4.1–4.2). Every zcc run -
 * the dialog's smoke test, a build, a background check - gets its environment from
 * `z88dkRunEnvironment`, so they all run zcc the same way (`.ai/z88dk/README.md`: zcc needs ZCCCFG and
 * its tools on PATH).
 */

const SETUP_HINT = "Use Integrations | z88dk (or the z88dk-setup command) to set one up.";

export const Z88DK_NOT_CONFIGURED_MESSAGE =
  `No z88dk installation is set up yet, so C files cannot be compiled. ${SETUP_HINT}`;

export function z88dkNotWorkingMessage(root: string): string {
  return (
    `${Z88DK_CONFIGURED_FAILED_MESSAGE} Folder: ${root}. ` +
    "Restore it, or use Integrations | z88dk (or the z88dk-setup command) to select a working one."
  );
}

export type Z88dkSettingsReader = { readSetting(key: string): any };

/** Where the install came from: the settings, the `Z88DK` environment variable, or detection. */
export type Z88dkInstallSource = "settings" | "environment" | "detected";

export type Z88dkInstall = {
  root: string;
  zcc: string;
  source: Z88dkInstallSource;
};

export function zccExecutableName(isWindows = process.platform === "win32"): string {
  return isWindows ? "zcc.exe" : "zcc";
}

export function zccPathOf(root: string, isWindows = process.platform === "win32"): string {
  return normalizePath(path.join(root, "bin", zccExecutableName(isWindows)));
}

export function normalizePath(itemPath: string): string {
  return itemPath.replaceAll("\\", "/");
}

/** A folder holding `bin/zcc` and `lib/config`: the shape every z88dk install has. */
export function isZ88dkRoot(root: string, isWindows = process.platform === "win32"): boolean {
  try {
    return (
      !!root &&
      fs.statSync(path.join(root, "bin", zccExecutableName(isWindows))).isFile() &&
      fs.statSync(path.join(root, "lib", "config")).isDirectory()
    );
  } catch {
    return false;
  }
}

/**
 * The environment zcc runs in: ZCCCFG at the install's target configurations, and its `bin` first
 * on PATH (zcc starts its tools by name). Windows spells the variable `Path`, so the existing key is
 * reused whatever its case.
 */
export function z88dkRunEnvironment(
  root: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
  isWindows = process.platform === "win32"
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") env[key] = value;
  }
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  const separator = isWindows ? ";" : ":";
  const binFolder = path.join(root, "bin");
  env[pathKey] = env[pathKey] ? `${binFolder}${separator}${env[pathKey]}` : binFolder;
  env.ZCCCFG = path.join(root, "lib", "config");
  env.NO_COLOR = "1";
  return env;
}

/**
 * The folders an existing install is looked for in, in order (`.ai/z88dk/README.md`, "Detection").
 * Pure: the caller checks each with `isZ88dkRoot`.
 */
export function z88dkCandidateRoots(
  env: NodeJS.ProcessEnv = process.env,
  options: { home?: string; isWindows?: boolean; downloadFolders?: string[] } = {}
): string[] {
  const isWindows = options.isWindows ?? process.platform === "win32";
  const home = options.home ?? os.homedir();
  const separator = isWindows ? ";" : ":";
  const join = isWindows ? path.win32.join : path.posix.join;
  const dirname = isWindows ? path.win32.dirname : path.posix.dirname;
  const candidates: string[] = [];

  // --- zcc on PATH: its folder's parent
  const pathValue = Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
  for (const entry of pathValue.split(separator)) {
    const folder = entry.trim().replace(/^"(.*)"$/, "$1");
    if (!folder) continue;
    if (fileExists(join(folder, zccExecutableName(isWindows)))) candidates.push(dirname(folder));
  }
  if (env.Z88DK?.trim()) candidates.push(env.Z88DK.trim());
  // --- ZCCCFG is <root>/lib/config
  if (env.ZCCCFG?.trim()) candidates.push(dirname(dirname(env.ZCCCFG.trim().replace(/[\\/]+$/, ""))));

  candidates.push(join(home, "z88dk"));
  for (const folder of options.downloadFolders ?? []) candidates.push(folder);
  if (isWindows) {
    candidates.push("C:\\z88dk", "C:\\Program Files\\z88dk");
  } else {
    candidates.push(
      "/opt/z88dk",
      "/usr/local/share/z88dk",
      "/usr/share/z88dk",
      "/opt/homebrew/share/z88dk",
      "/snap/z88dk/current"
    );
  }

  const seen = new Set<string>();
  return candidates
    .map((candidate) => normalizePath(candidate).replace(/\/+$/, ""))
    .filter((candidate) => {
      const key = isWindows ? candidate.toLowerCase() : candidate;
      if (!candidate || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * The install a build uses: the configured root, else the `Z88DK` environment variable, else the
 * first detected one. Undefined when there is none; a configured root that is not (or no longer) an
 * install is returned anyway, so the build can say which folder is broken.
 */
export function resolveZ88dkInstall(
  settings: Z88dkSettingsReader | undefined,
  options: { env?: NodeJS.ProcessEnv; isWindows?: boolean; detect?: boolean; home?: string } = {}
): Z88dkInstall | undefined {
  const isWindows = options.isWindows ?? process.platform === "win32";
  const env = options.env ?? process.env;
  const configured = readTrimmed(settings, Z88DK_INSTALL_FOLDER);
  if (configured) {
    const root = rootOf(configured, isWindows);
    return { root, zcc: zccPathOf(root, isWindows), source: "settings" };
  }
  const fromEnv = env.Z88DK?.trim();
  if (fromEnv && isZ88dkRoot(fromEnv, isWindows)) {
    return { root: normalizePath(fromEnv), zcc: zccPathOf(fromEnv, isWindows), source: "environment" };
  }
  if (options.detect === false) return undefined;
  const detected = z88dkCandidateRoots(env, { isWindows, home: options.home }).find((root) =>
    isZ88dkRoot(root, isWindows)
  );
  return detected ? { root: detected, zcc: zccPathOf(detected, isWindows), source: "detected" } : undefined;
}

/** A folder, or `zcc` itself (its root is two levels up), as an install root. */
export function rootOf(itemPath: string, isWindows = process.platform === "win32"): string {
  const normalized = normalizePath(itemPath.trim()).replace(/\/+$/, "");
  const base = normalized.split("/").pop()?.toLowerCase();
  if (base === zccExecutableName(isWindows).toLowerCase() || base === "zcc") {
    const binFolder = normalized.slice(0, normalized.lastIndexOf("/"));
    return binFolder.slice(0, binFolder.lastIndexOf("/")) || binFolder;
  }
  return normalized;
}

function readTrimmed(settings: Z88dkSettingsReader | undefined, key: string): string {
  const value = settings?.readSetting(key);
  return typeof value === "string" ? value.trim() : "";
}

function fileExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
