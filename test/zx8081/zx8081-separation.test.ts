import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Zx8081WasmV2Machine } from "@emu/machines/zx8081/Zx8081WasmV2Machine";

/*
 * The ZX80/ZX81 machine stands on the shared `Z80MachineBase`, as the Cambridge Z88 does
 * (`.plans/ZX8081_WASM_PLAN.md` §4.2): no Spectrum machine in its class hierarchy, and no TypeScript
 * machine device - the Spectrum's ULA screen, beeper, keyboard, tape or floating bus, or any other
 * machine's devices - in anything it imports. Its hardware is the WASM core.
 */

const REPO = resolve(__dirname, "../..");
const ALIASES: Record<string, string> = {
  "@common": "src/common",
  "@abstractions": "src/common/abstractions",
  "@messaging": "src/common/messaging",
  "@state": "src/common/state",
  "@utils": "src/common/utils",
  "@renderer": "src/renderer",
  "@emu": "src/emu",
  "@appIde": "src/renderer/appIde",
  "@main": "src/main",
  "@controls": "src/renderer/controls",
  "@mvc": "src/renderer/mvc"
};

function resolveImport(fromFile: string, spec: string): string | undefined {
  let base: string | undefined;
  if (spec.startsWith(".")) {
    base = resolve(REPO, dirname(fromFile), spec);
  } else {
    const alias = Object.keys(ALIASES).find((a) => spec === a || spec.startsWith(a + "/"));
    if (!alias) return undefined; // --- a package
    base = resolve(REPO, ALIASES[alias] + spec.slice(alias.length));
  }
  for (const candidate of [base, base + ".ts", base + ".tsx", base + "/index.ts"]) {
    if (existsSync(candidate) && candidate.match(/\.tsx?$/)) return relative(REPO, candidate);
  }
  return undefined;
}

/** Every source file reachable from `entry` through `import`/`export ... from` (type imports included). */
function importGraph(entry: string): Map<string, string> {
  const parentOf = new Map<string, string>([[entry, ""]]);
  const queue = [entry];
  const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
  while (queue.length) {
    const file = queue.shift()!;
    const source = readFileSync(resolve(REPO, file), "utf8");
    for (const m of source.matchAll(importRe)) {
      const target = resolveImport(file, m[1]);
      if (target && !parentOf.has(target)) {
        parentOf.set(target, file);
        queue.push(target);
      }
    }
  }
  return parentOf;
}

function chain(parentOf: Map<string, string>, file: string): string {
  const path: string[] = [];
  for (let f: string | undefined = file; f; f = parentOf.get(f)) path.unshift(f);
  return path.join(" -> ");
}

/**
 * TypeScript machine emulation: a device or machine class of another machine. Interfaces
 * (`I...Device`) and the disk image helpers reach every machine through the shared debugger and
 * messaging modules; they emulate nothing.
 */
function isTypeScriptMachineEmulation(file: string): boolean {
  if (!file.startsWith("src/emu/machines/") || file.startsWith("src/emu/machines/zx8081/")) return false;
  const name = file.slice("src/emu/machines/".length);
  const base = name.split("/").pop() ?? "";
  if (/^I[A-Z]/.test(base)) return false;
  return (
    name === "ZxSpectrumBase.ts" ||
    name === "AudioDeviceBase.ts" ||
    /Device\.ts$/.test(base) ||
    /(Machine|WasmHost)\.ts$/.test(base)
  );
}

describe("ZX80/ZX81 machine separation", () => {
  it("stands on Z80MachineBase, not on a Spectrum machine", () => {
    const names: string[] = [];
    for (let p = Zx8081WasmV2Machine.prototype; p; p = Object.getPrototypeOf(p)) names.push(p.constructor.name);
    expect(names).toContain("Zx8081WasmHost");
    expect(names).toContain("Z80MachineBase");
    expect(names).not.toContain("ZxSpectrumBase");
  });

  it("imports no TypeScript machine emulation, directly or transitively", () => {
    for (const entry of [
      "src/emu/machines/zx8081/Zx8081WasmV2Machine.ts",
      "src/emu/machines/zx8081/wasm/Zx8081WasmV2Loader.ts"
    ]) {
      const graph = importGraph(entry);
      const leaks = [...graph.keys()].filter(isTypeScriptMachineEmulation).map((f) => chain(graph, f));
      expect(leaks, entry).toEqual([]);
    }
  });
});
