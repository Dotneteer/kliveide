import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";

import { createSp48Session } from "../harness/sp48";

/*
 * A hit-count breakpoint on a routine the ROM also runs while a program is being started.
 *
 * Starting a compiled program boots the ROM through a code-injection flow, whose `ReachExecPoint`
 * step runs the per-instruction loop in `NoDebug` mode. That run used to carry the breakpoint store,
 * so the IM 1 handler at $38 - which runs every frame of the boot - was counted there: `-hit 4` was
 * spent (and silently stopped the boot) before the program ever ran, and the breakpoint never fired
 * in the debug session. Breakpoints belong to debug runs only (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`
 * C19).
 */

class ResolvingMessenger extends MessengerBase {
  protected send(message: RequestMessage): void {
    if (message.correlationId != null) {
      this.processResponse({
        type: "ApiMethodResponse",
        correlationId: message.correlationId,
        result: undefined
      });
    }
  }

  get requestChannel(): Channel {
    return "EmuToMain";
  }

  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

async function until(test: () => boolean, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (!test()) {
    if (Date.now() > deadline) throw new Error("Timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("hit counts and the code-injection flow - ZX Spectrum 48K", () => {
  it("counts only the debug session's hits: -hit 4 on $38 stops on the 4th interrupt", async () => {
    const session = await createSp48Session();
    const machine = session.machine;
    const store = createAppStore("test-cond-bp-injection");
    const controller = new MachineController(store, new ResolvingMessenger(), machine as any);
    const debugSupport = new DebugSupport(store, []);
    connectConditionSupport(debugSupport, machine);
    controller.debugSupport = debugSupport;
    debugSupport.addBreakpoint({ address: 0x0038, exec: true, hitCount: 4 });

    // --- An endless loop at $8000, started as the IDE starts a compiled program in debug mode
    await controller.runCode(
      {
        model: "sp48",
        entryAddress: 0x8000,
        segments: [{ bankOffset: 0, startAddress: 0x8000, emittedCode: [0x18, 0xfe] }],
        options: {}
      },
      undefined,
      true,
      false
    );

    try {
      await until(() => controller.state === MachineControllerState.Paused, 5000);
      expect(machine.pc).toBe(0x0038);
      expect(debugSupport.listBreakpointsWithState()[0].currentHits).toBe(4);
    } finally {
      await controller.stop();
    }
  }, 20000);
});
