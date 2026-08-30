import { describe, expect, it } from "vitest";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";

const HEADER_SIZE = 512;
const BANK_SIZE = 0x4000;

describe("NexFileViewerPanel", () => {
  it("reads bank data using NEX file order and actual bank flags", () => {
    const contents = new Uint8Array(HEADER_SIZE + BANK_SIZE * 3);

    contents.set([0x4e, 0x65, 0x78, 0x74], 0); // Next
    contents.set([0x56, 0x31, 0x2e, 0x32], 4); // V1.2
    contents[9] = 3;
    contents[18 + 0] = 1;
    contents[18 + 2] = 1;
    contents[18 + 5] = 1;

    contents[HEADER_SIZE] = 0x55;
    contents[HEADER_SIZE + BANK_SIZE] = 0x22;
    contents[HEADER_SIZE + BANK_SIZE * 2] = 0x00;

    const result = loadNexFileContents(contents);

    expect(result.error).toBeUndefined();
    expect(result.fileInfo?.header.bankFlags[0]).toBe(true);
    expect(result.fileInfo?.header.bankFlags[2]).toBe(true);
    expect(result.fileInfo?.header.bankFlags[5]).toBe(true);
    expect(result.fileInfo?.bankData.map(([bank]) => bank)).toEqual([5, 2, 0]);
    expect(result.fileInfo?.bankData.map(([, data]) => data[0])).toEqual([
      0x55,
      0x22,
      0x00
    ]);
  });
});
