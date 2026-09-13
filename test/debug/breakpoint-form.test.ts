import { describe, it, expect } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import {
  SOURCE_SPEC_MESSAGE,
  breakpointKeyOf,
  breakpointToForm,
  applyKindChange,
  createEmptyForm,
  formToBreakpointInfo,
  isBinaryBreakpoint,
  isFormValid,
  isKnownPartition,
  parseNumericInput,
  validateBreakpointForm,
  type BreakpointEnvironment,
  type BreakpointFormState,
  type BreakpointKind
} from "@renderer/appIde/utils/breakpoint-form";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "../commands/test-helpers/mock-context";

// --- Fixtures are builders with defaults, so a test names only the field it is about.

const anEnv = (over: Partial<BreakpointEnvironment> = {}): BreakpointEnvironment => ({
  partitionLabels: {},
  supportsPartitions: false,
  existingKeys: [],
  ...over
});

/*
 * Indices, not labels, and signed: ZX Next numbers its ROM and DivMMC pages from -1 downwards and
 * its RAM banks from 0 up, so a fixture that only had non-negative keys would never exercise the
 * range the real machines use.
 */
const partitionedEnv = (over: Partial<BreakpointEnvironment> = {}): BreakpointEnvironment =>
  anEnv({
    partitionLabels: { [-2]: "R1", [-1]: "R0", 0: "00", 1: "01", 2: "02" },
    supportsPartitions: true,
    ...over
  });

const aForm = (over: Partial<BreakpointFormState> = {}): BreakpointFormState => ({
  ...createEmptyForm(),
  address: "$8000",
  ...over
});

const ALL_KINDS: BreakpointKind[] = ["exec", "memRead", "memWrite", "ioRead", "ioWrite"];

describe("parseNumericInput", () => {
  it.each([
    ["decimal", "32768", 32768],
    ["hexadecimal", "$8000", 0x8000],
    ["binary", "%1000000000000000", 0x8000],
    ["hexadecimal with an underscore", "$8_000", 0x8000],
    ["zero", "0", 0],
    ["the top of the address space", "$ffff", 0xffff],
    ["surrounding whitespace", "  $8000  ", 0x8000]
  ])("accepts %s", (_what, text, expected) => {
    expect(parseNumericInput(text)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["an empty string", ""],
    ["only whitespace", "   "],
    ["undefined", undefined]
  ])("reports %s as empty", (_what, text) => {
    expect(parseNumericInput(text as string)).toEqual({ ok: false, reason: "empty" });
  });

  it.each([
    ["a bare identifier", "nonsense"],
    ["a lone sigil", "$"],
    ["two tokens", "$80 00"],
    ["a source spec", "[code/code.kz80.asm]:12"]
  ])("rejects %s", (_what, text) => {
    expect(parseNumericInput(text)).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not throw on a token type the command parser calls non-numeric", () => {
    // --- `getNumericTokenValue` returns `null` there rather than an error object; the command path
    // --- only survives it via a surrounding try/catch.
    expect(() => parseNumericInput("nonsense")).not.toThrow();
  });
});

describe("parseNumericInput agrees with the bp-set command parser", () => {
  // --- The point of the module delegating to the command tokenizer. If these two ever disagree,
  // --- the dialog and the command line have quietly become different front doors.
  const ACCEPTED = ["32768", "$8000", "%1000000000000000", "$8_000", "0", "$ffff", "65535"];
  const REJECTED = ["nonsense", "$", "not-a-number"];

  it.each(ACCEPTED)("both accept %s, with the same value", async (literal) => {
    const command = new SetBreakpointCommand();
    const context = createMockContext() as any;
    const args: any = { addrSpec: literal };

    const messages = await command.validateCommandArgs(context, args);

    expect(messages.length).toBe(0);
    const parsed = parseNumericInput(literal);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value).toBe(args.address);
  });

  it.each(REJECTED)("both reject %s", async (literal) => {
    const command = new SetBreakpointCommand();
    const context = createMockContext() as any;
    const args: any = { addrSpec: literal };

    const messages = await command.validateCommandArgs(context, args);

    expect(messages.length).toBeGreaterThan(0);
    expect(parseNumericInput(literal).ok).toBe(false);
  });

  it("diverges deliberately on range: the command masks, the dialog refuses", async () => {
    // --- `bp-set 65536` silently becomes $0000. A dialog that did the same would look like it had
    // --- accepted what was typed, so this is the one place the two are meant to differ.
    const command = new SetBreakpointCommand();
    const context = createMockContext() as any;
    const args: any = { addrSpec: "65536" };

    expect(await command.validateCommandArgs(context, args)).toHaveLength(0);
    expect(validateBreakpointForm(aForm({ address: "65536" }), anEnv()).address).toMatch(/between/);
  });

  it("diverges deliberately on source specs: the command accepts them, the dialog does not", async () => {
    const errors = validateBreakpointForm(
      aForm({ address: "[code/code.kz80.asm]:12" }),
      anEnv()
    );
    expect(errors.address).toBe(SOURCE_SPEC_MESSAGE);
  });
});

