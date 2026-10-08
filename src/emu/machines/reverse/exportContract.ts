/*
 * The export contract (`.plans/REVERSE_DEBUGGING_PLAN.md` D7, Phase 1).
 *
 * Replay is exact only if every way the host changes a core is in the input journal. Every export of
 * every WASM core therefore has a class:
 *
 * - `pure`: reads state, changes nothing in the core's image;
 * - `debug`: changes only *volatile* statics - breakpoints, watches, the history recorder, the trace,
 *   the layer debug view, RZX buffers - which a keyframe leaves out and replay does not need;
 * - `execution`: runs the machine (the frame loop and the single-instruction step); replay calls them
 *   itself;
 * - `journaled`: changes machine state; every call is recorded with its position and replayed there.
 *
 * `pure` and `debug` are claims a test checks: `test/wasm/reverse/export-contract.test.ts` calls every
 * such export of every core and requires the image to be unchanged. An export the rules below do not
 * classify fails that test, so a new input path cannot silently break replay: classify it here.
 *
 * Whether a journaled call *ends* the timeline (a user reset, a snapshot load: D2) is the
 * controller's policy, not the export's class - the same `HardReset` is a journaled input when the
 * program requests it through NextReg $02 (T11).
 */

export type ExportClass = "pure" | "debug" | "execution" | "journaled";

/** The cores and the prefixes of their own exports */
export const CORE_EXPORT_PREFIXES: Record<string, readonly string[]> = {
  sp48: ["sp48"],
  timex: ["timex", "sp48"],
  sp128: ["sp128"],
  spp3e: ["spp3e"],
  zxnext: ["zxnext"],
  z88: ["z88"],
  zx8081: ["zx8081"]
};

/** Exports shared by every Z80 core, by exact name prefix */
const SHARED: [RegExp, ExportClass][] = [
  // --- The execution-history recorder: volatile ring, header and stop target
  [/^z80History/, "debug"],
  // --- The breakpoint condition evaluator: volatile arena, slots and environment
  [/^cond/, "debug"]
];

/**
 * Exceptions to the rules, by name without the core prefix. An entry here says the rule's guess is
 * wrong for this export; the comment says why.
 */
const OVERRIDES: Record<string, ExportClass> = {
  // --- Getters that change state: reading consumes or latches something
  TakeResetRequest: "journaled", // clears the NextReg $02 request (non-volatile)
  // --- The debug loop begins its frames through this; the fast path does the same itself (T17)
  BeginAudioFrame: "execution",
  // --- RZX: the play and record buffers and the mode are volatile (an RZX load ends the timeline, D2) ...
  RzxSetMode: "debug",
  RzxSetPlayFrame: "debug",
  RzxClearRec: "debug",
  RzxRecMarkBlockStart: "debug",
  // --- ... but these move the machine's own tact counter
  RzxSetFrameTact: "journaled",
  // --- The layer debug view and the beam preview write only their volatile buffers
  ProbePixel: "debug",
  RecomposeForDebug: "debug",
  RenderLayerComposite: "debug",
  RenderPreviewToBeam: "debug",
  ResolveSpritesForIde: "debug",
  ComposeLayer2Sample: "debug",
  SetLayerDebug: "debug",
  SetLayerCapture: "debug",
  SetCopperWatchMode: "debug",
  ClearNextRegWatch: "debug",
  TakeNextRegHit: "debug",
  TakeCopperHit: "debug",
  TakeAutoRunHit: "debug",
  // --- The ZX81 auto-RUN watch lives in a non-volatile static
  ArmAutoRun: "journaled",
  // --- Reads that look like reads but have device side effects (status latches, FIFOs, counters)
  ReadPort: "journaled",
  ReadPsgRegisterValue: "pure",
  DmaReadStatusByte: "journaled",
  CopperRead: "pure",
  SpriteReadPort303b: "journaled",
  JoystickReadPort1f: "pure",
  JoystickReadPort37: "pure",
  // --- The Next's mouse reads count themselves; the UART peer and the beeper sample getters bring
  // --- their device up to the current tact (test-only exports, but they change the image)
  MouseReadPortFadf: "journaled",
  MouseReadPortFbdf: "journaled",
  MouseReadPortFfdf: "journaled",
  UartPeerReadyToReceive: "journaled",
  UartPeerOutputCount: "journaled",
  GetBeeperSampleLeftMilli: "journaled",
  GetBeeperSampleRightMilli: "journaled",
  I2cReadSclPort: "pure",
  I2cReadSdaPort: "pure",
  DiskReadData: "pure",
  // --- Plain getters the verb rules cannot see
  ArenaCapacity: "pure",
  SlotCapacity: "pure",
  MaxProgramWords: "pure",
  BusEventFieldsSize: "pure",
  ChecksumPhysicalMemory: "pure",
  ExpansionEffectivePortEnable: "pure",
  ExpansionShouldPropagateIo: "pure",
  MousePortReadCount: "pure",
  Peek: "pure"
};

