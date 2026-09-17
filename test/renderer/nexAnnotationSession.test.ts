import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearNexAnnotationSessions,
  flushNexAnnotationSession,
  peekNexAnnotationSession,
  seedNexAnnotationSession,
  subscribeNexAnnotationSession,
  updateNexAnnotationSession,
  type NexAnnotationSessionSnapshot
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationSession";

const PATH = "/project/game.nex.dis";

afterEach(() => {
  clearNexAnnotationSessions();
});

const sidecar = (offsetIndex: number) =>
  JSON.stringify({
    schemaVersion: 1,
    banks: {
      "5": {
        offsetIndex,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
      }
    }
  });

const annotationsWith = (offsetIndex: number) =>
  ({
    schemaVersion: 1,
    banks: {
      "5": {
        offsetIndex,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
      }
    }
  }) as any;

function project(saveFileContent = vi.fn(() => Promise.resolve())) {
  return {
    readFileContent: vi.fn(() => Promise.resolve(sidecar(1))),
    saveFileContent
  };
}

async function subscribed(service: ReturnType<typeof project>) {
  const snapshots: NexAnnotationSessionSnapshot[] = [];
  subscribeNexAnnotationSession(service, PATH, 5, (snapshot) => snapshots.push(snapshot));
  await vi.waitFor(() => expect(snapshots.at(-1)?.annotations).toBeDefined());
  return snapshots;
}

