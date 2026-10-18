/**
 * The latest release, as scripts/build-doc-site-info.cjs found it (docs/generated/site-info.json).
 * A build that skipped that step (`next build` run directly) still works: it shows no version
 * and links to the releases page.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Downloads = Partial<
  Record<"macArm64" | "macX64" | "windowsX64" | "windowsPortable" | "linuxX64" | "linuxArm64", string>
>;

export type SiteInfo = {
  latestRelease: string;
  releasesPage: string;
  downloads: Downloads;
};

export function readSiteInfo(): SiteInfo {
  const file = join(process.cwd(), "generated", "site-info.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as SiteInfo;
  return {
    latestRelease: "0.0.0",
    releasesPage: "https://github.com/Dotneteer/kliveide/releases/latest",
    downloads: {}
  };
}

/** True if version `a` is at most `b` (both "major.minor.patch"). */
export function versionAtMost(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return true;
}
