import { describe, it, expect } from "vitest";

import type { NexHeader } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import {
  declaredBanks,
  summarizeNexIssues,
  validateNexHeader,
  type NexValidationContext
} from "@renderer/appIde/DocumentPanels/Next/nexValidation";

/*
 * Pre-launch validation.
 *
 * Each of these turns a silent, baffling failure into a sentence: a NEX whose entry bank it does not
 * contain hands control to whatever was at `$C000` while the loader reports success. All of it is
 * decidable from the 512-byte header. See `.plans/NEX_DEBUGGING_PLAN.md` §12.
 */

/** 112 flags, with the named banks present. */
function flags(banks: number[]): boolean[] {
  const list = new Array(112).fill(false);
  banks.forEach((bank) => (list[bank] = true));
  return list;
}

/**
 * A header that is entirely fine: entry bank 20 present, entry point in it, stack in RAM, no core
 * requirement, and a bank count matching the flags. Every case below breaks exactly one thing.
 */
function header(over: Partial<NexHeader> = {}): NexHeader {
  return {
    entryBank: 20,
    programCounter: 0xc000,
    stackPointer: 0xff00,
    bankFlags: flags([5, 2, 20]),
    numOf16KBanks: 3,
    fullRamRequired: false,
    requiredCoreVersionMajor: 0,
    requiredCoreVersionMinor: 0,
    requiredCoreVersionSubMinor: 0,
    ...over
  } as NexHeader;
}

/** The ZX Spectrum Next as emulated: core 3.2.0, 112 sixteen-K banks. */
const NEXT: NexValidationContext = { coreVersion: [3, 2, 0], bankCount: 112 };

/** The rule ids a header raises, which is what a table can compare on. */
function idsFor(over: Partial<NexHeader>, context: NexValidationContext = NEXT): string[] {
  return validateNexHeader(header(over), context).map((issue) => issue.id);
}

describe("declaredBanks", () => {
  it("lists the banks a header's flags mark, in order", () => {
    expect(declaredBanks(header())).toEqual([2, 5, 20]);
  });

  it("includes bank 0, which is falsy", () => {
    expect(declaredBanks(header({ bankFlags: flags([0, 7]) }))).toEqual([0, 7]);
  });

  it("is empty for a header with no banks", () => {
    expect(declaredBanks(header({ bankFlags: flags([]) }))).toEqual([]);
  });
});

describe("validateNexHeader: a sound header", () => {
  it("reports nothing", () => {
    expect(validateNexHeader(header(), NEXT)).toEqual([]);
  });

  it("reports nothing without a header at all", () => {
    // --- A file that would not parse has its own error path; there is nothing to validate.
    expect(validateNexHeader(undefined, NEXT)).toEqual([]);
  });

  it("reports nothing when the machine is unknown", () => {
    // --- A NEX can be opened with any machine selected. The header's self-consistency still
    // --- applies; the comparisons against the machine are skipped rather than guessed at.
    expect(validateNexHeader(header(), {})).toEqual([]);
  });
});

