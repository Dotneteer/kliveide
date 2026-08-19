import {
  createZxNextOracleComparison,
  expectCurrentScaffoldDiagnosticsAreStillGuarded,
  expectScaffoldDiagnosticsHaveOracleCoverage,
  ZXNEXT_ORACLE_SCAFFOLD_SURFACES
} from "./wasm-next-test-helpers";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM scaffold diagnostics oracle guard", () => {
  it("requires every current scaffold diagnostic to have TypeScript oracle coverage", async () => {
    const comparison = await createZxNextOracleComparison();

    expectCurrentScaffoldDiagnosticsAreStillGuarded(comparison.wasmDiagnostics);
    expectScaffoldDiagnosticsHaveOracleCoverage(comparison.wasmDiagnostics, comparison.oracle);
    expect(comparison.wasmDiagnostics.scaffoldSurfaces).toEqual(ZXNEXT_ORACLE_SCAFFOLD_SURFACES);
  });

  it("fails loudly when a scaffold surface has no oracle snapshot coverage", async () => {
    const comparison = await createZxNextOracleComparison();

    expect(() =>
      expectScaffoldDiagnosticsHaveOracleCoverage(
        {
          implementationIncomplete: true,
          scaffoldSurfaces: ["registers", "debug"]
        },
        {
          ...comparison.oracle,
          coveredSurfaces: ["registers"]
        }
      )
    ).toThrow(/debug.*no TypeScript oracle snapshot coverage/);
  });

  it("fails loudly when scaffold diagnostics change without updating the guard", async () => {
    expect(() =>
      expectCurrentScaffoldDiagnosticsAreStillGuarded({
        scaffoldSurfaces: ["registers", "memory"]
      })
    ).toThrow(/diagnostics changed without updating oracle coverage/);
  });
});
