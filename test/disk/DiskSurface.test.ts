import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { createDiskSurface } from "@emu/machines/disk/DiskSurface";
import { DiskCrc } from "@emu/machines/disk/DiskCrc";

describe("Disk Surface View", () => {
  it("createDiskSurfaceView works #1", () => {
    const sv = createDiskSurface(readTestFile("blank180K.dsk"));
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
        
        expect(sector.tailData.get(0)).toEqual(crc.high);
        expect(sector.tailData.get(1)).toEqual(crc.low);
        for (let i = 2; i < 26; i++) {
          expect(sector.tailData.get(i)).toEqual(0x4e);
        }
      }
    }
  });

  it("createDiskSurfaceView works #2", () => {
    const sv = createDiskSurface(readTestFile("ltk.dsk"));
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
        
        expect(sector.tailData.get(0)).toEqual(crc.high);
        expect(sector.tailData.get(1)).toEqual(crc.low);
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
