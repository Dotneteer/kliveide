import { describe, expect, it } from "vitest";

import { decodeTimexContext, TIMEX_CHUNK_DOCK, TIMEX_CHUNK_EXROM, TIMEX_CHUNK_NONE } from "@common/history/contexts/timexContext";
import { HistoryKind } from "@common/history/historyRecord";

import { describeHistoryCore, history, loadRecording } from "./historyCoreSuite";
import { timexDriver } from "./drivers";

/*
 * The Timex machines' execution history (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` Phase 1): the
 * 48K core built with the SCLD. The TS2068's 8K chunk map is the paging the partition check steps
 * through: chunks 0, 1, 6 and 7 move between HOME and the external bank, which port $FF picks.
 */

const CHUNK_PAGING = (base: number) => `
        .org ${base}
Start:  di
        ld e,0
Loop:   ld a,e
        and $c3
        out ($f4),a
        ld a,e
        rrca
        and $80
        out ($ff),a
        inc e
        jr Loop`;

describeHistoryCore("the Timex Computer 2048", { machineId: "timex", create: () => timexDriver(), codeBase: 0x8000 });

describeHistoryCore("the Timex Sinclair 2068", {
  machineId: "timex",
  create: () => timexDriver({ model: "ts2068" }),
  codeBase: 0x8000,
  pagingProgram: CHUNK_PAGING,
  pagingSteps: 600
});

describe("execution history on the TS2068: the chunk map", () => {
  it("records each instruction with the chunks' sources at the time: DOCK and EXROM banks alike", async () => {
    const d = await timexDriver({ model: "ts2068" });
    await loadRecording(d, 0x8000, CHUNK_PAGING(0x8000));
    d.step(400);
    const contexts = history(d)
      .filter((r) => r.kind === HistoryKind.Instruction)
      .map((r) => decodeTimexContext(r.context));
    expect(contexts.every((c) => c.model === 2)).toBe(true);
    const sources = new Set(contexts.flatMap((c) => [c.chunkSources[0], c.chunkSources[7]]));
    // --- No cartridge: an external DOCK chunk has nothing behind it; the EXROM bank answers if loaded
    expect(sources.has(TIMEX_CHUNK_NONE) || sources.has(TIMEX_CHUNK_DOCK)).toBe(true);
    expect(contexts.some((c) => (c.portFf & 0x80) !== 0)).toBe(true);
    expect(contexts.some((c) => c.chunkSources[4] !== 0)).toBe(false);
    // --- Chunk 0 external with port $FF bit 7 set: the EXROM bank; chunk 1 with it clear: the DOCK
    const exrom = contexts.find((c) => (c.portFf & 0x80) !== 0 && (c.portF4 & 0x01) !== 0)!;
    expect([TIMEX_CHUNK_EXROM, TIMEX_CHUNK_NONE]).toContain(exrom.chunkSources[0]);
    const dock = contexts.find((c) => (c.portFf & 0x80) === 0 && (c.portF4 & 0x02) !== 0)!;
    expect([TIMEX_CHUNK_DOCK, TIMEX_CHUNK_NONE]).toContain(dock.chunkSources[1]);
  });
});
