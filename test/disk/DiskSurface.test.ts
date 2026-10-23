import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createDiskSurface } from "@emu/machines/disk/DiskSurface";
import { DiskCrc } from "@emu/machines/disk/DiskCrc";
import { readDiskData } from "@emu/machines/disk/disk-readers";

describe("Disk Surface View", () => {
  it("createDiskSurfaceView works #1", () => {
    const diskInfo = readDiskData(readTestFile("blank180K.dsk"));
    const sv = createDiskSurface(diskInfo);
    expect(sv.tracks.length).toEqual(40);
    for (let trackIdx = 0; trackIdx < sv.tracks.length; trackIdx++) {
      const track = sv.tracks[trackIdx];

      // --- Test track length
      expect(track.trackData.length).toEqual(8596);

      // --- Test header
      expect(track.header.length).toEqual(48);
      for (let i = 0; i < 12; i++) {
        expect(track.header.get(i)).toEqual(0x00);
      }
      expect(track.header.get(12)).toEqual(0xa1);
      expect(track.header.get(13)).toEqual(0xa1);
      expect(track.header.get(14)).toEqual(0xa1);
      expect(track.header.get(15)).toEqual(0xfc);
      for (let i = 16; i < 48; i++) {
        expect(track.header.get(i)).toEqual(0x4e);
      }

      // --- Test sectors
      expect(track.sectors.length).toEqual(9);
      for (let sectorIdx = 0; sectorIdx < track.sectors.length; sectorIdx++) {
        const sector = track.sectors[sectorIdx];

        // --- Test sector header
        expect(sector.headerData.length).toEqual(44);
        for (let i = 0; i < 12; i++) {
          expect(sector.headerData.get(i)).toEqual(0x00);
        }
        let crc = new DiskCrc();
        expect(sector.headerData.get(12)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(13)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(14)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(15)).toEqual(0xfe);
        crc.add(0xfe);
        expect(sector.headerData.get(16)).toEqual(trackIdx);
        crc.add(trackIdx);
        expect(sector.headerData.get(17)).toEqual(0x00);
        crc.add(0x00);
        expect(sector.headerData.get(18)).toEqual(sectorIdx + 1);
        crc.add(sectorIdx + 1);
        expect(sector.headerData.get(19)).toEqual(0x02);
        crc.add(0x02);
        expect(sector.headerData.get(20)).toEqual(crc.high);
        expect(sector.headerData.get(21)).toEqual(crc.low);
        for (let i = 22; i < 44; i++) {
          expect(sector.headerData.get(i)).toEqual(0x4e);
        }

        // --- Test sector prefix
        for (let i = 0; i < 12; i++) {
          expect(sector.sectorPrefix.get(i)).toEqual(0x00);
        }
        crc = new DiskCrc();
        expect(sector.sectorPrefix.get(12)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(13)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(14)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(15)).toEqual(0xfb);
        crc.add(0xfb);

        // --- Test sector data
        expect(sector.sectordata.length).toEqual(512);
        let datasum = 0x00;
        for (let i = 0; i < 512; i++) {
          const dataByte = sector.sectordata.get(i);
          datasum += dataByte;
          crc.add(dataByte);
        }
        if (trackIdx === 0 && sectorIdx === 0) {
          expect(datasum).toEqual(113765);  
        } else {
          expect(datasum).toEqual(512 * 0xe5);  
        }
        
        // --- A sector the dump read with a data CRC error (ST2 bit 5: ltk.dsk's track 12
        // --- protection) carries a wrong CRC on the surface, as on the real disk
        const crcFlip = (diskInfo.tracks[trackIdx].sectors[sectorIdx].SR2 & 0x20) !== 0 ? 0xff : 0x00;
        expect(sector.tailData.get(0)).toEqual(crc.high ^ crcFlip);
        expect(sector.tailData.get(1)).toEqual(crc.low ^ crcFlip);
        for (let i = 2; i < 26; i++) {
          expect(sector.tailData.get(i)).toEqual(0x4e);
        }
      }
    }
  });

  it("createDiskSurfaceView works #2", () => {
    const diskInfo = readDiskData(readTestFile("ltk.dsk"));
    const sv = createDiskSurface(diskInfo);
    expect(sv.tracks.length).toEqual(42);
    for (let trackIdx = 0; trackIdx < sv.tracks.length; trackIdx++) {
      const track = sv.tracks[trackIdx];
      const dskTrack = sv.tracks[trackIdx];

      // --- Test track length
      expect(track.trackData.length).toEqual(8596);

      // --- Test header
      expect(track.header.length).toEqual(48);
      for (let i = 0; i < 12; i++) {
        expect(track.header.get(i)).toEqual(0x00);
      }
      expect(track.header.get(12)).toEqual(0xa1);
      expect(track.header.get(13)).toEqual(0xa1);
      expect(track.header.get(14)).toEqual(0xa1);
      expect(track.header.get(15)).toEqual(0xfc);
      for (let i = 16; i < 48; i++) {
        expect(track.header.get(i)).toEqual(0x4e);
      }

      // --- Test sectors
      expect(track.sectors.length).toEqual(dskTrack.sectors.length);
      for (let sectorIdx = 0; sectorIdx < track.sectors.length; sectorIdx++) {
        const sector = track.sectors[sectorIdx];

        // --- Test sector header
        expect(sector.headerData.length).toEqual(44);
        for (let i = 0; i < 12; i++) {
          expect(sector.headerData.get(i)).toEqual(0x00);
        }
        let crc = new DiskCrc();
        expect(sector.headerData.get(12)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(13)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(14)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.headerData.get(15)).toEqual(0xfe);
        crc.add(0xfe);
        expect(sector.headerData.get(16)).toEqual(trackIdx);
        crc.add(trackIdx);
        expect(sector.headerData.get(17)).toEqual(0x00);
        crc.add(0x00);
        const sectorId = trackIdx === 12 && sectorIdx >= 4 ? sectorIdx + 2 : sectorIdx + 1;
        expect(sector.headerData.get(18)).toEqual(sectorId);
        crc.add(sectorId);
        expect(sector.headerData.get(19)).toEqual(0x02);
        crc.add(0x02);
        expect(sector.headerData.get(20)).toEqual(crc.high);
        expect(sector.headerData.get(21)).toEqual(crc.low);
        for (let i = 22; i < 44; i++) {
          expect(sector.headerData.get(i)).toEqual(0x4e);
        }

        // --- Test sector prefix
        for (let i = 0; i < 12; i++) {
          expect(sector.sectorPrefix.get(i)).toEqual(0x00);
        }
        crc = new DiskCrc();
        expect(sector.sectorPrefix.get(12)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(13)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(14)).toEqual(0xa1);
        crc.add(0xa1);
        expect(sector.sectorPrefix.get(15)).toEqual(0xfb);
        crc.add(0xfb);

        // --- Test sector data
        expect(sector.sectordata.length).toEqual(512);
        let datasum = 0x00;
        let dskDatasum = 0x00;
        for (let i = 0; i < 512; i++) {
          const dataByte = sector.sectordata.get(i);
          datasum += dataByte;
          dskDatasum += dskTrack.sectors[sectorIdx].sectordata.get(i)
          crc.add(dataByte);
        }
        expect(datasum).toEqual(dskDatasum);
        
        // --- A sector the dump read with a data CRC error (ST2 bit 5: ltk.dsk's track 12
        // --- protection) carries a wrong CRC on the surface, as on the real disk
        const crcFlip = (diskInfo.tracks[trackIdx].sectors[sectorIdx].SR2 & 0x20) !== 0 ? 0xff : 0x00;
        expect(sector.tailData.get(0)).toEqual(crc.high ^ crcFlip);
        expect(sector.tailData.get(1)).toEqual(crc.low ^ crcFlip);
        for (let i = 2; i < 26; i++) {
          expect(sector.tailData.get(i)).toEqual(0x4e);
        }
      }
    }
  });
});

