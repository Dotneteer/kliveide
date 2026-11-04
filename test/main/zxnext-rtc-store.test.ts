import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { NextRtcKeptEntry, NextRtcKeptState } from "@common/zxnext/nextRtcKept";
import { NEXT_RTC_FILE, NextRtcStoreFile } from "@main/zxnext-rtc-store";

/*
 * `zxnext-rtc.json` (`dev/ai/zxnext-rtc.md` D5, D8): one kept clock per Next model, and
 * the `nextRtcKept` state the Settings dialog's Kept clock row reads.
 */

const entry = (savedAt: number, offsetSeconds = 0): NextRtcKeptEntry => ({
  time: { offsetSeconds, dayOffset: 0, hours12: false },
  regs: [0x56, 0x34, 0x12, 6, 0x18, 0x09, 0x26],
  control: 0x10,
  ram: Array.from({ length: 56 }, (_, i) => (i * 37 + 5) & 0xff),
  savedAt
});

describe("The ZX Spectrum Next's kept clocks file", () => {
  let folder: string;
  let published: NextRtcKeptState[];
  let store: NextRtcStoreFile;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-rtc-"));
    published = [];
    store = new NextRtcStoreFile(
      () => folder,
      (s) => published.push(s)
    );
  });

  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  it("a missing file holds nothing", () => {
    expect(store.load("ks2-30201")).toBeUndefined();
    store.publish();
    expect(published).toEqual([{}]);
  });

  it("an entry round-trips; the RAM is base64 on disk", () => {
    store.save("ks2-30201", entry(1000, -3600));
    expect(store.load("ks2-30201")).toEqual(entry(1000, -3600));
    const onDisk = JSON.parse(fs.readFileSync(path.join(folder, NEXT_RTC_FILE), "utf8"));
    expect(onDisk.version).toBe(1);
    expect(typeof onDisk.profiles["ks2-30201"].ram).toBe("string");
  });

  it("a stopped clock keeps its registers and no offset", () => {
    const stopped = { ...entry(5), time: undefined, regs: [0xb0, 0, 0, 1, 1, 1, 0x26] };
    store.save("ks2-30201", stopped);
    expect(store.load("ks2-30201")).toEqual(stopped);
  });

  it("each model keeps its own; forgetting one leaves the other", () => {
    store.save("ks2-30201", entry(1));
    store.save("ks2-30204", entry(2));
    expect(store.forget("ks2-30201")).toBe(true);
    expect(store.forget("ks2-30201"), "already gone").toBe(false);
    expect(store.load("ks2-30201")).toBeUndefined();
    expect(store.load("ks2-30204")).toEqual(entry(2));
  });

  it("nextRtcKept follows every save and forget", () => {
    store.save("ks2-30201", entry(1));
    store.save("ks2-30204", entry(2));
    store.forget("ks2-30201");
    expect(published).toEqual([{ "ks2-30201": { savedAt: 1 } }, { "ks2-30201": { savedAt: 1 }, "ks2-30204": { savedAt: 2 } }, { "ks2-30204": { savedAt: 2 } }]);
  });

  it("another version, a broken file or a bad entry hold nothing, and a save replaces them", () => {
    const file = path.join(folder, NEXT_RTC_FILE);
    fs.writeFileSync(file, JSON.stringify({ version: 2, profiles: { "ks2-30201": entry(1) } }));
    expect(store.load("ks2-30201"), "another version").toBeUndefined();
    fs.writeFileSync(file, "{ not json");
    expect(store.load("ks2-30201"), "broken").toBeUndefined();
    fs.writeFileSync(file, JSON.stringify({ version: 1, profiles: { "ks2-30201": { ...entry(1), ram: "AAAA" } } }));
    expect(store.load("ks2-30201"), "3 RAM bytes").toBeUndefined();
    store.save("ks2-30201", entry(9));
    expect(store.load("ks2-30201")).toEqual(entry(9));
  });

  it("refuses to save an entry that is not one", () => {
    expect(() => store.save("ks2-30201", { ...entry(1), ram: [1, 2, 3] })).toThrow();
  });
});
