import { describe, expect, it } from "vitest";

import type { NextRtcKeptEntry } from "@common/zxnext/nextRtcKept";
import { hostWallSeconds, rtcRegistersToSeconds } from "@emu/machines/zxNext/nextRtc";
import type { NextRtcStore } from "@emu/machines/zxNext/nextRtcHost";
import { createSession, type NextRtcOptions, type NextTestSession } from "../../harness/zxnext";
import { boot, driver, hexes, OVER_ONE_SECOND, regs, rtcRead, rtcWrite } from "./_i2c-helpers";

/*
 * The DS1307 as the host sees it (`dev/ai/zxnext-rtc.md`): the core's view of the chip
 * without a bus transaction, and the counts of what the bus wrote. The hardware itself is
 * i2c-rtc.test.ts's.
 */

/** A host clock the test moves by hand */
class FakeClock {
  ms = new Date(2026, 10, 3, 10, 0, 0).getTime();
  readonly now = () => this.ms;
  advance(seconds: number): void {
    this.ms += seconds * 1000;
  }
  /** The host's local time as wall seconds, as the clock compares it */
  get wall(): number {
    return hostWallSeconds(this.ms);
  }
}

/** The I2C driver on a machine whose clock options are set before setup */
async function rtcDriver(rtc: NextRtcOptions): Promise<NextTestSession> {
  return boot(await createSession({ rtc }));
}

/** Registers 0-6 as the next read sees them */
const timeRegs = (s: NextTestSession) => Array.from({ length: 7 }, (_, i) => s.rtcRegister(i));
/** The time the clock shows, in wall seconds */
const shown = (s: NextTestSession) => rtcRegistersToSeconds(timeRegs(s));

describe("The DS1307 seen from the host", () => {
  it("P1: a register peek follows the running clock and changes nothing", async () => {
    const s = await driver();
    s.setRtcTime({ year: 26, month: 12, date: 31, day: 5, hours: 23, minutes: 59, seconds: 59 });
    s.runFrames(OVER_ONE_SECOND);
    const peeked = Array.from({ length: 7 }, (_, i) => s.rtcRegister(i));
    expect(hexes(peeked), "a new year").toEqual(hexes(regs({ year: 27, month: 1, date: 1, day: 6, hours: 0, minutes: 0, seconds: 0 })));
    // --- Peeking twice gives the same; the bus then reads what the peek promised
    expect(Array.from({ length: 7 }, (_, i) => s.rtcRegister(i))).toEqual(peeked);
    expect(hexes(rtcRead(s, 0, 7)), "the bus agrees").toEqual(hexes(peeked));
  });

  it("P1: bus writes are counted, all and to the time; reads and the pointer byte are not", async () => {
    const s = await driver();
    expect(s.rtcWriteCounts()).toEqual({ all: 0, time: 0 });
    rtcRead(s, 0, 8);
    expect(s.rtcWriteCounts(), "a read").toEqual({ all: 0, time: 0 });
    rtcWrite(s, 0x08, [1, 2, 3]);
    expect(s.rtcWriteCounts(), "three RAM bytes").toEqual({ all: 3, time: 0 });
    rtcWrite(s, 0x05, [0x01, 0x27, 0x10]);
    expect(s.rtcWriteCounts(), "month, year (time) and control").toEqual({ all: 6, time: 2 });
    rtcWrite(s, 0x10, []);
    expect(s.rtcWriteCounts(), "the pointer alone").toEqual({ all: 6, time: 2 });
  });
});

