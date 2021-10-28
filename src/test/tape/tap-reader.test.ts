import "mocha";
import * as fs from "fs";
import * as path from "path";
import * as expect from "expect";

import { BinaryReader } from "../../core/utils/BinaryReader";
import { TapReader } from "../../modules/vm-zx-spectrum/tap-file";

describe("Tape - TAP Reader", () => {
  it("Can read TZX file", () => {
      const filename = path.join(__dirname, "TreasureIsland.tap");
      const contents = fs.readFileSync(filename);
      const reader = new BinaryReader(contents);
      const tzxReader = new TapReader(reader);

      expect(tzxReader.readContents()).toBe(true);
  });
});
