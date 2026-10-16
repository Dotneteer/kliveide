import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAnnotationSessions,
  flushAnnotationSession,
  peekAnnotationSession,
  reloadAnnotationSessionFromDisk,
  seedAnnotationSession,
  seedReadOnlyAnnotationSession,
  setAnnotationFileWatch,
  subscribeAnnotationSession,
  updateAnnotationSession,
  type AnnotationSessionSnapshot
} from "@renderer/appIde/annotations/annotationSession";

const PATH = "/project/game.nex.dis";

afterEach(() => {
  clearAnnotationSessions();
  setAnnotationFileWatch(undefined);
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
  const snapshots: AnnotationSessionSnapshot[] = [];
  subscribeAnnotationSession(service, PATH, 5, (snapshot) => snapshots.push(snapshot));
  await vi.waitFor(() => expect(snapshots.at(-1)?.annotations).toBeDefined());
  return snapshots;
}

describe("nexAnnotationSession", () => {
  it("shares one loaded model between the banks of a sidecar", async () => {
    const service = project();
    const first: AnnotationSessionSnapshot[] = [];
    const second: AnnotationSessionSnapshot[] = [];

    subscribeAnnotationSession(service, PATH, 5, (s) => first.push(s));
    subscribeAnnotationSession(service, PATH, 5, (s) => second.push(s));

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

    updateAnnotationSession(PATH, annotationsWith(2));

    // --- Published before the write: the listing must not wait on the disk.
    expect(first.at(-1)).toMatchObject({
      dirty: true,
      annotations: { banks: { "5": { offsetIndex: 2 } } }
    });
    expect(second.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(2);

    await flushAnnotationSession(PATH);

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
    updateAnnotationSession(PATH, annotationsWith(2));
    await vi.waitFor(() => expect(saveFileContent).toHaveBeenCalledTimes(1));

    // --- Three more edits arrive while it is still in the air.
    updateAnnotationSession(PATH, annotationsWith(3));
    updateAnnotationSession(PATH, annotationsWith(4));
    updateAnnotationSession(PATH, annotationsWith(5));
    await Promise.resolve();
    // --- None of them started a second write alongside the first.
    expect(saveFileContent).toHaveBeenCalledTimes(1);

    release!();
    await flushAnnotationSession(PATH);

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

    updateAnnotationSession(PATH, annotationsWith(2));
    await flushAnnotationSession(PATH);

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

    updateAnnotationSession(PATH, annotationsWith(2));
    await flushAnnotationSession(PATH);
    expect(snapshots.at(-1)?.saveError).toBeDefined();

    // --- No retry loop of its own: the next edit is what tries again.
    updateAnnotationSession(PATH, annotationsWith(3));
    await flushAnnotationSession(PATH);

    expect(snapshots.at(-1)?.saveError).toBeUndefined();
    expect(snapshots.at(-1)?.dirty).toBe(false);
    expect(saveFileContent.mock.calls.at(-1)?.[1]).toContain('"offsetIndex": 3');
  });

  it("holds an edit made before any writer is known, and writes it on subscribe", async () => {
    // --- The `nex-label` command can edit a sidecar whose session exists but has no subscriber yet.
    updateAnnotationSession(PATH, annotationsWith(7));

    const service = project();
    await subscribed(service);
    updateAnnotationSession(PATH, annotationsWith(8));
    await flushAnnotationSession(PATH);

    expect(service.saveFileContent).toHaveBeenCalledWith(
      PATH,
      expect.stringContaining('"offsetIndex": 8')
    );
  });

  describe("seeding", () => {
    it("serves a seeded model to subscribers without reading the file", () => {
      const service = project();
      const seeded = annotationsWith(2);
      seedAnnotationSession(PATH, seeded);

      const snapshots: AnnotationSessionSnapshot[] = [];
      subscribeAnnotationSession(service, PATH, 5, (snapshot) => snapshots.push(snapshot));

      expect(service.readFileContent).not.toHaveBeenCalled();
      expect(snapshots.at(-1)?.annotations).toBe(seeded);
      expect(snapshots.at(-1)?.dirty).toBe(false);
    });

    it("never replaces a model the session already holds", async () => {
      // --- A pop-out's edit may still be on its way to disk; a viewer's fresh read is older news.
      const service = project();
      await subscribed(service);
      const edited = annotationsWith(3);
      updateAnnotationSession(PATH, edited, service);

      seedAnnotationSession(PATH, annotationsWith(0));

      expect(peekAnnotationSession(PATH)).toBe(edited);
      await flushAnnotationSession(PATH);
    });

    it("does not interrupt a load already in flight", async () => {
      const service = project();
      const snapshots = await subscribed(service);
      seedAnnotationSession(PATH, annotationsWith(0));
      expect(snapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(1);
    });
  });
});

describe("annotation files changed by another program", () => {
  /** A project whose file holds whatever `disk.text` says now */
  function changingProject(initial = sidecar(1)) {
    const disk = { text: initial as string | undefined };
    const service = {
      readFileContent: vi.fn(() =>
        disk.text === undefined
          ? Promise.reject(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }))
          : Promise.resolve(disk.text)
      ),
      saveFileContent: vi.fn((_path: string, text: string) => {
        disk.text = text;
        return Promise.resolve();
      })
    };
    return { disk, service };
  }

  it("publishes the file's new content to every subscriber, marked as reloaded", async () => {
    const { disk, service } = changingProject();
    const first = await subscribed(service);
    const second = await subscribed(service);

    disk.text = sidecar(2);
    await reloadAnnotationSessionFromDisk(PATH);

    for (const snapshots of [first, second]) {
      expect(snapshots.at(-1)).toMatchObject({ dirty: false, reloaded: true });
      expect(snapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(2);
    }
    // --- The file already holds it: nothing is written back
    expect(service.saveFileContent).not.toHaveBeenCalled();
    // --- Marked on that one snapshot only
    updateAnnotationSession(PATH, annotationsWith(3));
    expect(first.at(-1)?.reloaded).toBeUndefined();
    await flushAnnotationSession(PATH);
  });

  it("ignores the session's own write, which the watcher reports like any other", async () => {
    const { service } = changingProject();
    const snapshots = await subscribed(service);
    updateAnnotationSession(PATH, annotationsWith(4), service);
    await flushAnnotationSession(PATH);
    const count = snapshots.length;

    await reloadAnnotationSessionFromDisk(PATH);

    expect(snapshots.length).toBe(count);
  });

  it("does not read the file while the session owes it a write", async () => {
    const { disk, service } = changingProject();
    let finishWrite = () => {};
    service.saveFileContent.mockImplementationOnce(
      (_path: string, text: string) =>
        new Promise<void>((resolve) => {
          finishWrite = () => {
            disk.text = text;
            resolve();
          };
        })
    );
    await subscribed(service);
    updateAnnotationSession(PATH, annotationsWith(5), service);
    const reads = service.readFileContent.mock.calls.length;

    await reloadAnnotationSessionFromDisk(PATH);

    expect(service.readFileContent.mock.calls.length).toBe(reads);
    expect(peekAnnotationSession(PATH)?.banks["5"].offsetIndex).toBe(5);
    finishWrite();
    await flushAnnotationSession(PATH);
  });

  it("drops a re-read that overlapped an edit, even one whose write already finished", async () => {
    // --- The bug this guards: the re-read sees no write owed after its read, publishes the file it
    // --- read before the edit landed, and the edit (a new label) vanishes a moment after it appeared
    const { disk, service } = changingProject();
    await subscribed(service);
    let releaseRead: (() => void) | undefined;
    service.readFileContent.mockImplementationOnce(() => {
      const before = disk.text!;
      return new Promise<string>((resolve) => {
        releaseRead = () => resolve(before);
      });
    });
    disk.text = sidecar(2);
    const reload = reloadAnnotationSessionFromDisk(PATH);
    // --- The re-read is reading the file when the edit arrives
    await vi.waitFor(() => expect(releaseRead).toBeDefined());

    updateAnnotationSession(PATH, annotationsWith(3), service);
    await flushAnnotationSession(PATH);
    releaseRead!();
    await reload;

    expect(peekAnnotationSession(PATH)?.banks["5"].offsetIndex).toBe(3);
    expect(disk.text).toContain('"offsetIndex": 3');
  });

  it("recognises its own write of a ROM sidecar, which stores no view settings", async () => {
    const rom = (labels: string) =>
      `{"schemaVersion":3,"machine":"rom","pages":{"0":{"crc32":"00000000","name":"t.rom"}},` +
      `"banks":{"0":{"offsetIndex":0,"regions":[{"start":0,"end":16383,"type":"disassemble"}],` +
      `"localLabels":[${labels}]}},"provenance":{"0:0:label":"observed"}}`;
    const { disk, service } = changingProject(rom('{"name":"START","value":0}'));
    const snapshots = await subscribed(service);
    const model = peekAnnotationSession(PATH)!;
    updateAnnotationSession(
      PATH,
      {
        ...model,
        banks: {
          "0": {
            ...model.banks["0"],
            lastView: "disassembly",
            localLabels: [...model.banks["0"].localLabels!, { name: "NEXT", value: 3 }]
          }
        }
      } as any,
      service
    );
    await flushAnnotationSession(PATH);
    expect(disk.text).toContain("NEXT");
    expect(disk.text).not.toContain("lastView");
    const count = snapshots.length;

    await reloadAnnotationSessionFromDisk(PATH);

    expect(snapshots.length).toBe(count);
    expect(peekAnnotationSession(PATH)?.banks["0"].lastView).toBe("disassembly");
  });

  it("keeps a ROM page's view settings when another program changes the file", async () => {
    const rom = (labels: string) =>
      `{"schemaVersion":3,"machine":"rom","pages":{"0":{"crc32":"00000000","name":"t.rom"}},` +
      `"banks":{"0":{"offsetIndex":0,"regions":[{"start":0,"end":16383,"type":"disassemble"}],` +
      `"localLabels":[${labels}]}},"provenance":{"0:0:label":"observed"${labels.includes("OTHER") ? ',"0:5:label":"observed"' : ""}}}`;
    const { disk, service } = changingProject(rom('{"name":"START","value":0}'));
    await subscribed(service);
    const model = peekAnnotationSession(PATH)!;
    updateAnnotationSession(
      PATH,
      { ...model, banks: { "0": { ...model.banks["0"], lastView: "disassembly" } } } as any,
      service
    );
    await flushAnnotationSession(PATH);

    disk.text = rom('{"name":"START","value":0},{"name":"OTHER","value":5}');
    await reloadAnnotationSessionFromDisk(PATH);

    const bank = peekAnnotationSession(PATH)!.banks["0"];
    expect(bank.localLabels?.map((label) => label.name)).toEqual(["START", "OTHER"]);
    expect(bank.lastView).toBe("disassembly");
  });

  it("keeps the last good model while the file does not parse", async () => {
    const { disk, service } = changingProject();
    const snapshots = await subscribed(service);
    const count = snapshots.length;

    disk.text = '{"schemaVersion": 1, "banks": {';
    await reloadAnnotationSessionFromDisk(PATH);

    expect(snapshots.length).toBe(count);
    expect(peekAnnotationSession(PATH)?.banks["5"].offsetIndex).toBe(1);
  });

  it("publishes a deleted file as missing", async () => {
    const { disk, service } = changingProject();
    const snapshots = await subscribed(service);

    disk.text = undefined;
    await reloadAnnotationSessionFromDisk(PATH);

    expect(snapshots.at(-1)).toMatchObject({ missing: true, reloaded: true });
    expect(snapshots.at(-1)?.annotations).toBeUndefined();
  });

  it("reads a burst of changes one after the other, ending on the newest", async () => {
    const { disk, service } = changingProject();
    const snapshots = await subscribed(service);

    disk.text = sidecar(2);
    const first = reloadAnnotationSessionFromDisk(PATH);
    disk.text = sidecar(3);
    await Promise.all([first, reloadAnnotationSessionFromDisk(PATH)]);

    expect(snapshots.at(-1)?.annotations?.banks["5"].offsetIndex).toBe(3);
  });

  it("asks for each followed file to be watched, and released when sessions go", async () => {
    const watch = { watch: vi.fn(), unwatch: vi.fn() };
    const { service } = changingProject();
    // --- A session made before the watch is installed is followed when it is
    await subscribed(service);
    setAnnotationFileWatch(watch);
    expect(watch.watch).toHaveBeenCalledWith(PATH);

    // --- Once per session, however many subscribe
    await subscribed(service);
    subscribeAnnotationSession(service, "/project/other.dis", undefined, () => {});
    expect(watch.watch.mock.calls).toEqual([[PATH], ["/project/other.dis"]]);

    clearAnnotationSessions();
    expect(watch.unwatch.mock.calls).toEqual([[PATH], ["/project/other.dis"]]);
  });

  it("never follows a read-only shipped sidecar", () => {
    const watch = { watch: vi.fn(), unwatch: vi.fn() };
    setAnnotationFileWatch(watch);
    seedReadOnlyAnnotationSession("/roms/sp48.rom.dis", annotationsWith(1));
    subscribeAnnotationSession(project(), "/roms/sp48.rom.dis", undefined, () => {});

    expect(watch.watch).not.toHaveBeenCalled();
  });
});
