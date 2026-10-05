/**
 * Syntax highlighting unit tests for the .copper pragma (`.plans/COPPER_DEBUGGING_PLAN.md` §4.9).
 *
 * These tests validate the structure of the Monaco Monarch language definition exported by
 * `asmKz80LanguageProvider`:
 *   SH-1  The `pragmas` word list contains the dotted .copper spellings (and not the bare word,
 *         which the assembler does not treat as a pragma).
 *   SH-2  The root state pushes `copperSubcmd` on `.copper` (but not on a bare `copper`, as in
 *         `.savenex copper "file"`).
 *   SH-3  The `copperSubcmd` state colours the sub-commands as "statement" and pops back.
 *
 * No browser or Monaco runtime is needed: the definition is a plain JS object.
 */

import { describe, it, expect } from "vitest";
import { asmKz80LanguageProvider } from "@renderer/appIde/project/asmKz80LanguageProvider";

const langDef = asmKz80LanguageProvider.languageDef as any;

const tokenOf = (rule: any[]) => (typeof rule[1] === "string" ? rule[1] : rule[1]?.token);
const nextOf = (rule: any[]) => (typeof rule[1] === "string" ? undefined : rule[1]?.next);

/** The first rule of a state whose regex matches `text` at its start, as Monarch tries them. */
function firstRuleMatching(state: any[], text: string): any[] | undefined {
  return state.find((r: any) => {
    if (!Array.isArray(r) || !(r[0] instanceof RegExp)) return false;
    const m = new RegExp(r[0].source, r[0].flags.replace("g", "")).exec(text);
    return !!m && m.index === 0;
  });
}

// ---------------------------------------------------------------------------
// SH-1: pragmas word list
// ---------------------------------------------------------------------------

describe("SH-1: pragmas word list contains .copper entries", () => {
  it("contains '.copper' and '.COPPER'", () => {
    expect(langDef.pragmas).toContain(".copper");
    expect(langDef.pragmas).toContain(".COPPER");
  });

  it("does not contain the bare 'copper' (it is not a pragma)", () => {
    expect(langDef.pragmas).not.toContain("copper");
    expect(langDef.pragmas).not.toContain("COPPER");
  });

  it("still contains .dma and .savenex", () => {
    expect(langDef.pragmas).toContain(".dma");
    expect(langDef.pragmas).toContain(".savenex");
  });
});

// ---------------------------------------------------------------------------
// SH-2: root state
// ---------------------------------------------------------------------------

describe("SH-2: root state enters copperSubcmd", () => {
  const root: any[] = langDef.tokenizer.root;

  it("'.copper' is a pragma that pushes copperSubcmd", () => {
    const rule = firstRuleMatching(root, ".copper wait 1, 2");
    expect(rule).toBeDefined();
    expect(tokenOf(rule!)).toBe("pragma");
    expect(nextOf(rule!)).toBe("@copperSubcmd");
  });

  it("'.COPPER' and '.Copper' push copperSubcmd too", () => {
    for (const text of [".COPPER HALT", ".Copper nop"]) {
      expect(nextOf(firstRuleMatching(root, text)!)).toBe("@copperSubcmd");
    }
  });

  it("a bare 'copper' does not push copperSubcmd", () => {
    const rule = firstRuleMatching(root, "copper \"file.cop\"");
    expect(nextOf(rule!)).not.toBe("@copperSubcmd");
  });

  it("'.copperx' is not the pragma", () => {
    const rule = firstRuleMatching(root, ".copperx");
    expect(nextOf(rule!)).not.toBe("@copperSubcmd");
  });
});

// ---------------------------------------------------------------------------
// SH-3: copperSubcmd state
// ---------------------------------------------------------------------------

describe("SH-3: copperSubcmd tokenizer state", () => {
  const state: any[] | undefined = langDef.tokenizer?.copperSubcmd;

  it("copperSubcmd state exists", () => {
    expect(Array.isArray(state)).toBe(true);
  });

  it("colours every sub-command as 'statement' and pops", () => {
    for (const cmd of ["wait", "move", "nop", "halt", "word", "WAIT", "Halt"]) {
      const rule = firstRuleMatching(state!, `${cmd} 1`);
      expect(rule, `no rule for '${cmd}'`).toBeDefined();
      expect(tokenOf(rule!)).toBe("statement");
      expect(nextOf(rule!)).toBe("@pop");
    }
  });

  it("an unknown sub-command is an identifier and pops", () => {
    const rule = firstRuleMatching(state!, "waiting 1");
    expect(tokenOf(rule!)).toBe("identifier");
    expect(nextOf(rule!)).toBe("@pop");
  });

  it("whitespace stays in the state", () => {
    const rule = firstRuleMatching(state!, "  wait");
    expect(tokenOf(rule!)).toBe("white");
    expect(nextOf(rule!)).toBeUndefined();
  });
});
