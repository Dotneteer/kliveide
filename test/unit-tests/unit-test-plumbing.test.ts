import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { unitTestsReducer } from "@common/state/unit-tests-reducer";
import {
  unitTestEventAction,
  unitTestsClearAction,
  unitTestsRunEndedAction,
  unitTestsRunStartedAction
} from "@common/state/actions";
import { toRunnableCompilation } from "@common/unit-tests/runnableCompilation";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { addUnitTestSupport } from "@main/unit-tests/addUnitTestSupport";
import { sanitize } from "@main/unit-tests/unitTestProjectSettings";
import { findWasmArtifact } from "@main/unit-tests/wasmArtifacts";
import { artifactNameOf, unsupportedMachineMessage } from "@main/unit-tests/unitTestMachines";
import { SP48_WASM_V2_ARTIFACT_NAME } from "@emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader";
import { SP128_WASM_V2_ARTIFACT_NAME } from "@emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader";
import { SPP3E_WASM_V2_ARTIFACT_NAME } from "@emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader";
import { ZXNEXT_WASM_V2_ARTIFACT_NAME } from "@emu/machines/zxNext/wasm/ZxNextWasmV2Loader";
import { KLIVE_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/kliveInclude";
import { SJASMPLUS_UNIT_TEST_INCLUDE } from "@main/unit-tests/includes/sjasmplusInclude";
import { resultText, unitTestRows } from "@renderer/appIde/unit-tests/unitTestTree";

vi.mock("@main/main-store", () => ({ mainStore: { getState: () => ({}), dispatch: () => {} } }));
import { runOptionsFor } from "@main/unit-tests/unitTestService";
import { findTest } from "@renderer/appIde/commands/UnitTestCommands";

import { assembleWithInclude } from "./unitTestSupport";

/*
 * The plumbing around the runner (`.plans/Z80_UNIT_TESTS_PLAN.md` Phase 2): the store slice, the
 * compilation the worker gets, Add unit-test support, the project settings, the core lookup, the
 * panel's rows and the commands' test lookup.
 */

describe("unit-tests store slice", () => {
  it("clears only the results of the tests a run runs, and follows its events", () => {
    let state = unitTestsReducer(undefined, unitTestEventAction({ kind: "result", result: { id: "a", status: "failed", tstates: 1 } }));
    state = unitTestsReducer(state, unitTestEventAction({ kind: "result", result: { id: "b", status: "passed", tstates: 1 } }));
    state = unitTestsReducer(state, unitTestsRunStartedAction(["a"], 10));
    expect(Object.keys(state.results)).toEqual(["b"]);
    expect(state).toMatchObject({ running: true, runIds: ["a"], startedAt: 10 });
    state = unitTestsReducer(state, unitTestEventAction({ kind: "started", id: "a" }));
    expect(state.runningTest).toBe("a");
    state = unitTestsReducer(state, unitTestEventAction({ kind: "result", result: { id: "a", status: "passed", tstates: 5 } }));
    expect(state.runningTest).toBeUndefined();
    state = unitTestsReducer(state, unitTestEventAction({ kind: "problem", message: "p" }));
    state = unitTestsReducer(state, unitTestEventAction({ kind: "finished", summary: { total: 1, passed: 1, failed: 0, errors: 0 } }));
    state = unitTestsReducer(state, unitTestsRunEndedAction(20));
    expect(state).toMatchObject({ running: false, finishedAt: 20, problems: ["p"], summary: { passed: 1 } });
    expect(unitTestsReducer(state, unitTestsClearAction()).results).toEqual({});
  });
});

describe("the worker's compilation", () => {
  it("survives a JSON round trip and discovers the same tests", async () => {
    const output = await assembleWithInclude(`
  .org $8000
  UNITTEST_INITIALIZE()
    ret
  .module Suite
UT_a:
    TC_END()
  .endmodule
`);
    const plain = JSON.parse(JSON.stringify(toRunnableCompilation(output)));
    const fromPlain = discoverUnitTests(plain);
    const fromLive = discoverUnitTests(output as never);
    expect(fromPlain.tests).toEqual(fromLive.tests);
    expect(fromPlain.labels).toEqual(fromLive.labels);
    expect(plain.debugAnnotations.length).toBe(output.debugAnnotations.length);
  });
});

describe("Add unit-test support", () => {
  const project = () => mkdtempSync(join(tmpdir(), "klive-ut-"));

  it("writes the Klive include and the #include line once", () => {
    const dir = project();
    const root = join(dir, "code.kz80.asm");
    writeFileSync(root, "  .org $8000\n  ret\n");
    const first = addUnitTestSupport(root, "kz80-asm");
    expect(first.created).toBe(join(dir, "unit_tests.kz80.asm"));
    expect(first.includeAdded).toBe(true);
    expect(readFileSync(first.includeFile, "utf8")).toBe(KLIVE_UNIT_TEST_INCLUDE);
    expect(readFileSync(root, "utf8").startsWith('#include "unit_tests.kz80.asm"\n')).toBe(true);
    const second = addUnitTestSupport(root, "kz80-asm");
    expect(second).toMatchObject({ includeAdded: false });
    expect(second.created).toBeUndefined();
    expect(readFileSync(root, "utf8").match(/#include/g)).toHaveLength(1);
  });

  it("keeps a DeZog project's own unit_tests.inc and adds SLDOPT for sjasmplus", () => {
    const dir = project();
    const root = join(dir, "main.asm");
    writeFileSync(join(dir, "unit_tests.inc"), "; DeZog's include\r\n");
    writeFileSync(root, "  DEVICE ZXSPECTRUM48\r\n  include \"unit_tests.inc\"\r\n");
    const result = addUnitTestSupport(root, "sjasmp");
    expect(result).toMatchObject({ includeAdded: false, sldoptAdded: true });
    expect(result.created).toBeUndefined();
    expect(readFileSync(join(dir, "unit_tests.inc"), "utf8")).toBe("; DeZog's include\r\n");
    expect(readFileSync(root, "utf8").startsWith("    SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION\r\n")).toBe(true);
  });

  it("writes Klive's sjasmplus include into a project that has none", () => {
    const dir = project();
    const root = join(dir, "main.asm");
    writeFileSync(root, "  SLDOPT COMMENT WPMEM, LOGPOINT, ASSERTION\n");
    const result = addUnitTestSupport(root, "sjasmp");
    expect(readFileSync(result.includeFile, "utf8")).toBe(SJASMPLUS_UNIT_TEST_INCLUDE);
    expect(result).toMatchObject({ includeAdded: true, sldoptAdded: false });
  });

  it("refuses a build root without DeZog-style tests", () => {
    expect(() => addUnitTestSupport("/x/main.zxbas", "zxbas")).toThrow(/Klive Z80 assembler/);
  });
});

describe("project settings and machines", () => {
  it("keeps only the documented unitTests fields (D19)", () => {
    expect(
      sanitize({ timeout: 2, boot: "none", stopAtStart: false, machine: "sp128", include: ["A.*", 3], bogus: 1, timeoutx: 5 })
    ).toEqual({ timeout: 2, boot: "none", stopAtStart: false, machine: "sp128", include: ["A.*"] });
    expect(sanitize({ timeout: -1, boot: "maybe" })).toEqual({});
  });

  it("merges a request over the project settings", () => {
    expect(runOptionsFor({}, { timeout: 3, include: ["A.*"] }, "sp48")).toMatchObject({
      timeoutSeconds: 3,
      include: ["A.*"],
      boot: "rom"
    });
    expect(runOptionsFor({ options: { ids: ["x"] } }, { include: ["A.*"] }, "zxnext")).toMatchObject({
      ids: ["x"],
      boot: "none",
      timeoutSeconds: 1
    });
    expect(runOptionsFor({ options: { ids: ["x"] } }, { include: ["A.*"] }, "zxnext").include).toBeUndefined();
  });

  it("names the cores the loaders load, and refuses machines without a runner", () => {
    expect(artifactNameOf("sp48")).toBe(SP48_WASM_V2_ARTIFACT_NAME);
    expect(artifactNameOf("sp128")).toBe(SP128_WASM_V2_ARTIFACT_NAME);
    expect(artifactNameOf("spp3e")).toBe(SPP3E_WASM_V2_ARTIFACT_NAME);
    expect(artifactNameOf("zxnext")).toBe(ZXNEXT_WASM_V2_ARTIFACT_NAME);
    expect(unsupportedMachineMessage("sp48")).toBeUndefined();
    expect(unsupportedMachineMessage("c64")).toMatch(/Z80/);
    expect(unsupportedMachineMessage("z88")).toMatch(/Cambridge Z88/);
  });

  it("finds a core in the repository, and a packaged app's hashed copy", () => {
    expect(findWasmArtifact("zx-spectrum48.wasm", join(__dirname, "../../out/main"))).toMatch(
      /src[\\/]emu[\\/]machines[\\/]zxSpectrum48[\\/]wasm[\\/]dist[\\/]zx-spectrum48\.wasm$/
    );
    const app = mkdtempSync(join(tmpdir(), "klive-app-"));
    mkdirSync(join(app, "main"));
    mkdirSync(join(app, "renderer/assets"), { recursive: true });
    writeFileSync(join(app, "renderer/assets/zx-spectrum48-AbC123.wasm"), "x");
    writeFileSync(join(app, "renderer/assets/zx-spectrum-next-Zz9.wasm"), "x");
    expect(findWasmArtifact("zx-spectrum48.wasm", join(app, "main"))).toBe(join(app, "renderer/assets/zx-spectrum48-AbC123.wasm"));
    expect(findWasmArtifact("zx-timex.wasm", join(app, "main"))).toBeUndefined();
    expect(existsSync(join(app, "main"))).toBe(true);
    // --- The resources folder's plain copy, outside the asar, comes first (UNIT_TESTS_CLI_PLAN T3)
    const resources = mkdtempSync(join(tmpdir(), "klive-res-"));
    mkdirSync(join(resources, "wasm/zxSpectrum48"), { recursive: true });
    writeFileSync(join(resources, "wasm/zxSpectrum48/zx-spectrum48.wasm"), "x");
    expect(findWasmArtifact("zx-spectrum48.wasm", join(app, "main"), resources)).toBe(join(resources, "wasm/zxSpectrum48/zx-spectrum48.wasm"));
    expect(findWasmArtifact("zx-spectrum128.wasm", join(app, "main"), resources)).toBeUndefined();
  });
});

describe("the panel's rows and the commands' lookup", () => {
  const tests = [
    { id: "UT_a", label: "UT_a", suitePath: [], address: 1 },
    { id: "S.UT_b", label: "UT_b", suitePath: ["S"], address: 2 },
    { id: "S.UT_c", label: "UT_c", suitePath: ["S"], address: 3 }
  ];

  it("groups by suite, worst status first, with failure messages", () => {
    const rows = unitTestRows(
      tests,
      { "S.UT_b": { id: "S.UT_b", status: "failed", tstates: 1, message: "m" } },
      { running: true, runningTest: "S.UT_c", runIds: ["S.UT_c"] }
    );
    expect(rows.map((r) => r.key)).toEqual(["test:UT_a", "suite:S", "test:S.UT_b", "msg:S.UT_b", "test:S.UT_c"]);
    expect(rows[1]).toMatchObject({ status: "failed", count: 2, failures: 1 });
    expect(rows[4]).toMatchObject({ status: "running" });
    expect(unitTestRows(tests, {}, {}, "ut_c").map((r) => r.key)).toEqual(["suite:S", "test:S.UT_c"]);
    expect(resultText(tests[1], { id: "S.UT_b", status: "failed", tstates: 1200, message: "m", location: { file: "f", line: 3 } })).toBe(
      "S.UT_b: failed, 1,200 T\nm\nat f:3"
    );
  });

  it("finds a test by id, label or a unique pattern", () => {
    expect(findTest(tests, "S.UT_b")).toBe(tests[1]);
    expect(findTest(tests, "UT_c")).toBe(tests[2]);
    expect(findTest(tests, "*b")).toBe(tests[1]);
    expect(findTest(tests, "S.*")).toMatch(/names 2 tests/);
    expect(findTest(tests, "nope")).toMatch(/No unit test/);
  });
});
