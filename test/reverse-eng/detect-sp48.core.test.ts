import { beforeAll, describe, expect, it } from "vitest";
import { createSp48Session, type Sp48TestSession } from "../harness/sp48";
import { sp48BankSpace } from "@common/annotations/bankSpace";
import { MI_SPECTRUM_48 } from "@common/machines/constants";
import { profileLayoutOf } from "@common/profile/layouts";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import { runDetection, type DetectionContext, type DetectionPorts } from "@renderer/appIde/reverse/detection";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";

/*
 * Code/data detection on the real 48K core (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §8, G7.3):
 * boot to BASIC with coverage on, print through the ROM, then detect on the ROM page. Known entry
 * points must come out as code and the character set's printed letters as data.
 *
 * This is Klive's own observation of the ROM — the source G7.2's provenance rules allow — not a
 * comparison with any published ROM map.
 */

let s: Sp48TestSession;

function portsOf(session: Sp48TestSession): DetectionPorts {
  const machine = session.machine;
  return {
    async getMemoryContents() {
      const memory = new Uint8Array(0x10000);
      for (let a = 0; a < 0x10000; a++) memory[a] = session.peek(a);
      return { memory, pc: machine.pc, sp: machine.sp, slotPartitions: undefined } as unknown as MemoryInfo;
    },
    async getProfileTouched(mask?: number) {
      return { info: {} as any, bytes: machine.readProfileTouched(mask) ?? [] };
    },
    async getProfileEdges() {
      return undefined;
    },
    async getProfileView() {
      return { baseAddress: 0, flags: machine.readProfileFlags(0, 0x10000)!, info: {} as any };
    }
  };
}

const files = new Map<string, string>();
const context: DetectionContext = {
  bankSpace: sp48BankSpace,
  layout: profileLayoutOf(MI_SPECTRUM_48)!,
  activeSet: { path: "/work/game.z80.dis", machine: "sp48", reason: "command" },
  romPartition: (partition) =>
    partition === -1
      ? ({
          partition,
          source: { crc32: "00000000", size: 0x4000, page: 0, path: "roms/sp48.rom" },
          userPath: "/home/roms/sp48.rom.user.dis",
          userPage: 0,
          layers: [],
          bindings: []
        } as unknown as RomPartitionInfo)
      : undefined,
  isBasic48Rom: () => true,
  projectService: {
    readFileContent: async (path: string) => {
      if (!files.has(path)) throw new Error("missing");
      return files.get(path)!;
    },
    saveFileContent: async (path: string, contents: string | Uint8Array) => {
      files.set(path, String(contents));
    }
  } as any
};

beforeAll(async () => {
  s = await createSp48Session();
  s.machine.resetProfile();
  s.machine.setProfiling(true, true);
  s.bootToBasic();
  await s.loadCode(`
        .org $8000
    Main:
        ld a,2
        call $1601        ; CHAN-OPEN: the upper screen
        ld hl,Text
    Next:
        ld a,(hl)
        or a
        ret z
        rst $10           ; PRINT-A
        inc hl
        jr Next
    Text:
        .defm "KLIVE"
        .defb 0
  `);
  s.call("Main");
  s.runFrames(5);
  s.machine.setProfiling(false, true);
}, 120_000);

describe("detection on the 48K ROM", () => {
  it("finds the ROM's entry points as code and the printed letters as data", async () => {
    const run = await runDetection(portsOf(s), context, {
      scope: { kind: "rom" },
      mode: "fill",
      reach: true,
      text: false,
      words: false,
      unknown: "keep",
      screen: true
    });
    expect(run.problem).toBeUndefined();
    const [rom] = run.targets;
    expect(rom.name).toBe("ROM");
    const changeAt = (offset: number) =>
      rom.proposal.changes.find((c) => offset >= c.start && offset <= c.end);
    const codeAt = (offset: number) => {
      // --- Code over the default region is no change: it is code if no change makes it data
      const change = changeAt(offset);
      return change === undefined || change.type === "disassemble";
    };
    // --- START, MASK-INT, PRINT-OUT's RST target and the main entry ran
    for (const entry of [0x0000, 0x0038, 0x0010, 0x12ac]) expect(codeAt(entry)).toBe(true);
    // --- The character set: "K" (0x4B) at $3D00 + (0x4B - 0x20) * 8
    for (const ch of "KLIVE") {
      const glyph = 0x3d00 + (ch.charCodeAt(0) - 0x20) * 8;
      expect(changeAt(glyph)).toMatchObject({ type: "bytes", evidence: "observed" });
    }
    expect(rom.proposal.counts.observed).toBeGreaterThan(1000);
    expect(rom.proposal.counts.reached).toBeGreaterThan(0);
  });

  it("proposes the screen of bank 5 as skip and finds the program as code", async () => {
    const run = await runDetection(portsOf(s), context, {
      scope: { kind: "bank", bank: 2 },
      mode: "fill",
      reach: true,
      text: true,
      words: false,
      unknown: "keep",
      screen: true
    });
    const [bank2] = run.targets;
    // --- The program at $8000 is bank 2 offset 0; its message is read as data, and is text
    const text = bank2.proposal.changes.find((c) => c.type === "text");
    expect(text).toBeDefined();
    const screen = await runDetection(portsOf(s), context, {
      scope: { kind: "bank", bank: 5 },
      mode: "fill",
      reach: false,
      text: false,
      words: false,
      unknown: "keep",
      screen: true
    });
    expect(screen.targets[0].proposal.changes[0]).toMatchObject({ start: 0, type: "skip" });
  });
});
