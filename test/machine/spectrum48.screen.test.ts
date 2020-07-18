import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import { MachineApi } from "../../src/native/api";
import { ZxSpectrum48 } from "../../src/native/ZxSpectrum48";
import {
  ExecuteCycleOptions,
  EmulationMode,
} from "../../src/native/machine-state";
import { MemoryHelper } from "../../src/native/memory-helpers";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: MachineApi;
let machine: ZxSpectrum48;

const PIXEL_BUFFER = 0x08_A200;
const RENDERING_TABLE = 0x01_5e00;
const COLORIZE_BUFFER = 0x0B_4200;

describe("ZX Spectrum 48 - Screen", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
      imports: { trace: (arg: number) => console.log(arg) },
    });
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new ZxSpectrum48(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("ULA frame tact is OK", () => {
    const s = machine.getMachineState();
    expect(s.tactsInFrame).toBe(69888);
  });

  it("Flash toggle rate is OK", () => {
    const s = machine.getMachineState();
    expect(s.flashFrames).toBe(25);
  });

  it("Setting border value does not change invisible area", () => {
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x10,
      0x00, // LD BC,$0010
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0xfb, // EI
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800e);
    expect(s.tacts).toBe(451);
    expect(s.frameCompleted).toBe(false);
    const mh = new MemoryHelper(api, PIXEL_BUFFER);
    let sum = 0x00;
    for (let row = 0; row < s.screenLines; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        sum += mh.readByte(row * s.screenWidth + col);
      }
    }
    expect(sum).toBe(0xff * s.screenLines * s.screenWidth);
  });

  it("Setting border value changes border area #1", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x8d,
      0x00, // LD BC,$008C
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.tacts).toBe(3697);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let col = 0; col < 220; col++) {
      const pixel = mh.readByte(col);
      sum += pixel;
    }
    expect(sum).toBe(0x05 * 220);

    // --- Remaining line should be 0xff
    sum = 0;
    for (let col = 220; col < s.screenWidth; col++) {
      const pixel = mh.readByte(col);
      sum += pixel;
    }
    console.log(s.screenWidth);
    expect(sum).toBe(0xff * (s.screenWidth - 220));

    // --- Remaining screen part should be 0xff
    sum = 0x00;
    for (let row = 1; row < s.screenLines; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0xff * s.screenWidth * (s.screenLines - 1));
  });

  it("Setting border value changes border area #2", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x26,
      0x02, // LD BC,$0226
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.tacts).toBe(14331);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 47; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * 47);

    // --- Remaining line should be 0xff
    sum = 0;
    for (let col = 220; col < s.screenWidth; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0xff * (s.screenWidth - 220));

    // --- Remaining screen part should be 0xff
    sum = 0x00;
    const lastLine = s.lastDisplayLine + s.borderBottomLines;
    for (let row = 48; row < lastLine; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    console.log(s.screenLines);
    expect(sum).toBe(0xff * s.screenWidth * (lastLine - 48));
  });

  it("Setting border value changes border area #3", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x29,
      0x02, // LD BC,$0229
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0xfb, // EI
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800e);
    expect(s.tacts).toBe(14413);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 47; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * 47);

    // --- The left border of row 48 should be set to 0x05
    sum = 0;
    for (let col = 0; col < 48; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0x05 * 48);

    // --- The first 112 pixels of the first display row (48) should be set to 0
    sum = 0;
    for (let col = 48; col < 148; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0x00);

    // --- Remaining screen part should be 0xff
    sum = 0x00;
    const lastLine = s.lastDisplayLine + s.borderBottomLines;
    for (let row = 49; row < lastLine; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0xff * s.screenWidth * (lastLine - 49));
  });

  it("Border + empty pixels", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x75,
      0x0a, // LD BC,$0A75
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.tacts).toBe(69633);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 48; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * 48);

    // --- The left border of row 48 should be set to 0x05
    sum = 0;
    for (let col = 0; col < 48; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0x05 * 48);

    // --- Display rows should have a border value of 0x05 and a pixel value of 0x00
    for (let row = 48; row < 48 + 192; row++) {
      sum = 0x00;
      for (let col = 0; col < s.borderLeftPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderLeftPixels);

      sum = 0x00;
      for (let col = s.borderLeftPixels; col < s.screenWidth - s.borderRightPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x00);

      sum = 0x00;
      for (let col = s.screenWidth - s.borderRightPixels; col < s.screenWidth;  col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderRightPixels);
    }

    sum = 0;
    for (let row = 48 + 192 ; row < s.screenLines; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * (s.screenLines - 192 - 48));
  });

  it("Rendering with pattern #1", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x75,
      0x0a, // LD BC,$0A75
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);

    let mh = new MemoryHelper(api, 0);
    for (let addr = 0x4000; addr < 0x5800; addr++) {
      mh.writeByte(addr, addr & 0x0100 ? 0xaa : 0x55)
    }
    for (let addr = 0x5800; addr < 0x5b00; addr++) {
      mh.writeByte(addr, 0x51)
    }

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.tacts).toBe(69633);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 48; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * 48);

    // --- The left border of row 48 should be set to 0x05
    sum = 0;
    for (let col = 0; col < 48; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0x05 * 48);

    // --- Display rows should have a border value of 0x05 and a pixel value of 0x00
    for (let row = 48; row < 48 + 192; row++) {
      sum = 0x00;
      for (let col = 0; col < s.borderLeftPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderLeftPixels);

      sum = 0x00;
      let expectedSum = 0x00;
      for (let col = s.borderLeftPixels; col < s.screenWidth - s.borderRightPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
        expectedSum += (row + col) % 2 ? 0x09 : 0x0a
      }
      expect(sum).toBe(expectedSum);

      sum = 0x00;
      for (let col = s.screenWidth - s.borderRightPixels; col < s.screenWidth;  col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderRightPixels);
    }

    sum = 0;
    for (let row = 48 + 192 ; row < s.screenLines; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * (s.screenLines - 192 - 48));
  });

  it("Rendering until frame ends", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x75,
      0x0a, // LD BC,$0A75
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);

    let mh = new MemoryHelper(api, 0);
    for (let addr = 0x4000; addr < 0x5800; addr++) {
      mh.writeByte(addr, addr & 0x0100 ? 0xaa : 0x55)
    }
    for (let addr = 0x5800; addr < 0x5b00; addr++) {
      mh.writeByte(addr, 0x51)
    }

    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilUlaFrameEnds));
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.frameCompleted).toBe(true);
    expect(s.borderColor).toBe(0x05);
    mh = new MemoryHelper(api, PIXEL_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 48; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * 48);

    // --- The left border of row 48 should be set to 0x05
    sum = 0;
    for (let col = 0; col < 48; col++) {
      const pixel = mh.readByte(48 * s.screenWidth + col);
      sum += pixel;
    }
    expect(sum).toBe(0x05 * 48);

    // --- Display rows should have a border value of 0x05 and a pixel value of 0x00
    for (let row = 48; row < 48 + 192; row++) {
      sum = 0x00;
      for (let col = 0; col < s.borderLeftPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderLeftPixels);

      sum = 0x00;
      let expectedSum = 0x00;
      for (let col = s.borderLeftPixels; col < s.screenWidth - s.borderRightPixels; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
        expectedSum += (row + col) % 2 ? 0x09 : 0x0a
      }
      expect(sum).toBe(expectedSum);

      sum = 0x00;
      for (let col = s.screenWidth - s.borderRightPixels; col < s.screenWidth;  col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
      expect(sum).toBe(0x05 * s.borderRightPixels);
    }

    sum = 0;
    for (let row = 48 + 192 ; row < s.screenLines; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readByte(row * s.screenWidth + col);
        sum += pixel;
      }
    }
    expect(sum).toBe(0x05 * s.screenWidth * (s.screenLines - 192 - 48));
  });

  it("Display rendering table", () => {
    displayRenderingTable();
  });

  it("Colorize border + empty pixels", () => {
    machine.api.initZxSpectrum(0);
    machine.injectCode([
      0xf3, // DI
      0x3e,
      0x05, // LD A,$05
      0xd3,
      0xfe, // OUT ($FE),A
      0x01,
      0x75,
      0x0a, // LD BC,$0A75
      0x0b, // DECLB: DEC BC
      0x78, // LD A,B
      0xb1, // OR C
      0x20,
      0xfb, // JR NZ,DECLB
      0x76, // HALT
    ]);

    fillPixelBuffer(0xff);
    machine.executeCycle(new ExecuteCycleOptions(EmulationMode.UntilHalt));
    machine.api.colorize();
    const s = machine.getMachineState();
    expect(s.pc).toBe(0x800d);
    expect(s.tacts).toBe(69633);
    expect(s.frameCompleted).toBe(false);
    expect(s.borderColor).toBe(0x05);
    const mh = new MemoryHelper(api, COLORIZE_BUFFER);

    // --- Border pixels should be 0x05
    let sum = 0;
    for (let row = 0; row < 48; row++) {
      for (let col = 0; col < s.screenWidth; col++) {
        const pixel = mh.readUint32((row * s.screenWidth + col) * 4);
        if (pixel === (0xffaaaa00 - 0x100000000)) {
          sum++;
        }
      }
    }
    console.log(sum);
    // expect(sum).toBe(0x05 * s.screenWidth * 48);

    // // --- The left border of row 48 should be set to 0x05
    // sum = 0;
    // for (let col = 0; col < 48; col++) {
    //   const pixel = mh.readByte(48 * s.screenWidth + col);
    //   sum += pixel;
    // }
    // expect(sum).toBe(0x05 * 48);

    // // --- Display rows should have a border value of 0x05 and a pixel value of 0x00
    // for (let row = 48; row < 48 + 192; row++) {
    //   sum = 0x00;
    //   for (let col = 0; col < s.borderLeftPixels; col++) {
    //     const pixel = mh.readByte(row * s.screenWidth + col);
    //     sum += pixel;
    //   }
    //   expect(sum).toBe(0x05 * s.borderLeftPixels);

    //   sum = 0x00;
    //   for (let col = s.borderLeftPixels; col < s.screenWidth - s.borderRightPixels; col++) {
    //     const pixel = mh.readByte(row * s.screenWidth + col);
    //     sum += pixel;
    //   }
    //   expect(sum).toBe(0x00);

    //   sum = 0x00;
    //   for (let col = s.screenWidth - s.borderRightPixels; col < s.screenWidth;  col++) {
    //     const pixel = mh.readByte(row * s.screenWidth + col);
    //     sum += pixel;
    //   }
    //   expect(sum).toBe(0x05 * s.borderRightPixels);
    // }

    // sum = 0;
    // for (let row = 48 + 192 ; row < s.screenLines; row++) {
    //   for (let col = 0; col < s.screenWidth; col++) {
    //     const pixel = mh.readByte(row * s.screenWidth + col);
    //     sum += pixel;
    //   }
    // }
    // expect(sum).toBe(0x05 * s.screenWidth * (s.screenLines - 192 - 48));
  });

});