/** Exceptions that hold for one core only */
const CORE_OVERRIDES: Record<string, Record<string, ExportClass>> = {
  z88: {
    // --- The serial output buffer is volatile (host-side capture the guest never reads)
    ClearUartTx: "debug"
  },
  spp3e: {
    // --- The CPU's and the ULA's reads latch the floating-bus value; the host reads with the
    // --- side-effect-free `spp3ePeekMemory` / `spp3ePeekScreenMemoryOffset`
    ReadMemory: "journaled",
    ReadScreenMemoryOffset: "journaled",
    // --- Brings the PSG up to the current tact first (test-only)
    GetPsgCurrentOutput: "journaled"
  }
};

/** Runs the machine */
const EXECUTION = /^(ExecuteFrame|ExecuteInstruction|ExecuteUntilStop)$/;

/** Reads state */
const PURE =
  /^([A-Z][a-z0-9]*)?(Get|Is|Has|Peek)([A-Z0-9]|$)|Ptr$|Capacity$|^Read(Memory|PhysicalMemory|RamBank|RomBank|ScreenMemoryOffset|FloatingBus)$/;

/** Volatile debugging state */
const DEBUG = /^(Trace)/;

/**
 * Changes machine state. The verbs and device nouns are listed, not matched loosely, so an export
 * with a new verb is unclassified and the contract test asks for a decision.
 */
const JOURNALED = new RegExp(
  "^(" +
    [
      // --- Verbs
      "Set",
      "Write",
      "Upload",
      "Insert",
      "Remove",
      "Eject",
      "Clear",
      "Reset",
      "HardReset",
      "Press",
      "Raise",
      "Signal",
      "Delay",
      "Advance",
      "Append",
      "Generate",
      "Prepare",
      "Process",
      "Render",
      "Draw",
      "Configure",
      // --- Devices whose exports (other than Get/Is/Has) change the device
      "Tape",
      "Disk",
      "Beta",
      "Fdc",
      "Dock",
      "DivMmc",
      "Dma",
      "Sprite",
      "UartPeer",
      "I2c",
      "Mouse",
      "Joystick",
      "Expansion",
      "Rtc",
      "Ctc",
      "Copper",
      // --- Test-only hooks that move clocks
      "Test"
    ].join("|") +
    ")([A-Z0-9]|$)"
);

/** An export's name without its core's prefix, or undefined when it has none of them */
export function stripCorePrefix(coreId: string, name: string): string | undefined {
  for (const prefix of CORE_EXPORT_PREFIXES[coreId] ?? []) {
    if (name.startsWith(prefix) && name.length > prefix.length && /[A-Z]/.test(name[prefix.length])) {
      return name.slice(prefix.length);
    }
  }
  return undefined;
}

/**
 * The class of a core's export
 * @returns undefined for an export the contract does not classify (a contract-test failure)
 */
export function classifyExport(coreId: string, name: string): ExportClass | undefined {
  if (name === "memory") return "pure";
  for (const [pattern, cls] of SHARED) if (pattern.test(name)) return cls;
  const rest = stripCorePrefix(coreId, name);
  if (rest === undefined) return undefined;
  const override = CORE_OVERRIDES[coreId]?.[rest] ?? OVERRIDES[rest];
  if (override) return override;
  if (EXECUTION.test(rest)) return "execution";
  if (DEBUG.test(rest)) return "debug";
  if (PURE.test(rest)) return "pure";
  if (JOURNALED.test(rest)) return "journaled";
  return undefined;
}

/** The exports of a list the contract leaves unclassified */
export function unclassifiedExports(coreId: string, names: readonly string[]): string[] {
  return names.filter((n) => classifyExport(coreId, n) === undefined);
}

/**
 * A core's journaled exports, sorted: a debug recording's journal names them, so two builds whose
 * lists differ cannot replay each other's recordings (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D3, T2)
 * @param names The module's export names (`WebAssembly.Module.exports`)
 */
export function journaledExportNames(coreId: string, names: readonly string[]): string[] {
  return names.filter((name) => classifyExport(coreId, name) === "journaled").sort();
}
