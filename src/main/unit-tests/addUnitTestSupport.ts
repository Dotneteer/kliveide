import fs from "fs";
import path from "path";

import { SLDOPT_ALL_KEYWORDS } from "@common/utils/source-annotations";
import { KLIVE_INCLUDE_FILE, KLIVE_UNIT_TEST_INCLUDE } from "./includes/kliveInclude";
import { SJASMPLUS_INCLUDE_FILE, SJASMPLUS_UNIT_TEST_INCLUDE } from "./includes/sjasmplusInclude";

/*
 * Testing → Add unit-test support / `test-init` (`.plans/Z80_UNIT_TESTS_PLAN.md` D4, D5): writes
 * Klive's include next to the build root - never over an existing file, so a DeZog project keeps
 * its own `unit_tests.inc` - and adds the include line to the build root when it has none. For
 * sjasmplus, the `SLDOPT` line that exports the assertion comments comes too.
 */

/** What adding unit-test support did */
export type AddUnitTestSupportResult = {
  /** The include file written, or `undefined` when one was there already */
  created?: string;
  /** The include file the build root uses */
  includeFile: string;
  /** The include line was added to the build root */
  includeAdded: boolean;
  /** The `SLDOPT COMMENT` line was added (sjasmplus) */
  sldoptAdded?: boolean;
};

/** The languages that can hold unit tests (D14) */
export const UNIT_TEST_LANGUAGES = ["kz80-asm", "sjasmp"];

/**
 * Adds unit-test support to a build root
 * @param buildRoot The build root's full path
 * @param language Its language (`kz80-asm` or `sjasmp`)
 * @throws Error for a language that cannot hold DeZog-style tests
 */
export function addUnitTestSupport(buildRoot: string, language: string): AddUnitTestSupportResult {
  if (!UNIT_TEST_LANGUAGES.includes(language)) {
    throw new Error(
      "Unit tests need a Klive Z80 assembler (.kz80.asm) or sjasmplus build root; this build root's language has no DeZog-style tests."
    );
  }
  const klive = language === "kz80-asm";
  const fileName = klive ? KLIVE_INCLUDE_FILE : SJASMPLUS_INCLUDE_FILE;
  const includeFile = path.join(path.dirname(buildRoot), fileName);
  let created: string | undefined;
  if (!fs.existsSync(includeFile)) {
    fs.writeFileSync(includeFile, klive ? KLIVE_UNIT_TEST_INCLUDE : SJASMPLUS_UNIT_TEST_INCLUDE);
    created = includeFile;
  }

  const source = fs.readFileSync(buildRoot, "utf8");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const escaped = fileName.replace(/\./g, "\\.");
  const hasInclude = klive
    ? new RegExp(`^\\s*#include\\s+["<]([^">]*[\\\\/])?${escaped}[">]`, "im").test(source)
    : new RegExp(`^\\s*include\\s+["<]([^">]*[\\\\/])?${escaped}[">]`, "im").test(source);
  const hasSldopt = klive || /^\s*SLDOPT\s+COMMENT\b/im.test(source);
  const added: string[] = [];
  if (!hasSldopt) added.push(`    ${SLDOPT_ALL_KEYWORDS}`);
  if (!hasInclude) added.push(klive ? `#include "${fileName}"` : `    include "${fileName}"`);
  if (added.length) fs.writeFileSync(buildRoot, added.join(eol) + eol + source);
  return {
    ...(created ? { created } : {}),
    includeFile,
    includeAdded: !hasInclude,
    ...(klive ? {} : { sldoptAdded: !hasSldopt })
  };
}
