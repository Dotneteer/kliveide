import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";
import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";
import { Timeline, type TimelineMachine } from "@emu/machines/reverse/Timeline";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { recordingToSnapshot, snapshotToRecordingParts } from "@emu/machines/reverse/timelineRecording";
import { KEYFRAME_PAGE_SIZE } from "@emu/machines/reverse/KeyframeStore";
import { readDebugRecording, writeDebugRecording } from "@common/debugRecording/debugRecordingFile";
import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { CimHandler } from "@main/fat32/CimHandlers";
import { loadDebugRecording, saveDebugRecording } from "@renderer/appEmu/machines/debugRecordingFile";
import type { MachineStatePorts } from "@renderer/appEmu/machines/machineStateFile";
import { createSp128Session } from "../harness/sp128";
import { createTimexSession } from "../harness/timex";
import { createZ88Session } from "../harness/z88";
import { createZx81Session } from "../harness/zx81";
import { createCore, createSession as createNextSession } from "../harness/zxnext";

/*
 * Debug recordings on every machine with reverse debugging (`.plans/DEBUG_SESSION_RECORDING_PLAN.md`
 * Phases 4 and 5): each machine's debug session is saved and opened into a fresh machine and
 * controller, through the emulator's own save and open flow, and the opened timeline must be the
 * recorded one - the present byte for byte, step backs the forward run's states, and a full replay
 * from the start (`-verify`) agreeing with every keyframe. The 48K has its own, deeper test
 * (`debug-recording-sp48.test.ts`).
 *
 * The Next's NextZXOS part (Phase 4) needs a NextZXOS card (`~/Klive/ks2.cim`, cloned, never written)
 * and is skipped without one: a session that reads the card is opened on a Next with no card at all.
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
  machineId: string;
  wasmV2Runtime?: { module: WebAssembly.Module; exports: any };
  executionContext: { debugSupport?: unknown };
  pc: number;
  frames: number;
  saveMachineState(): any;
  loadMachineState(parts: any): void;
};

const MACHINES: { name: string; coreId: string; create(): Promise<AnyWasmMachine> }[] = [
  { name: "ZX Spectrum 128K", coreId: "sp128", create: async () => (await createSp128Session("sp128")).runFrames(100).machine as never },
  { name: "ZX Spectrum +3E", coreId: "spp3e", create: async () => (await createSp128Session("fdd1")).runFrames(100).machine as never },
  { name: "Timex TC2048", coreId: "timex", create: async () => (await createTimexSession()).bootToBasic().machine as never },
  { name: "Cambridge Z88", coreId: "z88", create: async () => (await createZ88Session({ rom: "model" })).runFrames(900).machine as never },
  { name: "ZX81", coreId: "zx8081", create: async () => (await createZx81Session({ machineId: MI_ZX81 })).bootToBasic().machine as never },
  { name: "ZX80", coreId: "zx8081", create: async () => (await createZx81Session({ machineId: MI_ZX80 })).bootToBasic().machine as never },
  { name: "ZX Spectrum Next", coreId: "zxnext", create: async () => (await createCore({ hardReset: true })) as never }
];

const key = (p: TimelinePosition) => `${p.sequence}/${p.sub}/${p.phase}`;

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

function controllerFor(machine: AnyWasmMachine, name: string) {
  const controller = new MachineController(createAppStore(name), new ResolvingMessenger(), machine as never);
  const debugSupport = new DebugSupport(undefined, []);
  connectConditionSupport(debugSupport, machine as never);
  machine.executionContext.debugSupport = debugSupport;
  controller.debugSupport = debugSupport;
  controller.state = MachineControllerState.Paused;
  return controller;
}

function portsOf(controller: MachineController, machineId: string): MachineStatePorts {
  return {
    getMachineController: () => controller as never,
    getEmulatorState: () => ({ machineId }) as never,
    setMachineType: async () => true,
    setTape: async () => {},
    setDisk: async () => {},
    getMediaFiles: () => ({})
  } as unknown as MachineStatePorts;
}

describe("debug recordings on every machine with reverse debugging (Phase 5)", () => {
  for (const m of MACHINES) {
    it(m.name, async () => {
      const machine = await m.create();
      const controller = controllerFor(machine, `test-recording-${m.name}`);
      const paused = () => controller.state === MachineControllerState.Paused;
      const startFrame = machine.frames;
      await controller.startDebug();
      await waitFor(() => machine.frames - startFrame >= 120, "120 frames");
      await controller.pause();
      const timeline = controller.timeline!;
      expect(timeline.store.keyframes.length).toBeGreaterThan(1);
      const forward = new Map<string, number>();
      forward.set(key(timeline.position), stateHash(machine, m.coreId));
      for (let i = 0; i < 200; i++) {
        await controller.stepInto();
        await waitFor(paused, `step ${i}`);
        forward.set(key(timeline.position), stateHash(machine, m.coreId));
      }
      const presentHash = stateHash(machine, m.coreId);

      const saved = await saveDebugRecording(portsOf(controller, machine.machineId), { kliveVersion: "test" });
      expect(saved.keyframes).toBeGreaterThan(1);

      // --- A fresh machine of the same kind, its own state anything
      const fresh = await m.create();
      const opened = controllerFor(fresh, `test-recording-${m.name}-opened`);
      const result = await loadDebugRecording(portsOf(opened, fresh.machineId), "bug.klr", saved.bytes, "test", { verify: true });
      expect(result.path).toBe("timeline");
      expect(result.verified!.keyframes).toBe(saved.keyframes);
      const loaded = opened.timeline!;
      expect(loaded.position).toEqual(timeline.position);
      expect(stateHash(fresh, m.coreId)).toBe(presentHash);

      // --- Step backs land on the forward run's states
      let matched = 0;
      for (let k = 0; k < 150; k++) {
        if (!opened.navigateHistory("back").moved) break;
        const want = forward.get(key(loaded.position));
        if (want === undefined) continue; // --- a step over a forced-NOP record (ZX80/81) lands between logged steps
        expect(stateHash(fresh, m.coreId), `step back ${k + 1}`).toBe(want);
        matched++;
      }
      expect(matched).toBeGreaterThan(30);
      opened.navigateHistory("present");
      expect(stateHash(fresh, m.coreId)).toBe(presentHash);
    }, 600_000);
  }
});

// ------------------------------------------------------------------------------------------------
// Phase 4: a NextZXOS session that reads the SD card opens on a Next with no card (D14)

const KS2 = process.env.KLIVE_REVERSE_SPIKE_CIM ?? join(userInfo().homedir, "Klive", "ks2.cim");

describe.skipIf(!existsSync(KS2))("a NextZXOS recording opens without the SD card (Phase 4)", () => {
  it("replays from its start to its present on a Next with no card, and runs on past its end", async () => {
    const folder = mkdtempSync(join(tmpdir(), "klive-recording-cim-"));
    try {
      const clone = join(folder, "ks2.cim");
      copyFileSync(KS2, clone);
      const card = new CimHandler(clone);
      const info = card.cimInfo;
      const s = await createNextSession();
      let sdCalls = 0;
      s.attachSdCard({
        totalSectors: (info.maxSize * 2048) / info.sectorSize,
        readSector: (sector) => {
          sdCalls++;
          return card.readSector(sector);
        },
        writeSector: (sector, data) => card.writeSector(sector, data)
      });
      const machine = s.machine as unknown as TimelineMachine & AnyWasmMachine;
      const timeline = Timeline.start(machine, { budgetBytes: 512 * 1048576 });
      for (let f = 0; f < 600; f++) {
        await s.runFramesAsync(1);
        timeline.afterFrame(true);
      }
      expect(sdCalls).toBeGreaterThan(100);
      expect(timeline.journal.entries.some((e) => e.kind === "write" && e.length === 512)).toBe(true);
      const parts = machine.saveMachineState();
      const snapshot = timeline.exportSnapshot();
      const bytes = await writeDebugRecording({
        header: {
          machineId: "zxnext",
          kliveVersion: "test",
          coreId: "zxnext",
          fingerprint: parts.fingerprint,
          codeHash: "",
          contractHash: "",
          memorySize: parts.memorySize,
          pageSize: KEYFRAME_PAGE_SIZE,
          savedAt: "",
          base: snapshot.keyframes[0].seed.position,
          present: snapshot.present.position,
          frames: 0,
          seconds: 0,
          records: 0,
          keyframes: snapshot.keyframes.length,
          sparse: false,
          pc: 0
        },
        ...snapshotToRecordingParts(snapshot),
        media: []
      });

      // --- A Next with no card at all
      const fresh = (await createCore({ hardReset: true })) as unknown as TimelineMachine & AnyWasmMachine;
      fresh.loadMachineState(parts);
      const opened = Timeline.fromSnapshot(fresh, recordingToSnapshot(await readDebugRecording(bytes)), { budgetBytes: 512 * 1048576 }, { image: parts.image });
      expect(opened.position).toEqual(timeline.position);
      expect(stateHash(fresh, "zxnext")).toBe(stateHash(machine, "zxnext"));
      // --- The whole run from its first keyframe, SD reads answered by the journal
      opened.verify();
      expect(opened.isEnded).toBe(false);
      // --- Past the end the machine runs on live, without a card
      for (let f = 0; f < 50; f++) {
        do (fresh as any).executeMachineFrame();
        while (!(fresh as any).frameJustCompleted);
        opened.afterFrame(true);
      }
      expect(opened.position.sequence).toBeGreaterThan(timeline.position.sequence);
      opened.end();
      timeline.end();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 900_000);
});
