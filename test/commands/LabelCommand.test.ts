import { describe, it, expect, vi, beforeEach } from "vitest";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { LabelCommand } from "@renderer/appIde/commands/LabelCommand";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import {
  recordNexLoad,
  resetNexLoadSessionForTests
} from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";
import {
  clearAnnotationSessions,
  flushAnnotationSession,
  peekAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";

/*
 * `nex-label` — naming the address you are stopped at, in the launched NEX's annotations.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.3.
 */

/** A sidecar on disk with bank 5 described and one label already in it. */
const SIDECAR_JSON = JSON.stringify({
  schemaVersion: 2,
  globalLabels: [],
  banks: {
    "5": {
      offsetIndex: 3,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [{ name: "Existing", value: 0x0010 }]
    }
  }
});

/** Bank 5's low half (8K page 10) paged at $C000, i.e. slot 6. */
const PAGING = [0, 1, 2, 3, 4, 5, 10, 11];

function contextFor(
  over: {
    machineState?: MachineControllerState;
    machineId?: string;
    pc?: number;
    sidecar?: string | undefined;
    pageInfo?: (number | undefined)[];
  } = {}
) {
  const saved: { path: string; contents: string }[] = [];
  const readFileContent = vi.fn(async () =>
    over.sidecar === undefined && !("sidecar" in over)
      ? SIDECAR_JSON
      : over.sidecar ?? Promise.reject(new Error("file does not exist"))
  );
  const context: any = {
    store: {
      getState: () => ({
        emulatorState: {
          machineId: over.machineId ?? MI_ZXNEXT,
          machineState: over.machineState ?? MachineControllerState.Paused
        }
      })
    },
    output: {
      write: vi.fn(),
      writeLine: vi.fn(),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi: {
      getCpuStateChunk: vi.fn(async () => ({ pcValue: over.pc ?? 0xc100 })),
      // --- The paging the breakpoint engine matches against: one partition per 8K slot
      getMemoryContents: vi.fn(async () => ({ slotPartitions: over.pageInfo ?? PAGING }))
    },
    service: {
      projectService: {
        readFileContent,
        saveFileContent: vi.fn(async (path: string, contents: string) => {
          saved.push({ path, contents });
        })
      }
    }
  };
  return { context, saved, readFileContent };
}

async function validate(args: any, over: any = {}) {
  const { context } = contextFor(over);
  const messages = await new LabelCommand().validateCommandArgs(context, args);
  return messages.filter((m) => m.type === ValidationMessageType.Error);
}

describe("LabelCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNexLoadSessionForTests();
    clearAnnotationSessions();
    recordNexLoad("/p/Game.nex", [5, 2, 20]);
  });

  it("is registered as `label`, and still answers to `nex-label`", () => {
    const command = new LabelCommand();
    expect(command.id).toEqual("label");
    expect(command.aliases).toEqual(["lbl", "nex-label", "nl"]);
  });

  describe("validation", () => {
    it("accepts a name on a paused ZX Spectrum Next", async () => {
      expect(await validate({ name: "DrawSprite" })).toEqual([]);
    });

    it("refuses an empty name", async () => {
      expect((await validate({ name: "  " }))[0].message).toContain("cannot be empty");
    });

    it("accepts every machine with a bank space, and refuses the others", async () => {
      expect(await validate({ name: "X" }, { machineId: "sp128" })).toEqual([]);
      expect(await validate({ name: "X" }, { machineId: "sp48" })).toEqual([]);
      const errors = await validate({ name: "X" }, { machineId: "z88" });
      expect(errors[0].message).toContain("cannot be annotated");
    });

    it("refuses a running machine with no address given", async () => {
      // --- Its program counter is elsewhere by the time this reads it, so "where we are" would
      // --- name an arbitrary instruction — the same reason §11.4's spotlight needs a pause.
      const errors = await validate(
        { name: "X" },
        { machineState: MachineControllerState.Running }
      );
      expect(errors[0].message).toContain("Pause the machine");
    });

    it("accepts a running machine when an address is given", async () => {
      expect(
        await validate({ name: "X", address: 0xc100 }, { machineState: MachineControllerState.Running })
      ).toEqual([]);
    });
  });

  describe("execute", () => {
    it("writes the label at the paused address's bank offset", async () => {
      const { context, saved } = contextFor();
      const result = await new LabelCommand().execute(context, { name: "DrawSprite" } as any);

      expect(result.success).toEqual(true);
      expect(saved).toHaveLength(1);
      expect(saved[0].path).toEqual("/p/Game.nex.dis");
      const written = JSON.parse(saved[0].contents);
      expect(written.banks["5"].localLabels).toEqual([
        { name: "Existing", value: 0x0010 },
        // --- $C100 with bank 5's low half at $C000 is offset $0100.
        { name: "DrawSprite", value: 0x0100 }
      ]);
    });

    it("names the bank and offset it used", async () => {
      const { context } = contextFor();
      const result = await new LabelCommand().execute(context, { name: "DrawSprite" } as any);
      expect(result.finalMessage).toContain("bank $05");
      expect(result.finalMessage).toContain("$0100");
    });

    it("takes an explicit address over the program counter", async () => {
      const { context, saved } = contextFor();
      await new LabelCommand().execute(context, { name: "Other", address: 0xc200 } as any);
      expect(JSON.parse(saved[0].contents).banks["5"].localLabels.at(-1)).toEqual({
        name: "Other",
        value: 0x0200
      });
    });

    it("resolves the high half of a bank correctly", async () => {
      // --- Slot 7 holds page 11 — bank 5's *high* half — so $E100 is offset $2100.
      const { context, saved } = contextFor();
      await new LabelCommand().execute(context, { name: "High", address: 0xe100 } as any);
      expect(JSON.parse(saved[0].contents).banks["5"].localLabels.at(-1)).toEqual({
        name: "High",
        value: 0x2100
      });
    });

    it("refuses when no annotation set is active", async () => {
      resetNexLoadSessionForTests();
      const { context } = contextFor();
      const result = await new LabelCommand().execute(context, { name: "X" } as any);
      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("No annotation set is active");
    });

    it("refuses an address that is not in a RAM bank", async () => {
      // --- ROM, or an unpaged slot: there is no bank offset to name.
      const { context } = contextFor({ pageInfo: [-1, 1, 2, 3, 4, 5, 10, 11] });
      const result = await new LabelCommand().execute(context, {
        name: "X",
        address: 0x0100
      } as any);
      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("not in a RAM bank");
    });

    it("refuses a bank the launched file does not contain", async () => {
      /*
       * Bank 7 is paged in, but `Game.nex` declares 5, 2 and 20 — so naming an offset in it would
       * write a label into annotations for code that is not this file's.
       */
      const { context } = contextFor({ pageInfo: [0, 1, 2, 3, 4, 5, 14, 15] });
      const result = await new LabelCommand().execute(context, { name: "X" } as any);
      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("does not contain it");
    });

    it("refuses a duplicate name rather than moving the existing label", async () => {
      const { context, saved } = contextFor();
      const result = await new LabelCommand().execute(context, { name: "Existing" } as any);
      expect(result.success).toEqual(false);
      expect(saved).toHaveLength(0);
    });

    it("creates the sidecar when the NEX has no annotations yet", async () => {
      // --- The first label makes the file, as the first edit anywhere does (§4.3)
      const { context, saved } = contextFor({ sidecar: undefined });
      const result = await new LabelCommand().execute(context, { name: "X" } as any);
      expect(result.success).toEqual(true);
      const written = JSON.parse(saved.at(-1)!.contents);
      expect(written.schemaVersion).toEqual(2);
      expect(written.banks["5"].localLabels).toEqual([{ name: "X", value: 0x0100 }]);
    });

    it("routes through an open viewer's session, which writes it", async () => {
      /*
       * With a viewer open, the session's copy is the current one and the file may be a write
       * behind it — so this edit joins it there rather than being written over the top of it. The
       * session then writes the result, so the label is on disk either way.
       */
      const { context, saved } = contextFor();
      updateAnnotationSession("/p/Game.nex.dis", {
        schemaVersion: 2,
        banks: {
          "5": {
            offsetIndex: 3,
            regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
            localLabels: [{ name: "UnsavedEdit", value: 0x0020 }]
          }
        }
      } as any);

      const result = await new LabelCommand().execute(context, { name: "DrawSprite" } as any);
      await flushAnnotationSession("/p/Game.nex.dis");

      expect(result.success).toEqual(true);
      // --- The command no longer tells the user to go and save it.
      expect(result.finalMessage).not.toContain("Save");
      // --- Written by the session, once, carrying both the viewer's edit and this one.
      expect(saved).toHaveLength(1);
      const written = JSON.parse(saved[0].contents);
      expect(written.banks["5"].localLabels).toEqual([
        { name: "UnsavedEdit", value: 0x0020 },
        { name: "DrawSprite", value: 0x0100 }
      ]);
    });

    it("keeps the viewer's edits when it adds to the session", async () => {
      const { context } = contextFor();
      updateAnnotationSession("/p/Game.nex.dis", {
        schemaVersion: 2,
        banks: {
          "5": {
            offsetIndex: 3,
            regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
            localLabels: [{ name: "UnsavedEdit", value: 0x0020 }]
          }
        }
      } as any);

      await new LabelCommand().execute(context, { name: "DrawSprite" } as any);

      expect(peekAnnotationSession("/p/Game.nex.dis")!.banks["5"].localLabels).toEqual([
        { name: "UnsavedEdit", value: 0x0020 },
        { name: "DrawSprite", value: 0x0100 }
      ]);
    });

    it("preserves the debug subtree it did not touch", async () => {
      /*
       * It writes through `saveAnnotationSubtree`, so a breakpoint set since the file was read
       * survives — §4.5's whole point.
       */
      const withDebug = JSON.parse(SIDECAR_JSON);
      withDebug.debug = { breakpoints: [{ bank: 5, offset: 0x10, kind: "exec" }] };
      const { context, saved } = contextFor({ sidecar: JSON.stringify(withDebug) });
      await new LabelCommand().execute(context, { name: "DrawSprite" } as any);
      expect(JSON.parse(saved[0].contents).debug).toEqual({
        breakpoints: [{ bank: 5, offset: 0x10, kind: "exec" }]
      });
    });
  });
});
