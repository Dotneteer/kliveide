/*
 * Boriel BASIC version strings ("2.0.0-beta25"): parsing `zxbc --version` output and ordering them.
 * Pure, so both the main process and its tests use it without spawning anything.
 */

export type BorielVersion = { major: number; minor: number; patch: number; pre: string };

const VERSION = /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;

export function parseBorielVersion(text: string | undefined): BorielVersion | undefined {
  const match = VERSION.exec(text ?? "");
  if (!match) return undefined;
  return { major: +match[1], minor: +match[2], patch: +match[3], pre: match[4] ?? "" };
}

/** The version in `zxbc --version`'s output ("zxbc 2.0.0-beta25"), as written there. */
export function versionFromOutput(output: string): string | undefined {
  return VERSION.exec(output)?.[0];
}

/**
 * Orders two versions as semver does, with the digit runs of a pre-release compared as numbers
 * ("beta3" < "beta25"). A release ranks above its pre-releases. Unparsable versions rank lowest.
 */
export function compareBorielVersions(a: string | undefined, b: string | undefined): number {
  const left = parseBorielVersion(a);
  const right = parseBorielVersion(b);
  if (!left || !right) return (left ? 1 : 0) - (right ? 1 : 0);
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  return comparePre(left.pre, right.pre);
}

function comparePre(a: string, b: string): number {
  const split = (text: string) => text.match(/\d+|\D+/g) ?? [];
  const left = split(a);
  const right = split(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    const numeric = /^\d/.test(left[i]) && /^\d/.test(right[i]);
    const order = numeric ? +left[i] - +right[i] : left[i].localeCompare(right[i]);
    if (order !== 0) return order;
  }
  return 0;
}