describe("P3: the clock follows the host's clock", () => {
  it("setup seeds the host's time; after a pause the next frame catches up", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    expect(shown(s), "seeded").toBe(clock.wall);
    clock.advance(3600);
    expect(shown(s), "no frame ran yet").toBe(clock.wall - 3600);
    s.runFrames(1);
    expect(shown(s), "an hour later").toBe(clock.wall);
    expect(rtcRead(s, 0, 7), "the bus reads it too").toEqual(timeRegs(s));
  });

  it("a time the program sets is kept as an offset and follows the host from there", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    const set = regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 4, seconds: 5 });
    rtcWrite(s, 0, set);
    s.runFrames(1);
    clock.advance(600);
    s.runFrames(1);
    expect(hexes(timeRegs(s)), "ten minutes on").toEqual(hexes(regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 14, seconds: 5 })));
  });

  it("emulated time run ahead of the host is pulled back", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    const start = clock.wall;
    s.runFrames(3 * OVER_ONE_SECOND);
    expect(shown(s)! - start, "three emulated seconds, the host stood still").toBe(3);
    clock.advance(1);
    s.runFrames(1);
    expect(shown(s)! - start, "back to the host's one second").toBe(1);
  });

  it("a stopped oscillator (CH) is left alone; clearing CH follows from the time set", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    rtcWrite(s, 0, [0x80 | 0x30]);
    const stopped = timeRegs(s);
    clock.advance(3600);
    s.runFrames(2);
    expect(hexes(timeRegs(s)), "stopped").toEqual(hexes(stopped));
    rtcWrite(s, 0, [0x30]);
    s.runFrames(1);
    const restarted = shown(s)!;
    clock.advance(5);
    s.runFrames(1);
    expect(shown(s)! - restarted).toBe(5);
  });

  it("12-hour mode and the program's day numbering survive a sync", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    // --- Friday 18 September 2026, 11:59:50 PM, with Monday = 1 (Friday = 5)
    rtcWrite(s, 0, [0x50, 0x59, 0x40 | 0x20 | 0x11, 5, 0x18, 0x09, 0x26]);
    s.runFrames(1);
    clock.advance(20);
    s.runFrames(1);
    expect(hexes(timeRegs(s)), "12:00:10 AM, Saturday = 6").toEqual(hexes([0x10, 0x00, 0x52, 6, 0x19, 0x09, 0x26]));
  });

  it("switching modes keeps the time shown; emulated time does not follow the host", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ clock: "host", now: clock.now });
    rtcWrite(s, 0, regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 4, seconds: 5 }));
    s.runFrames(1);
    const before = shown(s)!;
    s.setRtcOptions({ clock: "emulated" });
    expect(shown(s), "switched to emulated").toBe(before);
    clock.advance(3600);
    s.runFrames(1);
    expect(shown(s), "the host's hour is not followed").toBe(before);
    s.setRtcOptions({ clock: "host" });
    expect(shown(s), "switched back").toBe(before);
    clock.advance(10);
    s.runFrames(1);
    expect(shown(s)! - before, "followed from the switch").toBe(10);
  });

  it("Set to host time works in emulated mode too", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ now: clock.now });
    rtcWrite(s, 0, regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 4, seconds: 5 }));
    clock.advance(42);
    await s.rtcCommand("setToHost");
    expect(shown(s)).toBe(clock.wall);
    expect(s.rtcRegister(3), "Sunday = 1 numbering").toBe(new Date(clock.ms).getDay() + 1);
  });

  it("unset options are emulated time: the host's clock is only read at setup", async () => {
    const clock = new FakeClock();
    const s = await rtcDriver({ now: clock.now });
    expect(shown(s)).toBe(clock.wall);
    clock.advance(3600);
    s.runFrames(2);
    expect(shown(s)).toBe(clock.wall - 3600);
  });
});

/** A store in memory that records what the machine asks of it */
class FakeStore implements NextRtcStore {
  readonly entries = new Map<string, NextRtcKeptEntry>();
  loads = 0;
  readonly saves: { profileId: string; entry: NextRtcKeptEntry }[] = [];
  async load(profileId: string): Promise<NextRtcKeptEntry | undefined> {
    this.loads++;
    return this.entries.get(profileId);
  }
  async save(profileId: string, entry: NextRtcKeptEntry): Promise<void> {
    this.saves.push({ profileId, entry });
    this.entries.set(profileId, entry);
  }
}

