export type ChangesetType = "feature" | "fix" | "breaking" | "known-issue" | "internal";
export type Kind = "none" | "patch" | "minor" | "major";

export interface Changeset {
  file: string;
  type: string | undefined;
  issues: number[];
  bump?: string;
  highlight?: string;
  key?: boolean | string;
  body: string;
  errors: string[];
  addedAt?: number;
  text?: string;
}

export interface Feature {
  id: string;
  since: string;
}

export const TYPES: ChangesetType[];
export const BUMPS: string[];
export const SECTIONS: { id: string; title: string }[];
export function parseVersion(version: string): [number, number, number] | undefined;
export function isPlainVersion(version: string): boolean;
export function compareVersions(a: string, b: string): number;
export function bumpVersion(version: string, kind: Kind): string;
export function latestReleaseFromTags(tags: string[]): string | undefined;
export function parseChangeset(text: string, file?: string): Changeset;
export function typeKind(type: string, major0?: boolean): Kind;
export function changesetKind(cs: Changeset, currentVersion?: string): Kind;
export function nextVersion(input: {
  lastRelease?: string;
  packageVersion?: string;
  changesets: Changeset[];
}): { version: string; kind: Kind; reason: string } | undefined;
export function formatEntry(body: string, issues?: number[]): string;
export function orderChangesets(changesets: Changeset[]): Changeset[];
export function sectionEntries(changesets: Changeset[]): Record<string, string[]>;
export function assembleSection(input: { version: string; date?: string; changesets: Changeset[] }): string;
export function hasUnreleased(changelog: string): boolean;
export function hasSection(changelog: string, version: string): boolean;
export function insertSection(changelog: string, section: string, version?: string): string;
export function extractSection(changelog: string, version: string): string | undefined;
export function describeChangeset(cs: Changeset, currentVersion?: string): { kind: Kind; details: string; headline: string };
export function renderChangesetForDisplay(relPath: string, text: string, cs: Changeset, currentVersion?: string): string;
export function serializeChangeset(input: {
  type: string;
  issues?: number[];
  bump?: string;
  highlight?: string;
  key?: boolean | string;
  body?: string;
}): string;
export function slugFrom(text: string, fallback?: string): string;
export function gateDecision(input: {
  files: { path: string; status?: string }[];
  labels?: string[];
  author?: string;
  headRef?: string;
}): { ok: boolean; reason: string };
export function parseFeatures(featuresSource: string): Feature[];
export function featureUnlocks(
  features: Feature[],
  input: { version: string; lastRelease?: string }
): { unlocked: Feature[]; stale: Feature[]; future: Feature[] };
export function releasePrBody(input: {
  version: string;
  lastRelease?: string;
  section: string;
  reason: string;
  unlocks: { unlocked: Feature[]; stale: Feature[] };
  consumed: number;
}): string;