/**
 *
 * @param data Pixel buffer data
 */
function fillPixelBuffer(data: number): void {
  const s = machine.getMachineState();
  const mh = new MemoryHelper(api, PIXEL_BUFFER);
  const visibleLines =
    s.screenLines - s.nonVisibleBorderTopLines - s.nonVisibleBorderTopLines;
  const visibleColumns = (s.screenLineTime - s.nonVisibleBorderRightTime) * 2;
  const pixels = visibleLines * visibleColumns;
  for (let i = 0; i < pixels; i++) {
    mh.writeByte(i, data);
  }
}

function displayRenderingTable() {
  const s = machine.getMachineState();
  const mh = new MemoryHelper(api, RENDERING_TABLE);
  console.log(s.rasterLines);
  console.log(s.screenLineTime);

  let result = "";

  // --- Display horizontal axis
  result += "   |";
  for (let i = 0; i < s.screenLineTime; i++) {
    result += `${toHexa(i, 2)}|`;
  }
  result += "\r\n";
  displayAxis();

  let row = 0;
  displayRows(row, 0, s.verticalSyncLines);
  displayAxis();
  row += s.verticalSyncLines;
  displayRows(row, 0, s.nonVisibleBorderTopLines);
  displayAxis();
  row += s.nonVisibleBorderTopLines;
  displayRows(row, 0, s.borderTopLines);
  displayAxis();
  row += s.borderTopLines;
  displayRows(row, 0, s.displayLines);
  displayAxis();
  row += s.displayLines;
  displayRows(row, 0, s.borderBottomLines);
  displayAxis();
  row += s.borderBottomLines;
  displayRows(row, 0, s.nonVisibleBorderBottomLines);
  displayAxis();
  console.log(result);

  function displayRows(offset: number, fromRow: number, toRow: number): void {
    for (let j = fromRow; j < toRow; j++) {
      result += `${toHexa(offset + j, 3)}|`;
      for (let i = 0; i < s.screenLineTime; i++) {
        result += `${toHexa(
          mh.readByte(((j + offset) * s.screenLineTime + i) * 5),
          2
        )}|`;
      }
      result += "\r\n";
    }
  }

  function displayAxis(): void {
    result += "   ";
    for (let i = 0; i < s.screenLineTime; i++) {
      result += "---";
    }
    result += "-\r\n";
  }

  function toHexa(input: number, digits: number): string {
    return input.toString(16).toUpperCase().padStart(digits, "0");
  }
}
