import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, MATRIX_KEYS, type CoreName, type MatrixKey, type NextTestSession } from "../../harness/zxnext";

/*
 * The emulated keystroke queue (`queueKeystroke` / `emulateKeystroke`) - ported from
 * test/zxnext/KeystrokeQueue.test.ts, which covered only the TypeScript machine. The WASM machine has its
 * own copy in src/emu/machines/zxNext/ZxNextWasmHost.ts.
 *
 * This is a HOST API, not hardware: the code-injection flow and the on-screen keyboards queue keys on the
 * host's clock and the machine plays them back on its own, one queue entry at a time, each held for its
 * number of frames. There is no session method for it (it is not something a Next program or the
 * membrane can do), so the test calls the machine through the `s.machine` escape hatch - deliberately,
 * because the API itself is what is under test. What the machine then does with the keys is observed the
 * hardware way: a Z80 program polls the keyboard rows through port $FE and logs every change.
 *
 * .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.12: keys queued faster than the machine advances used
 * to share one time window, and the playback dropped the expired ones unpressed.
 *
 * Rows (zxnext.vhd ~3440-3456, membrane.vhd): A11 = $F7FE keys 1 2 3 4 5 (bits 0-4), A12 = $EFFE keys
 * 0 9 8 7 6 (bits 0-4); 0 = pressed.
 */

/** Logs (row $F7, row $EF) byte pairs from $A000 each time either changes; count at $9FFE. */
const LOGGER = `
        .org $8000
        di
        ld hl,$a000
        ld de,$ffff
Loop:   ld a,$f7
        in a,($fe)
        and $1f
        ld b,a
        ld a,$ef
        in a,($fe)
        and $1f
        ld c,a
        ld a,b
        cp d
        jr nz,Changed
        ld a,c
        cp e
        jr z,Loop
Changed:
        ld d,b
        ld e,c
        ld (hl),b
        inc hl
        ld (hl),c
        inc hl
        ld ($9ffe),hl
        jr Loop
`;

const ROW_F7: MatrixKey[] = ["1", "2", "3", "4", "5"];
const ROW_EF: MatrixKey[] = ["0", "9", "8", "7", "6"];

/** The keys held in each logged state, e.g. ["", "1", "", "2", ...]. */
function logged(s: NextTestSession): string[] {
  const end = s.peekWord(0x9ffe);
  const out: string[] = [];
  for (let a = 0xa000; a < end; a += 2) {
    const [f7, ef] = [s.peek(a), s.peek(a + 1)];
    const keys = [...ROW_F7.filter((_, i) => !(f7 & (1 << i))), ...ROW_EF.filter((_, i) => !(ef & (1 << i)))];
    out.push(keys.join("+"));
  }
  return out;
}

async function session(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(LOGGER);
  s.pokeWord(0x9ffe, 0xa000);
  return s.runFrames(1);
}

/** `s.machine.queueKeystroke` - the host API under test (see the header for why it is called directly). */
const queue = (s: NextTestSession, frameOffset: number, frames: number, key: MatrixKey) =>
  s.machine.queueKeystroke(frameOffset, frames, MATRIX_KEYS.indexOf(key));

describe.each(ALL_CORES)("emulated keystroke queue - %s core", (core) => {
  it("keys queued all at once are each pressed for their frames, in order, none lost", async () => {
    const s = await session(core);
    const keys: MatrixKey[] = ["1", "2", "3", "4", "5", "6", "7", "8"];
    for (const key of keys) queue(s, 0, 5, key); // --- all at the same machine time
    s.runFrames(keys.length * 8);
    expect(s.machine.getKeyQueueLength(), "queue drained").toBe(0);
    const presses = logged(s).filter((k) => k !== "");
    expect(presses).toEqual(keys);
    // --- one key at a time: each press is followed by a state with no key (or directly by the next)
    expect(logged(s).every((k) => !k.includes("+"))).toBe(true);
  });

  it("a keystroke queued on an empty queue is down in the next frame and up after its frames", async () => {
    const s = await session(core);
    queue(s, 0, 3, "5");
    s.runFrames(1);
    expect(s.in(0xf7fe) & 0x10, "5 held after one frame").toBe(0);
    s.runFrames(5);
    expect(s.in(0xf7fe) & 0x10, "released").toBe(0x10);
    expect(logged(s).filter((k) => k !== "")).toEqual(["5"]);
  });
});
