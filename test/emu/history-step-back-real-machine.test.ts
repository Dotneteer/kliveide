import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import { historicalCpuState } from "@renderer/appEmu/MainToEmuProcessor";
import { createSp48Session, type Sp48TestSession } from "../harness/sp48";

/*
 * Lite step back on a real core (`.plans/LITE_STEP_BACK_PLAN.md` §6.2): the 48K runs a program with
 * a known call tree with the history recorder on, and the controller's cursor walks back through
 * what it recorded. The machine is never touched by a navigation; any machine command returns to
 * the present (D5).
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

/*
 *   $8000  DI
 *   $8001  LD A,1
 *   $8003  CALL Sub         ; A=2 at Leaf
 *   $8006  LD A,2
 *   $8008  CALL Sub         ; A=3 at Leaf
 *   $800B  JR $
 *   Sub:  $8100  INC A
 *         $8101  CALL Leaf
 *         $8104  RET
 *   Leaf: $8200  LD B,A
 *         $8201  RET
 */
const MAIN = [0xf3, 0x3e, 0x01, 0xcd, 0x00, 0x81, 0x3e, 0x02, 0xcd, 0x00, 0x81, 0x18, 0xfe];
const SUB = [0x3c, 0xcd, 0x00, 0x82, 0xc9];
const LEAF = [0x47, 0xc9];
/** Instructions to the JR $: DI, LD, (INC, CALL, LD B, RET, RET) ×2 with LD A,2 between, CALL ×2 */
const PROGRAM_STEPS = 15;
/** The first visit of Leaf: the 6th record of 15 */
const LEAF_FIRST = PROGRAM_STEPS - 6 + 1;

type Regs = Pick<Z80CpuState, "pc" | "sp" | "af" | "bc">;
const regsOf = (s: Regs): Regs => ({ pc: s.pc, sp: s.sp, af: s.af, bc: s.bc });

async function setUp() {
  const session: Sp48TestSession = (await createSp48Session()).bootToBasic();
  session.poke(0x8000, MAIN).poke(0x8100, SUB).poke(0x8200, LEAF);
  session.recordHistory(true).clearHistory();
  session.machine.sp = 0x9000;
  session.machine.pc = 0x8000;
  const controller = new MachineController(
    createAppStore("test-step-back"),
    new ResolvingMessenger(),
    session.machine as any
  );
  controller.debugSupport = session.attachDebugSupport();
  // --- Every live state before each instruction: what stepping back must reproduce
  const states: Regs[] = [];
  for (let i = 0; i < PROGRAM_STEPS; i++) {
    states.push(regsOf(session.machine.getCpuState() as Z80CpuState));
    session.step();
  }
  controller.state = MachineControllerState.Paused;
  return { session, controller, states };
}

const cursorRegs = (controller: MachineController) => regsOf(controller.historyCursor.state()!.record.regs);

