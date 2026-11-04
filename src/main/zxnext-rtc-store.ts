/*
 * The ZX Spectrum Next's kept real-time clocks (`.ai/zxnext-rtc.md` D5):
 * `~/Klive/zxnext-rtc.json`, one entry per Next model. The main process owns the file; the emulator
 * loads and saves through `MainApi`, the Settings dialog's Kept clock row reads the `nextRtcKept`
 * app-state key this module keeps up to date.
 *
 * On disk the 56 RAM bytes are base64; a file that does not parse, has another version or an entry
 * that is not a valid one is treated as holding nothing for that model (and is replaced on the next
 * save), never as an error that stops the machine.
 */

import fs from "fs";
import path from "path";

import { isNextRtcKeptEntry, type NextRtcKeptEntry, type NextRtcKeptState } from "@common/zxnext/nextRtcKept";

export const NEXT_RTC_FILE = "zxnext-rtc.json";
const FILE_VERSION = 1;

type StoredEntry = Omit<NextRtcKeptEntry, "ram"> & { ram: string };
type StoredFile = { version: number; profiles: Record<string, StoredEntry> };

/** Reads and writes `zxnext-rtc.json` in one folder (the Klive home; a test's temp folder) */
export class NextRtcStoreFile {
  constructor(
    private readonly folder: () => string,
    /** Told the kept entries' save times whenever they change (the `nextRtcKept` app state) */
    private readonly onChanged?: (state: NextRtcKeptState) => void
  ) {}

  get filePath(): string {
    return path.join(this.folder(), NEXT_RTC_FILE);
  }

  /** A model's kept clock, or undefined */
  load(profileId: string): NextRtcKeptEntry | undefined {
    return this.readAll()[profileId];
  }

  /** Keeps a model's clock; the other models' entries stay */
  save(profileId: string, entry: NextRtcKeptEntry): void {
    if (!isNextRtcKeptEntry(entry)) throw new Error("Not a kept real-time clock");
    const all = this.readAll();
    all[profileId] = entry;
    this.writeAll(all);
  }

  /** Forgets a model's clock; true when there was one */
  forget(profileId: string): boolean {
    const all = this.readAll();
    if (!all[profileId]) return false;
    delete all[profileId];
    this.writeAll(all);
    return true;
  }

  /** The kept entries' save times by model */
  keptState(): NextRtcKeptState {
    const state: NextRtcKeptState = {};
    for (const [id, entry] of Object.entries(this.readAll())) state[id] = { savedAt: entry.savedAt };
    return state;
  }

  /** Tells `onChanged` what the file holds now (at startup) */
  publish(): void {
    this.onChanged?.(this.keptState());
  }

  private readAll(): Record<string, NextRtcKeptEntry> {
    let parsed: StoredFile;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      return {};
    }
    if (!parsed || parsed.version !== FILE_VERSION || typeof parsed.profiles !== "object" || !parsed.profiles) return {};
    const all: Record<string, NextRtcKeptEntry> = {};
    for (const [id, stored] of Object.entries(parsed.profiles)) {
      const entry = { ...stored, ram: decodeRam(stored?.ram) } as NextRtcKeptEntry;
      if (isNextRtcKeptEntry(entry)) all[id] = entry;
    }
    return all;
  }

  private writeAll(all: Record<string, NextRtcKeptEntry>): void {
    const profiles: Record<string, StoredEntry> = {};
    for (const [id, entry] of Object.entries(all)) {
      profiles[id] = { ...entry, ram: Buffer.from(entry.ram).toString("base64") };
    }
    const file: StoredFile = { version: FILE_VERSION, profiles };
    fs.mkdirSync(this.folder(), { recursive: true });
    // --- Written beside and renamed over, so a crash never leaves half a file
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(file, null, 2) + "\n");
    fs.renameSync(temp, this.filePath);
    this.publish();
  }
}

function decodeRam(value: unknown): number[] | undefined {
  if (typeof value !== "string") return undefined;
  return Array.from(Buffer.from(value, "base64"));
}
