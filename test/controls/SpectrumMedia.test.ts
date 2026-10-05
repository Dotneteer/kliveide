import { describe, expect, it } from "vitest";
import {
  describeSpectrumMedia,
  mediaFileName
} from "@renderer/appEmu/machines/spectrumMedia";
import { machineEmuToolRegistry } from "@renderer/appEmu/tool-registry";
import {
  MEDIA_INFO_MACHINE_IDS,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TIMEX,
  MI_Z88
} from "@common/machines/constants";
import { SETTING_EMU_SHOW_MEDIA_INFO } from "@common/settings/setting-const";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";

describe("Spectrum media strip", () => {
  it("takes the file name from either separator", () => {
    expect(mediaFileName("/home/me/games/manic.tzx")).toBe("manic.tzx");
    expect(mediaFileName("C:\\games\\jsw.tap")).toBe("jsw.tap");
    expect(mediaFileName("plain.tap")).toBe("plain.tap");
  });

  it("shows only the tape for a model without drives", () => {
    const cards = describeSpectrumMedia({ tape: "/x/manic.tzx" }, 0);
    expect(cards).toEqual([
      {
        mediaId: "tape",
        title: "Tape",
        fileName: "manic.tzx", fullPath: "/x/manic.tzx",
        emptyText: "(no tape)"
      }
    ]);
  });

  it("treats an ejected tape and missing media state as empty", () => {
    expect(describeSpectrumMedia({ tape: "" }, 0)[0].fileName).toBeUndefined();
    expect(describeSpectrumMedia(undefined, 0)[0].fileName).toBeUndefined();
  });

  it("adds one card per floppy drive with write protection", () => {
    const cards = describeSpectrumMedia(
      {
        diskA: { diskFile: "/d/one.dsk", writeProtected: true },
        diskB: {}
      },
      2
    );
    expect(cards.map((c) => c.title)).toEqual(["Tape", "Drive A", "Drive B"]);
    expect(cards.map((c) => c.mediaId)).toEqual(["tape", "diskA", "diskB"]);
    expect(cards[1]).toMatchObject({ fileName: "one.dsk", writeProtected: true });
    expect(cards[2]).toMatchObject({ fileName: undefined, emptyText: "(no disk)" });
    expect(cards[2].writeProtected).toBeUndefined();
  });

  it("shows only drive A on a one-drive +3E", () => {
    expect(describeSpectrumMedia({}, 1).map((c) => c.title)).toEqual(["Tape", "Drive A"]);
  });

  it("registers a switchable strip for the Spectrum models and keeps the Z88 strip fixed", () => {
    expect(MEDIA_INFO_MACHINE_IDS).toEqual([MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_TIMEX]);
    for (const id of MEDIA_INFO_MACHINE_IDS) {
      const entry = machineEmuToolRegistry.find((t) => t.machineId === id);
      expect(entry?.visibilitySetting).toBe(SETTING_EMU_SHOW_MEDIA_INFO);
    }
    expect(machineEmuToolRegistry.find((t) => t.machineId === MI_Z88)?.visibilitySetting)
      .toBeUndefined();
    expect(KliveGlobalSettings[SETTING_EMU_SHOW_MEDIA_INFO]?.type).toBe("boolean");
    // --- On unless the user turns it off
    expect(KliveGlobalSettings[SETTING_EMU_SHOW_MEDIA_INFO]?.defaultValue).toBe(true);
  });
});
