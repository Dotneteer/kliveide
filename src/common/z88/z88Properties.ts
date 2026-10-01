/*
 * A reader for the Java `Properties` text format, as `java.util.Properties.load(InputStream)` reads
 * it. OZvm writes `snapshot.settings` with `Properties.store`, so a `.z88` snapshot's settings are in
 * this format (ISO-8859-1, `key=value` lines, `#`/`!` comments).
 *
 * The whole grammar is implemented rather than the subset OZvm happens to write today: it is short,
 * and a hand-edited settings file (a debug setup someone tweaked) may use any of it.
 */

/**
 * Decodes ISO-8859-1 bytes: every byte is the code point of the same value.
 * @param bytes The raw bytes
 */
export function decodeLatin1(bytes: Uint8Array): string {
  let result = "";
  // --- Chunked so a large file never builds a huge argument list
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return result;
}

const isWhitespace = (ch: string) => ch === " " || ch === "\t" || ch === "\f";

/**
 * Parses Java properties text into a map. Later duplicates of a key win, as in Java.
 * @param text The properties text (already decoded)
 * @throws On a malformed `\uXXXX` escape (Java throws `IllegalArgumentException` there too)
 */
export function parseJavaProperties(text: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = text.split(/\r\n|\r|\n/);
  let index = 0;

  while (index < lines.length) {
    // --- Skip leading whitespace of the natural line
    let line = stripLeading(lines[index++]);
    if (line === "" || line[0] === "#" || line[0] === "!") {
      continue;
    }

    // --- A line ending in an odd number of backslashes continues on the next natural line,
    // --- whose leading whitespace is dropped
    while (endsWithContinuation(line)) {
      line = line.slice(0, -1);
      if (index >= lines.length) break;
      line += stripLeading(lines[index++]);
    }

    // --- The key ends at the first unescaped '=', ':' or whitespace
    let pos = 0;
    let rawKey = "";
    while (pos < line.length) {
      const ch = line[pos];
      if (ch === "\\" && pos + 1 < line.length) {
        rawKey += ch + line[pos + 1];
        pos += 2;
        continue;
      }
      if (ch === "=" || ch === ":" || isWhitespace(ch)) break;
      rawKey += ch;
      pos++;
    }

    // --- Then whitespace, at most one separator, and whitespace again
    while (pos < line.length && isWhitespace(line[pos])) pos++;
    if (pos < line.length && (line[pos] === "=" || line[pos] === ":")) pos++;
    while (pos < line.length && isWhitespace(line[pos])) pos++;

    result.set(unescape(rawKey), unescape(line.slice(pos)));
  }
  return result;
}

function stripLeading(line: string): string {
  let pos = 0;
  while (pos < line.length && isWhitespace(line[pos])) pos++;
  return line.slice(pos);
}

function endsWithContinuation(line: string): boolean {
  let count = 0;
  for (let i = line.length - 1; i >= 0 && line[i] === "\\"; i--) count++;
  return count % 2 === 1;
}

function unescape(text: string): string {
  if (!text.includes("\\")) return text;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "\\" || i + 1 >= text.length) {
      result += ch;
      continue;
    }
    const next = text[++i];
    switch (next) {
      case "t":
        result += "\t";
        break;
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "f":
        result += "\f";
        break;
      case "u": {
        const hex = text.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          throw new Error(`Malformed \\uXXXX escape: \\u${hex}`);
        }
        result += String.fromCharCode(parseInt(hex, 16));
        i += 4;
        break;
      }
      default:
        // --- Any other escaped character stands for itself
        result += next;
    }
  }
  return result;
}
