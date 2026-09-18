import { beforeEach, describe, expect, it } from "vitest";

/*
 * The sprite collision flag — port $303B bit 0 — against the FPGA (`_input/next-fpga/src/video/sprites.vhd`):
 *
 *   status_reg_s(0) <= status_reg_s(0) or (spr_line_data_o(8) and spr_line_we)
 *
 * i.e. set when a sprite writes an opaque pixel into a line-buffer position another sprite already
 * wrote, whatever the clip window or "sprite 0 on top" say (both act after that write), and cleared by
 * reading the port. Shared by the WASM (`test/wasm/zxNext/wasm-next-sprites-collision`) and TypeScript
 * (`test/zxnext/SpriteDevice-collision`) engines.
 */

const TRANSPARENT = 0xe3;

/** What the scenarios need from an engine. */
export type SpriteCollisionEngine = {
  name: string;
  createMachine: () => Promise<SpriteCollisionMachine>;
  setNextReg: (machine: SpriteCollisionMachine, reg: number, value: number) => void;
  /** Run the sprite engine over one whole frame, as emulation would. */
  completeFrame: (machine: SpriteCollisionMachine) => void;
};

export type SpriteCollisionMachine = {
  hardReset(): void;
  doWritePort(address: number, value: number): void;
  doReadPort(address: number): number;
};

export function defineSpriteCollisionTests(engine: SpriteCollisionEngine) {
  let machine: SpriteCollisionMachine;

  beforeEach(async () => {
    machine = await engine.createMachine();
    machine.hardReset();
    setReg(0x15, 0x03); // --- sprites on, over the border
  });

  function setReg(reg: number, value: number) {
    engine.setNextReg(machine, reg, value);
  }

  /** Pattern 0: one opaque pixel at (0,0). Pattern 1: fully opaque. Pattern 2: fully transparent. */
  function uploadPatterns() {
    const memory = new Uint8Array(0x4000).fill(TRANSPARENT);
    memory[0] = 0x1c;
    memory.fill(0xe0, 256, 512);
    machine.doWritePort(0x303b, 0x00);
    for (const value of memory) machine.doWritePort(0x005b, value);
  }

  function setSprite(index: number, attrs: number[]) {
    machine.doWritePort(0x303b, index);
    for (const value of attrs) machine.doWritePort(0x0057, value);
  }

  function completeFrame() {
    engine.completeFrame(machine);
  }

  const readStatus = () => machine.doReadPort(0x303b);

  describe(`${engine.name}: sprite collisions`, () => {
    it("flags two opaque sprites overlapping, once per read", () => {
      uploadPatterns();
      setSprite(0, [40, 40, 0x00, 0x81]); // --- pattern 1, opaque, at (40, 40)
      setSprite(1, [48, 44, 0x00, 0x81]); // --- overlaps it

      expect(readStatus() & 0x01).toBe(0);
      completeFrame();
      expect(readStatus() & 0x01).toBe(1);
      // --- Reading clears it; nothing new has been drawn since.
      expect(readStatus() & 0x01).toBe(0);
    });

    it("is not raised when sprites only overlap on transparent pixels", () => {
      uploadPatterns();
      setSprite(0, [40, 40, 0x00, 0x80]); // --- pattern 0: only (0,0) is opaque
      setSprite(1, [41, 40, 0x00, 0x81]); // --- opaque from x 41: misses that pixel
      setSprite(2, [40, 40, 0x00, 0x82]); // --- pattern 2: fully transparent, right on top
      completeFrame();
      expect(readStatus() & 0x01).toBe(0);
    });

    it("is not raised by sprites that do not touch", () => {
      uploadPatterns();
      setSprite(0, [40, 40, 0x00, 0x81]);
      setSprite(1, [56, 40, 0x00, 0x81]); // --- starts where the first one ends
      completeFrame();
      expect(readStatus() & 0x01).toBe(0);
    });

    it("counts pixels outside the clip window, which only limits what is shown", () => {
      uploadPatterns();
      // --- Not over the border: the clip window is the ULA area, starting at sprite space (32, 32).
      setReg(0x15, 0x01);
      setSprite(0, [0, 0, 0x00, 0x81]);
      setSprite(1, [4, 4, 0x00, 0x81]);
      completeFrame();
      expect(readStatus() & 0x01).toBe(1);
    });

    it("is raised with sprite 0 on top too", () => {
      uploadPatterns();
      setReg(0x15, 0x43);
      setSprite(0, [40, 40, 0x00, 0x81]);
      setSprite(1, [44, 40, 0x00, 0x81]);
      completeFrame();
      expect(readStatus() & 0x01).toBe(1);
    });

    // --- "is not raised while sprites are disabled" was wrong: sprites.vhd runs whatever $15 bit 0 says (it
    // --- only gates the pixels, zxnext.vhd ~6880). test/zxnext-hw/sprites/sprites.test.ts SPR-025 covers it.
  });
}
