import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - alu operations", () => {
  it("add", () => {
    testCodeEmit("add a,b", 0x80);
    testCodeEmit("add a,c", 0x81);
    testCodeEmit("add a,d", 0x82);
    testCodeEmit("add a,e", 0x83);
    testCodeEmit("add a,h", 0x84);
    testCodeEmit("add a,l", 0x85);
    testCodeEmit("add a,(hl)", 0x86);
    testCodeEmit("add a,a", 0x87);

    testCodeEmit("add a,xh", 0xdd, 0x84);
    testCodeEmit("add a,xl", 0xdd, 0x85);
    testCodeEmit("add a,yh", 0xfd, 0x84);
    testCodeEmit("add a,yl", 0xfd, 0x85);
    testCodeEmit("add a,ixh", 0xdd, 0x84);
    testCodeEmit("add a,ixl", 0xdd, 0x85);
    testCodeEmit("add a,iyh", 0xfd, 0x84);
    testCodeEmit("add a,iyl", 0xfd, 0x85);

    testCodeEmit("add a,(ix)", 0xdd, 0x86, 0x00);
    testCodeEmit("add a,(ix+#0A)", 0xdd, 0x86, 0x0a);
    testCodeEmit("add a,(ix-8)", 0xdd, 0x86, 0xf8);
    testCodeEmit("add a,(iy)", 0xfd, 0x86, 0x00);
    testCodeEmit("add a,(iy+#0A)", 0xfd, 0x86, 0x0a);
    testCodeEmit("add a,(iy-8)", 0xfd, 0x86, 0xf8);
    testCodeEmit("add a,2+#0A*4", 0xC6, 0x2A);

    testCodeEmit("add hl,bc", 0x09);
    testCodeEmit("add hl,de", 0x19);
    testCodeEmit("add hl,hl", 0x29);
    testCodeEmit("add hl,sp", 0x39);

    testCodeEmit("add ix,bc", 0xDD, 0x09);
    testCodeEmit("add ix,de", 0xDD, 0x19);
    testCodeEmit("add ix,ix", 0xDD, 0x29);
    testCodeEmit("add ix,sp", 0xDD, 0x39);

    testCodeEmit("add iy,bc", 0xFD, 0x09);
    testCodeEmit("add iy,de", 0xFD, 0x19);
    testCodeEmit("add iy,iy", 0xFD, 0x29);
    testCodeEmit("add iy,sp", 0xFD, 0x39);

    testCodeEmit(".model next \r\n add hl,a", 0xED, 0x31);
    testCodeEmit(".model next \r\n add de,a", 0xED, 0x32);
    testCodeEmit(".model next \r\n add bc,a", 0xED, 0x33);
    testCodeEmit(".model next \r\n add hl,#1234", 0xED, 0x34, 0x34, 0x12);
    testCodeEmit(".model next \r\n add de,#1234", 0xED, 0x35, 0x34, 0x12);
    testCodeEmit(".model next \r\n add bc,#1234", 0xED, 0x36, 0x34, 0x12);
  });

  it("adc", () => {
    testCodeEmit("adc a,b", 0x88);
    testCodeEmit("adc a,c", 0x89);
    testCodeEmit("adc a,d", 0x8A);
    testCodeEmit("adc a,e", 0x8B);
    testCodeEmit("adc a,h", 0x8C);
    testCodeEmit("adc a,l", 0x8D);
    testCodeEmit("adc a,(hl)", 0x8E);
    testCodeEmit("adc a,a", 0x8F);

    testCodeEmit("adc a,xh", 0xDD, 0x8C);
    testCodeEmit("adc a,xl", 0xDD, 0x8D);
    testCodeEmit("adc a,yh", 0xFD, 0x8C);
    testCodeEmit("adc a,yl", 0xFD, 0x8D);
    testCodeEmit("adc a,ixh", 0xDD, 0x8C);
    testCodeEmit("adc a,ixl", 0xDD, 0x8D);
    testCodeEmit("adc a,iyh", 0xFD, 0x8C);
    testCodeEmit("adc a,iyl", 0xFD, 0x8D);

    testCodeEmit("adc a,(ix)", 0xDD, 0x8E, 0x00);
    testCodeEmit("adc a,(ix+#0A)", 0xDD, 0x8E, 0x0A);
    testCodeEmit("adc a,(ix-8)", 0xDD, 0x8E, 0xF8);
    testCodeEmit("adc a,(iy)", 0xFD, 0x8E, 0x00);
    testCodeEmit("adc a,(iy+#0A)", 0xFD, 0x8E, 0x0A);
    testCodeEmit("adc a,(iy-8)", 0xFD, 0x8E, 0xF8);
    testCodeEmit("adc a,2+#0A*4", 0xCE, 0x2A);

    testCodeEmit("adc hl,bc", 0xED, 0x4A);
    testCodeEmit("adc hl,de", 0xED, 0x5A);
    testCodeEmit("adc hl,hl", 0xED, 0x6A);
    testCodeEmit("adc hl,sp", 0xED, 0x7A);
  });

  it("sub", () => {
    testCodeEmit("sub b", 0x90);
    testCodeEmit("sub c", 0x91);
    testCodeEmit("sub d", 0x92);
    testCodeEmit("sub e", 0x93);
    testCodeEmit("sub h", 0x94);
    testCodeEmit("sub l", 0x95);
    testCodeEmit("sub (hl)", 0x96);
    testCodeEmit("sub a", 0x97);

    testCodeEmit("sub a,b", 0x90);
    testCodeEmit("sub a,c", 0x91);
    testCodeEmit("sub a,d", 0x92);
    testCodeEmit("sub a,e", 0x93);
    testCodeEmit("sub a,h", 0x94);
    testCodeEmit("sub a,l", 0x95);
    testCodeEmit("sub a,(hl)", 0x96);

    testCodeEmit("sub xh", 0xdd, 0x94);
    testCodeEmit("sub xl", 0xdd, 0x95);
    testCodeEmit("sub yh", 0xfd, 0x94);
    testCodeEmit("sub yl", 0xfd, 0x95);
    testCodeEmit("sub ixh", 0xdd, 0x94);
    testCodeEmit("sub ixl", 0xdd, 0x95);
    testCodeEmit("sub iyh", 0xfd, 0x94);
    testCodeEmit("sub iyl", 0xfd, 0x95);
    testCodeEmit("sub a,xh", 0xdd, 0x94);
    testCodeEmit("sub a,xl", 0xdd, 0x95);
    testCodeEmit("sub a,yh", 0xfd, 0x94);
    testCodeEmit("sub a,yl", 0xfd, 0x95);
    testCodeEmit("sub a,ixh", 0xdd, 0x94);
    testCodeEmit("sub a,ixl", 0xdd, 0x95);
    testCodeEmit("sub a,iyh", 0xfd, 0x94);
    testCodeEmit("sub a,iyl", 0xfd, 0x95);

    testCodeEmit("sub 2+#0A*4", 0xd6, 0x2a);
    testCodeEmit("sub (ix)", 0xdd, 0x96, 0x00);
    testCodeEmit("sub (ix+#0A)", 0xdd, 0x96, 0x0a);
    testCodeEmit("sub (ix-8)", 0xdd, 0x96, 0xf8);
    testCodeEmit("sub (iy)", 0xfd, 0x96, 0x00);
    testCodeEmit("sub (iy+#0A)", 0xfd, 0x96, 0x0a);
    testCodeEmit("sub (iy-8)", 0xfd, 0x96, 0xf8);
    testCodeEmit("sub a,2+#0A*4", 0xd6, 0x2a);
    testCodeEmit("sub a,(ix)", 0xdd, 0x96, 0x00);
    testCodeEmit("sub a,(ix+#0A)", 0xdd, 0x96, 0x0a);
    testCodeEmit("sub a,(ix-8)", 0xdd, 0x96, 0xf8);
    testCodeEmit("sub a,(iy)", 0xfd, 0x96, 0x00);
    testCodeEmit("sub a,(iy+#0A)", 0xfd, 0x96, 0x0a);
    testCodeEmit("sub a,(iy-8)", 0xfd, 0x96, 0xf8);
  });

  it("sbc", () => {
    testCodeEmit("sbc a,b", 0x98);
    testCodeEmit("sbc a,c", 0x99);
    testCodeEmit("sbc a,d", 0x9A);
    testCodeEmit("sbc a,e", 0x9B);
    testCodeEmit("sbc a,h", 0x9C);
    testCodeEmit("sbc a,l", 0x9D);
    testCodeEmit("sbc a,(hl)", 0x9E);
    testCodeEmit("sbc a,a", 0x9F);

    testCodeEmit("sbc a,xh", 0xDD, 0x9C);
    testCodeEmit("sbc a,xl", 0xDD, 0x9D);
    testCodeEmit("sbc a,yh", 0xFD, 0x9C);
    testCodeEmit("sbc a,yl", 0xFD, 0x9D);
    testCodeEmit("sbc a,ixh", 0xDD, 0x9C);
    testCodeEmit("sbc a,ixl", 0xDD, 0x9D);
    testCodeEmit("sbc a,iyh", 0xFD, 0x9C);
    testCodeEmit("sbc a,iyl", 0xFD, 0x9D);

    testCodeEmit("sbc a,(ix)", 0xDD, 0x9E, 0x00);
    testCodeEmit("sbc a,(ix+#0A)", 0xDD, 0x9E, 0x0A);
    testCodeEmit("sbc a,(ix-8)", 0xDD, 0x9E, 0xF8);
    testCodeEmit("sbc a,(iy)", 0xFD, 0x9E, 0x00);
    testCodeEmit("sbc a,(iy+#0A)", 0xFD, 0x9E, 0x0A);
    testCodeEmit("sbc a,(iy-8)", 0xFD, 0x9E, 0xF8);
    testCodeEmit("sbc a,2+#0A*4", 0xDE, 0x2A);

    testCodeEmit("sbc hl,bc", 0xED, 0x42);
    testCodeEmit("sbc hl,de", 0xED, 0x52);
    testCodeEmit("sbc hl,hl", 0xED, 0x62);
    testCodeEmit("sbc hl,sp", 0xED, 0x72);
});

  it("and", () => {
    testCodeEmit("and b", 0xa0);
    testCodeEmit("and c", 0xa1);
    testCodeEmit("and d", 0xa2);
    testCodeEmit("and e", 0xa3);
    testCodeEmit("and h", 0xa4);
    testCodeEmit("and l", 0xa5);
    testCodeEmit("and (hl)", 0xa6);
    testCodeEmit("and a", 0xa7);

    testCodeEmit("and a,b", 0xa0);
    testCodeEmit("and a,c", 0xa1);
    testCodeEmit("and a,d", 0xa2);
    testCodeEmit("and a,e", 0xa3);
    testCodeEmit("and a,h", 0xa4);
    testCodeEmit("and a,l", 0xa5);
    testCodeEmit("and a,(hl)", 0xa6);
    testCodeEmit("and a,a", 0xa7);

    testCodeEmit("and xh", 0xdd, 0xa4);
    testCodeEmit("and xl", 0xdd, 0xa5);
    testCodeEmit("and yh", 0xfd, 0xa4);
    testCodeEmit("and yl", 0xfd, 0xa5);
    testCodeEmit("and ixh", 0xdd, 0xa4);
    testCodeEmit("and ixl", 0xdd, 0xa5);
    testCodeEmit("and iyh", 0xfd, 0xa4);
    testCodeEmit("and iyl", 0xfd, 0xa5);
    testCodeEmit("and a,xh", 0xdd, 0xa4);
    testCodeEmit("and a,xl", 0xdd, 0xa5);
    testCodeEmit("and a,yh", 0xfd, 0xa4);
    testCodeEmit("and a,yl", 0xfd, 0xa5);
    testCodeEmit("and a,ixh", 0xdd, 0xa4);
    testCodeEmit("and a,ixl", 0xdd, 0xa5);
    testCodeEmit("and a,iyh", 0xfd, 0xa4);
    testCodeEmit("and a,iyl", 0xfd, 0xa5);

    testCodeEmit("and 2+#0A*4", 0xe6, 0x2a);
    testCodeEmit("and (ix)", 0xdd, 0xa6, 0x00);
    testCodeEmit("and (ix+#0A)", 0xdd, 0xa6, 0x0a);
    testCodeEmit("and (ix-8)", 0xdd, 0xa6, 0xf8);
    testCodeEmit("and (iy)", 0xfd, 0xa6, 0x00);
    testCodeEmit("and (iy+#0A)", 0xfd, 0xa6, 0x0a);
    testCodeEmit("and (iy-8)", 0xfd, 0xa6, 0xf8);
    testCodeEmit("and a,2+#0A*4", 0xe6, 0x2a);
    testCodeEmit("and a,(ix)", 0xdd, 0xa6, 0x00);
    testCodeEmit("and a,(ix+#0A)", 0xdd, 0xa6, 0x0a);
    testCodeEmit("and a,(ix-8)", 0xdd, 0xa6, 0xf8);
    testCodeEmit("and a,(iy)", 0xfd, 0xa6, 0x00);
    testCodeEmit("and a,(iy+#0A)", 0xfd, 0xa6, 0x0a);
    testCodeEmit("and a,(iy-8)", 0xfd, 0xa6, 0xf8);
  });

  it("xor", () => {
    testCodeEmit("xor b", 0xa8);
    testCodeEmit("xor c", 0xa9);
    testCodeEmit("xor d", 0xaa);
    testCodeEmit("xor e", 0xab);
    testCodeEmit("xor h", 0xac);
    testCodeEmit("xor l", 0xad);
    testCodeEmit("xor (hl)", 0xae);
    testCodeEmit("xor a", 0xaf);

    testCodeEmit("xor a,b", 0xa8);
    testCodeEmit("xor a,c", 0xa9);
    testCodeEmit("xor a,d", 0xaa);
    testCodeEmit("xor a,e", 0xab);
    testCodeEmit("xor a,h", 0xac);
    testCodeEmit("xor a,l", 0xad);
    testCodeEmit("xor a,(hl)", 0xae);
    testCodeEmit("xor a,a", 0xaf);

    testCodeEmit("xor xh", 0xdd, 0xac);
    testCodeEmit("xor xl", 0xdd, 0xad);
    testCodeEmit("xor yh", 0xfd, 0xac);
    testCodeEmit("xor yl", 0xfd, 0xad);
    testCodeEmit("xor ixh", 0xdd, 0xac);
    testCodeEmit("xor ixl", 0xdd, 0xad);
    testCodeEmit("xor iyh", 0xfd, 0xac);
    testCodeEmit("xor iyl", 0xfd, 0xad);
    testCodeEmit("xor a,xh", 0xdd, 0xac);
    testCodeEmit("xor a,xl", 0xdd, 0xad);
    testCodeEmit("xor a,yh", 0xfd, 0xac);
    testCodeEmit("xor a,yl", 0xfd, 0xad);
    testCodeEmit("xor a,ixh", 0xdd, 0xac);
    testCodeEmit("xor a,ixl", 0xdd, 0xad);
    testCodeEmit("xor a,iyh", 0xfd, 0xac);
    testCodeEmit("xor a,iyl", 0xfd, 0xad);

    testCodeEmit("xor 2+#0A*4", 0xee, 0x2a);
    testCodeEmit("xor (ix)", 0xdd, 0xae, 0x00);
    testCodeEmit("xor (ix+#0A)", 0xdd, 0xae, 0x0a);
    testCodeEmit("xor (ix-8)", 0xdd, 0xae, 0xf8);
    testCodeEmit("xor (iy)", 0xfd, 0xae, 0x00);
    testCodeEmit("xor (iy+#0A)", 0xfd, 0xae, 0x0a);
    testCodeEmit("xor (iy-8)", 0xfd, 0xae, 0xf8);
    testCodeEmit("xor a,2+#0A*4", 0xee, 0x2a);
    testCodeEmit("xor a,(ix)", 0xdd, 0xae, 0x00);
    testCodeEmit("xor a,(ix+#0A)", 0xdd, 0xae, 0x0a);
    testCodeEmit("xor a,(ix-8)", 0xdd, 0xae, 0xf8);
    testCodeEmit("xor a,(iy)", 0xfd, 0xae, 0x00);
    testCodeEmit("xor a,(iy+#0A)", 0xfd, 0xae, 0x0a);
    testCodeEmit("xor a,(iy-8)", 0xfd, 0xae, 0xf8);
  });

  it("or", () => {
    testCodeEmit("or b", 0xb0);
    testCodeEmit("or c", 0xb1);
    testCodeEmit("or d", 0xb2);
    testCodeEmit("or e", 0xb3);
    testCodeEmit("or h", 0xb4);
    testCodeEmit("or l", 0xb5);
    testCodeEmit("or (hl)", 0xb6);
    testCodeEmit("or a", 0xb7);

    testCodeEmit("or a,b", 0xb0);
    testCodeEmit("or a,c", 0xb1);
    testCodeEmit("or a,d", 0xb2);
    testCodeEmit("or a,e", 0xb3);
    testCodeEmit("or a,h", 0xb4);
    testCodeEmit("or a,l", 0xb5);
    testCodeEmit("or a,(hl)", 0xb6);
    testCodeEmit("or a", 0xb7);

    testCodeEmit("or xh", 0xdd, 0xb4);
    testCodeEmit("or xl", 0xdd, 0xb5);
    testCodeEmit("or yh", 0xfd, 0xb4);
    testCodeEmit("or yl", 0xfd, 0xb5);
    testCodeEmit("or ixh", 0xdd, 0xb4);
    testCodeEmit("or ixl", 0xdd, 0xb5);
    testCodeEmit("or iyh", 0xfd, 0xb4);
    testCodeEmit("or iyl", 0xfd, 0xb5);
    testCodeEmit("or a,xh", 0xdd, 0xb4);
    testCodeEmit("or a,xl", 0xdd, 0xb5);
    testCodeEmit("or a,yh", 0xfd, 0xb4);
    testCodeEmit("or a,yl", 0xfd, 0xb5);
    testCodeEmit("or a,ixh", 0xdd, 0xb4);
    testCodeEmit("or a,ixl", 0xdd, 0xb5);
    testCodeEmit("or a,iyh", 0xfd, 0xb4);
    testCodeEmit("or a,iyl", 0xfd, 0xb5);

    testCodeEmit("or 2+#0A*4", 0xf6, 0x2a);
    testCodeEmit("or (ix)", 0xdd, 0xb6, 0x00);
    testCodeEmit("or (ix+#0A)", 0xdd, 0xb6, 0x0a);
    testCodeEmit("or (ix-8)", 0xdd, 0xb6, 0xf8);
    testCodeEmit("or (iy)", 0xfd, 0xb6, 0x00);
    testCodeEmit("or (iy+#0A)", 0xfd, 0xb6, 0x0a);
    testCodeEmit("or (iy-8)", 0xfd, 0xb6, 0xf8);
    testCodeEmit("or a,2+#0A*4", 0xf6, 0x2a);
    testCodeEmit("or a,(ix)", 0xdd, 0xb6, 0x00);
    testCodeEmit("or a,(ix+#0A)", 0xdd, 0xb6, 0x0a);
    testCodeEmit("or a,(ix-8)", 0xdd, 0xb6, 0xf8);
    testCodeEmit("or a,(iy)", 0xfd, 0xb6, 0x00);
    testCodeEmit("or a,(iy+#0A)", 0xfd, 0xb6, 0x0a);
    testCodeEmit("or a,(iy-8)", 0xfd, 0xb6, 0xf8);
  });

  it("cp", () => {
    testCodeEmit("cp b", 0xb8);
    testCodeEmit("cp c", 0xb9);
    testCodeEmit("cp d", 0xba);
    testCodeEmit("cp e", 0xbb);
    testCodeEmit("cp h", 0xbc);
    testCodeEmit("cp l", 0xbd);
    testCodeEmit("cp (hl)", 0xbe);
    testCodeEmit("cp a", 0xbf);

    testCodeEmit("cp a,b", 0xb8);
    testCodeEmit("cp a,c", 0xb9);
    testCodeEmit("cp a,d", 0xba);
    testCodeEmit("cp a,e", 0xbb);
    testCodeEmit("cp a,h", 0xbc);
    testCodeEmit("cp a,l", 0xbd);
    testCodeEmit("cp a,(hl)", 0xbe);
    testCodeEmit("cp a,a", 0xbf);

    testCodeEmit("cp xh", 0xdd, 0xbc);
    testCodeEmit("cp xl", 0xdd, 0xbd);
    testCodeEmit("cp yh", 0xfd, 0xbc);
    testCodeEmit("cp yl", 0xfd, 0xbd);
    testCodeEmit("cp ixh", 0xdd, 0xbc);
    testCodeEmit("cp ixl", 0xdd, 0xbd);
    testCodeEmit("cp iyh", 0xfd, 0xbc);
    testCodeEmit("cp iyl", 0xfd, 0xbd);
    testCodeEmit("cp a,xh", 0xdd, 0xbc);
    testCodeEmit("cp a,xl", 0xdd, 0xbd);
    testCodeEmit("cp a,yh", 0xfd, 0xbc);
    testCodeEmit("cp a,yl", 0xfd, 0xbd);
    testCodeEmit("cp a,ixh", 0xdd, 0xbc);
    testCodeEmit("cp a,ixl", 0xdd, 0xbd);
    testCodeEmit("cp a,iyh", 0xfd, 0xbc);
    testCodeEmit("cp a,iyl", 0xfd, 0xbd);

    testCodeEmit("cp 2+#0A*4", 0xfe, 0x2a);
    testCodeEmit("cp (ix)", 0xdd, 0xbe, 0x00);
    testCodeEmit("cp (ix+#0A)", 0xdd, 0xbe, 0x0a);
    testCodeEmit("cp (ix-8)", 0xdd, 0xbe, 0xf8);
    testCodeEmit("cp (iy)", 0xfd, 0xbe, 0x00);
    testCodeEmit("cp (iy+#0A)", 0xfd, 0xbe, 0x0a);
    testCodeEmit("cp (iy-8)", 0xfd, 0xbe, 0xf8);
    testCodeEmit("cp a,2+#0A*4", 0xfe, 0x2a);
    testCodeEmit("cp a,(ix)", 0xdd, 0xbe, 0x00);
    testCodeEmit("cp a,(ix+#0A)", 0xdd, 0xbe, 0x0a);
    testCodeEmit("cp a,(ix-8)", 0xdd, 0xbe, 0xf8);
    testCodeEmit("cp a,(iy)", 0xfd, 0xbe, 0x00);
    testCodeEmit("cp a,(iy+#0A)", 0xfd, 0xbe, 0x0a);
    testCodeEmit("cp a,(iy-8)", 0xfd, 0xbe, 0xf8);
  });

  it("alu: fails with invalid operand", () => {
    codeRaisesError("add a,(bc)", "Z2043");
    codeRaisesError("add a,(de)", "Z2043");
    codeRaisesError("add ix,hl", "Z2043");
    codeRaisesError("add ix,iy", "Z2043");
    codeRaisesError("add iy,hl", "Z2043");
    codeRaisesError("add iy,ix", "Z2043");
    codeRaisesError("adc a,(bc)", "Z2043");
    codeRaisesError("adc a,(de)", "Z2043");
    codeRaisesError("sbc a,(bc)", "Z2043");
    codeRaisesError("sbc a,(de)", "Z2043");
    codeRaisesError("sub (bc)", "Z2043");
    codeRaisesError("sub (de)", "Z2043");
    codeRaisesError("sub a,(bc)", "Z2043");
    codeRaisesError("sub a,(de)", "Z2043");
    codeRaisesError("sub b,c", "Z2050");
    codeRaisesError("and (bc)", "Z2043");
    codeRaisesError("and (de)", "Z2043");
    codeRaisesError("and a,(bc)", "Z2043");
    codeRaisesError("and a,(de)", "Z2043");
    codeRaisesError("and b,c", "Z2050");
    codeRaisesError("xor (bc)", "Z2043");
    codeRaisesError("xor (de)", "Z2043");
    codeRaisesError("xor a,(bc)", "Z2043");
    codeRaisesError("xor a,(de)", "Z2043");
    codeRaisesError("xor b,c", "Z2050");
    codeRaisesError("or (bc)", "Z2043");
    codeRaisesError("or (de)", "Z2043");
    codeRaisesError("or a,(bc)", "Z2043");
    codeRaisesError("or a,(de)", "Z2043");
    codeRaisesError("or b,c", "Z2050");
    codeRaisesError("cp (bc)", "Z2043");
    codeRaisesError("cp (de)", "Z2043");
    codeRaisesError("cp a,(bc)", "Z2043");
    codeRaisesError("cp a,(de)", "Z2043");
    codeRaisesError("cp b,c", "Z2050");
  });
});
