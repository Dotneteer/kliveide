/*
 * The Z88 Blink real-time clock as a count of milliseconds, and the "lost time" catch-up a `.z88`
 * snapshot load applies (OZvm `Blink.adjustLostTime()`; the spec's "RTC catch-up" section).
 *
 * TIM0-TIM4 are a monotonic counter, not a calendar: 5 ms ticks, seconds, minutes, 256-minute and
 * 65536-minute units. The largest value is about 1.1e12 ms, well inside `Number.MAX_SAFE_INTEGER`,
 * so plain numbers are exact here.
 */

/** TIM0..TIM4, in register order */
export type Z88Tim = readonly [number, number, number, number, number];

const MS_PER_TICK = 5;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/**
 * Converts the TIM0-TIM4 registers to milliseconds.
 * @param tim TIM0..TIM4 (each 0..255)
 */
export function decodeZ88Tim(tim: Z88Tim): number {
  return (
    tim[0] * MS_PER_TICK +
    tim[1] * MS_PER_SECOND +
    tim[2] * MS_PER_MINUTE +
    tim[3] * 256 * MS_PER_MINUTE +
    tim[4] * 65536 * MS_PER_MINUTE
  );
}

/**
 * Converts milliseconds to the TIM0-TIM4 registers. TIM4 wraps at 8 bits as the hardware does;
 * the 5 ms tick is clamped to 199.
 * @param totalMs A non-negative millisecond count
 */
export function encodeZ88Tim(totalMs: number): Z88Tim {
  const ms = Math.max(0, Math.floor(totalMs));
  let minutes = Math.floor(ms / MS_PER_MINUTE);
  const remainMs = ms % MS_PER_MINUTE;

  const tim4 = Math.floor(minutes / 65536) & 0xff;
  minutes %= 65536;
  const tim3 = Math.floor(minutes / 256) & 0xff;
  const tim2 = minutes % 256;
  const tim1 = Math.floor(remainMs / MS_PER_SECOND) & 0xff;
  const tim0 = Math.min(199, Math.floor((remainMs % MS_PER_SECOND) / MS_PER_TICK));
  return [tim0, tim1, tim2, tim3, tim4];
}

/**
 * Advances a restored RTC by the host time that passed while the snapshot was on disk.
 *
 * A host clock that went backwards (`nowMs < stoppedAtMs`) adds nothing: the RTC never runs
 * backwards. A missing stop time means no catch-up, as in OZvm.
 * @param tim The restored TIM0..TIM4
 * @param stoppedAtMs `Z88StoppedAtTime` (host ms since 1970), or undefined when absent
 * @param nowMs The current host time in ms since 1970
 */
export function adjustZ88LostTime(
  tim: Z88Tim,
  stoppedAtMs: number | undefined,
  nowMs: number
): Z88Tim {
  const deltaMs = stoppedAtMs === undefined ? 0 : Math.max(0, nowMs - stoppedAtMs);
  return encodeZ88Tim(decodeZ88Tim(tim) + deltaMs);
}
