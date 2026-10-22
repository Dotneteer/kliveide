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
  for (const entry of zipEntries(buffer, outputFolder, options)) {
    const fileData = inflateEntry(
      entry,
      entry.compressionMethod === 8 ? zlib.inflateRawSync(entry.compressedData) : entry.compressedData
    );
    writeEntry(outputFolder, entry.entryPath, fileData, entry.mode, options);
    extracted.push({ path: entry.entryPath, mode: entry.mode });
  }
  return extracted;
}

/** What `extractArchiveAsync` adds: it yields to the event loop as it goes, and can be stopped. */
export type AsyncExtractOptions = ExtractOptions & {
  /** Aborting it stops the extraction (with an `AbortError`) before the next entry. */
  signal?: AbortSignal;
  /** Called after each extracted file. */
  onEntry?: (done: number, total: number) => void;
};

/**
 * `extractArchive` for big archives (a z88dk release: ~29 000 files, ~410 MB): inflates on libuv's
 * thread pool and writes with async I/O, so the main process keeps serving the windows while it runs.
 * Only `.zip`; a tarball goes through the synchronous path.
 */
export async function extractArchiveAsync(
  archiveFile: string,
  outputFolder: string,
  options: AsyncExtractOptions = {}
): Promise<ExtractedEntry[]> {
  if (!archiveFile.toLowerCase().endsWith(".zip")) return extractArchive(archiveFile, outputFolder, options);
  const buffer = await fs.promises.readFile(archiveFile);
  const entries = [...zipEntries(buffer, outputFolder, options)];
  const extracted: ExtractedEntry[] = [];
  const applyModes = options.applyModes ?? process.platform !== "win32";
  const madeFolders = new Set<string>();
  for (const entry of entries) {
    if (options.signal?.aborted) {
      const error = new Error("The extraction was cancelled.");
      error.name = "AbortError";
      throw error;
    }
    const raw =
      entry.compressionMethod === 8
        ? await new Promise<Buffer>((resolve, reject) =>
            zlib.inflateRaw(entry.compressedData, (err, data) => (err ? reject(err) : resolve(data)))
          )
        : Buffer.from(entry.compressedData);
    const fileData = inflateEntry(entry, raw);
    const targetPath = safeJoin(outputFolder, entry.entryPath);
    const folder = path.dirname(targetPath);
    if (!madeFolders.has(folder)) {
      await fs.promises.mkdir(folder, { recursive: true });
      madeFolders.add(folder);
    }
    await fs.promises.writeFile(targetPath, fileData);
    if (applyModes && entry.mode) await fs.promises.chmod(targetPath, entry.mode & 0o777);
    extracted.push({ path: entry.entryPath, mode: entry.mode });
    options.onEntry?.(extracted.length, entries.length);
  }
  return extracted;
}

type ZipEntry = {
  rawName: string;
  entryPath: string;
  mode: number;
  compressionMethod: number;
  uncompressedSize: number;
  compressedData: Buffer;
};

/**
 * The files of a zip, after stripping and filtering, read from its central directory. Folder entries
 * are created on the way (they hold no data), so a kept empty folder survives.
 */
function* zipEntries(buffer: Buffer, outputFolder: string, options: ExtractOptions): Generator<ZipEntry> {
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
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${rawName}.`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    yield {
      rawName,
      entryPath,
      mode,
      compressionMethod,
      uncompressedSize,
      compressedData: buffer.subarray(dataOffset, dataOffset + compressedSize)
    };
  }
}

/** The entry's bytes: stored data as it is, deflated data as inflated; checked against the recorded size. */
function inflateEntry(entry: ZipEntry, inflated: Buffer): Buffer {
  const fileData = entry.compressionMethod === 0 ? entry.compressedData : inflated;
  if (fileData.length !== entry.uncompressedSize) {
    throw new Error(`Invalid ZIP entry size for ${entry.rawName}.`);
  }
  return fileData;
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
