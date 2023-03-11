import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - inc/dec operations", async () => {
  it("inc", async () => {
    await testCodeEmit("inc a", 0x3c);
    await testCodeEmit("inc b", 0x04);
    await testCodeEmit("inc c", 0x0c);
    await testCodeEmit("inc d", 0x14);
    await testCodeEmit("inc e", 0x1c);
    await testCodeEmit("inc h", 0x24);
    await testCodeEmit("inc l", 0x2c);
    await testCodeEmit("inc (hl)", 0x34);

    await testCodeEmit("inc bc", 0x03);
    await testCodeEmit("inc de", 0x13);
    await testCodeEmit("inc hl", 0x23);
    await testCodeEmit("inc sp", 0x33);

    await testCodeEmit("inc ix", 0xdd, 0x23);
    await testCodeEmit("inc iy", 0xfd, 0x23);

    await testCodeEmit("inc xh", 0xdd, 0x24);
    await testCodeEmit("inc xl", 0xdd, 0x2c);
    await testCodeEmit("inc yh", 0xfd, 0x24);
    await testCodeEmit("inc yl", 0xfd, 0x2c);

    await testCodeEmit("inc ixh", 0xdd, 0x24);
    await testCodeEmit("inc ixl", 0xdd, 0x2c);
    await testCodeEmit("inc iyh", 0xfd, 0x24);
    await testCodeEmit("inc iyl", 0xfd, 0x2c);
  });

  it("inc: indexed indirect", async () => {
    await testCodeEmit("inc (ix)", 0xdd, 0x34, 0x00);
    await testCodeEmit("inc (ix+#1A)", 0xdd, 0x34, 0x1a);
    await testCodeEmit("inc (ix-#32)", 0xdd, 0x34, 0xce);
    await testCodeEmit("inc (ix+[3+4+5])", 0xdd, 0x34, 0x0c);
    await testCodeEmit("inc (ix-[3+4+5])", 0xdd, 0x34, 0xf4);

    await testCodeEmit("inc (iy)", 0xfd, 0x34, 0x00);
    await testCodeEmit("inc (iy+#1A)", 0xfd, 0x34, 0x1a);
    await testCodeEmit("inc (iy-#32)", 0xfd, 0x34, 0xce);
    await testCodeEmit("inc (iy+[3+4+5])", 0xfd, 0x34, 0x0c);
    await testCodeEmit("inc (iy-[3+4+5])", 0xfd, 0x34, 0xf4);
  });

  it("dec", async () => {
    await testCodeEmit("dec a", 0x3d);
    await testCodeEmit("dec b", 0x05);
    await testCodeEmit("dec c", 0x0d);
    await testCodeEmit("dec d", 0x15);
    await testCodeEmit("dec e", 0x1d);
    await testCodeEmit("dec h", 0x25);
    await testCodeEmit("dec l", 0x2d);
    await testCodeEmit("dec (hl)", 0x35);

    await testCodeEmit("dec bc", 0x0b);
    await testCodeEmit("dec de", 0x1b);
    await testCodeEmit("dec hl", 0x2b);
    await testCodeEmit("dec sp", 0x3b);

    await testCodeEmit("dec ix", 0xdd, 0x2b);
    await testCodeEmit("dec iy", 0xfd, 0x2b);

    await testCodeEmit("dec xh", 0xdd, 0x25);
    await testCodeEmit("dec xl", 0xdd, 0x2d);
    await testCodeEmit("dec yh", 0xfd, 0x25);
    await testCodeEmit("dec yl", 0xfd, 0x2d);

    await testCodeEmit("dec ixh", 0xdd, 0x25);
    await testCodeEmit("dec ixl", 0xdd, 0x2d);
    await testCodeEmit("dec iyh", 0xfd, 0x25);
    await testCodeEmit("dec iyl", 0xfd, 0x2d);
  });

  it("dec: indexed indirect", async () => {
    await testCodeEmit("dec (ix)", 0xdd, 0x35, 0x00);
    await testCodeEmit("dec (ix+#1A)", 0xdd, 0x35, 0x1a);
    await testCodeEmit("dec (ix-#32)", 0xdd, 0x35, 0xce);
    await testCodeEmit("dec (ix+[3+4+5])", 0xdd, 0x35, 0x0c);
    await testCodeEmit("dec (ix-[3+4+5])", 0xdd, 0x35, 0xf4);

    await testCodeEmit("dec (iy)", 0xfd, 0x35, 0x00);
    await testCodeEmit("dec (iy+#1A)", 0xfd, 0x35, 0x1a);
    await testCodeEmit("dec (iy-#32)", 0xfd, 0x35, 0xce);
    await testCodeEmit("dec (iy+[3+4+5])", 0xfd, 0x35, 0x0c);
    await testCodeEmit("dec (iy-[3+4+5])", 0xfd, 0x35, 0xf4);
  });

  it("inc: fails with invalid operand", async () => {
    await codeRaisesError("inc 123", "Z0604");
    await codeRaisesError("inc (de)", "Z0604");
    await codeRaisesError("inc af", "Z0604");
    await codeRaisesError("inc i", "Z0604");
    await codeRaisesError("inc (#1234)", "Z0604");
    await codeRaisesError("dec 123", "Z0604");
    await codeRaisesError("dec (de)", "Z0604");
    await codeRaisesError("dec af", "Z0604");
    await codeRaisesError("dec i", "Z0604");
    await codeRaisesError("dec (#1234)", "Z0604");
  });
});
