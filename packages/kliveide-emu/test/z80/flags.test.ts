import "mocha";

describe("Flags generation", () => {
  it("Generate SZ53_FLAGS/SZ53P_FLAGS", () => {
    let sz53 = '(data (i32.const 0x40_0A00) "';
    let sz53p = '(data (i32.const 0x40_0B00) "';
    for (let i = 0; i < 0x100; i++) {
      const flags = (i & 0xa8) | (i === 0 ? 0x40 : 0x00);
      sz53 += `\\${flags.toString(16).padStart(2, "0")}`;
      let j = i;
      let parity = 0;
      for (let k = 0; k < 8; k++) {
        parity ^= j & 1; 
        j >>=1;
      }
      parity = parity ? 0 : 0x04;
      sz53p += `\\${(flags | parity).toString(16).padStart(2, "0")}`;
    }
    sz53 += '")';
    console.log(sz53);
    sz53p += '")';
    console.log(sz53p);
  });
});