export function readTestFile (filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}

describe("Disk surface from the DSK corpus", () => {
  it("writes a deleted data mark for a sector dumped with one", async () => {
    const { corpusDisk } = await import("./dskCorpus");
    const surface = createDiskSurface(corpusDisk("status-bytes"));
    const prefix = surface.tracks[6].sectors[3].sectorPrefix;
    expect(prefix.get(prefix.length - 1)).toBe(0xf8);
    const normal = surface.tracks[6].sectors[0].sectorPrefix;
    expect(normal.get(normal.length - 1)).toBe(0xfb);
  });

  it("puts one copy of a weak sector on the track and marks its bytes weak", async () => {
    const { corpusDisk, pattern } = await import("./dskCorpus");
    const surface = createDiskSurface(corpusDisk("weak-sectors"));
    const track = surface.tracks[4];
    const sector = track.sectors[2];
    expect(sector.sectordata.length).toBe(512);
    expect(sector.sectordata.view()).toEqual(pattern(4, 0, 3, 512, 0));
    const first = sector.sectordata.startOffset;
    expect(track.weakSectorData.getBit(first)).toBe(true);
    expect(track.weakSectorData.getBit(first + 511)).toBe(true);
    expect(track.weakSectorData.getBit(track.sectors[0].sectordata.startOffset)).toBe(false);
  });

  it("lays out a track of mixed sector sizes without overlap", async () => {
    const { corpusDisk, pattern } = await import("./dskCorpus");
    const track = createDiskSurface(corpusDisk("mixed-sizes")).tracks[1];
    expect(track.sectors.map((s) => s.sectordata.length)).toEqual([256, 512, 1024, 128]);
    expect(track.sectors[2].sectordata.view()).toEqual(pattern(1, 0, 3, 1024));
  });
});
