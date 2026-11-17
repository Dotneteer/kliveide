import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { NEW_PROJECT_NEXT_PROFILE_ID, nextProfileOf, romSetOf } from "@emu/machines/zxNext/nextProfiles";
import { DEFAULT_MACHINE_FAVORITES } from "@common/machines/machine-favorites";
import { newProjectModelOf } from "@common/machines/machine-registry";
import { MI_ZXNEXT } from "@common/machines/constants";
import { nextSdBaseImage } from "../harness/zxnext/core/sdCards";

/*
 * The install kit carries the default ZX Spectrum Next model's SD card, and only that one, gzipped
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phases 0 and 2, D-2). No release up to v0.68.1 shipped a card,
 * and the Next booted to "Drive C: not found". `dev/scripts/stage-next-sd.cjs` stages the card at
 * `npm run build:app`; `dev/scripts/check-packaged-sd-cards.cjs` checks the built kit itself in the
 * release workflow.
 */

const ROOT = path.join(__dirname, "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

describe("the SD card in the install kit", () => {
  const defaultSet = romSetOf(nextProfileOf(NEW_PROJECT_NEXT_PROFILE_ID));

  it("the default Next model is the KS3 with the newest core, for new projects and the Machine type menu", () => {
    expect(NEW_PROJECT_NEXT_PROFILE_ID).toBe("ks3-30303");
    expect(newProjectModelOf(MI_ZXNEXT)).toBe(NEW_PROJECT_NEXT_PROFILE_ID);
    expect(DEFAULT_MACHINE_FAVORITES.find((f) => f.machineId === MI_ZXNEXT)?.modelId).toBe(NEW_PROJECT_NEXT_PROFILE_ID);
  });

  it("extraResources ships exactly the default model's gzipped card into resources/next-sd", () => {
    const entry = pkg.build.extraResources.find((e: { from: string }) => e.from === ".local/next-sd-stage");
    expect(entry, "an extraResources entry from .local/next-sd-stage").toBeDefined();
    expect(entry.to).toBe("next-sd");
    // --- `process.env.PUBLIC` is the resources folder in a packaged app; `bundledCardPaths` reads
    // --- PUBLIC/next-sd/<setId>.cim.gz
    expect(entry.filter).toEqual([`${defaultSet.id}.cim.gz`]);
  });

  it("ships no raw card any more", () => {
    expect(pkg.build.extraResources.some((e: { from: string }) => e.from.includes("mmc"))).toBe(false);
  });

  it("every packaging path stages the card first", () => {
    expect(pkg.scripts["build:app"]).toContain("dev/scripts/stage-next-sd.cjs");
    const packaging = Object.entries<string>(pkg.scripts).filter(
      ([name, command]) => name.startsWith("build") && /electron-builder|npm run package:/.test(command)
    );
    expect(packaging.length).toBeGreaterThan(4);
    for (const [name, command] of packaging) expect(command, name).toContain("npm run build:app");
  });

  it("the default model's card is here to stage from (npm run next-sd:fetch)", () => {
    expect(fs.statSync(nextSdBaseImage(defaultSet.id)).isFile()).toBe(true);
  });
});
