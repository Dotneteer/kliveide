import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { advancedDebuggingOffMessage } from "@common/features/advancedDebugging";
import { BREAKPOINT_GROUP_ORDER, BREAKPOINT_GROUP_TITLES } from "@renderer/appIde/utils/breakpoint-grouping";
import { breakpointFilterLines, describeHitRule } from "@renderer/appIde/utils/breakpoint-filter-text";
import { describeWatchpoints } from "@renderer/appIde/utils/watch-watchpoints";
import { resultText, summaryText } from "@renderer/appIde/unit-tests/unitTestTree";
import { parseHitSpec } from "@common/utils/breakpoint-filters";
import { breakpointStatusText } from "@common/utils/breakpoint-spec";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { compileLogTemplate } from "@common/utils/breakpoint-condition/logpoint-template";
import { parseDezogExpression } from "@common/utils/breakpoint-condition/dezog/dezog-parser";
import { serviceSpanText } from "@common/history/serviceSpans";
import { HistoryKind } from "@common/history/historyRecord";

/*
 * The shared debugger texts in the pseudo-locale: every message these modules build is pseudo text,
 * so none of them is left in English when the display language changes.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

describe("shared debugger texts in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("translates breakpoint, unit-test, condition and history texts", () => {
    setLanguage("qps");
    const texts: string[] = [
      advancedDebuggingOffMessage(),
      ...BREAKPOINT_GROUP_ORDER.map((group) => BREAKPOINT_GROUP_TITLES[group]),
      describeHitRule({ address: 1, hitMode: "every", hitCount: 3 })!,
      ...breakpointFilterLines({ address: 1, condition: "a == 1", currentHits: 2, conditionError: "x", oneShot: true }),
      ...describeWatchpoints([{ address: 0x8000, memoryWrite: true, watchSymbol: "counter" }]),
      summaryText({ total: 3, passed: 1, failed: 1, errors: 1, cancelled: true } as never),
      resultText({ id: "S.UT_a" } as never, undefined),
      (parseHitSpec("x") as { error: string }).error,
      breakpointStatusText({ address: 1, disabled: true }),
      compileCondition("", {}).errors[0].message,
      compileCondition("a <", {}).errors[0].message,
      compileLogTemplate("{", "klive", {}).errors[0].message,
      serviceSpanText({ kind: HistoryKind.Nmi, instructions: 2, frameTacts: 10 } as never)
    ];
    for (const text of texts) expect(text, text).toSatisfy(isPseudo);
    expect(() => parseDezogExpression("")).toThrow(/~/);
  });
});
