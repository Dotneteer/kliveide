export const REPO: string;
export const CHECKSUMS_FILE: string;
export function expectedAssets(version: string): string[];
export function downloadUrl(tag: string, name: string): string;
export function downloadsFrom(names: string[], tag: string): Record<string, string | undefined>;
export function compareAssets(
  names: string[],
  version: string,
  options?: { withChecksums?: boolean }
): { missing: string[]; unexpected: string[] };
