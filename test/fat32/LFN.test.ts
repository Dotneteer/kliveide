import { describe, it, expect } from "vitest";
import { calcShortNameCheckSum, convertLongToShortName, getLongFileFatEntries } from "@main/fat32/file-names";
import { FNAME_FLAG_LOST_CHARS } from "@main/fat32/Fat32Types";
import { FatLongFileName } from "@main/fat32/FatLongFileName";
import { FatDirEntry } from "@main/fat32/FatDirEntry";

describe("Long file names", () => {
  const lfnCases = [
    { ln : "The quick brown.fox", conflict: 1, sn: "THEQUI~2.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", conflict: 3, sn: "THEQUI~4.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", conflict: 8, sn: "THEQUI~9.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", conflict: 9, sn: "THEQU~10.FOX", seq: 5, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", conflict: 44, sn: "THEQU~45.FOX", seq: 5, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", conflict: 99, sn: "THEQ~100.FOX", seq: 4, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The quick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The*quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The+quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The,quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The.quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The/quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The:quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The;quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The<quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The=quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The>quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\"quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The|quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The[quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\\quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The]quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x00quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x01quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x02quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x03quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x04quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x05quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x06quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x07quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x08quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x09quick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0aquick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0bquick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0cquick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0dquick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0equick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x0fquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x10quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x11quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x12quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x13quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x14quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x15quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x16quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x17quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x18quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x19quick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1aquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1bquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1cquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1dquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1equick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x1fquick brown.fox", sn: "THE_QU~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x80quick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
    { ln : "The\x81quick brown.fox", sn: "THEQUI~1.FOX", seq: 6, fl: FNAME_FLAG_LOST_CHARS },
  ];
  lfnCases.forEach((lfnCase) => {
    it(`Case (${lfnCase.ln})`, () => {
      // --- Act
      const sfn = convertLongToShortName(lfnCase.ln, lfnCase.conflict ?? 0);

      // --- Assert
      expect(sfn.name).toBe(lfnCase.sn);
      expect(sfn.seqPos).toBe(lfnCase.seq);
      expect(sfn.flags).toBe(lfnCase.fl);
    });
  });

  it("getLongFatEntries works #1", () => {
    // --- Act
    const lfn = "The quick brown.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("o".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual(0x0000);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);
    
    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #2", () => {
    // --- Act
    const lfn = "The quick brown1234567.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("3".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("4".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("5".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("6".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual("7".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[5]).toEqual("f".charCodeAt(0));

    expect(lfn1.LDIR_Name3[0]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name3[1]).toEqual("x".charCodeAt(0));

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #3", () => {
    // --- Act
    const lfn = "The quick brown123456.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("3".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("4".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("5".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("6".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name2[5]).toEqual("o".charCodeAt(0));

    expect(lfn1.LDIR_Name3[0]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name3[1]).toEqual(0x0000);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #4", () => {
    // --- Act
    const lfn = "The quick brown12345.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("3".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("4".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("5".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name2[5]).toEqual("x".charCodeAt(0));

    expect(lfn1.LDIR_Name3[0]).toEqual(0x0000);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #5", () => {
    // --- Act
    const lfn = "The quick brown1234.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("3".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("4".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name2[5]).toEqual(0x0000);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #6", () => {
    // --- Act
    const lfn = "The quick brown123.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("3".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual(0x0000);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #7", () => {
    // --- Act
    const lfn = "The quick brown12.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("2".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual(".".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual(0x0000);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #8", () => {
    // --- Act
    const lfn = "The quick brown1.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("n".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("1".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("f".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual(0x0000);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #9", () => {
    // --- Act
    const lfn = "The quick brow.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("w".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("x".charCodeAt(0));

    expect(lfn1.LDIR_Name2[0]).toEqual(0x0000);
    expect(lfn1.LDIR_Name2[1]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #10", () => {
    // --- Act
    const lfn = "The quick bro.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual(0x0000);

    expect(lfn1.LDIR_Name2[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[1]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #11", () => {
    // --- Act
    const lfn = "The quick br.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual(0x0000);
    expect(lfn1.LDIR_Name1[4]).toEqual(0xffff);

    expect(lfn1.LDIR_Name2[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[1]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("r".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual(".".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #12", () => {
    // --- Act
    const lfn = "The quick b.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual(0x0000);
    expect(lfn1.LDIR_Name1[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name1[4]).toEqual(0xffff);

    expect(lfn1.LDIR_Name2[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[1]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual("b".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual(".".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("f".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #13", () => {
    // --- Act
    const lfn = "The quick .fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(3);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x42);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("x".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual(0x0000);
    expect(lfn1.LDIR_Name1[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name1[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name1[4]).toEqual(0xffff);

    expect(lfn1.LDIR_Name2[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[1]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[2]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[3]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[4]).toEqual(0xffff);
    expect(lfn1.LDIR_Name2[5]).toEqual(0xffff);

    expect(lfn1.LDIR_Name3[0]).toEqual(0xffff);
    expect(lfn1.LDIR_Name3[1]).toEqual(0xffff);

    const lfn2 = entries[1] as FatLongFileName;
    expect(lfn2.LDIR_Ord).toBe(0x01);
    expect(lfn2.LDIR_Attr).toBe(0x0f);
    expect(lfn2.LDIR_Type).toBe(0);
    expect(lfn2.LDIR_Chksum).toBe(checksum);
    expect(lfn2.LDIR_FstClusLO).toBe(0);
    expect(lfn2.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn2.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn2.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn2.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn2.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn2.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn2.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn2.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn2.LDIR_Name2[4]).toEqual(" ".charCodeAt(0));
    expect(lfn2.LDIR_Name2[5]).toEqual(".".charCodeAt(0));
    expect(lfn2.LDIR_Name3[0]).toEqual("f".charCodeAt(0));
    expect(lfn2.LDIR_Name3[1]).toEqual("o".charCodeAt(0));

    const lfn3 = entries[2] as FatDirEntry;
    expect(lfn3.DIR_Name).toBe(shortName);
    expect(lfn3.DIR_Attr).toBe(0x20);
    expect(lfn3.DIR_NTRes).toBe(0);
    expect(lfn3.DIR_CrtTimeTenth).toBe(0);
    expect(lfn3.DIR_CrtTime).toBe(0);
    expect(lfn3.DIR_CrtDate).toBe(0);
    expect(lfn3.DIR_LstAccDate).toBe(0);
    expect(lfn3.DIR_FstClusHI).toBe(0);
    expect(lfn3.DIR_WrtTime).toBe(0);
    expect(lfn3.DIR_WrtDate).toBe(0);
    expect(lfn3.DIR_FstClusLO).toBe(0);
    expect(lfn3.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #14", () => {
    // --- Act
    const lfn = "The quick.fox";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const checksum = calcShortNameCheckSum(shortName);
    expect(entries).toHaveLength(2);

    const lfn1 = entries[0] as FatLongFileName;
    expect(lfn1.LDIR_Ord).toBe(0x41);
    expect(lfn1.LDIR_Attr).toBe(0x0f);
    expect(lfn1.LDIR_Type).toBe(0);
    expect(lfn1.LDIR_Chksum).toBe(checksum);
    expect(lfn1.LDIR_FstClusLO).toBe(0);
    expect(lfn1.LDIR_Name1[0]).toEqual("T".charCodeAt(0));
    expect(lfn1.LDIR_Name1[1]).toEqual("h".charCodeAt(0));
    expect(lfn1.LDIR_Name1[2]).toEqual("e".charCodeAt(0));
    expect(lfn1.LDIR_Name1[3]).toEqual(" ".charCodeAt(0));
    expect(lfn1.LDIR_Name1[4]).toEqual("q".charCodeAt(0));
    expect(lfn1.LDIR_Name2[0]).toEqual("u".charCodeAt(0));
    expect(lfn1.LDIR_Name2[1]).toEqual("i".charCodeAt(0));
    expect(lfn1.LDIR_Name2[2]).toEqual("c".charCodeAt(0));
    expect(lfn1.LDIR_Name2[3]).toEqual("k".charCodeAt(0));
    expect(lfn1.LDIR_Name2[4]).toEqual(".".charCodeAt(0));
    expect(lfn1.LDIR_Name2[5]).toEqual("f".charCodeAt(0));
    expect(lfn1.LDIR_Name3[0]).toEqual("o".charCodeAt(0));
    expect(lfn1.LDIR_Name3[1]).toEqual("x".charCodeAt(0));

    const lfn2 = entries[1] as FatDirEntry;
    expect(lfn2.DIR_Name).toBe(shortName);
    expect(lfn2.DIR_Attr).toBe(0x20);
    expect(lfn2.DIR_NTRes).toBe(0);
    expect(lfn2.DIR_CrtTimeTenth).toBe(0);
    expect(lfn2.DIR_CrtTime).toBe(0);
    expect(lfn2.DIR_CrtDate).toBe(0);
    expect(lfn2.DIR_LstAccDate).toBe(0);
    expect(lfn2.DIR_FstClusHI).toBe(0);
    expect(lfn2.DIR_WrtTime).toBe(0);
    expect(lfn2.DIR_WrtDate).toBe(0);
    expect(lfn2.DIR_FstClusLO).toBe(0);
    expect(lfn2.DIR_FileSize).toBe(0);
  });

  it("getLongFatEntries works #14", () => {
    // --- Act
    const lfn = "LICENSE.TXT";
    const entries = getLongFileFatEntries(lfn);

    // --- Assert
    const sfn = convertLongToShortName(lfn);
    const shortParts = sfn.name.split(".");
    const shortName = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    expect(entries).toHaveLength(1);

    const lfn2 = entries[0] as FatDirEntry;
    expect(lfn2.DIR_Name).toBe(shortName);
    expect(lfn2.DIR_Attr).toBe(0x20);
    expect(lfn2.DIR_NTRes).toBe(0);
    expect(lfn2.DIR_CrtTimeTenth).toBe(0);
    expect(lfn2.DIR_CrtTime).toBe(0);
    expect(lfn2.DIR_CrtDate).toBe(0);
    expect(lfn2.DIR_LstAccDate).toBe(0);
    expect(lfn2.DIR_FstClusHI).toBe(0);
    expect(lfn2.DIR_WrtTime).toBe(0);
    expect(lfn2.DIR_WrtDate).toBe(0);
    expect(lfn2.DIR_FstClusLO).toBe(0);
    expect(lfn2.DIR_FileSize).toBe(0);
  });
});