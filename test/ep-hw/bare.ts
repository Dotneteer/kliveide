import type { EpTestSession } from "../harness/enterprise";

/*
 * An Enterprise without EXOS running: page 0 shows RAM segment F8h (not video RAM, so NICK never
 * stretches the CPU there), the CPU sits in `DI; HALT` at 0000h, and the test writes NICK's LPT into
 * video RAM itself.
 */

/** Where the bare machine's code lives: segment F8h in page 0 */
export const CODE_SEGMENT = 0xf8;

/** An LPB, as the test writes it (`NICK_VIDEO.md` §3.2) */
export type Lpb = {
  lines: number;
  /** MB bits 3-1: 0 VSYNC, 1 PIXEL, 2 ATTRIBUTE, 3 CH256, 4 CH128, 5 CH64, 7 LPIXEL */
  mode: number;
  colours?: number;
  vres?: boolean;
  vint?: boolean;
  reload?: boolean;
  lm: number;
  rm: number;
  ld1?: number;
  ld2?: number;
  palette?: number[];
};

export function lpbBytes(b: Lpb): number[] {
  const mb = ((b.vint ? 1 : 0) << 7) | ((b.colours ?? 0) << 5) | ((b.vres ? 1 : 0) << 4) | (b.mode << 1) | (b.reload ? 1 : 0);
  const ld1 = b.ld1 ?? 0;
  const ld2 = b.ld2 ?? 0;
  const palette = b.palette ?? [0, 0, 0, 0, 0, 0, 0, 0];
  return [(256 - b.lines) & 0xff, mb, b.lm & 0x3f, b.rm & 0x3f, ld1 & 0xff, ld1 >> 8, ld2 & 0xff, ld2 >> 8, ...palette];
}

/**
 * A 312-line frame like the IS 1984 demo's (NICK_VIDEO_BACKGROUND.md §6.1), with vertical sync from
 * slot 6 of line 260 for 4 lines, and an optional VINT block. `picture` replaces the first 256 lines.
 */
export function standardLpt({ picture, vintLines = 0 }: { picture?: Lpb[]; vintLines?: number } = {}): Lpb[] {
  const body = picture ?? [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000 }];
  const bodyLines = body.reduce((n, b) => n + b.lines, 0);
  const tail: Lpb[] = [];
  if (vintLines) tail.push({ lines: vintLines, mode: 7, vint: true, lm: 63, rm: 0 });
  tail.push(
    { lines: 260 - bodyLines - vintLines, mode: 7, lm: 63, rm: 0 },
    { lines: 3, mode: 0, lm: 6, rm: 63 },
    { lines: 1, mode: 0, lm: 63, rm: 6 },
    { lines: 48, mode: 7, lm: 63, rm: 0, reload: true }
  );
  return [...body, ...tail];
}

/** Writes an LPT at `base` (16-byte aligned) and makes NICK load it now (the guide's forced reload) */
export function loadLpt(s: EpTestSession, blocks: Lpb[], base = 0x3000): void {
  blocks.forEach((b, i) => s.pokeVram(base + i * 16, lpbBytes(b)));
  forceLptBase(s, base);
}

/** Port 83h's forced reload: bits 7-6 = 00, then 01, then 11 (NICK_VIDEO.md §3.5) */
export function forceLptBase(s: EpTestSession, base: number): void {
  s.wasm.epWritePort(0x82, (base >> 4) & 0xff);
  s.wasm.epWritePort(0x83, (base >> 12) & 0x0f);
  s.wasm.epWritePort(0x83, ((base >> 12) & 0x0f) | 0x40);
  s.wasm.epWritePort(0x83, ((base >> 12) & 0x0f) | 0xc0);
}

/**
 * Parks the CPU in `DI; HALT` (or `DI; JR $` with `halt: false`) in segment F8h at 0000h, pages
 * 1-3 F9h, FAh, FFh, no DAVE waits (BFh = 0Ch), every interrupt off, and loads `lpt`. Runs `settle`
 * frames so the LPT is running.
 */
export function bareMachine(
  s: EpTestSession,
  { lpt = standardLpt(), settle = 2, halt = true, bf = 0x0c }: { lpt?: Lpb[]; settle?: number; halt?: boolean; bf?: number } = {}
): void {
  const w = s.wasm;
  w.epWritePort(0xb4, 0xaa);
  w.epWritePort(0xbf, bf);
  [CODE_SEGMENT, 0xf9, 0xfa, 0xff].forEach((seg, page) => w.epWritePort(0xb0 + page, seg));
  s.poke(0x0000, halt ? [0xf3, 0x76] : [0xf3, 0x18, 0xfe]);
  s.machine.pc = 0x0000;
  s.machine.sp = 0x7ff0;
  loadLpt(s, lpt);
  s.runFrames(settle);
}

/** Steps until `predicate` holds; throws after `limit` steps */
export function stepUntil(s: EpTestSession, predicate: () => boolean, limit = 400_000): void {
  for (let i = 0; i < limit; i++) {
    if (predicate()) return;
    s.step(1);
  }
  throw new Error("stepUntil: the condition never held");
}

/**
 * Runs `code` at 4000h of `segment` (page 1) and returns the T-states it took: the code is followed by
 * `JR $`, and it is stepped until PC reaches that (a HALT would leave the CPU halted for the next run)
 */
export function timeCode(s: EpTestSession, code: number[], { segment = 0xf9 }: { segment?: number } = {}): number {
  s.wasm.epWritePort(0xb1, segment);
  const end = 0x4000 + code.length;
  s.poke(0x4000, [...code, 0x18, 0xfe]);
  s.machine.pc = 0x4000;
  const start = s.wasm.epGetHalfClock();
  stepUntil(s, () => s.machine.pc === end, 1_000_000);
  return ((s.wasm.epGetHalfClock() - start) >>> 0) / 2;
}
