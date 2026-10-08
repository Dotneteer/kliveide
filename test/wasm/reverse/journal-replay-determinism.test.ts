/*
 * The journal-replay determinism test (`.plans/REVERSE_DEBUGGING_PLAN.md` T12, Phase 0 (d)), on the
 * 48K and the Next. It is the gate a core passes before it gets reverse debugging (D19).
 *
 *   1. Machine A runs a scripted workload with randomly timed inputs - keys and, through the
 *      machine's own API, memory edits, the clock multiplier and a tape upload (48K), joysticks, the
 *      mouse and NextReg writes (Next) - at frame boundaries and in the middle of frames, recording
 *      history, the contract-driven journal and keyframes every few frames.
 *   2. Machine B, a separate instance, restores a random keyframe of A and replays A's journal to a
 *      random later position.
 *   3. Machine C, also separate, runs A's script straight from the start and stops at the same
 *      position.
 *   4. B and C must be equal: the whole image (CPU registers included) and the position.
 *
 * Each script runs twice: on the fast frame path (`...ExecuteFrame`, the run mode) and on the
 * TypeScript debug loop (what a debug session runs); replay always uses the fast path. Every
 * keyframe interval is also replayed and compared with the next keyframe (D9's verification).
 */
import { describe, expect, it } from "vitest";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { comparePositions, positionAfter, type TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import { KeyframeStore } from "@emu/machines/reverse/KeyframeStore";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { createSp48Session } from "../../harness/sp48";
import { createSession as createNextSession } from "../../harness/zxnext";
import { createSp128Session, type Sp128SessionModel } from "../../harness/sp128";
import { MEDIA_DISK_A } from "@common/structs/project-const";
import { createZ88Session } from "../../harness/z88";
import { createTimexSession } from "../../harness/timex";
import { createZx81Session } from "../../harness/zx81";
import { ZX8081_KEY } from "@emu/machines/zx8081/Zx8081KeyCode";
import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";
import { ReverseRig, seededRandom, type SpikeCoreId } from "../../harness/reverseSupport";
import { expectSameBytes } from "../../expectBytes";

/** One step of a workload script */
type Action =
  | { kind: "frames"; count: number }
  | { kind: "key"; key: string; down: boolean }
  /** A core-specific input other than a key (the driver interprets the number) */
  | { kind: "input"; n: number }
  | { kind: "pause"; records: number };

type RunMode = "fast" | "debug";

/** A machine under the script, whatever its type */
type Driver = {
  rig: ReverseRig;
  executeFrame(): FrameTerminationMode;
  key(key: string, down: boolean): void;
  /** Feeds a core-specific input: pokes, the clock multiplier, tape, joysticks, mouse, NextRegs */
  input(n: number): void;
  setStepMode(mode: DebugStepMode): void;
  saveState(): MachineStateParts;
  loadState(parts: MachineStateParts): void;
};

/** A random script: frames, key presses and releases, other inputs, mid-frame pauses */
function makeScript(seed: number, keys: string[], length: number, maxPause: number): Action[] {
  const rnd = seededRandom(seed);
  const held = new Set<string>();
  const out: Action[] = [];
  for (let i = 0; i < length; i++) {
    const r = rnd();
    if (r < 0.4) out.push({ kind: "frames", count: 1 + Math.floor(rnd() * 4) });
    else if (r < 0.55) out.push({ kind: "input", n: Math.floor(rnd() * 0x10000) });
    else if (r < 0.8) {
      const key = keys[Math.floor(rnd() * keys.length)];
      const down = !held.has(key);
      if (down) held.add(key);
      else held.delete(key);
      out.push({ kind: "key", key, down });
    } else out.push({ kind: "pause", records: 1 + Math.floor(rnd() * maxPause) });
  }
  for (const key of held) out.push({ kind: "key", key, down: false });
  out.push({ kind: "frames", count: 2 });
  return out;
}

/**
 * Runs one action. A pause stops mid-frame after a number of records: on the fast path with the
 * core's stop target, in the debug loop by single steps.
 */
function runAction(d: Driver, mode: RunMode, a: Action): void {
  switch (a.kind) {
    case "key":
      d.key(a.key, a.down);
      return;
    case "input":
      d.input(a.n);
      return;
    case "frames":
      for (let n = 0; n < a.count; n++) {
        // --- A mid-frame pause leaves a frame to finish first: run until the core completes one
        do d.executeFrame();
        while (!d.rig.atFrameBoundary);
      }
      return;
    case "pause":
      if (mode === "fast") {
        const target = positionAfter(d.rig.port.position, a.records);
        d.rig.port.setTarget(target);
        try {
          while (!d.rig.port.targetReached) d.executeFrame();
        } finally {
          d.rig.port.clearTarget();
        }
      } else {
        d.setStepMode(DebugStepMode.StepInto);
        try {
          const target = positionAfter(d.rig.port.position, a.records);
          while (comparePositions(d.rig.port.position, target) < 0) d.executeFrame();
        } finally {
          d.setStepMode(DebugStepMode.StopAtBreakpoint);
        }
      }
      return;
  }
}

type MachineFactory = () => Promise<Driver>;

const FLOAT_SPY_BLOCKS = (() => {
  const reader = new TapReader(new BinaryReader(new Uint8Array(readFileSync(join(__dirname, "../../testfiles/floatspy.tap")))));
  reader.readContent();
  return reader.dataBlocks;
})();

const KEYFRAME_INTERVAL = 3;

async function proveJournalReplay(make: MachineFactory, keys: string[], mode: RunMode, seed: number): Promise<void> {
  // --- The debug loop runs every instruction through TypeScript: a shorter script
  const script = mode === "fast" ? makeScript(seed, keys, 90, 3000) : makeScript(seed, keys, 36, 600);

  // --- 1. Machine A: the recorded run
  const a = await make();
  // --- C starts from A's state, not its own boot: the Next's RTC reads the host clock at setup
  const initial = a.saveState();
  a.setStepMode(mode === "debug" ? DebugStepMode.StopAtBreakpoint : DebugStepMode.NoDebug);
  a.rig.port.setEnabled(true);
  const store = a.rig.createStore(256 * 1024 * 1024);
  const after: TimelinePosition[] = [];
  let framesSinceKeyframe = KEYFRAME_INTERVAL;
  for (const action of script) {
    runAction(a, mode, action);
    if (action.kind === "frames") framesSinceKeyframe += action.count;
    if (framesSinceKeyframe >= KEYFRAME_INTERVAL && a.rig.atFrameBoundary) {
      store.capture(a.rig.memory.buffer, a.rig.port.captureSeed(), a.rig.frames, a.rig.journal.length);
      framesSinceKeyframe = 0;
    }
    after.push(a.rig.port.position);
  }
  const keyframes = store.keyframes;
  expect(keyframes.length).toBeGreaterThan(mode === "fast" ? 5 : 3);
  expect(a.rig.journal.length).toBeGreaterThan(mode === "fast" ? 10 : 3);
  const end = after[after.length - 1];

  // --- 2./3./4. Random targets: B replays, C runs straight
  const b = await make();
  b.rig.port.setEnabled(true);
  const engine = b.rig.createEngine(store, a.rig.journal);
  const rnd = seededRandom(seed * 7919 + 1);
  for (let t = 0; t < 4; t++) {
    const kf = keyframes[Math.floor(rnd() * (keyframes.length - 1))];
    const span = end.sequence - kf.seed.position.sequence;
    const target: TimelinePosition = { sequence: kf.seed.position.sequence + 1 + Math.floor(rnd() * span), sub: 1, phase: 0 };
    // --- Not exactly where an action ended: there the 48K's key sync of the next action is pending
    if (after.some((p) => comparePositions(p, target) === 0)) target.sequence++;
    engine.replayTo(target, { from: kf });
    expect(comparePositions(b.rig.port.position, target)).toBeGreaterThanOrEqual(0);

    const c = await make();
    c.loadState(initial);
    c.setStepMode(mode === "debug" ? DebugStepMode.StopAtBreakpoint : DebugStepMode.NoDebug);
    c.rig.port.setEnabled(true);
    let i = 0;
    while (i < script.length && comparePositions(after[i], target) <= 0) runAction(c, mode, script[i++]);
    // --- The rest through the machine's own fast path, which does its frame-entry work (the 48K
    // --- pushes pending key changes there), stopped by the core's target
    c.setStepMode(DebugStepMode.NoDebug);
    c.rig.port.setTarget(target);
    while (!c.rig.port.targetReached) c.executeFrame();
    c.rig.port.clearTarget();

    expect(b.rig.port.position, `seed ${seed}, target ${target.sequence}`).toEqual(c.rig.port.position);
    // --- After a debug-loop run the CPU's bus-event fields hold what the debugger observed (T15)
    const mask = mode === "debug";
    expectSameBytes(b.rig.image(mask), c.rig.image(mask), `the images (seed ${seed}, target ${target.sequence})`);
    c.rig.dispose();
  }

  // --- D9: every keyframe interval replays into the next keyframe exactly
  for (let k = 0; k + 1 < keyframes.length; k++) {
    const ignore = mode === "debug" ? [b.rig.busEventFields] : [];
    const { diffPages } = engine.verifyInterval(keyframes[k], keyframes[k + 1], ignore);
    expect(diffPages, `interval ${k} (seed ${seed})`).toEqual([]);
  }
  a.rig.dispose();
  b.rig.dispose();
}

/** The 48K at the BASIC editor: the ROM reads the keyboard every interrupt and edits a line */
async function sp48Machine(): Promise<Driver> {
  const s = await createSp48Session();
  s.bootToBasic();
  return {
    rig: new ReverseRig("sp48", s.machine),
    executeFrame: () => s.machine.executeMachineFrame(),
    key: (key, down) => (down ? s.keyDown(key) : s.keyUp(key)),
    input: (n) => {
      switch (n & 3) {
        case 0:
        case 3:
          // --- A memory edit (the Memory panel's path)
          s.poke(0xc100 + ((n >> 2) & 0xff), n >> 8);
          return;
        case 1:
          // --- The clock multiplier, pushed at the next frame's entry
          s.machine.targetClockMultiplier = s.machine.targetClockMultiplier === 1 ? 2 : 1;
          return;
        case 2:
          // --- A tape: its blocks go into the core's tape buffer
          s.insertTape(FLOAT_SPY_BLOCKS);
          return;
      }
    },
    setStepMode: (mode) => (s.machine.executionContext.debugStepMode = mode),
    saveState: () => s.machine.saveMachineState(),
    loadState: (parts) => s.machine.loadMachineState(parts)
  };
}

/*
 * The Next: an IM 2 program that HALTs every frame (so positions fall inside coalesced HALT records),
 * reads the whole keyboard and writes what it read through banked memory, and counts interrupts on
 * the border.
 */
async function nextMachine(): Promise<Driver> {
  const s = await createNextSession();
  await s.loadCode(`
      .org $8000
start:
      ld a,$90
      ld i,a
      im 2
      ei
loop:
      halt
      ; --- A beeper burst: transitions still pending at a frame's end carry over into the next
      ld b,40
burst:
      ld a,b
      and $10
      out ($fe),a
      djnz burst
      ld bc,$00fe
      in a,(c)
      ld hl,($a000)
      ld (hl),a
      inc hl
      ld a,h
      and $1f
      or $c0
      ld h,a
      ld ($a000),hl
      jr loop

      .org $9191
handler:
      push af
      ld a,($a002)
      inc a
      ld ($a002),a
      and 7
      out ($fe),a
      pop af
      ei
      reti
`);
  for (let i = 0; i <= 0x100; i++) s.poke(0x9000 + i, 0x91);
  s.pokeWord(0xa000, 0xc000);
  s.runFrames(2);
  return {
    rig: new ReverseRig("zxnext", s.machine),
    executeFrame: () => s.machine.executeMachineFrame(),
    key: (key, down) => (down ? s.keyDown(key as never) : s.keyUp(key as never)),
    input: (n) => {
      switch (n & 3) {
        case 0:
          s.poke(0xc800 + ((n >> 2) & 0xff), n >> 8);
          return;
        case 1:
          s.machine.setJoystickState(n & 4 ? "left" : "right", (n >> 3) & 0xfff);
          return;
        case 2:
          s.machine.mousePacket((n >> 2) & 3, ((n >> 4) & 15) - 8, ((n >> 8) & 15) - 8, 0);
          return;
        case 3:
          // --- A NextReg written through $243B/$253B (the palette index)
          s.setNextReg(0x40, (n >> 2) & 0xff);
          return;
      }
    },
    setStepMode: (mode) => (s.machine.executionContext.debugStepMode = mode),
    saveState: () => s.machine.saveMachineState(),
    loadState: (parts) => s.machine.loadMachineState(parts)
  };
}

/**
 * The 128K family and the +2A/+3/+3E (one harness): booted to the 128 menu, which reads the keyboard
 * every interrupt, moves its bar and enters 128 BASIC. Inputs besides keys: memory edits, the clock
 * multiplier, a tape upload, AY register writes through the ports - and on a +3 with a drive, a disk
 * inserted (its upload into the core) and the drive motor switched through $1FFD.
 */
function sp128FamilyMachine(model: Sp128SessionModel, coreId: SpikeCoreId): MachineFactory {
  return async () => {
    const s = await createSp128Session(model);
    s.runFrames(120);
    const disk = coreId === "spp3e" ? new Uint8Array(readFileSync(join(__dirname, "../../testfiles/blank180K.dsk"))) : undefined;
    return {
      rig: new ReverseRig(coreId, s.machine),
      executeFrame: () => s.machine.executeMachineFrame(),
      key: (key, down) => (down ? s.keyDown(key) : s.keyUp(key)),
      input: (n) => {
        switch (n & 7) {
          case 0:
          case 4:
            s.poke(0xc100 + ((n >> 3) & 0xff), n >> 8);
            return;
          case 1:
            s.machine.targetClockMultiplier = s.machine.targetClockMultiplier === 1 ? 2 : 1;
            return;
          case 2:
            s.insertTape(FLOAT_SPY_BLOCKS);
            return;
          case 3:
          case 5:
            // --- An AY register: select, then write
            s.machine.doWritePort(0xfffd, (n >> 3) & 0x0f);
            s.machine.doWritePort(0xbffd, n >> 8);
            return;
          case 6:
            if (disk) s.machine.setMachineProperty(MEDIA_DISK_A, disk);
            return;
          case 7:
            // --- The +3's drive motor ($1FFD bit 3), the paging bits kept as the menu has them
            if (disk) s.machine.doWritePort(0x1ffd, n & 0x100 ? 0x0c : 0x04);
            return;
        }
      },
      setStepMode: (mode) => (s.machine.executionContext.debugStepMode = mode),
      saveState: () => s.machine.saveMachineState(),
      loadState: (parts) => s.machine.loadMachineState(parts)
    };
  };
}

/**
 * The Z88 running OZ from its Index: the keyboard (which also wakes a snoozed CPU), the flap and the
 * battery-low signal, memory edits and the clock multiplier.
 */
async function z88Machine(): Promise<Driver> {
  const s = await createZ88Session({ rom: "model" });
  s.runFrames(900);
  const m = s.machine as unknown as {
    signalFlapOpened(): void;
    signalFlapClosed(): void;
    raiseBatteryLow(): void;
    targetClockMultiplier: number;
    executionContext: { debugStepMode: DebugStepMode };
    executeMachineFrame(): FrameTerminationMode;
    saveMachineState(): MachineStateParts;
    loadMachineState(parts: MachineStateParts): void;
  };
  return {
    rig: new ReverseRig("z88", s.machine as never),
    executeFrame: () => m.executeMachineFrame(),
    key: (key, down) => (down ? s.keyDown(key as never) : s.keyUp(key as never)),
    input: (n) => {
      switch (n & 7) {
        case 0:
        case 1:
        case 2:
          // --- RAM in bank $20 (slot 0's RAM), as the Memory panel writes it
          s.poke(0x2000 + ((n >> 3) & 0xff), n >> 8);
          return;
        case 3:
          m.targetClockMultiplier = m.targetClockMultiplier === 1 ? 2 : 1;
          return;
        case 4:
          m.signalFlapOpened();
          return;
        case 5:
        case 6:
          m.signalFlapClosed();
          return;
        case 7:
          m.raiseBatteryLow();
          return;
      }
    },
    setStepMode: (mode) => (m.executionContext.debugStepMode = mode),
    saveState: () => m.saveMachineState(),
    loadState: (parts) => m.loadMachineState(parts)
  };
}

/**
 * The ZX81 (and ZX80) at the BASIC editor: the display is generated by the CPU itself - forced NOPs
 * and the ULA's interrupt - so positions fall inside the merged display runs. Inputs besides keys:
 * memory edits and the clock multiplier.
 */
function zx8081Machine(machineId: string): MachineFactory {
  return async () => {
    const s = await createZx81Session({ machineId });
    s.bootToBasic();
    return {
      rig: new ReverseRig("zx8081", s.machine),
      executeFrame: () => s.machine.executeMachineFrame(),
      key: (key, down) => (down ? s.keyDown(ZX8081_KEY[key]) : s.keyUp(ZX8081_KEY[key])),
      input: (n) => {
        if (n & 1) s.machine.targetClockMultiplier = s.machine.targetClockMultiplier === 1 ? 2 : 1;
        // --- Above the system variables and the program, below the 16K RAM top
        else s.poke(0x7000 + ((n >> 1) & 0xff), n >> 9);
      },
      setStepMode: (mode) => (s.machine.executionContext.debugStepMode = mode),
      saveState: () => s.machine.saveMachineState(),
      loadState: (parts) => s.machine.loadMachineState(parts)
    };
  };
}

/**
 * The Timex TC2048 at the BASIC editor (the 48K's frame loop with the SCLD): inputs besides keys are
 * memory edits, the clock multiplier, and the screen-mode port $FF - standard, second screen, hi-colour,
 * hi-res and its ink colours.
 */
async function timexMachine(): Promise<Driver> {
  const s = await createTimexSession();
  s.bootToBasic();
  return {
    rig: new ReverseRig("timex", s.machine),
    executeFrame: () => s.machine.executeMachineFrame(),
    key: (key, down) => (down ? s.keyDown(key) : s.keyUp(key)),
    input: (n) => {
      switch (n & 3) {
        case 0:
          s.poke(0xc100 + ((n >> 2) & 0xff), n >> 8);
          return;
        case 1:
          s.machine.targetClockMultiplier = s.machine.targetClockMultiplier === 1 ? 2 : 1;
          return;
        default:
          // --- The SCLD's mode bits, interrupts kept enabled (bit 6 clear)
          s.out(0xff, (n >> 2) & 0x3f & ~0x40);
          return;
      }
    },
    setStepMode: (mode) => (s.machine.executionContext.debugStepMode = mode),
    saveState: () => s.machine.saveMachineState(),
    loadState: (parts) => s.machine.loadMachineState(parts)
  };
}

const SP48_KEYS = ["A", "B", "N1", "Enter", "Space", "CShift", "SShift", "P"];
const ZX8081_KEYS = ["A", "P", "N1", "NewLine", "Space", "Shift", "Q", "N0"];
const Z88_KEYS = ["Down", "Up", "Enter", "Escape", "A", "N1", "ShiftL", "Index"];
const SP128_KEYS = ["N6", "N7", "Enter", "Space", "CShift", "SShift", "A", "P"];
const NEXT_KEYS = ["A", "Q", "1", "ENTER", "SPACE", "CAPS", "SYM", "P"];

/** Two seeds per variant in CI; `KLIVE_REVERSE_SEEDS=1-40` runs more locally */
const SEEDS = (() => {
  const m = /^(\d+)-(\d+)$/.exec(process.env.KLIVE_REVERSE_SEEDS ?? "");
  if (!m) return [1, 2];
  const out: number[] = [];
  for (let s = Number(m[1]); s <= Number(m[2]); s++) out.push(s);
  return out;
})();

/** Core id, machine, keys, and a name when one core runs several machines */
const cores: [SpikeCoreId, MachineFactory, string[], string?][] = [
  ["sp48", sp48Machine, SP48_KEYS],
  ["zxnext", nextMachine, NEXT_KEYS],
  ["sp128", sp128FamilyMachine("sp128", "sp128"), SP128_KEYS],
  ["sp128", sp128FamilyMachine("pentagon", "sp128"), SP128_KEYS, "pentagon"],
  // --- Without its own ROM the Scorpion boots the 128K ROMs, on its own memory map and timing
  ["sp128", sp128FamilyMachine("scorpion", "sp128"), SP128_KEYS, "scorpion"],
  ["timex", timexMachine, SP48_KEYS],
  ["spp3e", sp128FamilyMachine("fdd1", "spp3e"), SP128_KEYS],
  ["z88", z88Machine, Z88_KEYS],
  ["zx8081", zx8081Machine(MI_ZX81), ZX8081_KEYS, "zx81"],
  // --- The ZX80 runs on the same core with its own ROM and display timing
  ["zx8081", zx8081Machine(MI_ZX80), ZX8081_KEYS, "zx80"]
];

/** The cores whose layout stamp names frame-boundary scratch (T5): only they get the scratch proof */
const SCRATCH_CORES: SpikeCoreId[] = ["sp48", "zxnext"];

/*
 * T5's proof (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 3): a lean keyframe - one that leaves the
 * frame-boundary scratch the layout stamp names out - restored with that scratch full of garbage
 * replays every interval into the next keyframe exactly. Garbage that reached anything the keyframe
 * keeps would show as a differing page.
 */
async function proveScratchIsRewritten(make: MachineFactory, keys: string[], seed: number): Promise<void> {
  const script = makeScript(seed, keys, 90, 3000);
  const a = await make();
  a.setStepMode(DebugStepMode.NoDebug);
  a.rig.port.setEnabled(true);
  const scratch = a.rig.layout.scratch ?? [];
  expect(scratch.length).toBeGreaterThan(0);
  const store = new KeyframeStore({ layout: a.rig.layout, budgetBytes: 1 << 30, scratch: "layout" });
  let framesSinceKeyframe = KEYFRAME_INTERVAL;
  for (const action of script) {
    runAction(a, "fast", action);
    if (action.kind === "frames") framesSinceKeyframe += action.count;
    if (framesSinceKeyframe >= KEYFRAME_INTERVAL && a.rig.atFrameBoundary) {
      store.capture(a.rig.memory.buffer, a.rig.port.captureSeed(), a.rig.frames, a.rig.journal.length);
      framesSinceKeyframe = 0;
    }
  }
  const keyframes = store.keyframes;
  expect(keyframes.every((k) => !k.complete)).toBe(true);
  const b = await make();
  b.rig.port.setEnabled(true);
  const engine = b.rig.createEngine(store, a.rig.journal);
  const rnd = seededRandom(seed * 31 + 7);
  const garbage = () => {
    const memory = new Uint8Array(b.rig.memory.buffer);
    for (const s of scratch) for (let i = 0; i < s.size; i++) memory[s.address + i] = (rnd() * 256) | 0;
  };
  for (let k = 0; k + 1 < keyframes.length; k++) {
    const next = keyframes[k + 1];
    engine.replayTo(next.seed.position, { from: keyframes[k], journalLimit: next.journalIndex, afterRestore: garbage });
    expect(store.diffPages(next, b.rig.memory.buffer), `interval ${k} (seed ${seed})`).toEqual([]);
  }
  a.rig.dispose();
  b.rig.dispose();
}

describe("reverse debugging: the frame-boundary scratch is rewritten before it is read (T5)", () => {
  for (const [id, make, keys] of cores.filter(([id]) => SCRATCH_CORES.includes(id))) {
    for (const seed of SEEDS) {
      it(`${id}, seed ${seed}`, async () => {
        await proveScratchIsRewritten(make, keys, seed);
      }, 120_000);
    }
  }
});

describe("reverse debugging: journal replay = straight run", () => {
  for (const [id, make, keys, name] of cores) {
    for (const mode of ["fast", "debug"] as RunMode[]) {
      for (const seed of SEEDS) {
        it(`${name ?? id}, ${mode} path, seed ${seed}`, async () => {
          await proveJournalReplay(make, keys, mode, seed);
        }, 120_000);
      }
    }
  }
});
