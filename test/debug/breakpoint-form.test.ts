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
  parseBankRelativeInput,
  parseNumericInput,
  validateBreakpointForm,
  type BreakpointEnvironment,
  type BreakpointFormState,
  type BreakpointKind
} from "@renderer/appIde/utils/breakpoint-form";
import { MF_BANK, MF_ROM, MI_ZXNEXT } from "@common/machines/constants";
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

/*
 * Bank-relative breakpoints in the dialog.
 *
 * `05:+$0100` is spelled into the address field rather than given controls of its own, because that
 * is what `bp-set` accepts — one syntax, one parser — and because the Type selector above it is then
 * all a bank *watchpoint* needs. See `.plans/NEX_DEBUGGING_PLAN.md` §10.2.
 */

const nextEnv = (over: Partial<BreakpointEnvironment> = {}): BreakpointEnvironment =>
  partitionedEnv({ supportsBankRelative: true, ...over });

describe("parseBankRelativeInput", () => {
  it("reads a bank and an offset", () => {
    expect(parseBankRelativeInput("05:+$0100")).toMatchObject({
      ok: true,
      bank: 5,
      bankOffset: 0x0100
    });
  });

  it("takes the bank as hexadecimal without a $, as the command does", () => {
    expect(parseBankRelativeInput("6f:+$0000")).toMatchObject({ ok: true, bank: 0x6f });
    expect(parseBankRelativeInput("6F:+$0000")).toMatchObject({ ok: true, bank: 0x6f });
  });

  it("accepts every numeric spelling for the offset", () => {
    expect(parseBankRelativeInput("05:+256").bankOffset).toEqual(256);
    expect(parseBankRelativeInput("05:+%0000000100000000").bankOffset).toEqual(0x0100);
  });

  it("tolerates surrounding and internal spacing", () => {
    expect(parseBankRelativeInput("  05 :+ $0100  ")).toMatchObject({ ok: true, bank: 5 });
  });

  it("says which half is wrong", () => {
    // --- "That is not a bank" and "that is not an offset" are different corrections; one generic
    // --- message would leave the user guessing which end to fix.
    expect(parseBankRelativeInput("zz:+$0100").reason).toEqual("bank");
    expect(parseBankRelativeInput("70:+$0100").reason).toEqual("bank");
    expect(parseBankRelativeInput("05:+$4000").reason).toEqual("offset");
    expect(parseBankRelativeInput("05:+nonsense").reason).toEqual("offset");
    expect(parseBankRelativeInput("05:+").reason).toEqual("offset");
  });

  it("rejects a bank that merely starts with hex digits", () => {
    // --- `parseInt` would read `5xyz` as 5 and silently arm the wrong breakpoint.
    expect(parseBankRelativeInput("5xyz:+$0100").ok).toEqual(false);
  });

  it("reports plain addresses as not bank-relative at all", () => {
    expect(parseBankRelativeInput("$8000").reason).toEqual("notBankRelative");
    // --- The absolute partition form has no `+`, which is exactly what keeps the two apart.
    expect(parseBankRelativeInput("01:$8000").reason).toEqual("notBankRelative");
  });

  it("accepts bank 0 at offset 0", () => {
    expect(parseBankRelativeInput("00:+$0000")).toMatchObject({
      ok: true,
      bank: 0,
      bankOffset: 0
    });
  });
});

describe("isBinaryBreakpoint with bank-relative breakpoints", () => {
  it("accepts one, so the dialog can edit it", () => {
    expect(isBinaryBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true })).toEqual(true);
  });

  it("still refuses a source-bound one", () => {
    expect(isBinaryBreakpoint({ resource: "a.asm", line: 12 })).toEqual(false);
  });

  it("accepts bank 0 at offset 0", () => {
    expect(isBinaryBreakpoint({ bank: 0, bankOffset: 0, exec: true })).toEqual(true);
  });
});

describe("formToBreakpointInfo for a bank-relative address", () => {
  it("produces a bank site rather than an address", () => {
    const bp = formToBreakpointInfo(aForm({ address: "05:+$0100" }));
    expect(bp.bank).toEqual(5);
    expect(bp.bankOffset).toEqual(0x0100);
    expect(bp.address).toEqual(undefined);
    expect(bp.exec).toEqual(true);
  });

  it("carries the type, which is how a bank watchpoint is made", () => {
    expect(formToBreakpointInfo(aForm({ address: "05:+$0100", kind: "memWrite" }))).toMatchObject({
      bank: 5,
      bankOffset: 0x0100,
      exec: false,
      memoryWrite: true
    });
    expect(formToBreakpointInfo(aForm({ address: "05:+$0100", kind: "memRead" })).memoryRead).toEqual(
      true
    );
  });

  it("never emits a partition alongside the bank", () => {
    // --- A bank-relative breakpoint derives its own partition; a second, independent one would arm
    // --- it somewhere the bank is not.
    const bp = formToBreakpointInfo(aForm({ address: "05:+$0100", partition: 1 }));
    expect(bp.partition).toEqual(undefined);
  });

  it("falls back to an address for an I/O kind, which has no bank", () => {
    // --- Validation refuses the combination; this makes sure the conversion does not quietly emit
    // --- a bank that the emulator's own I/O guard would then reject.
    const bp = formToBreakpointInfo(aForm({ address: "05:+$0100", kind: "ioRead" }));
    expect(bp.bank).toEqual(undefined);
  });

  it("round-trips through the key the emulator stores", () => {
    const key = breakpointKeyOf(aForm({ address: "05:+$0100" }), nextEnv());
    expect(key).toEqual("05:+$0100");
  });
});

