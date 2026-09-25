/**
 * This class represents the information about an emulated key press
 */
export class EmulatedKeyStroke {
  constructor (
    public startTact: number,
    public endTact: number,
    public primaryCode: number,
    public secondaryCode?: number,
    public ternaryCode?: number
  ) {}
}

/** The range of a CPU tact counter kept in 32 bits, as the WASM cores keep it */
const TACT_COUNTER_RANGE = 0x1_0000_0000;

/**
 * A tact point in the range of a 32-bit tact counter.
 *
 * A keystroke's start and end are counted forward from the current tact. Computed in JS numbers they
 * can pass 2^32, which a WASM core's counter never shows - it wraps to 0 instead (after about 22
 * minutes on a Cambridge Z88, issue #1374).
 */
export function toTactCounter(tact: number): number {
  return ((tact % TACT_COUNTER_RANGE) + TACT_COUNTER_RANGE) % TACT_COUNTER_RANGE;
}

/**
 * How far `now` is past `point` on a wrapping 32-bit tact counter: negative while `point` is still
 * ahead. Correct while the two are less than 2^31 tacts apart - minutes at any clock this app runs,
 * against a keystroke that lasts a few frames.
 *
 * Comparing the raw values instead broke at the wrap: a keystroke queued just before it was pressed
 * and never released (its end stayed "ahead" of the small counter for good), and one whose start
 * passed 2^32 never began and blocked the queue.
 */
export function tactsPast(now: number, point: number): number {
  return (toTactCounter(now) - toTactCounter(point)) | 0;
}

/**
 * The later of two points on a wrapping 32-bit tact counter, in the counter's range.
 *
 * The Spectrum and Next queues chain a keystroke onto the end of the previous one, or onto "now"
 * when the queue has fallen behind. `Math.max` picks the wrong one across the wrap: a queue ending
 * just before 2^32 beats a counter that already reads a small number.
 */
export function laterTact(a: number, b: number): number {
  return tactsPast(a, b) >= 0 ? toTactCounter(a) : toTactCounter(b);
}
