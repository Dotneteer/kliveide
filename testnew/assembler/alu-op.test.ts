import { describe, it } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - alu operations", async () => {
  it("add", async () => {
    await testCodeEmit("add a,b", 0x80);
    await testCodeEmit("add a,c", 0x81);
    await testCodeEmit("add a,d", 0x82);
    await testCodeEmit("add a,e", 0x83);
    await testCodeEmit("add a,h", 0x84);
    await testCodeEmit("add a,l", 0x85);
    await testCodeEmit("add a,(hl)", 0x86);
    await testCodeEmit("add a,a", 0x87);

    await testCodeEmit("add a,xh", 0xdd, 0x84);
    await testCodeEmit("add a,xl", 0xdd, 0x85);
    await testCodeEmit("add a,yh", 0xfd, 0x84);
    await testCodeEmit("add a,yl", 0xfd, 0x85);
    await testCodeEmit("add a,ixh", 0xdd, 0x84);
    await testCodeEmit("add a,ixl", 0xdd, 0x85);
    await testCodeEmit("add a,iyh", 0xfd, 0x84);
    await testCodeEmit("add a,iyl", 0xfd, 0x85);

    await testCodeEmit("add a,(ix)", 0xdd, 0x86, 0x00);
    await testCodeEmit("add a,(ix+#0A)", 0xdd, 0x86, 0x0a);
    await testCodeEmit("add a,(ix-8)", 0xdd, 0x86, 0xf8);
    await testCodeEmit("add a,(iy)", 0xfd, 0x86, 0x00);
    await testCodeEmit("add a,(iy+#0A)", 0xfd, 0x86, 0x0a);
    await testCodeEmit("add a,(iy-8)", 0xfd, 0x86, 0xf8);
    await testCodeEmit("add a,2+#0A*4", 0xc6, 0x2a);

    await testCodeEmit("add hl,bc", 0x09);
    await testCodeEmit("add hl,de", 0x19);
    await testCodeEmit("add hl,hl", 0x29);
    await testCodeEmit("add hl,sp", 0x39);

    await testCodeEmit("add ix,bc", 0xdd, 0x09);
    await testCodeEmit("add ix,de", 0xdd, 0x19);
    await testCodeEmit("add ix,ix", 0xdd, 0x29);
    await testCodeEmit("add ix,sp", 0xdd, 0x39);

    await testCodeEmit("add iy,bc", 0xfd, 0x09);
    await testCodeEmit("add iy,de", 0xfd, 0x19);
    await testCodeEmit("add iy,iy", 0xfd, 0x29);
    await testCodeEmit("add iy,sp", 0xfd, 0x39);

    await testCodeEmit(".model next \r\n add hl,a", 0xed, 0x31);
    await testCodeEmit(".model next \r\n add de,a", 0xed, 0x32);
    await testCodeEmit(".model next \r\n add bc,a", 0xed, 0x33);
    await testCodeEmit(".model next \r\n add hl,#1234", 0xed, 0x34, 0x34, 0x12);
    await testCodeEmit(".model next \r\n add de,#1234", 0xed, 0x35, 0x34, 0x12);
    await testCodeEmit(".model next \r\n add bc,#1234", 0xed, 0x36, 0x34, 0x12);
  });

  it("adc", async () => {
    await testCodeEmit("adc a,b", 0x88);
    await testCodeEmit("adc a,c", 0x89);
    await testCodeEmit("adc a,d", 0x8a);
    await testCodeEmit("adc a,e", 0x8b);
    await testCodeEmit("adc a,h", 0x8c);
    await testCodeEmit("adc a,l", 0x8d);
    await testCodeEmit("adc a,(hl)", 0x8e);
    await testCodeEmit("adc a,a", 0x8f);

    await testCodeEmit("adc a,xh", 0xdd, 0x8c);
    await testCodeEmit("adc a,xl", 0xdd, 0x8d);
    await testCodeEmit("adc a,yh", 0xfd, 0x8c);
    await testCodeEmit("adc a,yl", 0xfd, 0x8d);
    await testCodeEmit("adc a,ixh", 0xdd, 0x8c);
    await testCodeEmit("adc a,ixl", 0xdd, 0x8d);
    await testCodeEmit("adc a,iyh", 0xfd, 0x8c);
    await testCodeEmit("adc a,iyl", 0xfd, 0x8d);

    await testCodeEmit("adc a,(ix)", 0xdd, 0x8e, 0x00);
    await testCodeEmit("adc a,(ix+#0A)", 0xdd, 0x8e, 0x0a);
    await testCodeEmit("adc a,(ix-8)", 0xdd, 0x8e, 0xf8);
    await testCodeEmit("adc a,(iy)", 0xfd, 0x8e, 0x00);
    await testCodeEmit("adc a,(iy+#0A)", 0xfd, 0x8e, 0x0a);
    await testCodeEmit("adc a,(iy-8)", 0xfd, 0x8e, 0xf8);
    await testCodeEmit("adc a,2+#0A*4", 0xce, 0x2a);

    await testCodeEmit("adc hl,bc", 0xed, 0x4a);
    await testCodeEmit("adc hl,de", 0xed, 0x5a);
    await testCodeEmit("adc hl,hl", 0xed, 0x6a);
    await testCodeEmit("adc hl,sp", 0xed, 0x7a);
  });

  it("sub", async () => {
    await testCodeEmit("sub b", 0x90);
    await testCodeEmit("sub c", 0x91);
    await testCodeEmit("sub d", 0x92);
    await testCodeEmit("sub e", 0x93);
    await testCodeEmit("sub h", 0x94);
    await testCodeEmit("sub l", 0x95);
    await testCodeEmit("sub (hl)", 0x96);
    await testCodeEmit("sub a", 0x97);

    await testCodeEmit("sub a,b", 0x90);
    await testCodeEmit("sub a,c", 0x91);
    await testCodeEmit("sub a,d", 0x92);
    await testCodeEmit("sub a,e", 0x93);
    await testCodeEmit("sub a,h", 0x94);
    await testCodeEmit("sub a,l", 0x95);
    await testCodeEmit("sub a,(hl)", 0x96);

    await testCodeEmit("sub xh", 0xdd, 0x94);
    await testCodeEmit("sub xl", 0xdd, 0x95);
    await testCodeEmit("sub yh", 0xfd, 0x94);
    await testCodeEmit("sub yl", 0xfd, 0x95);
    await testCodeEmit("sub ixh", 0xdd, 0x94);
    await testCodeEmit("sub ixl", 0xdd, 0x95);
    await testCodeEmit("sub iyh", 0xfd, 0x94);
    await testCodeEmit("sub iyl", 0xfd, 0x95);
    await testCodeEmit("sub a,xh", 0xdd, 0x94);
    await testCodeEmit("sub a,xl", 0xdd, 0x95);
    await testCodeEmit("sub a,yh", 0xfd, 0x94);
    await testCodeEmit("sub a,yl", 0xfd, 0x95);
    await testCodeEmit("sub a,ixh", 0xdd, 0x94);
    await testCodeEmit("sub a,ixl", 0xdd, 0x95);
    await testCodeEmit("sub a,iyh", 0xfd, 0x94);
    await testCodeEmit("sub a,iyl", 0xfd, 0x95);

    await testCodeEmit("sub 2+#0A*4", 0xd6, 0x2a);
    await testCodeEmit("sub (ix)", 0xdd, 0x96, 0x00);
    await testCodeEmit("sub (ix+#0A)", 0xdd, 0x96, 0x0a);
    await testCodeEmit("sub (ix-8)", 0xdd, 0x96, 0xf8);
    await testCodeEmit("sub (iy)", 0xfd, 0x96, 0x00);
    await testCodeEmit("sub (iy+#0A)", 0xfd, 0x96, 0x0a);
    await testCodeEmit("sub (iy-8)", 0xfd, 0x96, 0xf8);
    await testCodeEmit("sub a,2+#0A*4", 0xd6, 0x2a);
    await testCodeEmit("sub a,(ix)", 0xdd, 0x96, 0x00);
    await testCodeEmit("sub a,(ix+#0A)", 0xdd, 0x96, 0x0a);
    await testCodeEmit("sub a,(ix-8)", 0xdd, 0x96, 0xf8);
    await testCodeEmit("sub a,(iy)", 0xfd, 0x96, 0x00);
    await testCodeEmit("sub a,(iy+#0A)", 0xfd, 0x96, 0x0a);
    await testCodeEmit("sub a,(iy-8)", 0xfd, 0x96, 0xf8);
  });

  it("sbc", async () => {
    await testCodeEmit("sbc a,b", 0x98);
    await testCodeEmit("sbc a,c", 0x99);
    await testCodeEmit("sbc a,d", 0x9a);
    await testCodeEmit("sbc a,e", 0x9b);
    await testCodeEmit("sbc a,h", 0x9c);
    await testCodeEmit("sbc a,l", 0x9d);
    await testCodeEmit("sbc a,(hl)", 0x9e);
    await testCodeEmit("sbc a,a", 0x9f);

    await testCodeEmit("sbc a,xh", 0xdd, 0x9c);
    await testCodeEmit("sbc a,xl", 0xdd, 0x9d);
    await testCodeEmit("sbc a,yh", 0xfd, 0x9c);
    await testCodeEmit("sbc a,yl", 0xfd, 0x9d);
    await testCodeEmit("sbc a,ixh", 0xdd, 0x9c);
    await testCodeEmit("sbc a,ixl", 0xdd, 0x9d);
    await testCodeEmit("sbc a,iyh", 0xfd, 0x9c);
    await testCodeEmit("sbc a,iyl", 0xfd, 0x9d);

    await testCodeEmit("sbc a,(ix)", 0xdd, 0x9e, 0x00);
    await testCodeEmit("sbc a,(ix+#0A)", 0xdd, 0x9e, 0x0a);
    await testCodeEmit("sbc a,(ix-8)", 0xdd, 0x9e, 0xf8);
    await testCodeEmit("sbc a,(iy)", 0xfd, 0x9e, 0x00);
    await testCodeEmit("sbc a,(iy+#0A)", 0xfd, 0x9e, 0x0a);
    await testCodeEmit("sbc a,(iy-8)", 0xfd, 0x9e, 0xf8);
    await testCodeEmit("sbc a,2+#0A*4", 0xde, 0x2a);

    await testCodeEmit("sbc hl,bc", 0xed, 0x42);
    await testCodeEmit("sbc hl,de", 0xed, 0x52);
    await testCodeEmit("sbc hl,hl", 0xed, 0x62);
    await testCodeEmit("sbc hl,sp", 0xed, 0x72);
  });

  it("and", async () => {
    await testCodeEmit("and b", 0xa0);
    await testCodeEmit("and c", 0xa1);
    await testCodeEmit("and d", 0xa2);
    await testCodeEmit("and e", 0xa3);
    await testCodeEmit("and h", 0xa4);
    await testCodeEmit("and l", 0xa5);
    await testCodeEmit("and (hl)", 0xa6);
    await testCodeEmit("and a", 0xa7);

    await testCodeEmit("and a,b", 0xa0);
    await testCodeEmit("and a,c", 0xa1);
    await testCodeEmit("and a,d", 0xa2);
    await testCodeEmit("and a,e", 0xa3);
    await testCodeEmit("and a,h", 0xa4);
    await testCodeEmit("and a,l", 0xa5);
    await testCodeEmit("and a,(hl)", 0xa6);
    await testCodeEmit("and a,a", 0xa7);

    await testCodeEmit("and xh", 0xdd, 0xa4);
    await testCodeEmit("and xl", 0xdd, 0xa5);
    await testCodeEmit("and yh", 0xfd, 0xa4);
    await testCodeEmit("and yl", 0xfd, 0xa5);
    await testCodeEmit("and ixh", 0xdd, 0xa4);
    await testCodeEmit("and ixl", 0xdd, 0xa5);
    await testCodeEmit("and iyh", 0xfd, 0xa4);
    await testCodeEmit("and iyl", 0xfd, 0xa5);
    await testCodeEmit("and a,xh", 0xdd, 0xa4);
    await testCodeEmit("and a,xl", 0xdd, 0xa5);
    await testCodeEmit("and a,yh", 0xfd, 0xa4);
    await testCodeEmit("and a,yl", 0xfd, 0xa5);
    await testCodeEmit("and a,ixh", 0xdd, 0xa4);
    await testCodeEmit("and a,ixl", 0xdd, 0xa5);
    await testCodeEmit("and a,iyh", 0xfd, 0xa4);
    await testCodeEmit("and a,iyl", 0xfd, 0xa5);

    await testCodeEmit("and 2+#0A*4", 0xe6, 0x2a);
    await testCodeEmit("and (ix)", 0xdd, 0xa6, 0x00);
    await testCodeEmit("and (ix+#0A)", 0xdd, 0xa6, 0x0a);
    await testCodeEmit("and (ix-8)", 0xdd, 0xa6, 0xf8);
    await testCodeEmit("and (iy)", 0xfd, 0xa6, 0x00);
    await testCodeEmit("and (iy+#0A)", 0xfd, 0xa6, 0x0a);
    await testCodeEmit("and (iy-8)", 0xfd, 0xa6, 0xf8);
    await testCodeEmit("and a,2+#0A*4", 0xe6, 0x2a);
    await testCodeEmit("and a,(ix)", 0xdd, 0xa6, 0x00);
    await testCodeEmit("and a,(ix+#0A)", 0xdd, 0xa6, 0x0a);
    await testCodeEmit("and a,(ix-8)", 0xdd, 0xa6, 0xf8);
    await testCodeEmit("and a,(iy)", 0xfd, 0xa6, 0x00);
    await testCodeEmit("and a,(iy+#0A)", 0xfd, 0xa6, 0x0a);
    await testCodeEmit("and a,(iy-8)", 0xfd, 0xa6, 0xf8);
  });

  it("xor", async () => {
    await testCodeEmit("xor b", 0xa8);
    await testCodeEmit("xor c", 0xa9);
    await testCodeEmit("xor d", 0xaa);
    await testCodeEmit("xor e", 0xab);
    await testCodeEmit("xor h", 0xac);
    await testCodeEmit("xor l", 0xad);
    await testCodeEmit("xor (hl)", 0xae);
    await testCodeEmit("xor a", 0xaf);

    await testCodeEmit("xor a,b", 0xa8);
    await testCodeEmit("xor a,c", 0xa9);
    await testCodeEmit("xor a,d", 0xaa);
    await testCodeEmit("xor a,e", 0xab);
    await testCodeEmit("xor a,h", 0xac);
    await testCodeEmit("xor a,l", 0xad);
    await testCodeEmit("xor a,(hl)", 0xae);
    await testCodeEmit("xor a,a", 0xaf);

    await testCodeEmit("xor xh", 0xdd, 0xac);
    await testCodeEmit("xor xl", 0xdd, 0xad);
    await testCodeEmit("xor yh", 0xfd, 0xac);
    await testCodeEmit("xor yl", 0xfd, 0xad);
    await testCodeEmit("xor ixh", 0xdd, 0xac);
    await testCodeEmit("xor ixl", 0xdd, 0xad);
    await testCodeEmit("xor iyh", 0xfd, 0xac);
    await testCodeEmit("xor iyl", 0xfd, 0xad);
    await testCodeEmit("xor a,xh", 0xdd, 0xac);
    await testCodeEmit("xor a,xl", 0xdd, 0xad);
    await testCodeEmit("xor a,yh", 0xfd, 0xac);
    await testCodeEmit("xor a,yl", 0xfd, 0xad);
    await testCodeEmit("xor a,ixh", 0xdd, 0xac);
    await testCodeEmit("xor a,ixl", 0xdd, 0xad);
    await testCodeEmit("xor a,iyh", 0xfd, 0xac);
    await testCodeEmit("xor a,iyl", 0xfd, 0xad);

    await testCodeEmit("xor 2+#0A*4", 0xee, 0x2a);
    await testCodeEmit("xor (ix)", 0xdd, 0xae, 0x00);
    await testCodeEmit("xor (ix+#0A)", 0xdd, 0xae, 0x0a);
    await testCodeEmit("xor (ix-8)", 0xdd, 0xae, 0xf8);
    await testCodeEmit("xor (iy)", 0xfd, 0xae, 0x00);
    await testCodeEmit("xor (iy+#0A)", 0xfd, 0xae, 0x0a);
    await testCodeEmit("xor (iy-8)", 0xfd, 0xae, 0xf8);
    await testCodeEmit("xor a,2+#0A*4", 0xee, 0x2a);
    await testCodeEmit("xor a,(ix)", 0xdd, 0xae, 0x00);
    await testCodeEmit("xor a,(ix+#0A)", 0xdd, 0xae, 0x0a);
    await testCodeEmit("xor a,(ix-8)", 0xdd, 0xae, 0xf8);
    await testCodeEmit("xor a,(iy)", 0xfd, 0xae, 0x00);
    await testCodeEmit("xor a,(iy+#0A)", 0xfd, 0xae, 0x0a);
    await testCodeEmit("xor a,(iy-8)", 0xfd, 0xae, 0xf8);
  });

  it("or", async () => {
    await testCodeEmit("or b", 0xb0);
    await testCodeEmit("or c", 0xb1);
    await testCodeEmit("or d", 0xb2);
    await testCodeEmit("or e", 0xb3);
    await testCodeEmit("or h", 0xb4);
    await testCodeEmit("or l", 0xb5);
    await testCodeEmit("or (hl)", 0xb6);
    await testCodeEmit("or a", 0xb7);

    await testCodeEmit("or a,b", 0xb0);
    await testCodeEmit("or a,c", 0xb1);
    await testCodeEmit("or a,d", 0xb2);
    await testCodeEmit("or a,e", 0xb3);
    await testCodeEmit("or a,h", 0xb4);
    await testCodeEmit("or a,l", 0xb5);
    await testCodeEmit("or a,(hl)", 0xb6);
    await testCodeEmit("or a", 0xb7);

    await testCodeEmit("or xh", 0xdd, 0xb4);
    await testCodeEmit("or xl", 0xdd, 0xb5);
    await testCodeEmit("or yh", 0xfd, 0xb4);
    await testCodeEmit("or yl", 0xfd, 0xb5);
    await testCodeEmit("or ixh", 0xdd, 0xb4);
    await testCodeEmit("or ixl", 0xdd, 0xb5);
    await testCodeEmit("or iyh", 0xfd, 0xb4);
    await testCodeEmit("or iyl", 0xfd, 0xb5);
    await testCodeEmit("or a,xh", 0xdd, 0xb4);
    await testCodeEmit("or a,xl", 0xdd, 0xb5);
    await testCodeEmit("or a,yh", 0xfd, 0xb4);
    await testCodeEmit("or a,yl", 0xfd, 0xb5);
    await testCodeEmit("or a,ixh", 0xdd, 0xb4);
    await testCodeEmit("or a,ixl", 0xdd, 0xb5);
    await testCodeEmit("or a,iyh", 0xfd, 0xb4);
    await testCodeEmit("or a,iyl", 0xfd, 0xb5);

    await testCodeEmit("or 2+#0A*4", 0xf6, 0x2a);
    await testCodeEmit("or (ix)", 0xdd, 0xb6, 0x00);
    await testCodeEmit("or (ix+#0A)", 0xdd, 0xb6, 0x0a);
    await testCodeEmit("or (ix-8)", 0xdd, 0xb6, 0xf8);
    await testCodeEmit("or (iy)", 0xfd, 0xb6, 0x00);
    await testCodeEmit("or (iy+#0A)", 0xfd, 0xb6, 0x0a);
    await testCodeEmit("or (iy-8)", 0xfd, 0xb6, 0xf8);
    await testCodeEmit("or a,2+#0A*4", 0xf6, 0x2a);
    await testCodeEmit("or a,(ix)", 0xdd, 0xb6, 0x00);
    await testCodeEmit("or a,(ix+#0A)", 0xdd, 0xb6, 0x0a);
    await testCodeEmit("or a,(ix-8)", 0xdd, 0xb6, 0xf8);
    await testCodeEmit("or a,(iy)", 0xfd, 0xb6, 0x00);
    await testCodeEmit("or a,(iy+#0A)", 0xfd, 0xb6, 0x0a);
    await testCodeEmit("or a,(iy-8)", 0xfd, 0xb6, 0xf8);
  });

  it("cp", async () => {
    await testCodeEmit("cp b", 0xb8);
    await testCodeEmit("cp c", 0xb9);
    await testCodeEmit("cp d", 0xba);
    await testCodeEmit("cp e", 0xbb);
    await testCodeEmit("cp h", 0xbc);
    await testCodeEmit("cp l", 0xbd);
    await testCodeEmit("cp (hl)", 0xbe);
    await testCodeEmit("cp a", 0xbf);

    await testCodeEmit("cp a,b", 0xb8);
    await testCodeEmit("cp a,c", 0xb9);
    await testCodeEmit("cp a,d", 0xba);
    await testCodeEmit("cp a,e", 0xbb);
    await testCodeEmit("cp a,h", 0xbc);
    await testCodeEmit("cp a,l", 0xbd);
    await testCodeEmit("cp a,(hl)", 0xbe);
    await testCodeEmit("cp a,a", 0xbf);

    await testCodeEmit("cp xh", 0xdd, 0xbc);
    await testCodeEmit("cp xl", 0xdd, 0xbd);
    await testCodeEmit("cp yh", 0xfd, 0xbc);
    await testCodeEmit("cp yl", 0xfd, 0xbd);
    await testCodeEmit("cp ixh", 0xdd, 0xbc);
    await testCodeEmit("cp ixl", 0xdd, 0xbd);
    await testCodeEmit("cp iyh", 0xfd, 0xbc);
    await testCodeEmit("cp iyl", 0xfd, 0xbd);
    await testCodeEmit("cp a,xh", 0xdd, 0xbc);
    await testCodeEmit("cp a,xl", 0xdd, 0xbd);
    await testCodeEmit("cp a,yh", 0xfd, 0xbc);
    await testCodeEmit("cp a,yl", 0xfd, 0xbd);
    await testCodeEmit("cp a,ixh", 0xdd, 0xbc);
    await testCodeEmit("cp a,ixl", 0xdd, 0xbd);
    await testCodeEmit("cp a,iyh", 0xfd, 0xbc);
    await testCodeEmit("cp a,iyl", 0xfd, 0xbd);

    await testCodeEmit("cp 2+#0A*4", 0xfe, 0x2a);
    await testCodeEmit("cp (ix)", 0xdd, 0xbe, 0x00);
    await testCodeEmit("cp (ix+#0A)", 0xdd, 0xbe, 0x0a);
    await testCodeEmit("cp (ix-8)", 0xdd, 0xbe, 0xf8);
    await testCodeEmit("cp (iy)", 0xfd, 0xbe, 0x00);
    await testCodeEmit("cp (iy+#0A)", 0xfd, 0xbe, 0x0a);
    await testCodeEmit("cp (iy-8)", 0xfd, 0xbe, 0xf8);
    await testCodeEmit("cp a,2+#0A*4", 0xfe, 0x2a);
    await testCodeEmit("cp a,(ix)", 0xdd, 0xbe, 0x00);
    await testCodeEmit("cp a,(ix+#0A)", 0xdd, 0xbe, 0x0a);
    await testCodeEmit("cp a,(ix-8)", 0xdd, 0xbe, 0xf8);
    await testCodeEmit("cp a,(iy)", 0xfd, 0xbe, 0x00);
    await testCodeEmit("cp a,(iy+#0A)", 0xfd, 0xbe, 0x0a);
    await testCodeEmit("cp a,(iy-8)", 0xfd, 0xbe, 0xf8);
  });

  it("alu: fails with invalid operand", async () => {
    codeRaisesError("add a,(bc)", "Z0604");
    codeRaisesError("add a,(de)", "Z0604");
    codeRaisesError("add ix,hl", "Z0604");
    codeRaisesError("add ix,iy", "Z0604");
    codeRaisesError("add iy,hl", "Z0604");
    codeRaisesError("add iy,ix", "Z0604");
    codeRaisesError("adc a,(bc)", "Z0604");
    codeRaisesError("adc a,(de)", "Z0604");
    codeRaisesError("sbc a,(bc)", "Z0604");
    codeRaisesError("sbc a,(de)", "Z0604");
    codeRaisesError("sub (bc)", "Z0604");
    codeRaisesError("sub (de)", "Z0604");
    codeRaisesError("sub a,(bc)", "Z0604");
    codeRaisesError("sub a,(de)", "Z0604");
    codeRaisesError("sub b,c", "Z0408");
    codeRaisesError("and (bc)", "Z0604");
    codeRaisesError("and (de)", "Z0604");
    codeRaisesError("and a,(bc)", "Z0604");
    codeRaisesError("and a,(de)", "Z0604");
    codeRaisesError("and b,c", "Z0408");
    codeRaisesError("xor (bc)", "Z0604");
    codeRaisesError("xor (de)", "Z0604");
    codeRaisesError("xor a,(bc)", "Z0604");
    codeRaisesError("xor a,(de)", "Z0604");
    codeRaisesError("xor b,c", "Z0408");
    codeRaisesError("or (bc)", "Z0604");
    codeRaisesError("or (de)", "Z0604");
    codeRaisesError("or a,(bc)", "Z0604");
    codeRaisesError("or a,(de)", "Z0604");
    codeRaisesError("or b,c", "Z0408");
    codeRaisesError("cp (bc)", "Z0604");
    codeRaisesError("cp (de)", "Z0604");
    codeRaisesError("cp a,(bc)", "Z0604");
    codeRaisesError("cp a,(de)", "Z0604");
    codeRaisesError("cp b,c", "Z0408");
  });
});
