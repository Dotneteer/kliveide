import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";

/*
 * The WASM Cambridge Z88 stands on its own: no TypeScript Z88 emulation in its class hierarchy, in
 * anything it imports (type imports included), or in its instances.
 *
 * The ZX Spectrum Next's WASM machine once extended the TypeScript machine, and quiet paths kept
 * running TypeScript emulation on the production backend (`.ai/wasm-migration-intent-and-lessons.md`).
 * The Z88 was built separated from the start: the two cores share only the neutral modules
 * (`z88MachineInfo.ts`, `z88CardCatalog.ts`, `Z88KeyCode.ts`, `Z88KeyMappings.ts`, the card ids and
 * slot state) and the IDE contract (`IZ88Machine`, `IZ88IdeMachine`). These tests keep it that way.
 * See `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, Step 2.
 */

const REPO = resolve(__dirname, "../../..");
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

/**
 * The TypeScript Z88 emulation: the machine, its devices (and the device interfaces, which reach the
 * TypeScript memory through `IZ88DeviceHost`), the banked memory and the card classes.
 */
const Z88 = "src/emu/machines/z88/";
const NEUTRAL_MEMORY_MODULES = ["memory/CardIds.ts", "memory/CardSlotState.ts"];
function isTypeScriptZ88Emulation(file: string): boolean {
  if (!file.startsWith(Z88) || file.startsWith(Z88 + "wasm/")) return false;
  const name = file.slice(Z88.length);
  if (name.startsWith("memory/")) return !NEUTRAL_MEMORY_MODULES.includes(name);
  return (
    name === "Z88Machine.ts" ||
    name === "IZ88DeviceHost.ts" ||
    name === "IZ88BlinkTestDevice.ts" ||
    /^I?Z88[A-Za-z]+Device\.ts$/.test(name)
  );
}

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

describe("Cambridge Z88 WASM machine separation", () => {
  it("has no TypeScript Z88 class in its prototype chain", () => {
    const names: string[] = [];
    for (let p = Z88WasmV2Machine.prototype; p; p = Object.getPrototypeOf(p)) {
      names.push(p.constructor.name);
    }
    expect(names).not.toContain("Z88Machine");
    expect(names).toContain("Z88WasmHost");
    expect(names).toContain("Z80MachineBase");
  });

  it("imports no TypeScript Z88 emulation, directly or transitively", () => {
    for (const entry of [
      "src/emu/machines/z88/Z88WasmV2Machine.ts",
      "src/emu/machines/z88/Z88WasmHost.ts",
      "src/emu/machines/z88/wasm/Z88WasmV2Loader.ts"
    ]) {
      const graph = importGraph(entry);
      const leaks = [...graph.keys()].filter(isTypeScriptZ88Emulation).map((f) => chain(graph, f));
      expect(leaks, entry).toEqual([]);
    }
  });

  it("uses the neutral modules both cores share", () => {
    const graph = importGraph("src/emu/machines/z88/Z88WasmV2Machine.ts");
    for (const neutral of [
      "src/emu/machines/z88/z88MachineInfo.ts",
      "src/emu/machines/z88/z88CardCatalog.ts",
      "src/emu/machines/z88/Z88KeyCode.ts",
      "src/emu/machines/z88/Z88KeyMappings.ts",
      "src/emu/machines/z88/IZ88IdeMachine.ts"
    ]) {
      expect(graph.has(neutral), neutral).toBe(true);
    }
  });

  it("the graph check would see a leak (the TypeScript machine reaches its devices and cards)", () => {
    const leaks = [...importGraph("src/emu/machines/z88/Z88Machine.ts").keys()].filter(isTypeScriptZ88Emulation);
    expect(leaks).toContain("src/emu/machines/z88/Z88BlinkDevice.ts");
    expect(leaks).toContain("src/emu/machines/z88/memory/Z88BankedMemory.ts");
    expect(leaks).toContain("src/emu/machines/z88/memory/Z88AmdFlashMemoryCard.ts");
  });

  it("the neutral modules themselves reach no TypeScript Z88 emulation", () => {
    for (const neutral of ["src/emu/machines/z88/z88MachineInfo.ts", "src/emu/machines/z88/z88CardCatalog.ts"]) {
      const graph = importGraph(neutral);
      expect([...graph.keys()].filter(isTypeScriptZ88Emulation).map((f) => chain(graph, f)), neutral).toEqual([]);
    }
  });

  it("builds no TypeScript Z88 device", () => {
    const machine = new Z88WasmV2Machine();
    for (const member of ["memory", "blinkDevice", "keyboardDevice", "screenDevice", "beeperDevice"]) {
      expect((machine as unknown as Record<string, unknown>)[member], member).toBeUndefined();
    }
  });
});
