import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { createSp128Session } from "../harness/sp128";
import { createTimexSession } from "../harness/timex";
import { createZ88Session } from "../harness/z88";
import { createZx81Session } from "../harness/zx81";

/*
 * Reverse debugging on the machines Phase 7 enabled (`.plans/REVERSE_DEBUGGING_PLAN.md` D19), through
 * the real machine controller - the part the journal-replay determinism test (which drives the cores
 * directly) does not reach: each machine's `TimelineMachine` wiring, its debug loop's replay stop, and
 * its host state. Each machine runs its own ROM (the 128 menu, BASIC, OZ, the ZX80/81 editor):
 *
 * - up to 300 Step Backs, each putting the whole machine where the forward run had it;
 * - Step Forward and Return to Present back to the present's exact state;
 * - Step Into from the past (a replay run), then Continue from the past to the present, live again;
 * - Take over here: the future goes, and the machine runs on from the fork point.
 */

class ResolvingMessenger extends MessengerBase {
  protected send(message: RequestMessage): void {
    if (message.correlationId != null) {
      this.processResponse({ type: "ApiMethodResponse", correlationId: message.correlationId, result: undefined });
    }
  }
  get requestChannel(): Channel {
    return "EmuToMain";
  }
  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

type AnyWasmMachine = {
  wasmV2Runtime?: { module: WebAssembly.Module; exports: any };
  executionContext: { debugSupport?: unknown };
  pc: number;
  frames: number;
};

/** The machines, booted to where their ROM waits for the user */
const MACHINES: { name: string; coreId: string; create(): Promise<AnyWasmMachine> }[] = [
  {
    name: "ZX Spectrum 128K",
    coreId: "sp128",
    create: async () => (await createSp128Session("sp128")).runFrames(100).machine as never
  },
  {
    name: "ZX Spectrum +3E",
    coreId: "spp3e",
    create: async () => (await createSp128Session("fdd1")).runFrames(100).machine as never
  },
  { name: "Timex TC2048", coreId: "timex", create: async () => (await createTimexSession()).bootToBasic().machine as never },
  {
    name: "Cambridge Z88",
    coreId: "z88",
    create: async () => (await createZ88Session({ rom: "model" })).runFrames(900).machine as never
  },
  { name: "ZX81", coreId: "zx8081", create: async () => (await createZx81Session({ machineId: MI_ZX81 })).bootToBasic().machine as never },
  { name: "ZX80", coreId: "zx8081", create: async () => (await createZx81Session({ machineId: MI_ZX80 })).bootToBasic().machine as never }
];

const key = (p: TimelinePosition) => `${p.sequence}/${p.sub}/${p.phase}`;

/** The machine's whole state as a hash: volatile statics, the stack, the bus-event fields (T15) and any scratch (T5) out */
function stateHash(machine: AnyWasmMachine, coreId: string): number {
  const runtime = machine.wasmV2Runtime!;
  const image = captureWasmImage(coreId, runtime.module, runtime.exports.memory.buffer).image;
  const layout = readWasmLayout(runtime.module)!;
  image.fill(0, layout.stack!.address, layout.stack!.address + layout.stack!.size);
  for (const s of layout.scratch ?? []) image.fill(0, s.address, s.address + s.size);
  const bus = runtime.exports.z80HistoryBusEventFieldsPtr();
  image.fill(0, bus, bus + runtime.exports.z80HistoryBusEventFieldsSize());
  const words = new Uint32Array(image.buffer, image.byteOffset, image.byteLength >> 2);
  let h = 0x811c9dc5;
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193);
  return h >>> 0;
}

