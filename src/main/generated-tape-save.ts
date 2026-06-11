import path from "node:path";

const DEFAULT_TAPE_FILE_NAME = "saved.tzx";

export function createGeneratedTapeSaveDefaultPath(
  defaultName: string,
  lastTapeFolder: string | undefined,
  homePath: string
): string {
  return path.join(lastTapeFolder || homePath, normalizeGeneratedTapeFileName(defaultName));
}

export function normalizeGeneratedTapeFileName(defaultName: string): string {
  const normalizedSeparators = String(defaultName ?? "").replace(/\\/g, "/");
  const baseName = path.basename(normalizedSeparators).trim();
  const fileName = baseName || DEFAULT_TAPE_FILE_NAME;
  return fileName.toLowerCase().endsWith(".tzx") ? fileName : `${fileName}.tzx`;
}
