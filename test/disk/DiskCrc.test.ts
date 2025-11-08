import { describe, it, expect } from "vitest";
import { DiskCrc } from "@emu/machines/disk/DiskCrc";

describe("DiskCrc", () => {
  it("CRC works #1", () => {
    const crc = new DiskCrc();
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xfe);
    crc.add(0x00);
    crc.add(0x00);
    crc.add(0x01);
    crc.add(0x02);

    expect(crc.high).toEqual(0xca);
    expect(crc.low).toEqual(0x6f);
  });

  it("CRC works #2", () => {
    const crc = new DiskCrc();
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xfe);
    crc.add(0x00);
    crc.add(0x00);
    crc.add(0x02);
    crc.add(0x02);

    expect(crc.high).toEqual(0x9f);
    expect(crc.low).toEqual(0x3c);
  });

  it("CRC works #3", () => {
    const crc = new DiskCrc();
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xa1);
    crc.add(0xfb);
    for (let i = 0; i < 512; i++) {
      crc.add(0xe5);
    }
    expect(crc.high).toEqual(0xc4);
    expect(crc.low).toEqual(0x0b);
  });
});