describe("validateBreakpointForm - address", () => {
  it("accepts a well-formed address", () => {
    expect(isFormValid(validateBreakpointForm(aForm(), anEnv()))).toBe(true);
  });

  it("requires an address", () => {
    expect(validateBreakpointForm(aForm({ address: "" }), anEnv()).address).toBe(
      "Enter an address."
    );
  });

  it("asks for a port, not an address, on an I/O breakpoint", () => {
    expect(
      validateBreakpointForm(aForm({ kind: "ioRead", address: "" }), anEnv()).address
    ).toBe("Enter a port.");
  });

  it("rejects an unparseable address", () => {
    expect(validateBreakpointForm(aForm({ address: "nonsense" }), anEnv()).address).toMatch(
      /valid address/
    );
  });

  it("rejects an address above $ffff instead of truncating it", () => {
    expect(validateBreakpointForm(aForm({ address: "$1_0000" }), anEnv()).address).toMatch(
      /between \$0000 and \$FFFF/
    );
  });

  it("points a source spec at the editor margin", () => {
    expect(
      validateBreakpointForm(aForm({ address: "[code/code.kz80.asm]:12" }), anEnv()).address
    ).toBe(SOURCE_SPEC_MESSAGE);
  });
});

describe("validateBreakpointForm - port mask", () => {
  it("accepts a mask on an I/O breakpoint", () => {
    const errors = validateBreakpointForm(aForm({ kind: "ioRead", ioMask: "$00ff" }), anEnv());
    expect(isFormValid(errors)).toBe(true);
  });

  it("treats an empty mask as absent", () => {
    const errors = validateBreakpointForm(aForm({ kind: "ioWrite", ioMask: "" }), anEnv());
    expect(errors.ioMask).toBeUndefined();
  });

  it("rejects a mask on a non-I/O breakpoint", () => {
    // --- The command's rule: `-m` is only legal with `-i` or `-o`.
    expect(validateBreakpointForm(aForm({ kind: "exec", ioMask: "$00ff" }), anEnv()).ioMask).toBe(
      "A port mask applies only to I/O breakpoints."
    );
    expect(
      validateBreakpointForm(aForm({ kind: "memRead", ioMask: "$00ff" }), anEnv()).ioMask
    ).toBeDefined();
  });

  it("rejects an unparseable mask", () => {
    expect(
      validateBreakpointForm(aForm({ kind: "ioRead", ioMask: "nonsense" }), anEnv()).ioMask
    ).toMatch(/valid port mask/);
  });

  it("rejects a mask above $ffff", () => {
    expect(
      validateBreakpointForm(aForm({ kind: "ioRead", ioMask: "$1_0000" }), anEnv()).ioMask
    ).toMatch(/between \$0000 and \$FFFF/);
  });
});

describe("validateBreakpointForm - partition", () => {
  it("accepts a known partition when the machine supports them", () => {
    const errors = validateBreakpointForm(aForm({ partition: 1 }), partitionedEnv());
    expect(isFormValid(errors)).toBe(true);
  });

  it("accepts a negatively indexed ROM page", () => {
    // --- Bank 0 is a perfectly good partition and so is ROM 0 at index -1, so neither falsiness
    // --- nor sign can be used to mean "no partition".
    expect(isFormValid(validateBreakpointForm(aForm({ partition: -1 }), partitionedEnv()))).toBe(
      true
    );
    expect(isFormValid(validateBreakpointForm(aForm({ partition: 0 }), partitionedEnv()))).toBe(
      true
    );
  });

  it("rejects a partition on a machine without partition support", () => {
    expect(validateBreakpointForm(aForm({ partition: 1 }), anEnv()).partition).toBe(
      "This machine does not support partitions."
    );
  });

  it("rejects a partition on an I/O breakpoint", () => {
    expect(
      validateBreakpointForm(aForm({ kind: "ioRead", partition: 1 }), partitionedEnv()).partition
    ).toBe("I/O breakpoints cannot use a partition.");
  });

  it("rejects an index the machine does not have", () => {
    expect(validateBreakpointForm(aForm({ partition: 99 }), partitionedEnv()).partition).toBe(
      "This machine has no such partition."
    );
  });

  it("treats an absent partition as none", () => {
    expect(
      validateBreakpointForm(aForm({ partition: undefined }), partitionedEnv()).partition
    ).toBeUndefined();
  });
});

