import { describe, expect, it } from "vitest";

import {
  buildTimexWasm,
  outputRelative,
  packagedArtifactRelative,
  productionExports,
  timexOwnExports
} from "../../scripts/build-timex-wasm.cjs";
import { productionExports as sp48Exports } from "../../scripts/build-sp48-wasm.cjs";
import { TIMEX_OWN_EXPORTS } from "@emu/machines/timex/wasm/TimexWasmV2Loader";
import pkg from "../../package.json";

/*
 * The Timex core's build (`.plans/TIMEX_SCORPION_PLAN.md` P2): the 48K's exports under their own
 * names plus the SCLD's, its own artifact, and a place in the packaged app.
 */
describe("Timex WASM build", () => {
  it("exports everything the 48K core does, plus the Timex's own functions", () => {
    expect(productionExports).toEqual([...sp48Exports, ...timexOwnExports]);
    expect([...timexOwnExports]).toEqual([...TIMEX_OWN_EXPORTS]);
  });

  it("writes its own artifact, which the packaged app carries", () => {
    expect(outputRelative).toBe("src/emu/machines/timex/wasm/dist/zx-timex.wasm");
    expect(packagedArtifactRelative).toBe("wasm/timex/zx-timex.wasm");
    const resources = (pkg as any).build.extraResources as { from: string; to: string }[];
    expect(resources).toContainEqual(expect.objectContaining({ from: "src/emu/machines/timex/wasm/dist", to: "wasm/timex" }));
    expect(pkg.scripts["build:all-wasm"]).toContain("build:timex-wasm");
  });

  it("builds with every export present", async () => {
    const { output } = buildTimexWasm();
    const { readFileSync } = await import("node:fs");
    const module = new WebAssembly.Module(readFileSync(output));
    const names = WebAssembly.Module.exports(module).map((e) => e.name);
    for (const name of productionExports) expect(names).toContain(name);
  });
});