describe("P4: keeping the clock between sessions", () => {
  const RAM = Array.from({ length: 56 }, (_, i) => (i * 11 + 3) & 0xff);

  it("setup loads the model's kept clock: the time against the host, the control byte and the RAM", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    store.entries.set("ks2-30201", {
      time: { offsetSeconds: 3600, dayOffset: 0, hours12: false },
      regs: [0, 0, 0, 1, 1, 1, 0],
      control: 0x10,
      ram: RAM,
      savedAt: 0
    });
    const s = await rtcDriver({ clock: "host", keep: true, store, now: clock.now });
    expect(shown(s), "an hour ahead of the host").toBe(clock.wall + 3600);
    expect(rtcRead(s, 7, 1), "control").toEqual([0x10]);
    expect(rtcRead(s, 0x08, 56), "RAM").toEqual(RAM);
    expect(store.saves, "loading is no change").toHaveLength(0);
  });

  it("a stopped clock is loaded as its registers", async () => {
    const store = new FakeStore();
    const stopped = [0x80 | 0x12, 0x34, 0x05, 3, 0x04, 0x05, 0x26];
    store.entries.set("ks2-30201", { regs: stopped, control: 0, ram: RAM, savedAt: 0 });
    const s = await rtcDriver({ keep: true, store, now: new FakeClock().now });
    expect(hexes(timeRegs(s))).toEqual(hexes(stopped));
  });

  it("bus writes are saved once, a second after the last; other models stay apart", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    const s = await rtcDriver({ clock: "host", keep: true, store, now: clock.now });
    expect(store.saves, "nothing kept yet, nothing changed").toHaveLength(0);
    rtcWrite(s, 0x08, [1, 2, 3]);
    rtcWrite(s, 0x00, regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 4, seconds: 5 }));
    s.runFrames(2);
    expect(store.saves, "not yet").toHaveLength(0);
    clock.advance(1);
    s.runFrames(2);
    expect(store.saves).toHaveLength(1);
    const { profileId, entry } = store.saves[0];
    expect(profileId).toBe("ks2-30201");
    expect(entry.ram.slice(0, 3)).toEqual([1, 2, 3]);
    expect(entry.time?.offsetSeconds, "the set time against the host").toBe(
      rtcRegistersToSeconds(regs({ year: 30, month: 1, date: 2, day: 4, hours: 3, minutes: 4, seconds: 5 }))! - (clock.wall - 1)
    );
    expect(entry.savedAt).toBe(clock.ms);
  });

  it("keep off reads and writes nothing; turned on, it saves once at once", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    const s = await rtcDriver({ clock: "host", keep: false, store, now: clock.now });
    rtcWrite(s, 0x08, [9]);
    clock.advance(5);
    s.runFrames(2);
    expect([store.loads, store.saves.length], "keep off").toEqual([0, 0]);
    s.setRtcOptions({ keep: true });
    expect(store.saves).toHaveLength(1);
    expect(store.saves[0].entry.ram[0]).toBe(9);
    s.setRtcOptions({ keep: true });
    expect(store.saves, "no change, no save").toHaveLength(1);
  });

  it("an emulated clock that drifted from its kept offset is saved again", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    const s = await rtcDriver({ clock: "emulated", keep: true, store, now: clock.now });
    s.setRtcOptions({ keep: false }).setRtcOptions({ keep: true });
    expect(store.saves, "kept now").toHaveLength(1);
    clock.advance(60);
    s.runFrames(1);
    expect(store.saves, "the minute the machine stood still").toHaveLength(2);
    expect(store.saves[1].entry.time!.offsetSeconds - store.saves[0].entry.time!.offsetSeconds).toBe(-60);
  });

  it("Forget clears the RAM, seeds the host's time and saves nothing until the program writes", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    store.entries.set("ks2-30201", { time: { offsetSeconds: -86400, dayOffset: 0, hours12: false }, regs: [0, 0, 0, 1, 1, 1, 0], control: 0, ram: RAM, savedAt: 0 });
    const s = await rtcDriver({ clock: "host", keep: true, store, now: clock.now });
    await s.rtcCommand("forget");
    expect(rtcRead(s, 0x08, 56), "RAM cleared").toEqual(new Array(56).fill(0));
    expect(shown(s), "the host's time").toBe(clock.wall);
    clock.advance(60);
    s.runFrames(2);
    expect(store.saves, "nothing to save").toHaveLength(0);
    expect(shown(s), "still follows the host").toBe(clock.wall);
  });

  it("Set to host time saves a kept clock", async () => {
    const clock = new FakeClock();
    const store = new FakeStore();
    const s = await rtcDriver({ clock: "emulated", keep: true, store, now: clock.now });
    clock.advance(30);
    await s.rtcCommand("setToHost");
    expect(store.saves).toHaveLength(1);
    expect(store.saves[0].entry.time?.offsetSeconds).toBe(0);
  });
});