describe("validateBreakpointForm - duplicates", () => {
  it("refuses a breakpoint whose key already exists", () => {
    const env = anEnv({ existingKeys: ["$8000"] });
    expect(validateBreakpointForm(aForm({ address: "$8000" }), env).form).toBe(
      "A breakpoint already exists at $8000."
    );
  });

  it("allows the breakpoint being edited to keep its own key", () => {
    const env = anEnv({ existingKeys: ["$8000"], editingKey: "$8000" });
    expect(isFormValid(validateBreakpointForm(aForm({ address: "$8000" }), env))).toBe(true);
  });

  it("still refuses an edit that collides with a different breakpoint", () => {
    const env = anEnv({ existingKeys: ["$8000", "$9000"], editingKey: "$8000" });
    expect(validateBreakpointForm(aForm({ address: "$9000" }), env).form).toMatch(/already exists/);
  });

  it("does not confuse two kinds at the same address", () => {
    // --- The key carries the kind suffix, so a memory-read watchpoint and an exec breakpoint can
    // --- share an address.
    const env = anEnv({ existingKeys: ["$8000"] });
    expect(isFormValid(validateBreakpointForm(aForm({ kind: "memRead" }), env))).toBe(true);
  });

  it("does not report a duplicate while the address is still unparseable", () => {
    const env = anEnv({ existingKeys: ["$8000"] });
    const errors = validateBreakpointForm(aForm({ address: "nonsense" }), env);
    expect(errors.form).toBeUndefined();
    expect(errors.address).toBeDefined();
  });
});

describe("formToBreakpointInfo", () => {
  it.each([
    ["exec", { exec: true }],
    ["memRead", { memoryRead: true }],
    ["memWrite", { memoryWrite: true }],
    ["ioRead", { ioRead: true }],
    ["ioWrite", { ioWrite: true }]
  ] as [BreakpointKind, Partial<BreakpointInfo>][])("sets only the %s flag", (kind, expected) => {
    const bp = formToBreakpointInfo(aForm({ kind }));
    expect(bp.exec).toBe(kind === "exec");
    expect(bp.memoryRead).toBe(kind === "memRead");
    expect(bp.memoryWrite).toBe(kind === "memWrite");
    expect(bp.ioRead).toBe(kind === "ioRead");
    expect(bp.ioWrite).toBe(kind === "ioWrite");
    expect(bp).toMatchObject(expected);
  });

  it("never emits resource or line", () => {
    const bp = formToBreakpointInfo(aForm()) as BreakpointInfo;
    expect(bp.resource).toBeUndefined();
    expect(bp.line).toBeUndefined();
  });

  it("carries the partition index through unchanged", () => {
    expect(formToBreakpointInfo(aForm({ partition: 2 })).partition).toBe(2);
    expect(formToBreakpointInfo(aForm({ partition: -1 })).partition).toBe(-1);
  });

  it("drops a partition left over from a kind switch to I/O", () => {
    // --- The user picks ROM 0, then switches the type to I/O read: the stale index must not
    // --- survive into a breakpoint the command layer would have rejected outright.
    const bp = formToBreakpointInfo(aForm({ kind: "ioRead", partition: -1 }));
    expect(bp.partition).toBeUndefined();
  });

  it("keeps a port mask only for I/O kinds", () => {
    expect(formToBreakpointInfo(aForm({ kind: "ioRead", ioMask: "$00ff" })).ioMask).toBe(0x00ff);
    expect(formToBreakpointInfo(aForm({ kind: "exec", ioMask: "$00ff" })).ioMask).toBeUndefined();
  });

  it("maps the Enabled checkbox onto the disabled field", () => {
    expect(formToBreakpointInfo(aForm({ disabled: true })).disabled).toBe(true);
    expect(formToBreakpointInfo(aForm({ disabled: false })).disabled).toBe(false);
  });
});

describe("breakpointToForm", () => {
  it("renders the address as a four-digit hex literal", () => {
    expect(breakpointToForm({ address: 0x8000, exec: true }).address).toBe("$8000");
    expect(breakpointToForm({ address: 0x000f, exec: true }).address).toBe("$000F");
  });

  it("keeps the partition index", () => {
    expect(breakpointToForm({ address: 0x8000, partition: 1 }).partition).toBe(1);
    expect(breakpointToForm({ address: 0x8000, partition: -1 }).partition).toBe(-1);
    expect(breakpointToForm({ address: 0x8000 }).partition).toBeUndefined();
  });

  it.each(ALL_KINDS)("round-trips a %s breakpoint back to the same breakpoint", (kind) => {
    const original = formToBreakpointInfo(
      aForm({
        kind,
        partition: kind === "ioRead" || kind === "ioWrite" ? undefined : -1,
        ioMask: "$00ff"
      })
    );

    const roundTripped = formToBreakpointInfo(breakpointToForm(original));

    expect(roundTripped).toEqual(original);
  });

  it("round-trips through a stable key", () => {
    const env = partitionedEnv();
    const form = aForm({ kind: "memWrite", partition: 2 });
    const key = breakpointKeyOf(form, env);

    expect(breakpointKeyOf(breakpointToForm(formToBreakpointInfo(form)), env)).toBe(key);
  });
});

