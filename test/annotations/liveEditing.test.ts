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
import { freshRomSidecar } from "@renderer/appIde/annotations/romWorkingCopy";
import { formatRomSidecar } from "@common/roms/romAnnotationTools";

/*
 * Editing annotations from the live Disassembly view
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5): a row is turned into the bank site the
 * annotation editor works in, and the editor's own controller does the rest. A ROM row is edited in
 * its page's working copy (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`), and only when there is one.
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
  workingPath: "/home/Klive/RomAnnotations/sp128-1.rom.dis",
  workingPage: 0,
  hasWorkingCopy: true,
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

  it("sends a ROM row to the page's working copy, never the shipped sidecar", () => {
    expect(liveRowTarget(0x0d6b, context())).toMatchObject({
      kind: "rom",
      annotationPath: ROM.workingPath,
      bank: 0,
      offset: 0x0d6b,
      create: { machine: "rom", crc32: "b96a36be" },
      destination: "sp128-1.rom.dis working copy"
    });
  });

  it("does not edit a ROM page that has no working copy (R2)", () => {
    const shippedOnly = { ...ROM, hasWorkingCopy: false };
    expect(liveRowTarget(0x0d6b, context({ romPartition: () => shippedOnly }))).toMatchObject({
      disabledReason: expect.stringContaining("No working copy of sp128-1.rom.dis")
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
    const rom = annotationRowMenuItems({
      rom: true,
      hasOperands: false,
      hasDefinition: false,
      hints: {},
      regionActions: [],
      romEditor: "open"
    });
    expect(rom[0].text).toBe("Label (ROM working copy)...");
    expect(rom[rom.length - 1]).toMatchObject({ id: "open-rom-annotations", text: "Open ROM Annotations" });
    // --- Without a working copy the row offers to make one, and that entry is never disabled
    const start = annotationRowMenuItems({
      disabledReason: "No working copy",
      rom: false,
      hasOperands: false,
      hasDefinition: false,
      hints: {},
      regionActions: [],
      romEditor: "start"
    });
    expect(start[start.length - 1]).toMatchObject({ id: "start-rom-annotations", text: "Start Editing ROM Annotations..." });
    expect(start[start.length - 1].disabled).toBeUndefined();
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

  it("never makes a ROM working copy: that is rom-ann-new's, deliberately", async () => {
    const fs = fileSystem();
    const target = liveRowTarget(0x0d6b, context()) as any;
    expect(await ensureAnnotatedBank(target, fs.projectService)).toBeUndefined();
    expect(fs.saved).toEqual({});
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

  it("writes a ROM row's comment to the working copy, shippable: canonical, with provenance", async () => {
    const working = freshRomSidecar({
      workingPath: ROM.workingPath,
      workingPage: 0,
      crc32: "b96a36be",
      size: 0x4000,
      romName: "sp128-1.rom"
    });
    const fs = fileSystem({ [ROM.workingPath]: working });
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
    await flushAnnotationSession(ROM.workingPath);
    expect(Object.keys(fs.saved)).toEqual([ROM.workingPath]);
    const written = JSON.parse(fs.saved[ROM.workingPath]);
    expect(written.banks["0"].lineAnnotations).toEqual({
      [String(0x0d6b)]: { comment: "clear the screen" }
    });
    expect(written.provenance).toEqual({ [`0:${0x0d6b}:line`]: "observed" });
    // --- Everything but the banks and their provenance is the file as it was
    expect(written.pages).toEqual({ "0": { crc32: "b96a36be", name: "sp128-1.rom" } });
    expect(written.globalLabels).toBeUndefined();
    expect(fs.saved[ROM.workingPath]).toBe(formatRomSidecar(written));
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
