import {
  createZxNextOracleComparison,
  expectCurrentMigrationDiagnosticsAreStillGuarded,
  expectMigratedDiagnosticsHaveOracleCoverage,
  ZXNEXT_ORACLE_MIGRATED_SURFACES
} from "./wasm-next-test-helpers";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM migration diagnostics oracle guard", () => {
  it("requires every reported migrated surface to have TypeScript oracle coverage", async () => {
    const comparison = await createZxNextOracleComparison();

    expectCurrentMigrationDiagnosticsAreStillGuarded(comparison.wasmDiagnostics);
    expectMigratedDiagnosticsHaveOracleCoverage(comparison.wasmDiagnostics, comparison.oracle);
    expect(comparison.wasmDiagnostics.migratedSurfaces).toEqual(ZXNEXT_ORACLE_MIGRATED_SURFACES);
  });

  it("fails loudly when a migrated surface has no oracle snapshot coverage", async () => {
    const comparison = await createZxNextOracleComparison();

    expect(() =>
      expectMigratedDiagnosticsHaveOracleCoverage(
        {
          migratedSurfaces: ["debug"]
        },
        {
          ...comparison.oracle,
          coveredSurfaces: []
        }
      )
    ).toThrow(/debug.*no TypeScript oracle snapshot coverage/);
  });

  it("fails loudly when migration diagnostics change without updating the guard", async () => {
    expect(() =>
      expectCurrentMigrationDiagnosticsAreStillGuarded({
        defaultReady: false,
        defaultBlockers: ["timing-depth-parity"],
        migratedSurfaces: ["debug"]
      })
    ).toThrow(/migrated surfaces changed without updating oracle coverage/);
  });

  it("fails loudly when default readiness changes without updating the guard", async () => {
    expect(() =>
      expectCurrentMigrationDiagnosticsAreStillGuarded({
        defaultReady: true,
        defaultBlockers: ["timing-depth-parity"],
        migratedSurfaces: ZXNEXT_ORACLE_MIGRATED_SURFACES
      })
    ).toThrow(/defaultReady without updating the rollout guard/);
  });
});