describe("validateNexHeader: the rules", () => {
  const cases: { name: string; over: Partial<NexHeader>; expect: string[] }[] = [
    {
      name: "an entry bank the file does not contain",
      over: { entryBank: 21 },
      // --- Only one rule, deliberately: the entry point at $C000 *is* the entry bank, so the
      // --- second rule declines to restate the same fault. See the dedicated case below.
      expect: ["entry-bank-missing"]
    },
    {
      name: "an entry point in ROM",
      over: { programCounter: 0x2000 },
      expect: ["entry-point-in-rom"]
    },
    {
      name: "an entry point at $4000 with bank 5 absent",
      over: { programCounter: 0x4100, bankFlags: flags([2, 20]), numOf16KBanks: 2 },
      expect: ["entry-point-bank-missing"]
    },
    {
      name: "an entry point at $8000 with bank 2 absent",
      over: { programCounter: 0x8100, bankFlags: flags([5, 20]), numOf16KBanks: 2 },
      expect: ["entry-point-bank-missing"]
    },
    {
      name: "an entry point at $4000 with bank 5 present",
      over: { programCounter: 0x4100 },
      expect: []
    },
    {
      name: "a stack pointer in ROM",
      over: { stackPointer: 0x3fff },
      expect: ["stack-in-rom"]
    },
    {
      name: "a stack pointer at the bottom of RAM",
      over: { stackPointer: 0x4000 },
      expect: []
    },
    {
      name: "a core requirement newer than the emulated core",
      over: {
        requiredCoreVersionMajor: 3,
        requiredCoreVersionMinor: 3,
        requiredCoreVersionSubMinor: 0
      },
      expect: ["core-too-old"]
    },
    {
      name: "a core requirement the emulated core meets exactly",
      over: {
        requiredCoreVersionMajor: 3,
        requiredCoreVersionMinor: 2,
        requiredCoreVersionSubMinor: 0
      },
      expect: []
    },
    {
      name: "a core requirement older than the emulated core",
      over: {
        requiredCoreVersionMajor: 2,
        requiredCoreVersionMinor: 0,
        requiredCoreVersionSubMinor: 0
      },
      expect: []
    },
    {
      name: "a sub-minor requirement past the emulated core",
      over: {
        requiredCoreVersionMajor: 3,
        requiredCoreVersionMinor: 2,
        requiredCoreVersionSubMinor: 1
      },
      expect: ["core-too-old"]
    },
    {
      name: "no core requirement at all",
      // --- What most files carry. Zero is not a version to compare against.
      over: {
        requiredCoreVersionMajor: 0,
        requiredCoreVersionMinor: 0,
        requiredCoreVersionSubMinor: 0
      },
      expect: []
    },
    {
      name: "a bank count that disagrees with the flags",
      over: { numOf16KBanks: 9 },
      expect: ["bank-count-mismatch"]
    },
    {
      name: "full RAM required, which this machine has",
      over: { fullRamRequired: true },
      expect: []
    }
  ];

  cases.forEach(({ name, over, expect: expected }) => {
    it(`reports ${expected.length ? expected.join(", ") : "nothing"} for ${name}`, () => {
      expect(idsFor(over)).toEqual(expected);
    });
  });

  it("reports several independent problems at once, errors first", () => {
    // --- Listed together rather than one at a time: they have separate causes, and fixing them one
    // --- launch at a time is more launches than necessary.
    const ids = idsFor({
      programCounter: 0x1000,
      stackPointer: 0x0100,
      numOf16KBanks: 9,
      requiredCoreVersionMajor: 4,
      requiredCoreVersionMinor: 0,
      requiredCoreVersionSubMinor: 0
    });
    expect(ids).toEqual([
      "entry-point-in-rom",
      "stack-in-rom",
      "core-too-old",
      "bank-count-mismatch"
    ]);
  });

  it("does not say the entry bank is missing twice", () => {
    // --- An absent entry bank makes the $C000 entry point unreachable too, but that is the same
    // --- fault stated twice and the banner has one line to spend.
    expect(idsFor({ entryBank: 21 })).toEqual(["entry-bank-missing"]);
  });
});

describe("validateNexHeader: the RAM check", () => {
  it("fires for a machine with less RAM than the file needs", () => {
    /*
     * This cannot happen on the ZX Spectrum Next as emulated — it always reports 224 8K pages and
     * allocates its memory unconditionally — so the rule is driven from the context rather than
     * read from the machine here, and this is the only place it is exercised. It is kept because
     * the machine's capability is the side that could change.
     */
    const ids = idsFor({ fullRamRequired: true }, { coreVersion: [3, 2, 0], bankCount: 48 });
    expect(ids).toEqual(["not-enough-ram"]);
  });

  it("is skipped when the file does not need full RAM", () => {
    expect(idsFor({ fullRamRequired: false }, { bankCount: 48 })).toEqual([]);
  });

  it("is skipped when the machine's RAM is unknown", () => {
    expect(idsFor({ fullRamRequired: true }, { coreVersion: [3, 2, 0] })).toEqual([]);
  });
});

describe("validateNexHeader: the messages", () => {
  it("names the bank, in hex, when the entry bank is missing", () => {
    const [issue] = validateNexHeader(header({ entryBank: 0x21 }), NEXT);
    expect(issue.message).toContain("$21");
  });

  it("names the address when the entry point is in ROM", () => {
    const [issue] = validateNexHeader(header({ programCounter: 0x1234 }), NEXT);
    expect(issue.message).toContain("$1234");
  });

  it("names both core versions", () => {
    const [issue] = validateNexHeader(
      header({
        requiredCoreVersionMajor: 3,
        requiredCoreVersionMinor: 5,
        requiredCoreVersionSubMinor: 2
      }),
      NEXT
    );
    expect(issue.message).toContain("3.5.2");
    expect(issue.message).toContain("3.2.0");
  });
});

describe("summarizeNexIssues", () => {
  it("says nothing for a sound file", () => {
    expect(summarizeNexIssues([])).toEqual(undefined);
  });

  it("counts problems and warnings separately", () => {
    const issues = validateNexHeader(
      header({
        programCounter: 0x1000,
        numOf16KBanks: 9
      }),
      NEXT
    );
    expect(summarizeNexIssues(issues)).toEqual("This NEX file has 1 problem and 1 warning.");
  });

  it("pluralises each half on its own", () => {
    expect(
      summarizeNexIssues([
        { id: "a", severity: "error", message: "" },
        { id: "b", severity: "error", message: "" },
        { id: "c", severity: "warning", message: "" }
      ])
    ).toEqual("This NEX file has 2 problems and 1 warning.");
  });

  it("omits the half that is empty", () => {
    expect(summarizeNexIssues([{ id: "a", severity: "warning", message: "" }])).toEqual(
      "This NEX file has 1 warning."
    );
    expect(summarizeNexIssues([{ id: "a", severity: "error", message: "" }])).toEqual(
      "This NEX file has 1 problem."
    );
  });
});
