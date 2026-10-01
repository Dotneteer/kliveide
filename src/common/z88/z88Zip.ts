import { unzipSync } from "fflate";

/**
 * Reads every file entry of a ZIP archive (STORED or DEFLATE), keyed by its exact name.
 *
 * A `.z88` snapshot is a plain ZIP (`.plans/Z88_SNAPSHOT_PLAN.md` §4.1). Directory entries are
 * dropped: the format has none, and a name ending in "/" can never match a member it defines.
 * @param bytes The archive
 * @throws "Not a ZIP archive" when the bytes are not a readable ZIP
 */
export function readZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Not a ZIP archive (${reason})`);
  }
  const result = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (!name.endsWith("/")) {
      result.set(name, data);
    }
  }
  return result;
}
