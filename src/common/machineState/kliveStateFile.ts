/*
 * The Klive state file (`.kls`): a machine's complete state, for any WASM machine
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.7, D8). Pure: no Node, no DOM.
 *
 *   "KLIVESTA" · u16 container version (1) · u16 flags (0)
 *   u32 header length · header JSON (UTF-8)
 *   sections: { tag: 4 ASCII chars, u32 length, payload }...
 *     META  JSON: what the viewer shows without a core (registers, paging summary)
 *     THMB  u16 width · u16 height · RGBA pixels: the screen as it was
 *     CORE  the core's memory image, deflated
 *     HOST  JSON: the machine wrapper's own fields
 *     MEDI  JSON: the media the machine had (file names and fingerprints, never the files)
 *     SZX   a .szx snapshot of the same moment (ZX Spectrums only): the portable fallback (D9)
 * All numbers are little-endian. Unknown sections are kept by name and skipped, so an older Klive
 * reads a newer file's known parts.
 */

import { deflateSync, inflateSync } from "fflate";
import {
  hasContainerMagic,
  readChunkedContainer,
  writeChunkedContainer,
  type ContainerSection
} from "./chunkedContainer";

/** The file's magic */
export const KLIVE_STATE_MAGIC = "KLIVESTA";
/** The container version this code writes */
export const KLIVE_STATE_VERSION = 1;
/** The file extension */
export const KLIVE_STATE_EXTENSION = ".kls";

/** The header: everything a reader needs before it touches a core */
export type KliveStateHeader = {
  /** The Klive machine id ("sp48", "zxnext", ...) */
  machineId: string;
  /** The machine model, when the machine has models */
  modelId?: string;
  /** The machine configuration the state was taken with */
  config?: Record<string, unknown>;
  /** The Klive version that wrote the file */
  kliveVersion: string;
  /** The core ("sp48", "sp128", "spp3e", "zxnext", "z88", "zx8081") */
  coreId: string;
  /** The core build's memory-layout fingerprint */
  fingerprint: string;
  /** The core's linear memory size */
  memorySize: number;
  /** When the state was saved (ISO 8601) */
  savedAt: string;
  /** PC at the time */
  pc: number;
  /** The machine's display name */
  machineName?: string;
};

/** A medium the machine had when the state was saved */
export type KliveStateMedia = {
  /** The media id (`MEDIA_TAPE`, `MEDIA_DISK_A`, `MEDIA_DISK_B`, `MEDIA_SD_CARD`) */
  id: string;
  /** The file it came from */
  fileName?: string;
  /** A content fingerprint of the file (the SD card), to notice a changed file on load (D12) */
  fingerprint?: string;
  /** The file's size, in bytes */
  size?: number;
};

/** A screen picture */
export type KliveStateThumbnail = { width: number; height: number; rgba: Uint8Array };

/** A whole state file */
export type KliveStateFile = {
  header: KliveStateHeader;
  /** Viewer data */
  meta?: Record<string, unknown>;
  thumbnail?: KliveStateThumbnail;
  /** The memory image; empty when read with `skipImage` */
  image: Uint8Array;
  /** The wrapper's own fields */
  host: Record<string, unknown>;
  media: KliveStateMedia[];
  /** The portable `.szx` (Spectrums) */
  szx?: Uint8Array;
};

/** What reading gives besides the file */
export type KliveStateReadResult = KliveStateFile & {
  /** The deflated image's size */
  compressedImageSize: number;
  /** Sections this version does not know */
  unknownSections: string[];
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Writes a state file
 * @param file The state
 * @param level The deflate level of the memory image (1-9)
 */
export function writeKliveStateFile(file: KliveStateFile, level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6): Uint8Array {
  const sections: ContainerSection[] = [];
  const section = (tag: string, payload: Uint8Array) => sections.push({ tag, payload });
  if (file.meta) section("META", encoder.encode(JSON.stringify(file.meta)));
  if (file.thumbnail) section("THMB", encodeThumbnail(file.thumbnail));
  section("CORE", deflateSync(file.image, { level }));
  section("HOST", encoder.encode(JSON.stringify(file.host ?? {})));
  section("MEDI", encoder.encode(JSON.stringify(file.media ?? [])));
  if (file.szx) section("SZX ", file.szx);
  return writeChunkedContainer(KLIVE_STATE_MAGIC, KLIVE_STATE_VERSION, file.header, sections);
}

/** A thumbnail section's payload: u16 width, u16 height, RGBA pixels */
export function encodeThumbnail(t: KliveStateThumbnail): Uint8Array {
  const payload = new Uint8Array(4 + t.rgba.length);
  payload.set([t.width & 0xff, (t.width >> 8) & 0xff, t.height & 0xff, (t.height >> 8) & 0xff]);
  payload.set(t.rgba, 4);
  return payload;
}

/** Reads a thumbnail section; undefined when its size does not match its dimensions */
export function decodeThumbnail(payload: Uint8Array): KliveStateThumbnail | undefined {
  if (payload.length < 4) return undefined;
  const width = payload[0] | (payload[1] << 8);
  const height = payload[2] | (payload[3] << 8);
  return 4 + width * height * 4 === payload.length ? { width, height, rgba: payload.slice(4) } : undefined;
}

/** Does this look like a state file? */
export function hasKliveStateMagic(bytes: Uint8Array): boolean {
  return hasContainerMagic(bytes, KLIVE_STATE_MAGIC);
}

/**
 * Reads a state file
 * @param bytes The file
 * @param options `skipImage`: do not inflate the memory image (the viewer)
 * @throws When the file is not a state file, is of a newer container version, or is truncated
 */
export function readKliveStateFile(
  bytes: Uint8Array,
  options: { skipImage?: boolean } = {}
): KliveStateReadResult {
  const container = readChunkedContainer<KliveStateHeader>(
    bytes,
    KLIVE_STATE_MAGIC,
    KLIVE_STATE_VERSION,
    "state file",
    "Not a Klive state file: the KLIVESTA header is missing"
  );
  const header = container.header;
  if (!header?.machineId || !header.coreId || !header.fingerprint) {
    throw new Error("The state file's header lacks the machine, core or fingerprint");
  }

  const result: KliveStateReadResult = {
    header,
    image: new Uint8Array(0),
    host: {},
    media: [],
    compressedImageSize: 0,
    unknownSections: []
  };
  let sawCore = false;
  for (const { tag, payload } of container.sections) {
    const length = payload.length;
    const json = () => {
      try {
        return JSON.parse(decoder.decode(payload));
      } catch {
        throw new Error(`The state file's ${tag.trim()} section is not valid`);
      }
    };
    switch (tag) {
      case "META":
        result.meta = json();
        break;
      case "THMB":
        result.thumbnail = decodeThumbnail(payload);
        break;
      case "CORE":
        sawCore = true;
        result.compressedImageSize = length;
        if (!options.skipImage) {
          try {
            result.image = inflateSync(payload);
          } catch (err) {
            throw new Error(`The state file's memory image cannot be decompressed (${(err as Error).message})`);
          }
          if (result.image.length !== header.memorySize) {
            throw new Error(
              `The state file's memory image is ${result.image.length} bytes; its header says ${header.memorySize}`
            );
          }
        }
        break;
      case "HOST":
        result.host = json();
        break;
      case "MEDI":
        result.media = json();
        break;
      case "SZX ":
        result.szx = payload.slice();
        break;
      default:
        result.unknownSections.push(tag.trim());
    }
  }
  if (!sawCore) throw new Error("The state file has no memory image (CORE section)");
  return result;
}
