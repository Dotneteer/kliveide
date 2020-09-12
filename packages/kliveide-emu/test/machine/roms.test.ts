// import "mocha";
// import * as fs from "fs";
// import * as path from "path";

// describe("ROM", () => {
//   it("Create ROM", () => {
//     const romFile = path.join(__dirname, "../../roms/ZxSpectrumP3E/ZxSpectrumP3E-3.rom");
//     const contents = fs.readFileSync(romFile);
    
//     let result = ""
//     for (let i = 0; i < contents.length; i += 256) {
//       let vals = "";
//       for (let j = i; j < i + 256 && j < contents.length; j++) {
//         const val = contents[j];
//         vals += `\\${(val < 16 ? "0" : "") + val.toString(16)}`;
//       }
//       const page = 0x8000 + i
//       result += `(data (i32.const 0x3_${page.toString(16).padStart(4, "0")}) "${vals}")\r\n`
//     }
//     console.log(result);
//   });
// });
