import { describe, it, expect, vi, beforeEach } from "vitest";

import { sp128BankSpace, sp48BankSpace, timexBankSpace } from "@common/annotations/bankSpace";
import { liveRowTarget, rowsOfTarget } from "@renderer/appIde/annotations/liveListingPort";
import {
  ensureAnnotatedBank,
  liveIntentForAction,
  runLiveAnnotationAction
} from "@renderer/appIde/annotations/liveAnnotationEditing";
import {
  clearAnnotationSessions,
  flushAnnotationSession,
  peekAnnotationSession,
  subscribeAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import type { NexAnnotationEditorPorts } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorPorts";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import { annotationRowMenuItems } from "@renderer/appIde/DocumentPanels/disassemblyRowMenu";

/*
 * Editing annotations from the live Disassembly view
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5): a row is turned into the bank site the
 * annotation editor works in, and the editor's own controller does the rest.
 */

function fileSystem(files: Record<string, string> = {}) {
  const saved: Record<string, string> = {};
  return {
    saved,
    projectService: {
      readFileContent: vi.fn(async (path: string) => {
        const contents = saved[path] ?? files[path];
        if (contents === undefined) throw new Error("File does not exist");
        return contents;
      }),
      saveFileContent: vi.fn(async (path: string, contents: string) => {
        saved[path] = contents;
      })
    }
  };
}

const ACTIVE = { path: "/g/game.z80.dis", machine: "sp128" as const, reason: "snapshot" as const };
const PAGING_128 = [-2, -2, 5, 5, 2, 2, 7, 7];

const ROM: RomPartitionInfo = {
  partition: -2,
  source: { crc32: "b96a36be", size: 0x4000, path: "roms/sp128-1.rom", page: 0 },
  userPath: "/home/Klive/RomAnnotations/b96a36be.rom.dis",
  userPage: 0,
  layers: [],
  bindings: []
};

const context = (over: Partial<Parameters<typeof liveRowTarget>[1]> = {}) => ({
  bankSpace: sp128BankSpace,
  slots: PAGING_128,
  activeSet: ACTIVE,
  romPartition: (partition: number) => (partition === -2 ? ROM : undefined),
  ...over
});

beforeEach(() => clearAnnotationSessions());

describe("liveRowTarget", () => {
  it("sends a RAM row to the active set, at the bank paged there", () => {
    expect(liveRowTarget(0xc100, context())).toMatchObject({
      kind: "bank",
      annotationPath: "/g/game.z80.dis",
      bank: 7,
      offset: 0x0100,
      disassOffset: 0xc000,
      create: { machine: "sp128", offsetIndex: 3 }
    });
  });

  it("sends a ROM row to the page's user layer, never the shipped sidecar (Q6)", () => {
    expect(liveRowTarget(0x0d6b, context())).toMatchObject({
      kind: "rom",
      annotationPath: ROM.userPath,
      bank: 0,
      offset: 0x0d6b,
      create: { machine: "rom", crc32: "b96a36be" },
      destination: "your ROM annotations"
    });
  });

  it("explains why a row cannot be annotated", () => {
    expect(liveRowTarget(0xc100, context({ activeSet: undefined }))).toMatchObject({
      disabledReason: expect.stringContaining("No annotation set is active")
    });
    expect(liveRowTarget(0xc100, context({ bankSpace: undefined }))).toMatchObject({
      disabledReason: expect.stringContaining("cannot be annotated")
    });
    // --- A Timex DOCK chunk (Q4)
    expect(
      liveRowTarget(0xc000, context({ bankSpace: timexBankSpace, slots: [-1, -2, 2, 3, 4, 5, 14, 15] }))
    ).toMatchObject({ disabledReason: expect.stringContaining("DOCK") });
  });

  it("gives the menu its entries, disabled with the reason", () => {
    const items = annotationRowMenuItems({
      disabledReason: "No annotation set is active",
      rom: false,
      hasOperands: true,
      hasDefinition: false,
      hints: { "local-label": "Shift+L" },
      regionActions: [{ id: "mark-bytes", text: "Mark As Bytes" }]
    });
    expect(items.every((item) => item.disabled)).toBe(true);
    expect(items[0]).toMatchObject({ text: "Label...", hint: "Shift+L", tooltip: "No annotation set is active" });
    const rom = annotationRowMenuItems({ rom: true, hasOperands: false, hasDefinition: false, hints: {}, regionActions: [] });
    expect(rom[0].text).toBe("Label (your ROM annotations)...");
  });

  it("collects the rows of the same bank piece", () => {
    const items = [0x8000, 0xc000, 0xc003, 0x0010].map((address) => ({ address }) as DisassemblyItem);
    const target = liveRowTarget(0xc000, context()) as any;
    const rows = rowsOfTarget(items, target, context());
    expect(rows.map((item) => item.address)).toEqual([0xc000, 0xc003]);
    // --- A plain row is given its place in the bank, on a copy
    expect(rows[1].annotation).toMatchObject({ bankOffset: 3 });
    expect(items[2].annotation).toBeUndefined();
  });
});

describe("ensureAnnotatedBank", () => {
  it("creates a missing sidecar with the bank, in the set's bank space", async () => {
    const fs = fileSystem();
    const target = liveRowTarget(0xc100, context()) as any;
    const annotations = await ensureAnnotatedBank(target, fs.projectService);
    await flushAnnotationSession(ACTIVE.path);
    expect(annotations?.banks["7"]).toMatchObject({ offsetIndex: 3 });
    expect(JSON.parse(fs.saved[ACTIVE.path])).toMatchObject({ schemaVersion: 3, machine: "sp128" });
  });

  it("creates a ROM user layer naming the page it describes", async () => {
    const fs = fileSystem();
    const target = liveRowTarget(0x0d6b, context()) as any;
    await ensureAnnotatedBank(target, fs.projectService);
    await flushAnnotationSession(ROM.userPath);
    const written = JSON.parse(fs.saved[ROM.userPath]);
    expect(written).toMatchObject({
      schemaVersion: 3,
      machine: "rom",
      pages: { "0": { crc32: "b96a36be", name: "sp128-1.rom" } },
      banks: { "0": { offsetIndex: 0 } }
    });
    expect(written.globalLabels).toBeUndefined();
  });

  it("does not overwrite a sidecar that does not validate", async () => {
    const fs = fileSystem({ [ACTIVE.path]: "{ not json" });
    const target = liveRowTarget(0xc100, context()) as any;
    expect(await ensureAnnotatedBank(target, fs.projectService)).toBeUndefined();
    expect(fs.saved[ACTIVE.path]).toBeUndefined();
  });
});

describe("runLiveAnnotationAction", () => {
  function portsWith(fs: ReturnType<typeof fileSystem>, dialogs: Partial<NexAnnotationEditorPorts["dialogs"]>) {
    return {
      session: {
        subscribe: (path, bank, listener) => subscribeAnnotationSession(fs.projectService, path, bank, listener),
        update: (path, annotations) => updateAnnotationSession(path, annotations, fs.projectService)
      },
      dialogs: dialogs as NexAnnotationEditorPorts["dialogs"],
      confirm: { confirm: vi.fn(async () => true) },
      nativeConfirm: () => true,
      bankBytes: () => [],
      navigateToAddress: vi.fn(),
      revealAddressInBank: vi.fn(async () => {}),
      unwrittenChanged: vi.fn()
    } as NexAnnotationEditorPorts;
  }

  it("labels a 128K row in bank 7 through the bank editor's own dialog and controller", async () => {
    const fs = fileSystem();
    const label = vi.fn(async (args: any) => ({
      action: "save" as const,
      scope: "local" as const,
      name: "Bank7Main",
      value: args.initialLocalValue
    }));
    const target = liveRowTarget(0xc100, context()) as any;
    const row = { address: 0xc100, instruction: "ret", opCodes: [0xc9] } as DisassemblyItem;
    await runLiveAnnotationAction({
      ports: portsWith(fs, { label }),
      target,
      rows: rowsOfTarget([row], target, context()),
      row,
      action: "local-label",
      decimalView: false,
      machineRunning: true,
      projectService: fs.projectService
    });
    await flushAnnotationSession(ACTIVE.path);
    expect(label).toHaveBeenCalledWith(expect.objectContaining({ bank: 7, initialLocalValue: 0x0100 }));
    expect(peekAnnotationSession(ACTIVE.path)?.banks["7"].localLabels).toEqual([
      { name: "Bank7Main", value: 0x0100 }
    ]);
    expect(JSON.parse(fs.saved[ACTIVE.path]).banks["7"].localLabels).toEqual([
      { name: "Bank7Main", value: 0x0100 }
    ]);
  });

  it("writes a ROM row's comment to the user layer, and nothing to the shipped sidecar", async () => {
    const fs = fileSystem();
    const endOfLineComment = vi.fn(async () => ({ comment: "clear the screen" }));
    const target = liveRowTarget(0x0d6b, context()) as any;
    const row = { address: 0x0d6b, instruction: "call $0daf", opCodes: [0xcd, 0xaf, 0x0d] } as DisassemblyItem;
    await runLiveAnnotationAction({
      ports: portsWith(fs, { endOfLineComment }),
      target,
      rows: rowsOfTarget([row], target, context()),
      row,
      action: "comment",
      decimalView: false,
      machineRunning: true,
      projectService: fs.projectService
    });
    await flushAnnotationSession(ROM.userPath);
    expect(Object.keys(fs.saved)).toEqual([ROM.userPath]);
    expect(JSON.parse(fs.saved[ROM.userPath]).banks["0"].lineAnnotations).toEqual({
      [String(0x0d6b)]: { comment: "clear the screen" }
    });
  });

  it("marks a 48K range as bytes in bank 2", async () => {
    const fs = fileSystem();
    const ctx48 = { ...context(), bankSpace: sp48BankSpace, slots: [], activeSet: { ...ACTIVE, machine: "sp48" as const } };
    const target = liveRowTarget(0x8010, ctx48) as any;
    const row = { address: 0x8010, instruction: "nop", opCodes: [0] } as DisassemblyItem;
    // --- One row opens the region dialog on it, as in a bank document
    const region = vi.fn(async (args: any) => ({ type: "bytes" as const, start: args.initialStart, end: args.initialEnd }));
    await runLiveAnnotationAction({
      ports: portsWith(fs, { region }),
      target,
      rows: rowsOfTarget([row], target, ctx48),
      row,
      action: "mark-bytes",
      decimalView: false,
      machineRunning: true,
      projectService: fs.projectService
    });
    expect(region).toHaveBeenCalledWith(expect.objectContaining({ initialStart: 0x10, initialType: "bytes" }));
    expect(peekAnnotationSession(ACTIVE.path)?.banks["2"].regions).toContainEqual({
      start: 0x10,
      end: 0x10,
      type: "bytes"
    });
  });

  it("maps every menu action to the editor's intent", () => {
    expect(liveIntentForAction("local-label", 3)).toEqual({ type: "labelRequested", scope: "local", rowIndex: 3 });
    expect(liveIntentForAction("global-label", 3)).toEqual({ type: "labelRequested", scope: "local", rowIndex: 3 });
    expect(liveIntentForAction("mark-text", 1)).toEqual({ type: "regionTypeMarked", regionType: "text", rowIndex: 1 });
    expect(liveIntentForAction("goto-definition", 0)).toEqual({ type: "goToDefinitionRequested", rowIndex: 0 });
  });
});