describe("isBinaryBreakpoint", () => {
  it("accepts an address-bound breakpoint", () => {
    expect(isBinaryBreakpoint({ address: 0x8000, exec: true })).toBe(true);
    expect(isBinaryBreakpoint({ address: 0 })).toBe(true);
  });

  it("rejects a source-bound breakpoint", () => {
    // --- This is the guard that keeps a source breakpoint out of the dialog entirely.
    expect(isBinaryBreakpoint({ resource: "code/code.kz80.asm", line: 12 })).toBe(false);
  });

  it("rejects a source-bound breakpoint even once it has resolved to an address", () => {
    expect(
      isBinaryBreakpoint({ resource: "code/code.kz80.asm", line: 12, resolvedAddress: 0x8000 })
    ).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(isBinaryBreakpoint(undefined)).toBe(false);
  });
});

describe("helpers", () => {
  it("starts the Add flow from a blank execution breakpoint", () => {
    expect(createEmptyForm()).toEqual({
      kind: "exec",
      address: "",
      partition: undefined,
      ioMask: "",
      disabled: false
    });
  });

  it("knows which partition indices the machine has", () => {
    const env = partitionedEnv();
    expect(isKnownPartition(0, env)).toBe(true);
    expect(isKnownPartition(-1, env)).toBe(true);
    expect(isKnownPartition(99, env)).toBe(false);
    expect(isKnownPartition(-99, env)).toBe(false);
  });

  it("has no key for a form with no usable address", () => {
    expect(breakpointKeyOf(aForm({ address: "" }), anEnv())).toBeUndefined();
  });

  it("builds a partition-qualified key from the machine's own label", () => {
    expect(breakpointKeyOf(aForm({ partition: -2 }), partitionedEnv())).toBe("R1:$8000");
    expect(breakpointKeyOf(aForm({ partition: 1 }), partitionedEnv())).toBe("01:$8000");
  });

  it("builds a kind-suffixed key", () => {
    expect(breakpointKeyOf(aForm({ kind: "memRead" }), anEnv())).toBe("$8000:R");
    expect(breakpointKeyOf(aForm({ kind: "ioWrite" }), anEnv())).toBe("$8000:IW");
  });
});

describe("applyKindChange", () => {
  it("drops a partition when the type becomes I/O", () => {
    // --- The partition control is disabled for I/O kinds, so a value left in state would fail
    // --- validation against a field the user can see but not change.
    const next = applyKindChange(aForm({ partition: -1 }), "ioRead");

    expect(next.partition).toBeUndefined();
    expect(isFormValid(validateBreakpointForm(next, partitionedEnv()))).toBe(true);
  });

  it("drops a port mask when the type stops being I/O", () => {
    // --- Worse than the partition case: the mask field is not rendered at all, so a stale value
    // --- would be an error about a field with nowhere to go but Cancel.
    const next = applyKindChange(aForm({ kind: "ioRead", ioMask: "$00ff" }), "exec");

    expect(next.ioMask).toBe("");
    expect(isFormValid(validateBreakpointForm(next, anEnv()))).toBe(true);
  });

  it("keeps a port mask when moving between the two I/O kinds", () => {
    expect(applyKindChange(aForm({ kind: "ioRead", ioMask: "$00ff" }), "ioWrite").ioMask).toBe(
      "$00ff"
    );
  });

  it("keeps the partition when moving between non-I/O kinds", () => {
    expect(applyKindChange(aForm({ partition: -1 }), "memWrite").partition).toBe(-1);
  });

  it("leaves the address and the enabled state alone", () => {
    const next = applyKindChange(aForm({ address: "$8000", disabled: true }), "memRead");

    expect(next.address).toBe("$8000");
    expect(next.disabled).toBe(true);
    expect(next.kind).toBe("memRead");
  });

  it("survives a round trip back to the original type", () => {
    const start = aForm({ partition: -1 });
    const there = applyKindChange(start, "ioWrite");
    const back = applyKindChange(there, "exec");

    // --- The partition does not come back: it was dropped, not hidden. That is the point.
    expect(back).toEqual({ ...start, partition: undefined });
  });
});
