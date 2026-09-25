import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../harness/z88/core/machines";

/*
 * The TypeScript Cambridge Z88 emulation is gone (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`,
 * Step 3; the last commit that has it is tagged `z88-typescript-last`). The WASM core
 * (`src/emu/machines/z88/wasm/`, adapter `Z88WasmV2Machine`) is the only Z88, and these checks keep
 * the deleted modules from coming back or being imported again - a type-only import included, which
 * the build would not report once someone re-added a file of the same name.
 */

const Z88 = "src/emu/machines/z88";

/** The modules the removal deleted, by their path under `src/emu/machines/z88/` */
const DELETED = [
  "Z88Machine",
  "Z88Implementation",
  "Z88BlinkDevice",
  "Z88ScreenDevice",
  "Z88KeyboardDevice",
  "Z88BeeperDevice",
  "IZ88DeviceHost",
  "IZ88BlinkDevice",
  "IZ88BlinkTestDevice",
  "IZ88KeyboardDevice",
  "IZ88ScreenDevice",
  "IZ88BeeperDevice",
  "memory/Z88BankedMemory",
  "memory/Z88MemoryCardBase",
  "memory/Z88RamMemoryCard",
  "memory/Z88RomMemoryCard",
  "memory/Z88UvEpromMemoryCard",
  "memory/Z88IntelFlashMemoryCard",
  "memory/Z88AmdFlashMemoryCard",
  "memory/Z88AmdFlash29F040B",
  "memory/Z88AmdFlash29F080B",
  "memory/CardType",
  "memory/IZ88MemoryCard",
  "memory/IZ88MemoryOperation",
  "memory/Z88PageInfo",
  "memory/Z88CardsState",
  // --- Moved next to z88CardCatalog.ts, with every consumer updated (no re-export files)
  "memory/CardIds",
  "memory/CardSlotState"
];

/** Every TypeScript source of the app, the tests and the scripts */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(REPO_ROOT, dir))) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(join(REPO_ROOT, path)).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|cjs|mjs|js)$/.test(name)) out.push(path);
  }
  return out;
}

describe("Cambridge Z88: the TypeScript emulation is removed", () => {
  it("none of the deleted modules exists", () => {
    const present = DELETED.filter((m) => existsSync(join(REPO_ROOT, Z88, `${m}.ts`)));
    expect(present).toEqual([]);
    expect(existsSync(join(REPO_ROOT, Z88, "memory"))).toBe(false);
  });

  it("no source imports a deleted module, by alias or relative path", () => {
    const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
    const deleted = new Set(DELETED.map((m) => `${Z88}/${m}`));
    const leaks: string[] = [];
    for (const file of ["src", "test", "scripts"].flatMap((d) => sources(d))) {
      for (const match of readFileSync(join(REPO_ROOT, file), "utf8").matchAll(importRe)) {
        const spec = (match[1] ?? match[2]).replace(/\.(ts|tsx|js)$/, "");
        const target = spec.startsWith("@emu/")
          ? `src/emu/${spec.slice("@emu/".length)}`
          : spec.startsWith(".")
            ? relative(REPO_ROOT, join(REPO_ROOT, file, "..", spec))
            : undefined;
        if (target && deleted.has(target)) leaks.push(`${file} -> ${spec}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("the Z88 folder holds the WASM machine and the modules it shares with the renderer", () => {
    const files = readdirSync(join(REPO_ROOT, Z88)).filter((f) => f.endsWith(".ts")).sort();
    expect(files).toEqual([
      "CardIds.ts",
      "CardSlotState.ts",
      "IZ88IdeMachine.ts",
      "Z88KeyCode.ts",
      "Z88KeyLayout.ts",
      "Z88KeyMappings.ts",
      "Z88MachineFactory.ts",
      "Z88WasmHost.ts",
      "Z88WasmV2Machine.ts",
      "z88CardCatalog.ts",
      "z88MachineInfo.ts"
    ]);
  });
});
