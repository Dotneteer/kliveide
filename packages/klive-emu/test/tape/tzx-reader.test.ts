import "mocha";
import * as fs from "fs";
import * as path from "path";
import * as expect from "expect";

import { BinaryReader } from "../../src/core/utils/BinaryReader";
import { TzxReader } from "../../src/extensions/vm-zx-spectrum/tzx-file";

describe("Tape - TZX Reader", () => {
  it("Can read TZX file", () => {
      const filename = path.join(__dirname, "Pac-Man.tzx");
      const contents = fs.readFileSync(filename);
      const reader = new BinaryReader(contents);
      const tzxReader = new TzxReader(reader);

      expect(tzxReader.readContents()).toBe(true);
  });
});
