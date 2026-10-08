import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { setGlobalSettingAction } from "@state/actions";
import { MachineController } from "@emu/machines/MachineController";
import { MessengerBase } from "@messaging/MessengerBase";
import { SETTING_EMU_REVERSE_DEBUGGING } from "@common/settings/setting-const";
import { createCore } from "../harness/zxnext";

/*
 * The controller's half of the reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` D2, D5,
 * Phase 2), on the real ZX Spectrum Next core: a timeline in every debug session, none in a plain Run
 * or with the setting off; the run loop takes keyframes; a stop ends it.
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function controllerWithNext(storeId: string) {
  const machine = await createCore({ hardReset: true });
  const store = createAppStore(storeId);
  const controller = new MachineController(store, new ResolvingMessenger(), machine as any);
  return { machine, controller, store };
}

describe("reverse-debugging timeline through the machine controller", () => {
  it("keeps a timeline in a debug session, takes keyframes as frames run, and ends it at the stop", async () => {
    const { controller } = await controllerWithNext("test-timeline-1");
    await controller.startDebug();
    await wait(600);
    await controller.pause();
    const timeline = controller.timeline!;
    expect(timeline).toBeDefined();
    expect(timeline.mode).toBe("live");
    expect(timeline.store.keyframes.length).toBeGreaterThan(1);
    // --- A pause and a step keep it
    await controller.stepInto();
    await wait(20);
    expect(controller.timeline).toBe(timeline);
    // --- ...and the past is reachable
    const start = timeline.startPosition!;
    timeline.replayTo({ sequence: start.sequence + 1000, sub: 1, phase: 0 });
    expect(timeline.mode).toBe("navigating");
    timeline.returnToPresent();
    expect(timeline.mode).toBe("live");
    await controller.stop();
    expect(controller.timeline).toBeUndefined();
    expect(timeline.isEnded).toBe(true);
  });

  it("keeps none in a plain Run, or with the setting off", async () => {
    const { controller, store } = await controllerWithNext("test-timeline-2");
    await controller.start();
    await wait(60);
    await controller.pause();
    expect(controller.timeline).toBeUndefined();
    await controller.stop();

    store.dispatch(setGlobalSettingAction(SETTING_EMU_REVERSE_DEBUGGING, false));
    await controller.startDebug();
    await wait(60);
    await controller.pause();
    expect(controller.timeline).toBeUndefined();
    await controller.stop();
  });
});