describe("lite step back on the ZX Spectrum 48K", () => {
  it("steps back through the registers stepping forward produced, and forward to the present", async () => {
    const { session, controller, states } = await setUp();
    const live = regsOf(session.machine.getCpuState() as Z80CpuState);
    for (let k = 1; k <= PROGRAM_STEPS; k++) {
      const result = controller.navigateHistory("back");
      expect(result).toMatchObject({ moved: true, position: k });
      expect(cursorRegs(controller), `step −${k}`).toEqual(states[PROGRAM_STEPS - k]);
    }
    // --- The DI is the oldest record: no further back (T7)
    expect(controller.navigateHistory("back")).toMatchObject({ moved: false, reason: "start" });
    for (let k = PROGRAM_STEPS - 1; k >= 1; k--) {
      expect(controller.navigateHistory("forward")).toMatchObject({ moved: true, position: k });
    }
    expect(controller.navigateHistory("forward")).toMatchObject({ moved: true, position: 0 });
    // --- Navigation never touched the machine
    expect(regsOf(session.machine.getCpuState() as Z80CpuState)).toEqual(live);
  });

  it("steps back over a call to the CALL, and out of a routine to its caller", async () => {
    const { controller } = await setUp();
    // --- From the present (JR $, after Sub's RET) back over the second CALL Sub
    expect(controller.navigateHistory("backOver")).toMatchObject({ moved: true });
    expect(cursorRegs(controller).pc).toBe(0x8008);
    expect(controller.navigateHistory("backOver")).toMatchObject({ moved: true });
    expect(cursorRegs(controller).pc).toBe(0x8006);
    expect(controller.navigateHistory("backOver")).toMatchObject({ moved: true });
    expect(cursorRegs(controller).pc).toBe(0x8003);

    // --- Into Leaf of the first call, then out twice
    controller.navigateHistory({ toPosition: LEAF_FIRST });
    expect(cursorRegs(controller).pc).toBe(0x8200);
    expect(controller.navigateHistory("backOut")).toMatchObject({ moved: true });
    expect(cursorRegs(controller).pc).toBe(0x8101);
    expect(controller.navigateHistory("backOut")).toMatchObject({ moved: true });
    expect(cursorRegs(controller).pc).toBe(0x8003);
    expect(controller.navigateHistory("backOut")).toMatchObject({ reason: "noCall" });
  });

  it("reconstructs the call stack from history (D10)", async () => {
    const { controller } = await setUp();
    controller.navigateHistory({ toPosition: LEAF_FIRST });
    const stack = controller.historyCursor.callStack()!;
    expect(stack.frames.map((f) => [f.callSite, f.returnAddress])).toEqual([
      [0x8101, 0x8104],
      [0x8003, 0x8006]
    ]);
  });

  it("reverse-continues to a breakpoint whose register condition held, and over-stops on a memory one", async () => {
    const { controller } = await setUp();
    controller.debugSupport!.addBreakpoint({ address: 0x8200, exec: true, condition: "A == 2" });
    let result = controller.navigateHistory("reverseContinue");
    expect(result).toMatchObject({ moved: true, breakpoint: "$8200" });
    expect(cursorRegs(controller)).toMatchObject({ pc: 0x8200, af: expect.any(Number) });
    expect(cursorRegs(controller).af >> 8).toBe(2);
    expect(controller.navigateHistory("reverseContinue")).toMatchObject({ reason: "noHit" });

    controller.navigateHistory("present");
    controller.debugSupport!.eraseAllBreakpoints();
    controller.debugSupport!.addBreakpoint({ address: 0x8200, exec: true, condition: "b[$8000] == $F3" });
    result = controller.navigateHistory("reverseContinue");
    expect(cursorRegs(controller).af >> 8).toBe(3);
    expect(result.notes).toEqual([
      "Breakpoint $8200: condition not checked - it reads memory, which is not historical in lite mode"
    ]);
  });

  it("returns to the present on any machine command, and puts the record where a live state goes", async () => {
    const { session, controller } = await setUp();
    controller.navigateHistory({ toPosition: 3 });
    const live = session.machine.getCpuState() as Z80CpuState;
    const historical = historicalCpuState(live, controller.historyCursor.state()!);
    expect(historical.pc).toBe(cursorRegs(controller).pc);
    expect(historical.history).toMatchObject({ position: 3, memoryIsHistorical: false });
    expect(historical.lastNextRegWrite).toBeUndefined();
    expect(controller.historyCursor.position).toBe(3);
    expect(controller.store.getState().emulatorState.historyPosition).toBe(3);

    controller.clearHistoryCursor();
    expect(controller.historyCursor.position).toBe(0);
    expect(controller.store.getState().emulatorState.historyPosition).toBeUndefined();

    controller.navigateHistory("back");
    // --- A state other than Paused drops the cursor (D1)
    controller.state = MachineControllerState.Stopped;
    expect(controller.historyCursor.position).toBe(0);
    controller.state = MachineControllerState.Paused;
    controller.navigateHistory("back");
    // --- A cleared ring drops it on the next read (T6)
    session.clearHistory();
    expect(controller.historyCursor.position).toBe(0);
  });
});
