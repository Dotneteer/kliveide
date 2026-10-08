/*
 * The export contract (`.plans/REVERSE_DEBUGGING_PLAN.md` D7, Phase 1), on every WASM core:
 *
 * - every function export of every core has a class (`exportContract.ts`); a core with an export the
 *   contract does not know fails here, so a new input path cannot silently break replay;
 * - every `pure` and `debug` export really leaves the core's image alone: each is called on a running
 *   machine, with several argument sets, and the image (volatile statics excluded) must be unchanged.
 *   A `journaled` export is allowed to change it; a misclassified one shows up here.
 */
import { describe, expect, it } from "vitest";
import { classifyExport, unclassifiedExports } from "@emu/machines/reverse/exportContract";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import { createSp48Session } from "../../harness/sp48";
import { createSp128Session } from "../../harness/sp128";
import { createTimexSession } from "../../harness/timex";
import { createZ88Session } from "../../harness/z88";
import { createZx81Session } from "../../harness/zx81";
import { createSession as createNextSession } from "../../harness/zxnext";

type Runtime = { module: WebAssembly.Module; exports: Record<string, unknown> & { memory: WebAssembly.Memory } };

/** A machine of each core, booted and running something */
const CORES: [string, () => Promise<Runtime>][] = [
  [
    "sp48",
    async () => {
      const s = await createSp48Session();
      s.bootToBasic();
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "timex",
    async () => {
      const s = await createTimexSession();
      s.bootToBasic();
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "sp128",
    async () => {
      const s = await createSp128Session("sp128");
      s.runFrames(120);
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "spp3e",
    async () => {
      const s = await createSp128Session("fdd1");
      s.runFrames(120);
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "zxnext",
    async () => {
      const s = await createNextSession();
      await s.loadCode(`
      .org $8000
start:
      ld bc,$fffd
      ld a,7
      out (c),a
loop:
      inc a
      out ($fe),a
      nextreg $40,a
      ld ($c000),a
      jr loop
`);
      s.runFrames(5);
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "z88",
    async () => {
      const s = await createZ88Session();
      s.runFrames(60);
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ],
  [
    "zx8081",
    async () => {
      const s = await createZx81Session();
      s.bootToBasic();
      return s.machine.wasmV2Runtime as unknown as Runtime;
    }
  ]
];

/** The argument sets a pure or debug export is called with */
const ARGUMENT_SETS = [0, 1, 7, 0x4000, 0xffff];

/** The image without the C shadow stack, whose stale frames every call rewrites */
function image(coreId: string, runtime: Runtime): Uint8Array {
  const image = captureWasmImage(coreId, runtime.module, runtime.exports.memory.buffer).image;
  const stack = readWasmLayout(runtime.module)?.stack;
  if (stack) image.fill(0, stack.address, stack.address + stack.size);
  return image;
}

function firstDifference(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

describe("export contract", () => {
  it("leaves an unknown export unclassified (the check this test relies on)", () => {
    expect(unclassifiedExports("sp48", ["sp48GetFrames", "sp48FrobnicateWidget", "sp48ExecuteFrame"])).toEqual([
      "sp48FrobnicateWidget"
    ]);
    expect(classifyExport("sp48", "zxnextGetFrames")).toBeUndefined();
  });

  for (const [coreId, create] of CORES) {
    it(`${coreId}: every export is classified, and every pure or debug export leaves the image alone`, async () => {
      const runtime = await create();
      const names = WebAssembly.Module.exports(runtime.module)
        .filter((e) => e.kind === "function")
        .map((e) => e.name);
      expect(unclassifiedExports(coreId, names), `unclassified ${coreId} exports`).toEqual([]);
      expect(readWasmLayout(runtime.module)?.stack?.size, "the layout stamp's stack").toBeGreaterThan(0);

      const offenders: string[] = [];
      for (const name of names) {
        const cls = classifyExport(coreId, name);
        if (cls !== "pure" && cls !== "debug") continue;
        const fn = runtime.exports[name] as (...args: number[]) => unknown;
        for (const value of ARGUMENT_SETS) {
          const before = image(coreId, runtime);
          try {
            fn(...new Array(fn.length).fill(value));
          } catch {
            // --- A trap on a nonsense argument is not a state change
          }
          const at = firstDifference(before, image(coreId, runtime));
          if (at >= 0) {
            offenders.push(`${name}(${value}) [${cls}] changed byte ${at}`);
            break;
          }
        }
      }
      expect(offenders, `${coreId} exports that change the image`).toEqual([]);
    }, 120_000);
  }
});
