import { describe, expect, it, vi } from "vitest";

import { TestJUnitCommand } from "@renderer/appIde/commands/UnitTestCommands";
import { createMockContext, createMockStore } from "../commands/test-helpers/mock-context";
import { assembleWithInclude, INCLUDE_LINES } from "./unitTestSupport";

/*
 * `test-junit <file>`, the Test panel's "Export results as JUnit…" (`.plans/UNIT_TESTS_CLI_PLAN.md`
 * D14): the command line's JUnit writer on the store's last results. That the file equals
 * `klive test --junit`'s is checked end to end in `test/cli/klive-test-e2e.test.ts`.
 */

const SOURCE = `
  .org $8000
  UNITTEST_INITIALIZE()
  ret
UT_One:
  TC_END()
UT_Two:
  TC_END()
`;

async function contextWith(unitTests: object | undefined) {
  const result = await assembleWithInclude(SOURCE);
  const store = createMockStore({
    project: { folderPath: "/proj", buildRoots: ["main.kz80.asm"] },
    emulatorState: { machineId: "sp48" },
    compilation: { result, failed: false },
    unitTests
  } as never);
  const context = createMockContext({ store });
  (context.mainApi as any).saveTextFile = vi.fn().mockResolvedValue("/proj/out.xml");
  return context;
}

describe("test-junit", () => {
  it("writes the last run's tests, emulated time and the run's timestamp", async () => {
    const context = await contextWith({
      results: { UT_One: { id: "UT_One", status: "passed", tstates: 3500 } },
      runIds: ["UT_One"],
      summary: { total: 1, passed: 1, failed: 0, errors: 0, clockHz: 3_500_000 },
      startedAt: Date.UTC(2026, 9, 9),
      version: 1
    });
    const result = await new TestJUnitCommand().execute(context, { file: "out.xml" });
    expect(result.success).toBe(true);
    const xml = (context.mainApi.saveTextFile as any).mock.calls[0][1] as string;
    expect(xml).toContain('<testsuites name="proj" tests="1" failures="0" errors="0" skipped="0" time="0.001000" timestamp="2026-10-09T00:00:00.000Z">');
    expect(xml).toMatch(new RegExp(`<testcase classname="\\(root\\)" name="UT_One"[^>]* line="${INCLUDE_LINES + 5}" time="0\\.001000">`));
    // --- UT_Two was not in the run
    expect(xml).not.toContain("UT_Two");

    const plain = await contextWith((context.store.getState() as any).unitTests);
    await new TestJUnitCommand().execute(plain, { file: "out.xml", "-notimestamp": true });
    expect((plain.mainApi.saveTextFile as any).mock.calls[0][1]).not.toContain("timestamp=");
  });

  it("refuses without results", async () => {
    const context = await contextWith({ results: {}, version: 0 });
    const result = await new TestJUnitCommand().execute(context, { file: "out.xml" });
    expect(result).toMatchObject({ success: false, finalMessage: "Run the tests first: there are no results to export." });
  });
});
