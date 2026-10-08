/*
 * Saves and opens debug recordings (`.klr`): the orchestration of
 * `.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.4.
 *
 * Save:
 *  1. Recordings come from reverse debugging: the machine needs a live timeline (D17).
 *  2. A running machine is paused for the capture and runs on afterwards; the timeline's pages are
 *     taken by reference, so nothing is copied while the machine stands still (T10).
 *  3. The timeline, the `.kls` of its present (D16), the breakpoints (D11), the media (D14, D15), the
 *     sources' identity (D13) and the build's identity (D3) go into the file.
 *
 * Open:
 *  1. The machine is fitted to the recording's type, model and configuration, as for a `.kls`.
 *  2. The build must be the one that wrote it (D3); otherwise the end state alone may be opened (D16).
 *  3. The recording's breakpoints become session breakpoints (D11), the present's state goes in, the
 *     timeline is rebuilt around it - its replay arriving exactly at that state - and the machine
 *     stands paused where the recording was saved, or at its start (D10).
 */

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import type {
  DebugRecordingLoadOptions,
  DebugRecordingLoadResult,
  DebugRecordingSaveOptions,
  DebugRecordingSaveResult
} from "@common/debugRecording/debugRecordingTypes";
import type { DebugRecording, DeflateLevel, RecordingMedia } from "@common/debugRecording/debugRecordingFile";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { resolveModelId } from "@common/machines/machine-registry";
import {
  readDebugRecording,
  sha256Hex,
  writeDebugRecording
} from "@common/debugRecording/debugRecordingFile";
import { readKliveStateFile, writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { withoutBreakpointRuntimeState } from "@common/utils/breakpoint-filters";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";
import { KEYFRAME_PAGE_SIZE } from "@emu/machines/reverse/KeyframeStore";
import { journaledExportNames } from "@emu/machines/reverse/exportContract";
import {
  recordingToSnapshot,
  rekeyTimelineSnapshot,
  snapshotBase,
  snapshotToRecordingParts
} from "@emu/machines/reverse/timelineRecording";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";
import {
  captureKliveStateFile,
  configDiffers,
  coreIdOfMachine,
  loadMachineStateFile,
  machineDisplayName,
  stateMachineOf,
  type MachineStatePorts
} from "./machineStateFile";

/** The breakpoint schema a recording's BRKP section holds (D11) */
export const RECORDING_BREAKPOINT_SCHEMA = 1;

/** A `-sparse` recording keeps keyframes about this many frames apart (D7: about a second) */
export const SPARSE_KEYFRAME_FRAMES = 50;

/** The largest recording Klive writes or reads: the whole file passes through memory and IPC (T9) */
export const MAX_RECORDING_BYTES = 2 * 1024 ** 3 - 1;

/** What the flow needs of the machine beyond a state machine */
type RecordingMachine = {
  machineId: string;
  pc: number;
  baseClockFrequency?: number;
  tactsInFrame?: number;
  frameTactMultiplier?: number;
  wasmV2Runtime?: { module?: WebAssembly.Module };
};

/** Seconds of machine time per frame */
function secondsPerFrame(m: RecordingMachine): number {
  const clock = m.baseClockFrequency ?? 0;
  const tacts = m.tactsInFrame ?? 0;
  return clock > 0 && tacts > 0 ? tacts / (m.frameTactMultiplier || 1) / clock : 0.02;
}

/** The build identity a recording carries (D3) */
export async function coreIdentity(
  coreId: string,
  module: WebAssembly.Module | undefined
): Promise<{ fingerprint: string; codeHash: string; contractHash: string; memorySize: number }> {
  const layout = readWasmLayout(module);
  if (!layout) throw new Error(`The ${coreId} core has no layout stamp`);
  if (!layout.codeHash) throw new Error(`The ${coreId} core was built without a code hash; rebuild it`);
  const names = WebAssembly.Module.exports(module!).map((e) => e.name);
  const contractHash = await sha256Hex(new TextEncoder().encode(journaledExportNames(coreId, names).join("\n")));
  return { fingerprint: layout.fingerprint, codeHash: layout.codeHash, contractHash, memorySize: layout.memorySize };
}

/**
 * Why this build cannot replay a recording (D3), or undefined when it can
 * @param header The recording's identity
 * @param live The running core's identity
 */
export function recordingMismatch(
  header: { kliveVersion: string; coreId: string; fingerprint: string; codeHash: string; contractHash: string; memorySize: number },
  coreId: string,
  live: { fingerprint: string; codeHash: string; contractHash: string; memorySize: number },
  kliveVersion: string
): string | undefined {
  const build = `recorded by Klive ${header.kliveVersion} (build ${header.codeHash.slice(0, 8)})`;
  if (header.coreId !== coreId) return `The recording belongs to the ${header.coreId} core, not the ${coreId} core`;
  if (header.fingerprint !== live.fingerprint || header.memorySize !== live.memorySize) {
    return `The recording was ${build}; this build's ${coreId} core has another memory layout`;
  }
  if (header.contractHash !== live.contractHash) {
    return `The recording was ${build}; this build's ${coreId} core takes its inputs through other exports`;
  }
  if (header.codeHash !== live.codeHash) {
    return `The recording was ${build}; this build (Klive ${kliveVersion}, build ${live.codeHash.slice(0, 8)}) differs`;
  }
  return undefined;
}

/** The breakpoints a recording keeps: every owner's, without runtime state or run-to targets (D11) */
function recordedBreakpoints(defs: Iterable<BreakpointInfo>): BreakpointInfo[] {
  return [...defs].filter((bp) => !bp.runTo).map((bp) => withoutBreakpointRuntimeState({ ...bp }));
}

/**
 * Saves the machine's reverse-debugging timeline as a debug recording
 * @param ports The services the save uses
 * @param options What to save, and the IDE's part (version, watches, sources, SD card)
 */
export async function saveDebugRecording(
  ports: MachineStatePorts,
  options: DebugRecordingSaveOptions
): Promise<DebugRecordingSaveResult> {
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller) as (ReturnType<typeof stateMachineOf> & RecordingMachine) | undefined;
  if (!controller || !machine) throw new Error("This machine cannot save a debug recording");
  const state = controller.state;
  if (state !== MachineControllerState.Running && state !== MachineControllerState.Paused) {
    throw new Error("Start the machine with debugging; recordings come from reverse debugging");
  }
  if (!controller.timeline) {
    throw new Error("Start the machine with debugging; recordings come from reverse debugging");
  }
  const coreId = coreIdOfMachine(machine.machineId);
  const identity = await coreIdentity(coreId, machine.wasmV2Runtime?.module);

  const running = state === MachineControllerState.Running;
  const debugging = controller.isDebugging;
  const warnings: string[] = [];
  let parts: ReturnType<typeof snapshotToRecordingParts>;
  let snapshotBasePosition: TimelinePosition;
  let presentPosition: TimelinePosition;
  let cursor: TimelinePosition | undefined;
  let sparse = false;
  let kls: ReturnType<typeof captureKliveStateFile>;
  let breakpoints: BreakpointInfo[];
  let from: TimelinePosition | undefined;
  if (running) await controller.pause();
  try {
    const timeline = controller.timeline;
    if (!timeline) throw new Error("The reverse-debugging timeline ended");
    from = fromPosition(options.from, timeline.presentPosition.sequence);
    const snapshot = timeline.exportSnapshot({
      from,
      sparseFrames: options.sparse ? SPARSE_KEYFRAME_FRAMES : undefined
    });
    // --- The .kls of the present, which the load starts from (D16)
    kls = timeline.withPresent(() =>
      captureKliveStateFile(ports, machine, { kliveVersion: options.kliveVersion, sdCard: options.sdCard ? { ...options.sdCard, id: MEDIA_SD_CARD } : undefined })
    );
    parts = snapshotToRecordingParts(snapshot);
    snapshotBasePosition = snapshotBase(snapshot);
    presentPosition = snapshot.present.position;
    cursor = snapshot.cursor;
    sparse = snapshot.sparse;
    breakpoints = recordedBreakpoints(controller.debugSupport?.breakpointDefs.values() ?? []);
    // --- What is saved is no longer an unsaved extension (Q7)
    if (timeline.recording) timeline.recording = { ...timeline.recording, savedPresent: presentPosition };
  } finally {
    if (running) {
      if (debugging) await controller.startDebug();
      else await controller.start();
    }
  }
  warnings.push(...kls.warnings);

  const emulator = ports.getEmulatorState();
  const frames = parts.present.frames - parts.keyframes[0].frame;
  const seconds = frames * secondsPerFrame(machine);
  const mediaFiles = ports.getMediaFiles();
  const media: RecordingMedia[] = [
    ...[MEDIA_TAPE, MEDIA_DISK_A, MEDIA_DISK_B]
      .filter((id) => mediaFiles[id])
      .map((id) => ({ id, fileName: mediaFiles[id], kind: id === MEDIA_TAPE ? "tape" : "disk" })),
    ...(options.sdCard ? [{ ...options.sdCard, id: MEDIA_SD_CARD, kind: "sd" }] : [])
  ];
  const note = options.note?.trim() || undefined;
  const recording: DebugRecording = {
    header: {
      machineId: machine.machineId,
      modelId: emulator.modelId,
      config: emulator.config as Record<string, unknown> | undefined,
      machineName: kls.machineName,
      kliveVersion: options.kliveVersion,
      coreId,
      ...identity,
      pageSize: KEYFRAME_PAGE_SIZE,
      savedAt: new Date().toISOString(),
      description: note?.split(/\r?\n/)[0],
      base: snapshotBasePosition,
      present: presentPosition,
      cursor,
      frames: round(frames, 3),
      seconds: round(seconds, 3),
      records: presentPosition.sequence - snapshotBasePosition.sequence,
      keyframes: parts.keyframes.length,
      sparse,
      from,
      pc: kls.file.header.pc
    },
    thumbnail: kls.file.thumbnail,
    ...parts,
    breakpoints: { schemaVersion: RECORDING_BREAKPOINT_SCHEMA, breakpoints, watches: options.watches },
    media,
    sources: options.sources,
    kls: writeKliveStateFile(kls.file),
    note
  };
  const level = Math.max(1, Math.min(9, Math.round(options.level ?? 6))) as DeflateLevel;
  const bytes = await writeDebugRecording(recording, level);
  if (bytes.length > MAX_RECORDING_BYTES) {
    throw new Error(
      `The recording would be ${(bytes.length / 1024 ** 3).toFixed(1)} GB, more than Klive can write; save less of it with -from or -sparse`
    );
  }
  const sectionSizes = sectionSizesOf(bytes);
  return {
    bytes,
    machineName: kls.machineName,
    records: recording.header.records,
    frames: recording.header.frames,
    seconds: recording.header.seconds,
    keyframes: recording.header.keyframes,
    sectionSizes,
    fromPast: !!cursor,
    warnings
  };
}

