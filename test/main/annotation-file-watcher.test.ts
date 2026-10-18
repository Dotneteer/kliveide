import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOTATION_CHANGE_SETTLE_MS, AnnotationFileWatcher } from "@main/annotation-file-watcher";

/*
 * The watcher follows real folders here: what it must survive is how editors actually save
 * (in place, or a new file renamed over the old one), which a mocked `fs.watch` cannot show.
 */

// --- The app's own settle time: under load FSEvents delivers one save's events up to ~50 ms apart,
// --- so a shorter one splits a burst into two reports
const SETTLE_MS = ANNOTATION_CHANGE_SETTLE_MS;

let folder: string;
let changes: string[];
let watcher: AnnotationFileWatcher;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-ann-watch-"));
  changes = [];
  watcher = new AnnotationFileWatcher((filePath) => changes.push(filePath), SETTLE_MS);
});

afterEach(() => {
  watcher.dispose();
  fs.rmSync(folder, { recursive: true, force: true });
});

const sidecar = (name = "zx81.rom.dis") => path.join(folder, name);

/*
 * macOS watches a folder through FSEvents, whose stream starts asynchronously: a change made in the
 * first moments after `fs.watch()` can be lost. Under load (the full test run, with many tests
 * writing files) that window grows, and a test that writes straight after `watch()` waits for an
 * event that never comes. So a test that expects a report first waits until the watch is live:
 * it rewrites the file until the watcher reports it, then lets the report settle and clears it.
 */
async function watchLive(filePath: string, watchAs = filePath): Promise<void> {
  watcher.watch(watchAs);
  await vi.waitFor(
    () => {
      if (!changes.length) fs.writeFileSync(filePath, fs.readFileSync(filePath));
      expect(changes.length).toBeGreaterThan(0);
    },
    // --- Rewrites spaced wider than the settle time, or each one would restart it and none report
    { timeout: 10_000, interval: SETTLE_MS * 3 }
  );
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 3));
  changes.length = 0;
}

/** Events arrive within ~50 ms even under heavy file churn once the watch is live; this is slack */
const EVENT_WAIT = { timeout: 5_000 };

describe("AnnotationFileWatcher", () => {
  it("reports a file written in place, once per burst of writes", async () => {
    fs.writeFileSync(sidecar(), "{}");
    expect(watcher.watch(sidecar())).toBe(true);
    watcher.unwatch(sidecar());
    await watchLive(sidecar());

    fs.writeFileSync(sidecar(), '{"a":1}');
    fs.appendFileSync(sidecar(), " ");

    await vi.waitFor(() => expect(changes).toEqual([sidecar()]), EVENT_WAIT);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 3));
    expect(changes).toEqual([sidecar()]);
  });

  it("keeps reporting after a save that renames a new file over the old one", async () => {
    fs.writeFileSync(sidecar(), "{}");
    await watchLive(sidecar());

    for (const text of ['{"a":1}', '{"a":2}']) {
      changes.length = 0;
      const temp = path.join(folder, "zx81.rom.dis.tmp");
      fs.writeFileSync(temp, text);
      fs.renameSync(temp, sidecar());
      await vi.waitFor(() => expect(changes).toContain(sidecar()), EVENT_WAIT);
    }
  });

  it("does not report files it was not asked to follow", async () => {
    fs.writeFileSync(sidecar(), "{}");
    watcher.watch(sidecar());
    // --- macOS may still deliver the creation of the file just made; a stray report is harmless
    // --- (the IDE compares the file with its model), but would hide what this test looks for
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 4));
    changes.length = 0;

    fs.writeFileSync(sidecar("other.dis"), "{}");
    fs.writeFileSync(path.join(folder, "notes.txt"), "x");
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 4));
    expect(changes).toEqual([]);
  });

  it("counts follows, and stops with the last release", async () => {
    fs.writeFileSync(sidecar(), "{}");
    watcher.watch(sidecar());
    watcher.watch(sidecar());

    watcher.unwatch(sidecar());
    expect(watcher.watched()).toEqual([sidecar()]);
    watcher.unwatch(sidecar());
    expect(watcher.watched()).toEqual([]);

    fs.writeFileSync(sidecar(), '{"a":1}');
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 4));
    expect(changes).toEqual([]);
  });

  it("refuses what is not an absolute sidecar path, or a folder that does not exist", () => {
    expect(watcher.watch("zx81.rom.dis")).toBe(false);
    expect(watcher.watch(path.join(folder, "zx81.rom"))).toBe(false);
    expect(watcher.watch(path.join(folder, "missing", "zx81.rom.dis"))).toBe(false);
    expect(watcher.watched()).toEqual([]);
  });

  it("reports the path exactly as it was given", async () => {
    const spelled = `${folder}${path.sep}.${path.sep}zx81.rom.dis`;
    fs.writeFileSync(sidecar(), "{}");
    await watchLive(sidecar(), spelled);

    fs.writeFileSync(sidecar(), '{"a":1}');
    await vi.waitFor(() => expect(changes).toEqual([spelled]), EVENT_WAIT);
  });
});
