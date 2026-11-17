import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { NEXT_ROM_SETS } from "@common/zxnext/romSets";
import { NEXT_PROFILE_IDS, nextProfileOf } from "@emu/machines/zxNext/nextProfiles";
import { checkNextSdCard } from "@main/next-sd/checkNextSdCard";
import { writeCardFrom } from "@main/next-sd/nextSdCards";
import { nextSdBaseImage } from "../harness/zxnext/core/sdCards";

/*
 * The SD card check (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-8) on the real base cards: every model's own
 * card passes, a card of another release is named as such, and a working copy made from the default
 * card (raw or gzipped) passes too. No core runs, and the copy takes about a second, so this stays in
 * the unit tier.
 */

const cardOf = (setId: keyof typeof NEXT_ROM_SETS) => nextSdBaseImage(setId);

describe("checking the real base cards", () => {
  it.each(NEXT_PROFILE_IDS)("passes %s's own card", (modelId) => {
    const card = cardOf(nextProfileOf(modelId).romSet);
    expect(fs.existsSync(card)).toBe(true);
    expect(checkNextSdCard(card, modelId)).toEqual({ status: "ok", file: card });
  });

  it("names the 2.08 card as another release for a 2.10 model", () => {
    const card = cardOf("nextzxos-2.08");
    expect(checkNextSdCard(card, "ks2-30204")).toEqual({
      status: "wrongRelease",
      file: card,
      expected: "nextzxos-2.10",
      found: "nextzxos-2.08"
    });
  });

  it("makes a working copy of the default card, raw or gzipped, that passes the check", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-sd-real-"));
    try {
      const setId = "nextzxos-26.11" as const;
      const raw = path.join(dir, "raw.cim");
      await writeCardFrom({ setId, file: cardOf(setId), source: "bundled", compressed: false }, raw);
      expect(checkNextSdCard(raw, "ks3-30303").status).toBe("ok");

      const gz = path.join(dir, `${setId}.cim.gz`);
      fs.writeFileSync(gz, gzipSync(fs.readFileSync(cardOf(setId)), { level: 1 }));
      const fromGz = path.join(dir, "gz.cim");
      await writeCardFrom({ setId, file: gz, source: "downloaded", compressed: true }, fromGz);
      expect(checkNextSdCard(fromGz, "ks3-30303").status).toBe("ok");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