describe("nexAnnotationSession", () => {
  it("shares one loaded model between the banks of a sidecar", async () => {
    const service = project();
    const first: NexAnnotationSessionSnapshot[] = [];
    const second: NexAnnotationSessionSnapshot[] = [];

    subscribeNexAnnotationSession(service, PATH, 5, (s) => first.push(s));
    subscribeNexAnnotationSession(service, PATH, 5, (s) => second.push(s));

    await vi.waitFor(() =>
      expect(first.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1)
    );
    // --- One read for two subscribers: the session is the shared copy.
    expect(service.readFileContent).toHaveBeenCalledTimes(1);
    expect(second.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1);
  });

  it("writes an edit without being asked, and tells every subscriber", async () => {
    const service = project();
    const first = await subscribed(service);
    const second = await subscribed(service);

    updateNexAnnotationSession(PATH, annotationsWith(2));

    // --- Published before the write: the listing must not wait on the disk.
    expect(first.at(-1)).toMatchObject({
      dirty: true,
      annotations: { banks: { "5": { offsetIndex: 2 } } }
    });
    expect(second.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(2);

    await flushNexAnnotationSession(PATH);

    expect(service.saveFileContent).toHaveBeenCalledWith(
      PATH,
      expect.stringContaining('"offsetIndex": 2')
    );
    expect(first.at(-1)?.dirty).toBe(false);
    expect(second.at(-1)?.dirty).toBe(false);
    expect(first.at(-1)?.saveError).toBeUndefined();
  });

  it("serializes writes and coalesces a burst into the newest model", async () => {
    let release: (() => void) | undefined;
    const inFlight = new Promise<void>((resolve) => (release = resolve));
    const saveFileContent = vi
      .fn()
      .mockImplementationOnce(() => inFlight)
      .mockImplementation(() => Promise.resolve());
    const service = project(saveFileContent as any);
    await subscribed(service);

    // --- Hold the first write open. It reads the file before it writes, so wait for the write
    // --- itself rather than assuming it has started.
    updateNexAnnotationSession(PATH, annotationsWith(2));
    await vi.waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));

    // --- Three more edits arrive while it is still in the air.
    updateNexAnnotationSession(PATH, annotationsWith(3));
    updateNexAnnotationSession(PATH, annotationsWith(4));
    updateNexAnnotationSession(PATH, annotationsWith(5));
    await Promise.resolve();
    // --- None of them started a second write alongside the first.
    expect(saveFileContent).toHaveBeenCalledTimes(1);

    release!();
    await flushNexAnnotationSession(PATH);

    /*
     * Two writes for four edits, and the second carries the newest model.
     *
     * The point is not the count but what it guarantees: no two writes are ever in flight at once,
     * so neither can read the file before the other has written it — which is what would drop the
     * `debug` subtree the breakpoint path owns.
     */
    expect(saveFileContent).toHaveBeenCalledTimes(2);
    expect(saveFileContent.mock.calls.at(-1)?.[1]).toContain('"offsetIndex": 5');
  });

  it("keeps the edit and reports the reason when a write fails", async () => {
    const saveFileContent = vi.fn(() => Promise.reject(new Error("EACCES: read-only")));
    const service = project(saveFileContent as any);
    const snapshots = await subscribed(service);

    updateNexAnnotationSession(PATH, annotationsWith(2));
    await flushNexAnnotationSession(PATH);

    // --- The in-memory model is still the edited one; only the disk is behind.
    expect(snapshots.at(-1)).toMatchObject({
      dirty: true,
      saveError: expect.stringContaining("EACCES"),
      annotations: { banks: { "5": { offsetIndex: 2 } } }
    });
  });

  it("retries on the next edit, and clears the error once a write lands", async () => {
    const saveFileContent = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("EACCES: read-only")))
      .mockImplementation(() => Promise.resolve());
    const service = project(saveFileContent as any);
    const snapshots = await subscribed(service);

    updateNexAnnotationSession(PATH, annotationsWith(2));
    await flushNexAnnotationSession(PATH);
    expect(snapshots.at(-1)?.saveError).toBeDefined();

    // --- No retry loop of its own: the next edit is what tries again.
    updateNexAnnotationSession(PATH, annotationsWith(3));
    await flushNexAnnotationSession(PATH);

    expect(snapshots.at(-1)?.saveError).toBeUndefined();
    expect(snapshots.at(-1)?.dirty).toBe(false);
    expect(saveFileContent.mock.calls.at(-1)?.[1]).toContain('"offsetIndex": 3');
  });

  it("holds an edit made before any writer is known, and writes it on subscribe", async () => {
    // --- The `nex-label` command can edit a sidecar whose session exists but has no subscriber yet.
    updateNexAnnotationSession(PATH, annotationsWith(7));

    const service = project();
    await subscribed(service);
    updateNexAnnotationSession(PATH, annotationsWith(8));
    await flushNexAnnotationSession(PATH);

    expect(service.saveFileContent).toHaveBeenCalledWith(
      PATH,
      expect.stringContaining('"offsetIndex": 8')
    );
  });

  describe("seeding", () => {
    it("serves a seeded model to subscribers without reading the file", () => {
      const service = project();
      const seeded = annotationsWith(2);
      seedNexAnnotationSession(PATH, seeded);

      const snapshots: NexAnnotationSessionSnapshot[] = [];
      subscribeNexAnnotationSession(service, PATH, 5, (snapshot) => snapshots.push(snapshot));

      expect(service.readFileContent).not.toHaveBeenCalled();
      expect(snapshots.at(-1)?.annotations).toBe(seeded);
      expect(snapshots.at(-1)?.dirty).toBe(false);
    });

    it("never replaces a model the session already holds", async () => {
      // --- A pop-out's edit may still be on its way to disk; a viewer's fresh read is older news.
      const service = project();
      await subscribed(service);
      const edited = annotationsWith(3);
      updateNexAnnotationSession(PATH, edited, service);

      seedNexAnnotationSession(PATH, annotationsWith(0));

      expect(peekNexAnnotationSession(PATH)).toBe(edited);
      await flushNexAnnotationSession(PATH);
    });

    it("does not interrupt a load already in flight", async () => {
      const service = project();
      const snapshots = await subscribed(service);
      seedNexAnnotationSession(PATH, annotationsWith(0));
      expect(snapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1);
    });
  });
});
