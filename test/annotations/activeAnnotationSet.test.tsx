import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  activateSidecarOf,
  clearActiveAnnotationSet,
  getActiveAnnotationSet,
  projectAnnotationPath,
  resetActiveAnnotationSetForTests,
  setActiveAnnotationSet,
  subscribeActiveAnnotationSet,
  useActiveAnnotations
} from "@renderer/appIde/annotations/activeAnnotationSet";
import {
  clearAnnotationSessions,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import {
  AnnotationCloseCommand,
  AnnotationInfoCommand,
  AnnotationNewCommand,
  AnnotationOpenCommand,
  countAnnotations,
  romAnnotationInfoLines
} from "@renderer/appIde/commands/AnnotationSetCommands";
import { MI_SPECTRUM_128, MI_SPECTRUM_48, MI_ZX81 } from "@common/machines/constants";

/*
 * The active annotation set: one `.dis` file whose annotations are live, whichever way the program
 * got into the machine (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.3).
 */

function fileSystem(files: Record<string, string> = {}) {
  const saved: Record<string, string> = {};
  return {
    files,
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

function contextFor(machineId: string, fs = fileSystem(), folderPath = "/proj") {
  const lines: string[] = [];
  const context: any = {
    store: {
      getState: () => ({ emulatorState: { machineId }, project: { folderPath } })
    },
    output: {
      write: vi.fn((text: string) => lines.push(text)),
      writeLine: vi.fn((text?: string) => lines.push(text ?? "")),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    service: { projectService: fs.projectService }
  };
  return { context, lines, fs };
}

const SP48_FILE: ProgramAnnotations = {
  schemaVersion: 3,
  machine: "sp48",
  banks: {
    "2": {
      offsetIndex: 2,
      regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
      localLabels: [{ name: "Main", value: 0x0100 }]
    }
  }
};

beforeEach(() => {
  resetActiveAnnotationSetForTests();
  clearAnnotationSessions();
});

describe("the active annotation set", () => {
  it("names the sidecar beside a program file", () => {
    const set = activateSidecarOf("/games/jetpac.z80", "sp48", "snapshot");
    expect(set.path).toBe("/games/jetpac.z80.dis");
    expect(getActiveAnnotationSet()).toEqual({
      path: "/games/jetpac.z80.dis",
      hostPath: "/games/jetpac.z80",
      machine: "sp48",
      reason: "snapshot"
    });
  });

  it("tells listeners about real changes only", () => {
    const listener = vi.fn();
    subscribeActiveAnnotationSet(listener);
    activateSidecarOf("/a.nex", "next", "nex-run");
    activateSidecarOf("/a.nex", "next", "nex-run");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is not deactivated by a reason that did not set it", () => {
    activateSidecarOf("/games/jetpac.z80", "sp48", "snapshot");
    clearActiveAnnotationSet("project");
    expect(getActiveAnnotationSet()).toBeDefined();
    clearActiveAnnotationSet("snapshot");
    expect(getActiveAnnotationSet()).toBeUndefined();
  });

  it("puts the project's sidecar in its folder, annotations.dis by default (Q3)", () => {
    expect(projectAnnotationPath("/proj", undefined)).toBe("/proj/annotations.dis");
    expect(projectAnnotationPath("/proj/", "re/game.dis")).toBe("/proj/re/game.dis");
    expect(projectAnnotationPath("/proj", "/abs/x.dis")).toBe("/abs/x.dis");
  });

  it("reaches the live view when a label is added through the session (the §2.3 gap)", async () => {
    // --- The live view used to read the sidecar once per launch, so a label added afterwards did
    // --- not show until the next one. Following the session, it shows on the next render.
    const fs = fileSystem({ "/g.z80.dis": JSON.stringify(SP48_FILE) });
    setActiveAnnotationSet({ path: "/g.z80.dis", machine: "sp48", reason: "snapshot" });
    const { result } = renderHook(() => useActiveAnnotations(fs.projectService));
    await waitFor(() => expect(result.current.annotations).toBeDefined());
    expect(result.current.annotations?.banks["2"].localLabels).toHaveLength(1);

    const edited: ProgramAnnotations = JSON.parse(JSON.stringify(result.current.annotations));
    edited.banks["2"].localLabels!.push({ name: "Loop", value: 0x0120 });
    act(() => updateAnnotationSession("/g.z80.dis", edited, fs.projectService));
    expect(result.current.annotations?.banks["2"].localLabels?.map((l) => l.name)).toEqual([
      "Main",
      "Loop"
    ]);
  });

  it("reports a sidecar that does not exist yet as missing, not as an error", async () => {
    const fs = fileSystem();
    setActiveAnnotationSet({ path: "/new.z80.dis", machine: "sp48", reason: "snapshot" });
    const { result } = renderHook(() => useActiveAnnotations(fs.projectService));
    await waitFor(() => expect(result.current.snapshot?.loading).toBe(false));
    expect(result.current.snapshot?.missing).toBe(true);
    expect(result.current.annotations).toBeUndefined();
  });
});

describe("ann-* commands", () => {
  it("ann-new creates a schema 3 file in the machine's bank space and activates it", async () => {
    const { context, fs } = contextFor(MI_SPECTRUM_128);
    const result = await new AnnotationNewCommand().execute(context, { file: "game.dis" });
    expect(result.success).toBe(true);
    expect(JSON.parse(fs.saved["/proj/game.dis"])).toMatchObject({
      schemaVersion: 3,
      machine: "sp128",
      banks: {}
    });
    expect(getActiveAnnotationSet()).toMatchObject({ path: "/proj/game.dis", reason: "command" });
  });

  it("ann-new takes the bank space from -m and refuses an unknown one", async () => {
    const { context, fs } = contextFor(MI_SPECTRUM_128);
    const command = new AnnotationNewCommand();
    expect(await command.validateCommandArgs(context, { file: "x.dis", "-m": "c64" })).toHaveLength(1);
    await command.execute(context, { file: "x.dis", "-m": "sp48" });
    expect(JSON.parse(fs.saved["/proj/x.dis"]).machine).toBe("sp48");
  });

  it("ann-new refuses an existing file", async () => {
    const { context } = contextFor(MI_SPECTRUM_48, fileSystem({ "/proj/g.dis": "{}" }));
    const result = await new AnnotationNewCommand().execute(context, { file: "g.dis" });
    expect(result.success).toBe(false);
  });

  it("ann-open activates a file in its own bank space, warning only when it does not fit", async () => {
    const fs = fileSystem({ "/proj/g.dis": JSON.stringify(SP48_FILE) });
    const on128 = contextFor(MI_SPECTRUM_128, fs);
    expect((await new AnnotationOpenCommand().execute(on128.context, { file: "g.dis" })).success).toBe(true);
    expect(getActiveAnnotationSet()?.machine).toBe("sp48");
    // --- A 48K file on a 128K is the normal case (A3): no warning.
    expect(on128.lines.join("")).not.toContain("Warning");

    const onZx81 = contextFor(MI_ZX81, fs);
    await new AnnotationOpenCommand().execute(onZx81.context, { file: "g.dis" });
    expect(onZx81.lines.join("")).toContain("Warning");
  });

  it("ann-open refuses a file that does not validate", async () => {
    const fs = fileSystem({ "/proj/bad.dis": JSON.stringify({ schemaVersion: 3, banks: {} }) });
    const { context } = contextFor(MI_SPECTRUM_48, fs);
    const result = await new AnnotationOpenCommand().execute(context, { file: "bad.dis" });
    expect(result.success).toBe(false);
    expect(getActiveAnnotationSet()).toBeUndefined();
  });

  it("ann-close deactivates; ann-info describes the set", async () => {
    const fs = fileSystem({ "/proj/g.dis": JSON.stringify(SP48_FILE) });
    const { context, lines } = contextFor(MI_SPECTRUM_48, fs);
    await new AnnotationOpenCommand().execute(context, { file: "g.dis" });
    await new AnnotationInfoCommand().execute(context);
    const text = lines.join("\n");
    expect(text).toContain("/proj/g.dis");
    expect(text).toContain("1 label(s)");
    await new AnnotationCloseCommand().execute();
    expect(getActiveAnnotationSet()).toBeUndefined();
  });

  it("counts what a set holds", () => {
    expect(
      countAnnotations({
        schemaVersion: 3,
        machine: "sp48",
        globalLabels: [{ name: "G", value: 1 }],
        banks: {
          "5": {
            offsetIndex: 1,
            regions: [
              { start: 0, end: 9, type: "bytes" },
              { start: 10, end: 0x3fff, type: "disassemble" }
            ],
            localLabels: [{ name: "L", value: 0 }],
            comment: "bank",
            lineAnnotations: { "0": { synopsis: "s", comment: "c" } }
          }
        },
        debug: { breakpoints: [{ bank: 5, offset: 0, kind: "exec" }] }
      })
    ).toEqual({ banks: 1, labels: 2, comments: 3, regions: 1, breakpoints: 1 });
  });

  it("ann-info describes the ROM pages: their layers and how many labels bound (Q7)", () => {
    const lines = romAnnotationInfoLines([
      {
        partition: -1,
        source: { crc32: "12345678", size: 0x4000, path: "/roms/custom.rom", page: 0 },
        workingPath: "/roms/custom.rom.dis",
        workingPage: 0,
        hasWorkingCopy: false,
        layers: [
          {
            kind: "shipped",
            path: "roms/sp48.rom.dis",
            origin: "ROM: sp48.rom",
            page: 0,
            annotations: { schemaVersion: 3, machine: "rom", banks: {} },
            bound: new Set()
          }
        ],
        bindings: [
          {
            sidecar: "sp48.rom.dis",
            binding: { bound: new Set(), boundRegions: new Set(), labelsBound: 7, labelsTotal: 12 }
          }
        ]
      }
    ]);
    expect(lines).toEqual([
      "ROM page -1 (custom.rom, CRC 12345678):",
      "  shipped, inherited: roms/sp48.rom.dis",
      "  working copy: none (rom-ann-new makes /roms/custom.rom.dis, which makes the page editable)",
      "  7 of 12 labels of sp48.rom.dis bound to these bytes"
    ]);
  });
});
