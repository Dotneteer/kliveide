import fs from "fs";
import path from "path";
import zlib from "zlib";

/**
 * Extracts the archives Klive installs tools from (sjasmplus releases, the Boriel BASIC setup kits):
 * `.zip` (stored or deflated) and `.tar.gz`/`.tgz` (ustar and GNU tar, regular files and folders).
 * Written in-house so no runtime dependency is needed. Every entry is checked against the output
 * folder (`safeJoin`), so an archive cannot write outside it.
 */
export type ExtractOptions = {
  /** Leading path components to drop, as `tar --strip-components` (entries left empty are skipped). */
  stripComponents?: number;
  /** Return false to leave an entry out (gets the path after stripping, with "/" separators). */
  include?: (entryPath: string) => boolean;
  /** Apply the archive's permission bits to the extracted files (default: not on Windows). */
  applyModes?: boolean;
};

export type ExtractedEntry = {
  /** The path relative to the output folder, with "/" separators. */
  path: string;
  /** The permission bits the archive recorded (0 when it recorded none). */
  mode: number;
};

export function extractArchive(
  archiveFile: string,
  outputFolder: string,
  options: ExtractOptions = {}
): ExtractedEntry[] {
  const lowerName = archiveFile.toLowerCase();
  if (lowerName.endsWith(".zip")) return extractZip(archiveFile, outputFolder, options);
  if (lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")) {
    return extractTarGz(archiveFile, outputFolder, options);
  }
  throw new Error(`Unsupported archive type: ${path.basename(archiveFile)}`);
}

export function extractZip(
  zipFile: string,
  outputFolder: string,
  options: ExtractOptions = {}
): ExtractedEntry[] {
  const buffer = fs.readFileSync(zipFile);
  const extracted: ExtractedEntry[] = [];
  let offset = findZipCentralDirectoryOffset(buffer);

  while (offset < buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const madeBy = buffer.readUInt16LE(offset + 4) >> 8;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    // --- "Made by" 3 is Unix: the high 16 bits of the external attributes are st_mode
    const mode = madeBy === 3 ? (externalAttributes >>> 16) & 0o7777 : 0;
    const entryPath = stripEntry(rawName, options.stripComponents);
    if (entryPath === undefined) continue;
    if (rawName.endsWith("/")) {
      fs.mkdirSync(safeJoin(outputFolder, entryPath), { recursive: true });
      continue;
    }
    if (options.include && !options.include(entryPath)) continue;

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${rawName}.`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    let fileData: Buffer;
    if (compressionMethod === 0) {
      fileData = compressedData;
    } else if (compressionMethod === 8) {
      fileData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${rawName}.`);
    }
    if (fileData.length !== uncompressedSize) {
      throw new Error(`Invalid ZIP entry size for ${rawName}.`);
    }

    writeEntry(outputFolder, entryPath, fileData, mode, options);
    extracted.push({ path: entryPath, mode });
  }
  return extracted;
}

export function extractTarGz(
  tarGzFile: string,
  outputFolder: string,
  options: ExtractOptions = {}
): ExtractedEntry[] {
  const buffer = zlib.gunzipSync(fs.readFileSync(tarGzFile));
  const extracted: ExtractedEntry[] = [];
  let offset = 0;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;

    const name = readTarString(header, 0, 100);
    // --- ustar ("ustar\0") has a 155-byte name prefix at 345; GNU tar ("ustar  ") does not, and
    // --- uses that area for times, so it must not be read as part of the name.
    const magic = header.toString("latin1", 257, 265);
    const prefix = magic === "ustar\u000000" ? readTarString(header, 345, 155) : "";
    const rawName = prefix ? `${prefix}/${name}` : name;
    const mode = parseInt(readTarString(header, 100, 8) || "0", 8) & 0o7777;
    const size = parseInt(readTarString(header, 124, 12) || "0", 8);
    const typeFlag = readTarString(header, 156, 1);
    offset += 512;
    const data = buffer.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    const entryPath = stripEntry(rawName, options.stripComponents);
    if (entryPath === undefined) continue;
    if (typeFlag === "5") {
      fs.mkdirSync(safeJoin(outputFolder, entryPath), { recursive: true });
    } else if (typeFlag === "" || typeFlag === "0") {
      if (options.include && !options.include(entryPath)) continue;
      writeEntry(outputFolder, entryPath, data, mode, options);
      extracted.push({ path: entryPath, mode });
    }
    // --- Links, devices and extended headers are not part of any kit Klive installs: skipped
  }
  return extracted;
}

/** Resolves `itemPath` inside `baseFolder`, refusing anything that would land outside it. */
export function safeJoin(baseFolder: string, itemPath: string): string {
  const targetPath = path.resolve(baseFolder, itemPath);
  const resolvedBase = path.resolve(baseFolder);
  if (targetPath !== resolvedBase && !targetPath.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Archive entry escapes the install folder: ${itemPath}`);
  }
  return targetPath;
}

function writeEntry(
  outputFolder: string,
  entryPath: string,
  data: Buffer,
  mode: number,
  options: ExtractOptions
): void {
  const targetPath = safeJoin(outputFolder, entryPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, data);
  const applyModes = options.applyModes ?? process.platform !== "win32";
  if (applyModes && mode) fs.chmodSync(targetPath, mode & 0o777);
}

// --- `undefined`: nothing is left of the entry after stripping (the stripped folders themselves)
function stripEntry(rawName: string, stripComponents = 0): string | undefined {
  const parts = rawName.replaceAll("\\", "/").split("/").filter((part) => part && part !== ".");
  const kept = parts.slice(stripComponents);
  return kept.length ? kept.join("/") : undefined;
}

function findZipCentralDirectoryOffset(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = Math.max(minimumOffset, buffer.length - 22); offset >= minimumOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return buffer.readUInt32LE(offset + 16);
    }
  }
  throw new Error("Invalid ZIP archive. End of central directory not found.");
}

function readTarString(buffer: Buffer, offset: number, length: number): string {
  const end = buffer.indexOf(0, offset);
  const safeEnd = end >= offset && end < offset + length ? end : offset + length;
  return buffer.toString("utf8", offset, safeEnd).trim();
}
