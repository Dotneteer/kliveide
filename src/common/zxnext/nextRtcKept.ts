/*
 * A ZX Spectrum Next's kept real-time clock (`dev/ai/zxnext-rtc.md` D5): what the
 * emulator saves and loads through the main process, one per Next model, in `zxnext-rtc.json`.
 */

/** One model's kept DS1307 */
export type NextRtcKeptEntry = {
  /**
   * A running clock against the host's: its offset in whole seconds, the program's day-of-week
   * numbering (0-6 against Sunday = 1) and the 12-hour mode. Undefined for a stopped clock (CH) or a
   * time that is no valid date, which `regs` then holds as it was.
   */
  time?: { offsetSeconds: number; dayOffset: number; hours12: boolean };
  /** Registers 0-6 when saved */
  regs: number[];
  /** Register 7 */
  control: number;
  /** Registers $08-$3F, 56 bytes */
  ram: number[];
  /** When it was saved (host milliseconds) */
  savedAt: number;
};

/** What the Settings dialog's Kept clock row shows: the kept entries' save times by model */
export type NextRtcKeptState = Record<string, { savedAt: number }>;

/** Is this a usable entry (a file someone edited may hold anything)? */
export function isNextRtcKeptEntry(value: unknown): value is NextRtcKeptEntry {
  const e = value as NextRtcKeptEntry;
  const byte = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255;
  if (!e || typeof e !== "object") return false;
  if (!Array.isArray(e.regs) || e.regs.length !== 7 || !e.regs.every(byte)) return false;
  if (!byte(e.control) || !Array.isArray(e.ram) || e.ram.length !== 56 || !e.ram.every(byte)) return false;
  if (typeof e.savedAt !== "number" || !Number.isFinite(e.savedAt)) return false;
  if (e.time !== undefined) {
    const t = e.time;
    if (!t || !Number.isInteger(t.offsetSeconds) || !Number.isInteger(t.dayOffset) || typeof t.hours12 !== "boolean") {
      return false;
    }
  }
  return true;
}
