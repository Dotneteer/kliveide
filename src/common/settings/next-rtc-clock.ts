/**
 * What the ZX Spectrum Next's real-time clock follows (`.ai/zxnext-rtc.md` D1): the
 * host's clock (the real time, as the battery-backed DS1307 shows it), or emulated time, which stops
 * while the debugger pauses and runs fast or slow with the emulator. The Settings dialog reads this
 * table; the emulator panel pushes the choice into the running machine (`NEXT_RTC_CLOCK`).
 */
import { withLabels } from "@common/i18n/labels";
import type { MessageKey } from "@common/i18n/keys.generated";

export type NextRtcClock = "host" | "emulated";

export type NextRtcClockOption = {
  /** Label in the Settings dialog; translated each time it is read */
  readonly label: string;
  readonly labelKey: MessageKey;
  value: NextRtcClock;
};

export const NEXT_RTC_CLOCKS: NextRtcClockOption[] = withLabels<{ labelKey: MessageKey; value: NextRtcClock }>([
  { labelKey: "common.nextRtcClock.host", value: "host" },
  { labelKey: "common.nextRtcClock.emulated", value: "emulated" }
]);

export const DEFAULT_NEXT_RTC_CLOCK: NextRtcClock = "host";

/** A stored value as a known choice; anything else is the default */
export function normalizeNextRtcClock(value: unknown): NextRtcClock {
  return value === "emulated" ? "emulated" : DEFAULT_NEXT_RTC_CLOCK;
}
