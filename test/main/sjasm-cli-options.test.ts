import { describe, expect, it } from "vitest";

import { SjasmOptions } from "../../src/script-packages/sjasm/sjasm";

// --- The option renderer emits `optionPrefix + optionName`, and SjasmCliManager's
// --- prefix is "-". So a table entry of "-nologo" reaches sjasmplus as "--nologo":
// --- the leading dash in the table IS the second dash.
const OPTION_PREFIX = "-";

// --- Every long option sjasmplus v1.21.0 accepts, taken verbatim from its own
// --- `--help` output. sjasmplus rejects unknown options with
// --- "error: unrecognized option: <opt>" and exits 1, so an entry missing from
// --- this set fails every compilation that uses it.
const DOCUMENTED_LONG_OPTIONS = new Set([
  "--help",
  "--zxnext",
  "--i8080",
  "--lr35902",
  "--outprefix",
  "--inc",
  "--lst",
  "--lstlab",
  "--sym",
  "--exp",
  "--raw",
  "--sld",
  "--nologo",
  "--msg",
  "--fullpath",
  "--color",
  "--define",
  "--longptr",
  "--reversepop",
  "--dirbol",
  "--dos866",
  "--syntax"
]);

// --- Accepted by the binary but absent from `--help`; verified against v1.21.0.
const UNDOCUMENTED_BUT_ACCEPTED = new Set(["--version", "--nofakes"]);

// --- Short options take their value as a separate argument, which this renderer
// --- cannot emit, so only valueless ones may appear in the table.
const SHORT_OPTIONS = new Set(["-h"]);

describe("SjasmOptions CLI contract", () => {
  const rendered = Object.entries(SjasmOptions).map(([key, option]) => ({
    key,
    flag: `${OPTION_PREFIX}${option.optionName || key}`,
    type: option.type
  }));

  it("renders only options that sjasmplus accepts", () => {
    const unknown = rendered.filter(
      ({ flag }) =>
        !DOCUMENTED_LONG_OPTIONS.has(flag) &&
        !UNDOCUMENTED_BUT_ACCEPTED.has(flag) &&
        !SHORT_OPTIONS.has(flag)
    );

    expect(unknown.map((option) => `${option.key} -> ${option.flag}`)).toEqual([]);
  });

  it("passes an include path as --inc=, the only form a single argument can carry", () => {
    // --- "--i=<path>" is rejected outright; the includes silently fail to resolve.
    expect(rendered.find((option) => option.key === "inc")?.flag).toBe("--inc");
  });

  it("never renders a short option that would need a separate value argument", () => {
    const valueTakingShortOptions = rendered.filter(
      ({ flag, type }) => !flag.startsWith("--") && type !== "boolean"
    );

    expect(valueTakingShortOptions.map((option) => option.key)).toEqual([]);
  });
});
