import { describe, expect, it } from "vitest";

import { forkConfirmation, formatReverseSeconds, reverseStatusText, reverseStatusTooltip } from "@common/history/reverseDebugText";

/*
 * The words of full reverse debugging's UI (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4): the status
 * bar's states and the fork confirmation (D12, T4).
 */
describe("reverse debugging: the status bar and the fork confirmation", () => {
  it("formats machine time", () => {
    expect(formatReverseSeconds(0.000042)).toBe("42 µs");
    expect(formatReverseSeconds(0.0035)).toBe("3.5 ms");
    expect(formatReverseSeconds(0.0349)).toBe("35 ms");
    expect(formatReverseSeconds(1.2345)).toBe("1.23 s");
    expect(formatReverseSeconds(41.4)).toBe("41 s");
    expect(formatReverseSeconds(723)).toBe("12 min 3 s");
  });

  it("says where the machine stands", () => {
    expect(reverseStatusText(undefined)).toBeUndefined();
    expect(reverseStatusText({ active: true, mode: "live", rangeSeconds: 40 })).toBeUndefined();
    expect(reverseStatusText({ active: true, mode: "navigating", behindSeconds: 1.24 }, "−3,412")).toBe("⟲ −1.24 s · step −3,412");
    expect(reverseStatusText({ active: true, mode: "navigating", behindSeconds: 12.5, deepLanding: true })).toBe(
      "⟲ −13 s · before the history window"
    );
    expect(reverseStatusText({ active: true, mode: "replaying", behindSeconds: 0.8 })).toBe("▶ Replaying · 800 ms to present");
    expect(reverseStatusText({ active: true, mode: "navigating", searchedIntervals: 3 })).toBe("⟲ Searching back… 3 intervals");
    expect(reverseStatusText({ active: false, mode: "live", desync: "Replay diverged at 12/1 (ring)" })).toBe(
      "⚠ Reverse debugging stopped"
    );
  });

  it("explains itself in the tooltip, the reverse range and ignored input included", () => {
    const tip = reverseStatusTooltip({ active: true, mode: "navigating", behindSeconds: 1, rangeSeconds: 41, inputsIgnored: 2 })!;
    expect(tip).toContain("Click to return to the present");
    expect(tip).toContain("Input ignored while in the past (2)");
    expect(tip).toContain("Reverse range: 41 s");
    expect(reverseStatusTooltip({ active: false, mode: "live", desync: "Replay diverged" })).toBe(
      "Reverse debugging stopped: Replay diverged"
    );
  });

  it("names a timeline opened from a debug recording (DEBUG_SESSION_RECORDING D10)", () => {
    expect(reverseStatusText({ active: true, mode: "live", recording: "bug.klr" })).toBe("Recording: bug.klr");
    expect(reverseStatusText({ active: true, mode: "navigating", behindSeconds: 1.24, recording: "bug.klr" }, "−42")).toBe(
      "⟲ −1.24 s · step −42 · bug.klr"
    );
    expect(reverseStatusText({ active: true, mode: "live" })).toBeUndefined();
    expect(reverseStatusTooltip({ active: true, mode: "live", recording: "bug.klr" })).toContain("debug recording bug.klr");
  });

  it("names what a fork reverts and what it leaves", () => {
    const plain = forkConfirmation({ sdWrites: 0, hostFiles: [] });
    expect(plain.message).toBe("Continue from this point in the past?");
    expect(plain.detail).not.toContain("SD card");
    const full = forkConfirmation({ sdWrites: 3, hostFiles: ["game.tzx"] }, "Edit HL");
    expect(full.message).toBe("Edit HL in the past?");
    expect(full.detail).toContain("The SD card's 3 sector writes in that future will be undone.");
    expect(full.detail).toContain("Files saved to tape in that future stay on disk: game.tzx.");
    expect(full.confirmLabel).toBe("Take Over");
  });
});
