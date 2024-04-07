import "mocha";
import * as fs from "fs";

describe("generate bin", async () => {
  it("generate bin", async () => {
    const arr = new Uint8Array(14536);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (i+1) % 256;
    }
    fs.writeFileSync("/Users/dotneteer/colin_mc.bin", arr);
  });
});