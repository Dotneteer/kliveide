import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import type { BorielBundledKit } from "@common/messaging/BorielIntegration";

/*
 * The Boriel BASIC setup kit this Klive carries (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §3.1).
 * A packaged app has `<resources>/boriel/kit.json` and the one kit for its platform next to it
 * (staged by `scripts/boriel-kit.cjs stage`). A development run reads `vendor/boriel-basic/kit.json`
 * and the archives in `vendor/boriel-basic/kits/` (fetched by `npm run dev`'s `predev`).
 */

export type BorielKitEntry = { file: string; size: number; sha256: string };
export type BorielKitManifest = {
  product: string;
  version: string;
  urlBase: string;
  mirrors?: string[];
  kits: Record<string, BorielKitEntry>;
};

/** Where the manifest and the archive live. */
export type BorielKitLocation = { manifestFile: string; archiveFolder: string };

/** The kit location for a packaged app or a development run. */
export function borielKitLocation(isPackaged: boolean, resourcesPath: string, appPath: string): BorielKitLocation {
  if (isPackaged) {
    const folder = path.join(resourcesPath, "boriel");
    return { manifestFile: path.join(folder, "kit.json"), archiveFolder: folder };
  }
  const vendor = findVendorFolder(appPath);
  return { manifestFile: path.join(vendor, "kit.json"), archiveFolder: path.join(vendor, "kits") };
}

/**
 * The repository's `vendor/boriel-basic`, searched upward from the app path: `npm run dev` runs
 * from the repository root, while Electron started on the built `out/main/index.js` (the
 * Playwright harnesses) reports `out/main`.
 */
function findVendorFolder(appPath: string): string {
  let folder = path.resolve(appPath);
  for (let level = 0; level < 4; level++) {
    const candidate = path.join(folder, "vendor", "boriel-basic");
    if (fs.existsSync(path.join(candidate, "kit.json"))) return candidate;
    const parent = path.dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  return path.join(path.resolve(appPath), "vendor", "boriel-basic");
}

/** Node's platform and arch as a `kit.json` key ("darwin-arm64"). */
export function borielPlatformKey(platform: string = process.platform, arch: string = process.arch): string {
  return `${platform}-${arch}`;
}

export type LocatedKit = {
  manifest: BorielKitManifest;
  entry: BorielKitEntry;
  archiveFile: string;
};

/**
 * The bundled kit for this platform, or why there is none. Only the size is checked here (cheap,
 * at every start); the installer checks the SHA-256 before extracting.
 */
export function locateBundledKit(
  location: BorielKitLocation,
  platformKey: string = borielPlatformKey()
): { kit: BorielBundledKit; located?: LocatedKit } {
  let manifest: BorielKitManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(location.manifestFile, "utf8"));
  } catch {
    return { kit: { kind: "unavailable", platformKey, reason: "This Klive carries no Boriel BASIC kit." } };
  }
  const entry = manifest?.kits?.[platformKey];
  if (!entry) {
    return {
      kit: { kind: "unavailable", platformKey, reason: `There is no Boriel BASIC kit for ${platformKey}.` }
    };
  }
  const archiveFile = path.join(location.archiveFolder, entry.file);
  if (!fs.existsSync(archiveFile) || fs.statSync(archiveFile).size !== entry.size) {
    return {
      kit: { kind: "unavailable", platformKey, reason: `The Boriel BASIC kit ${entry.file} is missing.` }
    };
  }
  return {
    kit: { kind: "available", version: manifest.version, file: entry.file, platformKey },
    located: { manifest, entry, archiveFile }
  };
}

/** Whether the archive's SHA-256 is the one `kit.json` records. */
export function verifyKitArchive(located: LocatedKit): boolean {
  const digest = createHash("sha256").update(fs.readFileSync(located.archiveFile)).digest("hex");
  return digest === located.entry.sha256;
}
