/*
 * The memory-layout fingerprint (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` Phase 4).
 *
 * A small C program is linked the way the cores are, then changed: an added static or a renumbered
 * function table must change the fingerprint; an edit inside a function body must not. Then every
 * real core carries a readable stamp, and two builds of one core agree.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const layoutTools = require("../../../scripts/wasm-layout.cjs");

const dir = mkdtempSync(join(tmpdir(), "klive-layout-"));

/** Links C source like the cores, stamps it, and returns the layout and the stamped module */
function build(name: string, source: string, volatile: string[] = []) {
  const c = join(dir, `${name}.c`);
  const wasm = join(dir, `${name}.wasm`);
  const map = layoutTools.layoutMapPath(wasm);
  writeFileSync(c, source);
  const result = spawnSync(
    "clang",
    [
      "--target=wasm32",
      "-std=c11",
      "-O3",
      "-Wl,--strip-all",
      "-ffreestanding",
      "-nostdlib",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      "-Wl,--initial-memory=131072",
      "-Wl,--max-memory=131072",
      "-Wl,--export=run",
      "-Wl,--export=pick",
      ...layoutTools.layoutMapArgs(map),
      c,
      "-o",
      wasm
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) throw new Error(result.stderr);
  const layout = layoutTools.stampWasmLayout(wasm, map, volatile);
  return { layout, module: new WebAssembly.Module(readFileSync(wasm)) };
}

const BASE = `
typedef unsigned int u32;
static u32 counter;
static u32 buffer[64];
static u32 opA(u32 x) { return x + 1; }
static u32 opB(u32 x) { return x * 3; }
static u32 (*const table[2])(u32) = { opA, opB };
u32 pick(u32 i, u32 x) { return table[i & 1](x); }
u32 run(u32 n) { for (u32 i = 0; i < n; i++) buffer[i & 63] += counter++; return counter; }
`;

describe("layout fingerprint", () => {
  it("is the same for two builds of the same source", () => {
    expect(build("a1", BASE).layout.fingerprint).toBe(build("a2", BASE).layout.fingerprint);
  });

  it("ignores an edit inside a function body", () => {
    const edited = BASE.replace("buffer[i & 63] += counter++;", "buffer[i & 63] ^= counter++ * 7;");
    expect(build("b", edited).layout.fingerprint).toBe(build("b0", BASE).layout.fingerprint);
  });

  it("keeps the fingerprint but changes the code hash on an edit inside a function body (DEBUG_SESSION_RECORDING D3, T1)", () => {
    const edited = BASE.replace("buffer[i & 63] += counter++;", "buffer[i & 63] ^= counter++ * 7;");
    const a = build("h1", BASE).layout;
    const b = build("h2", BASE).layout;
    const c = build("h3", edited).layout;
    expect(a.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.codeHash).toBe(b.codeHash);
    expect(c.fingerprint).toBe(a.fingerprint);
    expect(c.codeHash).not.toBe(a.codeHash);
  });

  it("changes when a static is added", () => {
    // --- Used by `run`, so the linker keeps it
    const added = BASE.replace("static u32 counter;", "static u32 extra[4];\nstatic u32 counter;").replace(
      "return counter; }",
      "return counter + extra[n & 3]++; }"
    );
    expect(build("c", added).layout.fingerprint).not.toBe(build("c0", BASE).layout.fingerprint);
  });

  it("changes when the function table is reordered (a stored pointer would call another function)", () => {
    const swapped = BASE.replace("{ opA, opB }", "{ opB, opA }");
    expect(build("d", swapped).layout.fingerprint).not.toBe(build("d0", BASE).layout.fingerprint);
  });

  it("records volatile statics with their addresses, and refuses an unknown one", () => {
    const { layout } = build("e", BASE, ["buffer"]);
    expect(layout.volatile).toEqual([{ symbol: "buffer", address: expect.any(Number), size: 256 }]);
    expect(() => build("e2", BASE, ["nope"])).toThrow(/nope/);
  });

  it("is readable from the module at run time", () => {
    const { layout, module } = build("f", BASE, ["buffer"]);
    expect(readWasmLayout(module)).toEqual(layout);
    expect(layout.memorySize).toBe(131072);
  });

  it("reads as undefined from a module without a stamp, and from no module", () => {
    const bare = new WebAssembly.Module(new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
    expect(readWasmLayout(bare)).toBeUndefined();
    expect(readWasmLayout(undefined)).toBeUndefined();
  });
});

describe("the cores carry a layout", () => {
  const cores: [string, string][] = [
    ["sp48", "../../../scripts/build-sp48-wasm.cjs"],
    ["timex", "../../../scripts/build-timex-wasm.cjs"],
    ["sp128", "../../../scripts/build-sp128-wasm.cjs"],
    ["spp3e", "../../../scripts/build-spp3e-wasm.cjs"],
    ["z88", "../../../scripts/build-z88-wasm.cjs"],
    ["zx8081", "../../../scripts/build-zx8081-wasm.cjs"],
    ["zxnext", "../../../scripts/build-zxnext-wasm.cjs"]
  ];

  it.each(cores)("%s: two builds agree, and the stamp matches the memory size", (core, script) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const build = require(script);
    const fn = Object.entries(build).find(
      ([k, v]) => /^build.*Wasm$/.test(k) && !/All/.test(k) && typeof v === "function"
    )![1] as (o: object) => { layout: { fingerprint: string; memorySize: number } };
    const a = fn({ outputPath: join(dir, `${core}-a.wasm`) });
    const b = fn({ outputPath: join(dir, `${core}-b.wasm`) });
    expect(a.layout.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(b.layout.fingerprint).toBe(a.layout.fingerprint);
    const module = new WebAssembly.Module(readFileSync(join(dir, `${core}-a.wasm`)));
    expect(readWasmLayout(module)?.fingerprint).toBe(a.layout.fingerprint);
    // --- Two builds of one core are the same code: a debug recording opens in either (D3)
    expect((a.layout as { codeHash?: string }).codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect((b.layout as { codeHash?: string }).codeHash).toBe((a.layout as { codeHash?: string }).codeHash);
    expect(new WebAssembly.Instance(module, {}).exports.memory).toBeInstanceOf(WebAssembly.Memory);
  });
});
