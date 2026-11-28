import fs from "fs";

/**
 * Reads the text of the specified file; a UTF-8 byte order mark (U+FEFF) is dropped
 * @param filename File name
 */
export function readTextFile(filename: string): string {
  const sourceText = fs.readFileSync(filename, "utf8");
  return sourceText.charCodeAt(0) === 0xfeff ? sourceText.substring(1) : sourceText;
}
