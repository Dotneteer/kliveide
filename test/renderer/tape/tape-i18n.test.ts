import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { setLanguage } from "@common/i18n/i18n";
import { tapeHeaderFields } from "@renderer/appIde/DocumentPanels/Tape/tapeHeaderFields";
import {
  TAPE_ROLE_NAMES,
  TAPE_VIEW_NAMES,
  analyzeTape,
  tapeBlockFilters
} from "@renderer/appIde/DocumentPanels/Tape/tapeView";

/*
 * The tape viewer in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` step 11): the model words its
 * texts when it runs, so in `qps` every block name, group heading, header field and explanation is
 * pseudo text. Literal values - hex, numbers, BASIC keywords - stay as they are.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);
const tap = new Uint8Array(readFileSync(resolve(__dirname, "../../testfiles/floatspy.tap")));

describe("the tape viewer in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("words the analysis, the header fields and the option tables in the current language", () => {
    setLanguage("qps");
    const { analysis } = analyzeTape(tap);
    const problems: string[] = [];
    const check = (where: string, text: string | undefined) => {
      if (text && !isPseudo(text)) problems.push(`${where}: ${text}`);
    };
    for (const block of analysis!.blocks) {
      check(`block ${block.index} kind`, block.kindName);
      check(`block ${block.index} group`, block.groupLabel);
      if (block.header) check(`block ${block.index} summary`, block.summary);
      if (block.header && block.bytes) {
        for (const field of tapeHeaderFields(block.bytes)) {
          check(`field ${field.key} name`, field.name);
          check(`field ${field.key} meaning`, field.meaning);
        }
      }
    }
    for (const name of Object.values(TAPE_ROLE_NAMES)) check("role", name);
    for (const name of Object.values(TAPE_VIEW_NAMES)) check("view", name);
    for (const filter of tapeBlockFilters()) check("filter", filter.text);
    expect(problems).toEqual([]);
  });
});
