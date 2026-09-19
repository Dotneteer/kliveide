import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

/*
 * The WASM ZX Spectrum Next stands on its own: no TypeScript Next emulation in its class hierarchy,
 * in anything it imports, or in its instances.
 *
 * `ZxNextWasmV2Machine` used to extend the TypeScript `ZxNextMachine`, so every WASM machine built -
 * and reset - all ~25 TypeScript devices, and several paths quietly ran TypeScript emulation (the
 * keyboard, code injection, frame pacing). The two cores now share only neutral modules (the
 * `next*.ts` metadata, `nextMachineInfo.ts`) and the IDE contract (`IZxNextIdeMachine`). These tests
 * keep it that way. See `.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`, Step 5.
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

/** The TypeScript Next emulation: the machine, its base and CPU, the devices, the port handlers. */
const ZXNEXT = "src/emu/machines/zxNext/";
function isTypeScriptNextEmulation(file: string): boolean {
  if (file === "src/emu/z80/Z80NCpu.ts") return true;
  if (!file.startsWith(ZXNEXT) || file.startsWith(ZXNEXT + "wasm/")) return false;
  const name = file.slice(ZXNEXT.length);
  return (
    name === "ZxNextMachine.ts" ||
    name === "Z80NMachineBase.ts" ||
    name === "nextRegReadMux.ts" ||
    name === "Clock28.ts" ||
    name === "NextPsgChip.ts" ||
    /^[A-Za-z0-9]+Device\.ts$/.test(name) ||
    name.startsWith("io-ports/") ||
    name.startsWith("screen/") ||
    name.startsWith("storage/") ||
    name.startsWith("diagnostics/")
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

describe("ZX Spectrum Next WASM machine separation", () => {
  it("has no TypeScript Next class in its prototype chain", () => {
    const names: string[] = [];
    for (let p = ZxNextWasmV2Machine.prototype; p; p = Object.getPrototypeOf(p)) {
      names.push(p.constructor.name);
    }
    expect(names).not.toContain("ZxNextMachine");
    expect(names).not.toContain("Z80NMachineBase");
    expect(names).not.toContain("Z80NCpu");
    expect(names).toContain("ZxNextWasmHost");
  });

  it("imports no TypeScript Next emulation, directly or transitively", () => {
    for (const entry of [
      "src/emu/machines/zxNext/ZxNextWasmV2Machine.ts",
      "src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts"
    ]) {
      const graph = importGraph(entry);
      const leaks = [...graph.keys()].filter(isTypeScriptNextEmulation).map((f) => chain(graph, f));
      expect(leaks, entry).toEqual([]);
    }
  });

  it("the graph check would see a leak (the TypeScript machine is reachable from its own module)", () => {
    const graph = importGraph("src/emu/machines/zxNext/ZxNextMachine.ts");
    expect([...graph.keys()].filter(isTypeScriptNextEmulation)).toContain("src/emu/machines/zxNext/NextRegDevice.ts");
  });

  it("builds no TypeScript Next device", () => {
    const machine = new ZxNextWasmV2Machine();
    machine.hardReset();
    for (const device of [
      "memoryDevice",
      "nextRegDevice",
      "keyboardDevice",
      "composedScreenDevice",
      "paletteDevice",
      "spriteDevice",
      "tilemapDevice",
      "copperDevice",
      "divMmcDevice",
      "sdCardDevice",
      "audioControlDevice",
      "beeperDevice",
      "portManager"
    ]) {
      expect((machine as unknown as Record<string, unknown>)[device], device).toBeUndefined();
    }
  });
});
