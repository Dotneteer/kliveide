import { beforeAll, describe, expect, it } from "vitest";
import { createSession, type NextTestSession } from "../harness/zxnext";
import { nextBankSpace } from "@common/annotations/bankSpace";
import { MI_ZXNEXT } from "@common/machines/constants";
import { profileLayoutOf } from "@common/profile/layouts";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import { runDetection, type DetectionContext, type DetectionPorts } from "@renderer/appIde/reverse/detection";

/*
 * Code/data detection on the real ZX Spectrum Next core (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §8, G7.3): a program with a known layout — code, a table it reads, a message it reads one byte
 * of, a routine it never calls — run with coverage on, then classified bank by bank. The 16K bank
 * is read through its two 8K pages (D-T7).
 */

let s: NextTestSession;
let symbol: (name: string) => number;

function portsOf(session: NextTestSession): DetectionPorts {
  return {
    async getMemoryContents(partition?: number) {
      if (partition !== undefined) {
        const page = new Uint8Array(0x2000);
        for (let i = 0; i < 0x2000; i++) page[i] = session.peekPage(partition, i);
        return { memory: page } as unknown as MemoryInfo;
      }
      return {
        memory: session.peekBytes(0, 0x10000),
        pc: session.machine.pc,
        sp: session.machine.sp,
        slotPartitions: Array.from({ length: 8 }, (_, slot) => session.partition(slot * 0x2000))
      } as unknown as MemoryInfo;
    },
    async getProfileTouched(mask?: number) {
      return { info: {} as any, bytes: session.profileTouched(mask) };
    },
    async getProfileEdges() {
      return undefined;
    },
    async getProfileView() {
      return undefined;
    }
  };
}

const context: DetectionContext = {
  bankSpace: nextBankSpace,
  layout: profileLayoutOf(MI_ZXNEXT)!,
  activeSet: { path: "/work/game.nex.dis", machine: "next", reason: "command" },
  romPartition: () => undefined,
  isBasic48Rom: () => false,
  projectService: {
    readFileContent: async () => {
      throw new Error("missing");
    },
    saveFileContent: async () => undefined
  } as any
};

beforeAll(async () => {
  s = await createSession();
  const program = await s.loadCode(`
        .org $8000
    Main:
        ld hl,Table
        ld b,4
    Loop:
        ld a,(hl)
        inc hl
        djnz Loop
        call Sub
        ret
    Sub:
        ld a,(Message)
        nextreg $07,a
        ret
    Never:
        nop
        ret
    Table:
        .defb 1,2,3,4
    Message:
        .defm "HELLO"
  `);
  symbol = program.symbol;
  s.resetProfile();
  s.profile(true);
  s.call("Main");
  s.profile(false);
}, 120_000);

describe("detection on the Next", () => {
  it("classifies a paged bank from both of its 8K pages", async () => {
    const run = await runDetection(portsOf(s), context, {
      scope: { kind: "paged" },
      mode: "fill",
      reach: false,
      text: false,
      words: false,
      unknown: "keep",
      screen: false
    });
    const bank2 = run.targets.find((t) => t.name === "bank 2")!;
    expect(bank2).toBeDefined();
    const offset = (name: string) => symbol(name) - 0x8000;
    const changeAt = (o: number) => bank2.proposal.changes.find((c) => o >= c.start && o <= c.end);
    // --- The code ran: no change over the default region, and it is counted as observed code
    expect(changeAt(offset("Main"))).toBeUndefined();
    expect(changeAt(offset("Sub"))).toBeUndefined();
    // --- The table was read: data
    expect(changeAt(offset("Table"))).toMatchObject({ type: "bytes", evidence: "observed" });
    expect(changeAt(offset("Message"))).toMatchObject({ type: "bytes" });
    // --- The routine nobody called has no evidence either way
    const never = bank2.proposal.counts;
    expect(never.unknown).toBeGreaterThan(0x3f00);
    expect(never.code).toBe(offset("Never"));
  });
});
