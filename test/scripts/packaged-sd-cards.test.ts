import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { NEW_PROJECT_NEXT_PROFILE_ID, nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { DEFAULT_MACHINE_FAVORITES } from "@common/machines/machine-favorites";
import { newProjectModelOf } from "@common/machines/machine-registry";
import { MI_ZXNEXT } from "@common/machines/constants";

/*
 * The install kit carries the default ZX Spectrum Next model's SD card, and only that one
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 0 and D-2). No release before this test shipped a card:
 * `src/public/mmc` was not in `extraResources`, and the Next booted to "Drive C: not found".
 * `dev/scripts/check-packaged-sd-cards.cjs` checks the built kit itself in the release workflow.
 */

const ROOT = path.join(__dirname, "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

describe("the SD card in the install kit", () => {
  const defaultCard = romSetOf(nextProfileOf(NEW_PROJECT_NEXT_PROFILE_ID)).sdBaseImage.file;

  it("the default Next model is the KS3 with the newest core, for new projects and the Machine type menu", () => {
    expect(NEW_PROJECT_NEXT_PROFILE_ID).toBe("ks3-30303");
    expect(newProjectModelOf(MI_ZXNEXT)).toBe(NEW_PROJECT_NEXT_PROFILE_ID);
    expect(DEFAULT_MACHINE_FAVORITES.find((f) => f.machineId === MI_ZXNEXT)?.modelId).toBe(NEW_PROJECT_NEXT_PROFILE_ID);
  });

  it("extraResources ships exactly the default model's base image into resources/mmc", () => {
    const entry = pkg.build.extraResources.find((e: { from: string }) => e.from === "src/public/mmc");
    expect(entry, "an extraResources entry from src/public/mmc").toBeDefined();
    expect(entry.to).toBe("mmc");
    // --- `process.env.PUBLIC` is the resources folder in a packaged app; the card is read at PUBLIC/<file>
    expect(entry.filter.map((f: string) => `mmc/${f}`)).toEqual([defaultCard]);
  });

  it("the default model's base image is in the repository to be shipped", () => {
    expect(fs.statSync(path.join(ROOT, "src/public", defaultCard)).isFile()).toBe(true);
  });
});
