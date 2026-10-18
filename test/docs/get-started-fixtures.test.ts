/**
 * The programs the Get Started pages ask the reader to type must build.
 *
 * They live in `scripts/doc-shots/fixtures/get-started/`, where the screenshot recipes also open
 * them, so the code a page shows, the code in its screenshots and the code tested here are one
 * file (R5 of `.plans/DOCS_SITE_MODERNIZATION_PLAN.md`). A page whose program stops assembling
 * fails here, not in a reader's IDE.
 *
 * The test also checks that each page's code block still matches its fixture, so the two copies
 * cannot drift apart.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Z80Compiler } from "@main/z80-compiler/Z80Compiler";
import { KBasicCompiler } from "@main/kbasic/KBasicCompiler";

const REPO = join(__dirname, "..", "..");
const FIXTURES = join(REPO, "scripts", "doc-shots", "fixtures", "get-started");
const PAGES = join(REPO, "docs", "content", "en", "get-started");

type Output = { errors?: { errorCode: string; message: string; isWarning?: boolean }[]; segments?: { emittedCode: number[] }[] };

function errorsOf(output: Output) {
  return (output.errors ?? []).filter((e) => !e.isWarning).map((e) => `${e.errorCode}: ${e.message}`);
}

/** The code blocks of every Get Started page, with the fixture file each one names. */
function pageBlocks() {
  const blocks: { page: string; fixture: string; code: string }[] = [];
  for (const file of readdirSync(PAGES).filter((f) => f.endsWith(".mdx"))) {
    const text = readFileSync(join(PAGES, file), "utf8");
    // A block opts in with a `fixture=` meta: ```z80klive fixture="border-colours/code/code.kz80.asm"
    for (const m of text.matchAll(/```\w+[^\n]*fixture="([^"]+)"[^\n]*\n([\s\S]*?)```/g)) {
      blocks.push({ page: file, fixture: m[1], code: m[2] });
    }
  }
  return blocks;
}

describe("Get Started fixture programs", () => {
  it("assembles the border-colours program for the 48K", async () => {
    const output = (await new Z80Compiler().compileFile(
      join(FIXTURES, "border-colours", "code", "code.kz80.asm")
    )) as Output;
    expect(errorsOf(output)).toEqual([]);
    expect(output.segments?.[0].emittedCode.length).toBeGreaterThan(10);
  });

  it("assembles the next-sprite program for the ZX Spectrum Next", async () => {
    const output = (await new Z80Compiler().compileFile(
      join(FIXTURES, "next-sprite", "code", "code.kz80.asm")
    )) as Output;
    expect(errorsOf(output)).toEqual([]);
    // --- The code plus the 256-byte pattern
    const bytes = (output.segments ?? []).reduce((n, s) => n + s.emittedCode.length, 0);
    expect(bytes).toBeGreaterThan(256);
  });

  it("compiles the bouncing-ball program with Klive BASIC", async () => {
    const output = (await new KBasicCompiler().compileFile(
      join(FIXTURES, "bouncing-ball", "code", "program.zxbas")
    )) as Output;
    expect(errorsOf(output)).toEqual([]);
    expect(output.segments?.length).toBeGreaterThan(0);
  });

  it("keeps every page's code block identical to its fixture", () => {
    const blocks = pageBlocks();
    // --- Every fixture is shown on a page; a renamed fence attribute would otherwise pass silently
    expect(new Set(blocks.map((b) => b.fixture.split("/")[0]))).toEqual(
      new Set(["border-colours", "bouncing-ball", "next-sprite"])
    );
    for (const { page, fixture, code } of blocks) {
      const expected = readFileSync(join(FIXTURES, fixture), "utf8");
      expect(code, `${page} shows a different ${fixture}`).toBe(expected);
    }
  });
});