async function waitFor(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400_000; i++) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("reverse debugging through the controller on every Phase 7 machine", () => {
  for (const m of MACHINES) {
    it(m.name, async () => {
      const machine = await m.create();
      const controller = new MachineController(withAdvancedDebugging(createAppStore(`test-reverse-${m.coreId}`)), new ResolvingMessenger(), machine as never);
      const debugSupport = new DebugSupport(undefined, []);
      connectConditionSupport(debugSupport, machine as never);
      machine.executionContext.debugSupport = debugSupport;
      controller.debugSupport = debugSupport;
      controller.state = MachineControllerState.Paused;
      const paused = () => controller.state === MachineControllerState.Paused;
      const hash = () => stateHash(machine, m.coreId);

      // --- A debug run of a couple of seconds: the run loop takes keyframes on the way
      const startFrame = machine.frames;
      await controller.startDebug();
      await waitFor(() => machine.frames - startFrame >= 120, "120 frames");
      await controller.pause();
      const timeline = controller.timeline!;
      expect(timeline, "a timeline").toBeDefined();
      expect(timeline.store.keyframes.length).toBeGreaterThan(1);

      // --- Forward, logging every position's state
      const forward = new Map<string, { hash: number; pc: number }>();
      forward.set(key(timeline.position), { hash: hash(), pc: machine.pc });
      for (let i = 0; i < 400; i++) {
        await controller.stepInto();
        await waitFor(paused, `step ${i}`);
        forward.set(key(timeline.position), { hash: hash(), pc: machine.pc });
      }
      const present = timeline.position;
      const presentHash = hash();

      // --- Up to 300 Step Backs, as far as the forward log reaches: the whole machine as the forward run
      // --- had it. A step back is a record; on the ZX80/81 a record holds a display line's forced NOPs.
      const firstLogged = Math.min(...[...forward.keys()].map((x) => Number(x.split("/")[0])));
      let stepsBack = 0;
      for (let k = 1; k <= 300; k++) {
        // --- A step back lands before the previous record, or - over a display line's forced-NOP
        // --- record, which G4.3's stop rules skip - before the one before it
        if (timeline.position.sequence <= firstLogged + 2) break;
        stepsBack++;
        expect(controller.navigateHistory("back").moved, `step back ${k}`).toBe(true);
        const at = forward.get(key(timeline.position));
        expect(at, `step back ${k}: the forward run passed ${key(timeline.position)}`).toBeDefined();
        expect(hash(), `step back ${k}`).toBe(at!.hash);
        expect(machine.pc).toBe(at!.pc);
      }
      expect(stepsBack).toBeGreaterThanOrEqual(30);
      for (let k = 0; k < 20; k++) {
        controller.navigateHistory("forward");
        expect(hash(), `step forward ${k}`).toBe(forward.get(key(timeline.position))!.hash);
      }
      controller.navigateHistory("present");
      expect(timeline.mode).toBe("live");
      expect(timeline.position).toEqual(present);
      expect(hash()).toBe(presentHash);

      // --- Step Into from the past (a replay run)
      for (let k = 0; k < Math.min(200, stepsBack); k++) controller.navigateHistory("back");
      for (let k = 0; k < 10; k++) {
        await controller.stepInto();
        await waitFor(paused, `step into ${k} from the past`);
        expect(timeline.mode).toBe("navigating");
        expect(hash(), `step into ${k} from the past`).toBe(forward.get(key(timeline.position))!.hash);
      }

      // --- Take over here: the recorded future goes, and the machine runs on from the fork point as
      // --- the recorded run did (no input came after it)
      expect(await controller.takeOverHere()).toBe(true);
      expect(timeline.mode).toBe("live");
      for (let k = 0; k < 5; k++) {
        await controller.stepInto();
        await waitFor(paused, `step ${k} after the fork`);
        expect(hash(), `step ${k} after the fork`).toBe(forward.get(key(timeline.position))!.hash);
      }

      // --- Continue from the past replays to the present and goes live
      for (let k = 0; k < Math.min(50, stepsBack); k++) controller.navigateHistory("back");
      expect(timeline.mode).toBe("navigating");
      await controller.startDebug();
      await waitFor(() => timeline.mode === "live", "the present");
      await controller.pause();
      await controller.stop();
    }, 600_000);
  }
});
