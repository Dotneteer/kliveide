import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - inc/dec operations", () => {
  it("inc", () => {
    testCodeEmit("inc a", 0x3c);
    testCodeEmit("inc b", 0x04);
    testCodeEmit("inc c", 0x0c);
    testCodeEmit("inc d", 0x14);
    testCodeEmit("inc e", 0x1c);
    testCodeEmit("inc h", 0x24);
    testCodeEmit("inc l", 0x2c);
    testCodeEmit("inc (hl)", 0x34);

    testCodeEmit("inc bc", 0x03);
    testCodeEmit("inc de", 0x13);
    testCodeEmit("inc hl", 0x23);
    testCodeEmit("inc sp", 0x33);

    testCodeEmit("inc ix", 0xdd, 0x23);
    testCodeEmit("inc iy", 0xfd, 0x23);

    testCodeEmit("inc xh", 0xdd, 0x24);
    testCodeEmit("inc xl", 0xdd, 0x2c);
    testCodeEmit("inc yh", 0xfd, 0x24);
    testCodeEmit("inc yl", 0xfd, 0x2c);

    testCodeEmit("inc ixh", 0xdd, 0x24);
    testCodeEmit("inc ixl", 0xdd, 0x2c);
    testCodeEmit("inc iyh", 0xfd, 0x24);
    testCodeEmit("inc iyl", 0xfd, 0x2c);
  });

  it("inc: indexed indirect", () => {
    testCodeEmit("inc (ix)", 0xdd, 0x34, 0x00);
    testCodeEmit("inc (ix+#1A)", 0xdd, 0x34, 0x1a);
    testCodeEmit("inc (ix-#32)", 0xdd, 0x34, 0xce);
    testCodeEmit("inc (ix+[3+4+5])", 0xdd, 0x34, 0x0c);
    testCodeEmit("inc (ix-[3+4+5])", 0xdd, 0x34, 0xf4);

    testCodeEmit("inc (iy)", 0xfd, 0x34, 0x00);
    testCodeEmit("inc (iy+#1A)", 0xfd, 0x34, 0x1a);
    testCodeEmit("inc (iy-#32)", 0xfd, 0x34, 0xce);
    testCodeEmit("inc (iy+[3+4+5])", 0xfd, 0x34, 0x0c);
    testCodeEmit("inc (iy-[3+4+5])", 0xfd, 0x34, 0xf4);
  });

  it("dec", () => {
    testCodeEmit("dec a", 0x3d);
    testCodeEmit("dec b", 0x05);
    testCodeEmit("dec c", 0x0d);
    testCodeEmit("dec d", 0x15);
    testCodeEmit("dec e", 0x1d);
    testCodeEmit("dec h", 0x25);
    testCodeEmit("dec l", 0x2d);
    testCodeEmit("dec (hl)", 0x35);

    testCodeEmit("dec bc", 0x0b);
    testCodeEmit("dec de", 0x1b);
    testCodeEmit("dec hl", 0x2b);
    testCodeEmit("dec sp", 0x3b);

    testCodeEmit("dec ix", 0xdd, 0x2b);
    testCodeEmit("dec iy", 0xfd, 0x2b);

    testCodeEmit("dec xh", 0xdd, 0x25);
    testCodeEmit("dec xl", 0xdd, 0x2d);
    testCodeEmit("dec yh", 0xfd, 0x25);
    testCodeEmit("dec yl", 0xfd, 0x2d);

    testCodeEmit("dec ixh", 0xdd, 0x25);
    testCodeEmit("dec ixl", 0xdd, 0x2d);
    testCodeEmit("dec iyh", 0xfd, 0x25);
    testCodeEmit("dec iyl", 0xfd, 0x2d);
  });

  it("dec: indexed indirect", () => {
    testCodeEmit("dec (ix)", 0xdd, 0x35, 0x00);
    testCodeEmit("dec (ix+#1A)", 0xdd, 0x35, 0x1a);
    testCodeEmit("dec (ix-#32)", 0xdd, 0x35, 0xce);
    testCodeEmit("dec (ix+[3+4+5])", 0xdd, 0x35, 0x0c);
    testCodeEmit("dec (ix-[3+4+5])", 0xdd, 0x35, 0xf4);

    testCodeEmit("dec (iy)", 0xfd, 0x35, 0x00);
    testCodeEmit("dec (iy+#1A)", 0xfd, 0x35, 0x1a);
    testCodeEmit("dec (iy-#32)", 0xfd, 0x35, 0xce);
    testCodeEmit("dec (iy+[3+4+5])", 0xfd, 0x35, 0x0c);
    testCodeEmit("dec (iy-[3+4+5])", 0xfd, 0x35, 0xf4);
  });

  it("inc: fails with invalid operand", () => {
    codeRaisesError("inc 123", "Z0604");
    codeRaisesError("inc (de)", "Z0604");
    codeRaisesError("inc af", "Z0604");
    codeRaisesError("inc i", "Z0604");
    codeRaisesError("inc (#1234)", "Z0604");
    codeRaisesError("dec 123", "Z0604");
    codeRaisesError("dec (de)", "Z0604");
    codeRaisesError("dec af", "Z0604");
    codeRaisesError("dec i", "Z0604");
    codeRaisesError("dec (#1234)", "Z0604");
  });

});
