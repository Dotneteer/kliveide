import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PF_EXECUTED } from "@common/profile/profileTypes";
import { romPageProfileOf } from "@common/reverse/pipeline/profile/romPageProfile";
import { profileRecipe, type ProfileRecipe } from "./profileRecipes";

/*
 * The pipeline's `profile` command (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P3): runs a recipe on the
 * real machine and writes one profile per ROM page for `prepare`.
 *
 *   npm run rom:pipeline -- profile <recipe>
 *
 * runs this file with ROM_PROFILE_RECIPE and ROM_PROFILE_OUT set; it writes
 * `<out>/<rom file>/profile-page-<n>.json` and `<out>/<recipe>.log.md` (each command and the screen
 * after it). Without them it runs the 48K recipe and only checks that the profile makes sense.
 */

async function profile(recipe: ProfileRecipe) {
  const run = await recipe.run();
  return {
    run,
    pages: recipe.roms.map((rom) => ({ rom, profile: romPageProfileOf(run.flags, run.edges, rom.slice, rom.page, recipe.description) }))
  };
}

describe("ROM page profiles", () => {
  const id = process.env.ROM_PROFILE_RECIPE;
  const out = process.env.ROM_PROFILE_OUT;

  it.skipIf(!!id)("cut a 48K run into the ROM page's profile", async () => {
    const { pages } = await profile(profileRecipe("sp48"));
    const [{ profile: page }] = pages;
    expect(page.flags).toHaveLength(0x4000);
    // --- The main loop ran (offset $12AC), and the call edges name callees inside the page
    expect(page.flags[0x12ac] & PF_EXECUTED).toBeTruthy();
    expect(page.edges!.length).toBeGreaterThan(20);
    expect(page.edges!.every((e) => e.callee >= 0 && e.callee < 0x4000)).toBe(true);
  });

  it.runIf(!!id && !!out)("writes the recipe's profiles", { timeout: 600_000 }, async () => {
    const recipe = profileRecipe(id!);
    const { run, pages } = await profile(recipe);
    for (const { rom, profile: page } of pages) {
      const folder = join(out!, rom.file);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `profile-page-${rom.page}.json`), `${JSON.stringify(page)}\n`);
    }
    const log = [`# Profile recipe ${recipe.id}`, "", recipe.description, ""];
    for (const step of run.steps) {
      log.push(`## ${step.command}`, "");
      if (step.screen !== undefined) log.push("```", step.screen.replace(/\s+$/g, ""), "```", "");
    }
    log.push("## What ran", "");
    const ran = pages.map(({ rom, profile: page }) => ({ rom, executed: page.flags.filter((f) => f & PF_EXECUTED).length, edges: page.edges?.length ?? 0 }));
    for (const { rom, executed, edges } of ran) {
      log.push(`- ${rom.file} page ${rom.page}: ${executed} instruction start(s) ran, ${edges} call edge(s)${executed ? "" : " (never ran: the script does not reach it)"}`);
    }
    mkdirSync(out!, { recursive: true });
    writeFileSync(join(out!, `${recipe.id}.log.md`), `${log.join("\n")}\n`);
    // --- A page the script never reaches is a gap in the recipe, reported in the log; no page at all
    // --- running means the recipe is broken
    expect(ran.some((r) => r.executed > 0)).toBe(true);
  });
});
