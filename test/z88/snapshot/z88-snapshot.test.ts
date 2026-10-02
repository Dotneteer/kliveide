import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseJavaProperties, decodeLatin1 } from "@common/z88/z88Properties";
import { readZipEntries } from "@common/z88/z88Zip";
import { parseZ88Snapshot, type Z88Snapshot } from "@common/z88/z88Snapshot";
import { adjustZ88LostTime, decodeZ88Tim, encodeZ88Tim } from "@common/z88/z88Rtc";
import { mapZ88SnapshotToKlive, ozvmCardTypeName } from "@common/z88/z88SnapshotMapping";
import { CardIds } from "@emu/machines/z88/CardIds";

const K = 1024;
const FIXTURE = join(__dirname, "fixtures", "mm+jsw-oz5.z88");

/** The settings of a minimal valid snapshot (the spec's "Minimal snapshot.settings" example) */
const MINIMAL_SETTINGS: Record<string, string> = {
  AF: "0044",
  BC: "0000",
  DE: "0000",
  HL: "0000",
  IX: "0000",
  IY: "0000",
  PC: "0026",
  SP: "1FFE",
  _AF: "0000",
  _BC: "0000",
  _DE: "0000",
  _HL: "0000",
  I: "00",
  R: "01",
  IM: "01",
  IFF1: "true",
  IFF2: "true",
  PB0: "2600",
  PB1: "2A00",
  PB2: "2000",
  PB3: "2320",
  SBR: "2200",
  SCW: "0050",
  SCH: "0008",
  COM: "05",
  INT: "23",
  STA: "00",
  TMK: "01",
  TSTA: "00",
  SR0: "20",
  SR1: "21",
  SR2: "22",
  SR3: "23",
  TIM0: "00",
  TIM1: "00",
  TIM2: "00",
  TIM3: "00",
  TIM4: "00",
  SLOT0TYPE: "1",
  SLOT1TYPE: "0",
  SLOT2TYPE: "0",
  SLOT3TYPE: "0",
  Z88StoppedAtTime: "1727431200000",
  Breakpoints: "",
  Autorun: "true"
};

type BuildOptions = {
  /** Settings to add or override; `undefined` removes a key */
  settings?: Record<string, string | undefined>;
  /** Extra or replaced members; `undefined` removes one */
  members?: Record<string, Uint8Array | undefined>;
  /** Store (level 0) instead of deflating */
  store?: boolean;
};

/** Builds a `.z88` file: 512K ROM, 128K RAM, empty slots, unless overridden */
function buildSnapshot(options: BuildOptions = {}): Uint8Array {
  const settings: Record<string, string | undefined> = { ...MINIMAL_SETTINGS, ...options.settings };
  const text =
    "#Tue Sep 27 12:00:00 CEST 2026\n" +
    Object.entries(settings)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n";
  const members: Record<string, Uint8Array | undefined> = {
    "snapshot.settings": strToU8(text),
    "rom.bin": filled(512 * K, 0x11),
    "ram.bin": filled(128 * K, 0x22),
    ...options.members
  };
  const zipInput: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(members)) {
    if (data) zipInput[name] = data;
  }
  return zipSync(zipInput, { level: options.store ? 0 : 9 });
}

function filled(length: number, value: number): Uint8Array {
  return new Uint8Array(length).fill(value);
}

describe("Z88 snapshot - Java properties", () => {
  it("reads key=value and key:value, skipping comments and blank lines", () => {
    const props = parseJavaProperties("#comment\n! other\n\nA=1\nB:2\n  C = 3\n");
    expect([...props.entries()]).toEqual([
      ["A", "1"],
      ["B", "2"],
      ["C", "3"]
    ]);
  });

  it("accepts every line ending", () => {
    const props = parseJavaProperties("A=1\r\nB=2\rC=3\n");
    expect(props.get("A")).toBe("1");
    expect(props.get("B")).toBe("2");
    expect(props.get("C")).toBe("3");
  });

  it("treats whitespace as a separator and keeps an empty value", () => {
    const props = parseJavaProperties("A 1\nBreakpoints=\nC\n");
    expect(props.get("A")).toBe("1");
    expect(props.get("Breakpoints")).toBe("");
    expect(props.get("C")).toBe("");
  });

  it("joins continuation lines and drops the next line's leading whitespace", () => {
    const props = parseJavaProperties("A=one\\\n    two\nB=x\\\\\nC=y\n");
    expect(props.get("A")).toBe("onetwo");
    // --- An even number of backslashes is an escaped backslash, not a continuation
    expect(props.get("B")).toBe("x\\");
    expect(props.get("C")).toBe("y");
  });

  it("unescapes keys and values", () => {
    const props = parseJavaProperties("a\\=b\\:c=\\t\\u0041\\#\n");
    expect(props.get("a=b:c")).toBe("\tA#");
  });

  it("lets a later duplicate win", () => {
    expect(parseJavaProperties("A=1\nA=2\n").get("A")).toBe("2");
  });

  it("rejects a malformed unicode escape", () => {
    expect(() => parseJavaProperties("A=\\u12G4\n")).toThrow(/Malformed/);
  });

  it("decodes ISO-8859-1", () => {
    expect(decodeLatin1(new Uint8Array([0x41, 0xe9, 0xff]))).toBe("A\u00e9\u00ff");
  });
});