/** A `-from` as a position: just before the record it names, so the last keyframe at or before it (D8) */
function fromPosition(from: DebugRecordingSaveOptions["from"], newest: number): TimelinePosition | undefined {
  if (!from) return undefined;
  const sequence = "sequence" in from ? from.sequence : newest - from.stepsBack + 1;
  return { sequence: Math.max(0, sequence - 1), sub: Number.MAX_SAFE_INTEGER, phase: 0 };
}

function round(value: number, digits: number): number {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

/** The section sizes of a written recording (for the output and the measurements) */
function sectionSizesOf(bytes: Uint8Array): Record<string, number> {
  const sizes: Record<string, number> = {};
  const dword = (o: number) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  let offset = 16 + dword(12);
  while (offset + 8 <= bytes.length) {
    const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4)).trim();
    const length = dword(offset + 4);
    sizes[tag] = length;
    offset += 8 + length;
  }
  return sizes;
}

/**
 * Opens a debug recording
 * @param ports The services the load uses
 * @param fileName The file's name, for messages
 * @param bytes The file
 * @param kliveVersion This Klive's version (D3's message)
 * @param options Where to land, `-verify`, `-nobreakpoints`, the D16 fallback, the live SD card
 */
export async function loadDebugRecording(
  ports: MachineStatePorts,
  fileName: string,
  bytes: Uint8Array,
  kliveVersion: string,
  options: DebugRecordingLoadOptions = {}
): Promise<DebugRecordingLoadResult> {
  if (bytes.length > MAX_RECORDING_BYTES) throw new Error("The recording is larger than Klive can read (2 GB)");
  const recording = await readDebugRecording(bytes);
  const header = recording.header;
  const warnings: string[] = [];
  const machineName = header.machineName ?? machineDisplayName(header.machineId, header.modelId);
  const base = { machineId: header.machineId, modelId: header.modelId, machineName, pc: header.pc, warnings };

  // --- 1. Fit the machine: type, model and configuration, exactly as recorded
  const emulator = ports.getEmulatorState();
  let rebuilt = false;
  if (
    emulator.machineId !== header.machineId ||
    resolveModelId(header.machineId, emulator.modelId) !== resolveModelId(header.machineId, header.modelId) ||
    configDiffers(emulator.config, header.config)
  ) {
    const done = await ports.setMachineType(header.machineId, header.modelId, (header.config ?? {}) as MachineConfigSet);
    if (!done) throw new Error("Another machine change superseded opening the recording");
    rebuilt = true;
  }
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller) as (ReturnType<typeof stateMachineOf> & RecordingMachine) | undefined;
  if (!controller || !machine || machine.machineId !== header.machineId) {
    throw new Error(`The emulator is not running the ${machineName}`);
  }
  if (!controller.openTimeline) throw new Error(`The ${machineName} has no reverse debugging`);

  // --- 2. Same build only (D3); the end state is the fallback (D16)
  const coreId = coreIdOfMachine(header.machineId);
  const live = await coreIdentity(coreId, machine.wasmV2Runtime?.module);
  const refusal = recordingMismatch(header, coreId, live, kliveVersion);
  if (refusal) {
    if (!options.acceptFallback || !recording.kls) {
      return { ...base, rebuilt, path: "refused", refusal: recording.kls ? refusal : `${refusal}, and it holds no end state` };
    }
    const state = await loadMachineStateFile(ports, `${fileName}.kls`, recording.kls, "debug", {
      currentSdCard: options.currentSdCard ? { ...options.currentSdCard, id: MEDIA_SD_CARD } : undefined,
      acceptChangedSdCard: true
    });
    return {
      ...base,
      pc: state.pc,
      rebuilt: rebuilt || state.rebuilt,
      path: "state",
      refusal,
      warnings: [...warnings, ...state.warnings]
    };
  }
  if (!recording.kls) throw new Error("The recording holds no state of its present (KLS section)");
  const klsFile = readKliveStateFile(recording.kls);
  const parts: MachineStateParts = {
    coreId: klsFile.header.coreId,
    fingerprint: klsFile.header.fingerprint,
    memorySize: klsFile.header.memorySize,
    image: klsFile.image,
    host: klsFile.host
  };

  // --- 3. The breakpoints, as session breakpoints (D11): their keys may change (T5)
  const debugSupport = controller.debugSupport;
  const keyMap = new Map<string, string>();
  let breakpointsAdded = 0;
  if (!options.noBreakpoints && debugSupport) {
    for (const raw of (recording.breakpoints?.breakpoints ?? []) as BreakpointInfo[]) {
      const bp = withoutBreakpointRuntimeState({ ...raw, owner: { kind: "session" } });
      const oldKey = getBreakpointStorageKey(raw);
      const newKey = getBreakpointStorageKey(bp);
      keyMap.set(oldKey, newKey);
      if (debugSupport.breakpointDefs.has(newKey)) continue;
      if (debugSupport.addBreakpoint(bp)) breakpointsAdded++;
    }
  }
  const snapshot = rekeyTimelineSnapshot(recordingToSnapshot(recording), (key) => keyMap.get(key));

  // --- 4. The present's state, the timeline around it, and the landing (D10)
  const landing = options.land ?? "saved";
  const land =
    landing === "start" ? snapshot.keyframes[0].seed.position : landing === "saved" ? snapshot.cursor : undefined;
  await controller.openTimeline(() => machine.loadMachineState(parts), snapshot, {
    land,
    description: `Debug recording ${fileName} opened`,
    expectedImage: parts.image,
    recordingName: fileName.split(/[\\/]/).pop()
  });
  const timeline = controller.timeline;
  if (!timeline) throw new Error("The recording's timeline did not start");
  if (timeline.store.stats.poolBytes > timeline.store.budgetBytes) {
    warnings.push(
      "The recording is larger than the reverse-debugging memory budget: its oldest keyframes go as the machine runs on"
    );
  }

  // --- 5. -verify: one replay from the start, checking every keyframe (D9)
  let verified: DebugRecordingLoadResult["verified"];
  if (options.verify) {
    if (timeline.mode !== "live") {
      warnings.push("-verify checks a recording opened at its present; it was opened in the past and not checked");
    } else {
      const t0 = performance.now();
      timeline.verify();
      verified = { keyframes: timeline.store.keyframes.filter((k) => !k.transient).length, ms: Math.round(performance.now() - t0) };
    }
  }

  // --- 6. Media: in the recording, never written back (D14, D15)
  for (const m of recording.media) {
    if (m.id === MEDIA_TAPE) warnings.push(`The tape is the one in the recording (${m.fileName})`);
    if (m.id === MEDIA_DISK_A || m.id === MEDIA_DISK_B) {
      warnings.push(
        `Disk ${m.id === MEDIA_DISK_A ? "A" : "B"} is the one in the recording (${m.fileName}); it is detached from that file, so replaying never writes to it`
      );
    }
    if (m.id === MEDIA_SD_CARD) {
      const current = options.currentSdCard;
      warnings.push(
        current?.fingerprint && current.fingerprint === m.fingerprint
          ? `The SD card (${m.fileName}) is the one the recording was made with: running on past its end uses it`
          : `Every SD card sector the recording read is in it, so it replays without the card; running on past its end uses ${
              current ? `the current card (${current.fileName}), which is not the recorded one (${m.fileName})` : "no card"
            }`
      );
    }
  }
  if (header.sparse) warnings.push("The recording keeps only keyframes about a second apart: the first step back into a stretch replays longer");

  const landed = landing === "start" ? "start" : landing === "saved" && snapshot.cursor ? "saved" : "present";
  return {
    ...base,
    pc: machine.pc,
    rebuilt,
    path: "timeline",
    landed,
    records: header.records,
    keyframes: header.keyframes,
    seconds: header.seconds,
    breakpointsAdded,
    watches: options.noBreakpoints ? undefined : recording.breakpoints?.watches,
    sources: recording.sources,
    verified,
    warnings
  };
}
