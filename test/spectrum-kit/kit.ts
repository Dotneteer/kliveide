import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createSp48Session, type Sp48TestSession } from "../harness/sp48";
import { createSp128Session, type Sp128TestSession } from "../harness/sp128";

/*
 * The ZX Spectrum timing test kit (`vendor/spectrum-tests/`, `.plans/SPECTRUM_ULA_ACCURACY_PLAN.md`
 * Phase 0): runs the community's test programs on Klive's cores. Each program has a test file of its
 * own here, in the slow tier (`npm run test:slow`).
 *
 * A program that reports its own result (PASS/FAIL, a table checked against its author's real
 * machines) is asserted. A program that only draws gets its picture written to `.spectrum-kit/`
 * (git-ignored) for a by-eye comparison with the real-machine photos and videos on its ZXE wiki page:
 * never a golden recorded from Klive's own output (the plan's ground rules).
 */

/** The kit's folder */
export const KIT = join(__dirname, "../../vendor/spectrum-tests");

/** Where the runs' pictures go */
export const OUT = join(__dirname, "../../.spectrum-kit");

export type KitSession = Sp48TestSession | Sp128TestSession;

/** The machines the kit runs on, with the ULA's options */
export type KitMachine = {
  model: "48k" | "128k" | "plus2a";
  late?: boolean;
  snow?: boolean;
};

/** A machine of the kind, its ULA options set */
export async function kitMachine({ model, late = false, snow = true }: KitMachine): Promise<KitSession> {
  const s = model === "48k" ? await createSp48Session() : await createSp128Session(model === "128k" ? "sp128" : "plus2a");
  const x = s.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
  const core = model === "48k" ? "sp48" : model === "128k" ? "sp128" : undefined;
  if (core) {
    x[`${core}SetLateTiming`](late ? 1 : 0);
    x[`${core}SetSnowEffect`](snow ? 1 : 0);
  }
  return s;
}

/**
 * Loads a kit tape (or `.szx` snapshot) the way a user does. `slow`: at the real tape speed, for a
 * program with its own loader that the ROM's fast-load trap does not see.
 */
export function loadKitFile(s: KitSession, file: string, { slow = false } = {}): void {
  const path = join(KIT, file);
  if (file.endsWith(".szx")) {
    s.loadSnapshot(file, new Uint8Array(readFileSync(path)));
  } else {
    s.loadTap(path, { fastLoad: !slow });
  }
}

/** The screen's text, one line per row (`?` for a cell no ROM character matches) */
export function screenText(s: KitSession): string {
  return Array.from({ length: 24 }, (_, row) => s.screenLine(row)).join("\n");
}

/** Presses a chord of keys (held 5 frames, then 10 frames free) */
export function press(s: KitSession, ...keys: string[]): void {
  s.typeKeys([keys], { hold: 5, gap: 10 });
}

/** Writes the picture (and its text) to `.spectrum-kit/<name>.png` / `.txt` for a by-eye check */
export function savePicture(s: KitSession, name: string): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.png`), s.screenPng());
  writeFileSync(join(OUT, `${name}.txt`), screenText(s));
}

/**
 * Pages through a program that shows one result screen after another and waits for a key: runs
 * `frames` frames, keeps the text, presses SPACE, until `done` matches the text or `maxPages` pass.
 * Returns the pages' texts.
 */
export function pageThrough(
  s: KitSession,
  { frames = 300, maxPages = 120, done }: { frames?: number; maxPages?: number; done: RegExp }
): string[] {
  const pages: string[] = [];
  for (let page = 0; page < maxPages; page++) {
    s.runFrames(frames);
    const text = screenText(s);
    pages.push(text);
    if (done.test(text)) break;
    press(s, "Space");
  }
  return pages;
}

/** A pixel of the picture as the emulator panel shows it (row 0: the first visible line) */
export function pictureRgb(s: KitSession, row: number, col: number): number {
  const { width, pixels } = s.screenImage();
  const i = (row * width + col) * 4;
  return (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
}
