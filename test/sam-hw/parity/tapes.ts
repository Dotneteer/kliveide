import { tapeBlocksOf } from "@common/headless/tapeBlocks";
import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

/*
 * The parity probes' tapes (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md, Phase 6). A probe that says "@tape <name>"
 * gets the TZX file built here: Klive plays it through its own TZX reader (`tapeBlocksOf`, as the IDE's tape
 * insert does), SimCoupé gets the same file through its tape browser (F3, by hand: it takes no tape on the
 * command line and ignores dropped files on macOS).
 *
 * The blocks used are 10h (standard speed), 11h (turbo), 12h (pure tone) and 20h (pause). Pulse lengths are in
 * 3.5 MHz T-states, the TZX unit.
 */

type TzxBlock =
  | { kind: "standard"; pause: number; data: Uint8Array }
  | {
      kind: "turbo";
      pilot: number;
      sync1: number;
      sync2: number;
      zero: number;
      one: number;
      pilotCount: number;
      pause: number;
      data: Uint8Array;
    }
  | { kind: "tone"; pulse: number; count: number }
  | { kind: "pause"; ms: number };

/** A TZX 1.20 file of `blocks` */
export function tzxFile(blocks: TzxBlock[]): Uint8Array {
  const out: number[] = [..."ZXTape!"].map((c) => c.charCodeAt(0));
  out.push(0x1a, 1, 20);
  const word = (v: number) => out.push(v & 0xff, (v >> 8) & 0xff);
  for (const b of blocks) {
    if (b.kind === "standard") {
      out.push(0x10);
      word(b.pause);
      word(b.data.length);
      out.push(...b.data);
    } else if (b.kind === "turbo") {
      out.push(0x11);
      for (const v of [b.pilot, b.sync1, b.sync2, b.zero, b.one, b.pilotCount]) word(v);
      out.push(8);
      word(b.pause);
      out.push(b.data.length & 0xff, (b.data.length >> 8) & 0xff, (b.data.length >> 16) & 0xff);
      out.push(...b.data);
    } else if (b.kind === "tone") {
      out.push(0x12);
      word(b.pulse);
      word(b.count);
    } else {
      out.push(0x20);
      word(b.ms);
    }
  }
  return Uint8Array.from(out);
}

/** A tape file as the blocks Klive's deck plays */
export function tapeBlocks(file: Uint8Array): TapeDataBlock[] {
  const result = tapeBlocksOf(file);
  if ("error" in result) throw new Error(`not a tape: ${result.error}`);
  return result.blocks;
}

/*
 * The CODE file: the header ROM 3.0's `SAVE "klive" CODE 32768,100` writes (recorded in Klive from MIC,
 * test/sam-hw/tape.test.ts), and 100 bytes (i * 13 + 5) & FFh. `LOAD "" CODE 81920` puts them in page 4.
 */
const HEADER = Uint8Array.from([
  0x01, 0x13, 0x6b, 0x6c, 0x69, 0x76, 0x65, ...Array(20).fill(0x20), 0xff, 0xff, 0xff, 0xff, 0xff, 0x61, 0x00, 0x80,
  0x00, 0x64, 0x80, 0xff, 0xff, 0xff, ...Array(40).fill(0x00), 0x6a
]);
export const CODE_LENGTH = 100;
export const codeByte = (i: number) => (i * 13 + 5) & 0xff;

function dataBlock(): Uint8Array {
  const bytes = [0xff, ...Array.from({ length: CODE_LENGTH }, (_, i) => codeByte(i))];
  return Uint8Array.from([...bytes, bytes.reduce((a, b) => a ^ b, 0)]);
}

/** The CODE file as two turbo blocks with every pulse scaled by `scale` (1: the Spectrum ROM's timing) */
function scaledCode(scale: number, pause = 1000): TzxBlock[] {
  const p = (v: number) => Math.round(v * scale);
  const block = (data: Uint8Array, pilotCount: number): TzxBlock => ({
    kind: "turbo",
    pilot: p(2168),
    sync1: p(667),
    sync2: p(735),
    zero: p(855),
    one: p(1710),
    pilotCount,
    pause,
    data
  });
  return [block(HEADER, 8063), block(dataBlock(), 3223)];
}

/** The EAR probe's tones (pulse lengths, T-states) and pulses per tone; probes/tape-ear.kz80.asm counts the same */
export const EAR_TONES = [2000, 1000, 800, 600, 500, 450, 400, 350, 300];
export const EAR_TONE_PULSES = 60;

/** The named tapes */
export const TAPES: Record<string, () => Uint8Array> = {
  // --- The ROM's LOAD: standard blocks, then faster and slower pulses. ROM 3.0 in Klive loads from 0.25 to
  // --- 1.18 times the standard lengths (not at 0.2 or 1.2, 2026-11-27): "turbo" and "slow" sit near those edges
  "code-std": () =>
    tzxFile([
      { kind: "standard", pause: 1000, data: HEADER },
      { kind: "standard", pause: 1000, data: dataBlock() }
    ]),
  "code-fast": () => tzxFile(scaledCode(0.5)),
  "code-turbo": () => tzxFile(scaledCode(0.25)),
  "code-slow": () => tzxFile(scaledCode(1.15)),
  // --- A pure tone and a long pause between the header and the data
  "code-pause": () => {
    const [header, data] = scaledCode(1);
    return tzxFile([header, { kind: "tone", pulse: 1000, count: 400 }, { kind: "pause", ms: 3000 }, data]);
  },
  // --- EAR sampling: the CODE file first, so that the ROM's LOAD starts the tape (SimCoupé plays a tape only
  // --- while the ROM loads), a pause while the probe boots from disk, pure tones of known pulse lengths, a pause
  "ear-tones": () =>
    tzxFile([
      { kind: "standard", pause: 1000, data: HEADER },
      { kind: "standard", pause: 4000, data: dataBlock() },
      ...EAR_TONES.map((pulse): TzxBlock => ({ kind: "tone", pulse, count: EAR_TONE_PULSES })),
      { kind: "pause", ms: 2000 }
    ])
};

/** The tape a probe names */
export function probeTape(name: string): Uint8Array {
  const build = TAPES[name];
  if (!build) throw new Error(`@tape: no tape ${name}`);
  return build();
}
