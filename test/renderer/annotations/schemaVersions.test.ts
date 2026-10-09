import { describe, it, expect, vi } from "vitest";

import {
  createDefaultAnnotations,
  parseAnnotations,
  schemaVersionFor,
  type ProgramAnnotations
} from "@renderer/appIde/annotations/programAnnotations";
import {
  formatAnnotations,
  saveAnnotationSubtree,
  saveDebugSubtree
} from "@renderer/appIde/annotations/annotationSidecar";

/*
 * Schema 3 adds `machine` for every machine but the Next. A Next sidecar stays at schema 2, byte
 * for byte, so a previously shipped build keeps reading it (T4); a 48K sidecar is schema 3, which
 * that build refuses rather than reading its banks as Next banks (A6).
 */

function projectServiceWith(onDisk?: unknown) {
  const saved: string[] = [];
  return {
    saved,
    projectService: {
      readFileContent: vi.fn(async () =>
        onDisk === undefined
          ? Promise.reject(new Error("file does not exist"))
          : typeof onDisk === "string"
            ? onDisk
            : JSON.stringify(onDisk)
      ),
      saveFileContent: vi.fn(async (_path: string, contents: string) => {
        saved.push(contents);
      })
    } as any
  };
}

const NEXT_FILE = `{
  "schemaVersion": 2,
  "source": {
    "fileName": "Game.nex"
  },
  "globalLabels": [
    {
      "name": "Start",
      "value": 32768
    }
  ],
  "banks": {
    "5": {
      "offsetIndex": 1,
      "regions": [
        {
          "start": 0,
          "end": 255,
          "type": "bytes",
          "rowBytes": 2,
          "decode": "copper"
        },
        {
          "start": 256,
          "end": 16383,
          "type": "disassemble"
        }
      ],
      "localLabels": [
        {
          "name": "Loop",
          "value": 256
        }
      ]
    }
  }
}
`;

describe("schema versions", () => {
  it("round-trips a version 2 Next file byte for byte", () => {
    const parsed = parseAnnotations(NEXT_FILE);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.annotations?.machine).toBeUndefined();
    expect(formatAnnotations(parsed.annotations!)).toBe(NEXT_FILE);
  });

  it("re-saves a version 2 file through the subtree writer unchanged", async () => {
    const { projectService, saved } = projectServiceWith(NEXT_FILE);
    const parsed = parseAnnotations(NEXT_FILE).annotations!;
    await saveAnnotationSubtree(projectService, "/p/Game.nex.dis", parsed);
    expect(saved[0]).toBe(NEXT_FILE);
  });

  it("writes the Next as 2 and every other machine as 3", () => {
    expect(schemaVersionFor(undefined)).toBe(2);
    expect(schemaVersionFor("next")).toBe(2);
    expect(schemaVersionFor("sp48")).toBe(3);
    expect(schemaVersionFor("zx81")).toBe(3);
    expect(schemaVersionFor("rom")).toBe(3);
  });

  it("creates a 48K sidecar as schema 3 with its machine", () => {
    const annotations = createDefaultAnnotations({ machine: "sp48", loadedBanks: [5, 2, 0] });
    expect(annotations.schemaVersion).toBe(3);
    expect(annotations.machine).toBe("sp48");
    expect(Object.keys(annotations.banks).sort()).toEqual(["0", "2", "5"]);
  });

  it("does not write machine into a Next sidecar it creates", () => {
    const annotations = createDefaultAnnotations({ loadedBanks: [5] });
    expect(annotations.schemaVersion).toBe(2);
    expect("machine" in annotations).toBe(false);
  });

  it("accepts version 3 with a known machine and keeps it", () => {
    const parsed = parseAnnotations(
      JSON.stringify({ schemaVersion: 3, machine: "sp128", banks: { "7": { regions: [] } } })
    );
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.annotations).toMatchObject({ schemaVersion: 3, machine: "sp128" });
  });

  it("rejects version 3 with an unknown machine", () => {
    const parsed = parseAnnotations(
      JSON.stringify({ schemaVersion: 3, machine: "c64", banks: {} })
    );
    expect(parsed.annotations).toBeUndefined();
    expect(parsed.diagnostics.map((item) => item.path)).toContain("$.machine");
  });

  it("rejects version 3 without a machine", () => {
    const parsed = parseAnnotations(JSON.stringify({ schemaVersion: 3, banks: {} }));
    expect(parsed.annotations).toBeUndefined();
  });

  it("rejects machine in a version 2 file, which an older build would read as a Next's", () => {
    const parsed = parseAnnotations(
      JSON.stringify({ schemaVersion: 2, machine: "sp48", banks: {} })
    );
    expect(parsed.annotations).toBeUndefined();
  });

  it("limits bank keys to the machine's bank space", () => {
    expect(
      parseAnnotations(JSON.stringify({ schemaVersion: 3, machine: "sp128", banks: { "8": {} } }))
        .annotations
    ).toBeUndefined();
    expect(
      parseAnnotations(JSON.stringify({ schemaVersion: 3, machine: "scorpion", banks: { "15": {} } }))
        .annotations
    ).toBeDefined();
  });

  it("lists copper regions as bytes on a machine without a Copper", () => {
    const parsed = parseAnnotations(
      JSON.stringify({
        schemaVersion: 3,
        machine: "sp48",
        banks: { "2": { regions: [{ start: 0, end: 3, type: "bytes", decode: "copper" }] } }
      })
    );
    expect(parsed.annotations?.banks["2"].regions[0].type).toBe("bytes");
    expect(parsed.diagnostics.some((item) => item.severity === "warning")).toBe(true);
  });

  it("decodes text regions on the ZX81 and stores them as bytes + decode", () => {
    const stored = {
      schemaVersion: 3,
      machine: "zx81",
      banks: { "1": { regions: [{ start: 0, end: 9, type: "bytes", decode: "text" }] } }
    };
    const parsed = parseAnnotations(JSON.stringify(stored));
    expect(parsed.annotations?.banks["1"].regions[0].type).toBe("text");
    const written = JSON.parse(formatAnnotations(parsed.annotations!));
    expect(written.banks["1"].regions[0]).toEqual({
      start: 0,
      end: 9,
      type: "bytes",
      decode: "text"
    });
  });

  it("refuses global labels and a debug subtree in a ROM sidecar", () => {
    expect(
      parseAnnotations(
        JSON.stringify({ schemaVersion: 3, machine: "rom", globalLabels: [], banks: {} })
      ).annotations
    ).toBeUndefined();
    expect(
      parseAnnotations(JSON.stringify({ schemaVersion: 3, machine: "rom", debug: {}, banks: {} }))
        .annotations
    ).toBeUndefined();
  });

  it("keeps a schema 3 file at 3 when the debug writer adds a breakpoint", async () => {
    const onDisk: ProgramAnnotations = { schemaVersion: 3, machine: "sp48", banks: {} };
    const { projectService, saved } = projectServiceWith(onDisk);
    await saveDebugSubtree(projectService, "/p/game.z80.dis", {
      breakpoints: [{ bank: 5, offset: 0x10, kind: "exec" }]
    });
    expect(JSON.parse(saved[0])).toMatchObject({ schemaVersion: 3, machine: "sp48" });
  });

  it("writes machine through the annotation subtree writer", async () => {
    const { projectService, saved } = projectServiceWith();
    await saveAnnotationSubtree(projectService, "/p/game.z80.dis", {
      schemaVersion: 3,
      machine: "sp48",
      banks: {}
    });
    expect(JSON.parse(saved[0])).toEqual({ schemaVersion: 3, machine: "sp48", banks: {} });
  });
});
