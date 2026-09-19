/*
 * Exact-length Z80 delays for tact-accurate hardware tests (see the harness README, "Measuring to the
 * tact"). Used by `video/video-timing.test.ts` and `ula/border-timing.test.ts`.
 */

let labelCounter = 0;

/**
 * Exactly `tacts` T-states (>= 46) of code, changing only A, D, E and the flags: a DE countdown of 26
 * tacts per pass (21 for the last), then 5-tact `ret nz` (not taken: Z is set) and 4-tact `nop` fillers.
 */
export function delay(tacts: number): string {
  const passes = Math.floor((tacts - 5 - 15) / 26);
  if (passes < 1) throw new Error(`delay ${tacts} too short`);
  const rest = tacts - (26 * passes + 5); // 15 ... 40: rest mod 4 fives, then fours
  const fives = rest % 4;
  const fill = [...Array(fives).fill("ret nz"), ...Array((rest - 5 * fives) / 4).fill("nop")]; // Z set: not taken
  const label = `Dly${++labelCounter}`;
  return `
        ld de,${passes}          ; 10
${label}: dec de                 ; 6
        ld a,d                   ; 4
        or e                     ; 4
        jr nz,${label}           ; 12 / 7
        ${fill.join("\n        ")}`;
}
