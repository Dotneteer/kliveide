import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearNexAnnotationSessions,
  saveNexAnnotationSession,
  subscribeNexAnnotationSession,
  updateNexAnnotationSession,
  type NexAnnotationSessionSnapshot
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationSession";

afterEach(() => {
  clearNexAnnotationSessions();
});

describe("nexAnnotationSession", () => {
  it("shares loaded annotations, dirty state, and saves by sidecar path", async () => {
    const readFileContent = vi.fn(() =>
      Promise.resolve(JSON.stringify({
        schemaVersion: 1,
        banks: {
          "5": {
            offsetIndex: 1,
            regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
          }
        }
      }))
    );
    const saveFileContent = vi.fn(() => Promise.resolve());
    const firstSnapshots: NexAnnotationSessionSnapshot[] = [];
    const secondSnapshots: NexAnnotationSessionSnapshot[] = [];

    subscribeNexAnnotationSession(
      { readFileContent },
      "/project/game.nex.dis",
      5,
      (snapshot) => firstSnapshots.push(snapshot)
    );
    subscribeNexAnnotationSession(
      { readFileContent },
      "/project/game.nex.dis",
      5,
      (snapshot) => secondSnapshots.push(snapshot)
    );

    await vi.waitFor(() =>
      expect(firstSnapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1)
    );
    expect(readFileContent).toHaveBeenCalledTimes(1);
    expect(secondSnapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1);

    updateNexAnnotationSession("/project/game.nex.dis", {
      ...firstSnapshots.at(-1)!.annotations!,
      banks: {
        "5": {
          offsetIndex: 2,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
        }
      }
    });

    expect(firstSnapshots.at(-1)).toMatchObject({
      dirty: true,
      annotations: { banks: { "5": { offsetIndex: 2 } } }
    });
    expect(secondSnapshots.at(-1)).toMatchObject({
      dirty: true,
      annotations: { banks: { "5": { offsetIndex: 2 } } }
    });

    await saveNexAnnotationSession({ saveFileContent }, "/project/game.nex.dis");

    expect(saveFileContent).toHaveBeenCalledWith(
      "/project/game.nex.dis",
      expect.stringContaining('"offsetIndex": 2')
    );
    expect(firstSnapshots.at(-1)?.dirty).toBe(false);
    expect(secondSnapshots.at(-1)?.dirty).toBe(false);
  });
});
