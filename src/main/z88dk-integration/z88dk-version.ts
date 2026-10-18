import { Z88DK_MIN_SUPPORTED_BUILD, Z88DK_MIN_SUPPORTED_TAG } from "./z88dk-config";

/*
 * z88dk versions (`.ai/z88dk/README.md`, "Versions"). `zcc` has no `--version`: run with no arguments
 * it prints `zcc - Frontend for the z88dk Cross-C Compiler - v23854-4d530b6eb7-20251002` on stderr.
 * An install is judged by that build number; a GitHub release by its tag.
 */

export type Z88dkVersion = {
  /** As zcc prints it, without the leading `v`: `23854-4d530b6eb7-20251002`. */
  text: string;
  build: number;
  /** `yyyymmdd` */
  date: string;
};

/** The version in zcc's banner, or undefined when the text holds none. */
export function parseZccBanner(output: string): Z88dkVersion | undefined {
  const match = /\bv(\d+)-([0-9a-f]+)-(\d{8})\b/i.exec(output ?? "");
  if (!match) return undefined;
  return { text: `${match[1]}-${match[2]}-${match[3]}`, build: Number(match[1]), date: match[3] };
}

/** The display form: `v23854-4d530b6eb7-20251002`. */
export function formatZ88dkVersion(version: Z88dkVersion): string {
  return `v${version.text}`;
}

/** Reads a stored or displayed version string back (`v23854-...` or `23854-...`). */
export function buildOfVersion(version: string | undefined): number | undefined {
  return parseZccBanner(version?.startsWith("v") ? version : `v${version ?? ""}`)?.build;
}

export function isSupportedBuild(build: number | undefined): boolean {
  return build !== undefined && build >= Z88DK_MIN_SUPPORTED_BUILD;
}

/**
 * A release tag as numbers: `v2.4` → [2, 4], `v1.99c` → [1, 99, 3] (a letter suffix counts as a
 * third part). Undefined for a tag that is not a version.
 */
export function tagParts(tag: string): number[] | undefined {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?([a-z])?$/i.exec((tag ?? "").trim());
  if (!match) return undefined;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  if (match[4]) parts.push(match[4].toLowerCase().charCodeAt(0) - 96);
  return parts;
}

export function compareTags(left: string, right: string): number {
  const a = tagParts(left) ?? [];
  const b = tagParts(right) ?? [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** A release Klive supports (C3): the minimum supported tag or a newer one. */
export function isSupportedTag(tag: string): boolean {
  return !!tagParts(tag) && compareTags(tag, Z88DK_MIN_SUPPORTED_TAG) >= 0;
}
