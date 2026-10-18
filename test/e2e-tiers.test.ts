import fs from "fs";
import path from "path";
import picomatch from "picomatch";
import { describe, expect, it } from "vitest";
import { E2E_CORE_TESTS, E2E_KBASIC_TESTS, E2E_SLOW_TESTS } from "../build/e2e-tests";

/*
 * The slow tier is carved out of the two fast e2e lists (`.plans/FAST_SLOW_TEST_TIERS_PLAN.md`). An
 * entry that names a missing file silently stops excluding anything, and one outside both lists
 * would run in the unit tier as well - so both are checked here.
 */
const root = path.resolve(__dirname, "..");
const inFastList = picomatch([...E2E_CORE_TESTS, ...E2E_KBASIC_TESTS]);

describe("e2e test tiers", () => {
  it("lists every slow test once", () => {
    expect(new Set(E2E_SLOW_TESTS).size).toBe(E2E_SLOW_TESTS.length);
  });

  it.each(E2E_SLOW_TESTS)("%s exists and belongs to a fast e2e list", (file) => {
    expect(fs.existsSync(path.join(root, file))).toBe(true);
    expect(inFastList(file)).toBe(true);
  });
});
