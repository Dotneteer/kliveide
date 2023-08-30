import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { BinaryReader } from "@common/utils/BinaryReader";
import { DiskContents } from "@emu/machines/disk/DskFormat"

describe("DSK format", () => {
  it("readContents works #1", () => {
    const dsk = new DiskContents(readTestFile("blank180K.dsk"));

    expect(dsk.isExtendedFormat).toEqual(false);
    expect(dsk.diskInformation.creatorName).toEqual("");
    expect(dsk.diskInformation.numOfTracks).toEqual(40);
    expect(dsk.diskInformation.numOfSides).toEqual(1);
    expect(dsk.diskInformation.trackSize).toEqual(4864);
    expect(dsk.diskInformation.trackMsbs.length).toEqual(0);
  });

  it("readContents works #2", () => {
    const dsk = new DiskContents(readTestFile("ltk.dsk"));

    expect(dsk.isExtendedFormat).toEqual(true);
    expect(dsk.diskInformation.creatorName).toEqual("Moxon's Backup");
    expect(dsk.diskInformation.numOfTracks).toEqual(42);
    expect(dsk.diskInformation.numOfSides).toEqual(1);
    expect(dsk.diskInformation.trackSize).toEqual(0);
    expect(dsk.diskInformation.trackMsbs.length).toEqual(204);
  });

});

export function readTestFile (filename: string): BinaryReader {
    const fullname = path.join(__dirname, "../testfiles", filename);
    return new BinaryReader(fs.readFileSync(fullname));
  }
  