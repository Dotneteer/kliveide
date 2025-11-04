import fs from "fs";

/**
 * Reads the text of the specified file
 * @param filename File name
 * @param Handles UTF-8 with and without BOM header
 */
export function readTextFile (filename: string): string {
  const sourceText = fs.readFileSync(filename, "utf8");
  if (sourceText.length < 4) {
    return sourceText;
  }
  return sourceText.charCodeAt(0) >= 0xbf00 ? sourceText.substring(1) : sourceText;
}
