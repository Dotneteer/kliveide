import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discardWasmOutput,
  publishWasmOutput,
  stagingWasmOutput
} from "../../../scripts/wasm-layout.cjs";

/*
 * A core build compiles and stamps a staging file, then renames it over the artifact, so a test
 * worker reading the artifact while another rebuilds it never gets a module without its layout stamp
 * or a half-written one (the CI failure "built without a memory-layout stamp").
 */
describe("publishing a WASM build atomically", () => {
  it("a real build compiles to a staging file beside the output; a fake compiler run writes the output", () => {
    const output = join(tmpdir(), "core.wasm");
    const staged = stagingWasmOutput(output, true);
    expect(staged).not.toBe(output);
    expect(staged.startsWith(`${output}.`)).toBe(true);
    // --- Never a ".wasm": the builds' dist cleanup deletes every other .wasm in the folder
    expect(staged.endsWith(".wasm")).toBe(false);
    expect(stagingWasmOutput(output, false)).toBe(output);
  });

  it("publishing replaces the artifact with the staged bytes and leaves no staging file", () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-publish-"));
    const output = join(dir, "core.wasm");
    writeFileSync(output, "old");
    const staged = stagingWasmOutput(output, true);
    writeFileSync(staged, "new");
    publishWasmOutput(staged, output);
    expect(readFileSync(output, "utf8")).toBe("new");
    expect(readdirSync(dir)).toEqual(["core.wasm"]);
  });

  it("a failed build's staging file is discarded; the artifact is untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-publish-"));
    const output = join(dir, "core.wasm");
    writeFileSync(output, "old");
    const staged = stagingWasmOutput(output, true);
    writeFileSync(staged, "half");
    discardWasmOutput(staged, output);
    expect(readFileSync(output, "utf8")).toBe("old");
    expect(readdirSync(dir)).toEqual(["core.wasm"]);
    // --- With no staging (a fake compiler), discarding never removes the artifact
    discardWasmOutput(output, output);
    expect(readdirSync(dir)).toEqual(["core.wasm"]);
  });
});
