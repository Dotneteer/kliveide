import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { REPO_ROOT } from "../../harness/z88/core/machines";
import type { Z88TestSession } from "../../harness/z88";

/*
 * Fixed expectations for the Cambridge Z88 suites that once compared the WASM core with the
 * TypeScript machine in lockstep (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`, Step 1).
 *
 * The TypeScript machine recorded every value in `goldens/*.json` before it was deleted (the last
 * commit that has it is tagged `z88-typescript-last`), and the WASM core matched every one. A suite
 * states each checkpoint as `golden.expect(key, value)`; a value that differs from the recording is
 * a finding to settle against the hardware documentation (the Blink documentation, OZvm) - never by
 * editing the golden to fit.
 *
 * Binary data (memory, the picture, anything `ArrayBuffer.isView`) is stored as its length and
 * SHA-256, so a golden stays small while covering every byte.
 */

/** SHA-256 of bytes (a typed array's own bytes) or of a string, as hex */
export function sha256(data: ArrayBufferView | string): string {
  const bytes = typeof data === "string" ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return createHash("sha256").update(bytes).digest("hex");
}

/** The JSON form a golden stores: typed arrays become their length and hash; undefined is null */
export function toGolden(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (ArrayBuffer.isView(v) ? { byteLength: v.byteLength, sha256: sha256(v) } : v))
  );
}

/** The samples of a frame, as their count and the hash of their values */
export function audioDigest(samples: AudioSample[]): { count: number; sha256: string } {
  const values = new Float64Array(samples.length * 2);
  samples.forEach((s, i) => {
    values[2 * i] = s.left;
    values[2 * i + 1] = s.right;
  });
  return { count: samples.length, sha256: sha256(values) };
}

/** The hash of all 4 MB of physical memory, bank by bank */
export function memoryDigest(s: Z88TestSession): string {
  const hash = createHash("sha256");
  for (let bank = 0; bank < 256; bank++) hash.update(s.machine.getMemoryPartition(bank));
  return hash.digest("hex");
}

/**
 * Everything the lockstep comparison compared: CPU registers, tacts and frames, snooze and sleep, the
 * Blink state, the LCD picture, all 4 MB of physical memory and (optionally) the last frame's samples.
 */
export function machineState(s: Z88TestSession, { audio = false }: { audio?: boolean } = {}) {
  return {
    registers: s.registers(),
    tacts: s.tacts,
    frames: s.machine.frames,
    snoozed: s.snoozed,
    sleeping: s.sleeping,
    blink: s.blinkState(),
    lcd: { width: s.lcdWidth, height: s.lcdHeight, sha256: sha256(s.screen()) },
    audio: audio ? audioDigest(s.machine.getAudioSamples()) : undefined,
    memory: memoryDigest(s)
  };
}

/**
 * A running digest of a sequence of values - a machine state after every frame, registers after every
 * instruction - so a long lockstep run is one golden entry per stretch instead of one per step.
 */
export class Digest {
  private hash = createHash("sha256");
  private count = 0;

  add(value: unknown): this {
    this.hash.update(JSON.stringify(toGolden(value)));
    this.hash.update("\n");
    this.count++;
    return this;
  }

  /** The digest of the values added since the last call, and a fresh start */
  take(): { steps: number; sha256: string } {
    const result = { steps: this.count, sha256: this.hash.digest("hex") };
    this.hash = createHash("sha256");
    this.count = 0;
    return result;
  }
}

/**
 * Re-records instead of asserting: `Z88_GOLDENS_RECORD=1`.
 *
 * Only for a behaviour change already settled as a finding (see the header): the Blink RTC fixes of
 * issue #1374 were the first. Run the affected suites with it once, then review the JSON diff key by
 * key - every changed entry must follow from the settled change - and run them again without it.
 */
const RECORD = process.env.Z88_GOLDENS_RECORD === "1";

/** The goldens of one suite (`goldens/<name>.json`) */
export function goldens(name: string) {
  const file = join(REPO_ROOT, "test/wasm/z88/goldens", `${name}.json`);
  const stored: Record<string, unknown> = JSON.parse(readFileSync(file, "utf8"));
  return {
    /** Asserts `actual` equals the golden stored under `key` */
    expect(key: string, actual: unknown): void {
      expect(key in stored, `no golden '${key}' in ${name}.json`).toBe(true);
      if (RECORD) {
        stored[key] = toGolden(actual);
        writeFileSync(file, JSON.stringify(stored, null, 1) + "\n");
        return;
      }
      expect(toGolden(actual), key).toEqual(stored[key]);
    }
  };
}
