import fs from "fs";
import path from "path";
import zlib from "zlib";
import { describe, expect, it } from "vitest";

import { MI_SCORPION, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TIMEX, MI_ZXNEXT } from "@common/machines/constants";
import { getAllMachineModels, getModelConfig } from "@common/machines/machine-registry";
import { z88dkOptionsFrom, zccArgumentsFor } from "@main/z88dk-integration/Z88dkCompiler";
import { parseZ88dkMap, projectFileTest, z88dkLineRecords } from "@main/z88dk-integration/z88dk-map";
import { z88dkTargetFor } from "@main/z88dk-integration/z88dk-targets";

/*
 * The shipped z88dk project templates of the ZX Spectrum family (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`,
 * T1). The `tpl-*` fixtures are the templates' own `main.c` compiled by zcc with the arguments Klive's
 * debug build uses (`npm run z88dk:fixtures`); these tests keep the three in step:
 * - every Spectrum family machine and model z88dk builds for has a template and a fixture of it;
 * - each fixture's source is its template's, byte for byte, and its arguments are Klive's for
 *   Debug (`debug`) or for Run and Export (`build`, optimised: a construct only `-O2` breaks is caught);
 * - each fixture holds what Run, Debug and Export use: the image, the native file and C line records.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const TEMPLATES = path.join(__dirname, "..", "..", "src", "public", "project-templates");
const SPECTRUM_FAMILY = [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_TIMEX, MI_SCORPION, MI_ZXNEXT];

type TemplateFixture = {
  folder: string;
  template: string;
  machine: string;
  model?: string;
  /** The build Klive makes: `debug` for Debug, `build` for Run and Export (`-O2`, no `-debug`). */
  profile: "debug" | "build";
  zccArgs: string[];
};

const templateFixtures: TemplateFixture[] = fs
  .readdirSync(FIXTURES)
  .filter((name) => name.startsWith("tpl-"))
  .map((name) => ({ folder: name, ...JSON.parse(fs.readFileSync(path.join(FIXTURES, name, "fixture.json"), "utf8")) }));

const templateMain = (machine: string) => path.join(TEMPLATES, machine, "z88-dk", "code", "main.c");
const fixtureFile = (fixture: TemplateFixture, file: string) => path.join(FIXTURES, fixture.folder, file);
const mapOf = (fixture: TemplateFixture) =>
  parseZ88dkMap(zlib.gunzipSync(fs.readFileSync(fixtureFile(fixture, "program.map.gz"))).toString("utf8"));

const PROFILES = ["debug", "build"] as const;

/** Klive's arguments for a machine and model with a project's default options, in a profile. */
function kliveArgs(machineId: string, modelId: string | undefined, profile: "debug" | "build"): string[] | undefined {
  const target = z88dkTargetFor(machineId, modelId, getModelConfig(machineId, modelId));
  if ("refused" in target) return undefined;
  return zccArgumentsFor(target, z88dkOptionsFrom(() => undefined), profile, "program", ["main.c"]);
}

/** Every Spectrum family machine and model, with Klive's arguments, or undefined where z88dk is refused. */
const spectrumModels = getAllMachineModels()
  .filter((m) => SPECTRUM_FAMILY.includes(m.machineId))
  .map((m) => ({ machineId: m.machineId, modelId: m.modelId, args: kliveArgs(m.machineId, m.modelId, "debug") }));

describe("z88dk templates of the ZX Spectrum family", () => {
  it("lists the models the family has", () => {
    // --- Guards the filter above: a renamed machine id would otherwise empty the sweep silently
    for (const machineId of SPECTRUM_FAMILY) {
      expect(spectrumModels.some((m) => m.machineId === machineId), machineId).toBe(true);
    }
  });

  for (const machineId of SPECTRUM_FAMILY) {
    const buildable = spectrumModels.some((m) => m.machineId === machineId && m.args);
    it(`${machineId}: has a z88-dk template with Klive's build commands and a C build root`, () => {
      expect(buildable).toBe(true);
      const folder = path.join(TEMPLATES, machineId, "z88-dk");
      const project = JSON.parse(fs.readFileSync(path.join(folder, "__$klive.project"), "utf8"));
      expect(project.builder.roots).toEqual(["code/main.c"]);
      const ksx = fs.readFileSync(path.join(folder, "build.ksx"), "utf8");
      for (const command of ["klive.compile", "klive.run", "klive.debug"]) expect(ksx).toContain(`$command("${command}")`);
      expect(fs.existsSync(templateMain(machineId))).toBe(true);
    });
  }

  it("has a template fixture of Debug's and of Run's build for every model z88dk builds for", () => {
    const missing: string[] = [];
    for (const m of spectrumModels.filter((m) => m.args)) {
      for (const profile of PROFILES) {
        const args = kliveArgs(m.machineId, m.modelId, profile)!;
        const found = templateFixtures.some(
          (f) => f.machine === m.machineId && f.profile === profile && f.zccArgs.join(" ") === args.join(" ")
        );
        if (!found) missing.push(`${m.machineId}/${m.modelId ?? "-"} ${profile}: ${args.join(" ")}`);
      }
    }
    expect(missing).toEqual([]);
  });

  for (const fixture of templateFixtures) {
    describe(fixture.folder, () => {
      it("compiles its machine's template source, byte for byte", () => {
        expect(fixture.template).toBe(fixture.machine);
        expect(fs.readFileSync(fixtureFile(fixture, "main.c"), "utf8")).toBe(fs.readFileSync(templateMain(fixture.template), "utf8"));
      });

      it(`was built with Klive's ${fixture.profile}-profile arguments`, () => {
        expect(PROFILES).toContain(fixture.profile);
        expect(fixture.zccArgs).toEqual(kliveArgs(fixture.machine, fixture.model, fixture.profile));
      });

      it("holds the image and the native file Run and Export use", () => {
        const target = z88dkTargetFor(fixture.machine, fixture.model, getModelConfig(fixture.machine, fixture.model));
        if ("refused" in target) throw new Error(target.refused);
        expect(fs.statSync(fixtureFile(fixture, "program")).size).toBeGreaterThan(0);
        expect(fs.statSync(fixtureFile(fixture, `program${target.appExtension}`)).size).toBeGreaterThan(0);
      });

      it.runIf(fixture.profile === "debug")("maps the template's C lines in main and square", () => {
        const folder = path.join(FIXTURES, fixture.folder);
        const records = z88dkLineRecords(mapOf(fixture), folder, projectFileTest([folder], "/opt/z88dk")).filter(
          (r) => r.kind === "c"
        );
        const lines = fs.readFileSync(fixtureFile(fixture, "main.c"), "utf8").split(/\r?\n/);
        const lineOf = (text: string) => lines.findIndex((l) => l.includes(text)) + 1;
        const at = (text: string) => records.find((r) => r.line === lineOf(text));
        expect(at("int result = value * value;")?.func).toBe("square");
        expect(at("return result;")?.func).toBe("square");
        // --- The line that calls square (printf on the Spectrum templates, print_number on the Next's)
        expect(at("square(counter)")?.func).toBe("main");
      });
    });
  }
});