describe("Z88 snapshot - ZIP", () => {
  it("reads stored and deflated members alike", () => {
    const data = { "a.bin": filled(40000, 7), "b.txt": strToU8("hello") };
    for (const level of [0, 9] as const) {
      const entries = readZipEntries(zipSync(data, { level }));
      expect(entries.get("a.bin")).toEqual(data["a.bin"]);
      expect(entries.get("b.txt")).toEqual(data["b.txt"]);
    }
  });

  it("drops directory entries", () => {
    const entries = readZipEntries(zipSync({ "dir/": new Uint8Array(0), "x": filled(1, 1) }));
    expect([...entries.keys()]).toEqual(["x"]);
  });

  it("reports bytes that are not a ZIP", () => {
    expect(() => readZipEntries(strToU8("definitely not a zip"))).toThrow(/Not a ZIP archive/);
  });
});

describe("Z88 snapshot - RTC catch-up", () => {
  it("decodes and encodes each register's weight", () => {
    expect(decodeZ88Tim([1, 0, 0, 0, 0])).toBe(5);
    expect(decodeZ88Tim([0, 1, 0, 0, 0])).toBe(1000);
    expect(decodeZ88Tim([0, 0, 1, 0, 0])).toBe(60_000);
    expect(decodeZ88Tim([0, 0, 0, 1, 0])).toBe(15_360_000);
    expect(decodeZ88Tim([0, 0, 0, 0, 1])).toBe(3_932_160_000);
    for (const tim of [
      [0x28, 0x1e, 0x0a, 0, 0],
      [199, 59, 255, 255, 255],
      [0, 0, 0, 0, 0]
    ] as const) {
      expect(encodeZ88Tim(decodeZ88Tim(tim))).toEqual(tim);
    }
  });

  it("matches the spec's worked example (5 hours later)", () => {
    const stoppedAt = 1727431200000;
    const result = adjustZ88LostTime([0x28, 0x1e, 0x0a, 0x00, 0x00], stoppedAt, stoppedAt + 18_000_000);
    expect(result).toEqual([0x28, 0x1e, 0x36, 0x01, 0x00]);
  });

  it("never runs the clock backwards", () => {
    const tim = [10, 20, 30, 40, 50] as const;
    expect(adjustZ88LostTime(tim, 2_000, 1_000)).toEqual(tim);
  });

  it("does nothing without a stop time", () => {
    const tim = [10, 20, 30, 40, 50] as const;
    expect(adjustZ88LostTime(tim, undefined, Date.now())).toEqual(tim);
  });

  it("wraps TIM4 at 8 bits", () => {
    const result = adjustZ88LostTime([0, 0, 0, 0, 255], 0, 65536 * 60_000);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("normalises an out-of-range TIM0 into the next second", () => {
    expect(adjustZ88LostTime([200, 0, 0, 0, 0], 0, 0)).toEqual([0, 1, 0, 0, 0]);
  });
});

describe("Z88 snapshot - parser", () => {
  it("reads the spec's minimal snapshot", () => {
    for (const store of [false, true]) {
      const s = parseZ88Snapshot(buildSnapshot({ store }));
      expect(s.cpu).toEqual({
        af: 0x0044,
        bc: 0,
        de: 0,
        hl: 0,
        ix: 0,
        iy: 0,
        pc: 0x0026,
        sp: 0x1ffe,
        af_: 0,
        bc_: 0,
        de_: 0,
        hl_: 0,
        i: 0,
        r: 1,
        im: 1,
        iff1: true,
        iff2: true
      });
      expect(s.blink).toEqual({
        com: 0x05,
        int: 0x23,
        sta: 0,
        tmk: 0x01,
        tsta: 0,
        sr: [0x20, 0x21, 0x22, 0x23],
        tim: [0, 0, 0, 0, 0],
        pb: [0x2600, 0x2a00, 0x2000, 0x2320],
        sbr: 0x2200,
        scw: 0x50,
        sch: 0x08
      });
      expect(s.rom.ozvmType).toBe(1);
      expect(s.rom.bytes.length).toBe(512 * K);
      expect(s.ram.length).toBe(128 * K);
      expect(s.slots).toEqual([null, null, null, null]);
      expect(s.autorun).toBe(true);
      expect(s.stoppedAt).toBe(1727431200000);
      expect(s.breakpoints).toEqual([]);
      expect(s.png).toBeUndefined();
      expect(s.warnings).toEqual([]);
    }
  });

  it("accepts lower-case hex", () => {
    const s = parseZ88Snapshot(buildSnapshot({ settings: { PC: "abcd" } }));
    expect(s.cpu.pc).toBe(0xabcd);
  });

  it("applies the spec's defaults", () => {
    const s = parseZ88Snapshot(
      buildSnapshot({
        settings: {
          SCW: undefined,
          SCH: undefined,
          Autorun: undefined,
          Z88StoppedAtTime: undefined,
          Breakpoints: undefined,
          SLOT0TYPE: undefined
        }
      })
    );
    expect(s.blink.scw).toBe(0x50);
    expect(s.blink.sch).toBe(0x08);
    expect(s.autorun).toBe(true);
    expect(s.stoppedAt).toBeUndefined();
    expect(s.breakpoints).toEqual([]);
    expect(s.rom.ozvmType).toBeUndefined();
  });

  it("reads Autorun as Java's Boolean.valueOf does", () => {
    expect(parseZ88Snapshot(buildSnapshot({ settings: { Autorun: "FALSE" } })).autorun).toBe(false);
    expect(parseZ88Snapshot(buildSnapshot({ settings: { Autorun: "TRUE" } })).autorun).toBe(true);
    expect(parseZ88Snapshot(buildSnapshot({ settings: { Autorun: "yes" } })).autorun).toBe(false);
  });

  it("reads breakpoints, skipping malformed ones", () => {
    const s = parseZ88Snapshot(
      buildSnapshot({ settings: { Breakpoints: "203F00,[d]000003, xyz ,C01234" } })
    );
    expect(s.breakpoints).toEqual([
      { bank: 0x20, offset: 0x3f00, display: false },
      { bank: 0x00, offset: 0x0003, display: true },
      { bank: 0xc0, offset: 0x1234, display: false }
    ]);
    expect(s.warnings).toEqual(["Ignored a malformed breakpoint: xyz"]);
  });

  it("reads external card slots", () => {
    const s = parseZ88Snapshot(
      buildSnapshot({
        settings: { SLOT1TYPE: "2", SLOT2TYPE: "5" },
        members: { "slot1.bin": filled(128 * K, 0x33), "slot2.bin": filled(1024 * K, 0x44) }
      })
    );
    expect(s.slots[1]).toEqual({ ozvmType: 2, bytes: filled(128 * K, 0x33) });
    expect(s.slots[2]).toEqual({ ozvmType: 5, bytes: filled(1024 * K, 0x44) });
    expect(s.slots[3]).toBeNull();
  });

  it("reads hybrid cards, including the legacy single-image form", () => {
    const s = parseZ88Snapshot(
      buildSnapshot({
        settings: { SLOT2TYPE: "8", SLOT3TYPE: "12" },
        members: {
          "ram2.bin": filled(512 * K, 1),
          "flash2.bin": filled(512 * K, 2),
          "slot3.bin": filled(512 * K, 3)
        }
      })
    );
    expect(s.slots[2]).toEqual({ ozvmType: 8, ram: filled(512 * K, 1), flash: filled(512 * K, 2) });
    expect(s.slots[3]).toEqual({ ozvmType: 12, ram: undefined, flash: filled(512 * K, 3) });
    expect(s.warnings).toEqual([]);
  });

  it("reads an occupied slot without its image as empty, with a warning", () => {
    const s = parseZ88Snapshot(buildSnapshot({ settings: { SLOT1TYPE: "2" } }));
    expect(s.slots[1]).toBeNull();
    expect(s.warnings).toEqual(["Slot 1 has card type 2, but the snapshot has no slot1.bin"]);
  });

  it("warns about members the format does not define", () => {
    const s = parseZ88Snapshot(
      buildSnapshot({ members: { "notes.txt": strToU8("hi"), "slot2.bin": filled(32 * K, 0) } })
    );
    expect(s.warnings).toEqual([
      "Unused member in the snapshot: notes.txt",
      "Unused member in the snapshot: slot2.bin"
    ]);
  });

  it("lists the members with their sizes and keeps the PNG", () => {
    const png = strToU8("PNG!");
    const s = parseZ88Snapshot(buildSnapshot({ members: { "snapshot.png": png } }));
    expect(s.png).toEqual(png);
    expect(s.entries).toContainEqual({ name: "snapshot.png", size: 4 });
    expect(s.entries).toContainEqual({ name: "rom.bin", size: 512 * K });
  });

  it.each([
    ["no settings", { members: { "snapshot.settings": undefined } }, /no snapshot\.settings/],
    ["no ROM", { members: { "rom.bin": undefined } }, /no rom\.bin/],
    ["no RAM", { members: { "ram.bin": undefined } }, /no ram\.bin/],
    ["a partial bank", { members: { "ram.bin": filled(1000, 0) } }, /not a whole number of 16K banks/],
    ["an empty image", { members: { "ram.bin": new Uint8Array(0) } }, /not a whole number/],
    ["an oversized ROM", { members: { "rom.bin": filled(1024 * K, 0) } }, /larger than the 512K/],
    ["an oversized card", {
      settings: { SLOT1TYPE: "2" },
      members: { "slot1.bin": filled(2048 * K, 0) }
    }, /larger than the 1024K/],
    ["a missing register", { settings: { PC: undefined } }, /have no PC/],
    ["a missing slot type", { settings: { SLOT2TYPE: undefined } }, /have no SLOT2TYPE/],
    ["bad hex", { settings: { SP: "12G4" } }, /SP is not a hexadecimal number/],
    ["a 0x prefix", { settings: { SP: "0x1234" } }, /SP is not a hexadecimal number/],
    ["a byte out of range", { settings: { SR0: "100" } }, /SR0 is out of range/],
    ["a word out of range", { settings: { PC: "10000" } }, /PC is out of range/],
    ["a bad decimal", { settings: { SLOT1TYPE: "two" } }, /SLOT1TYPE is not a decimal number/],
    ["a bad interrupt mode", { settings: { IM: "03" } }, /Invalid interrupt mode/]
  ] as [string, BuildOptions, RegExp][])("rejects %s", (_, options, message) => {
    expect(() => parseZ88Snapshot(buildSnapshot(options))).toThrow(message);
  });

  it("rejects a file that is not a ZIP", () => {
    expect(() => parseZ88Snapshot(strToU8("PK? no"))).toThrow(/Not a ZIP archive/);
  });
});

describe("Z88 snapshot - mapping to Klive cards", () => {
  /** Maps a snapshot with one card in the given slot */
  function mapOne(slot: number, ozvmType: number, sizeK: number) {
    const options: BuildOptions =
      slot === 0
        ? {
            settings: { SLOT0TYPE: String(ozvmType) },
            members: { "rom.bin": filled(sizeK * K, 0) }
          }
        : {
            settings: { [`SLOT${slot}TYPE`]: String(ozvmType) },
            members: { [`slot${slot}.bin`]: filled(sizeK * K, 0) }
          };
    return mapZ88SnapshotToKlive(parseZ88Snapshot(buildSnapshot(options)));
  }

  it("maps the default snapshot: 512K ROM, 128K RAM", () => {
    const mapping = mapZ88SnapshotToKlive(parseZ88Snapshot(buildSnapshot()));
    expect(mapping.errors).toEqual([]);
    expect(mapping.intRamMask).toBe(0x07);
    expect(mapping.slots[0]).toMatchObject({
      ozvmType: 1,
      cardType: "ROM",
      sizeK: 512,
      spec: { kind: "ROM", sizeInBytes: 512 * K }
    });
    expect(mapping.slots.slice(1)).toEqual([null, null, null]);
  });

  it.each([
    [32, 0x01],
    [64, 0x03],
    [128, 0x07],
    [256, 0x0f],
    [512, 0x1f]
  ])("maps %iK internal RAM to chip mask %i", (sizeK, mask) => {
    const mapping = mapZ88SnapshotToKlive(
      parseZ88Snapshot(buildSnapshot({ members: { "ram.bin": filled(sizeK * K, 0) } }))
    );
    expect(mapping.intRamMask).toBe(mask);
    expect(mapping.errors).toEqual([]);
  });

  it("rejects an unsupported internal RAM size", () => {
    const mapping = mapZ88SnapshotToKlive(
      parseZ88Snapshot(buildSnapshot({ members: { "ram.bin": filled(48 * K, 0) } }))
    );
    expect(mapping.intRamMask).toBeUndefined();
    expect(mapping.errors).toEqual([expect.stringMatching(/Internal RAM of 48K/)]);
  });

  // --- [OZvm type, size K, Klive card type id] in an external slot (§4.2)
  it.each([
    [1, 32, CardIds.EPROMUV32],
    [1, 128, CardIds.EPROMUV128],
    [2, 32, CardIds.RAM32],
    [2, 128, CardIds.RAM128],
    [2, 256, CardIds.RAM256],
    [2, 512, CardIds.RAM512],
    [2, 1024, CardIds.RAM1024],
    [3, 32, CardIds.EPROMUV32],
    [3, 128, CardIds.EPROMUV128],
    [3, 256, CardIds.EPROMUV256],
    [4, 512, CardIds.IF28F004S5],
    [4, 1024, CardIds.IF28F008S5],
    [14, 512, CardIds.IF28F004S5],
    [14, 1024, CardIds.IF28F008S5],
    [5, 512, CardIds.AMDF29F040B],
    [5, 1024, CardIds.AMDF29F080B],
    [6, 512, CardIds.AMDF29F040B],
    [10, 512, CardIds.AMDF29F040B],
    [10, 1024, CardIds.AMDF29F080B],
    [11, 512, CardIds.AMDF29F040B],
    [13, 512, CardIds.AMDF29F040B]
  ])("maps OZvm type %i of %iK in slot 1 to %s", (ozvmType, sizeK, cardType) => {
    const mapping = mapOne(1, ozvmType, sizeK);
    expect(mapping.errors).toEqual([]);
    expect(mapping.slots[1]).toMatchObject({ ozvmType, cardType, sizeK });
    expect(mapping.slots[1]!.spec.sizeInBytes).toBe(sizeK * K);
  });

  it.each([
    [2, 64],
    [3, 512],
    [4, 128],
    [5, 128],
    [7, 32],
    [15, 512]
  ])("rejects OZvm type %i of %iK in slot 2", (ozvmType, sizeK) => {
    const mapping = mapOne(2, ozvmType, sizeK);
    expect(mapping.slots[2]).toBeNull();
    expect(mapping.errors).toEqual([expect.stringMatching(/^Slot 2: .* is not supported$/)]);
  });

  it.each([8, 9, 12])("rejects the hybrid type %i (D1)", (ozvmType) => {
    const mapping = mapZ88SnapshotToKlive(
      parseZ88Snapshot(
        buildSnapshot({
          settings: { SLOT3TYPE: String(ozvmType) },
          members: { "ram3.bin": filled(512 * K, 0), "flash3.bin": filled(512 * K, 0) }
        })
      )
    );
    expect(mapping.slots[3]).toBeNull();
    expect(mapping.errors).toEqual([
      expect.stringMatching(/^Slot 3 holds a .*hybrid.* card, which Klive does not support$/)
    ]);
  });

  // --- Slot 0 takes only ROM, EPROM and 512K Flash, of 128K, 256K or 512K
  it.each([
    [1, 128, "ROM"],
    [1, 256, "ROM"],
    [1, 512, "ROM"],
    [3, 128, CardIds.EPROMUV128],
    [3, 256, CardIds.EPROMUV256],
    [4, 512, CardIds.IF28F004S5],
    [5, 512, CardIds.AMDF29F040B],
    [13, 512, CardIds.AMDF29F040B]
  ])("maps OZvm type %i of %iK in slot 0 to %s", (ozvmType, sizeK, cardType) => {
    const mapping = mapOne(0, ozvmType, sizeK);
    expect(mapping.errors).toEqual([]);
    expect(mapping.slots[0]).toMatchObject({ ozvmType, cardType, sizeK });
  });

  it.each([
    [1, 32],
    [2, 128],
    [3, 32],
    [5, 256],
    [4, 256]
  ])("rejects OZvm type %i of %iK in slot 0", (ozvmType, sizeK) => {
    const mapping = mapOne(0, ozvmType, sizeK);
    expect(mapping.slots[0]).toBeNull();
    expect(mapping.errors).toEqual([expect.stringMatching(/in slot 0$/)]);
  });

  it("reads a ROM from an old file without SLOT0TYPE", () => {
    const mapping = mapZ88SnapshotToKlive(
      parseZ88Snapshot(buildSnapshot({ settings: { SLOT0TYPE: undefined } }))
    );
    expect(mapping.slots[0]).toMatchObject({ ozvmType: 1, cardType: "ROM", sizeK: 512 });
  });

  it("collects every problem, not just the first", () => {
    const mapping = mapZ88SnapshotToKlive(
      parseZ88Snapshot(
        buildSnapshot({
          settings: { SLOT1TYPE: "8", SLOT2TYPE: "5" },
          members: {
            "ram.bin": filled(48 * K, 0),
            "ram1.bin": filled(512 * K, 0),
            "slot2.bin": filled(128 * K, 0)
          }
        })
      )
    );
    expect(mapping.errors).toHaveLength(3);
  });

  it("names the OZvm card types", () => {
    expect(ozvmCardTypeName(10)).toBe("STM Flash");
    expect(ozvmCardTypeName(9)).toBe("AMIC hybrid 512K Flash + 512K RAM");
    expect(ozvmCardTypeName(7)).toBe("Unknown type 7");
  });
});

describe("Z88 snapshot - the issue #1397 sample (mm+jsw-oz5.z88)", () => {
  const snapshot: Z88Snapshot = parseZ88Snapshot(new Uint8Array(readFileSync(FIXTURE)));

  it("reads the Z80 state", () => {
    expect(snapshot.cpu).toEqual({
      af: 0x052a,
      bc: 0x1253,
      de: 0x2e4c,
      hl: 0xfbbe,
      ix: 0x3372,
      iy: 0x1fec,
      pc: 0xf523,
      sp: 0x1eba,
      af_: 0x5422,
      bc_: 0xbfbe,
      de_: 0xe7c1,
      hl_: 0xd402,
      i: 0x00,
      r: 0x7a,
      im: 1,
      iff1: false,
      iff2: false
    });
  });

  it("reads the Blink state", () => {
    expect(snapshot.blink).toEqual({
      com: 0x05,
      int: 0x3b,
      sta: 0x05,
      tmk: 0x07,
      tsta: 0x01,
      sr: [0x21, 0x22, 0xbe, 0xbf],
      tim: [0x51, 0x29, 0x0c, 0x00, 0x00],
      pb: [0x0434, 0x000d, 0x0043, 0x0019],
      sbr: 0x010f,
      scw: 0x50,
      sch: 0x08
    });
  });

  it("reads the memory and the session information", () => {
    expect(snapshot.rom.ozvmType).toBe(5);
    expect(snapshot.rom.bytes.length).toBe(512 * K);
    expect(snapshot.ram.length).toBe(128 * K);
    expect(snapshot.slots[1]).toBeNull();
    expect(snapshot.slots[2]).toMatchObject({ ozvmType: 3 });
    expect(snapshot.slots[2]!.bytes!.length).toBe(32 * K);
    expect(snapshot.slots[3]).toMatchObject({ ozvmType: 3 });
    expect(snapshot.slots[3]!.bytes!.length).toBe(32 * K);
    expect(snapshot.autorun).toBe(true);
    expect(snapshot.stoppedAt).toBe(1790714306337);
    expect(snapshot.breakpoints).toEqual([]);
    expect(snapshot.png).toBeDefined();
    expect(snapshot.warnings).toEqual([]);
  });

  it("maps to Klive cards: AMD Flash in slot 0, 32K EPROMs in slots 2 and 3", () => {
    const mapping = mapZ88SnapshotToKlive(snapshot);
    expect(mapping.errors).toEqual([]);
    expect(mapping.intRamMask).toBe(0x07);
    expect(mapping.slots[0]).toMatchObject({ cardType: CardIds.AMDF29F040B, sizeK: 512 });
    expect(mapping.slots[1]).toBeNull();
    expect(mapping.slots[2]).toMatchObject({ cardType: CardIds.EPROMUV32, sizeK: 32 });
    expect(mapping.slots[3]).toMatchObject({ cardType: CardIds.EPROMUV32, sizeK: 32 });
  });
});