describe("breakpointToForm for a bank-relative breakpoint", () => {
  it("spells the address the way the field accepts it", () => {
    const form = breakpointToForm({ bank: 5, bankOffset: 0x0100, exec: true });
    expect(form.address).toEqual("05:+$0100");
    expect(form.kind).toEqual("exec");
  });

  it("survives a round trip unchanged", () => {
    const original: BreakpointInfo = { bank: 0x6f, bankOffset: 0x3fff, memoryWrite: true };
    const back = formToBreakpointInfo(breakpointToForm(original));
    expect(back).toMatchObject({ bank: 0x6f, bankOffset: 0x3fff, memoryWrite: true });
  });

  it("reads a watchpoint back as its own type", () => {
    expect(breakpointToForm({ bank: 5, bankOffset: 0, memoryRead: true }).kind).toEqual("memRead");
  });

  it("spells bank 0 offset 0 rather than leaving the field empty", () => {
    expect(breakpointToForm({ bank: 0, bankOffset: 0, exec: true }).address).toEqual("00:+$0000");
  });
});

describe("validateBreakpointForm for a bank-relative address", () => {
  it("accepts one on the ZX Spectrum Next", () => {
    expect(validateBreakpointForm(aForm({ address: "05:+$0100" }), nextEnv())).toEqual({});
  });

  it("accepts a watchpoint on one", () => {
    expect(
      validateBreakpointForm(aForm({ address: "05:+$0100", kind: "memWrite" }), nextEnv())
    ).toEqual({});
  });

  it("refuses one on any other machine, as the command does", () => {
    // --- Otherwise the dialog would author a breakpoint the command layer rejects, through a path
    // --- that bypasses that rejection.
    const errors = validateBreakpointForm(aForm({ address: "05:+$0100" }), partitionedEnv());
    expect(errors.address).toContain("ZX Spectrum Next");
  });

  it("names the bank when the bank is wrong, and the offset when the offset is", () => {
    expect(validateBreakpointForm(aForm({ address: "70:+$0100" }), nextEnv()).address).toContain(
      "16K bank"
    );
    expect(validateBreakpointForm(aForm({ address: "05:+$4000" }), nextEnv()).address).toContain(
      "offset within the bank"
    );
  });

  it("refuses it for an I/O kind", () => {
    const errors = validateBreakpointForm(
      aForm({ address: "05:+$0100", kind: "ioRead" }),
      nextEnv()
    );
    expect(errors.address).toContain("port");
  });

  it("refuses a partition alongside it", () => {
    const errors = validateBreakpointForm(
      aForm({ address: "05:+$0100", partition: 1 }),
      nextEnv()
    );
    expect(errors.partition).toContain("already names its bank");
  });

  it("still catches a duplicate", () => {
    const errors = validateBreakpointForm(
      aForm({ address: "05:+$0100" }),
      nextEnv({ existingKeys: ["05:+$0100"] })
    );
    expect(errors.form).toContain("05:+$0100");
  });

  it("lets a breakpoint keep its own key while being edited", () => {
    const errors = validateBreakpointForm(
      aForm({ address: "05:+$0100" }),
      nextEnv({ existingKeys: ["05:+$0100"], editingKey: "05:+$0100" })
    );
    expect(isFormValid(errors)).toEqual(true);
  });

  it("does not mistake the absolute partition form for a bank-relative one", () => {
    // --- `01:$8000` has no `+`, so it must still be judged as an address with a partition. The old
    // --- spelling changing meaning is the one thing this grammar must never do.
    const errors = validateBreakpointForm(aForm({ address: "01:$8000" }), nextEnv());
    expect(errors.address).toBeDefined();
    expect(errors.address).not.toContain("16K bank");
  });
});

describe("the dialog and bp-set agree on a bank-relative address", () => {
  it("produces the same bank and offset for the same text", async () => {
    // --- The same guarantee the numeric table above gives for plain addresses: two parsers meant to
    // --- accept the same spelling will not keep doing so unless something checks.
    const command = new SetBreakpointCommand();
    const base = createMockContext();
    // --- The command's grammar is gated on the machine: it reads the model and its ROM/bank
    // --- feature counts before it will parse a bank-relative spec at all.
    const context: any = {
      ...base,
      service: {
        ...base.service,
        machineService: {
          getMachineInfo: () => ({
            machine: { machineId: MI_ZXNEXT, features: { [MF_ROM]: 7, [MF_BANK]: 224 } }
          })
        },
        projectService: { getBreakpointAddressInfo: () => undefined }
      }
    };
    const args: any = { addrSpec: "05:+$0100" };
    await command.validateCommandArgs(context, args);

    const fromForm = formToBreakpointInfo(aForm({ address: "05:+$0100" }));
    expect({ bank: args.bank, bankOffset: args.bankOffset }).toEqual({
      bank: fromForm.bank,
      bankOffset: fromForm.bankOffset
    });
  });
});
