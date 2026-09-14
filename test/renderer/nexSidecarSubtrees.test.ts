import { describe, it, expect, vi } from "vitest";

import {
  saveNexAnnotationSubtree,
  saveNexDebugSubtree
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationSidecar";
import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

/*
 * The sidecar's two subtrees are saved independently, on two different policies — annotations when
 * the user asks, breakpoints the moment they change. Neither writer may clobber the other, and
 * getting that wrong loses user data silently rather than loudly. See
 * `.plans/NEX_DEBUGGING_PLAN.md` §4.5.
 */

const PATH = "/p/Game.nex.dis";

function projectServiceWith(onDisk?: unknown) {
  const saved: string[] = [];
  return {
    saved,
    projectService: {
      readFileContent: vi.fn(async () =>
        onDisk === undefined ? Promise.reject(new Error("file does not exist")) : JSON.stringify(onDisk)
      ),
      saveFileContent: vi.fn(async (_path: string, contents: string) => {
        saved.push(contents);
      })
    } as any
  };
}

function written(saved: string[]): any {
  return JSON.parse(saved[saved.length - 1]);
}

const annotations: NexFileAnnotations = {
  schemaVersion: 2,
  source: { fileName: "Game.nex" },
  banks: { "5": { offsetIndex: 1, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }] } }
};

describe("saving the annotation subtree", () => {
  it("preserves the debug subtree already on disk", () => {
    // --- The reason this is read-merge-write: an annotation save must not revert a breakpoint set
    // --- since the model was loaded.
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: {},
      debug: { breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }] }
    });

    return saveNexAnnotationSubtree(projectService, PATH, annotations).then(() => {
      expect(written(saved).debug).toEqual({
        breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }]
      });
      expect(written(saved).banks).toEqual(annotations.banks);
    });
  });

  it("preserves a key this build knows nothing about", async () => {
    // --- Forward compatibility: a newer Klive's field must survive an older one's save.
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: {},
      somethingNewer: { kept: true }
    });
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    expect(written(saved).somethingNewer).toEqual({ kept: true });
  });

  it("stamps the model's schema version, which is how a v1 file becomes v2", async () => {
    const { projectService, saved } = projectServiceWith({ schemaVersion: 1, banks: {} });
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    expect(written(saved).schemaVersion).toEqual(2);
  });

  it("removes an annotation key the model no longer has", async () => {
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: {},
      globalLabels: [{ name: "Gone", value: 1 }]
    });
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    expect("globalLabels" in written(saved)).toEqual(false);
  });

  it("writes a whole file when there is nothing on disk yet", async () => {
    const { projectService, saved } = projectServiceWith(undefined);
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    expect(written(saved)).toMatchObject({ schemaVersion: 2, banks: annotations.banks });
  });

  it("ends the file with a newline, as it always did", async () => {
    const { projectService, saved } = projectServiceWith({ schemaVersion: 2, banks: {} });
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    expect(saved[0].endsWith("\n")).toEqual(true);
  });
});

describe("saving the debug subtree", () => {
  it("preserves the annotations already on disk", () => {
    // --- The other half: writing a breakpoint must not flush half-finished annotation edits, so it
    // --- writes only its own key.
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      source: { fileName: "Game.nex" },
      globalLabels: [{ name: "Start", value: 0x8000 }],
      banks: { "5": { offsetIndex: 1, regions: [] } }
    });

    return saveNexDebugSubtree(projectService, PATH, {
      breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }]
    }).then(() => {
      const file = written(saved);
      expect(file.globalLabels).toEqual([{ name: "Start", value: 0x8000 }]);
      expect(file.banks).toEqual({ "5": { offsetIndex: 1, regions: [] } });
      expect(file.debug).toEqual({ breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }] });
    });
  });

  it("does not write unsaved annotation edits that only exist in memory", async () => {
    // --- The file on disk has one bank; the in-memory model may have more. A breakpoint write must
    // --- carry none of that across.
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: { "5": { offsetIndex: 1, regions: [] } }
    });
    await saveNexDebugSubtree(projectService, PATH, {
      breakpoints: [{ bank: 6, offset: 0, kind: "exec" }]
    });
    expect(Object.keys(written(saved).banks)).toEqual(["5"]);
  });

  it("removes the key entirely when the last breakpoint goes", async () => {
    // --- A file with nothing to debug reads the same as it did before breakpoints existed.
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: {},
      debug: { breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }] }
    });
    await saveNexDebugSubtree(projectService, PATH, { breakpoints: [] });
    expect("debug" in written(saved)).toEqual(false);
  });

  it("removes the key for an absent state too", async () => {
    const { projectService, saved } = projectServiceWith({
      schemaVersion: 2,
      banks: {},
      debug: { breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }] }
    });
    await saveNexDebugSubtree(projectService, PATH, undefined);
    expect("debug" in written(saved)).toEqual(false);
  });

  it("declares the schema that describes the key it just added", async () => {
    // --- A v1 file gaining breakpoints has to say so, or the next reader would reject the key.
    const { projectService, saved } = projectServiceWith({ schemaVersion: 1, banks: {} });
    await saveNexDebugSubtree(projectService, PATH, {
      breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }]
    });
    expect(written(saved).schemaVersion).toEqual(2);
  });
});

describe("the two writers together", () => {
  it("neither clobbers the other, whichever order they run in", async () => {
    let onDisk: any = { schemaVersion: 2, banks: {} };
    const projectService = {
      readFileContent: vi.fn(async () => JSON.stringify(onDisk)),
      saveFileContent: vi.fn(async (_path: string, contents: string) => {
        onDisk = JSON.parse(contents);
      })
    } as any;

    await saveNexDebugSubtree(projectService, PATH, {
      breakpoints: [{ bank: 5, offset: 0x100, kind: "exec" }]
    });
    await saveNexAnnotationSubtree(projectService, PATH, annotations);
    await saveNexDebugSubtree(projectService, PATH, {
      breakpoints: [
        { bank: 5, offset: 0x100, kind: "exec" },
        { bank: 6, offset: 0x200, kind: "memWrite" }
      ]
    });

    expect(onDisk.banks).toEqual(annotations.banks);
    expect(onDisk.source).toEqual({ fileName: "Game.nex" });
    expect(onDisk.debug.breakpoints).toHaveLength(2);
  });
});
