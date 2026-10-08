import { createSp128Session, type Sp128SessionModel, type Sp128SessionOptions } from "../../harness/sp128";
import { createSp48Session } from "../../harness/sp48";
import { createTimexSession, type TimexSessionOptions } from "../../harness/timex";
import { createZ88Session } from "../../harness/z88";
import { createZx81Session } from "../../harness/zx81";
import type { HistoryCoreDriver, HistoryTestMachine } from "./historyCoreSuite";

/*
 * The history suite's drivers (`historyCoreSuite.ts`): each core's harness session behind the one
 * shape the suite drives.
 */

type Session = {
  machine: unknown;
  poke(address: number, bytes: number[]): unknown;
  peek(address: number): number;
  step(count: number): unknown;
  runFrames(count: number): unknown;
};

/**
 * @param s The harness session
 * @param prefix The core's `…GetCpuPrefix` export: a Spectrum harness steps one CPU *cycle* at a time
 *   (the debug loop's unit, trap T1), so a step runs cycles until no prefix is pending
 */
function driver(s: Session, prefix: string): HistoryCoreDriver {
  const pending = () =>
    (s.machine as { wasmV2Runtime: { exports: Record<string, () => number> } }).wasmV2Runtime.exports[prefix]() !== 0;
  return {
    machine: s.machine as HistoryTestMachine,
    poke: (address, bytes) => void s.poke(address, Array.from(bytes)),
    peek: (address) => s.peek(address),
    step: (count) => {
      for (let i = 0; i < count; i++) {
        s.step(1);
        while (pending()) s.step(1);
      }
    },
    runFrames: (count) => void s.runFrames(count)
  };
}

export async function sp48Driver(): Promise<HistoryCoreDriver> {
  return driver(await createSp48Session(), "sp48GetCpuPrefix");
}

export async function timexDriver(options: TimexSessionOptions = {}): Promise<HistoryCoreDriver> {
  return driver(await createTimexSession(options), "sp48GetCpuPrefix");
}

export async function sp128Driver(model: Sp128SessionModel, options: Sp128SessionOptions = {}): Promise<HistoryCoreDriver> {
  const prefix = model === "sp128" || model === "pentagon" || model === "scorpion" ? "sp128GetCpuPrefix" : "spp3eGetCpuPrefix";
  return driver(await createSp128Session(model, options), prefix);
}

/** The Z88 with the whole 64K mapped to internal RAM (the harness's flat layout) */
export async function z88Driver(): Promise<HistoryCoreDriver> {
  const s = await createZ88Session();
  s.mapFlatRam();
  return driver(s, "z88GetCpuPrefix");
}

export async function zx8081Driver(machineId: "zx80" | "zx81" = "zx81"): Promise<HistoryCoreDriver> {
  return driver(await createZx81Session({ machineId }), "zx8081GetCpuPrefix");
}
